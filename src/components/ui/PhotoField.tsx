import { useRef, useState } from 'react'
import { Button } from './Button'
import { CameraIcon } from './icons'
import { dataUrlBytes, formatBytes, toSquareDataUrl } from '@/lib/image'
import { initials } from '@/lib/format'

/**
 * Patient photo picker.
 *
 * `capture="environment"` means a tablet at the chairside opens the camera directly rather than a
 * file browser — which is how this will actually be used. Everything is downscaled before it goes
 * anywhere near Firestore; see `lib/image.ts` for why it is stored inline rather than in Storage.
 */
interface PhotoFieldProps {
  value: string | null
  onChange: (dataUrl: string | null) => void
  /** Falls back to initials when there is no photo. */
  name?: string
  disabled?: boolean
}

export function PhotoField({ value, onChange, name = '', disabled = false }: PhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      onChange(await toSquareDataUrl(file))
    } catch (caught) {
      console.error('Failed to process the photo', caught)
      setError(caught instanceof Error ? caught.message : 'Could not read that image.')
    } finally {
      setBusy(false)
      // Cleared so picking the same file twice still fires a change event.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-navy">Patient photo</span>

      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-line bg-pale">
          {value ? (
            <img src={value} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-lg font-semibold text-ink-muted">
              {name.trim() ? initials(name) : <CameraIcon className="size-6" />}
            </span>
          )}
        </div>

        <div className="min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={disabled || busy}
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={busy}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <CameraIcon className="size-4" />
              {value ? 'Replace photo' : 'Add photo'}
            </Button>

            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled || busy}
                onClick={() => {
                  onChange(null)
                  setError(null)
                }}
              >
                Remove
              </Button>
            )}
          </div>

          <p className="mt-1.5 text-xs text-ink-muted">
            {value
              ? `Stored at ${formatBytes(dataUrlBytes(value))}, cropped square.`
              : 'Optional. On a tablet this opens the camera.'}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
