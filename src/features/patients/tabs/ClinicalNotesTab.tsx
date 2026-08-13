import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextAreaField } from '@/components/ui/Field'
import { Card, EmptyState, ErrorNotice, InfoNotice, Spinner } from '@/components/ui/primitives'
import { useActor } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import { addClinicalEntry, listClinicalEntries } from '@/services/clinicalEntries'
import { CLINICAL_ENTRY_LABELS, type ClinicalEntry } from '@/types/models'
import { formatDateTime } from '@/lib/format'

/**
 * Clinical notes as dated entries attributed to the signed-in user (FR-M01-05).
 *
 * Entries are appended, never edited — a note records what was observed at a point in time, so a
 * correction is a further note rather than a rewrite of the original.
 *
 * Previous dental history is deliberately *not* here. It is a single fact about the patient taken
 * once at registration, so it lives on the patient record beside the medical screening; this tab is
 * the running record of care given at this clinic. Entries created before that split still render
 * with their original label.
 */
export function ClinicalNotesTab({ patientId }: { patientId: string }) {
  const actor = useActor()
  const { notify } = useToast()

  const [entries, setEntries] = useState<ClinicalEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setEntries(await listClinicalEntries(patientId))
    } catch (error) {
      console.error('Failed to load clinical entries', error)
      setLoadError('Could not load the clinical entries.')
      setEntries([])
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAdd() {
    if (text.trim() === '') {
      setSaveError('Write the entry before saving.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      await addClinicalEntry(patientId, 'clinicalNote', text, actor)
      setText('')
      notify('Clinical note added.')
      await load()
    } catch (error) {
      console.error('Failed to add clinical entry', error)
      setSaveError('Could not save the entry. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Add a clinical note">
        <div className="space-y-4">
          {saveError && <ErrorNotice>{saveError}</ErrorNotice>}

          <TextAreaField
            label="Clinical note"
            rows={4}
            value={text}
            disabled={saving}
            onChange={(event) => setText(event.target.value)}
            placeholder="Examination findings, observations, advice given…"
            hint={`Saved against ${actor.displayName} with today’s date. Entries cannot be edited afterwards.`}
          />

          <div className="flex justify-end">
            <Button onClick={() => void handleAdd()} loading={saving}>
              Add note
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Notes" description="Newest first.">
        {loadError ? (
          <ErrorNotice>{loadError}</ErrorNotice>
        ) : entries === null ? (
          <Spinner label="Loading entries" />
        ) : entries.length === 0 ? (
          <EmptyState
            title="No clinical notes yet"
            description="Examination findings and observations recorded here appear in date order. Previous dental history is on the Medical history tab."
          />
        ) : (
          <ol className="space-y-4">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  {/* Only surfaced for entries predating the move of dental history onto the
                      patient record; every new note is a clinical note. */}
                  {entry.type === 'dentalHistory' && (
                    <span className="rounded-full bg-aqua-100 px-2 py-0.5 font-medium text-aqua-600">
                      {CLINICAL_ENTRY_LABELS.dentalHistory}
                    </span>
                  )}
                  <span className="text-ink-muted">{formatDateTime(entry.createdAt)}</span>
                  <span className="text-ink-muted">· {entry.authorName}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap text-ink">{entry.text}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <InfoNotice>
        Diagnosis sheets, treatment plans and consent records are specified as separate modules and
        are not part of the patient registry.
      </InfoNotice>
    </div>
  )
}
