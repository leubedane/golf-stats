import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chips } from '../components/Chips';
import { SgBars, formatSg } from '../components/SgBars';
import { SideBar } from '../components/SideBar';
import { TrendChart } from '../components/TrendChart';
import { classLabel } from '../components/labels';
import { db } from '../db/db';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { MissSide, ShotShape } from '../domain/types';
import { useT } from '../i18n/i18n';
import {
  averagePerRound,
  orderByBag,
  puttingByBand,
  roundTrend,
  sgByClub,
  sgByShortGameType,
  tendenciesByClub,
} from '../stats/stats';
import { baselineFor } from '../strokesGained/baselines';
import { SG_CATEGORIES, type SgCategory } from '../strokesGained/strokesGained';

const RANGES = ['5', '10', '20', 'all'] as const;
type Range = (typeof RANGES)[number];
const SHORT_GAME_ORDER = ['chipFlat', 'chipHighSpin', 'chipHigh', 'pitch', 'bunkerShot', 'fringePutt'] as const;

export function StatsPage() {
  const t = useT();
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const finished = useLiveQuery(() => db.rounds.orderBy('startedAt').reverse().filter((r) => Boolean(r.finishedAt)).toArray());
  const bag = useLiveQuery(() => db.clubs.orderBy('order').toArray());
  const [classId, setClassId] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('10');
  const [trendCategory, setTrendCategory] = useState<SgCategory | 'total'>('total');

  const s = settings ?? DEFAULT_SETTINGS;
  const classes = [
    ...s.handicapClasses.filter((c) => c.id === s.primaryHandicapClassId),
    ...s.handicapClasses.filter((c) => c.id !== s.primaryHandicapClassId),
  ];
  const selected = classes.find((c) => c.id === classId) ?? classes[0];
  const rounds = useMemo(
    () => (finished ?? []).slice(0, range === 'all' ? undefined : Number(range)),
    [finished, range],
  );
  const baseline = useMemo(() => baselineFor(selected, s), [selected, s]);
  const stats = useMemo(() => {
    const trend = roundTrend(rounds, baseline);
    return {
      trend,
      average: averagePerRound(trend),
      clubs: sgByClub(rounds, baseline),
      shortGame: sgByShortGameType(rounds, baseline),
      putting: puttingByBand(rounds, baseline),
      tendencies: tendenciesByClub(rounds),
    };
  }, [rounds, baseline]);

  if (!settings || !finished || !bag) return null;
  const bagNames = bag.map((c) => c.name);
  const catLabel = (c: SgCategory | 'total') => t(`sg.${c}`);
  const shotsDetail = (n: number, sg: number) => t('stats.shotsTotal', { n, total: formatSg(sg) });

  if (finished.length === 0) {
    return (
      <>
        <h1>{t('stats.title')}</h1>
        <p className="muted">{t('stats.empty')}</p>
        <Link to="/rounds/new" className="button primary block">{t('rounds.new')}</Link>
      </>
    );
  }

  return (
    <>
      <h1>{t('stats.title')}</h1>
      <div className="row filters">
        <label className="field grow">
          <span>{t('summary.compareWith')}</span>
          <select value={selected.id} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{classLabel(c, s, t)}</option>
            ))}
          </select>
        </label>
        <label className="field grow">
          <span>{t('stats.rounds')}</span>
          <select value={range} onChange={(e) => setRange(e.target.value as Range)}>
            {RANGES.map((r) => (
              <option key={r} value={r}>{r === 'all' ? t('stats.allRounds') : t('stats.lastN', { n: r })}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="stat-tiles two">
        <div className="card stat">
          <small className="muted">{t('stats.roundsCount')}</small>
          <strong>{rounds.length}</strong>
        </div>
        <div className="card stat">
          <small className="muted">{t('stats.avgPerRound')}</small>
          <strong>{stats.average ? formatSg(stats.average.total) : '–'}</strong>
          <small className="muted">{t('summary.vs', { cls: classLabel(selected, s, t) })}</small>
        </div>
      </section>

      {stats.average && (
        <section className="card">
          <h2>{t('stats.avgByCategory')}</h2>
          <SgBars
            ariaLabel={t('stats.avgByCategory')}
            bars={SG_CATEGORIES.map((c) => ({ key: c, label: catLabel(c), value: stats.average![c] }))}
            total={{ key: 'total', label: catLabel('total'), value: stats.average.total }}
          />
          {selected.kind !== 'pga' && <p className="muted legend">{t('summary.modeledNote')}</p>}
        </section>
      )}

      <section className="card">
        <h2>{t('stats.trend')}</h2>
        <Chips
          options={['total', ...SG_CATEGORIES] as const}
          value={trendCategory}
          onChange={(v) => v && setTrendCategory(v)}
          label={(v) => catLabel(v)}
          columns={3}
          ariaLabel={t('stats.trend')}
        />
        <TrendChart
          ariaLabel={`${t('stats.trend')}: ${catLabel(trendCategory)}`}
          format={formatSg}
          points={stats.trend.map((p) => ({
            key: p.roundId,
            value: p.sg[trendCategory],
            label: `${new Date(p.startedAt).toLocaleDateString()} · ${p.courseName}`,
          }))}
        />
      </section>

      <section className="card">
        <h2>{t('stats.byClub')}</h2>
        <p className="muted legend">{t('stats.perShotNote')}</p>
        <SgBars
          ariaLabel={t('stats.byClub')}
          bars={orderByBag(stats.clubs, (g) => g.key, bagNames).map((g) => ({
            key: g.key,
            label: g.key,
            value: g.sgPerShot,
            detail: shotsDetail(g.shots, g.sg),
          }))}
        />
      </section>

      <section className="card">
        <h2>{t('stats.shortGame')}</h2>
        {stats.shortGame.length === 0 ? (
          <p className="muted">{t('summary.noShots')}</p>
        ) : (
          <>
            <p className="muted legend">{t('stats.perShotNote')}</p>
            <SgBars
              ariaLabel={t('stats.shortGame')}
              bars={SHORT_GAME_ORDER.flatMap((k) => {
                const g = stats.shortGame.find((x) => x.key === k);
                return g ? [{ key: k, label: t(`sgt.${k}`), value: g.sgPerShot, detail: shotsDetail(g.shots, g.sg) }] : [];
              })}
            />
          </>
        )}
      </section>

      <section className="card">
        <h2>{t('stats.putting')}</h2>
        <table className="data">
          <thead>
            <tr>
              <th>{t('stats.distance')}</th>
              <th>{t('stats.putts')}</th>
              <th>{t('stats.holedPct')}</th>
              <th>{t('stats.sgPerPutt')}</th>
            </tr>
          </thead>
          <tbody>
            {stats.putting.map((b) => (
              <tr key={b.key}>
                <th>{b.key} m</th>
                <td>{b.shots}</td>
                <td>{b.shots ? `${Math.round((b.holed / b.shots) * 100)}%` : '–'}</td>
                <td>{b.shots ? formatSg(b.sgPerShot) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>{t('stats.tendencies')}</h2>
        {stats.tendencies.length === 0 ? (
          <p className="muted">{t('stats.noTendencies')}</p>
        ) : (
          <>
            <p className="muted legend">
              <span className="swatch side-left" /> {t('missSide.left')} <span className="swatch side-onTarget" /> {t('missSide.onTarget')}{' '}
              <span className="swatch side-right" /> {t('missSide.right')}
            </p>
            <ul className="list tendencies">
              {orderByBag(stats.tendencies, (x) => x.clubName, bagNames).map((x) => {
                const sideTotal = x.side.left + x.side.onTarget + x.side.right;
                const pct = (k: MissSide) => (sideTotal ? Math.round((x.side[k] / sideTotal) * 100) : 0);
                const shapes = (Object.entries(x.shapes) as [ShotShape, number][]).sort((a, b) => b[1] - a[1]);
                return (
                  <li key={x.clubName}>
                    <div className="row">
                      <strong className="club-name">{x.clubName}</strong>
                      <SideBar side={x.side} label={x.clubName} />
                    </div>
                    <small className="muted">
                      {sideTotal > 0 && `L ${pct('left')}% · ${pct('onTarget')}% · R ${pct('right')}%`}
                      {sideTotal > 0 && shapes.length > 0 && ' · '}
                      {shapes.map(([k, n]) => `${t(`shape.${k}`)} ${n}`).join(', ')}
                    </small>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
