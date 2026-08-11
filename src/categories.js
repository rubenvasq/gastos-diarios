// Categorías de gasto iniciales. Personalizables en vivo desde la app
// (vista Categorías): cada categoría se guarda en el estado y puede
// editarse su label, icono de Lucide, emoji y color.
// Estas son solo las semillas para usuarios nuevos o importaciones.
export const CATEGORIES = [
  { id: 'alimentacion',  label: 'Alimentación',  icon: 'utensils',       emoji: '🍽️', color: '#f97316' },
  { id: 'transporte',    label: 'Transporte',    icon: 'bus',            emoji: '🚌', color: '#3b82f6' },
  { id: 'entretenimiento', label: 'Entretenimiento', icon: 'clapperboard', emoji: '🎬', color: '#ec4899' },
  { id: 'compras',       label: 'Compras',       icon: 'shopping-bag',   emoji: '🛍️', color: '#14b8a6' },
  { id: 'salud',         label: 'Salud',         icon: 'heart-pulse',    emoji: '💊', color: '#ef4444' },
  { id: 'educacion',     label: 'Educación',     icon: 'graduation-cap', emoji: '🎓', color: '#8b5cf6' },
  { id: 'servicios',     label: 'Servicios',     icon: 'smartphone',     emoji: '📱', color: '#06b6d4' },
  { id: 'vivienda',      label: 'Vivienda',      icon: 'house',          emoji: '🏠', color: '#f59e0b' },
  { id: 'suscripciones', label: 'Suscripciones', icon: 'repeat',         emoji: '🔁', color: '#6366f1' },
  { id: 'otros',         label: 'Otros',         icon: 'package',        emoji: '📦', color: '#64748b' },
];

// Comodín para ids desconocidos (importaciones viejas, datos sueltos…).
export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
