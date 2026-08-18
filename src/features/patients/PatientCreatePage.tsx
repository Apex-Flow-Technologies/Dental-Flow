import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useActor } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import { Card, PageHeader, Spinner } from '@/components/ui/primitives'
import {
  createPatient,
  findDuplicates,
  suggestNextFileNumber,
  FileNumberTakenError,
} from '@/services/patients'
import type { Patient } from '@/types/models'
import {
  getClinicSettings,
  suggestedFee,
  DEFAULT_SETTINGS,
  type ClinicSettings,
} from '@/services/clinicSettings'
import { PatientForm } from './PatientForm'
import { DuplicateWarningDialog } from './DuplicateWarningDialog'
import {
  emptyPatientForm,
  toPatientInput,
  type PatientFormValues,
} from './patientSchema'

/** Create Patient flow (FR-M01-02 / 03 / 04 / 07). */
export function PatientCreatePage() {
  const actor = useActor()
  const navigate = useNavigate()
  const { notify } = useToast()

  const [defaults, setDefaults] = useState<PatientFormValues | null>(null)
  const [suggested, setSuggested] = useState('')
  const [settings, setSettings] = useState<ClinicSettings>(DEFAULT_SETTINGS)
  const [fieldError, setFieldError] = useState<{
    field: keyof PatientFormValues
    message: string
  } | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [duplicates, setDuplicates] = useState<Patient[]>([])
  const [confirming, setConfirming] = useState(false)
  // Held so "Create anyway" saves exactly what was on screen when the warning appeared.
  const pendingValues = useRef<PatientFormValues | null>(null)

  useEffect(() => {
    let cancelled = false
    suggestNextFileNumber()
      .then((fileNumber) => {
        if (cancelled) return
        setSuggested(fileNumber)
        setDefaults(emptyPatientForm(fileNumber))
      })
      .catch(() => {
        // A failed suggestion must not block registration — staff can type the number themselves.
        if (cancelled) return
        setDefaults(emptyPatientForm())
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    getClinicSettings()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded)
      })
      // A missing fee schedule must not block a registration; the field simply stays blank.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  async function save(values: PatientFormValues) {
    setFieldError(null)
    setFormError(null)
    try {
      const patient = await createPatient(toPatientInput(values), actor)
      notify(`Patient ${patient.fullName} registered as file ${patient.fileNumber}.`)
      navigate(`/patients/${patient.id}`, { replace: true })
    } catch (error) {
      if (error instanceof FileNumberTakenError) {
        setFieldError({
          field: 'fileNumber',
          message: `File number ${error.fileNumber} is already assigned. Enter a different one.`,
        })
      } else {
        console.error('Failed to create patient', error)
        setFormError('Could not save the patient. Check your connection and try again.')
      }
      throw error
    }
  }

  /** Checks for likely duplicates first; the save itself happens in `save`. */
  async function handleSubmit(values: PatientFormValues) {
    setFieldError(null)
    setFormError(null)

    let matches: Patient[] = []
    try {
      matches = await findDuplicates(toPatientInput(values))
    } catch (error) {
      // A failed duplicate check is not a reason to refuse a registration; log and continue.
      console.error('Duplicate check failed', error)
    }

    if (matches.length > 0) {
      pendingValues.current = values
      setDuplicates(matches)
      return
    }

    try {
      await save(values)
    } catch {
      // Already surfaced on the form by `save`.
    }
  }

  async function handleConfirmDuplicate() {
    const values = pendingValues.current
    if (!values) return

    setConfirming(true)
    try {
      await save(values)
      setDuplicates([])
    } catch {
      // Close the dialog so the error on the form underneath is visible.
      setDuplicates([])
    } finally {
      setConfirming(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Register a new patient"
        subtitle="Captures everything on the paper registration card. Fields marked * are required."
      />

      <Card>
        {defaults === null ? (
          <Spinner label="Preparing the file number" />
        ) : (
          <PatientForm
            defaultValues={defaults}
            suggestedFileNumber={suggested}
            submitLabel="Register patient"
            onSubmit={handleSubmit}
            onCancel={() => navigate('/patients')}
            fieldError={fieldError}
            formError={formError}
            suggestedFeeAmount={suggestedFee(settings, 'new')?.amount ?? null}
            currency={settings.currency}
          />
        )}
      </Card>

      <DuplicateWarningDialog
        open={duplicates.length > 0}
        matches={duplicates}
        confirming={confirming}
        onCancel={() => {
          setDuplicates([])
          pendingValues.current = null
        }}
        onConfirm={() => void handleConfirmDuplicate()}
      />
    </>
  )
}
