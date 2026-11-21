import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GolfCourseApiError, fetchCourse, searchCourses, type ApiCourseSummary } from '../courses/golfCourseApi';
import { toCourse } from '../courses/golfCourseApi';
import { PcCaddieError, fetchPcCaddieCourses } from '../courses/pcCaddie';
import { db, getSettings } from '../db/db';
import { courseDisplayName } from '../domain/course';
import { useT, type Translate } from '../i18n/i18n';

export function errorMessage(e: unknown, t: Translate): string {
  if (e instanceof GolfCourseApiError) return e.kind === 'noKey' ? t('search.noKey') : t(`error.${e.kind}`);
  if (e instanceof PcCaddieError) return t(`pccaddie.${e.kind}`);
  return String(e);
}

export function CourseSearchPage() {
  const t = useT();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ApiCourseSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [clubId, setClubId] = useState('');
  const savedIds = useLiveQuery(async () => new Set((await db.courses.toArray()).map((c) => c.externalId)));

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError('');
    try {
      const settings = await getSettings();
      setResults(await searchCourses(query, settings.golfCourseApiKey));
    } catch (err) {
      setError(errorMessage(err, t));
    } finally {
      setBusy(false);
    }
  }

  async function add(summary: ApiCourseSummary) {
    setBusy(true);
    setError('');
    try {
      const settings = await getSettings();
      const course = toCourse(await fetchCourse(summary.id, settings.golfCourseApiKey));
      await db.courses.put(course);
      navigate(`/courses/${course.id}`);
    } catch (err) {
      setError(errorMessage(err, t));
      setBusy(false);
    }
  }

  async function importPcCaddie(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const courses = await fetchPcCaddieCourses(clubId, await db.courses.toArray());
      await db.courses.bulkPut(courses);
      navigate(courses.length === 1 ? `/courses/${courses[0].id}` : '/courses');
    } catch (err) {
      setError(errorMessage(err, t));
      setBusy(false);
    }
  }

  return (
    <>
      <Link to="/courses" className="back">
        ← {t('common.back')}
      </Link>
      <h1>{t('search.title')}</h1>
      <form className="row" onSubmit={search}>
        <input
          className="grow"
          type="search"
          autoFocus
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="primary" disabled={busy}>
          {t('search.button')}
        </button>
      </form>
      {busy && <p className="muted">{t('search.searching')}</p>}
      {error && <p className="error">{error}</p>}
      {results && results.length === 0 && (
        <p className="muted">
          {t('search.noResults')} <Link to="/courses/new">{t('courses.manual')}</Link>
        </p>
      )}
      {results && results.length > 0 && (
        <ul className="list card">
          {results.map((r) => (
            <li key={r.id} className="row">
              <div className="grow">
                <strong>{courseDisplayName({ clubName: r.club_name, courseName: r.course_name })}</strong>
                <br />
                <small className="muted">
                  {[r.location?.city, r.location?.country].filter(Boolean).join(', ')}
                </small>
              </div>
              {savedIds?.has(r.id) ? (
                <small className="muted">{t('search.added')}</small>
              ) : (
                <button disabled={busy} onClick={() => add(r)}>
                  {t('search.add')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="section">{t('pccaddie.title')}</h2>
      <p className="muted">{t('pccaddie.hint')}</p>
      <form className="row" onSubmit={importPcCaddie}>
        <input
          className="grow"
          inputMode="numeric"
          placeholder={t('pccaddie.placeholder')}
          value={clubId}
          onChange={(e) => setClubId(e.target.value)}
        />
        <button className="primary" disabled={busy || !clubId.trim()}>
          {t('pccaddie.button')}
        </button>
      </form>
    </>
  );
}
