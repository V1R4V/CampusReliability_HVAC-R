#!/usr/bin/env python3
"""
Interim seed generator (pure stdlib, deterministic) for "Before It Breaks".

Writes, into pkg22bc8209/data/:
  WeatherDay/weather_2026.json          REAL  NOAA GHCN-Daily USW00014837 (tavg derived)
  SensorReading/sensors_2026-MM.json    SYNTHETIC, physically shaped per docs/DATA.md §4,
                                        energy driven by the real weather, failures F1-F5 and
                                        decoys D1/D2/D4 planted from data/FailureEvent/events.json.
                                        D3 (heat wave) needs no planting: real weather does it.

Calibration references (no raw data copied — see docs/DATA.md §1 and the links in the brief):
  - ISO 10816 vibration bands (healthy 1.2-2.5 mm/s, >4.5 concerning, >7.1 unacceptable)
  - ASHRAE Guideline 14 degree-day energy baselines (CDD base 55 F, HDD base 60 F)
  - LBNL/PNNL simulated chiller plant FDD dataset: fault taxonomy used to pick which signals
    move for each failure mode (leak -> pressure+flow imbalance; bearing -> vibration+energy;
    fouling -> delta-T + energy). The 1.1 GB dataset itself is not downloaded.

Usage:  python3 tools/datagen/interim_generator.py [--noaa-file /tmp/noaa.json]
"""
import argparse
import datetime as dt
import json
import math
import os
import random
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "pkg22bc8209", "data")
STATION = "USW00014837"
NOAA_URL = ("https://www.ncei.noaa.gov/access/services/data/v1?dataset=daily-summaries&stations=%s"
            "&startDate=2026-01-01&endDate=2026-08-31&dataTypes=TMAX,TMIN,TAVG&units=standard&format=json" % STATION)
START, END = dt.date(2026, 1, 1), dt.date(2026, 8, 31)
SEED = 20260617

# Which sensors each asset type reports (docs/DATA.md §4).
SENSORS = {
    "chw_main": ("pressure", "flow_imbalance", "delta_t", "energy"),
    "chiller": ("delta_t", "vibration", "energy"),
    "chw_pump": ("pressure", "vibration", "energy"),
    "condensate_pump": ("pressure", "vibration", "energy"),
    "isolation_valve": ("pressure", "flow_imbalance", "energy"),
    "steam_line": ("pressure", "flow_imbalance", "energy"),
    "heat_exchanger": ("pressure", "flow_imbalance", "delta_t", "energy"),
    "steam_trap": ("pressure", "delta_t", "energy"),
    "unit_heater": ("delta_t", "vibration", "energy"),
    "ahu": ("delta_t", "vibration", "energy"),
}
COL = {"pressure": "pressure_psi", "flow_imbalance": "flow_imbalance_pct", "delta_t": "delta_t_f",
       "vibration": "vibration_mm_s", "energy": "energy_kwh"}
NOISE = {"pressure": 0.8, "flow_imbalance": 0.3, "delta_t": 0.35, "vibration": 0.15}

# Failure modes: signal -> deviation reached on the failure day (docs/DATA.md §4 ranges).
# energy is a fraction over weather-expected.
MODES = {
    "VIL-UH-2": {"vibration": +4.2, "delta_t": -4.0, "energy": 0.09},     # F1 fan bearing seizing
    "STE-HX-1": {"pressure": -7.0, "flow_imbalance": +4.0, "delta_t": -3.5, "energy": 0.08},  # F2 leak + fouling
    "WIMR-AHU-3": {"vibration": +4.8, "energy": 0.09},                   # F3 bearing
    "S3-PIPE": {"pressure": -8.0, "flow_imbalance": +4.5, "delta_t": -1.2, "energy": 0.06},  # F4 main leak
    "WAL-CHL-2": {"vibration": +4.0, "delta_t": -3.0, "energy": 0.10},   # F5 old chiller
}
RAMP_EXP = 1.9  # convex ramp: faster near failure


def load_json(path):
    with open(path) as f:
        return json.load(f)


def fetch_noaa(cache):
    if cache and os.path.exists(cache):
        return load_json(cache)
    with urllib.request.urlopen(NOAA_URL, timeout=30) as r:
        rows = json.loads(r.read().decode())
    if cache:
        with open(cache, "w") as f:
            json.dump(rows, f)
    return rows


def weather_label(tmax, tmin):
    if tmax >= 90:
        return "heat"
    if tmax >= 85:
        return "hot"
    if tmin <= 0:
        return "bitter cold"
    if tmin <= 20:
        return "cold"
    if tmax <= 50:
        return "cool"
    return "mild"


def build_weather(noaa):
    out = {}
    for r in noaa:
        tmax, tmin = float(r["TMAX"]), float(r["TMIN"])
        tavg = float(r["TAVG"]) if r.get("TAVG") not in (None, "") else round((tmax + tmin) / 2.0, 1)
        out[r["DATE"]] = {
            "id": r["DATE"], "date": r["DATE"], "tmax_f": tmax, "tmin_f": tmin, "tavg_f": tavg,
            "label": weather_label(tmax, tmin),
            "source": "NOAA GHCN-Daily %s Madison Dane Co. Rgnl Airport (real); tavg_f = (tmax+tmin)/2 derived" % STATION,
        }
    return out


def daterange():
    d = START
    while d <= END:
        yield d
        d += dt.timedelta(days=1)


def expected_energy(asset, load, tavg, weekend):
    """Weather-driven daily kWh (ASHRAE degree-day form). `load` = tons (cooling) or gsf (others)."""
    cdd = max(0.0, tavg - 55.0)
    hdd = max(0.0, 60.0 - tavg)
    t = asset["asset_type"]
    if t == "chw_main":                      # pumping energy for the segment
        return load * (1.0 + 0.09 * cdd)
    if t == "chiller":                       # ~0.65 kW/ton; small year-round process load,
        frac = max(0.10, min(1.0, cdd / 28.0))   # otherwise driven by CDD (DATA.md §4)
        return load * 0.65 * 24.0 * frac
    if t == "heat_exchanger":
        return load * (0.02 + 0.0028 * hdd)
    if t == "unit_heater":
        return 180.0 + 26.0 * hdd
    if t == "ahu":
        e = load * 0.012 * (1.0 + 0.012 * cdd + 0.006 * hdd)
        return e * (0.9 if weekend else 1.0)
    return load * (0.02 + 0.002 * hdd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--noaa-file", default=os.path.join(ROOT, "tools", "datagen", "raw", "noaa_2026.json"))
    args = ap.parse_args()
    os.makedirs(os.path.dirname(args.noaa_file), exist_ok=True)
    rng = random.Random(SEED)

    assets = load_json(os.path.join(DATA, "Asset", "assets.json"))
    buildings = {b["id"]: b for b in load_json(os.path.join(DATA, "Building", "buildings.json"))}
    segments = load_json(os.path.join(DATA, "LoopSegment", "segments.json"))
    events = load_json(os.path.join(DATA, "FailureEvent", "events.json"))
    weather = build_weather(fetch_noaa(args.noaa_file))

    seg_tons = {}
    for b in buildings.values():
        seg_tons[b["segment"]] = seg_tons.get(b["segment"], 0.0) + float(b.get("peak_load_tons") or 0)
    plant_of = {s["id"]: s["plant"] for s in segments}
    plant_tons = {}
    for sid, tons in seg_tons.items():
        plant_tons[plant_of[sid]] = plant_tons.get(plant_of[sid], 0.0) + tons

    failures = {e["asset"]: e for e in events if e["kind"] == "failure"}
    decoys = {e["id"]: e for e in events if e["kind"] == "decoy"}

    rows_by_month = {}
    for a in assets:
        aid, t = a["id"], a["asset_type"]
        sensors = SENSORS[t]
        # fixed healthy baselines per asset
        base = {
            "pressure": rng.uniform(62.0, 88.0),
            "flow_imbalance": rng.uniform(0.3, 0.8),
            "delta_t": rng.uniform(10.5, 13.5) if a["system"] == "cooling" else (rng.uniform(22.0, 36.0) if a["system"] == "heating" else rng.uniform(14.0, 18.0)),
            "vibration": rng.uniform(1.3, 2.3),
        }
        if t == "chw_main":
            load = seg_tons.get(a["segment"], 800.0)
        elif t == "chiller":
            load = plant_tons.get(plant_of[a["segment"]], 3000.0) * rng.uniform(0.3, 0.5)
        else:
            load = float(buildings.get(a.get("building"), {}).get("gsf") or 150000)
        # D4: slow, normal aging drift on an old chiller all year (never a step)
        aging = (aid == decoys.get("D4", {}).get("asset"))

        f = failures.get(aid)
        onset = dt.date.fromisoformat(f["onset_date"]) if f else None
        fail = dt.date.fromisoformat(f["date"]) if f else None
        fail_end = dt.date.fromisoformat(f["end_date"]) if f else None
        mode = MODES.get(aid, {})

        for d in daterange():
            iso = d.isoformat()
            w = weather[iso]
            frac_year = (d - START).days / 242.0
            row = {"id": "%s_%s" % (aid, iso), "asset": aid, "date": iso}

            # D2: 5-day full sensor dropout
            d2 = decoys.get("D2")
            if d2 and d2["asset"] == aid and d2["onset_date"] <= iso <= d2["date"]:
                rows_by_month.setdefault(iso[:7], []).append(row)
                continue

            in_failed = bool(f) and fail <= d <= fail_end
            ramp = 0.0
            if f and onset <= d < fail:
                ramp = ((d - onset).days / float((fail - onset).days)) ** RAMP_EXP

            exp_e = expected_energy(a, load, w["tavg_f"], d.weekday() >= 5)
            for s in sensors:
                if s == "energy":
                    v = exp_e * (1.0 + rng.gauss(0.0, 0.03))
                    v *= 1.0 + ramp * mode.get("energy", 0.0)
                    if aging:
                        v *= 1.0 + 0.03 * frac_year
                    if in_failed:
                        v *= 0.15  # isolated / shut down
                else:
                    v = base[s] + rng.gauss(0.0, NOISE[s])
                    if s == "delta_t" and a["system"] == "cooling":
                        v -= 0.6 * max(0.0, 1.0 - max(0.0, w["tavg_f"] - 55.0) / 20.0)  # dips at low load
                    v += ramp * mode.get(s, 0.0)
                    if aging and s == "vibration":
                        v += 0.6 * frac_year
                    if in_failed:
                        v = {"pressure": base["pressure"] - 25.0, "flow_imbalance": base["flow_imbalance"] + 6.0,
                             "delta_t": base["delta_t"] * 0.7, "vibration": base["vibration"] * 0.6}[s]
                        v += rng.gauss(0.0, NOISE[s])
                    if in_failed and s == "vibration" and (fail_end - d).days > 0:
                        v = base["vibration"] * 0.4 + rng.gauss(0, 0.05)
                # D1: one-day vibration spike on a healthy chiller
                d1 = decoys.get("D1")
                if d1 and d1["asset"] == aid and iso == d1["date"] and s == "vibration":
                    v = 6.4
                if s != "energy" and rng.random() < 0.02:
                    continue  # ~2% random missing readings (key omitted = null)
                lo = 0.0
                row[COL[s]] = round(max(lo, v), 2 if s != "energy" else 1)
            rows_by_month.setdefault(iso[:7], []).append(row)

    # ---- write ----
    wdir = os.path.join(DATA, "WeatherDay")
    sdir = os.path.join(DATA, "SensorReading")
    for d_ in (wdir, sdir):
        for fn in os.listdir(d_):
            os.remove(os.path.join(d_, fn))
    with open(os.path.join(wdir, "weather_2026.json"), "w") as fh:
        json.dump([weather[k] for k in sorted(weather)], fh, indent=0)
    total = 0
    for m, rows in sorted(rows_by_month.items()):
        with open(os.path.join(sdir, "sensors_%s.json" % m), "w") as fh:
            json.dump(rows, fh, indent=0)
        total += len(rows)
    print("weather days:", len(weather), " sensor rows:", total, " months:", len(rows_by_month))


if __name__ == "__main__":
    main()
