import config from '../theme.config.js';
import { CATEGORIES, getCategory } from './categories.js';
import {
  loadState,
  saveState,
  exportState,
  importState,
  createExpense,
  filterByMonth,
  sumExpenses,
  groupByCategory,
} from './storage.js';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const today = () => new Date().toISOString().slice(0, 10);

// '#4f46e5' -> '79 70 229'  (para las variables CSS que usa Tailwind)
function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function applyAccent(hex) {
  document.documentElement.style.setProperty('--accent', hexToRgb(hex));
}

function applyMode(mode) {
  const dark = mode === 'dark'
    || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

// Redibuja los iconos de Lucide tras un cambio del DOM de Alpine.
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('app', () => ({
    config,
    categories: CATEGORIES,

    state: loadState(),
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),

    form: { amount: '', category: CATEGORIES[0].id, description: '', date: today() },

    // Ajustes personalizables en vivo
    accent: config.theme.accent,
    mode: localStorage.getItem('gd-mode') || config.theme.defaultMode,
    settingsOpen: false,

    toast: '',

    init() {
      applyAccent(this.accent);
      applyMode(this.mode);

      this.$watch('accent', (v) => applyAccent(v));
      this.$watch('mode', (v) => { applyMode(v); localStorage.setItem('gd-mode', v); });

      // Sigue el modo del sistema si está en 'system'
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => { if (this.mode === 'system') applyMode('system'); });

      this.$nextTick(refreshIcons);
    },

    // ---- Datos derivados ----
    get monthExpenses() {
      return filterByMonth(this.state.expenses, this.viewYear, this.viewMonth);
    },
    get total() { return sumExpenses(this.monthExpenses); },
    get remaining() { return this.state.budget - this.total; },
    get pct() {
      return this.state.budget > 0 ? Math.min((this.total / this.state.budget) * 100, 100) : 0;
    },
    get monthLabel() { return `${MONTHS[this.viewMonth]} ${this.viewYear}`; },

    get sortedExpenses() {
      return [...this.monthExpenses].sort(
        (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
      );
    },

    get breakdown() {
      const groups = groupByCategory(this.monthExpenses);
      return Object.entries(groups)
        .sort((a, b) => b[1] - a[1])
        .map(([id, amount]) => ({
          cat: getCategory(id),
          amount,
          pct: this.total > 0 ? (amount / this.total) * 100 : 0,
        }));
    },

    get progressColor() {
      if (this.pct >= 90) return 'var(--rose)';
      if (this.pct >= 70) return 'var(--amber)';
      return 'rgb(var(--accent))';
    },

    get alert() {
      const b = this.state.budget;
      if (b > 0 && this.pct >= 100) return { kind: 'danger', text: 'Has superado tu presupuesto mensual.' };
      if (b > 0 && this.pct >= 90) return { kind: 'danger', text: 'Estás cerca de agotar tu presupuesto.' };
      if (b > 0 && this.remaining > 0 && this.monthExpenses.length > 0) {
        return { kind: 'ok', text: `Te quedan ${this.fmt(this.remaining)} disponibles este mes.` };
      }
      return null;
    },

    // ---- Helpers ----
    fmt(n) {
      return new Intl.NumberFormat(config.locale, {
        style: 'currency', currency: config.currency,
      }).format(n);
    },
    cat(id) { return getCategory(id); },
    dateLabel(d) {
      return new Date(d + 'T12:00:00').toLocaleDateString(config.locale, {
        weekday: 'short', day: 'numeric', month: 'short',
      });
    },

    // ---- Acciones ----
    addExpense() {
      const amount = parseFloat(this.form.amount);
      if (!amount || amount <= 0) return this.notify('Ingresa un monto válido.');

      this.state.expenses.push(createExpense({
        amount,
        category: this.form.category,
        description: this.form.description,
        date: this.form.date || today(),
      }));
      const saved = saveState(this.state);
      this.form = { amount: '', category: CATEGORIES[0].id, description: '', date: today() };
      this.$nextTick(refreshIcons);
      this.notify(saved
        ? `Gasto de ${this.fmt(amount)} registrado.`
        : 'Gasto registrado, pero no se pudo guardar en este dispositivo.');
    },

    removeExpense(id) {
      if (!confirm('¿Eliminar este gasto?')) return;
      this.state.expenses = this.state.expenses.filter((e) => e.id !== id);
      saveState(this.state);
      this.$nextTick(refreshIcons);
      this.notify('Gasto eliminado.');
    },

    setBudget(value) {
      const v = parseFloat(value);
      this.state.budget = Number.isFinite(v) && v >= 0 ? v : 0;
      saveState(this.state);
      this.notify('Presupuesto actualizado.');
    },

    changeMonth(delta) {
      this.viewMonth += delta;
      if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
      if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
      this.$nextTick(refreshIcons);
    },

    doExport() {
      exportState(this.state);
      this.notify('Datos exportados.');
    },

    async doImport(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        this.state = await importState(file);
        saveState(this.state);
        this.$nextTick(refreshIcons);
        this.notify('Datos importados correctamente.');
      } catch {
        this.notify('No se pudo importar el archivo.');
      }
      event.target.value = '';
    },

    notify(message) {
      this.toast = message;
      clearTimeout(this._t);
      this._t = setTimeout(() => { this.toast = ''; }, 2800);
    },
  }));
});
