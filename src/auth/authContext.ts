import { createContext } from 'react'
import type { User } from 'firebase/auth'
import type { AppUser } from '@/types/models'
import type { Actor } from '@/services/audit'

export interface AuthState {
  /** Still resolving the Firebase session and the clinic profile. */
  loading: boolean
  firebaseUser: User | null
  profile: AppUser | null
  /**
   * Set when a valid Firebase account signed in but has no active clinic profile. The session is
   * ended immediately in that case; this message explains why to the login screen.
   */
  accessError: string | null
  actor: Actor | null
  signIn: (email: string, password: string) => Promise<void>
  signOutUser: () => Promise<void>
}

/** Kept out of `AuthProvider.tsx` so that file exports only a component and Fast Refresh works. */
export const AuthContext = createContext<AuthState | null>(null)
