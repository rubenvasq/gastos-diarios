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

También puedes abrir `index.html` directamente, pero se recomienda usar un servidor local por los módulos ES.

## Estructura

```
ejemploi/
├── index.html          # Página principal
├── src/
│   ├── app.js          # Lógica de la interfaz
│   ├── storage.js      # Persistencia y utilidades
│   └── categories.js   # Categorías de gasto
├── styles/
│   └── main.css        # Estilos
├── package.json
└── README.md
```

## Uso

1. Establece tu presupuesto mensual en la tarjeta superior.
2. Registra gastos con el formulario (monto, categoría, descripción, fecha).
3. Revisa el desglose por categoría y el historial del mes.
4. Usa **Exportar** para hacer respaldo de tus datos en JSON.

## Tecnologías

- HTML5, CSS3, JavaScript (ES modules)
- localStorage para persistencia
- Sin dependencias de producción

## Licencia

MIT
