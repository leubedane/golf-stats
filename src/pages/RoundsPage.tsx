import { useT } from '../i18n/i18n';

export function RoundsPage() {
  const t = useT();
  return (
    <>
      <h1>{t('rounds.title')}</h1>
      <p className="muted">{t('rounds.comingSoon')}</p>
    </>
  );
}
