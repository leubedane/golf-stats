import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { CLUB_KINDS, MAX_CLUBS } from '../domain/bag';
import { newId } from '../domain/ids';
import type { Club, ClubKind } from '../domain/types';
import { useT } from '../i18n/i18n';

export function BagPage() {
  const t = useT();
  const clubs = useLiveQuery(() => db.clubs.orderBy('order').toArray()) ?? [];

  async function move(index: number, delta: -1 | 1) {
    const other = clubs[index + delta];
    if (!other) return;
    const club = clubs[index];
    await db.transaction('rw', db.clubs, async () => {
      await db.clubs.update(club.id, { order: other.order });
      await db.clubs.update(other.id, { order: club.order });
    });
  }

  async function add() {
    const order = clubs.length ? clubs[clubs.length - 1].order + 1 : 0;
    await db.clubs.add({ id: newId(), name: '', kind: 'iron', order });
  }

  const update = (club: Club, changes: Partial<Club>) => db.clubs.update(club.id, changes);

  return (
    <>
      <h1>{t('bag.title')}</h1>
      <p className="muted">{t('bag.count', { n: clubs.length, max: MAX_CLUBS })}</p>
      <ul className="list card">
        {clubs.map((club, i) => (
          <li key={club.id} className="row bag-row">
            <input
              className="grow"
              aria-label={t('bag.name')}
              defaultValue={club.name}
              placeholder={t('bag.name')}
              onBlur={(e) => update(club, { name: e.target.value.trim() })}
            />
            <select
              aria-label={t('bag.kind')}
              value={club.kind}
              onChange={(e) => update(club, { kind: e.target.value as ClubKind })}
            >
              {CLUB_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`clubKind.${k}`)}
                </option>
              ))}
            </select>
            <button className="icon" aria-label={t('bag.moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button
              className="icon"
              aria-label={t('bag.moveDown')}
              disabled={i === clubs.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
            <button className="icon danger" aria-label={t('common.delete')} onClick={() => db.clubs.delete(club.id)}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      {clubs.length < MAX_CLUBS ? (
        <button className="primary" onClick={add}>
          {t('common.add')}
        </button>
      ) : (
        <p className="muted">{t('bag.full')}</p>
      )}
    </>
  );
}
