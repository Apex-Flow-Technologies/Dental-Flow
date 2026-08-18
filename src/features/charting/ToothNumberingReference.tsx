import { STATUS_META, STATUS_ORDER } from './toothNotation'
import { statusVar } from './toothVisual'

/**
 * The FDI notation key and the status legend.
 *
 * Present because the chart is read by more than the person who drew it — a colleague picking up
 * the file, or a patient being shown the plan, needs to know that "36" is the lower left first
 * molar and that red means pathology. The legend reads the same tokens the chart does, so the two
 * cannot drift apart.
 */
export function ToothNumberingReference() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-ink-muted uppercase">
          Tooth numbering system — FDI (ISO 3950)
        </h3>
        <p className="mb-3 text-sm text-ink-muted">
          Two digits: the quadrant, then the tooth counting back from the midline. Left and right
          are always the <strong className="font-medium text-navy">patient&rsquo;s</strong>, which
          is why the chart is mirrored — it faces them.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-pale text-left">
                {['Quadrant', 'Range', 'Position'].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold tracking-wide text-navy uppercase"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['1', '11–18', 'Upper right'],
                ['2', '21–28', 'Upper left'],
                ['3', '31–38', 'Lower left'],
                ['4', '41–48', 'Lower right'],
                ['5', '51–55', 'Upper right (primary)'],
                ['6', '61–65', 'Upper left (primary)'],
                ['7', '71–75', 'Lower left (primary)'],
                ['8', '81–85', 'Lower right (primary)'],
              ].map(([quadrant, range, position]) => (
                <tr key={quadrant} className="border-t border-line">
                  <td className="px-3 py-1.5 font-mono font-medium text-navy">{quadrant}</td>
                  <td className="px-3 py-1.5 font-mono text-ink tabular-nums">{range}</td>
                  <td className="px-3 py-1.5 text-ink-muted">{position}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm text-ink-muted">
          Position 1 is the central incisor, counting back to 8 (third molar). So{' '}
          <span className="font-mono font-medium text-navy">36</span> is the lower left first molar.
        </p>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-semibold tracking-wider text-ink-muted uppercase">
          Status key
        </h3>
        <p className="mb-3 text-sm text-ink-muted">
          Red means pathology or planned work, blue an existing restoration — the convention dental
          charts have used for decades. Caries and planned extraction share a red and are told apart
          by shape: caries fills one surface, an extraction crosses the whole tooth.
        </p>

        <ul className="grid gap-2 sm:grid-cols-2">
          {STATUS_ORDER.map((status) => (
            <li key={status} className="flex items-center gap-2.5 text-sm">
              <span
                aria-hidden="true"
                className="size-4 shrink-0 rounded border border-black/15"
                style={{ background: statusVar(status) }}
              />
              <span className="font-medium text-ink">{STATUS_META[status].label}</span>
              <span className="text-xs text-ink-muted">{STATUS_META[status].hint}</span>
            </li>
          ))}
        </ul>

        <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wider text-ink-muted uppercase">
          Surface abbreviations
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          {[
            ['M', 'mesial'],
            ['D', 'distal'],
            ['B', 'buccal'],
            ['La', 'labial'],
            ['Li', 'lingual'],
            ['P', 'palatal'],
            ['O', 'occlusal'],
            ['I', 'incisal'],
          ].map(([initial, name]) => (
            <div key={initial} className="flex gap-2">
              <dt className="w-6 font-mono text-xs font-bold text-ink-muted">{initial}</dt>
              <dd className="text-ink">{name}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  )
}
