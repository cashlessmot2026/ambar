/** Traducciones por idioma: { en: { name: '…', description: '…' } }. */
export type I18nMap = Partial<Record<'es' | 'en' | 'de' | 'ru' | 'pt' | 'it' | 'fr' | 'zh' | 'ko' | 'ar', Record<string, string | undefined>>>

export interface Product {
  i18n?: I18nMap
  id: string
  name: string
  description: string | null
  price: number
  images: string[]
  featured: boolean
  sort: number
  active?: boolean
  category_id?: string
}

export interface Category {
  i18n?: I18nMap
  id: string
  name: string
  image: string | null
  sort: number
  products: Product[]
  menu_id?: string
}

export interface Menu {
  i18n?: I18nMap
  id: string
  slug: string
  name: string
  subtitle: string | null
  start_time: string // "HH:MM"
  end_time: string // "HH:MM"
  sort: number
  categories: Category[]
  active?: boolean
}

export interface Reward {
  i18n?: I18nMap
  id: string
  name: string
  description: string | null
  stars_required: number
  image: string | null
  active?: boolean
  sort?: number
}

export interface Settings {
  business: {
    name: string
    tagline: string
    chef: string
    chef_url: string
    location: string
    award: string
    music: string
    music_url: string
  }
  contact: {
    whatsapp: string
    instagram_url: string
    google_review_url: string
    tripadvisor_url: string
    maps_url: string
  }
  theme: {
    colors: Record<'bg' | 'surface' | 'border' | 'gold' | 'amber' | 'text' | 'muted', string>
    fonts: { heading: string; body: string }
  }
  landing: { headline: string; subheadline: string; video: string; images: string[] }
  /** Textos del negocio y del landing traducidos: { en: { landing: { headline }, business: { tagline } } } */
  i18n?: Partial<Record<string, { landing?: Partial<Record<'headline' | 'subheadline', string>>; business?: Partial<Record<'tagline' | 'location' | 'award', string>> }>>
  /** Pedidos por la app; ausente = activo. */
  ordering?: { enabled: boolean }
  /** Encuesta de satisfacción; ausente = encuesta por defecto. */
  survey?: Survey
}

export interface PublicData {
  settings: Settings
  menus: Menu[]
  rewards: Reward[]
}

export interface Customer {
  id: string
  name: string
  address: string
  phone: string
  email?: string | null
  birthday?: string | null // YYYY-MM-DD
  lat?: number | null
  lng?: number | null
  /** false en cuentas creadas antes del login con PIN. */
  has_pin?: boolean
  stars: number
  pending_reward_id: string | null
  created_at: string
}

export interface Coords { lat: number; lng: number }

export interface RegisterInput {
  name: string
  email: string
  phone: string
  birthday: string
  address: string
  pin: string
  consent: boolean
  coords: Coords | null
}

export interface OrderLine {
  product_id: string
  name: string
  qty: number
  price: number
}

export type OrderStatus = 'nuevo' | 'preparando' | 'en_camino' | 'entregado' | 'cancelado'
export const ORDER_STATUSES: OrderStatus[] = ['nuevo', 'preparando', 'en_camino', 'entregado', 'cancelado']

export interface OrderSummary {
  id: string
  number: number
  total: number
  items: OrderLine[]
  notes: string | null
  created_at: string
  status?: OrderStatus
  lat?: number | null
  lng?: number | null
  updated_at?: string
  /** Solo en la respuesta de place_order: el pedido sumó 1 estrella y el nuevo total. */
  star_awarded?: boolean
  stars?: number
}

export type ClaimResult =
  | { action: 'earn'; stars: number }
  | { action: 'redeem'; stars: 0; reward: { id: string; name: string; description: string | null } }

export interface AdminOrder extends OrderSummary {
  status: OrderStatus
  customer: { name: string; phone: string; address: string; email?: string | null }
}

export type ReservationStatus = 'pendiente' | 'confirmada' | 'rechazada' | 'cancelada' | 'completada'
export const RESERVATION_STATUSES: ReservationStatus[] = ['pendiente', 'confirmada', 'rechazada', 'cancelada', 'completada']

export interface Reservation {
  id: string
  number: number
  name: string
  phone: string
  email: string
  reserved_at: string
  people: number
  babies: boolean
  notes: string | null
  dishes: OrderLine[]
  dishes_total: number
  status: ReservationStatus
  email_received_at: string | null
  email_confirmed_at: string | null
  created_at: string
  updated_at: string
}

export interface ReservationInput {
  name: string
  phone: string
  email: string
  reserved_at: string // ISO
  people: number
  babies: boolean
  notes: string
}

export interface AiReply {
  reply: string
  products: string[]
  recommended: string | null
}

export interface StarEvent {
  kind: 'earn' | 'redeem' | 'adjust'
  delta: number
  reward_name: string | null
  created_at: string
}

export interface AdminCustomer extends Customer {
  orders: number
  events: StarEvent[]
}

export interface AdminData {
  settings: Settings
  business_key: string
  menus: Menu[]
  rewards: Reward[]
}

export interface SurveyQuestion {
  id: string
  text: string
}

export interface Survey {
  title: string
  intro: string
  questions: SurveyQuestion[]
  comment_enabled: boolean
}

export interface SurveyResults {
  total: number
  average: number | null
  by_question: { text: string; avg: number; count: number }[]
  recent: {
    id: string
    created_at: string
    average: number
    comment: string | null
    answers: { id: string; text: string; rating: number }[]
  }[]
}
