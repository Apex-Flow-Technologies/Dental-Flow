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
import {
  RADIOGRAPH_LABELS,
  type RadiographAdvice,
  type RadiographAdviceInput,
} from '@/types/models'
import { writeAudit, type Actor } from './audit'
import { mapDocs } from './mapping'

/**
 * Imaging advised at a visit — "advised for OPG, lateral cephalogram, CBCT".
 *
 * Tracked as records rather than free text so an outstanding investigation is answerable: the
 * clinically important question is not "what did we write down" but "what did we ask for that has
 * not come back", which prose cannot answer.
 */
const adviceCollection = (patientId: string) =>
  collection(db, 'patients', patientId, 'radiographAdvice')

export async function listRadiographAdvice(patientId: string): Promise<RadiographAdvice[]> {
  const snapshot = await getDocs(query(adviceCollection(patientId), orderBy('advisedOn', 'desc')))
  return mapDocs<RadiographAdvice>(snapshot)
}

const describe = (input: Pick<RadiographAdvice, 'types' | 'region'>): string => {
  const names = input.types.map((type) => RADIOGRAPH_LABELS[type]).join(', ')
  return input.region.trim() ? `${names} — ${input.region.trim()}` : names
}

export async function addRadiographAdvice(
  patientId: string,
  input: RadiographAdviceInput,
  actor: Actor,
): Promise<void> {
  if (input.types.length === 0) throw new Error('Select at least one investigation.')

  const created = await addDoc(adviceCollection(patientId), {
    patientId,
    ...input,
    region: input.region.trim(),
    reason: input.reason.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedBy: actor.uid,
  })

  await writeAudit({
    entity: 'clinicalEntry',
    entityId: created.id,
    patientId,
    action: 'create',
    changes: [{ field: 'radiograph', label: 'Imaging advised', from: '', to: describe(input) }],
    actor,
  })
}

/** Marks an advised investigation as received, so the outstanding list stays meaningful. */
export async function setRadiographReceived(
  patientId: string,
  advice: RadiographAdvice,
  received: boolean,
  actor: Actor,
): Promise<void> {
  await updateDoc(doc(db, 'patients', patientId, 'radiographAdvice', advice.id), {
    received,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  })

  await writeAudit({
    entity: 'clinicalEntry',
    entityId: advice.id,
    patientId,
    action: 'update',
    changes: [
      {
        field: 'radiograph',
        label: describe(advice),
        from: advice.received ? 'Received' : 'Awaited',
        to: received ? 'Received' : 'Awaited',
      },
    ],
    actor,
  })
}

export async function deleteRadiographAdvice(
  patientId: string,
  advice: RadiographAdvice,
  actor: Actor,
): Promise<void> {
  await deleteDoc(doc(db, 'patients', patientId, 'radiographAdvice', advice.id))

  await writeAudit({
    entity: 'clinicalEntry',
    entityId: advice.id,
    patientId,
    action: 'update',
    changes: [
      { field: 'radiograph', label: 'Imaging advice removed', from: describe(advice), to: '—' },
    ],
    actor,
  })
}
