import datetime as _dt

PRIORITY_RANGE = (1, 3)      # 1 high … 3 low
EST_HOURS_RANGE = (1, 40)    # inspections are 4–8 h; anything above a work week is a typo


def _today():
    return _dt.date.today().isoformat()


def _reload(wo_id):
    return c3.WorkOrder.forId(wo_id).get("this, asset.id")


def _current(this):
    """The stored row behind `this` — the UI passes a bare `{id}` — with a clear error for an unknown id."""
    wo_id = this.id if this is not None else None
    cur = c3.WorkOrder.forId(wo_id).get("this, asset.id") if wo_id else None
    if cur is None:
        raise ValueError("Unknown work order id %r. Ids look like 'WO 26-071213'." % (wo_id,))
    return cur


def _text(value, name):
    s = str(value).strip()
    if not s:
        raise ValueError("%s cannot be empty." % name)
    return s


def _int_between(value, lo, hi, name):
    if isinstance(value, bool):
        raise ValueError("%s must be a whole number between %d and %d, got %r." % (name, lo, hi, value))
    try:
        f = float(value)
        n = int(f)
        if n != f:
            raise ValueError
    except (TypeError, ValueError):
        raise ValueError("%s must be a whole number between %d and %d, got %r." % (name, lo, hi, value))
    if n < lo or n > hi:
        raise ValueError("%s must be between %d and %d, got %d." % (name, lo, hi, n))
    return n


def approve(this, approver):
    cur = _current(this)
    if cur.status == "DISMISSED":
        raise ValueError("Work order %s was dismissed (%s); a dismissed order cannot be approved. Ask the agent for a new draft instead."
                         % (cur.id, cur.dismiss_reason or "no reason recorded"))
    if cur.status == "APPROVED":
        return cur  # idempotent: a second click must not rewrite approved_by / approved_on
    name = str(approver).strip() if approver is not None and str(approver).strip() else "Facilities manager"
    c3.WorkOrder.make({
        "id": cur.id,
        "status": "APPROVED",
        "approved_by": name,
        "approved_on": _today(),
    }).merge()
    return _reload(cur.id)


def dismiss(this, reason):
    if reason is None or not str(reason).strip():
        raise ValueError("A reason is required to dismiss a work order.")
    cur = _current(this)
    c3.WorkOrder.make({
        "id": cur.id,
        "status": "DISMISSED",
        "dismiss_reason": str(reason).strip(),
    }).merge()
    return _reload(cur.id)


def edit(this, title, description, priority, crew, est_hours):
    cur = _current(this)
    if cur.status != "PENDING_APPROVAL":
        raise ValueError("Work order %s is %s; only PENDING_APPROVAL work orders can be edited." % (cur.id, cur.status))
    changes = {}
    if title is not None:
        changes["title"] = _text(title, "title")
    if description is not None:
        changes["description"] = _text(description, "description")
    if crew is not None:
        changes["crew"] = _text(crew, "crew")
    if priority is not None:
        changes["priority"] = _int_between(priority, PRIORITY_RANGE[0], PRIORITY_RANGE[1], "priority")
    if est_hours is not None:
        changes["est_hours"] = _int_between(est_hours, EST_HOURS_RANGE[0], EST_HOURS_RANGE[1], "est_hours")
    if not changes:
        raise ValueError("Nothing to edit on %s: pass at least one of title, description, priority, crew, est_hours." % cur.id)
    changes["id"] = cur.id
    changes["edited_on"] = _today()
    c3.WorkOrder.make(changes).merge()
    return _reload(cur.id)
