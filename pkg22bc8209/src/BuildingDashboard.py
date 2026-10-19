import datetime as _dt

STATUS_RANK = {"HEALTHY": 0, "WATCH": 1, "INSPECTION_DUE": 2, "FAILED": 3}
SYSTEMS = ["cooling", "heating", "air"]
PLAN_B_TEMP_F = 95


def _fetch(type_name, include, flt=None):
    spec = {"include": include, "limit": -1}
    if flt:
        spec["filter"] = flt
    return list(getattr(c3, type_name).fetch(spec).objs or [])


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
    }


def compute(cls, building_id, as_of):
    b = c3.Building.forId(building_id).get("this, segment.id")
    segment = c3.LoopSegment.forId(b.segment.id).get("this, plant.id")
    plant = c3.Plant.forId(segment.plant.id).get("this") if segment.plant is not None else None

    items = c3.CampusSnapshot.queue(as_of) or []
    serving = [q for q in items if q["building_id"] == building_id or (q["building_id"] is None and q["segment_id"] == segment.id)]
    serving_ids = [q["asset_id"] for q in serving]

    window_lo = _shift(as_of, -89)
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
