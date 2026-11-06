// Ejecuta un archivo SQL en el proyecto Supabase vía Management API.
// Uso: SUPABASE_ACCESS_TOKEN=... node scripts/db.mjs <archivo.sql> [--expect-error TEXTO]
// Reemplaza {{ADMIN_INITIAL_PASSWORD}} con la variable de entorno ADMIN_INITIAL_PASSWORD (obligatoria si el SQL la usa).
import { readFileSync } from 'node:fs'

const PROJECT = 'evfvcvllsjlakrpqmvdj'
const [file, flag, expected] = process.argv.slice(2)
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!file || !token) {
  console.error('Uso: SUPABASE_ACCESS_TOKEN=... node scripts/db.mjs <archivo.sql> [--expect-error TEXTO]')
  process.exit(2)
}
let query = readFileSync(file, 'utf8')
if (query.includes('{{ADMIN_INITIAL_PASSWORD}}')) {
  const pw = process.env.ADMIN_INITIAL_PASSWORD
  if (!pw) {
    console.error('Define ADMIN_INITIAL_PASSWORD para crear la clave inicial del panel admin.')
    process.exit(2)
  }
  query = query.replaceAll('{{ADMIN_INITIAL_PASSWORD}}', pw.replaceAll("'", "''"))
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
})
const text = await res.text()
if (flag === '--expect-error') {
  if (text.includes(expected)) {
    console.log(`OK: ${expected}`)
    process.exit(0)
  }
  console.error(`FAIL: no se encontró "${expected}"\n${text}`)
  process.exit(1)
}
if (!res.ok) {
  console.error(`ERROR ${res.status}: ${text}`)
  process.exit(1)
}
console.log(text.length > 2000 ? text.slice(0, 2000) + '…' : text)
