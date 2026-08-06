// Categorías de gasto. Personalizables: cambia label, color,
// el icono de Lucide (`icon`, ver https://lucide.dev) y/o el emoji.
export const CATEGORIES = [
  { id: 'comida',     label: 'Comida',     icon: 'utensils',   emoji: '🍽️', color: '#f97316' },
  { id: 'transporte', label: 'Transporte', icon: 'bus',        emoji: '🚌', color: '#3b82f6' },
  { id: 'hogar',      label: 'Hogar',      icon: 'house',      emoji: '🏠', color: '#8b5cf6' },
  { id: 'salud',      label: 'Salud',      icon: 'heart-pulse',emoji: '💊', color: '#ef4444' },
  { id: 'ocio',       label: 'Ocio',       icon: 'clapperboard',emoji: '🎬', color: '#ec4899' },
  { id: 'servicios',  label: 'Servicios',  icon: 'smartphone', emoji: '📱', color: '#06b6d4' },
  { id: 'otros',      label: 'Otros',      icon: 'package',    emoji: '📦', color: '#64748b' },
];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
