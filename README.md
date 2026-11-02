# GastosDiarios

Gestor de **finanzas personales** _local-first_: una PWA que funciona **sin conexión**, **sin backend** y **sin paso de compilación**, con un **asistente de IA** que responde preguntas consultando tus propios datos.

**▶ Demo en vivo:** https://rubenvasq.github.io/Gastos-diarios/

> Tus datos nunca salen de tu dispositivo: todo se guarda en el navegador (IndexedDB). La primera vez carga en línea; después funciona offline.

---

## Qué hace

Gestión financiera completa en una sola app:

- **Inicio** — dashboard con balance total, resumen del mes (ingresos/gastos/ahorro), presupuesto, cuentas, análisis de gastos por categoría, actividad reciente y _insights_ automáticos. Organizado en pestañas (Resumen / Gastos / Actividad).
- **Cuentas** — banco, efectivo, ahorros, tarjeta, Nequi, Daviplata, PayPal, inversiones; crear/editar/eliminar y ajustar saldo.
- **Movimientos** — gastos (con **foto del recibo**), ingresos y transferencias (los saldos se ajustan solos); búsqueda, filtros, orden y paginación.
- **Presupuestos** — presupuesto mensual global y por categoría, con barras de avance y alertas.
- **Reportes** — ingresos vs gastos, evolución, gastos por cuenta, ahorro acumulado y **proyección anual**; exportar CSV/JSON e imprimir.
- **Metas**, **Deudas**, **Patrimonio** (activos − pasivos), **Calendario** mensual, **Recurrentes** (pagos fijos) y **Categorías** editables.
- **Asistente IA** — un agente que responde sobre tus finanzas usando _tool use_ sobre tus datos locales.
- **Privacidad** — PIN de bloqueo con auto-bloqueo y opción de ocultar montos.

---

## Decisiones de arquitectura

El objetivo era construir una app rica sin servidor ni tooling pesado. Las decisiones interesantes:

### Local-first con IndexedDB + caché síncrona
Toda la información vive en el navegador. La app **lee de una caché en memoria** y escribe _write-through_ a **IndexedDB** (`src/db.js`), lo que da lecturas síncronas y rápidas y, a la vez, persistencia muy por encima del límite de ~5 MB de `localStorage`. Si IndexedDB no está disponible, cae con elegancia a `localStorage` o memoria. La primera carga **copia** (no mueve) datos previos de `localStorage` a IndexedDB, sin perder nada.

### Sin paso de compilación, pero offline real
La UI es un único componente **Alpine.js** con utilidades **Tailwind**, iconos **Lucide** y gráficos **Chart.js**. Para no depender de un CDN en tiempo de ejecución, las librerías están **vendorizadas** en `/vendor`, así el _service worker_ puede cachearlas y la app funciona **100 % offline** tras la primera visita. Cero bundler, cero `node_modules` en producción.

### Vistas modulares cargadas en runtime
En lugar de un `index.html` monolítico, cada vista vive en su propio archivo (`/views/*.html`). `app.js` (`loadPartials`) las inyecta antes de arrancar Alpine, y la navegación es un **view-switcher** (`x-if`): solo la vista activa existe en el DOM. Mantiene el código ordenado sin introducir un framework de routing ni un build.

### El asistente de IA
El agente corre **en el navegador** con un bucle de _tool use_: el modelo pide herramientas (consultar gastos del mes, totales por categoría, etc.) y un **repository** (`src/agent/`) es la única pieza que sabe de dónde salen los datos, aislando el estado de la app del modelo. El proveedor del LLM es configurable por `baseURL`, y la clave de API se guarda **solo localmente** (nunca se envía a un servidor propio porque no hay ninguno).

### PWA
`manifest.webmanifest` + `sw.js` (cache-first con actualización en segundo plano). Instalable, con íconos _maskable_ y soporte de _safe-area_ para móvil.

---

## Desarrollo local

```bash
npm start      # sirve en http://localhost:3000 (npx serve)
```

Se necesita un servidor local (no abrir `index.html` con `file://`): `src/app.js` es un módulo ES y el _service worker_ solo se registra sobre `http(s)`.

Comprobación rápida de la lógica (sin navegador):

```bash
node smoke.mjs              # asserts sobre storage/stats/finance/export
node tests/agent-tools.smoke.mjs
```

---

## Estructura

```
├── index.html             # Shell: sidebar, topbar, modales, FAB; monta las vistas
├── views/                 # Una vista por archivo (inicio, cuentas, movimientos, …, config)
├── src/
│   ├── app.js             # Componente Alpine: estado, getters, acciones, gráficos, PWA/PIN
│   ├── db.js              # IndexedDB + caché write-through (almacén principal)
│   ├── storage.js         # Shape del estado, sanitización, factories, seeds
│   ├── migrations.js      # Migración de esquema v1 → v2 → v3
│   ├── stats.js           # Lógica pura: filtros, series, insights, recurrentes
│   ├── finance.js         # Patrimonio, activos, pasivos, proyección
│   ├── validation.js      # Salud de datos (análisis + reparación segura)
│   ├── backup.js          # Respaldos automáticos locales
│   ├── export.js          # Descargas JSON/CSV
│   ├── categories.js      # Categorías (icono, emoji, color)
│   └── agent/             # Asistente IA: engine, repository (bridge), tools, system prompt
├── vendor/                # Alpine, Tailwind, Lucide, Chart.js, Inter (sin CDN, offline)
├── styles/main.css        # Variables de tema, animaciones, impresión, safe-area
├── theme.config.js        # Marca, moneda, idioma, acento, tema por defecto
├── manifest.webmanifest   # PWA
└── sw.js                  # Service worker (cache-first, offline)
```

---

## Datos y respaldo

Los datos son **locales a ese navegador y perfil**. Para respaldarlos o moverlos a otro dispositivo: **Configuración → Exportar** (JSON) y luego **Importar**. Hay además respaldos automáticos locales restaurables desde Configuración.

## Personalización

- `theme.config.js` — nombre, logo, moneda (`COP` por defecto), idioma, formato de fecha, presupuesto inicial y color de acento.
- `src/categories.js` — categorías de gasto (icono, emoji, color).
- En vivo: acento y tema claro/oscuro desde Configuración.

## Stack

Alpine.js · Tailwind CSS · Lucide · Chart.js · IndexedDB · PWA (service worker) · JavaScript (ES modules), sin build.

## Licencia

MIT
