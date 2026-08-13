import config from '../theme.config.js';
import * as store from './storage.js';
import * as stats from './stats.js';
import * as fin from './finance.js';
import * as validation from './validation.js';
import * as backup from './backup.js';
import { downloadJSON, downloadCSV, downloadText } from './export.js';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const NAV_ITEMS = [
  { id: 'inicio',       icon: 'layout-dashboard', label: 'Inicio' },
  { id: 'cuentas',      icon: 'wallet',           label: 'Cuentas' },
  { id: 'movimientos',  icon: 'receipt',          label: 'Movimientos' },
  { id: 'presupuestos', icon: 'gauge',            label: 'Presupuestos' },
  { id: 'reportes',     icon: 'chart-column',     label: 'Reportes' },
  { id: 'metas',        icon: 'target',           label: 'Metas' },
  { id: 'deudas',       icon: 'banknote',         label: 'Deudas' },
  { id: 'patrimonio',   icon: 'landmark',         label: 'Patrimonio' },
  { id: 'calendario',   icon: 'calendar-days',    label: 'Calendario' },
  { id: 'recurrentes',  icon: 'repeat',           label: 'Recurrentes' },
  { id: 'categorias',   icon: 'tags',             label: 'Categorías' },
];
// Configuración se abre como pantalla aparte desde el perfil (no va en el menú lateral)

const FREQUENCY_LABELS = {
  mensual: 'Cada mes',
  semanal: 'Cada semana',
  quincenal: 'Cada quincena',
  anual: 'Cada año',
};

// Widgets configurables del dashboard (Inicio).
const WIDGET_DEFS = [
  { id: 'kpis',     label: 'Indicadores principales', icon: 'layout-dashboard' },
  { id: 'accounts', label: 'Cuentas',                 icon: 'wallet' },
  { id: 'analytics', label: 'Análisis de gastos',     icon: 'chart-pie' },
  { id: 'budget',   label: 'Presupuesto del mes',     icon: 'gauge' },
  { id: 'recent',   label: 'Transacciones recientes', icon: 'receipt' },
  { id: 'insights', label: 'Resumen inteligente',     icon: 'sparkles' },
  { id: 'top',      label: 'Top gastos del mes',      icon: 'trophy' },
  { id: 'overview', label: 'Visión mensual',          icon: 'chart-line' },
];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// '#10B981' -> '16 185 129' (variables CSS de Tailwind)
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

function isDarkMode(mode) {
  return mode === 'dark'
    || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

document.addEventListener('alpine:init', () => {
  window.Alpine.data('app', () => {
    const loaded = store.loadState();
    return {
      // ---- Configuración y estado ----
      config,
      accountTypes: store.ACCOUNT_TYPES,
      accountIcons: store.ACCOUNT_ICONS,
      frequencies: store.FREQUENCIES,
      navItems: NAV_ITEMS,
      state: loaded.state,
      _migrated: loaded.migrated,

    // ---- Vista / navegación ----
    view: 'inicio',
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    sidebarOpen: false,
    sidebarCollapsed: false,
    _navLock: false,   // silencia el scroll-spy durante el scroll programático
    _navTimer: null,
    _spyTick: null,
    showConfig: false, // Configuración como pantalla aparte de lo principal
    notifOpen: false,
    profileOpen: false,
    fabOpen: false,

    // ---- Filtros de Movimientos ----
    search: '',
    txFilter: 'all', // all | expense | income | transfer
    txAccount: 'all',
    txCategory: 'all',
    dateFrom: '',
    dateTo: '',
    sortBy: 'date', // date | amount | description
    sortDir: 'desc',
    txLimit: 25, // paginación: cuántos movimientos se muestran a la vez
    txExpanded: false,

    // ---- Búsqueda global ----
    globalSearchOpen: false,
    globalQuery: '',

    // ---- Filtros de Reportes ----
    reportCategory: 'all',
    reportAccount: 'all',
    reportType: 'all',

    // ---- Modal de movimiento ----
    modalOpen: false,
    entryType: 'expense',
    editingId: null,
    form: { amount: '', category: null, description: '', account: '', toAccount: '', date: today(), note: '', receipts: [] },
    formError: '',

    // ---- Modal de cuenta ----
    accountModalOpen: false,
    accountForm: null,

    // ---- Modal de categoría ----
    catModalOpen: false,
    catForm: null,

    // ---- Modal de recurrente ----
    recModalOpen: false,
    recForm: null,

    // ---- Modal de meta ----
    goalModalOpen: false,
    goalForm: null,
    goalContribution: { id: null, amount: '', account: '' },
    goalContribOpen: false,

    // ---- Modal de deuda ----
    debtModalOpen: false,
    debtForm: null,
    debtPayment: { id: null, amount: '', account: '' },
    debtPayOpen: false,

    // ---- Confirmación / reasignación ----
    confirmOpen: false,
    confirmMessage: '',
    confirmTone: 'warn',
    confirmAction: null,
    reassignOpen: false,
    reassignCatId: null,
    reassignTarget: '',

    // ---- Análisis de datos ----
    analysisOpen: false,
    analysis: null,
    analysisFixed: 0,

    // ---- Calendario ----
    selectedDay: null,

    // ---- Privacidad / PIN ----
    locked: false,
    pinInput: '',
    pinError: '',
    pinDraft: '',
    revealAmounts: false,

    // ---- Apariencia ----
    accent: config.theme.accent,
    mode: localStorage.getItem('gd-mode') || config.theme.defaultMode,
    toast: '',
    _charts: {},

    // ---- Undo / historial ----
    _undoStack: [],
    _undoLimit: 20,
    _lastSaved: null,
    toastActionLabel: '',
    _toastActionFn: null,

    // ---- Actividad ----
    _activityLimit: 50,

    // Cache del análisis de salud (se invalida en _save/undo).
    _analysisCache: null,

    // ============================================================
    init() {
      applyAccent(this.accent);
      applyMode(this.mode);

      this.$watch('accent', (v) => applyAccent(v));
      this.$watch('mode', (v) => {
        applyMode(v);
        localStorage.setItem('gd-mode', v);
        this.$nextTick(() => this.renderCharts());
      });
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (this.mode === 'system') {
            applyMode('system');
            this.renderCharts();
          }
        });

      // El spy se registra aparte para que un fallo en renderCharts no lo impida
      this._setupScrollSpy();
      this._setupShortcuts();

      // Configuración como página con URL propia (#config): sincroniza con el
      // hash y restaura la pantalla correcta si se recarga estando en ella.
      window.addEventListener('hashchange', () => this._applyHash());
      this._applyHash();

      // PWA / offline: registra el service worker (no rompe nada en http://localhost
      // ni si el navegador no lo soporta).
      if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
      }

      // Privacidad: auto-lock al cargar si corresponde, y rastreo de actividad.
      this._checkAutoLock();
      window.addEventListener('pointerdown', () => this._trackActivity(), { passive: true });
      window.addEventListener('keydown', () => this._trackActivity(), { passive: true });

      // Snapshot base para el sistema de deshacer
      this._lastSaved = JSON.parse(JSON.stringify(this.state));

      // Aviso de migración de datos (v1/v2 -> v3)
      if (this._migrated) {
        this.notify('Actualizando tus datos...');
        setTimeout(() => this.notify('✓ Datos actualizados correctamente.'), 1400);
      }

      this.$nextTick(() => {
        refreshIcons();
        this.renderCharts();
      });
    },

    // Resalta en la barra lateral la sección donde estás al desplazarte
    _setupScrollSpy() {
      const ids = NAV_ITEMS.map((n) => n.id);
      const line = 96; // px desde arriba (justo bajo la topbar fija)
      const pick = () => {
        if (this._navLock || this.showConfig) return;
        let current = ids[0];
        for (const id of ids) {
          const el = document.getElementById('view-' + id);
          if (el && el.getBoundingClientRect().top - line <= 0) current = id;
        }
        // Al llegar al fondo, activa la última sección aunque sea corta
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
          current = ids[ids.length - 1];
        }
        if (this.view !== current) this.view = current;
      };
      // requestAnimationFrame para no recalcular en cada píxel de scroll
      const onScroll = () => {
        if (this._spyTick) return;
        this._spyTick = requestAnimationFrame(() => { this._spyTick = null; pick(); });
      };
      // capture:true para captar también el scroll de contenedores internos
      window.addEventListener('scroll', onScroll, { passive: true, capture: true });
      window.addEventListener('resize', onScroll, { passive: true });
      pick();
    },

    // Atajos de teclado: N/G gasto, I ingreso, T transferencia, / búsqueda,
    // D dashboard, Esc cerrar, Ctrl/Cmd+Z deshacer.
    _setupShortcuts() {
      window.addEventListener('keydown', (e) => {
        if (this.locked) return; // la pantalla de bloqueo consume todo
        const tag = e.target?.tagName;
        const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          if (typing) return; // deja que el navegador deshaga el texto en campos
          e.preventDefault();
          this.undo();
          return;
        }

        if (e.key === 'Escape') {
          if (this.globalSearchOpen) { this.closeGlobalSearch(); return; }
          if (this.modalOpen || this.accountModalOpen || this.catModalOpen || this.recModalOpen || this.goalModalOpen || this.debtModalOpen) {
            this.modalOpen = this.accountModalOpen = this.catModalOpen = this.recModalOpen = this.goalModalOpen = this.debtModalOpen = false;
          }
          return;
        }

        if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === '/') { e.preventDefault(); this.openGlobalSearch(); return; }

        const anyModal = this.modalOpen || this.accountModalOpen || this.catModalOpen || this.recModalOpen || this.goalModalOpen || this.debtModalOpen || this.confirmOpen;
        if (anyModal) return;

        const k = e.key.toLowerCase();
        if (k === 'n' || k === 'g') { e.preventDefault(); this.openTxModal('expense'); }
        else if (k === 'i') { e.preventDefault(); this.openTxModal('income'); }
        else if (k === 't') { e.preventDefault(); this.openTxModal('transfer'); }
        else if (k === 'd') { e.preventDefault(); this.goTo('inicio'); }
      });
    },

    // ============================================================
    // Búsqueda global
    // ============================================================
    openGlobalSearch() {
      this.globalQuery = '';
      this.globalSearchOpen = true;
      this.$nextTick(() => {
        const el = document.getElementById('global-search-input');
        if (el) el.focus();
      });
    },

    closeGlobalSearch() {
      this.globalSearchOpen = false;
      this.globalQuery = '';
    },

    get globalSearchResults() {
      const q = this.globalQuery.trim().toLowerCase();
      if (!q) return [];
      const match = (s) => String(s ?? '').toLowerCase().includes(q);
      const movements = this.allTx.filter((t) =>
        match(t.rec.description) || match(t.rec.note) || match(t.cat?.label) || match(this.txTypeLabel(t)));
      const accounts = this.accounts.filter((a) => match(a.name));
      const categories = this.categories.filter((c) => match(c.label));
      const groups = [];
      if (movements.length) groups.push({ key: 'movimientos', label: 'Movimientos', icon: 'receipt', items: movements.slice(0, 8) });
      if (accounts.length) groups.push({ key: 'cuentas', label: 'Cuentas', icon: 'wallet', items: accounts.slice(0, 6) });
      if (categories.length) groups.push({ key: 'categorias', label: 'Categorías', icon: 'tags', items: categories.slice(0, 6) });
      return groups;
    },

    globalPick(item, groupKey) {
      this.closeGlobalSearch();
      if (groupKey === 'movimientos') this.openTxModal(item.kind, item.rec);
      else if (groupKey === 'cuentas') this.goTo('cuentas');
      else if (groupKey === 'categorias') this.goTo('categorias');
    },

    // ============================================================
    // Historial de actividad
    // ============================================================
    get activityLog() {
      const acts = Array.isArray(this.state.activity) ? this.state.activity : [];
      return acts.slice().reverse();
    },

    activityDot(type) {
      const map = {
        gasto: 'bg-rose-500', ingreso: 'bg-emerald-500', transferencia: 'bg-sky-500',
        eliminacion: 'bg-rose-400', duplicado: 'bg-indigo-400', cuenta: 'bg-blue-400',
        categoria: 'bg-amber-400', recurrente: 'bg-violet-400', presupuesto: 'bg-teal-400',
        backup: 'bg-slate-400', datos: 'bg-slate-500', sistema: 'bg-slate-300',
      };
      return map[type] ?? 'bg-slate-400';
    },

    formatDateTime(iso) {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${dd}/${mm}/${d.getFullYear()} ${hh}:${mi}`;
    },

    // ============================================================
    // Datos derivados
    // ============================================================
    get categories() { return this.state.categories; },
    get accounts() { return this.state.accounts; },
    get activeAccounts() { return this.state.accounts.filter((a) => a.status === 'activa'); },

    get monthExpenses() { return stats.filterMonth(this.state.expenses, this.viewYear, this.viewMonth); },
    get monthIncome() { return stats.filterMonth(this.state.income, this.viewYear, this.viewMonth); },
    get monthTransfers() { return stats.filterMonth(this.state.transfers, this.viewYear, this.viewMonth); },
    get totalExpenses() { return fin.calculateExpenses(this.state, this.viewYear, this.viewMonth); },
    get totalIncome() { return fin.calculateIncome(this.state, this.viewYear, this.viewMonth); },
    get totalBalance() { return fin.calculateBalance(this.state); },
    get savings() { return fin.calculateSavings(this.state, this.viewYear, this.viewMonth); },
    get remainingBudget() { return this.state.budget - this.totalExpenses; },
    get budgetPct() {
      return fin.calculateBudgetUsage(this.state, this.viewYear, this.viewMonth).pct;
    },
    get monthLabel() { return `${MONTHS[this.viewMonth]} ${this.viewYear}`; },
    get activeLabel() {
      return NAV_ITEMS.find((n) => n.id === this.view)?.label ?? 'Inicio';
    },

    account(id) {
      return this.state.accounts.find((a) => a.id === id) ?? this.state.accounts[0];
    },
    accountTypeLabel(typeId) {
      return store.ACCOUNT_TYPES.find((t) => t.id === typeId)?.label ?? 'Otras';
    },
    frequencyLabel(f) { return FREQUENCY_LABELS[f] ?? 'Cada mes'; },
    category(id) {
      return this.state.categories.find((c) => c.id === id)
        ?? this.state.categories[this.state.categories.length - 1];
    },
    cat(id) { return this.category(id); },

    get prevTotals() {
      const y = this.viewMonth === 0 ? this.viewYear - 1 : this.viewYear;
      const m = this.viewMonth === 0 ? 11 : this.viewMonth - 1;
      return {
        income: stats.sum(stats.filterMonth(this.state.income, y, m)),
        expenses: stats.sum(stats.filterMonth(this.state.expenses, y, m)),
      };
    },

    get kpis() {
      const prev = this.prevTotals;
      const tInc = stats.pctChange(this.totalIncome, prev.income);
      const tExp = stats.pctChange(this.totalExpenses, prev.expenses);
      const savPct = this.totalIncome > 0 ? (this.savings / this.totalIncome) * 100 : null;
      return [
        {
          id: 'balance', label: 'Balance total', icon: 'wallet', color: '#10B981',
          value: this.fmt(this.totalBalance),
          chip: {
            text: `${this.savings >= 0 ? '+' : '−'} ${this.fmt(Math.abs(this.savings))} este mes`,
            tone: this.savings >= 0 ? 'good' : 'bad',
            icon: this.savings >= 0 ? 'arrow-up-right' : 'arrow-down-right',
          },
        },
        {
          id: 'income', label: 'Ingresos del mes', icon: 'trending-up', color: '#06B6D4',
          value: this.fmt(this.totalIncome),
          chip: tInc ? { text: `${tInc.up ? '+' : '−'}${tInc.pct}%`, tone: 'good', icon: tInc.up ? 'trending-up' : 'trending-down' } : null,
        },
        {
          id: 'expenses', label: 'Gastos del mes', icon: 'credit-card', color: '#F43F5E',
          value: this.fmt(this.totalExpenses),
          chip: tExp ? { text: `${tExp.up ? '+' : '−'}${tExp.pct}%`, tone: tExp.up ? 'bad' : 'good', icon: tExp.up ? 'trending-up' : 'trending-down' } : null,
        },
        {
          id: 'savings', label: 'Ahorro del mes', icon: 'piggy-bank', color: '#8B5CF6',
          value: this.fmt(this.savings),
          chip: savPct != null ? { text: `${savPct.toFixed(0)}% del ingreso`, tone: savPct >= 0 ? 'good' : 'bad', icon: null } : null,
        },
        {
          id: 'budget', label: 'Presupuesto restante', icon: 'gauge', color: '#F59E0B',
          value: this.fmt(this.remainingBudget),
          chip: {
            text: `${this.budgetPct}% usado`,
            tone: this.budgetPct >= 100 ? 'bad' : this.budgetPct >= 90 ? 'warn' : 'neutral',
            icon: null,
          },
        },
      ];
    },

    // ---- Movimientos unificados ----
    get allTx() {
      const list = [
        ...this.monthExpenses.map((e) => ({ kind: 'expense', rec: e, cat: this.category(e.category), acct: this.account(e.account), toAcct: null })),
        ...this.monthIncome.map((i) => ({ kind: 'income', rec: i, cat: null, acct: this.account(i.account), toAcct: null })),
        ...this.monthTransfers.map((t) => ({ kind: 'transfer', rec: t, cat: null, acct: this.account(t.from), toAcct: this.account(t.to) })),
      ];
      return list.sort((a, b) => b.rec.date.localeCompare(a.rec.date) || b.rec.createdAt.localeCompare(a.rec.createdAt));
    },

    get recentTx() { return this.allTx.slice(0, 8); },

    get filteredTx() {
      const q = this.search.trim().toLowerCase();
      let list = this.allTx.filter((t) => {
        if (this.txFilter !== 'all' && t.kind !== this.txFilter) return false;
        if (this.txAccount !== 'all') {
          const rec = t.rec;
          if (rec.account !== this.txAccount && rec.from !== this.txAccount && rec.to !== this.txAccount) return false;
        }
        if (this.txCategory !== 'all' && (t.kind !== 'expense' || t.rec.category !== this.txCategory)) return false;
        if (this.dateFrom && t.rec.date < this.dateFrom) return false;
        if (this.dateTo && t.rec.date > this.dateTo) return false;
        if (q) {
          const label = `${t.rec.description} ${t.kind === 'expense' ? t.cat.label : ''} ${t.acct?.name ?? ''} ${t.toAcct?.name ?? ''} ${this.txTypeLabel(t)}`.toLowerCase();
          if (!label.includes(q)) return false;
        }
        return true;
      });
      const dir = this.sortDir === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        if (this.sortBy === 'amount') return (a.rec.amount - b.rec.amount) * dir;
        if (this.sortBy === 'description') return a.rec.description.localeCompare(b.rec.description, config.locale) * dir;
        return (b.rec.date.localeCompare(a.rec.date) || b.rec.createdAt.localeCompare(a.rec.createdAt)) * dir;
      });
      return list;
    },

    get hasActiveFilters() {
      return this.search || this.txFilter !== 'all' || this.txAccount !== 'all'
        || this.txCategory !== 'all' || this.dateFrom || this.dateTo;
    },

    // Paginación de la tabla de movimientos.
    get visibleTx() {
      const list = this.filteredTx;
      const limit = this.txExpanded ? list.length : this.txLimit;
      return list.slice(0, limit);
    },
    get hiddenTxCount() { return Math.max(0, this.filteredTx.length - this.txLimit); },

    expandTx() { this.txExpanded = true; },
    collapseTx() { this.txExpanded = false; },

    get filteredTotals() {
      const list = this.filteredTx;
      return {
        expenses: list.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.rec.amount, 0),
        income: list.filter((t) => t.kind === 'income').reduce((s, t) => s + t.rec.amount, 0),
      };
    },

    txTypeLabel(t) {
      if (t.kind === 'expense') return 'Gasto';
      if (t.kind === 'income') return 'Ingreso';
      return 'Transferencia';
    },

    txStatus(t) {
      if (t.kind === 'income') return { label: 'Ingreso', icon: 'arrow-down-left', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' };
      if (t.kind === 'transfer') return { label: 'Transferencia', icon: 'arrow-right-left', cls: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400' };
      if (t.acct?.type === 'tarjeta') return { label: 'Crédito', icon: 'credit-card', cls: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400' };
      return { label: 'Pagado', icon: 'circle-check', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
    },

    // ---- Análisis / presupuesto ----
    get breakdown() {
      return [...stats.groupSum(this.monthExpenses, (e) => e.category).entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, amount]) => ({
          cat: this.category(id),
          amount,
          pct: this.totalExpenses > 0 ? (amount / this.totalExpenses) * 100 : 0,
        }));
    },

    get hasChartData() { return this.totalExpenses > 0; },

    get top5() {
      return stats.topExpenses(this.monthExpenses, 5).map((e) => ({
        ...e,
        cat: this.category(e.category),
        acct: this.account(e.account),
      }));
    },

    get allBudgetRows() {
      return this.categories.map((cat) => {
        const spent = stats.sum(this.monthExpenses.filter((e) => e.category === cat.id));
        const budget = this.state.catBudgets[cat.id] ?? 0;
        const raw = budget > 0 ? (spent / budget) * 100 : 0;
        const over = raw >= 100;
        const warn = !over && raw >= 90;
        return {
          cat, spent, budget, raw,
          pct: Math.min(raw, 100), over, warn,
          barColor: over ? '#F43F5E' : warn ? '#F59E0B' : cat.color,
        };
      });
    },
    get budgetRows() { return this.allBudgetRows.filter((r) => r.budget > 0); },

    get alert() {
      const b = this.state.budget;
      if (b > 0 && this.budgetPct >= 100) return { kind: 'danger', text: 'Has superado tu presupuesto mensual.' };
      if (b > 0 && this.budgetPct >= 90) return { kind: 'danger', text: 'Estás cerca de agotar tu presupuesto.' };
      if (b > 0 && this.remainingBudget > 0 && this.monthExpenses.length > 0) {
        return { kind: 'ok', text: `Te quedan ${this.fmt(this.remainingBudget)} disponibles este mes.` };
      }
      return null;
    },

    // ---- Alertas tipadas (info | warning | danger | success) ----
    get alerts() {
      const list = [];
      if (this.alert) {
        list.push({
          level: this.alert.kind === 'danger' ? 'danger' : 'success',
          icon: this.alert.kind === 'danger' ? 'triangle-alert' : 'circle-check',
          text: this.alert.text,
        });
      }
      this.budgetRows.forEach((r) => {
        if (r.over) list.push({ level: 'danger', icon: 'triangle-alert', text: `Presupuesto de ${r.cat.label} superado` });
        else if (r.warn) list.push({ level: 'warning', icon: 'circle-alert', text: `Queda poco presupuesto en ${r.cat.label}` });
      });
      const pend = this.recurringList.filter((r) => r.pending);
      if (pend.length) list.push({ level: 'warning', icon: 'bell-ring', text: `${pend.length} pago(s) recurrente(s) pendiente(s)` });
      if (this.upcomingCount) list.push({ level: 'info', icon: 'repeat', text: `${this.upcomingCount} pago(s) recurrente(s) próximos` });
      this.debtList.forEach((d) => {
        if (d.status === 'activa' && d.daysUntil != null && d.daysUntil <= 7) {
          list.push({ level: d.daysUntil <= 2 ? 'danger' : 'warning', icon: 'banknote', text: `Pago de "${d.name}" vence pronto (${this.formatDate(d.nextDate)})` });
        }
      });
      this.goalList.forEach((g) => {
        if (g.savedAmount >= g.targetAmount) list.push({ level: 'success', icon: 'trophy', text: `Meta "${g.name}" alcanzada. ¡Felicidades!` });
      });
      const health = this._analysisCache ?? (this._analysisCache = validation.analyzeState(this.state));
      if (health.ok && health.issues.length === 0) list.push({ level: 'success', icon: 'shield-check', text: 'Estado de datos: Excelente.' });
      else if (health.issues.length) list.push({ level: 'warning', icon: 'shield-alert', text: `Se encontraron ${health.issues.length} inconsistencia(s). Revisa Configuración → Análisis.` });
      return list.slice(0, 8);
    },
    get alertCount() { return this.alerts.length; },

    get notifications() {
      return this.alerts.map((a) => ({
        icon: a.icon,
        text: a.text,
        tone: a.level === 'danger' ? 'danger' : a.level === 'warning' ? 'warn' : 'info',
      }));
    },

    // ---- Insights ----
    get insights() {
      return stats.insights(this.state, this.viewYear, this.viewMonth, {
        fmt: (n) => this.fmt(n),
        catLabel: (id) => this.category(id).label,
      });
    },

    // ---- Recurrentes ----
    get recurringList() {
      const t = stats.todayStr();
      return this.state.recurring.map((rec) => {
        const pending = rec.active && rec.nextDate <= t;
        const daysUntil = Math.round((new Date(rec.nextDate + 'T12:00:00') - new Date(t + 'T12:00:00')) / 86400000);
        return { rec, pending, daysUntil, cat: this.category(rec.category), acct: this.account(rec.account) };
      }).sort((a, b) => a.rec.nextDate.localeCompare(b.rec.nextDate));
    },
    get pendingCount() { return this.recurringList.filter((r) => r.pending).length; },
    get upcomingCount() { return this.recurringList.filter((r) => !r.pending && r.daysUntil <= 7).length; },

    // ---- Metas ----
    get goalList() {
      const todayISO = stats.todayStr();
      return this.state.goals.map((g) => {
        const target = Number(g.targetAmount) || 0;
        const saved = Number(g.savedAmount) || 0;
        const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
        const daysLeft = g.targetDate ? Math.round((new Date(g.targetDate + 'T12:00:00') - new Date(todayISO + 'T12:00:00')) / 86400000) : null;
        return { ...g, target, saved, pct, daysLeft };
      });
    },

    // ---- Deudas ----
    get debtList() {
      const todayISO = stats.todayStr();
      return this.state.debts.map((d) => {
        const nextDate = d.nextDate || d.dueDate || '';
        const daysUntil = nextDate ? Math.round((new Date(nextDate + 'T12:00:00') - new Date(todayISO + 'T12:00:00')) / 86400000) : null;
        const original = Number(d.originalAmount) || 0;
        const balance = Number(d.balance) || 0;
        const quota = Number(d.quota) || 0;
        const pct = original > 0 ? Math.round(((original - balance) / original) * 100) : 0;
        return { ...d, original, balance, quota, pct, daysUntil, nextDate, status: d.status || 'activa' };
      });
    },
    get totalDebt() { return fin.calculateNetWorth(this.state).liabilities; },

    // ---- Patrimonio ----
    get patrimonio() { return fin.calculateNetWorth(this.state); },

    // Proyección de ahorro acumulado mes a mes (estimación para el año de la vista).
    get projection() {
      const monthly = fin.calculateMonthlyTotals(this.state, this.viewYear);
      let acc = 0;
      const now = new Date();
      return monthly.map((m, idx) => {
        acc += m.savings;
        return {
          month: idx,
          label: new Date(this.viewYear, idx, 1).toLocaleDateString('es-CO', { month: 'short' }),
          value: Math.round(acc * 100) / 100,
        };
      }).filter((p) => p.month >= now.getMonth());
    },

    // Serie estimada de evolución del patrimonio para el año de la vista.
    get patrimonioSeries() {
      const monthly = fin.calculateMonthlyTotals(this.state, this.viewYear);
      const now = new Date();
      const curMonth = Math.min(now.getMonth(), 11);
      const curNet = this.patrimonio.netWorth;
      let cumToDate = 0;
      for (let m = 0; m <= curMonth; m++) cumToDate += monthly[m].savings;
      let acc = curNet - cumToDate; // patrimonio estimado a inicios de año
      const series = [];
      for (let m = 0; m < 12; m++) {
        acc += monthly[m].savings;
        const label = new Date(this.viewYear, m, 1).toLocaleDateString('es-CO', { month: 'short' });
        series.push({ month: m, label, value: Math.round(acc * 100) / 100, past: m < curMonth });
      }
      return series;
    },

    // ---- Calendario ----
    get calendarCells() {
      const y = this.viewYear;
      const m = this.viewMonth;
      const startOffset = (new Date(y, m, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const ds = stats.dayStats(this.state.expenses, y, m);
      const todayISO = stats.todayStr();
      let maxTotal = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const st = ds.get(d);
        if (st && st.total > maxTotal) maxTotal = st.total;
      }
      const cells = [];
      for (let i = 0; i < startOffset; i++) cells.push({ empty: true });
      for (let d = 1; d <= daysInMonth; d++) {
        const st = ds.get(d);
        const dateISO = stats.dateStr(y, m, d);
        cells.push({
          empty: false, day: d, date: dateISO,
          total: st?.total ?? 0, count: st?.count ?? 0,
          isToday: dateISO === todayISO,
          ratio: maxTotal ? (st?.total ?? 0) / maxTotal : 0,
        });
      }
      while (cells.length % 7) cells.push({ empty: true });
      return cells;
    },

    get calendarMonthTotal() { return this.totalExpenses; },
    get calendarSpendDays() { return this.calendarCells.filter((c) => !c.empty && c.total > 0).length; },

    get selectedDayTx() {
      if (!this.selectedDay) return [];
      const day = this.selectedDay;
      const list = [
        ...this.state.expenses.filter((e) => e.date === day).map((e) => ({ kind: 'expense', rec: e, cat: this.category(e.category), acct: this.account(e.account), toAcct: null })),
        ...this.state.income.filter((i) => i.date === day).map((i) => ({ kind: 'income', rec: i, cat: null, acct: this.account(i.account), toAcct: null })),
        ...this.state.transfers.filter((t) => t.date === day).map((t) => ({ kind: 'transfer', rec: t, cat: null, acct: this.account(t.from), toAcct: this.account(t.to) })),
      ];
      return list.sort((a, b) => b.rec.createdAt.localeCompare(a.rec.createdAt));
    },

    // ---- Reportes ----
    get reportExpenses() {
      return this.monthExpenses.filter((e) =>
        (this.reportCategory === 'all' || e.category === this.reportCategory)
        && (this.reportAccount === 'all' || e.account === this.reportAccount));
    },
    get reportTotal() { return stats.sum(this.reportExpenses); },
    get reportByCategory() {
      return [...stats.groupSum(this.reportExpenses, (e) => e.category).entries()]
        .map(([id, amount]) => ({ cat: this.category(id), amount }))
        .sort((a, b) => b.amount - a.amount);
    },
    get reportByAccount() {
      return [...stats.groupSum(this.reportExpenses, (e) => e.account).entries()]
        .map(([id, amount]) => ({ acct: this.account(id), amount }))
        .sort((a, b) => b.amount - a.amount);
    },
    get reportsSeries() {
      const months = [];
      for (let k = 5; k >= 0; k--) {
        const d = new Date(this.viewYear, this.viewMonth - k, 1);
        const income = stats.sum(stats.filterMonth(this.state.income, d.getFullYear(), d.getMonth()));
        const expenses = stats.sum(stats.filterMonth(this.state.expenses, d.getFullYear(), d.getMonth()));
        months.push({ label: MONTHS_SHORT[d.getMonth()], income, expenses, net: income - expenses });
      }
      return months;
    },
    get evolutionSeries() {
      let acc = 0;
      return this.reportsSeries.map((m) => ({ label: m.label, value: (acc += m.net) }));
    },
    get savingsSeries() {
      return this.reportsSeries.map((m) => ({ label: m.label, value: m.net }));
    },

    // ============================================================
    // Formato
    // ============================================================
    currency() { return this.state.settings.currency || config.currency; },
    locale() { return this.state.settings.locale || config.locale; },
    fmt(n) {
      if (!this._amountVisible()) return '••••';
      return new Intl.NumberFormat(this.locale(), {
        style: 'currency', currency: this.currency(),
      }).format(n);
    },
    compactFmt(n) {
      if (!this._amountVisible()) return '••••';
      return new Intl.NumberFormat(this.locale(), {
        style: 'currency', currency: this.currency(),
        notation: 'compact', maximumFractionDigits: 1,
      }).format(n);
    },
    formatDate(d) {
      if (!d) return '';
      const [y, m, day] = d.split('-');
      const fmt = this.state.settings.dateFormat || 'dd/mm/yyyy';
      if (fmt === 'mm/dd/yyyy') return `${m}/${day}/${y}`;
      if (fmt === 'yyyy-mm-dd') return `${y}-${m}-${day}`;
      return `${day}/${m}/${y}`;
    },
    dateLabel(d) {
      return new Date(d + 'T12:00:00').toLocaleDateString(this.locale(), {
        weekday: 'short', day: 'numeric', month: 'short',
      });
    },
    tableDate(d) {
      return new Date(d + 'T12:00:00').toLocaleDateString(this.locale(), {
        day: '2-digit', month: 'short',
      });
    },

    // ============================================================
    // Navegación
    // ============================================================
    goTo(id) {
      if (this.showConfig) this.showConfig = false;
      if (location.hash === '#config') {
        history.replaceState(null, '', location.pathname + location.search);
      }
      this.view = id;
      this.sidebarOpen = false;
      this.fabOpen = false;
      // Bloquea el scroll-spy mientras dura el desplazamiento programático
      this._navLock = true;
      clearTimeout(this._navTimer);
      this._navTimer = setTimeout(() => { this._navLock = false; }, 700);
      this.$nextTick(() => {
        const el = document.getElementById('view-' + id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
        refreshIcons();
        this.renderCharts();
      });
    },

    // Configuración: página aparte con su propia URL (#config), accesible
    // desde el desplegable del perfil. Al usar el hash se comporta como una
    // página real: cambia la URL, funciona el botón "atrás" y persiste al recargar.
    openConfig() {
      this.profileOpen = false;
      this.sidebarOpen = false;
      this.fabOpen = false;
      if (location.hash !== '#config') location.hash = 'config'; // dispara _applyHash
      else this._applyHash();
    },

    closeConfig() {
      // Quita el hash sin dejar el '#' colgando; sincroniza el estado a mano
      // porque replaceState no dispara el evento hashchange.
      if (location.hash === '#config') {
        history.replaceState(null, '', location.pathname + location.search);
      }
      this.showConfig = false;
      window.scrollTo({ top: 0 });
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    // Sincroniza showConfig con la URL. Se llama al cargar y en cada hashchange.
    _applyHash() {
      const wantConfig = location.hash === '#config';
      if (wantConfig === this.showConfig) return;
      this.showConfig = wantConfig;
      if (wantConfig) {
        this.profileOpen = false;
        this.sidebarOpen = false;
        this.fabOpen = false;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.$nextTick(refreshIcons);
      } else {
        window.scrollTo({ top: 0 });
        this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
      }
    },

    changeMonth(delta) {
      this.viewMonth += delta;
      if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
      if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
      this.selectedDay = null;
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    goToToday() {
      this.viewYear = new Date().getFullYear();
      this.viewMonth = new Date().getMonth();
      this.selectedDay = stats.todayStr();
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    // ============================================================
    // Dashboard configurable
    // ============================================================
    get widgetDefs() { return WIDGET_DEFS; },

    get _enabledWidgets() {
      const saved = Array.isArray(this.state.widgets) ? this.state.widgets : [];
      if (!saved.length) return new Set(WIDGET_DEFS.map((w) => w.id));
      return new Set(saved);
    },

    widgetOn(id) { return this._enabledWidgets.has(id); },

    toggleWidget(id) {
      const set = new Set(this._enabledWidgets);
      if (set.has(id)) set.delete(id); else set.add(id);
      const allOn = WIDGET_DEFS.every((w) => set.has(w.id));
      this.state.widgets = allOn ? [] : WIDGET_DEFS.map((w) => w.id).filter((x) => set.has(x));
      this._save();
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    resetWidgets() {
      this.state.widgets = [];
      this._save();
      this.notify('Dashboard restablecido a la configuración por defecto.');
    },

    clearTxFilters() {
      this.search = '';
      this.txFilter = 'all';
      this.txAccount = 'all';
      this.txCategory = 'all';
      this.dateFrom = '';
      this.dateTo = '';
    },

    viewAccountMovements(id) {
      this.txAccount = id;
      this.goTo('movimientos');
    },

    // ============================================================
    // Modal de movimiento (gasto / ingreso / transferencia)
    // ============================================================
    openTxModal(type, record = null) {
      this.entryType = type || 'expense';
      this.editingId = record ? record.id : null;
      const first = this.activeAccounts[0]?.id ?? this.accounts[0]?.id ?? '';
      const second = this.activeAccounts[1]?.id ?? this.accounts[1]?.id ?? first;
      if (record) {
        this.form = {
          amount: record.amount,
          category: record.category ?? this.categories[0]?.id,
          description: record.description ?? '',
          account: record.from ?? record.account ?? first,
          toAccount: record.to ?? '',
          date: record.date,
          note: record.note ?? '',
          receipts: [],
        };
      } else {
        this.form = {
          amount: '', category: this.categories[0]?.id, description: '',
          account: first, toAccount: type === 'transfer' ? second : '',
          date: today(), note: '', receipts: [],
        };
      }
      this.formError = '';
      this.modalOpen = true;
      this.fabOpen = false;
      this.$nextTick(refreshIcons);
    },

    _applyBalance(kind, amount, accountId, toId, sign) {
      const a = this.account(accountId);
      const b = this.account(toId);
      if (kind === 'income') a.balance = Math.round((a.balance + amount * sign) * 100) / 100;
      else if (kind === 'expense') a.balance = Math.round((a.balance - amount * sign) * 100) / 100;
      else if (kind === 'transfer') {
        a.balance = Math.round((a.balance - amount * sign) * 100) / 100;
        b.balance = Math.round((b.balance + amount * sign) * 100) / 100;
      }
    },

    submitTx() {
      const amount = parseFloat(this.form.amount);
      if (!amount || amount <= 0) { this.formError = 'Ingresa un monto válido mayor a cero.'; return; }
      if (!this.form.account) { this.formError = 'Selecciona una cuenta.'; return; }
      if (this.entryType === 'transfer') {
        if (!this.form.toAccount) { this.formError = 'Selecciona la cuenta de destino.'; return; }
        if (this.form.account === this.form.toAccount) { this.formError = 'Las cuentas de origen y destino deben ser distintas.'; return; }
      }
      if (!this.form.date) { this.formError = 'Selecciona una fecha.'; return; }
      this.formError = '';
      const amountR = Math.round(amount * 100) / 100;
      const common = {
        amount: amountR,
        description: (this.form.description || '').trim(),
        date: this.form.date,
        note: (this.form.note || '').trim(),
      };

      // Edición: primero revierte el efecto del registro original
      if (this.editingId) this._revertRecord(this.editingId);

      if (this.entryType === 'income') {
        const rec = store.createIncome({ ...common, account: this.form.account });
        this.state.income.push(rec);
        this._applyBalance('income', amountR, this.form.account, null, 1);
        this._attachPendingReceipts(rec.id);
        this._logActivity('ingreso', this.editingId ? 'Ingreso actualizado' : `Ingreso de ${this.fmt(amountR)} registrado`);
        this.notify(this.editingId ? 'Ingreso actualizado.' : `Ingreso de ${this.fmt(amountR)} registrado.`);
      } else if (this.entryType === 'expense') {
        const rec = store.createExpense({ ...common, category: this.form.category, account: this.form.account });
        this.state.expenses.push(rec);
        this._applyBalance('expense', amountR, this.form.account, null, 1);
        this._attachPendingReceipts(rec.id);
        this._logActivity('gasto', this.editingId ? 'Gasto actualizado' : `Gasto de ${this.fmt(amountR)} registrado`);
        this.notify(this.editingId ? 'Gasto actualizado.' : `Gasto de ${this.fmt(amountR)} registrado.`);
      } else {
        const rec = store.createTransfer({ ...common, from: this.form.account, to: this.form.toAccount });
        this.state.transfers.push(rec);
        this._applyBalance('transfer', amountR, this.form.account, this.form.toAccount, 1);
        this._logActivity('transferencia', this.editingId ? 'Transferencia actualizada' : `Transferencia de ${this.fmt(amountR)}`);
        this.notify('Transferencia registrada.');
      }

      this.editingId = null;
      this._save();
      this.modalOpen = false;
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    // Revierte el efecto en los saldos del registro que se está editando.
    _revertRecord(id) {
      const e = this.state.expenses.find((x) => x.id === id);
      if (e) { this._applyBalance('expense', e.amount, e.account, null, -1); return; }
      const i = this.state.income.find((x) => x.id === id);
      if (i) { this._applyBalance('income', i.amount, i.account, null, -1); return; }
      const t = this.state.transfers.find((x) => x.id === id);
      if (t) { this._applyBalance('transfer', t.amount, t.from, t.to, -1); }
    },

    removeTx(t) {
      const label = this.txTypeLabel(t).toLowerCase();
      this.openConfirm(`¿Eliminar este ${label}? Esta acción revierte el saldo en tus cuentas.`, () => {
        this._applyBalance(t.kind, t.rec.amount, t.kind === 'transfer' ? t.rec.from : t.rec.account, t.kind === 'transfer' ? t.rec.to : null, -1);
        if (t.kind === 'expense') this.state.expenses = this.state.expenses.filter((x) => x.id !== t.rec.id);
        else if (t.kind === 'income') this.state.income = this.state.income.filter((x) => x.id !== t.rec.id);
        else this.state.transfers = this.state.transfers.filter((x) => x.id !== t.rec.id);
        if (this.state.receipts?.[t.rec.id]) delete this.state.receipts[t.rec.id];
        this._logActivity('eliminacion', `${this.txTypeLabel(t)} eliminado: ${t.rec.description || this.fmt(t.rec.amount)}`);
        this._save();
        this.notify('Movimiento eliminado.', 'DESHACER', () => this.undo());
        this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
      }, 'danger');
    },

    duplicateTx(t) {
      const common = {
        amount: t.rec.amount,
        description: t.rec.description,
        date: t.rec.date,
        note: t.rec.note,
      };
      if (t.kind === 'expense') {
        const rec = store.createExpense({ ...common, category: t.rec.category, account: t.rec.account });
        this.state.expenses.push(rec);
        this._applyBalance('expense', rec.amount, rec.account, null, 1);
      } else if (t.kind === 'income') {
        const rec = store.createIncome({ ...common, account: t.rec.account });
        this.state.income.push(rec);
        this._applyBalance('income', rec.amount, rec.account, null, 1);
      } else {
        const rec = store.createTransfer({ ...common, from: t.rec.from, to: t.rec.to });
        this.state.transfers.push(rec);
        this._applyBalance('transfer', rec.amount, rec.from, rec.to, 1);
      }
      this._logActivity('duplicado', `Movimiento duplicado: ${this.fmt(t.rec.amount)}`);
      this._save();
      this.notify('Movimiento duplicado.');
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    // ============================================================
    // Comprobantes (receipts) adjuntos a un movimiento
    // ============================================================
    // Lee un archivo de imagen, lo valida y lo comprime (canvas) a un
    // data URL almacenable. Límite: ~4MB de entrada, máx 1400px.
    _processReceiptFile(file) {
      return new Promise((resolve, reject) => {
        if (!file || !file.type) return reject('Archivo no válido.');
        const mime = file.type.toLowerCase();
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
          return reject('Formato no permitido. Usa JPG, PNG o WEBP.');
        }
        if (file.size > 4 * 1024 * 1024) return reject('La imagen supera el límite de 4MB.');
        const img = new Image();
        const reader = new FileReader();
        reader.onload = () => {
          img.onload = () => {
            const MAX = 1400;
            let { width, height } = img;
            if (width > MAX || height > MAX) {
              const scale = Math.min(MAX / width, MAX / height);
              width = Math.round(width * scale);
              height = Math.round(height * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
            resolve({ name: file.name, mime: 'image/jpeg', dataUrl, size: Math.round(dataUrl.length * 0.75) });
          };
          img.onerror = () => reject('No se pudo leer la imagen.');
          img.src = reader.result;
        };
        reader.onerror = () => reject('No se pudo leer el archivo.');
        reader.readAsDataURL(file);
      });
    },

    async onReceiptFile(event) {
      const file = event.target?.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const receipt = await this._processReceiptFile(file);
        if (!Array.isArray(this.form.receipts)) this.form.receipts = [];
        this.form.receipts.push(receipt);
        this.notify('Comprobante agregado.');
        this.$nextTick(refreshIcons);
      } catch (err) {
        this.notify(typeof err === 'string' ? err : 'No se pudo adjuntar el comprobante.');
      }
    },

    // Comprobantes ya guardados de un movimiento (edición).
    receiptsFor(id) {
      if (!id) return [];
      const list = this.state.receipts?.[id];
      return Array.isArray(list) ? list : [];
    },

    // Elimina un comprobante guardado (de inmediato; guarda el estado).
    removeReceipt(recordId, receiptId) {
      const list = this.state.receipts?.[recordId];
      if (!Array.isArray(list)) return;
      this.state.receipts[recordId] = list.filter((r) => r.id !== receiptId);
      if (!this.state.receipts[recordId].length) delete this.state.receipts[recordId];
      this._save();
      this.notify('Comprobante eliminado.');
      this.$nextTick(refreshIcons);
    },

    // Quita un comprobante aún no guardado (pendiente del formulario).
    dropPendingReceipt(index) {
      if (Array.isArray(this.form.receipts)) this.form.receipts.splice(index, 1);
    },

    // Persiste los comprobantes pendientes del formulario a un record id.
    _attachPendingReceipts(recordId) {
      const pending = Array.isArray(this.form.receipts) ? this.form.receipts : [];
      if (!pending.length) return;
      if (!this.state.receipts || typeof this.state.receipts !== 'object') this.state.receipts = {};
      if (!Array.isArray(this.state.receipts[recordId])) this.state.receipts[recordId] = [];
      for (const r of pending) {
        this.state.receipts[recordId].push({ id: (crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}`), ...r, createdAt: new Date().toISOString() });
      }
      this.form.receipts = [];
    },

    // ============================================================
    // Privacidad / PIN lock
    // ============================================================
    // Recalcula si la pantalla debe bloquearse al cargar (auto-lock).
    _checkAutoLock() {
      const p = this.state.privacy;
      if (!p?.pinEnabled) return;
      const ts = Number(localStorage.getItem('gd-last-activity') || 0);
      const min = Math.max(0, Number(p.autoLockMinutes) || 0);
      const expired = min > 0 && (Date.now() - ts) >= min * 60000;
      if (expired || localStorage.getItem('gd-locked') === '1') this.locked = true;
    },

    // Registra actividad del usuario (para el auto-lock).
    _trackActivity() {
      if (this.state.privacy?.pinEnabled) {
        const now = Date.now();
        const last = Number(localStorage.getItem('gd-last-activity') || 0);
        if (now - last > 60000) localStorage.setItem('gd-last-activity', String(now));
      }
    },

    lockNow() {
      if (!this.state.privacy?.pinEnabled) return this.notify('Activa un PIN en Configuración para bloquear la app.');
      localStorage.setItem('gd-locked', '1');
      this.pinInput = '';
      this.pinError = '';
      this.locked = true;
    },

    unlockApp() {
      const pin = String(this.state.privacy?.pin || '');
      if (!pin) { this.locked = false; return; }
      if (this.pinInput === pin) {
        localStorage.removeItem('gd-locked');
        localStorage.setItem('gd-last-activity', String(Date.now()));
        this.pinInput = '';
        this.pinError = '';
        this.locked = false;
        this.notify('Desbloqueado.');
      } else {
        this.pinError = 'PIN incorrecto. Inténtalo de nuevo.';
        this.pinInput = '';
      }
    },

    // Verifica si un monto debe mostrarse (oculta si activo y no revelado).
    _amountVisible() {
      return !this.state.privacy?.hideAmounts || this.revealAmounts;
    },

    setPin(enabled) {
      const p = this.state.privacy;
      if (enabled) {
        const pin = String(this.pinDraft || '').trim();
        if (!/^\d{4,6}$/.test(pin)) {
          return this.notify('Configura primero un PIN de 4 a 6 dígitos.');
        }
        p.pin = pin;
        p.pinEnabled = true;
        this.pinDraft = '';
        localStorage.setItem('gd-last-activity', String(Date.now()));
        this.notify('PIN activado.');
      } else {
        p.pinEnabled = false;
        p.pin = null;
        this.pinDraft = '';
        localStorage.removeItem('gd-locked');
        localStorage.removeItem('gd-last-activity');
        this.locked = false;
        this.notify('PIN desactivado.');
      }
      this._save();
    },

    toggleAmountsHidden() {
      this.state.privacy.hideAmounts = !this.state.privacy.hideAmounts;
      this.revealAmounts = false;
      this._save();
      this.notify(this.state.privacy.hideAmounts ? 'Montos ocultos.' : 'Montos visibles.');
    },

    // ============================================================
    // Cuentas
    // ============================================================
    openAccountModal(account = null) {
      const first = this.activeAccounts[0]?.id ?? '';
      const t = store.ACCOUNT_TYPES[0];
      this.accountForm = account
        ? { ...account }
        : { id: null, name: '', type: t.id, icon: t.icon, color: t.color, balance: 0, currency: '', status: 'activa' };
      this.accountModalOpen = true;
      this.$nextTick(refreshIcons);
    },

    submitAccount() {
      const f = this.accountForm;
      if (!f.name || !f.name.trim()) return this.notify('Escribe un nombre para la cuenta.');
      if (f.id) {
        const i = this.state.accounts.findIndex((a) => a.id === f.id);
        if (i >= 0) {
          const prev = this.state.accounts[i];
          this.state.accounts[i] = store.createAccount({ ...f, name: f.name, balance: prev.balance, createdAt: prev.createdAt });
          this.state.accounts[i].id = prev.id;
        }
        this._logActivity('cuenta', `Cuenta "${f.name}" actualizada`);
        this.notify('Cuenta actualizada.');
      } else {
        const acct = store.createAccount(f);
        this.state.accounts.push(acct);
        this._logActivity('cuenta', `Cuenta "${acct.name}" creada`);
        this.notify(`Cuenta "${acct.name}" creada.`);
      }
      this._save();
      this.accountModalOpen = false;
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    adjustBalance(delta) {
      // Reajuste manual del saldo: suma/resta al saldo actual (sin movimiento)
      if (!this.accountForm) return;
      this.accountForm.balance = Math.round((parseFloat(this.accountForm.balance) + delta) * 100) / 100;
    },

    deleteAccount(account) {
      const hasTx = this.state.expenses.some((e) => e.account === account.id)
        || this.state.income.some((i) => i.account === account.id)
        || this.state.transfers.some((t) => t.from === account.id || t.to === account.id);
      if (hasTx) return this.notify('No puedes eliminar una cuenta con movimientos. Reasigna sus movimientos primero.');
      this.openConfirm(`¿Eliminar la cuenta "${account.name}"?`, () => {
        this.state.accounts = this.state.accounts.filter((a) => a.id !== account.id);
        this._logActivity('cuenta', `Cuenta "${account.name}" eliminada`);
        this._save();
        this.notify('Cuenta eliminada.', 'DESHACER', () => this.undo());
        this.$nextTick(refreshIcons);
      }, 'danger');
    },

    setAccountBalance(id, value) {
      const v = parseFloat(value);
      if (Number.isFinite(v)) {
        const a = this.account(id);
        a.balance = Math.round(v * 100) / 100;
        this._save();
      }
    },

    // ============================================================
    // Categorías
    // ============================================================
    openCatModal(cat = null) {
      this.catForm = cat
        ? { ...cat }
        : { id: null, label: '', icon: 'tag', emoji: '', color: '#64748B' };
      this.catModalOpen = true;
      this.$nextTick(refreshIcons);
    },

    submitCategory() {
      const f = this.catForm;
      if (!f.label || !f.label.trim()) return this.notify('Escribe un nombre para la categoría.');
      if (f.id) {
        const i = this.state.categories.findIndex((c) => c.id === f.id);
        if (i >= 0) this.state.categories[i] = { id: f.id, label: f.label.trim(), icon: f.icon, emoji: f.emoji, color: f.color };
        this.notify('Categoría actualizada.');
      } else {
        const c = store.createCategory(f);
        this.state.categories.push(c);
        this.notify(`Categoría "${c.label}" creada.`);
      }
      this._save();
      this.catModalOpen = false;
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    categoryUsage(id) {
      return this.state.expenses.filter((e) => e.category === id).length;
    },

    deleteCategory(cat) {
      const used = this.categoryUsage(cat.id);
      if (used > 0) {
        this.reassignCatId = cat.id;
        this.reassignTarget = this.state.categories[this.state.categories.length - 1]?.id ?? '';
        this.reassignOpen = true;
        return;
      }
      this.openConfirm(`¿Eliminar la categoría "${cat.label}"?`, () => {
        this._removeCategory(cat.id);
      }, 'danger');
    },

    confirmReassign() {
      if (!this.reassignCatId || this.reassignCatId === this.reassignTarget) {
        this.reassignOpen = false;
        return;
      }
      this.state.expenses.forEach((e) => {
        if (e.category === this.reassignCatId) e.category = this.reassignTarget;
      });
      this._removeCategory(this.reassignCatId);
      this.reassignOpen = false;
      this.notify('Movimientos reasignados y categoría eliminada.');
    },

    _removeCategory(id) {
      const cat = this.state.categories.find((c) => c.id === id);
      this.state.categories = this.state.categories.filter((c) => c.id !== id);
      delete this.state.catBudgets[id];
      this._logActivity('categoria', `Categoría "${cat?.label ?? id}" eliminada`);
      this._save();
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    // ============================================================
    // Recurrentes
    // ============================================================
    openRecModal(rec = null) {
      const first = this.activeAccounts[0]?.id ?? '';
      this.recForm = rec
        ? { ...rec }
        : { id: null, name: '', amount: '', category: this.categories[0]?.id, account: first, frequency: 'mensual', nextDate: today(), active: true };
      this.recModalOpen = true;
      this.$nextTick(refreshIcons);
    },

    submitRecurring() {
      const f = this.recForm;
      const amount = parseFloat(f.amount);
      if (!f.name || !f.name.trim()) return this.notify('Escribe un nombre para el pago recurrente.');
      if (!amount || amount <= 0) return this.notify('Ingresa un monto válido.');
      if (!f.account) return this.notify('Selecciona una cuenta.');
      if (f.id) {
        const i = this.state.recurring.findIndex((r) => r.id === f.id);
        if (i >= 0) this.state.recurring[i] = store.createRecurring({ ...f, amount, createdAt: this.state.recurring[i].createdAt });
        this._logActivity('recurrente', `Pago recurrente "${f.name}" actualizado`);
        this.notify('Pago recurrente actualizado.');
      } else {
        this.state.recurring.push(store.createRecurring({ ...f, amount }));
        this._logActivity('recurrente', `Pago recurrente "${f.name}" creado`);
        this.notify('Pago recurrente creado.');
      }
      this._save();
      this.recModalOpen = false;
      this.$nextTick(refreshIcons);
    },

    registerRecurring(item) {
      const rec = store.createExpense({
        amount: item.rec.amount,
        category: item.rec.category,
        description: item.rec.name,
        date: stats.todayStr(),
        account: item.rec.account,
        note: 'Pago recurrente',
      });
      this.state.expenses.push(rec);
      this._applyBalance('expense', rec.amount, rec.account, null, 1);
      item.rec.nextDate = stats.nextRecurringDate(item.rec.nextDate, item.rec.frequency);
      this._logActivity('recurrente', `Pago recurrente "${item.rec.name}" registrado como gasto`);
      this._save();
      this.notify(`Gasto "${item.rec.name}" registrado. Próximo: ${this.formatDate(item.rec.nextDate)}`);
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    skipRecurring(item) {
      item.rec.nextDate = stats.nextRecurringDate(item.rec.nextDate, item.rec.frequency);
      this._save();
      this.notify('Pago omitido. Próxima fecha reprogramada.');
      this.$nextTick(refreshIcons);
    },

    toggleRecurring(item) {
      item.rec.active = !item.rec.active;
      this._save();
      this.$nextTick(refreshIcons);
    },

    deleteRecurring(item) {
      this.openConfirm(`¿Eliminar el pago recurrente "${item.rec.name}"?`, () => {
        this.state.recurring = this.state.recurring.filter((r) => r.id !== item.rec.id);
        this._logActivity('recurrente', `Pago recurrente "${item.rec.name}" eliminado`);
        this._save();
        this.notify('Pago recurrente eliminado.');
        this.$nextTick(refreshIcons);
      }, 'danger');
    },

    // ============================================================
    // Metas (objetivos financieros)
    // ============================================================
    openGoalModal(goal = null) {
      this.goalForm = goal
        ? { ...goal }
        : { id: null, name: '', targetAmount: '', savedAmount: 0, targetDate: '', icon: 'target', color: '#10B981' };
      this.goalModalOpen = true;
      this.$nextTick(refreshIcons);
    },

    submitGoal() {
      const f = this.goalForm;
      const target = parseFloat(f.targetAmount);
      if (!f.name || !f.name.trim()) return this.notify('Escribe un nombre para la meta.');
      if (!target || target <= 0) return this.notify('Ingresa una meta válida mayor a cero.');
      const saved = Math.min(parseFloat(f.savedAmount) || 0, target);
      if (f.id) {
        const i = this.state.goals.findIndex((g) => g.id === f.id);
        if (i >= 0) this.state.goals[i] = store.createGoal({ ...f, targetAmount: target, savedAmount: saved, createdAt: this.state.goals[i].createdAt });
        this._logActivity('meta', `Meta "${f.name}" actualizada`);
        this.notify('Meta actualizada.');
      } else {
        const goal = store.createGoal({ ...f, targetAmount: target, savedAmount: saved });
        this.state.goals.push(goal);
        this._logActivity('meta', `Meta "${goal.name}" creada`);
        this.notify(`Meta "${goal.name}" creada.`);
      }
      this._save();
      this.goalModalOpen = false;
      this.$nextTick(refreshIcons);
    },

    deleteGoal(goal) {
      this.openConfirm(`¿Eliminar la meta "${goal.name}"?`, () => {
        this.state.goals = this.state.goals.filter((g) => g.id !== goal.id);
        this._logActivity('meta', `Meta "${goal.name}" eliminada`);
        this._save();
        this.notify('Meta eliminada.');
        this.$nextTick(refreshIcons);
      }, 'danger');
    },

    // Registra un aporte (o retiro) a una meta desde una cuenta.
    adjustGoal(goal, amount, accountId, isWithdraw = false) {
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) return this.notify('Ingresa un monto válido.');
      if (!accountId) return this.notify('Selecciona una cuenta.');
      const acct = this.account(accountId);
      const delta = isWithdraw ? amt : -amt;
      const requested = goal.savedAmount + (isWithdraw ? -amt : amt);
      if (requested < 0) return this.notify('El aporte supera lo ahorrado para esta meta.');
      if (acct.balance - (isWithdraw ? -amt : amt) < 0) return this.notify('Saldo insuficiente en la cuenta seleccionada.');
      const id = goal.id;
      const i = this.state.goals.findIndex((g) => g.id === id);
      if (i < 0) return;
      this.state.goals[i].savedAmount = Math.round(requested * 100) / 100;
      acct.balance = Math.round((acct.balance + delta) * 100) / 100;
      this._logActivity('meta', isWithdraw ? `Retiro de ${this.fmt(amt)} de la meta "${goal.name}"` : `Aporte de ${this.fmt(amt)} a la meta "${goal.name}"`);
      this._save();
      this.notify(isWithdraw ? 'Retiro registrado.' : 'Aporte registrado.');
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    openGoalContribution(goal) {
      this.goalContribution = { id: goal.id, amount: '', account: this.activeAccounts[0]?.id ?? '', withdraw: false };
      this.goalContribOpen = true;
      this.$nextTick(refreshIcons);
    },

    submitGoalContribution() {
      const c = this.goalContribution;
      const goal = this.state.goals.find((g) => g.id === c.id);
      if (goal) this.adjustGoal(goal, c.amount, c.account, c.withdraw);
      this.goalContribOpen = false;
    },

    // ============================================================
    // Deudas
    // ============================================================
    openDebtModal(debt = null) {
      this.debtForm = debt
        ? { ...debt }
        : { id: null, name: '', creditor: '', originalAmount: '', balance: '', quota: 0, nextDate: today(), status: 'activa', icon: 'banknote', color: '#EF4444' };
      this.debtModalOpen = true;
      this.$nextTick(refreshIcons);
    },

    submitDebt() {
      const f = this.debtForm;
      const original = parseFloat(f.originalAmount);
      if (!f.name || !f.name.trim()) return this.notify('Escribe un nombre para la deuda.');
      if (!original || original <= 0) return this.notify('Ingresa un monto original válido.');
      let balance = f.balance === '' || f.balance == null ? original : parseFloat(f.balance);
      if (!Number.isFinite(balance) || balance < 0) balance = original;
      if (f.id) {
        const i = this.state.debts.findIndex((d) => d.id === f.id);
        if (i >= 0) this.state.debts[i] = store.createDebt({ ...f, originalAmount: original, balance: Math.min(balance, original), createdAt: this.state.debts[i].createdAt });
        this._logActivity('deuda', `Deuda "${f.name}" actualizada`);
        this.notify('Deuda actualizada.');
      } else {
        const debt = store.createDebt({ ...f, originalAmount: original, balance: Math.min(balance, original) });
        this.state.debts.push(debt);
        this._logActivity('deuda', `Deuda "${debt.name}" registrada`);
        this.notify(`Deuda "${debt.name}" registrada.`);
      }
      this._save();
      this.debtModalOpen = false;
      this.$nextTick(refreshIcons);
    },

    deleteDebt(debt) {
      this.openConfirm(`¿Eliminar la deuda "${debt.name}"?`, () => {
        this.state.debts = this.state.debts.filter((d) => d.id !== debt.id);
        this._logActivity('deuda', `Deuda "${debt.name}" eliminada`);
        this._save();
        this.notify('Deuda eliminada.');
        this.$nextTick(refreshIcons);
      }, 'danger');
    },

    // Pago de cuota: descuenta saldo de la deuda y opcionalmente registra gasto.
    openDebtPayment(debt) {
      this.debtPayment = { id: debt.id, amount: debt.quota || '', account: this.activeAccounts[0]?.id ?? '' };
      this.debtPayOpen = true;
      this.$nextTick(refreshIcons);
    },

    submitDebtPayment() {
      const p = this.debtPayment;
      const debt = this.state.debts.find((d) => d.id === p.id);
      if (!debt) return;
      const amt = parseFloat(p.amount);
      if (!amt || amt <= 0) return this.notify('Ingresa un monto de pago válido.');
      const acct = this.account(p.account);
      if (!acct) return this.notify('Selecciona una cuenta.');
      if (acct.balance - amt < 0) return this.notify('Saldo insuficiente en la cuenta seleccionada.');
      debt.balance = Math.max(0, Math.round((debt.balance - amt) * 100) / 100);
      acct.balance = Math.round((acct.balance - amt) * 100) / 100;
      this.state.expenses.push(store.createExpense({
        amount: amt,
        category: this.categories[0]?.id,
        description: `Pago de deuda: ${debt.name}`,
        date: stats.todayStr(),
        account: p.account,
        note: 'Pago de deuda',
      }));
      if (debt.balance <= 0) debt.status = 'pagada';
      this._logActivity('deuda', `Pago de ${this.fmt(amt)} a la deuda "${debt.name}"`);
      this._save();
      this.debtPayOpen = false;
      this.notify('Pago registrado.');
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    markDebtPaid(debt) {
      this.openConfirm(`¿Marcar "${debt.name}" como pagada?`, () => {
        const i = this.state.debts.findIndex((d) => d.id === debt.id);
        if (i >= 0) {
          this.state.debts[i].status = 'pagada';
          this.state.debts[i].balance = 0;
        }
        this._logActivity('deuda', `Deuda "${debt.name}" marcada como pagada`);
        this._save();
        this.notify('Deuda marcada como pagada.');
        this.$nextTick(refreshIcons);
      });
    },

    // ============================================================
    // Presupuestos y ajustes
    // ============================================================
    setBudget(value) {
      const v = parseFloat(value);
      this.state.budget = Number.isFinite(v) && v >= 0 ? v : 0;
      this._logActivity('presupuesto', `Presupuesto mensual: ${this.fmt(this.state.budget)}`);
      this._save();
      this.notify('Presupuesto mensual actualizado.');
      this.$nextTick(this.renderCharts);
    },

    setCatBudget(id, value) {
      const v = parseFloat(value);
      if (Number.isFinite(v) && v >= 0) {
        this.state.catBudgets[id] = Math.round(v * 100) / 100;
        this._save();
      }
    },

    setCurrency(value) {
      this.state.settings.currency = value;
      this._save();
      this.notify(`Moneda principal: ${value}`);
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },
    setLocale(value) {
      this.state.settings.locale = value;
      this._save();
      this.notify('Idioma actualizado.');
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },
    setDateFormat(value) {
      this.state.settings.dateFormat = value;
      this._save();
      this.notify('Formato de fecha actualizado.');
    },

    // ============================================================
    // Exportación / importación
    // ============================================================
    doExport() {
      downloadJSON(this.state);
      this.notify('Datos exportados en JSON.');
    },

    doExportCSV() {
      const rows = this._csvRows(this.allTx);
      downloadCSV(rows, `movimientos-${this.viewYear}-${String(this.viewMonth + 1).padStart(2, '0')}`);
      this.notify('Movimientos exportados en CSV.');
    },

    doExportReportsCSV() {
      const list = this.filteredTx;
      if (!list.length) return this.notify('No hay movimientos que coincidan con los filtros.');
      downloadCSV(this._csvRows(list), 'reporte-movimientos');
      this.notify('Reporte CSV descargado.');
    },

    _csvRows(list) {
      const header = ['Fecha', 'Tipo', 'Descripción', 'Categoría', 'Cuenta', 'Cuenta destino', 'Monto'];
      const body = list.map((t) => [
        t.rec.date,
        this.txTypeLabel(t),
        t.rec.description || (t.kind === 'expense' ? t.cat.label : ''),
        t.kind === 'expense' ? t.cat.label : '',
        t.acct?.name ?? '',
        t.toAcct?.name ?? '',
        t.kind === 'income' ? t.rec.amount : t.kind === 'expense' ? -t.rec.amount : `transferencia ${t.rec.amount}`,
      ]);
      return [header, ...body];
    },

    doExportMonthly() {
      const lines = [
        `RESUMEN MENSUAL — ${this.monthLabel}`,
        '',
        `Balance total: ${this.fmt(this.totalBalance)}`,
        `Ingresos del mes: ${this.fmt(this.totalIncome)}`,
        `Gastos del mes: ${this.fmt(this.totalExpenses)}`,
        `Ahorro del mes: ${this.fmt(this.savings)}`,
        `Presupuesto mensual: ${this.fmt(this.state.budget)} (${this.budgetPct}% usado)`,
        '',
        'Gastos por categoría:',
        ...(this.breakdown.length ? this.breakdown.map((b) => `- ${b.cat.label}: ${this.fmt(b.amount)} (${b.pct.toFixed(0)}%)`) : ['- Sin gastos este mes']),
        '',
        'Cuentas:',
        ...this.accounts.map((a) => `- ${a.name} (${this.accountTypeLabel(a.type)}): ${this.fmt(a.balance)}`),
      ];
      downloadText(lines.join('\n'), `resumen-${this.viewYear}-${String(this.viewMonth + 1).padStart(2, '0')}.txt`);
      this.notify('Resumen mensual exportado.');
    },

    doPrint() {
      window.print();
    },

    async doImport(event) {
      const file = event.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        this._importData = text;
        this.openConfirm('Importar este archivo reemplazará tus datos actuales. ¿Deseas continuar?', () => {
          this.applyImport(this._importData);
        }, 'danger');
      } catch {
        this.notify('No se pudo leer el archivo.');
      }
      event.target.value = '';
    },

    applyImport(text) {
      try {
        backup.saveBackup(this.state, { auto: true, label: 'Respaldo previo a importación' });
        this.state = store.importState(text);
        this._logActivity('datos', 'Datos importados desde archivo');
        this._save();
        this.notify('Datos importados correctamente.');
        this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
      } catch {
        this.notify('El archivo no contiene datos válidos de GastosDiarios.');
      }
    },

    loadDemo() {
      this.openConfirm('Esto reemplazará tus datos actuales con datos de ejemplo. ¿Deseas continuar?', () => {
        backup.saveBackup(this.state, { auto: true, label: 'Respaldo previo a cargar ejemplo' });
        this.state = store.demoState(this.viewYear, this.viewMonth);
        this._logActivity('datos', 'Datos de ejemplo cargados');
        this._save();
        this.notify('Datos de ejemplo cargados.');
        this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
      }, 'warn');
    },

    resetData() {
      this.openConfirm('Se borrarán TODOS tus datos y se restablecerá la configuración inicial. Esta acción no se puede deshacer. ¿Continuar?', () => {
        backup.saveBackup(this.state, { auto: true, label: 'Respaldo previo a restablecer' });
        this.state = store.defaultState();
        this._logActivity('datos', 'Datos restablecidos a la configuración inicial');
        this._save();
        this.notify('Datos restablecidos.');
        this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
      }, 'danger');
    },

    // ============================================================
    // Respaldos e historial de restauración
    // ============================================================
    get backups() {
      return backup.listBackups().map(backup.backupSummary);
    },

    saveManualBackup() {
      const ok = backup.saveBackup(this.state, { label: 'Respaldo manual' });
      if (!ok) return this.notify('No se pudo guardar el respaldo. El almacenamiento está lleno.');
      this._logActivity('backup', 'Respaldo manual creado');
      this._save();
      this.notify('Respaldo guardado en el historial.');
    },

    deleteBackup(id) {
      backup.removeBackup(id);
      this.notify('Respaldo eliminado del historial.');
    },

    restoreBackupFromHistory(id) {
      this.openConfirm('Importar este respaldo reemplazará los datos actuales. ¿Deseas continuar?', () => {
        try {
          backup.saveBackup(this.state, { auto: true, label: 'Respaldo de seguridad previo a restaurar' });
          this.state = backup.restoreBackup(id);
          this._logActivity('backup', 'Datos restaurados desde un respaldo del historial');
          this._save();
          this.notify('Respaldo restaurado correctamente.');
          this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
        } catch {
          this.notify('No se pudo restaurar el respaldo.');
        }
      }, 'danger');
    },

    // ============================================================
    // Analizar datos (herramienta de mantenimiento)
    // ============================================================
    analyzeData() {
      this.analysis = validation.analyzeState(this.state);
      this.analysisFixed = 0;
      this.analysisOpen = true;
    },

    applySafeFixes() {
      const { state, fixed } = validation.safeFixState(this.state);
      if (fixed === 0) return this.notify('No se encontraron correcciones seguras por aplicar.');
      this.state = state;
      this._save();
      this.analysisFixed = fixed;
      this.analysis = validation.analyzeState(this.state);
      this.notify(`${fixed} corrección${fixed === 1 ? '' : 'es'} segura${fixed === 1 ? '' : 's'} aplicada${fixed === 1 ? '' : 's'}.`);
    },

    // ============================================================
    // Confirmaciones y toasts
    // ============================================================
    openConfirm(message, action, tone = 'warn') {
      this.confirmMessage = message;
      this.confirmAction = action;
      this.confirmTone = tone;
      this.confirmOpen = true;
    },

    runConfirm() {
      const fn = this.confirmAction;
      this.confirmOpen = false;
      this.confirmAction = null;
      if (fn) fn();
    },

    notify(message, actionLabel = null, actionFn = null) {
      this.toast = message;
      this.toastActionLabel = actionLabel;
      this._toastActionFn = actionFn;
      clearTimeout(this._t);
      this._t = setTimeout(() => { this.toast = ''; this.toastActionLabel = ''; this._toastActionFn = null; }, actionLabel ? 6000 : 2800);
    },

    runToastAction() {
      const fn = this._toastActionFn;
      this.toast = '';
      this.toastActionLabel = '';
      this._toastActionFn = null;
      clearTimeout(this._t);
      if (fn) fn();
    },

    // ============================================================
    // Persistencia central (guardar + undo) y actividad
    // ============================================================
    // Guarda el estado actual. Antes de persistir, empuja al historial de
    // deshacer el último estado persistido (que es el previo a esta mutación).
    _save() {
      if (this._lastSaved) {
        this._undoStack.push(this._lastSaved);
        if (this._undoStack.length > this._undoLimit) this._undoStack.shift();
      }
      this._analysisCache = null;
      const ok = store.saveState(this.state);
      this._lastSaved = JSON.parse(JSON.stringify(this.state));
      if (!ok) this.notify('No fue posible guardar los cambios. Tus datos actuales no han sido modificados.');
      return ok;
    },

    _logActivity(type, text) {
      if (!Array.isArray(this.state.activity)) this.state.activity = [];
      this.state.activity.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `act-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type,
        text,
      });
      if (this.state.activity.length > this._activityLimit) {
        this.state.activity = this.state.activity.slice(this.state.activity.length - this._activityLimit);
      }
    },

    undo() {
      const prev = this._undoStack.pop();
      if (!prev) return this.notify('No hay cambios para deshacer.');
      this.state = prev;
      this._lastSaved = JSON.parse(JSON.stringify(prev));
      this._analysisCache = null;
      const ok = store.saveState(this.state);
      this.notify('Cambio deshecho.');
      if (!ok) this.notify('No fue posible guardar los cambios. Tus datos actuales no han sido modificados.');
      this.$nextTick(() => { refreshIcons(); this.renderCharts(); });
    },

    // ============================================================
    // Gráficos (Chart.js)
    // ============================================================
    _chart(id, type, data, options, extraPlugins) {
      const el = document.getElementById(id);
      if (!el || el.offsetParent === null) return; // solo canvas visibles
      if (this._charts[id]) this._charts[id].destroy();
      this._charts[id] = new Chart(el, { type, data, options, plugins: extraPlugins });
    },

    renderCharts() {
      if (!window.Chart) return;
      const self = this;
      const dark = isDarkMode(this.mode);
      const txt = dark ? '#CBD5E1' : '#64748B';
      const grid = dark ? 'rgba(148,163,184,.12)' : 'rgba(15,23,42,.06)';
      const accentRgb = hexToRgb(this.accent);

      const centerText = {
        id: 'centerText',
        afterDraw(chart) {
          if (chart.config.type !== 'doughnut') return;
          const { ctx, chartArea } = chart;
          if (!chartArea) return;
          const total = chart.data.datasets[0].data.reduce((s, v) => s + v, 0);
          const x = (chartArea.left + chartArea.right) / 2;
          const y = (chartArea.top + chartArea.bottom) / 2;
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '700 20px Inter, system-ui, sans-serif';
          ctx.fillStyle = dark ? '#F1F5F9' : '#0F172A';
          ctx.fillText(self.fmt(total), x, y - 10);
          ctx.font = '500 11px Inter, system-ui, sans-serif';
          ctx.fillStyle = dark ? '#94A3B8' : '#64748B';
          ctx.fillText('Total del mes', x, y + 12);
          ctx.restore();
        },
      };

      const tooltip = {
        backgroundColor: dark ? '#1E293B' : '#0F172A',
        padding: 12, cornerRadius: 12,
        titleFont: { family: 'Inter, system-ui, sans-serif' },
        bodyFont: { family: 'Inter, system-ui, sans-serif' },
      };

      const scales = {
        x: {
          grid: { display: false }, border: { display: false },
          ticks: { color: txt, font: { family: 'Inter, system-ui, sans-serif', size: 11 } },
        },
        y: {
          beginAtZero: true, grid: { color: grid }, border: { display: false },
          ticks: {
            color: txt, font: { family: 'Inter, system-ui, sans-serif', size: 11 },
            callback: (v) => self.compactFmt(v),
          },
        },
      };

      // --- Inicio: doughnut de análisis ---
      if (this.hasChartData) {
        this._chart('chart-analytics', 'doughnut', {
          labels: this.breakdown.map((b) => b.cat.label),
          datasets: [{
            data: this.breakdown.map((b) => b.amount),
            backgroundColor: this.breakdown.map((b) => b.cat.color),
            borderColor: dark ? '#0F172A' : '#FFFFFF',
            borderWidth: 3, hoverOffset: 6, spacing: 2,
          }],
        }, {
          responsive: true, maintainAspectRatio: false, cutout: '72%',
          plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => ` ${c.label}: ${self.fmt(c.parsed)}` } } },
        }, [centerText]);
      } else {
        const el = document.getElementById('chart-analytics');
        if (el && this._charts['chart-analytics']) { this._charts['chart-analytics'].destroy(); delete this._charts['chart-analytics']; }
      }

      // --- Inicio: visión mensual (área) ---
      const ov = this.overview;
      const incGrad = ((id) => {
        const g = document.getElementById(id)?.getContext('2d');
        if (!g) return null;
        const grad = g.createLinearGradient(0, 0, 0, 260);
        grad.addColorStop(0, `rgba(${accentRgb}, .35)`);
        grad.addColorStop(1, `rgba(${accentRgb}, 0)`);
        return grad;
      })('chart-overview');
      const expGrad = ((id) => {
        const g = document.getElementById(id)?.getContext('2d');
        if (!g) return null;
        const grad = g.createLinearGradient(0, 0, 0, 260);
        grad.addColorStop(0, 'rgba(244, 63, 94, .28)');
        grad.addColorStop(1, 'rgba(244, 63, 94, 0)');
        return grad;
      })('chart-overview');

      this._chart('chart-overview', 'line', {
        labels: ov.map((m) => m.label),
        datasets: [
          { label: 'Ingresos', data: ov.map((m) => m.income), borderColor: `rgb(${accentRgb})`, backgroundColor: incGrad, fill: true, tension: 0.45, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: `rgb(${accentRgb})` },
          { label: 'Gastos', data: ov.map((m) => m.expenses), borderColor: '#F43F5E', backgroundColor: expGrad, fill: true, tension: 0.45, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: '#F43F5E' },
        ],
      }, {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${self.fmt(c.parsed.y)}` } } },
        scales,
      });

      // --- Reportes ---
      this._reportCharts(tooltip, scales, accentRgb, dark);

      // --- Patrimonio: evolución estimada ---
      const ps = this.patrimonioSeries;
      const patGrad = ((id) => {
        const g = document.getElementById(id)?.getContext('2d');
        if (!g) return null;
        const grad = g.createLinearGradient(0, 0, 0, 260);
        grad.addColorStop(0, `rgba(${accentRgb}, .3)`);
        grad.addColorStop(1, `rgba(${accentRgb}, 0)`);
        return grad;
      })('patrimonioChart');
      this._chart('patrimonioChart', 'line', {
        labels: ps.map((m) => m.label),
        datasets: [{
          label: 'Patrimonio neto estimado',
          data: ps.map((m) => m.value),
          borderColor: `rgb(${accentRgb})`,
          backgroundColor: patGrad,
          fill: true, tension: 0.45, borderWidth: 2.5,
          pointRadius: ps.map((m) => (m.past ? 3 : 0)),
          pointHoverRadius: 5,
          pointBackgroundColor: `rgb(${accentRgb})`,
          segment: { borderDash: (ctx) => (ctx.p1DataIndex >= 0 && !ps[ctx.p1DataIndex]?.past && ctx.p1DataIndex > ctx.p0DataIndex ? [6, 5] : undefined) },
        }],
      }, {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => ` ${self.fmt(c.parsed.y)}` } } },
        scales,
      });
    },

    get overview() {
      const months = [];
      const now = new Date();
      for (let k = 5; k >= 0; k--) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        months.push({
          label: MONTHS_SHORT[d.getMonth()],
          income: stats.sum(stats.filterMonth(this.state.income, d.getFullYear(), d.getMonth())),
          expenses: stats.sum(stats.filterMonth(this.state.expenses, d.getFullYear(), d.getMonth())),
        });
      }
      return months;
    },

    _reportCharts(tooltip, scales, accentRgb, dark) {
      const self = this;

      if (this.reportByCategory.length) {
        this._chart('chart-cat', 'doughnut', {
          labels: this.reportByCategory.map((b) => b.cat.label),
          datasets: [{
            data: this.reportByCategory.map((b) => b.amount),
            backgroundColor: this.reportByCategory.map((b) => b.cat.color),
            borderColor: dark ? '#0F172A' : '#FFFFFF',
            borderWidth: 3, hoverOffset: 6, spacing: 2,
          }],
        }, {
          responsive: true, maintainAspectRatio: false, cutout: '68%',
          plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => ` ${c.label}: ${self.fmt(c.parsed)}` } } },
        });
      } else {
        const el = document.getElementById('chart-cat');
        if (el && this._charts['chart-cat']) { this._charts['chart-cat'].destroy(); delete this._charts['chart-cat']; }
      }

      const rs = this.reportsSeries;
      this._chart('chart-ivg', 'bar', {
        labels: rs.map((m) => m.label),
        datasets: [
          { label: 'Ingresos', data: rs.map((m) => m.income), backgroundColor: `rgba(${accentRgb}, .85)`, borderRadius: 8, borderSkipped: false },
          { label: 'Gastos', data: rs.map((m) => m.expenses), backgroundColor: 'rgba(244, 63, 94, .85)', borderRadius: 8, borderSkipped: false },
        ],
      }, {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => ` ${c.dataset.label}: ${self.fmt(c.parsed.y)}` } } },
        scales,
      });

      this._chart('chart-evo', 'line', {
        labels: this.evolutionSeries.map((m) => m.label),
        datasets: [{
          label: 'Balance acumulado',
          data: this.evolutionSeries.map((m) => m.value),
          borderColor: `rgb(${accentRgb})`,
          backgroundColor: (() => {
            const g = document.getElementById('chart-evo')?.getContext('2d');
            if (!g) return 'transparent';
            const grad = g.createLinearGradient(0, 0, 0, 260);
            grad.addColorStop(0, `rgba(${accentRgb}, .3)`);
            grad.addColorStop(1, `rgba(${accentRgb}, 0)`);
            return grad;
          })(),
          fill: true, tension: 0.45, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: `rgb(${accentRgb})`,
        }],
      }, {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => ` ${self.fmt(c.parsed.y)}` } } },
        scales,
      });

      if (this.reportByAccount.length) {
        this._chart('chart-acct', 'bar', {
          labels: this.reportByAccount.map((b) => b.acct.name),
          datasets: [{
            label: 'Gastos',
            data: this.reportByAccount.map((b) => b.amount),
            backgroundColor: this.reportByAccount.map((b) => b.acct.color),
            borderRadius: 8, borderSkipped: false,
          }],
        }, {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => ` ${self.fmt(c.parsed.y)}` } } },
          scales: { ...scales, x: { ...scales.x, ticks: { ...scales.x.ticks, callback: (v) => (String(v).length > 8 ? String(v).slice(0, 8) + '…' : v) } } },
        });
      } else {
        const el = document.getElementById('chart-acct');
        if (el && this._charts['chart-acct']) { this._charts['chart-acct'].destroy(); delete this._charts['chart-acct']; }
      }

      this._chart('chart-sav', 'line', {
        labels: this.savingsSeries.map((m) => m.label),
        datasets: [{
          label: 'Ahorro mensual',
          data: this.savingsSeries.map((m) => m.value),
          borderColor: '#8B5CF6',
          backgroundColor: (() => {
            const g = document.getElementById('chart-sav')?.getContext('2d');
            if (!g) return 'transparent';
            const grad = g.createLinearGradient(0, 0, 0, 260);
            grad.addColorStop(0, 'rgba(139, 92, 246, .3)');
            grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
            return grad;
          })(),
          fill: true, tension: 0.45, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointBackgroundColor: '#8B5CF6',
        }],
      }, {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => ` ${self.fmt(c.parsed.y)}` } } },
        scales,
      });
    },
    };
  });
});
