"""Nice-number axis ladder.

The renderer chooses an axis domain with `range()` and divides it with
`tickCount()` (runtime/charts.mjs). `nice_range` and `tick_count` are exact
ports of the two, so a Python reader - the page gate, the native chart's
headroom stop in emit_pptx.py - gets the domain the scene draws; a parity
test holds them to the JavaScript over many domains.

An axis tick a reader recognises sits on the 1 / 2 / 2.5 / 5 ladder times a
power of ten. Interpolating the raw data extrema instead produces axes reading
14.025 or 22.75, which is the loudest amateur tell a chart can carry.
`nice_axis` is the gate's rule for a rendered axis.
"""

from __future__ import annotations

import math
import re
from decimal import ROUND_HALF_UP, Decimal
from typing import Iterator, Sequence

STEP_LADDER = (1.0, 2.0, 2.5, 5.0)


# A tick label is a number, optionally wearing a currency symbol, a sign, a
# percent sign or a magnitude suffix. Anything else ("Q1", "FY24") is a
# category label and not the axis's business.
_LABEL_RE = re.compile(
    r"^[\s\u2212+$\u20ac\u00a3\u00a5-]*"
    r"(?P<number>\d[\d,]*(?:\.\d+)?)"
    r"\s*(?:%|pp|x|k|m|bn|b|tn)?\s*$",
    re.I,
)


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
    """Ladder steps in ascending order, starting a decade below `rough`
    (charts.mjs stepCandidates)."""
    base = rough if (rough > 0 and math.isfinite(rough)) else 1.0
    start = math.floor(math.log10(base)) - 1
    for exponent in range(start, start + 5):
        magnitude = 10.0 ** exponent
        for rung in STEP_LADDER:
            yield rung * magnitude


def to_fixed(value: float, places: int) -> float:
    """JavaScript's `Number(value.toFixed(places))`: the exact binary value
    rounded to `places` decimals, a tie going away from zero."""
    return float(Decimal(value).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


# The step counts a domain may be divided into, in the order that breaks a
# tie: the tightest division wins, and four wins a tie (charts.mjs TICK_COUNTS).
TICK_COUNTS = (4, 3, 5, 6)


def nice_range(values: Sequence[float], include_zero: bool = False) -> dict:
    """The axis domain the renderer draws for `values` (charts.mjs `range()`):
    {"min", "max", "span", "step", "steps"}, spanning `steps` whole ladder steps
    anchored at or below the data minimum, the tightest such span of the
    TICK_COUNTS divisions."""
    low, high = min(values), max(values)
    if include_zero:
        low, high = min(0, low), max(0, high)
    if low == high:
        padding = abs(low) * 0.05 or 1
        low -= padding
        high += padding
    best = None
    for steps in TICK_COUNTS:
        for candidate in step_candidates((high - low) / steps):
            start = math.floor(low / candidate + 1e-9) * candidate
            if start + candidate * steps >= high - 1e-9:
                if best is None or candidate * steps < best[0] * best[2] - 1e-9:
                    best = (candidate, start, steps)
                break
    step, nice_min, steps = best or ((high - low) / 4, low, 4)
    exponent = math.floor(math.log10(step))
    places = min(10, max(0, -exponent + (1 if step / 10.0 ** exponent == 2.5 else 0)))
    domain_min, domain_max = to_fixed(nice_min, places), to_fixed(nice_min + step * steps, places)
    return {"min": domain_min, "max": domain_max, "span": (domain_max - domain_min) or 1,
            "step": to_fixed(step, places), "steps": steps}


def tick_count(low: float, high: float, preferred: int = 4) -> int:
    """How many steps the renderer divides [low, high] into (charts.mjs
    `tickCount()`): the preferred count if it lands on the ladder, else three,
    five, six or two."""
    def on_ladder(count):
        step = (high - low) / count
        if not step > 0 or not math.isfinite(step):
            return False
        normalized = step / 10 ** math.floor(math.log10(step))
        return any(abs(normalized - value) < 1e-9 for value in (1, 2, 2.5, 5, 10))
    return next((count for count in (preferred, 3, 5, 6, 2) if on_ladder(count)), preferred)


def axis_ticks(low: float, high: float, preferred: int = 4) -> list:
    """The tick values the renderer draws on [low, high] (charts.mjs `axes()`)."""
    steps = tick_count(low, high, preferred)
    return [low + (high - low) * index / steps for index in range(steps + 1)]
