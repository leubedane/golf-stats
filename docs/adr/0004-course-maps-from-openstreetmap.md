# 4. Course Maps from OpenStreetMap

## Status

Accepted (2026-11-22)

## Context

The golfer wants to see a map of the Hole being played, next to its Hole Strategy, for orientation. GPS distances and placing Shots on the map may come later, so the data should carry real coordinates.

Two sources were considered:

- **Pictures from club websites** (e.g. the per-hole images of GC Breisgau). They are copyrighted, so they cannot ship in the publicly deployed PWA, and they have no coordinates, which rules out GPS later.
- **OpenStreetMap** golf mapping: `golf=hole` lines from tee to green, plus `golf=tee`, `green`, `fairway`, `bunker`, `water_hazard` areas, licensed under the ODbL. Coverage varies: in November 2026 the Freiburger Golfclub had all 18 Hole Lines and greens (6 without `ref`, but named "Loch N"), while Europa-Park GC Breisgau had only bunkers and water. Tagging varies too: Freiburg maps each `golf=hole` as a closed outline of the hole corridor, not as the documented tee→green line.

The app is offline-first and signal on a golf course is poor, so the map must not depend on a tile server or a live request during a Round. Aerial imagery was left out: provider terms (Esri, Bing, Google) mostly forbid offline caching.

## Decision

- Use OpenStreetMap vector data only. Show "© OpenStreetMap contributors" under every map.
- Store one **Course Map** per Course in its own Dexie table `courseMaps` (schema version 6), keyed by `courseId`. Like Hole Strategies (ADR 0002) it lives apart from the Course, because course imports replace the Course as a whole. Deleting a Course deletes its Course Map.
- A Course Map holds the raw features as latitude/longitude, as fetched, plus the golfer's manual Hole Line assignments. Coordinates are positions, not distances, so the "store meters" rule does not apply; they are projected to meters only when a Hole Map is drawn.
- The golfer loads a Course Map on demand from the Course page: the OSM golf course is found by name with Nominatim (or by a pasted OSM link or id) and its features are fetched with the Overpass API, trying several public servers. Nothing is fetched automatically. Each server gets 75 s to answer completely; the server list is tried a second time after a 5 s pause. A request that fails while the device is online counts as a busy server, not a lost connection: busy Overpass servers reject requests without CORS headers, which the browser reports like a network failure. "No connection" is shown only when the device is offline.
- Hole Lines are matched to hole numbers by `ref`, then by a hole number in `name` ("Loch 3", "Hole 3"). Lines with no number, or with a number used twice (two courses in one OSM area), stay unassigned until the golfer assigns them. A manual assignment wins and survives a refresh. Par and length always come from the Course, never from OSM.
- A Hole Line that is a closed ring is treated as an outline of the hole. Its direction runs from the tee to the green inside it that lie farthest apart, and features count for the Hole when they lie inside it or within 10 m.
- The **Hole Map** is derived by a pure function: the Hole Line plus every green, fairway, tee, bunker and water area within 40 m of it, rotated so the tee is at the bottom and the green at the top. Other features in view are drawn faded. All OSM tees are drawn alike; they are not matched to the Course's Tees.
- Drawn as plain SVG. No map library, no tiles, no aerial imagery.
- `BACKUP_VERSION` moves to 5 with a `courseMaps` array; older backups import with none.
- A Course without usable OSM data shows an empty state linking to the OSM editor. An in-app hole editor was considered and rejected: it would duplicate iD and the data would help nobody else.

## Consequences

- Map quality is exactly OSM's. Improving a course means editing OSM and pressing Refresh.
- A pond between two holes appears on both Hole Maps, which is intended.
- Multipolygon relations (rare for bunkers, sometimes used for large water) are not loaded; only ways.
- Coordinates are already stored, so GPS distances can be added without a data migration.
