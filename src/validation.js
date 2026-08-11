// src/validation.js — validación central del estado y herramienta "Analizar datos".
// Nunca se permite: NaN/Infinity, montos negativos en transacciones, fechas
// inválidas, ids duplicados, categorías/cuentas inexistentes o JSON corrupto.
// `analyzeState()` informa inconsistencias; `safeFixState()` aplica SOLO
// correcciones seguras (nunca elimina registros sin confirmación).

import config from '../theme.config.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  return !Number.isNaN(new Date(s + 'T12:00:00').getTime());
}

function hexColor(s) {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}

// Tipos de cuenta conocidos (coinciden con src/storage.js ACCOUNT_TYPES).
const KNOWN_ACCOUNT_TYPES = new Set([
  'banco', 'efectivo', 'ahorros', 'tarjeta', 'nequi', 'daviplata', 'paypal', 'inversiones', 'otros',
]);

function collectIds(records, area, issues) {
  const seen = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    if (!r || typeof r !== 'object') continue;
    if (typeof r.id !== 'string' || !r.id) {
      issues.push({ level: 'error', area, ref: null, message: 'Registro sin id.' });
      continue;
    }
    if (seen.has(r.id)) {
      issues.push({ level: 'error', area, ref: r.id, message: `Id duplicado: "${r.id}".` });
    } else {
      seen.set(r.id, true);
    }
  }
}

// ---- Validadores por tipo ----

function validateMovementAmount(amount, area, issues) {
  const n = Number(amount);
  if (!Number.isFinite(n)) {
    issues.push({ level: 'error', area, ref: null, message: 'Monto no numérico o infinito.' });
    return null;
  }
  if (n <= 0) {
    issues.push({ level: 'error', area, ref: null, message: 'Monto debe ser mayor a 0.' });
    return null;
  }
  return n;
}

function validateRecordDate(date, area, issues) {
  if (!isValidDate(date)) {
    issues.push({ level: 'error', area, ref: null, message: `Fecha inválida: "${date}".` });
    return false;
  }
  return true;
}

function validateRefs(refs, known, area, issues) {
  let ok = true;
  for (const ref of refs) {
    if (typeof ref !== 'string' || !known.has(ref)) {
      issues.push({ level: 'error', area, ref, message: `Referencia inexistente: "${ref}".` });
      ok = false;
    }
  }
  return ok;
}

export function validateExpense(e, ctx) {
  const issues = [];
  validateMovementAmount(e.amount, 'gastos', issues);
  validateRecordDate(e.date, 'gastos', issues);
  validateRefs([e.category], ctx.categories, 'gastos', issues);
  validateRefs([e.account], ctx.accounts, 'gastos', issues);
  return issues;
}

export function validateIncome(i, ctx) {
  const issues = [];
  validateMovementAmount(i.amount, 'ingresos', issues);
  validateRecordDate(i.date, 'ingresos', issues);
  validateRefs([i.account], ctx.accounts, 'ingresos', issues);
  return issues;
}

export function validateTransfer(t, ctx) {
  const issues = [];
  validateMovementAmount(t.amount, 'transferencias', issues);
  validateRecordDate(t.date, 'transferencias', issues);
  if (t.from === t.to) issues.push({ level: 'error', area: 'transferencias', ref: t.id, message: 'La transferencia es a la misma cuenta.' });
  validateRefs([t.from, t.to], ctx.accounts, 'transferencias', issues);
  return issues;
}

export function validateAccount(a, ctx) {
  const issues = [];
  if (typeof a.name !== 'string' || !a.name.trim()) issues.push({ level: 'error', area: 'cuentas', ref: a.id, message: 'Cuenta sin nombre.' });
  const n = Number(a.balance);
  if (!Number.isFinite(n)) issues.push({ level: 'error', area: 'cuentas', ref: a.id, message: 'Saldo de cuenta no numérico.' });
  if (typeof a.type === 'string' && a.type && !KNOWN_ACCOUNT_TYPES.has(a.type)) {
    issues.push({ level: 'warning', area: 'cuentas', ref: a.id, message: `Tipo de cuenta desconocido: "${a.type}".` });
  }
  return issues;
}

export function validateCategory(c) {
  const issues = [];
  if (typeof c.label !== 'string' || !c.label.trim()) issues.push({ level: 'error', area: 'categorias', ref: c.id, message: 'Categoría sin nombre.' });
  if (typeof c.id !== 'string' || !c.id) issues.push({ level: 'error', area: 'categorias', ref: null, message: 'Categoría sin id.' });
  return issues;
}

export function validateBudget(state) {
  const issues = [];
  const b = Number(state.budget);
  if (!Number.isFinite(b) || b < 0) issues.push({ level: 'error', area: 'presupuestos', ref: null, message: 'Presupuesto global inválido.' });
  const cb = state.catBudgets ?? {};
  for (const [cat, val] of Object.entries(cb)) {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) issues.push({ level: 'error', area: 'presupuestos', ref: cat, message: `Presupuesto de categoría "${cat}" inválido.` });
  }
  return issues;
}

export function validateRecurring(r, ctx) {
  const issues = [];
  validateMovementAmount(r.amount, 'recurrentes', issues);
  validateRecordDate(r.nextDate, 'recurrentes', issues);
  validateRefs([r.category], ctx.categories, 'recurrentes', issues);
  validateRefs([r.account], ctx.accounts, 'recurrentes', issues);
  return issues;
}

export function validateGoal(g) {
  const issues = [];
  const t = Number(g.targetAmount);
  const s = Number(g.savedAmount);
  if (!Number.isFinite(t) || t <= 0) issues.push({ level: 'error', area: 'metas', ref: g.id, message: 'Meta sin monto objetivo válido.' });
  if (!Number.isFinite(s) || s < 0) issues.push({ level: 'error', area: 'metas', ref: g.id, message: 'Ahorro acumulado inválido.' });
  if (g.targetDate && !isValidDate(g.targetDate)) issues.push({ level: 'error', area: 'metas', ref: g.id, message: 'Fecha objetivo inválida.' });
  if (Number.isFinite(t) && Number.isFinite(s) && s > t) {
    issues.push({ level: 'warning', area: 'metas', ref: g.id, message: 'Ahorro acumulado supera el objetivo.' });
  }
  return issues;
}

export function validateDebt(d) {
  const issues = [];
  const o = Number(d.originalAmount);
  const bal = Number(d.balance);
  if (!Number.isFinite(o) || o <= 0) issues.push({ level: 'error', area: 'deudas', ref: d.id, message: 'Deuda sin monto original válido.' });
  if (!Number.isFinite(bal) || bal < 0) issues.push({ level: 'error', area: 'deudas', ref: d.id, message: 'Saldo de deuda inválido.' });
  if (Number.isFinite(o) && Number.isFinite(bal) && bal > o) {
    issues.push({ level: 'warning', area: 'deudas', ref: d.id, message: 'El saldo pendiente supera el monto original.' });
  }
  return issues;
}

// ---- Analizador global ----

export function analyzeState(state) {
  const issues = [];
  if (!state || typeof state !== 'object') {
    return { ok: false, counts: { error: 1, warning: 0 }, issues: [{ level: 'error', area: 'estado', ref: null, message: 'No hay datos.' }], summary: 'No hay datos que analizar.' };
  }

  const categories = new Set((state.categories ?? []).filter((c) => c && typeof c.id === 'string').map((c) => c.id));
  const accounts = new Set((state.accounts ?? []).filter((a) => a && typeof a.id === 'string').map((a) => a.id));
  const ctx = { categories, accounts };

  collectIds(state.expenses, 'gastos', issues);
  collectIds(state.income, 'ingresos', issues);
  collectIds(state.transfers, 'transferencias', issues);
  collectIds(state.accounts, 'cuentas', issues);
  collectIds(state.categories, 'categorias', issues);
  collectIds(state.recurring, 'recurrentes', issues);
  collectIds(state.goals, 'metas', issues);
  collectIds(state.debts, 'deudas', issues);

  for (const e of state.expenses ?? []) issues.push(...validateExpense(e, ctx));
  for (const i of state.income ?? []) issues.push(...validateIncome(i, ctx));
  for (const t of state.transfers ?? []) issues.push(...validateTransfer(t, ctx));
  for (const a of state.accounts ?? []) issues.push(...validateAccount(a, ctx));
  for (const c of state.categories ?? []) issues.push(...validateCategory(c));
  issues.push(...validateBudget(state));
  for (const r of state.recurring ?? []) issues.push(...validateRecurring(r, ctx));
  for (const g of state.goals ?? []) issues.push(...validateGoal(g));
  for (const d of state.debts ?? []) issues.push(...validateDebt(d));

  if (!Array.isArray(state.expenses) || !Array.isArray(state.income) || !Array.isArray(state.accounts)) {
    issues.push({ level: 'error', area: 'estado', ref: null, message: 'Faltan colecciones obligatorias (gastos, ingresos o cuentas).' });
  }

  const counts = { error: 0, warning: 0 };
  for (const it of issues) counts[it.level] += 1;

  return {
    ok: counts.error === 0 && counts.warning === 0,
    counts,
    issues,
    summary: counts.error === 0 && counts.warning === 0
      ? 'Estado de datos: Excelente'
      : `Se encontraron ${counts.error + counts.warning} inconsistencia${counts.error + counts.warning === 1 ? '' : 's'}.`,
  };
}

// ---- Correcciones seguras (nunca eliminan registros) ----

function round2(n) { return Math.round(n * 100) / 100; }

export function safeFixState(state) {
  const s = JSON.parse(JSON.stringify(state));
  let fixed = 0;

  if (!Number.isFinite(Number(s.budget)) || s.budget < 0) { s.budget = config.defaultBudget; fixed++; }

  const catBudgets = s.catBudgets ?? {};
  for (const [cat, val] of Object.entries(catBudgets)) {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) { catBudgets[cat] = 0; fixed++; }
  }
  s.catBudgets = catBudgets;

  const fixRecord = (r, area, needsCategory, needsAccount) => {
    if (!r || typeof r !== 'object') return;
    const amt = Number(r.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      r.amount = round2(Number.isFinite(amt) ? Math.max(amt, 0.01) : 0);
      fixed++;
    } else {
      const rounded = round2(amt);
      if (rounded !== amt) { r.amount = rounded; fixed++; }
    }
    if (!isValidDate(r.date)) { r.date = new Date().toISOString().slice(0, 10); fixed++; }
    if (needsCategory && (typeof r.category !== 'string' || !(s.categories ?? []).some((c) => c.id === r.category))) {
      r.category = 'otros'; fixed++;
    }
    if (needsAccount && (typeof r.account !== 'string' || !(s.accounts ?? []).some((a) => a.id === r.account))) {
      r.account = (s.accounts ?? [])[0]?.id ?? 'efectivo'; fixed++;
    }
  };

  for (const e of s.expenses ?? []) fixRecord(e, 'gastos', true, true);
  for (const i of s.income ?? []) fixRecord(i, 'ingresos', false, true);
  for (const t of s.transfers ?? []) {
    if (!t || typeof t !== 'object') continue;
    const amt = Number(t.amount);
    if (!Number.isFinite(amt) || amt <= 0) { t.amount = round2(Number.isFinite(amt) ? Math.max(amt, 0.01) : 0); fixed++; }
    if (!isValidDate(t.date)) { t.date = new Date().toISOString().slice(0, 10); fixed++; }
    if (t.from === t.to) { t.to = (s.accounts ?? []).find((a) => a.id !== t.from)?.id ?? t.to; fixed++; }
    if (!(s.accounts ?? []).some((a) => a.id === t.from)) { t.from = (s.accounts ?? [])[0]?.id ?? 'efectivo'; fixed++; }
    if (!(s.accounts ?? []).some((a) => a.id === t.to)) { t.to = (s.accounts ?? [])[0]?.id ?? 'efectivo'; fixed++; }
  }

  const usedIds = new Set();
  const collect = (records) => {
    for (const r of records ?? []) {
      if (r && typeof r.id === 'string' && r.id) usedIds.add(r.id);
    }
  };
  collect(s.expenses); collect(s.income); collect(s.transfers);
  collect(s.accounts); collect(s.categories); collect(s.recurring);
  collect(s.goals); collect(s.debts);

  const dedupe = (records, prefix) => {
    const seen = new Set();
    for (const r of records ?? []) {
      if (!r || typeof r !== 'object') continue;
      if (!r.id || seen.has(r.id) || usedIds.has(r.id)) {
        r.id = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        fixed++;
      }
      seen.add(r.id);
      usedIds.add(r.id);
    }
  };
  dedupe(s.expenses, 'exp'); dedupe(s.income, 'inc'); dedupe(s.transfers, 'trf');
  dedupe(s.accounts, 'acct'); dedupe(s.categories, 'cat'); dedupe(s.recurring, 'rec');
  dedupe(s.goals, 'goal'); dedupe(s.debts, 'debt');

  for (const a of s.accounts ?? []) {
    if (a && !Number.isFinite(Number(a.balance))) { a.balance = 0; fixed++; }
  }

  return { state: s, fixed };
}
