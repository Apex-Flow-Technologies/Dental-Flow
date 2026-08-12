import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ToastContext, type ToastMessage } from './toastContext'

/** Transient confirmations ("Patient saved"). Errors that need a decision use inline notices instead. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const notify = useCallback((message: string, tone: ToastMessage['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4000)
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto max-w-md rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
              toast.tone === 'success' ? 'bg-aqua-600' : 'bg-danger'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
