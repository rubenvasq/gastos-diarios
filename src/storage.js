const STORAGE_KEY = 'gastosdiarios-v1';

const defaultState = () => ({
  budget: 2000,
  expenses: [],
});

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      budget: typeof parsed.budget === 'number' ? parsed.budget : 2000,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Almacenamiento lleno o bloqueado (modo privado, permisos).
    return false;
  }
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gastosdiarios-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importState(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.expenses)) {
    throw new Error('Archivo inválido: no contiene gastos.');
  }
  return {
    budget: Number.isFinite(parsed.budget) && parsed.budget >= 0 ? parsed.budget : 2000,
    expenses: parsed.expenses.map(sanitizeExpense).filter(Boolean),
  };
}

// Normaliza un gasto que viene de una fuente no confiable (importación).
// Descarta los que no tienen un monto válido.
function sanitizeExpense(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const isValidDate = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date);
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : crypto.randomUUID(),
    amount: Math.round(amount * 100) / 100,
    category: typeof raw.category === 'string' ? raw.category : 'otros',
    description: typeof raw.description === 'string' ? raw.description.slice(0, 100) : '',
    date: isValidDate ? raw.date : new Date().toISOString().slice(0, 10),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

export function createExpense({ amount, category, description, date }) {
  return {
    id: crypto.randomUUID(),
    amount: Math.round(amount * 100) / 100,
    category,
    description: description.trim(),
    date,
    createdAt: new Date().toISOString(),
  };
}

export function filterByMonth(expenses, year, month) {
  return expenses.filter((e) => {
    const d = new Date(e.date + 'T12:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function sumExpenses(expenses) {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function groupByCategory(expenses) {
  const groups = {};
  for (const expense of expenses) {
    groups[expense.category] = (groups[expense.category] ?? 0) + expense.amount;
  }
  return groups;
}
