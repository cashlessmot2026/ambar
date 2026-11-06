# Ámbar Steak House — PWA

App web instalable (PWA) de **Ámbar Steak House** (Punta Hansa, San Andrés): landing con video y galería, dos menús digitales priorizados por la hora, pedidos (panel + WhatsApp), reseñas en Google y Tripadvisor, tarjeta de fidelización con estrellas por QR/NFC y panel de administración oculto.

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

# Pruebas de las RPC (todo se revierte):
node scripts/db.mjs supabase/tests/rpc_test.sql --expect-error ALL_TESTS_PASSED
```

## Tarjeta de fidelización (QR / NFC)

1. Publica la app en su dominio final (HTTPS).
2. Entra a `/#/ambar-admin` → **QR / NFC**.
3. Descarga el PNG del QR e imprímelo.
4. Graba la misma URL en un tag NFC (NTAG213/215) con una app como *NFC Tools*: Escribir → URL.

Cada escaneo suma 1 estrella. Si el cliente toca **Canjear** en su tarjeta, el siguiente escaneo canjea el premio y sus estrellas vuelven a 0. Los premios y las estrellas necesarias se configuran en **Premios**.

## Assets

`python scripts/process_assets.py` regenera el logo transparente, los iconos PWA y las imágenes del landing a partir de `logo.jpeg` y la carpeta `landing page/` (no incluida en el repo).
