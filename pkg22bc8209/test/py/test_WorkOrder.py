"""One work-order truth per asset, replay-date stamping, and the UI member actions.

Rule (`WorkOrder.current` / `current_all`, used by Briefing, CampusSnapshot and BuildingDashboard):
only orders with `drafted_on <= as_of` exist; APPROVED beats PENDING_APPROVAL beats DISMISSED;
newest among equals. `Briefing.generate` reuses the live order and drafts only when there is none
(or only a dismissed one). `approve` / `dismiss` / `edit` stamp the replay date they are given.

Every order this file creates or lets the agent draft is removed again, so the WorkOrder table
ends as the three seed rows (WO 26-071213 pending, WO 26-070118 approved, WO 26-070342 dismissed).
"""
from typing import TYPE_CHECKING
import datetime as dt

import pytest

if TYPE_CHECKING:  # keeps editors quiet; no runtime cost
    c3 = {}

SEED_IDS = {"WO 26-071213", "WO 26-070118", "WO 26-070342"}
SEED_PENDING = "WO 26-071213"            # S3-PIPE, drafted 2026-06-09
RULE_ASSET = "S1-PIPE"                   # segment mains with no seed work order
STAMP_ASSET = "S2-PIPE"
TEST_PREFIX = "WO 26-099"                # far above the agent's series (WO 26-0712xx)


def _all():
    return list(c3.WorkOrder.fetch({"include": "this, asset.id", "limit": -1}).objs or [])


def _one(wo_id):
    rows = c3.WorkOrder.fetch({"filter": "id == '%s'" % wo_id, "include": "this, asset.id", "limit": 1}).objs
    return rows[0] if rows else None


def _remove(wo_id):
    w = _one(wo_id)
    if w is not None:
        w.remove()


def _make(wo_id, asset_id, status, drafted_on, **extra):
    row = {"id": wo_id, "asset": {"id": asset_id}, "building_ids": [], "title": "test " + wo_id,
           "description": "test fixture", "priority": 2, "crew": "Utilities – Piping", "est_hours": 4,
           "status": status, "drafted_by": "agent", "drafted_on": drafted_on}
    row.update(extra)
    c3.WorkOrder.make(row).create()
    return wo_id


def _queue_item(as_of, asset_id):
    return next(q for q in c3.CampusSnapshot.compute(as_of)["queue"] if q["asset_id"] == asset_id)


@pytest.fixture(scope="module", autouse=True)
def _restore_seed_table():
    """Safety net: whatever a test created or the agent drafted is removed at the end."""
    yield
    for w in _all():
        if w.id not in SEED_IDS:
            w.remove()


@pytest.fixture(scope="module")
def pair():
    """A pending draft (Feb 1) superseded by an approved order (Feb 3) on the same asset."""
    pending = _make(TEST_PREFIX + "001", RULE_ASSET, "PENDING_APPROVAL", "2026-02-01")
    approved = _make(TEST_PREFIX + "002", RULE_ASSET, "APPROVED", "2026-02-03",
                     approved_by="QA", approved_on="2026-02-03")
    yield pending, approved
    _remove(pending)
    _remove(approved)


@pytest.fixture
def pending_draft():
    wid = _make(TEST_PREFIX + "003", STAMP_ASSET, "PENDING_APPROVAL", "2026-02-01")
    yield _one(wid)
    _remove(wid)


# ------------------------------------------------------------------------------------------ rule

def test_approved_supersedes_an_older_pending_draft(pair):
    pending, approved = pair
    cur = c3.WorkOrder.current(RULE_ASSET, "2026-02-10")
    assert cur.id == approved and cur.status == "APPROVED"
    # Overview and Building page tell the same story
    assert _queue_item("2026-02-10", RULE_ASSET)["work_order_status"] == "APPROVED"
    served = c3.Building.fetch({"filter": "segment.id == 'S1'", "include": "id", "limit": 1}).objs
    if served:
        dash = c3.BuildingDashboard.compute(served[0].id, "2026-02-10")
        mine = [w for w in dash["work_orders"] if w["asset_id"] == RULE_ASSET]
        assert [w["wo_id"] for w in mine] == [approved], "the pending draft must not be listed beside its approval"


def test_orders_drafted_after_as_of_do_not_exist_yet(pair):
    pending, approved = pair
    assert c3.WorkOrder.current(RULE_ASSET, "2026-01-31") is None
    assert c3.WorkOrder.current(RULE_ASSET, "2026-02-02").id == pending      # approval not drafted yet
    assert _queue_item("2026-01-31", RULE_ASSET)["work_order_status"] is None
    assert _queue_item("2026-02-02", RULE_ASSET)["work_order_status"] == "PENDING_APPROVAL"
    assert not [w for w in (c3.WorkOrder.current_all("2026-01-31") or []) if w.asset.id == RULE_ASSET]


def test_briefing_reuses_the_live_order_and_agrees_with_the_overview():
    b = c3.Briefing.generate("S3-PIPE", "2026-06-09")
    assert b["work_order"]["wo_id"] == SEED_PENDING
    assert b["work_order"]["status"] == "PENDING_APPROVAL"
    top = c3.CampusSnapshot.compute("2026-06-09")["queue"][0]
    assert top["asset_id"] == "S3-PIPE"
    assert top["work_order_status"] == b["work_order"]["status"]
    text = " ".join(b["bullets"])
    assert "Plan B" not in text
    if b["cost_per_day_usd"]:
        assert "Outage plan if it fails" in text


def test_briefing_never_shows_a_draft_from_the_future():
    wo = c3.Briefing.generate("S3-PIPE", "2026-06-08")["work_order"]
    assert wo is None or wo["wo_id"] != SEED_PENDING, "the June 9 draft does not exist on June 8"
    if wo is not None:
        assert wo["drafted_on"] == "2026-06-08" and wo["status"] == "PENDING_APPROVAL"
        # on June 9 the newest pending draft — the seed one — is still the one shown
        assert c3.Briefing.generate("S3-PIPE", "2026-06-09")["work_order"]["wo_id"] == SEED_PENDING
        _remove(wo["wo_id"])


# -------------------------------------------------------------------------------- replay stamps

def test_edit_and_approve_stamp_the_replay_date_and_approve_is_idempotent(pending_draft):
    edited = pending_draft.edit(None, None, None, None, 7, "2026-02-05")
    assert edited.est_hours == 7 and edited.edited_on == "2026-02-05"
    assert edited.title == pending_draft.title                      # untouched fields stay
    approved = edited.approve("QA", "2026-02-06")
    assert approved.status == "APPROVED" and approved.approved_by == "QA" and approved.approved_on == "2026-02-06"
    again = approved.approve("Someone else", "2026-02-20")
    assert again.approved_by == "QA" and again.approved_on == "2026-02-06", "a second click rewrites nothing"
    with pytest.raises(Exception) as ei:
        again.edit("new title", None, None, None, None, "2026-02-21")
    assert "only PENDING_APPROVAL" in str(ei.value)


def test_dismiss_stamps_the_replay_date_and_blocks_approval(pending_draft):
    d = pending_draft.dismiss("duplicate of a planned PM", "2026-02-07")
    assert d.status == "DISMISSED" and d.dismissed_on == "2026-02-07"
    assert d.dismiss_reason == "duplicate of a planned PM"
    with pytest.raises(Exception) as ei:
        d.approve("QA", "2026-02-08")
    assert "dismissed" in str(ei.value).lower()
    # a dismissed-only asset still reports "dismissed" rather than nothing
    assert c3.WorkOrder.current(STAMP_ASSET, "2026-02-10").id == d.id
    assert _queue_item("2026-02-10", STAMP_ASSET)["work_order_status"] == "DISMISSED"


def test_missing_as_of_means_today(pending_draft):
    a = pending_draft.approve(None, None)
    assert a.approved_by == "Facilities manager"
    assert a.approved_on == dt.date.today().isoformat()


def test_stamp_before_the_draft_date_is_rejected(pending_draft):
    with pytest.raises(Exception) as ei:
        pending_draft.approve("QA", "2026-01-15")
    assert "before" in str(ei.value)
    with pytest.raises(Exception):
        pending_draft.edit(None, None, None, None, 5, "not-a-date")


def test_edit_validates_its_fields(pending_draft):
    with pytest.raises(Exception) as ei:
        pending_draft.edit(None, None, 7, None, None, None)
    assert "priority" in str(ei.value)
    with pytest.raises(Exception) as ei:
        pending_draft.edit(None, None, None, None, None, None)
    assert "Nothing to edit" in str(ei.value)


def test_unknown_building_is_a_clear_error():
    with pytest.raises(Exception) as ei:
        c3.BuildingDashboard.compute("nope", "2026-06-09")
    assert "Unknown building_id" in str(ei.value)


def test_unknown_work_order_is_a_clear_error():
    with pytest.raises(Exception) as ei:
        c3.WorkOrder.make({"id": "WO 26-000000"}).approve("QA", None)
    assert "Unknown work order id" in str(ei.value)
