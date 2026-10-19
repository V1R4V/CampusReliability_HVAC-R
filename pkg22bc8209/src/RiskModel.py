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
        if len(idx) >= 10 and np.nanstd(x) > 1e-6:
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

    energy = g["energy_kwh"].astype(float).values
    expected = _expected_energy(energy, dd)
    with np.errstate(divide="ignore", invalid="ignore"):
        pct = np.where(expected > 0, (energy - expected) / expected * 100.0, np.nan)
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
        z[sig] = raw.clip(lower=0.0).rolling(3, min_periods=1).mean()

    n = len(g)
    rows = []
    prev_risk = 0.0
    due = False
    above = 0
    below = 0
    prev_status = None
    days_in = 0
    age_mult = 1.0 + float(age_years or 0) / 60.0
    windows = [(lo, hi) for lo, hi in failed_windows]

    for i in range(n):
        date = g.at[i, "date"]
        avail = {sig: float(z[sig].iat[i]) for sig in SIGNALS if not np.isnan(z[sig].iat[i])}
        sensors_present = any(not np.isnan(float(g.at[i, c])) for c in SENSOR_COL.values() if c in g) or not np.isnan(energy[i])
        if not avail or not sensors_present:
            risk = prev_risk * 0.9
            contrib = {}
            driver = None
        else:
            wsum = sum(WEIGHTS[s] for s in avail)
            weighted = {s: WEIGHTS[s] / wsum * avail[s] for s in avail}
            risk = sum(weighted.values())
            risk *= age_mult
            if system == "heating" and tavg[i] < 0:
                risk *= 1.3
            if system == "cooling" and tmax[i] > 85:
                risk *= 1.2
            total = sum(weighted.values())
            contrib = {s: (weighted[s] / total if total > 0 else 1.0 / len(weighted)) for s in weighted}
            driver = max(weighted, key=weighted.get) if total > 0 else "pressure" if "pressure" in avail else list(avail)[0]

        failed = any(lo <= date <= hi for lo, hi in windows)
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

        d_delta = _clean(delta[driver].iat[i]) if driver else None
        row = {
            "id": "%s_%s" % (aid, date),
            "asset": {"id": aid},
            "date": date,
            "risk": round(float(risk), 3),
            "status": status,
            "driver": driver,
            "driver_label": _label(driver, d_delta, _clean(pct[i])) if driver else None,
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
