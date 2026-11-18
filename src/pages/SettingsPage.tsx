import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { NumberField } from '../components/NumberField';
import { classLabel } from '../components/labels';
import { db } from '../db/db';
import { exportBackup, importBackup, parseBackup } from '../db/backup';
import { addHandicapClass, isValidHandicap, removeHandicapClass } from '../domain/settings';
import type { Settings } from '../domain/types';
import { useT } from '../i18n/i18n';

export function SettingsPage() {
  const t = useT();
  const settings = useLiveQuery(() => db.settings.get('settings'));
  const [newClass, setNewClass] = useState(0);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  if (!settings) return null;
  const save = (next: Settings) => db.settings.put(next);

  async function downloadBackup() {
    const backup = await exportBackup(db);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `golfstat-backup-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function restoreBackup(file: File) {
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(t('settings.importConfirm'))) return;
      await importBackup(db, backup);
      setMessage(t('settings.importDone'));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <h1>{t('settings.title')}</h1>

      <section className="card">
        <h2>{t('settings.player')}</h2>
        <label className="field">
          <span>{t('settings.handicap')}</span>
          <NumberField
            value={settings.handicap}
            onChange={(v) => isValidHandicap(v) && save({ ...settings, handicap: v })}
          />
        </label>
        <div className="field">
          <span>{t('settings.teeGender')}</span>
          <div className="segmented">
            {(['male', 'female'] as const).map((g) => (
              <button
                key={g}
                className={settings.teeGender === g ? 'selected' : ''}
                onClick={() => save({ ...settings, teeGender: g })}
              >
                {t(g === 'male' ? 'settings.teeGender.male' : 'settings.teeGender.female')}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>{t('settings.language')}</span>
          <div className="segmented">
            {(['en', 'de'] as const).map((l) => (
              <button
                key={l}
                className={settings.language === l ? 'selected' : ''}
                onClick={() => save({ ...settings, language: l })}
              >
                {l === 'en' ? 'English' : 'Deutsch'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>{t('settings.classes')}</h2>
        <p className="muted">{t('settings.classesHelp')}</p>
        <ul className="list">
          {settings.handicapClasses.map((cls) => (
            <li key={cls.id} className="row">
              <label className="grow">
                <input
                  type="radio"
                  name="primary"
                  checked={settings.primaryHandicapClassId === cls.id}
                  onChange={() => save({ ...settings, primaryHandicapClassId: cls.id })}
                />{' '}
                {classLabel(cls, settings, t)}{' '}
                <small className="muted">
                  {cls.kind === 'pga' ? t('settings.measured') : t('settings.modeled')}
                </small>
              </label>
              {cls.kind !== 'own' && (
                <button className="link danger" onClick={() => save(removeHandicapClass(settings, cls.id))}>
                  {t('common.delete')}
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="row">
          <NumberField className="grow" label={t('settings.addClass')} value={newClass} onChange={setNewClass} />
          <button
            onClick={() => isValidHandicap(newClass) && save(addHandicapClass(settings, newClass))}
          >
            {t('settings.addClass')}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>{t('settings.api')}</h2>
        <label className="field">
          <span>{t('settings.apiKey')}</span>
          <input
            type="password"
            autoComplete="off"
            defaultValue={settings.golfCourseApiKey}
            onBlur={(e) => save({ ...settings, golfCourseApiKey: e.target.value.trim() })}
          />
        </label>
        <p className="muted">{t('settings.apiHelp')}</p>
      </section>

      <section className="card">
        <h2>{t('settings.backup')}</h2>
        <div className="stack">
          <button onClick={downloadBackup}>{t('settings.export')}</button>
          <button onClick={() => fileInput.current?.click()}>{t('settings.import')}</button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) restoreBackup(file);
              e.target.value = '';
            }}
          />
        </div>
        {message && <p className="muted">{message}</p>}
      </section>
    </>
  );
}
