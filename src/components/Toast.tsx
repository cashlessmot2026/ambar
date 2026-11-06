import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const Ctx = createContext<(msg: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 2200)
  }, [])
  return (
    <Ctx.Provider value={show}>
      {children}
      <AnimatePresence>
        {msg && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: 20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
          >
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
