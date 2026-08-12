/**
 * The Firebase web config, and nothing else.
 *
 * Deliberately separate from `firebase.ts`: that module calls `getAuth()` at import time, which
 * throws `auth/invalid-api-key` when the config is blank. Keeping the values here — with no SDK
 * calls — lets `App.tsx` check whether setup is complete without loading the SDK, so a fresh clone
 * shows the setup instructions instead of a blank page.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/** Which `VITE_FIREBASE_*` keys are still blank. Listed on the setup screen. */
export const missingFirebaseKeys = Object.entries({
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  VITE_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID: firebaseConfig.appId,
})
  .filter(([, value]) => !value)
  .map(([key]) => key)

/** True once `.env.local` holds enough for the SDK to initialise without throwing. */
export const isFirebaseConfigured =
  Boolean(firebaseConfig.apiKey) &&
  Boolean(firebaseConfig.projectId) &&
  Boolean(firebaseConfig.authDomain)
