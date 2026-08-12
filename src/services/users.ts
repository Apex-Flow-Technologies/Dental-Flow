import { createUserWithEmailAndPassword } from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db, withSecondaryAuth } from '@/lib/firebase'
import type { AppUser } from '@/types/models'
import { writeAudit, type Actor } from './audit'

const usersCollection = collection(db, 'users')

/**
 * The signed-in user's clinic profile.
 *
 * A Firebase Auth account alone does not grant access — the matching `users/{uid}` document does.
 * That is what makes accounts admin-provisioned: an account with no profile document, or one with
 * `active: false`, is rejected by both the app and `firestore.rules`.
 */
export async function getAppUser(uid: string): Promise<AppUser | null> {
  const snapshot = await getDoc(doc(db, 'users', uid))
  if (!snapshot.exists()) return null
  return { uid: snapshot.id, ...snapshot.data() } as AppUser
}

export async function listUsers(): Promise<AppUser[]> {
  const snapshot = await getDocs(query(usersCollection, orderBy('createdAt', 'asc')))
  return snapshot.docs.map((docSnapshot) => ({
    uid: docSnapshot.id,
    ...docSnapshot.data(),
  })) as AppUser[]
}

export interface CreateUserParams {
  email: string
  password: string
  displayName: string
}

/**
 * Creates a clinic account without disturbing the current session.
 *
 * `createUserWithEmailAndPassword` signs in as the account it creates. Run on the main app that
 * would sign the current staff member out every time they add a colleague, so it runs on a
 * throwaway secondary app instead (see `withSecondaryAuth`). The new account's Auth record and its
 * `users/{uid}` profile are created together; without the profile the account cannot sign in.
 */
export async function createClinicUser(params: CreateUserParams, actor: Actor): Promise<void> {
  const email = params.email.trim().toLowerCase()
  const displayName = params.displayName.trim()

  const uid = await withSecondaryAuth(async (secondaryAuth) => {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, email, params.password)
    return credential.user.uid
  })

  await setDoc(doc(db, 'users', uid), {
    email,
    displayName,
    role: 'staff',
    active: true,
    createdAt: serverTimestamp(),
    createdBy: actor.uid,
  })

  await writeAudit({
    entity: 'user',
    entityId: uid,
    patientId: null,
    action: 'create',
    changes: [{ field: 'email', label: 'Account created', from: '', to: email }],
    actor,
  })
}

/**
 * Revokes or restores access.
 *
 * Flipping `active` is preferred over deleting the account: audit entries and clinical notes
 * reference the author's uid, and deleting the user would leave those attributions dangling.
 */
export async function setUserActive(user: AppUser, active: boolean, actor: Actor): Promise<void> {
  await updateDoc(doc(db, 'users', user.uid), { active })

  await writeAudit({
    entity: 'user',
    entityId: user.uid,
    patientId: null,
    action: 'update',
    changes: [
      {
        field: 'active',
        label: 'Account access',
        from: user.active ? 'Active' : 'Disabled',
        to: active ? 'Active' : 'Disabled',
      },
    ],
    actor,
  })
}
