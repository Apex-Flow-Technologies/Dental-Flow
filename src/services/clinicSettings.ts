import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { PatientCategory } from '@/types/models'
import { writeAudit, type Actor } from './audit'

/**
 * Clinic-wide settings the doctor controls, starting with the consultation fee schedule.
 *
 * A single document rather than a collection: it is read on every billing screen and is a handful
 * of rows, so one read beats a query. The doctor sets the pricing — the app never invents an
 * amount, it only remembers the ones entered.
 */
const settingsDoc = doc(db, 'settings', 'clinic')

export interface FeeOption {
  id: string
  label: string
  amount: number
  /** Suggested automatically when a patient of this category is billed. */
  appliesTo: PatientCategory | 'any'
}

export interface ClinicSettings {
  consultationFees: FeeOption[]
  currency: string
}

/**
 * Starting fee schedule, used only until the doctor saves their own.
 *
 * Deliberately round, obviously-placeholder numbers: a plausible-looking default is worse than an
 * obvious one, because it might get billed without anyone checking.
 */
export const DEFAULT_SETTINGS: ClinicSettings = {
  currency: '₹',
  consultationFees: [
    { id: 'first', label: 'First consultation', amount: 300, appliesTo: 'new' },
    { id: 'review', label: 'Review / follow-up', amount: 200, appliesTo: 'known' },
    { id: 'regular', label: 'Regular patient', amount: 150, appliesTo: 'regular' },
    { id: 'referred', label: 'Referred by dentist', amount: 250, appliesTo: 'referred' },
    { id: 'camp', label: 'Camp / outreach', amount: 0, appliesTo: 'camp' },
  ],
}

export async function getClinicSettings(): Promise<ClinicSettings> {
  const snapshot = await getDoc(settingsDoc)
  if (!snapshot.exists()) return DEFAULT_SETTINGS

  const data = snapshot.data() as Partial<ClinicSettings>
  return {
    currency: data.currency ?? DEFAULT_SETTINGS.currency,
    // An empty saved list is a real choice; only a missing one falls back.
    consultationFees: data.consultationFees ?? DEFAULT_SETTINGS.consultationFees,
  }
}

export async function saveClinicSettings(
  settings: ClinicSettings,
  actor: Actor,
): Promise<void> {
  await setDoc(
    settingsDoc,
    { ...settings, updatedAt: serverTimestamp(), updatedBy: actor.uid },
    { merge: true },
  )

  await writeAudit({
    entity: 'user',
    entityId: 'settings',
    patientId: null,
    action: 'update',
    changes: [
      {
        field: 'consultationFees',
        label: 'Consultation fees',
        from: '',
        to: settings.consultationFees
          .map((fee) => `${fee.label} ${settings.currency}${fee.amount}`)
          .join(', '),
      },
    ],
    actor,
  })
}

/** The fee to suggest for a patient of this category, or null when nothing matches. */
export function suggestedFee(
  settings: ClinicSettings,
  category: PatientCategory | undefined,
): FeeOption | null {
  if (!category) return null
  return (
    settings.consultationFees.find((fee) => fee.appliesTo === category) ??
    settings.consultationFees.find((fee) => fee.appliesTo === 'any') ??
    null
  )
}
