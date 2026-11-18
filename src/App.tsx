import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useT } from './i18n/i18n';
import { RoundsPage } from './pages/RoundsPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseSearchPage } from './pages/CourseSearchPage';
import { CourseEditPage } from './pages/CourseEditPage';
import { BagPage } from './pages/BagPage';
import { SettingsPage } from './pages/SettingsPage';

export function App() {
  const t = useT();
  return (
    <BrowserRouter>
      <main className="page">
        <Routes>
          <Route path="/" element={<RoundsPage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/search" element={<CourseSearchPage />} />
          <Route path="/courses/new" element={<CourseEditPage />} />
          <Route path="/courses/:id" element={<CourseEditPage />} />
          <Route path="/bag" element={<BagPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
      <nav className="tabbar">
        <NavLink to="/" end>{t('nav.rounds')}</NavLink>
        <NavLink to="/courses">{t('nav.courses')}</NavLink>
        <NavLink to="/bag">{t('nav.bag')}</NavLink>
        <NavLink to="/settings">{t('nav.settings')}</NavLink>
      </nav>
    </BrowserRouter>
  );
}
