import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { HoleStrategyCard } from '../components/HoleStrategyCard';
import { db, saveStrategy } from '../db/db';
import { courseDisplayName } from '../domain/course';
import { strategyId, strategyTee } from '../domain/holeStrategy';
import { DEFAULT_SETTINGS } from '../domain/settings';
import { useT } from '../i18n/i18n';

/** The Course Strategy: one Hole Strategy card per hole, editable outside a Round. */
export function CourseStrategyPage() {
  const t = useT();
  const { id = '' } = useParams();
  const course = useLiveQuery(() => db.courses.get(id), [id]);
  const strategies = useLiveQuery(() => db.holeStrategies.where('courseId').equals(id).toArray(), [id]);
  const bag = useLiveQuery(() => db.clubs.orderBy('order').toArray());
  const settings = useLiveQuery(() => db.settings.get('settings')) ?? DEFAULT_SETTINGS;

  if (course === undefined || !strategies || !bag) return null;
  if (course === null) return <p>Course not found.</p>;

  const tee = strategyTee(course, settings.teeGender);
  const byId = new Map(strategies.map((s) => [s.id, s]));

  return (
    <>
      <Link to={`/courses/${course.id}`} className="back">
        ← {t('common.back')}
      </Link>
      <h1>{t('strategy.courseTitle')}</h1>
      <p className="muted">
        {courseDisplayName(course)}
        {tee && ` · ${tee.name}`}
      </p>
      <p className="muted">{t('strategy.hint')}</p>
      {(tee?.holes ?? []).map((hole) => (
        <HoleStrategyCard
          key={hole.number}
          courseId={course.id}
          hole={hole}
          strategy={byId.get(strategyId(course.id, hole.number))}
          bag={bag}
          t={t}
          withHeading
          onSave={(s) => saveStrategy(s)}
        />
      ))}
    </>
  );
}
