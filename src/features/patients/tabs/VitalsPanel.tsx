import { useCallback, useEffect, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { Badge, Card, EmptyState, ErrorNotice, Spinner } from '@/components/ui/primitives'
import { useActor } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import {
  addVitals,
  classifyBloodPressure,
  classifySugar,
  deleteVitals,
  FLAG_LABEL,
  FLAG_TONE,
  listVitals,
} from '@/services/vitals'
import {
  SUGAR_KINDS,
  SUGAR_KIND_LABELS,
  SUGAR_KIND_UNITS,
  type SugarKind,
  type VitalsReading,
} from '@/types/models'
import { formatDate, fromDateInput, todayInput } from '@/lib/format'

/**
 * Blood pressure and blood sugar readings.
 *
 * Sits with the medical history because that is the decision it feeds: a dentist checks BP before
 * an extraction and sugar before anything that has to heal. Readings are dated and kept, so the
 * trend is visible rather than just the last value.
 */
export function VitalsPanel({ patientId }: { patientId: string }) {
  const actor = useActor()
  const { notify } = useToast()

  const [readings, setReadings] = useState<VitalsReading[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [takenAt, setTakenAt] = useState(todayInput())
  const [systolic, setSystolic] = useState('')
  const [diastolic, setDiastolic] = useState('')
  const [pulse, setPulse] = useState('')
  const [sugarValue, setSugarValue] = useState('')
  const [sugarKind, setSugarKind] = useState<SugarKind>('random')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setReadings(await listVitals(patientId))
    } catch (caught) {
      console.error('Failed to load vitals', caught)
      setLoadError('Could not load the readings.')
      setReadings([])
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  function reset() {
    setTakenAt(todayInput())
    setSystolic('')
    setDiastolic('')
    setPulse('')
    setSugarValue('')
    setNotes('')
    setError(null)
  }

  const num = (value: string): number | null => {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }

  async function handleSave() {
    const sys = num(systolic)
    const dia = num(diastolic)
    const sugar = num(sugarValue)

    // A reading with nothing in it is not a reading.
    if (sys === null && dia === null && sugar === null) {
      setError('Enter a blood pressure or a sugar reading.')
      return
    }
    // Half a blood pressure is not interpretable, so both halves are required together.
    if ((sys === null) !== (dia === null)) {
      setError('Blood pressure needs both the systolic and diastolic values.')
      return
    }
    if (sys !== null && dia !== null && sys <= dia) {
      setError('Systolic should be higher than diastolic — check the reading.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await addVitals(
        patientId,
        {
          takenAt: fromDateInput(takenAt) ?? Timestamp.now(),
          systolic: sys,
          diastolic: dia,
          pulse: num(pulse),
          sugarValue: sugar,
          sugarKind: sugar === null ? null : sugarKind,
          notes,
          recordedByName: actor.displayName || actor.email,
        },
        actor,
      )
      reset()
      setAdding(false)
      notify('Reading recorded.')
      await load()
    } catch (caught) {
      console.error('Failed to save vitals', caught)
      setError('Could not save the reading. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(reading: VitalsReading) {
    try {
      await deleteVitals(patientId, reading, actor)
      await load()
    } catch (caught) {
      console.error('Failed to remove reading', caught)
      notify('Could not remove that reading.', 'error')
    }
  }

  return (
    <Card
      title="Blood pressure & sugar"
      description="Dated readings. The most recent is at the top."
      action={
        !adding && (
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            Add reading
          </Button>
        )
      }
    >
      {adding && (
        <div className="mb-6 rounded-lg border border-line bg-pale/60 p-4">
          <div className="space-y-4">
            {error && <ErrorNotice>{error}</ErrorNotice>}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField
                label="Date taken"
                type="date"
                value={takenAt}
                onChange={(event) => setTakenAt(event.target.value)}
              />
              <TextField
                label="Systolic"
                inputMode="numeric"
                className="no-spinner"
                placeholder="120"
                hint="mm Hg"
                value={systolic}
                onChange={(event) => setSystolic(event.target.value)}
              />
              <TextField
                label="Diastolic"
                inputMode="numeric"
                className="no-spinner"
                placeholder="80"
                hint="mm Hg"
                value={diastolic}
                onChange={(event) => setDiastolic(event.target.value)}
              />
              <TextField
                label="Pulse"
                inputMode="numeric"
                className="no-spinner"
                placeholder="72"
                hint="per minute, optional"
                value={pulse}
                onChange={(event) => setPulse(event.target.value)}
              />

              <SelectField
                label="Sugar test"
                value={sugarKind}
                onChange={(event) => setSugarKind(event.target.value as SugarKind)}
              >
                {SUGAR_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {SUGAR_KIND_LABELS[kind]}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Sugar value"
                inputMode="decimal"
                className="no-spinner"
                hint={SUGAR_KIND_UNITS[sugarKind]}
                value={sugarValue}
                onChange={(event) => setSugarValue(event.target.value)}
              />
              <TextField
                label="Notes"
                className="sm:col-span-2"
                placeholder="On medication, measured after rest…"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setAdding(false)
                  reset()
                }}
              >
                Cancel
              </Button>
              <Button onClick={() => void handleSave()} loading={saving}>
                Save reading
              </Button>
            </div>
          </div>
        </div>
      )}

      {loadError ? (
        <ErrorNotice>{loadError}</ErrorNotice>
      ) : readings === null ? (
        <Spinner label="Loading readings" />
      ) : readings.length === 0 ? (
        <EmptyState
          title="No readings recorded"
          description="Blood pressure and sugar taken at a visit appear here in date order."
        />
      ) : (
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="w-full min-w-2xl border-collapse text-sm">
            <thead>
              <tr className="bg-pale text-left">
                {['Date', 'Blood pressure', 'Pulse', 'Sugar', 'Recorded by', ''].map(
                  (heading, index) => (
                    <th
                      key={heading || index}
                      scope="col"
                      className="px-4 py-3 text-xs font-semibold tracking-wide text-navy uppercase"
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => {
                const bpFlag = classifyBloodPressure(reading.systolic, reading.diastolic)
                const sugarFlag = classifySugar(reading.sugarValue, reading.sugarKind)
                return (
                  <tr key={reading.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-ink">
                      {formatDate(reading.takenAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {reading.systolic !== null && reading.diastolic !== null ? (
                        <span className="flex items-center gap-2">
                          <span className="font-medium tabular-nums text-ink">
                            {reading.systolic}/{reading.diastolic}
                          </span>
                          {bpFlag !== 'normal' && (
                            <Badge tone={FLAG_TONE[bpFlag]}>{FLAG_LABEL[bpFlag]}</Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-muted">
                      {reading.pulse ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {reading.sugarValue !== null && reading.sugarKind ? (
                        <span className="flex items-center gap-2">
                          <span className="font-medium tabular-nums text-ink">
                            {reading.sugarValue} {SUGAR_KIND_UNITS[reading.sugarKind]}
                          </span>
                          <span className="text-xs text-ink-muted">
                            {SUGAR_KIND_LABELS[reading.sugarKind]}
                          </span>
                          {sugarFlag !== 'normal' && (
                            <Badge tone={FLAG_TONE[sugarFlag]}>{FLAG_LABEL[sugarFlag]}</Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {reading.recordedByName}
                      {reading.notes && (
                        <span className="mt-0.5 block text-xs">{reading.notes}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDelete(reading)}
                        className="rounded px-2 py-1 text-xs font-medium text-ink-muted hover:bg-pale hover:text-danger"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
