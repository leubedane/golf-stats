# 5. Ball Positions on Shots

## Status

Accepted (2026-11-25)

## Context

The golfer wants to record Shots on the Hole Map by touch instead of typing every Distance to Pin. A tap on the map can fill in the next Shot's Lie and Distance to Pin, and the recorded Shots can be drawn on the map.

Until now a Shot held only a Lie and a Distance to Pin. Placing Shots on the map needs a stored position, and that raises the question of which value is the truth when the map and a typed distance disagree.

## Decision

- A Shot optionally stores its **Ball Position**, the latitude/longitude where the ball lies before the Shot. One tap per Shot: the Ball Position of Shot N+1 is where Shot N finished. There is no separate landing point. A Pick-Up stores the Ball Position it was lifted from.
- Each Round Hole optionally stores a **Pin Position**. It defaults to the Course Map's `golf=pin` for the Hole, or the middle of the Hole's green, and the golfer can drag it once per Hole per Round.
- The first Shot of a Hole is always from the Tee; its Lie cannot be changed. Its Ball Position defaults to the start of the Hole Line, and its Distance to Pin is the straight line to the Pin Position instead of the scorecard length when the Hole has a Hole Map.
- **Off the Green, the map is the only source of Distance to Pin.** While a Shot has a Ball Position, its Distance to Pin is computed from the Ball Position and the Pin Position, and is recomputed when either moves. Typing a distance removes the Ball Position, so the map never shows a ball that contradicts the number.
- **On the Green, the Ball Position only draws.** Map accuracy (1–2 m) is too coarse for putting Strokes Gained, so a Shot whose Lie is Green keeps a typed Distance to Pin. Its Ball Position, if placed, only ends the previous Shot's line.
- Placing or moving a Ball Position fills in the Lie from the Course Map feature under it: green → Green, bunker → Bunker, fairway → Fairway, otherwise Rough. Fringe and Recovery cannot be told from the map. The golfer's choice of Lie wins until the ball is moved again.
- Positions are stored as latitude/longitude, like the Course Map (ADR 0004), not in screen meters, so they survive a Course Map refresh and GPS can set them later.
- Positions are placed in a full-screen Hole Map with zoom and draggable markers; it can be panned beyond the Hole to place a ball on a neighbouring hole. No GPS for now. After a Penalty the golfer places the next ball like any other; the app does not guess the relief taken.
- Holes without a Hole Map record Shots exactly as before.
- The stored shape changes, so `BACKUP_VERSION` moves to 6; older backups import with no positions.

## Consequences

- Strokes Gained still reads only Lie and Distance to Pin, so the calculation is unchanged and Shots with and without positions mix freely.
- Moving a Pin Position changes the Distances to Pin, and so the Strokes Gained, of the Hole's map-placed Shots off the Green.
- Map-derived distances are only as good as OSM's geometry and the golfer's tap. Typing a distance remains possible at the cost of the Ball Position.
- A Course Map refresh that moves OSM features does not move stored Ball Positions, but can change the Lie the map would suggest.
