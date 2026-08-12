import { z } from 'zod'
import { Timestamp } from 'firebase/firestore'
import {
  BRANCHES,
  SEXES,
  type MedicalFlagKey,
  type Patient,
  type PatientInput,
} from '@/types/models'
import { fromDateInput, normaliseIndianPhone, toDateInput, todayInput } from '@/lib/format'

/**
 * Form-level shape. Every field is a string because that is what HTML inputs produce; the
 * conversion to Firestore types happens once, in `toPatientInput`, rather than being scattered
 * through the component.
 */
const flagSchema = z.object({
  status: z.enum(['yes', 'no', '']),
  detail: z.string(),
})

const indianPhone = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => normaliseIndianPhone(value).length === 10, {
      message: `${label} must be a 10-digit mobile number.`,
    })

export const patientFormSchema = z
  .object({
    fileNumber: z.string().trim().min(1, 'File number is required.'),
    registrationDate: z.string().min(1, 'Registration date is required.'),
    branch: z.enum(BRANCHES, { message: 'Select a branch.' }),

    fullName: z
      .string()
      .trim()
      .min(2, 'Enter the patient’s full name.')
      .max(120, 'Name is too long.'),
    dob: z.string(),
    ageAtRegistration: z.string(),
    sex: z.enum(SEXES, { message: 'Select the patient’s sex.' }),
    referral: z.string().trim().max(120, 'Referral is too long.'),

    phone: indianPhone('Phone'),
    altPhone: z
      .string()
      .trim()
      .refine((value) => value === '' || normaliseIndianPhone(value).length === 10, {
        message: 'Alternate phone must be a 10-digit mobile number.',
      }),
    email: z
      .string()
      .trim()
      .refine((value) => value === '' || z.email().safeParse(value).success, {
        message: 'Enter a valid email address.',
      }),
    occupation: z.string().trim().max(80, 'Occupation is too long.'),

    guardianName: z.string().trim().max(120, 'Name is too long.'),
    guardianRelation: z.string().trim().max(60, 'Relation is too long.'),
    guardianPhone: z
      .string()
      .trim()
      .refine((value) => value === '' || normaliseIndianPhone(value).length === 10, {
        message: 'Must be a 10-digit mobile number.',
      }),

    addressLine1: z.string().trim().min(1, 'Address is required.').max(200, 'Address is too long.'),
    addressCity: z.string().trim().min(1, 'City is required.').max(80, 'City is too long.'),
    addressState: z.string().trim().max(80, 'State is too long.'),
    addressPincode: z
      .string()
      .trim()
      .refine((value) => value === '' || /^\d{6}$/.test(value), {
        message: 'Pincode must be 6 digits.',
      }),

    hypertensive: flagSchema,
    diabetic: flagSchema,
    otherIllness: flagSchema,
    medicineAllergy: flagSchema,
  })
  .superRefine((values, ctx) => {
    /* --- Age: DOB is authoritative, age typed only when DOB is unknown ------------------- */
    const hasDob = values.dob !== ''
    const hasAge = values.ageAtRegistration.trim() !== ''

    if (!hasDob && !hasAge) {
      ctx.addIssue({
        code: 'custom',
        path: ['dob'],
        message: 'Enter a date of birth, or an age if the date of birth is unknown.',
      })
    }

    if (hasDob) {
      const parsed = new Date(values.dob)
      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({ code: 'custom', path: ['dob'], message: 'That is not a valid date.' })
      } else if (parsed.getTime() > Date.now()) {
        ctx.addIssue({
          code: 'custom',
          path: ['dob'],
          message: 'Date of birth cannot be in the future.',
        })
      }
    }

    if (!hasDob && hasAge) {
      const age = Number(values.ageAtRegistration)
      if (!Number.isInteger(age) || age < 0 || age > 130) {
        ctx.addIssue({
          code: 'custom',
          path: ['ageAtRegistration'],
          message: 'Enter a whole age between 0 and 130.',
        })
      }
    }

    /* --- Registration date --------------------------------------------------------------- */
    if (values.registrationDate && new Date(values.registrationDate).getTime() > Date.now()) {
      ctx.addIssue({
        code: 'custom',
        path: ['registrationDate'],
        message: 'Registration date cannot be in the future.',
      })
    }

    /* --- Medical screening: all four must be answered, Yes needs detail (FR-M01-04) ------- */
    const flags: MedicalFlagKey[] = ['hypertensive', 'diabetic', 'otherIllness', 'medicineAllergy']
    for (const key of flags) {
      const flag = values[key]
      if (flag.status === '') {
        ctx.addIssue({
          code: 'custom',
          path: [key, 'status'],
          message: 'Answer Yes or No.',
        })
      } else if (flag.status === 'yes' && flag.detail.trim() === '') {
        ctx.addIssue({
          code: 'custom',
          path: [key, 'detail'],
          message: 'Record the details for this answer.',
        })
      }
    }

    /* --- Alternate phone must actually be an alternative --------------------------------- */
    if (
      values.altPhone.trim() !== '' &&
      normaliseIndianPhone(values.altPhone) === normaliseIndianPhone(values.phone)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['altPhone'],
        message: 'Alternate phone is the same as the primary phone.',
      })
    }

    /* --- Guardian: a name without a way to reach them is not a usable contact ------------- */
    if (values.guardianName.trim() !== '' && values.guardianPhone.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['guardianPhone'],
        message: 'Add a phone number for this contact.',
      })
    }
  })

export type PatientFormValues = z.infer<typeof patientFormSchema>

/** Blank form, pre-filled with today's registration date and the suggested file number. */
export function emptyPatientForm(fileNumber = ''): PatientFormValues {
  const blankFlag = { status: '' as const, detail: '' }
  return {
    fileNumber,
    registrationDate: todayInput(),
    branch: 'villivakkam',
    fullName: '',
    dob: '',
    ageAtRegistration: '',
    sex: 'male',
    referral: '',
    phone: '',
    altPhone: '',
    email: '',
    occupation: '',
    guardianName: '',
    guardianRelation: '',
    guardianPhone: '',
    addressLine1: '',
    addressCity: '',
    addressState: 'Tamil Nadu',
    addressPincode: '',
    hypertensive: { ...blankFlag },
    diabetic: { ...blankFlag },
    otherIllness: { ...blankFlag },
    medicineAllergy: { ...blankFlag },
  }
}

/** Existing patient -> form values, for the edit path. */
export function patientToForm(patient: Patient): PatientFormValues {
  const flag = (key: MedicalFlagKey) => ({
    status: (patient.medicalHistory?.[key]?.status ? 'yes' : 'no') as 'yes' | 'no',
    detail: patient.medicalHistory?.[key]?.detail ?? '',
  })

  return {
    fileNumber: patient.fileNumber,
    registrationDate: toDateInput(patient.registrationDate),
    branch: patient.branch,
    fullName: patient.fullName,
    dob: toDateInput(patient.dob),
    ageAtRegistration: patient.ageAtRegistration === null ? '' : String(patient.ageAtRegistration),
    sex: patient.sex,
    referral: patient.referral ?? '',
    phone: patient.phone,
    altPhone: patient.altPhone ?? '',
    email: patient.email ?? '',
    occupation: patient.occupation ?? '',
    guardianName: patient.guardian?.name ?? '',
    guardianRelation: patient.guardian?.relation ?? '',
    guardianPhone: patient.guardian?.phone ?? '',
    addressLine1: patient.address?.line1 ?? '',
    addressCity: patient.address?.city ?? '',
    addressState: patient.address?.state ?? '',
    addressPincode: patient.address?.pincode ?? '',
    hypertensive: flag('hypertensive'),
    diabetic: flag('diabetic'),
    otherIllness: flag('otherIllness'),
    medicineAllergy: flag('medicineAllergy'),
  }
}

/** Form values -> the shape the service layer writes. Runs only after validation has passed. */
export function toPatientInput(values: PatientFormValues): PatientInput {
  const hasDob = values.dob !== ''
  // `Number('')` is 0, which would silently record a newborn. The zod schema rejects an empty
  // value, but this conversion is also reached from the medical-history tab, which does not run it.
  const typedAge = values.ageAtRegistration.trim()
  const ageAtRegistration = hasDob || typedAge === '' ? null : Number(typedAge)

  const flag = (key: MedicalFlagKey) => ({
    status: values[key].status === 'yes',
    // Detail is dropped when the answer is No, so a stale note cannot outlive the Yes it belonged to.
    detail: values[key].status === 'yes' ? values[key].detail.trim() : '',
  })

  const guardianName = values.guardianName.trim()

  return {
    fileNumber: values.fileNumber,
    registrationDate: fromDateInput(values.registrationDate) ?? Timestamp.now(),
    branch: values.branch,
    fullName: values.fullName,
    dob: hasDob ? fromDateInput(values.dob) : null,
    ageAtRegistration,
    sex: values.sex,
    referral: values.referral.trim() || null,
    phone: values.phone,
    altPhone: values.altPhone.trim() || null,
    email: values.email.trim() || null,
    occupation: values.occupation.trim() || null,
    guardian: guardianName
      ? {
          name: guardianName,
          relation: values.guardianRelation.trim(),
          phone: normaliseIndianPhone(values.guardianPhone),
        }
      : null,
    address: {
      line1: values.addressLine1.trim(),
      city: values.addressCity.trim(),
      state: values.addressState.trim(),
      pincode: values.addressPincode.trim(),
    },
    medicalHistory: {
      hypertensive: flag('hypertensive'),
      diabetic: flag('diabetic'),
      otherIllness: flag('otherIllness'),
      medicineAllergy: flag('medicineAllergy'),
    },
  }
}
