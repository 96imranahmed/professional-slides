"""The one definition of a word in the Python runtime.

A word is what the text contract counts: text-contract.mjs `textWords`, the
count the composer writes on each scene slide as `planBodyWords`. The text is
normalised (`normalize_text`, text-contract.mjs `normalizeText`): NFKC, soft
hyphens and zero-width spaces dropped, a hyphen that ends a line joined to the
next line, whitespace collapsed and trimmed. It is then split on whitespace,
where whitespace is JavaScript's `\\s`. Every token is a word: "12%", "$1.2B",
"-", a bullet and a URL are one word each.

A printed word (`printed_words`) is a word carrying a letter or a digit: the
unit of a rendered PDF's text, where pdftotext sets list bullets and dashes as
tokens of their own. The density profile reads rendered pages with it, as the
calibration measured the targets those pages are compared with.

Content words (`content_words`) are the lower-case runs of letters, four
letters and up, that are not stopwords (stopwords.json `content`): what two
sentences share when they say the same thing. content_gates.mjs
`contentWords` extracts the same set.

evals/tests/test_text_stats.py holds all three to their JavaScript
definitions over the same strings.
"""

from __future__ import annotations

import re
import unicodedata

# JavaScript's `\s`: the characters String.prototype.split(/\s+/) splits on.
# Python's own `\s` differs (it takes U+001C-U+001F and U+0085, and not
# U+FEFF), so the class is spelled out.
JS_SPACE = "\t\n\v\f\r    -     　﻿"
SPACE = re.compile(f"[{JS_SPACE}]+")
INVISIBLE = re.compile("[­​]")
LINE_BREAK_HYPHEN = re.compile(f"-[{JS_SPACE}]*\r?\n[{JS_SPACE}]*")


def normalize_text(value) -> str:
    text = unicodedata.normalize("NFKC", "" if value is None else str(value))
    text = INVISIBLE.sub("", text)
    text = LINE_BREAK_HYPHEN.sub("-", text)
    return SPACE.sub(" ", text).strip(" ")


def words(value) -> list:
    """The words of `value`, in order."""
    text = normalize_text(value)
    return text.split(" ") if text else []


def word_count(value) -> int:
    return len(words(value))


