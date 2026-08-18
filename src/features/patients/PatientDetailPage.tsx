import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Badge, EmptyState, ErrorNotice, Spinner } from '@/components/ui/primitives'
import { ArrowLeftIcon } from '@/components/ui/icons'
import { getPatient } from '@/services/patients'
import {
  BRANCH_LABELS,
  MEDICAL_FLAG_KEYS,
  MEDICAL_FLAG_LABELS,
  SEX_LABELS,
  type Patient,
} from '@/types/models'
import { displayAge, formatAge, formatPhone, initials } from '@/lib/format'
import { DemographicsTab } from './tabs/DemographicsTab'
import { MedicalHistoryTab } from './tabs/MedicalHistoryTab'
import { ClinicalNotesTab } from './tabs/ClinicalNotesTab'
import { TreatmentTab } from './tabs/TreatmentTab'
import { ToothChartPanel } from '@/features/charting/ToothChartPanel'
import { AuditTab } from './tabs/AuditTab'

const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'medical', label: 'Medical history' },
  { id: 'notes', label: 'Clinical notes' },
  { id: 'charting', label: 'Tooth chart' },
  { id: 'treatment', label: 'Treatment' },
  { id: 'audit', label: 'Audit' },
] as const

type TabId = (typeof TABS)[number]['id']

const isTabId = (value: string | null): value is TabId =>
  TABS.some((tab) => tab.id === value)

/** The full patient file. Tab state lives in the URL so a tab can be linked to and survives reload. */
export function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tabParam = searchParams.get('tab')
  const activeTab: TabId = isTabId(tabParam) ? tabParam : 'details'

  const load = useCallback(async () => {
    if (!patientId) return
    setLoading(true)
    setError(null)
    try {
      setPatient(await getPatient(patientId))
    } catch (caught) {
      console.error('Failed to load patient', caught)
      setError('Could not load this patient. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <Spinner label="Loading the patient file" />
  if (error) return <ErrorNotice>{error}</ErrorNotice>

  if (!patient) {
    return (
      <EmptyState
        title="Patient not found"
        description="This file may have been removed, or the link may be wrong."
        action={
          <Link to="/patients" className="text-sm font-medium text-clinic hover:underline">
            Back to patients
          </Link>
        }
      />
    )
  }

  const age = displayAge(patient)
  const alerts = MEDICAL_FLAG_KEYS.filter((key) => patient.medicalHistory?.[key]?.status)

  return (
    <>
      <Link
        to="/patients"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-clinic hover:underline"
      >
        <ArrowLeftIcon className="size-4" />
        All patients
      </Link>

      <header className="mb-6 rounded-xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-start gap-4">
          {patient.photoDataUrl ? (
            <img
              src={patient.photoDataUrl}
              alt={`Photo of ${patient.fullName}`}
              className="size-14 shrink-0 rounded-2xl border border-line object-cover"
            />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-navy text-lg font-semibold text-white">
              {initials(patient.fullName)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-navy">{patient.fullName}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              File {patient.fileNumber} · {formatAge(age)}
              {age.approximate ? ' (est.)' : ''} · {SEX_LABELS[patient.sex]} ·{' '}
              {formatPhone(patient.phone)} · {BRANCH_LABELS[patient.branch]}
            </p>

            {alerts.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {alerts.map((key) => (
                  <Badge key={key} tone="warn">
                    {MEDICAL_FLAG_LABELS[key]}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mb-6 overflow-x-auto border-b border-line">
        <nav className="flex min-w-max gap-1" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setSearchParams({ tab: tab.id }, { replace: true })}
              className={`min-h-11 border-b-2 px-4 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-clinic text-clinic'
                  : 'border-transparent text-ink-muted hover:text-navy'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'details' && <DemographicsTab patient={patient} onSaved={setPatient} />}
      {activeTab === 'medical' && <MedicalHistoryTab patient={patient} onSaved={setPatient} />}
      {activeTab === 'notes' && <ClinicalNotesTab patientId={patient.id} />}
      {activeTab === 'charting' && <ToothChartPanel patient={patient} />}
      {activeTab === 'treatment' && <TreatmentTab patientId={patient.id} />}
      {activeTab === 'audit' && <AuditTab patientId={patient.id} />}
    </>
  )
}
