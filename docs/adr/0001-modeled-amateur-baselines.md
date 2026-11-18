# 1. Modeled baselines for amateur Handicap Classes

## Status

Accepted (2026-11-18)

## Context

Strokes Gained needs a Baseline (expected strokes to hole out by Distance to Pin and Lie) for every Handicap Class we compare against: PGA Tour, Scratch, HCP 10, HCP 20, HCP 30.

Only the PGA Tour Baseline exists as a full, published table (Broadie, *Every Shot Counts* / "Assessing Golfer Performance on the PGA TOUR", 2012). For Scratch, Broadie (2008) publishes partial values only. For HCP 10/20/30 there is no free, measured table by distance and lie: Shot Scope, Arccos, DECADE and Lou Stagner publish scattered data points and per-handicap aggregates, but not lookup tables. Commercial data would cost money and licensing effort disproportionate to a personal app.

## Decision

- Use Broadie's PGA Tour table as the single Measured Baseline.
- Derive Scratch, HCP 10, HCP 20 and HCP 30 as Modeled Baselines: apply a per-lie adjustment to the PGA Tour table that grows with distance, calibrated so that a typical course plays to roughly par +1, +11, +22 and +33 respectively (anchored on Shot Scope's published per-handicap score averages).
- Calibrate on a fixed Reference Course (par 72, ~5,900 m men's tee, Course Rating ≈ par, Slope 125) rather than per played Course, so Baselines are identical everywhere and Strokes Gained stays comparable across Courses.
- Because the adjustment is parametric in handicap, a Modeled Baseline can be generated for any handicap (e.g. the golfer's own 6.8), not only the preset classes.
- Validate the model against published amateur data points (e.g. HCP 10 from 100 yd fairway ≈ 3.4).
- Show Modeled Baselines as "modeled" in the app.

## Model

`E_h(lie, d) = E_pga(lie, d) + k_h · w(lie, d)`, floored at 1 stroke.

- `w` (shape, fixed): on the Green `0.25 · (1 − e^(−feet/12))`; off the Green
  `base(lie) · min(1, 0.5 + yards/100) + 0.0006 · yards` with base Tee 0.60, Fairway/Fringe 0.50,
  Rough 0.62, Bunker 0.80, Recovery 0.75. Amateurs lose a little on short putts, more on long putts,
  and most per shot from the rough and bunkers.
- `k_h` (solved): the expected score on the Reference Course (sum of `E_h(tee, length)` over its
  holes) equals par 72 plus the typical strokes over par for handicap h, interpolated from
  0 → +1, 10 → +11, 20 → +22, 30 → +33.
- Checked against published points: HCP 10 from 100 yd fairway 3.32 (published ≈ 3.38),
  from 100 yd rough 3.66 (≈ 3.5); HCP 15 from 160 yd fairway 3.76 (≈ 3.92).

The PGA Tour table rows below 20 yd off the Green are estimates, and the table itself was
transcribed from circulated copies; both should be verified against *Every Shot Counts*.

## Consequences

- Comparisons against amateur classes are approximations; absolute SG values vs HCP 10/20/30 carry model error, though relative trends over time remain meaningful.
- Baselines are data, not code: a measured amateur table can replace a modeled one later without changing the Strokes Gained calculation.
- The PGA Tour table is copyrighted; it is used for personal use and must not be redistributed in a public release without clarification.
