import re

DEFAULT_CREWS = 2
PLAN_B_TEMP_F = 95


def _fmt_k(usd):
    return "~$%dK/day" % int(round(usd / 1000.0)) if usd else None


def _entity(kind, ident, label):
    return {"kind": kind, "id": ident, "label": label}


FLAGGED = ("INSPECTION_DUE", "FAILED", "WATCH")
MAX_CREWS = 10
STATUS_WORD = {"HEALTHY": "healthy", "WATCH": "on watch", "INSPECTION_DUE": "inspection due", "FAILED": "failed"}


def _loop(segment_id):
    return _entity("segment", segment_id, "Loop " + segment_id)


def _plural(n, word):
    return "%d %s%s" % (n, word, "" if n == 1 else "s")


def _why_flagged(q):
    why = []
    if q["status"] == "INSPECTION_DUE":
        why.append("it is inspection due")
    elif q["status"] == "FAILED":
        why.append("it has failed")
    else:
        why.append("it is on watch with %s" % (q["driver_label"] or "signals drifting"))
    if q["buildings_served"]:
        why.append("serves " + _plural(q["buildings_served"], "building"))
    if q["cost_per_day_usd"]:
        why.append("a failure would cost %s in rental chillers" % _fmt_k(q["cost_per_day_usd"]))
    return ", ".join(why)


def _best_use(q):
    """A crew with nothing flagged gets the next asset on the ranked queue, described only with
    that queue row's own numbers (status and days in it, energy over expected, risk, buildings)."""
    facts = []
    pct = q["energy_over_expected_pct"] or 0.0
    if pct >= 1.0:
        facts.append("energy %+.1f%% over its weather-expected use" % pct)
    elif q["driver_label"]:
        facts.append(q["driver_label"])
    facts.append("risk %.1f, below the watch line" % (q["risk"] or 0.0))
    if q["buildings_served"]:
        facts.append("serves " + _plural(q["buildings_served"], "building"))
    days = int(q["days_in_status"] or 0)
    return "%s (%s for %s; %s)" % (q["name"], STATUS_WORD.get(q["status"], (q["status"] or "").lower()),
                                   _plural(days, "day"), ", ".join(facts))


def _inspect_answer(question, as_of, items):
    m = re.search(r"(\d+)\s+crews?", question or "", re.I)
    crews = int(m.group(1)) if m else DEFAULT_CREWS
    crews = max(1, min(crews, MAX_CREWS))
    flagged = [q for q in items if q["status"] in FLAGGED]
    candidates = flagged[:crews]

    sentences = []
    entities = []
    actions = []
    if not flagged:
        sentences.append("No asset is due or on watch as of %s; all systems are within their own normal ranges." % as_of)
    for i, q in enumerate(candidates):
        briefing = c3.Briefing.generate(q["asset_id"], as_of)
        sentences.append("Send crew %d to %s: %s." % (i + 1, q["name"], _why_flagged(q)))
        entities.append(_entity("asset", q["asset_id"], q["name"]))
        if q["segment_id"] and not any(e["id"] == q["segment_id"] for e in entities):
            entities.append(_loop(q["segment_id"]))
        if briefing.get("work_order"):
            actions.append({"kind": "draft_work_order", "work_order": briefing["work_order"]})

    # Fewer flagged assets than crews: every crew still gets an answer, filled from the top of
    # the same ranked queue with an explicit hedge. Nothing is drafted for these — a healthy
    # asset gets a look, not a work order.
    taken = {q["asset_id"] for q in candidates}
    fillers = [q for q in items if q["asset_id"] not in taken][:max(0, crews - len(candidates))]
    for k, q in enumerate(fillers):
        lead = "nothing else is due or on watch" if candidates else "nothing is due or on watch"
        sentences.append("Crew %d: %s; best use is %s, which ranks next on today's queue, otherwise scheduled preventive maintenance."
                         % (len(candidates) + k + 1, lead, _best_use(q)))
        entities.append(_entity("asset", q["asset_id"], q["name"]))

    if len(flagged) > crews:
        rest = flagged[crews:]
        sentences.append("Also flagged beyond these crews: %s%s." % (
            ", ".join(q["name"] for q in rest[:3]), " and %d more" % (len(rest) - 3) if len(rest) > 3 else ""))
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
    entities = [_loop(seg)] + [_entity("building", b["building_id"], b["name"]) for b in sim["buildings"][:3]]
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
