import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { courseDisplayName } from '../domain/course';
import type { Course } from '../domain/types';
import { useT } from '../i18n/i18n';
import type { MessageKey } from '../i18n/en';

const SOURCE_LABEL: Record<Course['source'], MessageKey> = {
  api: 'courses.fromApi',
  pccaddie: 'courses.fromPcCaddie',
  manual: 'courses.manualSource',
};

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
                  {t(SOURCE_LABEL[c.source])}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
