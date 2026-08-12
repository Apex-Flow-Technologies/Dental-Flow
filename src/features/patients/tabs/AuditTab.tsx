import { useEffect, useState } from 'react'
import { Card, EmptyState, ErrorNotice, Spinner } from '@/components/ui/primitives'
import { listPatientAudit } from '@/services/audit'
import { AUDIT_ENTITY_LABELS, type AuditEntry } from '@/types/models'
import { formatDateTime } from '@/lib/format'

/**
 * The audit trail for one patient (FR-M01-08).
 *
 * Entries are append-only in `firestore.rules`, so what is shown here is the complete history of
 * who changed which field and when — nothing can be edited away after the fact.
 */
export function AuditTab({ patientId }: { patientId: string }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listPatientAudit(patientId)
      .then((found) => {
        if (!cancelled) setEntries(found)
      })
      .catch((caught) => {
        console.error('Failed to load the audit trail', caught)
        if (cancelled) return
        setError('Could not load the audit trail.')
        setEntries([])
      })
    return () => {
      cancelled = true
    }
  }, [patientId])

  return (
    <Card
      title="Audit trail"
      description="Every change to this patient's demographics and medical history, newest first."
    >
      {error ? (
        <ErrorNotice>{error}</ErrorNotice>
      ) : entries === null ? (
        <Spinner label="Loading the audit trail" />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No changes recorded yet"
          description="Edits to this record will appear here with the field, the old value and the new one."
        />
      ) : (
        <ol className="space-y-4">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="rounded-full bg-clinic-100 px-2 py-0.5 font-medium text-navy">
                  {entry.action === 'create' ? 'Created' : 'Updated'} ·{' '}
                  {AUDIT_ENTITY_LABELS[entry.entity] ?? entry.entity}
                </span>
                <span className="text-ink-muted">{formatDateTime(entry.at)}</span>
                <span className="text-ink-muted">· {entry.actorEmail}</span>
              </div>

              <ul className="mt-3 space-y-1.5">
                {entry.changes.map((change, index) => (
                  <li key={`${change.field}-${index}`} className="text-sm">
                    <span className="font-medium text-navy">{change.label}</span>{' '}
                    {entry.action === 'create' ? (
                      <span className="text-ink">{change.to}</span>
                    ) : (
                      <>
                        <span className="text-ink-muted line-through">{change.from}</span>
                        <span className="mx-1.5 text-ink-muted">→</span>
                        <span className="text-ink">{change.to}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
