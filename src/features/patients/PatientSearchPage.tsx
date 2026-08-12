import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Badge, Card, EmptyState, ErrorNotice, PageHeader, Spinner } from '@/components/ui/primitives'
import { PlusIcon, SearchIcon } from '@/components/ui/icons'
import { searchPatients } from '@/services/patients'
import { BRANCH_LABELS, MEDICAL_FLAG_KEYS, MEDICAL_FLAG_LABELS, SEX_LABELS, type Patient } from '@/types/models'
import { displayAge, formatAge, formatDate, formatPhone } from '@/lib/format'

/**
 * The "Old Patients" view (FR-M01-01): search by clinic file number, name, phone or alternate phone.
 *
 * Landing on the page shows recently updated patients rather than nothing, because the common case
 * at the front desk is returning to a file opened minutes ago.
 */
export function PatientSearchPage() {
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Patient[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** The term the displayed results belong to — drives the "no matches for X" message. */
  const [searchedTerm, setSearchedTerm] = useState('')

  // Guards against an earlier, slower query overwriting the results of a later one.
  const requestId = useRef(0)

  const run = useCallback(async (query: string) => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const found = await searchPatients(query)
      if (id !== requestId.current) return
      setResults(found)
      setSearchedTerm(query.trim())
    } catch (caught) {
      if (id !== requestId.current) return
      console.error('Patient search failed', caught)
      setError('Could not load patients. Check your connection and try again.')
      setResults([])
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void run('')
  }, [run])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void run(term)
  }

  const isBrowsing = searchedTerm === ''

  return (
    <>
      <PageHeader
        title="Patients"
        subtitle="Search by file number, name, phone or alternate phone."
        action={
          <Button onClick={() => navigate('/patients/new')}>
            <PlusIcon className="size-4" />
            New patient
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" />
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="File number, name, or phone number"
              aria-label="Search patients"
              className="min-h-11 w-full rounded-lg border border-line bg-white pr-3 pl-11 text-sm text-ink placeholder:text-ink-muted/60 focus:border-clinic"
            />
          </div>
          <Button type="submit" className="sm:w-32">
            Search
          </Button>
          {searchedTerm !== '' && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setTerm('')
                void run('')
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </form>

      {error && <div className="mb-4">{<ErrorNotice>{error}</ErrorNotice>}</div>}

      <Card
        title={isBrowsing ? 'Recently updated' : `Results for “${searchedTerm}”`}
        description={
          results && results.length > 0
            ? `${results.length} patient${results.length === 1 ? '' : 's'}`
            : undefined
        }
        className="overflow-hidden"
      >
        {loading ? (
          <Spinner label="Searching" />
        ) : results && results.length > 0 ? (
          <PatientTable patients={results} />
        ) : isBrowsing ? (
          <EmptyState
            title="No patients registered yet"
            description="Register the first patient to start building the digital registry."
            action={
              <Button onClick={() => navigate('/patients/new')}>
                <PlusIcon className="size-4" />
                Register a patient
              </Button>
            }
          />
        ) : (
          <EmptyState
            title={`No patient matches “${searchedTerm}”`}
            description="Names match from the beginning, so try the first name on the file. Phone and file number must match exactly."
            action={
              <Button variant="secondary" onClick={() => navigate('/patients/new')}>
                Register as a new patient
              </Button>
            }
          />
        )}
      </Card>
    </>
  )
}

function PatientTable({ patients }: { patients: Patient[] }) {
  return (
    <div className="-mx-5 -my-5 overflow-x-auto">
      <table className="w-full min-w-3xl border-collapse text-sm">
        <thead>
          <tr className="bg-pale text-left">
            {['File no.', 'Name', 'Age / sex', 'Phone', 'Branch', 'Alerts', 'Updated'].map(
              (heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="px-4 py-3 text-xs font-semibold tracking-wide text-navy uppercase"
                >
                  {heading}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {patients.map((patient) => {
            const age = displayAge(patient)
            // Only Yes answers are surfaced here — the row is a triage cue, not the full history.
            const alerts = MEDICAL_FLAG_KEYS.filter(
              (key) => patient.medicalHistory?.[key]?.status,
            )

            return (
              <tr key={patient.id} className="border-t border-line hover:bg-pale/60">
                <td className="px-4 py-3 font-mono text-xs font-medium text-navy">
                  {patient.fileNumber}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/patients/${patient.id}`}
                    className="font-medium text-clinic hover:underline"
                  >
                    {patient.fullName}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {formatAge(age)} · {SEX_LABELS[patient.sex]}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink">
                  {formatPhone(patient.phone)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {BRANCH_LABELS[patient.branch]}
                </td>
                <td className="px-4 py-3">
                  {alerts.length === 0 ? (
                    <span className="text-ink-muted">—</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {alerts.map((key) => (
                        <Badge key={key} tone="warn">
                          {MEDICAL_FLAG_LABELS[key]}
                        </Badge>
                      ))}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-ink-muted">
                  {formatDate(patient.updatedAt)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
