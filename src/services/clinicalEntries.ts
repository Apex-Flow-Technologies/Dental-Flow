import { addDoc, collection, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ClinicalEntry, ClinicalEntryType } from '@/types/models'
import { writeAudit, type Actor } from './audit'
import { mapDocs } from './mapping'

/**
 * Clinical entries live in a subcollection of the patient (FR-M01-05). Keeping them out of the
 * patient document means the notes list can grow indefinitely without bloating every patient read,
 * and future clinical modules can query them independently.
 */
const entriesCollection = (patientId: string) =>
  collection(db, 'patients', patientId, 'clinicalEntries')

export async function listClinicalEntries(patientId: string): Promise<ClinicalEntry[]> {
  const snapshot = await getDocs(query(entriesCollection(patientId), orderBy('createdAt', 'desc')))
  return mapDocs<ClinicalEntry>(snapshot)
}

/**
 * Appends a dated entry attributed to the signed-in user.
 *
 * Entries are add-only — a clinical note is a record of what was observed at a point in time, so
 * it is never edited or deleted in place. Corrections are made by adding a further note, and
 * `firestore.rules` denies update and delete to enforce that.
 */
export async function addClinicalEntry(
  patientId: string,
  type: ClinicalEntryType,
  text: string,
  actor: Actor,
): Promise<void> {
  const trimmed = text.trim()
  if (trimmed === '') throw new Error('A clinical entry cannot be empty.')

  const created = await addDoc(entriesCollection(patientId), {
    patientId,
    type,
    text: trimmed,
    authorId: actor.uid,
    authorName: actor.displayName || actor.email,
    createdAt: serverTimestamp(),
  })

  await writeAudit({
    entity: 'clinicalEntry',
    entityId: created.id,
    patientId,
    action: 'create',
    changes: [{ field: 'text', label: 'Entry added', from: '', to: trimmed }],
    actor,
  })
}
