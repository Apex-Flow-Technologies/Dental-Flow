import { Controller, useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/Button'
import { ReadOnlyField, SelectField, TextField } from '@/components/ui/Field'
import { DictatedTextArea } from '@/components/ui/DictatedTextArea'
import { PhotoField } from '@/components/ui/PhotoField'
import { YesNoField } from '@/components/ui/YesNoField'
import { ErrorNotice, FormSection, InfoNotice } from '@/components/ui/primitives'
import {
  BRANCHES,
  BRANCH_LABELS,
  PATIENT_CATEGORIES,
  PATIENT_CATEGORY_LABELS,
  MEDICAL_FLAG_DETAIL_LABELS,
  MEDICAL_FLAG_KEYS,
  MEDICAL_FLAG_LABELS,
  SEXES,
  SEX_LABELS,
} from '@/types/models'
import { calcAgeFromInput } from '@/lib/format'
import {
  emptyPatientForm,
  patientFormSchema,
  type PatientFormValues,
} from './patientSchema'

interface PatientFormProps {
  defaultValues?: PatientFormValues
  /** Shown under the file number when the value was suggested rather than typed. */
  suggestedFileNumber?: string
  submitLabel: string
  onSubmit: (values: PatientFormValues) => Promise<void>
  onCancel?: () => void
  /** Server-side failure surfaced against a field — a taken file number, most importantly. */
  fieldError?: { field: keyof PatientFormValues; message: string } | null
  formError?: string | null
  /** Suggested consultation fee for the selected category, from the clinic fee schedule. */
  suggestedFeeAmount?: number | null
  currency?: string
}

const grid = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

/**
 * The digital equivalent of the paper registration card. Used for both create and edit, so the two
 * paths cannot drift apart in what they validate.
 *
 * Section order deliberately mirrors the paper card — file keys, then identity, then contact, then
 * medical screening — so staff transcribing an old card read straight down without hunting.
 */
export function PatientForm({
  defaultValues,
  suggestedFileNumber,
  submitLabel,
  onSubmit,
  onCancel,
  fieldError,
  formError,
  suggestedFeeAmount = null,
  currency = '₹',
}: PatientFormProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: defaultValues ?? emptyPatientForm(),
    // Re-validate as the user corrects a field, so a fixed error clears without a second submit.
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  })

  const dob = watch('dob')
  const derivedAge = calcAgeFromInput(dob)
  const dobKnown = dob !== ''

  const submit: SubmitHandler<PatientFormValues> = async (values) => {
    await onSubmit(values)
  }

  // A server rejection (e.g. file number taken) outranks the client-side message for that field.
  const errorFor = (field: keyof PatientFormValues): string | undefined => {
    if (fieldError?.field === field) return fieldError.message
    const entry = errors[field]
    return typeof entry?.message === 'string' ? entry.message : undefined
  }

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-8">
      {formError && <ErrorNotice>{formError}</ErrorNotice>}

      <FormSection
        title="File keys"
        description="The identifiers this record is filed and found under."
      >
        <div className={grid}>
          <TextField
            label="Clinic file number"
            required
            error={errorFor('fileNumber')}
            hint={
              suggestedFileNumber && !errorFor('fileNumber')
                ? `Suggested: ${suggestedFileNumber}. Overwrite it to match an existing paper card.`
                : undefined
            }
            {...register('fileNumber')}
          />
          <TextField
            label="Registration date"
            type="date"
            required
            error={errorFor('registrationDate')}
            {...register('registrationDate')}
          />
          <SelectField label="Branch" required error={errorFor('branch')} {...register('branch')}>
            {BRANCHES.map((branch) => (
              <option key={branch} value={branch}>
                {BRANCH_LABELS[branch]}
              </option>
            ))}
          </SelectField>
        </div>
      </FormSection>

      <FormSection title="Patient">
        <div className={grid}>
          <TextField
            label="Full name"
            required
            autoComplete="off"
            className="sm:col-span-2"
            error={errorFor('fullName')}
            {...register('fullName')}
          />

          <SelectField label="Sex" required error={errorFor('sex')} {...register('sex')}>
            {SEXES.map((sex) => (
              <option key={sex} value={sex}>
                {SEX_LABELS[sex]}
              </option>
            ))}
          </SelectField>

          <TextField
            label="Date of birth"
            type="date"
            error={errorFor('dob')}
            hint={dobKnown ? undefined : 'Leave blank only if the date of birth is unknown.'}
            {...register('dob')}
            onChange={(event) => {
              register('dob').onChange(event)
              // Age and DOB are mutually exclusive; entering a DOB clears any age typed earlier.
              if (event.target.value !== '') setValue('ageAtRegistration', '')
            }}
          />

          {dobKnown ? (
            <ReadOnlyField
              label="Age"
              value={derivedAge === null ? '—' : `${derivedAge} years`}
              hint="Calculated from the date of birth."
            />
          ) : (
            <TextField
              label="Age"
              type="number"
              inputMode="numeric"
              min={0}
              max={130}
              className="no-spinner"
              error={errorFor('ageAtRegistration')}
              hint="Recorded as the age on the registration date."
              {...register('ageAtRegistration')}
            />
          )}

          <TextField label="Occupation" error={errorFor('occupation')} {...register('occupation')} />
          <TextField
            label="Referred by"
            hint="Optional — who sent the patient."
            error={errorFor('referral')}
            {...register('referral')}
          />

          <SelectField
            label="Patient category"
            required
            error={errorFor('category')}
            hint="Drives which consultation fee is suggested."
            {...register('category')}
          >
            {PATIENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {PATIENT_CATEGORY_LABELS[category]}
              </option>
            ))}
          </SelectField>

          <TextField
            label="Consultation fee"
            inputMode="decimal"
            className="no-spinner"
            placeholder={suggestedFeeAmount === null ? '' : String(suggestedFeeAmount)}
            hint={
              suggestedFeeAmount === null
                ? 'Optional. Overridable at billing.'
                : `Suggested ${currency}${suggestedFeeAmount} for this category. Leave blank to use it.`
            }
            error={errorFor('consultationFee')}
            {...register('consultationFee')}
          />

          <Controller
            name="photoDataUrl"
            control={control}
            render={({ field }) => (
              <div className="sm:col-span-2 lg:col-span-3">
                <PhotoField
                  value={field.value}
                  onChange={field.onChange}
                  name={watch('fullName')}
                />
              </div>
            )}
          />
        </div>
      </FormSection>

      <FormSection title="Contact">
        <div className={grid}>
          <TextField
            label="Phone"
            type="tel"
            inputMode="tel"
            required
            autoComplete="off"
            error={errorFor('phone')}
            hint="Primary lookup after file number and name."
            {...register('phone')}
          />
          <TextField
            label="Alternate phone"
            type="tel"
            inputMode="tel"
            error={errorFor('altPhone')}
            {...register('altPhone')}
          />
          <TextField label="Email" type="email" error={errorFor('email')} {...register('email')} />

          <TextField
            label="Address"
            required
            className="sm:col-span-2"
            error={errorFor('addressLine1')}
            {...register('addressLine1')}
          />
          <TextField
            label="City"
            required
            error={errorFor('addressCity')}
            {...register('addressCity')}
          />
          <TextField label="State" error={errorFor('addressState')} {...register('addressState')} />
          <TextField
            label="Pincode"
            inputMode="numeric"
            maxLength={6}
            className="no-spinner"
            error={errorFor('addressPincode')}
            {...register('addressPincode')}
          />
        </div>
      </FormSection>

      <FormSection
        title="Spouse or guardian"
        description="One contact, as on the paper card. Optional."
      >
        <div className={grid}>
          <TextField label="Name" error={errorFor('guardianName')} {...register('guardianName')} />
          <TextField
            label="Relation"
            placeholder="Spouse, father, guardian…"
            error={errorFor('guardianRelation')}
            {...register('guardianRelation')}
          />
          <TextField
            label="Phone"
            type="tel"
            inputMode="tel"
            error={errorFor('guardianPhone')}
            {...register('guardianPhone')}
          />
        </div>
      </FormSection>

      <FormSection
        title="Medical history"
        description="All four questions must be answered before the record can be saved."
      >
        <InfoNotice>
          A blank answer is not the same as “No”. Record what the patient actually reported — later
          treatment decisions depend on it.
        </InfoNotice>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {MEDICAL_FLAG_KEYS.map((key) => (
            <Controller
              key={key}
              name={key}
              control={control}
              render={({ field }) => (
                <YesNoField
                  label={MEDICAL_FLAG_LABELS[key]}
                  detailLabel={MEDICAL_FLAG_DETAIL_LABELS[key]}
                  value={field.value.status === '' ? null : field.value.status === 'yes'}
                  detail={field.value.detail}
                  onChange={(next) =>
                    field.onChange({ ...field.value, status: next ? 'yes' : 'no' })
                  }
                  onDetailChange={(detail) => field.onChange({ ...field.value, detail })}
                  error={errors[key]?.status?.message}
                  detailError={errors[key]?.detail?.message}
                />
              )}
            />
          ))}
        </div>

        {/* Sits with the medical screening, as on the paper card — it is history taken at
            registration, not an observation from a visit here. */}
        <Controller
          name="previousDentalHistory"
          control={control}
          render={({ field }) => (
            <DictatedTextArea
              label="Previous dental history"
              className="mt-4"
              rows={3}
              value={field.value}
              onChange={field.onChange}
              error={errorFor('previousDentalHistory')}
              hint="Treatments, extractions, dentures or appliances from before this clinic. Leave blank if none."
              placeholder="e.g. RCT on 36 elsewhere in 2023, upper partial denture, extraction of 18"
            />
          )}
        />
      </FormSection>

      <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-6">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
