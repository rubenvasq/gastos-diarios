// The Gastos Diarios toolset.
//
// Each tool is { definition, handler }:
//   - definition: the JSON Schema we SEND to the model (name, description, args).
//   - handler(input, repo): what WE run when the model asks for it. It validates
//     the model's arguments (untrusted input!) and delegates to `repo`, which is
//     the live bridge over the app's state (see bridge.js).
//
// Handlers never throw: on bad input they return an { error } object so the
// model can read it and correct itself on the next turn. This mirrors the
// invoice tools in sistefa-ai-agent.

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function requireMonth(month) {
  return MONTH_RE.test(month ?? '')
    ? null
    : { error: "El mes debe tener formato YYYY-MM, por ejemplo '2025-10'." };
}

function positiveAmount(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const gastosTools = [
  // ---- Lectura ---------------------------------------------------------
  {
    definition: {
      name: 'get_spending_summary',
      description:
        'Obtiene el total gastado en un mes dado, con el número de movimientos. Úsala cuando el usuario pregunte cuánto gastó en un mes concreto.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: "Mes a resumir en formato YYYY-MM (p.ej. '2025-10')." },
        },
        required: ['month'],
      },
    },
    async handler(input, repo) {
      const { month } = input ?? {};
      const bad = requireMonth(month);
      if (bad) return bad;
      return repo.spendingForMonth(month);
    },
  },

  {
    definition: {
      name: 'get_income_summary',
      description: 'Obtiene el total de ingresos de un mes dado. Úsala cuando el usuario pregunte cuánto ingresó o recibió en un mes.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Mes en formato YYYY-MM.' },
        },
        required: ['month'],
      },
    },
    async handler(input, repo) {
      const { month } = input ?? {};
      const bad = requireMonth(month);
      if (bad) return bad;
      return repo.incomeForMonth(month);
    },
  },

  {
    definition: {
      name: 'get_spending_by_category',
      description:
        'Desglosa el gasto de un mes por categoría, de mayor a menor. Úsala cuando el usuario pregunte en qué gasta más o pida un desglose por categoría.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Mes en formato YYYY-MM.' },
        },
        required: ['month'],
      },
    },
    async handler(input, repo) {
      const { month } = input ?? {};
      const bad = requireMonth(month);
      if (bad) return bad;
      return repo.spendingByCategory(month);
    },
  },

  {
    definition: {
      name: 'compare_months',
      description:
        'Compara el gasto total entre dos meses y da la variación porcentual. Úsala cuando el usuario pregunte si gastó más o menos que otro mes.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Mes actual (YYYY-MM).' },
          compareTo: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Mes con el que comparar (YYYY-MM).' },
        },
        required: ['month', 'compareTo'],
      },
    },
    async handler(input, repo) {
      const { month, compareTo } = input ?? {};
      const bad = requireMonth(month) || requireMonth(compareTo);
      if (bad) return bad;
      return repo.compareMonths(month, compareTo);
    },
  },

  {
    definition: {
      name: 'get_budget_status',
      description:
        'Devuelve el presupuesto mensual, cuánto se ha gastado y cuánto queda. Úsala cuando el usuario pregunte cómo va de presupuesto o cuánto le queda este mes.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Mes en formato YYYY-MM.' },
        },
        required: ['month'],
      },
    },
    async handler(input, repo) {
      const { month } = input ?? {};
      const bad = requireMonth(month);
      if (bad) return bad;
      return repo.budgetStatus(month);
    },
  },

  {
    definition: {
      name: 'get_net_worth',
      description: 'Devuelve el patrimonio neto actual: activos, deudas y neto. Úsala cuando el usuario pregunte por su patrimonio, activos o deudas totales.',
      parameters: { type: 'object', properties: {} },
    },
    async handler(_input, repo) {
      return repo.netWorth();
    },
  },

  {
    definition: {
      name: 'get_insights',
      description: 'Devuelve observaciones inteligentes del mes (consejos y alertas calculados de los datos). Úsala cuando el usuario pida un análisis o recomendaciones.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Mes en formato YYYY-MM.' },
        },
        required: ['month'],
      },
    },
    async handler(input, repo) {
      const { month } = input ?? {};
      const bad = requireMonth(month);
      if (bad) return bad;
      return repo.insights(month);
    },
  },

  {
    definition: {
      name: 'list_transactions',
      description: 'Lista los movimientos de un mes (gastos e ingresos), más recientes primero. Úsala cuando el usuario pida ver, listar o revisar sus movimientos.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', pattern: '^\\d{4}-\\d{2}$', description: 'Mes en formato YYYY-MM.' },
          type: { type: 'string', enum: ['expense', 'income', 'all'], description: "Filtrar por tipo. Por defecto 'all'." },
          limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Máximo de movimientos a devolver.' },
        },
        required: ['month'],
      },
    },
    async handler(input, repo) {
      const { month, type = 'all', limit = 20 } = input ?? {};
      const bad = requireMonth(month);
      if (bad) return bad;
      return repo.listTransactions(month, type, limit);
    },
  },

  {
    definition: {
      name: 'get_accounts',
      description: 'Lista las cuentas del usuario con su id, nombre y saldo. Úsala para encontrar el id de una cuenta antes de crear un gasto, ingreso o recordatorio.',
      parameters: { type: 'object', properties: {} },
    },
    async handler(_input, repo) {
      return repo.listAccounts();
    },
  },

  {
    definition: {
      name: 'get_categories',
      description: 'Lista las categorías de gasto con su id y nombre. Úsala para encontrar el id de una categoría antes de crear un gasto.',
      parameters: { type: 'object', properties: {} },
    },
    async handler(_input, repo) {
      return repo.listCategories();
    },
  },

  // ---- Escritura -------------------------------------------------------
  {
    definition: {
      name: 'add_expense',
      description:
        'Registra un nuevo gasto. Antes de llamarla, asegúrate de tener un id de categoría (get_categories) y un id de cuenta (get_accounts) válidos.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', exclusiveMinimum: 0, description: 'Monto del gasto, mayor a cero.' },
          category: { type: 'string', description: 'id de la categoría (de get_categories).' },
          account: { type: 'string', description: 'id de la cuenta (de get_accounts).' },
          description: { type: 'string', description: 'Descripción breve del gasto.' },
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Fecha en formato YYYY-MM-DD. Por defecto hoy.' },
        },
        required: ['amount', 'category', 'account'],
      },
    },
    async handler(input, repo) {
      const { amount, category, account, description, date } = input ?? {};
      if (!positiveAmount(amount)) return { error: 'El monto debe ser un número mayor a cero.' };
      if (date && !DATE_RE.test(date)) return { error: 'La fecha debe tener formato YYYY-MM-DD.' };
      return repo.addExpense({ amount, category, account, description, date });
    },
  },

  {
    definition: {
      name: 'add_income',
      description: 'Registra un nuevo ingreso. Antes de llamarla, asegúrate de tener un id de cuenta válido (get_accounts).',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', exclusiveMinimum: 0, description: 'Monto del ingreso, mayor a cero.' },
          account: { type: 'string', description: 'id de la cuenta (de get_accounts).' },
          description: { type: 'string', description: 'Descripción breve del ingreso.' },
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Fecha en formato YYYY-MM-DD. Por defecto hoy.' },
        },
        required: ['amount', 'account'],
      },
    },
    async handler(input, repo) {
      const { amount, account, description, date } = input ?? {};
      if (!positiveAmount(amount)) return { error: 'El monto debe ser un número mayor a cero.' };
      if (date && !DATE_RE.test(date)) return { error: 'La fecha debe tener formato YYYY-MM-DD.' };
      return repo.addIncome({ amount, account, description, date });
    },
  },

  {
    definition: {
      name: 'create_payment_reminder',
      description:
        'Crea un pago recurrente (recordatorio de pago) que aparecerá como pendiente cuando llegue su fecha. Úsala cuando el usuario pida recordar un pago periódico, como el arriendo o una suscripción.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre del pago, p.ej. "Arriendo".' },
          amount: { type: 'number', exclusiveMinimum: 0, description: 'Monto del pago, mayor a cero.' },
          category: { type: 'string', description: 'id de la categoría (de get_categories).' },
          account: { type: 'string', description: 'id de la cuenta desde la que se pagará (de get_accounts).' },
          frequency: { type: 'string', enum: ['mensual', 'semanal', 'quincenal', 'anual'], description: "Frecuencia. Por defecto 'mensual'." },
          nextDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Fecha del próximo pago, YYYY-MM-DD.' },
        },
        required: ['name', 'amount', 'category', 'account', 'nextDate'],
      },
    },
    async handler(input, repo) {
      const { name, amount, category, account, frequency = 'mensual', nextDate } = input ?? {};
      if (!name || !String(name).trim()) return { error: 'El recordatorio necesita un nombre.' };
      if (!positiveAmount(amount)) return { error: 'El monto debe ser un número mayor a cero.' };
      if (!DATE_RE.test(nextDate ?? '')) return { error: 'nextDate debe tener formato YYYY-MM-DD.' };
      return repo.createPaymentReminder({ name, amount, category, account, frequency, nextDate });
    },
  },

  {
    definition: {
      name: 'set_monthly_budget',
      description: 'Fija el presupuesto mensual total. Úsala cuando el usuario quiera establecer o cambiar su presupuesto del mes.',
      parameters: {
        type: 'object',
        properties: {
          amount: { type: 'number', minimum: 0, description: 'Monto del presupuesto mensual (0 o más).' },
        },
        required: ['amount'],
      },
    },
    async handler(input, repo) {
      const { amount } = input ?? {};
      const n = Number(amount);
      if (!Number.isFinite(n) || n < 0) return { error: 'El presupuesto debe ser un número de 0 o más.' };
      return repo.setBudget(n);
    },
  },
];
