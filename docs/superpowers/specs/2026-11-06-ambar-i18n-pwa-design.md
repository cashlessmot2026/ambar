# Ámbar PWA — Multi-idioma y PWA adaptativa (Apple / Android)

Fecha: 2026-11-06 · Estado: diseño aprobado en chat, pendiente revisión del documento
Base: `docs/superpowers/specs/2026-11-06-ambar-pwa-design.md`

## 1. Objetivo

1. Toda la app pública se puede usar en 10 idiomas: español (base), inglés, alemán, ruso, portugués de Brasil, italiano, francés, mandarín (chino simplificado), coreano y árabe (RTL).
2. La PWA se instala y se comporta como app nativa en iPhone, iPad y Android, y se adapta a teléfono (vertical y horizontal), tablet y escritorio.

Fuera de alcance: traducir el panel admin (sigue en español), traducción automática por API, cambiar la moneda (los precios siguen en COP, `$35.000`).

## 2. Idiomas

| Código app | Idioma | Detecta también | Dirección |
|---|---|---|---|
| `es` | Español | `es-*` | ltr |
| `en` | English | `en-*` | ltr |
| `de` | Deutsch | `de-*` | ltr |
| `ru` | Русский | `ru-*` | ltr |
| `pt` | Português (Brasil) | `pt-*` | ltr |
| `it` | Italiano | `it-*` | ltr |
| `fr` | Français | `fr-*` | ltr |
| `zh` | 中文 | `zh-*` | ltr |
| `ko` | 한국어 | `ko-*` | ltr |
| `ar` | العربية | `ar-*` | rtl |

- Primera visita: se toma el primer idioma de `navigator.languages` que esté en la tabla; si ninguno, `es`.
- Selector 🌐 en la barra superior (todas las pantallas públicas) que abre una hoja con los 10 idiomas en su propio nombre. La elección se guarda en `localStorage` (`ambar:lang`) y tiene prioridad sobre la detección.
- Al cambiar de idioma: `<html lang>` y `<html dir>` se actualizan; no se recarga la página.

## 3. Textos de la interfaz

- Diccionario por idioma en `src/i18n/locales/<code>.ts`. `es.ts` define las claves; los demás se tipan contra él (`Record<keyof typeof es, string>`), así que falta una clave = error de compilación. Una prueba también verifica en ejecución que ningún valor esté vacío.
- `t(key, vars?)` con interpolación `{name}`; si una clave faltara en tiempo de ejecución, usa español.
- Se traducen: navegación, landing, menú, carrito, registro (incluido el texto de autorización de datos), gracias/reseñas, tarjeta, escaneo de estrellas, mensajes de error de `api.ts`, instalación de la app y la política de datos (con nota: "en caso de diferencia prevalece la versión en español").
- El mensaje de WhatsApp al restaurante sigue en español y agrega la línea `Idioma del cliente: <nombre del idioma en español>`.

## 4. Contenido de la base de datos

- Nueva columna `i18n jsonb not null default '{}'` en `menus`, `categories`, `products` y `rewards`. Forma: `{"en": {"name": "...", "description": "..."}, "ar": {...}}` (en menús también `subtitle`).
- `settings.data.i18n`: `{"en": {"landing": {"headline", "subheadline"}, "business": {"tagline", "location", "award"}}}`.
- `get_public_data()` y `admin_get()` devuelven `i18n`. `admin_upsert` ya acepta la columna (lista de columnas dinámica).
- Cliente: `localized(obj, field, lang)` devuelve `obj.i18n?.[lang]?.[field]` o el valor en español si falta o está vacío.
- Migración `006_i18n.sql`: agrega columnas y carga las traducciones de los 98 productos, 20 categorías, 2 menús, el premio inicial y los textos del landing en los 9 idiomas. Las traducciones se emparejan por nombre en español (`menus.slug` + `categories.name` + `products.name`). Los nombres propios (Barkhu, Rib eye, Tomahawk, Baby beef, Mounster, Smoked, House, Mojito, Margarita, marcas de cerveza/gaseosa) no se traducen; sí sus descripciones.
- Panel admin: en el editor de producto, categoría, menú, premio y página aparece una fila de pestañas `ES · EN · DE · RU · PT · IT · FR · 中文 · 한국어 · عربي`; cada pestaña edita los campos traducibles de ese idioma. Las pestañas con texto vacío muestran un punto indicando "usa español".

## 5. Escrituras y RTL

- Fuentes: títulos Montserrat / cuerpo Inter (cubren latín y cirílico). Respaldo por escritura en la pila CSS: `"PingFang SC", "Noto Sans SC"` (zh), `"Apple SD Gothic Neo", "Noto Sans KR"` (ko), `"Noto Sans Arabic"` (ar, cargada desde Google Fonts solo cuando el idioma es árabe).
- En `zh`, `ko` y `ar` se desactivan `text-transform: uppercase` y el `letter-spacing` de títulos y botones (`:root:lang(zh|ko|ar)`).
- RTL: el CSS usa propiedades lógicas (`margin-inline-start`, `inset-inline-start`, `text-align: start`, etc.). En `dir="rtl"`: flechas invertidas, barra lateral de escritorio a la derecha, deslizar-para-borrar del carrito invertido, carruseles horizontales empiezan por la derecha. Números y precios se mantienen con dígitos occidentales.

## 6. PWA adaptativa

### iOS / iPadOS
- Pantallas de arranque `apple-touch-startup-image` para los tamaños de iPhone (SE → 17 Pro Max) e iPad (mini → Pro 13") en vertical y horizontal, generadas por `scripts/process_assets.py` (fondo `#0E0E10` + logo centrado).
- `apple-mobile-web-app-capable`, `mobile-web-app-capable`, `apple-mobile-web-app-title=Ámbar`, `apple-mobile-web-app-status-bar-style=black-translucent`.
- Áreas seguras: barra superior con `padding-top: env(safe-area-inset-top)`, barra inferior/hojas con `env(safe-area-inset-bottom)`, laterales con `env(safe-area-inset-left/right)` en horizontal.
- Inputs con `font-size: 16px` mínimo (evita el zoom automático de Safari).
- Guía de instalación: si es iOS/iPadOS en Safari y no está en modo `standalone`, aparece (una vez, se puede cerrar y no vuelve en 14 días) una tarjeta inferior "Instala Ámbar: toca Compartir ⬆︎ y luego Agregar a inicio", traducida.

### Android
- Manifest: `id`, `display: standalone`, `orientation: any`, `categories: ["food","lifestyle"]`, iconos `any` + `maskable` + `monochrome` (iconos temáticos Android 13+).
- `shortcuts`: Menú (`./#/menu`), Pedido (`./#/pedido`), Tarjeta (`./#/tarjeta`) con iconos 96px.
- `screenshots`: 2 verticales (`form_factor: narrow`) y 1 horizontal (`wide`) generadas desde la app, para la ficha de instalación enriquecida.
- Botón "Instalar app" existente con `beforeinstallprompt`.
- Vibración corta (`navigator.vibrate(15)`) al agregar al carrito y al ganar estrella, solo si el dispositivo la soporta y el usuario no pidió movimiento reducido.

### Diseños por dispositivo
- Teléfono vertical: actual. Teléfono horizontal (`max-height: 500px`): hero más bajo, barra inferior compacta.
- Tablet (≥ 768px): grilla de productos de 3 columnas, tarjeta de fidelización centrada con premios al lado, hojas modales centradas.
- Escritorio (≥ 1024px): barra lateral (ya existe) y grilla de 4 columnas.

## 7. Pruebas

- Vitest: detección de idioma (`pt-PT→pt`, `zh-TW→zh`, `ar-EG→ar`, `xx→es`, preferencia guardada gana); `t()` interpola y cae a español; todas las claves de los 10 diccionarios no vacías; `localized()` con traducción, vacía y ausente; WhatsApp incluye "Idioma del cliente".
- SQL (`rpc_test.sql`): `get_public_data` devuelve `i18n` en productos; `admin_upsert` guarda `i18n`.
- Navegador (Playwright): capturas en `ar` (RTL), `zh`, `en` en viewport iPhone; iPad horizontal; Android; verificar `<html dir="rtl">` y que la guía iOS aparece solo con user-agent de iPhone Safari.
- Verificación final en GitHub Pages tras el despliegue.

## 8. Entrega

Mismo flujo: commits en rama, revisión final independiente, merge a `main`; el workflow de GitHub Pages publica automáticamente en https://cashlessmot2026.github.io/ambar/.
