import datetime as _dt

WATCH_THRESHOLD = 2.0
PERSISTENCE_DAYS = 2
LOOKBACK_DAYS = 30
FALSE_ALARM_HORIZON_DAYS = 21
DECOY_WINDOW_DAYS = 5
SWEEP = [2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 3.75, 4.0]
DECOY_REASON = {
    "D1": "Persistence rule: needs %d days over threshold" % PERSISTENCE_DAYS,
    "D2": "Missing data never raises risk",
    "D3": "Energy is compared with the weather-expected baseline",
    "D4": "Compared with its own 30-day normal",
}


def _fetch(type_name, include, flt=None):
    spec = {"include": include, "limit": -1}
    if flt:
        spec["filter"] = flt
    return list(getattr(c3, type_name).fetch(spec).objs or [])


def _d(s):
    return _dt.date.fromisoformat(s)


def _statuses(dates, risks, failed_windows, thr):
    """Re-derive statuses from the risk series at an arbitrary threshold (CONTRACT §2 rules)."""
    out = []
    due = False
    above = 0
    below = 0
    for d, r in zip(dates, risks):
        if any(lo <= d <= hi for lo, hi in failed_windows):
            out.append("FAILED")
            due = False
            above = below = 0
            continue
        r = r or 0.0
        above = above + 1 if r >= thr else 0
        below = below + 1 if r < WATCH_THRESHOLD else 0
        if not due and above >= PERSISTENCE_DAYS:
            due = True
        if due and below >= PERSISTENCE_DAYS:
            due = False
        out.append("INSPECTION_DUE" if due else ("WATCH" if r >= WATCH_THRESHOLD else "HEALTHY"))
    return out


def _series_by_asset():
    rows = _fetch("RiskScore", "date, risk, energy_over_expected_pct, asset.id")
    by_asset = {}
    for r in rows:
        if r.asset is None:
            continue
        by_asset.setdefault(r.asset.id, []).append(r)
    for aid in by_asset:
        by_asset[aid].sort(key=lambda r: r.date)
    return by_asset


def _evaluate(by_asset, events, systems, thr):
    failures_by_asset = {}
    failed_windows = {}
    for e in events:
        if e.kind != "failure" or e.asset is None:
            continue
        failures_by_asset.setdefault(e.asset.id, []).append(e)
        failed_windows.setdefault(e.asset.id, []).append((e.date, e.end_date or e.date))

    statuses = {}
    for aid, rows in by_asset.items():
        dates = [r.date for r in rows]
        risks = [float(r.risk or 0) for r in rows]
        statuses[aid] = dict(zip(dates, _statuses(dates, risks, failed_windows.get(aid, []), thr)))

    failures = []
    missed = 0
    for aid, evs in failures_by_asset.items():
        for e in evs:
            fail = _d(e.date)
            lo = (fail - _dt.timedelta(days=LOOKBACK_DAYS)).isoformat()
            due_days = sorted(d for d, s in statuses.get(aid, {}).items() if s == "INSPECTION_DUE" and lo <= d < e.date)
            first = due_days[0] if due_days else None
            pct_at_flag = None
            if first:
                for r in by_asset.get(aid, []):
                    if r.date == first:
                        pct_at_flag = round(float(r.energy_over_expected_pct or 0), 1)
                        break
            else:
                missed += 1
            failures.append({
                "event_id": e.id,
                "asset_id": aid,
                "system": systems.get(aid),
                "failure_date": e.date,
                "first_due_date": first,
                "lead_days": (fail - _d(first)).days if first else None,
                "energy_over_expected_pct_at_flag": pct_at_flag,
            })
    failures.sort(key=lambda f: f["failure_date"])

    false_alarm_days = 0
    for aid, st in statuses.items():
        fails = [_d(e.date) for e in failures_by_asset.get(aid, [])]
        for d, s in st.items():
            if s != "INSPECTION_DUE":
                continue
            dd = _d(d)
            if not any(0 <= (f - dd).days <= FALSE_ALARM_HORIZON_DAYS for f in fails):
                false_alarm_days += 1

    return failures, false_alarm_days, missed, statuses, failures_by_asset


def _median(xs):
    xs = sorted(xs)
    n = len(xs)
    if not n:
        return None
    return float(xs[n // 2]) if n % 2 else (xs[n // 2 - 1] + xs[n // 2]) / 2.0


def _asset_day_metrics(statuses, failures_by_asset, failures):
    """Honest asset-day scoring at this threshold. A flagged day (INSPECTION_DUE) is a true positive
    when a failure starts on that asset within the next FALSE_ALARM_HORIZON_DAYS days, otherwise a
    false alarm; a positive day is any non-FAILED asset-day inside that window before a failure, so
    recall says how much of the warning window the model actually covered."""
    tp = fp = fn = 0
    asset_days = 0
    for aid, st in statuses.items():
        fails = [_d(e.date) for e in failures_by_asset.get(aid, [])]
        for d, s in st.items():
            if s == "FAILED":
                continue
            asset_days += 1
            dd = _d(d)
            positive = any(0 < (f - dd).days <= FALSE_ALARM_HORIZON_DAYS for f in fails)
            flagged = s == "INSPECTION_DUE"
            if flagged and positive:
                tp += 1
            elif flagged:
                fp += 1
            elif positive:
                fn += 1
    leads = [f["lead_days"] for f in failures if f["lead_days"] is not None]
    return {
        "asset_days": asset_days,
        "true_positive_days": tp,
        "false_alarm_days": fp,
        "missed_positive_days": fn,
        "precision": round(tp / float(tp + fp), 3) if tp + fp else None,
        "recall": round(tp / float(tp + fn), 3) if tp + fn else None,
        "false_alarms_per_1000_asset_days": round(fp / float(asset_days) * 1000.0, 2) if asset_days else None,
        "failures_detected": len(leads),
        "failures_total": len(failures),
        "lead_days": {
            "min": min(leads) if leads else None,
            "mean": round(sum(leads) / float(len(leads)), 1) if leads else None,
            "median": _median(leads),
        },
    }


def _brier_14d(failures_by_asset):
    """Brier score of each method's stored `p_fail_14d` against 'a failure on this asset starts within
    the next 14 days', over every asset-day outside FAILED windows (where every method writes 1.0 by
    construction). Lower is better; `base_rate` is the score of always predicting the average
    positive rate, the bar a method has to beat to carry any information."""
    rows = _fetch("RiskForecast", "asset.id, date, method, p_fail_14d")
    fails = {aid: [_d(e.date) for e in evs] for aid, evs in failures_by_asset.items()}
    windows = {aid: [(e.date, e.end_date or e.date) for e in evs] for aid, evs in failures_by_asset.items()}
    acc = {}
    pos = n_days = 0
    seen_days = set()
    for r in rows:
        if r.asset is None or r.p_fail_14d is None:
            continue
        aid = r.asset.id
        if any(lo <= r.date <= hi for lo, hi in windows.get(aid, [])):
            continue
        dd = _d(r.date)
        y = 1.0 if any(0 < (f - dd).days <= 14 for f in fails.get(aid, [])) else 0.0
        key = (aid, r.date)
        if key not in seen_days:
            seen_days.add(key)
            n_days += 1
            pos += int(y)
        s, n = acc.get(r.method, (0.0, 0))
        acc[r.method] = (s + (float(r.p_fail_14d) - y) ** 2, n + 1)
    out = {m: round(s / n, 4) for m, (s, n) in acc.items() if n}
    rate = pos / float(n_days) if n_days else None
    out["base_rate"] = round(rate * (1.0 - rate), 4) if rate is not None else None
    out["positive_rate"] = round(rate, 4) if rate is not None else None
    out["asset_days"] = n_days
    return out


def run(cls, threshold):
    thr = float(threshold) if threshold is not None else 3.0
    by_asset = _series_by_asset()
    events = _fetch("FailureEvent", "this, asset.id")
    systems = {a.id: a.system for a in _fetch("Asset", "id, system")}

    failures, false_alarm_days, missed, statuses, failures_by_asset = _evaluate(by_asset, events, systems, thr)
    healthy_assets = sum(1 for aid in systems if aid not in failures_by_asset)

    decoys = []
    for e in sorted((e for e in events if e.kind == "decoy"), key=lambda e: e.id):
        center = _d(e.date)
        lo = (center - _dt.timedelta(days=DECOY_WINDOW_DAYS)).isoformat()
        hi = (center + _dt.timedelta(days=DECOY_WINDOW_DAYS)).isoformat()
        targets = [e.asset.id] if e.asset is not None else [aid for aid in systems if aid not in failures_by_asset]
        fired = any(s == "INSPECTION_DUE" for aid in targets for d, s in statuses.get(aid, {}).items() if lo <= d <= hi)
        decoys.append({
            "event_id": e.id,
            "label": (e.label or "").split(":")[0],
            "ignored": not fired,
            "reason": DECOY_REASON.get(e.id, "Compared with its own normal; drift must persist"),
        })

    sweep = []
    for t in SWEEP:
        f, fa, m, _, _ = _evaluate(by_asset, events, systems, t)
        leads = [x["lead_days"] for x in f if x["lead_days"] is not None]
        sweep.append({
            "threshold": t,
            "mean_lead_days": round(sum(leads) / len(leads), 1) if leads else None,
            "min_lead_days": min(leads) if leads else None,
            "false_alarm_days": fa,
            "missed": m,
        })

    curves = []
    for f in failures:
        rows = {r.date: float(r.risk or 0) for r in by_asset.get(f["asset_id"], [])}
        fail = _d(f["failure_date"])
        points = []
        for k in range(-21, 1):
            d = (fail + _dt.timedelta(days=k)).isoformat()
            if d in rows:
                points.append({"days_before": k, "risk": round(rows[d], 2)})
        curves.append({"event_id": f["event_id"], "asset_id": f["asset_id"], "points": points})

    # Additive (docs/ML.md §9): asset-day precision/recall, false alarms per 1,000 asset-days,
    # lead-time spread, and the per-method Brier score of the stored 14-day probabilities.
    metrics = _asset_day_metrics(statuses, failures_by_asset, failures)
    metrics["brier_14d"] = _brier_14d(failures_by_asset)
    metrics["note"] = ("Scored against the planted failures F1-F5 (synthetic): a flagged asset-day counts as correct "
                       "only if that asset fails within %d days. This proves the pipeline, not that the real break was predictable."
                       % FALSE_ALARM_HORIZON_DAYS)

    return {
        "threshold": thr,
        "failures": failures,
        "false_alarm_days": false_alarm_days,
        "healthy_assets": healthy_assets,
        "decoys": decoys,
        "sweep": sweep,
        "aligned_curves": curves,
        "metrics": metrics,
    }
