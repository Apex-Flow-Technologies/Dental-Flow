import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import { Badge, Card, EmptyState, ErrorNotice, InfoNotice, Spinner } from '@/components/ui/primitives'
import { useActor } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import {
  addTreatment,
  deleteTreatment,
  listTreatments,
  updateTreatmentStatus,
  type TreatmentInput,
} from '@/services/treatments'
import {
  TREATMENT_STATUSES,
  TREATMENT_STATUS_LABELS,
  type TreatmentRecord,
  type TreatmentStatus,
} from '@/types/models'
import { formatDate } from '@/lib/format'

const EMPTY: TreatmentInput = { status: 'planned', procedure: '', tooth: '', notes: '' }

const STATUS_TONE: Record<TreatmentStatus, 'neutral' | 'info' | 'success'> = {
  planned: 'neutral',
  inProgress: 'info',
  completed: 'success',
}

/**
 * The treatment-table container of FR-M01-06.
 *
 * The SRS defers detailed treatment, payment, follow-up, signature, diagnosis and estimate fields
 * to their own modules, so this holds only enough to link a treatment to the patient. The notice
 * below is deliberately visible: without it the sparse table reads as unfinished work rather than
 * as a boundary the specification drew on purpose.
 */
export function TreatmentTab({ patientId }: { patientId: string }) {
  const actor = useActor()
  const { notify } = useToast()

  const [treatments, setTreatments] = useState<TreatmentRecord[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<TreatmentInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setTreatments(await listTreatments(patientId))
    } catch (error) {
      console.error('Failed to load treatments', error)
      setLoadError('Could not load the treatment table.')
      setTreatments([])
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAdd() {
    if (draft.procedure.trim() === '') {
      setSaveError('Enter what the treatment is.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      await addTreatment(patientId, draft, actor)
      setDraft(EMPTY)
      setAdding(false)
      notify('Treatment added.')
      await load()
    } catch (error) {
      console.error('Failed to add treatment', error)
      setSaveError('Could not save the treatment. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(treatment: TreatmentRecord, status: TreatmentStatus) {
    try {
      await updateTreatmentStatus(patientId, treatment, status, actor)
      await load()
    } catch (error) {
      console.error('Failed to update treatment status', error)
      notify('Could not update the treatment status.', 'error')
    }
  }

  async function handleDelete(treatment: TreatmentRecord) {
    try {
      await deleteTreatment(patientId, treatment, actor)
      notify('Treatment removed.')
      await load()
    } catch (error) {
      console.error('Failed to remove treatment', error)
      notify('Could not remove the treatment.', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <InfoNotice>
        <strong className="font-semibold">Placeholder module.</strong> Detailed treatment records,
        payments, estimates, next visits, signatures and the pain scale are specified as separate
        modules. This table only holds the link between a treatment and this patient so that work
        can attach to it later.
      </InfoNotice>

      <Card
        title="Treatment table"
        action={
          !adding && (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              Add treatment
            </Button>
          )
        }
      >
        {adding && (
          <div className="mb-6 rounded-lg border border-line bg-pale/60 p-4">
            <div className="space-y-4">
              {saveError && <ErrorNotice>{saveError}</ErrorNotice>}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <TextField
                  label="Treatment"
                  required
                  value={draft.procedure}
                  onChange={(event) => setDraft({ ...draft, procedure: event.target.value })}
                  placeholder="As written on the treatment sheet"
                />
                <TextField
                  label="Tooth / quadrant"
                  value={draft.tooth}
                  onChange={(event) => setDraft({ ...draft, tooth: event.target.value })}
                  placeholder="e.g. 36, upper left"
                />
                <SelectField
                  label="Status"
                  value={draft.status}
                  onChange={(event) =>
                    setDraft({ ...draft, status: event.target.value as TreatmentStatus })
                  }
                >
                  {TREATMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {TREATMENT_STATUS_LABELS[status]}
                    </option>
                  ))}
                </SelectField>
              </div>

              <TextAreaField
                label="Notes"
                rows={2}
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAdding(false)
                    setDraft(EMPTY)
                    setSaveError(null)
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={() => void handleAdd()} loading={saving}>
                  Add to table
                </Button>
              </div>
            </div>
          </div>
        )}

        {loadError ? (
          <ErrorNotice>{loadError}</ErrorNotice>
        ) : treatments === null ? (
          <Spinner label="Loading treatments" />
        ) : treatments.length === 0 ? (
          <EmptyState
            title="No treatments recorded"
            description="Rows added here link to this patient and will carry over when the Treatment module is built."
          />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {treatments.map((treatment) => (
              <li key={treatment.id} className="flex flex-wrap items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-navy">{treatment.procedure || '—'}</p>
                    {treatment.tooth && <Badge>Tooth {treatment.tooth}</Badge>}
                    <Badge tone={STATUS_TONE[treatment.status]}>
                      {TREATMENT_STATUS_LABELS[treatment.status]}
                    </Badge>
                  </div>
                  {treatment.notes && (
                    <p className="mt-1 text-sm break-words text-ink-muted">{treatment.notes}</p>
                  )}
                  <p className="mt-1 text-xs text-ink-muted">
                    Added {formatDate(treatment.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Status for ${treatment.procedure || 'treatment'}`}
                    value={treatment.status}
                    onChange={(event) =>
                      void handleStatusChange(treatment, event.target.value as TreatmentStatus)
                    }
                    className="min-h-9 rounded-lg border border-line bg-white px-2 text-sm text-ink"
                  >
                    {TREATMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {TREATMENT_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(treatment)}
                    aria-label={`Remove ${treatment.procedure || 'treatment'}`}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
