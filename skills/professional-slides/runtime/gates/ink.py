"""Reading the renders: where the pixels are, and how dark.

Pulled out of page_gates.py, which is 2,700 lines and 37 gates over one shared
vocabulary of helpers and constants - a cluster that mostly earns its single
file. This part does not: it depends on none of that vocabulary, only on the
canvas size and two luminance thresholds, and it is the only part of the gates
that needs a package the rest of the pipeline does without.

Pillow and numpy are optional (see requirements.txt). Both loaders return None
rather than raising when they are absent, so a machine without them still gets
every gate that reads the scene, and the report names the slides whose renders
it could not measure.
"""
from __future__ import annotations

from pathlib import Path

# The canvas every render is measured on, and what counts as marked.
# `INK_LUMINANCE` is type and marks; `SURFACE_LUMINANCE` also counts a tinted
# card or band, so the void gates read designed space rather than emptiness.
CANVAS_W, CANVAS_H = 1280, 720
INK_LUMINANCE = 235
SURFACE_LUMINANCE = 250


def relative(histogram, luminance):
    """The threshold for this page, measured from its own background.

    The two luminances were absolute: ink below 235, occupied below 250. On a
    white page that is right. On a warm cream canvas (the editorial design's
    247) every pixel of the page is below 250, so every row read as occupied
    and the dead-band and void gates could never fire - a half-empty page
    passed them. The background is the page's commonest grey; the thresholds
    keep their distance from it.
    """
    background = max(range(256), key=histogram.__getitem__)
    return luminance - (255 - background)


def _threshold(grey, luminance):
    return relative(grey.histogram(), luminance) if luminance < 255 else luminance


def load_ink_matrix(path, luminance=INK_LUMINANCE):
    """The 1280x720 ink mask as a numpy array (rows x columns of booleans), or
    None when numpy or Pillow is not installed. Column-aware gates need the
    grid; the row gates take its row sums."""
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        return None

    with Image.open(path) as image:
        grey = image.convert("L")
        if grey.size != (CANVAS_W, CANVAS_H):
            grey = grey.resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
        return np.asarray(grey) < _threshold(grey, luminance)


def load_ink_rows(path, luminance=INK_LUMINANCE):
    """Return rows[y] = count of pixels darker than `luminance` on that row of the
    1280x720 canvas, or None when Pillow is not installed. Ink uses
    INK_LUMINANCE; occupancy (for the dead-band and void gates) uses
    SURFACE_LUMINANCE so a tinted card or band counts as designed space rather
    than emptiness.

    Pillow is optional (see requirements.txt), and it is the only thing these
    three gates need that the rest of the file does not. Crashing here took the
    whole report down - every scene-level gate included - on a machine that was
    missing one package, which is the wrong trade: the pixel gates are a
    supplement to the scene gates, not a precondition for them. `load_ink_matrix`
    already returned None for absent numpy; this matches it."""
    try:
        from PIL import Image
    except ImportError:
        return None

    with Image.open(path) as image:
        grey = image.convert("L")
        if grey.size != (CANVAS_W, CANVAS_H):
            grey = grey.resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
        luminance = _threshold(grey, luminance)
        try:
            import numpy as np

            return (np.asarray(grey) < luminance).sum(axis=1).tolist()
        except ImportError:
            pass
        mask = grey.point(lambda p: 255 if p < luminance else 0, mode="L")
        return [
            int(sum(mask.crop((0, y, CANVAS_W, y + 1)).histogram()[1:]))
            for y in range(CANVAS_H)
        ]


def render_path(render_dir, slide_number):
    directory = Path(render_dir)
    for pattern in (f"slide-{slide_number}.png", f"slide-{slide_number:02d}.png",
                    f"slide{slide_number}.png", f"{slide_number}.png"):
        candidate = directory / pattern
        if candidate.is_file():
            return candidate
    return None
