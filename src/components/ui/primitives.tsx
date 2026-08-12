import type { ReactNode } from 'react'

/* ------------------------------------------------------------------- card */

export function Card({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-line bg-white ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-navy">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

/* ------------------------------------------------------------------ badge */

type Tone = 'neutral' | 'info' | 'success' | 'warn' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'bg-pale text-ink-muted border-line',
  info: 'bg-clinic-100 text-navy border-clinic/30',
  success: 'bg-aqua-100 text-aqua-600 border-aqua/40',
  warn: 'bg-warn-100 text-warn border-warn/30',
  danger: 'bg-danger-100 text-danger border-danger/30',
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: Tone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ states */

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-sm text-ink-muted">
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-clinic border-t-transparent"
      />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-base font-medium text-navy">{title}</p>
      {description && <p className="max-w-md text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-danger/30 bg-danger-100 px-4 py-3 text-sm text-danger"
    >
      {children}
    </div>
  )
}

export function InfoNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-clinic/25 bg-clinic-100/60 px-4 py-3 text-sm text-navy">
      {children}
    </div>
  )
}

/* ----------------------------------------------------------------- layout */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/** A labelled value in a definition list. Used across every read-only patient panel. */
export function DataItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-ink-muted uppercase">{label}</dt>
      <dd className="mt-1 text-sm break-words text-ink">{value}</dd>
    </div>
  )
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="border-b border-line pb-6 last:border-b-0 last:pb-0">
      <h3 className="text-sm font-semibold tracking-wide text-navy uppercase">{title}</h3>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
