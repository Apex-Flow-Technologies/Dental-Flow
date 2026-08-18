import { useCallback, useId, type ReactNode } from 'react'
import { useSpeechToText } from './useSpeechToText'
import { MicIcon } from './icons'

/**
 * A textarea with dictation.
 *
 * Typing every clinical note by hand is the slowest part of chairside work — the doctor has gloves
 * on and a patient in the chair. Speech is appended to whatever is already in the field rather
 * than replacing it, so dictation and typing can be mixed freely.
 *
 * The button hides entirely where the browser has no speech recognition (Firefox, older Safari)
 * rather than offering a control that silently does nothing.
 */
interface DictatedTextAreaProps {
  label: string
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  hint?: ReactNode
  error?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export function DictatedTextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
  error,
  disabled = false,
  required = false,
  className = '',
}: DictatedTextAreaProps) {
  const id = useId()

  const handleResult = useCallback(
    (text: string) => {
      // Append with a space, capitalising after a sentence end so dictated notes read normally.
      const trimmed = value.trimEnd()
      const needsCapital = trimmed === '' || /[.!?]$/.test(trimmed)
      const chunk = needsCapital ? text.charAt(0).toUpperCase() + text.slice(1) : text
      onChange(trimmed === '' ? chunk : `${trimmed} ${chunk}`)
    },
    [value, onChange],
  )

  const speech = useSpeechToText({ onResult: handleResult })

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-navy">
          {label}
          {required && (
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
          )}
        </label>

        {speech.supported && (
          <button
            type="button"
            onClick={speech.toggle}
            disabled={disabled}
            aria-pressed={speech.listening}
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors disabled:opacity-50 ${
              speech.listening
                ? 'border-danger bg-danger-100 text-danger'
                : 'border-line bg-white text-ink-muted hover:bg-pale hover:text-navy'
            }`}
          >
            <MicIcon className={`size-4 ${speech.listening ? 'animate-pulse' : ''}`} />
            {speech.listening ? 'Listening… tap to stop' : 'Dictate'}
          </button>
        )}
      </div>

      <div className="relative">
        <textarea
          id={id}
          rows={rows}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`w-full resize-y rounded-lg border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 transition-colors focus:border-clinic disabled:bg-pale disabled:text-ink-muted ${
            error ? 'border-danger' : speech.listening ? 'border-clinic' : 'border-line'
          }`}
        />

        {/* Interim words are shown but never committed — half-recognised speech must not reach
            the clinical record. */}
        {speech.interim && (
          <p className="pointer-events-none absolute inset-x-3 bottom-2 truncate text-sm text-ink-muted italic">
            {speech.interim}…
          </p>
        )}
      </div>

      {speech.error && (
        <p className="mt-1.5 text-sm text-warn" role="status">
          {speech.error}
        </p>
      )}

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
