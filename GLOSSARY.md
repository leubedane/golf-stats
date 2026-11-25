# Golfstat

A personal shot-by-shot golf tracker that measures each shot with Strokes Gained against the baselines of several handicap classes.

## Course

**Course**:
A golf course with a fixed set of holes, played from one of several Tees.
_Avoid_: Club (ambiguous with golf club), venue

**Tee**:
A named set of tee boxes on a Course (e.g. yellow, red), carrying its own Course Rating, Slope and hole lengths.
_Avoid_: Tee box (when meaning the whole set)

**Hole**:
One hole of a Course with a par, a length per Tee and a stroke index.

**Stroke Index**:
The difficulty ranking of a Hole on its Course (1 = hardest).
_Avoid_: Hole handicap

**Course Map**:
The OpenStreetMap features of a Course (Hole Lines, tees, greens, fairways, bunkers, water) stored offline as latitude/longitude, with the golfer's Hole Line assignments.
_Avoid_: Layout, course plan, Bahnenverlauf

**Hole Line**:
The OpenStreetMap way (`golf=hole`) of one Hole: normally a line from the tee to the green, on some courses a closed outline of the hole.
_Avoid_: Centerline, route

**Hole Map**:
The drawing of one Hole built from the Course Map: its Hole Line and the features near it, with the tee at the bottom and the green at the top.
_Avoid_: Flyover, hole picture, hole plan

## Play

**Round**:
One visit to a Course from one Tee, consisting of a Hole Score and/or the Shots played on each Hole.

**Shot**:
One stroke at the ball, recorded with its Start Lie, Distance to Pin, Club and optional Miss Direction and Shot Shape.
_Avoid_: Stroke (reserved for scoring), hit

**Lie**:
Where the ball rests before a Shot: Tee, Fairway, Fringe, Rough, Bunker, Recovery or Green. The first Shot of a Hole is always from the Tee; later Shots can be from the Tee too (e.g. re-teeing after out of bounds).
_Avoid_: Position (for the kind of ground)

**Ball Position**:
Where the ball lies on the Hole Map before a Shot, set by touch; the first Shot's Ball Position is on the tee. The next Shot's Ball Position is where the previous Shot finished.
_Avoid_: Location, spot, landing point

**Pin Position**:
Where the hole is cut on the Green in one Round: taken from the Course Map's pin, or the middle of the Green, and movable by the golfer. Distance to Pin is measured to it.
_Avoid_: Flag, pin placement

**Fringe**:
The closely mown collar around the Green; a Shot from the Fringe is Around-the-Green but is valued like a Fairway Lie.
_Avoid_: Collar, apron

**Recovery**:
A Lie from which a normal shot toward the target is impossible (trees, blocked, punch-out required).

**Distance to Pin**:
The straight-line distance in meters from the ball to the hole before a Shot; the length of a Shot is derived from consecutive Distances to Pin.
_Avoid_: Remaining distance, yardage

**Miss Direction**:
Where a Shot finished relative to its target: Left, On Target or Right (and Short or Long for approaches).

**Shot Shape**:
The curve of a Shot's flight: Hook, Draw, Straight, Fade or Slice.
_Avoid_: Curve, ball flight

**Hole Outcome**:
How a Hole ended: Holed, or Picked Up from a recorded position (no score for that Hole).
_Avoid_: Hole result

**Hole Score**:
The result of a Hole entered directly: Strokes (or Picked Up), and optionally Putts, Tee Result and Penalty strokes. Until one is entered, a Detailed hole's Hole Score follows its Shots; once entered it is the official score, and Shots that disagree with it are flagged.
_Avoid_: Quick score, card score, hole result

**Detailed**:
A Hole whose Shots end in a Hole Outcome. Only Detailed holes count for Strokes Gained; a Hole with Shots but no Hole Outcome is in progress.

**Tee Result**:
Where the first Shot on a par 4 or par 5 finished relative to the fairway: Fairway, Left or Right. Entered as part of a Hole Score.
_Avoid_: Fairway hit, driving accuracy (as the field's name)

**Green in Regulation**:
Reaching the Green with at least two strokes to spare against par, i.e. Strokes minus Putts is at most par minus 2. Worked out from the Hole Score, never entered.
_Avoid_: GIR (in UI text)

**Pick-Up**:
Lifting the ball before holing out; the position it was lifted from ends the last Shot, and the Hole is left out of score totals.

**Penalty**:
Penalty strokes (1 or 2) charged to the Shot that caused them, e.g. out of bounds or water.

**Short Game Type**:
The kind of an Around-the-Green Shot: Chip Flat, Chip High-Spin, Chip High, Pitch, Bunker Shot or Fringe Putt.
_Avoid_: Chip type, shot kind

**Bunker Shot**:
A Short Game Type for a Shot from a greenside bunker; a Shot from a fairway bunker is an Approach with Lie Bunker.

**Putt**:
A Shot whose Lie is Green, recorded with optional Miss Direction and Break.

**Break**:
The curve of the green a Putt must follow: Left-to-Right, Straight or Right-to-Left.

## Strategy

**Hole Strategy**:
The preferred way to play one Hole of a Course: Tee Club, Tee Target, Good Miss, Danger Side and free-text notes. It belongs to the hole number, so it is the same from every Tee, and it is shown on that Hole in every Round on the Course.
_Avoid_: Game plan, hole notes

**Course Strategy**:
All Hole Strategies of one Course.

**Tee Club**:
The Club planned for the first Shot of a Hole.

**Tee Target**:
Where the first Shot of a Hole should be aimed, described in words (e.g. "left edge of the right bunker").
_Avoid_: Aim point, line

**Good Miss**:
The sides of the Green (Short, Long, Left, Right) where missing it is safe. Part of a Hole Strategy, unlike Miss Direction, which records where a Shot actually finished.
_Avoid_: Bail-out

**Danger Side**:
The sides of the Green to avoid at all costs. A side is never both a Good Miss and a Danger Side.
_Avoid_: Trouble

## Equipment

**Bag**:
The golfer's set of up to 14 Clubs available for selection on a Shot.

**Club**:
One golf club in the Bag (e.g. Driver, 7i, 56°, Putter).
_Avoid_: Stick

## Strokes Gained

**Baseline**:
A table giving, for one Handicap Class, the average number of strokes needed to hole out from a given Distance to Pin and Lie.
_Avoid_: Benchmark, expected strokes table

**Handicap Class**:
A reference group of golfers whose Baseline is used for comparison: PGA Tour, Scratch, HCP 10, HCP 20, HCP 30, or any handicap the golfer adds (e.g. their own).

**Reference Course**:
The fixed, typical course (par 72, ~5,900 m, Slope 125) on which Modeled Baselines are calibrated, so Baselines are identical on every Course.

**Primary Handicap Class**:
The Handicap Class the golfer chooses to see first in every statistic.

**Measured Baseline**:
A Baseline taken directly from recorded shot data (only PGA Tour).

**Modeled Baseline**:
A Baseline derived from the PGA Tour Baseline by a calibrated handicap adjustment (Scratch, HCP 10, HCP 20, HCP 30).

**Strokes Gained**:
For one Shot against one Baseline: expected strokes at the start, minus expected strokes at the end, minus one, minus Penalty strokes.
_Avoid_: SG score, performance index

**SG Category**:
One of four buckets each Shot is assigned to: Off-the-Tee, Approach, Around-the-Green or Putting.

**Off-the-Tee**:
Tee Shots on par 4 and par 5 Holes.

**Approach**:
Shots from more than 27 m that are not Off-the-Tee, including tee Shots on par 3s.

**Around-the-Green**:
Shots from within 27 m of the hole whose Lie is not Green.
_Avoid_: Short game

**Putting**:
Shots whose Lie is Green.
