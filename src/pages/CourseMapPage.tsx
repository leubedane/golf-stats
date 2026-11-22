import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapDrawing } from '../components/MapDrawing';
import { OsmError, fetchCourseMap, findGolfCourses, osmEditUrl, parseOsmReference, type OsmGolfCourse } from '../courses/openStreetMap';
import { db } from '../db/db';
import { courseDisplayName } from '../domain/course';
import { assignHoleLine, assignedHoleLines, courseOverview, holeLineLengthM, newCourseMap, unassignedHoleLines } from '../domain/courseMap';
import { strategyTee } from '../domain/holeStrategy';
import { DEFAULT_SETTINGS } from '../domain/settings';
import type { Course, CourseMap, OsmReference } from '../domain/types';
import { useT, type Translate } from '../i18n/i18n';

function osmErrorMessage(e: unknown, t: Translate): string {
  if (e instanceof OsmError) return t(e.kind === 'notFound' ? 'map.notFound' : e.kind === 'network' ? 'map.errorNetwork' : 'map.errorServer');
  return String(e);
}

/** Loads a Course Map from OpenStreetMap and lets the golfer assign Hole Lines without a hole number. */
export function CourseMapPage() {
  const t = useT();
  const { id = '' } = useParams();
  const course = useLiveQuery(() => db.courses.get(id), [id]);
  // null once loaded without a Course Map, undefined while loading.
  const courseMap = useLiveQuery(async () => (await db.courseMaps.get(id)) ?? null, [id]);
  const settings = useLiveQuery(() => db.settings.get('settings')) ?? DEFAULT_SETTINGS;
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  if (course === undefined || courseMap === undefined) return null;
  if (course === null) return <p>Course not found.</p>;

  const holeNumbers = (strategyTee(course, settings.teeGender)?.holes ?? []).map((h) => h.number);

  async function load(osm: OsmReference) {
    setError('');
    setBusy(t('map.loading'));
    try {
      const fetched = await fetchCourseMap(osm);
      const { osmName, ...data } = fetched;
      await db.courseMaps.put(newCourseMap(id, osm, osmName, data, courseMap ?? undefined));
    } catch (e) {
      setError(osmErrorMessage(e, t));
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    if (!confirm(t('map.confirmRemove'))) return;
    await db.courseMaps.delete(id);
  }

  return (
    <>
      <Link to={`/courses/${course.id}`} className="back">
        ← {t('common.back')}
      </Link>
      <h1>{t('map.courseMap')}</h1>
      <p className="muted">{courseDisplayName(course)}</p>
      <p className="muted">{t('map.hint')}</p>

      {courseMap ? (
        <LoadedMap
          courseMap={courseMap}
          holeNumbers={holeNumbers}
          t={t}
          busy={!!busy}
          onRefresh={() => load(courseMap.osm)}
          onRemove={remove}
        />
      ) : (
        <FindCourse course={course} t={t} busy={!!busy} onLoad={load} onError={setError} />
      )}
      {busy && <p className="muted">{busy}</p>}
      {error && <p className="error">{error}</p>}
    </>
  );
}

interface FindProps {
  course: Course;
  t: Translate;
  busy: boolean;
  onLoad: (osm: OsmReference) => void;
  onError: (message: string) => void;
}

function FindCourse({ course, t, busy, onLoad, onError }: FindProps) {
  const [results, setResults] = useState<OsmGolfCourse[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [link, setLink] = useState('');

  async function search() {
    onError('');
    setSearching(true);
    try {
      setResults(await findGolfCourses(course.clubName, course.city));
    } catch (e) {
      onError(osmErrorMessage(e, t));
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      <section className="card">
        <button className="primary" disabled={searching || busy || !course.clubName.trim()} onClick={search}>
          {searching ? t('map.searching') : t('map.search')}
        </button>
        {results && results.length === 0 && <p className="muted">{t('map.noResults')}</p>}
        {results && results.length > 0 && (
          <ul className="list">
            {results.map((r) => (
              <li key={`${r.osm.type}${r.osm.id}`} className="row">
                <span className="grow">
                  {r.name}
                  <br />
                  <small className="muted">
                    {r.place} · {r.osm.type} {r.osm.id}
                  </small>
                </span>
                <button disabled={busy} onClick={() => onLoad(r.osm)}>
                  {t('map.load')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const ref = parseOsmReference(link);
            if (ref) onLoad(ref);
            else onError(t('map.invalidLink'));
          }}
        >
          <label className="field">
            <span>{t('map.osmLink')}</span>
            <input value={link} placeholder={t('map.osmLinkPlaceholder')} onChange={(e) => setLink(e.target.value)} />
          </label>
          <button type="submit" disabled={busy || !link.trim()}>
            {t('map.load')}
          </button>
        </form>
      </section>
    </>
  );
}

interface LoadedProps {
  courseMap: CourseMap;
  holeNumbers: number[];
  t: Translate;
  busy: boolean;
  onRefresh: () => void;
  onRemove: () => void;
}

function LoadedMap({ courseMap, holeNumbers, t, busy, onRefresh, onRemove }: LoadedProps) {
  const [selected, setSelected] = useState<number | undefined>();
  const assigned = useMemo(() => assignedHoleLines(courseMap), [courseMap]);
  const overview = useMemo(() => courseOverview(courseMap, selected), [courseMap, selected]);
  const covered = holeNumbers.filter((n) => assigned.has(n)).length;
  const manual = new Set(courseMap.assignments.map((a) => a.osmId));
  // Lines the golfer has to (or did) assign: those OSM could not number uniquely.
  const toAssign = [...unassignedHoleLines(courseMap), ...courseMap.holeLines.filter((l) => manual.has(l.osmId))];
  const lineIndex = new Map(courseMap.holeLines.map((l, i) => [l.osmId, i + 1]));
  const holeOf = new Map([...assigned].map(([n, l]) => [l.osmId, n]));

  return (
    <>
      <section className="card">
        <p>
          {t('map.source', { name: courseMap.osmName || `${courseMap.osm.type} ${courseMap.osm.id}`, date: new Date(courseMap.fetchedAt).toLocaleDateString() })}
        </p>
        <p>{courseMap.holeLines.length === 0 ? t('map.noHoleLines') : t('map.coverage', { n: covered, total: holeNumbers.length })}</p>
        <div className="row wrap">
          <button disabled={busy} onClick={onRefresh}>
            {t('map.refresh')}
          </button>
          <a className="button" href={osmEditUrl(courseMap.osm)} target="_blank" rel="noreferrer">
            {t('map.edit')}
          </a>
          <button className="link danger-text" onClick={onRemove}>
            {t('map.remove')}
          </button>
        </div>
      </section>

      {toAssign.length > 0 && (
        <section className="card">
          <h2>{t('map.unassigned')}</h2>
          <p className="muted">{t('map.unassignedHint')}</p>
          <ul className="list">
            {toAssign.map((line) => (
              <li key={line.osmId} className={`row${selected === line.osmId ? ' selected-line' : ''}`}>
                <button className="link grow line-pick" onClick={() => setSelected(line.osmId)}>
                  {t('map.line', { n: lineIndex.get(line.osmId)!, m: Math.round(holeLineLengthM(courseMap, line)) })}
                </button>
                <label className="row">
                  <span className="muted">{t('map.assignTo')}</span>
                  <select
                    value={holeOf.get(line.osmId) ?? ''}
                    onFocus={() => setSelected(line.osmId)}
                    onChange={(e) =>
                      db.courseMaps.put(assignHoleLine(courseMap, line.osmId, e.target.value === '' ? null : Number(e.target.value)))
                    }
                  >
                    <option value="">{t('map.notAssigned')}</option>
                    {holeNumbers.map((n) => (
                      <option key={n} value={n}>
                        {n} {assigned.has(n) && assigned.get(n)!.osmId !== line.osmId ? t('map.taken') : ''}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {overview && (
        <section className="card">
          <MapDrawing view={overview} t={t} label={t('map.courseMap')} onLineClick={setSelected} />
        </section>
      )}
    </>
  );
}
