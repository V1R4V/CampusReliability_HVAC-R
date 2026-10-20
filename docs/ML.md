# ML spec (owner: Vibhrav)

Input: `data/seed/*.csv` (CONTRACT §3). Output: `risk_daily.csv` + the `campusSnapshot`,
`assetHistory`, `backtest` calls. Everything is precomputed for the whole replay so the UI scrubber
is instant; nothing heavy runs during the demo.

**Starting point, not a checklist.** The method below is one simple approach that works; swap in
something better or simpler if you like. Fixed: output shapes (CONTRACT), status enum, and honesty
about results.

## 1. Weather-normalized energy baseline
Per asset, fit expected daily energy from outdoor temperature on its own history:
- Cooling: `expected = a + b × CDD` with `CDD = max(0, tavg_f − 55)`.
- Heating: `expected = a + b × HDD` with `HDD = max(0, 60 − tavg_f)`.
- Air: `expected = a + b × CDD + c × HDD` (+ weekend dummy if Devansh adds the weekend effect).
- Fit on a trailing 60-day window ending 7 days before the scored day (so a slow degradation doesn't
  teach the baseline that "bad is normal"). First 30 days of the replay: fit on whatever exists, mark low confidence.
- `energy_over_expected_pct = (actual − expected) / expected × 100`.
- **No weather-comparable history → expected is unknown.** A slope is only trusted when the fit
  window has ≥ 5 days with degree-days > 0 and ≥ 1 degree-day of spread; with a slope we extrapolate
  at most 5 degree-days past the window's range, without one not at all. Beyond that `expected` is
  null, the energy signal is excluded for the day and the weights renormalise over the other
  signals. Without this rule the first warm days of spring (a winter of zero CDD behind them) read
  as "+300 % energy" on every chiller — the single largest source of false alarms in testing.
This is the standard degree-day method (ASHRAE Guideline 14 style). It is what makes decoy D3 (heat wave) not fire.

## 2. Risk score
For each asset and day:
1. For each available signal, z-score against that asset's **previous 30 days** (exclude today):
   `z = (x − mean30) / max(std30, floor)` with floors (pressure 0.5 psi, flow 0.2%, ΔT 0.5°F,
   vibration 0.1 mm/s, energy-pct 1.0).
2. Direction-adjust so positive = bad: pressure falling, flow imbalance rising, ΔT shrinking,
   vibration rising, energy_over_expected rising. Clip negatives to 0.
3. Smooth each with a 3-day rolling **median** (changed from mean on Oct 19 after decoy D1 fired at 3.0: a mean smears a one-day spike across 3 days, which then satisfies the 2-day persistence rule; a median removes it and still passes monotone drift).
4. `risk = 0.6 × weighted mean + 0.4 × max z` with weights pressure 0.25, flow imbalance 0.25, ΔT 0.15, vibration 0.15, energy 0.20 —
   renormalized over signals that are non-null that day. (The max term was added Oct 19 because the pure weighted mean diluted a bearing failure visible only in vibration — z≈6 averaged with two quiet signals stayed under 3.0 and F3 was missed.)
   Days inside a FAILED window are excluded from every baseline window, so an outage never becomes "normal" and the post-repair recovery never reads as an energy spike.
5. Multipliers: `× (1 + age_years / 60)`; heating assets `× 1.3` when `tavg_f < 0`; cooling assets
   `× 1.2` when `tmax_f > 85`.
6. `driver` = signal with the largest weighted contribution; `contrib_*` = shares summing to 1.
7. Status per CONTRACT §2 (threshold, persistence, hysteresis, FAILED from events).

Missing data (D2): a day with all signals null → carry forward previous risk × 0.9, never raise it.

## 3. Ranking (for `campusSnapshot`)
`impact` and `cost_per_day_usd` per CONTRACT QueueItem. Queue order: INSPECTION_DUE, FAILED, then
`risk × impact` desc. `driver_label` like "pressure ↓ 6 psi", "vibration ↑ 4.8 mm/s", "energy +8.5%",
"flow imbalance ↑ 1.5 pts" (the flow signal is already a percentage, so its change is in percentage points).
KPIs: `energy_waste_usd_per_day = Σ max(0, actual − expected) × ENERGY_USD_PER_KWH` over assets
with energy_over_expected_pct > 5; `cooling_exposure_usd_per_day = Σ cost_per_day_usd` over
due/watch cooling assets (count each building once).

## 4. Backtest
- For each failure F1–F5: `first_due_date` = first INSPECTION_DUE day in the 30 days before failure;
  `lead_days = failure_date − first_due_date`.
- False-alarm days: CONTRACT definition (due with no failure on that asset within 21 days after).
- Decoys D1–D4: `ignored = true` if the decoy asset never went INSPECTION_DUE within ±5 days of the decoy.
- `sweep`: thresholds 2.0 → 4.0 step 0.25 with mean/min lead days, false-alarm days, missed.
- `aligned_curves`: risk from −21 to 0 days before each failure.

## 5. Honesty rules
- Don't tune the model to the planted failures by hand-picking dates. Tune the **generator** for
  realism (ranges in DATA.md) and leave model params as specified unless a decoy fires.
- If a decoy fires at threshold 3.0, report it — a false alarm we explain beats a suspicious zero.
- The pitch line: "The failures were planted; this proves the pipeline, not that the real break was predictable."

## 6. Order of work
1. **By 12:30:** risk_daily v1 on seed v1 (F4 only is fine) + `campusSnapshot` shape → UI can switch off fixtures for Overview.
2. **By 1:15:** energy baseline, all failures/decoys, `assetHistory`, `backtest`.
3. **Then:** agent (`briefing`, work orders, `ask`) — see `docs/briefs/vibhrav.md`.

## 7. Acceptance checks
- At threshold 3.0: every failure flagged 5–10 days early; S3-PIPE first due around Jun 9;
  0 decoys fire; false-alarm days reported (target 0, but truthful).
- Heat wave (D3): raw cooling energy rises, `energy_over_expected_pct` stays near 0 for healthy assets.
- Output shapes match `contract/fixtures/` exactly.

**Result on the interim seed (real NOAA weather, synthetic sensors — `tools/datagen/interim_generator.py`),
`RiskModel.score_all(3.0)` → `Backtest.run(3.0)`, 2026-10-19:**

| | F1 VIL-UH-2 | F2 STE-HX-1 | F3 WIMR-AHU-3 | F4 S3-PIPE | F5 WAL-CHL-2 |
|---|---|---|---|---|---|
| first INSPECTION_DUE | Jan 22 | Feb 10 | Apr 8 | **Jun 8** | Jul 15 |
| lead days | 6 | 6 | 6 | 9 | 7 |

Decoys D1–D4 all ignored. False-alarm days at 3.0: **2** (S4-PIPE May 16–17: +7.9 % energy in the
first mid-May warm spell on a 54-year-old main; clears in two days). Sweep: 2.5 → 7 false-alarm
days, 3.25–3.5 → 0 with no misses, ≥ 3.75 misses F3. We report the 2, per §5.

## 8. Failure probabilities — four methods side by side (`RiskModel.forecast_all` → `RiskForecast`)

`RiskScore` says *how abnormal* an asset is today; `RiskForecast` says *how likely it is to fail*
in the next 7 / 14 / 30 days — four independent ways, so the UI shows the spread, not one opaque
number. All rows are precomputed after `score_all` (19,440 rows ≈ 10 s), read via
`RiskForecast.compare(asset_id, as_of)` (one asset, all methods + 30-day history + consensus) and
`RiskForecast.campus(as_of)` (every asset ranked by consensus `p_fail_14d`).

| method | what it is | trained on |
|---|---|---|
| `heuristic` | logistic calibration of `RiskScore.risk` (capped at 8) vs "failed within horizon" | planted F1–F5, leave-one-failure-out |
| `classifier` | L2 logistic regression on 8 condition features: risk, 3- and 7-day slopes, max z, number of elevated signals, energy over expected, days at WATCH, age | planted F1–F5, leave-one-failure-out |
| `monte_carlo` | 1,000 forward paths of the (age-normalised) risk from the asset's own trailing 14-day drift and noise, drift growing 3 %/day; probability = share of paths reaching the failure level (median pre-failure risk of the *other* failures); also p10/p50/p90 days to first crossing | nothing — the asset's own history |
| `weibull` | ASHRAE median service life by equipment type, Weibull shape 2.5 (pipes) / 3.0, conditional on survival to `age_years` | population estimate, no sensors |

`consensus` = mean of the three condition-based methods; `weibull` is shown as the "age alone"
reference. Each row carries `confidence` (low / medium / high), a one-line `basis`, and a
`trained_on` honesty label for the UI chip.

The default Python runtime has numpy/pandas/scipy but no scikit-learn, so the logistic models are
fit with `scipy.optimize` (L-BFGS); that is a hackathon trade-off, not a design choice. Both
`score_all` and `forecast_all` wipe their table before writing (`removeAll`), because `mergeBatch`
keeps stale non-null fields from a previous run. Run order after any seed change:
`upsertSeedData` → `RiskModel.score_all(3.0)` → `RiskModel.forecast_all()` (~10 s) → `Backtest.run(3.0)`.
Run them one at a time — two concurrent `forecast_all` calls race on the wipe.

**Why the rerun after every seed upsert is not optional:** `upsertSeedData` also loads
`pkg22bc8209/data/RiskScore/S3-PIPE_fixture.json` (a fixture-derived placeholder from the first
hour), which overwrites 31 computed S3-PIPE rows (May 20 – Jun 19) with fixture values and no
`driver_label` — on Oct 19 night that is why the Overview read "risk 3.21, pressure ↓ (z 1.6), day 1"
instead of the model's "risk 4.70, flow imbalance ↑ 1.5 pts, day 2", and why the backtest lead for F4
briefly read 8 instead of 9. `RiskScore` is not a seed table (CONTRACT §5.1); that file should be
deleted by its owner. Until then: anyone who upserts seed re-runs `score_all` → `forecast_all`.

**Smoke result, S3-PIPE as of 2026-06-09 (8 days before F4):** heuristic 0.92 · classifier 0.72 ·
Monte Carlo 0.94 (days to failure p10/p50/p90 = 1/3/11) · Weibull 0.002 → consensus 0.86, spread
0.22. Every healthy asset that day: consensus ≤ 0.06. The pitch line still holds: the failures were
planted; this proves the pipeline, not that the real break was predictable.

**Horizons are cumulative (fixed Oct 19 night).** P(fail within 30 d) can never be below P(fail
within 7 d), but the `heuristic` and `classifier` horizons were three independently fitted logistic
curves: the 30-day label has many more low-risk positives, so its curve is flatter and, at high
risk, sits *below* the 7-day curve. S3-PIPE as of Jun 9 read heuristic 94 / 92 / 78 % and classifier
61 / 72 / 70 % for 7 / 14 / 30 d; 71 of 19,440 stored rows were non-monotone (heuristic 39,
classifier 32). Monte Carlo (first-crossing time of one set of paths) and Weibull (one hazard) never
were. `forecast_all` now passes every method's triple through a running max before writing
(`_monotone`: p7 kept, p14 ≥ p7, p30 ≥ p14, clipped to [0, 1]); the consensus is recomputed from the
stored rows at read time and inherits the property. After the rerun (on the recomputed `RiskScore`,
see above): S3-PIPE heuristic 94.2 / 94.2 / 94.2, classifier 61.5 / 72.3 / 72.3, Monte Carlo
80.8 / 94.4 / 99.6, Weibull 0.1 / 0.2 / 0.4 → consensus 78.8 / 87.0 / 88.7 % (spread 0.22); the
healthy S1-PIPE is unchanged at 0.0 / 0.1 / 0.8 %; 0 of 19,440 rows violate. A running max is a
floor, not a recalibration — where it bites, the longer horizon is understated, never overstated. The
principled fix is one discrete-time hazard per method (a single λ(x), P(h) = 1 − exp(−Σλ)); noted,
not done.

## 9. Honest evaluation — `Backtest.run(threshold).metrics` (additive)

`Backtest.run` now also returns `metrics` so the Backtest page can quote standard numbers instead of
lead days alone. All of it is scored against the planted failures F1–F5 (synthetic), so it measures
the pipeline, not the real break.

| key | definition |
|---|---|
| `asset_days` | non-`FAILED` asset-days in the stored `RiskScore` series |
| `true_positive_days` / `false_alarm_days` | `INSPECTION_DUE` asset-days with / without a failure on that asset within the next 21 days (same horizon as the contract's false-alarm day) |
| `missed_positive_days` | asset-days inside the 21-day pre-failure window that were not flagged |
| `precision`, `recall` | TP / (TP + FP) and TP / (TP + FN) over asset-days — recall is "how much of the warning window did we cover", so ~0.3 at 3.0 is expected when flags start 6–9 days out |
| `false_alarms_per_1000_asset_days` | FP / asset_days × 1000 |
| `failures_detected`, `failures_total`, `lead_days{min,mean,median}` | the five planted failures |
| `brier_14d{heuristic, classifier, monte_carlo, weibull, base_rate, positive_rate, asset_days}` | Brier score of each method's stored `p_fail_14d` against "fails within 14 days", outside `FAILED` windows; `base_rate` is the score of always predicting the average positive rate — the bar a method has to beat |

Result at threshold 3.0 on the Oct 19 seed (`Backtest.run(3.0).metrics`, whole call 1.9 s): 4,781
asset-days; TP 34 / FP 2 / FN 71 → precision 0.944, recall 0.324, 0.42 false alarms per 1,000
asset-days; 5 of 5 failures detected, lead days min 6 / mean 6.8 / median 6. Brier at 14 d:
heuristic 0.0076, classifier 0.0076, Monte Carlo 0.0225, Weibull 0.0145, base rate 0.0144 (positive
rate 1.46 %). Read honestly: the two trained methods roughly halve the base-rate Brier; Weibull
carries no information beyond the base rate, by construction; Monte Carlo is *worse* than the base
rate — it is sharp on drifting assets but too eager on quiet ones (random-walk paths from a flat
series still cross the failure level a few per cent of the time), so it belongs in the spread, not in
the headline. Recall of 0.32 is the expected shape of a 6–9-day lead inside a 21-day window, not a miss.
