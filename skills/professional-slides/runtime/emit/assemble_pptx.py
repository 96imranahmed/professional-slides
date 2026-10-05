#!/usr/bin/env python3
"""Assemble a revision: the user's deck with only the changed slides replaced.

    python3 runtime/emit/assemble_pptx.py plan.json out.pptx
    python3 runtime/emit/assemble_pptx.py plan.json --check

A point change to an existing deck must leave what it does not touch as it
was. Recomposing a slide the user never asked to change redraws it in this
runtime's design, so a revision's untouched slides are not recomposed: they
are carried. The package written here is the SOURCE deck, part for part -
its slides, layouts, masters, themes, media, fonts and document properties,
each byte as the user saved it - with three kinds of change and no other:

    carried    a source slide kept where the plan puts it. Its part and every
               part it draws on are copied as bytes, never parsed and written
               again
    edited     a carried slide with text replaced in place (`edits`, `title`,
               `hidden`): the one run of text is rewritten inside the slide's
               own XML, so its shapes, its fonts and its layout are the slide's.
               An edit rewrites whole words (whole_words), in the slide and in
               its speaker notes; words that stand only inside longer ones, or
               more than once without `"all": true`, are refused
    composed   a slide this runtime composed (emit_pptx.py), copied in from the
               composed package with the layout, master and theme it was drawn
               on, its charts, their workbooks and its pictures. It brings its
               own master, so nothing of the user's template is redefined

A source slide the plan does not name is dropped, with every part only it
drew on: its notes, its chart and the chart's embedded workbook, a picture no
kept slide shows. A slide cut because it must not circulate does not leave
its data in the file. A part a kept slide (or the deck itself) still draws on
stays, byte for byte, and the result lists what was removed (`removed`). Only
`ppt/presentation.xml`, its relationships and `[Content_Types].xml` are
rewritten, to list the slides in their new order - and not even those where
every slide is carried in the order it had.

The plan (written by build-deck.mjs from the compiled deck) is

    { "source": "deck.source.pptx", "sha256": "<of the source>", "composed": "composed.pptx" | null,
      "slides": [ { "carry": 3 },                                       source slide 3, as it is
                  { "carry": 4, "title": "...", "edits": [{ "old", "new" }], "hidden": false },
                  { "composed": 1 } ] }                                 slide 1 of the composed package

The result (stdout, JSON) says what was done and proves what was kept: every
carried slide's parts are read back from the written file and compared with
the source's, byte for byte (`preserved`), and every edit reports how many
times its text stood on the slide. An edit whose text is not on the slide, or
a slide that does not exist, is refused (exit 2) before anything is written.

`--check` tries the plan's carried slides and writes nothing: every edit that
cannot be made is listed with its slide (`refusals`), so the author hears of
each at the compile, in one run, and not of the first at the build.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import posixpath
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

from lxml import etree

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
    "p14": "http://schemas.microsoft.com/office/powerpoint/2010/main",
}
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
PRESENTATION = "ppt/presentation.xml"
CONTENT_TYPES = "[Content_Types].xml"
# The ids of slide masters and of their layouts share one space, which starts here (ECMA-376 19.2.1.33/34).
MASTER_ID_FLOOR = 2147483648
SLIDE_ID_FLOOR = 256
EPOCH = datetime.fromtimestamp(int(os.environ["SOURCE_DATE_EPOCH"]), timezone.utc) if os.environ.get("SOURCE_DATE_EPOCH") else datetime(1980, 1, 1, tzinfo=timezone.utc)
STAMP = min(max(EPOCH.timetuple()[:6], (1980, 1, 1, 0, 0, 0)), (2107, 12, 31, 23, 59, 58))


class Refusal(Exception):
    """A plan the assembler will not act on; main() reports it and exits 2."""


def q(prefix: str, tag: str) -> str:
    return f"{{{NS[prefix]}}}{tag}"


def resolve(part: str, target: str) -> str:
    """The part an internal relationship of `part` points at ("" is the package itself)."""
    return target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(posixpath.dirname(part), target))


def slide_link(kind: str) -> bool:
    """A relationship from one slide to another (a hyperlink or an action): the other slide is not a part the first draws on."""
    return kind == REL + "slide"


class Package:
    """A .pptx as its parts: name -> bytes, in the order the zip holds them."""

    def __init__(self, data: bytes):
        self.infos, self.parts = {}, {}
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for info in archive.infolist():
                self.infos[info.filename] = info
                self.parts[info.filename] = archive.read(info.filename)

    @staticmethod
    def rels_name(part: str) -> str:
        return posixpath.join(posixpath.dirname(part), "_rels", posixpath.basename(part) + ".rels")

    def rels(self, part: str) -> list:
        """The part's relationships: (id, type, target part name or None when external, the element)."""
        data = self.parts.get(self.rels_name(part))
        if data is None:
            return []
        out = []
        for el in etree.fromstring(data):
            target = el.get("Target", "")
            internal = el.get("TargetMode") != "External"
            name = resolve(part, target) if internal else None
            out.append((el.get("Id"), el.get("Type"), name, el))
        return out

    def closure(self, part: str, stop=lambda kind: False) -> list:
        """`part` and every part it draws on, through its relationships; `stop(type)` names a relationship not to follow."""
        seen, queue = [], [part]
        while queue:
            name = queue.pop(0)
            if name in seen or name not in self.parts:
                continue
            seen.append(name)
            queue.extend(target for _, kind, target, _ in self.rels(name) if target and not stop(kind))
        return seen

    def notes_of(self, slide: str) -> str | None:
        """The notes page of a slide, or None."""
        return next((target for _, kind, target, _ in self.rels(slide) if kind == REL + "notesSlide" and target), None)

    def slides(self) -> list:
        """The slides in show order: (slide id, relationship id, part name)."""
        root = etree.fromstring(self.parts[PRESENTATION])
        by_id = {rid: name for rid, _, name, _ in self.rels(PRESENTATION)}
        listed = root.find(q("p", "sldIdLst"))
        return [(el.get("id"), el.get(q("r", "id")), by_id.get(el.get(q("r", "id")))) for el in (listed if listed is not None else [])]

    def content_type(self, part: str) -> str | None:
        root = etree.fromstring(self.parts[CONTENT_TYPES])
        for el in root.findall(q("ct", "Override")):
            if el.get("PartName") == "/" + part:
                return el.get("ContentType")
        ext = part.rsplit(".", 1)[-1].lower()
        for el in root.findall(q("ct", "Default")):
            if el.get("Extension", "").lower() == ext:
                return el.get("ContentType")
        return None


def serialise(root) -> bytes:
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)


# --- text edits on a carried slide ------------------------------------------

def paragraph_runs(paragraph) -> list:
    """The paragraph's pieces in order: ("text", <a:t>) for a run, ("break", <a:br>) for a soft line break. A field (a slide number, a date) is the deck's furniture and is left alone."""
    pieces = []
    for child in paragraph:
        if child.tag == q("a", "r"):
            text = child.find(q("a", "t"))
            if text is not None:
                pieces.append(("text", text))
        elif child.tag == q("a", "br"):
            pieces.append(("break", child))
    return pieces


def paragraph_text(paragraph) -> tuple:
    """The paragraph's pieces, where each sits in its text, and the text: a soft line break reads as a space, as the inventory reads it."""
    pieces = paragraph_runs(paragraph)
    spans, text = [], ""
    for kind, el in pieces:
        piece = (el.text or "") if kind == "text" else " "
        spans.append((len(text), len(text) + len(piece)))
        text += piece
    return pieces, spans, text


# "The slide prints these words": the reading runtime/revision.mjs wholeWords gives, in Python. Words are printed where they
# stand as tokens of their own - a token runs between spaces (and em dashes), with brackets and quotes before it and sentence
# punctuation after it left off - so an edit of "12.4" does not reach into "£112.45" or "£12.4m".
SEPARATORS = "\u2014"
OPENERS = "([{\"'\u201c\u2018\u00ab"
CLOSERS = ")]}\"'\u201d\u2019\u00bb.,;:!?\u2026"


def separates(char: str) -> bool:
    return char.isspace() or char in SEPARATORS


def whole_words(text: str, words: str) -> tuple:
    """Where `text` prints `words`: the offsets at which they stand as tokens of their own, and each longer token they stand only inside."""
    whole, inside = [], []
    at = text.find(words) if words else -1
    while at >= 0:
        end = at + len(words)
        start, stop = at, end
        while start > 0 and not separates(text[start - 1]):
            start -= 1
        while stop < len(text) and not separates(text[stop]):
            stop += 1
        opens = separates(text[at]) or all(char in OPENERS for char in text[start:at])
        closes = separates(text[end - 1]) or all(char in CLOSERS for char in text[end:stop])
        if opens and closes:
            whole.append(at)
        else:
            inside.append(text[start:stop])
        at = text.find(words, end)
    return whole, inside


def replace_in_paragraph(paragraph, old: str, new: str) -> int:
    """Replace `old` wherever it stands whole in the paragraph's text, which may
    run across several runs. The first run the text stands in takes the new
    text and keeps its own formatting; the rest of the old text is cut from
    the runs it ran into. Returns how many were replaced."""
    starts = whole_words(paragraph_text(paragraph)[2], old)[0]
    # Right to left, so the offsets still to be replaced are untouched by the ones already made.
    for start in reversed(starts):
        pieces, spans, _ = paragraph_text(paragraph)
        end, written = start + len(old), False
        for (kind, el), (lo, hi) in zip(pieces, spans):
            if hi <= start or lo >= end:
                continue
            if kind == "break":
                # A break inside the replaced text went with the words either side of it.
                if lo >= start and hi <= end:
                    el.getparent().remove(el)
                continue
            value = el.text or ""
            el.text = value[:max(0, start - lo)] + ("" if written else new) + (value[end - lo:] if end < hi else "")
            written = True
    return len(starts)


def notes_paragraphs(notes_root) -> list:
    """The paragraphs of a notes page that are the speaker's notes: its body placeholder, not the slide image or the page number."""
    if notes_root is None:
        return []
    out = []
    for shape in notes_root.iter(q("p", "sp")):
        holder = shape.find(f"{q('p', 'nvSpPr')}/{q('p', 'nvPr')}/{q('p', 'ph')}")
        if holder is not None and holder.get("type") == "body":
            out.extend(shape.iter(q("a", "p")))
    return out


def shortened(text: str, limit: int = 70) -> str:
    return text if len(text) <= limit else text[:limit - 1].rstrip() + "\u2026"


def replace_text(root, notes_root, old: str, new: str, every: bool, index: int) -> int:
    """Replace `old` where the slide prints it whole - in its shapes, its groups, its table cells and its speaker notes.

    An edit names one thing. Words the slide prints only inside longer ones
    are not that thing, and words it prints more than once may not all be:
    each is refused with the places named, before anything is written."""
    places = [(paragraph, "") for paragraph in root.iter(q("a", "p"))] + [(paragraph, " (in the notes)") for paragraph in notes_paragraphs(notes_root)]
    found = [(paragraph, where, *whole_words(paragraph_text(paragraph)[2], old)) for paragraph, where in places]
    whole = [(paragraph, where) for paragraph, where, starts, _ in found for _ in starts]
    inside = [token for _, _, _, tokens in found for token in tokens]
    if not whole and inside:
        longer = ", ".join(f'"{token}"' for token in dict.fromkeys(inside))
        raise Refusal(f"slide {index} prints \"{old}\" only inside longer words or numbers - {longer} - and an edit rewrites whole words: name the one you mean as the slide prints it (`\"old\": \"{inside[0]}\"`), so that nothing beside it is rewritten")
    if not whole:
        raise Refusal(f"slide {index} does not print \"{old}\" in its text: `replace` names words as the slide's shapes, table cells and notes hold them, in one paragraph (a chart's numbers are in the chart, and are changed by giving the page a `type`)")
    if len(whole) > 1 and not every:
        named = "; ".join(f'"{shortened(paragraph_text(paragraph)[2])}"{where}' for paragraph, where in whole)
        raise Refusal(f"slide {index} prints \"{old}\" {len(whole)} times - {named} - and an edit names one thing: write more of the words around the one you mean in `old` and `new`, or say every one is meant with `\"all\": true`")
    return sum(replace_in_paragraph(paragraph, old, new) for paragraph, _ in dict.fromkeys(whole))


TITLE_TYPES = {"title", "ctrTitle"}


def set_title(root, title: str) -> bool:
    """Write `title` into the slide's title placeholder: its first run takes the text and keeps its formatting, and the title's other runs and paragraphs go."""
    for shape in root.iter(q("p", "sp")):
        holder = shape.find(f"{q('p', 'nvSpPr')}/{q('p', 'nvPr')}/{q('p', 'ph')}")
        if holder is None or holder.get("type") not in TITLE_TYPES:
            continue
        body = shape.find(q("p", "txBody"))
        if body is None:
            return False
        paragraphs = body.findall(q("a", "p"))
        if not paragraphs:
            paragraphs = [etree.SubElement(body, q("a", "p"))]
        first = next((p for p in paragraphs if p.find(q("a", "r")) is not None), paragraphs[0])
        for paragraph in paragraphs:
            if paragraph is not first:
                body.remove(paragraph)
        runs = first.findall(q("a", "r"))
        if runs:
            run = runs[0]
            for extra in [*runs[1:], *first.findall(q("a", "br")), *first.findall(q("a", "fld"))]:
                first.remove(extra)
        else:
            run = etree.Element(q("a", "r"))
            end = first.find(q("a", "endParaRPr"))
            (end.addprevious(run) if end is not None else first.append(run))
        text = run.find(q("a", "t"))
        if text is None:
            text = etree.SubElement(run, q("a", "t"))
        text.text = title
        return True
    return False


def edit_slide(data: bytes, entry: dict, index: int, notes: bytes | None = None) -> tuple:
    """A carried slide's XML with the plan's edits made, and its notes page's where an edit reached it; returns (slide bytes, notes bytes or None when untouched, what was done)."""
    root = etree.fromstring(data)
    notes_root = etree.fromstring(notes) if notes else None
    before = [paragraph_text(paragraph)[2] for paragraph in notes_paragraphs(notes_root)]
    done = []
    if "title" in entry:
        if not set_title(root, str(entry["title"])):
            raise Refusal(f"slide {index} has no title placeholder to retitle; replace its title's words with `replace` instead")
        done.append({"title": entry["title"]})
    for edit in entry.get("edits") or []:
        count = replace_text(root, notes_root, str(edit["old"]), str(edit["new"]), bool(edit.get("all")), index)
        done.append({"old": edit["old"], "new": edit["new"], "count": count})
    if "hidden" in entry:
        if entry["hidden"]:
            root.set("show", "0")
        elif "show" in root.attrib:
            del root.attrib["show"]
        done.append({"hidden": bool(entry["hidden"])})
    noted = notes_root is not None and before != [paragraph_text(paragraph)[2] for paragraph in notes_paragraphs(notes_root)]
    return serialise(root), (serialise(notes_root) if noted else None), done


# --- assembling ----------------------------------------------------------------

class Assembly:
    def __init__(self, source: Package, composed: Package | None):
        self.source, self.composed = source, composed
        self.parts = dict(source.parts)          # name -> bytes: the package being written
        self.new = set()                         # names this assembly wrote or rewrote
        self.renamed = {}                        # composed part name -> its name here
        self.types = {}                          # new part name -> content type
        self.presentation = etree.fromstring(source.parts[PRESENTATION])
        self.presentation_rels = etree.fromstring(source.parts[Package.rels_name(PRESENTATION)])
        self.notes_master = next((name for _, kind, name, _ in source.rels(PRESENTATION) if kind == REL + "notesMaster"), None)
        self.registered = set()                  # composed masters already listed in the presentation

    # names and ids ---------------------------------------------------------
    def free_name(self, name: str) -> str:
        """A name for a copied part that no part here has: the same family, the next number."""
        match = re.match(r"^(.*?)(\d+)(\.[^./]+)$", name)
        prefix, ext = (match.group(1), match.group(3)) if match else (name.rsplit(".", 1)[0] + "-", "." + name.rsplit(".", 1)[-1])
        taken = set(self.parts)
        number = 1
        while f"{prefix}{number}{ext}" in taken:
            number += 1
        return f"{prefix}{number}{ext}"

    def next_rel_id(self) -> str:
        used = {el.get("Id") for el in self.presentation_rels}
        number = 1
        while f"rId{number}" in used:
            number += 1
        return f"rId{number}"

    def master_ids(self) -> set:
        """Every id a master or a layout of this deck has: the two share one space."""
        ids = {int(el.get("id")) for el in self.presentation.iter(q("p", "sldMasterId")) if el.get("id")}
        for name, data in self.parts.items():
            if re.match(r"^ppt/slideMasters/[^/]+\.xml$", name):
                ids |= {int(el.get("id")) for el in etree.fromstring(data).iter(q("p", "sldLayoutId")) if el.get("id")}
        return ids

    # copying a composed slide in ------------------------------------------
    def bring(self, part: str) -> str:
        """Copy composed `part` and everything it draws on into this package; returns its name here."""
        if part in self.renamed:
            return self.renamed[part]
        package = self.composed
        # The host's notes master serves a composed slide's notes: a deck has one.
        stop = (lambda kind: kind == REL + "notesMaster") if self.notes_master else (lambda kind: False)
        closure = package.closure(part, stop)
        for name in closure:
            if name not in self.renamed:
                self.renamed[name] = self.free_name(name)
                self.parts[self.renamed[name]] = package.parts[name]
                self.new.add(self.renamed[name])
                self.types[self.renamed[name]] = package.content_type(name)
        for name in closure:
            here = self.renamed[name]
            rels = package.parts.get(Package.rels_name(name))
            if rels is None:
                continue
            root = etree.fromstring(rels)
            for el in list(root):
                if el.get("TargetMode") == "External":
                    continue
                resolved = resolve(name, el.get("Target", ""))
                if el.get("Type") == REL + "notesMaster" and self.notes_master:
                    to = self.notes_master
                elif resolved in self.renamed:
                    to = self.renamed[resolved]
                else:
                    root.remove(el)
                    continue
                el.set("Target", posixpath.relpath(to, posixpath.dirname(here)))
            self.parts[Package.rels_name(here)] = serialise(root)
            self.new.add(Package.rels_name(here))
        for name in closure:
            if re.match(r"^ppt/slideMasters/[^/]+\.xml$", name) and name not in self.registered:
                self.register_master(name)
            if re.match(r"^ppt/notesMasters/[^/]+\.xml$", name) and not self.notes_master:
                self.register_notes_master(name)
        return self.renamed[part]

    def register_master(self, name: str):
        """List a copied master in the presentation, its id and its layouts' ids renumbered past every id the deck uses."""
        self.registered.add(name)
        here = self.renamed[name]
        used = self.master_ids()
        number = max([MASTER_ID_FLOOR - 1, *used]) + 1
        root = etree.fromstring(self.parts[here])
        master_id = number
        for el in root.iter(q("p", "sldLayoutId")):
            number += 1
            el.set("id", str(number))
        self.parts[here] = serialise(root)
        rid = self.next_rel_id()
        etree.SubElement(self.presentation_rels, q("rel", "Relationship"), Id=rid, Type=REL + "slideMaster", Target=posixpath.relpath(here, "ppt"))
        masters = self.presentation.find(q("p", "sldMasterIdLst"))
        if masters is None:
            masters = etree.Element(q("p", "sldMasterIdLst"))
            self.presentation.insert(0, masters)
        entry = etree.SubElement(masters, q("p", "sldMasterId"))
        entry.set("id", str(master_id))
        entry.set(q("r", "id"), rid)

    def register_notes_master(self, name: str):
        here = self.renamed[name]
        self.notes_master = here
        rid = self.next_rel_id()
        etree.SubElement(self.presentation_rels, q("rel", "Relationship"), Id=rid, Type=REL + "notesMaster", Target=posixpath.relpath(here, "ppt"))
        listed = etree.Element(q("p", "notesMasterIdLst"))
        entry = etree.SubElement(listed, q("p", "notesMasterId"))
        entry.set(q("r", "id"), rid)
        masters = self.presentation.find(q("p", "sldMasterIdLst"))
        (masters.addnext(listed) if masters is not None else self.presentation.insert(0, listed))

    # dropping a source slide ----------------------------------------------
    def unlink(self, part: str, gone: set) -> list:
        """Take out of `part` every link to a slide in `gone`: the relationship, and each hyperlink that used it (its text stays).

        Returns the slides it linked to. A reference to a cut slide that is not
        a hyperlink - a slide zoom, a custom action - cannot be taken out
        without redrawing the slide, so it is refused."""
        rels_name = Package.rels_name(part)
        data = self.parts.get(rels_name)
        if data is None:
            return []
        rels = etree.fromstring(data)
        cut = {el.get("Id"): resolve(part, el.get("Target", "")) for el in rels
               if el.get("TargetMode") != "External" and slide_link(el.get("Type")) and resolve(part, el.get("Target", "")) in gone}
        if not cut:
            return []
        slide = etree.fromstring(self.parts[part])
        for el in list(slide.iter()):
            if el.get(q("r", "id")) not in cut:
                continue
            if el.tag not in (q("a", "hlinkClick"), q("a", "hlinkMouseOver")):
                raise Refusal(f"{part} refers to {cut[el.get(q('r', 'id'))]}, which the revision cuts, through <{etree.QName(el).localname}>: keep that slide, or redraw the slide that refers to it by giving its page a `type`")
            el.getparent().remove(el)
        for el in list(rels):
            if el.get("Id") in cut:
                rels.remove(el)
        self.parts[part], self.parts[rels_name] = serialise(slide), serialise(rels)
        self.new |= {part, rels_name}
        return sorted(set(cut.values()))

    def drop(self, part: str):
        """Remove a source slide's part, its relationships and the notes page that is its alone."""
        for _, kind, target, _ in self.source.rels(part):
            if kind == REL + "notesSlide" and target:
                for name in (target, Package.rels_name(target)):
                    self.parts.pop(name, None)
        for name in (part, Package.rels_name(part)):
            self.parts.pop(name, None)

    def reachable(self) -> set:
        """Every part of the package being written that something still draws on, from the package's own relationships down."""
        seen, queue = set(), [""]
        while queue:
            name = queue.pop()
            data = self.parts.get(Package.rels_name(name) if name else "_rels/.rels")
            if data is None:
                continue
            for el in etree.fromstring(data):
                if el.get("TargetMode") == "External":
                    continue
                resolved = resolve(name, el.get("Target", ""))
                if resolved in self.parts and resolved not in seen:
                    seen.add(resolved)
                    queue.append(resolved)
        return seen

    def sweep(self, dropped: list) -> list:
        """Remove what only the dropped slides drew on: each part of a dropped slide's closure that nothing kept reaches any more.

        Only those parts are candidates, so a part the source deck held and
        nothing ever pointed at stays as the user saved it; a chart, a
        workbook or a picture a kept slide also shows is reached, and stays."""
        candidates = [name for part in dropped for name in self.source.closure(part, slide_link)]
        kept = self.reachable()
        removed = []
        for name in dict.fromkeys(candidates):
            if name in self.parts and name not in kept:
                removed.append(name)
                for gone in (name, Package.rels_name(name)):
                    self.parts.pop(gone, None)
        return sorted(removed)

    # the presentation part ---------------------------------------------------
    def write_order(self, order: list, dropped: list):
        """`order` is the final slide list: ("carried", slide id, rel id) or ("composed", part name here)."""
        listed = self.presentation.find(q("p", "sldIdLst"))
        if listed is None:
            listed = etree.SubElement(self.presentation, q("p", "sldIdLst"))
        existing = {el.get("id"): el for el in listed}
        used = {int(i) for i in existing if i}
        for el in list(listed):
            listed.remove(el)
        sections = [el for el in self.presentation.iter(q("p14", "sldIdLst"))]
        dropped_ids = {slide_id for slide_id, _, _ in dropped}
        for section in sections:
            for el in list(section):
                if el.get("id") in dropped_ids:
                    section.remove(el)
        # A custom show lists slides by relationship: a dropped slide leaves it.
        dropped_rels = {rid for _, rid, _ in dropped}
        for el in list(self.presentation.iter(q("p", "sld"))):
            if el.get(q("r", "id")) in dropped_rels:
                el.getparent().remove(el)
        for rel in list(self.presentation_rels):
            if rel.get("Id") in dropped_rels:
                self.presentation_rels.remove(rel)
        previous, ids = None, []
        for item in order:
            if item[0] == "carried":
                entry = existing[item[1]]
                listed.append(entry)
                previous = item[1]
            else:
                number = max([SLIDE_ID_FLOOR - 1, *used]) + 1
                used.add(number)
                rid = self.next_rel_id()
                etree.SubElement(self.presentation_rels, q("rel", "Relationship"), Id=rid, Type=REL + "slide", Target=posixpath.relpath(item[1], "ppt"))
                entry = etree.SubElement(listed, q("p", "sldId"))
                entry.set("id", str(number))
                entry.set(q("r", "id"), rid)
                # A deck with sections keeps every slide in one: a new slide joins the section of the slide before it.
                self.join_section(sections, str(number), previous)
                previous = str(number)
            ids.append(entry.get("id"))
        self.parts[PRESENTATION] = serialise(self.presentation)
        self.parts[Package.rels_name(PRESENTATION)] = serialise(self.presentation_rels)
        self.new |= {PRESENTATION, Package.rels_name(PRESENTATION)}
        return ids

    @staticmethod
    def join_section(sections: list, new_id: str, previous: str | None):
        if not sections:
            return
        for section in sections:
            for el in section:
                if el.get("id") == previous:
                    entry = etree.Element(q("p14", "sldId"))
                    entry.set("id", new_id)
                    el.addnext(entry)
                    return
        entry = etree.Element(q("p14", "sldId"))
        entry.set("id", new_id)
        sections[0].insert(0, entry)

    def write_content_types(self):
        root = etree.fromstring(self.source.parts[CONTENT_TYPES])
        defaults = {el.get("Extension", "").lower(): el.get("ContentType") for el in root.findall(q("ct", "Default"))}
        for el in root.findall(q("ct", "Override")):
            if el.get("PartName", "").lstrip("/") not in self.parts:
                root.remove(el)
        overridden = {el.get("PartName") for el in root.findall(q("ct", "Override"))}
        for name in sorted(self.types):
            kind = self.types[name]
            if not kind or "/" + name in overridden:
                continue
            ext = name.rsplit(".", 1)[-1].lower()
            if defaults.get(ext) == kind:
                continue
            if ext not in defaults and not name.endswith(".xml"):
                etree.SubElement(root, q("ct", "Default"), Extension=ext, ContentType=kind)
                defaults[ext] = kind
                continue
            etree.SubElement(root, q("ct", "Override"), PartName="/" + name, ContentType=kind)
        self.parts[CONTENT_TYPES] = serialise(root)
        self.new.add(CONTENT_TYPES)

    def save(self) -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            names = [name for name in self.source.infos if name in self.parts] + sorted(name for name in self.parts if name not in self.source.infos)
            for name in names:
                kept = self.source.infos.get(name) if name not in self.new else None
                info = zipfile.ZipInfo(name, date_time=kept.date_time if kept else STAMP)
                info.compress_type = kept.compress_type if kept else zipfile.ZIP_DEFLATED
                info.external_attr = kept.external_attr if kept else 0o600 << 16
                archive.writestr(info, self.parts[name])
        return buffer.getvalue()


def assemble(plan: dict, base: Path) -> tuple:
    """The assembled package's bytes and the report of what was done."""
    source_path = (base / plan["source"]).resolve()
    if not source_path.is_file():
        raise Refusal(f"The source deck is not at {source_path}: a revision carries slides from the copy the import kept beside the inventory (<id>.source.pptx); run runtime/import-deck.py on the user's deck again")
    source_bytes = source_path.read_bytes()
    digest = hashlib.sha256(source_bytes).hexdigest()
    if plan.get("sha256") and digest != plan["sha256"]:
        raise Refusal(f"{source_path.name} is not the deck the inventory was read from (its hash differs): the revision's slide ids and its carried slides belong to the deck as imported. Import the deck again, or put the imported copy back")
    source = Package(source_bytes)
    composed = Package((base / plan["composed"]).resolve().read_bytes()) if plan.get("composed") else None
    assembly = Assembly(source, composed)
    listed, made = source.slides(), composed.slides() if composed else []
    order, used, edits, carried = [], set(), [], []
    for entry in plan["slides"]:
        if "carry" in entry:
            index = int(entry["carry"])
            if not 1 <= index <= len(listed) or index in used:
                raise Refusal(f"The plan carries source slide {index} {'twice' if index in used else f'of a deck of {len(listed)}'}")
            used.add(index)
            slide_id, rid, part = listed[index - 1]
            if any(key in entry for key in ("title", "edits", "hidden")):
                notes_part = source.notes_of(part)
                assembly.parts[part], notes, done = edit_slide(source.parts[part], entry, index, source.parts.get(notes_part))
                assembly.new.add(part)
                if notes is not None:
                    assembly.parts[notes_part] = notes
                    assembly.new.add(notes_part)
                edits.append({"slide": index, "changes": done, **({"notes": True} if notes is not None else {})})
            else:
                carried.append((index, part))
            order.append(("carried", slide_id, rid))
        else:
            index = int(entry["composed"])
            if composed is None or not 1 <= index <= len(made):
                raise Refusal(f"The plan places composed slide {index}, and the composed deck holds {len(made)}")
            order.append(("composed", assembly.bring(made[index - 1][2])))
    dropped = [(slide_id, rid, part) for at, (slide_id, rid, part) in enumerate(listed, 1) if at not in used]
    # A kept slide that links to a cut one loses the link (its text stays): a link to a missing part is a damaged file.
    # The slide is then changed, so it is reported as an edit and not proven identical.
    gone = {part for _, _, part in dropped}
    for at, (_, _, part) in enumerate(listed, 1):
        if at in used and (unlinked := assembly.unlink(part, gone)):
            change = {"unlinked": unlinked}
            known = next((edit for edit in edits if edit["slide"] == at), None)
            (known["changes"].append(change) if known else edits.append({"slide": at, "changes": [change]}))
            carried = [(index, kept) for index, kept in carried if index != at]
    for _, _, part in dropped:
        assembly.drop(part)
    # A deck whose slides are all carried in their own order lists them as it did: the three parts that list them are not written again.
    removed = []
    if dropped or any(item[0] == "composed" for item in order) or [item[2] for item in order] != [rid for _, rid, _ in listed]:
        assembly.write_order(order, dropped)
        # With the slide list rewritten, what the dropped slides alone drew on is reached by nothing.
        removed = assembly.sweep([part for _, _, part in dropped])
        assembly.write_content_types()
    data = assembly.save()
    # What was kept, proven on the written file: each carried slide's part and every part it draws on, read back and compared.
    written = Package(data)
    preserved, compared, drifted = 0, set(), []
    for index, part in carried:
        closure = source.closure(part, slide_link)
        same = all(written.parts.get(name) == source.parts[name] for name in closure)
        compared |= set(closure)
        if same:
            preserved += 1
        else:
            drifted.append(index)
    untouched = sum(1 for name, blob in source.parts.items() if written.parts.get(name) == blob)
    report = {"slides": len(order), "carried": len(carried), "edited": len(edits), "composed": sum(1 for item in order if item[0] == "composed"),
              "dropped": [at for at, _ in enumerate(listed, 1) if at not in used], "removed": removed, "edits": edits,
              "preserved": {"slides": preserved, "of": len(carried), "parts": len(compared), "drifted": drifted,
                            "sourceParts": len(source.parts), "sourcePartsIdentical": untouched}}
    return data, report


def check(plan: dict, base: Path) -> list:
    """Every carried slide of the plan tried on the source deck: the refusals, as { slide, message }."""
    source_path = (base / plan["source"]).resolve()
    if not source_path.is_file():
        return [{"slide": None, "message": f"The source deck is not at {source_path}"}]
    source = Package(source_path.read_bytes())
    listed, refusals = source.slides(), []
    for entry in plan["slides"]:
        index = int(entry["carry"])
        if not 1 <= index <= len(listed):
            refusals.append({"slide": index, "message": f"the source deck has no slide {index}"})
            continue
        if not any(key in entry for key in ("title", "edits", "hidden")):
            continue
        # In sequence, as assemble() makes them, so an edit is tried on the slide the edits before it leave; one that
        # cannot be made is listed and skipped, so it does not hide the next.
        part = listed[index - 1][2]
        slide, notes = source.parts[part], source.parts.get(source.notes_of(part))
        for single in [{key: entry[key]} for key in ("title",) if key in entry] + [{"edits": [edit]} for edit in entry.get("edits") or []]:
            try:
                slide, edited_notes, _ = edit_slide(slide, single, index, notes)
                notes = edited_notes if edited_notes is not None else notes
            except Refusal as refusal:
                refusals.append({"slide": index, "message": str(refusal)})
    return refusals


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("plan", type=Path)
    parser.add_argument("out", type=Path, nargs="?")
    parser.add_argument("--check", action="store_true", help="try the carried slides' edits on the source deck and write nothing")
    args = parser.parse_args(argv)
    if args.check == (args.out is not None):
        parser.error("give the file to write, or --check")
    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    if args.check:
        refusals = check(plan, args.plan.resolve().parent)
        print(json.dumps({"refusals": refusals}))
        return 2 if refusals else 0
    try:
        data, report = assemble(plan, args.plan.resolve().parent)
    except Refusal as refusal:
        print(json.dumps({"refused": str(refusal)}))
        print(refusal, file=sys.stderr)
        return 2
    args.out.write_bytes(data)
    print(json.dumps({"out": str(args.out), **report}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
