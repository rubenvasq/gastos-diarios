// src/stats.js — lógica de negocio pura y funciones de cálculo.
// No depende de Alpine ni del DOM; app.js la usa para los datos derivados.

export function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function todayStr() {
  const d = new Date();
  return dateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

export function sum(records) {
  return records.reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

export function filterMonth(records, year, month) {
  return records.filter((r) => {
    const d = new Date(r.date + 'T12:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

// Devuelve un Map<clave, suma>
export function groupSum(records, keyFn) {
  const map = new Map();
  for (const r of records) {
    const k = keyFn(r);
    map.set(k, (map.get(k) ?? 0) + r.amount);
  }
  return map;
}

// Cambio porcentual entre dos valores (null si no hay base).
export function pctChange(now, prev) {
  if (!prev || prev <= 0) return null;
  const d = ((now - prev) / prev) * 100;
  return { pct: Math.abs(d).toFixed(0), up: d >= 0 };
}

export function topExpenses(expenses, n = 5) {
  return [...expenses].sort((a, b) => b.amount - a.amount).slice(0, n);
}

// día -> { total, count } para un mes dado
export function dayStats(expenses, year, month) {
  const map = new Map();
  for (const e of filterMonth(expenses, year, month)) {
    const day = Number(e.date.slice(8, 10));
    const cur = map.get(day) ?? { total: 0, count: 0 };
    cur.total += e.amount;
    cur.count += 1;
    map.set(day, cur);
  }
  return map;
}

// Avanza una fecha según la frecuencia de un pago recurrente.
export function nextRecurringDate(date, frequency) {
  const d = new Date(date + 'T12:00:00');
  if (frequency === 'semanal') d.setDate(d.getDate() + 7);
  else if (frequency === 'quincenal') d.setDate(d.getDate() + 15);
  else if (frequency === 'anual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // 'mensual' por defecto
  return dateStr(d.getFullYear(), d.getMonth(), d.getDate());
}

// Recurrentes activos cuya próxima fecha cae en los próximos `days` días
// (incluye los ya vencidos, marcados como `pending`).
export function upcomingRecurring(recurring, days) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const limit = now.getTime() + days * 86400000;
  return recurring
    .filter((r) => r.active)
    .map((r) => {
      const d = new Date(r.nextDate + 'T12:00:00');
      return { r, pending: d <= now, daysUntil: Math.round((d - now) / 86400000) };
    })
    .filter((x) => x.daysUntil <= days)
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

// ---------------------------------------------------------------
// Resumen inteligente — insights calculados en JS con los datos reales.
// `fmt` es el formateador de moneda de la app; `catLabel` resuelve ids.
// ---------------------------------------------------------------
export function insights(state, y, m, { fmt, catLabel }) {
  const out = [];
  const exp = filterMonth(state.expenses, y, m);
  const inc = filterMonth(state.income, y, m);
  const prevY = m === 0 ? y - 1 : y;
  const prevM = m === 0 ? 11 : m - 1;
  const prevExp = filterMonth(state.expenses, prevY, prevM);
  const total = sum(exp);
  const incomeTotal = sum(inc);
  const prevTotal = sum(prevExp);

  if (!exp.length && !inc.length) {
    out.push({ icon: 'sparkles', text: 'Aún no hay movimientos este mes. Registra tu primer gasto o ingreso.', tone: 'info' });
  } else {
    const net = incomeTotal - total;
    if (net >= 0) out.push({ icon: 'piggy-bank', text: `Ahorraste ${fmt(net)} este mes.`, tone: 'ok' });
    else out.push({ icon: 'triangle-alert', text: `Tus gastos superaron tus ingresos por ${fmt(Math.abs(net))}.`, tone: 'bad' });
  }

  const chg = pctChange(total, prevTotal);
  if (chg && exp.length) {
    out.push(chg.up
      ? { icon: 'trending-up', text: `Este mes gastaste ${chg.pct}% más que el anterior.`, tone: 'warn' }
      : { icon: 'trending-down', text: `Este mes gastaste ${chg.pct}% menos que el anterior.`, tone: 'ok' });
  }

  if (total > 0) {
    const byCat = [...groupSum(exp, (e) => e.category).entries()].sort((a, b) => b[1] - a[1]);
    const [topId, topAmt] = byCat[0];
    const share = Math.round((topAmt / total) * 100);
    if (share >= 15) out.push({ icon: 'pie-chart', text: `${catLabel(topId)} representa el ${share}% de tus gastos.`, tone: 'info' });
  }

  if (prevTotal > 0 && total > 0) {
    const nowByCat = groupSum(exp, (e) => e.category);
    const prevByCat = groupSum(prevExp, (e) => e.category);
    let gain = null;
    let drop = null;
    for (const [id, amt] of nowByCat) {
      const before = prevByCat.get(id) ?? 0;
      if (before <= 0) continue;
      const diff = ((amt - before) / before) * 100;
      if (diff > 10 && (!gain || diff > gain.diff)) gain = { id, diff };
      if (diff < -10 && (!drop || diff < drop.diff)) drop = { id, diff };
    }
    if (gain) out.push({ icon: 'trending-up', text: `${catLabel(gain.id)} aumentó ${Math.abs(gain.diff).toFixed(0)}% respecto al mes anterior.`, tone: 'warn' });
    if (drop) out.push({ icon: 'trending-down', text: `Redujiste tus gastos en ${catLabel(drop.id)} un ${Math.abs(drop.diff).toFixed(0)}%.`, tone: 'ok' });
  }

  if (total > 0) {
    const ds = dayStats(exp, y, m);
    const best = [...ds.entries()].sort((a, b) => b[1].total - a[1].total)[0];
    if (best) {
      const weekday = new Date(dateStr(y, m, best[0]) + 'T12:00:00').getDay();
      const names = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      out.push({ icon: 'flame', text: `Tu día con mayor gasto fue el ${names[weekday]} (${fmt(best[1].total)}).`, tone: 'info' });
    }
    const now = new Date();
    const isCurrent = now.getFullYear() === y && now.getMonth() === m;
    const daysElapsed = isCurrent ? now.getDate() : new Date(y, m + 1, 0).getDate();
    out.push({ icon: 'calendar-clock', text: `Gastas en promedio ${fmt(total / daysElapsed)} por día.`, tone: 'info' });
  }

  if (state.budget > 0 && (exp.length || inc.length)) {
    const pct = Math.round((total / state.budget) * 100);
    const rem = state.budget - total;
    if (pct >= 100) out.push({ icon: 'triangle-alert', text: 'Has superado tu presupuesto mensual.', tone: 'bad' });
    else if (pct >= 90) out.push({ icon: 'circle-alert', text: `Has utilizado el ${pct}% de tu presupuesto.`, tone: 'warn' });
    else out.push({ icon: 'circle-check', text: `Te quedan ${fmt(rem)} de presupuesto.`, tone: 'ok' });
  }

  const next = upcomingRecurring(state.recurring, 7).filter((x) => !x.pending);
  if (next.length) out.push({ icon: 'repeat', text: `${next.length} pago(s) recurrente(s) en los próximos 7 días.`, tone: 'info' });

  return out.slice(0, 7);
}
