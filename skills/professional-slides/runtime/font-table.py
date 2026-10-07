#!/usr/bin/env python3
"""Measure an installed typeface so the runtime can set a deck in it.

    python3 runtime/font-table.py --family "Open Sans"              find it among the installed fonts
    python3 runtime/font-table.py --regular a.ttf [--bold b.ttf] [--family "Name"]
    python3 runtime/font-table.py --list                              the families installed

The runtime measures text with a native canvas where one is installed, and
otherwise with advance-width tables it ships for Arial and Georgia
(font-metrics.mjs). A deck styled from a brand - a website's typeface, a
template's - is then measured as Arial even where the machine has the face, and
its titles and columns are fitted to the wrong widths. This reads the face's
regular and bold files with Pillow, measures every character of the Latin,
punctuation and currency blocks at 2048 units to the em, and writes the table
in the shipped format to the user's fonts folder (`$PROFESSIONAL_SLIDES_HOME/
fonts`, else `$XDG_CONFIG_HOME/professional-slides/fonts`, else
`~/.professional-slides/fonts`), never into the skill: the measure belongs to
the user's machine, as the face does. A face that is not installed is not
fetched here - installing a font is the user's to do.
"""
import argparse
import json
import os
import sys
from pathlib import Path

UNITS = 2048
# The characters a deck sets: Basic Latin through Latin Extended-B, general punctuation, currency signs, letterlike symbols.
BLOCKS = [(0x20, 0x24F), (0x2000, 0x206F), (0x20A0, 0x20CF), (0x2100, 0x214F)]
FONT_DIRS = ["/Library/Fonts", "/System/Library/Fonts", "/System/Library/Fonts/Supplemental", str(Path.home() / "Library" / "Fonts"),
             "/usr/share/fonts", "/usr/local/share/fonts", str(Path.home() / ".fonts"), str(Path.home() / ".local" / "share" / "fonts"),
             "C:\\Windows\\Fonts"]


def user_fonts_dir():
    if os.environ.get("PROFESSIONAL_SLIDES_HOME"):
        return Path(os.environ["PROFESSIONAL_SLIDES_HOME"]) / "fonts"
    if os.environ.get("XDG_CONFIG_HOME"):
        return Path(os.environ["XDG_CONFIG_HOME"]) / "professional-slides" / "fonts"
    return Path.home() / ".professional-slides" / "fonts"


def installed():
    """Every installed font file Pillow can open, as (family, style, path)."""
    from PIL import ImageFont
    found = []
    for directory in FONT_DIRS:
        for root, _, files in os.walk(directory):
            for name in files:
                if not name.lower().endswith((".ttf", ".otf")):
                    continue
                path = os.path.join(root, name)
                try:
                    family, style = ImageFont.truetype(path, 12).getname()
                except Exception:
                    continue
                found.append((family or "", style or "", path))
    return found


def find(family):
    """The regular and bold files of an installed family: (regular, bold), bold None where it has none."""
    faces = [(style.lower(), path) for name, style, path in installed() if name.lower() == family.lower()]
    regular = next((path for style, path in faces if style in ("regular", "roman", "book", "normal")), None) or next((path for style, path in faces if "italic" not in style and "bold" not in style), None)
    bold = next((path for style, path in faces if style == "bold"), None) or next((path for style, path in faces if "bold" in style and "italic" not in style), None)
    return regular, bold


def face_table(path):
    from PIL import ImageFont
    font = ImageFont.truetype(path, UNITS)
    advances = {}
    for start, end in BLOCKS:
        for cp in range(start, end + 1):
            try:
                width = font.getlength(chr(cp))
            except Exception:
                continue
            advances[str(cp)] = int(round(width))
    ascent, descent = font.getmetrics()
    return {"default": advances.get(str(ord("0")), UNITS // 2), "space": advances.get("32", UNITS // 4), "advances": advances,
            "ascender": ascent, "descender": -descent, "lineGap": 0, "winAscent": ascent, "winDescent": descent}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Measure an installed typeface for the runtime's text layout.")
    parser.add_argument("--family", help="the family name, as the font names itself")
    parser.add_argument("--regular", help="the regular face's file")
    parser.add_argument("--bold", help="the bold face's file (the regular is used where there is none)")
    parser.add_argument("--out", help="the folder to write the table to (default: the user's fonts folder)")
    parser.add_argument("--list", action="store_true", help="list the installed families")
    args = parser.parse_args(argv)
    try:
        from PIL import ImageFont  # noqa: F401
    except ImportError:
        print("Pillow is not installed: run node runtime/doctor.mjs for the install line", file=sys.stderr)
        return 2
    if args.list:
        print(json.dumps(sorted({name for name, _, _ in installed() if name}), indent=1))
        return 0
    regular, bold = args.regular, args.bold
    if not regular:
        if not args.family:
            parser.error("name the face: --family \"Name\", or --regular <file>")
        regular, found_bold = find(args.family)
        bold = bold or found_bold
        if not regular:
            print(f"{args.family} is not installed on this machine (font-table.py --list names the families that are). "
                  "Install it from its foundry or Google Fonts - that is yours to do - and run this again, or keep the deck in Arial.", file=sys.stderr)
            return 2
    from PIL import ImageFont
    family = args.family or ImageFont.truetype(regular, 12).getname()[0]
    table = {"family": family, "source": f"measured from the installed files {Path(regular).name}{f' and {Path(bold).name}' if bold else ''} with Pillow (font-table.py)",
             "unitsPerEm": UNITS, "faces": {"regular": face_table(regular), "bold": face_table(bold or regular)}}
    out = Path(args.out) if args.out else user_fonts_dir()
    out.mkdir(parents=True, exist_ok=True)
    target = out / f"{family.lower()}-metrics.json"
    target.write_text(json.dumps(table), encoding="utf-8")
    print(json.dumps({"family": family, "table": str(target), "regular": regular, "bold": bold or regular, "characters": len(table["faces"]["regular"]["advances"]),
                      "next": f"node runtime/preferences.mjs set 'typography={json.dumps({'body': family, 'display': family})}'"}, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
