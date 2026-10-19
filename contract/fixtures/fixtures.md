# Fixtures — FAKE example data

One file per data call in `docs/CONTRACT.md`. They exist so the UI can be built from minute one.

- **Shapes are binding** (keys, types, enums). Real backend output must match them.
- **Values are fake.** Never quote a number from here in the pitch or on a slide — every result
  (lead days, false alarms, chillers, $/day) must come from the real pipeline output.
- Building facts here (year built, GSF, tons) are placeholders, not real UW data.

| File | Call |
|---|---|
| `campus_snapshot.json` | `campusSnapshot("2026-06-09")` |
| `building_van_vleck_hall.json` | `building("van_vleck_hall", "2026-06-09")` |
| `asset_history_S3-PIPE.json` | `assetHistory("S3-PIPE")` (31 days only; real one covers Jan–Aug) |
| `briefing_S3-PIPE.json` | `briefing("S3-PIPE", "2026-06-09")` |
| `plan_b_S3.json` | `simulatePlanB("S3", 95, false)` |
| `backtest.json` | `backtest(3.0)` |
| `work_orders.json` | `workOrders()` |
| `ask.json` | `ask("What should 2 crews inspect this week?", "2026-06-09")` |
| `events.json` | `events()` |

Owner: Vibhrav. Change only by PR (see `docs/RULES.md` §4).
