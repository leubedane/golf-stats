import { effectiveScore } from './holeScore';
import { shotEnd, shotProgressM } from './round';
import type { Round } from './types';

const HEADER = [
  'round_id', 'date', 'course', 'tee', 'hole', 'par', 'stroke_index', 'hole_score', 'shot',
  'lie', 'distance_m', 'club', 'penalty', 'miss_side', 'miss_length', 'shape',
  'short_game_type', 'break', 'end_lie', 'end_distance_m', 'progress_m',
];

function cell(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per Shot, for spreadsheets and external analysis. */
export function roundsToCsv(rounds: Round[]): string {
  const rows = [HEADER.join(',')];
  for (const r of rounds) {
    const date = new Date(r.startedAt).toISOString().slice(0, 10);
    for (const h of r.holes) {
      h.shots.forEach((s, i) => {
        const end = shotEnd(h, i);
        rows.push(
          [
            r.id, date, r.courseName, r.teeName, h.number, h.par, h.strokeIndex, effectiveScore(h)?.strokes ?? null, i + 1,
            s.lie, s.distanceM, s.clubName, s.penaltyStrokes, s.missSide, s.missLength, s.shape,
            s.shortGameType, s.break,
            end.kind === 'holed' ? 'holed' : end.kind === 'position' ? end.lie : '',
            end.kind === 'holed' ? 0 : end.kind === 'position' ? end.distanceM : '',
            shotProgressM(h, i),
          ]
            .map(cell)
            .join(','),
        );
      });
    }
  }
  return rows.join('\n') + '\n';
}
