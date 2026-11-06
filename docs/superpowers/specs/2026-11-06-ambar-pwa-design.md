# Ámbar Steak House — PWA (menú digital, pedidos y fidelización)

Fecha: 2026-11-06 · Estado: aprobado en chat, pendiente revisión del documento

## 1. Objetivo

PWA instalable para Ámbar Steak House (Punta Hansa, San Andrés) que:
- Presenta el negocio (landing con logo, video, fotos, redes).
- Muestra dos menús independientes (Desayuno y Ámbar) priorizados según la hora del dispositivo.
- Permite pedir solo a clientes registrados (nombre, dirección, teléfono + consentimiento de datos).
- Envía cada pedido al panel admin y por WhatsApp al restaurante; luego invita a dejar reseña.
- Ofrece tarjeta de fidelización con estrellas que se suman/canjean escaneando un QR o tag NFC fijo del negocio.
- Tiene un panel admin oculto (clave validada solo en base de datos) para editar todo.

Fuera de alcance: pagos en línea, hosting/despliegue (el código solo se sube a GitHub), notificaciones push.

## 2. Datos de negocio (valores iniciales, editables)

- Nombre: ÁMBAR STEAK HOUSE 🥩
- Chef: @aldaarizachef
- Ubicación: Punta Hansa, frente hotel Arena Blanca
- Logro: 🥇🏆 Island Burger 2024
- Música: @ambarmusicvibes
- Instagram: https://www.instagram.com/ambarsteakhouse_
- WhatsApp pedidos: +57 322 9089680 (`573229089680`)
- Reseña Google: `https://search.google.com/local/writereview?placeid=ChIJS8IK_uWvBY8RRvIb-KGKVzg` (abre el cuadro de reseña directamente)
- Reseña TripAdvisor: https://www.tripadvisor.co/Restaurant_Review-g297482-d27184355-Reviews-Ambar_Steak_House-San_Andres_Island_San_Andres_and_Providencia_Department.html

## 3. Stack

- React 18 + Vite + TypeScript, `react-router` con **HashRouter** (funciona en cualquier hosting estático sin reglas de reescritura; las URLs de QR/NFC son `https://<dominio>/#/estrella?k=<clave>`).
- `motion` (animaciones: `layoutId` + `AnimatePresence` para ampliar fotos, `drag`/`whileTap`/`whileHover` en tarjetas y botones). Se ejecuta `npx motion-ai` para instalar el AI Kit.
- `vite-plugin-pwa` (manifest, service worker, offline del menú, instalable).
- `@supabase/supabase-js` con URL `https://evfvcvllsjlakrpqmvdj.supabase.co` y llave publicable (es pública por diseño).
- `canvas-confetti` (fuegos artificiales), `qrcode` (QR imprimible en el panel).

## 4. Diseño visual

Basado en la referencia (dark + dorado):
- Colores por defecto: fondo `#0E0E10`, superficie `#18181B`, borde `#2A2A2E`, dorado `#D4A24C`, ámbar `#F08A24` (naranja de la carta), texto `#F5F5F4`, texto secundario `#A1A1AA`.
- Fuentes por defecto: Montserrat (títulos, 700–800, mayúsculas) + Inter (cuerpo). Cargadas desde Google Fonts; editables.
- Radios 16–24 px, botones tipo píldora con borde dorado o relleno dorado, chips circulares de categorías, barra inferior con 4 pestañas (Inicio, Menú, Pedido, Tarjeta).
- Colores y fuentes se aplican como variables CSS leídas de `settings`, así el admin los cambia sin redeploy.
- Logo: se procesa `logo.jpeg` a PNG con fondo transparente (trazos blancos sobre alfa) + iconos PWA 192/512/maskable.

## 5. Pantallas del cliente

1. **Inicio (landing)**: hero con el video en loop silenciado + logo; bloque de información del negocio; badge Island Burger 2024; carrusel de fotos (imágenes de `landing page/`, convertidas a WebP); botones Instagram y "Ver menú"; botón "Instalar app" cuando el navegador lo permita.
2. **Menú**: pestañas Desayuno / Ámbar. Orden por hora local del dispositivo: 04:00–10:59 → Desayuno primero; 11:00–03:59 → Ámbar primero (ventanas editables por menú en el panel). Chips de categoría, buscador, tarjetas de producto (foto, nombre, descripción, precio COP, botón agregar). Tocar foto → vista ampliada con `layoutId`; producto con varias imágenes → galería.
3. **Pedido (carrito)**: lista, cantidades, notas, total. Al confirmar: si no hay registro → modal de registro. Luego se guarda el pedido (RPC), se abre `wa.me/573229089680?text=<pedido formateado>` y se muestra pantalla de agradecimiento con botones de reseña Google y TripAdvisor.
4. **Registro**: nombre, dirección, teléfono (10 dígitos), casilla obligatoria "Autorizo el tratamiento de mis datos personales" con enlace al texto de la política (Ley 1581 de 2012, finalidad: gestión de pedidos y programa de fidelización; derechos de consultar, actualizar y suprimir; contacto WhatsApp del negocio). Si el teléfono ya existe, se recupera ese cliente (mismo teléfono = misma tarjeta).
5. **Tarjeta**: tarjeta tipo crédito (negro/dorado, logo, nombre, teléfono enmascarado parcialmente, chip decorativo) con fila de estrellas y barra de progreso hacia cada premio activo. Arrastrable/inclinable con `drag` + `dragSnapToOrigin`. Botón "Escanear QR" (usa la cámara vía URL; el tag NFC abre la misma URL). Si el cliente alcanza un premio, aparece "Canjear [premio]", que arma un canje pendiente.
6. **Ruta `/#/estrella?k=…`** (abierta por QR o NFC): si no hay registro → registro y luego continúa. Si hay canje pendiente → canjea el premio (estrellas se reinician a 0) y muestra celebración. Si no → suma 1 estrella y lanza fuegos artificiales. Sin límite de frecuencia (decisión del negocio); el panel muestra el historial para detectar abusos.

## 6. Panel admin

- Ruta oculta `/#/ambar-admin`, sin enlaces desde la app. La clave no existe en el código: se valida con la RPC `admin_login`. Clave inicial definida por el negocio al instalar (guardada como hash bcrypt, nunca en el repo); se puede cambiar desde el panel.
- Sesión: token aleatorio guardado en `sessionStorage`, hash en `admin_sessions`, expira a las 12 h.
- Secciones:
  - **Pedidos**: lista en vivo (polling cada 15 s), estados nuevo → preparando → entregado / cancelado.
  - **Clientes**: lista, estrellas, historial de escaneos y canjes, ajuste manual de estrellas.
  - **Premios**: crear/editar/activar premios, estrellas requeridas, imagen.
  - **Menús y productos**: CRUD de menús (nombre, ventana horaria), categorías y productos (nombre, descripción, precio, varias imágenes, activo, destacado, orden).
  - **Página**: textos del negocio, redes, enlaces de reseña, WhatsApp, imágenes y video del landing, colores, fuentes (lista de Google Fonts).
  - **QR / NFC**: muestra el QR fijo del negocio (descargable PNG) y la URL para grabar en el tag NFC. La clave es fija y no se rota.
  - **Seguridad**: cambiar contraseña.

## 7. Datos (Supabase, esquema `public`)

| Tabla | Campos clave |
|---|---|
| `settings` | `id=1`, `data jsonb` (negocio, redes, enlaces, colores, fuentes, landing) |
| `menus` | `id`, `slug`, `name`, `start_time`, `end_time`, `sort`, `active` |
| `categories` | `id`, `menu_id`, `name`, `sort` |
| `products` | `id`, `category_id`, `name`, `description`, `price int`, `images text[]`, `active`, `featured`, `sort` |
| `customers` | `id`, `name`, `address`, `phone unique`, `consent_at`, `consent_version`, `token_hash`, `stars int`, `pending_reward_id`, `created_at` |
| `rewards` | `id`, `name`, `description`, `stars_required`, `image`, `active` |
| `star_events` | `id`, `customer_id`, `kind ('earn','redeem','adjust')`, `delta`, `reward_id`, `created_at` |
| `orders` | `id`, `customer_id`, `items jsonb`, `total int`, `notes`, `status`, `created_at` |
| `admin_config` | `id=1`, `password_hash`, `business_key` |
| `admin_sessions` | `token_hash`, `expires_at` |

Semilla: los dos menús con todas sus categorías y productos tomados de los PDF (precios en COP), `settings` con los datos del punto 2, clave admin inicial (desde variable de entorno), `business_key` aleatoria fija.

## 8. Seguridad

- RLS activado en todas las tablas **sin políticas** para `anon`: la llave publicable no puede leer ni escribir tablas directamente.
- Todo acceso pasa por funciones `SECURITY DEFINER` con `search_path` fijo:
  - Públicas: `get_public_data()` (settings, menús, categorías, productos activos, premios activos), `register_customer(...)` → token, `get_my_card(token)`, `place_order(token, items, notes)` (recalcula precios en servidor), `claim_star(token, key)`, `arm_redeem(token, reward_id)`.
  - Admin: `admin_login(password)` → token de sesión; todas las demás `admin_*` reciben el token y lo validan primero.
- Tokens de cliente y admin: 32 bytes aleatorios; en BD solo se guarda su hash SHA-256.
- Imágenes: bucket público `media`. Subida permitida solo si la política de storage valida el encabezado `x-admin-token` contra `admin_sessions`; si el servicio de storage no expone los encabezados a Postgres, se usa una Edge Function `admin-upload` que valida el token y sube con la service role (la service role nunca sale del servidor).
- Nada sensible en `index.html` ni en el bundle: solo la URL y la llave publicable de Supabase.
- El token de acceso de Supabase solo se usa localmente para migraciones; nunca se guarda en el repo.

## 9. Errores y offline

- El service worker cachea la app y la última respuesta de `get_public_data` para ver el menú sin conexión; pedir y sumar estrellas requieren conexión (mensaje claro si falla).
- Mensajes de error amigables en español en registro, pedido, escaneo y panel.

## 10. Pruebas y verificación

- Vitest para la lógica pura: prioridad de menú por hora, formateo del pedido para WhatsApp, cálculo de progreso de premios.
- Pruebas SQL de las RPC contra el proyecto (registro, pedido, ganar/canjear estrella, login admin correcto/incorrecto, acceso directo a tablas con anon denegado).
- Verificación manual en navegador (móvil y escritorio) con Playwright: landing, menú, pedido → WhatsApp → reseñas, estrella con fuegos artificiales, panel admin.

## 11. Entrega

- `npm install motion && npx motion-ai` dentro del proyecto.
- Código en `https://github.com/cashlessmot2026/ambar` (repo público: sin secretos). Los PDF originales no se suben.
