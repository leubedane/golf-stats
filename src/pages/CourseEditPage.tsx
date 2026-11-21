import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { NumberField } from '../components/NumberField';
import { fetchCourse, toCourse } from '../courses/golfCourseApi';
import { db, deleteCourse, getSettings } from '../db/db';
import {
  courseDisplayName,
  courseLengthM,
  coursePar,
  emptyCourse,
  emptyHoles,
  emptyTee,
  validateCourse,
  type CourseProblem,
} from '../domain/course';
import type { Course, Hole, Tee, TeeGender } from '../domain/types';
import { useT, type Translate } from '../i18n/i18n';
import { errorMessage } from './CourseSearchPage';

function problemText(p: CourseProblem, t: Translate): string {
  const params: Record<string, number> = {};
  if ('tee' in p) params.tee = p.tee + 1;
  if ('hole' in p) params.hole = p.hole;
  return t(`problem.${p.code}`, params);
}

export function CourseEditPage() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [problems, setProblems] = useState<CourseProblem[]>([]);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      if (id) {
        const existing = await db.courses.get(id);
        if (existing) setCourse(existing);
        else navigate('/courses', { replace: true });
      } else {
        setCourse(emptyCourse((await getSettings()).teeGender));
      }
    })();
  }, [id, navigate]);

  if (!course) return null;

  const change = (next: Course) => {
    setCourse(next);
    setSaved(false);
  };
  const changeTee = (index: number, tee: Tee) =>
    change({ ...course, tees: course.tees.map((x, i) => (i === index ? tee : x)) });
  const changeHole = (teeIndex: number, hole: Hole) => {
    const tee = course.tees[teeIndex];
    changeTee(teeIndex, { ...tee, holes: tee.holes.map((h) => (h.number === hole.number ? hole : h)) });
  };

  async function save() {
    if (!course) return;
    const found = validateCourse(course);
    setProblems(found);
    if (found.length > 0) return;
    await db.courses.put({ ...course, updatedAt: Date.now() });
    setSaved(true);
    if (!id) navigate(`/courses/${course.id}`, { replace: true });
  }

  async function refresh() {
    if (!course?.externalId) return;
    setError('');
    try {
      const settings = await getSettings();
      change(toCourse(await fetchCourse(course.externalId, settings.golfCourseApiKey), course));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  async function remove() {
    if (!course || !confirm(t('common.confirmDelete', { name: courseDisplayName(course) }))) return;
    await deleteCourse(course.id);
    navigate('/courses');
  }

  return (
    <>
      <Link to="/courses" className="back">
        ← {t('common.back')}
      </Link>
      <h1>{course.clubName ? courseDisplayName(course) : t('course.title')}</h1>

      <section className="card">
        <label className="field">
          <span>{t('course.clubName')}</span>
          <input value={course.clubName} onChange={(e) => change({ ...course, clubName: e.target.value })} />
        </label>
        <label className="field">
          <span>{t('course.courseName')}</span>
          <input value={course.courseName} onChange={(e) => change({ ...course, courseName: e.target.value })} />
        </label>
        <div className="row">
          <label className="field grow">
            <span>{t('course.city')}</span>
            <input value={course.city} onChange={(e) => change({ ...course, city: e.target.value })} />
          </label>
          <label className="field grow">
            <span>{t('course.country')}</span>
            <input value={course.country} onChange={(e) => change({ ...course, country: e.target.value })} />
          </label>
        </div>
        {id && (
          <Link className="button" to={`/courses/${course.id}/strategy`}>
            {t('strategy.courseTitle')}
          </Link>
        )}
        {course.source === 'api' && course.externalId && (
          <button onClick={refresh}>{t('courses.refresh')}</button>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      {course.tees.map((tee, ti) => (
        <TeeEditor
          key={tee.id}
          index={ti}
          tee={tee}
          t={t}
          onChange={(next) => changeTee(ti, next)}
          onHoleChange={(hole) => changeHole(ti, hole)}
          onRemove={() => change({ ...course, tees: course.tees.filter((_, i) => i !== ti) })}
        />
      ))}

      <button onClick={async () => change({ ...course, tees: [...course.tees, emptyTee((await getSettings()).teeGender)] })}>
        {t('course.addTee')}
      </button>

      {problems.length > 0 && (
        <div className="card error">
          <p>{t('course.problems')}</p>
          <ul>
            {problems.map((p, i) => (
              <li key={i}>{problemText(p, t)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="row actions">
        <button className="primary grow" onClick={save}>
          {saved ? `✓ ${t('common.saved')}` : t('common.save')}
        </button>
        {id && (
          <button className="danger" onClick={remove}>
            {t('common.delete')}
          </button>
        )}
      </div>
    </>
  );
}

interface TeeEditorProps {
  index: number;
  tee: Tee;
  t: Translate;
  onChange: (tee: Tee) => void;
  onHoleChange: (hole: Hole) => void;
  onRemove: () => void;
}

function TeeEditor({ index, tee, t, onChange, onHoleChange, onRemove }: TeeEditorProps) {
  const holeCount = tee.holes.length === 9 ? 9 : 18;
  return (
    <section className="card">
      <div className="row">
        <h2 className="grow">
          {t('course.tee')} {index + 1}
          {tee.name && ` – ${tee.name}`}
        </h2>
        <button className="link danger" onClick={onRemove}>
          {t('course.removeTee')}
        </button>
      </div>
      <label className="field">
        <span>{t('course.teeName')}</span>
        <input value={tee.name} onChange={(e) => onChange({ ...tee, name: e.target.value })} />
      </label>
      <div className="row">
        <label className="field grow">
          <span>{t('course.gender')}</span>
          <select value={tee.gender} onChange={(e) => onChange({ ...tee, gender: e.target.value as TeeGender })}>
            <option value="male">{t('settings.teeGender.male')}</option>
            <option value="female">{t('settings.teeGender.female')}</option>
          </select>
        </label>
        <label className="field grow">
          <span>{t('course.holes')}</span>
          <select
            value={holeCount}
            onChange={(e) => onChange({ ...tee, holes: emptyHoles(Number(e.target.value) as 9 | 18) })}
          >
            <option value={18}>18</option>
            <option value={9}>9</option>
          </select>
        </label>
      </div>
      <div className="row">
        <label className="field grow">
          <span>{t('course.courseRating')}</span>
          <NumberField value={tee.courseRating} blankZero onChange={(v) => onChange({ ...tee, courseRating: v })} />
        </label>
        <label className="field grow">
          <span>{t('course.slope')}</span>
          <NumberField value={tee.slope} integer blankZero onChange={(v) => onChange({ ...tee, slope: v })} />
        </label>
      </div>
      <table className="holes">
        <thead>
          <tr>
            <th>{t('course.hole')}</th>
            <th>{t('course.par')}</th>
            <th>{t('course.lengthM')}</th>
            <th>{t('course.strokeIndex')}</th>
          </tr>
        </thead>
        <tbody>
          {tee.holes.map((h) => (
            <tr key={h.number}>
              <td>{h.number}</td>
              <td>
                <select value={h.par} onChange={(e) => onHoleChange({ ...h, par: Number(e.target.value) })}>
                  {[3, 4, 5, 6].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <NumberField
                  label={`${t('course.lengthM')} ${h.number}`}
                  value={h.lengthM}
                  integer
                  blankZero
                  onChange={(v) => onHoleChange({ ...h, lengthM: v })}
                />
              </td>
              <td>
                <NumberField
                  label={`${t('course.strokeIndex')} ${h.number}`}
                  value={h.strokeIndex}
                  integer
                  blankZero
                  onChange={(v) => onHoleChange({ ...h, strokeIndex: v })}
                />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{t('course.total')}</td>
            <td>{coursePar(tee)}</td>
            <td>{courseLengthM(tee)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
