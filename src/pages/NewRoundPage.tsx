import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db, getSettings } from '../db/db';
import { courseDisplayName, validateCourse } from '../domain/course';
import { startRound } from '../domain/round';
import { useT } from '../i18n/i18n';

export function NewRoundPage() {
  const t = useT();
  const navigate = useNavigate();
  const courses = useLiveQuery(() => db.courses.orderBy('clubName').toArray());
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const lastRound = useLiveQuery(() => db.rounds.orderBy('startedAt').last());
  const [courseId, setCourseId] = useState('');
  const [teeId, setTeeId] = useState('');
  const [startHole, setStartHole] = useState(1);
  const [holeCount, setHoleCount] = useState(18);

  // Preselect the course of the last round, else the first course.
  useEffect(() => {
    if (!courses || courses.length === 0 || courseId) return;
    const last = lastRound && courses.find((c) => c.id === lastRound.courseId);
    setCourseId((last ?? courses[0]).id);
  }, [courses, lastRound, courseId]);

  const course = courses?.find((c) => c.id === courseId);
  const tees = course
    ? course.tees.filter((x) => x.gender === settings?.teeGender).concat(
        course.tees.filter((x) => x.gender !== settings?.teeGender),
      )
    : [];
  const tee = tees.find((x) => x.id === teeId) ?? tees[0];
  const holeTotal = tee?.holes.length ?? 18;
  const valid = course ? validateCourse(course).length === 0 : false;

  async function start() {
    if (!course || !tee) return;
    const s = await getSettings();
    const round = startRound({ course, tee, startHole, holeCount: Math.min(holeCount, holeTotal), handicap: s.handicap });
    await db.rounds.put(round);
    navigate(`/rounds/${round.id}/scorecard`, { replace: true });
  }

  if (!courses) return null;
  return (
    <>
      <Link to="/" className="back">
        ← {t('common.back')}
      </Link>
      <h1>{t('newRound.title')}</h1>
      <section className="card">
        <label className="field">
          <span>{t('newRound.course')}</span>
          <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setTeeId(''); setStartHole(1); }}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {courseDisplayName(c)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('newRound.tee')}</span>
          <select value={tee?.id ?? ''} onChange={(e) => setTeeId(e.target.value)}>
            {tees.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({x.gender === 'male' ? t('settings.teeGender.male') : t('settings.teeGender.female')}) · CR {x.courseRating} / {x.slope}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <label className="field grow">
            <span>{t('newRound.startHole')}</span>
            <select value={startHole} onChange={(e) => setStartHole(Number(e.target.value))}>
              {tee?.holes.map((h) => (
                <option key={h.number} value={h.number}>
                  {h.number}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow">
            <span>{t('newRound.holes')}</span>
            <select value={Math.min(holeCount, holeTotal)} onChange={(e) => setHoleCount(Number(e.target.value))}>
              {[18, 9].filter((n) => n <= holeTotal).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        {course && !valid && (
          <p className="error">
            {t('newRound.invalidCourse')} <Link to={`/courses/${course.id}`}>{t('common.edit')}</Link>
          </p>
        )}
      </section>
      <button className="primary block" disabled={!tee || !valid} onClick={start}>
        {t('newRound.start')}
      </button>
    </>
  );
}
