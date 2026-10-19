# Judging rubric (University Accelerator) and how we win each point

Max 20 = 4 categories × 5. **Design + Implementation = 10 of 20**, so a polished, complete, working
product beats extra features. Every person should know which category their work feeds.

## The official rubric (verbatim)

**Creativity (0–5)** — How novel is the idea?
- Low (1–2): Idea largely duplicates an existing product, service, or well-known solution.
- Mid (3): A fresh take on a known problem, or a meaningful improvement on something that already exists.
- High (4–5): A genuinely original idea that stands apart from existing solutions, the kind of thing that generates real excitement in the room.

**Feasibility (0–5)** — What is the likelihood this project can be used in a real world context?
- Low (1–2): Unclear who would use this or why; no obvious real-world application.
- Mid (3): A plausible real-world use case, but demand or practicality still needs validation.
- High (4–5): Addresses a clear, validated real-world need with an obvious path to adoption or implementation.

**Implementation (0–5)** — How challenging was it to build this project, and how far did the team get? Was the solution complete?
- Low (1–2): A mockup, slides, or a static demo with no working product.
- Mid (3): A working prototype that runs, but has rough edges or gaps.
- High (4–5): A robust, functioning product (not just a prototype) that shows real depth and strong execution.

**Design (0–5)** — Is the user interface intuitive? Does the design/user experience meet the needs of the target audience?
- Low (1–2): The interface is cluttered and chaotic; the app has a broken user flow.
- Mid (3): The interface is clean and functional but has a few clunky components.
- High (4–5): The interface is well-polished and intuitive for intended users.

## How we score 4–5 in each

### Creativity — target 4
Risk: "predictive maintenance" already exists (C3 Reliability, Johnson Controls, Siemens, IBM Maximo).
What makes ours stand apart — say these out loud:
- **Ranks the whole campus by what's at stake** (buildings, labs, $/day), not just "this pump is anomalous".
- **Plan B is ready before the failure**: who loses cooling, in what order, how many chillers, $/day.
  The real lesson of June 2026: 63% of the $15.8M was renting chillers because campus was unprepared.
- **Energy waste as the everyday payoff** — same alert, useful even in weeks when nothing breaks.
- **Agent with a human in the loop**: drafts work orders, never executes them.
- **Built on the judges' own campus**, replaying a real $15.8M event.
Owner of the story: Vibhrav (pitch). Feeds from: Plan B (Arnav, Devansh), agent (Vibhrav, Anuva).

### Feasibility — target 5
- Clear user: UW FP&M facilities/utilities manager. Clear need: $1.5B backlog, 4% vs 10–12% on
  prevention, $15.8M June event, Regents warned in 2019 — all real and cited.
- Path to adoption: read-only access to building-automation + work-order data; a manager approves
  work orders. Same pipeline runs on real feeds.
- **Real data where possible**: real NOAA weather, real buildings/plants, real costs, real FP&M
  work-order format and PM asset categories. Labeled REAL / SYNTHETIC / ESTIMATE in the UI.
- Honest answers ready (PLAN.md → Judge Q&A).
Feeds from: Devansh (real data), everyone (labels), Vibhrav (pitch).

### Implementation — target 4–5
"Robust, functioning product, real depth, complete":
- The whole demo path works live with no fixtures and no hand-holding (FRONTEND §8), run 3× before freeze.
- Real depth to show: weather-normalized energy baseline, per-asset z-scores with persistence,
  network-aware impact, Plan B simulation, **backtest with threshold slider and decoys ignored**.
- Every page has loading/empty/error states — nothing blank or broken when clicked.
- Tag `demo-v1` at 2:15; backup screen recording.
Feeds from: everyone. Owner of "it all works together": Vibhrav (integrator).

### Design — target 4–5
"Well-polished and intuitive for intended users":
- Built around the manager's 3 questions: what needs attention / why and what do I do / what if I don't.
- Color = status only; one consistent StatusPill everywhere; projector-sized type.
- One global as-of date; every click goes somewhere sensible; no dead ends.
- Polish pass 1:30–2:15 is **not optional**: alignment, spacing, consistent numbers and dates.
Feeds from: Arnav, Anuva.

## Pre-judging checklist (Vibhrav runs at 2:10)
- [ ] Demo path runs end to end on `main`, real backend, no console errors
- [ ] Every number on screen matches PLAN.md (no "8%" vs "7.5%" mismatches)
- [ ] REAL / SYNTHETIC / ESTIMATE chips visible on Overview, Asset detail, Plan B
- [ ] S3 failure labeled "Reenactment of the real June 17 event"
- [ ] Backtest shows decoys ignored + honest false-alarm count
- [ ] Every page: no blank panels, no lorem ipsum, no fixture flags left on
- [ ] Sources clicked and confirmed by a human
- [ ] `demo-v1` tagged, backup recording saved
