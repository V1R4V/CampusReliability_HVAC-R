import re

DEFAULT_CREWS = 2
PLAN_B_TEMP_F = 95


def _fmt_k(usd):
    return "~$%dK/day" % int(round(usd / 1000.0)) if usd else None


def _entity(kind, ident, label):
    return {"kind": kind, "id": ident, "label": label}


def _inspect_answer(question, as_of, items):
    m = re.search(r"(\d+)\s+crews?", question or "", re.I)
    crews = int(m.group(1)) if m else DEFAULT_CREWS
    candidates = [q for q in items if q["status"] in ("INSPECTION_DUE", "FAILED", "WATCH")][:crews]
    if not candidates:
        return ("No asset is due or on watch as of %s. All systems are within their own normal ranges; "
                "the crews can stay on scheduled preventive maintenance." % as_of), [], []

    sentences = []
    entities = []
    actions = []
    for i, q in enumerate(candidates):
        briefing = c3.Briefing.generate(q["asset_id"], as_of)
        why = []
        if q["status"] == "INSPECTION_DUE":
            why.append("it is inspection due")
        elif q["status"] == "FAILED":
            why.append("it has failed")
        else:
            why.append("it is on watch with %s" % (q["driver_label"] or "signals drifting"))
        if q["buildings_served"]:
            why.append("serves %d building%s" % (q["buildings_served"], "" if q["buildings_served"] == 1 else "s"))
        if q["cost_per_day_usd"]:
            why.append("a failure would cost %s in rental chillers" % _fmt_k(q["cost_per_day_usd"]))
        sentences.append("Send crew %d to %s: %s." % (i + 1, q["name"], ", ".join(why)))
        entities.append(_entity("asset", q["asset_id"], q["name"]))
        if q["segment_id"] and not any(e["id"] == q["segment_id"] for e in entities):
            entities.append(_entity("segment", q["segment_id"], "Segment " + q["segment_id"]))
        if briefing.get("work_order"):
            actions.append({"kind": "draft_work_order", "work_order": briefing["work_order"]})
    return " ".join(sentences), entities, actions


def _plan_b_answer(question, as_of):
    m = re.search(r"\b(S[1-6])\b", question, re.I)
    seg = m.group(1).upper() if m else "S3"
    t = re.search(r"(\d{2,3})\s*°?\s*F", question, re.I)
    temp = float(t.group(1)) if t else PLAN_B_TEMP_F
    sim = c3.PlanB.simulate(seg, temp, False)
    tot = sim["totals"]
    first = [b["name"] for b in sim["buildings"][:3]]
    answer = ("If %s fails on a %d°F day, %d buildings lose cooling. Staging in priority order — %s first — "
              "needs %d temporary chillers at about %s (estimate), %s a week. The real June 2026 outage ran ~%d chillers "
              "at ~$%dK/day." % (seg, int(temp), tot["buildings"], ", ".join(first), tot["chillers"],
                                _fmt_k(tot["cost_per_day_usd"]), "$%dK" % int(round(tot["cost_per_week_usd"] / 1000.0)),
                                sim["reference"]["chillers"], int(round(sim["reference"]["usd_per_day"] / 1000.0))))
    entities = [_entity("segment", seg, "Segment " + seg)] + [_entity("building", b["building_id"], b["name"]) for b in sim["buildings"][:3]]
    return answer, entities, []


def _energy_answer(as_of, items):
    top = sorted([q for q in items if (q["energy_over_expected_pct"] or 0) > 0],
                 key=lambda q: -(q["energy_over_expected_pct"] or 0))[:3]
    if not top:
        return "No asset is running over its weather-expected energy as of %s." % as_of, [], []
    parts = ["%s (+%.1f%%)" % (q["name"], q["energy_over_expected_pct"]) for q in top]
    answer = ("The biggest energy waste as of %s: %s. These are compared with each asset's own weather-normalized "
              "baseline, so the heat is already accounted for." % (as_of, "; ".join(parts)))
    return answer, [_entity("asset", q["asset_id"], q["name"]) for q in top], []


def ask(cls, question, as_of):
    q_text = (question or "").strip()
    lower = q_text.lower()
    items = c3.CampusSnapshot.queue(as_of) or []

    if "fail" in lower and ("what if" in lower or "if " in lower) or "plan b" in lower:
        answer, entities, actions = _plan_b_answer(q_text, as_of)
    elif "energy" in lower or "wast" in lower:
        answer, entities, actions = _energy_answer(as_of, items)
    else:
        answer, entities, actions = _inspect_answer(q_text, as_of, items)

    return {
        "question": q_text,
        "as_of": as_of,
        "answer": answer,
        "entities": entities,
        "proposed_actions": actions,
        "generated_by": "template",
    }
