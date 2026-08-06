export const CATEGORIES = [
  { id: 'comida', label: 'Comida', emoji: '🍽️', color: '#f97316' },
  { id: 'transporte', label: 'Transporte', emoji: '🚌', color: '#3b82f6' },
  { id: 'hogar', label: 'Hogar', emoji: '🏠', color: '#8b5cf6' },
  { id: 'salud', label: 'Salud', emoji: '💊', color: '#ef4444' },
  { id: 'ocio', label: 'Ocio', emoji: '🎬', color: '#ec4899' },
  { id: 'servicios', label: 'Servicios', emoji: '📱', color: '#06b6d4' },
  { id: 'otros', label: 'Otros', emoji: '📦', color: '#64748b' },
];

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}
