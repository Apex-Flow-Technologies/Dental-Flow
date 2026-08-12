import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, DataItem } from '@/components/ui/primitives'
import { useActor } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import { FileNumberTakenError, updatePatient } from '@/services/patients'
import { BRANCH_LABELS, SEX_LABELS, type Patient } from '@/types/models'
import {
  displayAge,
  formatAge,
  formatDate,
  formatDateTime,
  formatPhone,
  orDash,
} from '@/lib/format'
import { PatientForm } from '../PatientForm'
import { patientToForm, toPatientInput, type PatientFormValues } from '../patientSchema'

interface DemographicsTabProps {
  patient: Patient
  onSaved: (patient: Patient) => void
}

/** Read view of the paper card, with the same form used for registration behind an Edit button. */
export function DemographicsTab({ patient, onSaved }: DemographicsTabProps) {
  const actor = useActor()
  const { notify } = useToast()
  const [editing, setEditing] = useState(false)
  const [fieldError, setFieldError] = useState<{
    field: keyof PatientFormValues
    message: string
  } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit(values: PatientFormValues) {
    setFieldError(null)
    setFormError(null)
    try {
      const updated = await updatePatient(patient, toPatientInput(values), actor)
      onSaved(updated)
      setEditing(false)
      notify('Patient record updated.')
    } catch (error) {
      if (error instanceof FileNumberTakenError) {
        setFieldError({
          field: 'fileNumber',
          message: `File number ${error.fileNumber} belongs to another patient.`,
        })
      } else {
        console.error('Failed to update patient', error)
        setFormError('Could not save the changes. Check your connection and try again.')
      }
    }
  }

  if (editing) {
    return (
      <Card title="Edit patient record">
        <PatientForm
          defaultValues={patientToForm(patient)}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
          onCancel={() => {
            setEditing(false)
            setFieldError(null)
            setFormError(null)
          }}
          fieldError={fieldError}
          formError={formError}
        />
      </Card>
    )
  }

  const age = displayAge(patient)

  return (
    <div className="space-y-6">
      <Card
        title="Patient details"
        action={
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Edit record
          </Button>
        }
      >
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <DataItem label="Clinic file number" value={patient.fileNumber} />
          <DataItem label="Registration date" value={formatDate(patient.registrationDate)} />
          <DataItem label="Branch" value={BRANCH_LABELS[patient.branch]} />

          <DataItem label="Full name" value={patient.fullName} />
          <DataItem label="Sex" value={SEX_LABELS[patient.sex]} />
          <DataItem
            label="Date of birth"
            value={
              patient.dob ? (
                formatDate(patient.dob)
              ) : (
                <span className="text-ink-muted">Not recorded</span>
              )
            }
          />
          <DataItem
            label="Age"
            value={
              <>
                {formatAge(age)}
                {age.approximate && (
                  <span className="ml-2 text-xs text-ink-muted">
                    estimated from age at registration
                  </span>
                )}
              </>
            }
          />
          <DataItem label="Occupation" value={orDash(patient.occupation)} />
          <DataItem label="Referred by" value={orDash(patient.referral)} />
        </dl>
      </Card>

      <Card title="Contact">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <DataItem label="Phone" value={formatPhone(patient.phone)} />
          <DataItem
            label="Alternate phone"
            value={patient.altPhone ? formatPhone(patient.altPhone) : '—'}
          />
          <DataItem label="Email" value={orDash(patient.email)} />
          <DataItem
            label="Address"
            value={
              [patient.address?.line1, patient.address?.city, patient.address?.state]
                .filter(Boolean)
                .join(', ') || '—'
            }
          />
          <DataItem label="Pincode" value={orDash(patient.address?.pincode)} />
          <DataItem
            label="Spouse / guardian"
            value={
              patient.guardian
                ? `${patient.guardian.name}${
                    patient.guardian.relation ? ` (${patient.guardian.relation})` : ''
                  } · ${formatPhone(patient.guardian.phone)}`
                : '—'
            }
          />
        </dl>
      </Card>

      <Card title="Record history">
        <dl className="grid gap-5 sm:grid-cols-2">
          <DataItem label="Created" value={formatDateTime(patient.createdAt)} />
          <DataItem label="Last updated" value={formatDateTime(patient.updatedAt)} />
        </dl>
      </Card>
    </div>
  )
}
