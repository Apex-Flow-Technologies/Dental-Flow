import type { FindingContext, ToothFinding, ToothStatus, ToothSurface } from '@/types/models'
import { isSurfaceScoped } from './toothNotation'

/**
 * How one tooth should be drawn, derived from its findings.
 *
 * The renderers never read `ToothFinding` directly — they read this. That is what keeps the 2D
 * chart, the 3D view and the legend showing the same thing: there is one place where "these
 * records mean this appearance" is decided.
 */
export interface ToothVisual {
  /** The whole-tooth status, if any. Surface-scoped statuses do not set this. */
  toothStatus: ToothStatus | null
  /** Per-surface fills, e.g. { occlusal: 'caries' }. */
  surfaceFills: Partial<Record<ToothSurface, ToothStatus>>
  /** True when the *other* context also holds a record — drives the corner dot. */
  hasOther: boolean
}

export const EMPTY_VISUAL: ToothVisual = {
  toothStatus: null,
  surfaceFills: {},
  hasOther: false,
}

export const otherContext = (context: FindingContext): FindingContext =>
  context === 'finding' ? 'plan' : 'finding'

export function findingsForTooth(
  findings: ToothFinding[],
  fdi: string,
  context?: FindingContext,
): ToothFinding[] {
  return findings.filter(
    (finding) => finding.toothNumber === fdi && (!context || finding.context === context),
  )
}

/**
 * Collapses a tooth's findings into one appearance.
 *
 * `sound` is deliberately not treated as a status to draw — it means "examined, nothing found",
 * which looks the same as an unexamined tooth but records that somebody looked. Later records
 * win over earlier ones for the same surface, so re-charting a surface corrects it.
 */
export function toothVisual(
  findings: ToothFinding[],
  fdi: string,
  context: FindingContext,
): ToothVisual {
  const mine = findingsForTooth(findings, fdi, context)
  const visual: ToothVisual = {
    toothStatus: null,
    surfaceFills: {},
    hasOther: findingsForTooth(findings, fdi, otherContext(context)).length > 0,
  }

  for (const finding of mine) {
    if (isSurfaceScoped(finding.status)) {
      for (const surface of finding.surfaces) visual.surfaceFills[surface] = finding.status
    } else if (finding.status !== 'sound') {
      visual.toothStatus = finding.status
    }
  }

  return visual
}

/** Visual state for every tooth in one pass — cheaper than calling `toothVisual` per glyph. */
export function visualMap(
  findings: ToothFinding[],
  teeth: string[],
  context: FindingContext,
): Record<string, ToothVisual> {
  const map: Record<string, ToothVisual> = {}
  for (const fdi of teeth) map[fdi] = toothVisual(findings, fdi, context)
  return map
}

/** Statuses that repaint the whole crown rather than a single surface. */
const CROWN_COVERING: ToothStatus[] = ['crown', 'bridge', 'implant']

/** Fill for one surface of the grid glyph. */
export function surfaceFill(surface: ToothSurface, visual: ToothVisual): string {
  const status = visual.surfaceFills[surface]
  if (status) return `var(--color-st-${cssKey(status)})`
  if (visual.toothStatus && CROWN_COVERING.includes(visual.toothStatus)) {
    return `var(--color-st-${cssKey(visual.toothStatus)})`
  }
  return 'var(--color-st-sound)'
}

/** Maps a status name onto its CSS token suffix. */
export function cssKey(status: ToothStatus): string {
  switch (status) {
    case 'rootCanalTreated':
      return 'rct'
    case 'extractionPlanned':
      return 'extract'
    default:
      return status
  }
}

export const statusVar = (status: ToothStatus): string => `var(--color-st-${cssKey(status)})`

/** A one-line summary of a tooth's state, for tooltips and the arch legend. */
export function summariseVisual(visual: ToothVisual, labels: Record<ToothStatus, string>): string {
  const parts: string[] = []
  if (visual.toothStatus) parts.push(labels[visual.toothStatus])
  for (const [surface, status] of Object.entries(visual.surfaceFills)) {
    if (status) parts.push(`${labels[status]} (${surface})`)
  }
  return parts.join(', ')
}
