import type { Timestamp } from 'firebase/firestore'

/**
 * Dental Flow v1 — M01 Patient Registry data model (SRS §4.3).
 *
 * The SRS integration contract (§5) requires that every child record carries `patientId`,
 * `createdAt`, `updatedAt`, `createdBy` and a clinic/branch identifier. `Audited` and
 * `PatientScoped` below exist so future modules (Diagnosis, Treatment Visits, Billing) inherit
 * that contract instead of re-deriving it.
 */

/** Branches listed on the clinic's public site. Confirmed scope: one shared registry, tagged by branch. */
export const BRANCHES = ['villivakkam', 'mogappair'] as const
export type Branch = (typeof BRANCHES)[number]

export const BRANCH_LABELS: Record<Branch, string> = {
  villivakkam: 'Villivakkam',
  mogappair: 'Mogappair',
}

export const SEXES = ['male', 'female', 'other'] as const
export type Sex = (typeof SEXES)[number]

export const SEX_LABELS: Record<Sex, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
}

/** Audit stamps required on every record by SRS §5. */
export interface Audited {
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  updatedBy: string
}

/**
 * One of the four mandatory medical screening decisions (FR-M01-04).
 * Modelled as an explicit boolean plus detail — the SRS states these must not be free text alone,
 * because "no note written" and "screened, answer was no" are clinically different.
 */
export interface MedicalFlag {
  status: boolean
  detail: string
}

export interface MedicalHistory {
  hypertensive: MedicalFlag
  diabetic: MedicalFlag
  otherIllness: MedicalFlag
  medicineAllergy: MedicalFlag
}

export const MEDICAL_FLAG_KEYS = [
  'hypertensive',
  'diabetic',
  'otherIllness',
  'medicineAllergy',
] as const
export type MedicalFlagKey = (typeof MEDICAL_FLAG_KEYS)[number]

export const MEDICAL_FLAG_LABELS: Record<MedicalFlagKey, string> = {
  hypertensive: 'Known hypertensive',
  diabetic: 'Known diabetic',
  otherIllness: 'Other medical illness',
  medicineAllergy: 'Allergic to any medicine',
}

/** Prompt shown for the detail field once a flag is set to Yes. */
export const MEDICAL_FLAG_DETAIL_LABELS: Record<MedicalFlagKey, string> = {
  hypertensive: 'Since when, and current medication',
  diabetic: 'Type, since when, and current medication',
  otherIllness: 'Which illness, and current treatment',
  medicineAllergy: 'Which medicines, and the reaction',
}

export function emptyMedicalHistory(): MedicalHistory {
  return {
    hypertensive: { status: false, detail: '' },
    diabetic: { status: false, detail: '' },
    otherIllness: { status: false, detail: '' },
    medicineAllergy: { status: false, detail: '' },
  }
}

export interface Address {
  line1: string
  city: string
  state: string
  pincode: string
}

/** The paper card allows one spouse OR guardian contact — not both (SRS §4.2 FR-M01-03). */
export interface GuardianContact {
  name: string
  relation: string
  phone: string
}

/**
 * The master patient record. `id` is the Firebase-generated immutable identifier the SRS calls
 * `patientId`; `fileNumber` is the clinic-facing key staff read off the paper card. Both are
 * exposed to downstream modules and must never be re-created there (SRS §5).
 */
export interface Patient extends Audited {
  id: string
  fileNumber: string
  /** Numeric part of the file number, when it has one. Feeds the next-number suggestion. */
  fileNumberSeq: number | null
  registrationDate: Timestamp
  fullName: string
  /** Lowercased `fullName`; exists only so Firestore can do prefix search on the name. */
  nameLower: string
  dob: Timestamp | null
  /**
   * Age as recorded at registration. Set ONLY when `dob` is unknown — the confirmed rule is that
   * DOB is authoritative and age is derived from it whenever DOB exists.
   */
  ageAtRegistration: number | null
  sex: Sex
  referral: string | null
  guardian: GuardianContact | null
  address: Address
  /** Normalised to digits only, so search matches regardless of how it was typed. */
  phone: string
  altPhone: string | null
  email: string | null
  occupation: string | null
  branch: Branch
  medicalHistory: MedicalHistory
  /**
   * Previous dental history, as written on the registration card.
   *
   * Captured with the medical screening rather than as a dated clinical entry: on the paper card it
   * is one field filled in once at registration describing what happened *before* this clinic, not
   * a running log of visits here. Ongoing observations belong in `ClinicalEntry`.
   *
   * Optional in practice — patients registered before this field existed will not have it.
   */
  previousDentalHistory?: string
}

/** The writable shape of a patient — everything except the server-managed fields. */
export type PatientInput = Omit<Patient, keyof Audited | 'id' | 'nameLower' | 'fileNumberSeq'>

/**
 * A dated clinical entry (FR-M01-05) — observations recorded during care at this clinic.
 * Future clinical modules are expected to reuse this collection rather than invent their own.
 *
 * `dentalHistory` is retained only so entries created before previous dental history moved onto the
 * patient record still render. Nothing creates new ones; new entries are always `clinicalNote`.
 */
export const CLINICAL_ENTRY_TYPES = ['dentalHistory', 'clinicalNote'] as const
export type ClinicalEntryType = (typeof CLINICAL_ENTRY_TYPES)[number]

export const CLINICAL_ENTRY_LABELS: Record<ClinicalEntryType, string> = {
  dentalHistory: 'Previous dental history',
  clinicalNote: 'Clinical note',
}

export interface ClinicalEntry {
  id: string
  patientId: string
  type: ClinicalEntryType
  text: string
  authorId: string
  /** Denormalised so the notes list renders without an extra read per entry. */
  authorName: string
  createdAt: Timestamp
}

/**
 * Placeholder treatment row (FR-M01-06). The SRS defers detailed treatment, payment, follow-up,
 * signature, diagnosis and estimate fields to their own modules, so this carries the patient link
 * and a status only. Do not extend it here — extend it when the Treatment module is specified.
 */
export const TREATMENT_STATUSES = ['planned', 'inProgress', 'completed'] as const
export type TreatmentStatus = (typeof TREATMENT_STATUSES)[number]

export const TREATMENT_STATUS_LABELS: Record<TreatmentStatus, string> = {
  planned: 'Planned',
  inProgress: 'In progress',
  completed: 'Completed',
}

export interface TreatmentRecord extends Audited {
  id: string
  patientId: string
  status: TreatmentStatus
  /** Free text until the Treatment module defines a procedure catalogue. */
  procedure: string
  /** Tooth number/quadrant as written on the paper sheet. Not validated against a notation yet. */
  tooth: string
  notes: string
}

/**
 * A clinic user. The confirmed role model is a single combined doctor/admin role, so `role` has
 * one value today — it exists as a field so restricting permissions later is a data change rather
 * than a schema migration.
 */
export const USER_ROLES = ['staff'] as const
export type UserRole = (typeof USER_ROLES)[number]

export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  /** Cleared to false to revoke access; security rules reject inactive users on the next request. */
  active: boolean
  createdAt: Timestamp
  createdBy: string
}

/** One field-level change inside an audit entry. Values are pre-formatted for display. */
export interface AuditChange {
  field: string
  label: string
  from: string
  to: string
}

/**
 * Append-only audit trail (FR-M01-08). Entries are never updated or deleted — `firestore.rules`
 * denies both, which is what makes this a trail rather than a log.
 */
export const AUDIT_ACTIONS = ['create', 'update'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_ENTITIES = [
  'patient',
  'medicalHistory',
  'clinicalEntry',
  'treatment',
  'toothFinding',
  'user',
] as const
export type AuditEntity = (typeof AUDIT_ENTITIES)[number]

export const AUDIT_ENTITY_LABELS: Record<AuditEntity, string> = {
  patient: 'Patient demographics',
  medicalHistory: 'Medical history',
  clinicalEntry: 'Clinical entry',
  treatment: 'Treatment',
  toothFinding: 'Tooth chart',
  user: 'User account',
}

export interface AuditEntry {
  id: string
  entity: AuditEntity
  entityId: string
  /** Set for every patient-scoped entity so the patient's Audit tab is a single query. */
  patientId: string | null
  action: AuditAction
  changes: AuditChange[]
  actorId: string
  actorEmail: string
  at: Timestamp
}

/* ==========================================================================
   Module 02 — Charting
   ========================================================================== */

export type Dentition = 'permanent' | 'primary'

export const TOOTH_SURFACES = [
  'mesial',
  'distal',
  'buccal',
  'labial',
  'lingual',
  'palatal',
  'occlusal',
  'incisal',
] as const
export type ToothSurface = (typeof TOOTH_SURFACES)[number]

export const TOOTH_STATUSES = [
  'sound',
  'caries',
  'restored',
  'rootCanalTreated',
  'crown',
  'bridge',
  'implant',
  'missing',
  'extractionPlanned',
] as const
export type ToothStatus = (typeof TOOTH_STATUSES)[number]

/** What was observed, versus what is proposed. One collection, split by this. */
export const FINDING_CONTEXTS = ['finding', 'plan'] as const
export type FindingContext = (typeof FINDING_CONTEXTS)[number]

export const FINDING_CONTEXT_LABELS: Record<FindingContext, string> = {
  finding: 'Findings',
  plan: 'Treatment plan',
}

/**
 * One charted observation or proposal on one tooth.
 *
 * Deliberately a data record rather than state inside a renderer: the 2D chart, the 3D patient
 * view and any future printout are all views over this one collection. Keeping tooth state in the
 * scene graph would cost the ability to print a chart, to run without WebGL, and to answer
 * questions like "which patients have untreated caries on a lower molar".
 */
export interface ToothFinding extends Audited {
  id: string
  patientId: string
  /** FDI two-digit number, stored as a string so the leading quadrant digit survives. */
  toothNumber: string
  dentition: Dentition
  /** Empty when the finding applies to the whole tooth. */
  surfaces: ToothSurface[]
  status: ToothStatus
  context: FindingContext
  notes: string
}

/** The writable shape of a finding — everything except the server-managed fields. */
export type ToothFindingInput = Omit<ToothFinding, keyof Audited | 'id' | 'patientId'>
