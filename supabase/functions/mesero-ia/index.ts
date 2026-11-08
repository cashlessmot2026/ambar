// Edge Function: "Tu mesero IA" con Google Gemini.
//
// Secretos: GEMINI_API_KEY (obligatorio), GEMINI_MODEL (opcional; si falla se prueban gemini-3.6-flash,
// gemini-3.5-flash y gemini-3.1-flash-lite).
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.
//
// Body: { messages: [{ role: 'user' | 'model', text }], cart: [{ product_id, qty }], lang }
// Respuesta: { reply, products: [ids sugeridos], recommended: id del recomendado del día }
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

// Archivo autocontenido (sin imports locales) para poder pegarlo tal cual en el editor del dashboard.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } })

// <recommend> Copia exacta de src/lib/recommend.ts (un test verifica que sean iguales).
export interface PricedProduct { id: string; price: number; name: string }

export const POOL_SIZE = 5

/** Días desde 1970 en la hora de Colombia (UTC-5, sin horario de verano). */
export function bogotaDay(now: Date = new Date()): number {
  return Math.floor((now.getTime() - 5 * 3600_000) / 86_400_000)
}

export function dailyPick<T extends PricedProduct>(products: T[], now: Date = new Date()): T | null {
  const pool = [...products]
    .filter((p) => p.price > 0)
    .sort((a, b) => b.price - a.price || a.name.localeCompare(b.name))
    .slice(0, POOL_SIZE)
  if (!pool.length) return null
  return pool[bogotaDay(now) % pool.length]
}
// </recommend>

interface Product { id: string; name: string; description: string | null; price: number; featured: boolean }
interface Category { name: string; products: Product[] }
interface Menu { name: string; subtitle: string | null; start_time: string; end_time: string; categories: Category[] }

const LANG_NAMES: Record<string, string> = {
  es: 'español', en: 'English', de: 'Deutsch', ru: 'русский', pt: 'português do Brasil', it: 'italiano',
  fr: 'français', zh: '简体中文', ko: '한국어', ar: 'العربية',
}
const cop = (n: number) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

let cache: { at: number; menus: Menu[]; business: string } | null = null

/** Modelos rápidos probados en orden (nov. 2026: gemini-2.5-flash ya no está disponible para llaves nuevas). */
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'ai_not_configured' }, 500)

  let body: { messages?: { role: string; text: string }[]; cart?: { product_id: string; qty: number }[]; lang?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 800) }))
  if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'bad_request' }, 400)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()
  const { data: allowed } = await db.rpc('_ai_allow', { p_ip: ip })
  if (allowed === false) return json({ error: 'too_many_attempts' }, 429)

  if (!cache || Date.now() - cache.at > 5 * 60_000) {
    const { data, error } = await db.rpc('get_public_data')
    if (error) return json({ error: 'menu_unavailable' }, 502)
    cache = { at: Date.now(), menus: data.menus as Menu[], business: data.settings?.business?.name ?? 'Ámbar' }
  }

  // Hora de la isla: decide qué menús están abiertos ahora.
  const bogota = new Date(Date.now() - 5 * 3600_000)
  const hhmm = bogota.toISOString().slice(11, 16)
  const openNow = (m: Menu) => (m.start_time <= m.end_time
    ? hhmm >= m.start_time && hhmm <= m.end_time
    : hhmm >= m.start_time || hhmm <= m.end_time)

  // Referencias cortas (p1, p2…) para que el modelo no invente IDs largos.
  const refs = new Map<string, Product>()
  const byId = new Map<string, string>()
  const all: Product[] = []
  const menuText = cache.menus.map((m) => {
    const cats = m.categories.filter((c) => c.products.length).map((c) => {
      const items = c.products.map((p) => {
        const ref = `p${refs.size + 1}`
        refs.set(ref, p)
        byId.set(p.id, ref)
        all.push(p)
        return `  - [${ref}] ${p.name} — ${cop(p.price)}${p.featured ? ' ★destacado' : ''}${p.description ? ` — ${p.description.replace(/\s+/g, ' ').slice(0, 220)}` : ''}`
      })
      return ` ## ${c.name}\n${items.join('\n')}`
    })
    const state = openNow(m) ? 'ABIERTO AHORA' : 'CERRADO AHORA (solo se puede pedir en su horario)'
    return `# MENÚ "${m.name}"${m.subtitle ? ` (${m.subtitle})` : ''} · horario ${m.start_time}–${m.end_time} · ${state}\n${cats.join('\n')}`
  }).join('\n\n')

  const pick = dailyPick(all)
  const pickRef = pick ? byId.get(pick.id) : null
  const cart = (body.cart ?? []).slice(0, 60)
    .map((i) => { const ref = byId.get(i.product_id); return ref ? `${i.qty}× [${ref}] ${refs.get(ref)!.name}` : null })
    .filter(Boolean)
  const lang = LANG_NAMES[body.lang ?? 'es'] ?? 'español'
  const now = bogota.toLocaleString('es-CO', { timeZone: 'UTC', weekday: 'long', hour: '2-digit', minute: '2-digit' })
  const pickMentioned = !!pick && messages.some((m) => m.role === 'model' && m.text.toLowerCase().includes(pick.name.toLowerCase()))

  const system = `Eres el mesero estrella de ${cache.business}, steak house frente al mar en San Andrés Isla, Colombia.
Atiendes por chat a un cliente que mira la carta en su celular. Conoces cada plato de memoria y vendes con calidez, como en el salón.

IDIOMA: responde siempre en ${lang}, aunque la carta esté en español (traduce el nombre si ayuda, pero conserva el nombre original).

CÓMO RESPONDES (esto es lo más importante):
1. Siempre propones platos CONCRETOS de la carta: entre 2 y 3 opciones con su nombre exacto y precio, y una razón corta y antojable para cada una (corte, ahumado, tamaño, para cuántos).
2. Lees bien la intención: "para compartir" → picadas, entradas o platos grandes; "para 2" → porciones para compartir o dos fuertes; "algo ligero" → ensaladas o entradas; "bebidas/postres" → de esas categorías; "desayuno" → solo del menú de desayuno.
3. Vendes más con naturalidad: si eligió un fuerte, ofrece un acompañamiento o adición y una bebida que combine; si ya tiene fuerte y bebida, ofrece un postre. Nunca repitas lo que ya tiene en su pedido.
4. ${pick && !pickMentioned ? `Menciona una vez el RECOMENDADO DEL DÍA [${pickRef}] ${pick.name} (${cop(pick.price)}) como sugerencia del chef cuando encaje.` : 'Ya mencionaste el recomendado del día; no lo repitas salvo que pregunten.'}
5. Si un menú está CERRADO AHORA, no lo ofrezcas para pedir ya; puedes decir a qué hora abre.
6. Termina con UNA pregunta corta que ayude a decidir (punto del corte, para cuántas personas, si quiere bebida…).
7. Formato: texto plano, sin markdown ni asteriscos. Máximo ~90 palabras. Cada opción en su propia línea empezando con "• ".
8. Solo existe lo que está en la CARTA. Nunca inventes platos, precios, ingredientes, promociones ni tiempos de preparación. Si preguntan por alergias o ingredientes que no aparecen, sugiere confirmarlo con el personal.
9. No confirmas pedidos: el cliente toca "+" en las tarjetas que aparecen bajo tu mensaje y confirma en la pestaña Pedido.

Ahora en la isla es ${now}.
${cart.length ? `PEDIDO ACTUAL DEL CLIENTE:\n${cart.join('\n')}` : 'El cliente aún no tiene productos en su pedido.'}

CARTA (cada plato tiene una referencia [pN]):
${menuText}

SALIDA: un objeto JSON con
- "reply": el mensaje para el cliente (sin las referencias [pN]).
- "products": las referencias pN de TODOS los platos que mencionas en "reply", en el mismo orden (máximo 4).`

  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    generationConfig: {
      temperature: 0.6,
      // Los modelos Gemini 3 "piensan" antes de responder y eso gasta del mismo límite: con 600 la respuesta
      // llegaba cortada a la mitad. Se baja el razonamiento y se sube el límite.
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingLevel: 'low' },
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: { reply: { type: 'STRING' }, products: { type: 'ARRAY', items: { type: 'STRING' } } },
        required: ['reply', 'products'],
      },
    },
  })

  // Google retira modelos con frecuencia: se prueba el configurado y, si no existe o no responde a tiempo,
  // los siguientes de la lista.
  const models = [...new Set([Deno.env.get('GEMINI_MODEL'), ...FALLBACK_MODELS].filter((m): m is string => !!m))]
  let out: { candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[] } | null = null
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: payload,
        signal: AbortSignal.timeout(25_000),
      })
      if (res.ok) { out = await res.json(); break }
      const detail = await res.text()
      console.error('gemini', model, res.status, detail.slice(0, 300))
      // Llave inválida o sin cuota: otro modelo no lo arregla.
      if (res.status === 400 && /API key/i.test(detail)) break
      if (res.status === 401 || res.status === 403) break
    } catch (e) {
      console.error('gemini', model, 'timeout/red', String(e))
    }
  }
  if (!out) return json({ error: 'ai_failed' }, 502)
  const cand = out.candidates?.[0]
  if (cand?.finishReason && cand.finishReason !== 'STOP') console.error('gemini finishReason', cand.finishReason)
  // Se ignoran las partes de "pensamiento" del modelo.
  const raw = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('')
  const parsed = parseAnswer(raw)

  // Productos: los que el modelo listó; si no listó ninguno (JSON cortado), los que nombra en el texto
  // como opción ("• Nombre"), para no confundir ingredientes con platos.
  let ids = parsed.products.map((r) => refs.get(r.replace(/[[\]\s]/g, ''))?.id).filter((id): id is string => !!id)
  if (!ids.length) {
    const bullets = parsed.reply.split('\n').filter((l) => l.trim().startsWith('•')).map((l) => l.toLowerCase())
    ids = all.filter((p) => bullets.some((l) => l.includes(p.name.toLowerCase()))).map((p) => p.id)
  }
  const products = ids.filter((id, i, a) => a.indexOf(id) === i).slice(0, 4)

  const reply = parsed.reply
    .replace(/\s*\[p\d+\]/g, '')
    .replace(/\*\*?([^*]+)\*\*?/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
  if (!reply) return json({ error: 'ai_failed' }, 502)
  return json({ reply, products, recommended: pick?.id ?? null })
})

/** Lee {"reply","products"}; si el JSON llegó incompleto, rescata el texto de "reply" igual. */
function parseAnswer(raw: string): { reply: string; products: string[] } {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const j = JSON.parse(clean)
    return { reply: String(j.reply ?? ''), products: Array.isArray(j.products) ? j.products.map(String) : [] }
  } catch { /* JSON incompleto */ }
  const m = clean.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/s)
  const products = [...clean.matchAll(/"(p\d+)"/g)].map((x) => x[1])
  if (m) {
    let reply = m[1]
    try { reply = JSON.parse(`"${reply.replace(/\\$/, '')}"`) } catch { reply = reply.replace(/\\n/g, '\n').replace(/\\"/g, '"') }
    return { reply, products }
  }
  // No parece JSON: es texto directo.
  return { reply: clean.startsWith('{') ? '' : clean, products }
}
