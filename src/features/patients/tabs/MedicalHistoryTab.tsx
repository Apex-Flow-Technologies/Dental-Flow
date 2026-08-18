import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge, Card, ErrorNotice, InfoNotice } from '@/components/ui/primitives'
import { YesNoField } from '@/components/ui/YesNoField'
import { useActor } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import { updatePatient } from '@/services/patients'
import {
  MEDICAL_FLAG_DETAIL_LABELS,
  MEDICAL_FLAG_KEYS,
  MEDICAL_FLAG_LABELS,
  type MedicalFlagKey,
  type MedicalHistory,
  type Patient,
} from '@/types/models'
import { patientToForm, toPatientInput } from '../patientSchema'
import { VitalsPanel } from './VitalsPanel'
import { DictatedTextArea } from '@/components/ui/DictatedTextArea'

interface MedicalHistoryTabProps {
  patient: Patient
  onSaved: (patient: Patient) => void
}

/**
 * The four mandatory screening decisions (FR-M01-04), editable on their own.
 *
 * Separate from the demographics form so a doctor updating a medical answer chairside does not
 * have to walk past every address field, and so the change lands in the audit trail as a medical
 * edit rather than a demographic one.
 */
export function MedicalHistoryTab({ patient, onSaved }: MedicalHistoryTabProps) {
  const actor = useActor()
  const { notify } = useToast()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<MedicalHistory>(patient.medicalHistory)
  const [dentalHistory, setDentalHistory] = useState(patient.previousDentalHistory ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startEditing() {
    setDraft(patient.medicalHistory)
    setDentalHistory(patient.previousDentalHistory ?? '')
    setError(null)
    setEditing(true)
  }

  const missingDetail = MEDICAL_FLAG_KEYS.filter(
    (key) => draft[key].status && draft[key].detail.trim() === '',
  )

  async function handleSave() {
    if (missingDetail.length > 0) {
      setError('Record the details for every answer marked Yes.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      // Reuse the demographics conversion so both paths write an identically shaped document,
      // then overlay just the medical answers.
      const input = toPatientInput(patientToForm(patient))
      const updated = await updatePatient(
        patient,
        { ...input, medicalHistory: draft, previousDentalHistory: dentalHistory.trim() },
        actor,
      )
      onSaved(updated)
      setEditing(false)
      notify('Medical history updated.')
    } catch (caught) {
      console.error('Failed to update medical history', caught)
      setError('Could not save the medical history. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <Card title="Edit medical history">
        <div className="space-y-4">
          {error && <ErrorNotice>{error}</ErrorNotice>}

          <div className="grid gap-4 lg:grid-cols-2">
            {MEDICAL_FLAG_KEYS.map((key) => (
              <YesNoField
                key={key}
                label={MEDICAL_FLAG_LABELS[key]}
                detailLabel={MEDICAL_FLAG_DETAIL_LABELS[key]}
                value={draft[key].status}
                detail={draft[key].detail}
                disabled={saving}
                detailError={
                  missingDetail.includes(key) && error ? 'Record the details.' : undefined
                }
                onChange={(status) =>
                  setDraft((current) => ({
                    ...current,
                    // Clearing the detail on No stops a stale note outliving the Yes it belonged to.
                    [key]: { status, detail: status ? current[key].detail : '' },
                  }))
                }
                onDetailChange={(detail) =>
                  setDraft((current) => ({ ...current, [key]: { ...current[key], detail } }))
                }
              />
            ))}
          </div>

          <DictatedTextArea
            label="Previous dental history"
            rows={3}
            disabled={saving}
            value={dentalHistory}
            onChange={setDentalHistory}
            hint="Treatments, extractions, dentures or appliances from before this clinic."
            placeholder="e.g. RCT on 36 elsewhere in 2023, upper partial denture, extraction of 18"
          />

          <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} loading={saving}>
              Save medical history
            </Button>
          </div>
        </div>
      </Card>
    )
  }

  const positives = MEDICAL_FLAG_KEYS.filter((key) => patient.medicalHistory?.[key]?.status)
  const dental = (patient.previousDentalHistory ?? '').trim()

  return (
    <div className="space-y-6">
      <Card
        title="Medical history"
        description="Screening answers recorded at registration and updated since."
        action={
          <Button variant="secondary" size="sm" onClick={startEditing}>
            Edit
          </Button>
        }
      >
        <div className="space-y-4">
          {positives.length > 0 ? (
            <div className="flex flex-wrap gap-2 rounded-lg border border-warn/30 bg-warn-100 p-3">
              <span className="text-sm font-medium text-warn">Flagged:</span>
              {positives.map((key) => (
                <Badge key={key} tone="warn">
                  {MEDICAL_FLAG_LABELS[key]}
                </Badge>
              ))}
            </div>
          ) : (
            <InfoNotice>No medical conditions flagged at screening.</InfoNotice>
          )}

          <ul className="divide-y divide-line rounded-lg border border-line">
            {MEDICAL_FLAG_KEYS.map((key) => (
              <MedicalRow key={key} flagKey={key} history={patient.medicalHistory} />
            ))}
          </ul>
        </div>
      </Card>

      {/* Directly below the medical history, mirroring the registration card's layout. */}
      <Card
        title="Previous dental history"
        description="Treatment received before coming to this clinic."
        action={
          <Button variant="secondary" size="sm" onClick={startEditing}>
            Edit
          </Button>
        }
      >
        {dental === '' ? (
          <p className="text-sm text-ink-muted">
            No previous dental history recorded at registration.
          </p>
        ) : (
          <p className="text-sm whitespace-pre-wrap text-ink">{dental}</p>
        )}
      </Card>

      <VitalsPanel patientId={patient.id} />
    </div>
  )
}

function MedicalRow({
  flagKey,
  history,
}: {
  flagKey: MedicalFlagKey
  history: MedicalHistory | undefined
}) {
  const flag = history?.[flagKey]

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-navy">{MEDICAL_FLAG_LABELS[flagKey]}</p>
        {flag?.status && flag.detail && (
          <p className="mt-1 text-sm break-words text-ink-muted">{flag.detail}</p>
        )}
      </div>
      <Badge tone={flag?.status ? 'warn' : 'neutral'}>{flag?.status ? 'Yes' : 'No'}</Badge>
    </li>
  )
}
