import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Product } from '../lib/types'

export interface CartItem {
  product_id: string
  name: string
  price: number
  image: string | null
  qty: number
}

interface CartValue {
  items: CartItem[]
  count: number
  total: number
  add: (p: Product) => void
  setQty: (productId: string, qty: number) => void
  remove: (productId: string) => void
  clear: () => void
}

const KEY = 'ambar:cart:v1'
const Ctx = createContext<CartValue | null>(null)

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CartItem[]) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load)

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* sin almacenamiento */ }
  }, [items])

  const value = useMemo<CartValue>(() => ({
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    total: items.reduce((n, i) => n + i.qty * i.price, 0),
    add: (p) =>
      setItems((cur) => {
        const found = cur.find((i) => i.product_id === p.id)
        if (found) return cur.map((i) => (i.product_id === p.id ? { ...i, qty: Math.min(50, i.qty + 1) } : i))
        return [...cur, { product_id: p.id, name: p.name, price: p.price, image: p.images[0] ?? null, qty: 1 }]
      }),
    setQty: (id, qty) =>
      setItems((cur) =>
        qty <= 0 ? cur.filter((i) => i.product_id !== id) : cur.map((i) => (i.product_id === id ? { ...i, qty: Math.min(50, qty) } : i)),
      ),
    remove: (id) => setItems((cur) => cur.filter((i) => i.product_id !== id)),
    clear: () => setItems([]),
  }), [items])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart(): CartValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCart fuera de CartProvider')
  return v
}
