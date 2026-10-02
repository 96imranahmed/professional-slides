"""WCAG relative luminance and contrast, computed as the scene computes them.

palettes.mjs `contrastRatio` and core.mjs `onFill` decide which colour a
label takes on a fill when the scene is composed; the emitter sets the native
chart's labels with `on_fill`, and the template importer judges a house's
colours with `luminance` and `contrast`. evals/tests/test_color_parity.py
holds them to the JavaScript.
"""

from __future__ import annotations


def channel(value: float) -> float:
    """One sRGB channel (0..1) linearised."""
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def luminance(hex_color) -> float:
    """Relative luminance (0..1) of a #RRGGBB or RRGGBB colour; 1.0, white,
    for a value that is not one."""
    try:
        h = str(hex_color).lstrip("#")
        r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    except ValueError:
        return 1.0
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(a, b) -> float:
    """The WCAG contrast ratio of two colours, 1 to 21."""
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def on_fill(fill, on="#FFFFFF", ink="#000000"):
    """The reversed white or the ink, whichever reads better on `fill`."""
    return on if contrast(fill, on) >= contrast(fill, ink) else ink
