import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { roundTotals } from '../domain/round';
import type { Round } from '../domain/types';
import { useT, type Translate } from '../i18n/i18n';

export function formatToPar(strokes: number, par: number): string {
  const d = strokes - par;
  return d === 0 ? 'E' : d > 0 ? `+${d}` : String(d);
}

function RoundItem({ round, t }: { round: Round; t: Translate }) {
  const totals = roundTotals(round);
  const date = new Date(round.startedAt).toLocaleDateString();
  return (
    <li>
      <Link className="list-link" to={round.finishedAt ? `/rounds/${round.id}/summary` : `/rounds/${round.id}/scorecard`}>
        <span className="row">
          <strong className="grow">{round.courseName}</strong>
          {totals.holesCompleted > 0 && (
            <strong>
              {totals.strokes} ({formatToPar(totals.strokes, totals.par)})
            </strong>
          )}
        </span>
        <small className="muted">
          {date} · {round.teeName} · {t('rounds.holesPlayed', { n: totals.holesCompleted })}
        </small>
      </Link>
    </li>
  );
}

export function RoundsPage() {
  const t = useT();
  const rounds = useLiveQuery(() => db.rounds.orderBy('startedAt').reverse().toArray());
  const courseCount = useLiveQuery(() => db.courses.count());
  if (!rounds || courseCount === undefined) return null;
  const active = rounds.filter((r) => !r.finishedAt);
  const finished = rounds.filter((r) => r.finishedAt);

  return (
    <>
      <h1>{t('rounds.title')}</h1>
      {courseCount === 0 ? (
        <p className="muted">
          {t('rounds.noCourses')} <Link to="/courses">{t('nav.courses')}</Link>
        </p>
      ) : (
        <Link className="button primary block" to="/rounds/new">
          {t('rounds.new')}
        </Link>
      )}
      {active.length > 0 && (
        <>
          <h2 className="section">{t('rounds.active')}</h2>
          <ul className="list card">
            {active.map((r) => (
              <RoundItem key={r.id} round={r} t={t} />
            ))}
          </ul>
        </>
      )}
      <h2 className="section">{t('rounds.finished')}</h2>
      {finished.length === 0 ? (
        <p className="muted">{t('rounds.empty')}</p>
      ) : (
        <ul className="list card">
          {finished.map((r) => (
            <RoundItem key={r.id} round={r} t={t} />
          ))}
        </ul>
      )}
    </>
  );
}
