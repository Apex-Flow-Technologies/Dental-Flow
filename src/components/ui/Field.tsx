import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

/**
 * Form primitives.
 *
 * All three wire the label, the error and the hint to the control with `aria-describedby` /
 * `aria-invalid`, and render errors below the field rather than replacing it — SRS §6 requires
 * validation errors to be shown clearly *without losing what the user typed*.
 */

const CONTROL_BASE =
  'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 transition-colors focus:border-clinic disabled:bg-pale disabled:text-ink-muted'

const controlClass = (invalid: boolean) =>
  `${CONTROL_BASE} ${invalid ? 'border-danger' : 'border-line'}`

interface FieldShellProps {
  label: string
  htmlFor: string
  error?: string
  hint?: ReactNode
  required?: boolean
  className?: string
  children: ReactNode
  describedBy: string
}

function FieldShell({
  label,
  htmlFor,
  error,
  hint,
  required,
  className = '',
  children,
  describedBy,
}: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-navy">
        {label}
        {required && (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${describedBy}-error`} className="mt-1.5 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${describedBy}-hint`} className="mt-1.5 text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  label: string
  error?: string
  hint?: ReactNode
  className?: string
}

export function TextField({ label, error, hint, className, ...rest }: TextFieldProps) {
  const id = useId()
  return (
    <FieldShell
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      required={rest.required}
      className={className}
      describedBy={id}
    >
      <input
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={controlClass(Boolean(error))}
      />
    </FieldShell>
  )
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'className'> {
  label: string
  error?: string
  hint?: ReactNode
  className?: string
  children: ReactNode
}

export function SelectField({ label, error, hint, className, children, ...rest }: SelectFieldProps) {
  const id = useId()
  return (
    <FieldShell
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      required={rest.required}
      className={className}
      describedBy={id}
    >
      <select
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={controlClass(Boolean(error))}
      >
        {children}
      </select>
    </FieldShell>
  )
}

interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> {
  label: string
  error?: string
  hint?: ReactNode
  className?: string
}

export function TextAreaField({ label, error, hint, className, ...rest }: TextAreaFieldProps) {
  const id = useId()
  return (
    <FieldShell
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      required={rest.required}
      className={className}
      describedBy={id}
    >
      <textarea
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`${controlClass(Boolean(error))} resize-y`}
      />
    </FieldShell>
  )
}

/** A read-only value rendered with the same rhythm as a field, for computed values like age. */
export function ReadOnlyField({
  label,
  value,
  hint,
  className = '',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <span className="mb-1.5 block text-sm font-medium text-navy">{label}</span>
      <div className="min-h-11 w-full rounded-lg border border-line bg-pale px-3 py-2.5 text-sm text-ink">
        {value}
      </div>
      {hint && <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>}
    </div>
  )
}
