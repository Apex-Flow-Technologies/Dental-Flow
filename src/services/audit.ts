import {
  addDoc,
  collection,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { AuditAction, AuditChange, AuditEntity, AuditEntry } from '@/types/models'
import { mapDocs } from './mapping'

/** Who performed the action. Passed in rather than read from context so services stay UI-free. */
export interface Actor {
  uid: string
  email: string
  displayName: string
}

const auditCollection = collection(db, 'auditLog')

export interface WriteAuditParams {
  entity: AuditEntity
  entityId: string
  patientId: string | null
  action: AuditAction
  changes: AuditChange[]
  actor: Actor
}

/**
 * Appends one audit entry (FR-M01-08).
 *
 * An update with no field changes writes nothing — an audit trail full of no-op saves is one
 * nobody reads. Failures are swallowed and logged: an audit write must never roll back or block
 * the clinical save the user actually asked for.
 */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  if (params.action === 'update' && params.changes.length === 0) return

  try {
    await addDoc(auditCollection, {
      entity: params.entity,
      entityId: params.entityId,
      patientId: params.patientId,
      action: params.action,
      changes: params.changes,
      actorId: params.actor.uid,
      actorEmail: params.actor.email,
      at: serverTimestamp(),
    })
  } catch (error) {
    console.error('Failed to write audit entry', params, error)
  }
}

/** Audit trail for one patient, newest first. */
export async function listPatientAudit(patientId: string, max = 100): Promise<AuditEntry[]> {
  const snapshot = await getDocs(
    query(auditCollection, where('patientId', '==', patientId), orderBy('at', 'desc'), limitTo(max)),
  )
  return mapDocs<AuditEntry>(snapshot)
}

/** Clinic-wide audit trail, newest first. */
export async function listRecentAudit(max = 200): Promise<AuditEntry[]> {
  const snapshot = await getDocs(query(auditCollection, orderBy('at', 'desc'), limitTo(max)))
  return mapDocs<AuditEntry>(snapshot)
}
