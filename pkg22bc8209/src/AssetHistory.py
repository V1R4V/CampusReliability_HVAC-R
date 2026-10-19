import math

INSPECTION_THRESHOLD = 3.0
SENSORS = ["pressure_psi", "flow_imbalance_pct", "delta_t_f", "vibration_mm_s", "energy_kwh"]
SIGNALS = ["pressure", "flow_imbalance", "delta_t", "vibration", "energy"]
CRITICALITY_WEIGHT = {"patient_care": 4, "research_lab": 3, "instruction": 2, "office": 1}


def _fetch(type_name, include, flt=None):
    spec = {"include": include, "limit": -1}
    if flt:
        spec["filter"] = flt
    return list(getattr(c3, type_name).fetch(spec).objs or [])


def _asset(asset_id):
    """The asset, or a clear error naming the bad id and the ids that do exist."""
    a = None
    if asset_id is not None and str(asset_id).strip():
        a = c3.Asset.forId(str(asset_id).strip()).get("this, segment.id, building.id")
    if a is None:
        known = sorted(x.id for x in _fetch("Asset", "id"))
        raise ValueError("Unknown asset_id %r. Known assets: %s." % (asset_id, ", ".join(known) if known else "none loaded"))
    return a


def _num(v):
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


def _band(values):
    """Trailing 30-day mean ± 2 std per index (excluding the day itself); None where <5 points."""
    out = []
    for i in range(len(values)):
        window = [v for v in values[max(0, i - 30):i] if v is not None]
        if len(window) < 5:
            # fall back to the first available window so early days still get shading
            window = [v for v in values[:30] if v is not None]
        if len(window) < 2:
            out.append(None)
            continue
        mean = sum(window) / len(window)
        var = sum((v - mean) ** 2 for v in window) / (len(window) - 1)
        std = math.sqrt(var)
        out.append([round(mean - 2 * std, 2), round(mean + 2 * std, 2)])
    return out


def get(cls, asset_id):
    a = _asset(asset_id)
    asset_id = a.id
    if a.building is not None:
        b = c3.Building.forId(a.building.id).get("this")
        served = [b] if b is not None else []
    elif a.segment is not None:
        served = _fetch("Building", "this", "segment.id == '" + a.segment.id + "'")
    else:
        served = []
    served.sort(key=lambda b: (-CRITICALITY_WEIGHT.get(b.criticality, 0), -(b.peak_load_tons or 0)))

    readings = sorted(_fetch("SensorReading", "this", "asset.id == '" + asset_id + "'"), key=lambda r: r.date)
    scores = {s.date: s for s in _fetch("RiskScore", "this", "asset.id == '" + asset_id + "'")}

    cols = {c: [_num(getattr(r, c)) for r in readings] for c in SENSORS}
    bands = {c: _band(cols[c]) if any(v is not None for v in cols[c]) else [None] * len(readings) for c in SENSORS}
    reading_dates = [r.date for r in readings]
    reading_idx = {d: i for i, d in enumerate(reading_dates)}

    dates = sorted(set(reading_dates) | set(scores.keys()))
    series = []
    for d in dates:
        s = scores.get(d)
        i = reading_idx.get(d)
        sensors = {c: (cols[c][i] if i is not None else None) for c in SENSORS}
        band = {c: (bands[c][i] if i is not None else None) for c in SENSORS}
        series.append({
            "date": d,
            "risk": round(_num(s.risk) or 0.0, 2) if s is not None else 0.0,
            "status": (s.status if s is not None and s.status else "HEALTHY"),
            "driver": s.driver if s is not None else None,
            "z": {sig: (_num(getattr(s, "z_" + sig)) if s is not None else None) for sig in SIGNALS},
            "contrib": {sig: (_num(getattr(s, "contrib_" + sig)) if s is not None else None) for sig in SIGNALS},
            "sensors": sensors,
            "band": band,
            "energy_over_expected_pct": round(_num(s.energy_over_expected_pct) or 0.0, 1) if s is not None else 0.0,
        })

    events = []
    for e in _fetch("FailureEvent", "this, asset.id"):
        eid = e.asset.id if e.asset is not None else None
        if eid == asset_id or eid is None:
            events.append({
                "event_id": e.id,
                "kind": e.kind,
                "asset_id": eid,
                "onset_date": e.onset_date,
                "date": e.date,
                "end_date": e.end_date,
                "label": e.label,
                "synthetic": bool(e.synthetic) if e.synthetic is not None else None,
            })
    events.sort(key=lambda e: e["date"] or "")

    return {
        "asset": {
            "asset_id": a.id,
            "name": a.name,
            "system": a.system,
            "type": a.asset_type,
            "segment_id": a.segment.id if a.segment is not None else None,
            "building_id": a.building.id if a.building is not None else None,
            "age_years": a.age_years,
            "install_year": a.install_year,
            "buildings_served": [{"building_id": b.id, "name": b.name, "criticality": b.criticality} for b in served],
        },
        "threshold": INSPECTION_THRESHOLD,
        "series": series,
        "events": events,
    }
