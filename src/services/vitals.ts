import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { VitalsInput, VitalsReading } from '@/types/models'
import { writeAudit, type Actor } from './audit'
import { mapDocs } from './mapping'

/**
 * Blood pressure and blood sugar readings.
 *
 * A subcollection rather than fields on the patient, because the clinically useful thing is the
 * trend across visits — a single "current BP" on the record loses exactly the information a
 * dentist wants before an extraction.
 */
const vitalsCollection = (patientId: string) => collection(db, 'patients', patientId, 'vitals')

export async function listVitals(patientId: string): Promise<VitalsReading[]> {
  const snapshot = await getDocs(query(vitalsCollection(patientId), orderBy('takenAt', 'desc')))
  return mapDocs<VitalsReading>(snapshot)
}

function describe(input: VitalsInput): string {
  const parts: string[] = []
  if (input.systolic !== null && input.diastolic !== null) {
    parts.push(`BP ${input.systolic}/${input.diastolic}`)
  }
  if (input.pulse !== null) parts.push(`pulse ${input.pulse}`)
  if (input.sugarValue !== null && input.sugarKind) {
    parts.push(`${input.sugarKind} ${input.sugarValue}`)
  }
  return parts.join(', ') || 'reading'
}

export async function addVitals(
  patientId: string,
  input: VitalsInput,
  actor: Actor,
): Promise<void> {
  const created = await addDoc(vitalsCollection(patientId), {
    patientId,
    ...input,
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedBy: actor.uid,
  })

  await writeAudit({
    entity: 'medicalHistory',
    entityId: created.id,
    patientId,
    action: 'create',
    changes: [{ field: 'vitals', label: 'Vitals recorded', from: '', to: describe(input) }],
    actor,
  })
}

export async function deleteVitals(
  patientId: string,
  reading: VitalsReading,
  actor: Actor,
): Promise<void> {
  await deleteDoc(doc(db, 'patients', patientId, 'vitals', reading.id))

  await writeAudit({
    entity: 'medicalHistory',
    entityId: reading.id,
    patientId,
    action: 'update',
    changes: [
      {
        field: 'vitals',
        label: 'Vitals reading removed',
        from: describe(reading),
        to: '—',
      },
    ],
    actor,
  })
}

/* ------------------------------------------------------------ interpretation */

export type VitalsFlag = 'normal' | 'elevated' | 'high' | 'low'

/**
 * Blood-pressure banding, ACC/AHA.
 *
 * Advisory only — it colours a row so a reading worth a second look is not lost in a table. It is
 * not a diagnosis, and deliberately errs toward flagging: an unnecessarily highlighted row costs
 * a glance, a missed hypertensive reading before an extraction costs more.
 */
export function classifyBloodPressure(
  systolic: number | null,
  diastolic: number | null,
): VitalsFlag {
  if (systolic === null || diastolic === null) return 'normal'
  if (systolic < 90 || diastolic < 60) return 'low'
  if (systolic >= 140 || diastolic >= 90) return 'high'
  if (systolic >= 130 || diastolic >= 80) return 'elevated'
  if (systolic >= 120) return 'elevated'
  return 'normal'
}

/** Sugar banding. The thresholds differ per test, which is why the kind is stored with the value. */
export function classifySugar(value: number | null, kind: string | null): VitalsFlag {
  if (value === null || !kind) return 'normal'
  switch (kind) {
    case 'fasting':
      if (value < 70) return 'low'
      if (value >= 126) return 'high'
      return value >= 100 ? 'elevated' : 'normal'
    case 'postPrandial':
      if (value < 70) return 'low'
      if (value >= 200) return 'high'
      return value >= 140 ? 'elevated' : 'normal'
    case 'random':
      if (value < 70) return 'low'
      if (value >= 200) return 'high'
      return value >= 140 ? 'elevated' : 'normal'
    case 'hba1c':
      if (value >= 6.5) return 'high'
      return value >= 5.7 ? 'elevated' : 'normal'
    default:
      return 'normal'
  }
}

export const FLAG_TONE: Record<VitalsFlag, 'neutral' | 'warn' | 'danger' | 'info'> = {
  normal: 'neutral',
  elevated: 'warn',
  high: 'danger',
  low: 'info',
}

export const FLAG_LABEL: Record<VitalsFlag, string> = {
  normal: 'Normal',
  elevated: 'Elevated',
  high: 'High',
  low: 'Low',
}
