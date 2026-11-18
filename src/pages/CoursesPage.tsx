import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { courseDisplayName } from '../domain/course';
import { useT } from '../i18n/i18n';

export function CoursesPage() {
  const t = useT();
  const courses = useLiveQuery(() => db.courses.orderBy('clubName').toArray());
  if (!courses) return null;

  return (
    <>
      <h1>{t('courses.title')}</h1>
      <div className="row">
        <Link className="button primary grow" to="/courses/search">
          {t('courses.search')}
        </Link>
        <Link className="button grow" to="/courses/new">
          {t('courses.manual')}
        </Link>
      </div>
      {courses.length === 0 ? (
        <p className="muted">{t('courses.empty')}</p>
      ) : (
        <ul className="list card">
          {courses.map((c) => (
            <li key={c.id}>
              <Link className="list-link" to={`/courses/${c.id}`}>
                <strong>{courseDisplayName(c)}</strong>
                <small className="muted">
                  {[c.city, c.country].filter(Boolean).join(', ')} · {t('courses.tees', { n: c.tees.length })} ·{' '}
                  {c.source === 'api' ? t('courses.fromApi') : t('courses.manualSource')}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
