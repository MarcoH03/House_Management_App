// Lógica de negocio: miembros, compras/despensa, tareas y finanzas.
import { store } from './store.js';
import { uid, norm, today, addDays, addMonths, round2, monthOf, listNames } from './util.js';

/* ---------- Catálogos ---------- */

export const COLORS = ['blue', 'green', 'orange', 'pink', 'purple', 'teal', 'indigo', 'red', 'yellow', 'mint', 'brown', 'gray'];

export const SHOP_CATS = [
  { id: 'fruta', name: 'Frutas y verduras', emoji: '🥦' },
  { id: 'carne', name: 'Carne y pescado', emoji: '🥩' },
  { id: 'lacteos', name: 'Lácteos y huevos', emoji: '🥛' },
  { id: 'pan', name: 'Panadería', emoji: '🥖' },
  { id: 'despensa', name: 'Despensa', emoji: '🥫' },
  { id: 'congelados', name: 'Congelados', emoji: '🧊' },
  { id: 'bebidas', name: 'Bebidas', emoji: '🧃' },
  { id: 'limpieza', name: 'Limpieza', emoji: '🧽' },
  { id: 'higiene', name: 'Higiene personal', emoji: '🧴' },
  { id: 'hogar', name: 'Hogar', emoji: '🏠' },
  { id: 'mascotas', name: 'Mascotas', emoji: '🐾' },
  { id: 'otros', name: 'Otros', emoji: '📦' },
];
export const shopCat = (id) => SHOP_CATS.find((c) => c.id === id) || SHOP_CATS[SHOP_CATS.length - 1];

const KEYWORDS = {
  fruta: ['manzana', 'platano', 'banana', 'naranja', 'mandarina', 'limon', 'tomate', 'lechuga', 'cebolla', 'ajo', 'patata', 'papa', 'zanahoria', 'pimiento', 'fruta', 'verdura', 'fresa', 'uva', 'pera', 'aguacate', 'pepino', 'calabacin', 'espinaca', 'brocoli', 'melon', 'sandia', 'kiwi', 'champinon', 'seta', 'puerro', 'berenjena', 'perejil', 'cilantro'],
  carne: ['pollo', 'carne', 'ternera', 'cerdo', 'pescado', 'salmon', 'merluza', 'gamba', 'jamon', 'chorizo', 'pavo', 'hamburguesa', 'salchicha', 'lomo', 'filete', 'bacon', 'pechuga', 'costilla'],
  lacteos: ['leche', 'yogur', 'queso', 'mantequilla', 'nata', 'huevo', 'kefir'],
  pan: ['pan', 'baguette', 'barra', 'bolleria', 'croissant', 'tostada', 'magdalena', 'bizcocho'],
  despensa: ['arroz', 'pasta', 'macarron', 'espagueti', 'harina', 'azucar', 'sal', 'aceite', 'vinagre', 'atun', 'lenteja', 'garbanzo', 'alubia', 'frijol', 'cafe', 'infusion', 'cereal', 'galleta', 'chocolate', 'miel', 'mermelada', 'especia', 'conserva', 'caldo', 'salsa', 'tomate frito', 'avena', 'legumbre'],
  congelados: ['congelad', 'helado', 'pizza', 'hielo'],
  bebidas: ['agua', 'refresco', 'cerveza', 'vino', 'zumo', 'jugo', 'cola', 'soda', 'tonica'],
  limpieza: ['detergente', 'lejia', 'cloro', 'suavizante', 'friegasuelos', 'lavavajillas', 'fregona', 'estropajo', 'bayeta', 'bolsas de basura', 'bolsa de basura', 'limpiador', 'lavaplatos', 'ambientador', 'quitagrasas', 'pastillas lavavajillas'],
  higiene: ['champu', 'gel', 'pasta de dientes', 'dentifrico', 'cepillo de dientes', 'desodorante', 'papel higienico', 'compresa', 'tampon', 'maquinilla', 'colonia', 'jabon', 'toallitas', 'algodon', 'panal', 'crema', 'acondicionador', 'enjuague'],
  hogar: ['bombilla', 'pila', 'servilleta', 'papel de cocina', 'papel de aluminio', 'film', 'vela', 'cinta', 'mechero'],
  mascotas: ['pienso', 'comida de gato', 'comida de perro', 'arena', 'snack perro', 'snack gato'],
};

export function guessCategory(name) {
  const n = ` ${norm(name)}`;
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    for (const w of words) if (n.includes(` ${norm(w)}`)) return cat;
  }
  return 'otros';
}

export const UNITS = [
  ['ud', 'unidades'], ['kg', 'kilos'], ['g', 'gramos'], ['L', 'litros'], ['ml', 'mililitros'],
  ['paq', 'paquetes'], ['bote', 'botes'], ['rollo', 'rollos'], ['caja', 'cajas'], ['bolsa', 'bolsas'],
];

export const REPEATS = [
  ['none', 'Nunca'], ['daily', 'Cada día'], ['weekly', 'Cada semana'],
  ['biweekly', 'Cada 2 semanas'], ['monthly', 'Cada mes'],
];
export const repeatLabel = (r) => (REPEATS.find((x) => x[0] === r) || REPEATS[0])[1];

export const CURRENCIES = [
  ['EUR', 'Euro (€)'], ['USD', 'Dólar estadounidense ($)'], ['MXN', 'Peso mexicano ($)'],
  ['COP', 'Peso colombiano ($)'], ['ARS', 'Peso argentino ($)'], ['CLP', 'Peso chileno ($)'],
  ['PEN', 'Sol peruano (S/)'], ['GBP', 'Libra esterlina (£)'],
];

export const BUDGET_EMOJIS = ['🛒', '🧽', '💡', '🔧', '📦', '🍿', '🚗', '🐾', '🎁', '💊', '📺', '🏠', '🌱', '👶', '🍽️', '✈️', '🧾', '👕'];

export const DEFAULT_BUDGETS = [
  { id: 'b-super', name: 'Supermercado', emoji: '🛒', color: 'green' },
  { id: 'b-limpieza', name: 'Limpieza y hogar', emoji: '🧽', color: 'blue' },
  { id: 'b-servicios', name: 'Facturas y servicios', emoji: '💡', color: 'orange' },
  { id: 'b-mant', name: 'Mantenimiento', emoji: '🔧', color: 'gray' },
  { id: 'b-otros', name: 'Otros', emoji: '📦', color: 'purple' },
];

/* ---------- Miembros ---------- */

export const members = () => store.list('members').sort((a, b) => a.createdAt - b.createdAt);
export const member = (id) => store.get('members', id);
export const meId = () => (store.meta.me && member(store.meta.me) ? store.meta.me : null);
export const memberName = (id) => member(id)?.name || 'Alguien';
export const currency = () => store.data.settings.currency || 'EUR';

export function nextColor() {
  const used = new Set(members().map((m) => m.color));
  return COLORS.find((c) => !used.has(c)) || COLORS[members().length % COLORS.length];
}

export function saveMember(m) {
  return store.put('members', { color: nextColor(), ...m, name: m.name.trim() });
}

export function removeMember(id) {
  store.batch(() => {
    for (const t of tasks()) if (t.assignee === id) store.patch('tasks', t.id, { assignee: null });
    store.remove('members', id);
  });
  if (store.meta.me === id) store.setMeta({ me: null });
}

/* ---------- Actividad ---------- */

export function log(text, kind = 'info') {
  store.put('activity', { id: uid(), kind, text, by: meId(), at: Date.now() });
}
export const activity = (limit = 8) => store.list('activity').sort((a, b) => b.at - a.at).slice(0, limit);

/* ---------- Alta del hogar ---------- */

export function seedBudgets() {
  DEFAULT_BUDGETS.forEach((b, i) => {
    if (!store.data.budgets[b.id]) store.put('budgets', { ...b, amounts: {}, order: i });
  });
}

export function createHousehold({ name, myName, others, currency: cur }) {
  let meRec;
  store.batch(() => {
    store.setSettings({ name: name.trim() || 'Mi casa', currency: cur || 'EUR' });
    meRec = store.put('members', { id: uid(), name: myName.trim(), color: 'blue' });
    others.filter((n) => n.trim()).forEach((n) => saveMember({ id: uid(), name: n }));
    seedBudgets();
  });
  store.setMeta({ me: meRec.id, onboarded: true });
}

/* ---------- Compras y despensa ---------- */

export const items = () => store.list('items');
export const shoppingList = () => items().filter((i) => i.onList);
export const isLow = (i) => i.min > 0 && (i.stock || 0) <= i.min;
export const lowStock = () => items().filter(isLow);
export const findItem = (name) => items().find((i) => norm(i.name) === norm(name));

/** Añade a la lista por nombre (reutiliza el artículo si ya existe). */
export function addToList(name) {
  const clean = name.trim();
  if (!clean) return null;
  const ex = findItem(clean);
  if (ex?.onList) return { item: ex, status: 'already' };
  let item;
  store.batch(() => {
    if (ex) item = store.patch('items', ex.id, { onList: true, listQty: ex.listQty || 1, addedBy: meId() });
    else item = store.put('items', newItem({ name: clean, onList: true }));
    log(`añadió ${item.name} a la lista`, 'list');
  });
  return { item, status: ex ? 'added' : 'new' };
}

export function newItem(data = {}) {
  return {
    id: uid(), name: '', category: data.name ? guessCategory(data.name) : 'otros', stock: 0, unit: 'ud',
    min: 0, autoAdd: true, onList: false, listQty: 1, note: '', addedBy: meId(), ...data,
  };
}

export function saveItem(it) {
  const prev = it.id && store.get('items', it.id);
  return store.batch(() => {
    const saved = store.put('items', it);
    if (!prev && saved.onList) log(`añadió ${saved.name} a la lista`, 'list');
    return saved;
  });
}

export function toggleOnList(id) {
  const it = store.get('items', id);
  if (!it) return null;
  store.batch(() => {
    store.patch('items', id, { onList: !it.onList, listQty: it.listQty || 1 });
    if (!it.onList) log(`añadió ${it.name} a la lista`, 'list');
  });
  return !it.onList;
}

/** Cambia lo que queda. Devuelve true si se añadió solo a la lista. */
export function adjustStock(id, delta) {
  const it = store.get('items', id);
  if (!it) return false;
  const stock = Math.max(0, round2((it.stock || 0) + delta));
  const autoAdd = delta < 0 && it.autoAdd && it.min > 0 && stock <= it.min && !it.onList;
  store.batch(() => {
    store.patch('items', id, autoAdd ? { stock, onList: true, listQty: it.listQty || 1 } : { stock });
    if (autoAdd) log(`${it.name} se está acabando: añadido a la lista`, 'list');
  });
  return autoAdd;
}

export function markBought(id, { qty, amount = 0, budgetId, by } = {}) {
  const it = store.get('items', id);
  if (!it) return null;
  const q = qty > 0 ? qty : it.listQty || 1;
  const buyer = by ?? meId();
  return store.batch(() => {
    const p = store.put('purchases', {
      id: uid(), itemId: id, name: it.name, qty: q, unit: it.unit, by: buyer,
      at: Date.now(), date: today(), billed: false, expenseId: null,
    });
    store.patch('items', id, { stock: round2((it.stock || 0) + q), onList: false, listQty: 1 });
    if (amount > 0) {
      const e = saveExpense({ amount, budgetId: budgetId || defaultBudgetFor(it.category), desc: it.name, by: buyer, date: today(), purchaseIds: [p.id] });
      store.patch('purchases', p.id, { billed: true, expenseId: e.id });
    }
    log(`compró ${it.name}`, 'buy');
    return p;
  });
}

const BILL_WINDOW = 3 * 86400000;
export function unbilledPurchases() {
  const me = meId();
  return store.list('purchases')
    .filter((p) => !p.billed && p.at > Date.now() - BILL_WINDOW && (!me || !p.by || p.by === me))
    .sort((a, b) => a.at - b.at);
}

export function dismissPurchases(ids) {
  store.batch(() => ids.forEach((id) => store.patch('purchases', id, { billed: true })));
}

export const purchases = (limit = 150) => store.list('purchases').sort((a, b) => b.at - a.at).slice(0, limit);

export function defaultBudgetFor(category) {
  const b = budgets();
  const want = ['limpieza', 'higiene', 'hogar'].includes(category) ? 'b-limpieza' : 'b-super';
  return (b.find((x) => x.id === want) || b.find((x) => x.id === 'b-super') || b[0])?.id || '';
}

export function billSummary(ps) {
  const cats = ps.map((p) => store.get('items', p.itemId)?.category || 'otros');
  const votes = {};
  for (const c of cats) votes[defaultBudgetFor(c)] = (votes[defaultBudgetFor(c)] || 0) + 1;
  const budgetId = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return { budgetId, desc: `Compra: ${listNames(ps.map((p) => p.name), 4)}` };
}

/* ---------- Tareas ---------- */

export const tasks = () => store.list('tasks');
export const pendingTasks = () => tasks().filter((t) => !t.done);
export const sortTasks = (arr) =>
  arr.sort((a, b) => (a.due || '9999') .localeCompare(b.due || '9999') || a.createdAt - b.createdAt);

export function nextDue(date, repeat) {
  switch (repeat) {
    case 'daily': return addDays(date, 1);
    case 'weekly': return addDays(date, 7);
    case 'biweekly': return addDays(date, 14);
    case 'monthly': return addMonths(date, 1);
    default: return date;
  }
}

export function saveTask(t) {
  const isNew = !(t.id && store.get('tasks', t.id));
  return store.batch(() => {
    const saved = store.put('tasks', t);
    if (isNew) log(`creó la tarea «${saved.title}»`, 'task');
    return saved;
  });
}

/** Completa una tarea. Si se repite, la reprograma (y rota el responsable si procede). */
export function completeTask(id) {
  const t = store.get('tasks', id);
  if (!t) return null;
  return store.batch(() => {
    log(`completó «${t.title}»`, 'done');
    if (t.repeat && t.repeat !== 'none') {
      const now = today();
      let next = t.due || now;
      let guard = 0;
      do { next = nextDue(next, t.repeat); } while (next <= now && guard++ < 1000);
      let assignee = t.assignee || null;
      if (t.rotate) {
        const ms = members();
        if (ms.length) {
          const idx = ms.findIndex((m) => m.id === t.assignee);
          assignee = ms[(idx + 1) % ms.length].id;
        }
      }
      store.patch('tasks', id, { due: next, assignee, lastDoneAt: Date.now(), lastDoneBy: meId() });
      return { next, assignee, repeat: true };
    }
    store.patch('tasks', id, { done: true, doneAt: Date.now(), doneBy: meId() });
    return { repeat: false };
  });
}

export const uncompleteTask = (id) => store.patch('tasks', id, { done: false, doneAt: null, doneBy: null });

export function clearDoneTasks() {
  store.batch(() => tasks().filter((t) => t.done).forEach((t) => store.remove('tasks', t.id)));
}

/* ---------- Finanzas ---------- */

export const budgets = () =>
  store.list('budgets').sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.createdAt - b.createdAt);

/** Presupuesto vigente para un mes: el último valor fijado en ese mes o antes. */
export function budgetAmount(b, month) {
  const keys = Object.keys(b.amounts || {}).filter((k) => k <= month).sort();
  return keys.length ? Number(b.amounts[keys[keys.length - 1]]) || 0 : 0;
}

export function saveBudget(b, month, amount) {
  const amounts = { ...(b.amounts || {}) };
  if (amount !== undefined && budgetAmount(b, month) !== amount) {
    for (const k of Object.keys(amounts)) if (k > month) delete amounts[k];
    amounts[month] = amount;
  }
  const order = b.order ?? budgets().length;
  return store.put('budgets', { ...b, amounts, order });
}

export function saveExpense(e) {
  const isNew = !(e.id && store.get('expenses', e.id));
  return store.batch(() => {
    const saved = store.put('expenses', { ...e, amount: round2(e.amount) });
    if (isNew) log(`anotó un gasto: ${saved.desc || 'sin concepto'}`, 'expense');
    return saved;
  });
}

export const expensesIn = (month) =>
  store.list('expenses').filter((e) => monthOf(e.date) === month).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

export function monthSummary(month) {
  const exps = expensesIn(month);
  const bs = budgets();
  const known = new Set(bs.map((b) => b.id));
  const rows = bs.map((b) => {
    const amount = budgetAmount(b, month);
    const spent = round2(exps.filter((e) => e.budgetId === b.id).reduce((s, e) => s + e.amount, 0));
    return { b, amount, spent, remaining: round2(amount - spent) };
  });
  const otherSpent = round2(exps.filter((e) => !known.has(e.budgetId)).reduce((s, e) => s + e.amount, 0));
  const totalBudget = round2(rows.reduce((s, r) => s + r.amount, 0));
  const totalSpent = round2(rows.reduce((s, r) => s + r.spent, 0) + otherSpent);
  const byMember = {};
  for (const e of exps) byMember[e.by || ''] = round2((byMember[e.by || ''] || 0) + e.amount);
  return { month, rows, otherSpent, totalBudget, totalSpent, remaining: round2(totalBudget - totalSpent), expenses: exps, byMember };
}
