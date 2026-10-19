import math

CRITICALITY_WEIGHT = {"patient_care": 4, "research_lab": 3, "instruction": 2, "office": 1}
CHILLER_RENTAL_USD_PER_DAY = 3704  # estimate: $10M / ~30 chillers / ~90 days
TONS_PER_RENTAL_CHILLER = 400      # assumption
PRIORITY_CRITICALITIES = ("patient_care", "research_lab")

REAL_OUTAGE = {
    "label": "Real June 2026 outage",
    "total_usd": 15800000,
    "rental_usd": 10000000,
    "deterioration_usd": 4000000,
    "repair_usd": 1800000,
    "chillers": 30,
    "usd_per_day": 111000,
    "buildings_closed": 23,
    "buildings_partial": 11,
    "start_date": "2026-06-17",
    "reopen_date": "2026-08-10",
    "source": "Cap Times Oct 8 2026; WPR Jun 30 2026; UW News. usd_per_day is our estimate.",
}


def _load_factor(temp_f):
    return max(0.3, min(1.0, (float(temp_f) - 55.0) / 40.0))


def simulate(cls, segment_id, temp_f, priority_only):
    segment = c3.LoopSegment.forId(segment_id).get("this, plant.id")
    buildings = list(c3.Building.fetch({
        "filter": "segment.id == '" + segment_id + "'",
        "include": "this",
        "limit": -1,
    }).objs or [])

    load_factor = _load_factor(temp_f if temp_f is not None else 95)
    ordered = sorted(
        buildings,
        key=lambda b: (-CRITICALITY_WEIGHT.get(b.criticality, 0), -(b.peak_load_tons or 0.0)),
    )

    rows = []
    total_chillers = 0
    total_cost = 0
    staged_count = 0
    for i, b in enumerate(ordered):
        tons = float(b.peak_load_tons or 0.0)
        chillers = int(math.ceil(tons * load_factor / TONS_PER_RENTAL_CHILLER)) if tons > 0 else 0
        cost = chillers * CHILLER_RENTAL_USD_PER_DAY
        staged = (not priority_only) or (b.criticality in PRIORITY_CRITICALITIES)
        if staged:
            total_chillers += chillers
            total_cost += cost
            staged_count += 1
        rows.append({
            "order": i + 1,
            "building_id": b.id,
            "name": b.name,
            "criticality": b.criticality,
            "peak_load_tons": tons,
            "chillers_needed": chillers,
            "cost_per_day_usd": cost,
            "staged": staged,
        })

    return {
        "segment_id": segment_id,
        "plant_id": segment.plant.id if segment and segment.plant else None,
        "temp_f": float(temp_f) if temp_f is not None else 95.0,
        "priority_only": bool(priority_only),
        "load_factor": round(load_factor, 3),
        "buildings": rows,
        "totals": {
            "buildings": staged_count,
            "chillers": total_chillers,
            "cost_per_day_usd": total_cost,
            "cost_per_week_usd": total_cost * 7,
        },
        "reference": dict(REAL_OUTAGE),
    }
