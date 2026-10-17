// Nice numbers: the values an axis, a shared scale or a legend may land on.
// One definition for the renderer's axis domain and ticks (chart-axes.mjs `range`
// and `tickCount`, which gates/nice_ticks.py ports), the shared maximum of peer
// charts (compose-arrangements.mjs) and a map's size legend (maps.mjs).

/**
 * Tick steps a reader recognises: 1, 2, 2.5 or 5 times a power of ten.
 * Interpolating the raw data extrema instead yields axes reading 14.025 or
 * 22.75, which is the loudest amateur tell a chart can carry.
 */
export const STEP_LADDER = Object.freeze([1, 2, 2.5, 5]);

// The ladder with the next decade's 1 on top: the rungs a value rounds up to.
export const ROUNDING_LADDER = Object.freeze([...STEP_LADDER, 10]);

// A shared maximum is divided into ladder steps afterwards (tickCount), so it
// may stop at any multiple of its decade that three to six such steps reach:
// 1.2 is six steps of 0.2, 1.5 three of 0.5, 8 four of 2.
export const CEILING_LADDER = Object.freeze([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]);

/** The power of ten at or below `value` (a positive number). */
export const decade = (value) => Math.pow(10, Math.floor(Math.log10(value)));

/** Whether `step` is 1, 2, 2.5, 5 or 10 times a power of ten. */
export function onLadder(step) {
  const normalized = step / decade(step);
  return ROUNDING_LADDER.some((value) => Math.abs(normalized - value) < 1e-9);
}

/**
 * Whether [min, max] divided into `count` equal steps is an axis a reader
 * would choose: the step on the ladder, and every tick a whole number of steps
 * from zero. It is the rule the tick gate holds a drawn axis to
 * (gates/nice_ticks.py nice_axis), and the one the renderer divides a domain
 * by (chart-axes.mjs tickCount), so an axis the renderer chooses passes the
 * gate. On the ladder alone is not enough: -3,000 to 3,000 in three steps of
 * 2,000 reads -3,000, -1,000, 1,000, 3,000 - every tick an odd thousand, none
 * a whole step - where six steps of 1,000 read the axis a reader expects.
 */
export function wholeSteps(min, max, count) {
  const step = (max - min) / count;
  if (!(step > 0) || !Number.isFinite(step) || !onLadder(step)) return false;
  // Held as the gate holds it: a tick off a whole step by more than a millionth of the axis's largest value.
  const scale = Math.max(Math.abs(min), Math.abs(max)) || 1;
  return Math.abs(Math.round(min / step) * step - min) <= scale * 1e-6;
}

/** Candidate steps in ascending order, starting a decade below the rough step. */
export function* stepCandidates(rough) {
  const start = Math.floor(Math.log10(rough > 0 && Number.isFinite(rough) ? rough : 1)) - 1;
  for (let exponent = start; exponent <= start + 4; exponent += 1) {
    const magnitude = Math.pow(10, exponent);
    for (const rung of STEP_LADDER) yield rung * magnitude;
  }
}

/**
 * The smallest rung of `ladder`, times `value`'s decade, at or above `value`
 * (a positive number). `slack` below 1 lets a value a hair over a rung keep it:
 * 1001 at 0.999 stays 1000.
 */
export function niceCeiling(value, { ladder = ROUNDING_LADDER, slack = 1 } = {}) {
  const magnitude = decade(value);
  return (ladder.find((rung) => rung * magnitude >= value * slack) ?? 10) * magnitude;
}
