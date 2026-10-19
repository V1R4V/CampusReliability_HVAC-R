"""PlanB.simulate — the contract formula (docs/CONTRACT.md §4 `simulatePlanB`).

load_factor = clamp((temp_f − 55) / 40, 0.3, 1.0)
chillers_needed = ceil(peak_load_tons × load_factor / 400)
cost_per_day_usd = chillers_needed × 3704
priority_only stages only patient_care + research_lab buildings; the rest are `staged = false`
and excluded from `totals`. Order: criticality weight desc, then peak_load_tons desc.
"""
from typing import TYPE_CHECKING
import math

import pytest

if TYPE_CHECKING:  # keeps editors quiet; no runtime cost
    c3 = {}

CRITICALITY_WEIGHT = {"patient_care": 4, "research_lab": 3, "instruction": 2, "office": 1}
TONS_PER_CHILLER = 400
USD_PER_CHILLER_DAY = 3704
PRIORITY = ("patient_care", "research_lab")
CONTRACT_KEYS = {"segment_id", "plant_id", "temp_f", "priority_only", "load_factor", "buildings", "totals", "reference"}
ROW_KEYS = {"order", "building_id", "name", "criticality", "peak_load_tons", "chillers_needed", "cost_per_day_usd", "staged"}


def _expected_factor(temp_f):
    return max(0.3, min(1.0, (temp_f - 55.0) / 40.0))


@pytest.fixture(scope="module")
def s3_95():
    return c3.PlanB.simulate("S3", 95, False)


def test_contract_shape(s3_95):
    assert CONTRACT_KEYS <= set(s3_95.keys())
    assert s3_95["segment_id"] == "S3"
    assert s3_95["plant_id"] == "CHARTER"
    assert s3_95["buildings"], "S3 serves buildings"
    for row in s3_95["buildings"]:
        assert ROW_KEYS <= set(row.keys())
    assert set(s3_95["totals"].keys()) == {"buildings", "chillers", "cost_per_day_usd", "cost_per_week_usd"}
    ref = s3_95["reference"]
    assert ref["total_usd"] == 15800000 and ref["rental_usd"] == 10000000 and ref["chillers"] == 30
    assert ref["start_date"] == "2026-06-17" and ref["reopen_date"] == "2026-08-10"


@pytest.mark.parametrize("temp_f, expected", [
    (40, 0.3),     # below 55 °F clamps at the 0.3 floor
    (55, 0.3),     # (55 − 55) / 40 = 0 → floor
    (67, 0.3),     # 0.3 exactly at the floor boundary
    (75, 0.5),
    (95, 1.0),     # (95 − 55) / 40 = 1.0 → ceiling
    (110, 1.0),    # above 95 °F clamps at 1.0
])
def test_load_factor_clamp(temp_f, expected):
    sim = c3.PlanB.simulate("S3", temp_f, False)
    assert math.isclose(sim["load_factor"], expected, abs_tol=1e-3)
    assert sim["temp_f"] == float(temp_f)


@pytest.mark.parametrize("temp_f", [55, 75, 85, 95])
def test_chillers_formula_per_building(temp_f):
    sim = c3.PlanB.simulate("S3", temp_f, False)
    factor = _expected_factor(temp_f)
    for row in sim["buildings"]:
        tons = row["peak_load_tons"]
        want = int(math.ceil(tons * factor / TONS_PER_CHILLER)) if tons > 0 else 0
        assert row["chillers_needed"] == want, row
        assert row["cost_per_day_usd"] == want * USD_PER_CHILLER_DAY, row
        assert row["staged"] is True


def test_s3_at_95_matches_fixture(s3_95):
    # contract/fixtures/plan_b_S3.json: 9 buildings, 18 chillers, $66,672/day
    assert s3_95["totals"]["buildings"] == 9
    assert s3_95["totals"]["chillers"] == 18
    assert s3_95["totals"]["cost_per_day_usd"] == 18 * USD_PER_CHILLER_DAY == 66672
    assert s3_95["totals"]["cost_per_week_usd"] == 66672 * 7


def test_totals_sum_staged_rows(s3_95):
    staged = [r for r in s3_95["buildings"] if r["staged"]]
    assert s3_95["totals"]["buildings"] == len(staged)
    assert s3_95["totals"]["chillers"] == sum(r["chillers_needed"] for r in staged)
    assert s3_95["totals"]["cost_per_day_usd"] == sum(r["cost_per_day_usd"] for r in staged)
    assert s3_95["totals"]["cost_per_week_usd"] == s3_95["totals"]["cost_per_day_usd"] * 7


def test_order_is_criticality_then_load(s3_95):
    rows = s3_95["buildings"]
    assert [r["order"] for r in rows] == list(range(1, len(rows) + 1))
    keys = [(-CRITICALITY_WEIGHT[r["criticality"]], -r["peak_load_tons"]) for r in rows]
    assert keys == sorted(keys)


def test_priority_only_staging():
    full = c3.PlanB.simulate("S3", 95, False)
    prio = c3.PlanB.simulate("S3", 95, True)
    assert prio["priority_only"] is True
    # same rows, same order, same per-building numbers — only `staged` and the totals change
    assert [r["building_id"] for r in prio["buildings"]] == [r["building_id"] for r in full["buildings"]]
    for row in prio["buildings"]:
        assert row["staged"] == (row["criticality"] in PRIORITY), row
    staged = [r for r in prio["buildings"] if r["staged"]]
    assert staged and len(staged) < len(prio["buildings"])
    assert prio["totals"]["buildings"] == len(staged)
    assert prio["totals"]["chillers"] == sum(r["chillers_needed"] for r in staged)
    assert prio["totals"]["chillers"] < full["totals"]["chillers"]
    # S3 has three research labs (1400 + 620 + 480 tons) → 4 + 2 + 2 = 8 chillers at 95 °F
    assert prio["totals"]["chillers"] == 8
    assert prio["totals"]["cost_per_day_usd"] == 8 * USD_PER_CHILLER_DAY


def test_every_segment_simulates():
    for seg in ("S1", "S2", "S3", "S4", "S5", "S6"):
        sim = c3.PlanB.simulate(seg, 85, False)
        assert sim["segment_id"] == seg
        assert sim["plant_id"] in ("CHARTER", "WALNUT", "WCCF")
        assert sim["totals"]["chillers"] >= 1
