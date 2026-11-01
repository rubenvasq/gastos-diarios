// Smoke test for the Gastos Diarios agent toolset (src/agent/tools.js).
//
// Pure, no browser, no API: we run each tool's handler against a fake repo and
// assert the validation + delegation behaviour. Mirrors smoke.mjs in style.
//
//   node tests/agent-tools.smoke.mjs

import assert from 'node:assert/strict';
import { gastosTools } from '../src/agent/tools.js';

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

const byName = new Map(gastosTools.map((t) => [t.definition.name, t]));
const call = (name, input, repo) => byName.get(name).handler(input, repo);

// A fake repo that records calls and returns canned data. Tools must never
// reach it when validation fails.
function makeRepo() {
  const calls = [];
  const repo = {};
  const methods = [
    'spendingForMonth', 'incomeForMonth', 'spendingByCategory', 'compareMonths',
    'budgetStatus', 'netWorth', 'insights', 'listTransactions', 'listAccounts',
    'listCategories', 'addExpense', 'addIncome', 'createPaymentReminder', 'setBudget',
  ];
  for (const m of methods) {
    repo[m] = (...args) => { calls.push([m, ...args]); return { ok: true, method: m }; };
  }
  return { repo, calls };
}

// ---- Each registered tool has a well-formed definition ----
check('every tool has name/description/parameters', () => {
  for (const t of gastosTools) {
    assert.ok(t.definition.name, 'name');
    assert.ok(t.definition.description, 'description');
    assert.equal(t.definition.parameters.type, 'object');
    assert.equal(typeof t.handler, 'function');
  }
});

check('tool names are unique', () => {
  assert.equal(byName.size, gastosTools.length);
});

// ---- Validation: bad month is rejected BEFORE touching the repo ----
check('get_spending_summary rejects a bad month', async () => {
  const { repo, calls } = makeRepo();
  const r = await call('get_spending_summary', { month: 'octubre' }, repo);
  assert.ok(r.error, 'should return an error object');
  assert.equal(calls.length, 0, 'repo must not be called on invalid input');
});

check('get_spending_summary accepts a valid month', async () => {
  const { repo, calls } = makeRepo();
  await call('get_spending_summary', { month: '2025-10' }, repo);
  assert.deepEqual(calls[0], ['spendingForMonth', '2025-10']);
});

check('compare_months validates both months', async () => {
  const { repo } = makeRepo();
  const r = await call('compare_months', { month: '2025-10', compareTo: 'x' }, repo);
  assert.ok(r.error);
});

// ---- Write tools validate amounts and dates ----
check('add_expense rejects non-positive amount', async () => {
  const { repo, calls } = makeRepo();
  const r = await call('add_expense', { amount: 0, category: 'c', account: 'a' }, repo);
  assert.ok(r.error);
  assert.equal(calls.length, 0);
});

check('add_expense rejects a malformed date', async () => {
  const { repo } = makeRepo();
  const r = await call('add_expense', { amount: 10, category: 'c', account: 'a', date: '10/2025' }, repo);
  assert.ok(r.error);
});

check('add_expense delegates valid input to repo', async () => {
  const { repo, calls } = makeRepo();
  await call('add_expense', { amount: 45000, category: 'alimentacion', account: 'ef', description: 'almuerzo' }, repo);
  assert.equal(calls[0][0], 'addExpense');
  assert.equal(calls[0][1].amount, 45000);
});

check('create_payment_reminder requires a valid nextDate', async () => {
  const { repo } = makeRepo();
  const r = await call('create_payment_reminder', { name: 'Arriendo', amount: 900000, category: 'vivienda', account: 'ef', nextDate: 'mañana' }, repo);
  assert.ok(r.error);
});

check('set_monthly_budget rejects negative amounts', async () => {
  const { repo } = makeRepo();
  const r = await call('set_monthly_budget', { amount: -5 }, repo);
  assert.ok(r.error);
});

check('read tools with no args reach the repo', async () => {
  const { repo, calls } = makeRepo();
  await call('get_net_worth', {}, repo);
  await call('get_accounts', {}, repo);
  await call('get_categories', {}, repo);
  assert.deepEqual(calls.map((c) => c[0]), ['netWorth', 'listAccounts', 'listCategories']);
});

console.log(`\n✓ agent-tools smoke: ${passed} checks passed\n`);
