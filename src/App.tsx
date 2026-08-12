import { lazy, Suspense } from 'react'
import { isFirebaseConfigured } from '@/lib/firebaseConfig'
import { FirebaseSetupPage } from '@/features/setup/FirebaseSetupPage'
import { Spinner } from '@/components/ui/primitives'

/**
 * Lazy so the Firebase SDK is not imported — and therefore not initialised — until the config has
 * been confirmed. Initialising with a blank config throws `auth/invalid-api-key` at import time,
 * which would blank the page before the setup instructions could render.
 */
const AppRoutes = lazy(() => import('./AppRoutes'))

export default function App() {
  if (!isFirebaseConfigured) return <FirebaseSetupPage />

  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Spinner label="Starting Dental Flow" />
        </div>
      }
    >
      <AppRoutes />
    </Suspense>
  )
}
