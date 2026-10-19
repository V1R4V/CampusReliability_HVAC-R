# Plan — Before It Breaks (working name) · team zeroday@c3 · C3 AI hackathon, Oct 19 2026

## 1. One line
An agent that tells UW Facilities "inspection due" on whichever building system is most likely to
fail next, ranks it by the buildings and dollars at stake, flags the energy it wastes while it
degrades, drafts the work order for approval, and has Plan B ready.

## 2. The problem (real, cited — a human must click every source before the pitch)
- **The break.** June 17, 2026: a chilled water main supply line broke near the Charter Street
  plant (~4 ft wide, ~20 ft underground). (UW News; Cap Times)
- **The damage.** 23 buildings closed, 11 more partly closed, during a statewide heat emergency —
  incl. Bascom, Grainger, Science Hall. Reopened Aug 10; mobile chillers into September. (WPR; UW News)
- **The bill.** $15.8M: temporary chillers ~$10.0M (63%), extra deterioration found ~$4.0M (25%),
  repairing the line ~$1.8M (11%). (Cap Times, Oct 8 2026)
- **~$111K/day** in rentals — *our estimate*: $10M ÷ ~30 chillers ÷ ~90 days ≈ $3,704/chiller/day.
- **Not a one-off.** June 4: Regents approved ~$3M for Engineering Centers chilled water piping
  (failed bolt flooded research space) and ~$3M to replace a 40+-year-old Charmany Farms chiller
  that failed catastrophically. (WMTV)
- **The Regents were warned.** Feb 2019: ~$1.5B deferred maintenance; $21M/yr needed just to stop
  growth; UW spent ~4% of maintenance budget on prevention vs 10–12% at Illinois, Minnesota, Ohio
  State; 2019 polar vortex → 30 incidents in 28 buildings, about half from deteriorated or
  underfunded maintenance. (WPR)
- **Still budget-first.** July 2026: UW System prioritizes repairs by safety, operational need and
  available funding — nothing ranks equipment by risk of failing next. (WMTV)
- **FP&M's own numbers** (May 2021 Physical Plant Operations Report): 2,218 PMs in a month, 84% on
  time, 460 follow-up repairs, 120 emergency calls/month; failures led by isolation valves (105),
  blowdown valves (64), condensate pumps (55), heat exchangers (50).

**The insight:** the expensive part of June wasn't the pipe — it was being caught unprepared.

## 3. Locked decisions
| Decision | Choice | Why |
|---|---|---|
| Scope | Whole-building (cooling, heating, air); **cooling deep** (only cooling has Plan B + $/day) | Creativity + Feasibility; ML is system-agnostic so breadth is cheap |
| Ranking unit | `risk × impact` points; $/day only where real (chiller rental) | No invented dollar figures for heating/air |
| June 17 | Planted failure F4 labeled **"Reenactment of the real June 17 event"** | Keeps the hook, stays honest |
| Data | Real: NOAA weather, buildings, plants, costs, WO format, PM categories. Synthetic: sensors, loop layout, failures | Feasibility |
| Credibility | 5 failures + 4 decoys + threshold-slider backtest | A suspicious "0 false alarms" becomes a demonstrated one |
| Name | "Before It Breaks" is the working name; team decides final later | |

## 4. Team and ownership
| Person | Role | Folders | Brief |
|---|---|---|---|
| Vibhrav | ML + agent backend + integrator (merges `main`) + pitch | `model/`, `agent/`, `contract/`, `docs/` | `briefs/vibhrav.md` |
| Devansh | Data pipeline + network + Plan B compute | `data/`, `network/` | `briefs/devansh.md` |
| Arnav | UI: shell, Overview, Plan B, Backtest, Buildings index | see RULES §3 | `briefs/arnav.md` |
| Anuva | UI: Building dashboard, Asset detail, Work Orders, Agent drawer | see RULES §3 | `briefs/anuva.md` |

## 5. Timeline (details in RULES §5)
11:30 kickoff → **12:00** shared UI components + seed v1 → **12:30 checkpoint 1** (end to end on
`main`) → **1:30 checkpoint 2 / feature freeze** → 1:30–2:15 polish + run demo 3× → **2:15 code
freeze, tag `demo-v1`** → 2:15–3:00 rehearse.

## 6. Priorities
- **P0 (by 1:30):** seed data + F4; risk model; campusSnapshot; assetHistory; briefing (template);
  Plan B; UI shell + scrubber, Overview, Building dashboard, Asset detail, Plan B page; approve work order.
- **P1:** all 5 failures + 4 decoys; backtest + Backtest page; Work Orders page; LLM briefing; Agent drawer + `ask`.
- **P2:** Buildings index, Play animation, Edit work order, real map.

If behind at 1:30: cut P2, then Agent drawer, then Work Orders page. **Never cut** the demo path.

## 7. Demo path (≈85 s)
1. Overview on the January cold-snap warning date: Vilas unit heater tops the queue. "This is what the Regents heard in 2019."
2. Asset detail → briefing → **Approve**.
3. Click the "Real break" marker → lands ~Jun 9 → S3 main turns red. "Reenactment of June 17."
4. Read the briefing: buildings served, driving signal, energy over normal, $/day if it fails → **Approve**.
5. Plan B → S3 → **Simulate failure**: labs first, chillers, $/day — next to the real tile ($15.8M, ~$111K/day).
6. Backtest: slide the threshold — lead time vs false alarms; decoys ignored.

## 8. Pitch (3:00) — fill `{{…}}` from the final backtest, never from memory
1. **Hook (0:00–0:25)** — "On June 17 a 4-foot pipe under Charter Street broke. 34 buildings lost
   cooling during a heat emergency. UW paid $15.8 million — and $10 million of that was just renting chillers."
2. **It's not one pipe (0:25–0:55)** — 2019 warning, $1.5B backlog, a third of peers' prevention
   spend, two more cooling failures this June. "UW can't fix everything. It needs to know what to fix first — and be ready when it can't."
3. **Demo (0:55–2:20)** — §7. Say early: "Weather, buildings and costs are real. Sensor data is synthetic because UW's isn't public."
4. **Impact (2:20–2:45)** — "{{min}}–{{max}} days of warning across cooling, heating and air
   handling in our replay. A week buys an inspection crew, chillers staged only for labs, and a
   repair before the heat wave. And failing equipment ran {{x}}–{{y}}% over normal energy before it
   broke — so the same alerts cut waste every week."
5. **Close (2:45–3:00)** — "Same agent works for any campus, hospital or utility network. Fix it before it breaks."

## 9. Judge Q&A (honest answers)
| Question | Answer |
|---|---|
| Would this have caught the June break? | We don't know. UW is still investigating. Leaks often show first as pressure loss and flow imbalance, which we watch. Our June 17 is a labeled reenactment on synthetic data. |
| Is the data real? | Weather, buildings, plants, costs and FP&M's work-order format are real. Sensor readings, loop layout and failures are synthetic because UW doesn't publish them. The failures were planted — this proves the pipeline, not that the real break was predictable. |
| Where does $111K/day come from? | Our estimate: ~$10M rentals ÷ ~30 chillers ÷ ~90 days. |
| Why not a threshold alarm? | Each asset is compared with its own normal, energy is weather-adjusted, and drift must persist. The Backtest page shows a one-day spike, a sensor dropout and a heat wave all ignored. |
| Isn't this just predictive maintenance? | The ranking is by what's at stake across the whole campus network, and Plan B is ready before the failure — that's where 63% of the $15.8M went. |
| What would UW need to adopt it? | Read access to building-automation and work-order data, and a manager to approve work orders. No new hardware if pressure/flow are already logged — a question for FP&M. |
| Why C3? | Predictive maintenance on a utility network is C3's pattern; C3 Code built the data model, model and agent in a day. |

## 10. Sources (click each before the pitch)
- Campus cooling issues — UW News, Jun–Aug 2026
- "More than 20 buildings closed on UW-Madison campus because of air conditioning issues" — WPR, Jun 30 2026
- "UW-Madison's summer air conditioning woes cost $15.8 million" — Cap Times, Oct 8 2026
- "Board of Regents approved millions for aging infrastructure weeks before UW-Madison AC issues" — WMTV, Jul 1 2026
- "UW-Madison still dealing with cooling issues weeks after broken chilled water line" — WMTV, Jul 15 2026
- "UW-Madison facilities are expansive, aged and fragile, official says" — WPR, Feb 8 2019
- Physical Plant May 2021 Operations Report — facilities.fpm.wisc.edu (PDF)
- NOAA GHCN-Daily, Madison Dane County Regional Airport

See also: `RUBRIC.md` (how we score), `FRONTEND.md`, `DATA.md`, `ML.md`, `CONTRACT.md`, `RULES.md`.
