"""Read hash-bound source excerpts for the independent copy reviewer."""
import hashlib
import json
from pathlib import Path
import sys


def read_sources(records, base, slide_count):
    sources, paths, seen = [], {}, set()
    for record in records:
        sid = record.get("id")
        if not isinstance(sid, str) or not sid.strip() or sid in seen:
            raise ValueError("Copy source IDs must be nonempty and unique")
        seen.add(sid)
        path = Path(record["path"])
        path = path if path.is_absolute() else base / path
        data = path.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if digest != record.get("sha256"):
            raise ValueError(f"Stale copy source: {sid}")
        slides = record.get("slides")
        if (not isinstance(slides, list) or not slides or len(set(slides)) != len(slides)
                or any(type(s) is not int or not 1 <= s <= slide_count for s in slides)):
            raise ValueError(f"Invalid copy source slide mapping: {sid}")
        pages = record.get("pages")
        if data.startswith(b"%PDF"):
            from pypdf import PdfReader
            import io
            reader = PdfReader(io.BytesIO(data))
            if (not isinstance(pages, list) or not pages or len(set(pages)) != len(pages)
                    or any(type(p) is not int or not 1 <= p <= len(reader.pages) for p in pages)):
                raise ValueError(f"Invalid copy source page mapping: {sid}")
            text = "\n\n".join(f"Source page {p}\n{reader.pages[p - 1].extract_text() or ''}" for p in pages)
            if not any((reader.pages[p - 1].extract_text() or "").strip() for p in pages):
                raise ValueError(f"Copy source needs a verified text transcription: {sid}")
        elif path.suffix.lower() in {".md", ".txt", ".json", ".csv"} and pages is None:
            text = data.decode("utf-8")
        else:
            raise ValueError(f"Unsupported copy source format or page mapping: {sid}")
        if not text.strip():
            raise ValueError(f"Empty copy source: {sid}")
        key = "source:" + sid
        paths[key] = str(path.resolve())
        sources.append({"id": key, "text": text, "slides": slides, "source": {"path": str(path.resolve()), "sha256": digest, "pages": pages}})
    return {"sources": sources, "paths": paths}


if __name__ == "__main__":
    request = json.load(sys.stdin)
    print(json.dumps(read_sources(request["records"], Path(request["base"]), request["slideCount"])))
