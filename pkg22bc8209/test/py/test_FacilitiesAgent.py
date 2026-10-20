"""'What should N crews inspect this week?' answers for every crew: flagged assets first, then the
next assets on the same ranked queue with an explicit hedge and no work order drafted for them.
Entities stay navigable and segments are labelled "Loop S3".

The agent drafts work orders for flagged assets via Briefing.generate; anything drafted here is
removed again so the WorkOrder table ends as the three seed rows. One `ask` call is shared by the
crew tests (module fixture) to keep the run short across the platform's test runtimes.
"""
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:  # keeps editors quiet; no runtime cost
    c3 = {}

SEED_IDS = {"WO 26-071213", "WO 26-070118", "WO 26-070342"}
FLAGGED = ("INSPECTION_DUE", "FAILED", "WATCH")
AS_OF = "2026-06-09"


@pytest.fixture(scope="module", autouse=True)
def _restore_seed_table():
    yield
    for w in c3.WorkOrder.fetch({"include": "id", "limit": -1}).objs or []:
        if w.id not in SEED_IDS:
            w.remove()


@pytest.fixture(scope="module")
def queue():
    return list(c3.CampusSnapshot.queue(AS_OF) or [])


@pytest.fixture(scope="module")
def two_crews():
    return c3.FacilitiesAgent.ask("What should 2 crews inspect this week?", AS_OF)


def test_both_crews_get_an_assignment(two_crews):
    answer = two_crews["answer"].lower()
    assert "crew 1" in answer and "crew 2" in answer, two_crews["answer"]
    assets = [e for e in two_crews["entities"] if e["kind"] == "asset"]
    assert len(assets) >= 2 and len({e["id"] for e in assets}) == len(assets)
    for e in two_crews["entities"]:
        assert e["kind"] in ("asset", "building", "segment") and e["id"] and e["label"]
        if e["kind"] == "segment":
            assert e["label"].startswith("Loop ") and "Segment" not in e["label"], e


def test_fill_from_the_ranked_queue_is_hedged_and_drafts_nothing(two_crews, queue):
    flagged = [q for q in queue if q["status"] in FLAGGED]
    assert len(two_crews["proposed_actions"]) <= min(2, len(flagged)), "no work order for a healthy filler"
    for action in two_crews["proposed_actions"]:
        assert action["kind"] == "draft_work_order"
        assert action["work_order"]["status"] in ("PENDING_APPROVAL", "APPROVED")
    if len(flagged) >= 2:
        pytest.skip("two or more assets flagged on %s: nothing to fill" % AS_OF)
    answer = two_crews["answer"]
    assert "otherwise scheduled preventive maintenance" in answer
    filler = next(q for q in queue if q["asset_id"] not in {f["asset_id"] for f in flagged})
    assert filler["name"] in answer, "the filler is the next asset on the ranked queue"
    assert filler["asset_id"] in {e["id"] for e in two_crews["entities"] if e["kind"] == "asset"}
    if (filler["energy_over_expected_pct"] or 0) >= 1.0:
        assert ("%+.1f%%" % filler["energy_over_expected_pct"]) in answer


def test_outage_plan_question_still_routes_to_plan_b():
    r = c3.FacilitiesAgent.ask("What if S3 fails on a 95F day?", AS_OF)
    assert "temporary chillers" in r["answer"]
    seg = [e for e in r["entities"] if e["kind"] == "segment"]
    assert seg and seg[0]["id"] == "S3" and seg[0]["label"] == "Loop S3"
