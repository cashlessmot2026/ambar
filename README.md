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

# Pruebas de las RPC (todo se revierte):
node scripts/db.mjs supabase/tests/rpc_test.sql --expect-error ALL_TESTS_PASSED
```

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
