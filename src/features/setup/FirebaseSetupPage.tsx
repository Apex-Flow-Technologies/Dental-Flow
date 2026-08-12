import { missingFirebaseKeys } from '@/lib/firebaseConfig'
import { ToothIcon } from '@/components/ui/icons'

/**
 * Shown instead of the app when `.env.local` has not been filled in.
 *
 * Without this the first Firestore call fails with an opaque SDK error that gives no hint the
 * config is simply missing — a confusing first-run experience for whoever sets the clinic up.
 */
export function FirebaseSetupPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-xl rounded-xl bg-white p-8 shadow-xl">
        <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-clinic-100 text-clinic">
          <ToothIcon className="size-6" />
        </span>

        <h1 className="text-xl font-semibold text-navy">Firebase is not configured yet</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Dental Flow needs your Firebase project details before it can sign anyone in or store a
          patient record.
        </p>

        <ol className="mt-6 space-y-3 text-sm text-ink">
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
              1
            </span>
            <span>
              In the Firebase console, open <strong>Project settings → General → Your apps</strong>{' '}
              and select your web app.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
              2
            </span>
            <span>
              Copy each value from <strong>SDK setup and configuration</strong> into{' '}
              <code className="rounded bg-pale px-1.5 py-0.5 text-xs">.env.local</code> in the
              project root.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">
              3
            </span>
            <span>
              Restart the dev server — Vite only reads environment files at startup.
            </span>
          </li>
        </ol>

        {missingFirebaseKeys.length > 0 && (
          <div className="mt-6 rounded-lg border border-warn/30 bg-warn-100 p-4">
            <p className="text-sm font-medium text-warn">Still missing</p>
            <ul className="mt-2 space-y-1">
              {missingFirebaseKeys.map((key) => (
                <li key={key} className="font-mono text-xs text-ink">
                  {key}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-xs text-ink-muted">
          These values ship in the browser bundle and are public by design. Patient data is protected
          by Firebase Authentication and the rules in <code>firestore.rules</code>, not by keeping
          them secret.
        </p>
      </div>
    </main>
  )
}
