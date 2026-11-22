import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { HoleStrategyCard } from '../components/HoleStrategyCard';
import { HoleMapCard } from '../components/MapDrawing';
import { db, saveStrategy } from '../db/db';
import { strategyId } from '../domain/holeStrategy';
import { effectiveScore, scoreMismatches, shotPlan, shotsScore } from '../domain/holeScore';
import {
  currentHoleIndex,
  deleteShot,
  finishHole,
  finishRound,
  reopenHole,
  roundTotals,
  saveShot,
} from '../domain/round';
import type { Round, RoundHole, Shot } from '../domain/types';
import { useT, type Translate } from '../i18n/i18n';
import { classLabel } from '../components/labels';
import { formatSg } from '../components/SgBars';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { baselineFor } from '../strokesGained/baselines';
import { shotStrokesGained } from '../strokesGained/strokesGained';
import { formatToPar } from './RoundsPage';
import { ShotForm } from './ShotForm';

function formatDistance(m: number): string {
  return Number.isInteger(m) ? String(m) : m.toFixed(1);
}

function shotSummary(shot: Shot, t: Translate): string {
  const parts = [t(`lie.${shot.lie}`), `${formatDistance(shot.distanceM)} m`, shot.clubName];
  if (shot.shortGameType) parts.push(t(`sgt.${shot.shortGameType}`));
  if (shot.shape) parts.push(t(`shape.${shot.shape}`));
  if (shot.missSide && shot.missSide !== 'onTarget') parts.push(t(`missSide.${shot.missSide}`));
  if (shot.missLength && shot.missLength !== 'good') parts.push(t(`missLength.${shot.missLength}`));
  if (shot.penaltyStrokes) parts.push(`+${shot.penaltyStrokes}`);
  return parts.filter(Boolean).join(' · ');
}

export function RoundPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const round = useLiveQuery(() => db.rounds.get(id ?? ''), [id]);
  const bag = useLiveQuery(() => db.clubs.orderBy('order').toArray());
  const allRounds = useLiveQuery(() => db.rounds.toArray());
  const settings = useLiveQuery(() => db.settings.get('settings')) ?? DEFAULT_SETTINGS;
  const [editingId, setEditingId] = useState<string | null>(null);
  const requested = Number(params.get('h'));
  const holeIndex =
    round && params.has('h') && requested >= 0 && requested < round.holes.length ? requested : round ? currentHoleIndex(round) : 0;
  const holeNumber = round?.holes[holeIndex]?.number;
  // null once loaded without a Hole Strategy, undefined while loading.
  const strategy = useLiveQuery(
    async () => (round && holeNumber ? ((await db.holeStrategies.get(strategyId(round.courseId, holeNumber))) ?? null) : undefined),
    [round?.courseId, holeNumber],
  );
  // null once loaded without a Course Map.
  const courseMap = useLiveQuery(async () => (round ? ((await db.courseMaps.get(round.courseId)) ?? null) : undefined), [round?.courseId]);

  const history = useMemo(
    () => (allRounds ?? []).flatMap((r) => r.holes.flatMap((h) => h.shots)),
    [allRounds],
  );

  if (round === undefined || !bag) return null;
  if (round === null) return <p>Round not found.</p>;

  const hole: RoundHole = round.holes[holeIndex];
  const totals = roundTotals(round);
  const score = shotsScore(hole);
  const entered = hole.score ? effectiveScore(hole) : null;
  const mismatches = scoreMismatches(hole);
  const plan = shotPlan(hole);
  const editingIndex = hole.shots.findIndex((s) => s.id === editingId);
  const isLast = holeIndex === round.holes.length - 1;
  const primaryClass =
    settings.handicapClasses.find((c) => c.id === settings.primaryHandicapClassId) ?? settings.handicapClasses[0];
  const baseline = baselineFor(primaryClass, settings);

  const goToHole = (i: number) => {
    setEditingId(null);
    setParams({ h: String(i) }, { replace: true });
    window.scrollTo(0, 0);
  };
  const persist = (next: Round) => db.rounds.put(next);

  async function onSubmit(shot: Shot, action: 'next' | 'holed' | 'update') {
    let next = saveShot(round!, holeIndex, shot);
    if (action === 'holed') next = finishHole(next, holeIndex, { kind: 'holed' });
    await persist(next);
    setEditingId(null);
    if (action === 'holed' && !isLast) goToHole(holeIndex + 1);
  }

  async function finish() {
    if (!confirm(t('round.finishConfirm'))) return;
    await persist(finishRound(round!));
    navigate(`/rounds/${round!.id}/summary`);
  }

  async function remove() {
    if (!confirm(t('common.confirmDelete', { name: round!.courseName }))) return;
    await db.rounds.delete(round!.id);
    navigate('/');
  }

  return (
    <>
      <Link to={`/rounds/${round.id}/scorecard`} className="back">
        ← {t('round.scorecard')}
      </Link>
      <div className="round-header">
        <small className="muted">{round.courseName} · {round.teeName}</small>
        <div className="row">
          <button className="icon" aria-label={t('round.prevHole')} disabled={holeIndex === 0} onClick={() => goToHole(holeIndex - 1)}>
            ‹
          </button>
          <div className="grow center">
            <h1>{t('round.hole', { n: hole.number })}</h1>
            <small className="muted">{t('round.parLength', { par: hole.par, length: hole.lengthM, si: hole.strokeIndex })}</small>
          </div>
          <button className="icon" aria-label={t('round.nextHole')} disabled={isLast} onClick={() => goToHole(holeIndex + 1)}>
            ›
          </button>
        </div>
        {totals.holesCompleted > 0 && (
          <p className="center muted">
            {t('round.score')}: <strong>{totals.strokes}</strong> ({t('round.toPar', { n: formatToPar(totals.strokes, totals.par) })}) ·{' '}
            {t('rounds.holesPlayed', { n: totals.holesCompleted })}
          </p>
        )}
        {entered && (
          <p className="center">
            {t('round.holeScoreLine', { score: entered.strokes ?? t('round.pickedUp') })}
            {entered.putts !== undefined && ` · ${t('round.puttsN', { n: entered.putts })}`}
            {entered.teeResult && ` · ${t(`teeResult.${entered.teeResult}`)}`}
          </p>
        )}
        {mismatches.length > 0 && (
          <p className="center error">
            ⚠ {t('mismatch.warning', { fields: mismatches.map((m) => t(`mismatch.${m}`)).join(', ') })}
          </p>
        )}
      </div>

      {strategy !== undefined && (
        <HoleStrategyCard
          key={hole.number}
          courseId={round.courseId}
          hole={hole}
          strategy={strategy ?? undefined}
          bag={bag}
          t={t}
          onSave={(s) => saveStrategy(s)}
        />
      )}

      <HoleMapCard courseMap={courseMap} holeNumber={hole.number} t={t} rememberOpen />

      <section className="card">
        <div className="row">
          <h2 className="grow">{t('round.shots')}</h2>
          <small className="muted">{t('round.sgVs', { cls: classLabel(primaryClass, settings, t) })}</small>
        </div>
        {hole.shots.length === 0 ? (
          <p className="muted">{t('round.noShots')}</p>
        ) : (
          <ol className="shots">
            {hole.shots.map((s, i) => {
              const sg = shotStrokesGained(hole, i, baseline);
              return (
                <li key={s.id}>
                  <button className={`shot-row ${s.id === editingId ? 'selected' : ''}`} onClick={() => setEditingId(s.id === editingId ? null : s.id)}>
                    <span className="grow">{shotSummary(s, t)}</span>
                    {sg !== null && <span className="sg">{formatSg(sg)}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
        {hole.outcome && (
          <p className="outcome">
            {hole.outcome.kind === 'holed'
              ? t('round.holeDone', { score: `${score} (${formatToPar(score!, hole.par)})` })
              : t('round.holePickedUp')}
          </p>
        )}
      </section>

      {editingIndex >= 0 ? (
        <ShotForm
          key={`edit-${editingId}`}
          hole={hole}
          bag={bag}
          history={history}
          t={t}
          editing={{ shot: hole.shots[editingIndex], index: editingIndex }}
          onSubmit={onSubmit}
          onPickUp={() => undefined}
          onCancel={() => setEditingId(null)}
          onDelete={async () => {
            await persist(deleteShot(round, holeIndex, editingId!));
            setEditingId(null);
          }}
        />
      ) : hole.outcome ? (
        <div className="stack">
          {!isLast && (
            <button className="primary" onClick={() => goToHole(holeIndex + 1)}>
              {t('round.nextHole')} ›
            </button>
          )}
          <button onClick={() => persist(reopenHole(round, holeIndex))}>{t('round.reopen')}</button>
        </div>
      ) : strategy === undefined ? null : (
        <ShotForm
          key={`new-${hole.number}-${hole.shots.length}`}
          hole={hole}
          bag={bag}
          history={history}
          t={t}
          plan={plan}
          teeClubId={strategy?.teeClubId ?? null}
          onSubmit={onSubmit}
          onPickUp={async (lie, distanceM) => {
            await persist(finishHole(round, holeIndex, { kind: 'pickedUp', lie, distanceM }));
            if (!isLast) goToHole(holeIndex + 1);
          }}
        />
      )}

      <div className="stack round-actions">
        <Link className="button" to={`/rounds/${round.id}/summary`}>
          {t('round.summary')}
        </Link>
        {!round.finishedAt && (
          <button className={isLast && hole.outcome ? 'primary' : ''} onClick={finish}>
            {t('round.finish')}
          </button>
        )}
        <button className="link danger" onClick={remove}>
          {t('round.delete')}
        </button>
      </div>
    </>
  );
}
