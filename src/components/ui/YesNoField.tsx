import { useId } from 'react'
import { TextAreaField } from './Field'

/**
 * One of the four medical screening decisions (FR-M01-04).
 *
 * Rendered as two explicit radios rather than a checkbox, because "No" and "not yet asked" are
 * clinically different answers and a checkbox cannot tell them apart. The detail field only
 * appears — and is only required — once the answer is Yes; the SRS states these decisions must not
 * be captured as free text alone.
 */
interface YesNoFieldProps {
  label: string
  detailLabel: string
  value: boolean | null
  detail: string
  onChange: (value: boolean) => void
  onDetailChange: (detail: string) => void
  error?: string
  detailError?: string
  disabled?: boolean
}

export function YesNoField({
  label,
  detailLabel,
  value,
  detail,
  onChange,
  onDetailChange,
  error,
  detailError,
  disabled,
}: YesNoFieldProps) {
  const name = useId()

  return (
    <fieldset
      className={`rounded-xl border p-4 ${error ? 'border-danger bg-danger-100/40' : 'border-line bg-white'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <legend className="contents">
          <span className="text-sm font-medium text-navy">{label}</span>
        </legend>

        <div className="flex gap-2" role="radiogroup" aria-label={label}>
          {[
            { label: 'Yes', selected: value === true },
            { label: 'No', selected: value === false },
          ].map((option) => (
            <label
              key={option.label}
              className={`min-h-9 cursor-pointer rounded-lg border px-4 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-clinic ${
                option.selected
                  ? option.label === 'Yes'
                    ? 'border-warn bg-warn-100 text-warn'
                    : 'border-clinic bg-clinic-100 text-navy'
                  : 'border-line bg-white text-ink-muted hover:bg-pale'
              } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name={name}
                className="sr-only"
                checked={option.selected}
                disabled={disabled}
                onChange={() => onChange(option.label === 'Yes')}
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {value === true && (
        <TextAreaField
          label={detailLabel}
          className="mt-4"
          rows={2}
          required
          disabled={disabled}
          value={detail}
          error={detailError}
          onChange={(event) => onDetailChange(event.target.value)}
          placeholder="Record what the patient reported"
        />
      )}
    </fieldset>
  )
}
