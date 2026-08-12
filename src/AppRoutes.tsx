import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { ToastProvider } from '@/components/ui/Toast'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { PatientSearchPage } from '@/features/patients/PatientSearchPage'
import { PatientCreatePage } from '@/features/patients/PatientCreatePage'
import { PatientDetailPage } from '@/features/patients/PatientDetailPage'
import { UsersPage } from '@/features/admin/UsersPage'
import { NotFoundPage } from '@/features/NotFoundPage'

/**
 * The authenticated application.
 *
 * Loaded lazily by `App.tsx` so that nothing here — and nothing it imports, including the Firebase
 * SDK — is evaluated until the config has been confirmed present.
 */
export default function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/patients" replace />} />
                <Route path="/patients" element={<PatientSearchPage />} />
                <Route path="/patients/new" element={<PatientCreatePage />} />
                <Route path="/patients/:patientId" element={<PatientDetailPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
