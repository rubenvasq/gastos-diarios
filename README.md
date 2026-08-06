# GastosDiarios

Aplicación web para **controlar tus gastos personales**. Resuelve un problema cotidiano: no saber en qué se va el dinero a fin de mes.

## Problema que resuelve

Muchas personas gastan sin registrar nada y al final del mes no entienden dónde se fue su sueldo. GastosDiarios te permite:

- Registrar cada gasto con monto, categoría y fecha
- Definir un **presupuesto mensual** y ver cuánto te queda
- Ver un **desglose por categoría** (comida, transporte, hogar…)
- Recibir **alertas** cuando te acercas al límite
- Navegar entre meses para revisar historial
- **Exportar/importar** tus datos como respaldo

Los datos se guardan **localmente** en tu navegador (sin servidor ni cuenta).

## Inicio rápido

```bash
npm start
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

También puedes abrir `index.html` directamente, pero se recomienda usar un servidor local por los módulos ES. Se necesita **conexión a internet** para cargar Tailwind, Alpine y Lucide desde CDN (los datos siguen siendo locales).

## Personalización

- **`theme.config.js`** — nombre de la app, logo (icono de Lucide o una foto/imagen), moneda, presupuesto inicial y colores de acento.
- **`src/categories.js`** — categorías de gasto, sus iconos ([Lucide](https://lucide.dev)) y colores.
- **En vivo** — el botón ⚙ abre un panel para cambiar el color de acento y el tema (claro/oscuro/sistema); las preferencias se recuerdan.

## Estructura

```
ejemploi/
├── index.html          # Vista (Tailwind + Alpine + Lucide, vía CDN)
├── theme.config.js     # Configuración/personalización central
├── src/
│   ├── app.js          # Componente Alpine (estado y acciones)
│   ├── storage.js      # Persistencia y utilidades de datos
│   └── categories.js   # Categorías de gasto (icono, color)
├── styles/
│   └── main.css        # Variables de tema y animaciones
├── package.json
└── README.md
```

## Uso

1. Establece tu presupuesto mensual en la tarjeta superior.
2. Registra gastos con el formulario (monto, categoría, descripción, fecha).
3. Revisa el desglose por categoría y el historial del mes.
4. Usa **Exportar** para hacer respaldo de tus datos en JSON.

## Tecnologías

- JavaScript (ES modules) para la lógica de datos
- [Alpine.js](https://alpinejs.dev) para la interfaz reactiva
- [Tailwind CSS](https://tailwindcss.com) para los estilos
- [Lucide](https://lucide.dev) para los iconos
- localStorage para persistencia
- Sin paso de compilación (frameworks vía CDN)

## Licencia

MIT
