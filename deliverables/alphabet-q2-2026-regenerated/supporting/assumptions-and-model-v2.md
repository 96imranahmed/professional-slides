# Analytical model and decision rule

This model is an illustrative valuation sensitivity, not a price target, company guidance, a consensus forecast or an estimate selected by evidence. Its purpose is to expose the operating and cash-return assumptions that a new Class A purchase at $335.02 needs. All amounts are USD billions except stock price. Exact inputs, formulas and every annual output are in `model.mjs` and `calculations.json`.

## Timing and scope

Value date: 1 September 2026 close. Five rolling scenario years end 1 September 2027 through 1 September 2031. Cash flows are discounted at year end. Year 0 revenue is four times reported Q2 2026, excluding its 0.106 hedging gain: 478.760. This is a capacity/run-rate anchor, not FY2026 revenue. Q2 seasonality, TPU launch effects and acquisition mix can make this anchor unrepresentative. The model does not insert an unreported FY2026 second half or claim a seasonal adjustment.

The asset and capital-structure bridge is frozen at June 2026. The known July legal payment is captured in the full June legal reserve. Unobserved July/August operations, investment price changes and capital issuance are not assumed as facts. A $20 billion change in net assets changes value by $1.64 per share. This date mismatch is a limitation of the specified evidence cutoff, with a bounded direct equity-bridge effect; changes in operating expectations could be much larger.

## Driver selection and rationale

Search, Cloud and remaining Services exhaust the material revenue base; Other Bets revenue stays at four times Q2. Search is modeled separately because it contributes 53% of Q2 revenue and its margins fund investment. Cloud is separate because it produces 48% of incremental revenue and is changing the capital requirement. YouTube, Network and subscriptions/devices are pooled only in the valuation schedule; their actual contributions remain separate on slide 3. Services and Cloud profitability are modeled separately before shared AI costs and Other Bets losses, so attractive Cloud segment margins cannot erase corporate AI expense.

The reference case deliberately contains both supportive and adverse assumptions: Search slows gradually from 15% to 6%; Cloud slows from 55% to 20% but compounds to $419 billion in Year 5; consolidated margin reaches approximately 35%; capital expenditure falls from 40% to 20% of revenue. Public evidence does not select these paths. They are an auditable middle set between a meaningful deterioration and sustained AI success, and the recommendation remains conditional on this analytical framework.

| Annual inputs, Year 1 to Year 5 | Downside | Reference | Upside |
| --- | --- | --- | --- |
| Search growth, % | 8 / 5 / 4 / 3 / 3 | 15 / 12 / 10 / 8 / 6 | 18 / 17 / 15 / 12 / 10 |
| Cloud growth, % | 35 / 25 / 20 / 15 / 12 | 55 / 40 / 30 / 25 / 20 | 70 / 55 / 45 / 35 / 25 |
| Remaining Services growth, % | 5 / 4 / 3 / 3 / 3 | 10 / 9 / 8 / 7 / 6 | 13 / 12 / 11 / 10 / 8 |
| Services margin, % | 39 / 38 / 37 / 36 / 36 | 42 / 42 / 42 / 43 / 43 | 43 / 44 / 45 / 45 / 45 |
| Cloud margin, % | 28 / 28 / 29 / 30 / 30 | 34 / 35 / 36 / 36 / 36 | 36 / 37 / 38 / 39 / 40 |
| Capex / revenue, % | 40 / 38 / 33 / 29 / 25 | 40 / 35 / 29 / 24 / 20 | 42 / 36 / 29 / 23 / 18 |
| Depreciation and amortization / revenue, % | 8 / 10 / 11 / 12 / 13 | 8 / 10 / 11 / 12 / 13 | 8 / 10 / 11 / 12 / 13 |
| Incremental working capital / incremental revenue, % | 15 | 10 | 8 |
| Portfolio recovery before tax/friction reserve, % of June carrying | 50 | 75 | 100 |
| Backstop loss reserve | 15 | 5 | 0 |

Shared assumptions: Other Bets operating loss begins at four times 1.799 and grows 5% annually. Corporate costs begin at four times 5.789 and grow 20%, 15%, 12%, 10%, 8%. Operating tax rate is 20%, compared with reported Q2 group tax of 19.1%, distorted by investment gains. No legal addback, SBC addback or amortization exclusion raises modeled operating profit. Cash-flow addback for D&A is explicit and distinct from the operating margin input.

Depreciation rises above the reported H1 rate near 6% of revenue because the asset base is expanding rapidly. It is not a vintage-based depreciation forecast; no asset useful-life change is invented. Terminal D&A of 13% and capex of 18% to 25% retain a material replacement and growth burden. The upside does not assume AI becomes asset-light. The reference path requires capital spending to peak near $242 billion in Year 2 and ease to $203 billion in Year 5 even as revenue passes $1 trillion. Failure of that efficiency assumption directly lowers valuation.

The common 10% discount rate is an assumed enterprise weighted-average cost of capital (WACC) for unlevered FCFF, not a cost of equity, a measured market WACC or supplied IC policy. This makes explicit the convention already implemented by the original `wacc` model parameter; it changes no cash flow, formula, rate or value. Ten percent is a round illustrative reference, and 8%–12% is a ±2 percentage-point sensitivity test, not an empirically calibrated or independently established appropriate range. The committee must accept an enterprise discount assumption before treating the conditional values as underwriting conclusions.

Each tested WACC is constant through the explicit forecast and terminal period; the model does not estimate capital weights, beta, risk-free rates, credit spreads or a changing future financing mix. FCFF excludes interest and net borrowing. Existing debt and debt-like claims enter the common-equity bridge once, after enterprise valuation; no financing cash flow or separate tax-shield value is added. Future financing paths are not modeled, so the selected WACC must represent the committee's accepted financing/risk assumption rather than an equity hurdle applied to unlevered cash flow. Three percent perpetual growth is an analyst long-run nominal assumption. Tax is fixed at 20% across cases to isolate operating assumptions; a sustained five-point tax increase would reduce value and needs re-underwriting.

## Formulas

For each scenario and year:

1. Revenue for each driver = prior driver revenue × (1 + its growth rate).
2. Services operating income = (Search + remaining Services revenue) × Services margin.
3. Consolidated operating income = Services OI + Cloud revenue × Cloud margin − corporate costs − Other Bets loss.
4. NOPAT = operating income × 80%.
5. D&A = revenue × D&A ratio; capex = revenue × capex ratio; working-capital investment = revenue increase × working-capital ratio.
6. FCFF = NOPAT + D&A − capex − incremental working capital. SBC remains an economic cost in margins, so it is not added back. Recurring cash compensation or issuance to cover stock awards cannot become free value through the cash-flow statement's SBC addback.
7. Terminal Year 6 revenue and NOPAT grow 3%; D&A and capex retain Year 5 revenue ratios; incremental working capital is 3% of Year 5 revenue times the scenario ratio. Terminal value = Year 6 FCFF / (discount rate − growth), discounted five years. This does not allow capex to fall to D&A immediately at the terminal boundary.
8. Enterprise value = present value of five FCFFs + present value of terminal value.
9. Common equity = enterprise value + the reconciled asset/claim bridge below; per-share value = common equity / 12.230.

No dividends are added to DCF value as a separate return. FCFF already values cash that can ultimately fund distributions. No share repurchase assumption reduces the denominator. The market-cap proxy of $4,097.3 billion uses Class A price for all common shares only to contextualize cash yields, not to claim all classes have identical market quotes.

## Annual output schedule

| Reference case, USD bn unless stated | Year 1 | Year 2 | Year 3 | Year 4 | Year 5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Revenue | 583.720 | 692.453 | 801.543 | 911.436 | 1,014.940 |
| Consolidated operating income | 196.893 | 235.250 | 275.117 | 318.690 | 354.719 |
| Operating margin, % | 33.73 | 33.97 | 34.32 | 34.97 | 34.95 |
| NOPAT | 157.514 | 188.200 | 220.094 | 254.952 | 283.775 |
| D&A | 46.698 | 69.245 | 88.170 | 109.372 | 131.942 |
| Capex | 233.488 | 242.358 | 232.447 | 218.745 | 202.988 |
| Working-capital investment | 10.496 | 10.873 | 10.909 | 10.989 | 10.350 |
| FCFF | -39.772 | 4.214 | 64.907 | 134.590 | 202.379 |

Downside annual FCFF: -54.017 / -39.389 / -7.201 / 24.283 / 61.546. Upside annual FCFF: -46.285 / 10.969 / 100.338 / 209.532 / 334.144. Full segment schedules for all cases appear in `calculations.json`; no annual row is omitted there.

## Asset and claim reconciliation

| Adjustment, USD bn | Downside | Reference | Upside | Treatment |
| --- | ---: | ---: | ---: | --- |
| Cash and marketable debt | 155.411 | 155.411 | 155.411 | 55.911 + 99.500. Excludes all equity holdings from immediate liquidity. |
| Investment portfolio | 87.244 | 130.866 | 174.488 | (87.063 current equity + 14.126 long-term equity + 131.461 nonmarketable) × case recovery × 75% after-tax/friction factor. No mark-to-market gains enter operating income. |
| Debt face value | -101.085 | -101.085 | -101.085 | Includes current and noncurrent notes and other long-term debt; no double subtraction of current debt. |
| Finance leases | -2.590 | -2.590 | -2.590 | Debt-like treatment. Operating leases remain operating costs. |
| Preferred proxy | -19.250 | -19.250 | -19.250 | Full gross liquidation amount used as a conservative economic claim. No simultaneous converted-share dilution. |
| Accrued legal obligations | -17.400 | -17.400 | -17.400 | Full June reserve, including the $5.2 billion subsequently paid in July. Future recurring legal expense remains in margins. |
| Long-term tax payable | -11.306 | -11.306 | -11.306 | Conservative full reserve, timing uncertain. |
| Future VIE capital funding | -21.900 | -21.900 | -21.900 | Full reserve with no assumed new asset value. Includes the contingent $20.0 billion; intentionally conservative. |
| Backstop loss reserve | -15.000 | -5.000 | 0.000 | Scenario cost, not probability-weighted fair value or company expectation. |
| Net bridge | 54.124 | 107.746 | 156.368 | Added once to enterprise value. |

The portfolio's 25% tax/friction haircut applies to carrying value rather than a sourced taxable basis and is deliberately conservative. Do not also deduct the $22.819 billion deferred-tax liability, which would overlap substantially with the tax reserve. Other contingent or tax exposures cannot be precisely netted from the filing. A full additional $22.819 billion reserve would reduce price by $1.87; removing the entire future VIE funding reserve would add $1.79. These amounts do not close the reference case's price gap.

The preferred stock will convert in 2029, while this five-year model uses its liquidation preference as a debt-like proxy. That simplification avoids forecasting relative Class A and Class C prices, capped-call settlement and dividend-in-shares choices. It is not a contractual redemption assumption. An approximate maximum gross conversion at the filing's published per-preferred-share rates would add about 54 million common shares; release the $19.25 billion proxy when adding these shares, never charge both. Cumulative 6.25% dividends before conversion also require a reserve. At this scale the preferred approximation is small relative to the valuation gap but should be replaced with instrument-level modeling before execution.

Future SBC is fully expensed economically, so the model holds shares flat instead of also charging forecast SBC dilution. This is a compensation-equivalent convention, not a prediction of shares outstanding. ATM capacity of $40 billion is neither cash nor outstanding shares at June. If fully sold at $335.02 it implies approximately 119 million shares before fees, but proceeds may fund employee tax obligations; issuing shares does not create $40 billion of free shareholder value. No ATM funding is assumed in the DCF.

## Commitments, capacity and double-count controls

The $811 billion obligations comprise supplier, inventory, content and energy purchases; $707 billion is a subset. They cannot all be treated as debt in addition to future operating costs and capex. The model includes five-year capex of $1,033 / $1,130 / $1,319 billion, plus operating costs embedded in margins. This gives substantial expenditure capacity but does not prove a contract-by-contract maturity reconciliation: the filing does not disclose the capex/COGS split or all annual timing. A persistent additional five percentage points of capex/revenue reduces reference value to $134.62.

Operating leases of $18.037 billion and $85.2 billion uncommenced payments, plus the $5.8 billion short lease, must be funded through modeled operating costs; not all amounts are presently due. The model's segment margins assume these obligations can be absorbed. The short-term $200.7 billion contractual total exceeds $155.4 billion of cash and debt securities, but does not by itself prove a liquidity shortfall: it is met over time by cash receipts as well as opening cash, and overlaps model expenses. The largest cumulative modeled FCFF deficit is approximately $100.6 billion in the downside before future distributions and exceptional uses. This is a significant draw on cash capacity and explains retaining financing risk; it is not a solvency forecast.

Backstop maximum exposures of $7.6 billion guarantees and $43.8 billion credit derivatives, plus the proposed $24.1 billion additional backstops, are not guaranteed future payments. A further $20 billion realized loss beyond the case reserve reduces equity value by $1.64/share directly. A customer or infrastructure failure that also impairs Cloud growth has a much larger modeled effect and is represented by the downside operating path. Do not infer additive expected losses from maximum notional values.

## Results, sensitivities and action

At a common 10% discount rate and 3% terminal growth, scenario values are $50.02 / $184.63 / $303.45. Differences against the $335.02 snapshot are -85.1% / -44.9% / -9.4%. These are valuation gaps, not one-year expected stock returns. No scenario probabilities or probability-weighted target are assigned.

Terminal value supplies 105.8% / 89.1% / 88.9% of enterprise value. Above 100% in downside reflects negative explicit cash-flow PV. That concentration makes these values highly sensitive to long-term assumptions and rules out presenting $184.63 as a precise fair-value estimate. Terminal implied incremental ROIC is about 5.1% / 11.5% / 17.8% given growth and reinvestment, making the assumed economics transparent.

| Reference value, USD/share | 2% perpetual growth | 3% | 4% |
| --- | ---: | ---: | ---: |
| 8% discount rate | 229.02 | 270.13 | 331.80 |
| 9% | 191.95 | 220.14 | 259.59 |
| 10% | 164.33 | 184.63 | 211.69 |
| 11% | 143.00 | 158.17 | 177.66 |
| 12% | 126.07 | 137.73 | 152.30 |

At 3% terminal growth the reference operating path needs approximately a 7.11% discount rate to support $335.02. This is an implied valuation discount rate, not a promised shareholder IRR. At 8% discount, the upside operating path values shares at $444.47, 32.7% above the snapshot. This plausible alternative reverses the new-money recommendation under the rule below; it is the strongest countercase and is visible in the summary, sensitivity slide and close.

The decision rule is an analyst proposal, not supplied IC policy: **Buy** when the reference value under the committee's accepted assumptions is at least 1.2× price; **Hold** when value is 0.8× to less than 1.2× price; **Avoid** new capital when value is below 0.8× price. Twenty percent is a judgmental buffer for a terminal-heavy model, not a statistical confidence interval. At current price the boundaries are $268.02 and $402.02. Reference $184.63 implies Avoid; reference at 8%/3% $270.13 implies Hold; adopted upside at 8%/3% $444.47 implies Buy. This makes the assumption-dependent action explicit.

With reference assumptions fixed, a price at or below $153.86 meets the proposed buy buffer; $230.79 is the upper boundary for Hold. These are model-derived watch levels, not trading instructions or unconditional entry targets. Price alone does not cure unsupported cash-generation assumptions. A five-point reduction in Search growth in every year lowers reference value to $165.29, while persistent five-point extra capex lowers it to $134.62. Those separate shocks establish why cash conversion and capital efficiency deserve more weight than near-term GAAP EPS.

Committee action requested: avoid committing new capital at the specified price under the 10% reference framework. Existing-position tax, risk-budget and concentration decisions are out of scope because holdings were not supplied. No trade or portfolio sizing is authorized by this planning exercise. Reopen at the next earnings release, date not assumed, or earlier material remedy/financing disclosure. The proposed investment analyst owns refreshing the model; the committee owns accepting the hurdle, scenario and investment decision.
