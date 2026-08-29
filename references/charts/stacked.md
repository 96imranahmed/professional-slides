# Stacked Bars and Areas

## Best for

Composition across categories or time, contribution to a total, and share
shifts with a stable category set.

## Data contract

Each stack must reconcile to its total. Declare absolute versus percentage
mode, segment order, treatment of negative values, and the threshold for any
grouped `Other` category.

## Construction

- Use 100% stacking for share and absolute stacking for magnitude.
- Put the most important or stable segment on the baseline.
- Keep segment order constant across stacks.
- Limit segments and disclose the rule for `Other`.
- Add total labels when both magnitude and mix matter.
- Prefer bars to areas when exact category comparison matters.
- Use direct segment labels only where space and contrast support them.

## Platform mapping

Map series order and stack mode explicitly; do not trust application defaults.
Read back totals and category order. Verify that percentage charts normalize
correctly and that labels do not disappear or move after conversion.

## Failure modes

Comparing many middle segments, inconsistent series order, irregular time in an
area chart, too many colors, narrow segments with unreadable labels, and totals
that do not reconcile.

## Acceptance test

Each total or 100% stack reconciles after rounding, and the composition change
supporting the title can be found without consulting a legend repeatedly.
