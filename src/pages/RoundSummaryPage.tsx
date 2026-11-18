import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Chips } from '../components/Chips';
import { SgBars, formatSg } from '../components/SgBars';
import { classLabel } from '../components/labels';
import { db } from '../db/db';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { roundTotals } from '../domain/round';
import { useT } from '../i18n/i18n';
import { baselineFor } from '../strokesGained/baselines';
import { SG_CATEGORIES } from '../strokesGained/strokesGained';
import { summarizeRound } from '../strokesGained/summary';
import { formatToPar } from './RoundsPage';

export function RoundSummaryPage() {
  const t = useT();
  const { id } = useParams();
  const round = useLiveQuery(() => db.rounds.get(id ?? ''), [id]);
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const [classId, setClassId] = useState<string | null>(null);

  if (round === undefined || settings === undefined) return null;
  if (round === null) return <p>Round not found.</p>;
  const s = settings ?? DEFAULT_SETTINGS;

  // Primary class first, then the rest in their configured order.
  const classes = [
    ...s.handicapClasses.filter((c) => c.id === s.primaryHandicapClassId),
    ...s.handicapClasses.filter((c) => c.id !== s.primaryHandicapClassId),
  ];
  const selected = classes.find((c) => c.id === classId) ?? classes[0];
  const summaries = classes.map((cls) => ({ cls, summary: summarizeRound(round, baselineFor(cls, s)) }));
  const current = summaries.find((x) => x.cls.id === selected.id)!.summary;
  const totals = roundTotals(round);
  const catLabel = (c: string) => t(`sg.${c}` as 'sg.total');

  const bars = [
    ...SG_CATEGORIES.map((c) => ({
      key: c,
      label: catLabel(c),
      value: current.sg[c],
      detail: current.shotCount[c]
        ? t('summary.perShot', { n: current.shotCount[c], avg: formatSg(current.sg[c] / current.shotCount[c]) })
        : t('summary.noShots'),
    })),
  ];
  const totalBar = { key: 'total', label: catLabel('total'), value: current.sg.total };

  return (
    <>
      <Link to="/" className="back">
        ← {t('nav.rounds')}
      </Link>
      <h1>{round.courseName}</h1>
      <p className="muted">
        {new Date(round.startedAt).toLocaleDateString()} · {round.teeName} · CR {round.courseRating} / {round.slope}
      </p>

      <section className="stat-tiles">
        <div className="card stat">
          <small className="muted">{t('round.score')}</small>
          <strong>{totals.holesCompleted ? totals.strokes : '–'}</strong>
          <small className="muted">
            {totals.holesCompleted ? formatToPar(totals.strokes, totals.par) : ''} · {t('rounds.holesPlayed', { n: totals.holesCompleted })}
          </small>
        </div>
        <div className="card stat">
          <small className="muted">{t('summary.sgTotal')}</small>
          <strong>{formatSg(current.sg.total)}</strong>
          <small className="muted">{t('summary.vs', { cls: classLabel(selected, s, t) })}</small>
        </div>
        <div className="card stat">
          <small className="muted">{t('summary.putts')}</small>
          <strong>{current.putts}</strong>
          <small className="muted">{t('summary.penalties', { n: current.penaltyStrokes })}</small>
        </div>
      </section>

      <section className="card">
        <h2>{t('summary.byCategory')}</h2>
        <Chips
          options={classes.map((c) => c.id)}
          value={selected.id}
          onChange={(v) => v && setClassId(v)}
          label={(v) => classLabel(classes.find((c) => c.id === v)!, s, t)}
          columns={3}
          ariaLabel={t('summary.compareWith')}
        />
        <SgBars bars={bars} total={totalBar} ariaLabel={t('summary.byCategory')} />
        <p className="muted legend">
          <span className="swatch gained" /> {t('summary.gained')} <span className="swatch lost" /> {t('summary.lost')}
          {selected.kind !== 'pga' && <> · {t('summary.modeledNote')}</>}
        </p>
      </section>

      <section className="card">
        <h2>{t('summary.allClasses')}</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th />
                {summaries.map(({ cls }) => (
                  <th key={cls.id} className={cls.id === selected.id ? 'selected' : ''}>
                    {classLabel(cls, s, t)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...SG_CATEGORIES, 'total' as const].map((c) => (
                <tr key={c} className={c === 'total' ? 'total' : ''}>
                  <th>{catLabel(c)}</th>
                  {summaries.map(({ cls, summary }) => (
                    <td key={cls.id} className={cls.id === selected.id ? 'selected' : ''}>
                      {formatSg(summary.sg[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>{t('summary.holes')}</h2>
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>{t('course.hole')}</th>
                <th>{t('course.par')}</th>
                <th>{t('round.score')}</th>
                <th>SG</th>
              </tr>
            </thead>
            <tbody>
              {current.holes.map((h) => (
                <tr key={h.number}>
                  <th>
                    <Link to={`/rounds/${round.id}?h=${round.holes.findIndex((x) => x.number === h.number)}`} aria-label={`${t('course.hole')} ${h.number}`}>
                      {h.number}
                    </Link>
                  </th>
                  <td>{h.par}</td>
                  <td>{h.score ?? (h.pickedUp ? t('round.pickedUp') : '–')}</td>
                  <td>{h.sg === null ? '–' : formatSg(h.sg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link className="button block" to={`/rounds/${round.id}`}>
        {t('summary.editShots')}
      </Link>
    </>
  );
}
