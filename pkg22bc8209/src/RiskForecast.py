import datetime as _dt

METHODS = ["heuristic", "classifier", "monte_carlo", "weibull"]
CONSENSUS_METHODS = ["heuristic", "classifier", "monte_carlo"]
LABELS = {
    "heuristic": "Calibrated risk score",
    "classifier": "Logistic classifier",
    "monte_carlo": "Monte Carlo drift simulation",
    "weibull": "Weibull age baseline (ASHRAE)",
}
HISTORY_DAYS = 30
INSPECTION_THRESHOLD = 3.0


def _fetch(type_name, include, flt=None):
    spec = {"include": include, "limit": -1}
    if flt:
        spec["filter"] = flt
    return list(getattr(c3, type_name).fetch(spec).objs or [])


def _num(v, nd=4):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return round(f, nd)


def _method_json(r):
    q = None
    if r.days_to_failure_p50 is not None:
        q = {"p10": _num(r.days_to_failure_p10, 1), "p50": _num(r.days_to_failure_p50, 1), "p90": _num(r.days_to_failure_p90, 1)}
    return {
        "method": r.method,
        "label": LABELS.get(r.method, r.method),
        "p_fail_7d": _num(r.p_fail_7d),
        "p_fail_14d": _num(r.p_fail_14d),
        "p_fail_30d": _num(r.p_fail_30d),
        "days_to_failure": q,
        "confidence": r.confidence,
        "basis": r.basis,
        "trained_on": r.trained_on,
    }


def _consensus(by_method):
    vals = {h: [float(getattr(by_method[m], "p_fail_%dd" % h)) for m in CONSENSUS_METHODS
                if m in by_method and getattr(by_method[m], "p_fail_%dd" % h) is not None] for h in (7, 14, 30)}
    n = len(vals[14])
    if n == 0:
        return {"p_fail_7d": None, "p_fail_14d": None, "p_fail_30d": None, "spread_14d": None, "n_methods": 0,
                "note": "no condition-based forecast for this day"}
    return {
        "p_fail_7d": round(sum(vals[7]) / len(vals[7]), 4) if vals[7] else None,
        "p_fail_14d": round(sum(vals[14]) / n, 4),
        "p_fail_30d": round(sum(vals[30]) / len(vals[30]), 4) if vals[30] else None,
        "spread_14d": round(max(vals[14]) - min(vals[14]), 4),
        "n_methods": n,
        "note": "mean of %d condition-based methods; the Weibull age baseline is shown for reference only" % n,
    }


def compare(cls, asset_id, as_of):
    # fetch, not forId().get(): forId returns None for an unknown id in this runtime.
    found = _fetch("Asset", "this", "id == '%s'" % str(asset_id).replace("'", "\\'")) if asset_id else []
    if not found:
        raise ValueError("Unknown asset_id %r." % (asset_id,))
    a = found[0]
    lo = (_dt.date.fromisoformat(as_of) - _dt.timedelta(days=HISTORY_DAYS)).isoformat()
    rows = _fetch("RiskForecast", "this, asset.id",
                  "asset.id == '%s' && date >= '%s' && date <= '%s'" % (asset_id, lo, as_of))
    dates = sorted({r.date for r in rows})
    used = as_of if as_of in dates else (dates[-1] if dates else None)
    today = {r.method: r for r in rows if r.date == used}

    by_date = {}
    for r in rows:
        by_date.setdefault(r.date, {})[r.method] = r
    history = []
    for d in dates:
        bm = by_date[d]
        point = {"date": d}
        for m in METHODS:
            point[m] = _num(bm[m].p_fail_14d) if m in bm else None
        point["consensus"] = _consensus(bm)["p_fail_14d"]
        history.append(point)

    score = _fetch("RiskScore", "risk, status", "asset.id == '%s' && date == '%s'" % (asset_id, used or as_of))
    s = score[0] if score else None

    nxt = None
    for e in _fetch("FailureEvent", "this, asset.id", "kind == 'failure' && asset.id == '%s'" % asset_id):
        if e.date > as_of and (nxt is None or e.date < nxt.date):
            nxt = e
    next_failure = None
    if nxt is not None:
        next_failure = {
            "event_id": nxt.id,
            "date": nxt.date,
            "days_from_as_of": (_dt.date.fromisoformat(nxt.date) - _dt.date.fromisoformat(as_of)).days,
            "synthetic": bool(nxt.synthetic) if nxt.synthetic is not None else None,
        }

    return {
        "asset_id": a.id,
        "name": a.name,
        "as_of": as_of,
        "as_of_used": used,
        "status": s.status if s is not None else None,
        "risk": _num(s.risk, 3) if s is not None else None,
        "threshold": INSPECTION_THRESHOLD,
        "methods": [_method_json(today[m]) for m in METHODS if m in today],
        "consensus": _consensus(today),
        "history": history,
        "next_failure": next_failure,
    }


def campus(cls, as_of):
    assets = {a.id: a for a in _fetch("Asset", "this, building.id")}
    scores = {r.asset.id: r for r in _fetch("RiskScore", "risk, status, asset.id", "date == '%s'" % as_of) if r.asset is not None}
    by_asset = {}
    for r in _fetch("RiskForecast", "this, asset.id", "date == '%s'" % as_of):
        if r.asset is not None:
            by_asset.setdefault(r.asset.id, {})[r.method] = r

    out = []
    for aid, a in assets.items():
        bm = by_asset.get(aid, {})
        cons = _consensus(bm)
        s = scores.get(aid)
        mc = bm.get("monte_carlo")
        confs = [bm[m].confidence for m in CONSENSUS_METHODS if m in bm and bm[m].confidence]
        conf = None
        if confs:
            conf = "high" if all(c == "high" for c in confs) else ("low" if any(c == "low" for c in confs) else "medium")
        out.append({
            "asset_id": aid,
            "name": a.name,
            "system": a.system,
            "type": a.asset_type,
            "building_id": a.building.id if a.building is not None else None,
            "status": s.status if s is not None else None,
            "risk": _num(s.risk, 3) if s is not None else None,
            "consensus_14d": cons["p_fail_14d"],
            "heuristic_14d": _num(bm["heuristic"].p_fail_14d) if "heuristic" in bm else None,
            "classifier_14d": _num(bm["classifier"].p_fail_14d) if "classifier" in bm else None,
            "monte_carlo_14d": _num(mc.p_fail_14d) if mc is not None else None,
            "weibull_14d": _num(bm["weibull"].p_fail_14d) if "weibull" in bm else None,
            "days_to_failure_p50": _num(mc.days_to_failure_p50, 1) if mc is not None else None,
            "confidence": conf,
            "spread_14d": cons["spread_14d"],
        })
    out.sort(key=lambda x: (-(x["consensus_14d"] or 0.0), -(x["risk"] or 0.0)))
    return {"as_of": as_of, "assets": out}
