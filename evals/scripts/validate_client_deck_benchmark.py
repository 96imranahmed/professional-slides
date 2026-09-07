"""Audit corpus coverage and immutable evidence; does not replace PPTX judges."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

DIMENSIONS = (
    "insight", "decisionCompleteness", "copy", "evidenceDensity",
    "exhibitChoice", "visualHierarchy", "deckRhythm",
)


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit(manifest, base):
    """Return an explicit incomplete verdict for missing, stale, or failed cases."""
    errors = []
    counts = Counter()

    def fail(location, message):
        errors.append({"location": location, "message": message})

    def artifact(record, location, parse=False):
        if not isinstance(record, dict) or not record.get("path") or not record.get("sha256"):
            fail(location, "Missing file path or SHA-256")
            return None
        path = Path(record["path"])
        path = path if path.is_absolute() else base / path
        if not path.is_file():
            fail(location, "Evidence file is missing")
            return None
        if sha256(path) != record["sha256"]:
            fail(location, "Evidence hash is stale")
            return None
        if not parse:
            return path
        try:
            return json.loads(path.read_text())
        except (ValueError, UnicodeError):
            fail(location, "Evidence is not valid JSON")
            return None

    def scores(value, location):
        if not isinstance(value, dict) or set(value) != set(DIMENSIONS):
            fail(location, "Every benchmark dimension must be scored separately")
            return
        if any(type(v) is not int or not 90 <= v <= 100 for v in value.values()):
            fail(location, "A benchmark dimension is below 90 or invalid")

    def pages(value, location):
        if (not isinstance(value, list) or not value
                or any(type(p) is not int or p < 1 for p in value)
                or len(set(value)) != len(value)):
            fail(location, "Expected distinct positive one-based page numbers")
            return set()
        return set(value)

    if not isinstance(manifest, dict):
        return {"schemaVersion": 1, "accepted": False, "counts": {}, "errors": [{"location": "manifest", "message": "Expected a JSON object"}]}
    if manifest.get("schemaVersion") != 1:
        fail("manifest", "Unsupported schema version")
    inventory = artifact(manifest.get("inventory"), "inventory", parse=True)
    if not isinstance(inventory, list) or not inventory:
        fail("inventory", "A hash-bound complete listing inventory is required")
        inventory = []
    inventory_ids = [r.get("id") for r in inventory if isinstance(r, dict)]
    if (len(inventory_ids) != len(inventory) or any(not isinstance(i, str) or not i for i in inventory_ids)
            or len(set(inventory_ids)) != len(inventory_ids)):
        fail("inventory", "Listing inventory IDs must be nonempty strings and unique")
        inventory_ids = [i for i in inventory_ids if isinstance(i, str) and i]
    inventory_by_id = {r["id"]: r for r in inventory if isinstance(r, dict) and isinstance(r.get("id"), str)}
    counts["listingEntries"] = len(inventory_ids)
    sources = manifest.get("sources", [])
    if not isinstance(sources, list) or not sources:
        fail("sources", "The corpus inventory is missing")
        sources = []
    if any(not isinstance(s, dict) for s in sources):
        fail("sources", "Each source must be an object")
        sources = [s for s in sources if isinstance(s, dict)]
    ids = [s.get("id") for s in sources]
    if any(not isinstance(i, str) or not i for i in ids):
        fail("sources", "Source IDs must be nonempty strings")
        sources = [s for s in sources if isinstance(s.get("id"), str) and s["id"]]
        ids = [s["id"] for s in sources]
    if len(set(ids)) != len(ids):
        fail("sources", "Source IDs must be present and unique")
    listed = {s.get("listingId", s["id"]) for s in sources}
    if listed != set(inventory_ids):
        fail("sources", "Every listing entry must have an admission record; extra unlisted entries are invalid")
    source_by_id = {s.get("id"): s for s in sources}
    case_ids = set()
    for source in sources:
        sid = source.get("id", "unknown")
        status = source.get("status")
        original = inventory_by_id.get(source.get("listingId", sid), {})
        if source.get("listingUrl") != original.get("listingUrl"):
            fail(sid, "Admission record must retain the inventoried listing URL")
        counts["listedSources"] += 1
        if not source.get("listingUrl") or not source.get("documentUrl") or not source.get("reason"):
            fail(sid, "Every admission decision needs source URLs and a reason")
        if status == "excluded":
            counts["excludedSources"] += 1
            continue
        if status == "duplicate":
            counts["duplicateSources"] += 1
            target = source_by_id.get(source.get("duplicateOf"), {})
            if target.get("status") != "included" or source.get("document", {}).get("sha256") != target.get("document", {}).get("sha256"):
                fail(sid, "A duplicate must match the bytes of an included source")
            artifact(source.get("document"), sid + ".document")
            continue
        if status != "included":
            counts["unresolvedSources"] += 1
            fail(sid, "Source admission or acquisition is unresolved")
            continue
        counts["includedSources"] += 1
        artifact(source.get("document"), sid + ".document")
        source_hash = source.get("document", {}).get("sha256")
        selected = pages(source.get("selectedPages"), sid + ".selectedPages")
        page_count = source.get("pageCount")
        if type(page_count) is not int or page_count < 1:
            fail(sid, "A verified positive source page count is required")
            page_count = 0
        omitted = source.get("excludedPages", [])
        if not isinstance(omitted, list):
            fail(sid, "Excluded pages must be a list")
            omitted = []
        omitted_numbers = {p.get("page") for p in omitted if isinstance(p, dict)}
        if (len(omitted_numbers) != len(omitted)
                or any(not isinstance(p, dict) or not p.get("reason") for p in omitted)
                or selected & omitted_numbers
                or selected | omitted_numbers != set(range(1, page_count + 1))):
            fail(sid, "Every source page must be admitted or explicitly excluded with a reason")
        covered = set()
        cases = source.get("cases", [])
        if not isinstance(cases, list) or any(not isinstance(c, dict) for c in cases):
            fail(sid, "Cases must be a list of objects")
            cases = []
        for case in cases:
            cid = case.get("id", "unknown")
            location = sid + "." + cid
            counts["cases"] += 1
            if cid in case_ids:
                fail(location, "Case IDs must be unique across the corpus")
            case_ids.add(cid)
            expected = pages(case.get("sourcePages"), location + ".sourcePages")
            if not expected <= selected or expected & covered:
                fail(location, "Case pages overlap or fall outside the admitted source pages")
            covered |= expected
            # The archived first pass remains required even when a repair is accepted.
            artifact(case.get("firstPassPlan"), location + ".firstPassPlan")
            artifact(case.get("frozenInputs"), location + ".frozenInputs", parse=True)
            artifact(case.get("evidencePacket"), location + ".evidencePacket")
            candidate = case.get("candidate", {})
            artifact(candidate, location + ".candidate")
            candidate_hash = candidate.get("sha256")
            candidate_pages = pages(case.get("candidatePages"), location + ".candidatePages")
            count = case.get("candidatePageCount")
            if type(count) is not int or count < 1 or candidate_pages != set(range(1, count + 1)):
                fail(location, "Every actual candidate page must be evaluated")
            first_candidate = case.get("firstPassCandidate")
            if first_candidate:
                artifact(first_candidate, location + ".firstPassCandidate")
            else:
                failure = artifact(case.get("firstPassFailure"), location + ".firstPassFailure", parse=True)
                if not isinstance(failure, dict) or failure.get("accepted") is not False or not failure.get("errors"):
                    fail(location, "Archive either the first candidate or its concrete failed attempt")
            if case.get("acceptedAttempt") == "first-pass" and (not first_candidate or first_candidate.get("sha256") != candidate_hash):
                fail(location, "First-pass acceptance must use the unchanged first candidate")
            if case.get("acceptedAttempt") == "repaired":
                artifact(case.get("repairLedger"), location + ".repairLedger")
            for report_name in ["provenance", "hard", "visual", "consistency"]:
                report = artifact(case.get("reports", {}).get(report_name), location + "." + report_name, parse=True)
                if report is None:
                    continue
                # Report adapters explicitly declare the actual binding location;
                # the validator never accepts an unbound accepted:true summary.
                key_path = case.get("reportCandidateKeys", {}).get(report_name, ["candidate", "sha256"])
                value = report
                for key in key_path:
                    value = value.get(key) if isinstance(value, dict) else None
                if report.get("accepted") is not True or value != candidate_hash:
                    fail(location + "." + report_name, "PPTX report rejected or bound to another candidate")
            review = artifact(case.get("backwardReview"), location + ".backwardReview", parse=True)
            if review is None:
                continue
            if review.get("sourceSha256") != source_hash or review.get("candidateSha256") != candidate_hash:
                fail(location, "Backward review is bound to different source or candidate bytes")
            if review.get("accepted") is not True:
                fail(location, "Backward review has not accepted the candidate")
            scores(review.get("scores"), location + ".scores")
            reviewed_source, reviewed_candidate = set(), set()
            for number, comparison in enumerate(review.get("pageComparisons", [])):
                loc = location + f".pageComparisons[{number}]"
                source_pages = pages(comparison.get("sourcePages"), loc + ".sourcePages")
                target_pages = pages(comparison.get("candidatePages"), loc + ".candidatePages")
                reviewed_source |= source_pages
                reviewed_candidate |= target_pages
                if not comparison.get("evidence"):
                    fail(loc, "Page comparison needs concrete rendered evidence")
                scores(comparison.get("scores"), loc + ".scores")
                if comparison.get("materialLoss") is not False:
                    fail(loc, "Material evidence, copy, or density loss remains unresolved")
                if any(f.get("severity") in {"major", "blocker"} for f in comparison.get("findings", [])):
                    fail(loc, "Major or blocker finding remains")
            if reviewed_source != expected or reviewed_candidate != candidate_pages:
                fail(location, "Backward review does not cover every source and candidate page")
            # Render inventories bind every page image, not just a contact sheet.
            for name, expected_pages in [("sourceRenders", expected), ("candidateRenders", candidate_pages)]:
                renders = case.get(name, [])
                if {r.get("page") for r in renders} != expected_pages or len(renders) != len(expected_pages):
                    fail(location + "." + name, "Exact page renders are incomplete or duplicated")
                for render in renders:
                    artifact(render, location + "." + name + "." + str(render.get("page")))
            if case.get("acceptedAttempt") == "first-pass":
                counts["reportedFirstPassAccepted"] += 1
            elif case.get("acceptedAttempt") == "repaired":
                counts["reportedRepairedAccepted"] += 1
            else:
                fail(location, "Declare whether the accepted candidate is first-pass or repaired")
        if covered != selected:
            fail(sid, "Admitted pages have no complete case assignment")
        counts["selectedSourcePages"] += len(selected)
    if not counts["includedSources"] or not counts["cases"]:
        fail("corpus", "No evaluated client-deck cases")
    return {"schemaVersion": 1, "accepted": not errors, "counts": dict(counts), "errors": errors}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    result = audit(json.loads(args.manifest.read_text()), args.manifest.resolve().parent)
    result["manifestSha256"] = sha256(args.manifest)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"accepted": result["accepted"], "counts": result["counts"], "errors": len(result["errors"])}))
    return 0 if result["accepted"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
