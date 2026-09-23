"""Nice-number axis ladder.

Mirror of the JavaScript `range()` in `runtime/charts.mjs` so the deterministic
page gates can check a rendered axis without shelling into Node, and so the two
implementations can be fuzzed against each other.

An axis tick a reader recognises sits on the 1 / 2 / 2.5 / 5 ladder times a
power of ten. Interpolating the raw data extrema instead produces axes reading
14.025 or 22.75, which is the loudest amateur tell a chart can carry.
"""

from __future__ import annotations

import math
import re
from typing import Iterable, Iterator, Sequence

STEP_LADDER = (1.0, 2.0, 2.5, 5.0)

# Tolerance used when comparing a mantissa against the ladder. Rendered labels
# are already rounded for display, so this only has to absorb float noise.
_EPS = 1e-9

# A tick label is a number, optionally wearing a currency symbol, a sign, a
# percent sign or a magnitude suffix. Anything else ("Q1", "FY24") is a
# category label and not the axis's business.
_LABEL_RE = re.compile(
    r"^[\s\u2212+$\u20ac\u00a3\u00a5-]*"
    r"(?P<number>\d[\d,]*(?:\.\d+)?)"
    r"\s*(?:%|pp|x|k|m|bn|b|tn)?\s*$",
    re.I,
)
_SUFFIXES = {"k": 1e3, "m": 1e6, "bn": 1e9, "b": 1e9, "tn": 1e12}


def parse_number(label: str):
    """Extract the numeric value from an axis label, or None.

    Handles currency prefixes, thousands separators, a trailing percent sign and
    the k / m / bn magnitude suffixes. Returns the value as written on the axis
    (the suffix is *not* expanded) because the ladder check is about the digits
    the reader sees, not the underlying quantity.
    """
    if label is None:
        return None
    text = str(label).strip()
    if not text:
        return None
    match = _LABEL_RE.match(text)
    if not match:
        return None
    sign = -1.0 if text.lstrip()[:1] in ("-", "\u2212") else 1.0
    try:
        return sign * float(match.group("number").replace(",", ""))
    except ValueError:
        return None


def magnitude_suffix(label: str):
    """Return the magnitude multiplier implied by a trailing k/m/bn, else 1."""
    text = str(label or "").strip().lower()
    for suffix, factor in sorted(_SUFFIXES.items(), key=lambda kv: -len(kv[0])):
        if text.endswith(suffix):
            return factor
    return 1.0


def mantissa(value: float) -> float:
    """Normalised mantissa of |value| in [1, 10)."""
    if value == 0:
        return 0.0
    exponent = math.floor(math.log10(abs(value)))
    return abs(value) / (10.0 ** exponent)


def on_ladder(value: float) -> bool:
    """True when |value| is 1, 2, 2.5 or 5 times a power of ten (or zero)."""
    if value == 0:
        return True
    if not math.isfinite(value):
        return False
    m = mantissa(value)
    # A mantissa of 10 can appear through float error at decade boundaries.
    return any(abs(m - rung) < 1e-6 for rung in STEP_LADDER + (10.0,))


def decimal_places(value: float, limit: int = 6) -> int:
    """Number of decimals needed to write the value exactly (capped)."""
    if not math.isfinite(value):
        return limit + 1
    for places in range(limit + 1):
        if abs(round(value, places) - value) < 1e-9:
            return places
    return limit + 1


def significant_digits(value: float, limit: int = 12) -> int:
    """Significant digits needed to write |value| exactly (capped)."""
    if value == 0 or not math.isfinite(value):
        return 1
    exponent = math.floor(math.log10(abs(value)))
    for digits in range(1, limit + 1):
        scale = 10.0 ** (digits - 1 - exponent)
        if abs(round(abs(value) * scale) / scale - abs(value)) < abs(value) * 1e-12:
            return digits
    return limit + 1


def is_nice_tick(value: float) -> bool:
    """The gate's acceptance rule for a single rendered tick value.

    A tick passes when it sits on the 1/2/2.5/5 ladder, when it is written with
    at most one decimal place (an integer, or one significant trailing decimal
    such as 12.5), or when it carries at most two significant digits - which is
    what a ladder step produces on a sub-unit axis (0.003, 0.0015, 0.75).

    It fails for 14.025 or 22.75: four or five significant digits with two or
    more decimals can only come from interpolating raw extrema.
    """
    if value is None or not math.isfinite(value):
        return False
    if on_ladder(value):
        return True
    if decimal_places(value) <= 1:
        return True
    digits = significant_digits(value)
    if digits <= 2:
        return True
    # A 2.5 step puts a 5 in the third significant place (2.25, 0.00275).
    # Nothing else on the ladder reaches three significant digits.
    return digits == 3 and round(mantissa(value) * 100) % 10 == 5


def nice_axis(values: Sequence[float]):
    """Judge a whole axis rather than one label.

    An axis is the real unit of the ladder rule: the step between ticks must be
    a ladder number and every tick must be a whole number of steps from the
    others. This is what catches 12.4 / 14.025 / 15.65 / 17.275 / 18.9 - a step
    of 1.625, produced by interpolating the data extrema.

    Returns (ok, detail). A single-tick axis falls back to `is_nice_tick`.
    """
    numbers = sorted(float(v) for v in values if v is not None and math.isfinite(float(v)))
    if not numbers:
        return True, {"reason": "no numeric ticks"}
    if len(numbers) == 1:
        return is_nice_tick(numbers[0]), {"reason": "single tick", "ticks": numbers}
    steps = [b - a for a, b in zip(numbers, numbers[1:])]
    step = steps[0]
    scale = max(abs(n) for n in numbers) or 1.0
    if step <= 0 or any(abs(s - step) > scale * 1e-6 for s in steps):
        return False, {"reason": "uneven steps", "ticks": numbers, "steps": steps}
    if not on_ladder(step):
        return False, {"reason": "step is off the ladder", "ticks": numbers, "step": step}
    for value in numbers:
        if abs(round(value / step) * step - value) > scale * 1e-6:
            return False, {"reason": "tick is not a whole step", "ticks": numbers, "step": step}
    return True, {"ticks": numbers, "step": step}


def step_candidates(rough: float) -> Iterator[float]:
    """Ladder steps in ascending order, starting a decade below `rough`."""
    base = rough if (rough > 0 and math.isfinite(rough)) else 1.0
    start = math.floor(math.log10(base)) - 1
    for exponent in range(start, start + 5):
        magnitude = 10.0 ** exponent
        for rung in STEP_LADDER:
            yield rung * magnitude


def nice_domain(minimum: float, maximum: float, steps: int = 4, include_zero: bool = False) -> dict:
    """Port of `range()` from charts.mjs.

    Returns {"min", "max", "span", "step"} where the domain spans exactly
    `steps` whole ladder steps and every tick is a nice number.
    """
    lo, hi = float(minimum), float(maximum)
    if include_zero:
        lo, hi = min(0.0, lo), max(0.0, hi)
    if lo == hi:
        padding = abs(lo) * 0.05 or 1.0
        lo -= padding
        hi += padding
    data_min, data_max = lo, hi
    step = None
    nice_min = 0.0
    for candidate in step_candidates((data_max - data_min) / steps):
        start = math.floor(data_min / candidate + _EPS) * candidate
        if start + candidate * steps >= data_max - _EPS:
            step = candidate
            nice_min = start
            break
    if step is None:
        step = (data_max - data_min) / steps
        nice_min = data_min
    exponent = math.floor(math.log10(step))
    normalised = step / (10.0 ** exponent)
    decimals = max(0, -exponent + (1 if abs(normalised - 2.5) < 1e-9 else 0))
    decimals = min(10, decimals)

    def rounded(value: float) -> float:
        return float(round(value, decimals))

    lo = rounded(nice_min)
    hi = rounded(nice_min + step * steps)
    return {"min": lo, "max": hi, "span": (hi - lo) or 1.0, "step": rounded(step)}


def ticks(minimum: float, maximum: float, steps: int = 4, include_zero: bool = False) -> list:
    """The tick values a `nice_domain` implies, inclusive of both endpoints."""
    domain = nice_domain(minimum, maximum, steps, include_zero)
    return [round(domain["min"] + domain["step"] * i, 10) for i in range(steps + 1)]


def best_domain(values: Sequence[float], include_zero: bool = False, steps_range: Iterable[int] = (3, 4, 5, 6)) -> dict:
    """Pick the step count in `steps_range` that leaves the least headroom.

    Item 25 of the revamp: letting `steps` vary 3-6 minimises the empty band
    above the tallest bar while keeping every tick on the ladder.
    """
    finite = [float(v) for v in values if v is not None and math.isfinite(float(v))]
    if not finite:
        raise ValueError("best_domain requires at least one finite value")
    lo, hi = min(finite), max(finite)
    best = None
    for steps in steps_range:
        domain = nice_domain(lo, hi, steps, include_zero)
        headroom = (domain["max"] - hi) + (lo - domain["min"])
        score = (headroom / domain["span"], steps)
        if best is None or score < best[0]:
            best = (score, {**domain, "steps": steps})
    return best[1]
