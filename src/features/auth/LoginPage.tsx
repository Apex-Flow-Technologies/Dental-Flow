import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '@/auth/useAuth'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { ErrorNotice, Spinner } from '@/components/ui/primitives'
import { ToothIcon } from '@/components/ui/icons'

/**
 * Firebase reports a wrong password and an unknown email identically as `invalid-credential`, and
 * deliberately so — distinguishing them would let anyone enumerate which staff emails exist.
 */
function describeAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password.'
      case 'auth/invalid-email':
        return 'That does not look like a valid email address.'
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact an administrator.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a few minutes and try again.'
      case 'auth/network-request-failed':
        return 'Cannot reach Firebase. Check your internet connection.'
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not enabled on this Firebase project yet.'
      default:
        return `Sign-in failed (${error.code}).`
    }
  }
  return 'Sign-in failed. Please try again.'
}

export function LoginPage() {
  const { signIn, loading, firebaseUser, profile, accessError } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-navy">
        <Spinner label="Loading" />
      </div>
    )
  }

  if (firebaseUser && profile) {
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? '/patients'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
    } catch (caught) {
      setError(describeAuthError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10 text-aqua">
            <ToothIcon className="size-7" />
          </span>
          <h1 className="text-2xl font-semibold text-white">Dental Flow</h1>
          <p className="mt-1 text-sm text-white/70">Arun Care Dental Clinic — Patient Registry</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow-xl">
          <div className="space-y-4">
            {/* accessError comes from AuthProvider: the credentials were valid but access is not granted. */}
            {(error || accessError) && <ErrorNotice>{error ?? accessError}</ErrorNotice>}

            <TextField
              label="Email"
              type="email"
              required
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@clinic.com"
            />

            <TextField
              label="Password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <Button type="submit" loading={submitting} className="w-full">
              Sign in
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-white/60">
          Accounts are created by a clinic administrator. There is no public sign-up.
        </p>

        <p className="mt-8 text-center text-xs text-white/40">
          Built by <span className="font-medium text-white/60">Apex Flow Technologies</span>
        </p>
      </div>
    </main>
  )
}
