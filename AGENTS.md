# Agent guide

Golfstat is a personal, offline-first React PWA that records golf rounds shot by shot and scores them with Strokes Gained. Commands live in `package.json`. Before calling a change done, `npm test` and `npm run typecheck` must both be green.

## Domain language

`GLOSSARY.md` is the vocabulary. Use its terms in code, UI strings and commits (Shot, not "stroke" or "hit"; Distance to Pin; Handicap Class), and avoid the words it lists under _Avoid_. When you introduce or change a domain concept, update the glossary in the same change.

## Architecture

- `src/domain`, `src/strokesGained` and `src/stats` are pure functions: they take data and return data, and never touch Dexie or React. Their tests sit beside them as `*.test.ts`. Put new logic here and keep pages thin.
- `src/db/db.ts` holds the Dexie schema. To change the schema, add a new `this.version(n)` and leave earlier versions untouched, because users' existing IndexedDB data upgrades through them. If the stored shape changes, also bump `BACKUP_VERSION` in `src/db/backup.ts` and keep older backups importable.
- Pages read data reactively with `useLiveQuery`.

## Units

Every stored distance is in **meters**. The PGA Tour table is in yards off the green and feet on the green, as published, and `baseline.ts` converts at lookup time. GolfCourseAPI yardages are converted when a course is imported. Convert only at those edges.

## Strokes Gained and baselines

Read `docs/adr/0001-modeled-amateur-baselines.md` before touching anything in `src/strokesGained`. Baselines are data behind the `Baseline` function type: a measured amateur table can replace a modeled one without changing the SG calculation, so keep that seam. `pgaTourTable.ts` is unverified and copyrighted. Leave its values alone unless they are being checked against *Every Shot Counts*.

## i18n

Every user-visible string goes through `useT()`. `src/i18n/en.ts` defines the message keys, and `de.ts` is type-checked against it, so add each new key to both files.

## ADRs

Record any decision a future reader would question (a new data source, model or storage format) as the next numbered file in `docs/adr/`, following the format of 0001.
