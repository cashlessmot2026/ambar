import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api } from '../lib/api'
import type { AdminData } from '../lib/types'

const KEY = 'ambar:admin-session'

interface AdminValue {
  token: string | null
  data: AdminData | null
  login: (password: string) => Promise<void>
  logout: () => void
  reload: () => Promise<void>
  /** Ejecuta una llamada admin; si la sesión expiró, cierra sesión y relanza el error. */
  run: <T>(fn: (token: string) => Promise<T>) => Promise<T>
}

const Ctx = createContext<AdminValue | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    try { return sessionStorage.getItem(KEY) } catch { return null }
  })
  const [data, setData] = useState<AdminData | null>(null)

  const logout = useCallback(() => {
    if (token) void api.admin.logout(token).catch(() => {})
    try { sessionStorage.removeItem(KEY) } catch { /* sin almacenamiento */ }
    setToken(null)
    setData(null)
  }, [token])

  const run = useCallback(async <T,>(fn: (t: string) => Promise<T>): Promise<T> => {
    if (!token) throw new ApiError('unauthorized')
    try {
      return await fn(token)
    } catch (e) {
      if (e instanceof ApiError && e.code === 'unauthorized') {
        try { sessionStorage.removeItem(KEY) } catch { /* sin almacenamiento */ }
        setToken(null)
        setData(null)
      }
      throw e
    }
  }, [token])

  const reload = useCallback(async () => {
    const d = await run((t) => api.admin.get(t))
    setData(d)
  }, [run])

  useEffect(() => {
    if (token) void reload().catch(() => {})
  }, [token, reload])

  const login = useCallback(async (password: string) => {
    const t = await api.admin.login(password)
    try { sessionStorage.setItem(KEY, t) } catch { /* sin almacenamiento */ }
    setToken(t)
  }, [])

  const value = useMemo(() => ({ token, data, login, logout, reload, run }), [token, data, login, logout, reload, run])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAdmin(): AdminValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAdmin fuera de AdminProvider')
  return v
}
