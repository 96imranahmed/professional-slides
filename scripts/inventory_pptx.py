#!/usr/bin/env python3
"""Create a read-only structural and visual-token inventory of a PPTX file."""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import re
import sys
from collections import Counter
from pathlib import Path, PurePosixPath
from zipfile import BadZipFile, ZipFile
from xml.etree import ElementTree as ET


NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
RID = f"{{{NS['r']}}}id"
EMU_PER_INCH = 914400
SLIDE_PART = re.compile(r"^ppt/slides/slide\d+\.xml$")
MASTER_PART = re.compile(r"^ppt/slideMasters/slideMaster\d+\.xml$")
LAYOUT_PART = re.compile(r"^ppt/slideLayouts/slideLayout\d+\.xml$")
THEME_PART = re.compile(r"^ppt/theme/theme\d+\.xml$")
THEME_OVERRIDE_PART = re.compile(r"^ppt/theme/themeOverride\d+\.xml$")
CHART_PART = re.compile(r"^ppt/charts/chart\d+\.xml$")
NOTES_PART = re.compile(r"^ppt/notesSlides/notesSlide\d+\.xml$")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _xml(archive: ZipFile, part: str) -> ET.Element:
    return ET.fromstring(archive.read(part))


def _relationships(archive: ZipFile, part: str) -> dict[str, str]:
    source = PurePosixPath(part)
    rel_part = str(source.parent / "_rels" / f"{source.name}.rels")
    if rel_part not in archive.namelist():
        return {}
    root = _xml(archive, rel_part)
    base = str(source.parent)
    result: dict[str, str] = {}
    for relationship in root.findall("rel:Relationship", NS):
        rid = relationship.attrib.get("Id")
        target = relationship.attrib.get("Target")
        if rid and target and not target.startswith(("http://", "https://")):
            result[rid] = posixpath.normpath(posixpath.join(base, target))
    return result


def _ordered_slide_parts(archive: ZipFile) -> list[str]:
    presentation = _xml(archive, "ppt/presentation.xml")
    relationships = _relationships(archive, "ppt/presentation.xml")
    parts: list[str] = []
    for slide_id in presentation.findall(".//p:sldId", NS):
        target = relationships.get(slide_id.attrib.get(RID, ""))
        if target:
            parts.append(target)
    return parts


def _slide_title(slide: ET.Element) -> str:
    for shape in slide.findall(".//p:sp", NS):
        placeholder = shape.find("./p:nvSpPr/p:nvPr/p:ph", NS)
        if placeholder is not None and placeholder.attrib.get("type", "title") in {"title", "ctrTitle"}:
            text = " ".join(t.text.strip() for t in shape.findall(".//a:t", NS) if t.text and t.text.strip())
            if text:
                return text
    texts = [t.text.strip() for t in slide.findall(".//a:t", NS) if t.text and t.text.strip()]
    return " ".join(texts[:3])[:240]


def inventory(path: Path) -> dict[str, object]:
    with ZipFile(path) as archive:
        names = archive.namelist()
        presentation = _xml(archive, "ppt/presentation.xml")
        slide_size = presentation.find("p:sldSz", NS)
        width = int(slide_size.attrib["cx"]) if slide_size is not None else 0
        height = int(slide_size.attrib["cy"]) if slide_size is not None else 0
        slide_parts = _ordered_slide_parts(archive)
        fonts: Counter[str] = Counter()
        colors: Counter[str] = Counter()
        for name in names:
            if not name.endswith(".xml") or not name.startswith("ppt/"):
                continue
            try:
                root = _xml(archive, name)
            except ET.ParseError:
                continue
            for node in root.iter():
                typeface = node.attrib.get("typeface")
                if typeface and not typeface.startswith("+"):
                    fonts[typeface.strip()] += 1
                tag = node.tag.rsplit("}", 1)[-1]
                if tag == "srgbClr" and node.attrib.get("val"):
                    colors[f"#{node.attrib['val'].upper()}"] += 1
                elif tag == "sysClr" and node.attrib.get("lastClr"):
                    colors[f"#{node.attrib['lastClr'].upper()}"] += 1

        slides: list[dict[str, object]] = []
        for number, part in enumerate(slide_parts, start=1):
            root = _xml(archive, part)
            rels = _relationships(archive, part)
            layout = next((target for target in rels.values() if "/slideLayouts/" in target), None)
            notes = next((target for target in rels.values() if "/notesSlides/" in target), None)
            slides.append(
                {
                    "number": number,
                    "part": part,
                    "title": _slide_title(root),
                    "layoutPart": layout,
                    "hasNotes": notes is not None,
                    "textCharacters": sum(len(t.text or "") for t in root.findall(".//a:t", NS)),
                    "shapeCount": len(root.findall(".//p:sp", NS)),
                    "graphicFrameCount": len(root.findall(".//p:graphicFrame", NS)),
                    "pictureCount": len(root.findall(".//p:pic", NS)),
                    "containsTable": bool(root.findall(".//a:tbl", NS)),
                }
            )

        return {
            "source": path.name,
            "sha256": _sha256(path),
            "bytes": path.stat().st_size,
            "canvas": {
                "widthEmu": width,
                "heightEmu": height,
                "widthInches": round(width / EMU_PER_INCH, 4) if width else None,
                "heightInches": round(height / EMU_PER_INCH, 4) if height else None,
                "aspectRatio": round(width / height, 4) if height else None,
            },
            "package": {
                "slideCount": len(slide_parts),
                "masterCount": sum(bool(MASTER_PART.fullmatch(name)) for name in names),
                "layoutCount": sum(bool(LAYOUT_PART.fullmatch(name)) for name in names),
                "themeCount": sum(bool(THEME_PART.fullmatch(name)) for name in names),
                "themeOverrideCount": sum(bool(THEME_OVERRIDE_PART.fullmatch(name)) for name in names),
                "chartCount": sum(bool(CHART_PART.fullmatch(name)) for name in names),
                "mediaCount": sum(name.startswith("ppt/media/") and not name.endswith("/") for name in names),
                "notesCount": sum(bool(NOTES_PART.fullmatch(name)) for name in names),
            },
            "fonts": [name for name, _ in fonts.most_common()],
            "topLiteralColors": [{"hex": value, "uses": count} for value, count in colors.most_common(24)],
            "slides": slides,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pptx", type=Path)
    parser.add_argument("--output", type=Path, help="Write JSON to this path instead of stdout")
    args = parser.parse_args()
    try:
        result = inventory(args.pptx)
    except (OSError, BadZipFile, KeyError, ET.ParseError) as exc:
        print(f"ERROR: unable to inventory {args.pptx}: {exc}", file=sys.stderr)
        return 1
    text = json.dumps(result, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf-8")
        print(f"Wrote inventory: {args.output}")
    else:
        print(text, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
