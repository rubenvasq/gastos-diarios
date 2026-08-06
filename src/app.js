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

const formatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

let state = loadState();
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();

const els = {
  currentMonth: document.getElementById('current-month'),
  btnPrevMonth: document.getElementById('btn-prev-month'),
  btnNextMonth: document.getElementById('btn-next-month'),
  budgetInput: document.getElementById('budget-input'),
  totalSpent: document.getElementById('total-spent'),
  totalRemaining: document.getElementById('total-remaining'),
  budgetProgress: document.getElementById('budget-progress'),
  budgetAlert: document.getElementById('budget-alert'),
  progress: document.querySelector('.progress'),
  form: document.getElementById('expense-form'),
  amount: document.getElementById('expense-amount'),
  category: document.getElementById('expense-category'),
  description: document.getElementById('expense-description'),
  date: document.getElementById('expense-date'),
  categoryBreakdown: document.getElementById('category-breakdown'),
  emptyCategories: document.getElementById('empty-categories'),
  expenseList: document.getElementById('expense-list'),
  emptyExpenses: document.getElementById('empty-expenses'),
  expenseCount: document.getElementById('expense-count'),
  btnExport: document.getElementById('btn-export'),
  btnImport: document.getElementById('btn-import'),
  importFile: document.getElementById('import-file'),
  toast: document.getElementById('toast'),
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('toast--visible');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.remove('toast--visible'), 2800);
}

function populateCategories() {
  els.category.innerHTML = CATEGORIES.map(
    (c) => `<option value="${c.id}">${c.emoji} ${c.label}</option>`
  ).join('');
}

function setDefaultDate() {
  els.date.value = new Date().toISOString().slice(0, 10);
}

function getMonthExpenses() {
  return filterByMonth(state.expenses, viewYear, viewMonth);
}

function render() {
  const monthExpenses = getMonthExpenses();
  const total = sumExpenses(monthExpenses);
  const budget = state.budget;
  const remaining = budget - total;
  const pct = budget > 0 ? Math.min((total / budget) * 100, 100) : 0;

  els.currentMonth.textContent = `${MONTHS[viewMonth]} ${viewYear}`;
  els.budgetInput.value = budget;
  els.totalSpent.textContent = formatter.format(total);
  els.totalRemaining.textContent = formatter.format(remaining);
  els.totalRemaining.className = `budget-summary__value ${remaining >= 0 ? 'budget-summary__value--positive' : 'budget-summary__value--negative'}`;

  els.budgetProgress.style.width = `${pct}%`;
  els.budgetProgress.className = `progress__bar ${pct >= 90 ? 'progress__bar--danger' : pct >= 70 ? 'progress__bar--warning' : ''}`;
  els.progress.setAttribute('aria-valuenow', Math.round(pct));

  if (budget > 0 && pct >= 90) {
    els.budgetAlert.hidden = false;
    els.budgetAlert.textContent = pct >= 100
      ? '⚠️ Has superado tu presupuesto mensual.'
      : '⚠️ Estás cerca de agotar tu presupuesto.';
    els.budgetAlert.className = 'budget-alert budget-alert--danger';
  } else if (budget > 0 && remaining > 0 && monthExpenses.length > 0) {
    els.budgetAlert.hidden = false;
    els.budgetAlert.textContent = `✓ Te quedan ${formatter.format(remaining)} disponibles este mes.`;
    els.budgetAlert.className = 'budget-alert budget-alert--ok';
  } else {
    els.budgetAlert.hidden = true;
  }

  renderCategoryBreakdown(monthExpenses, total);
  renderExpenseList(monthExpenses);
}

function renderCategoryBreakdown(expenses, total) {
  const groups = groupByCategory(expenses);
  const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);

  els.emptyCategories.hidden = entries.length > 0;
  els.categoryBreakdown.innerHTML = entries.map(([catId, amount]) => {
    const cat = getCategory(catId);
    const pct = total > 0 ? (amount / total) * 100 : 0;
    return `
      <li class="category-item">
        <div class="category-item__header">
          <span>${cat.emoji} ${cat.label}</span>
          <span>${formatter.format(amount)}</span>
        </div>
        <div class="category-item__bar">
          <div class="category-item__fill" style="width:${pct}%; background:${cat.color}"></div>
        </div>
      </li>`;
  }).join('');
}

function renderExpenseList(expenses) {
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  els.expenseCount.textContent = `${sorted.length} ${sorted.length === 1 ? 'gasto' : 'gastos'}`;
  els.emptyExpenses.hidden = sorted.length > 0;
  els.expenseList.innerHTML = sorted.map((expense) => {
    const cat = getCategory(expense.category);
    const dateLabel = new Date(expense.date + 'T12:00:00').toLocaleDateString('es-MX', {
      weekday: 'short', day: 'numeric', month: 'short',
    });
    return `
      <li class="expense-item">
        <div class="expense-item__icon" style="background:${cat.color}20; color:${cat.color}">${cat.emoji}</div>
        <div class="expense-item__body">
          <span class="expense-item__title">${expense.description || cat.label}</span>
          <span class="expense-item__meta">${cat.label} · ${dateLabel}</span>
        </div>
        <span class="expense-item__amount">${formatter.format(expense.amount)}</span>
        <button type="button" class="btn btn--icon btn--danger expense-item__delete" data-id="${expense.id}" aria-label="Eliminar gasto">×</button>
      </li>`;
  }).join('');
}

function changeMonth(delta) {
  viewMonth += delta;
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  render();
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = parseFloat(els.amount.value);
  if (!amount || amount <= 0) {
    showToast('Ingresa un monto válido.');
    els.amount.focus();
    return;
  }

  const expense = createExpense({
    amount,
    category: els.category.value,
    description: els.description.value,
    date: els.date.value,
  });

  state.expenses.push(expense);
  saveState(state);
  els.form.reset();
  setDefaultDate();
  render();
  showToast(`Gasto de ${formatter.format(amount)} registrado.`);
});

els.budgetInput.addEventListener('change', () => {
  const value = parseFloat(els.budgetInput.value);
  state.budget = Number.isFinite(value) && value >= 0 ? value : 0;
  saveState(state);
  render();
  showToast('Presupuesto actualizado.');
});

els.btnPrevMonth.addEventListener('click', () => changeMonth(-1));
els.btnNextMonth.addEventListener('click', () => changeMonth(1));

els.expenseList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-id]');
  if (!btn) return;
  state.expenses = state.expenses.filter((exp) => exp.id !== btn.dataset.id);
  saveState(state);
  render();
  showToast('Gasto eliminado.');
});

els.btnExport.addEventListener('click', () => {
  exportState(state);
  showToast('Datos exportados.');
});

els.btnImport.addEventListener('click', () => els.importFile.click());

els.importFile.addEventListener('change', async () => {
  const file = els.importFile.files[0];
  if (!file) return;
  try {
    state = await importState(file);
    saveState(state);
    render();
    showToast('Datos importados correctamente.');
  } catch {
    showToast('No se pudo importar el archivo.');
  }
  els.importFile.value = '';
});

populateCategories();
setDefaultDate();
render();
