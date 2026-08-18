import type { ToothSurface } from '@/types/models'
import { SURFACE_INITIAL, surfacesFor } from './toothNotation'
import { SurfaceBox } from './ToothGlyphs'
import type { ToothVisual } from './toothVisual'

interface ToothSurfacePickerProps {
  fdi: string
  visual: ToothVisual
  picked: ToothSurface[]
  onToggle: (surface: ToothSurface) => void
  /** Whole-tooth statuses do not take surfaces — the picker greys out rather than disappearing. */
  disabled?: boolean
  disabledReason?: string
}

/**
 * The five-segment diagram for one tooth, plus its surface key.
 *
 * The surfaces offered are derived from the FDI number, never hardcoded: a lower molar has no
 * palatal surface, and offering one would let a doctor record something anatomically impossible.
 */
export function ToothSurfacePicker({
  fdi,
  visual,
  picked,
  onToggle,
  disabled = false,
  disabledReason,
}: ToothSurfacePickerProps) {
  const surfaces = surfacesFor(fdi)

  return (
    <div>
      <div className="flex flex-wrap items-start gap-5">
        <div
          className={`relative ${disabled ? 'pointer-events-none opacity-45' : ''}`}
          aria-disabled={disabled || undefined}
        >
          <SurfaceBox
            fdi={fdi}
            visual={visual}
            big
            pickable={!disabled}
            picked={picked}
            onSurface={onToggle}
          />
        </div>

        <dl className="grid flex-1 grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-sm">
          {surfaces.map((surface) => {
            const on = picked.includes(surface)
            return (
              <div key={surface} className="contents">
                <dt
                  className={`w-7 text-right font-mono text-xs font-bold ${
                    on ? 'text-clinic' : 'text-ink-muted'
                  }`}
                >
                  {SURFACE_INITIAL[surface]}
                </dt>
                <dd className={on ? 'font-medium text-navy' : 'text-ink-muted'}>{surface}</dd>
              </div>
            )
          })}
        </dl>
      </div>

      {disabled && disabledReason && (
        <p className="mt-3 rounded-lg border border-line bg-pale px-3 py-2 text-sm text-ink-muted">
          {disabledReason}
        </p>
      )}
    </div>
  )
}
