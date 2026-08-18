import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SelectField, TextField } from '@/components/ui/Field'
import { Card, ErrorNotice, InfoNotice, Spinner } from '@/components/ui/primitives'
import { useActor } from '@/auth/useAuth'
import { useToast } from '@/components/ui/toastContext'
import {
  getClinicSettings,
  saveClinicSettings,
  type ClinicSettings,
  type FeeOption,
} from '@/services/clinicSettings'
import { PATIENT_CATEGORIES, PATIENT_CATEGORY_LABELS } from '@/types/models'
import { describeLoadError, describeSaveError } from '@/services/errors'

/**
 * The consultation fee schedule.
 *
 * Rows are added and removed by the doctor — the app never invents a price. Each row optionally
 * binds to a patient category, which is what makes the registration form able to suggest a fee
 * instead of asking the front desk to remember one.
 */
export function FeeSettingsCard() {
  const actor = useActor()
  const { notify } = useToast()

  const [settings, setSettings] = useState<ClinicSettings | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const load = useCallback(async () => {
    setLoadError(null)
    try {
      setSettings(await getClinicSettings())
    } catch (caught) {
      console.error('Failed to load clinic settings', caught)
      setLoadError(describeLoadError(caught, 'the fee schedule'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function update(index: number, patch: Partial<FeeOption>) {
    setSettings((current) =>
      current
        ? {
            ...current,
            consultationFees: current.consultationFees.map((fee, i) =>
              i === index ? { ...fee, ...patch } : fee,
            ),
          }
        : current,
    )
    setDirty(true)
  }

  function addRow() {
    setSettings((current) =>
      current
        ? {
            ...current,
            consultationFees: [
              ...current.consultationFees,
              {
                // Timestamped so a row removed and re-added never collides with the old one.
                id: `fee-${Date.now()}`,
                label: '',
                amount: 0,
                appliesTo: 'any',
              },
            ],
          }
        : current,
    )
    setDirty(true)
  }

  function removeRow(index: number) {
    setSettings((current) =>
      current
        ? {
            ...current,
            consultationFees: current.consultationFees.filter((_, i) => i !== index),
          }
        : current,
    )
    setDirty(true)
  }

  async function handleSave() {
    if (!settings) return
    if (settings.consultationFees.some((fee) => fee.label.trim() === '')) {
      setError('Give every fee a name, or remove the blank row.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await saveClinicSettings(
        {
          ...settings,
          consultationFees: settings.consultationFees.map((fee) => ({
            ...fee,
            label: fee.label.trim(),
            amount: Number.isFinite(fee.amount) ? fee.amount : 0,
          })),
        },
        actor,
      )
      setDirty(false)
      notify('Fee schedule saved.')
    } catch (caught) {
      console.error('Failed to save fee schedule', caught)
      setError(describeSaveError(caught, 'the fee schedule'))
    } finally {
      setSaving(false)
    }
  }

  if (loadError) return <ErrorNotice>{loadError}</ErrorNotice>
  if (!settings) return <Spinner label="Loading the fee schedule" />

  return (
    <Card
      title="Consultation fees"
      description="Set by the clinic. A patient's category decides which of these is suggested at registration."
      action={
        <Button variant="secondary" size="sm" onClick={addRow}>
          Add fee
        </Button>
      }
    >
      <div className="space-y-4">
        {error && <ErrorNotice>{error}</ErrorNotice>}

        {settings.consultationFees.length === 0 ? (
          <InfoNotice>
            No fees defined. Registration will simply leave the consultation fee blank.
          </InfoNotice>
        ) : (
          <ul className="space-y-3">
            {settings.consultationFees.map((fee, index) => (
              <li
                key={fee.id}
                className="grid items-start gap-3 rounded-lg border border-line p-3 sm:grid-cols-[1fr_8rem_12rem_auto]"
              >
                <TextField
                  label="Name"
                  value={fee.label}
                  placeholder="First consultation"
                  onChange={(event) => update(index, { label: event.target.value })}
                />
                <TextField
                  label={`Amount (${settings.currency})`}
                  inputMode="decimal"
                  className="no-spinner"
                  value={String(fee.amount)}
                  onChange={(event) => update(index, { amount: Number(event.target.value) || 0 })}
                />
                <SelectField
                  label="Suggest for"
                  value={fee.appliesTo}
                  onChange={(event) =>
                    update(index, { appliesTo: event.target.value as FeeOption['appliesTo'] })
                  }
                >
                  <option value="any">Any patient</option>
                  {PATIENT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {PATIENT_CATEGORY_LABELS[category]}
                    </option>
                  ))}
                </SelectField>
                <div className="flex h-full items-end pb-1">
                  <Button variant="ghost" size="sm" onClick={() => removeRow(index)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <InfoNotice>
          These are suggestions, not a locked price list. The fee on a patient can be overridden at
          registration, and again per visit once the Billing module is built.
        </InfoNotice>

        <div className="flex justify-end">
          <Button onClick={() => void handleSave()} loading={saving} disabled={!dirty}>
            Save fee schedule
          </Button>
        </div>
      </div>
    </Card>
  )
}
