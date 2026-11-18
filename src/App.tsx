import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useT } from './i18n/i18n';
import { RoundsPage } from './pages/RoundsPage';
import { NewRoundPage } from './pages/NewRoundPage';
import { RoundPage } from './pages/RoundPage';
import { RoundSummaryPage } from './pages/RoundSummaryPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseSearchPage } from './pages/CourseSearchPage';
import { CourseEditPage } from './pages/CourseEditPage';
import { BagPage } from './pages/BagPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';

export function App() {
  const t = useT();
  return (
    <BrowserRouter>
      <main className="page">
        <Routes>
          <Route path="/" element={<RoundsPage />} />
          <Route path="/rounds/new" element={<NewRoundPage />} />
          <Route path="/rounds/:id" element={<RoundPage />} />
          <Route path="/rounds/:id/summary" element={<RoundSummaryPage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/search" element={<CourseSearchPage />} />
          <Route path="/courses/new" element={<CourseEditPage />} />
          <Route path="/courses/:id" element={<CourseEditPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/bag" element={<BagPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <nav className="tabbar">
        <NavLink to="/" className={({ isActive }) => (isActive || location.pathname.startsWith('/rounds') ? 'active' : '')} end>{t('nav.rounds')}</NavLink>
        <NavLink to="/stats">{t('nav.stats')}</NavLink>
        <NavLink to="/courses">{t('nav.courses')}</NavLink>
        <NavLink to="/bag">{t('nav.bag')}</NavLink>
        <NavLink to="/settings">{t('nav.settings')}</NavLink>
      </nav>
    </BrowserRouter>
  );
}
