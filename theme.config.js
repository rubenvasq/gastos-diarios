// ============================================================
//  CONFIGURACIÓN CENTRAL — personaliza aquí toda la app
//  (marca, colores, moneda, fecha, foto/logo). Las categorías
//  y sus iconos/colores por defecto se editan en src/categories.js
// ============================================================

export default {
  brand: {
    name: 'GastosDiarios',
    tagline: 'Sabe en qué se va tu dinero',

    // Icono del logo. Usa un nombre de icono de Lucide (https://lucide.dev)
    // p. ej. 'wallet', 'piggy-bank', 'coins', 'banknote'.
    logoIcon: 'wallet',

    // Si pones una URL o ruta de imagen (foto/logo), reemplaza al icono.
    // Ej: 'assets/mi-logo.png'  ó  'https://...'
    logoImage: '',
  },

  // Formato de dinero y fechas por defecto.
  // Se pueden cambiar en vivo desde la vista Configuración (se guardan en localStorage).
  locale: 'es-CO', // 'es-CO' | 'es-MX' | 'es-ES' | 'en-US'
  currency: 'COP', // 'COP' | 'MXN' | 'USD' | 'EUR' | 'PEN' | 'CLP' | 'ARS'
  dateFormat: 'dd/mm/yyyy', // 'dd/mm/yyyy' | 'mm/dd/yyyy' | 'yyyy-mm-dd'

  defaultBudget: 4000000,

  theme: {
    // Color de acento inicial (se puede cambiar en vivo desde Configuración)
    accent: '#10B981',

    // 'light' | 'dark' | 'system'
    defaultMode: 'system',
  },

  // Paleta de acentos disponible en el selector rápido
  accentPresets: [
    { name: 'Esmeralda', value: '#10B981' },
    { name: 'Verde',     value: '#22C55E' },
    { name: 'Azul',      value: '#3B82F6' },
    { name: 'Índigo',    value: '#4F46E5' },
    { name: 'Violeta',   value: '#8B5CF6' },
    { name: 'Rosa',      value: '#EC4899' },
    { name: 'Ámbar',     value: '#F59E0B' },
  ],
};
