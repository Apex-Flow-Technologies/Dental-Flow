import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { Spinner } from '@/components/ui/primitives'

/** Route guard. Sends unauthenticated users to login, remembering where they were headed. */
export function RequireAuth() {
  const { loading, firebaseUser, profile } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Checking your session" />
      </div>
    )
  }

  if (!firebaseUser || !profile) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
