import type { ToothSurface } from '@/types/models'
import {
  cellsForArch,
  toothName,
  type Arch,
  type ArchCell,
  type ChartDentition,
  type MixedMap,
} from './toothNotation'
import { AnatomicalTooth, SurfaceBox } from './ToothGlyphs'
import { EMPTY_VISUAL, type ToothVisual } from './toothVisual'

interface ToothChart2DProps {
  dentition: ChartDentition
  mixedMap: MixedMap
  visuals: Record<string, ToothVisual>
  selected: string | null
  onSelectTooth: (fdi: string) => void
  onToggleSurface: (fdi: string, surface: ToothSurface) => void
}

/**
 * The SVG odontogram — the default charting surface.
 *
 * Two rows per arch, which is how Open Dental and Dentrix lay it out, and for the same reason: an
 * anatomical facial view is recognisable but only shows one face, so you cannot click a mesial
 * surface on it; a grid of plain boxes is precise but does not look like teeth. Both rows, one
 * click each.
 *
 * Layout runs upper numbers, upper teeth (roots up), upper surface boxes, occlusal plane, lower
 * surface boxes, lower teeth (roots down), lower numbers.
 */
export function ToothChart2D({
  dentition,
  mixedMap,
  visuals,
  selected,
  onSelectTooth,
  onToggleSurface,
}: ToothChart2DProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[46rem] px-1 pb-2">
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
          {/* Labelled on screen so nobody has to remember that the chart faces the patient. */}
          <span>◀ Patient right</span>
          <span>Patient left ▶</span>
        </div>

        <ArchRow
          arch="upper"
          dentition={dentition}
          mixedMap={mixedMap}
          visuals={visuals}
          selected={selected}
          onSelectTooth={onSelectTooth}
          onToggleSurface={onToggleSurface}
        />

        <div className="relative my-2 h-px bg-line">
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2.5 text-[10px] font-bold tracking-widest text-ink-muted uppercase">
            Occlusal plane
          </span>
        </div>

        <ArchRow
          arch="lower"
          dentition={dentition}
          mixedMap={mixedMap}
          visuals={visuals}
          selected={selected}
          onSelectTooth={onSelectTooth}
          onToggleSurface={onToggleSurface}
        />
      </div>
    </div>
  )
}

interface ArchRowProps extends ToothChart2DProps {
  arch: Arch
}

function ArchRow({
  arch,
  dentition,
  mixedMap,
  visuals,
  selected,
  onSelectTooth,
  onToggleSurface,
}: ArchRowProps) {
  const cells = cellsForArch(arch, dentition, mixedMap)
  const upper = arch === 'upper'

  const numbers = (
    <div className="flex items-end justify-center gap-0.5">
      {cells.map((cell, index) => (
        <ToothNumber key={index} cell={cell} selected={selected} />
      ))}
    </div>
  )

  const teeth = (
    <div className="flex items-end justify-center gap-0.5">
      {cells.map((cell, index) => (
        <div key={index} className={cellWidth(cell)}>
          {cell.kind === 'tooth' && (
            <button
              type="button"
              onClick={() => onSelectTooth(cell.fdi)}
              aria-label={`${toothName(cell.fdi)}, tooth ${cell.fdi}`}
              aria-pressed={selected === cell.fdi}
              title={toothName(cell.fdi)}
              className="flex w-full cursor-pointer justify-center rounded transition-colors hover:bg-pale"
            >
              <AnatomicalTooth fdi={cell.fdi} visual={visuals[cell.fdi] ?? EMPTY_VISUAL} />
            </button>
          )}
          {cell.kind === 'unerupted' && <UneruptedSlot />}
        </div>
      ))}
    </div>
  )

  const surfaces = (
    <div className="flex items-center justify-center gap-0.5">
      {cells.map((cell, index) => (
        <div key={index} className={`${cellWidth(cell)} flex justify-center`}>
          {cell.kind === 'tooth' && (
            <SurfaceBox
              fdi={cell.fdi}
              visual={visuals[cell.fdi] ?? EMPTY_VISUAL}
              hit
              selected={selected === cell.fdi}
              onSurface={(surface) => onToggleSurface(cell.fdi, surface)}
            />
          )}
        </div>
      ))}
    </div>
  )

  // Upper arch reads numbers → teeth → surfaces; the lower arch mirrors it so both surface rows
  // meet at the occlusal plane, exactly as the two arches meet in the mouth.
  return upper ? (
    <div className="space-y-1">
      {numbers}
      {teeth}
      {surfaces}
    </div>
  ) : (
    <div className="space-y-1">
      {surfaces}
      {teeth}
      {numbers}
    </div>
  )
}

/** Midline is a thin divider; every tooth slot is a fixed width so the arches stay aligned. */
function cellWidth(cell: ArchCell): string {
  return cell.kind === 'midline' ? 'w-3 shrink-0' : 'w-10 shrink-0'
}

function ToothNumber({ cell, selected }: { cell: ArchCell; selected: string | null }) {
  if (cell.kind === 'midline') return <div className="w-3 shrink-0" />

  const label = cell.kind === 'tooth' ? cell.fdi : cell.key
  const active = cell.kind === 'tooth' && selected === cell.fdi

  return (
    <div
      className={`w-10 shrink-0 text-center text-[11px] font-semibold tabular-nums ${
        active ? 'text-clinic' : cell.kind === 'unerupted' ? 'text-ink-muted/50' : 'text-ink-muted'
      }`}
    >
      {label}
    </div>
  )
}

/**
 * A slot where nothing has erupted.
 *
 * Rendered rather than skipped so the arch stays aligned — a child mid-transition still has the
 * neighbouring teeth in their real positions, and collapsing the gap would misrepresent that.
 */
function UneruptedSlot() {
  return (
    <div
      className="mx-auto h-14 w-7 rounded-md border-2 border-dashed border-line"
      title="No tooth erupted in this position"
    />
  )
}
