import { Link } from 'react-router-dom'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/primitives'
import { AlertIcon } from '@/components/ui/icons'
import { displayAge, formatAge, formatDate, formatPhone } from '@/lib/format'
import { BRANCH_LABELS, type Patient } from '@/types/models'

/**
 * Warns about likely duplicate patients before a save (FR-M01-07).
 *
 * A warning rather than a block, because the matches it finds are genuinely ambiguous — families
 * share a phone number, and names repeat. The front desk can see the existing files and decide.
 */
interface DuplicateWarningDialogProps {
  open: boolean
  matches: Patient[]
  onCancel: () => void
  onConfirm: () => void
  confirming: boolean
}

export function DuplicateWarningDialog({
  open,
  matches,
  onCancel,
  onConfirm,
  confirming,
}: DuplicateWarningDialogProps) {
  return (
    <Modal
      open={open}
      size="lg"
      title="This patient may already have a file"
      description={
        matches.length === 1
          ? 'One existing patient matches the phone number or the name and date of birth.'
          : `${matches.length} existing patients match the phone number or the name and date of birth.`
      }
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={confirming}>
            Go back and edit
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={confirming}>
            Create a new file anyway
          </Button>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-warn/30 bg-warn-100 p-3 text-sm text-warn">
        <AlertIcon className="mt-0.5 size-5" />
        <p>
          Open the existing file if this is the same person. Creating a second file splits their
          treatment history across two records.
        </p>
      </div>

      <ul className="space-y-3">
        {matches.map((patient) => {
          const age = displayAge(patient)
          return (
            <li
              key={patient.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-navy">{patient.fullName}</p>
                  <Badge tone="info">File {patient.fileNumber}</Badge>
                  <Badge>{BRANCH_LABELS[patient.branch]}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">
                  {formatPhone(patient.phone)} · Age {formatAge(age)} · Registered{' '}
                  {formatDate(patient.registrationDate)}
                </p>
              </div>

              <Link
                to={`/patients/${patient.id}`}
                className="min-h-9 rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-clinic hover:bg-pale"
              >
                Open this file
              </Link>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
