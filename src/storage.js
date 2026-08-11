// src/storage.js — persistencia, migración y sanitización de datos.
// La app es 100% local (localStorage). Se mantiene la misma clave de
// almacenamiento de la v1 para NUNCA perder los datos del usuario;
// un `version` interno permite migrar estructuras nuevas.

import config from '../theme.config.js';
import { CATEGORIES } from './categories.js';
import { db } from './db.js';
import { STORAGE_VERSION, defaultSettings, sanitizeSettings, migrateState } from './migrations.js';
import { validateBackupText } from './backup.js';

export { STORAGE_VERSION } from './migrations.js';

export const STORAGE_KEY = 'gastosdiarios-v1';

// ---------------------------------------------------------------
// Tipos de cuenta (plantilla para crear/editar cuentas)
// ---------------------------------------------------------------
export const ACCOUNT_TYPES = [
  { id: 'banco',       label: 'Banco',             icon: 'landmark',    color: '#3B82F6' },
  { id: 'efectivo',    label: 'Efectivo',          icon: 'banknote',    color: '#10B981' },
  { id: 'ahorros',     label: 'Ahorros',           icon: 'piggy-bank',  color: '#F59E0B' },
  { id: 'tarjeta',     label: 'Tarjeta de crédito', icon: 'credit-card', color: '#8B5CF6' },
  { id: 'nequi',       label: 'Nequi',             icon: 'smartphone',  color: '#EC4899' },
  { id: 'daviplata',   label: 'Daviplata',         icon: 'smartphone',  color: '#06B6D4' },
  { id: 'paypal',      label: 'PayPal',            icon: 'globe',       color: '#0EA5E9' },
  { id: 'inversiones', label: 'Inversiones',       icon: 'trending-up', color: '#EF4444' },
  { id: 'otros',       label: 'Otras',             icon: 'wallet',      color: '#64748B' },
];

export const ACCOUNT_ICONS = [
  'landmark', 'banknote', 'piggy-bank', 'credit-card', 'smartphone',
  'globe', 'trending-up', 'wallet', 'coins', 'building-2',
];

export const FREQUENCIES = ['mensual', 'semanal', 'quincenal', 'anual'];

// Cuentas iniciales (se pueden crear/editar/eliminar en la app).
export const ACCOUNT_DEFAULTS = [
  { id: 'banco',       name: 'Cuenta bancaria',    type: 'banco',       icon: 'landmark',    color: '#3B82F6', balance: 1850000, currency: null, status: 'activa' },
  { id: 'efectivo',    name: 'Efectivo',           type: 'efectivo',    icon: 'banknote',    color: '#10B981', balance: 350000,  currency: null, status: 'activa' },
  { id: 'ahorro',      name: 'Ahorros',            type: 'ahorros',     icon: 'piggy-bank',  color: '#F59E0B', balance: 6200000, currency: null, status: 'activa' },
  { id: 'tarjeta',     name: 'Tarjeta de crédito', type: 'tarjeta',     icon: 'credit-card', color: '#8B5CF6', balance: 0,       currency: null, status: 'activa' },
  { id: 'nequi',       name: 'Nequi',              type: 'nequi',       icon: 'smartphone',  color: '#EC4899', balance: 250000,  currency: null, status: 'activa' },
  { id: 'daviplata',   name: 'Daviplata',          type: 'daviplata',   icon: 'smartphone',  color: '#06B6D4', balance: 120000,  currency: null, status: 'activa' },
  { id: 'inversiones', name: 'Inversiones',        type: 'inversiones', icon: 'trending-up', color: '#EF4444', balance: 8000000, currency: null, status: 'activa' },
];

// Presupuesto mensual por categoría (solo las que aparecen en las barras).
export const CAT_BUDGET_DEFAULTS = {
  alimentacion: 800000,
  transporte: 350000,
  entretenimiento: 250000,
  compras: 500000,
  salud: 200000,
  educacion: 300000,
  servicios: 200000,
  vivienda: 1500000,
  suscripciones: 150000,
  otros: 200000,
};

const CURRENCIES = ['COP', 'MXN', 'USD', 'EUR', 'PEN', 'CLP', 'ARS'];

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function round2(n) { return Math.round(n * 100) / 100; }

function isValidDateStr(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function pickNonNegative(obj) {
  const out = {};
  for (const k in obj) {
    const v = Number(obj[k]);
    if (Number.isFinite(v) && v >= 0) out[k] = v;
  }
  return out;
}

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------
// Ajustes del usuario (moneda, idioma, formato de fecha)
// (defaultSettings/sanitizeSettings viven en src/migrations.js)
// ---------------------------------------------------------------

// ---------------------------------------------------------------
// Estado por defecto (usuarios nuevos / restablecer)
// ---------------------------------------------------------------
export function defaultState() {
  return {
    version: STORAGE_VERSION,
    budget: config.defaultBudget,
    income: [],
    expenses: [],
    transfers: [],
    recurring: [],
    accounts: ACCOUNT_DEFAULTS.map((a) => ({ ...a })),
    categories: CATEGORIES.map((c) => ({ ...c })),
    catBudgets: { ...CAT_BUDGET_DEFAULTS },
    settings: defaultSettings(),
    goals: [],
    debts: [],
    activity: [],
    widgets: [],
    receipts: {},
    privacy: { pinEnabled: false, pin: null, hideAmounts: false, autoLockMinutes: 30 },
  };
}

// ---------------------------------------------------------------
// Normalizadores / sanitizadores (datos NO confiables: imports)
// ---------------------------------------------------------------
function guessType(id) {
  const map = { banco: 'banco', efectivo: 'efectivo', ahorro: 'ahorros', tarjeta: 'tarjeta', digital: 'nequi', inversiones: 'inversiones' };
  return map[id] ?? 'otros';
}

function normalizeAccount(raw, index = 0) {
  const typeId = ACCOUNT_TYPES.some((t) => t.id === raw?.type) ? raw.type : guessType(raw?.id);
  const type = ACCOUNT_TYPES.find((t) => t.id === typeId) ?? ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1];
  const balance = Number(raw?.balance);
  return {
    id: (typeof raw?.id === 'string' && raw.id) ? raw.id : `acct-${index}-${Date.now()}`,
    name: (typeof raw?.name === 'string' && raw.name.trim()) ? raw.name.trim() : (type?.label ?? 'Cuenta'),
    type: type.id,
    currency: (typeof raw?.currency === 'string' && CURRENCIES.includes(raw.currency)) ? raw.currency : null,
    icon: (typeof raw?.icon === 'string' && ACCOUNT_ICONS.includes(raw.icon)) ? raw.icon : (type?.icon ?? 'wallet'),
    color: (typeof raw?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.color)) ? raw.color : (type?.color ?? '#64748B'),
    balance: Number.isFinite(balance) ? round2(balance) : 0, // puede ser negativa (crédito)
    status: raw?.status === 'inactiva' ? 'inactiva' : 'activa',
    createdAt: (typeof raw?.createdAt === 'string' && raw.createdAt) ? raw.createdAt : new Date().toISOString(),
  };
}

function sanitizeExpense(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id: (typeof raw.id === 'string' && raw.id) ? raw.id : uid(),
    amount: round2(amount),
    category: typeof raw.category === 'string' ? raw.category : 'otros',
    description: (typeof raw.description === 'string' ? raw.description : '').slice(0, 100),
    note: (typeof raw.note === 'string' ? raw.note : '').slice(0, 500),
    date: isValidDateStr(raw.date) ? raw.date : todayStr(),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    account: typeof raw.account === 'string' ? raw.account : 'efectivo',
  };
}

function sanitizeIncome(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id: (typeof raw.id === 'string' && raw.id) ? raw.id : uid(),
    amount: round2(amount),
    description: (typeof raw.description === 'string' ? raw.description : '').slice(0, 100),
    note: (typeof raw.note === 'string' ? raw.note : '').slice(0, 500),
    date: isValidDateStr(raw.date) ? raw.date : todayStr(),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    account: typeof raw.account === 'string' ? raw.account : 'efectivo',
  };
}

function sanitizeTransfer(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id: (typeof raw.id === 'string' && raw.id) ? raw.id : uid(),
    amount: round2(amount),
    from: typeof raw.from === 'string' ? raw.from : 'efectivo',
    to: typeof raw.to === 'string' ? raw.to : 'efectivo',
    description: (typeof raw.description === 'string' ? raw.description : '').slice(0, 100),
    date: isValidDateStr(raw.date) ? raw.date : todayStr(),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

function sanitizeRecurring(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id: (typeof raw.id === 'string' && raw.id) ? raw.id : uid(),
    name: (typeof raw.name === 'string' && raw.name.trim()) ? raw.name.trim().slice(0, 60) : 'Pago recurrente',
    amount: round2(amount),
    category: typeof raw.category === 'string' ? raw.category : 'otros',
    account: typeof raw.account === 'string' ? raw.account : 'efectivo',
    frequency: FREQUENCIES.includes(raw.frequency) ? raw.frequency : 'mensual',
    nextDate: isValidDateStr(raw.nextDate) ? raw.nextDate : todayStr(),
    active: raw.active !== false,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

function sanitizeCategory(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: (typeof raw.id === 'string' && raw.id) ? raw.id : uid(),
    label: (typeof raw.label === 'string' && raw.label.trim()) ? raw.label.trim().slice(0, 30) : 'Categoría',
    icon: typeof raw.icon === 'string' ? raw.icon : 'tag',
    emoji: typeof raw.emoji === 'string' ? raw.emoji : '',
    color: (typeof raw.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.color)) ? raw.color : '#64748B',
  };
}

// ---------------------------------------------------------------
// Migración de estructura (v1 -> v2 -> v3)
// La lógica vive en src/migrations.js (migrateState), que garantiza
// las colecciones nuevas SIN perder datos y reporta si hubo cambio.
// ---------------------------------------------------------------
function buildState(p) {
  const s = migrateState(p).state;
  const catBudgets = (s.catBudgets && typeof s.catBudgets === 'object')
    ? { ...CAT_BUDGET_DEFAULTS, ...pickNonNegative(s.catBudgets) }
    : { ...CAT_BUDGET_DEFAULTS };
  const categories = (Array.isArray(s.categories) ? s.categories.map(sanitizeCategory).filter(Boolean) : []);
  const cats = categories.length ? categories : CATEGORIES.map((c) => ({ ...c }));
  const accounts = (Array.isArray(s.accounts) && s.accounts.length)
    ? s.accounts.map(normalizeAccount)
    : ACCOUNT_DEFAULTS.map((a) => ({ ...a }));

  return {
    version: STORAGE_VERSION,
    budget: (Number.isFinite(s.budget) && s.budget >= 0) ? s.budget : config.defaultBudget,
    income: (Array.isArray(s.income) ? s.income.map(sanitizeIncome) : []).filter(Boolean),
    expenses: (Array.isArray(s.expenses) ? s.expenses.map(sanitizeExpense) : []).filter(Boolean),
    transfers: (Array.isArray(s.transfers) ? s.transfers.map(sanitizeTransfer) : []).filter(Boolean),
    recurring: (Array.isArray(s.recurring) ? s.recurring.map(sanitizeRecurring) : []).filter(Boolean),
    accounts,
    categories: cats,
    catBudgets,
    settings: sanitizeSettings(s.settings),
    goals: Array.isArray(s.goals) ? s.goals : [],
    debts: Array.isArray(s.debts) ? s.debts : [],
    activity: Array.isArray(s.activity) ? s.activity : [],
    widgets: Array.isArray(s.widgets) ? s.widgets : [],
    receipts: (s.receipts && typeof s.receipts === 'object') ? s.receipts : {},
    privacy: s.privacy ?? { pinEnabled: false, pin: null, hideAmounts: false, autoLockMinutes: 30 },
  };
}

// ---------------------------------------------------------------
// API pública
// ---------------------------------------------------------------
// Devuelve { state, migrated }: `migrated` indica si la estructura fue
// actualizada en esta carga (para mostrar "Actualizando tus datos...").
export function loadState() {
  try {
    const raw = db.get(STORAGE_KEY);
    if (!raw) return { state: defaultState(), migrated: false };
    const parsed = JSON.parse(raw);
    const { state: migratedState, migrated } = migrateState(parsed);
    const state = buildState(migratedState);
    if (migrated) db.set(STORAGE_KEY, JSON.stringify(state)); // persistir la migración
    return { state, migrated };
  } catch {
    return { state: defaultState(), migrated: false };
  }
}

export function saveState(state) {
  return db.set(STORAGE_KEY, JSON.stringify(state));
}

// Recibe el TEXTO del archivo (no un File) para separar la lectura del parseo.
// Acepta tanto el envelope de respaldo (backup.js) como el JSON plano legacy.
export function importState(text) {
  const backup = validateBackupText(text);
  return buildState(backup.data ?? backup);
}

// ---------------------------------------------------------------
// Factories (movimientos, transferencias, recurrentes, cuentas, categorías)
// ---------------------------------------------------------------
export function createExpense({ amount, category, description, date, account, note = '' }) {
  return {
    id: uid(),
    amount: round2(amount),
    category,
    description: (description || '').trim(),
    note: (note || '').trim(),
    date,
    createdAt: new Date().toISOString(),
    account: account || 'efectivo',
  };
}

export function createIncome({ amount, description, date, account, note = '' }) {
  return {
    id: uid(),
    amount: round2(amount),
    description: (description || '').trim(),
    note: (note || '').trim(),
    date,
    createdAt: new Date().toISOString(),
    account: account || 'efectivo',
  };
}

export function createTransfer({ amount, from, to, description, date, note = '' }) {
  return {
    id: uid(),
    amount: round2(amount),
    from,
    to,
    description: (description || '').trim(),
    note: (note || '').trim(),
    date,
    createdAt: new Date().toISOString(),
  };
}

export function createRecurring({ name, amount, category, account, frequency = 'mensual', nextDate, active = true }) {
  return {
    id: uid(),
    name: (name || '').trim(),
    amount: round2(amount),
    category,
    account,
    frequency,
    nextDate,
    active: active !== false,
    createdAt: new Date().toISOString(),
  };
}

export function createAccount({ name, type = 'banco', icon = 'landmark', color = '#3B82F6', balance = 0, currency = null, status = 'activa' }) {
  const t = ACCOUNT_TYPES.find((x) => x.id === type) ?? ACCOUNT_TYPES[0];
  return {
    id: uid(),
    name: (name || '').trim(),
    type: t.id,
    icon: ACCOUNT_ICONS.includes(icon) ? icon : t.icon,
    color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : t.color,
    balance: round2(Number.isFinite(balance) ? balance : 0),
    currency: (typeof currency === 'string' && CURRENCIES.includes(currency)) ? currency : null,
    status: status === 'inactiva' ? 'inactiva' : 'activa',
    createdAt: new Date().toISOString(),
  };
}

export function createCategory({ label, icon = 'tag', emoji = '', color = '#64748B' }) {
  return {
    id: uid(),
    label: (label || '').trim(),
    icon,
    emoji,
    color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#64748B',
  };
}

export function createGoal({ name, targetAmount, savedAmount = 0, targetDate = null, icon = 'target', color = '#10B981' }) {
  return {
    id: uid(),
    name: (name || '').trim(),
    targetAmount: round2(Number.isFinite(Number(targetAmount)) && Number(targetAmount) > 0 ? Number(targetAmount) : 0),
    savedAmount: round2(Math.max(0, Number.isFinite(Number(savedAmount)) ? Number(savedAmount) : 0)),
    targetDate: targetDate || null,
    icon,
    color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#10B981',
    createdAt: new Date().toISOString(),
  };
}

export function createDebt({ name, creditor = '', originalAmount, balance, quota = 0, nextDate = null, status = 'activa', icon = 'banknote', color = '#EF4444' }) {
  const orig = round2(Number.isFinite(Number(originalAmount)) && Number(originalAmount) > 0 ? Number(originalAmount) : 0);
  const bal = round2(Math.min(orig, Math.max(0, Number.isFinite(Number(balance)) ? Number(balance) : orig)));
  return {
    id: uid(),
    name: (name || '').trim(),
    creditor: (creditor || '').trim(),
    originalAmount: orig,
    balance: bal,
    quota: round2(Math.max(0, Number.isFinite(Number(quota)) ? Number(quota) : 0)),
    nextDate: nextDate || null,
    status: status === 'pagada' ? 'pagada' : 'activa',
    icon,
    color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#EF4444',
    createdAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------
// Datos de ejemplo (usuario nuevo o "Cargar ejemplo")
// ---------------------------------------------------------------
export function demoState(y, m) {
  const accounts = ACCOUNT_DEFAULTS.map((a) => ({ ...a }));
  const catBudgets = { ...CAT_BUDGET_DEFAULTS };
  const expenses = [];
  const seed = [
    ['vivienda', 1200000, 'Arriendo', 1], ['transporte', 150000, 'Uber', 2], ['alimentacion', 480000, 'Supermercado', 3],
    ['alimentacion', 260000, 'Café y desayuno', 6], ['compras', 350000, 'Ropa nueva', 8], ['servicios', 120000, 'Internet y teléfono', 9],
    ['alimentacion', 780000, 'Restaurante', 12], ['transporte', 300000, 'Gasolina', 13], ['salud', 80000, 'Farmacia', 15],
    ['educacion', 250000, 'Curso online', 16], ['compras', 890000, 'Electrónica', 18], ['entretenimiento', 500000, 'Concierto', 20],
    ['suscripciones', 80000, 'Netflix', 20], ['otros', 180000, 'Regalos', 22], ['entretenimiento', 180000, 'Cine y palomitas', 5],
  ];
  for (const [cat, amt, desc, day] of seed) {
    expenses.push(createExpense({
      amount: amt, category: cat, description: desc,
      date: dateStr(y, m, day), account: day % 2 ? 'banco' : 'tarjeta',
    }));
  }

  const income = [
    createIncome({ amount: 4500000, description: 'Nómina', date: dateStr(y, m, 2), account: 'banco' }),
    createIncome({ amount: 600000, description: 'Freelance', date: dateStr(y, m, 12), account: 'daviplata' }),
  ];

  const transfers = [
    createTransfer({ amount: 200000, from: 'banco', to: 'efectivo', description: 'Retiro', date: dateStr(y, m, 4) }),
  ];

  const recurring = [
    createRecurring({ name: 'Internet', amount: 120000, category: 'servicios', account: 'banco', frequency: 'mensual', nextDate: dateStr(y, m, 15) }),
    createRecurring({ name: 'Netflix', amount: 80000, category: 'suscripciones', account: 'tarjeta', frequency: 'mensual', nextDate: dateStr(y, m, 20) }),
    createRecurring({ name: 'Spotify', amount: 35000, category: 'suscripciones', account: 'tarjeta', frequency: 'mensual', nextDate: dateStr(y, m, 22) }),
  ];

  const ba = (id, delta) => {
    const a = accounts.find((x) => x.id === id);
    if (a) a.balance = round2(a.balance + delta);
  };
  ba('banco', 4500000 - 2000 - 200000);
  ba('daviplata', 600000 - 250);
  ba('tarjeta', -1700);
  ba('efectivo', 200000);

  return {
    version: STORAGE_VERSION,
    budget: 4000000,
    income,
    expenses,
    transfers,
    recurring,
    accounts,
    categories: CATEGORIES.map((c) => ({ ...c })),
    catBudgets,
    settings: defaultSettings(),
    goals: [
      {
        id: 'goal-viaje',
        name: 'Viaje a la costa',
        targetAmount: 2500000,
        savedAmount: 900000,
        targetDate: dateStr(y, m + 1 < 12 ? m + 1 : 0, 15),
        color: '#0EA5E9',
        icon: 'plane',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'goal-emergencia',
        name: 'Fondo de emergencia',
        targetAmount: 10000000,
        savedAmount: 4200000,
        targetDate: null,
        color: '#10B981',
        icon: 'umbrella',
        createdAt: new Date().toISOString(),
      },
    ],
    debts: [
      {
        id: 'debt-tarjeta',
        name: 'Tarjeta de crédito',
        creditor: 'Banco ABC',
        originalAmount: 3200000,
        balance: 1250000,
        quota: 250000,
        rate: 2.5,
        nextDate: dateStr(y, m, 20),
        status: 'activa',
        color: '#EF4444',
        icon: 'credit-card',
        createdAt: new Date().toISOString(),
      },
    ],
    activity: [
      { id: 'act-init', timestamp: new Date().toISOString(), type: 'sistema', text: 'Datos de ejemplo cargados.' },
    ],
    widgets: [],
    receipts: {},
    privacy: { pinEnabled: false, pin: null, hideAmounts: false, autoLockMinutes: 30 },
  };
}

// ---------------------------------------------------------------
// Utilidades de datos (compat; la lógica nueva vive en stats.js)
// ---------------------------------------------------------------
export function filterByMonth(records, year, month) {
  return records.filter((r) => {
    const d = new Date(r.date + 'T12:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function sumExpenses(records) {
  return records.reduce((sum, r) => sum + r.amount, 0);
}

export function groupByCategory(expenses) {
  const groups = {};
  for (const expense of expenses) {
    groups[expense.category] = (groups[expense.category] ?? 0) + expense.amount;
  }
  return groups;
}
