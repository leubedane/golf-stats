import { shotEnd } from '../domain/round';
import type { MissSide, Round, ShortGameType, ShotShape } from '../domain/types';
import type { Baseline } from '../strokesGained/baseline';
import { roundShotsSg, sumByCategory, type SgByCategory, type SgEntry } from '../strokesGained/strokesGained';

export interface RoundPoint {
  roundId: string;
  startedAt: number;
  courseName: string;
  sg: SgByCategory;
}

/** SG per Round, oldest first. */
export function roundTrend(rounds: Round[], baseline: Baseline): RoundPoint[] {
  return [...rounds]
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((r) => ({ roundId: r.id, startedAt: r.startedAt, courseName: r.courseName, sg: sumByCategory(roundShotsSg(r, baseline)) }));
}

export function averagePerRound(points: RoundPoint[]): SgByCategory | null {
  if (points.length === 0) return null;
  const sum = points.reduce<SgByCategory>(
    (acc, p) => {
      for (const k of Object.keys(acc) as (keyof SgByCategory)[]) acc[k] += p.sg[k];
      return acc;
    },
    { offTheTee: 0, approach: 0, aroundTheGreen: 0, putting: 0, total: 0 },
  );
  for (const k of Object.keys(sum) as (keyof SgByCategory)[]) sum[k] /= points.length;
  return sum;
}

export interface GroupSg<K extends string = string> {
  key: K;
  shots: number;
  sg: number;
  sgPerShot: number;
}

function groupSg<K extends string>(entries: SgEntry[], keyOf: (e: SgEntry) => K | undefined): GroupSg<K>[] {
  const groups = new Map<K, { shots: number; sg: number }>();
  for (const e of entries) {
    const key = keyOf(e);
    if (key === undefined) continue;
    const g = groups.get(key) ?? { shots: 0, sg: 0 };
    g.shots++;
    g.sg += e.sg;
    groups.set(key, g);
  }
  return [...groups.entries()].map(([key, g]) => ({ key, shots: g.shots, sg: g.sg, sgPerShot: g.sg / g.shots }));
}

const allEntries = (rounds: Round[], baseline: Baseline) => rounds.flatMap((r) => roundShotsSg(r, baseline));

/** SG per Club, keyed by the Club name recorded on the Shot. */
export function sgByClub(rounds: Round[], baseline: Baseline): GroupSg[] {
  return groupSg(allEntries(rounds, baseline), (e) => e.shot.clubName || undefined);
}

export function sgByShortGameType(rounds: Round[], baseline: Baseline): GroupSg<ShortGameType>[] {
  return groupSg(allEntries(rounds, baseline), (e) => (e.category === 'aroundTheGreen' ? e.shot.shortGameType : undefined));
}

export const PUTT_BANDS = [
  { key: '0-1', maxM: 1 },
  { key: '1-2', maxM: 2 },
  { key: '2-5', maxM: 5 },
  { key: '5-10', maxM: 10 },
  { key: '10+', maxM: Infinity },
] as const;
export type PuttBand = (typeof PUTT_BANDS)[number]['key'];

export interface PuttBandStats extends GroupSg<PuttBand> {
  holed: number;
}

/** Putting by Distance to Pin band: putts, putts holed, SG. */
export function puttingByBand(rounds: Round[], baseline: Baseline): PuttBandStats[] {
  const bandOf = (m: number): PuttBand => PUTT_BANDS.find((b) => m <= b.maxM)!.key;
  const entries = allEntries(rounds, baseline).filter((e) => e.category === 'putting');
  const groups = groupSg(entries, (e) => bandOf(e.shot.distanceM));
  const holed = new Map<PuttBand, number>();
  for (const r of rounds)
    for (const h of r.holes)
      h.shots.forEach((s, i) => {
        if (s.lie === 'green' && shotEnd(h, i).kind === 'holed') holed.set(bandOf(s.distanceM), (holed.get(bandOf(s.distanceM)) ?? 0) + 1);
      });
  return PUTT_BANDS.map((b) => {
    const g = groups.find((x) => x.key === b.key);
    return g ? { ...g, holed: holed.get(b.key) ?? 0 } : { key: b.key, shots: 0, sg: 0, sgPerShot: 0, holed: 0 };
  });
}

export interface ClubTendency {
  clubName: string;
  shots: number;
  side: Record<MissSide, number>;
  shapes: Partial<Record<ShotShape, number>>;
}

/** Miss Direction and Shot Shape counts per Club (Shots without either are ignored). */
export function tendenciesByClub(rounds: Round[]): ClubTendency[] {
  const byClub = new Map<string, ClubTendency>();
  for (const r of rounds)
    for (const h of r.holes)
      for (const s of h.shots) {
        if (!s.clubName || s.lie === 'green' || (!s.missSide && !s.shape)) continue;
        const t = byClub.get(s.clubName) ?? { clubName: s.clubName, shots: 0, side: { left: 0, onTarget: 0, right: 0 }, shapes: {} };
        t.shots++;
        if (s.missSide) t.side[s.missSide]++;
        if (s.shape) t.shapes[s.shape] = (t.shapes[s.shape] ?? 0) + 1;
        byClub.set(s.clubName, t);
      }
  return [...byClub.values()];
}

/** Orders items by the position of their Club in the Bag; Clubs no longer in the Bag go last. */
export function orderByBag<T>(items: T[], name: (t: T) => string, bagNames: string[]): T[] {
  const pos = (n: string) => {
    const i = bagNames.indexOf(n);
    return i === -1 ? bagNames.length : i;
  };
  return [...items].sort((a, b) => pos(name(a)) - pos(name(b)) || name(a).localeCompare(name(b)));
}
