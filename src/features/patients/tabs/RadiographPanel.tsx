import { useCallback, useEffect, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { DictatedTextArea } from '@/components/ui/DictatedTextArea'
import {
  Badge,
  Card,
  EmptyState,
  ErrorNotice,
  InfoNotice,
  Spinner,
} from '@/components/ui/primitives'
import { FileIcon } from '@/components/ui/icons'
import { useActor } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import {
  addRadiographAdvice,
  deleteRadiographAdvice,
  listRadiographAdvice,
  setRadiographReceived,
} from '@/services/radiographs'
import {
  RADIOGRAPH_LABELS,
  RADIOGRAPH_TYPES,
  type RadiographAdvice,
  type RadiographType,
} from '@/types/models'
import { formatDate } from '@/lib/format'
import { describeLoadError, describeSaveError } from '@/services/errors'

/**
 * "Advised for OPG, lateral cephalogram, CBCT" — imaging requested at a visit.
 *
 * Recorded as structured records rather than a line of prose because the useful question is which
 * investigations are still outstanding. That is a filter over records; over free text it is a
 * reading exercise nobody does.
 */
export function RadiographPanel({ patientId }: { patientId: string }) {
  const actor = useActor()
  const { notify } = useToast()

  const [advice, setAdvice] = useState<RadiographAdvice[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [types, setTypes] = useState<RadiographType[]>([])
  const [region, setRegion] = useState('')
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setAdvice(await listRadiographAdvice(patientId))
    } catch (caught) {
      console.error('Failed to load radiograph advice', caught)
      setLoadError(describeLoadError(caught, 'the imaging advice'))
      setAdvice([])
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  function reset() {
    setTypes([])
    setRegion('')
    setReason('')
    setError(null)
  }

  async function handleSave() {
    if (types.length === 0) {
      setError('Select at least one investigation.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await addRadiographAdvice(
        patientId,
        {
          types,
          region,
          reason,
          advisedOn: Timestamp.now(),
          received: false,
          advisedByName: actor.displayName || actor.email,
        },
        actor,
      )
      reset()
      setAdding(false)
      notify('Imaging advice recorded.')
      await load()
    } catch (caught) {
      console.error('Failed to save radiograph advice', caught)
      setError(describeSaveError(caught, 'the imaging advice'))
    } finally {
      setSaving(false)
    }
  }

  const outstanding = (advice ?? []).filter((item) => !item.received)

  return (
    <div className="space-y-6">
      <Card
        title="Advised investigations"
        description="OPG, lateral cephalogram, CBCT and other imaging requested at a visit."
        action={
          !adding && (
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              Advise imaging
            </Button>
          )
        }
      >
        {adding && (
          <div className="mb-6 rounded-lg border border-line bg-pale/60 p-4">
            <div className="space-y-4">
              {error && <ErrorNotice>{error}</ErrorNotice>}

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-navy">Investigations</legend>
                <div className="flex flex-wrap gap-2">
                  {RADIOGRAPH_TYPES.map((type) => {
                    const on = types.includes(type)
                    return (
                      <label
                        key={type}
                        className={`min-h-10 cursor-pointer rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-clinic ${
                          on
                            ? 'border-clinic bg-clinic-100 text-navy'
                            : 'border-line bg-white text-ink-muted hover:bg-pale'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() =>
                            setTypes((current) =>
                              current.includes(type)
                                ? current.filter((t) => t !== type)
                                : [...current, type],
                            )
                          }
                        />
                        {RADIOGRAPH_LABELS[type]}
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <TextField
                label="Region"
                placeholder="e.g. 36 region, full arch, TMJ"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
              />

              <DictatedTextArea
                label="Reason"
                rows={2}
                value={reason}
                disabled={saving}
                onChange={setReason}
                placeholder="Why the investigation is being advised…"
              />

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
                  Save advice
                </Button>
              </div>
            </div>
          </div>
        )}

        {outstanding.length > 0 && (
          <div className="mb-4 rounded-lg border border-warn/30 bg-warn-100 px-4 py-3 text-sm text-warn">
            {outstanding.length} investigation{outstanding.length === 1 ? '' : 's'} still awaited.
          </div>
        )}

        {loadError ? (
          <ErrorNotice>{loadError}</ErrorNotice>
        ) : advice === null ? (
          <Spinner label="Loading imaging advice" />
        ) : advice.length === 0 ? (
          <EmptyState
            title="No imaging advised"
            description="Investigations requested here can be marked received once the films come back."
          />
        ) : (
          <ul className="space-y-3">
            {advice.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start gap-3 rounded-lg border border-line p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.types.map((type) => (
                      <Badge key={type} tone={item.received ? 'success' : 'warn'}>
                        {RADIOGRAPH_LABELS[type]}
                      </Badge>
                    ))}
                    {item.region && <span className="text-sm text-ink">{item.region}</span>}
                  </div>
                  {item.reason && (
                    <p className="mt-1.5 text-sm break-words text-ink-muted">{item.reason}</p>
                  )}
                  <p className="mt-1.5 text-xs text-ink-muted">
                    Advised {formatDate(item.advisedOn)} · {item.advisedByName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={item.received ? 'ghost' : 'secondary'}
                    onClick={() =>
                      void setRadiographReceived(patientId, item, !item.received, actor).then(load)
                    }
                  >
                    {item.received ? 'Mark awaited' : 'Mark received'}
                  </Button>
                  <button
                    type="button"
                    onClick={() =>
                      void deleteRadiographAdvice(patientId, item, actor).then(load)
                    }
                    className="rounded px-2 py-1 text-xs font-medium text-ink-muted hover:bg-pale hover:text-danger"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AttachmentsCard />
    </div>
  )
}

/**
 * X-ray and OPG file uploads.
 *
 * Deliberately shows the real constraint rather than a disabled button with no explanation: the
 * files need Cloud Storage, which needs the Blaze plan, and that is a decision for whoever owns
 * the Firebase project. The data model (`PatientAttachment`) and the security rules are already in
 * place, so this becomes functional as soon as a bucket exists.
 */
function AttachmentsCard() {
  return (
    <Card
      title="X-ray & OPG files"
      description="Radiograph images and scanned reports attached to this patient."
    >
      <div className="space-y-4">
        <InfoNotice>
          <strong className="font-semibold">Needs Firebase Storage.</strong> Radiographs are several
          megabytes each, so unlike the patient photo they cannot live inside the patient record —
          Firestore caps a document at 1&nbsp;MiB. Cloud Storage requires the Blaze plan; this
          project is on Spark, and its bucket has not been provisioned.
        </InfoNotice>

        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-line px-6 py-10 text-center">
          <FileIcon className="size-8 text-ink-muted" />
          <p className="text-sm font-medium text-navy">Upload is not available yet</p>
          <p className="max-w-md text-sm text-ink-muted">
            Enable Cloud Storage on the Firebase project and this becomes a drop zone — the
            attachment records, security rules and listing are already built around it.
          </p>
        </div>
      </div>
    </Card>
  )
}
