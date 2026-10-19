WEIGHTS = {"pressure": 0.25, "flow_imbalance": 0.25, "delta_t": 0.15, "vibration": 0.15, "energy": 0.20}
FLOORS = {"pressure": 0.5, "flow_imbalance": 0.2, "delta_t": 0.5, "vibration": 0.1, "energy": 1.0}
DIRECTION = {"pressure": -1.0, "flow_imbalance": 1.0, "delta_t": -1.0, "vibration": 1.0, "energy": 1.0}
SENSOR_COL = {"pressure": "pressure_psi", "flow_imbalance": "flow_imbalance_pct", "delta_t": "delta_t_f", "vibration": "vibration_mm_s"}
SIGNALS = ["pressure", "flow_imbalance", "delta_t", "vibration", "energy"]
WATCH_THRESHOLD = 2.0
PERSISTENCE_DAYS = 2
BASELINE_WINDOW = 30
ENERGY_FIT_WINDOW = 60
ENERGY_FIT_LAG = 7
ENERGY_DD_EXTRAPOLATION = 5.0   # max degree-days beyond the fit window's range before "expected" is unknown
BATCH = 500


def _fetch(type_name, include, flt=None):
    spec = {"include": include, "limit": -1}
    if flt:
        spec["filter"] = flt
    return list(getattr(c3, type_name).fetch(spec).objs or [])


def _expected_energy(energy, dd):
    """Degree-day regression per day on a trailing window ending ENERGY_FIT_LAG days earlier."""
    import numpy as np
    n = len(energy)
    out = np.full(n, np.nan)
    for i in range(n):
        hi = i - ENERGY_FIT_LAG
        lo = hi - ENERGY_FIT_WINDOW
        idx = [j for j in range(max(0, lo), max(0, hi) + 1) if j < i and not np.isnan(energy[j])]
        if len(idx) < 10:
            idx = [j for j in range(0, i) if not np.isnan(energy[j])]
        if not idx:
            out[i] = energy[i]
            continue
        x = dd[idx]
        y = energy[idx]
        xmax = float(np.nanmax(x))
        # A degree-day slope is only trusted with real support: >= 5 window days with dd > 0 and
        # at least 1 degree-day of spread. One mild March day must not define the April slope.
        has_slope = len(idx) >= 10 and int((x > 0).sum()) >= 5 and np.nanstd(x) > 1.0
        tolerance = ENERGY_DD_EXTRAPOLATION if has_slope else 0.5
        if dd[i] > xmax + tolerance:
            # No weather-comparable history (e.g. the first warm days of spring after a winter of
            # zero cooling degree-days): the expected value is unknown, so the energy signal is
            # excluded for the day instead of being compared with a flat seasonal mean. With a
            # fitted slope we extrapolate up to ENERGY_DD_EXTRAPOLATION degree-days; without one,
            # (flat window) we do not extrapolate at all.
            out[i] = np.nan
        elif has_slope:
            b, a = np.polyfit(x, y, 1)
            out[i] = a + b * dd[i]
        else:
            out[i] = np.nanmean(y)
    return out


def _label(driver, delta, pct):
    if driver == "energy":
        return "energy %+.1f%%" % (pct if pct is not None else 0.0)
    if delta is None:
        return driver.replace("_", " ")
    if driver == "pressure":
        return "pressure %s %.0f psi" % ("↓" if delta < 0 else "↑", abs(delta))
    if driver == "flow_imbalance":
        return "flow imbalance %s %.1f%%" % ("↑" if delta > 0 else "↓", abs(delta))
    if driver == "delta_t":
        return "ΔT %s %.1f°F" % ("↓" if delta < 0 else "↑", abs(delta))
    return "vibration %s %.1f mm/s" % ("↑" if delta > 0 else "↓", abs(delta))


def _clean(v):
    import math
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if (math.isnan(f) or math.isinf(f)) else f


def _score_asset(aid, g, system, age_years, weather, failed_windows, thr):
    import numpy as np
    import pandas as pd

    g = g.sort_values("date").reset_index(drop=True)
    g = g.merge(weather, on="date", how="left")
    tavg = g["tavg_f"].fillna(57.5).values
    tmax = g["tmax_f"].fillna(70.0).values
    cdd = np.maximum(0.0, tavg - 55.0)
    hdd = np.maximum(0.0, 60.0 - tavg)
    dd = cdd if system == "cooling" else (hdd if system == "heating" else cdd + hdd)

    # Days inside a FAILED window never enter any baseline: an outage (idle equipment, collapsed
    # pressure) would otherwise teach the model that "broken" is normal and make the recovery
    # look like a 200%+ energy spike.
    windows = [(lo, hi) for lo, hi in failed_windows]
    failed_mask = np.array([any(lo <= d <= hi for lo, hi in windows) for d in g["date"]], dtype=bool)
    for c in list(SENSOR_COL.values()) + ["energy_kwh"]:
        if c in g:
            g.loc[failed_mask, c] = np.nan

    energy = g["energy_kwh"].astype(float).values
    _exp = _expected_energy(energy, dd)
    # Accept either signature: `expected` alone (NaN where the weather is outside the fitted
    # degree-day range) or `(expected, extrapolated)`. Either way an unknown baseline → NaN pct →
    # energy is excluded for the day and the weights renormalise over the remaining signals.
    expected, extrapolated = _exp if isinstance(_exp, tuple) else (_exp, np.isnan(_exp))
    with np.errstate(divide="ignore", invalid="ignore"):
        pct = np.where(expected > 0, (energy - expected) / expected * 100.0, np.nan)
    pct = np.where(extrapolated, np.nan, pct)
    g["energy_pct"] = pct

    z = {}
    delta = {}
    for sig in SIGNALS:
        col = SENSOR_COL.get(sig, "energy_pct")
        x = g[col].astype(float)
        if x.notna().sum() == 0:
            z[sig] = pd.Series(np.nan, index=g.index)
            delta[sig] = pd.Series(np.nan, index=g.index)
            continue
        m = x.rolling(BASELINE_WINDOW, min_periods=5).mean().shift(1)
        sd = x.rolling(BASELINE_WINDOW, min_periods=5).std().shift(1).fillna(0.0).clip(lower=FLOORS[sig])
        raw = DIRECTION[sig] * (x - m) / sd
        delta[sig] = x - m
        # 3-day rolling MEDIAN (not mean): a one-day spike (decoy D1) is removed outright,
        # while genuine monotone drift passes through unchanged after the first two days.
        z[sig] = raw.clip(lower=0.0).rolling(3, min_periods=1).median()

    n = len(g)
    rows = []
    prev_risk = 0.0
    due = False
    above = 0
    below = 0
    prev_status = None
    days_in = 0
    age_mult = 1.0 + float(age_years or 0) / 60.0
    prev_driver = None
    prev_label = None

    for i in range(n):
        date = g.at[i, "date"]
        avail = {sig: float(z[sig].iat[i]) for sig in SIGNALS if not np.isnan(z[sig].iat[i])}
        sensors_present = any(not np.isnan(float(g.at[i, c])) for c in SENSOR_COL.values() if c in g) or not np.isnan(energy[i])
        if not avail or not sensors_present:
            # Missing data never raises risk (decoy D2): decay and keep yesterday's explanation.
            risk = prev_risk * 0.9
            contrib = {}
            driver = None
        else:
            wsum = sum(WEIGHTS[s] for s in avail)
            weighted = {s: WEIGHTS[s] / wsum * avail[s] for s in avail}
            # Weighted mean alone dilutes a single screaming sensor (a bearing failure shows only
            # in vibration), so blend in the dominant signal: 0.6 × weighted mean + 0.4 × max z.
            risk = 0.6 * sum(weighted.values()) + 0.4 * max(avail.values())
            risk *= age_mult
            if system == "heating" and tavg[i] < 0:
                risk *= 1.3
            if system == "cooling" and tmax[i] > 85:
                risk *= 1.2
            total = sum(weighted.values())
            contrib = {s: (weighted[s] / total if total > 0 else 1.0 / len(weighted)) for s in weighted}
            driver = max(weighted, key=weighted.get) if total > 0 else "pressure" if "pressure" in avail else list(avail)[0]

        failed = bool(failed_mask[i])
        if failed:
            status = "FAILED"
            due = False
            above = below = 0
        else:
            above = above + 1 if risk >= thr else 0
            below = below + 1 if risk < WATCH_THRESHOLD else 0
            if not due and above >= PERSISTENCE_DAYS:
                due = True
            if due and below >= PERSISTENCE_DAYS:
                due = False
            status = "INSPECTION_DUE" if due else ("WATCH" if risk >= WATCH_THRESHOLD else "HEALTHY")
        days_in = days_in + 1 if status == prev_status else 1
        prev_status = status
        prev_risk = risk

        if driver:
            d_delta = _clean(delta[driver].iat[i])
            label = _label(driver, d_delta, _clean(pct[i]))
            prev_driver, prev_label = driver, label
        else:
            driver, label = prev_driver, prev_label
        row = {
            "id": "%s_%s" % (aid, date),
            "asset": {"id": aid},
            "date": date,
            "risk": round(float(risk), 3),
            "status": status,
            "driver": driver,
            "driver_label": label,
            "expected_energy_kwh": _clean(expected[i]),
            "energy_over_expected_pct": round(_clean(pct[i]), 2) if _clean(pct[i]) is not None else None,
            "days_in_status": days_in,
        }
        for sig in SIGNALS:
            zv = _clean(z[sig].iat[i])
            row["z_" + sig] = round(zv, 3) if zv is not None else None
            row["contrib_" + sig] = round(contrib[sig], 3) if sig in contrib else None
        rows.append({k: v for k, v in row.items() if v is not None})
    return rows


def score_all(cls, threshold):
    import pandas as pd

    thr = float(threshold) if threshold is not None else 3.0
    readings = _fetch("SensorReading", "this, asset.id")
    if not readings:
        return 0
    assets = {a.id: a for a in _fetch("Asset", "this")}
    weather = pd.DataFrame([{"date": w.date, "tavg_f": w.tavg_f, "tmax_f": w.tmax_f} for w in _fetch("WeatherDay", "this")],
                           columns=["date", "tavg_f", "tmax_f"])

    failed_windows = {}
    for e in _fetch("FailureEvent", "this, asset.id"):
        if e.kind == "failure" and e.asset is not None:
            failed_windows.setdefault(e.asset.id, []).append((e.date, e.end_date or e.date))

    df = pd.DataFrame([{
        "asset": r.asset.id,
        "date": r.date,
        "pressure_psi": r.pressure_psi,
        "flow_imbalance_pct": r.flow_imbalance_pct,
        "delta_t_f": r.delta_t_f,
        "vibration_mm_s": r.vibration_mm_s,
        "energy_kwh": r.energy_kwh,
    } for r in readings if r.asset is not None])
    for c in ["pressure_psi", "flow_imbalance_pct", "delta_t_f", "vibration_mm_s", "energy_kwh"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    written = 0
    for aid, g in df.groupby("asset"):
        a = assets.get(aid)
        if a is None:
            continue
        rows = _score_asset(aid, g.drop(columns=["asset"]), a.system, a.age_years, weather, failed_windows.get(aid, []), thr)
        for k in range(0, len(rows), BATCH):
            chunk = [c3.RiskScore.make(r) for r in rows[k:k + BATCH]]
            c3.RiskScore.mergeBatch(chunk)
            written += len(chunk)
    return written


# ----------------------------------------------------------------------------------------------
# Stage 2 — failure probabilities by four independent methods (docs/ML.md §8)
# ----------------------------------------------------------------------------------------------

HORIZONS = [7, 14, 30]
Z_COLS = ["z_pressure", "z_flow_imbalance", "z_delta_t", "z_vibration", "z_energy"]
CLF_FEATURES = ["risk_c", "slope3", "slope7", "zmax", "n_elev", "energy_pos", "watch_days", "age"]
HEURISTIC_FEATURES = ["risk_c"]
RISK_CAP = 8.0           # a one-day spike to risk 40 is a data glitch, not 10× more evidence of failure
Z_CAP = 10.0
MIN_HISTORY_DAYS = 5
LOW_CONFIDENCE_DAYS = 30
L2_HEURISTIC = 0.001     # penalty = l2 × Σw² added to the MEAN log-loss (so ~0.01–0.1 is strong)
L2_CLASSIFIER = 0.02
MC_PATHS = 1000
MC_DAYS = 30
MC_FIT_WINDOW = 14
MC_SIGMA_FLOOR = 0.15
MC_ACCEL = 0.03          # degradation is convex: drift grows ~3 %/day along a path
MC_MIN_CROSS_SHARE = 0.10
FAIL_LEVEL_DEFAULT = 5.0
# ASHRAE Equipment Life Expectancy chart — median service life in years (estimates; see ML.md §8).
ASHRAE_MEDIAN_LIFE = {"chw_main": 50, "steam_line": 40, "isolation_valve": 20, "heat_exchanger": 24,
                      "steam_trap": 10, "chiller": 23, "chw_pump": 20, "condensate_pump": 20,
                      "unit_heater": 20, "ahu": 25}
WEIBULL_SHAPE = {"chw_main": 2.5, "steam_line": 2.5}   # pipes wear out more gradually; others 3.0
TRAINED_ON = {
    "heuristic": "logistic calibration of RiskScore.risk on planted failures F1-F5 (synthetic; leave-one-failure-out)",
    "classifier": "L2 logistic regression on 8 condition features; planted failures F1-F5 (synthetic; leave-one-failure-out)",
    "monte_carlo": "no training: 1000 paths from the asset's own 14-day drift; failure level = median pre-failure risk of the other planted failures (synthetic)",
    "weibull": "ASHRAE median service life by equipment type (estimate; age-only population baseline)",
}


def _sigmoid(z):
    import numpy as np
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


def _fit_logit(X, y, l2):
    """L2-regularised logistic regression (intercept unpenalised) via L-BFGS; returns weights [b, w...]."""
    import numpy as np
    from scipy.optimize import minimize
    n, k = X.shape
    Xb = np.hstack([np.ones((n, 1)), X])

    def f(w):
        z = Xb @ w
        loss = np.mean(np.logaddexp(0, -z) * y + np.logaddexp(0, z) * (1 - y)) + l2 * np.sum(w[1:] ** 2)
        p = _sigmoid(z)
        grad = Xb.T @ (p - y) / n
        grad[1:] += 2.0 * l2 * w[1:]
        return loss, grad

    res = minimize(f, np.zeros(k + 1), jac=True, method="L-BFGS-B")
    return res.x


def _risk_frame(assets):
    import numpy as np
    import pandas as pd
    rows = _fetch("RiskScore", "this, asset.id")
    df = pd.DataFrame([{
        "asset": r.asset.id, "date": r.date, "risk": r.risk, "status": r.status,
        "energy_pct": r.energy_over_expected_pct,
        **{c: getattr(r, c) for c in Z_COLS},
    } for r in rows if r.asset is not None])
    for c in ["risk", "energy_pct"] + Z_COLS:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df["risk"] = df["risk"].fillna(0.0)
    df = df.sort_values(["asset", "date"]).reset_index(drop=True)

    parts = []
    for aid, g in df.groupby("asset", sort=False):
        g = g.copy()
        a = assets.get(aid)
        age_years = float((a.age_years if a is not None else 0) or 0)
        r = g["risk"]
        g["risk_c"] = r.clip(upper=RISK_CAP)
        # score_all multiplies by (1 + age/60); dividing it back out gives a condition-only scale
        # that is comparable across assets — the Monte Carlo failure level is defined on it.
        g["raw_risk"] = r / (1.0 + age_years / 60.0)
        g["slope3"] = ((r - r.shift(3)) / 3.0).fillna(0.0).clip(-RISK_CAP, RISK_CAP)
        g["slope7"] = ((r - r.shift(7)) / 7.0).fillna(0.0).clip(-RISK_CAP, RISK_CAP)
        z = g[Z_COLS].fillna(0.0).clip(upper=Z_CAP)
        g["zmax"] = z.max(axis=1)
        g["n_elev"] = (z > 1.5).sum(axis=1).astype(float)
        g["energy_pos"] = g["energy_pct"].fillna(0.0).clip(lower=0.0, upper=50.0)
        above = (r >= WATCH_THRESHOLD).astype(int)
        g["watch_days"] = (above.groupby((above != above.shift()).cumsum()).cumsum() * above).astype(float)
        g["age"] = age_years / 60.0
        g["hist_days"] = np.arange(len(g))
        parts.append(g)
    return pd.concat(parts).reset_index(drop=True)


def _add_labels(df, failures):
    """y7/y14/y30 = 1 if a failure on this asset starts within h days after the row; in_failed marks FAILED windows."""
    import datetime as dt
    import numpy as np
    d = df["date"].map(dt.date.fromisoformat)
    n = len(df)
    y = {h: np.zeros(n) for h in HORIZONS}
    in_failed = np.zeros(n, dtype=bool)
    for aid, evs in failures.items():
        idx = np.where(df["asset"].values == aid)[0]
        for i in idx:
            di = d.iat[i]
            for fd, ed in evs:
                delta = (fd - di).days
                if fd <= di <= ed:
                    in_failed[i] = True
                for h in HORIZONS:
                    if 0 < delta <= h:
                        y[h][i] = 1.0
    for h in HORIZONS:
        df["y%d" % h] = y[h]
    df["in_failed"] = in_failed
    return df


def _loo_predict(df, feats, fail_assets, l2):
    """Leave-one-failure-out logistic predictions per horizon. Assets with a planted failure are scored
    by a model that never saw them; healthy assets by the model fit on everything. Also returns the
    standardised-feature contributions (14-day model) used for the `basis` text."""
    import numpy as np
    X_all = df[feats].values.astype(float)
    train_base = (~df["in_failed"].values) & (df["hist_days"].values >= MIN_HISTORY_DAYS)
    preds = {h: np.full(len(df), np.nan) for h in HORIZONS}
    contrib = np.zeros((len(df), len(feats)))
    is_fail_asset = df["asset"].isin(fail_assets).values
    groups = [(a, df["asset"].values == a) for a in fail_assets] + [(None, ~is_fail_asset)]
    for aid, test_mask in groups:
        if not test_mask.any():
            continue
        tr = train_base & (~test_mask if aid else np.ones(len(df), dtype=bool))
        mu = X_all[tr].mean(axis=0)
        sd = X_all[tr].std(axis=0)
        sd[sd < 1e-9] = 1.0
        Xtr = (X_all[tr] - mu) / sd
        Xte = (X_all[test_mask] - mu) / sd
        for h in HORIZONS:
            w = _fit_logit(Xtr, df["y%d" % h].values[tr], l2)
            preds[h][test_mask] = _sigmoid(w[0] + Xte @ w[1:])
            if h == 14:
                contrib[test_mask] = Xte * w[1:]
    return preds, contrib


def _confidence_basic(hist_days):
    return "low" if hist_days < LOW_CONFIDENCE_DAYS else "medium"


def _monte_carlo(risks, fail_level, seed):
    """Per day: fit drift/noise on the trailing 14 risk points, simulate MC_PATHS × MC_DAYS paths with
    drift uncertainty and mild convex acceleration, and read off crossing probabilities and the
    first-crossing-day percentiles."""
    import numpy as np
    rng = np.random.default_rng(seed)
    out = []
    n = len(risks)
    accel = 1.0 + MC_ACCEL * np.arange(1, MC_DAYS + 1)
    for i in range(n):
        lo = max(0, i - MC_FIT_WINDOW + 1)
        hist = risks[lo:i + 1]
        hist = hist[~np.isnan(hist)]
        r0 = float(risks[i]) if not np.isnan(risks[i]) else (float(hist[-1]) if len(hist) else 0.0)
        if len(hist) >= MIN_HISTORY_DAYS:
            t = np.arange(len(hist), dtype=float)
            A = np.vstack([t, np.ones_like(t)]).T
            (mu, c), *_ = np.linalg.lstsq(A, hist, rcond=None)
            resid = hist - (mu * t + c)
            sigma = max(float(resid.std()), MC_SIGMA_FLOOR)
            se_mu = sigma / np.sqrt(max(((t - t.mean()) ** 2).sum(), 1e-9))
            conf = "high" if (mu > 2.0 * se_mu and len(hist) >= 10) else "medium"
        else:
            mu, sigma, se_mu, conf = 0.0, 0.3, 0.3, "low"
        if i < LOW_CONFIDENCE_DAYS and conf == "medium":
            conf = "low"
        drift = rng.normal(mu, se_mu, size=(MC_PATHS, 1))
        eps = rng.normal(0.0, sigma, size=(MC_PATHS, MC_DAYS))
        paths = np.maximum(r0 + np.cumsum(drift * accel + eps, axis=1), 0.0)
        crossed = paths >= fail_level
        any_cross = crossed.any(axis=1)
        first = np.where(any_cross, crossed.argmax(axis=1) + 1, np.inf)
        p = {h: float(np.mean(first <= h)) for h in HORIZONS}
        q = (None, None, None)
        if any_cross.mean() >= MC_MIN_CROSS_SHARE:
            fc = first[any_cross]
            q = tuple(float(x) for x in np.percentile(fc, [10, 50, 90]))
        basis = "age-normalised risk %.2f, drift %+.2f/day (sigma %.2f) over last %d d; %d of %d paths reach failure level %.1f within 14 d" % (
            r0, mu, sigma, len(hist), int(np.sum(first <= 14)), MC_PATHS, fail_level)
        out.append((p, q, conf, basis))
    return out


def _weibull(asset_type, age_years):
    """Conditional Weibull failure probability given survival to `age_years` (ASHRAE median lives)."""
    import math
    beta = WEIBULL_SHAPE.get(asset_type, 3.0)
    median = ASHRAE_MEDIAN_LIFE.get(asset_type, 20)
    eta = median / (math.log(2.0) ** (1.0 / beta))
    t = max(float(age_years or 0), 0.1)

    def cond_p(days):
        return 1.0 - math.exp(-(((t + days / 365.0) ** beta - t ** beta) / eta ** beta))

    def q_days(q):
        tq = (t ** beta - (eta ** beta) * math.log(1.0 - q)) ** (1.0 / beta)
        return (tq - t) * 365.0

    p = {h: cond_p(h) for h in HORIZONS}
    q = (q_days(0.10), q_days(0.50), q_days(0.90))
    basis = "age %d y vs ASHRAE median life %d y (Weibull beta %.1f): %.0f%% chance of failure within a year from age alone" % (
        t, median, beta, 100.0 * cond_p(365))
    return p, q, basis


def _row(aid, date, method, p, q, conf, basis):
    row = {
        "id": "%s_%s_%s" % (aid, date, method),
        "asset": {"id": aid},
        "date": date,
        "method": method,
        "p_fail_7d": round(float(p[7]), 4),
        "p_fail_14d": round(float(p[14]), 4),
        "p_fail_30d": round(float(p[30]), 4),
        "confidence": conf,
        "basis": basis,
        "trained_on": TRAINED_ON[method],
    }
    if q and q[0] is not None:
        row["days_to_failure_p10"] = round(float(q[0]), 1)
        row["days_to_failure_p50"] = round(float(q[1]), 1)
        row["days_to_failure_p90"] = round(float(q[2]), 1)
    return row


def forecast_all(cls):
    import datetime as dt
    import numpy as np

    assets = {a.id: a for a in _fetch("Asset", "this")}
    failures = {}
    for e in _fetch("FailureEvent", "this, asset.id"):
        if e.kind == "failure" and e.asset is not None:
            failures.setdefault(e.asset.id, []).append(
                (dt.date.fromisoformat(e.date), dt.date.fromisoformat(e.end_date or e.date)))
    df = _risk_frame(assets)
    if df.empty:
        return 0
    df = _add_labels(df, failures)
    fail_assets = sorted(failures)

    # risk level at which the planted failures actually happened (day before failure), per asset
    pre_fail = {}
    for aid, evs in failures.items():
        g = df[df["asset"] == aid]
        for fd, _ in evs:
            prev = g[g["date"] == (fd - dt.timedelta(days=1)).isoformat()]
            if len(prev):
                pre_fail[aid] = float(prev["risk"].iat[0])

    heur, _ = _loo_predict(df, ["risk"], fail_assets, L2_HEURISTIC)
    clf, contrib = _loo_predict(df, CLF_FEATURES, fail_assets, L2_CLASSIFIER)

    rows = []
    for aid, g in df.groupby("asset", sort=False):
        a = assets[aid]
        idx = g.index.values
        others = [v for k, v in pre_fail.items() if k != aid]
        fail_level = float(np.median(others)) if others else FAIL_LEVEL_DEFAULT
        mc = _monte_carlo(g["risk"].values.astype(float), fail_level, seed=abs(hash(aid)) % (2 ** 32))
        wp, wq, wbasis = _weibull(a.asset_type, a.age_years)
        for j, i in enumerate(idx):
            date = df.at[i, "date"]
            hist_days = int(df.at[i, "hist_days"])
            risk = float(df.at[i, "risk"])
            if df.at[i, "in_failed"]:
                p1 = {h: 1.0 for h in HORIZONS}
                for m in ("heuristic", "classifier", "monte_carlo"):
                    rows.append(_row(aid, date, m, p1, None, "high", "asset is in a FAILED window (FailureEvent)"))
            else:
                ph = {h: (0.0 if np.isnan(heur[h][i]) else heur[h][i]) for h in HORIZONS}
                rows.append(_row(aid, date, "heuristic", ph, None, _confidence_basic(hist_days),
                                 "risk %.2f -> P(fail within 14 d) %.0f%% on the calibration curve" % (risk, 100 * ph[14])))
                pc = {h: (0.0 if np.isnan(clf[h][i]) else clf[h][i]) for h in HORIZONS}
                top = sorted(zip(CLF_FEATURES, contrib[i]), key=lambda kv: -abs(kv[1]))[:3]
                rows.append(_row(aid, date, "classifier", pc, None, _confidence_basic(hist_days),
                                 "top drivers: " + ", ".join("%s %+.2f" % kv for kv in top)))
                p, q, conf, basis = mc[j]
                rows.append(_row(aid, date, "monte_carlo", p, q, conf, basis))
            rows.append(_row(aid, date, "weibull", wp, wq, "low", wbasis))

    written = 0
    for k in range(0, len(rows), BATCH):
        chunk = [c3.RiskForecast.make(r) for r in rows[k:k + BATCH]]
        c3.RiskForecast.mergeBatch(chunk)
        written += len(chunk)
    return written
