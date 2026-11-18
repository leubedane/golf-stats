import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import {
  currentHoleIndex,
  deleteShot,
  finishHole,
  finishRound,
  holeScore,
  reopenHole,
  roundTotals,
  saveShot,
} from '../domain/round';
import type { Round, RoundHole, Shot } from '../domain/types';
import { useT, type Translate } from '../i18n/i18n';
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
  const [editingId, setEditingId] = useState<string | null>(null);

  const history = useMemo(
    () => (allRounds ?? []).flatMap((r) => r.holes.flatMap((h) => h.shots)),
    [allRounds],
  );

  if (round === undefined || !bag) return null;
  if (round === null) return <p>Round not found.</p>;

  const requested = Number(params.get('h'));
  const holeIndex = params.has('h') && requested >= 0 && requested < round.holes.length ? requested : currentHoleIndex(round);
  const hole: RoundHole = round.holes[holeIndex];
  const totals = roundTotals(round);
  const score = holeScore(hole);
  const editingIndex = hole.shots.findIndex((s) => s.id === editingId);
  const isLast = holeIndex === round.holes.length - 1;

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
    navigate('/');
  }

  async function remove() {
    if (!confirm(t('common.confirmDelete', { name: round!.courseName }))) return;
    await db.rounds.delete(round!.id);
    navigate('/');
  }

  return (
    <>
      <Link to="/" className="back">
        ← {t('nav.rounds')}
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
      </div>

      <section className="card">
        <h2>{t('round.shots')}</h2>
        {hole.shots.length === 0 ? (
          <p className="muted">{t('round.noShots')}</p>
        ) : (
          <ol className="shots">
            {hole.shots.map((s) => (
              <li key={s.id}>
                <button className={`shot-row ${s.id === editingId ? 'selected' : ''}`} onClick={() => setEditingId(s.id === editingId ? null : s.id)}>
                  {shotSummary(s, t)}
                </button>
              </li>
            ))}
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
      ) : (
        <ShotForm
          key={`new-${hole.number}-${hole.shots.length}`}
          hole={hole}
          bag={bag}
          history={history}
          t={t}
          onSubmit={onSubmit}
          onPickUp={async (lie, distanceM) => {
            await persist(finishHole(round, holeIndex, { kind: 'pickedUp', lie, distanceM }));
            if (!isLast) goToHole(holeIndex + 1);
          }}
        />
      )}

      <div className="stack round-actions">
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
