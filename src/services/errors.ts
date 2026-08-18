import { FirebaseError } from 'firebase/app'

/**
 * Turns a Firestore failure into something a person can act on.
 *
 * The case worth separating is `permission-denied`. Firestore does not inherit rules into
 * subcollections — each needs its own `match` block — so adding a feature and forgetting to
 * redeploy `firestore.rules` produces a read failure that looks exactly like a network problem.
 * A generic "could not load" sends people to check their internet; naming the real cause sends
 * them to the console, which is where the fix is.
 */
export function describeLoadError(error: unknown, subject: string): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return `Not allowed to read ${subject}. The security rules for this collection have not been deployed — publish firestore.rules in the Firebase console.`
      case 'unavailable':
      case 'deadline-exceeded':
        return `Cannot reach the database to load ${subject}. Check your internet connection.`
      case 'failed-precondition':
        return `A database index is missing for ${subject}. The browser console has a link that creates it.`
      case 'unauthenticated':
        return 'Your session has expired. Sign in again.'
      default:
        return `Could not load ${subject} (${error.code}).`
    }
  }
  return `Could not load ${subject}.`
}

/** The same treatment for a failed write. */
export function describeSaveError(error: unknown, subject: string): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return `Not allowed to save ${subject}. The security rules for this collection have not been deployed — publish firestore.rules in the Firebase console.`
      case 'unavailable':
      case 'deadline-exceeded':
        return `Cannot reach the database. ${capitalise(subject)} was not saved — check your connection and try again.`
      case 'unauthenticated':
        return 'Your session has expired. Sign in again.'
      default:
        return `Could not save ${subject} (${error.code}).`
    }
  }
  return `Could not save ${subject}. Check your connection and try again.`
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
