// src/migrations.js — migraciones de estructura versionadas y ajustes por defecto.
// Todo cambio estructural del estado se hace aquí, de forma incremental y SIN
// perder datos. `migrateState()` detecta la versión de entrada y la sube hasta
// STORAGE_VERSION, devolviendo además si hubo migración (para avisar al usuario).

import config from '../theme.config.js';
import { CATEGORIES } from './categories.js';

export const STORAGE_VERSION = 3;

// v1 -> v2: remapea ids de categorías viejas.
const CATEGORY_ID_MAP = { comida: 'alimentacion', ocio: 'entretenimiento', hogar: 'vivienda' };

const LOCALES = ['es-CO', 'es-MX', 'es-ES', 'en-US'];
const CURRENCIES = ['COP', 'MXN', 'USD', 'EUR', 'PEN', 'CLP', 'ARS'];
const DATE_FORMATS = ['dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'];

export function defaultSettings() {
  return {
    currency: config.currency,
    locale: config.locale,
    dateFormat: config.dateFormat ?? 'dd/mm/yyyy',
  };
}

export function sanitizeSettings(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  return {
    currency: CURRENCIES.includes(o.currency) ? o.currency : config.currency,
    locale: LOCALES.includes(o.locale) ? o.locale : config.locale,
    dateFormat: DATE_FORMATS.includes(o.dateFormat) ? o.dateFormat : config.dateFormat ?? 'dd/mm/yyyy',
  };
}

export function defaultPrivacy() {
  return { pinEnabled: false, pin: null, hideAmounts: false, autoLockMinutes: 30 };
}

export function sanitizePrivacy(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const pin = typeof o.pin === 'string' ? o.pin : null;
  return {
    pinEnabled: o.pinEnabled === true,
    pin: pin && /^\d{4,6}$/.test(pin) ? pin : null,
    hideAmounts: o.hideAmounts === true,
    autoLockMinutes: Number.isFinite(o.autoLockMinutes) && o.autoLockMinutes > 0 ? o.autoLockMinutes : 30,
  };
}

// Devuelve { state, migrated }. `state` conserva todos los campos originales;
// solo garantiza/crea las estructuras de la versión actual.
export function migrateState(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const v = Number.isInteger(input.version) ? input.version : 1;
  const s = { ...input };
  const migrated = v < STORAGE_VERSION;

  if (v < 2) {
    s.expenses = (Array.isArray(s.expenses) ? s.expenses : []).map((e) => ({
      ...e,
      category: CATEGORY_ID_MAP[e.category] ?? e.category,
    }));
    if (s.catBudgets && typeof s.catBudgets === 'object') {
      const nb = {};
      for (const [k, val] of Object.entries(s.catBudgets)) nb[CATEGORY_ID_MAP[k] ?? k] = val;
      s.catBudgets = nb;
    }
  }

  // v2 -> v3: metas de ahorro, deudas, historial de actividad, widgets del
  // dashboard, comprobantes adjuntos y ajustes de privacidad. Solo se siembran
  // valores por defecto si la clave NO existe (nunca se pisan datos reales).
  if (v < 3) {
    if (!('goals' in s)) s.goals = [];
    if (!('debts' in s)) s.debts = [];
    if (!('activity' in s)) s.activity = [];
    if (!('widgets' in s)) s.widgets = [];
    if (!('receipts' in s)) s.receipts = {};
    if (!('privacy' in s)) s.privacy = defaultPrivacy();
  }

  // Garantías estructurales para cualquier versión.
  s.version = STORAGE_VERSION;
  s.transfers = Array.isArray(s.transfers) ? s.transfers : [];
  s.recurring = Array.isArray(s.recurring) ? s.recurring : [];
  s.categories = (Array.isArray(s.categories) && s.categories.length)
    ? s.categories
    : CATEGORIES.map((c) => ({ ...c }));
  s.settings = sanitizeSettings(s.settings ?? {});
  s.goals = Array.isArray(s.goals) ? s.goals : [];
  s.debts = Array.isArray(s.debts) ? s.debts : [];
  s.activity = Array.isArray(s.activity) ? s.activity : [];
  s.widgets = Array.isArray(s.widgets) ? s.widgets : [];
  s.receipts = (s.receipts && typeof s.receipts === 'object') ? s.receipts : {};
  s.privacy = sanitizePrivacy(s.privacy);

  return { state: s, migrated };
}
