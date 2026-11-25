import { Component, useState, type ReactNode } from 'react';
import { translator } from '../i18n/i18n';
import { downloadBackup } from './download';

/** The browser's language: the stored setting may be what cannot be read. */
const t = translator(typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en');

function describe(error: unknown): string {
  if (error instanceof Error) return [`${error.name}: ${error.message}`, ...(error.stack ?? '').split('\n').slice(1, 6)].join('\n');
  return String(error);
}

/** Shown instead of a white page when the app fails: the error, the build, and a way to save the data. */
export function ErrorScreen({ error }: { error: unknown }) {
  const [backupFailed, setBackupFailed] = useState('');
  return (
    <section className="card error-screen">
      <h1>{t('error.title')}</h1>
      <p>{t('error.help')}</p>
      <pre className="error-details">
        {describe(error)}
        {'\n'}
        {location.pathname}
        {location.search} · {import.meta.env.VITE_BUILD_COMMIT?.slice(0, 7) ?? t('settings.localBuild')}
      </pre>
      <div className="stack">
        <button
          className="primary"
          onClick={() => downloadBackup().catch((e: unknown) => setBackupFailed(describe(e)))}
        >
          {t('settings.export')}
        </button>
        <a className="button" href="/">
          {t('error.home')}
        </a>
        <button onClick={() => location.reload()}>{t('error.reload')}</button>
      </div>
      {backupFailed && <pre className="error-details">{backupFailed}</pre>}
    </section>
  );
}

/** Catches a page that fails while drawing; navigating to another page tries again. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children;
  }
}
