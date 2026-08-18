import { useCallback, useEffect, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import {
  Badge,
  Card,
  EmptyState,
  ErrorNotice,
  InfoNotice,
  PageHeader,
  Spinner,
} from '@/components/ui/primitives'
import { useActor, useAuth } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import { createClinicUser, listUsers, setUserActive } from '@/services/users'
import type { AppUser } from '@/types/models'
import { formatDate } from '@/lib/format'
import { FeeSettingsCard } from './FeeSettingsCard'
import { describeLoadError } from '@/services/errors'

function describeCreateError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return 'An account with that email already exists.'
      case 'auth/invalid-email':
        return 'That does not look like a valid email address.'
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.'
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not enabled on this Firebase project.'
      default:
        return `Could not create the account (${error.code}).`
    }
  }
  return 'Could not create the account. Check your connection and try again.'
}

/**
 * Clinic user management.
 *
 * The confirmed role model is a single combined doctor/admin role, so every signed-in user can
 * manage accounts. Access is revoked by disabling rather than deleting: clinical notes and audit
 * entries reference the author's uid, and removing the account would orphan those attributions.
 */
export function UsersPage() {
  const actor = useActor()
  const { profile } = useAuth()
  const { notify } = useToast()

  const [users, setUsers] = useState<AppUser[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setUsers(await listUsers())
    } catch (error) {
      console.error('Failed to load users', error)
      setLoadError(describeLoadError(error, 'the clinic users'))
      setUsers([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function closeInvite() {
    setInviting(false)
    setEmail('')
    setDisplayName('')
    setPassword('')
    setCreateError(null)
  }

  async function handleCreate() {
    if (displayName.trim() === '' || email.trim() === '') {
      setCreateError('Name and email are both required.')
      return
    }
    if (password.length < 6) {
      setCreateError('Password must be at least 6 characters.')
      return
    }

    setCreating(true)
    setCreateError(null)
    try {
      await createClinicUser({ email, password, displayName }, actor)
      notify(`Account created for ${displayName.trim()}.`)
      closeInvite()
      await load()
    } catch (error) {
      console.error('Failed to create user', error)
      setCreateError(describeCreateError(error))
    } finally {
      setCreating(false)
    }
  }

  async function handleToggleActive(user: AppUser) {
    try {
      await setUserActive(user, !user.active, actor)
      notify(user.active ? `${user.displayName} can no longer sign in.` : `${user.displayName} re-enabled.`)
      await load()
    } catch (error) {
      console.error('Failed to change user access', error)
      notify('Could not change access for this account.', 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Clinic settings"
        subtitle="Accounts that can sign in, and the pricing the clinic works to."
        action={<Button onClick={() => setInviting(true)}>Add user</Button>}
      />

      {loadError && (
        <div className="mb-4">
          <ErrorNotice>{loadError}</ErrorNotice>
        </div>
      )}

      <Card className="overflow-hidden">
        {users === null ? (
          <Spinner label="Loading users" />
        ) : users.length === 0 ? (
          <EmptyState
            title="No clinic users yet"
            description="Add the first account so colleagues can sign in."
          />
        ) : (
          <div className="-mx-5 -my-5 overflow-x-auto">
            <table className="w-full min-w-2xl border-collapse text-sm">
              <thead>
                <tr className="bg-pale text-left">
                  {['Name', 'Email', 'Status', 'Added', ''].map((heading, index) => (
                    <th
                      key={heading || index}
                      scope="col"
                      className="px-4 py-3 text-xs font-semibold tracking-wide text-navy uppercase"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.uid === profile?.uid
                  return (
                    <tr key={user.uid} className="border-t border-line">
                      <td className="px-4 py-3 font-medium text-navy">
                        {user.displayName}
                        {isSelf && <span className="ml-2 text-xs text-ink-muted">(you)</span>}
                      </td>
                      <td className="px-4 py-3 text-ink">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge tone={user.active ? 'success' : 'neutral'}>
                          {user.active ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant={user.active ? 'ghost' : 'secondary'}
                          size="sm"
                          // Disabling your own account would lock you out mid-session.
                          disabled={isSelf}
                          title={isSelf ? 'You cannot change your own access.' : undefined}
                          onClick={() => void handleToggleActive(user)}
                        >
                          {user.active ? 'Disable' : 'Enable'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6">
        <FeeSettingsCard />
      </div>

      <div className="mt-6">
        <InfoNotice>
          Every user has the same combined doctor/administrator access: full patient records plus
          user management. Narrower roles for reception and assistants are noted in the
          specification but were not part of this build.
        </InfoNotice>
      </div>

      <Modal
        open={inviting}
        title="Add a clinic user"
        description="The account can sign in immediately. Share the password with them directly and ask them to change it."
        onClose={closeInvite}
        footer={
          <>
            <Button variant="secondary" onClick={closeInvite} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} loading={creating}>
              Create account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {createError && <ErrorNotice>{createError}</ErrorNotice>}

          <TextField
            label="Full name"
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Dr. A. Kumar"
          />
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@clinic.com"
          />
          <TextField
            label="Temporary password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            hint="At least 6 characters, as required by Firebase."
          />
        </div>
      </Modal>
    </>
  )
}
