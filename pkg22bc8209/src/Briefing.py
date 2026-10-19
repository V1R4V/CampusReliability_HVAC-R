import math

CRITICALITY_WEIGHT = {"patient_care": 4, "research_lab": 3, "instruction": 2, "office": 1}
CHILLER_RENTAL_USD_PER_DAY = 3704
TONS_PER_RENTAL_CHILLER = 400
SIGNALS = ["pressure", "flow_imbalance", "delta_t", "vibration", "energy"]
SIGNAL_NAME = {"pressure": "Pressure", "flow_imbalance": "Flow imbalance", "delta_t": "ΔT", "vibration": "Vibration", "energy": "Energy"}
PIPING_TYPES = ("chw_main", "steam_line", "isolation_valve", "steam_trap")
WO_SERIES_BASE = 71213


def _fetch(type_name, include, flt=None):
    spec = {"include": include, "limit": -1}
    if flt:
        spec["filter"] = flt
    return list(getattr(c3, type_name).fetch(spec).objs or [])


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


def _short_name(b):
    n = b.name or b.id
    for suffix in (" Building", " Hall"):
        if n.endswith(suffix) and len(n) > len(suffix) + 3:
            n = n[: -len(suffix)]
    return n


def _crew(asset):
    if asset.asset_type in PIPING_TYPES:
        return "Utilities – Piping"
    return "HVAC – Mechanical"


def _next_wo_id():
    n = len(_fetch("WorkOrder", "id"))
    return "WO 26-0%05d" % (WO_SERIES_BASE + n)


def _draft_work_order(asset, q, served, as_of, priority, description):
    existing = _fetch("WorkOrder", "this, asset.id",
                      "asset.id == '" + asset.id + "' && status == 'PENDING_APPROVAL'")
    if existing:
        return existing[0]
    wo = c3.WorkOrder.make({
        "id": _next_wo_id(),
        "asset": {"id": asset.id},
        "building_ids": [b.id for b in served],
        "title": "Inspect " + (asset.name[0].lower() + asset.name[1:] if asset.name else asset.id),
        "description": description,
        "priority": priority,
        "crew": _crew(asset),
        "est_hours": 6 if asset.asset_type == "chw_main" else 4,
        "status": "PENDING_APPROVAL",
        "drafted_by": "agent",
        "drafted_on": as_of,
    })
    wo.upsert()
    return c3.WorkOrder.forId(wo.id).get("this, asset.id")


def generate(cls, asset_id, as_of):
    asset = c3.Asset.forId(asset_id).get("this, segment.id, building.id")
    items = c3.CampusSnapshot.queue(as_of) or []
    q = next((i for i in items if i["asset_id"] == asset_id), None)
    if q is None:
        raise ValueError("Unknown asset: " + str(asset_id))

    if asset.building is not None:
        served = [c3.Building.forId(asset.building.id).get("this")]
    else:
        served = _fetch("Building", "this", "segment.id == '" + asset.segment.id + "'")
    served.sort(key=lambda b: (-CRITICALITY_WEIGHT.get(b.criticality, 0), -(b.peak_load_tons or 0)))
    labs = [b for b in served if b.criticality in ("research_lab", "patient_care")]

    score = _fetch("RiskScore", "this", "asset.id == '" + asset_id + "' && date == '" + as_of + "'")
    score = score[0] if score else None
    contribs = []
    if score is not None:
        for sig in SIGNALS:
            c = getattr(score, "contrib_" + sig)
            if c is not None:
                contribs.append((sig, float(c)))
    contribs.sort(key=lambda t: -t[1])

    status = q["status"]
    days = q["days_in_status"]
    pct = q["energy_over_expected_pct"] or 0.0
    driver_label = q["driver_label"] or "drifting from its normal"
    is_cooling = asset.system == "cooling"
    chillers = sum(int(math.ceil(float(b.peak_load_tons or 0) / TONS_PER_RENTAL_CHILLER)) for b in served) if is_cooling else None
    cost = chillers * CHILLER_RENTAL_USD_PER_DAY if is_cooling else None
    cost_k = ("~$%dK a day" % int(round(cost / 1000.0))) if cost else None

    status_word = {"INSPECTION_DUE": "Inspection due", "WATCH": "Watch", "FAILED": "Failed", "HEALTHY": "Healthy"}[status]
    headline = "%s: %s, %d years old." % (status_word, asset.name[0].lower() + asset.name[1:] if asset.name else asset.id, asset.age_years or 0)

    top_names = ", ".join(_short_name(b) for b in served[:2])
    sentences = []
    if status == "HEALTHY":
        sentences.append("All signals are within this asset's own 30-day normal.")
    else:
        sentences.append("%s for %d day%s." % (driver_label[0].upper() + driver_label[1:], days, "" if days == 1 else "s"))
        if len(contribs) > 1 and contribs[1][1] >= 0.15 and score is not None:
            second = contribs[1][0]
            if second == "energy":
                sentences.append("Energy is also %+.1f%% over its weather-expected use." % pct)
            else:
                sentences.append("%s is also drifting (%d%% of the risk)." % (SIGNAL_NAME[second], int(round(contribs[1][1] * 100))))
    if pct and status != "HEALTHY":
        sentences.append("It is running %.1f%% over its normal energy use." % pct)
    if served:
        sentences.append("It serves %d building%s, including %s%s." % (
            len(served), "" if len(served) == 1 else "s", top_names,
            (" (%d research lab%s)" % (len(labs), "" if len(labs) == 1 else "s")) if labs and len(served) > 2 else ""))
    if is_cooling and cost and status != "HEALTHY":
        sentences.append("If it fails: %d temporary chiller%s, %s." % (chillers, "" if chillers == 1 else "s", cost_k))
    text = " ".join(sentences)

    bullets = []
    if contribs:
        bullets.append("Driving signal: %s (%d%% of risk)" % (driver_label, int(round(contribs[0][1] * 100))))
        for sig, c in contribs[1:3]:
            if sig != "energy" and c >= 0.05:
                bullets.append("%s (%d%%)" % (SIGNAL_NAME[sig], int(round(c * 100))))
    bullets.append("Energy %+.1f%% over weather-expected" % pct)
    bullets.append("Serves %d building%s · %d research lab%s" % (len(served), "" if len(served) == 1 else "s", len(labs), "" if len(labs) == 1 else "s"))
    if is_cooling and cost:
        bullets.append("Plan B if it fails: %d chillers · %s (estimate)" % (chillers, cost_k.replace(" a day", "/day")))

    work_order = None
    if status in ("WATCH", "INSPECTION_DUE", "FAILED"):
        impacts = sorted(i["impact"] for i in items)
        top_quartile = impacts[int(len(impacts) * 0.75)] if impacts else 0
        priority = 1 if status in ("INSPECTION_DUE", "FAILED") and q["impact"] >= top_quartile else 2
        description = "%s %d day%s%s. Inspect %s." % (
            driver_label[0].upper() + driver_label[1:], days, "" if days == 1 else "s",
            (" and %s rising" % SIGNAL_NAME[contribs[1][0]].lower()) if len(contribs) > 1 and contribs[1][0] not in ("energy",) and contribs[1][1] >= 0.15 else "",
            {"chw_main": "the segment supply line and isolation valves",
             "chiller": "compressor bearings, refrigerant charge and condenser approach",
             "ahu": "fan bearings, belts and coil ΔT",
             "unit_heater": "fan motor and heat output",
             "heat_exchanger": "tube bundle, strainers and approach temperature"}.get(asset.asset_type, "the unit"))
        work_order = _wo_json(_draft_work_order(asset, q, served, as_of, priority, description))

    return {
        "asset_id": asset.id,
        "as_of": as_of,
        "status": status,
        "headline": headline,
        "text": text,
        "bullets": bullets,
        "driver": q["driver"],
        "energy_over_expected_pct": pct,
        "buildings_served": [b.name for b in served],
        "cost_per_day_usd": cost,
        "generated_by": "template",
        "work_order": work_order,
    }
