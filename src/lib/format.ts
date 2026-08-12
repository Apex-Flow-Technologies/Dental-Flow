import { Timestamp } from 'firebase/firestore'
import { differenceInYears, format, isValid, parseISO } from 'date-fns'
import type { Patient } from '@/types/models'

/* ------------------------------------------------------------------ dates */

/** `yyyy-MM-dd` for `<input type="date">`, which only accepts that format. */
export function toDateInput(value: Timestamp | Date | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Timestamp ? value.toDate() : value
  return isValid(date) ? format(date, 'yyyy-MM-dd') : ''
}

export function fromDateInput(value: string | null | undefined): Timestamp | null {
  if (!value) return null
  const date = parseISO(value)
  return isValid(date) ? Timestamp.fromDate(date) : null
}

export function formatDate(value: Timestamp | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Timestamp ? value.toDate() : value
  return isValid(date) ? format(date, 'dd MMM yyyy') : '—'
}

export function formatDateTime(value: Timestamp | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Timestamp ? value.toDate() : value
  return isValid(date) ? format(date, 'dd MMM yyyy, h:mm a') : '—'
}

export const todayInput = (): string => format(new Date(), 'yyyy-MM-dd')

/* -------------------------------------------------------------------- age */

/** Completed years between `dob` and today, or null if the date is missing or in the future. */
export function calcAge(dob: Timestamp | Date | null | undefined): number | null {
  if (!dob) return null
  const date = dob instanceof Timestamp ? dob.toDate() : dob
  if (!isValid(date)) return null
  const years = differenceInYears(new Date(), date)
  return years >= 0 ? years : null
}

export function calcAgeFromInput(value: string): number | null {
  return calcAge(fromDateInput(value))
}

export interface DisplayAge {
  years: number | null
  /** True when derived from an age typed at registration rather than from a date of birth. */
  approximate: boolean
}

/**
 * The patient's age today.
 *
 * DOB is authoritative whenever present. When only an age-at-registration was recorded — the case
 * for legacy paper cards where DOB was never asked — the age is rolled forward by the years elapsed
 * since registration and flagged approximate, so nobody mistakes it for a known figure.
 */
export function displayAge(patient: Pick<Patient, 'dob' | 'ageAtRegistration' | 'registrationDate'>): DisplayAge {
  const fromDob = calcAge(patient.dob)
  if (fromDob !== null) return { years: fromDob, approximate: false }

  if (patient.ageAtRegistration === null) return { years: null, approximate: false }

  const elapsed = differenceInYears(new Date(), patient.registrationDate.toDate())
  return { years: patient.ageAtRegistration + Math.max(0, elapsed), approximate: true }
}

export function formatAge(age: DisplayAge): string {
  if (age.years === null) return '—'
  return age.approximate ? `~${age.years}` : String(age.years)
}

/* ------------------------------------------------------------------ phone */

/** Digits only. Stored and searched in this form so formatting never breaks a lookup. */
export function normalisePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}

/** Drops a leading +91 / 0 so "+91 98765 43210" and "9876543210" match the same patient. */
export function normaliseIndianPhone(value: string | null | undefined): string {
  const digits = normalisePhone(value)
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1)
  return digits
}

export function formatPhone(value: string | null | undefined): string {
  const digits = normalisePhone(value)
  if (!digits) return '—'
  return digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits
}

/* ------------------------------------------------------- file numbers */

/**
 * Trailing digits of a file number, used to suggest the next one.
 * "ACD-1042" and "1042" both yield 1042; a purely alphabetic number yields null.
 */
export function fileNumberSeq(fileNumber: string): number | null {
  const match = fileNumber.trim().match(/(\d+)\s*$/)
  if (!match) return null
  const parsed = Number.parseInt(match[1], 10)
  return Number.isSafeInteger(parsed) ? parsed : null
}

/** Uppercased and internally-whitespace-collapsed, so "acd 1042" and "ACD-1042" cannot both exist. */
export function normaliseFileNumber(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase()
}

/* ------------------------------------------------------------------ text */

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (character) => character.toUpperCase())
}

/** Collapses runs of whitespace so a stray double space does not defeat name search. */
export function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function nameKey(value: string): string {
  return cleanName(value).toLowerCase()
}

export function initials(value: string): string {
  const parts = cleanName(value).split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function orDash(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()
  return trimmed === '' ? '—' : trimmed
}
