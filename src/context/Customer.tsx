import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api } from '../lib/api'
import type { Customer, RegisterInput } from '../lib/types'

export const TOKEN_KEY = 'ambar:customer-token'
const CUSTOMER_KEY = 'ambar:customer'

interface CustomerValue {
  customer: Customer | null
  token: string | null
  /** true cuando ya se verificó el token guardado (o no había). */
  ready: boolean
  /** Crea la cuenta (con PIN) y deja la sesión iniciada en este dispositivo. */
  signUp: (input: RegisterInput) => Promise<Customer>
  /** Inicia sesión con correo o teléfono + PIN. */
  signIn: (login: string, pin: string) => Promise<Customer>
  /** Cierra la sesión en este dispositivo (y borra el token en el servidor). */
  signOut: () => void
  refresh: () => Promise<Customer | null>
  setCustomer: (c: Customer) => void
  /** Olvida la sesión local sin llamar al servidor (token inválido). */
  logout: () => void
}

const Ctx = createContext<CustomerValue | null>(null)

const read = (k: string) => {
  try { return localStorage.getItem(k) } catch { return null }
}
const write = (k: string, v: string | null) => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* sin almacenamiento */ }
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => read(TOKEN_KEY))
  const [customer, setCustomerState] = useState<Customer | null>(() => {
    const raw = read(CUSTOMER_KEY)
    try { return raw ? (JSON.parse(raw) as Customer) : null } catch { return null }
  })
  const [ready, setReady] = useState(false)

  const setCustomer = useCallback((c: Customer) => {
    setCustomerState(c)
    write(CUSTOMER_KEY, JSON.stringify(c))
  }, [])

  const logout = useCallback(() => {
    write(TOKEN_KEY, null)
    write(CUSTOMER_KEY, null)
    setToken(null)
    setCustomerState(null)
  }, [])

  const signOut = useCallback(() => {
    const t = read(TOKEN_KEY)
    if (t) void api.logout(t).catch(() => {})
    logout()
  }, [logout])

  const refresh = useCallback(async () => {
    const t = read(TOKEN_KEY)
    if (!t) {
      setReady(true)
      return null
    }
    try {
      const c = await api.getMyCard(t)
      setCustomer(c)
      return c
    } catch (e) {
      if (e instanceof ApiError && e.code === 'invalid_token') logout()
      return null
    } finally {
      setReady(true)
    }
  }, [logout, setCustomer])

  useEffect(() => { void refresh() }, [refresh])

  const start = useCallback((res: { token: string; customer: Customer }) => {
    write(TOKEN_KEY, res.token)
    setToken(res.token)
    setCustomer(res.customer)
    return res.customer
  }, [setCustomer])

  const signUp = useCallback(async (input: RegisterInput) => start(await api.registerAccount(input)), [start])
  const signIn = useCallback(async (login: string, pin: string) => start(await api.login(login, pin)), [start])

  const value = useMemo(
    () => ({ customer, token, ready, signUp, signIn, signOut, refresh, setCustomer, logout }),
    [customer, token, ready, signUp, signIn, signOut, refresh, setCustomer, logout],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCustomer(): CustomerValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCustomer fuera de CustomerProvider')
  return v
}
