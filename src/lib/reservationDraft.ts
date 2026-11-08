// Reserva a la que el cliente está agregando platos desde el menú (se guarda en este dispositivo).
export interface ReservationDraft {
  id: string
  number: number
  key: string
  reserved_at: string
  people: number
}

const KEY = 'ambar:reservation-draft'

export function readDraft(): ReservationDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ReservationDraft) : null
  } catch {
    return null
  }
}

export function writeDraft(d: ReservationDraft | null) {
  try {
    if (d) localStorage.setItem(KEY, JSON.stringify(d))
    else localStorage.removeItem(KEY)
  } catch { /* sin almacenamiento */ }
  window.dispatchEvent(new Event('ambar:draft'))
}
