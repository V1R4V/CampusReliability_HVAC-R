"""Failure probabilities are cumulative: p_fail_7d <= p_fail_14d <= p_fail_30d for every method,
asset and day (docs/ML.md §8). Checks the stored RiskForecast table and the compare payload, plus
the RiskScore driver-label units.
"""
from typing import TYPE_CHECKING

import pytest

if TYPE_CHECKING:  # keeps editors quiet; no runtime cost
    c3 = {}

EPS = 1e-9
METHODS = {"heuristic", "classifier", "monte_carlo", "weibull"}


def _monotone(p7, p14, p30):
    p7, p14, p30 = (p7 or 0.0), (p14 or 0.0), (p30 or 0.0)
    return p7 <= p14 + EPS and p14 <= p30 + EPS


SAMPLE_DATES = ["2026-01-20", "2026-02-12", "2026-04-10", "2026-06-08", "2026-06-09", "2026-06-16", "2026-07-20", "2026-08-30"]


@pytest.mark.parametrize("date", SAMPLE_DATES)
def test_every_stored_row_is_monotone_across_horizons(date):
    # every asset and method on days around each planted failure plus quiet days; the whole table
    # (19,440 rows) is checked once by hand after forecast_all (docs/ML.md §8), not in 9 runtimes
    rows = c3.RiskForecast.fetch({"filter": "date == '%s'" % date,
                                  "include": "method, p_fail_7d, p_fail_14d, p_fail_30d", "limit": -1}).objs
    assert len(rows) > 0, "no forecast rows for %s: run RiskModel.forecast_all() first" % date
    bad = [(r.method, r.p_fail_7d, r.p_fail_14d, r.p_fail_30d) for r in rows
           if not _monotone(r.p_fail_7d, r.p_fail_14d, r.p_fail_30d)]
    assert bad == [], "%d non-monotone rows on %s, e.g. %s" % (len(bad), date, bad[:5])


def test_compare_is_monotone_per_method_and_in_the_consensus():
    c = c3.RiskForecast.compare("S3-PIPE", "2026-06-09")
    assert {m["method"] for m in c["methods"]} == METHODS
    for m in c["methods"]:
        assert _monotone(m["p_fail_7d"], m["p_fail_14d"], m["p_fail_30d"]), m
        assert 0.0 <= m["p_fail_7d"] and m["p_fail_30d"] <= 1.0
    cons = c["consensus"]
    assert cons["n_methods"] == 3
    assert _monotone(cons["p_fail_7d"], cons["p_fail_14d"], cons["p_fail_30d"])
    assert 0.0 <= cons["spread_14d"] <= 1.0
    assert c["next_failure"] is not None and c["next_failure"]["event_id"] == "F4"


def test_campus_ranking_is_consistent_with_compare():
    camp = c3.RiskForecast.campus("2026-06-09")
    assert camp["assets"], "no forecast rows for 2026-06-09"
    top = camp["assets"][0]
    assert top["asset_id"] == "S3-PIPE", "eight days before F4 the S3 main must rank first"
    assert abs(top["consensus_14d"] - c3.RiskForecast.compare("S3-PIPE", "2026-06-09")["consensus"]["p_fail_14d"]) < 1e-6
    consensus = [a["consensus_14d"] or 0.0 for a in camp["assets"]]
    assert consensus == sorted(consensus, reverse=True)


def test_unknown_asset_is_a_clear_error():
    with pytest.raises(Exception) as ei:
        c3.RiskForecast.compare("nope", "2026-06-09")
    assert "Unknown asset_id" in str(ei.value)


def test_flow_imbalance_labels_are_in_percentage_points():
    rows = c3.RiskScore.fetch({"filter": "driver == 'flow_imbalance' && exists(driver_label)",
                               "include": "driver_label", "limit": 200}).objs
    if not rows:
        pytest.skip("no flow-imbalance-driven day in this seed")
    for r in rows:
        label = r.driver_label
        assert "%" not in label, label                       # never a percent sign: the unit is points
        if any(ch.isdigit() for ch in label):                # a bare "flow imbalance" (no baseline yet) is fine
            assert label.endswith(" pts"), label
