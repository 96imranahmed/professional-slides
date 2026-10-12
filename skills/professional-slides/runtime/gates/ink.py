"""Reading the renders: where the pixels are, and how dark.

A module of its own because it depends on none of the gates' vocabulary,
only on the canvas size and two luminance thresholds, and it is the only part
of the gates that needs a package the rest of the pipeline does without.

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
    # The canvas is the commonest light grey. A page whose dark panels cover
    # more pixels than its canvas - a rail and six navy flow boxes - made the
    # navy its "background", and every mark on it, and the canvas itself, read
    # as empty: a full page measured 72% dead band. A page with no light
    # canvas to speak of keeps its commonest grey.
    total = sum(histogram)
    light = range(128, 256)
    if sum(histogram[i] for i in light) >= 0.1 * total:
        background = max(light, key=histogram.__getitem__)
    else:
        background = max(range(256), key=histogram.__getitem__)
    return luminance - (255 - background)


def grey_contrast(a, b):
    """The WCAG contrast of two grey levels of a render (0-255), each read as
    the sRGB grey it is: what the eye gets of a colour pair once it is pixels."""
    def luminance(level):
        v = float(level) / 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def _threshold(grey, luminance):
    return relative(grey.histogram(), luminance) if luminance < 255 else luminance


def dark_background(histogram):
    """The commonest dark grey of a page set on a dark ground: its background."""
    return max(range(128), key=histogram.__getitem__)


def marked(grey, luminance, dark=False):
    """Whether each grey level of a load_grey array is marked, read from the
    page's own background (relative). `dark` says the page is set on a dark
    ground (the scene's canvas, scene_ink.dark_ground): there type and marks
    are lighter than the page, and a darker-than test saw none of them - a
    full navy page measured no ink at all and a 72% dead band - so a mark is a
    pixel lighter than the commonest dark grey by the same margin."""
    import numpy as np

    if luminance >= 255:
        return grey < luminance
    histogram = np.bincount(grey.ravel(), minlength=256).tolist()
    if dark:
        return grey > dark_background(histogram) + (255 - luminance)
    return grey < relative(histogram, luminance)


def load_grey(path):
    """The render's grey levels on the 1280x720 canvas as a numpy array, or
    None when numpy or Pillow is not installed. Every pixel gate reads one
    page through this array: the page is decoded once, not once a gate (a
    48-page deck was decoded 186 times). A render of another size is
    resampled to the canvas; the renderer writes the canvas size, so it is
    not."""
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        return None

    with Image.open(path) as image:
        grey = image.convert("L")
        if grey.size != (CANVAS_W, CANVAS_H):
            grey = grey.resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
        return np.asarray(grey)


def ink_matrix(grey, luminance=INK_LUMINANCE, dark=False):
    """The ink mask of a load_grey array (rows x columns of booleans), with
    the threshold measured from the page's own background (marked)."""
    return marked(grey, luminance, dark)


def ink_rows(grey, luminance=INK_LUMINANCE, dark=False):
    """rows[y] = count of marked pixels on row y of a load_grey array."""
    return ink_matrix(grey, luminance, dark).sum(axis=1).tolist()


def load_ink_matrix(path, luminance=INK_LUMINANCE, dark=False):
    """The 1280x720 ink mask as a numpy array (rows x columns of booleans), or
    None when numpy or Pillow is not installed. Column-aware gates need the
    grid; the row gates take its row sums."""
    grey = load_grey(path)
    return None if grey is None else ink_matrix(grey, luminance, dark)


def load_ink_rows(path, luminance=INK_LUMINANCE, dark=False):
    """Return rows[y] = count of pixels darker than `luminance` on that row of the
    1280x720 canvas, or None when Pillow is not installed. Ink uses
    INK_LUMINANCE; occupancy (for the dead-band and void gates) uses
    SURFACE_LUMINANCE so a tinted card or band counts as designed space rather
    than emptiness.

    Pillow is optional (see requirements.txt), and it is the only thing these
    three gates need that the rest of the file does not. Crashing here took the
    whole report down - every scene-level gate included - on a machine that was
    missing one package, which is the wrong trade: the pixel gates are a
    supplement to the scene gates, not a precondition for them. Without numpy
    the rows are counted with Pillow alone."""
    grey = load_grey(path)
    if grey is not None:
        return ink_rows(grey, luminance, dark)
    try:
        from PIL import Image
    except ImportError:
        return None

    with Image.open(path) as image:
        grey = image.convert("L")
        if grey.size != (CANVAS_W, CANVAS_H):
            grey = grey.resize((CANVAS_W, CANVAS_H), Image.LANCZOS)
        if dark and luminance < 255:
            floor = dark_background(grey.histogram()) + (255 - luminance)
            mask = grey.point(lambda p: 255 if p > floor else 0, mode="L")
        else:
            luminance = _threshold(grey, luminance)
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
