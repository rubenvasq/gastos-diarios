// The bridge between the generic agent engine and this app's live data.
//
// `createBridge(component)` returns a `repo` whose methods read and write the
// Alpine component's `state` DIRECTLY. Because writes mutate `this.state`, call
// `_save()` and re-render, the dashboard updates the instant the agent acts —
// e.g. the agent adds an expense and the charts change on screen.
//
// The repo is the ONLY place in the agent layer that knows how Gastos Diarios
// stores data. The tools (tools.js) and the loop (engine.js) stay data-agnostic.

import * as store from '../storage.js';
import * as stats from '../stats.js';
import * as fin from '../finance.js';

// "2025-10" -> { y: 2025, m: 9 }  (stats/finance use a 0-based month)
function parseMonth(month) {
  const [y, mm] = month.split('-').map(Number);
  return { y, m: mm - 1 };
}

export function createBridge(c) {
  const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };

  // Run after any write: persist + refresh charts/icons so the UI reflects it.
  const commit = () => {
    c._save();
    c.$nextTick(() => { refreshIcons(); c.renderCharts(); });
  };

  const findAccount = (id) => c.state.accounts.find((a) => a.id === id) || null;
  const findCategory = (id) => c.state.categories.find((cat) => cat.id === id) || null;

  const repo = {
    // ---- Lectura -------------------------------------------------------
    spendingForMonth(month) {
      const { y, m } = parseMonth(month);
      const recs = stats.filterMonth(c.state.expenses, y, m);
      return { month, total: stats.sum(recs), count: recs.length, currency: c.currency() };
    },

    incomeForMonth(month) {
      const { y, m } = parseMonth(month);
      const recs = stats.filterMonth(c.state.income, y, m);
      return { month, total: stats.sum(recs), count: recs.length, currency: c.currency() };
    },

    spendingByCategory(month) {
      const { y, m } = parseMonth(month);
      const recs = stats.filterMonth(c.state.expenses, y, m);
      const grouped = stats.groupSum(recs, (e) => e.category); // Map<catId, total>
      const rows = [...grouped.entries()]
        .map(([category, total]) => ({ category, label: c.category(category).label, total }))
        .sort((a, b) => b.total - a.total);
      return { month, currency: c.currency(), categories: rows };
    },

    compareMonths(month, compareTo) {
      const a = parseMonth(month);
      const b = parseMonth(compareTo);
      const total = stats.sum(stats.filterMonth(c.state.expenses, a.y, a.m));
      const compareTotal = stats.sum(stats.filterMonth(c.state.expenses, b.y, b.m));
      const change = stats.pctChange(total, compareTotal); // { pct, up } | null
      return {
        month, total, compareTo, compareTotal, currency: c.currency(),
        pctChange: change ? change.pct : null,
        direction: change ? (change.up ? 'up' : 'down') : 'same',
      };
    },

    budgetStatus(month) {
      const { y, m } = parseMonth(month);
      const spent = stats.sum(stats.filterMonth(c.state.expenses, y, m));
      const budget = Number(c.state.budget) || 0;
      const remaining = Math.round((budget - spent) * 100) / 100;
      return {
        month, budget, spent, remaining, currency: c.currency(),
        usedPct: budget > 0 ? Math.round((spent / budget) * 100) : null,
        overBudget: budget > 0 && spent > budget,
      };
    },

    netWorth() {
      return { ...fin.calculateNetWorth(c.state), currency: c.currency() };
    },

    insights(month) {
      const { y, m } = parseMonth(month);
      return {
        month,
        insights: stats.insights(c.state, y, m, {
          fmt: (n) => c.fmt(n),
          catLabel: (id) => c.category(id).label,
        }).map(({ text, tone }) => ({ text, tone })),
      };
    },

    listTransactions(month, type, limit) {
      const { y, m } = parseMonth(month);
      const take = (arr, kind) => stats.filterMonth(arr, y, m).map((r) => ({
        kind, amount: r.amount, description: r.description || '', date: r.date,
        category: r.category ? c.category(r.category).label : undefined,
        account: findAccount(r.account)?.name,
      }));
      let rows = [];
      if (type === 'expense' || type === 'all') rows = rows.concat(take(c.state.expenses, 'expense'));
      if (type === 'income' || type === 'all') rows = rows.concat(take(c.state.income, 'income'));
      rows.sort((x, z) => z.date.localeCompare(x.date));
      return { month, currency: c.currency(), count: rows.length, transactions: rows.slice(0, limit) };
    },

    listAccounts() {
      return {
        accounts: c.state.accounts.map((a) => ({
          id: a.id, name: a.name, type: a.type, balance: a.balance,
        })),
      };
    },

    listCategories() {
      return { categories: c.state.categories.map((cat) => ({ id: cat.id, label: cat.label })) };
    },

    // ---- Escritura -----------------------------------------------------
    addExpense({ amount, category, account, description, date }) {
      if (!findAccount(account)) {
        return { error: `No existe una cuenta con id '${account}'. Usa get_accounts para ver los ids válidos.` };
      }
      if (!findCategory(category)) {
        return { error: `No existe una categoría con id '${category}'. Usa get_categories para ver los ids válidos.` };
      }
      const rec = store.createExpense({
        amount, category, account,
        description: (description || '').trim(),
        date: date || stats.todayStr(),
      });
      c.state.expenses.push(rec);
      c._applyBalance('expense', rec.amount, account, null, 1);
      c._logActivity('gasto', `Gasto de ${c.fmt(rec.amount)} registrado por el asistente`);
      commit();
      return { created: true, expense: { amount: rec.amount, category: c.category(category).label, account: findAccount(account).name, date: rec.date, description: rec.description } };
    },

    addIncome({ amount, account, description, date }) {
      if (!findAccount(account)) {
        return { error: `No existe una cuenta con id '${account}'. Usa get_accounts para ver los ids válidos.` };
      }
      const rec = store.createIncome({
        amount, account,
        description: (description || '').trim(),
        date: date || stats.todayStr(),
      });
      c.state.income.push(rec);
      c._applyBalance('income', rec.amount, account, null, 1);
      c._logActivity('ingreso', `Ingreso de ${c.fmt(rec.amount)} registrado por el asistente`);
      commit();
      return { created: true, income: { amount: rec.amount, account: findAccount(account).name, date: rec.date, description: rec.description } };
    },

    createPaymentReminder({ name, amount, category, account, frequency, nextDate }) {
      if (!findAccount(account)) {
        return { error: `No existe una cuenta con id '${account}'. Usa get_accounts para ver los ids válidos.` };
      }
      if (!findCategory(category)) {
        return { error: `No existe una categoría con id '${category}'. Usa get_categories para ver los ids válidos.` };
      }
      const rec = store.createRecurring({ name: name.trim(), amount, category, account, frequency, nextDate });
      c.state.recurring.push(rec);
      c._logActivity('recurrente', `Pago recurrente "${rec.name}" creado por el asistente`);
      commit();
      return { created: true, reminder: { name: rec.name, amount: rec.amount, frequency: rec.frequency, nextDate: rec.nextDate } };
    },

    setBudget(amount) {
      c.state.budget = amount;
      c._logActivity('presupuesto', `Presupuesto mensual fijado por el asistente: ${c.fmt(amount)}`);
      commit();
      return { updated: true, budget: amount, currency: c.currency() };
    },
  };

  return repo;
}
