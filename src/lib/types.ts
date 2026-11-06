export interface Product {
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
  id: string
  name: string
  image: string | null
  sort: number
  products: Product[]
  menu_id?: string
}

export interface Menu {
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
  stars: number
  pending_reward_id: string | null
  created_at: string
}

export interface OrderLine {
  product_id: string
  name: string
  qty: number
  price: number
}

export interface OrderSummary {
  id: string
  number: number
  total: number
  items: OrderLine[]
  notes: string | null
  created_at: string
}

export type ClaimResult =
  | { action: 'earn'; stars: number }
  | { action: 'redeem'; stars: 0; reward: { id: string; name: string; description: string | null } }

export interface AdminOrder extends OrderSummary {
  status: 'nuevo' | 'preparando' | 'entregado' | 'cancelado'
  customer: { name: string; phone: string; address: string }
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
