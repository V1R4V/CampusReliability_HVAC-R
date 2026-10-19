import math

CRITICALITY_WEIGHT = {"patient_care": 4, "research_lab": 3, "instruction": 2, "office": 1}
CHILLER_RENTAL_USD_PER_DAY = 3704  # estimate: $10M / ~30 chillers / ~90 days
TONS_PER_RENTAL_CHILLER = 400      # assumption
PRIORITY_CRITICALITIES = ("patient_care", "research_lab")
DEFAULT_TEMP_F = 95.0
TEMP_RANGE_F = (-60.0, 140.0)      # anything outside is a unit mix-up, not a Madison day

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


def _temp(temp_f):
    """Validated outdoor temperature in °F; null means the 95 °F design day."""
    if temp_f is None:
        return DEFAULT_TEMP_F
    if isinstance(temp_f, bool):
        raise ValueError("temp_f must be a number in °F, got %r." % (temp_f,))
    try:
        t = float(temp_f)
    except (TypeError, ValueError):
        raise ValueError("temp_f must be a number in °F, got %r." % (temp_f,))
    if math.isnan(t) or math.isinf(t) or t < TEMP_RANGE_F[0] or t > TEMP_RANGE_F[1]:
        raise ValueError("temp_f %r °F is outside the supported range %d..%d °F." % (temp_f, int(TEMP_RANGE_F[0]), int(TEMP_RANGE_F[1])))
    return t


def _flag(value):
    """Booleans may arrive as strings from a query string; 'false' must not count as true."""
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes", "y")
    return bool(value)


def _segment(segment_id):
    seg = None
    if segment_id is not None and str(segment_id).strip():
        seg = c3.LoopSegment.forId(str(segment_id).strip()).get("this, plant.id")
    if seg is None:
        known = sorted(s.id for s in (c3.LoopSegment.fetch({"include": "id", "limit": -1}).objs or []))
        raise ValueError("Unknown segment_id %r. Known segments: %s." % (segment_id, ", ".join(known) if known else "none loaded"))
    return seg


def simulate(cls, segment_id, temp_f, priority_only):
    segment = _segment(segment_id)
    temp = _temp(temp_f)
    priority_only = _flag(priority_only)
    buildings = list(c3.Building.fetch({
        "filter": "segment.id == '" + segment.id + "'",
        "include": "this",
        "limit": -1,
    }).objs or [])

    load_factor = _load_factor(temp)
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
        "segment_id": segment.id,
        "plant_id": segment.plant.id if segment.plant is not None else None,
        "temp_f": temp,
        "priority_only": priority_only,
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
