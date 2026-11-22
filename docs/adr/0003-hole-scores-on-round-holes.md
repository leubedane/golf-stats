# 3. Hole Scores stored on Round holes

## Status

Accepted (2026-11-21)

## Context

Until now a hole's score existed only as the sum of its Shots: no Shots, no score. The golfer wants to enter the result of every hole first (Strokes, Putts, Tee Result, Penalties), during or after the Round, and record the Shots in detail later, or not at all for some holes.

That raises three questions: where the entered result lives, which number counts when it and the Shots disagree, and what the Shots-only Rounds recorded so far mean under the new model.

## Decision

- Store the entered result as an optional `score` field (a Hole Score) on each `RoundHole`, inside the Round record. No new table and no Dexie schema version: the field is not indexed and older Rounds simply lack it.
- An entered Hole Score is the official score. When the hole's Shots end in a Hole Outcome (the hole is Detailed) and disagree with it on Strokes, Putts or Penalty strokes, the hole is flagged. Fields that were not entered are not compared.
- Without an entered Hole Score, a Detailed hole's score follows its Shots, as before. The "follows the Shots" state is derived (no `score` field), not stored as a flag, so correcting a Shot never creates a mismatch against a number the golfer never typed. The first change on the scorecard fixes it as an entered Hole Score.
- Strokes Gained counts only Detailed holes. A hole in progress (Shots without a Hole Outcome) is left out until finished, and the Round summary states how many holes Strokes Gained covers.
- Score totals, Fairways, Greens in Regulation and Putts come from each hole's Hole Score (entered or derived), so they cover holes that were never Detailed.
- The entered Hole Score prefills Shot entry: the Tee Result sets the first Shot's Miss Direction and the second Shot's Lie, and the next Shot starts on the Green once only putts remain. These are defaults, never constraints.
- `BACKUP_VERSION` moves to 4. Older backups import unchanged.
- Scanning a paper scorecard with OCR or a vision model was considered and left out for now: it would need an API key and a network connection in an offline-first app, and handwriting recognition still needs a review step.

## Consequences

- Rounds recorded before this change behave as before: their scores follow their Shots.
- The existing function that counts Strokes from Shots was renamed `shotsScore`, to keep "Hole Score" for the domain concept.
- A Round can mix holes with only a Hole Score and Detailed holes, so Strokes Gained totals of such a Round cover fewer holes than its score. The summary shows the coverage.
