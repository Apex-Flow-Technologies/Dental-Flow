import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Modal dialog built on the native `<dialog>` element, so focus trapping, Escape handling and the
 * top-layer backdrop come from the browser rather than from hand-written key handlers.
 */
interface ModalProps {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Width class; dialogs listing patient matches need more room than a confirmation. */
  size?: 'sm' | 'lg'
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  size = 'sm',
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    // Fires for Escape as well as programmatic close, keeping React state in step either way.
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      aria-label={title}
      className={`m-auto w-[calc(100vw-2rem)] rounded-xl border border-line bg-white p-0 text-ink backdrop:bg-navy-900/40 ${
        size === 'lg' ? 'max-w-2xl' : 'max-w-md'
      }`}
    >
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-base font-semibold text-navy">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-5 py-4">{children}</div>

      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-pale px-5 py-4">
          {footer}
        </div>
      )}
    </dialog>
  )
}
