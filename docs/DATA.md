# Data spec (owner: Devansh)

Goal: data that is **real wherever it can be**, and synthetic data that behaves like real equipment
so a facilities engineer would believe the charts. Every table and column is in `docs/CONTRACT.md`.
Output: `data/seed/*.csv` + `contract`-shaped `events()`.

**Starting point, not a checklist.** Ranges, counts and dates below are suggestions — simplify or
improve them. Fixed: CSV columns/units from CONTRACT, S3 failing on Jun 17, and honest labels.

## 1. Real data to pull

| What | Source | Notes |
|---|---|---|
| Daily weather Jan 1 – Aug 31 2026 | NOAA GHCN-Daily, Madison Dane County Regional Airport (verify station id, expected `USW00014837`) — or Meteostat as fallback | `tmax_f, tmin_f, tavg_f`. If 2026 pull fails, use 2025 shifted one year and **say so** in `source` |
| ~25 buildings: name, year built, GSF, lat/lon | UW FP&M / campus map pages, Wikipedia, OpenStreetMap | Cite in `source`. If GSF is not findable, estimate and write `estimate` in `source` |
| 3 plants: Charter Street Heating Plant, Walnut Street Heating Plant, West Campus Cogeneration Facility | public | lat/lon from OSM |
| Asset types and failure mix | FP&M Physical Plant May 2021 Operations Report: PM failures by program — isolation valves 105, blowdown valves 64, condensate pumps 55, heat exchangers 50, pumps 39, expansion joints 31, steam traps 22, tunnels 21 | Use to choose the asset mix (more valves/pumps/HX than chillers) |
| Work order ID format | same report: `WO 21-071487`, `PRJ-21-002195` | We use `WO 26-0NNNNN` |
| Costs and outage facts | see CONTRACT `REAL_OUTAGE` | |

Candidate buildings (real names; verify facts, pick ~25):
Bascom Hall, Science Hall, Music Hall, Van Hise Hall, Van Vleck Hall, Chemistry Building, Grainger
Hall, Vilas Hall, WIMR, Sterling Hall, Birge Hall, Computer Sciences, Engineering Hall, Mechanical
Engineering, Engineering Centers Building, Mosse Humanities, Social Science, Medical Foundation
Centennial Building, Integrative Biology Research, Chamberlin Hall, Agricultural Engineering,
Microbial Sciences, Moore Hall, Biochemistry, Weeks Hall, Health Sciences Learning Center.

Criticality: assign honestly with a one-line reason (labs → research_lab; classroom/office
buildings → instruction/office). Only label `patient_care` if the building actually has clinical
space — verify, don't assume (WIMR is research; check before calling it patient care).

## 2. Network topology (synthetic, plausible)
- 3 plants → 5–6 segments → ~25 buildings. Group by geography (use lat/lon).
- **S3 is the reenactment segment**, fed from Charter Street (the real break was near Charter St).
  It must serve 9 buildings including the real closures **Bascom, Science Hall, Grainger** plus
  Music Hall, Van Hise, Van Vleck, Chemistry and two others.
- Each segment has one `chw_main` asset (`S<n>-PIPE`) with empty `building_id` (serves the segment).

## 3. Assets (~60)
Per segment: 1 `chw_main`, 1–2 `chw_pump`, 1–2 `isolation_valve`, 1 `steam_line`.
Per plant: 2–3 `chiller` (ages 10–45; one 43-year-old at Walnut = `WAL-CHL-2`).
Per building (most): 1 `ahu`, some `unit_heater`, `heat_exchanger`, `steam_trap`, `condensate_pump`.
Ages realistic for campus: 5–65 years; older buildings → older equipment.

## 4. Synthetic sensors (physically shaped)
Which sensors each type has (others `null`):

| Type | pressure | flow_imbalance | delta_t | vibration | energy |
|---|---|---|---|---|---|
| chw_main | ✓ | ✓ | ✓ | | ✓ (pumping) |
| chiller | | | ✓ | ✓ | ✓ |
| chw_pump, condensate_pump | ✓ | | | ✓ | ✓ |
| isolation_valve, steam_line, heat_exchanger | ✓ | ✓ (steam/condensate) | ✓ (HX) | | ✓ |
| steam_trap | ✓ | | ✓ | | ✓ |
| unit_heater | | | ✓ | ✓ (fan) | ✓ |
| ahu | | | ✓ | ✓ | ✓ |

Healthy ranges (daily values = baseline + small noise):
- Chilled water supply pressure 60–90 psi (per asset fixed baseline), daily noise σ ≈ 0.8 psi.
- Flow imbalance 0–1%, σ ≈ 0.3%.
- Chilled water ΔT 10–14°F (dips slightly at low load). Heating ΔT 20–40°F.
- Vibration (ISO 10816 bands): healthy 1.2–2.5 mm/s, σ ≈ 0.15; >4.5 is concerning, >7.1 unacceptable.
- Energy: **driven by real weather.** Cooling: `base + k × GSF × max(0, tavg − 55)`. Heating:
  `base + k × GSF × max(0, 60 − tavg)`. AHU: mild both ways. Plus 3% noise. Weekends −10% for AHU.
- ~2% of readings missing at random.

Degradation (planted failures): starts at `onset_date`, ramps (convex, faster near failure) to
failure. At failure day, signals reach: pressure −5 to −10 psi, flow imbalance +3–6%, ΔT down 3–5°F,
vibration 5–8 mm/s, energy +7–10% over weather-expected. Only the 2–3 signals that fit the failure
mode move (a leak moves pressure + flow imbalance; a bearing moves vibration + energy).

## 5. Planted failures and decoys (events.csv)
Pick heating dates from the **real coldest stretches** in the NOAA data and the chiller date from
a **real hot stretch**; the dates below are targets. S3 is fixed.

| id | asset | system | onset | failure | story |
|---|---|---|---|---|---|
| F1 | `VIL-UH-2` Vilas Hall unit heater | heating | ~14 d before | coldest Jan stretch (target Jan 28) | 2019 polar-vortex echo: unit heaters |
| F2 | `STE-HX-1` Sterling Hall heat exchanger | heating | ~14 d before | Feb cold stretch (target Feb 16) | real Feb 2021 burst pipes at Sterling |
| F3 | `WIMR-AHU-3` WIMR air handler | air | ~12 d before | Apr 14 | bearing: vibration + energy |
| F4 | `S3-PIPE` chilled water main | cooling | ~18 d before | **Jun 17 (fixed)**, end Aug 10 | **"Reenactment of the real June 17 event"**: pressure + flow imbalance |
| F5 | `WAL-CHL-2` 43-yr chiller | cooling | ~14 d before | hot stretch in July (target Jul 22) | echoes real Charmany chiller failure |

| id | decoy | must NOT trigger because |
|---|---|---|
| D1 | one-day vibration spike on a healthy chiller (Mar) | persistence rule |
| D2 | 5-day sensor dropout on a healthy AHU (May) | missing data ≠ risk |
| D3 | real June heat wave raises every cooling asset's raw energy | weather-normalized baseline |
| D4 | slow normal aging drift on an old chiller all year | compared with its own 30-day normal |

Plus `R1` = the real June 17 break (`kind=real_reference`, `synthetic=false`) for the UI marker.

## 6. Order of work
1. **By 12:00 — seed v1:** buildings (names + segments, facts can be rough), plants, segments,
   assets, weather (real if pull works), sensors with F4 planted. Crude is fine; shapes must be exact.
2. **By 12:45:** all failures + decoys, real building facts filled, `events()`.
3. **By 1:30:** `simulatePlanB` in `network/` + `plan_b` line for `building()`.

## 7. Acceptance checks
- Every CSV matches CONTRACT columns, types, units; `null` not 0 for missing.
- Plot raw energy for 3 cooling assets: it rises with real June heat.
- F4 signals visibly drift from ~May 30; healthy assets look flat-with-noise.
- Every building has a `source`; every invented number is labeled estimate/synthetic.
- `simulatePlanB('S3', 95, false)` returns 9 buildings ordered by criticality then load, totals add up.
