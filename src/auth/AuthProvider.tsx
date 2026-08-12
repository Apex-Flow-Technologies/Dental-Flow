import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { FirebaseError } from 'firebase/app'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getAppUser } from '@/services/users'
import type { AppUser } from '@/types/models'
import type { Actor } from '@/services/audit'
import { AuthContext, type AuthState } from './authContext'

const NO_PROFILE_MESSAGE =
  'This account is not registered for clinic access. Ask an administrator to add it.'
const INACTIVE_MESSAGE = 'This account has been disabled. Contact an administrator.'
const UNREACHABLE_MESSAGE =
  'Cannot reach the patient database. Check your internet connection, and confirm Cloud Firestore is enabled on this Firebase project.'

/**
 * Whether a failed profile read means "no access" or "could not ask".
 *
 * Firestore reports an unreachable backend as `unavailable` — including when the project has no
 * Firestore database at all, where the SDK falls back to an empty local cache and says the client
 * is offline. Treating that as a missing profile sends people hunting for an account problem that
 * does not exist, so connectivity failures are reported as themselves and the session is kept.
 */
function isBackendUnreachable(error: unknown): boolean {
  if (!(error instanceof FirebaseError)) return false
  return (
    error.code === 'unavailable' ||
    error.code === 'firestore/unavailable' ||
    error.code === 'deadline-exceeded' ||
    error.code === 'firestore/deadline-exceeded'
  )
}

/**
 * Two-stage authentication.
 *
 * Passing Firebase Authentication is necessary but not sufficient — access requires an active
 * `users/{uid}` document. That is what "admin-provisioned, no public signup" means in practice:
 * even if an account somehow exists in Auth, without a profile it cannot read a single patient
 * record, because `firestore.rules` applies the same check server-side.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [accessError, setAccessError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFirebaseUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      try {
        const appUser = await getAppUser(user.uid)

        if (!appUser || !appUser.active) {
          setAccessError(appUser ? INACTIVE_MESSAGE : NO_PROFILE_MESSAGE)
          setFirebaseUser(null)
          setProfile(null)
          await signOut(auth)
          return
        }

        setAccessError(null)
        setFirebaseUser(user)
        setProfile(appUser)
      } catch (error) {
        console.error('Failed to load the clinic profile', error)

        if (isBackendUnreachable(error)) {
          // Not an access problem. Keep the Firebase session so a recovered connection resumes
          // without a second sign-in, and say plainly that the database could not be reached.
          setAccessError(UNREACHABLE_MESSAGE)
          setFirebaseUser(null)
          setProfile(null)
          return
        }

        // Anything else — including a rules rejection — means this account has no access.
        setAccessError(NO_PROFILE_MESSAGE)
        setFirebaseUser(null)
        setProfile(null)
        await signOut(auth)
      } finally {
        setLoading(false)
      }
    })
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setAccessError(null)
    await signInWithEmailAndPassword(auth, email.trim(), password)
    // The profile check runs in the onAuthStateChanged handler above.
  }, [])

  const signOutUser = useCallback(async () => {
    setAccessError(null)
    await signOut(auth)
  }, [])

  const value = useMemo<AuthState>(() => {
    const actor: Actor | null =
      firebaseUser && profile
        ? {
            uid: firebaseUser.uid,
            email: profile.email || (firebaseUser.email ?? ''),
            displayName: profile.displayName || profile.email,
          }
        : null

    return { loading, firebaseUser, profile, accessError, actor, signIn, signOutUser }
  }, [loading, firebaseUser, profile, accessError, signIn, signOutUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
