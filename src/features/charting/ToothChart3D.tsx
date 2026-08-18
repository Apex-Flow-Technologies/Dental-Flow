import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { FindingContext } from '@/types/models'
import { Button } from '@/components/ui/Button'
import { InfoNotice } from '@/components/ui/primitives'
import {
  cellsForArch,
  isAnterior,
  parseFdi,
  toothName,
  toothType,
  type Arch,
  type ChartDentition,
  type MixedMap,
} from './toothNotation'
import { EMPTY_VISUAL, statusVar, type ToothVisual } from './toothVisual'

/**
 * Case-presentation view — the doctor drives this to explain findings to the patient.
 *
 * It is NOT the charting surface: the 2D odontogram is, and this tab is deliberately not the
 * default. Tooth state lives in `ToothFinding` records, so this is a second renderer over the same
 * data rather than a place where anything is stored.
 *
 * Built with CSS 3D transforms rather than three.js. The real view needs a GLB with one mesh per
 * tooth named by FDI number, which has to be sourced and licensed before it can ship — see the
 * build brief. This proves the interaction (presets, constrained orbit, arch separation, hover
 * lift) so the asset is the only thing outstanding, and it costs no bundle weight in the meantime.
 */

interface ToothChart3DProps {
  dentition: ChartDentition
  mixedMap: MixedMap
  visuals: Record<string, ToothVisual>
  selected: string | null
  context: FindingContext
  onSelectTooth: (fdi: string) => void
}

/** Width and height in px for each tooth type — molars are wide, incisors narrow and tall. */
const T3_SIZE: Record<string, [number, number]> = {
  molar: [30, 30],
  premolar: [22, 30],
  canine: [17, 34],
  incisor: [16, 31],
}

/** [rotX, rotY] for each preset camera. */
const CAMERAS: Record<string, [number, number]> = {
  front: [12, 0],
  upper: [-62, 0],
  lower: [62, 0],
  right: [12, 58],
  left: [12, -58],
}

const DEFAULT_GAP = 46

export default function ToothChart3D({
  dentition,
  mixedMap,
  visuals,
  selected,
  onSelectTooth,
}: ToothChart3DProps) {
  const [rotX, setRotX] = useState(12)
  const [rotY, setRotY] = useState(0)
  const [gap, setGap] = useState(DEFAULT_GAP)
  const [dragging, setDragging] = useState(false)
  const [preset, setPreset] = useState<string | null>('front')

  const last = useRef({ x: 0, y: 0 })

  const applyPreset = useCallback((name: keyof typeof CAMERAS) => {
    const [x, y] = CAMERAS[name]
    setRotX(x)
    setRotY(y)
    setPreset(name)
  }, [])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Clicking a tooth selects it; only the empty stage starts an orbit.
    if ((event.target as HTMLElement).closest('[data-tooth]')) return
    setDragging(true)
    last.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return
    // Clamped so the arches can never be spun behind the camera and lost.
    setRotY((current) => Math.max(-95, Math.min(95, current + (event.clientX - last.current.x) * 0.4)))
    setRotX((current) => Math.max(-75, Math.min(75, current - (event.clientY - last.current.y) * 0.4)))
    last.current = { x: event.clientX, y: event.clientY }
    setPreset(null)
  }

  const stopDrag = () => setDragging(false)

  return (
    <div className="space-y-4">
      <InfoNotice>
        <strong className="font-semibold">Case presentation view.</strong> Drag to orbit, or use a
        preset. Charting is done on the 2D chart — this shows the same findings to the patient.
      </InfoNotice>

      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
        onPointerLeave={stopDrag}
        className={`relative h-[26rem] touch-none overflow-hidden rounded-xl border border-line bg-[radial-gradient(120%_90%_at_50%_12%,var(--color-white),var(--color-pale)_72%)] ${
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        <div className="absolute top-3 left-3 z-10 rounded-lg border border-line bg-white px-2.5 py-1 text-xs font-medium text-navy shadow-sm">
          {selected ? (
            <>
              <span className="font-semibold tabular-nums">{selected}</span>{' '}
              <span className="text-ink-muted">{toothName(selected)}</span>
            </>
          ) : (
            <span className="text-ink-muted">Click a tooth</span>
          )}
        </div>

        <div className="absolute inset-0 grid place-items-center [perspective:1150px]">
          <div
            className="relative h-0 w-0 [transform-style:preserve-3d]"
            style={{
              transform: `scale3d(1.45,1.45,1.45) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
              transition: dragging ? 'none' : 'transform 400ms cubic-bezier(0.22,0.75,0.3,1)',
            }}
          >
            {(['upper', 'lower'] as Arch[]).map((arch) => (
              <div
                key={arch}
                className="absolute [transform-style:preserve-3d]"
                style={{
                  transform: `translateY(${(arch === 'upper' ? -1 : 1) * (gap / 2)}px)`,
                  transition: dragging ? 'none' : 'transform 400ms cubic-bezier(0.22,0.75,0.3,1)',
                }}
              >
                <Arch3D
                  arch={arch}
                  dentition={dentition}
                  mixedMap={mixedMap}
                  visuals={visuals}
                  selected={selected}
                  onSelectTooth={onSelectTooth}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(CAMERAS) as Array<keyof typeof CAMERAS>).map((name) => (
          <Button
            key={name}
            size="sm"
            variant={preset === name ? 'primary' : 'secondary'}
            onClick={() => applyPreset(name)}
          >
            {name === 'upper' ? 'Upper arch' : name === 'lower' ? 'Lower arch' : capitalise(name)}
          </Button>
        ))}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            applyPreset('front')
            setGap(DEFAULT_GAP)
          }}
        >
          Reset
        </Button>

        <label className="ml-auto flex items-center gap-3 text-sm text-ink-muted">
          Arch separation
          <input
            type="range"
            min={0}
            max={120}
            value={gap}
            onChange={(event) => setGap(Number(event.target.value))}
            className="w-32 accent-clinic"
            aria-label="Arch separation"
          />
        </label>
      </div>
    </div>
  )
}

const capitalise = (value: string) => value[0].toUpperCase() + value.slice(1)

/** Positions teeth around a parabola-ish arc, which is close enough to a real arch form. */
function archPositions(count: number) {
  const spread = 78
  const A = 178
  const B = 200
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1)
    const theta = ((-spread + t * 2 * spread) * Math.PI) / 180
    return {
      x: A * Math.sin(theta),
      z: B * Math.cos(theta) - B * 0.62,
      rot: (theta * 180) / Math.PI,
    }
  })
}

interface Arch3DProps {
  arch: Arch
  dentition: ChartDentition
  mixedMap: MixedMap
  visuals: Record<string, ToothVisual>
  selected: string | null
  onSelectTooth: (fdi: string) => void
}

function Arch3D({ arch, dentition, mixedMap, visuals, selected, onSelectTooth }: Arch3DProps) {
  const teeth = cellsForArch(arch, dentition, mixedMap).filter(
    (cell): cell is { kind: 'tooth'; fdi: string } => cell.kind === 'tooth',
  )
  const positions = archPositions(teeth.length)
  const upper = arch === 'upper'

  return (
    <>
      {teeth.map((cell, index) => {
        const position = positions[index]
        const [w, h] = T3_SIZE[toothType(cell.fdi)]
        const visual = visuals[cell.fdi] ?? EMPTY_VISUAL
        const missing = visual.toothStatus === 'missing'
        const isSelected = selected === cell.fdi

        // A finding on the biting surface shows on the cap — which is the whole point of the
        // upper-arch and lower-arch presets.
        const biting = isAnterior(parseFdi(cell.fdi).position) ? 'incisal' : 'occlusal'
        const bitingStatus = visual.surfaceFills[biting]

        let crownBg: string | undefined
        let occBg: string | undefined

        if (
          visual.toothStatus &&
          ['crown', 'bridge', 'implant', 'extractionPlanned'].includes(visual.toothStatus)
        ) {
          const tone = statusVar(visual.toothStatus)
          crownBg = `linear-gradient(175deg, color-mix(in srgb, ${tone} 34%, #ffffff), ${tone})`
          occBg = `color-mix(in srgb, ${tone} 62%, #ffffff)`
        } else {
          const firstSurface = Object.values(visual.surfaceFills)[0]
          if (firstSurface) {
            const tone = statusVar(firstSurface)
            crownBg = `linear-gradient(175deg, #fffdf7 4%, var(--color-st-sound) 26%, color-mix(in srgb, ${tone} 82%, #ffffff) 68%)`
          }
        }

        if (bitingStatus) {
          occBg = `color-mix(in srgb, ${statusVar(bitingStatus)} 78%, #ffffff)`
        }

        return (
          <button
            key={cell.fdi}
            type="button"
            data-tooth={cell.fdi}
            aria-label={`${toothName(cell.fdi)}, tooth ${cell.fdi}`}
            aria-pressed={isSelected}
            onClick={() => onSelectTooth(cell.fdi)}
            className="group absolute cursor-pointer border-0 bg-transparent p-0 [transform-style:preserve-3d]"
            style={{
              width: w,
              height: h,
              marginLeft: -w / 2,
              marginTop: -h / 2,
              transform: `translate3d(${position.x.toFixed(1)}px,0,${position.z.toFixed(1)}px) rotateY(${position.rot.toFixed(1)}deg)`,
            }}
          >
            {missing ? (
              <div
                className="absolute inset-x-0 h-2.5 rounded-md border-[1.5px] border-dashed border-st-missing"
                style={upper ? { top: 2 } : { bottom: 2 }}
              />
            ) : (
              <>
                <div
                  className="absolute -inset-x-[2.5px] h-[15px] rounded-md"
                  style={{
                    ...(upper ? { top: -10 } : { bottom: -10 }),
                    background: upper
                      ? 'linear-gradient(180deg, var(--color-gum-2) 12%, var(--color-gum) 96%)'
                      : 'linear-gradient(0deg, var(--color-gum-2) 12%, var(--color-gum) 96%)',
                  }}
                />
                <div
                  className={`relative h-full w-full transition-transform duration-150 ${
                    upper
                      ? 'rounded-t-lg rounded-b-[5px] group-hover:-translate-y-1'
                      : 'rounded-t-[5px] rounded-b-lg group-hover:translate-y-1'
                  }`}
                  style={{
                    background:
                      crownBg ??
                      'linear-gradient(175deg, #fffdf7 4%, var(--color-st-sound) 45%, #d9cfba 100%)',
                    boxShadow: isSelected
                      ? '0 0 0 2px var(--color-clinic), 0 4px 12px -4px rgba(8,127,201,0.8)'
                      : 'inset 0 -4px 6px -3px rgba(90,74,45,0.5), inset 0 2px 2px rgba(255,255,255,0.85), 0 3px 6px -3px rgba(16,31,69,0.5)',
                  }}
                />
                {/* The biting surface as a real horizontal plane — this is what the arch presets
                    exist to reveal. */}
                <div
                  className="absolute left-0 h-3.5 w-full rounded-[3px] [backface-visibility:hidden]"
                  style={{
                    ...(upper
                      ? { bottom: 0, transformOrigin: '50% 100%', transform: 'rotateX(90deg)' }
                      : { top: 0, transformOrigin: '50% 0%', transform: 'rotateX(-90deg)' }),
                    background: occBg ?? 'linear-gradient(180deg, #fffdf7, #e3dac6)',
                    boxShadow: 'inset 0 0 3px rgba(120,100,62,0.35)',
                  }}
                />
              </>
            )}
          </button>
        )
      })}
    </>
  )
}
