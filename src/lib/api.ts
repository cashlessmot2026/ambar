import { createClient } from '@supabase/supabase-js'
import { SUPABASE_KEY, SUPABASE_URL, supabase } from './supabase'
import type {
  AdminCustomer, AdminData, AdminOrder, AiReply, ClaimResult, Coords, Customer, OrderLine, OrderStatus, OrderSummary,
  PublicData, RegisterInput, Reservation, ReservationInput, Settings, Survey, SurveyResults,
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
  ordering_disabled: 'Los pedidos por la app están desactivados.',
  phone_in_use:'Este teléfono ya tiene una Tarjeta Ámbar. Escribe el mismo nombre con el que te registraste.',
  password_too_short: 'La nueva contraseña debe tener al menos 4 caracteres.',
  invalid_survey: 'La encuesta no es válida. Califica todas las preguntas.',
  unauthorized: 'Tu sesión de administrador expiró.',
  network: 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
  invalid_email: 'Escribe un correo válido.',
  invalid_pin: 'El PIN debe tener 4 dígitos.',
  invalid_pin_old: 'El PIN actual no es correcto.',
  invalid_birthday: 'Revisa la fecha de cumpleaños.',
  invalid_location: 'No pudimos leer tu ubicación.',
  invalid_credentials: 'Correo/teléfono o PIN incorrectos.',
  account_exists: 'Este teléfono ya tiene cuenta. Inicia sesión con tu PIN.',
  email_in_use: 'Este correo ya está registrado. Inicia sesión.',
  invalid_datetime: 'Elige una fecha y hora futuras.',
  invalid_people: 'Número de personas inválido.',
  invalid_babies: 'Indica si vienes con bebés.',
  invalid_status: 'Estado inválido.',
  invalid_item: 'Revisa los productos del pedido.',
  reservation_closed: 'Esta reserva ya no admite cambios.',
  not_found: 'Ya no existe. Actualiza la lista.',
  email_not_configured: 'El correo no está configurado en Supabase (faltan GMAIL_USER / GMAIL_APP_PASSWORD).',
  smtp_failed: 'Gmail rechazó el envío. Revisa GMAIL_USER y la contraseña de aplicación.',
  already_sent: 'Ese correo ya se envió.',
  not_confirmed: 'La reserva debe estar confirmada para enviar el correo.',
  ai_not_configured: 'El mesero IA no está configurado (falta GEMINI_API_KEY).',
  ai_failed: 'El mesero IA no respondió. Inténtalo de nuevo.',
}

/** Llama una Edge Function y convierte su { error } en ApiError. */
async function fn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  let res
  try {
    res = await supabase.functions.invoke(name, { body })
  } catch {
    throw new ApiError('network')
  }
  if (res.error) {
    let code = 'unknown'
    const ctx = (res.error as { context?: Response }).context
    try { code = (await ctx?.json())?.error ?? code } catch { /* cuerpo no JSON */ }
    if (code === 'unknown' && res.error.name === 'FunctionsFetchError') code = 'network'
    throw new ApiError(code)
  }
  return res.data as T
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
  registerAccount: (i: RegisterInput) =>
    rpc<{ token: string; customer: Customer }>('register_account', {
      p_name: i.name, p_email: i.email, p_phone: i.phone, p_birthday: i.birthday, p_address: i.address,
      p_pin: i.pin, p_consent: i.consent, p_lat: i.coords?.lat ?? null, p_lng: i.coords?.lng ?? null,
    }),
  /** Login con correo o teléfono + PIN. La RPC devuelve null si no coinciden. */
  login: async (login: string, pin: string) => {
    const res = await rpc<{ token: string; customer: Customer } | null>('customer_login', { p_login: login, p_pin: pin })
    if (!res) throw new ApiError('invalid_credentials')
    return res
  },
  logout: (token: string) => rpc<void>('customer_logout', { p_token: token }),
  updateProfile: (
    token: string,
    p: { name: string; email: string; address: string; birthday: string | null },
    gps: { mode: 'keep' } | { mode: 'clear' } | { mode: 'set'; coords: Coords },
  ) =>
    rpc<Customer>('update_my_profile', {
      p_token: token, p_name: p.name, p_email: p.email, p_address: p.address, p_birthday: p.birthday || null,
      p_gps: gps.mode, p_lat: gps.mode === 'set' ? gps.coords.lat : null, p_lng: gps.mode === 'set' ? gps.coords.lng : null,
    }),
  setPin: (token: string, oldPin: string, newPin: string) =>
    rpc<Customer>('set_my_pin', { p_token: token, p_old: oldPin, p_new: newPin }),
  myOrders: (token: string) => rpc<OrderSummary[]>('my_orders', { p_token: token, p_limit: 30 }),
  myReservations: (token: string) => rpc<Reservation[]>('my_reservations', { p_token: token }),
  getMyCard: (token: string) => rpc<Customer>('get_my_card', { p_token: token }),
  placeOrder: (token: string, items: { product_id: string; qty: number }[], notes: string, coords: Coords | null = null) =>
    rpc<OrderSummary>('place_order', {
      p_token: token, p_items: items, p_notes: notes, p_lat: coords?.lat ?? null, p_lng: coords?.lng ?? null,
    }),
  createReservation: (r: ReservationInput, token: string | null) =>
    rpc<{ reservation: Reservation; key: string }>('create_reservation', {
      p_name: r.name, p_phone: r.phone, p_email: r.email, p_reserved_at: r.reserved_at, p_people: r.people,
      p_babies: r.babies, p_notes: r.notes, p_token: token,
    }),
  setReservationDishes: (id: string, key: string, items: { product_id: string; qty: number }[]) =>
    rpc<Reservation>('reservation_set_dishes', { p_id: id, p_key: key, p_items: items }),
  /** Correo "reserva recibida" al cliente (Edge Function reservation-email). */
  reservationReceivedEmail: (id: string, key: string) => fn<{ ok: true }>('reservation-email', { id, kind: 'received', key }),
  askWaiter: (messages: { role: 'user' | 'model'; text: string }[], cart: { product_id: string; qty: number }[], lang: string) =>
    fn<AiReply>('mesero-ia', { messages, cart, lang }),
  armRedeem: (token: string, rewardId: string | null) =>
    rpc<Customer>('arm_redeem', { p_token: token, p_reward_id: rewardId }),
  submitSurvey: (answers: { id: string; text: string; rating: number }[], comment: string) =>
    rpc<void>('submit_survey', { p_answers: answers, p_comment: comment }),
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
    setOrderStatus: (t: string, id: string, status: OrderStatus) =>
      rpc<void>('admin_set_order_status', { p_token: t, p_id: id, p_status: status }),
    updateOrder: (t: string, id: string, items: OrderLine[], notes: string) =>
      rpc<OrderSummary>('admin_update_order', { p_token: t, p_id: id, p_items: items, p_notes: notes }),
    deleteOrder: (t: string, id: string) => rpc<void>('admin_delete_order', { p_token: t, p_id: id }),
    reservations: (t: string) => rpc<Reservation[]>('admin_reservations', { p_token: t, p_limit: 300 }),
    updateReservation: (t: string, id: string, row: Partial<Omit<Reservation, 'id'>>) =>
      rpc<Reservation>('admin_update_reservation', { p_token: t, p_id: id, p_row: row }),
    deleteReservation: (t: string, id: string) => rpc<void>('admin_delete_reservation', { p_token: t, p_id: id }),
    /** Correo de confirmación al cliente (Edge Function reservation-email). */
    reservationConfirmedEmail: (t: string, id: string) =>
      fn<{ ok: true }>('reservation-email', { id, kind: 'confirmed', admin_token: t }),
    customers: (t: string) => rpc<AdminCustomer[]>('admin_customers', { p_token: t }),
    adjustStars: (t: string, customerId: string, delta: number) =>
      rpc<Customer>('admin_adjust_stars', { p_token: t, p_customer: customerId, p_delta: delta }),
    upsert: <T,>(t: string, table: 'menus' | 'categories' | 'products' | 'rewards', row: Record<string, unknown>) =>
      rpc<T>('admin_upsert', { p_token: t, p_table: table, p_row: row }),
    remove: (t: string, table: 'menus' | 'categories' | 'products' | 'rewards', id: string) =>
      rpc<void>('admin_delete', { p_token: t, p_table: table, p_id: id }),
    saveSettings: (t: string, data: Settings) => rpc<Settings>('admin_save_settings', { p_token: t, p_data: data }),
    /** Activa o desactiva los pedidos por la app (modo solo menú). Solo cambia esa clave de settings. */
    setOrdering: (t: string, enabled: boolean) => rpc<Settings>('admin_set_ordering', { p_token: t, p_enabled: enabled }),
    setSurvey: (t: string, data: Survey) => rpc<Settings>('admin_set_survey', { p_token: t, p_data: data }),
    surveyResults: (t: string, limit = 50) => rpc<SurveyResults>('admin_survey_results', { p_token: t, p_limit: limit }),
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
