# GastosDiarios

Aplicación web para **gestionar tus finanzas personales** (efectivo, bancos, Nequi/Daviplata, tarjetas, inversiones). Es una app 100% local: todo vive en el `localStorage` de tu navegador, sin servidor ni cuenta.

## Qué puedes hacer

- **Panel (Inicio)** — balance total, ingresos, gastos, ahorro, presupuesto usado, cuentas con saldo, gastos por categoría, barras de presupuesto, últimas transacciones, alertas e *insights* del mes.
- **Cuentas** — crear/editar/eliminar cuentas (banco, efectivo, ahorros, tarjeta, Nequi, Daviplata, PayPal, inversiones), ajustar saldo y ver movimientos por cuenta.
- **Movimientos** — registrar **gastos** (con captura de **recibos/fotos**), **ingresos** y **transferencias** entre cuentas (los saldos se ajustan solos). Búsqueda (con debounce), filtros por tipo/cuenta/categoría/fecha, orden y paginación.
- **Presupuestos** — presupuesto mensual global y por categoría con barras de avance y alertas.
- **Reportes** — resumen del mes, gastos por categoría, ingresos vs gastos, evolución, gastos por cuenta, ahorro acumulado y **proyección de ahorro anual**; exportar CSV/JSON e imprimir.
- **Metas** — define metas de ahorro con monto objetivo y fecha límite, registra aportes y consulta tu progreso.
- **Deudas** — controla préstamos/créditos: cuota, saldo pendiente, pagos registrados y estado pagada.
- **Patrimonio** — activos (cuentas + inversiones) menos pasivos (deudas), con gráfico de evolución y ahorro acumulado.
- **Calendario** — vista mensual con los gastos de cada día.
- **Recurrentes** — pagos que se repiten (mensual, semanal, quincenal, anual); aviso de pendientes con un clic para registrar el gasto.
- **Categorías** — editar la lista de categorías (icono, emoji, color) con reasignación segura si tienen movimientos.
- **Configuración** — moneda, idioma, formato de fecha, color de acento, tema claro/oscuro, **PIN de bloqueo con auto-bloqueo y ocultar montos**, y respaldo (exportar/importar JSON, cargar datos de ejemplo, restablecer).

Los datos se guardan **localmente** en tu navegador. Usa **Exportar respaldo** para guardar un JSON. Con la **PWA** (instalable y con *service worker* cache-first) la app abre y funciona sin conexión; solo los datos offline, los recursos se cachean tras la primera visita.

## Inicio rápido

```bash
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Necesitas **conexión a internet** la primera vez (Tailwind, Alpine, Lucide y Chart.js vienen de CDN); después el *service worker* cachea todo y la app funciona **offline**. Los datos son siempre locales.

> Abrir `index.html` directo no funciona: `src/app.js` es un módulo ES y el navegador lo bloquea sobre `file://` (y el *service worker* solo se registra sobre `http(s)`).

Para una comprobación rápida de la lógica: `node smoke.mjs` (no requiere navegador).

## Personalización

- **`theme.config.js`** — nombre/tagline, logo, moneda (`COP` por defecto), idioma, formato de fecha, presupuesto inicial y color de acento.
- **`src/categories.js`** — categorías de gasto, iconos ([Lucide](https://lucide.dev)), emojis y colores.
- **En vivo** — desde Configuración puedes cambiar acento y tema; las preferencias se recuerdan.

## Estructura

```
ejemploi/
├── index.html            # Vista (Tailwind + Alpine + Lucide + Chart.js, vía CDN)
├── theme.config.js       # Configuración/personalización central
├── manifest.webmanifest  # PWA: nombre, iconos y tema (instalable)
├── sw.js                 # Service worker: cache-first para app y CDNs (offline)
├── icons/
│   └── icon.svg          # Icono de la PWA (cualquier propósito, 512×512)
├── src/
│   ├── app.js            # Componente Alpine (estado, getters, acciones, gráficos, PWA/PIN)
│   ├── storage.js        # Persistencia, migración v1→v2→v3, sanitización y factories
│   ├── stats.js          # Lógica pura: filtros, series, insights, recurrentes
│   ├── finance.js        # Cálculos financieros: patrimonio, activos, pasivos, proyección
│   ├── validation.js     # Salud de datos: análisis y safeFixState
│   ├── migrations.js     # Migración v1→v2→v3 del estado guardado
│   ├── backup.js         # Envelopes de respaldo automático en localStorage
│   ├── export.js         # Descargas JSON/CSV/texto (funciones puras + Blob)
│   └── categories.js     # Categorías de gasto (icono, emoji, color)
├── styles/
│   └── main.css          # Variables de tema, scrollbar, animaciones e impresión
├── package.json
├── smoke.mjs             # Pruebas rápidas de lógica (node smoke.mjs)
└── README.md
```

## Uso

1. (Opcional) Revisa **Cuentas** y ajusta los saldos iniciales.
2. Registra gastos, ingresos o transferencias con el botón flotante **+**.
3. Define tu presupuesto mensual y por categoría en **Presupuestos**.
4. Usa **Exportar** (JSON) para respaldar tus datos.

## Tecnologías

- JavaScript (ES modules) para la lógica de datos
- [Alpine.js](https://alpinejs.dev) para la interfaz reactiva
- [Tailwind CSS](https://tailwindcss.com) para los estilos
- [Lucide](https://lucide.dev) para los iconos
- [Chart.js](https://www.chartjs.org) para los gráficos
- localStorage para persistencia
- Sin paso de compilación (frameworks vía CDN)

## Licencia

MIT
