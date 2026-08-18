# Tooth Chart — build brief

**Module 02 (charting), Dental Flow.** This is the tooth selection surface used by Clinical Findings
and Treatment Plan.

**Preview:** https://claude.ai/code/artifact/539f785d-86ad-43f3-a2c2-92caafeb64d3
Open it and click around first. That is what you're building.

**Reference implementation:** `tooth-chart.html` (sent with this brief). Same thing in plain
HTML/JS. When something is unclear, read that file — it is the answer. The SVG tooth-drawing code in
it is finished; port it rather than redrawing it.

**To start with Claude Code:** drop this file at `docs/tooth-chart-build.md`, then say
*"Read docs/tooth-chart-build.md and implement it following the existing conventions in this repo."*

---

## 1. The one rule

**This is a data feature with two renderers, not a 3D feature.**

Build `ToothFinding` records first, keyed by FDI tooth number and surface. The 2D chart, the 3D
patient view and any future printout are all views over that one collection.

If tooth state ends up living inside the three.js scene, we lose the ability to print a chart, to run
on a machine without WebGL, or to answer "which patients have untreated caries on a lower molar."
All three are real clinic requests.

---

## 2. Files

```
src/features/charting/
  ToothChartPanel.tsx      2D/3D toggle + shared side panel
  ToothChart2D.tsx         SVG odontogram — the default charting surface
  ToothChart3D.tsx         lazy-loaded R3F scene (last)
  ToothSurfacePicker.tsx   five-segment diagram for one tooth
  ToothDetailPanel.tsx     status, surfaces, notes for the selected tooth
  toothNotation.ts         FDI helpers — pure, no React, no Firebase
src/services/
  toothFindings.ts         every Firestore read and write for findings
```

Components never import `firebase/firestore`. The services layer owns all data access — same as the
patient module.

---

## 3. Data model

Add to `src/types/models.ts`, following the existing `Audited` contract:

```ts
export type Dentition = 'permanent' | 'primary'

export const TOOTH_SURFACES = [
  'mesial', 'distal', 'buccal', 'labial',
  'lingual', 'palatal', 'occlusal', 'incisal',
] as const
export type ToothSurface = (typeof TOOTH_SURFACES)[number]

export const TOOTH_STATUSES = [
  'sound', 'caries', 'restored', 'rootCanalTreated',
  'crown', 'bridge', 'implant', 'missing', 'extractionPlanned',
] as const
export type ToothStatus = (typeof TOOTH_STATUSES)[number]

export const FINDING_CONTEXTS = ['finding', 'plan'] as const
export type FindingContext = (typeof FINDING_CONTEXTS)[number]

export interface ToothFinding extends Audited {
  id: string
  patientId: string
  /** FDI two-digit number, stored as a string to keep the leading quadrant digit. */
  toothNumber: string
  dentition: Dentition
  /** Empty when the finding applies to the whole tooth. */
  surfaces: ToothSurface[]
  status: ToothStatus
  /** Observed finding, or proposed treatment. */
  context: FindingContext
  notes: string
}
```

**Firestore:** `patients/{patientId}/toothFindings/{findingId}`

- Every record carries `patientId`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` (SRS §5)
- Call `writeAudit` from `services/audit.ts` on every create and update
- Add `'toothFinding'` to `AUDIT_ENTITIES` with a label
- Security rules: copy the `treatments` block in `firestore.rules` — `read`/`create`/`update` gated
  on `isStaff()` and `writtenBySelf()`

---

## 4. `toothNotation.ts` — the part that must be right

Pure functions, no imports. **Write unit tests for this file.** It is small, and it is where a silent
bug would mirror every chart in the clinic.

### FDI numbering

Quadrant digit, then tooth position. Position 1 is the central incisor, counting back.

| Quadrant | Range | Position | | Quadrant | Range | Position |
|---|---|---|---|---|---|---|
| 1 | 11–18 | Upper right | | 5 | 51–55 | Upper right (primary) |
| 2 | 21–28 | Upper left | | 6 | 61–65 | Upper left (primary) |
| 3 | 31–38 | Lower left | | 7 | 71–75 | Lower left (primary) |
| 4 | 41–48 | Lower right | | 8 | 81–85 | Lower right (primary) |

Left and right are **the patient's**, not the viewer's.

### Surfaces are derived, never hardcoded in a component

```ts
export function surfacesFor(fdi: string): ToothSurface[] {
  const quadrant = Number(fdi[0])
  const position = Number(fdi[1])
  const isUpper = [1, 2, 5, 6].includes(quadrant)
  const isAnterior = position <= 3        // central, lateral, canine

  return [
    'mesial',
    'distal',
    isAnterior ? 'labial' : 'buccal',
    isUpper ? 'palatal' : 'lingual',
    isAnterior ? 'incisal' : 'occlusal',
  ]
}
```

### The mirroring rule

The chart faces the patient, so **the patient's right is on the viewer's left.**

Upper row, left to right on screen: `18 17 16 15 14 13 12 11 | 21 22 23 24 25 26 27 28`
Lower row, left to right on screen: `48 47 46 45 44 43 42 41 | 31 32 33 34 35 36 37 38`

Which means: for quadrants **1, 4, 5, 8** the mesial surface points to the **right** of the glyph.
For quadrants **2, 3, 6, 7** it points **left**. One helper, used everywhere:

```ts
export function mesialOnRight(fdi: string): boolean {
  return [1, 4, 5, 8].includes(Number(fdi[0]))
}
```

### Mixed dentition

Children mid-transition have primary and permanent teeth in the same arch. **Do not assume 32
teeth.** Per-patient mode: `permanent` / `primary` / `mixed`, where mixed lets each position be
flagged individually. Positions with nothing erupted render as a dashed placeholder so the arch stays
aligned. See the preview's Mixed toggle.

---

## 5. Status colours

Add to the `@theme` block in `src/index.css`, next to the existing `--color-navy` / `--color-clinic`
/ `--color-aqua` set:

```css
--st-sound:    #fbf8f1;   /* natural tooth */
--st-caries:   #c0392b;   /* per surface */
--st-restored: #087fc9;   /* per surface */
--st-rct:      #18316b;
--st-crown:    #39c6c3;
--st-bridge:   #2aa9a6;
--st-implant:  #6b7c99;
--st-missing:  #b8c8da;
--st-extract:  #c0392b;
```

**No hardcoded hex inside any chart component** — the same tokens drive the 2D chart, the 3D view and
the legend, and they must never drift apart.

Why caries and planned extraction share a red: dental charts have used one convention for decades —
**red means pathology or planned work, blue means an existing restoration.** The two reds stay
distinguishable by *form*, not hue: caries fills one surface solid, a planned extraction marks the
whole tooth with an X.

**Scope matters.** Only `caries` and `restored` are recorded per surface. Everything else applies to
the whole tooth — when one of those is selected, disable the surface picker and save `surfaces: []`.

---

## 6. The 2D chart layout

**Two rows per arch**, which is how Open Dental and Dentrix do it and why:

1. **Anatomical tooth** — crown and roots, facial view. Recognisable, and where whole-tooth states
   live (missing, crown, implant, root canal, planned extraction).
2. **Surface grid** — a uniform five-part box directly next to it. Clickable per surface.

You need both. A facial-view tooth only shows one face, so you can't click a mesial surface on it —
but a grid of plain boxes doesn't look like teeth. Anatomical row for recognition, grid for
precision.

Layout, top to bottom: upper numbers → upper teeth (roots up) → upper surface boxes → occlusal plane
line → lower surface boxes → lower teeth (roots down) → lower numbers. Label the chart
**"Patient right"** and **"Patient left"** on screen so nobody has to remember.

Clicking a tooth *or* a surface selects that tooth; clicking a surface also toggles it. Both are one
click away.

The tooth shapes are anatomically real, not decorative — port them from the reference file:

| | |
|---|---|
| Molars | 4-cusp crown; **upper 3 roots, lower 2** |
| Premolars | 2 cusps; upper first premolar 2 roots, the rest 1 |
| Canines | pointed cusp, longest root |
| Incisors | chisel crown, wider at the incisal edge than at the neck |

---

## 7. Findings vs plan

One collection, split by `context`. The toggle switches what you're charting and what the chart
displays. A tooth that also has a record in the *other* context gets a small corner dot — see tooth
47 in the preview, which is `missing` as a finding and `implant` as a plan.

---

## 8. Build order

Do not invert this. Steps 1–5 ship something genuinely useful on their own.

1. `toothNotation.ts` + the model types. No UI. **Unit tests.**
2. `services/toothFindings.ts` + security rules + audit wiring.
3. **`ToothChart2D.tsx`** — the working charting surface. This alone delivers the clinical value.
4. `ToothSurfacePicker` + `ToothDetailPanel`.
5. Wire into Clinical Findings and Treatment Plan.

Stop here and show it to Hari before going on.

6. Source, rename and commit the GLB (see below).
7. `ToothChart3D.tsx` — lazy, behind the "Show patient" toggle.
8. Camera presets, arch separation, reduced-motion, WebGL fallback.

---

## 9. The 3D view — later, and don't start it early

It's for **case presentation**, not charting. The doctor drives it to explain findings to the patient.
Default the charting tab to 2D.

The model is the schedule risk, not the React work. Requirements for the GLB:

- Upper and lower arches, gingiva included
- **Every tooth a separate mesh named by FDI number** — `tooth_11`, `tooth_36`. This is what makes
  raycasting map straight onto a tooth ID with no lookup table. If the meshes aren't named this way
  (most aren't), rename them once in Blender before development starts — about an hour, and it must
  happen up front, not be worked around in code.
- Under ~150k triangles, Draco or meshopt compressed, target under 3 MB
- **A commercial-use licence**, kept in the repo. We may resell this to other clinics.

Store at `public/models/dental-arches.glb`. Budget roughly $30–200 on Sketchfab / TurboSquid /
CGTrader. Do not procedurally generate the teeth — it's cheaper and it looks it.

Stack when you get there: `three`, `@react-three/fiber` (v9+ for React 19), `@react-three/drei`.
**Lazy-load the whole 3D chunk** with `React.lazy` + `Suspense` — reception staff registering a
patient must never download a 3 MB dental model.

---

## 10. Don'ts

- Don't hardcode a surface list in a component — derive it from the FDI number
- Don't put React or Firebase imports in `toothNotation.ts`
- Don't import `firebase/firestore` in a component
- Don't hardcode hex colours in the chart
- Don't assume 32 teeth
- Don't add auto-rotate to the 3D view — it's nauseating and it burns GPU on clinic laptops all day
- Don't build the 3D view before the data layer works

---

## 11. Open questions — Hari to confirm with Dr. Arun

Don't block on these; build to the defaults above and flag them.

1. **Status vocabulary** — are those nine what he actually charts?
2. **Notation** — FDI everywhere, or does anyone there read Universal / Palmer? Storage stays FDI
   regardless; this only affects display.
3. **Findings vs plan** — one collection split by `context`, or two separate screens?
4. **Paediatric load** — how much children's work? Decides how much mixed dentition is worth.
5. **Periodontal charting** — pocket depths, bleeding, mobility. Out of scope, and easy to assume is
   included. Confirm it isn't expected.
6. **Print** — if the physical file needs a printed chart, the 2D SVG is the print source and we
   should know now.
