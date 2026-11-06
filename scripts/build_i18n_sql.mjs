// Genera supabase/migrations/007_i18n_data.sql a partir de supabase/i18n/<lang>.json.
// Uso: node scripts/build_i18n_sql.mjs
//
// Formato de cada JSON:
// {
//   "menus":      { "<slug>": { "name": "...", "subtitle": "..." } },
//   "categories": { "<nombre en español>": "<traducción>" },
//   "products":   { "<nombre en español>": ["<nombre traducido o ''>", "<descripción traducida (opcional)>"] },
//   "rewards":    { "<nombre en español>": ["<nombre>", "<descripción>"] },
//   "settings":   { "landing": { "headline": "...", "subheadline": "..." }, "business": { "tagline": "...", "location": "...", "award": "..." } }
// }
// Un nombre vacío '' significa "usar el nombre en español" (nombres propios).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'supabase/i18n'
const OUT = 'supabase/migrations/007_i18n_data.sql'
const q = (s) => `'${String(s).replaceAll("'", "''")}'`
const j = (o) => `${q(JSON.stringify(o))}::jsonb`

const pair = ([name, description]) => {
  const o = {}
  if (name) o.name = name
  if (description) o.description = description
  return o
}

const out = [
  '-- GENERADO por scripts/build_i18n_sql.mjs a partir de supabase/i18n/*.json. No editar a mano.',
  '-- Carga las traducciones del contenido. Se empareja por nombre en español (menús por slug).',
  'begin;',
]
const files = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort()
for (const f of files) {
  const lang = f.replace('.json', '')
  const d = JSON.parse(readFileSync(join(DIR, f), 'utf8'))
  out.push(`\n-- ${lang}`)
  for (const [slug, v] of Object.entries(d.menus ?? {}))
    out.push(`update menus set i18n = i18n || jsonb_build_object(${q(lang)}, ${j(v)}) where slug = ${q(slug)};`)
  for (const [name, v] of Object.entries(d.categories ?? {}))
    out.push(`update categories set i18n = i18n || jsonb_build_object(${q(lang)}, ${j({ name: v })}) where name = ${q(name)};`)
  for (const [name, v] of Object.entries(d.products ?? {})) {
    const o = pair(v)
    if (Object.keys(o).length) out.push(`update products set i18n = i18n || jsonb_build_object(${q(lang)}, ${j(o)}) where name = ${q(name)};`)
  }
  for (const [name, v] of Object.entries(d.rewards ?? {}))
    out.push(`update rewards set i18n = i18n || jsonb_build_object(${q(lang)}, ${j(pair(v))}) where name = ${q(name)};`)
  if (d.settings)
    out.push(
      `update settings set data = jsonb_set(data, '{i18n}', coalesce(data->'i18n', '{}'::jsonb) || jsonb_build_object(${q(lang)}, ${j(d.settings)}), true) where id = 1;`,
    )
}
out.push('commit;\n')
writeFileSync(OUT, out.join('\n'))
console.log(`${OUT}: ${files.length} idiomas, ${out.length} líneas`)
