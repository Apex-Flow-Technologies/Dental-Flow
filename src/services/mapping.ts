import type { DocumentSnapshot, QuerySnapshot } from 'firebase/firestore'

/**
 * Firestore document -> app model.
 *
 * The cast is deliberate and is the single place it happens: Firestore returns `DocumentData`, and
 * the schema is enforced by `firestore.rules` and the zod schemas on write rather than at read
 * time. Keeping it here means no component or service casts documents itself.
 */
export function mapDoc<T>(snapshot: DocumentSnapshot): T | null {
  if (!snapshot.exists()) return null
  return { id: snapshot.id, ...snapshot.data() } as T
}

export function mapDocs<T>(snapshot: QuerySnapshot): T[] {
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T)
}

/** Merges parallel query results, keeping first-seen order and dropping duplicate ids. */
export function dedupeById<T extends { id: string }>(...groups: T[][]): T[] {
  const seen = new Set<string>()
  const merged: T[] = []
  for (const group of groups) {
    for (const item of group) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      merged.push(item)
    }
  }
  return merged
}
