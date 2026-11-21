import { useState } from 'react';
import { GREEN_SIDES, emptyStrategy, toggleGreenSide, withTeeClub } from '../domain/holeStrategy';
import type { Club, GreenSide, HoleStrategy } from '../domain/types';
import type { Translate } from '../i18n/i18n';

interface Props {
  courseId: string;
  hole: { number: number; par: number; lengthM: number };
  /** Undefined when the hole has no Hole Strategy yet. */
  strategy: HoleStrategy | undefined;
  bag: Club[];
  t: Translate;
  /** Show "Hole n · Par · length" as heading (Course Strategy page); the Round header already shows it. */
  withHeading?: boolean;
  onSave: (strategy: HoleStrategy) => Promise<void>;
}

const sides = (list: GreenSide[], t: Translate) => list.map((s) => t(`greenSide.${s}`)).join('/');

/** Compact Hole Strategy: tap to see the Notes and edit. */
export function HoleStrategyCard({ courseId, hole, strategy, bag, t, withHeading, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<HoleStrategy | null>(null);
  const heading = withHeading && (
    <h2>{t('strategy.hole', { n: hole.number, par: hole.par, length: hole.lengthM })}</h2>
  );

  if (draft) {
    return (
      <section className="card">
        {heading}
        <HoleStrategyForm
          draft={draft}
          bag={bag}
          t={t}
          onChange={setDraft}
          onCancel={() => setDraft(null)}
          onSave={async () => {
            await onSave(draft);
            setDraft(null);
          }}
        />
      </section>
    );
  }

  if (!strategy) {
    return (
      <section className="card">
        {heading}
        <button className="link" onClick={() => setDraft(emptyStrategy(courseId, hole.number))}>
          {t('strategy.add')}
        </button>
      </section>
    );
  }

  const tee = [strategy.teeClubName, strategy.teeTarget].filter(Boolean).join(' · ');
  return (
    <section className="card">
      {heading}
      <button className="strategy-summary" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="grow">
          {!withHeading && <small className="muted">{t('strategy.title')}: </small>}
          {tee}
          {strategy.goodMiss.length > 0 && (
            <>
              {tee && ' · '}
              {t('strategy.missShort', { sides: sides(strategy.goodMiss, t) })}
            </>
          )}
          {strategy.dangerSide.length > 0 && (
            <span className="danger-text">
              {' · '}
              {t('strategy.dangerShort', { sides: sides(strategy.dangerSide, t) })}
            </span>
          )}
          {strategy.notes && !open && ' …'}
        </span>
      </button>
      {open && (
        <>
          {strategy.notes && <p className="strategy-notes">{strategy.notes}</p>}
          <div className="row">
            <small className="muted grow">
              {t('strategy.updated', { date: new Date(strategy.updatedAt).toLocaleDateString() })}
            </small>
            <button className="link" onClick={() => setDraft(strategy)}>
              {t('common.edit')}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

interface FormProps {
  draft: HoleStrategy;
  bag: Club[];
  t: Translate;
  onChange: (draft: HoleStrategy) => void;
  onSave: () => void;
  onCancel: () => void;
}

function HoleStrategyForm({ draft, bag, t, onChange, onSave, onCancel }: FormProps) {
  // A Tee Club removed from the Bag stays selectable under its stored name.
  const removedClub = draft.teeClubId && !bag.some((c) => c.id === draft.teeClubId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <label className="field">
        <span>{t('strategy.teeClub')}</span>
        <select
          value={draft.teeClubId ?? ''}
          onChange={(e) => {
            if (e.target.value === draft.teeClubId) return;
            onChange(withTeeClub(draft, bag.find((c) => c.id === e.target.value) ?? null));
          }}
        >
          <option value="">{t('strategy.noClub')}</option>
          {removedClub && <option value={draft.teeClubId!}>{draft.teeClubName}</option>}
          {bag
            .filter((c) => c.kind !== 'putter')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        <span>{t('strategy.teeTarget')}</span>
        <input
          value={draft.teeTarget}
          placeholder={t('strategy.teeTargetPlaceholder')}
          onChange={(e) => onChange({ ...draft, teeTarget: e.target.value })}
        />
      </label>
      <SideChips label={t('strategy.goodMiss')} field="goodMiss" draft={draft} t={t} onChange={onChange} />
      <SideChips label={t('strategy.dangerSide')} field="dangerSide" draft={draft} t={t} onChange={onChange} />
      <label className="field">
        <span>{t('strategy.notes')}</span>
        <textarea
          value={draft.notes}
          placeholder={t('strategy.notesPlaceholder')}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
        />
      </label>
      <div className="row">
        <button type="submit" className="primary grow">
          {t('common.save')}
        </button>
        <button type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

interface SideChipsProps {
  label: string;
  field: 'goodMiss' | 'dangerSide';
  draft: HoleStrategy;
  t: Translate;
  onChange: (draft: HoleStrategy) => void;
}

/** Multi-select chips for the sides of the Green. */
function SideChips({ label, field, draft, t, onChange }: SideChipsProps) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className={`chips ${field === 'dangerSide' ? 'danger' : ''}`} role="group" aria-label={label}>
        {GREEN_SIDES.map((side) => (
          <button
            key={side}
            type="button"
            role="checkbox"
            aria-checked={draft[field].includes(side)}
            className={draft[field].includes(side) ? 'selected' : ''}
            onClick={() => onChange(toggleGreenSide(draft, field, side))}
          >
            {t(`greenSide.${side}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
