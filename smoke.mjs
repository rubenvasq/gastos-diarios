// smoke.mjs — pruebas de lógica (ESM, sin navegador).
// Uso: node smoke.mjs  (los módulos puros no necesitan browser).

import { pathToFileURL } from 'node:url';

const base = pathToFileURL(import.meta.dirname + '/').href;
const storage = await import(base + 'src/storage.js');
const migrations = await import(base + 'src/migrations.js');
const finance = await import(base + 'src/finance.js');
const validation = await import(base + 'src/validation.js');
const backup = await import(base + 'src/backup.js');
const stats = await import(base + 'src/stats.js');
const cat = await import(base + 'src/categories.js');
const exp = await import(base + 'src/export.js');

const assert = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('OK: ' + msg); };
const assertThrows = (fn, msg) => {
  let threw = false;
  try { fn(); } catch { threw = true; }
  assert(threw, msg);
};

// ---- default state ----
const s = storage.defaultState();
assert(s.version === 3, 'defaultState version 3');
assert(Array.isArray(s.transfers) && Array.isArray(s.recurring) && s.settings, 'v2 keys present');
assert(Array.isArray(s.goals) && Array.isArray(s.debts) && Array.isArray(s.activity), 'v3 collections present');
assert(Array.isArray(s.widgets) && s.receipts && s.privacy, 'v3 widgets/receipts/privacy present');
assert(s.accounts.length === storage.ACCOUNT_DEFAULTS.length, 'accounts seeded');
assert(s.categories.length >= 10, 'categories seeded');

// ---- loadState returns { state, migrated } (db fallback en memoria en Node) ----
const loaded = storage.loadState();
assert(loaded && typeof loaded === 'object' && loaded.state && loaded.state.version === 3, 'loadState returns {state, migrated}');

// ---- migrateState v1 -> v3 ----
const v1 = {
  budget: 2000,
  income: [{ id: 'a', amount: 100, description: 's', date: '2026-08-01', createdAt: 'x', account: 'banco' }],
  expenses: [{ id: 'b', amount: 50, category: 'comida', description: 'taco', date: '2026-08-02', createdAt: 'x', account: 'efectivo' }],
  accounts: [
    { id: 'efectivo', name: 'Efectivo', icon: 'wallet', color: '#10b981', balance: 0 },
    { id: 'banco', name: 'Banco', icon: 'landmark', color: '#3b82f6', balance: 0 },
  ],
  catBudgets: { comida: 3000, hogar: 1000, ocio: 500 },
};
const mig = migrations.migrateState(v1);
assert(mig.migrated === true && mig.state.version === 3, 'migrateState bumps v1 -> v3 + migrated flag');
assert(mig.state.expenses[0].category === 'alimentacion', 'category remapped comida->alimentacion');
assert(mig.state.catBudgets['alimentacion'] === 3000 && mig.state.catBudgets['vivienda'] === 1000, 'catBudgets remapped');
assert(Array.isArray(mig.state.goals) && mig.state.privacy.pinEnabled === false, 'v3 fields defaulted on migration');

const m = storage.importState(JSON.stringify(v1));
assert(m.version === 3, 'importState bumps to v3');
assert(m.expenses[0].category === 'alimentacion', 'importState remaps categories');
assert(Array.isArray(m.transfers) && Array.isArray(m.recurring) && m.categories.length >= 10, 'import adds arrays+categories');
assert(Array.isArray(m.goals) && Array.isArray(m.debts) && m.privacy, 'import adds v3 fields');

// ---- importState rejects junk ----
assertThrows(() => storage.importState('{nope}'), 'importState throws on invalid JSON');
assertThrows(() => storage.importState(JSON.stringify({ foo: 1 })), 'importState throws on data-less file');

// ---- sanitization through importState ----
const junk = storage.importState(JSON.stringify({
  expenses: [
    { amount: 'x', category: 'nope', date: 'bad' },
    { amount: 10, category: 'nope', date: 'bad' },
  ],
  accounts: [{ id: 'x', name: 'X', icon: 'wallet', color: 'red', balance: 5 }],
}));
assert(junk.expenses.length === 1, 'invalid expense dropped, valid kept');
assert(junk.expenses[0].amount === 10 && /^\d{4}-\d{2}-\d{2}$/.test(junk.expenses[0].date), 'valid expense kept, date normalized');
assert(/^#[0-9a-f]{6}$/i.test(junk.accounts[0].color), 'normalizeAccount color fallback');

// ---- factories ----
const e = storage.createExpense({ amount: '12.999', category: 'alimentacion', description: 'x', date: '2026-08-03', account: 'efectivo' });
assert(Math.abs(e.amount - 13) < 1e-9, 'createExpense rounds amount');
assert(/^\d{4}-\d{2}-\d{2}$/.test(e.date), 'date normalized');
const t = storage.createTransfer({ amount: 100, from: 'banco', to: 'efectivo', date: '2026-08-03' });
assert(t.from === 'banco' && t.to === 'efectivo' && t.amount === 100, 'createTransfer shape');
const rec = storage.createRecurring({ name: 'Netflix', amount: 80000, category: 'entretenimiento', account: 'banco', frequency: 'mensual', nextDate: '2026-08-10' });
assert(rec.nextDate === '2026-08-10' && rec.active === true, 'createRecurring shape');
const acct = storage.createAccount({ name: 'Mi cuenta', type: 'nope', color: 'zzz' });
assert(acct.type === 'banco' && /^#[0-9a-f]{6}$/i.test(acct.color), 'createAccount fallbacks');
const c2 = storage.createCategory({ label: 'Mascotas' });
assert(c2.id && c2.label === 'Mascotas', 'createCategory shape');

// ---- filters / sums ----
const list = [e, storage.createExpense({ amount: 30, category: 'transporte', description: 'bus', date: '2026-07-20', account: 'efectivo' })];
assert(stats.filterMonth(list, 2026, 7).length === 1, 'filterMonth month window');
assert(stats.sum(list) === 43, 'stats.sum total');
const g = storage.groupByCategory(list);
assert(g['alimentacion'] === 13, 'groupByCategory alimentacion');
assert(stats.groupSum(list, (r) => r.category).get('alimentacion') === 13, 'stats.groupSum');

// ---- finance central calcs ----
const fState = storage.importState(JSON.stringify(v1));
assert(finance.calculateBalance(fState) === 0, 'calculateBalance sums accounts');
assert(finance.calculateIncome(fState, 2026, 7) === 100, 'calculateIncome month');
assert(finance.calculateExpenses(fState, 2026, 7) === 50, 'calculateExpenses month');
assert(finance.calculateSavings(fState, 2026, 7) === 50, 'calculateSavings month');
const bu = finance.calculateBudgetUsage(fState, 2026, 7);
assert(bu.budget === 2000 && bu.used === 50, 'calculateBudgetUsage budget/used');
const nw = finance.calculateNetWorth(fState);
assert(nw.netWorth === 0 && nw.liabilities === 0, 'calculateNetWorth no debts');
const mTot = finance.calculateMonthlyTotals(fState, 2026);
assert(mTot.length === 12 && mTot[7].income === 100, 'calculateMonthlyTotals 12 months');
const tm = finance.transferMoney(500, 100, 50);
assert(tm.from === 450 && tm.to === 150, 'transferMoney from/to');
const moved = finance.applyTransfer(fState.accounts, { from: 'efectivo', to: 'banco', amount: 25 });
assert(moved[0].balance === -25 && moved[1].balance === 25, 'applyTransfer immutable balances');

// ---- validation ----
const goodAnalysis = validation.analyzeState(storage.defaultState());
assert(goodAnalysis.ok === true && goodAnalysis.summary === 'Estado de datos: Excelente', 'analyzeState clean state excellent');
const dup = storage.importState(JSON.stringify({
  expenses: [{ id: 'x', amount: 1, category: 'alimentacion', date: '2026-08-01', account: 'efectivo' },
             { id: 'x', amount: 2, category: 'alimentacion', date: '2026-08-02', account: 'efectivo' }],
  accounts: [{ id: 'efectivo', name: 'E', icon: 'wallet', color: '#10b981', balance: 0 }],
}));
const badAnalysis = validation.analyzeState(dup);
assert(badAnalysis.ok === false && badAnalysis.counts.error >= 1, 'analyzeState flags duplicate ids');
assert(badAnalysis.summary.includes('inconsistencia'), 'analyzeState summary count');
const nState = storage.importState(JSON.stringify({
  expenses: [{ id: 'x', amount: 1, category: 'desconocida', date: '2026-08-01', account: 'noexiste' }],
  accounts: [{ id: 'efectivo', name: 'E', icon: 'wallet', color: '#10b981', balance: 0 }],
}));
const badRefs = validation.analyzeState(nState);
assert(badRefs.counts.error >= 2, 'analyzeState flags missing category + account refs');
const fixed = validation.safeFixState(nState);
assert(fixed.state.expenses[0].category === 'otros' && fixed.state.expenses[0].account === 'efectivo', 'safeFixState re-references safely');

// ---- backup ----
const b = backup.createBackup(storage.defaultState());
assert(b.kind === 'gastosdiarios-backup' && b.version === 3 && b.data.version === 3, 'createBackup envelope');
const validated = backup.validateBackupText(JSON.stringify(b));
assert(validated.data.version === 3, 'validateBackupText accepts envelope');
const legacy = backup.validateBackupText(JSON.stringify(v1));
assert(legacy.data && legacy.kind === 'gastosdiarios-backup', 'validateBackupText wraps legacy JSON');
const saved = backup.saveBackup(storage.defaultState(), { label: 'Prueba' });
assert(backup.listBackups().length === 1, 'saveBackup/listBackups history');
const restored = backup.restoreBackup(saved.id);
assert(restored.version === 3, 'restoreBackup returns data');
backup.removeBackup(saved.id);
assert(backup.listBackups().length === 0, 'removeBackup');

// ---- auto-backup periódico ----
assert(backup.lastBackupAt() === null, 'lastBackupAt null sin respaldos');
const auto1 = backup.maybeAutoBackup(storage.defaultState(), 24);
assert(auto1 && auto1.auto === true, 'maybeAutoBackup crea el primer respaldo');
assert(typeof backup.lastBackupAt() === 'string', 'lastBackupAt devuelve fecha tras respaldar');
const auto2 = backup.maybeAutoBackup(storage.defaultState(), 24);
assert(auto2 === null, 'maybeAutoBackup no duplica dentro del intervalo');
const auto3 = backup.maybeAutoBackup(storage.defaultState(), 0);
assert(auto3 && auto3.auto === true, 'maybeAutoBackup respalda si el intervalo ya pasó');
backup.removeBackup(auto1.id); backup.removeBackup(auto3.id);
assert(backup.listBackups().length === 0, 'limpieza auto-backup');

// ---- insights ----
const ins = stats.insights(m, 2026, 8, { fmt: (n) => String(n), catLabel: (id) => id });
assert(Array.isArray(ins), 'insights returns array');

// ---- recurring helpers ----
const after = stats.nextRecurringDate('2026-08-10', 'mensual');
assert(after === '2026-09-10', 'nextRecurringDate mensual');
const afterW = stats.nextRecurringDate('2026-08-10', 'semanal');
assert(afterW === '2026-08-17', 'nextRecurringDate semanal');
const up = stats.upcomingRecurring(m.recurring, '2026-08-15', 30);
assert(Array.isArray(up), 'upcomingRecurring array');

// ---- stats pure helpers ----
const chg = stats.pctChange(100, 80);
assert(chg && chg.pct === '25' && chg.up === true, 'pctChange positive');
assert(stats.pctChange(100, 0) === null, 'pctChange null base');
const top = stats.topExpenses([{ amount: 5 }, { amount: 9 }, { amount: 1 }], 2);
assert(top.length === 2 && top[0].amount === 9, 'topExpenses sorted slice');
const ds = stats.dayStats([{ amount: 10, date: '2026-08-05' }, { amount: 5, date: '2026-08-05' }, { amount: 1, date: '2026-07-30' }], 2026, 7);
assert(ds.get(5).total === 15 && ds.get(5).count === 2, 'dayStats totals');

// ---- export csv (sin DOM) ----
const csv = exp.toCSV([['a', 'b'], ['1', '2']]);
assert(csv === 'a,b\r\n1,2', 'toCSV rows joined');
const esc = exp.toCSV([['h"i', 'a,b']]);
assert(esc.includes('"h""i"') && esc.includes('"a,b"'), 'csvCell quoting');
assert(exp.csvCell('plain') === 'plain', 'csvCell no quotes on plain');

// ---- factories de metas y deudas ----
const goal = storage.createGoal({ name: '  Ahorro  ', targetAmount: 1000, savedAmount: 250, color: '#0EA5E9' });
assert(goal.name === 'Ahorro' && goal.targetAmount === 1000 && goal.savedAmount === 250, 'createGoal sanitiza nombre y montos');
const goalBad = storage.createGoal({ name: 'X', targetAmount: -5 });
assert(goalBad.targetAmount === 0, 'createGoal rechaza meta inválida');
const debt = storage.createDebt({ name: 'TC', originalAmount: 500, balance: 200, quota: 50, status: 'activa' });
assert(debt.originalAmount === 500 && debt.balance === 200 && debt.status === 'activa', 'createDebt monto original/saldo');
const debtOver = storage.createDebt({ name: 'TC', originalAmount: 100, balance: 9999 });
assert(debtOver.balance === 100, 'createDebt no permite saldo > original');
const debtPaid = storage.createDebt({ name: 'TC', originalAmount: 100, balance: 0, status: 'pagada' });
assert(debtPaid.status === 'pagada' && debtPaid.balance === 0, 'createDebt pagada');

// ---- net worth con deudas ----
const nwState = storage.importState(JSON.stringify({
  accounts: [{ id: 'a', name: 'A', icon: 'wallet', color: '#10b981', balance: 1000 }],
  expenses: [], income: [], transfers: [],
  debts: [{ id: 'd1', name: 'D', originalAmount: 500, balance: 200, status: 'activa' },
          { id: 'd2', name: 'D2', originalAmount: 999, balance: 999, status: 'pagada' }],
}));
const nwDebt = finance.calculateNetWorth(nwState);
assert(nwDebt.assets === 1000 && nwDebt.liabilities === 200 && nwDebt.netWorth === 800, 'calculateNetWorth con deudas pagadas');
const series = finance.netWorthSeries(nwState, 2026, 100);
assert(series.length === 12 && series[0].value === 100, 'netWorthSeries base + 12 meses');

// ---- metas como activo: aportar no debe cambiar el patrimonio neto ----
// Al aportar 300 a una meta, la cuenta baja a 700 y la meta sube a 300;
// el patrimonio neto (activos - pasivos) debe quedar igual.
const goalState = {
  accounts: [{ id: 'a', name: 'A', icon: 'wallet', color: '#10b981', balance: 700 }],
  expenses: [], income: [], transfers: [], debts: [],
  goals: [{ id: 'g', name: 'Viaje', targetAmount: 1000, savedAmount: 300, createdAt: 'x' }],
};
const nwGoal = finance.calculateNetWorth(goalState);
assert(finance.goalSavings(goalState) === 300, 'goalSavings suma ahorro de metas');
assert(nwGoal.accounts === 700 && nwGoal.goals === 300, 'netWorth separa cuentas y metas');
assert(nwGoal.assets === 1000 && nwGoal.netWorth === 1000, 'aportar a meta no cambia el patrimonio');
assert(finance.goalSavings({ goals: [{ savedAmount: -50 }, { savedAmount: 'x' }] }) === 0, 'goalSavings ignora montos inválidos');

console.log('\nALL SMOKE TESTS PASSED');
