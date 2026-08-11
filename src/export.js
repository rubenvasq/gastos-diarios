// src/export.js — exportación e importación de datos (JSON, CSV, texto).
// Funciones puras de generación + disparo de descarga del lado del navegador.

import { createBackup } from './backup.js';

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// El JSON exportado usa el envelope de respaldo: metadatos + versión + datos.
export function downloadJSON(state) {
  const backup = createBackup(state);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  triggerDownload(blob, `gastosdiarios-respaldo-${todayStamp()}.json`);
}

// Escapa una celda CSV (comas, comillas, saltos de línea).
export function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(rows) {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function downloadCSV(rows, name) {
  // BOM \uFEFF para que Excel interprete UTF-8 correctamente
  const blob = new Blob([`\uFEFF${toCSV(rows)}`], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `${name}.csv`);
}

export function downloadText(text, name) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  triggerDownload(blob, name);
}
