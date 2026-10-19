import datetime as _dt

STATUS_RANK = {"HEALTHY": 0, "WATCH": 1, "INSPECTION_DUE": 2, "FAILED": 3}
SYSTEMS = ["cooling", "heating", "air"]
PLAN_B_TEMP_F = 95
REPLAY_START = "2026-01-01"
REPLAY_END = "2026-08-31"


def _fetch(type_name, include, flt=None):
    spec = {"include": include, "limit": -1}
    if flt:
        spec["filter"] = flt
    return list(getattr(c3, type_name).fetch(spec).objs or [])


def _check_as_of(as_of):
    """ISO date inside the replay window, or a clear error naming the bad input."""
    s = str(as_of).strip() if as_of is not None else ""
    if len(s) > 10 and s[10] in "T ":
        s = s[:10]
    try:
        iso = _dt.date.fromisoformat(s).isoformat()
    except ValueError:
        raise ValueError("as_of must be an ISO date YYYY-MM-DD, got %r." % (as_of,))
    if iso < REPLAY_START or iso > REPLAY_END:
        raise ValueError("as_of %s is outside the replay window %s..%s." % (iso, REPLAY_START, REPLAY_END))
    return iso


def _building(building_id):
    b = None
    if building_id is not None and str(building_id).strip():
        b = c3.Building.forId(str(building_id).strip()).get("this, segment.id")
    if b is None:
        known = sorted(x.id for x in _fetch("Building", "id"))
        raise ValueError("Unknown building_id %r. Known buildings: %s." % (building_id, ", ".join(known) if known else "none loaded"))
    return b


def _shift(as_of, days):
    return (_dt.date.fromisoformat(as_of) + _dt.timedelta(days=days)).isoformat()


def _wo_json(w):
    return {
        "wo_id": w.id,
        "asset_id": w.asset.id if w.asset is not None else None,
        "building_ids": list(w.building_ids) if w.building_ids else [],
        "title": w.title,
        "description": w.description,
        "priority": w.priority,
        "crew": w.crew,
        "est_hours": w.est_hours,
        "status": w.status,
        "drafted_by": w.drafted_by,
        "drafted_on": w.drafted_on,
        "approved_by": w.approved_by,
        "approved_on": w.approved_on,
        "dismiss_reason": w.dismiss_reason,
        "edited_on": getattr(w, "edited_on", None),
    }


def compute(cls, building_id, as_of):
    as_of = _check_as_of(as_of)
    b = _building(building_id)
    building_id = b.id
    segment = c3.LoopSegment.forId(b.segment.id).get("this, plant.id") if b.segment is not None else None
    if segment is None:
        raise ValueError("Building %r has no loop segment assigned; cannot build its dashboard." % building_id)
    plant = c3.Plant.forId(segment.plant.id).get("this") if segment.plant is not None else None

    items = c3.CampusSnapshot.queue(as_of) or []
    serving = [q for q in items if q["building_id"] == building_id or (q["building_id"] is None and q["segment_id"] == segment.id)]
    serving_ids = [q["asset_id"] for q in serving]

    window_lo = _shift(as_of, -89)
    # RiskScore may be empty while the model re-runs: everything below degrades to empty series.
    scores = [s for s in _fetch("RiskScore", "this, asset.id", "date >= '" + window_lo + "' && date <= '" + as_of + "'")
              if s.asset is not None and s.asset.id in serving_ids]

    systems = {}
    for sys_name in SYSTEMS:
        cands = [q for q in serving if q["system"] == sys_name]
        if not cands:
            systems[sys_name] = None
            continue
        top = sorted(cands, key=lambda q: (-STATUS_RANK.get(q["status"], 0), -q["risk"]))[0]
        spark_lo = _shift(as_of, -6)
        spark = sorted(
            [{"date": s.date, "risk": round(float(s.risk or 0), 2)} for s in scores if s.asset.id == top["asset_id"] and s.date >= spark_lo],
            key=lambda p: p["date"])
        systems[sys_name] = {
            "status": top["status"],
            "risk": top["risk"],
            "via_asset_id": top["asset_id"],
            "energy_over_expected_pct": top["energy_over_expected_pct"],
            "sparkline": spark,
        }

    by_date = {}
    for s in scores:
        exp = float(s.expected_energy_kwh) if s.expected_energy_kwh is not None else None
        if exp is None:
            continue
        pct = float(s.energy_over_expected_pct or 0.0)
        acc = by_date.setdefault(s.date, {"actual": 0.0, "expected": 0.0})
        acc["expected"] += exp
        acc["actual"] += exp * (1 + pct / 100.0)
    energy_series = [{"date": d, "actual_kwh": int(round(v["actual"])), "expected_kwh": int(round(v["expected"]))}
                     for d, v in sorted(by_date.items())]

    work_orders = [_wo_json(w) for w in _fetch("WorkOrder", "this, asset.id")
                   if w.asset is not None and w.asset.id in serving_ids and (w.drafted_on or "") <= as_of]
    work_orders.sort(key=lambda w: w["drafted_on"] or "", reverse=True)

    plan_b = None
    if any(q["system"] == "cooling" for q in serving):
        sim = c3.PlanB.simulate(segment.id, PLAN_B_TEMP_F, False)
        for row in sim.get("buildings", []):
            if row["building_id"] == building_id:
                plan_b = {
                    "segment_id": segment.id,
                    "priority_rank": row["order"],
                    "chillers_needed": row["chillers_needed"],
                    "cost_per_day_usd": row["cost_per_day_usd"],
                }
                break

    return {
        "as_of": as_of,
        "building": {
            "building_id": b.id,
            "name": b.name,
            "segment_id": segment.id,
            "criticality": b.criticality,
            "year_built": b.year_built,
            "gsf": b.gsf,
            "peak_load_tons": b.peak_load_tons,
            "lat": b.lat,
            "lon": b.lon,
            "source": b.source,
        },
        "served_by": {
            "plant_id": plant.id if plant is not None else None,
            "plant_name": plant.name if plant is not None else None,
            "segment_id": segment.id,
            "segment_name": segment.name,
        },
        "systems": systems,
        "energy_series": energy_series,
        "assets": serving,
        "work_orders": work_orders,
        "plan_b": plan_b,
    }
