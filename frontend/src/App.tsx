import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './i18n/LanguageContext';
import { StaffAuthProvider } from './auth/StaffAuth';
import { AppLayout } from './components/layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { JoinPage } from './pages/JoinPage';
import { StatusPage } from './pages/StatusPage';
import { ReceptionPage } from './pages/ReceptionPage';
import { BarberPage } from './pages/BarberPage';
import { DisplayPage } from './pages/DisplayPage';
import { AdminPage } from './pages/AdminPage';
import { NotFoundPage } from './pages/NotFoundPage';

export default function App() {
  return (
    <LanguageProvider>
      <StaffAuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Customer Screens */}
          <Route
            path="/"
            element={
              <AppLayout>
                <HomePage />
              </AppLayout>
            }
          />
          <Route
            path="/join"
            element={
              <AppLayout>
                <JoinPage />
              </AppLayout>
            }
          />
          <Route
            path="/status/:publicId"
            element={
              <AppLayout>
                <StatusPage />
              </AppLayout>
            }
          />

          {/* Staff Screens */}
          <Route
            path="/reception"
            element={
              <AppLayout>
                <ReceptionPage />
              </AppLayout>
            }
          />
          <Route
            path="/barber"
            element={
              <AppLayout>
                <BarberPage />
              </AppLayout>
            }
          />
          <Route
            path="/barber/:barberId"
            element={
              <AppLayout>
                <BarberPage />
              </AppLayout>
            }
          />
          <Route
            path="/admin"
            element={
              <AppLayout>
                <AdminPage />
              </AppLayout>
            }
          />

          {/* Waiting Area TV Display (Full-screen TV layout) */}
          <Route path="/display" element={<DisplayPage />} />

          {/* Fallback 404 Route */}
          <Route
            path="*"
            element={
              <AppLayout>
                <NotFoundPage />
              </AppLayout>
            }
          />
        </Routes>
      </BrowserRouter>
      </StaffAuthProvider>
    </LanguageProvider>
  );
}
