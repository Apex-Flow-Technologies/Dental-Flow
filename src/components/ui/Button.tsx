import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-clinic text-white hover:bg-clinic-600 disabled:bg-clinic/50',
  secondary: 'bg-white text-navy border border-line hover:bg-pale disabled:text-ink-muted',
  ghost: 'bg-transparent text-navy hover:bg-pale disabled:text-ink-muted',
  danger: 'bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50',
}

const SIZES: Record<Size, string> = {
  // min-h-11 keeps every control at a comfortable tablet tap target for chairside use (SRS §6).
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}
