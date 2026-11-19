# Golfstat

A personal, offline-first golf tracker. Record every shot of a round on your phone, then see where you gain and lose strokes using **Strokes Gained**, compared against the PGA Tour and against amateur handicap classes (Scratch, HCP 10, 20, 30, or your own handicap).

## Features

- **Live round entry**: record each shot with lie, distance to pin, club, and optionally miss direction, shot shape, penalties, short-game type and putt break. Handles pick-ups.
- **Strokes Gained**: every shot is valued against each handicap class and grouped into Off-the-Tee, Approach, Around-the-Green and Putting.
- **Round summary and stats**: SG by category per round, trends over time, and breakdowns.
- **Courses**: search and import courses from [GolfCourseAPI](https://golfcourseapi.com) (needs your own API key), or enter them by hand.
- **Bag**: up to 14 clubs to pick from while recording shots.
- **Your data stays on your device**: everything is stored in the browser (IndexedDB). There's JSON backup/restore and CSV export.
- **Installable PWA**, works offline. English and German.

## Getting started

Requires Node 22+.

```sh
npm install
npm run dev        # dev server
npm test           # unit tests (Vitest)
npm run typecheck
npm run build      # type-check and production build into dist/
npm run preview    # serve the production build
```

To import courses, add your GolfCourseAPI key under **Settings** in the app.

## How the baselines work

Strokes Gained for a shot = expected strokes before the shot − expected strokes after it − 1 − penalty strokes.

Expected strokes come from a **baseline** for each handicap class:

- **PGA Tour**: Mark Broadie's published table (*Every Shot Counts*). This is the only measured baseline.
- **Scratch, HCP 10/20/30 and your own handicap**: *modeled* from the PGA Tour table with a handicap adjustment, calibrated so that a typical course plays to about par +1 / +11 / +22 / +33. The app labels these as modeled.

You can read the full reasoning and the model in [`docs/adr/0001-modeled-amateur-baselines.md`](docs/adr/0001-modeled-amateur-baselines.md). Amateur SG values are approximations, but trends over time are still meaningful.

> **Note:** The PGA Tour table was transcribed from circulated copies and hasn't been checked against the book yet. It's copyrighted, so it's included here for personal use only.

## Project layout

```
src/
  domain/          types, rounds, courses, settings, units, CSV (pure logic)
  strokesGained/   baselines, SG calculation, round summaries
  stats/           aggregates and trends across rounds
  courses/         GolfCourseAPI client
  db/              Dexie (IndexedDB) schema and backup
  i18n/            en / de messages
  pages/, components/  React UI
docs/adr/          architecture decisions
GLOSSARY.md        domain vocabulary
```

## Deployment

Pushes to `main` deploy to Cloudflare Pages through GitHub Actions (`.github/workflows/deploy.yml`), and pull requests get preview deployments. The workflow needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets. You can also set the `CLOUDFLARE_PAGES_PROJECT` variable (it defaults to `golfstats`).
