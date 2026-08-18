import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import type {
  FindingContext,
  Patient,
  ToothFinding,
  ToothStatus,
  ToothSurface,
} from '@/types/models'
import { FINDING_CONTEXT_LABELS } from '@/types/models'
import { useActor } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import { Card, ErrorNotice, Spinner } from '@/components/ui/primitives'
import { DictatedTextArea } from '@/components/ui/DictatedTextArea'
import { Button } from '@/components/ui/Button'
import {
  addToothFinding,
  clearTooth,
  deleteToothFinding,
  listToothFindings,
} from '@/services/toothFindings'
import { addClinicalEntry } from '@/services/clinicalEntries'
import { displayAge, formatAge, initials } from '@/lib/format'
import { SEX_LABELS } from '@/types/models'
import {
  allTeeth,
  isSurfaceScoped,
  NOTATIONS,
  NOTATION_LABELS,
  STATUS_META,
  surfacesFor,
  type ChartDentition,
  type MixedMap,
  type Notation,
} from './toothNotation'
import { ChartDefs } from './ToothGlyphs'
import { ToothChart2D } from './ToothChart2D'
import { ToothDetailPanel } from './ToothDetailPanel'
import { ToothNumberingReference } from './ToothNumberingReference'
import { findingsForTooth, visualMap, EMPTY_VISUAL } from './toothVisual'

/**
 * Module 02 — charting. The 2D/3D toggle plus the shared side panel.
 *
 * The 3D view is lazy-loaded: reception staff registering a patient must never pay for it, and it
 * is a case-presentation tool rather than the charting surface, so 2D is the default.
 */
const ToothChart3D = lazy(() => import('./ToothChart3D'))

const DENTITION_OPTIONS: Array<{ value: ChartDentition; label: string }> = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'primary', label: 'Primary' },
]

const CONTEXTS: FindingContext[] = ['finding', 'plan']

export function ToothChartPanel({ patient }: { patient: Patient }) {
  const actor = useActor()
  const { notify } = useToast()

  const [findings, setFindings] = useState<ToothFinding[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [dentition, setDentition] = useState<ChartDentition>('permanent')
  const [mixedMap] = useState<MixedMap>({})
  const [context, setContext] = useState<FindingContext>('finding')
  const [view, setView] = useState<'2d' | '3d'>('2d')
  // Display only. Storage stays FDI, which is the notation that encodes quadrant and position.
  const [notation, setNotation] = useState<Notation>('fdi')
  const [selected, setSelected] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setFindings(await listToothFindings(patient.id))
    } catch (error) {
      console.error('Failed to load tooth findings', error)
      setLoadError('Could not load the tooth chart.')
      setFindings([])
    }
  }, [patient.id])

  useEffect(() => {
    void load()
  }, [load])

  const teeth = useMemo(() => allTeeth(dentition, mixedMap), [dentition, mixedMap])

  const visuals = useMemo(
    () => visualMap(findings ?? [], teeth, context),
    [findings, teeth, context],
  )

  const existing = useMemo(
    () => (selected ? findingsForTooth(findings ?? [], selected, context) : []),
    [findings, selected, context],
  )

  /**
   * Clicking a surface both selects the tooth and charts that surface with the panel's current
   * status — so the fast path (caries on one surface) is a single click, per the build brief.
   */
  async function handleToggleSurface(fdi: string, surface: ToothSurface) {
    setSelected(fdi)
    if (!surfacesFor(fdi).includes(surface)) return
    await save(fdi, 'caries', [surface], '')
  }

  async function save(
    fdi: string,
    status: ToothStatus,
    surfaces: ToothSurface[],
    notes: string,
  ) {
    setSaving(true)
    setSaveError(null)
    try {
      await addToothFinding(
        patient.id,
        {
          toothNumber: fdi,
          dentition: Number(fdi[0]) > 4 ? 'primary' : 'permanent',
          surfaces: isSurfaceScoped(status) ? surfaces : [],
          status,
          context,
          notes,
          statusLabel: STATUS_META[status].label,
        },
        actor,
      )
      await load()
    } catch (error) {
      console.error('Failed to save tooth finding', error)
      setSaveError('Could not save. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(finding: ToothFinding) {
    setSaving(true)
    try {
      await deleteToothFinding(patient.id, finding, STATUS_META[finding.status].label, actor)
      await load()
    } catch (error) {
      console.error('Failed to remove tooth finding', error)
      notify('Could not remove that finding.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!selected) return
    setSaving(true)
    try {
      const removed = await clearTooth(patient.id, selected, context, findings ?? [], actor)
      if (removed > 0) notify(`Tooth ${selected} cleared.`)
      await load()
    } catch (error) {
      console.error('Failed to clear tooth', error)
      notify('Could not clear that tooth.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <ErrorNotice>{loadError}</ErrorNotice>
  if (findings === null) return <Spinner label="Loading the tooth chart" />

  const age = displayAge(patient)
  const chartedCount = findings.filter((finding) => finding.context === context).length

  return (
    <div className="space-y-6">
      <ChartDefs />

      {/* ------------------------------------------------------------- header */}
      <div className="rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-3">
            {patient.photoDataUrl ? (
              <img
                src={patient.photoDataUrl}
                alt=""
                className="size-11 shrink-0 rounded-full border border-line object-cover"
              />
            ) : (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                {initials(patient.fullName)}
              </span>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-navy">{patient.fullName}</p>
              <p className="font-mono text-xs text-ink-muted">
                File {patient.fileNumber} · {formatAge(age)}
                {age.approximate ? '~' : ''} {SEX_LABELS[patient.sex][0]}
              </p>
            </div>
          </div>

          <ToggleGroup
            label="Dentition"
            options={DENTITION_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            value={dentition}
            onChange={(value) => {
              setDentition(value as ChartDentition)
              setSelected(null)
            }}
          />

          <ToggleGroup
            label="Charting"
            options={CONTEXTS.map((value) => ({
              value,
              label: FINDING_CONTEXT_LABELS[value],
            }))}
            value={context}
            onChange={(value) => setContext(value as FindingContext)}
          />

          <ToggleGroup
            label="Numbering"
            options={NOTATIONS.map((value) => ({
              value,
              label: value === 'fdi' ? 'FDI' : value === 'universal' ? 'Universal' : 'Palmer',
            }))}
            value={notation}
            onChange={(value) => setNotation(value as Notation)}
          />
        </div>
      </div>

      {/* -------------------------------------------------------- chart + panel */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-line p-0.5">
              {(['2d', '3d'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  aria-pressed={view === option}
                  className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
                    view === option
                      ? 'bg-clinic-100 text-navy'
                      : 'text-ink-muted hover:text-navy'
                  }`}
                >
                  {option === '2d' ? '2D chart' : 'Show patient'}
                </button>
              ))}
            </div>
            <p className="text-sm text-ink-muted">
              {view === '2d'
                ? `${NOTATION_LABELS[notation]} · click a tooth, or a surface directly`
                : 'Case presentation view · drag to orbit, or use a preset'}
            </p>
          </div>

          {view === '2d' ? (
            <ToothChart2D
              dentition={dentition}
              mixedMap={mixedMap}
              notation={notation}
              visuals={visuals}
              selected={selected}
              onSelectTooth={setSelected}
              onToggleSurface={(fdi, surface) => void handleToggleSurface(fdi, surface)}
            />
          ) : (
            <Suspense fallback={<Spinner label="Loading the patient view" />}>
              <ToothChart3D
                dentition={dentition}
                mixedMap={mixedMap}
                visuals={visuals}
                selected={selected}
                context={context}
                onSelectTooth={setSelected}
              />
            </Suspense>
          )}
        </Card>

        <div className="min-w-0 rounded-xl border border-line bg-white">
          <ToothDetailPanel
            fdi={selected}
            visual={selected ? (visuals[selected] ?? EMPTY_VISUAL) : EMPTY_VISUAL}
            context={context}
            notation={notation}
            existing={existing}
            saving={saving}
            error={saveError}
            onSave={(status, surfaces, notes) =>
              selected ? save(selected, status, surfaces, notes) : Promise.resolve()
            }
            onDeleteFinding={(finding) => void handleDelete(finding)}
            onClear={() => void handleClear()}
          />
        </div>
      </div>

      <AdditionalNotes patientId={patient.id} context={context} chartedCount={chartedCount} />

      <Card title="Tooth numbering system">
        <ToothNumberingReference />
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------- toggles */

interface ToggleGroupProps {
  label: string
  options: Array<{ value: string; label: string }>
  value: string
  onChange: (value: string) => void
}

function ToggleGroup({ label, options, value, onChange }: ToggleGroupProps) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
        {label}
      </p>
      <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`min-h-9 rounded-md px-3.5 text-sm font-medium transition-colors ${
              value === option.value
                ? 'bg-clinic-100 text-navy'
                : 'text-ink-muted hover:text-navy'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- additional notes */

/**
 * Free-text notes that belong to the charting session as a whole rather than to one tooth.
 *
 * Saved as a dated clinical entry so it lands in the same append-only record as every other
 * clinical note, rather than creating a second place where notes hide.
 */
function AdditionalNotes({
  patientId,
  context,
  chartedCount,
}: {
  patientId: string
  context: FindingContext
  chartedCount: number
}) {
  const actor = useActor()
  const { notify } = useToast()
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (text.trim() === '') {
      setError('Write the note before saving.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const heading = context === 'plan' ? 'Treatment plan' : 'Clinical findings'
      await addClinicalEntry(patientId, 'clinicalNote', `${heading} — ${text.trim()}`, actor)
      setText('')
      notify('Note added to the clinical record.')
    } catch (caught) {
      console.error('Failed to save charting note', caught)
      setError('Could not save the note. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card
      title={`${FINDING_CONTEXT_LABELS[context]} — additional notes`}
      description={`${chartedCount} tooth record${chartedCount === 1 ? '' : 's'} charted in this view. Notes here cover the whole mouth rather than one tooth.`}
    >
      <div className="space-y-4">
        {error && <ErrorNotice>{error}</ErrorNotice>}

        <DictatedTextArea
          label={context === 'plan' ? 'Treatment plan notes' : 'Clinical findings notes'}
          rows={4}
          value={text}
          disabled={saving}
          onChange={setText}
          placeholder={
            context === 'plan'
              ? 'Sequence of treatment, sittings, materials, what was discussed with the patient…'
              : 'General observations, occlusion, soft tissue, oral hygiene…'
          }
          hint={`Saved to the patient's clinical notes against ${actor.displayName}, with today's date.`}
        />

        <div className="flex justify-end">
          <Button onClick={() => void handleSave()} loading={saving}>
            Add note
          </Button>
        </div>
      </div>
    </Card>
  )
}
