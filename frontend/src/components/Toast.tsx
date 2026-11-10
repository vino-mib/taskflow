import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from './toast-context.ts'

interface ToastItem {
  id: number
  message: string
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const timers = useRef<number[]>([])

  const push = useCallback((message: string) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message }].slice(-3))
    const timer = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id))
    }, 3200)
    timers.current.push(timer)
  }, [])

  useEffect(() => {
    const active = timers.current
    return () => {
      for (const timer of active) window.clearTimeout(timer)
    }
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
