// ============================================================
//  CONFIGURACIÓN CENTRAL — personaliza aquí toda la app
//  (marca, colores, moneda, foto/logo). Las categorías y sus
//  iconos/colores se editan en src/categories.js
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

  // Formato de dinero
  locale: 'es-MX',
  currency: 'MXN',

  defaultBudget: 2000,

  theme: {
    // Color de acento inicial (se puede cambiar en vivo desde el panel ⚙)
    accent: '#4f46e5',

    // 'light' | 'dark' | 'system'
    defaultMode: 'system',
  },

  // Paleta de acentos disponible en el selector rápido
  accentPresets: [
    { name: 'Índigo', value: '#4f46e5' },
    { name: 'Esmeralda', value: '#0d9488' },
    { name: 'Rosa', value: '#e11d48' },
    { name: 'Ámbar', value: '#f59e0b' },
    { name: 'Azul', value: '#2563eb' },
    { name: 'Violeta', value: '#7c3aed' },
  ],
};
