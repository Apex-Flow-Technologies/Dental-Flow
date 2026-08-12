import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  BRANCH_LABELS,
  MEDICAL_FLAG_KEYS,
  MEDICAL_FLAG_LABELS,
  SEX_LABELS,
  type AuditChange,
  type Patient,
  type PatientInput,
} from '@/types/models'
import {
  fileNumberSeq,
  formatDate,
  nameKey,
  normaliseFileNumber,
  normaliseIndianPhone,
} from '@/lib/format'
import { writeAudit, type Actor } from './audit'
import { dedupeById, mapDoc, mapDocs } from './mapping'

const patientsCollection = collection(db, 'patients')
const fileNumberDoc = (fileNumber: string) => doc(db, 'fileNumbers', fileNumber)
const counterDoc = doc(db, 'counters', 'fileNumber')

/** Thrown when a file number is already reserved. Carries the field so the form can highlight it. */
export class FileNumberTakenError extends Error {
  readonly field = 'fileNumber' as const
  readonly fileNumber: string

  constructor(fileNumber: string) {
    super(`File number ${fileNumber} is already assigned to another patient.`)
    this.name = 'FileNumberTakenError'
    this.fileNumber = fileNumber
  }
}

/* ------------------------------------------------------------- file numbers */

/**
 * Next file number to pre-fill on the create form.
 *
 * Read from a counter rather than by scanning patients, so a deleted or renumbered record cannot
 * cause the suggestion to collide with a number already in use. The value is only a suggestion —
 * staff may overwrite it, which is what makes entering legacy paper cards possible — so a stale
 * read is harmless; the reservation in `createPatient` is what actually guarantees uniqueness.
 */
export async function suggestNextFileNumber(): Promise<string> {
  const snapshot = await getDoc(counterDoc)
  const next = snapshot.exists() ? (snapshot.data().next as number | undefined) : undefined
  return String(typeof next === 'number' && next > 0 ? next : 1)
}

export async function isFileNumberAvailable(fileNumber: string): Promise<boolean> {
  const snapshot = await getDoc(fileNumberDoc(normaliseFileNumber(fileNumber)))
  return !snapshot.exists()
}

/* --------------------------------------------------------------- read paths */

export async function getPatient(patientId: string): Promise<Patient | null> {
  return mapDoc<Patient>(await getDoc(doc(db, 'patients', patientId)))
}

/** Most recently updated patients — the landing state of the Old Patients view. */
export async function listRecentPatients(max = 25): Promise<Patient[]> {
  const snapshot = await getDocs(
    query(patientsCollection, orderBy('updatedAt', 'desc'), limitTo(max)),
  )
  return mapDocs<Patient>(snapshot)
}

/**
 * Search by file number, name, primary phone or alternate phone (FR-M01-01).
 *
 * Firestore has neither OR across fields nor substring matching, so each field gets its own query
 * and the results are merged. Name uses a prefix range (`\uf8ff` is the highest code point Firestore
 * sorts, making it an open-ended upper bound) — so "raj" finds "Rajesh Kumar" but not "Neeraj".
 * Both phone fields are matched against the number with +91/0 stripped, so the stored form and the
 * typed form agree regardless of how either was written.
 */
export async function searchPatients(rawQuery: string, max = 40): Promise<Patient[]> {
  const term = rawQuery.trim()
  if (term === '') return listRecentPatients(max)

  const searches: Promise<Patient[]>[] = []

  const asFileNumber = normaliseFileNumber(term)
  searches.push(
    getDocs(query(patientsCollection, where('fileNumber', '==', asFileNumber), limitTo(max))).then(
      mapDocs<Patient>,
    ),
  )

  const digits = normaliseIndianPhone(term)
  if (digits.length >= 4) {
    searches.push(
      getDocs(query(patientsCollection, where('phone', '==', digits), limitTo(max))).then(
        mapDocs<Patient>,
      ),
      getDocs(query(patientsCollection, where('altPhone', '==', digits), limitTo(max))).then(
        mapDocs<Patient>,
      ),
    )
  }

  const key = nameKey(term)
  if (key.length >= 2) {
    searches.push(
      getDocs(
        query(
          patientsCollection,
          where('nameLower', '>=', key),
          where('nameLower', '<=', `${key}\uf8ff`),
          orderBy('nameLower'),
          limitTo(max),
        ),
      ).then(mapDocs<Patient>),
    )
  }

  const groups = await Promise.all(searches)
  return dedupeById<Patient>(...groups).slice(0, max)
}

/**
 * Likely duplicates of a patient about to be saved (FR-M01-07).
 *
 * Matches on the primary phone, or on an identical name with the same date of birth. Deliberately
 * a warning and not a block: families genuinely share a phone number, so the front desk has to be
 * the one to decide. File-number collisions are the opposite — those are blocked outright, in
 * `createPatient`.
 */
export async function findDuplicates(
  input: Pick<PatientInput, 'phone' | 'fullName' | 'dob'>,
  excludePatientId?: string,
): Promise<Patient[]> {
  const searches: Promise<Patient[]>[] = []

  const phone = normaliseIndianPhone(input.phone)
  if (phone.length >= 10) {
    searches.push(
      getDocs(query(patientsCollection, where('phone', '==', phone), limitTo(10))).then(
        mapDocs<Patient>,
      ),
    )
  }

  const key = nameKey(input.fullName)
  if (key.length >= 3) {
    searches.push(
      getDocs(query(patientsCollection, where('nameLower', '==', key), limitTo(10))).then(
        (snapshot) =>
          mapDocs<Patient>(snapshot).filter((candidate) => {
            // A shared name alone is too common to flag; require the birth date to agree too.
            if (!input.dob || !candidate.dob) return false
            return candidate.dob.isEqual(input.dob)
          }),
      ),
    )
  }

  if (searches.length === 0) return []

  const groups = await Promise.all(searches)
  return dedupeById<Patient>(...groups).filter((candidate) => candidate.id !== excludePatientId)
}

/* -------------------------------------------------------------- write paths */

/** Fields Firestore stores that are derived from the input rather than typed by the user. */
function derived(input: PatientInput) {
  const fileNumber = normaliseFileNumber(input.fileNumber)
  return {
    ...input,
    fileNumber,
    fileNumberSeq: fileNumberSeq(fileNumber),
    fullName: input.fullName.trim().replace(/\s+/g, ' '),
    nameLower: nameKey(input.fullName),
    phone: normaliseIndianPhone(input.phone),
    altPhone: input.altPhone ? normaliseIndianPhone(input.altPhone) : null,
    email: input.email?.trim().toLowerCase() || null,
  }
}

/**
 * Creates a patient and reserves its file number atomically (FR-M01-07).
 *
 * The uniqueness guarantee lives in the `fileNumbers/{fileNumber}` document: a transaction that
 * reads it, finds it present, and aborts cannot be beaten by a concurrent create, because
 * Firestore re-runs the transaction if that document changed underneath it. Checking
 * `isFileNumberAvailable` and then writing would leave a window where two receptionists
 * registering at once both pass the check.
 */
export async function createPatient(input: PatientInput, actor: Actor): Promise<Patient> {
  const data = derived(input)
  const patientRef = doc(patientsCollection)
  const reservationRef = fileNumberDoc(data.fileNumber)

  await runTransaction(db, async (transaction) => {
    // Firestore requires every read in a transaction to happen before any write.
    const [existing, counter] = await Promise.all([
      transaction.get(reservationRef),
      transaction.get(counterDoc),
    ])

    if (existing.exists()) throw new FileNumberTakenError(data.fileNumber)

    transaction.set(reservationRef, {
      patientId: patientRef.id,
      assignedAt: serverTimestamp(),
      assignedBy: actor.uid,
    })

    transaction.set(patientRef, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: actor.uid,
      updatedBy: actor.uid,
    })

    // Keep the suggestion ahead of the highest number used, including manually entered legacy ones.
    const currentNext = counter.exists() ? ((counter.data().next as number | undefined) ?? 1) : 1
    const nextFromThis = data.fileNumberSeq === null ? 1 : data.fileNumberSeq + 1
    transaction.set(counterDoc, { next: Math.max(currentNext, nextFromThis) }, { merge: true })
  })

  await writeAudit({
    entity: 'patient',
    entityId: patientRef.id,
    patientId: patientRef.id,
    action: 'create',
    changes: [
      { field: 'fileNumber', label: 'File number', from: '', to: data.fileNumber },
      { field: 'fullName', label: 'Name', from: '', to: data.fullName },
    ],
    actor,
  })

  const created = await getPatient(patientRef.id)
  if (!created) throw new Error('Patient was created but could not be read back.')
  return created
}

/**
 * Updates a patient and records exactly what changed.
 *
 * Changing the file number moves the reservation in the same transaction, so the old number
 * becomes free and the new one cannot be taken by anyone else in between.
 */
export async function updatePatient(
  before: Patient,
  input: PatientInput,
  actor: Actor,
): Promise<Patient> {
  const data = derived(input)
  const patientRef = doc(db, 'patients', before.id)
  const fileNumberChanged = data.fileNumber !== before.fileNumber

  await runTransaction(db, async (transaction) => {
    if (fileNumberChanged) {
      const nextRef = fileNumberDoc(data.fileNumber)
      const existing = await transaction.get(nextRef)
      if (existing.exists()) throw new FileNumberTakenError(data.fileNumber)

      transaction.delete(fileNumberDoc(before.fileNumber))
      transaction.set(nextRef, {
        patientId: before.id,
        assignedAt: serverTimestamp(),
        assignedBy: actor.uid,
      })
    }

    transaction.update(patientRef, {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    })
  })

  const changes = diffPatient(before, data)
  const demographic = changes.filter((change) => !change.field.startsWith('medicalHistory.'))
  const medical = changes.filter((change) => change.field.startsWith('medicalHistory.'))

  // Split so the medical-history tab's history is not buried inside demographic edits.
  await Promise.all([
    writeAudit({
      entity: 'patient',
      entityId: before.id,
      patientId: before.id,
      action: 'update',
      changes: demographic,
      actor,
    }),
    writeAudit({
      entity: 'medicalHistory',
      entityId: before.id,
      patientId: before.id,
      action: 'update',
      changes: medical,
      actor,
    }),
  ])

  const updated = await getPatient(before.id)
  if (!updated) throw new Error('Patient was updated but could not be read back.')
  return updated
}

/* -------------------------------------------------------------------- diff */

const FIELD_LABELS: Record<string, string> = {
  fileNumber: 'File number',
  registrationDate: 'Registration date',
  fullName: 'Name',
  dob: 'Date of birth',
  ageAtRegistration: 'Age at registration',
  sex: 'Sex',
  referral: 'Referred by',
  phone: 'Phone',
  altPhone: 'Alternate phone',
  email: 'Email',
  occupation: 'Occupation',
  branch: 'Branch',
  'guardian.name': 'Spouse / guardian name',
  'guardian.relation': 'Spouse / guardian relation',
  'guardian.phone': 'Spouse / guardian phone',
  'address.line1': 'Address',
  'address.city': 'City',
  'address.state': 'State',
  'address.pincode': 'Pincode',
}

function displayValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (value instanceof Timestamp) return formatDate(value)
  if (field === 'sex') return SEX_LABELS[value as keyof typeof SEX_LABELS] ?? String(value)
  if (field === 'branch') return BRANCH_LABELS[value as keyof typeof BRANCH_LABELS] ?? String(value)
  return String(value)
}

function push(
  changes: AuditChange[],
  field: string,
  label: string,
  from: unknown,
  to: unknown,
): void {
  const fromText = displayValue(field, from)
  const toText = displayValue(field, to)
  if (fromText !== toText) changes.push({ field, label, from: fromText, to: toText })
}

/**
 * Field-level diff for the audit trail (FR-M01-08). Only changed fields are recorded — an entry
 * listing every field on every save makes the trail unreadable and hides the edit that mattered.
 */
export function diffPatient(before: Patient, after: ReturnType<typeof derived>): AuditChange[] {
  const changes: AuditChange[] = []

  const scalars = [
    'fileNumber',
    'registrationDate',
    'fullName',
    'dob',
    'ageAtRegistration',
    'sex',
    'referral',
    'phone',
    'altPhone',
    'email',
    'occupation',
    'branch',
  ] as const

  for (const field of scalars) {
    push(changes, field, FIELD_LABELS[field], before[field], after[field])
  }

  for (const part of ['line1', 'city', 'state', 'pincode'] as const) {
    const field = `address.${part}`
    push(changes, field, FIELD_LABELS[field], before.address?.[part], after.address?.[part])
  }

  for (const part of ['name', 'relation', 'phone'] as const) {
    const field = `guardian.${part}`
    push(changes, field, FIELD_LABELS[field], before.guardian?.[part], after.guardian?.[part])
  }

  for (const key of MEDICAL_FLAG_KEYS) {
    const beforeFlag = before.medicalHistory?.[key]
    const afterFlag = after.medicalHistory?.[key]
    push(
      changes,
      `medicalHistory.${key}`,
      MEDICAL_FLAG_LABELS[key],
      beforeFlag?.status ? 'Yes' : 'No',
      afterFlag?.status ? 'Yes' : 'No',
    )
    push(
      changes,
      `medicalHistory.${key}.detail`,
      `${MEDICAL_FLAG_LABELS[key]} — details`,
      beforeFlag?.detail,
      afterFlag?.detail,
    )
  }

  return changes
}
