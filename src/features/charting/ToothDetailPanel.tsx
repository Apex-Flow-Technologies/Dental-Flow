import { useEffect, useState } from 'react'
import type { FindingContext, ToothFinding, ToothStatus, ToothSurface } from '@/types/models'
import { Button } from '@/components/ui/Button'
import { TextAreaField } from '@/components/ui/Field'
import { ErrorNotice } from '@/components/ui/primitives'
import {
  isSurfaceScoped,
  parseFdi,
  STATUS_META,
  STATUS_ORDER,
  toothName,
} from './toothNotation'
import { ToothSurfacePicker } from './ToothSurfacePicker'
import { statusVar, type ToothVisual } from './toothVisual'
import { formatDate } from '@/lib/format'

interface ToothDetailPanelProps {
  fdi: string | null
  visual: ToothVisual
  context: FindingContext
  /** Existing findings on this tooth, in the active context. */
  existing: ToothFinding[]
  saving: boolean
  error: string | null
  onSave: (status: ToothStatus, surfaces: ToothSurface[], notes: string) => Promise<void>
  onDeleteFinding: (finding: ToothFinding) => void
  onClear: () => void
}

/**
 * Status, surfaces and notes for the selected tooth.
 *
 * Selecting a status changes what the surface picker means: caries and restorations are recorded
 * per surface, everything else applies to the whole tooth. Rather than silently discarding the
 * surfaces, the picker greys out and says why — the alternative is a doctor picking three surfaces
 * for a crown and never learning they were dropped.
 */
export function ToothDetailPanel({
  fdi,
  visual,
  context,
  existing,
  saving,
  error,
  onSave,
  onDeleteFinding,
  onClear,
}: ToothDetailPanelProps) {
  const [status, setStatus] = useState<ToothStatus>('caries')
  const [surfaces, setSurfaces] = useState<ToothSurface[]>([])
  const [notes, setNotes] = useState('')

  // A new tooth is a fresh entry — carrying the previous tooth's surfaces over would silently
  // chart the wrong thing on the next click.
  useEffect(() => {
    setSurfaces([])
    setNotes('')
  }, [fdi])

  if (!fdi) {
    return (
      <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-base font-medium text-navy">No tooth selected</p>
        <p className="max-w-xs text-sm text-ink-muted">
          Click any tooth on the chart — or a single surface — to record a finding.
        </p>
      </div>
    )
  }

  const tooth = parseFdi(fdi)
  const surfaceScoped = isSurfaceScoped(status)

  async function handleSave() {
    if (!fdi) return
    await onSave(status, surfaceScoped ? surfaces : [], notes)
    setSurfaces([])
    setNotes('')
  }

  const canSave = !surfaceScoped || surfaces.length > 0

  return (
    <div className="flex flex-col">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="text-2xl leading-none font-semibold text-clinic tabular-nums">{fdi}</span>
        <div className="min-w-0">
          <p className="font-medium text-navy">{toothName(fdi)}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            Quadrant {tooth.quadrant} · {tooth.dentition} · FDI {fdi}
          </p>
        </div>
      </header>

      <div className="space-y-5 px-5 py-4">
        {error && <ErrorNotice>{error}</ErrorNotice>}

        <section>
          <h3 className="mb-3 text-xs font-semibold tracking-wider text-ink-muted uppercase">
            Surfaces
          </h3>
          <ToothSurfacePicker
            fdi={fdi}
            visual={visual}
            picked={surfaces}
            disabled={!surfaceScoped}
            disabledReason={`${STATUS_META[status].label} applies to the whole tooth — surfaces are not recorded for it.`}
            onToggle={(surface) =>
              setSurfaces((current) =>
                current.includes(surface)
                  ? current.filter((s) => s !== surface)
                  : [...current, surface],
              )
            }
          />
        </section>

        <section>
          <h3 className="mb-3 text-xs font-semibold tracking-wider text-ink-muted uppercase">
            Status
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {STATUS_ORDER.map((option) => {
              const active = status === option
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  aria-pressed={active}
                  className={`flex min-h-10 items-center gap-2 rounded-lg border px-3 text-left text-sm font-medium transition-colors ${
                    active
                      ? 'border-clinic bg-clinic-100 text-navy'
                      : 'border-line bg-white text-ink hover:bg-pale'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-[3px] border border-black/15"
                    style={{ background: statusVar(option) }}
                  />
                  <span className="truncate">{STATUS_META[option].label}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <TextAreaField
            label="Notes"
            rows={3}
            value={notes}
            disabled={saving}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Clinical note for this tooth…"
          />
        </section>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleSave()} loading={saving} disabled={!canSave}>
            {context === 'plan' ? 'Save to plan' : 'Save finding'}
          </Button>
          <Button variant="secondary" onClick={onClear} disabled={saving || existing.length === 0}>
            Clear
          </Button>
        </div>

        {surfaceScoped && surfaces.length === 0 && (
          <p className="text-sm text-ink-muted">
            {STATUS_META[status].label} is recorded per surface — pick at least one on the diagram.
          </p>
        )}

        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wider text-ink-muted uppercase">
            On this tooth ({existing.length})
          </h3>
          {existing.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing charted yet.</p>
          ) : (
            <ul className="space-y-2">
              {existing.map((finding) => (
                <li
                  key={finding.id}
                  className="flex items-start gap-2 rounded-lg border border-line p-3"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 size-3 shrink-0 rounded-[3px] border border-black/15"
                    style={{ background: statusVar(finding.status) }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-navy">
                      {STATUS_META[finding.status].label}
                    </p>
                    {finding.surfaces.length > 0 && (
                      <p className="text-xs text-ink-muted">{finding.surfaces.join(', ')}</p>
                    )}
                    {finding.notes && (
                      <p className="mt-1 text-sm break-words text-ink">{finding.notes}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-muted">
                      {formatDate(finding.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteFinding(finding)}
                    disabled={saving}
                    className="shrink-0 rounded px-2 py-1 text-xs font-medium text-ink-muted hover:bg-pale hover:text-danger disabled:opacity-50"
                    aria-label={`Remove ${STATUS_META[finding.status].label} from tooth ${finding.toothNumber}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
