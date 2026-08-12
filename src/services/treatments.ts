import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { TreatmentRecord, TreatmentStatus } from '@/types/models'
import { writeAudit, type Actor } from './audit'
import { mapDocs } from './mapping'

/**
 * The treatment-table container of FR-M01-06.
 *
 * The SRS explicitly defers detailed treatment, payment, follow-up, signature, diagnosis and
 * estimate fields to their own modules. This holds the patient link and a minimal row so the
 * relationship exists and the paper treatment table has somewhere to go — do not grow it here.
 * When the Treatment module is specified, extend `TreatmentRecord` rather than starting over.
 */
const treatmentsCollection = (patientId: string) =>
  collection(db, 'patients', patientId, 'treatments')

export interface TreatmentInput {
  status: TreatmentStatus
  procedure: string
  tooth: string
  notes: string
}

export async function listTreatments(patientId: string): Promise<TreatmentRecord[]> {
  const snapshot = await getDocs(query(treatmentsCollection(patientId), orderBy('createdAt', 'desc')))
  return mapDocs<TreatmentRecord>(snapshot)
}

export async function addTreatment(
  patientId: string,
  input: TreatmentInput,
  actor: Actor,
): Promise<void> {
  const created = await addDoc(treatmentsCollection(patientId), {
    patientId,
    ...input,
    procedure: input.procedure.trim(),
    tooth: input.tooth.trim(),
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedBy: actor.uid,
  })

  await writeAudit({
    entity: 'treatment',
    entityId: created.id,
    patientId,
    action: 'create',
    changes: [
      { field: 'procedure', label: 'Treatment added', from: '', to: input.procedure.trim() || '—' },
    ],
    actor,
  })
}

export async function updateTreatmentStatus(
  patientId: string,
  treatment: TreatmentRecord,
  status: TreatmentStatus,
  actor: Actor,
): Promise<void> {
  if (treatment.status === status) return

  await updateDoc(doc(db, 'patients', patientId, 'treatments', treatment.id), {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  })

  await writeAudit({
    entity: 'treatment',
    entityId: treatment.id,
    patientId,
    action: 'update',
    changes: [{ field: 'status', label: 'Treatment status', from: treatment.status, to: status }],
    actor,
  })
}

export async function deleteTreatment(
  patientId: string,
  treatment: TreatmentRecord,
  actor: Actor,
): Promise<void> {
  await deleteDoc(doc(db, 'patients', patientId, 'treatments', treatment.id))

  await writeAudit({
    entity: 'treatment',
    entityId: treatment.id,
    patientId,
    action: 'update',
    changes: [
      { field: 'deleted', label: 'Treatment removed', from: treatment.procedure || '—', to: '—' },
    ],
    actor,
  })
}
