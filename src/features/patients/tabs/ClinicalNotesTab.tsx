import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextAreaField } from '@/components/ui/Field'
import { Card, EmptyState, ErrorNotice, InfoNotice, Spinner } from '@/components/ui/primitives'
import { useActor } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import { addClinicalEntry, listClinicalEntries } from '@/services/clinicalEntries'
import { CLINICAL_ENTRY_LABELS, type ClinicalEntry, type ClinicalEntryType } from '@/types/models'
import { formatDateTime } from '@/lib/format'

/**
 * Previous dental history and clinical notes as dated entries attributed to the signed-in user
 * (FR-M01-05).
 *
 * Entries are appended, never edited — a note records what was observed at a point in time, so a
 * correction is a further note rather than a rewrite of the original.
 */
export function ClinicalNotesTab({ patientId }: { patientId: string }) {
  const actor = useActor()
  const { notify } = useToast()

  const [entries, setEntries] = useState<ClinicalEntry[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [type, setType] = useState<ClinicalEntryType>('clinicalNote')
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
      await addClinicalEntry(patientId, type, text, actor)
      setText('')
      notify(`${CLINICAL_ENTRY_LABELS[type]} added.`)
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
      <Card title="Add an entry">
        <div className="space-y-4">
          {saveError && <ErrorNotice>{saveError}</ErrorNotice>}

          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Entry type">
            {(Object.keys(CLINICAL_ENTRY_LABELS) as ClinicalEntryType[]).map((option) => (
              <label
                key={option}
                className={`min-h-9 cursor-pointer rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-clinic ${
                  type === option
                    ? 'border-clinic bg-clinic-100 text-navy'
                    : 'border-line bg-white text-ink-muted hover:bg-pale'
                }`}
              >
                <input
                  type="radio"
                  name="entry-type"
                  className="sr-only"
                  checked={type === option}
                  onChange={() => setType(option)}
                />
                {CLINICAL_ENTRY_LABELS[option]}
              </label>
            ))}
          </div>

          <TextAreaField
            label={CLINICAL_ENTRY_LABELS[type]}
            rows={4}
            value={text}
            disabled={saving}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              type === 'dentalHistory'
                ? 'Previous treatments, extractions, appliances, complaints…'
                : 'Examination findings, observations, advice given…'
            }
            hint={`Saved against ${actor.displayName} with today’s date. Entries cannot be edited afterwards.`}
          />

          <div className="flex justify-end">
            <Button onClick={() => void handleAdd()} loading={saving}>
              Add entry
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Entries" description="Newest first.">
        {loadError ? (
          <ErrorNotice>{loadError}</ErrorNotice>
        ) : entries === null ? (
          <Spinner label="Loading entries" />
        ) : entries.length === 0 ? (
          <EmptyState
            title="No clinical entries yet"
            description="Previous dental history and clinical notes recorded here appear in date order."
          />
        ) : (
          <ol className="space-y-4">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-line p-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${
                      entry.type === 'dentalHistory'
                        ? 'bg-aqua-100 text-aqua-600'
                        : 'bg-clinic-100 text-navy'
                    }`}
                  >
                    {CLINICAL_ENTRY_LABELS[entry.type]}
                  </span>
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
