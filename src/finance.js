// src/finance.js — lógica financiera central.
// Todas las vistas (dashboard, cuentas, presupuestos, reportes, calendario,
// insights, patrimonio) deben obtener sus números aquí, NUNCA recalcularlos
// en la UI. Funciones puras y testables; no dependen del navegador.

export function round2(n) {
  return Math.round(n * 100) / 100;
}

export function sum(records) {
  return (Array.isArray(records) ? records : []).reduce((acc, r) => {
    const n = Number(r?.amount);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

// Filtra registros con fecha en el mes dado. `month` es 0-based (Enero=0).
export function filterMonth(records, year, month) {
  return (Array.isArray(records) ? records : []).filter((r) => {
    if (!r?.date) return false;
    const d = new Date(String(r.date).slice(0, 10) + 'T12:00:00');
    return !Number.isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month;
  });
}

export function monthIncome(state, year, month) {
  return sum(filterMonth(state?.income, year, month));
}

export function monthExpenses(state, year, month) {
  return sum(filterMonth(state?.expenses, year, month));
}

export function monthTransfers(state, year, month) {
  return sum(filterMonth(state?.transfers, year, month));
}

export function monthSavings(state, year, month) {
  return monthIncome(state, year, month) - monthExpenses(state, year, month);
}

// Alias con los nombres pedidos explícitamente.
export const calculateIncome = monthIncome;
export const calculateExpenses = monthExpenses;
export const calculateSavings = monthSavings;

// Balance total = suma de los balances de todas las cuentas (activas o no).
export function calculateBalance(state) {
  return round2((state?.accounts ?? []).reduce((acc, a) => {
    const n = Number(a?.balance);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0));
}

export function calculateAccountBalance(account) {
  const n = Number(account?.balance);
  return Number.isFinite(n) ? round2(n) : 0;
}

// Uso del presupuesto global del mes.
export function calculateBudgetUsage(state, year, month) {
  const used = calculateExpenses(state, year, month);
  const budget = Number(state?.budget);
  const safeBudget = Number.isFinite(budget) && budget >= 0 ? budget : 0;
  return {
    budget: safeBudget,
    used,
    remaining: safeBudget - used,
    pct: safeBudget > 0 ? Math.min(Math.round((used / safeBudget) * 100), 999) : 0,
  };
}

// Uso del presupuesto por categoría. Devuelve Map category -> { budget, used, pct }.
export function calculateCatBudgetUsage(state, year, month) {
  const catBudgets = state?.catBudgets ?? {};
  const usedMap = new Map();
  for (const e of filterMonth(state?.expenses, year, month)) {
    usedMap.set(e.category, (usedMap.get(e.category) ?? 0) + (Number(e.amount) || 0));
  }
  const out = new Map();
  for (const [cat, budgetRaw] of Object.entries(catBudgets)) {
    const budget = Number(budgetRaw);
    const used = usedMap.get(cat) ?? 0;
    const safeBudget = Number.isFinite(budget) && budget >= 0 ? budget : 0;
    out.set(cat, {
      budget: safeBudget,
      used,
      remaining: safeBudget - used,
      pct: safeBudget > 0 ? Math.min(Math.round((used / safeBudget) * 100), 999) : 0,
    });
  }
  return out;
}

// Patrimonio neto: activos (balances de cuentas) menos pasivos (deudas pendientes).
export function calculateNetWorth(state) {
  const assets = calculateBalance(state);
  const liabilities = round2((state?.debts ?? []).reduce((acc, d) => {
    if (d?.status === 'pagada') return acc;
    const n = Number(d?.balance ?? d?.originalAmount);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0));
  return { assets, liabilities, netWorth: round2(assets - liabilities) };
}

// Totales de los 12 meses de un año (ingresos, gastos, ahorro).
export function calculateMonthlyTotals(state, year) {
  const y = Number(year);
  return Array.from({ length: 12 }, (_, m) => {
    const income = calculateIncome(state, y, m);
    const expenses = calculateExpenses(state, y, m);
    return { month: m, income, expenses, savings: income - expenses };
  });
}

// Evolución histórica del patrimonio: suma acumulada del ahorro mensual.
// Devuelve array { month, assets } comenzando en `base`.
export function netWorthSeries(state, year, base = 0) {
  let acc = round2(Number(base) || 0);
  return Array.from({ length: 12 }, (_, m) => {
    acc = round2(acc + monthSavings(state, year, m));
    return { month: m, value: acc };
  });
}

// Aplica una transferencia a la lista de cuentas (sin mutar la entrada).
export function applyTransfer(accounts, { from, to, amount }) {
  const amt = round2(Number(amount));
  if (!Number.isFinite(amt) || amt < 0 || !from || !to) return accounts;
  return accounts.map((a) => {
    if (a.id === from) return { ...a, balance: round2(calculateAccountBalance(a) - amt) };
    if (a.id === to) return { ...a, balance: round2(calculateAccountBalance(a) + amt) };
    return a;
  });
}

// Delta de balance de una cuenta para gastos/ingresos (expense resta, income suma).
export function movementDelta(type, amount) {
  const n = Number(amount);
  const amt = Number.isFinite(n) ? round2(n) : 0;
  if (type === 'income') return +amt;
  if (type === 'expense') return -amt;
  return 0;
}

// Nombre canónico de la operación central que mueve dinero entre cuentas.
// Pura y testable: devuelve los saldos nuevos de from/to.
export function transferMoney(fromBalance, toBalance, amount) {
  const amt = round2(Number(amount));
  if (!Number.isFinite(amt) || amt < 0) return null;
  return {
    from: round2(Number(fromBalance) - amt),
    to: round2(Number(toBalance) + amt),
  };
}
