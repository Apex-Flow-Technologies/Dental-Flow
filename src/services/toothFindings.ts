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
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type {
  FindingContext,
  ToothFinding,
  ToothFindingInput,
  ToothSurface,
} from '@/types/models'
import { writeAudit, type Actor } from './audit'
import { mapDocs } from './mapping'

/**
 * Every Firestore read and write for tooth findings (Module 02 — Charting).
 *
 * Components never import `firebase/firestore` — same rule as the patient module. The chart, the
 * 3D patient view and any future printout are all views over this one collection, so it is the
 * only place tooth state lives.
 */
const findingsCollection = (patientId: string) =>
  collection(db, 'patients', patientId, 'toothFindings')

const findingDoc = (patientId: string, findingId: string) =>
  doc(db, 'patients', patientId, 'toothFindings', findingId)

/** Every finding for a patient, both contexts. The chart filters in memory — the set is small. */
export async function listToothFindings(patientId: string): Promise<ToothFinding[]> {
  const snapshot = await getDocs(query(findingsCollection(patientId), orderBy('createdAt', 'asc')))
  return mapDocs<ToothFinding>(snapshot)
}

export async function listFindingsForTooth(
  patientId: string,
  toothNumber: string,
): Promise<ToothFinding[]> {
  const snapshot = await getDocs(
    query(findingsCollection(patientId), where('toothNumber', '==', toothNumber)),
  )
  return mapDocs<ToothFinding>(snapshot)
}

/** Short human description used in the audit trail, e.g. "36 occlusal, mesial - Caries". */
function describe(toothNumber: string, surfaces: ToothSurface[], label: string): string {
  const scope = surfaces.length > 0 ? ` ${surfaces.join(', ')}` : ''
  return `${toothNumber}${scope} — ${label}`
}

export interface SaveFindingParams extends ToothFindingInput {
  /** Display label for the status, so the audit entry reads in clinical language. */
  statusLabel: string
}

/**
 * Records a finding on a tooth.
 *
 * Surface-scoped statuses (caries, restorations) carry the surfaces they were seen on;
 * whole-tooth statuses save an empty `surfaces` array. The caller is responsible for that
 * distinction because it is a clinical rule, not a storage one — see `isSurfaceScoped`.
 */
export async function addToothFinding(
  patientId: string,
  input: SaveFindingParams,
  actor: Actor,
): Promise<void> {
  const { statusLabel, ...finding } = input

  const created = await addDoc(findingsCollection(patientId), {
    patientId,
    ...finding,
    notes: finding.notes.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedBy: actor.uid,
  })

  await writeAudit({
    entity: 'toothFinding',
    entityId: created.id,
    patientId,
    action: 'create',
    changes: [
      {
        field: finding.context,
        label: finding.context === 'plan' ? 'Treatment planned' : 'Finding charted',
        from: '',
        to: describe(finding.toothNumber, finding.surfaces, statusLabel),
      },
    ],
    actor,
  })
}

export async function updateToothFinding(
  patientId: string,
  before: ToothFinding,
  /** Display label for the *previous* status, so both sides of the audit read in clinical language. */
  previousLabel: string,
  input: SaveFindingParams,
  actor: Actor,
): Promise<void> {
  const { statusLabel, ...finding } = input

  await updateDoc(findingDoc(patientId, before.id), {
    ...finding,
    notes: finding.notes.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  })

  await writeAudit({
    entity: 'toothFinding',
    entityId: before.id,
    patientId,
    action: 'update',
    changes: [
      {
        field: finding.context,
        label: `Tooth ${finding.toothNumber}`,
        from: describe(before.toothNumber, before.surfaces, previousLabel),
        to: describe(finding.toothNumber, finding.surfaces, statusLabel),
      },
    ],
    actor,
  })
}

/**
 * Removes a finding.
 *
 * Unlike patient records, findings are deletable: charting is iterative and a doctor mis-clicking
 * a tooth must be able to undo it. The audit entry preserves what was removed, so the correction
 * is recorded even though the finding is gone.
 */
export async function deleteToothFinding(
  patientId: string,
  finding: ToothFinding,
  statusLabel: string,
  actor: Actor,
): Promise<void> {
  await deleteDoc(findingDoc(patientId, finding.id))

  await writeAudit({
    entity: 'toothFinding',
    entityId: finding.id,
    patientId,
    action: 'update',
    changes: [
      {
        field: finding.context,
        label: finding.context === 'plan' ? 'Planned treatment removed' : 'Finding removed',
        from: describe(finding.toothNumber, finding.surfaces, statusLabel),
        to: '—',
      },
    ],
    actor,
  })
}

/** Clears every finding on one tooth in one context — the "Clear" action in the detail panel. */
export async function clearTooth(
  patientId: string,
  toothNumber: string,
  context: FindingContext,
  findings: ToothFinding[],
  actor: Actor,
): Promise<number> {
  const doomed = findings.filter(
    (finding) => finding.toothNumber === toothNumber && finding.context === context,
  )
  if (doomed.length === 0) return 0

  await Promise.all(doomed.map((finding) => deleteDoc(findingDoc(patientId, finding.id))))

  await writeAudit({
    entity: 'toothFinding',
    entityId: toothNumber,
    patientId,
    action: 'update',
    changes: [
      {
        field: context,
        label: `Tooth ${toothNumber} cleared`,
        from: doomed.map((finding) => finding.status).join(', '),
        to: '—',
      },
    ],
    actor,
  })

  return doomed.length
}
