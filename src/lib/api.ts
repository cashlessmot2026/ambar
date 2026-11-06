import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase'
import type {
  AdminCustomer, AdminData, AdminOrder, ClaimResult, Customer, OrderSummary, PublicData, Settings,
} from './types'

export class ApiError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

const MESSAGES: Record<string, string> = {
  invalid_token: 'Tu sesión expiró. Regístrate de nuevo con tu teléfono.',
  invalid_phone: 'El teléfono debe tener 10 dígitos.',
  invalid_name: 'Escribe tu nombre.',
  invalid_address: 'Escribe tu dirección.',
  consent_required: 'Debes autorizar el tratamiento de datos para continuar.',
  empty_order: 'Tu pedido está vacío.',
  invalid_qty: 'Cantidad inválida.',
  product_unavailable: 'Uno de los productos ya no está disponible. Revisa tu pedido.',
  too_many_items: 'Demasiados productos en un pedido.',
  invalid_key: 'Este código no es válido. Escanea el QR o tag oficial de Ámbar.',
  reward_unavailable: 'Ese premio ya no está disponible.',
  not_enough_stars: 'Aún no tienes estrellas suficientes.',
  invalid_password: 'Contraseña incorrecta.',
  too_many_attempts: 'Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo.',
  phone_in_use: 'Este teléfono ya tiene una Tarjeta Ámbar. Escribe el mismo nombre con el que te registraste.',
  password_too_short: 'La nueva contraseña debe tener al menos 4 caracteres.',
  unauthorized: 'Tu sesión de administrador expiró.',
  network: 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return MESSAGES[e.code] ?? 'Ocurrió un error. Inténtalo de nuevo.'
  return 'Ocurrió un error. Inténtalo de nuevo.'
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  let res
  try {
    res = await supabase.rpc(fn, args)
  } catch {
    throw new ApiError('network')
  }
  if (res.error) {
    const msg = res.error.message ?? ''
    throw new ApiError(MESSAGES[msg] ? msg : msg.includes('fetch') ? 'network' : msg || 'unknown')
  }
  return res.data as T
}

export const api = {
  getPublicData: () => rpc<PublicData>('get_public_data'),
  register: (name: string, address: string, phone: string, consent: boolean) =>
    rpc<{ token: string; customer: Customer }>('register_customer', {
      p_name: name, p_address: address, p_phone: phone, p_consent: consent,
    }),
  getMyCard: (token: string) => rpc<Customer>('get_my_card', { p_token: token }),
  placeOrder: (token: string, items: { product_id: string; qty: number }[], notes: string) =>
    rpc<OrderSummary>('place_order', { p_token: token, p_items: items, p_notes: notes }),
  armRedeem: (token: string, rewardId: string | null) =>
    rpc<Customer>('arm_redeem', { p_token: token, p_reward_id: rewardId }),
  claimStar: (token: string, key: string) => rpc<ClaimResult>('claim_star', { p_token: token, p_key: key }),

  admin: {
    // La RPC devuelve null con contraseña incorrecta (así el intento fallido queda registrado en la BD).
    login: async (password: string) => {
      const token = await rpc<string | null>('admin_login', { p_password: password })
      if (!token) throw new ApiError('invalid_password')
      return token
    },
    logout: (t: string) => rpc<void>('admin_logout', { p_token: t }),
    get: (t: string) => rpc<AdminData>('admin_get', { p_token: t }),
    orders: (t: string, limit = 150) => rpc<AdminOrder[]>('admin_orders', { p_token: t, p_limit: limit }),
    setOrderStatus: (t: string, id: string, status: AdminOrder['status']) =>
      rpc<void>('admin_set_order_status', { p_token: t, p_id: id, p_status: status }),
    customers: (t: string) => rpc<AdminCustomer[]>('admin_customers', { p_token: t }),
    adjustStars: (t: string, customerId: string, delta: number) =>
      rpc<Customer>('admin_adjust_stars', { p_token: t, p_customer: customerId, p_delta: delta }),
    upsert: <T,>(t: string, table: 'menus' | 'categories' | 'products' | 'rewards', row: Record<string, unknown>) =>
      rpc<T>('admin_upsert', { p_token: t, p_table: table, p_row: row }),
    remove: (t: string, table: 'menus' | 'categories' | 'products' | 'rewards', id: string) =>
      rpc<void>('admin_delete', { p_token: t, p_table: table, p_id: id }),
    saveSettings: (t: string, data: Settings) => rpc<Settings>('admin_save_settings', { p_token: t, p_data: data }),
    changePassword: (t: string, oldPw: string, newPw: string) =>
      rpc<void>('admin_change_password', { p_token: t, p_old: oldPw, p_new: newPw }),
  },
}

/** Convierte una imagen a WebP (máx. 1600 px) en el navegador. Videos y GIF se suben tal cual. */
async function toWebp(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob>((ok, fail) =>
    canvas.toBlob((b) => (b ? ok(b) : fail(new Error('webp'))), 'image/webp', 0.82),
  )
}

/** Sube un archivo al bucket `media` usando la sesión admin (validada por política de storage). */
export async function uploadImage(adminToken: string, file: File): Promise<string> {
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-admin-token': adminToken } },
  })
  const blob = await toWebp(file)
  const ext = blob.type === 'image/webp' ? 'webp' : (file.name.split('.').pop() ?? 'bin')
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await client.storage.from('media').upload(path, blob, {
    contentType: blob.type || file.type, cacheControl: '31536000',
  })
  if (error) throw new ApiError(error.message.includes('security') ? 'unauthorized' : 'upload_failed')
  return client.storage.from('media').getPublicUrl(path).data.publicUrl
}
