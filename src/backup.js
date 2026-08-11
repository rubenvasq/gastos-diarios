// src/backup.js — respaldos con metadatos e historial de puntos de restauración.
// Formato de exportación: { kind, version, exportedAt, appVersion, data }.
// El historial vive en localStorage (clave propia) vía el adaptador db.js.

import { db } from './db.js';
import { STORAGE_VERSION } from './migrations.js';

export const BACKUP_KEY = 'gastosdiarios-backups-v1';
export const MAX_BACKUPS = 10;
const KIND = 'gastosdiarios-backup';
export const APP_VERSION = '3.0.0';

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `bk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Envelope estándar para exportación (JSON de la app) y respaldos.
export function createBackup(state) {
  return {
    kind: KIND,
    version: STORAGE_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    data: state,
  };
}

// Valida el TEXTO de un archivo. Acepta el envelope nuevo o el JSON plano de la
// v1/v2 (legacy). Devuelve el backup normalizado. Lanza Error si es inválido.
export function validateBackupText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es JSON válido.');
  }
  if (parsed && parsed.kind === KIND && parsed.data && typeof parsed.data === 'object') {
    return parsed;
  }
  const hasAny = ['expenses', 'income', 'accounts', 'transfers'].some((k) => Array.isArray(parsed?.[k]));
  if (hasAny) return createBackup(parsed);
  throw new Error('Archivo inválido: no contiene datos de GastosDiarios.');
}

export function listBackups() {
  try {
    const raw = db.get(BACKUP_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function persistBackups(items) {
  return db.set(BACKUP_KEY, JSON.stringify(items));
}

// Guarda un respaldo en el historial (no reemplaza datos actuales).
// Devuelve el item guardado, o null si no se pudo persistir (cuota/error).
export function saveBackup(state, opts = {}) {
  const backup = createBackup(state);
  const item = {
    id: uid(),
    createdAt: backup.exportedAt,
    size: JSON.stringify(backup).length,
    auto: opts.auto === true,
    label: opts.label || (opts.auto ? 'Respaldo automático' : 'Respaldo manual'),
    data: backup,
  };
  const items = [...listBackups(), item];
  while (items.length > MAX_BACKUPS) items.shift();
  return persistBackups(items) ? item : null;
}

export function getBackup(id) {
  return listBackups().find((b) => b.id === id) ?? null;
}

export function removeBackup(id) {
  persistBackups(listBackups().filter((b) => b.id !== id));
}

// Devuelve los datos del respaldo (ya validados) para restaurarlos.
export function restoreBackup(id) {
  const item = getBackup(id);
  if (!item) throw new Error('Respaldo no encontrado.');
  return validateBackupText(JSON.stringify(item.data)).data;
}

// Prepara los metadatos para la vista "Historial de respaldos".
export function backupSummary(b) {
  const size = b.size;
  const unit = size > 1024 * 1024 ? 'MB' : 'KB';
  const value = size > 1024 * 1024 ? (size / (1024 * 1024)).toFixed(1) : Math.max(1, Math.round(size / 1024));
  return {
    id: b.id,
    createdAt: b.createdAt,
    label: b.label,
    auto: b.auto,
    sizeLabel: `${value} ${unit}`,
  };
}
