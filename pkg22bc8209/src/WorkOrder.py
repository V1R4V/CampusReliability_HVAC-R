import datetime as _dt

PRIORITY_RANGE = (1, 3)      # 1 high … 3 low
EST_HOURS_RANGE = (1, 40)    # inspections are 4–8 h; anything above a work week is a typo
# The one rule for "which order represents an asset": approved beats pending beats dismissed.
STATUS_RANK = {"APPROVED": 0, "PENDING_APPROVAL": 1, "DISMISSED": 2}


def _today():
    return _dt.date.today().isoformat()


def _iso(value, name):
    """`value` as an ISO `YYYY-MM-DD` string (a trailing time part is dropped), or a clear error."""
    s = str(value).strip()
    if len(s) > 10 and s[10] in "T ":
        s = s[:10]
    try:
        return _dt.date.fromisoformat(s).isoformat()
    except ValueError:
        raise ValueError("%s must be an ISO date YYYY-MM-DD, got %r." % (name, value))


def _stamp(as_of):
    """Date to write on a state change: the replay date the UI is showing when given, else today."""
    if as_of is None or not str(as_of).strip():
        return _today()
    return _iso(as_of, "as_of")


def _q(s):
    return str(s).replace("\\", "\\\\").replace("'", "\\'")


def _fetch(flt, include="this, asset.id"):
    return list(c3.WorkOrder.fetch({"filter": flt, "include": include, "limit": -1}).objs or [])


def _by_id(wo_id):
    # fetch, not forId().get(): forId returns None for an unknown id in this runtime.
    rows = _fetch("id == '" + _q(wo_id) + "'") if wo_id else []
    return rows[0] if rows else None


def _current(this):
    """The stored row behind `this` — the UI passes a bare `{id}` — with a clear error for an unknown id."""
    wo_id = this.id if this is not None else None
    cur = _by_id(wo_id)
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


def _not_before_draft(cur, stamp):
    if cur.drafted_on and stamp < cur.drafted_on:
        raise ValueError("as_of %s is before work order %s was drafted (%s)." % (stamp, cur.id, cur.drafted_on))
    return stamp


# ---------------------------------------------------------------------------------------------
# ONE work-order truth per asset. Briefing, CampusSnapshot and BuildingDashboard all go through
# `_pick`, so the Overview, the Building page and the Asset page can never disagree about which
# order is "the" order for an asset on a given replay date.
# ---------------------------------------------------------------------------------------------

def _pick(orders, as_of):
    """Which order represents an asset as of `as_of`:
    - only orders drafted on or before `as_of` exist (a draft made while scrubbed to June 12 is
      invisible on June 9);
    - an APPROVED order is the live one — an older pending draft is never surfaced beside it;
    - else the newest PENDING_APPROVAL draft;
    - else the newest DISMISSED order (so a page can say "dismissed" rather than show nothing);
    - None when the asset has no order yet. Drafting a replacement is Briefing's job alone."""
    visible = [w for w in orders if w is not None and (w.drafted_on or "") <= as_of]
    if not visible:
        return None
    visible.sort(key=lambda w: (w.drafted_on or "", w.id or ""), reverse=True)   # newest first
    return min(visible, key=lambda w: STATUS_RANK.get(w.status, 9))               # first = newest among equals


def current(cls, asset_id, as_of):
    if asset_id is None or not str(asset_id).strip():
        raise ValueError("asset_id is required.")
    return _pick(_fetch("asset.id == '" + _q(str(asset_id).strip()) + "'"), _stamp(as_of))


def current_all(cls, as_of):
    as_of = _stamp(as_of)
    by_asset = {}
    for w in _fetch("drafted_on <= '" + as_of + "'"):
        if w.asset is not None:
            by_asset.setdefault(w.asset.id, []).append(w)
    picked = [_pick(ws, as_of) for ws in by_asset.values()]
    return [w for w in picked if w is not None]


# ---------------------------------------------------------------------------------------------
# State changes from the UI. `as_of` is the replay date shown on screen; null → today.
# ---------------------------------------------------------------------------------------------

def approve(this, approver, as_of):
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
        "approved_on": _not_before_draft(cur, _stamp(as_of)),
    }).merge()
    return _by_id(cur.id)


def dismiss(this, reason, as_of):
    if reason is None or not str(reason).strip():
        raise ValueError("A reason is required to dismiss a work order.")
    cur = _current(this)
    if cur.status == "DISMISSED":
        return cur  # idempotent: keep the original reason and date
    if cur.status == "APPROVED":
        raise ValueError("Work order %s is already approved (%s on %s); an approved order cannot be dismissed from here."
                         % (cur.id, cur.approved_by or "unknown approver", cur.approved_on or "unknown date"))
    c3.WorkOrder.make({
        "id": cur.id,
        "status": "DISMISSED",
        "dismiss_reason": str(reason).strip(),
        "dismissed_on": _not_before_draft(cur, _stamp(as_of)),
    }).merge()
    return _by_id(cur.id)


def edit(this, title, description, priority, crew, est_hours, as_of):
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
    changes["edited_on"] = _not_before_draft(cur, _stamp(as_of))
    c3.WorkOrder.make(changes).merge()
    return _by_id(cur.id)
