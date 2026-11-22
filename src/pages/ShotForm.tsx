import { useEffect, useState } from 'react';
import { Chips } from '../components/Chips';
import { NumberField } from '../components/NumberField';
import {
  defaultShortGameType,
  isAroundTheGreen,
  isFullShot,
  isPutt,
  newShot,
  nextShotDraft,
  suggestClub,
  validateShot,
  type ShotProblem,
} from '../domain/round';
import type { ShotPlan } from '../domain/holeScore';
import type {
  Break,
  Club,
  Lie,
  MissLength,
  MissSide,
  RoundHole,
  ShortGameType,
  Shot,
  ShotShape,
} from '../domain/types';
import type { Translate } from '../i18n/i18n';

const LIES: Lie[] = ['tee', 'fairway', 'rough', 'bunker', 'fringe', 'recovery', 'green'];
const SIDES: MissSide[] = ['left', 'onTarget', 'right'];
const LENGTHS: MissLength[] = ['short', 'good', 'long'];
const SHAPES: ShotShape[] = ['hook', 'draw', 'straight', 'fade', 'slice'];
const SHORT_GAME: ShortGameType[] = ['chipFlat', 'chipHighSpin', 'chipHigh', 'pitch', 'bunkerShot', 'fringePutt'];
const BREAKS: Break[] = ['leftToRight', 'straight', 'rightToLeft'];

interface Props {
  hole: RoundHole;
  bag: Club[];
  history: Shot[];
  t: Translate;
  /** Shot being edited; a new Shot is drafted when absent. */
  editing?: { shot: Shot; index: number };
  /** What the entered Hole Score says about the next Shot. */
  plan?: ShotPlan;
  /** The Hole Strategy's Tee Club, preselected for the first Shot. */
  teeClubId?: string | null;
  onSubmit: (shot: Shot, action: 'next' | 'holed' | 'update') => void;
  onPickUp: (lie: Lie, distanceM: number) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

export function ShotForm({ hole, bag, history, t, editing, plan, teeClubId, onSubmit, onPickUp, onDelete, onCancel }: Props) {
  const initial = editing?.shot;
  const draft = nextShotDraft(hole);
  const firstShot = !initial && hole.shots.length === 0;
  // The Hole Strategy's Tee Club wins over the history suggestion, for the first Shot only.
  const strategyClub = firstShot && teeClubId && bag.some((c) => c.id === teeClubId) ? teeClubId : null;
  const [lie, setLie] = useState<Lie | null>(initial?.lie ?? draft.lie ?? plan?.lie ?? null);
  const [distanceM, setDistanceM] = useState(initial?.distanceM ?? draft.distanceM);
  const [clubId, setClubId] = useState<string | null>(initial?.clubId ?? strategyClub);
  const [clubTouched, setClubTouched] = useState(Boolean(initial) || strategyClub !== null);
  const [shortGameType, setShortGameType] = useState(initial?.shortGameType);
  const [shape, setShape] = useState(initial?.shape);
  const [missSide, setMissSide] = useState(initial?.missSide ?? (firstShot ? plan?.missSide : undefined));
  const [missLength, setMissLength] = useState(initial?.missLength);
  const [brk, setBreak] = useState(initial?.break);
  const [penalty, setPenalty] = useState<0 | 1 | 2>(initial?.penaltyStrokes ?? 0);
  const [problems, setProblems] = useState<(ShotProblem | 'lieMissing')[]>([]);

  // Keep suggesting a club until the golfer picks one.
  useEffect(() => {
    if (clubTouched || !lie) return;
    setClubId(suggestClub(bag, history, lie, distanceM, hole.par)?.id ?? null);
  }, [lie, distanceM, clubTouched, bag, history, hole.par]);

  function changeLie(next: Lie) {
    setLie(next);
    const implied = defaultShortGameType(next);
    setShortGameType((current) =>
      implied ?? (current === 'bunkerShot' || current === 'fringePutt' ? undefined : current),
    );
  }

  function build(): Shot | null {
    if (!lie) {
      setProblems(['lieMissing']);
      return null;
    }
    const club = bag.find((c) => c.id === clubId);
    const base = initial ?? newShot({ lie, distanceM });
    const shot: Shot = {
      ...base,
      lie,
      distanceM,
      // A Club removed from the Bag since the Shot keeps its recorded name.
      clubId: club ? club.id : clubId === base.clubId ? base.clubId : null,
      clubName: club ? club.name : clubId === base.clubId ? base.clubName : '',
      penaltyStrokes: penalty,
      shortGameType,
      shape,
      missSide,
      missLength,
      break: brk,
    };
    const found = validateShot(shot);
    setProblems(found);
    return found.length === 0 ? shot : null;
  }

  function submit(action: 'next' | 'holed' | 'update') {
    const shot = build();
    if (shot) onSubmit(shot, action);
  }

  function pickUp() {
    if (!lie || !(distanceM > 0)) {
      setProblems(lie ? ['distanceInvalid'] : ['lieMissing']);
      return;
    }
    onPickUp(lie, distanceM);
  }

  // The Hole Score says this is the last Shot: holing out becomes the main action.
  const lastExpected = !editing && plan?.expectedShots === hole.shots.length + 1;
  const putt = lie !== null && isPutt(lie);
  const aroundGreen = lie !== null && isAroundTheGreen(lie, distanceM);
  const fullShot = lie !== null && isFullShot(lie, distanceM);
  const clubs = putt
    ? [...bag.filter((c) => c.kind === 'putter'), ...bag.filter((c) => c.kind !== 'putter')]
    : bag;

  return (
    <section className="card shot-form">
      <h2>
        {editing
          ? t('round.editShot', { n: editing.index + 1 })
          : plan?.expectedShots
            ? t('round.shotOf', { n: hole.shots.length + 1, m: plan.expectedShots })
            : t('round.shotN', { n: hole.shots.length + 1 })}
      </h2>

      <div className="field">
        <span>{t('shot.lie')}</span>
        <Chips options={LIES} value={lie} onChange={(v) => v && changeLie(v)} label={(v) => t(`lie.${v}`)} columns={4} ariaLabel={t('shot.lie')} />
      </div>

      <label className="field">
        <span>{putt ? t('shot.distanceGreen') : t('shot.distance')}</span>
        <NumberField className="big-number" value={distanceM} blankZero onChange={setDistanceM} label={t('shot.distance')} />
      </label>

      <div className="field">
        <span>{t('shot.club')}</span>
        <Chips
          options={clubs.map((c) => c.id)}
          value={clubId}
          onChange={(v) => {
            setClubId(v ?? null);
            setClubTouched(true);
          }}
          label={(id) => bag.find((c) => c.id === id)?.name ?? '?'}
          columns={5}
          ariaLabel={t('shot.club')}
        />
      </div>

      {aroundGreen && (
        <div className="field">
          <span>{t('shot.shortGameType')}</span>
          <Chips options={SHORT_GAME} value={shortGameType} onChange={setShortGameType} label={(v) => t(`sgt.${v}`)} columns={3} ariaLabel={t('shot.shortGameType')} />
        </div>
      )}

      {fullShot && (
        <div className="field">
          <span>
            {t('shot.shape')} <small>({t('shot.optional')})</small>
          </span>
          <Chips options={SHAPES} value={shape} onChange={setShape} optional label={(v) => t(`shape.${v}`)} columns={5} ariaLabel={t('shot.shape')} />
        </div>
      )}

      <div className="field">
        <span>
          {t('shot.missSide')} <small>({t('shot.optional')})</small>
        </span>
        <Chips options={SIDES} value={missSide} onChange={setMissSide} optional label={(v) => t(`missSide.${v}`)} columns={3} ariaLabel={t('shot.missSide')} />
      </div>

      {lie !== 'tee' && (
        <div className="field">
          <span>
            {t('shot.missLength')} <small>({t('shot.optional')})</small>
          </span>
          <Chips options={LENGTHS} value={missLength} onChange={setMissLength} optional label={(v) => t(`missLength.${v}`)} columns={3} ariaLabel={t('shot.missLength')} />
        </div>
      )}

      {putt && (
        <div className="field">
          <span>
            {t('shot.break')} <small>({t('shot.optional')})</small>
          </span>
          <Chips options={BREAKS} value={brk} onChange={setBreak} optional label={(v) => t(`break.${v}`)} columns={3} ariaLabel={t('shot.break')} />
        </div>
      )}

      {!putt && (
        <div className="field">
          <span>{t('shot.penalty')}</span>
          <Chips
            options={['0', '1', '2'] as const}
            value={String(penalty) as '0' | '1' | '2'}
            onChange={(v) => setPenalty(Number(v ?? 0) as 0 | 1 | 2)}
            label={(v) => (v === '0' ? '0' : `+${v}`)}
            columns={3}
            ariaLabel={t('shot.penalty')}
          />
        </div>
      )}

      {problems.length > 0 && (
        <ul className="error">
          {problems.map((p) => (
            <li key={p}>{t(`shot.problem.${p}`)}</li>
          ))}
        </ul>
      )}

      {editing ? (
        <div className="stack">
          <button className="primary" onClick={() => submit('update')}>
            {t('shot.update')}
          </button>
          <div className="row">
            <button className="grow" onClick={onCancel}>
              {t('shot.cancelEdit')}
            </button>
            <button className="grow danger" onClick={onDelete}>
              {t('shot.deleteShot')}
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="row">
            <button className={`grow ${lastExpected ? '' : 'primary'}`} onClick={() => submit('next')}>
              {t('shot.next')}
            </button>
            <button className={`grow ${lastExpected ? 'primary' : 'holed'}`} onClick={() => submit('holed')}>
              {t('shot.holed')}
            </button>
          </div>
          {hole.shots.length > 0 && (
            <button className="link muted" onClick={pickUp}>
              {t('shot.pickUp')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
