# Ámbar Steak House — PWA

App web instalable (PWA) de **Ámbar Steak House** (Punta Hansa, San Andrés): landing con video y galería, dos menús digitales priorizados por la hora, pedidos (panel + WhatsApp) que se pueden desactivar (modo solo menú), reseñas en Google y Tripadvisor, tarjeta de fidelización con estrellas por QR/NFC y panel de administración oculto.

Publicada en **https://cashlessmot2026.github.io/ambar/** (GitHub Pages; se despliega sola en cada push a `main` con `.github/workflows/deploy.yml`).

**Idiomas:** español, inglés, alemán, ruso, portugués (Brasil), italiano, francés, mandarín, coreano y árabe (de derecha a izquierda). Se detecta el idioma del teléfono y hay un selector 🌐.

## Stack

- React 19 + Vite + TypeScript, `react-router` (HashRouter)
- [Motion](https://motion.dev) para animaciones (`layoutId`, `AnimatePresence`, `drag`, `Reorder`)
- `vite-plugin-pwa` (instalable, funciona sin conexión para ver el menú)
- Supabase (Postgres + Storage) como único backend

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas unitarias (vitest)
npm run build      # genera dist/ para publicar en cualquier hosting estático con HTTPS
```

Rutas principales: `/#/` inicio · `/#/menu` · `/#/pedido` · `/#/tarjeta` · `/#/estrella?k=…` (QR/NFC) · `/#/privacidad`.

Panel admin: **`/#/ambar-admin`** (no está enlazado desde la app).

## Base de datos

Todas las tablas tienen RLS activo **sin políticas**: la llave publicable no puede leer ni escribir tablas. Todo pasa por funciones RPC `SECURITY DEFINER` que validan tokens en la base de datos:

- Clientes: token aleatorio (solo se guarda su hash SHA-256).
- Admin: contraseña con bcrypt; sesiones de 12 h. La contraseña nunca está en el código.
- Imágenes: bucket público `media`; solo se puede escribir con una sesión admin válida (cabecera `x-admin-token`).

Migraciones en `supabase/migrations` (aplicar en orden):

```bash
# Token personal de Supabase (https://supabase.com/dashboard/account/tokens). Nunca lo subas al repo.
export SUPABASE_ACCESS_TOKEN=sbp_...
export ADMIN_INITIAL_PASSWORD='tu-clave'   # obligatoria; solo se usa la primera vez que se crea admin_config

node scripts/db.mjs supabase/migrations/001_schema.sql
node scripts/db.mjs supabase/migrations/002_functions.sql
node scripts/db.mjs supabase/migrations/003_seed.sql     # ⚠️ recrea los menús 'desayuno' y 'ambar' (borra cambios hechos en el panel)
node scripts/db.mjs supabase/migrations/004_storage.sql
node scripts/db.mjs supabase/migrations/005_hardening.sql
node scripts/db.mjs supabase/migrations/006_i18n_ordering.sql
node scripts/db.mjs supabase/migrations/007_i18n_data.sql      # traducciones del menú (volver a aplicar si se reaplica 003)
node scripts/db.mjs supabase/migrations/008_review_fixes.sql
node scripts/db.mjs supabase/migrations/009_survey.sql           # encuesta de satisfacción
node scripts/db.mjs supabase/migrations/010_accounts_reservations.sql  # cuentas con PIN, reservas, tiempo real, Mesero IA

# Pruebas de las RPC (todo se revierte):
node scripts/db.mjs supabase/tests/rpc_test.sql --expect-error ALL_TESTS_PASSED
```

## Cuentas, reservas, alertas y Mesero IA (migración 010)

- **Cuentas**: registro con nombre, correo, teléfono, cumpleaños, dirección, PIN de 4 dígitos y GPS opcional. Login con correo **o** teléfono + PIN (bcrypt; 5 fallos en 15 min bloquean la cuenta, 20 la IP). La sesión queda guardada en el dispositivo hasta "Cerrar sesión". Los clientes antiguos (sin PIN) completan su cuenta registrándose con el mismo teléfono y nombre. Perfil e historial en `/cuenta`.
- **Pedidos**: guardan la ubicación GPS (si el cliente la comparte) y se ven en su perfil con el estado en vivo. En el panel se pueden editar, eliminar y pasar por `nuevo → preparando → en camino → entregado`. Al confirmar se genera la imagen del ticket y se abre WhatsApp con el texto.
- **Reservas** (`/reservar`, botón junto a "Ver menú"): obligatorios nombre, teléfono, correo, fecha/hora, personas y si vienen con bebés. Después se ofrece elegir platos en el menú y adjuntarlos a la reserva. Llegan al panel (pestaña Reservas) y al WhatsApp del restaurante.
- **Tiempo real**: la base de datos difunde un aviso sin datos personales por Supabase Realtime (`realtime.send`, canal público `ambar-admin` y `ambar-customer-<id>`); el panel suena y una voz dice "Tienes una nueva reserva" / "Tienes un nuevo pedido". Hay que tocar **Activar alertas** una vez por sesión (los navegadores bloquean el audio hasta un toque). Si Realtime falla, el panel consulta cada 20 s.

### Edge Functions

| Función | Qué hace | Secretos |
| --- | --- | --- |
| `reservation-email` | Correo "reserva recibida" (al reservar) y "reserva confirmada" (al aceptar en el panel), por SMTP de Gmail, remitente **Ámbar Restaurante** | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `MAIL_FROM_NAME` |
| `mesero-ia` | "Tu mesero IA" con Gemini: conoce toda la carta, sugiere adicionales y empuja el recomendado del día (rota a diario entre los 5 platos más costosos) | `GEMINI_API_KEY`, `GEMINI_MODEL` (opcional) |

```bash
# 1) Copia supabase/functions/.env.example a supabase/functions/.env (ignorado por git) y llénalo.
# 2) Sube los secretos y las funciones (la app usa la llave publicable, por eso --no-verify-jwt):
npx supabase login
npx supabase secrets set --env-file supabase/functions/.env --project-ref evfvcvllsjlakrpqmvdj
npx supabase functions deploy reservation-email --no-verify-jwt --project-ref evfvcvllsjlakrpqmvdj
npx supabase functions deploy mesero-ia --no-verify-jwt --project-ref evfvcvllsjlakrpqmvdj
```

Gmail solo envía desde la dirección `@gmail.com` de la cuenta; lo que ve el cliente como remitente es **"Ámbar Restaurante"**. Para que la dirección misma sea `@ambar...` hace falta un dominio propio (y un proveedor como Resend o Google Workspace).

## Traducciones

- **Textos de la app:** `src/i18n/locales/<idioma>.ts`. `es.ts` define las claves; si falta una en otro idioma, TypeScript no compila y una prueba lo detecta.
- **Platos, categorías, menús, premio y portada:** `supabase/i18n/<idioma>.json`, emparejados por el nombre en español. Después de editarlos:
  ```bash
  node scripts/build_i18n_sql.mjs                         # regenera 007_i18n_data.sql
  node scripts/db.mjs supabase/migrations/007_i18n_data.sql
  ```
- **Desde el panel:** Menús (selector de idioma + pestañas en cada producto), Premios y Página → *Traducciones de textos*. Lo que quede vacío se muestra en español.
- El mensaje de WhatsApp al restaurante siempre va en español e indica el idioma del cliente.

## Instalación en el teléfono

- **Android / Chrome:** botón *Instalar app* (ficha con capturas, accesos directos a Menú, Pedido y Tarjeta, ícono adaptable y monocromo).
- **iPhone / iPad (Safari):** aparece una guía *Compartir → Agregar a inicio*. Incluye pantallas de arranque para cada modelo (`public/splash/`, generadas por `scripts/process_assets.py`).

## Tarjeta de fidelización (QR / NFC)

1. Publica la app en su dominio final (HTTPS).
2. Entra a `/#/ambar-admin` → **QR / NFC**.
3. Descarga el PNG del QR e imprímelo.
4. Graba la misma URL en un tag NFC (NTAG213/215) con una app como *NFC Tools*: Escribir → URL.

Cada escaneo suma 1 estrella. Si el cliente toca **Canjear** en su tarjeta, el siguiente escaneo canjea el premio y sus estrellas vuelven a 0. Los premios y las estrellas necesarias se configuran en **Premios**.

## Assets

`python scripts/process_assets.py` regenera el logo transparente, los iconos PWA (incluidos monocromo y accesos directos), las pantallas de arranque de iOS y las imágenes del landing a partir de `logo.jpeg` y la carpeta `landing page/` (no incluida en el repo).
