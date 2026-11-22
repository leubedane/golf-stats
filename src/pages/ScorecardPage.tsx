import { useLiveQuery } from 'dexie-react-hooks';
import { Fragment, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chips } from '../components/Chips';
import { NumberField } from '../components/NumberField';
import { db } from '../db/db';
import { effectiveScore, holeStatus, setHoleScore, type HoleStatus } from '../domain/holeScore';
import { currentHoleIndex, finishRound, isHoleComplete, roundTotals } from '../domain/round';
import type { HoleScore, Round, RoundHole, TeeResult } from '../domain/types';
import { useT, type Translate } from '../i18n/i18n';
import type { MessageKey } from '../i18n/en';
import { formatToPar } from './RoundsPage';

const TEE_RESULTS: TeeResult[] = ['left', 'fairway', 'right'];
const TEE_RESULT_MARK: Record<TeeResult, string> = { left: '←', fairway: '●', right: '→' };
const STATUS_MARK: Partial<Record<HoleStatus, { mark: string; label: MessageKey }>> = {
  detailed: { mark: '✓', label: 'scorecard.statusDetailed' },
  mismatch: { mark: '⚠', label: 'scorecard.statusMismatch' },
  inProgress: { mark: '…', label: 'scorecard.statusInProgress' },
};

function scoreClass(strokes: number | null | undefined, par: number): string {
  if (strokes === null || strokes === undefined) return '';
  const d = strokes - par;
  return d < 0 ? 'score-under' : d === 0 ? 'score-par' : d === 1 ? 'score-bogey' : 'score-double';
}

interface Segment {
  key: string;
  label: MessageKey;
  holes: RoundHole[];
}

/** Front nine, back nine and total, as on a paper scorecard; just the total for a 9-hole Round. */
function segments(round: Round): Segment[] {
  const front = round.holes.filter((h) => h.number <= 9);
  const back = round.holes.filter((h) => h.number > 9);
  const total: Segment = { key: 'total', label: 'scorecard.total', holes: round.holes };
  if (front.length === 0 || back.length === 0) return [total];
  return [
    { key: 'out', label: 'scorecard.out', holes: front },
    { key: 'in', label: 'scorecard.in', holes: back },
    total,
  ];
}

function segmentTotals(holes: RoundHole[]) {
  const scores = holes.map(effectiveScore);
  const strokes = scores.filter((s) => s?.strokes != null);
  const putts = scores.filter((s) => s?.putts !== undefined);
  return {
    par: holes.reduce((sum, h) => sum + h.par, 0),
    strokes: strokes.length ? strokes.reduce((sum, s) => sum + s!.strokes!, 0) : null,
    putts: putts.length ? putts.reduce((sum, s) => sum + s!.putts!, 0) : null,
  };
}

/** The Round's start page: one row per hole, quick Hole Score entry, and the way into Shot entry. */
export function ScorecardPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const round = useLiveQuery(() => db.rounds.get(id ?? ''), [id]);
  const [selected, setSelected] = useState<number | null>(null);

  if (round === undefined) return null;
  if (round === null) return <p>Round not found.</p>;

  const totals = roundTotals(round);
  const open = round.holes.some((h) => !isHoleComplete(h) && !h.score);
  const continueIndex = currentHoleIndex(round);
  const save = (holeIndex: number, score: HoleScore | undefined) => db.rounds.put(setHoleScore(round, holeIndex, score));

  async function finish() {
    if (!confirm(t('round.finishConfirm'))) return;
    await db.rounds.put(finishRound(round!));
    navigate(`/rounds/${round!.id}/summary`);
  }

  return (
    <>
      <Link to="/" className="back">
        ← {t('nav.rounds')}
      </Link>
      <h1>{t('scorecard.title')}</h1>
      <p className="muted">
        {round.courseName} · {round.teeName}
        {totals.holesCompleted > 0 && (
          <>
            {' · '}
            <strong>{totals.strokes}</strong> ({formatToPar(totals.strokes, totals.par)}) ·{' '}
            {t('rounds.holesPlayed', { n: totals.holesCompleted })}
          </>
        )}
      </p>

      {open && !round.finishedAt && (
        <Link className="button primary block" to={`/rounds/${round.id}?h=${continueIndex}`}>
          {t('scorecard.continue', { n: round.holes[continueIndex].number })} ›
        </Link>
      )}

      <section className="card scorecard">
        <table className="data">
          <thead>
            <tr>
              <th>{t('course.hole')}</th>
              <th>{t('course.par')}</th>
              <th>{t('scorecard.strokes')}</th>
              <th>{t('scorecard.putts')}</th>
              <th>{t('scorecard.teeResult')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {round.holes.map((h, i) => {
              const score = effectiveScore(h);
              const status = STATUS_MARK[holeStatus(h)];
              const isSelected = selected === i;
              return (
                <Fragment key={h.number}>
                  <tr className={`scorecard-row ${isSelected ? 'selected' : ''}`} onClick={() => setSelected(isSelected ? null : i)}>
                    <th>
                      <button className="link" aria-expanded={isSelected}>
                        {h.number}
                      </button>
                    </th>
                    <td>{h.par}</td>
                    <td>
                      <span className={`score ${scoreClass(score?.strokes, h.par)}`}>
                        {score ? (score.strokes ?? '–') : ''}
                      </span>
                    </td>
                    <td>{score?.putts ?? ''}</td>
                    <td aria-label={score?.teeResult && t(`teeResult.${score.teeResult}`)}>
                      {score?.teeResult ? TEE_RESULT_MARK[score.teeResult] : ''}
                    </td>
                    <td className={holeStatus(h) === 'mismatch' ? 'error' : 'muted'} title={status && t(status.label)}>
                      {status && <span aria-label={t(status.label)}>{status.mark}</span>}
                    </td>
                  </tr>
                  {isSelected && (
                    <tr className="scorecard-entry">
                      <td colSpan={6}>
                        <HoleScoreEntry
                          hole={h}
                          t={t}
                          onChange={(score) => save(i, score)}
                          shotsLink={`/rounds/${round.id}?h=${i}`}
                          onNext={i < round.holes.length - 1 ? () => setSelected(i + 1) : undefined}
                          onClose={() => setSelected(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {segments(round).map((seg) => {
              const s = segmentTotals(seg.holes);
              return (
                <tr key={seg.key} className="total">
                  <th>{t(seg.label)}</th>
                  <td>{s.par}</td>
                  <td>{s.strokes ?? ''}</td>
                  <td>{s.putts ?? ''}</td>
                  <td />
                  <td />
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted legend">{t('scorecard.legend')}</p>
      </section>

      <div className="stack round-actions">
        <Link className="button" to={`/rounds/${round.id}/summary`}>
          {t('round.summary')}
        </Link>
        {!round.finishedAt && <button onClick={finish}>{t('round.finish')}</button>}
      </div>
    </>
  );
}

interface EntryProps {
  hole: RoundHole;
  t: Translate;
  onChange: (score: HoleScore | undefined) => void;
  shotsLink: string;
  onNext?: () => void;
  onClose: () => void;
}

const PICKED_UP = 'pickedUp';

/** Quick entry of one Hole Score. Every tap saves; the first change to a Detailed hole fixes its Hole Score. */
function HoleScoreEntry({ hole, t, onChange, shotsLink, onNext, onClose }: EntryProps) {
  const current = effectiveScore(hole);
  const follows = !hole.score && current !== null;
  const first = Math.max(1, hole.par - 2);
  const strokeOptions = [...Array.from({ length: hole.par + 5 - first }, (_, k) => String(first + k)), PICKED_UP];
  const strokesValue = current ? (current.strokes === null ? PICKED_UP : String(current.strokes)) : undefined;
  const other = current?.strokes != null && !strokeOptions.includes(String(current.strokes));
  const update = (patch: Partial<HoleScore>) => onChange({ strokes: current?.strokes ?? hole.par, ...current, ...patch });
  const optional = <K extends keyof HoleScore>(key: K, value: HoleScore[K] | undefined) => {
    const next: HoleScore = { strokes: current?.strokes ?? null, ...current };
    if (value === undefined) delete next[key];
    else next[key] = value;
    onChange(next);
  };

  return (
    <div className="hole-score-entry">
      <div className="field">
        <span>{t('scorecard.strokes')}</span>
        <Chips
          options={strokeOptions}
          value={other ? undefined : strokesValue}
          onChange={(v) => v && update({ strokes: v === PICKED_UP ? null : Number(v) })}
          label={(v) => (v === PICKED_UP ? '–' : v)}
          columns={4}
          ariaLabel={t('scorecard.strokes')}
        />
        <label className="row other-strokes">
          <span className="muted">{t('scorecard.other')}</span>
          <NumberField
            value={other ? current!.strokes! : 0}
            integer
            blankZero
            label={`${t('scorecard.strokes')} ${t('scorecard.other')}`}
            onChange={(v) => v > 0 && update({ strokes: v })}
          />
        </label>
      </div>

      {current && (
        <>
          <div className="field">
            <span>
              {t('scorecard.putts')} <small>({t('shot.optional')})</small>
            </span>
            <Chips
              options={['0', '1', '2', '3', '4'] as const}
              value={current?.putts === undefined ? undefined : (String(current.putts) as '0')}
              onChange={(v) => optional('putts', v === undefined ? undefined : Number(v))}
              optional
              label={(v) => v}
              columns={5}
              ariaLabel={t('scorecard.putts')}
            />
          </div>

          {hole.par >= 4 && (
            <div className="field">
              <span>
                {t('scorecard.teeResult')} <small>({t('shot.optional')})</small>
              </span>
              <Chips
                options={TEE_RESULTS}
                value={current?.teeResult}
                onChange={(v) => optional('teeResult', v)}
                optional
                label={(v) => t(`teeResult.${v}`)}
                columns={3}
                ariaLabel={t('scorecard.teeResult')}
              />
            </div>
          )}

          <div className="field">
            <span>
              {t('scorecard.penalties')} <small>({t('shot.optional')})</small>
            </span>
            <Chips
              options={['0', '1', '2', '3'] as const}
              value={current?.penaltyStrokes === undefined ? undefined : (String(current.penaltyStrokes) as '0')}
              onChange={(v) => optional('penaltyStrokes', v === undefined ? undefined : Number(v))}
              optional
              label={(v) => v}
              columns={4}
              ariaLabel={t('scorecard.penalties')}
            />
          </div>
        </>
      )}

      {follows && <p className="muted">{t('scorecard.followsShots')}</p>}

      <div className="row">
        {onNext ? (
          <button className="primary grow" onClick={onNext}>
            {t('scorecard.next')} ›
          </button>
        ) : (
          <button className="primary grow" onClick={onClose}>
            {t('scorecard.close')}
          </button>
        )}
        <Link className="button grow" to={shotsLink}>
          {t('scorecard.shots')} ›
        </Link>
      </div>
      {hole.score && (
        <button className="link danger" onClick={() => onChange(undefined)}>
          {t('scorecard.clear')}
        </button>
      )}
    </div>
  );
}
