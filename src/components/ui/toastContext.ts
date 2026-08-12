import { createContext, useContext } from 'react'

export interface ToastMessage {
  id: number
  message: string
  tone: 'success' | 'error'
}

export interface ToastContextValue {
  notify: (message: string, tone?: ToastMessage['tone']) => void
}

/** Kept out of `Toast.tsx` so that file exports only a component and Fast Refresh works. */
export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside a ToastProvider.')
  return context
}
