import type { ToothSurface } from '@/types/models'
import {
  ACERV,
  AH,
  ATOP,
  AW,
  anatomyParams,
  crownPath,
  rootShapes,
  SH,
  SW,
  segGeometry,
  segPolygon,
  surfaceSpots,
} from './toothGeometry'
import { mesialOnRight, SURFACE_INITIAL, segmentMap } from './toothNotation'
import { statusVar, surfaceFill, type ToothVisual } from './toothVisual'

/**
 * Shared SVG defs — gradients and the hatch pattern.
 *
 * Mounted once by the chart. Referenced by `url(#id)` from every glyph, so the ids are global and
 * deliberately prefixed to avoid colliding with anything else on the page.
 */
export function ChartDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true">
      <defs>
        <pattern
          id="tc-hatch"
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="5" height="5" fill="transparent" />
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-st-extract)" strokeWidth="2.4" />
        </pattern>

        {/* Enamel is brightest at the biting edge and warms toward the neck; the gradient runs
            along the crown's own box, so it flips with the arch. */}
        <linearGradient id="tc-enamel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-st-enamel)" />
          <stop offset="58%" stopColor="var(--color-st-sound)" />
          <stop offset="100%" stopColor="var(--color-st-root)" />
        </linearGradient>

        <linearGradient id="tc-root" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-st-root)" />
          <stop offset="100%" stopColor="var(--color-st-root-deep)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

/* ============================================================ anatomical tooth */

interface AnatomicalToothProps {
  fdi: string
  visual: ToothVisual
  scale?: number
}

/**
 * Facial view of one tooth — crown and roots.
 *
 * A facial view shows only one face, so you cannot click a mesial surface on it. That is what the
 * surface grid below it is for; this row exists so the chart is recognisable as teeth.
 */
export function AnatomicalTooth({ fdi, visual, scale = 1 }: AnatomicalToothProps) {
  const p = anatomyParams(fdi)
  const cx = AW / 2
  const flip = p.arch === 'upper'
  const missing = visual.toothStatus === 'missing'
  const extract = visual.toothStatus === 'extractionPlanned'
  const implant = visual.toothStatus === 'implant'
  const crowned = visual.toothStatus === 'crown' || visual.toothStatus === 'bridge'

  const roots = rootShapes(p, cx)
  const crownFill = crowned
    ? statusVar(visual.toothStatus!)
    : implant
      ? 'var(--color-st-implant)'
      : 'url(#tc-enamel)'

  const spots = surfaceSpots(fdi, p, cx, mesialOnRight(fdi))
  const midY = (ATOP + ACERV) / 2

  return (
    <svg
      width={AW * scale}
      height={AH * scale}
      viewBox={`0 0 ${AW} ${AH}`}
      aria-hidden="true"
      className="block"
    >
      <g
        transform={flip ? `translate(0,${AH}) scale(1,-1)` : undefined}
        opacity={missing ? 0.2 : 1}
      >
        {implant ? (
          <ImplantFixture p={p} cx={cx} />
        ) : (
          <>
            {roots.back.map((d, i) => (
              <path
                key={`b${i}`}
                d={d}
                fill="var(--color-st-root-deep)"
                stroke="var(--color-st-line)"
                strokeWidth="0.5"
              />
            ))}
            {roots.front.map((d, i) => (
              <path
                key={`f${i}`}
                d={d}
                fill="url(#tc-root)"
                stroke="var(--color-st-line)"
                strokeWidth="0.55"
              />
            ))}
          </>
        )}

        <path
          d={crownPath(p, cx)}
          fill={crownFill}
          stroke="var(--color-st-line)"
          strokeWidth="0.6"
          strokeLinejoin="round"
        />

        {/* Root canal treatment: pulp chamber plus a filled canal per root. Drawn after the crown
            so the chamber reads through it, as it does on a radiograph. */}
        {visual.toothStatus === 'rootCanalTreated' && !implant && (
          <>
            {roots.apexes.map(([ax, ay], i) => (
              <line
                key={i}
                x1={cx}
                y1={ACERV - 3}
                x2={ax}
                y2={ay - 2.5}
                stroke="var(--color-st-rct)"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            ))}
            <ellipse
              cx={cx}
              cy={ACERV - 4}
              rx={p.hw * 0.36}
              ry="2.8"
              fill="var(--color-st-rct)"
            />
          </>
        )}

        {/* Surface findings, marked roughly where they sit on the real crown. */}
        {!missing &&
          !crowned &&
          !implant &&
          Object.entries(visual.surfaceFills).map(([surface, status]) => {
            if (!status) return null
            const spot = spots[surface as ToothSurface]
            // Lingual and palatal face away from the viewer — a ring, not a solid dot, so the
            // mark is not read as being on the visible face.
            if (!spot) {
              return (
                <circle
                  key={surface}
                  cx={cx}
                  cy={midY - 4.5}
                  r="2.1"
                  fill="none"
                  stroke={statusVar(status)}
                  strokeWidth="1.3"
                />
              )
            }
            return (
              <circle
                key={surface}
                cx={spot[0]}
                cy={spot[1]}
                r="2.1"
                fill={statusVar(status)}
                stroke="var(--color-st-enamel)"
                strokeWidth="0.5"
              />
            )
          })}
      </g>

      {missing && (
        <path
          d={`M${cx - 7},${AH / 2 - 7} L${cx + 7},${AH / 2 + 7} M${cx + 7},${AH / 2 - 7} L${cx - 7},${AH / 2 + 7}`}
          stroke="var(--color-st-missing)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}

      {extract && (
        <path
          d={`M${cx - 9},${AH / 2 - 11} L${cx + 9},${AH / 2 + 11} M${cx + 9},${AH / 2 - 11} L${cx - 9},${AH / 2 + 11}`}
          stroke="var(--color-st-extract)"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      )}

      {/* Bridge connector — adjacent units join across the cell gap. */}
      {visual.toothStatus === 'bridge' && (
        <line
          x1="-3"
          y1={flip ? AH - ACERV + 1 : ACERV - 1}
          x2={AW + 3}
          y2={flip ? AH - ACERV + 1 : ACERV - 1}
          stroke="var(--color-st-bridge)"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  )
}

/** A titanium fixture, not a root — the shape people recognise as an implant. */
function ImplantFixture({ p, cx }: { p: ReturnType<typeof anatomyParams>; cx: number }) {
  const fw = p.hw * 0.42
  const fy = ACERV + 2
  const fb = p.apexY - 4
  const threads = Array.from({ length: 6 }, (_, i) => {
    const ty = fy + 3 + i * ((fb - fy - 3) / 5.5)
    const tw = fw * (1 - ((ty - fy) / (fb - fy)) * 0.55)
    return { ty, tw }
  })

  return (
    <>
      <path
        d={`M${cx - fw},${fy} L${cx + fw},${fy} L${cx + fw * 0.42},${fb} Q${cx},${fb + 2.5} ${cx - fw * 0.42},${fb} Z`}
        fill="var(--color-st-implant)"
      />
      {threads.map(({ ty, tw }, i) => (
        <line
          key={i}
          x1={cx - tw}
          y1={ty}
          x2={cx + tw}
          y2={ty + 1.1}
          stroke="#ffffff"
          strokeWidth="0.8"
          opacity="0.55"
        />
      ))}
    </>
  )
}

/* ================================================================ surface box */

let glyphSeq = 0

interface SurfaceBoxProps {
  fdi: string
  visual: ToothVisual
  /** Large variant used by the side-panel picker. */
  big?: boolean
  /** Surfaces currently picked in the panel — highlighted in the accent colour. */
  picked?: ToothSurface[]
  /** Makes each segment a focusable button. Picker only. */
  pickable?: boolean
  /** Makes segments clickable without owning focus. Chart grid only. */
  hit?: boolean
  selected?: boolean
  onSurface?: (surface: ToothSurface) => void
}

/**
 * The five-part surface glyph: four outer trapezoids plus a centre box.
 *
 * Uniform and square on purpose — the anatomical row above carries tooth shape, so this row can
 * be a precise hit target instead of trying to be both.
 */
export function SurfaceBox({
  fdi,
  visual,
  big = false,
  picked = [],
  pickable = false,
  hit = false,
  selected = false,
  onSurface,
}: SurfaceBoxProps) {
  const g = segGeometry()
  const map = segmentMap(fdi)
  const scale = big ? 4.6 : 1
  const clipId = `tc-clip-${(glyphSeq += 1)}`
  const missing = visual.toothStatus === 'missing'
  const extract = visual.toothStatus === 'extractionPlanned'
  const interactive = pickable || hit

  const sides: Array<{ side: 'top' | 'right' | 'bottom' | 'left'; surface: ToothSurface }> = [
    { side: 'top', surface: map.top },
    { side: 'right', surface: map.right },
    { side: 'bottom', surface: map.bottom },
    { side: 'left', surface: map.left },
  ]

  const segFill = (surface: ToothSurface) =>
    pickable && picked.includes(surface) ? 'var(--color-clinic)' : surfaceFill(surface, visual)

  const labelFor = (x: number, y: number, surface: ToothSurface) => (
    <text
      key={`l-${surface}`}
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="middle"
      style={{ fontSize: '3.4px', fontWeight: 700 }}
      fill={picked.includes(surface) ? '#ffffff' : 'var(--color-ink-muted)'}
      pointerEvents="none"
    >
      {SURFACE_INITIAL[surface]}
    </text>
  )

  return (
    <svg
      width={SW * scale}
      height={SH * scale}
      viewBox={`0 0 ${SW} ${SH}`}
      className="block overflow-visible"
      aria-hidden={!pickable}
    >
      <defs>
        <clipPath id={clipId}>
          <rect
            x={g.x0}
            y={g.y0}
            width={g.x1 - g.x0}
            height={g.y1 - g.y0}
            rx={g.rx}
          />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`} opacity={missing ? 0.26 : 1}>
        {sides.map(({ side, surface }) => (
          <polygon
            key={side}
            points={segPolygon(g, side)}
            fill={segFill(surface)}
            stroke="var(--color-st-line)"
            strokeWidth="0.5"
            strokeOpacity="0.45"
            className={interactive ? 'cursor-pointer' : undefined}
            role={pickable ? 'button' : undefined}
            tabIndex={pickable ? 0 : undefined}
            aria-label={pickable ? surface : undefined}
            onClick={interactive ? () => onSurface?.(surface) : undefined}
            onKeyDown={
              pickable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSurface?.(surface)
                    }
                  }
                : undefined
            }
          />
        ))}

        <rect
          x={g.ix0}
          y={g.iy0}
          width={g.ix1 - g.ix0}
          height={g.iy1 - g.iy0}
          rx="1.6"
          fill={segFill(map.center)}
          stroke="var(--color-st-line)"
          strokeWidth="0.5"
          strokeOpacity="0.45"
          className={interactive ? 'cursor-pointer' : undefined}
          role={pickable ? 'button' : undefined}
          tabIndex={pickable ? 0 : undefined}
          aria-label={pickable ? map.center : undefined}
          onClick={interactive ? () => onSurface?.(map.center) : undefined}
          onKeyDown={
            pickable
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSurface?.(map.center)
                  }
                }
              : undefined
          }
        />

        {extract && (
          <rect
            x={g.x0}
            y={g.y0}
            width={g.x1 - g.x0}
            height={g.y1 - g.y0}
            fill="url(#tc-hatch)"
            opacity="0.55"
            pointerEvents="none"
          />
        )}
      </g>

      <rect
        x={g.x0}
        y={g.y0}
        width={g.x1 - g.x0}
        height={g.y1 - g.y0}
        rx={g.rx}
        fill="none"
        stroke={missing ? 'var(--color-st-missing)' : 'var(--color-st-line)'}
        strokeWidth={missing ? 1.1 : 0.9}
        strokeDasharray={missing ? '2.4 2' : undefined}
        opacity={missing ? 0.85 : 0.8}
        pointerEvents="none"
      />

      {selected && (
        <rect
          x={g.x0 - 2.6}
          y={g.y0 - 2.6}
          width={g.x1 - g.x0 + 5.2}
          height={g.y1 - g.y0 + 5.2}
          rx={g.rx + 2.6}
          fill="none"
          stroke="var(--color-clinic)"
          strokeWidth="1.8"
          pointerEvents="none"
        />
      )}

      {/* Corner tick when the other context also holds a record for this tooth. */}
      {!big && visual.hasOther && (
        <circle
          cx={g.x1 - 1}
          cy={g.y0 + 1}
          r="2.2"
          fill="var(--color-aqua)"
          stroke="#ffffff"
          strokeWidth="0.9"
          pointerEvents="none"
        />
      )}

      {big &&
        pickable && [
          labelFor((g.x0 + g.x1) / 2, (g.y0 + g.iy0) / 2, map.top),
          labelFor((g.x0 + g.x1) / 2, (g.iy1 + g.y1) / 2, map.bottom),
          labelFor((g.x0 + g.ix0) / 2, (g.y0 + g.y1) / 2, map.left),
          labelFor((g.ix1 + g.x1) / 2, (g.y0 + g.y1) / 2, map.right),
          labelFor((g.ix0 + g.ix1) / 2, (g.iy0 + g.iy1) / 2, map.center),
        ]}
    </svg>
  )
}
