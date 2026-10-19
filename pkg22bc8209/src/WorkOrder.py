import datetime as _dt


def _today():
    return _dt.date.today().isoformat()


def _reload(wo_id):
    return c3.WorkOrder.forId(wo_id).get("this, asset.id")


def approve(this, approver):
    c3.WorkOrder.make({
        "id": this.id,
        "status": "APPROVED",
        "approved_by": approver or "Facilities manager",
        "approved_on": _today(),
    }).merge()
    return _reload(this.id)


def dismiss(this, reason):
    if not reason or not str(reason).strip():
        raise ValueError("A reason is required to dismiss a work order.")
    c3.WorkOrder.make({
        "id": this.id,
        "status": "DISMISSED",
        "dismiss_reason": str(reason).strip(),
    }).merge()
    return _reload(this.id)
