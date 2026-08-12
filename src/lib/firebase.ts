import { initializeApp, deleteApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { firebaseConfig } from './firebaseConfig'

/**
 * Firebase SDK singletons.
 *
 * Importing this module initialises the SDK, which throws if the config is blank — so nothing may
 * import it until `isFirebaseConfigured` (in `firebaseConfig.ts`) has been checked. `App.tsx`
 * enforces that by loading the authenticated app tree lazily.
 */

// Vite HMR re-executes this module, so reuse the existing app instead of initialising twice.
export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

/**
 * Runs `work` against a throwaway second Firebase app.
 *
 * Creating a user with `createUserWithEmailAndPassword` signs the *current* session out and in as
 * the newly created account — which would kick the signed-in staff member out every time they add
 * a colleague. A separate app instance has its own auth state, so the live session is untouched.
 * The alternative is the Admin SDK in a Cloud Function, which needs the Blaze billing plan.
 */
export async function withSecondaryAuth<T>(work: (secondaryAuth: Auth) => Promise<T>): Promise<T> {
  const name = `secondary-${Date.now()}`
  const secondaryApp = initializeApp(firebaseConfig, name)
  try {
    return await work(getAuth(secondaryApp))
  } finally {
    await deleteApp(secondaryApp)
  }
}
