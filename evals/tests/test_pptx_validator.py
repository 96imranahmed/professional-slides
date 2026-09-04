from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
VALIDATOR_PATH = ROOT / "evals" / "scripts" / "validate_pptx.py"


def load_validator():
    spec = importlib.util.spec_from_file_location("validate_pptx", VALIDATOR_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


validator = load_validator()


def content_types(slide_count: int) -> str:
    overrides = "".join(
        f'<Override PartName="/ppt/slides/slide{number}.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>'
        for number in range(1, slide_count + 1)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/ppt/presentation.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>'
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>'
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>'
        '<Override PartName="/ppt/theme/theme1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
        f'{overrides}</Types>'
    )


def relationships(values: list[tuple[str, str, str]]) -> str:
    body = "".join(
        f'<Relationship Id="{rel_id}" Type="{rel_type}" Target="{target}"/>'
        for rel_id, rel_type, target in values
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        f'{body}</Relationships>'
    )


def shape(shape_id: int, name: str, text: str, *, x: int, y: int, width: int, height: int, size: int, bold: bool,
          font: str = "Arial", color: str = "111111") -> str:
    bold_value = "1" if bold else "0"
    return (
        '<p:sp>'
        '<p:nvSpPr>'
        f'<p:cNvPr id="{shape_id}" name="{name}"/><p:cNvSpPr/><p:nvPr/>'
        '</p:nvSpPr>'
        '<p:spPr><a:xfrm>'
        f'<a:off x="{x}" y="{y}"/><a:ext cx="{width}" cy="{height}"/>'
        '</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
        '<p:txBody><a:bodyPr/><a:lstStyle/><a:p>'
        f'<a:pPr><a:defRPr sz="{size}" b="{bold_value}"><a:solidFill><a:srgbClr val="{color}"/>'
        f'</a:solidFill><a:latin typeface="{font}"/></a:defRPr></a:pPr>'
        f'<a:r><a:rPr sz="{size}" b="{bold_value}"><a:solidFill><a:srgbClr val="{color}"/>'
        f'</a:solidFill><a:latin typeface="{font}"/></a:rPr><a:t>{text}</a:t></a:r>'
        '</a:p></p:txBody></p:sp>'
    )


def slide_xml(title: str, body: str, *, title_x: int = 1000, title_font: str = "Arial",
              title_color: str = "111111") -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
        '</p:nvGrpSpPr><p:grpSpPr><a:xfrm/></p:grpSpPr>'
        + shape(
            2, "action-title", title, x=title_x, y=1000, width=8000, height=700,
            size=3200, bold=True, font=title_font, color=title_color,
        )
        + shape(
            3, "body", body, x=1000, y=2000, width=8000, height=2400,
            size=1800, bold=False,
        )
        + '</p:spTree></p:cSld></p:sld>'
    )


def build_pptx(
    path: Path,
    slides: list[dict[str, object]],
    *,
    omit_layout: bool = False,
) -> None:
    slide_ids = "".join(
        f'<p:sldId id="{255 + number}" r:id="rId{number}"/>'
        for number in range(1, len(slides) + 1)
    )
    presentation = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>'
        f'<p:sldIdLst>{slide_ids}</p:sldIdLst>'
        '<p:sldSz cx="12192000" cy="6858000"/></p:presentation>'
    )
    presentation_rels = [
        (f"rId{number}", validator.SLIDE_REL, f"slides/slide{number}.xml")
        for number in range(1, len(slides) + 1)
    ] + [("rIdMaster", validator.MASTER_REL, "slideMasters/slideMaster1.xml")]
    theme = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Test">'
        '<a:themeElements><a:clrScheme name="Test">'
        '<a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>'
        '</a:clrScheme><a:fontScheme name="Test"><a:majorFont><a:latin typeface="Arial"/>'
        '</a:majorFont><a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme>'
        '<a:fmtScheme name="Test"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/>'
        '<a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>'
    )
    master = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
        '</p:nvGrpSpPr><p:grpSpPr><a:xfrm/></p:grpSpPr></p:spTree></p:cSld></p:sldMaster>'
    )
    layout = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" '
        'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
        '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/>'
        '</p:nvGrpSpPr><p:grpSpPr><a:xfrm/></p:grpSpPr></p:spTree></p:cSld></p:sldLayout>'
    )
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types(len(slides)))
        archive.writestr(
            "_rels/.rels",
            relationships([("rId1", validator.PRESENTATION_REL, "ppt/presentation.xml")]),
        )
        archive.writestr("ppt/presentation.xml", presentation)
        archive.writestr("ppt/_rels/presentation.xml.rels", relationships(presentation_rels))
        archive.writestr("ppt/theme/theme1.xml", theme)
        archive.writestr("ppt/slideMasters/slideMaster1.xml", master)
        archive.writestr(
            "ppt/slideMasters/_rels/slideMaster1.xml.rels",
            relationships([
                ("rIdLayout", validator.LAYOUT_REL, "../slideLayouts/slideLayout1.xml"),
                ("rIdTheme", validator.THEME_REL, "../theme/theme1.xml"),
            ]),
        )
        if not omit_layout:
            archive.writestr("ppt/slideLayouts/slideLayout1.xml", layout)
            archive.writestr(
                "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
                relationships([("rIdMaster", validator.MASTER_REL, "../slideMasters/slideMaster1.xml")]),
            )
        for number, values in enumerate(slides, start=1):
            archive.writestr(
                f"ppt/slides/slide{number}.xml",
                slide_xml(
                    str(values["title"]),
                    str(values["body"]),
                    title_x=int(values.get("title_x", 1000)),
                    title_font=str(values.get("title_font", "Arial")),
                    title_color=str(values.get("title_color", "111111")),
                ),
            )
            archive.writestr(
                f"ppt/slides/_rels/slide{number}.xml.rels",
                relationships([("rIdLayout", validator.LAYOUT_REL, "../slideLayouts/slideLayout1.xml")]),
            )


def manifest(titles: list[str]) -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "deck": {
            "slideCount": len(titles),
            "slideSizeEmu": {"width": 12192000, "height": 6858000},
            "titles": titles,
            "requireTheme": True,
            "requireSlideLayout": True,
            "requireSlideMaster": True,
        },
        "copy": {
            "forbiddenCharacters": ["—"],
            "maxTitleWords": 12,
            "maxWordsPerSlide": 20,
            "maxWordsPerTextShape": 12,
            "maxParagraphsPerTextShape": 3,
            "excludedShapeNamePatterns": ["(?i)^source", "(?i)^footer", "(?i)^page-number"],
            "slideOverrides": {},
        },
        "theme": {
            "allowedFonts": ["Arial"],
            "allowedColors": ["111111", "FFFFFF"],
            "allowedSchemeColors": ["dk1", "lt1", "phClr"],
            "allowedFontSizesPt": [18, 32],
            "minimumFontSizePt": 12,
            "fontSizeTolerancePt": 0.05,
        },
        "roles": [{
            "id": "action-title",
            "slides": list(range(1, len(titles) + 1)),
            "shapeNamePattern": "^action-title$",
            "requiredCountPerSlide": 1,
            "fontFamilies": ["Arial"],
            "fontSizesPt": [32],
            "textColors": ["111111"],
            "bold": True,
            "geometryEmu": {"x": 1000, "y": 1000, "cx": 8000, "cy": 700},
            "geometryToleranceEmu": 0,
            "consistentAcrossSlides": [
                "x", "y", "cx", "cy", "fontFamilies", "fontSizesPt", "textColors", "bold"
            ],
        }],
    }


class PptxValidatorTests(unittest.TestCase):
    def validate(self, slides: list[dict[str, object]], *, manifest_value=None, omit_layout=False):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        pptx = root / "candidate.pptx"
        manifest_path = root / "acceptance.json"
        build_pptx(pptx, slides, omit_layout=omit_layout)
        manifest_path.write_text(
            json.dumps(manifest_value or manifest([str(value["title"]) for value in slides])),
            encoding="utf-8",
        )
        return validator.validate(pptx, manifest_path), pptx, manifest_path

    def test_accepts_a_schema_valid_concise_consistent_deck(self):
        report, _, _ = self.validate([
            {"title": "Margin recovery is credible", "body": "Pricing offsets freight and labour."},
            {"title": "Cash conversion remains strong", "body": "Receivables track revenue."},
        ])
        self.assertTrue(report["accepted"], report["findings"])
        self.assertEqual(report["status"], "accepted")
        self.assertEqual(report["summary"]["slideCount"], 2)

    def test_rejects_a_missing_relationship_target(self):
        report, _, _ = self.validate(
            [{"title": "One clear claim", "body": "One short proof."}],
            omit_layout=True,
        )
        self.assertFalse(report["accepted"])
        self.assertIn("package.relationship_target", report["summary"]["findingCodes"])

    def test_rejects_undeclared_theme_variables(self):
        report, _, _ = self.validate([
            {
                "title": "One clear claim",
                "body": "One short proof.",
                "title_font": "Calibri",
                "title_color": "FF0000",
            }
        ])
        self.assertFalse(report["accepted"])
        self.assertIn("theme.font_not_allowed", report["summary"]["findingCodes"])
        self.assertIn("theme.color_not_allowed", report["summary"]["findingCodes"])

    def test_rejects_copy_that_is_long_or_contains_an_em_dash(self):
        report, _, _ = self.validate([
            {
                "title": "One clear claim",
                "body": "This deliberately overlong body uses many unnecessary words to explain a very simple point — and keeps going.",
            }
        ])
        codes = report["summary"]["findingCodes"]
        self.assertIn("copy.shape_word_limit", codes)
        self.assertIn("copy.forbidden_character", codes)

    def test_rejects_title_drift_from_the_approved_contract(self):
        values = manifest(["Approved title"])
        report, _, _ = self.validate(
            [{"title": "Changed title", "body": "One short proof."}],
            manifest_value=values,
        )
        self.assertIn("copy.title_mismatch", report["summary"]["findingCodes"])

    def test_rejects_role_geometry_drift(self):
        report, _, _ = self.validate([
            {"title": "First claim", "body": "First proof."},
            {"title": "Second claim", "body": "Second proof.", "title_x": 1300},
        ])
        codes = report["summary"]["findingCodes"]
        self.assertIn("role.geometry_mismatch", codes)
        self.assertIn("role.consistency_drift", codes)

    def test_rejects_an_out_of_bounds_shape(self):
        report, _, _ = self.validate([
            {"title": "One clear claim", "body": "One short proof.", "title_x": 12191500}
        ])
        self.assertIn("presentation.shape_out_of_bounds", report["summary"]["findingCodes"])

    def test_rejects_an_incomplete_acceptance_manifest(self):
        values = manifest(["One clear claim"])
        del values["theme"]["allowedFontSizesPt"]
        report, _, _ = self.validate(
            [{"title": "One clear claim", "body": "One short proof."}],
            manifest_value=values,
        )
        self.assertIn("manifest.theme_font_sizes", report["summary"]["findingCodes"])

    def test_repair_loop_moves_the_same_brief_from_rejected_to_accepted(self):
        rejected, _, _ = self.validate([
            {
                "title": "Margin recovery is credible",
                "body": "Pricing actions and a wide collection of operational initiatives are expected to offset freight, labour, and other pressures over time.",
            }
        ])
        accepted, _, _ = self.validate([
            {"title": "Margin recovery is credible", "body": "Pricing offsets freight and labour."}
        ])
        self.assertFalse(rejected["accepted"])
        self.assertTrue(accepted["accepted"], accepted["findings"])

    def test_cli_returns_nonzero_and_writes_a_machine_readable_report(self):
        report, pptx, manifest_path = self.validate([
            {"title": "One clear claim", "body": "One short proof — with a forbidden mark."}
        ])
        self.assertFalse(report["accepted"])
        output = pptx.parent / "report.json"
        completed = subprocess.run(
            [
                sys.executable,
                str(VALIDATOR_PATH),
                str(pptx),
                "--manifest",
                str(manifest_path),
                "--report",
                str(output),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        self.assertEqual(completed.returncode, 1)
        written = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(written["status"], "rejected")
        self.assertIn("copy.forbidden_character", written["summary"]["findingCodes"])


if __name__ == "__main__":
    unittest.main()
