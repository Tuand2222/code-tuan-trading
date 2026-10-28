# V6 Capital Pro — architecture and acceptance

Implemented from the supplied **Thiết Kế Quản Trị Vốn.pdf**, **tuannhatky_v6_4.html** and **risk_management_pro_dashboard.html**. The HTML files are reference prototypes, not ledger fixtures. Their hardcoded probabilities, ROI, fees, FX and synthetic R conversions are not imported.

## Application boundaries

- Classic retains its existing operational UI, broker connections, journal, position sizing and reports. V6 adds `#capital` with protection, evaluation, optimization and stress tabs; the sidebar, light/dark theme and mobile layout follow the reference direction.
- Native V6 and authenticated Classic are selectable, separate data sources. No automatic ledger merging, FX conversion or two-account summing. Shared Classic capital settings retain account ownership and server version protection. Missing capital means no capital recommendation.
- Account protection ignores analysis filters. Native partial exits affect realized account money but do not enter closed-position strategy statistics. Unpriced open positions have no invented mark-to-market. Unknown open risk blocks the recommendation.
- Layer 1 caps risk by tier, remaining daily budget, open exposure and distance to the floor. Exact stop-boundary equality stops new plans. Defense halves the budget and requires a selected method with enough observations, positive mean and Omega(0)>1 for a recommendation. Stop affects prospective plans; recording/importing actual historical trades remains available.
- Layer 2 excludes unknown Net/fees and unknown initial risk from R statistics. It reports excluded counts, sample sizes and tail mass. Native non-synthetic single-entry evidence with valid SL/TP, and valid Classic prices, permit planned R:R versus realized Net R comparisons.

## Numerical contracts

- Omega(L) = sum(max(R-L,0)) / sum(max(L-R,0)). Net fees are not charged twice. Infinity and undefined are distinct.
- Loss = -R. VaR uses empirical inverse CDF `ceil(c*N)-1`; ES97.5 uses exactly 2.5% tail mass, fractionally weighting the boundary observation. Day-level ES aggregates complete Net days in the account timezone and is denominated in account currency, separately from per-trade R. Non-trading days are not invented. Any incomplete trading day is excluded as a whole.
- Stressed ES selects the worst cumulative R drawdown window of up to30 trades. The optional liquidity multiplier is sensitivity `sqrt(days/10)`, not FRTB capital certification. Walk-forward VaR breaches use only earlier trades, with at least40 previous observations and a maximum100-trade fitting window.
- Kelly maximizes expected log growth inside `1+fR>0`, including losses worse than1R. RCK additionally enforces `sum(p*(1+fR)^(-lambda))<=1`, `lambda=ln(beta)/ln(alpha)`. Bisection solves both bounds. A relative probability box moves feasible probability mass toward worse outcomes. Binary assumptions cannot become a real-money recommendation. Empirical recommendation is the minimum of RCK and Layer1 limits, divided by the configured remaining-loss buffer where tighter.
- RCK's bound concerns wealth relative to starting wealth, not maximum drawdown from the running peak. It depends on IID returns and the supplied distribution. No broker orders or automatic SL tightening are performed.
- Position sizing includes explicit point value, stop distance, fees per unit and quantity step; quantity rounds down.
- Monte Carlo runs the selected1,000 or10,000 paths with a reproducible seed and fixed-fraction compounding in a cancellable Web Worker. Fan quantiles are P5/P25/P50/P75/P95. Stress injects the stated number of losing trades (bounded by the horizon), tail multipliers and additional R cost. Floor-relative probability and peak-relative drawdown probability are separate; Wilson intervals avoid claiming zero true risk after zero observed failures.
- Generic challenge rules are configurable: daily loss, static/trailing/locked floor, target, minimum days, fee, split and a post-pass payout period. Breach wins over pass and remains sticky. Take-home median includes failed and timed-out challenges as zero. ROI needs an entered fee; positive-payout break-even is explicitly conditional. This is one challenge and one subsequent period, not guaranteed recurring payouts or a specific firm's current rules.
- The49-cell sensitivity heatmap is a separate binary survey with400 paths/cell and at most250 trades, visibly labeled. Center parameters use empirical win/payoff where available; otherwise the entered binary payoff is the explicit assumption. Analytical infinite-horizon ruin is restricted to a fixed-cash, integer +b/-1 lattice model; it is not substituted for the compound-wealth simulation.

## Persistence and preservation

Actual native account policy is an optional field on the journal, compatible with existing v4 snapshots. Research preferences use `tuan-v6-capital:<journalId>` and participate in complete device backup, per-account cloud reconciliation and independent NDJSON restoration. Derived reports use a disposable, content-hashed IndexedDB cache; simulations never mutate ledger records. Existing D1/R2 archive and ownership contracts are retained; no new destructive migration or expiry policy is introduced.

## Evidence and limits

Unit fixtures cover fractional-tail ES (losses1..100 → VaR98/ES99.2), the published binary RCK example, probability bounds, stop equality, missing data, timezone days, partial realized exits, seed reproducibility and fan ordering. Browser tests cover360/768/1280 layouts, keyboard-accessible scroll tables, history preservation, stress counts, cloud preference restoration and the account veto under filtering. Historical observations and simulations do not establish future performance.

Primary method references:

- Busseti, Ryu, Boyd: https://web.stanford.edu/~boyd/papers/pdf/kelly.pdf
- Keating, Shadwick: https://people.duke.edu/~charvey/Teaching/BA453_2004/Keating_A_universal_performance.pdf
- Rockafellar, Uryasev: https://sites.math.washington.edu/~rtr/papers/rtr187-CVaR2.pdf
- Robust Kelly: https://web.stanford.edu/~boyd/papers/pdf/robust_kelly.pdf
- Basel market-risk framework: https://www.bis.org/committees/bcbs/basel-framework/standard/mar
