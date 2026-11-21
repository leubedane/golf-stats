# 2. Hole Strategies stored apart from Courses

## Status

Accepted (2026-11-21)

## Context

A Hole Strategy records how the golfer wants to play a Hole: Tee Club, Tee Target, Good Miss, Danger Side and notes. It is written once, often during a first Round on a Course, and shown on that Hole in every later Round.

The obvious place for it would be inside the `Course` record, next to the Holes. But Courses are replaced as a whole: a GolfCourseAPI refresh, a PC CADDIE import and the course editor all `put` a complete `Course`. A strategy stored inside it would be wiped by the next import. Holes also live per Tee, while a strategy is the same from every Tee.

## Decision

- Store Hole Strategies in their own Dexie table `holeStrategies` (schema version 5), keyed by `${courseId}:${holeNumber}` and indexed by `courseId`.
- A Hole Strategy belongs to a Course and a hole number, not to a Tee.
- Keep only the latest version of each Hole Strategy, with an `updatedAt` timestamp; no history.
- An emptied Hole Strategy is deleted, not stored.
- Deleting a Course deletes its Hole Strategies in the same transaction. Rounds are unaffected.
- The Tee Club is stored as Club id plus Club name, like a Shot's Club, so it survives removal from the Bag and leaves a later plan-versus-actual comparison possible.
- Backups move to version 3 with a `holeStrategies` array; version 1 and 2 backups import with none.

## Consequences

- Re-importing or editing a Course never touches its Course Strategy.
- If a Course's holes are reduced (18 to 9), strategies for hole numbers that no longer exist stay in the table, unseen, until the Course is deleted.
- A golfer who plays very different Tees gets one Tee Club per hole; the hole length shown next to the strategy (from the Round, or from the first Tee of the golfer's gender on the Course Strategy page) shows when it no longer fits.
