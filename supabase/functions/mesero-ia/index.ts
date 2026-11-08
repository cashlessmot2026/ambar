// Edge Function: "Tu mesero IA" con Google Gemini.
//
// Secretos: GEMINI_API_KEY (obligatorio), GEMINI_MODEL (opcional, por defecto gemini-2.5-flash).
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.
//
// Body: { messages: [{ role: 'user' | 'model', text }], cart: [{ product_id, qty }], lang }
// Respuesta: { reply, products: [ids sugeridos], recommended: id del recomendado del día }
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { corsHeaders, json } from '../_shared/cors.ts'
import { dailyPick } from '../_shared/recommend.ts'

interface Product { id: string; name: string; description: string | null; price: number; featured: boolean }
interface Category { name: string; products: Product[] }
interface Menu { name: string; subtitle: string | null; start_time: string; end_time: string; categories: Category[] }

const LANG_NAMES: Record<string, string> = {
  es: 'español', en: 'English', de: 'Deutsch', ru: 'русский', pt: 'português do Brasil', it: 'italiano',
  fr: 'français', zh: '简体中文', ko: '한국어', ar: 'العربية',
}
const cop = (n: number) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

let cache: { at: number; menus: Menu[]; business: string } | null = null

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

  // Referencias cortas (p1, p2…) para que el modelo no invente IDs largos.
  const refs = new Map<string, Product>()
  const byId = new Map<string, string>()
  const all: Product[] = []
  const menuText = cache.menus.map((m) => {
    const cats = m.categories.map((c) => {
      const items = c.products.map((p) => {
        const ref = `p${refs.size + 1}`
        refs.set(ref, p)
        byId.set(p.id, ref)
        all.push(p)
        return `  - [${ref}] ${p.name} · ${cop(p.price)}${p.description ? ` · ${p.description.slice(0, 160)}` : ''}`
      })
      return ` ${c.name}:\n${items.join('\n')}`
    })
    return `MENÚ "${m.name}"${m.subtitle ? ` (${m.subtitle})` : ''} · disponible ${m.start_time}–${m.end_time}\n${cats.join('\n')}`
  }).join('\n\n')

  const pick = dailyPick(all)
  const cart = (body.cart ?? []).slice(0, 60)
    .map((i) => { const ref = byId.get(i.product_id); return ref ? `${i.qty}× [${ref}] ${refs.get(ref)!.name}` : null })
    .filter(Boolean)
  const lang = LANG_NAMES[body.lang ?? 'es'] ?? 'español'
  const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', weekday: 'long', hour: '2-digit', minute: '2-digit' })

  const system = `Eres "Tu mesero IA" de ${cache.business}, un steak house en San Andrés Isla, Colombia.
Hablas como un mesero cálido, elegante y breve (máximo 3 o 4 frases). Responde SIEMPRE en ${lang}.
Objetivo: ayudar a elegir y aumentar la venta de forma amable:
- Sugiere acompañamientos, bebidas, entradas o postres que combinen con lo que el cliente eligió o pregunta.
- Menciona con entusiasmo el RECOMENDADO DEL DÍA cuando sea natural${pick ? `: [${byId.get(pick.id)}] ${pick.name} (${cop(pick.price)})` : ''}.
- Solo puedes recomendar productos que estén en la carta de abajo, con su precio exacto. Nunca inventes platos, precios ni promociones.
- Si preguntan algo que no está en la carta (alergias, ingredientes no listados) di que lo confirme con el personal.
- No tomes pedidos tú mismo: invita a tocar "Agregar" en los productos sugeridos y luego confirmar en la pestaña Pedido.
Hora actual en la isla: ${now}. Ten en cuenta el horario de cada menú.
${cart.length ? `El cliente ya tiene en su pedido:\n${cart.join('\n')}` : 'El cliente aún no tiene productos en su pedido.'}

CARTA:
${menuText}

Responde en JSON: "reply" (texto para el cliente, sin las referencias [pN]) y "products" (las referencias pN que sugieres, máximo 4, en orden).`

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { reply: { type: 'STRING' }, products: { type: 'ARRAY', items: { type: 'STRING' } } },
          required: ['reply'],
        },
      },
    }),
  })
  if (!res.ok) {
    console.error('gemini', res.status, await res.text())
    return json({ error: 'ai_failed' }, 502)
  }
  const out = await res.json()
  const raw = out?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  let parsed: { reply?: string; products?: string[] } = {}
  try { parsed = JSON.parse(raw) } catch { parsed = { reply: raw } }
  const products = (parsed.products ?? [])
    .map((r) => refs.get(String(r).replace(/[[\]\s]/g, ''))?.id)
    .filter((id): id is string => !!id)
    .filter((id, i, a) => a.indexOf(id) === i)
    .slice(0, 4)
  const reply = String(parsed.reply ?? '').replace(/\s*\[p\d+\]\s*/g, ' ').trim()
  if (!reply) return json({ error: 'ai_failed' }, 502)
  return json({ reply, products, recommended: pick?.id ?? null })
})
