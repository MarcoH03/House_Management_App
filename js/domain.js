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

/** Moneda principal: todo se resume en CUP. */
export const BASE = 'CUP';
export const CURRENCY_CATALOG = [
  ['CUP', 'Peso cubano', '🇨🇺'],
  ['USD', 'Dólar estadounidense', '🇺🇸'],
  ['EUR', 'Euro', '🇪🇺'],
  ['MLC', 'Moneda libremente convertible', '💳'],
  ['USDT', 'Tether (USDT)', '🪙'],
  ['CAD', 'Dólar canadiense', '🇨🇦'],
  ['MXN', 'Peso mexicano', '🇲🇽'],
  ['BRL', 'Real brasileño', '🇧🇷'],
  ['GBP', 'Libra esterlina', '🇬🇧'],
  ['CHF', 'Franco suizo', '🇨🇭'],
];
export const curInfo = (code) => {
  const c = CURRENCY_CATALOG.find((x) => x[0] === code);
  return { code, name: c?.[1] || code, flag: c?.[2] || '💱' };
};
const curOrder = (code) => { const i = CURRENCY_CATALOG.findIndex((x) => x[0] === code); return i < 0 ? 99 : i; };
export const sortCurrencies = (arr) => [...new Set(arr)].sort((a, b) => curOrder(a) - curOrder(b) || a.localeCompare(b));
export const ACCOUNT_EMOJIS = ['🏠', '💵', '🏦', '💳', '🐷', '👛', '🧳', '🎯', '🛒', '🚗', '🎓', '🩺', '🎁', '✈️', '🔧', '📱'];

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
export const currency = () => BASE;

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

export function createHousehold({ name, myName, others }) {
  let meRec;
  store.batch(() => {
    store.setSettings({ name: name.trim() || 'Mi casa', currency: BASE });
    meRec = store.put('members', { id: uid(), name: myName.trim(), color: 'blue' });
    others.filter((n) => n.trim()).forEach((n) => saveMember({ id: uid(), name: n }));
    seedBudgets();
    seedAccounts();
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

export function markBought(id, { qty, amount = 0, currency: cur = BASE, rate: r, accountId, categoryId, by } = {}) {
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
      const e = saveTxn({ type: 'expense', amount, currency: cur, rate: r, accountId: accountId || defaultAccountId(), categoryId: categoryId ?? defaultBudgetFor(it.category), desc: it.name, by: buyer, date: today(), purchaseIds: [p.id] });
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
  const categoryId = Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return { categoryId, desc: `Compra: ${listNames(ps.map((p) => p.name), 4)}` };
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
// Modelo: cuentas con saldo en varias monedas. El saldo NO se guarda: se calcula
// a partir de los movimientos (txns), que son registros independientes y por eso
// se fusionan sin conflictos entre dispositivos.
//
// Tipos de movimiento:
//  income   entrada de dinero          {accountId, currency, amount, rate, usdRate, cup}
//  expense  gasto                      {accountId, currency, amount, rate, usdRate, cup, categoryId}
//  transfer de una cuenta a otra       {accountId, toAccountId, currency, amount}
//  exchange cambio de moneda           {accountId, currency, amount, toCurrency, toAmount, rate}
//
// `rate` (CUP por unidad) y `usdRate` (CUP por USD) se congelan al anotar el
// movimiento: un cambio posterior de la tasa no altera lo ya registrado.

/** Categorías de gasto (se reutiliza la colección antigua de presupuestos). */
export const budgets = () =>
  store.list('budgets').sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.createdAt - b.createdAt);
export const categories = budgets;

export function saveCategory(c) {
  return store.put('budgets', { ...c, order: c.order ?? budgets().length });
}

/* Tasas de cambio */

export const fx = () => store.get('fx', 'current') || { id: 'current', rates: {}, auto: true, source: '', asOf: '' };
export const rateOf = (code) => (code === BASE ? 1 : Number(fx().rates?.[code]) || 0);

export function setRates(rates, { source = 'manual', asOf = new Date().toISOString(), auto } = {}) {
  const cur = fx();
  const clean = {};
  for (const [k, v] of Object.entries(rates)) {
    const n = Number(v);
    if (k !== BASE && n > 0) clean[k] = round2(n);
  }
  return store.put('fx', { ...cur, id: 'current', rates: clean, source, asOf, auto: auto ?? cur.auto !== false });
}

/** Convierte importes entre monedas con la tasa actual (0 si falta alguna tasa). */
export function convert(amount, from, to) {
  const a = rateOf(from);
  const b = rateOf(to);
  return a && b ? round2((amount * a) / b) : 0;
}

/** Monedas en uso: CUP, las que tienen tasa y las de las cuentas. */
export function currenciesInUse() {
  const list = [BASE, ...Object.keys(fx().rates || {})];
  for (const a of accounts()) list.push(...(a.currencies || []));
  return sortCurrencies(list);
}

/* Cuentas */

export const accounts = () =>
  store.list('accounts').sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.createdAt - b.createdAt);
export const account = (id) => store.get('accounts', id);
export const defaultAccountId = () => accounts()[0]?.id || '';

export function seedAccounts() {
  if (!Object.keys(store.data.accounts).length) {
    store.put('accounts', { id: 'acc-casa', name: 'Casa', emoji: '🏠', color: 'blue', currencies: [BASE, 'USD'], order: 0 });
  }
}

export function saveAccount(a) {
  return store.put('accounts', { ...a, name: a.name.trim(), currencies: sortCurrencies(a.currencies?.length ? a.currencies : [BASE]), order: a.order ?? accounts().length });
}

export function addCurrencyToAccount(id, code) {
  const a = account(id);
  if (a && !(a.currencies || []).includes(code)) store.patch('accounts', id, { currencies: sortCurrencies([...(a.currencies || []), code]) });
}

export const txns = () => store.list('txns');

/** Saldos: { accountId: { CUP: 1200, USD: 50 } } */
export function ledger() {
  const bal = {};
  const add = (acc, cur, v) => {
    if (!acc || !cur) return;
    bal[acc] = bal[acc] || {};
    bal[acc][cur] = round2((bal[acc][cur] || 0) + v);
  };
  for (const t of txns()) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') add(t.accountId, t.currency, amt);
    else if (t.type === 'expense') add(t.accountId, t.currency, -amt);
    else if (t.type === 'transfer') { add(t.accountId, t.currency, -amt); add(t.toAccountId, t.currency, amt); }
    else if (t.type === 'exchange') { add(t.accountId, t.currency, -amt); add(t.accountId, t.toCurrency, Number(t.toAmount) || 0); }
  }
  return bal;
}

/** Saldos por moneda de una cuenta, incluyendo las monedas añadidas aunque estén a 0. */
export function accountBalances(a, led = ledger()) {
  const b = led[a.id] || {};
  const out = {};
  for (const c of sortCurrencies([...(a.currencies || []), ...Object.keys(b)])) {
    const v = b[c] || 0;
    if (v !== 0 || (a.currencies || []).includes(c)) out[c] = v;
  }
  return out;
}

/** Valora un conjunto de saldos en CUP y USD al cambio actual. */
export function valuation(byCur) {
  let cup = 0;
  const missing = [];
  for (const [c, v] of Object.entries(byCur)) {
    if (!v) continue;
    const r = rateOf(c);
    if (r) cup += v * r; else missing.push(c);
  }
  const usdRate = rateOf('USD');
  return { cup: round2(cup), usd: usdRate ? round2(cup / usdRate) : null, missing };
}

export function totals(led = ledger()) {
  const byCur = {};
  const known = new Set(accounts().map((a) => a.id));
  for (const [acc, b] of Object.entries(led)) {
    if (!known.has(acc)) continue;
    for (const [c, v] of Object.entries(b)) byCur[c] = round2((byCur[c] || 0) + v);
  }
  const sorted = Object.fromEntries(sortCurrencies(Object.keys(byCur)).map((c) => [c, byCur[c]]));
  return { byCur: sorted, ...valuation(sorted) };
}

/* Movimientos */

const TXN_LOG = { income: 'anotó una entrada', expense: 'anotó un gasto', transfer: 'hizo una transferencia', exchange: 'cambió moneda' };

export function saveTxn(t) {
  const prev = t.id ? store.get('txns', t.id) : null;
  const amount = round2(Math.abs(Number(t.amount) || 0));
  const rec = { by: meId(), date: today(), desc: '', ...t, amount };
  if (rec.type === 'income' || rec.type === 'expense') {
    // La tasa se fija al crear el movimiento (o la que indique el usuario) y no se recalcula después.
    const r = rec.currency === BASE ? 1 : Number(rec.rate) || prev?.rate || rateOf(rec.currency);
    rec.rate = r;
    rec.usdRate = Number(rec.usdRate) || prev?.usdRate || rateOf('USD') || (rec.currency === 'USD' ? r : 0);
    rec.cup = round2(amount * r);
  }
  if (rec.type === 'exchange') {
    rec.toAmount = round2(Math.abs(Number(rec.toAmount) || 0));
    rec.rate = amount ? rec.toAmount / amount : 0;
  }
  return store.batch(() => {
    const saved = store.put('txns', rec);
    if (!prev) {
      const what = rec.type === 'exchange' ? `${rec.currency} → ${rec.toCurrency}` : rec.desc || '';
      log(`${TXN_LOG[rec.type] || 'anotó un movimiento'}${what ? `: ${what}` : ''}`, rec.type);
    }
    return saved;
  });
}

/** Valor en USD de un movimiento con las tasas de su día. */
export const txnUsd = (t) => (t.currency === 'USD' ? t.amount : t.usdRate ? round2(t.cup / t.usdRate) : null);

export const txnsIn = (month) =>
  txns().filter((t) => monthOf(t.date) === month).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

export function monthSummary(month) {
  const list = txnsIn(month);
  const sum = (type) => {
    let cup = 0; let usd = 0; let usdOk = true;
    for (const t of list.filter((x) => x.type === type)) {
      cup += t.cup || 0;
      const u = txnUsd(t);
      if (u == null) usdOk = false; else usd += u;
    }
    return { cup: round2(cup), usd: usdOk ? round2(usd) : null };
  };
  const income = sum('income');
  const spent = sum('expense');
  const byCat = {};
  for (const t of list.filter((x) => x.type === 'expense')) {
    const k = store.get('budgets', t.categoryId) ? t.categoryId : '';
    byCat[k] = round2((byCat[k] || 0) + (t.cup || 0));
  }
  const byMember = {};
  for (const t of list.filter((x) => x.type === 'expense')) byMember[t.by || ''] = round2((byMember[t.by || ''] || 0) + (t.cup || 0));
  return { month, list, income, spent, byCat, byMember };
}

export function accountTxns(id, limit = 40) {
  return txns().filter((t) => t.accountId === id || t.toAccountId === id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, limit);
}

/* Migración desde la versión con presupuestos por categoría */

export function migrateFinance() {
  if (!store.meta.onboarded) return;
  const old = store.list('expenses');
  const needAcc = !Object.keys(store.data.accounts).length;
  const pending = old.filter((e) => !store.data.txns[`mig-${e.id}`]);
  if (!needAcc && !pending.length) return;
  store.batch(() => {
    if (needAcc) seedAccounts();
    const cur = BASE; // la versión anterior solo tenía una moneda; se asume CUP
    for (const e of pending) {
      store.put('txns', {
        id: `mig-${e.id}`, type: 'expense', accountId: defaultAccountId() || 'acc-casa', currency: cur,
        amount: e.amount, rate: cur === BASE ? 1 : rateOf(cur), usdRate: rateOf('USD'),
        cup: round2(e.amount * (cur === BASE ? 1 : rateOf(cur))), categoryId: e.budgetId || '',
        desc: e.desc || '', date: e.date, by: e.by || null, purchaseIds: e.purchaseIds || [], createdAt: e.createdAt,
      });
    }
  });
}
