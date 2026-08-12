/**
 * Inline SVG icons.
 *
 * Kept local rather than pulled from an icon package: the set is small, and inlining avoids
 * shipping a dependency for eight glyphs. All are `currentColor` and sized by the caller.
 */
interface IconProps {
  className?: string
}

const base = 'shrink-0'

export function ToothIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${base} ${className}`}
    >
      <path d="M12 5.5c-1.6-1.3-3-2-4.5-2A3.5 3.5 0 0 0 4 7c0 2 .6 3.2 1 5 .5 2.2.4 5.4 1.4 7.4.6 1.2 2 1 2.4-.4.5-1.7.6-4.5 1.4-5.6.4-.6 1.2-.9 1.8-.9s1.4.3 1.8.9c.8 1.1.9 3.9 1.4 5.6.4 1.4 1.8 1.6 2.4.4 1-2 .9-5.2 1.4-7.4.4-1.8 1-3 1-5a3.5 3.5 0 0 0-3.5-3.5c-1.5 0-2.9.7-4.5 2Z" />
    </svg>
  )
}

export function SearchIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      className={`${base} ${className}`}
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function PlusIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      className={`${base} ${className}`}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function UsersIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${base} ${className}`}
    >
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.4 5.2a3.2 3.2 0 0 1 0 5.6" />
    </svg>
  )
}

export function ArrowLeftIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${base} ${className}`}
    >
      <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
    </svg>
  )
}

export function SignOutIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${base} ${className}`}
    >
      <path d="M15 17v1.5A1.5 1.5 0 0 1 13.5 20h-7A1.5 1.5 0 0 1 5 18.5v-13A1.5 1.5 0 0 1 6.5 4h7A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M19 12H9m10 0-3-3m3 3-3 3" />
    </svg>
  )
}

export function MenuIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden="true"
      className={`${base} ${className}`}
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

export function AlertIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${base} ${className}`}
    >
      <path d="M12 4.5 2.8 20h18.4L12 4.5Z" />
      <path d="M12 10v4M12 17.2v.1" />
    </svg>
  )
}
