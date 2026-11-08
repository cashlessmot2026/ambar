// Edge Function: correo de reserva (recibida / confirmada) enviado desde el Gmail del restaurante.
//
// Secretos necesarios (supabase secrets set ...):
//   GMAIL_USER          la cuenta de Gmail del restaurante (ej. ambarrestaurante@gmail.com)
//   GMAIL_APP_PASSWORD  contraseña de aplicación de 16 caracteres de esa cuenta
//   MAIL_FROM_NAME      nombre que ve el cliente como remitente (por defecto "Ámbar Restaurante")
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase automáticamente.
//
// Body: { id, kind: 'received', key }            → lo llama el cliente justo después de reservar
//       { id, kind: 'confirmed', admin_token }   → lo llama el panel al aceptar la reserva
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import nodemailer from 'npm:nodemailer@6.9.16'
import { corsHeaders, json } from '../_shared/cors.ts'

interface Dish { name: string; qty: number; price: number }
interface Reservation {
  id: string; number: number; name: string; phone: string; email: string; reserved_at: string
  people: number; babies: boolean; notes: string | null; dishes: Dish[]; dishes_total: number; status: string
}

const TZ = 'America/Bogota'
const cop = (n: number) => '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function when(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function render(r: Reservation, kind: 'received' | 'confirmed', business: { name: string; location: string; whatsapp: string; maps: string }) {
  const title = kind === 'confirmed' ? '¡Tu reserva está confirmada!' : 'Recibimos tu solicitud de reserva'
  const intro = kind === 'confirmed'
    ? `Hola ${r.name}, te esperamos en ${business.name}. Estos son los detalles de tu reserva:`
    : `Hola ${r.name}, gracias por elegirnos. Tu reserva quedó registrada y te escribiremos en cuanto la confirmemos.`
  const rows: [string, string][] = [
    ['Reserva', `#${r.number}`],
    ['Fecha y hora', when(r.reserved_at)],
    ['Personas', String(r.people)],
    ['Con bebés', r.babies ? 'Sí' : 'No'],
    ['Teléfono', r.phone],
  ]
  if (r.notes) rows.push(['Notas', r.notes])
  const dishes = r.dishes?.length
    ? `<h3 style="margin:24px 0 8px;font-size:15px;color:#d4a24c">Platos elegidos</h3>
       <table style="width:100%;border-collapse:collapse;font-size:14px">${r.dishes.map((d) =>
         `<tr><td style="padding:4px 0">${d.qty}× ${esc(d.name)}</td><td style="padding:4px 0;text-align:right">${cop(d.qty * d.price)}</td></tr>`).join('')}
         <tr><td style="padding:8px 0;border-top:1px solid #333"><strong>Total estimado</strong></td>
             <td style="padding:8px 0;border-top:1px solid #333;text-align:right"><strong>${cop(r.dishes_total)}</strong></td></tr>
       </table>`
    : ''
  const html = `<!doctype html><html><body style="margin:0;background:#0f0f0f;font-family:Arial,Helvetica,sans-serif;color:#eee">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="text-align:center;font-size:22px;letter-spacing:.2em;color:#d4a24c;font-weight:bold">${esc(business.name.toUpperCase())}</div>
    <div style="background:#1a1a1a;border:1px solid #2c2c2c;border-radius:16px;padding:24px;margin-top:20px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#fff">${title}</h2>
      <p style="margin:0 0 18px;color:#bbb;font-size:14px;line-height:1.5">${esc(intro)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([k, v]) =>
        `<tr><td style="padding:6px 0;color:#999;width:40%">${k}</td><td style="padding:6px 0;color:#fff">${esc(v)}</td></tr>`).join('')}</table>
      ${dishes}
    </div>
    <p style="text-align:center;color:#999;font-size:13px;margin-top:20px;line-height:1.6">
      ${esc(business.location)}<br/>
      ${business.maps ? `<a href="${esc(business.maps)}" style="color:#d4a24c">Cómo llegar</a> · ` : ''}
      <a href="https://api.whatsapp.com/send?phone=${business.whatsapp}" style="color:#d4a24c">WhatsApp</a>
    </p>
  </div></body></html>`
  const text = [title, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(r.dishes?.length ? ['', 'Platos elegidos:', ...r.dishes.map((d) => `- ${d.qty}x ${d.name} ${cop(d.qty * d.price)}`), `Total estimado: ${cop(r.dishes_total)}`] : []),
    '', business.location].join('\n')
  const subject = kind === 'confirmed'
    ? `Reserva confirmada #${r.number} · ${business.name}`
    : `Recibimos tu reserva #${r.number} · ${business.name}`
  return { subject, html, text }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const user = Deno.env.get('GMAIL_USER')
  const pass = Deno.env.get('GMAIL_APP_PASSWORD')?.replace(/\s+/g, '')
  if (!user || !pass) return json({ error: 'email_not_configured' }, 500)

  let body: { id?: string; kind?: string; key?: string; admin_token?: string }
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }
  const kind = body.kind === 'confirmed' ? 'confirmed' : body.kind === 'received' ? 'received' : null
  if (!body.id || !kind) return json({ error: 'bad_request' }, 400)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })
  const { data: r, error } = await db.rpc('_reservation_email_data', {
    p_id: body.id, p_kind: kind, p_key: body.key ?? null, p_admin_token: body.admin_token ?? null,
  })
  if (error) {
    const code = error.message || 'error'
    return json({ error: code }, code === 'unauthorized' ? 401 : code === 'already_sent' ? 409 : 400)
  }

  const { data: pub } = await db.rpc('get_public_data')
  const s = pub?.settings ?? {}
  const business = {
    name: Deno.env.get('MAIL_FROM_NAME') || 'Ámbar Restaurante',
    location: s.business?.location ?? '',
    whatsapp: String(s.contact?.whatsapp ?? '573229089680').replace(/\D/g, ''),
    maps: s.contact?.maps_url ?? '',
  }
  const mail = render(r as Reservation, kind, business)

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass },
  })
  try {
    await transport.sendMail({
      from: { name: business.name, address: user },
      replyTo: { name: business.name, address: user },
      to: (r as Reservation).email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    })
  } catch (e) {
    console.error('smtp', e)
    return json({ error: 'smtp_failed' }, 502)
  }
  await db.rpc('_reservation_email_sent', { p_id: body.id, p_kind: kind })
  return json({ ok: true })
})
