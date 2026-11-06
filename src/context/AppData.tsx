import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'
import type { PublicData } from '../lib/types'

const CACHE_KEY = 'ambar:data:v1'

interface AppDataValue {
  data: PublicData | null
  loading: boolean
  error: boolean
  reload: () => Promise<void>
}

const Ctx = createContext<AppDataValue>({ data: null, loading: true, error: false, reload: async () => {} })

function readCache(): PublicData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as PublicData) : null
  } catch {
    return null
  }
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PublicData | null>(readCache)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    try {
      const fresh = await api.getPublicData()
      setData(fresh)
      setError(false)
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(fresh)) } catch { /* sin almacenamiento */ }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  return <Ctx.Provider value={{ data, loading, error, reload }}>{children}</Ctx.Provider>
}

export const useAppData = () => useContext(Ctx)
