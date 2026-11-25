import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { ErrorBoundary, ErrorScreen } from './components/ErrorScreen';
import { ensureSeeded } from './db/db';
import './styles.css';

registerSW({ immediate: true });

const root = createRoot(document.getElementById('root')!);

ensureSeeded().then(
  () =>
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    ),
  // The database could not be opened: say so instead of leaving the page white.
  (error: unknown) =>
    root.render(
      <main className="page">
        <ErrorScreen error={error} />
      </main>,
    ),
);
