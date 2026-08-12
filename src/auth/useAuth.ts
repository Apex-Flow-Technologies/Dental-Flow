import { useContext } from 'react'
import { AuthContext, type AuthState } from './authContext'
import type { Actor } from '@/services/audit'

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.')
  return context
}

/**
 * The signed-in user as an audit actor.
 *
 * Only call this beneath `RequireAuth`, which guarantees a session exists. Throwing rather than
 * returning null means a write can never silently record an empty author on a clinical record.
 */
export function useActor(): Actor {
  const { actor } = useAuth()
  if (!actor) throw new Error('No signed-in user. useActor must be used inside a protected route.')
  return actor
}
