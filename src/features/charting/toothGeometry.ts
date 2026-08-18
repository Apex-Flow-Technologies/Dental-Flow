import { isAnterior, parseFdi, toothType, type ToothType } from './toothNotation'

/**
 * SVG path geometry for the anatomical tooth glyph.
 *
 * Pure maths, no React — kept apart from the component so the shapes can be reused by a print
 * view or a legend without dragging rendering along. Teeth are drawn canonically with the crown
 * at the top and roots hanging down, then flipped for the upper arch.
 *
 * Root counts follow real anatomy: upper molars three, lower molars two, upper first premolars
 * two, everything else one. That is what makes the glyph recognisable to a dentist rather than
 * decorative.
 */

/** Glyph viewBox, and where the crown ends and the roots begin. */
export const AW = 40
export const AH = 60
export const ATOP = 2.5
export const ACERV = 24

/** Two decimal places — SVG path strings get long, and more precision buys nothing visible. */
const f = (n: number): number => Math.round(n * 100) / 100

export interface AnatomyParams {
  type: ToothType
  /** Half-width of the crown at its widest. */
  hw: number
  apexY: number
  roots: number
  arch: 'upper' | 'lower'
}

export function anatomyParams(fdi: string): AnatomyParams {
  const tooth = parseFdi(fdi)
  const type = toothType(fdi)
  let hw: number
  let apexY: number
  let roots: number

  if (type === 'incisor') {
    hw = tooth.position === 1 ? 8 : 6.9
    apexY = 51
    roots = 1
  } else if (type === 'canine') {
    hw = 7.8
    apexY = 57 // the longest root in the mouth
    roots = 1
  } else if (type === 'premolar') {
    hw = 9.4
    apexY = 53
    roots = tooth.arch === 'upper' && tooth.position === 4 ? 2 : 1
  } else {
    hw = tooth.position === 6 ? 13 : tooth.position === 7 ? 12.4 : 11.4
    apexY = 50
    roots = tooth.arch === 'upper' ? 3 : 2
  }

  if (tooth.dentition === 'primary') {
    hw *= 0.88
    apexY -= 5
  }

  return { type, hw, apexY, roots, arch: tooth.arch }
}

/** The crown outline: chisel for incisors, single cusp for canines, two or more for posteriors. */
export function crownPath(p: AnatomyParams, cx: number): string {
  const { hw } = p
  const mw = hw * 0.78
  const top = ATOP
  const base = ` L${f(cx + mw)},${ACERV} L${f(cx - mw)},${ACERV} Z`

  if (p.type === 'incisor') {
    return (
      `M${f(cx - hw)},${f(top + 2)}` +
      ` Q${f(cx - hw)},${top} ${f(cx - hw + 1.6)},${top}` +
      ` L${f(cx + hw - 1.6)},${top}` +
      ` Q${f(cx + hw)},${top} ${f(cx + hw)},${f(top + 2)}${base}`
    )
  }

  if (p.type === 'canine') {
    return (
      `M${f(cx - hw)},${f(top + 9)}` +
      ` Q${f(cx - hw * 0.5)},${f(top + 6)} ${f(cx - 1.2)},${f(top + 0.6)}` +
      ` Q${cx},${f(top - 0.6)} ${f(cx + 1.2)},${f(top + 0.6)}` +
      ` Q${f(cx + hw * 0.5)},${f(top + 6)} ${f(cx + hw)},${f(top + 9)}${base}`
    )
  }

  if (p.type === 'premolar') {
    return (
      `M${f(cx - hw)},${f(top + 7)}` +
      ` C${f(cx - hw * 0.8)},${f(top + 0.6)} ${f(cx - hw * 0.36)},${f(top + 0.4)}` +
      ` ${f(cx - hw * 0.16)},${f(top + 5.6)}` +
      ` C${f(cx + hw * 0.04)},${f(top + 0.4)} ${f(cx + hw * 0.48)},${f(top + 0.4)}` +
      ` ${f(cx + hw)},${f(top + 7)}${base}`
    )
  }

  // Molar — cusp, groove, cusp, groove, cusp.
  return (
    `M${f(cx - hw)},${f(top + 7.5)}` +
    ` C${f(cx - hw * 0.86)},${f(top + 0.8)} ${f(cx - hw * 0.46)},${f(top + 0.8)}` +
    ` ${f(cx - hw * 0.33)},${f(top + 5.8)}` +
    ` C${f(cx - hw * 0.2)},${f(top + 1)} ${f(cx + hw * 0.2)},${f(top + 1)}` +
    ` ${f(cx + hw * 0.33)},${f(top + 5.8)}` +
    ` C${f(cx + hw * 0.46)},${f(top + 0.8)} ${f(cx + hw * 0.86)},${f(top + 0.8)}` +
    ` ${f(cx + hw)},${f(top + 7.5)}${base}`
  )
}

/** One root: a tapered spindle from the cervical line down to an apex. */
function taperRoot(
  xa: number,
  xb: number,
  ya: number,
  apexX: number,
  apexY: number,
  bowA: number,
  bowB: number,
): string {
  const m = ya + (apexY - ya) * 0.55
  return (
    `M${f(xa)},${f(ya)}` +
    ` C${f(xa + bowA)},${f(m)} ${f(apexX - 1.2)},${f(apexY - 7)} ${f(apexX)},${f(apexY)}` +
    ` C${f(apexX + 1.2)},${f(apexY - 7)} ${f(xb + bowB)},${f(m)} ${f(xb)},${f(ya)} Z`
  )
}

export interface RootShapes {
  /** Drawn first — the palatal root of an upper molar sits behind the other two. */
  back: string[]
  front: string[]
  /** Apex coordinates, used to draw root-canal fillings down each canal. */
  apexes: [number, number][]
  /** Y of the furcation, where a multi-rooted tooth splits. */
  furc: number
}

export function rootShapes(p: AnatomyParams, cx: number): RootShapes {
  const mw = p.hw * 0.78
  const back: string[] = []
  const front: string[] = []
  const apexes: [number, number][] = []

  if (p.roots === 1) {
    front.push(taperRoot(cx - mw, cx + mw, ACERV, cx + 1, p.apexY, 0.4, 1.6))
    apexes.push([cx + 1, p.apexY])
    return { back, front, apexes, furc: ACERV }
  }

  const furc = ACERV + (p.type === 'molar' ? 9 : 13)

  // The trunk between the cervical line and the furcation.
  front.push(
    `M${f(cx - mw)},${ACERV} L${f(cx + mw)},${ACERV}` +
      ` L${f(cx + mw * 0.94)},${f(furc)} L${f(cx - mw * 0.94)},${f(furc)} Z`,
  )

  if (p.roots === 3) {
    back.push(taperRoot(cx - mw * 0.34, cx + mw * 0.34, furc - 2, cx, p.apexY - 1.5, 0, 0))
    apexes.push([cx, p.apexY - 1.5])
  }

  front.push(taperRoot(cx - mw * 0.94, cx - 1.5, furc, cx - p.hw * 0.58, p.apexY, -1.6, -0.5))
  front.push(taperRoot(cx + 1.5, cx + mw * 0.94, furc, cx + p.hw * 0.58, p.apexY, 0.5, 1.6))
  apexes.push([cx - p.hw * 0.58, p.apexY], [cx + p.hw * 0.58, p.apexY])

  return { back, front, apexes, furc }
}

/**
 * Where a surface finding is marked on the facial-view crown.
 *
 * `null` means the surface faces away from the viewer — lingual and palatal are on the far side
 * of a facial view, so they are drawn as a hollow ring rather than a solid dot. Pretending they
 * are visible would put a mark where the surface is not.
 */
export function surfaceSpots(
  fdi: string,
  p: AnatomyParams,
  cx: number,
  mesialRight: boolean,
): Record<string, [number, number] | null> {
  const midY = (ATOP + ACERV) / 2
  const anterior = isAnterior(parseFdi(fdi).position)

  return {
    occlusal: [cx, ATOP + 5],
    incisal: [cx, ATOP + 4],
    buccal: [cx, midY + 3],
    labial: [cx, midY + 3],
    lingual: null,
    palatal: null,
    mesial: [cx + (mesialRight ? p.hw * 0.6 : -p.hw * 0.6), midY],
    distal: [cx + (mesialRight ? -p.hw * 0.6 : p.hw * 0.6), midY],
    // Anterior teeth have no occlusal table; keeps the record shape uniform.
    ...(anterior ? {} : {}),
  }
}

/* ---------------------------------------------------- surface grid geometry */

/** The uniform five-part surface box. Square, so it reads as a hit target, not as a tooth. */
export const SW = 30
export const SH = 30

export interface SegGeometry {
  x0: number
  x1: number
  y0: number
  y1: number
  ix0: number
  ix1: number
  iy0: number
  iy1: number
  rx: number
}

export function segGeometry(): SegGeometry {
  const x0 = 1
  const x1 = SW - 1
  const y0 = 1
  const y1 = SH - 1
  const w = x1 - x0
  const h = y1 - y0
  return {
    x0,
    x1,
    y0,
    y1,
    ix0: x0 + w * 0.3,
    ix1: x1 - w * 0.3,
    iy0: y0 + h * 0.3,
    iy1: y1 - h * 0.3,
    rx: 3.5,
  }
}

/** Trapezoid points for one of the four outer segments. */
export function segPolygon(g: SegGeometry, side: 'top' | 'right' | 'bottom' | 'left'): string {
  const map: Record<typeof side, [number, number][]> = {
    top: [
      [g.x0, g.y0],
      [g.x1, g.y0],
      [g.ix1, g.iy0],
      [g.ix0, g.iy0],
    ],
    right: [
      [g.x1, g.y0],
      [g.x1, g.y1],
      [g.ix1, g.iy1],
      [g.ix1, g.iy0],
    ],
    bottom: [
      [g.x0, g.y1],
      [g.x1, g.y1],
      [g.ix1, g.iy1],
      [g.ix0, g.iy1],
    ],
    left: [
      [g.x0, g.y0],
      [g.x0, g.y1],
      [g.ix0, g.iy1],
      [g.ix0, g.iy0],
    ],
  }
  return map[side].map(([x, y]) => `${x},${y}`).join(' ')
}
