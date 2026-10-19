import math
import datetime as _dt

CRITICALITY_WEIGHT = {"patient_care": 4, "research_lab": 3, "instruction": 2, "office": 1}
CHILLER_RENTAL_USD_PER_DAY = 3704
TONS_PER_RENTAL_CHILLER = 400
ENERGY_USD_PER_KWH = 0.10
STATUS_RANK = {"HEALTHY": 0, "WATCH": 1, "INSPECTION_DUE": 2, "FAILED": 3}
QUEUE_ORDER = {"INSPECTION_DUE": 0, "FAILED": 1, "WATCH": 2, "HEALTHY": 3}


def _fetch(type_name, include, flt=None):
    spec = {"include": include, "limit": -1}
    if flt:
        spec["filter"] = flt
    return list(getattr(c3, type_name).fetch(spec).objs or [])


def _ref_id(ref):
    return ref.id if ref is not None else None


def _shift(as_of, days):
    d = _dt.date.fromisoformat(as_of) + _dt.timedelta(days=days)
    return d.isoformat()


def _worst(statuses):
    best = "HEALTHY"
    for s in statuses:
        if STATUS_RANK.get(s, 0) > STATUS_RANK[best]:
            best = s
    return best


def _served(asset, buildings_by_segment, buildings_by_id):
    bid = _ref_id(asset.building)
    if bid:
        b = buildings_by_id.get(bid)
        return [b] if b else []
    return buildings_by_segment.get(_ref_id(asset.segment), [])


def _chillers_for(buildings):
    return sum(int(math.ceil(float(b.peak_load_tons or 0) / TONS_PER_RENTAL_CHILLER)) for b in buildings)


def _fallback_label(rs):
    if rs is None or not rs.driver:
        return None
    if rs.driver == "energy":
        return "energy %+.1f%%" % float(rs.energy_over_expected_pct or 0)
    z = getattr(rs, "z_" + rs.driver, None)
    arrow = "↓" if rs.driver in ("pressure", "delta_t") else "↑"
    name = {"pressure": "pressure", "flow_imbalance": "flow imbalance", "delta_t": "ΔT", "vibration": "vibration"}[rs.driver]
    return "%s %s (z %.1f)" % (name, arrow, float(z or 0))


def _queue_items(as_of):
    assets = _fetch("Asset", "this, segment.id, building.id")
    buildings = _fetch("Building", "this, segment.id")
    scores = _fetch("RiskScore", "this, asset.id", "date == '" + as_of + "'")
    wos = _fetch("WorkOrder", "this, asset.id", "drafted_on <= '" + as_of + "'")

    buildings_by_id = {b.id: b for b in buildings}
    buildings_by_segment = {}
    for b in buildings:
        buildings_by_segment.setdefault(_ref_id(b.segment), []).append(b)
    score_by_asset = {_ref_id(s.asset): s for s in scores}
    wo_by_asset = {}
    for w in sorted(wos, key=lambda w: w.drafted_on or ""):
        wo_by_asset[_ref_id(w.asset)] = w.status

    items = []
    for a in assets:
        served = _served(a, buildings_by_segment, buildings_by_id)
        impact = sum(CRITICALITY_WEIGHT.get(b.criticality, 0) * float(b.peak_load_tons or 0) / 500.0 for b in served)
        cost = _chillers_for(served) * CHILLER_RENTAL_USD_PER_DAY if a.system == "cooling" else None
        rs = score_by_asset.get(a.id)
        risk = float(rs.risk) if rs is not None and rs.risk is not None else 0.0
        status = rs.status if rs is not None and rs.status else "HEALTHY"
        items.append({
            "asset_id": a.id,
            "name": a.name,
            "system": a.system,
            "type": a.asset_type,
            "segment_id": _ref_id(a.segment),
            "building_id": _ref_id(a.building),
            "status": status,
            "risk": round(risk, 2),
            "days_in_status": int(rs.days_in_status) if rs is not None and rs.days_in_status is not None else 0,
            "driver": rs.driver if rs is not None else None,
            "driver_label": (rs.driver_label if rs is not None and rs.driver_label else _fallback_label(rs)),
            "energy_over_expected_pct": round(float(rs.energy_over_expected_pct), 1) if rs is not None and rs.energy_over_expected_pct is not None else 0.0,
            "impact": round(impact, 1),
            "rank_score": round(risk * impact, 1),
            "buildings_served": len(served),
            "cost_per_day_usd": cost,
            "work_order_status": wo_by_asset.get(a.id),
            "_served_ids": [b.id for b in served],
            "_expected_kwh": float(rs.expected_energy_kwh) if rs is not None and rs.expected_energy_kwh is not None else None,
        })
    items.sort(key=lambda q: (QUEUE_ORDER.get(q["status"], 9), -q["rank_score"], -q["risk"]))
    return items, assets, buildings, buildings_by_segment


def _public(items):
    return [{k: v for k, v in q.items() if not k.startswith("_")} for q in items]


def queue(cls, as_of):
    items, _, _, _ = _queue_items(as_of)
    return _public(items)


def compute(cls, as_of):
    items, assets, buildings, buildings_by_segment = _queue_items(as_of)
    yesterday_due = sum(1 for s in _fetch("RiskScore", "status", "date == '" + _shift(as_of, -1) + "'") if s.status == "INSPECTION_DUE")

    due = [q for q in items if q["status"] == "INSPECTION_DUE"]
    watch = [q for q in items if q["status"] == "WATCH"]
    failed = [q for q in items if q["status"] == "FAILED"]

    waste_usd = 0.0
    over5 = 0
    for q in items:
        pct = q["energy_over_expected_pct"] or 0.0
        if pct > 5 and q["_expected_kwh"]:
            over5 += 1
            waste_usd += q["_expected_kwh"] * pct / 100.0 * ENERGY_USD_PER_KWH

    exposed_building_ids = set()
    for q in due + watch:
        if q["system"] == "cooling":
            exposed_building_ids.update(q["_served_ids"])
    buildings_by_id = {b.id: b for b in buildings}
    exposure = _chillers_for([buildings_by_id[i] for i in exposed_building_ids if i in buildings_by_id]) * CHILLER_RENTAL_USD_PER_DAY

    building_status = {b.id: [] for b in buildings}
    for q in items:
        for bid in q["_served_ids"]:
            building_status.setdefault(bid, []).append(q["status"])
    buildings_out = [{
        "building_id": b.id,
        "name": b.name,
        "segment_id": _ref_id(b.segment),
        "criticality": b.criticality,
        "worst_status": _worst(building_status.get(b.id, [])),
    } for b in buildings]

    segments = _fetch("LoopSegment", "this, plant.id")
    segment_status = {}
    for q in items:
        segment_status.setdefault(q["segment_id"], []).append(q["status"])
    segments_out = [{
        "segment_id": s.id,
        "plant_id": _ref_id(s.plant),
        "name": s.name,
        "worst_status": _worst(segment_status.get(s.id, [])),
    } for s in segments]

    plants_out = [{"plant_id": p.id, "name": p.name} for p in _fetch("Plant", "this")]

    weather = None
    w = _fetch("WeatherDay", "this", "date == '" + as_of + "'")
    if w:
        w = w[0]
        weather = {"tmax_f": w.tmax_f, "tmin_f": w.tmin_f, "tavg_f": w.tavg_f, "label": w.label, "source": w.source}
    else:
        weather = {"tmax_f": None, "tmin_f": None, "tavg_f": None, "label": None, "source": None}

    if due:
        top = due[0]
        labs = sum(1 for bid in top["_served_ids"] if buildings_by_id.get(bid) is not None and buildings_by_id[bid].criticality in ("research_lab", "patient_care"))
        brief = "%d asset%s need%s inspection. The %s has %s for %d day%s and serves %d building%s%s." % (
            len(due), "" if len(due) == 1 else "s", "s" if len(due) == 1 else "",
            top["name"], top["driver_label"] or "drifted from its normal", top["days_in_status"],
            "" if top["days_in_status"] == 1 else "s", top["buildings_served"],
            "" if top["buildings_served"] == 1 else "s",
            (", including %d research lab%s" % (labs, "" if labs == 1 else "s")) if labs else "")
    elif watch:
        brief = "No inspections due. %d asset%s on watch; the highest is %s (%s)." % (
            len(watch), "" if len(watch) == 1 else "s", watch[0]["name"], watch[0]["driver_label"] or "drifting")
    else:
        brief = "All systems within normal ranges as of %s." % as_of

    return {
        "as_of": as_of,
        "weather": weather,
        "kpis": {
            "inspection_due": len(due),
            "inspection_due_delta": len(due) - yesterday_due,
            "watch": len(watch),
            "failed": len(failed),
            "energy_waste_usd_per_day": int(round(waste_usd)),
            "assets_over_5pct_energy": over5,
            "cooling_exposure_usd_per_day": exposure,
        },
        "queue": _public(items),
        "buildings": buildings_out,
        "segments": segments_out,
        "plants": plants_out,
        "morning_brief": brief,
    }
