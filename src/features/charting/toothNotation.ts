import type { Dentition, ToothStatus, ToothSurface } from '@/types/models'

/**
 * FDI (ISO 3950) tooth notation.
 *
 * Pure — no React, no Firebase, no DOM. A silent bug here (a mirrored quadrant, a wrong surface
 * list) would corrupt every chart in the clinic without ever throwing, so this module is small,
 * dependency-free and unit tested.
 */

export type Arch = 'upper' | 'lower'
/** The *patient's* side, never the viewer's. */
export type Side = 'left' | 'right'

interface QuadrantMeta {
  arch: Arch
  side: Side
  dentition: Dentition
  count: number
}

const QUADRANTS: Record<number, QuadrantMeta> = {
  1: { arch: 'upper', side: 'right', dentition: 'permanent', count: 8 },
  2: { arch: 'upper', side: 'left', dentition: 'permanent', count: 8 },
  3: { arch: 'lower', side: 'left', dentition: 'permanent', count: 8 },
  4: { arch: 'lower', side: 'right', dentition: 'permanent', count: 8 },
  5: { arch: 'upper', side: 'right', dentition: 'primary', count: 5 },
  6: { arch: 'upper', side: 'left', dentition: 'primary', count: 5 },
  7: { arch: 'lower', side: 'left', dentition: 'primary', count: 5 },
  8: { arch: 'lower', side: 'right', dentition: 'primary', count: 5 },
}

const PERMANENT_NAMES = [
  'central incisor',
  'lateral incisor',
  'canine',
  'first premolar',
  'second premolar',
  'first molar',
  'second molar',
  'third molar',
]

const PRIMARY_NAMES = ['central incisor', 'lateral incisor', 'canine', 'first molar', 'second molar']

export type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar'

export interface ParsedTooth {
  fdi: string
  quadrant: number
  position: number
  arch: Arch
  side: Side
  dentition: Dentition
}

export function isValidFdi(fdi: string): boolean {
  if (!/^[1-8][1-8]$/.test(fdi)) return false
  return Number(fdi[1]) <= QUADRANTS[Number(fdi[0])].count
}

export function parseFdi(fdi: string): ParsedTooth {
  if (!isValidFdi(fdi)) throw new Error(`Not a valid FDI tooth number: ${JSON.stringify(fdi)}`)
  const quadrant = Number(fdi[0])
  const meta = QUADRANTS[quadrant]
  return {
    fdi,
    quadrant,
    position: Number(fdi[1]),
    arch: meta.arch,
    side: meta.side,
    dentition: meta.dentition,
  }
}

/** Positions 1-3 are anterior in both dentitions: central, lateral, canine. */
export function isAnterior(position: number): boolean {
  return position <= 3
}

/**
 * The surfaces a given tooth actually has — derived, never hardcoded in a component.
 *
 * Anteriors have a labial face and an incisal edge; posteriors a buccal face and an occlusal
 * table. Uppers face the palate, lowers the tongue. Charting a "palatal" surface on a lower molar
 * is a data error, so the vocabulary is narrowed per tooth rather than offered in full.
 */
export function surfacesFor(fdi: string): ToothSurface[] {
  const tooth = parseFdi(fdi)
  const anterior = isAnterior(tooth.position)
  return [
    'mesial',
    'distal',
    anterior ? 'labial' : 'buccal',
    tooth.arch === 'upper' ? 'palatal' : 'lingual',
    anterior ? 'incisal' : 'occlusal',
  ]
}

export function toothName(fdi: string): string {
  const tooth = parseFdi(fdi)
  const names = tooth.dentition === 'primary' ? PRIMARY_NAMES : PERMANENT_NAMES
  const prefix = `${tooth.arch === 'upper' ? 'Upper' : 'Lower'} ${tooth.side}`
  const label = names[tooth.position - 1]
  return `${prefix} ${label}${tooth.dentition === 'primary' ? ' (primary)' : ''}`
}

export function toothType(fdi: string): ToothType {
  const tooth = parseFdi(fdi)
  if (tooth.position <= 2) return 'incisor'
  if (tooth.position === 3) return 'canine'
  // Primary dentition has no premolars — positions 4 and 5 are the primary molars.
  if (tooth.dentition === 'primary') return 'molar'
  return tooth.position <= 5 ? 'premolar' : 'molar'
}

/**
 * Whether the mesial surface points to the *viewer's* right for this tooth.
 *
 * The chart faces the patient, so the patient's right sits on the viewer's left. Mesial always
 * points toward the midline, which for a patient-right quadrant means pointing viewer-right.
 * Get this backwards and every chart in the clinic is mirrored — so it lives in exactly one
 * function that everything else calls.
 */
export function mesialOnRight(fdi: string): boolean {
  return QUADRANTS[Number(fdi[0])].side === 'right'
}

/**
 * The permanent-quadrant equivalent of any tooth — its stable "slot in the mouth".
 *
 * A primary upper-right canine (53) and its permanent successor (13) occupy the same position.
 * Keying mixed dentition by this rather than by FDI is what lets one slot switch between the two
 * without the arch re-flowing.
 */
export function positionKey(fdi: string): string {
  const quadrant = Number(fdi[0])
  return `${quadrant > 4 ? quadrant - 4 : quadrant}${fdi[1]}`
}

export function fdiForPosition(key: string, dentition: Dentition): string {
  const quadrant = Number(key[0])
  return `${dentition === 'primary' ? quadrant + 4 : quadrant}${key[1]}`
}

/** Primary teeth exist only at positions 1-5; positions 6-8 have no primary predecessor. */
export function hasPrimary(key: string): boolean {
  return Number(key[1]) <= 5
}

/* --------------------------------------------------------------- arch layout */

/** How the chart addresses one slot, left to right on screen. */
export type ArchCell =
  | { kind: 'tooth'; fdi: string }
  | { kind: 'unerupted'; key: string }
  | { kind: 'midline' }

export type ChartDentition = 'permanent' | 'primary' | 'mixed'

/** In mixed dentition each slot is independently permanent, primary, or empty. */
export type MixedMap = Record<string, Dentition | 'absent'>

/**
 * The teeth of one arch in screen order.
 *
 * The patient-right quadrant counts *down* (18 to 11) because position 1 is the central incisor
 * at the midline; the patient-left quadrant then counts up (21 to 28). That produces the standard
 * odontogram order with the midline in the centre.
 */
export function cellsForArch(
  arch: Arch,
  dentition: ChartDentition,
  mixedMap: MixedMap = {},
): ArchCell[] {
  const primary = dentition === 'primary'
  const rightQuadrant = arch === 'upper' ? (primary ? 5 : 1) : primary ? 8 : 4
  const leftQuadrant = arch === 'upper' ? (primary ? 6 : 2) : primary ? 7 : 3
  const count = primary ? 5 : 8

  const cell = (quadrant: number, position: number): ArchCell => {
    const key = `${quadrant}${position}`
    if (dentition !== 'mixed') return { kind: 'tooth', fdi: `${quadrant}${position}` }

    const mode = mixedMap[key] ?? 'permanent'
    if (mode === 'absent') return { kind: 'unerupted', key }
    return { kind: 'tooth', fdi: fdiForPosition(key, mode) }
  }

  const cells: ArchCell[] = []
  for (let position = count; position >= 1; position -= 1) cells.push(cell(rightQuadrant, position))
  cells.push({ kind: 'midline' })
  for (let position = 1; position <= count; position += 1) cells.push(cell(leftQuadrant, position))
  return cells
}

/** Every tooth on the chart, both arches. */
export function allTeeth(dentition: ChartDentition, mixedMap: MixedMap = {}): string[] {
  const arches: Arch[] = ['upper', 'lower']
  return arches
    .flatMap((arch) => cellsForArch(arch, dentition, mixedMap))
    .filter((cell): cell is { kind: 'tooth'; fdi: string } => cell.kind === 'tooth')
    .map((cell) => cell.fdi)
}

/* ------------------------------------------------------------ surface layout */

/** Which surface sits on which side of the square surface glyph. */
export interface SegmentMap {
  top: ToothSurface
  bottom: ToothSurface
  left: ToothSurface
  right: ToothSurface
  center: ToothSurface
}

/**
 * Facial always points away from the occlusal plane — so it is on top for the upper arch and on
 * the bottom for the lower. Mesial always points toward the midline.
 */
export function segmentMap(fdi: string): SegmentMap {
  const tooth = parseFdi(fdi)
  const anterior = isAnterior(tooth.position)
  const facial: ToothSurface = anterior ? 'labial' : 'buccal'
  const inner: ToothSurface = tooth.arch === 'upper' ? 'palatal' : 'lingual'
  const mesialRight = mesialOnRight(fdi)

  return {
    top: tooth.arch === 'upper' ? facial : inner,
    bottom: tooth.arch === 'upper' ? inner : facial,
    left: mesialRight ? 'distal' : 'mesial',
    right: mesialRight ? 'mesial' : 'distal',
    center: anterior ? 'incisal' : 'occlusal',
  }
}

export const SURFACE_INITIAL: Record<ToothSurface, string> = {
  mesial: 'M',
  distal: 'D',
  buccal: 'B',
  labial: 'La',
  lingual: 'Li',
  palatal: 'P',
  occlusal: 'O',
  incisal: 'I',
}

/* --------------------------------------------------------------- status meta */

export type StatusScope = 'tooth' | 'surface'

export interface StatusMeta {
  label: string
  /** Surface-scoped statuses are recorded per surface; tooth-scoped apply to the whole tooth. */
  scope: StatusScope
  /** CSS custom property from the `@theme` block — never a literal hex in a component. */
  token: string
  hint: string
}

export const STATUS_ORDER: ToothStatus[] = [
  'sound',
  'caries',
  'restored',
  'rootCanalTreated',
  'crown',
  'bridge',
  'implant',
  'missing',
  'extractionPlanned',
]

export const STATUS_META: Record<ToothStatus, StatusMeta> = {
  sound: { label: 'Sound', scope: 'tooth', token: '--color-st-sound', hint: 'no finding' },
  caries: { label: 'Caries', scope: 'surface', token: '--color-st-caries', hint: 'per surface' },
  restored: {
    label: 'Restored / filled',
    scope: 'surface',
    token: '--color-st-restored',
    hint: 'per surface',
  },
  rootCanalTreated: {
    label: 'Root canal treated',
    scope: 'tooth',
    token: '--color-st-rct',
    hint: 'canal marker',
  },
  crown: { label: 'Crown', scope: 'tooth', token: '--color-st-crown', hint: 'whole tooth' },
  bridge: { label: 'Bridge', scope: 'tooth', token: '--color-st-bridge', hint: 'whole tooth' },
  implant: { label: 'Implant', scope: 'tooth', token: '--color-st-implant', hint: 'whole tooth' },
  missing: { label: 'Missing', scope: 'tooth', token: '--color-st-missing', hint: 'ghosted' },
  extractionPlanned: {
    label: 'Extraction planned',
    scope: 'tooth',
    token: '--color-st-extract',
    hint: 'hatched',
  },
}

export const statusColor = (status: ToothStatus): string => `var(${STATUS_META[status].token})`

export const isSurfaceScoped = (status: ToothStatus): boolean =>
  STATUS_META[status].scope === 'surface'

/* ------------------------------------------------- alternative notations */

/**
 * Storage is always FDI. These convert for *display only*.
 *
 * The clinic's own charts use Universal numbering (1-32), while FDI is the ISO standard and the
 * one that encodes quadrant and position arithmetically — which is why every calculation in this
 * module works on FDI and only the label changes. Converting at the storage layer instead would
 * mean re-deriving quadrant and position from a number that does not carry them.
 */
export const NOTATIONS = ['fdi', 'universal', 'palmer'] as const
export type Notation = (typeof NOTATIONS)[number]

export const NOTATION_LABELS: Record<Notation, string> = {
  fdi: 'FDI (ISO 3950)',
  universal: 'Universal (1–32)',
  palmer: 'Palmer',
}

const PRIMARY_LETTERS = 'ABCDEFGHIJKLMNOPQRST'

/**
 * Universal numbering: permanent teeth 1-32, primary teeth A-T.
 *
 * 1 is the patient's upper right third molar; the count runs across the upper arch to 16 at the
 * upper left third molar, drops to 17 at the *lower left* third molar, and returns to 32 at the
 * lower right third molar. It is a single continuous loop, which is why each quadrant needs its
 * own offset rather than one formula.
 */
export function toUniversal(fdi: string): string {
  const { quadrant, position } = parseFdi(fdi)
  switch (quadrant) {
    case 1:
      return String(9 - position)
    case 2:
      return String(8 + position)
    case 3:
      return String(25 - position)
    case 4:
      return String(24 + position)
    // Primary quadrants follow the same loop, lettered A-T.
    case 5:
      return PRIMARY_LETTERS[5 - position]
    case 6:
      return PRIMARY_LETTERS[4 + position]
    case 7:
      return PRIMARY_LETTERS[9 + position]
    default:
      return PRIMARY_LETTERS[20 - position]
  }
}

/**
 * Palmer notation: the position number inside a bracket whose orientation gives the quadrant.
 * Primary teeth use letters A-E in the same brackets.
 */
export function toPalmer(fdi: string): string {
  const { quadrant, position } = parseFdi(fdi)
  const symbol = position <= 5 && quadrant > 4 ? 'ABCDE'[position - 1] : String(position)
  switch (quadrant) {
    case 1:
    case 5:
      return `${symbol}\u2518` // upper right
    case 2:
    case 6:
      return `\u2514${symbol}` // upper left
    case 4:
    case 8:
      return `${symbol}\u2510` // lower right
    default:
      return `\u250c${symbol}` // lower left
  }
}

/** The label to print on a tooth in the chosen notation. */
export function toothLabel(fdi: string, notation: Notation): string {
  switch (notation) {
    case 'universal':
      return toUniversal(fdi)
    case 'palmer':
      return toPalmer(fdi)
    default:
      return fdi
  }
}
