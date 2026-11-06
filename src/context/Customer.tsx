import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, api } from '../lib/api'
import type { Customer } from '../lib/types'

export const TOKEN_KEY = 'ambar:customer-token'
const CUSTOMER_KEY = 'ambar:customer'

interface CustomerValue {
  customer: Customer | null
  token: string | null
  /** true cuando ya se verificó el token guardado (o no había). */
  ready: boolean
  register: (name: string, address: string, phone: string, consent: boolean) => Promise<Customer>
  refresh: () => Promise<Customer | null>
  setCustomer: (c: Customer) => void
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

  const register = useCallback(async (name: string, address: string, phone: string, consent: boolean) => {
    const res = await api.register(name, address, phone, consent)
    write(TOKEN_KEY, res.token)
    setToken(res.token)
    setCustomer(res.customer)
    return res.customer
  }, [setCustomer])

  const value = useMemo(
    () => ({ customer, token, ready, register, refresh, setCustomer, logout }),
    [customer, token, ready, register, refresh, setCustomer, logout],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCustomer(): CustomerValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCustomer fuera de CustomerProvider')
  return v
}
