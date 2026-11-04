// Compras: lista de la compra, despensa (lo que queda) e historial.
import { store } from '../store.js';
import { app } from '../app.js';
import * as D from '../domain.js';
import { esc, fmtQty, fmtDay, groupBy, parseAmount, listNames } from '../util.js';
import { icon } from '../icons.js';
import { largeTitle, group, row, check, segmented, empty, glassBtn, F, avatar } from '../ui.js';
import { openSheet, confirmDialog, toast } from '../overlays.js';
import { openExpenseSheet, amountField } from './money.js';

const state = { seg: 'list', q: '', quick: '' };

const qtyLabel = (n, unit) => `${fmtQty(n)} ${unit || 'ud'}`;

/* ---------- Hojas ---------- */

export function openItemSheet(id, defaults = {}) {
  const prev = id ? store.get('items', id) : null;
  const it = prev || D.newItem(defaults);
  const isNew = !prev;
  const body =
    group({
      body: F.text({ name: 'name', value: it.name, placeholder: 'Nombre (p. ej. Leche)', attrs: `autocomplete="off" autocapitalize="sentences"${isNew ? ' autofocus' : ''}` })
        + F.select({ name: 'category', label: 'Categoría', value: it.category, options: D.SHOP_CATS.map((c) => [c.id, `${c.emoji} ${c.name}`]) }),
    })
    + group({
      header: 'Lista de la compra',
      body: F.toggle({ name: 'onList', label: 'Pendiente de comprar', checked: it.onList })
        + F.stepper({ name: 'listQty', label: 'Cantidad a comprar', value: it.listQty || 1, min: 0 })
        + F.text({ name: 'note', label: 'Nota', value: it.note, placeholder: 'Marca, tamaño…' }),
    })
    + group({
      header: 'Despensa',
      footer: 'Cuando lo que queda llegue al mínimo, se añadirá solo a la lista de la compra.',
      body: F.stepper({ name: 'stock', label: 'Quedan', value: it.stock || 0, min: 0 })
        + F.select({ name: 'unit', label: 'Unidad', value: it.unit, options: D.UNITS })
        + F.stepper({ name: 'min', label: 'Mínimo', value: it.min || 0, min: 0 })
        + F.toggle({ name: 'autoAdd', label: 'Añadir a la lista al llegar al mínimo', checked: it.autoAdd !== false }),
    })
    + (isNew ? '' : group({ body: F.button({ label: 'Marcar como comprado…', action: 'buy' }) })
      + group({ body: F.button({ label: 'Eliminar artículo', action: 'delete', cls: 'destructive' }) }));

  const save = (v) => D.saveItem({
    ...it,
    name: v.name.trim(),
    category: v.category,
    onList: v.onList,
    listQty: parseAmount(v.listQty) || 1,
    note: v.note.trim(),
    stock: Math.max(0, parseAmount(v.stock)),
    unit: v.unit,
    min: Math.max(0, parseAmount(v.min)),
    autoAdd: v.autoAdd,
  });

  openSheet({
    title: isNew ? 'Nuevo artículo' : 'Artículo',
    body,
    require: 'name',
    onDone: (v) => {
      const dup = isNew && D.findItem(v.name);
      if (dup) {
        D.saveItem({ ...dup, onList: dup.onList || v.onList });
        toast(`${dup.name} ya existía; se ha actualizado`);
        return;
      }
      save(v);
    },
    onMount(api) {
      if (!isNew) return;
      const sel = api.body.querySelector('[name=category]');
      let touched = false;
      sel.addEventListener('change', () => { touched = true; });
      api.body.querySelector('[name=name]').addEventListener('input', (e) => {
        if (!touched) sel.value = D.guessCategory(e.target.value);
      });
    },
    actions: {
      buy(el, api) {
        save(api.values());
        api.close();
        setTimeout(() => openBuySheet(it.id), 250);
      },
      async delete(el, api) {
        if (await confirmDialog({ title: `¿Eliminar «${it.name}»?`, message: 'Se quitará de la lista y de la despensa.' })) {
          store.remove('items', it.id);
          api.close();
        }
      },
    },
  });
}

export function openBuySheet(id) {
  const it = store.get('items', id);
  if (!it) return;
  const bs = D.budgets();
  const body = amountField('', 'Importe (opcional)')
    + group({
      body: F.stepper({ name: 'qty', label: 'Cantidad comprada', value: it.listQty || 1, min: 0, unit: it.unit })
        + (bs.length ? F.select({ name: 'budgetId', label: 'Categoría del gasto', value: D.defaultBudgetFor(it.category), options: bs.map((b) => [b.id, `${b.emoji} ${b.name}`]) }) : '')
        + F.select({ name: 'by', label: 'Comprado por', value: D.meId() || '', options: [['', '—'], ...D.members().map((m) => [m.id, m.name])] }),
      footer: 'Lo comprado se suma a la despensa. Si indicas un importe, se anota también como gasto en Finanzas.',
    });
  openSheet({
    title: it.name,
    body,
    doneLabel: 'Comprado',
    onDone(v) {
      D.markBought(id, { qty: parseAmount(v.qty), amount: parseAmount(v.amount), budgetId: v.budgetId, by: v.by || null });
      toast(`${it.name}: comprado`);
    },
  });
}

/* ---------- Banner de compras sin importe ---------- */

export function unbilledBanner() {
  const ps = D.unbilledPurchases();
  if (!ps.length) return '';
  return `<div class="banner">
    <span class="itile c-green">${icon('receipt')}</span>
    <div class="banner-main"><div class="banner-title">¿Cuánto ha costado la compra?</div>
    <div class="banner-text">${esc(listNames(ps.map((p) => p.name)))}</div></div>
    <button type="button" class="btn-tinted small" data-action="bill">Añadir</button>
    <button type="button" class="icon-btn" data-action="dismiss-bill" aria-label="Descartar">${icon('xmark')}</button>
  </div>`;
}

export const shoppingActions = {
  buy(el) {
    const it = store.get('items', el.dataset.id);
    if (!it) return;
    el.classList.add('on');
    el.closest('.row')?.classList.add('leaving');
    setTimeout(() => {
      D.markBought(it.id);
      toast(`${it.name} → despensa`, 'box');
    }, 420);
  },
  'edit-item': (el) => openItemSheet(el.dataset.id),
  bill() {
    const ps = D.unbilledPurchases();
    const { budgetId, desc } = D.billSummary(ps);
    openExpenseSheet(null, { desc, budgetId, purchaseIds: ps.map((p) => p.id) });
  },
  'dismiss-bill': () => D.dismissPurchases(D.unbilledPurchases().map((p) => p.id)),
};

/* ---------- Vista ---------- */

function listView() {
  const list = D.shoppingList();
  const quick = `<div class="group quick-group"><div class="list"><div class="row quick">
      <div class="row-lead"><span class="quick-plus">${icon('plus')}</span></div>
      <div class="row-body"><input name="quick-item" class="field-input" placeholder="Añadir a la lista" enterkeyhint="done" autocomplete="off" autocapitalize="sentences" value="${esc(state.quick)}"></div>
    </div></div></div>`;

  const low = D.lowStock().filter((i) => !i.onList);
  const lowChips = low.length ? `<div class="hint-row"><span class="hint-label">Se está acabando:</span><div class="chips inline">${low.slice(0, 8).map((i) =>
    `<button type="button" class="chip" data-action="add-low" data-id="${i.id}">${icon('plus')}${esc(i.name)}</button>`).join('')}</div></div>` : '';

  if (!list.length) {
    return unbilledBanner() + quick + lowChips + empty({ icon: 'cart', title: 'No falta nada', text: 'Escribe arriba lo que haya que comprar. Al marcarlo como comprado pasará a la despensa.' });
  }
  const byCat = groupBy(list, (i) => i.category);
  const groups = D.SHOP_CATS.filter((c) => byCat.has(c.id)).map((c) => group({
    header: `${c.emoji} ${c.name}`,
    body: byCat.get(c.id).sort((a, b) => a.name.localeCompare(b.name)).map((i) => {
      const sub = [];
      if ((i.listQty || 1) !== 1 || i.unit !== 'ud') sub.push(`<span>${esc(qtyLabel(i.listQty || 1, i.unit))}</span>`);
      if (i.note) sub.push(`<span>${esc(i.note)}</span>`);
      if (i.min > 0 || i.stock > 0) sub.push(`<span class="muted">Quedan ${esc(fmtQty(i.stock || 0))}</span>`);
      return row({
        lead: check({ action: 'buy', id: i.id, color: 'green', label: `Marcar ${i.name} como comprado` }),
        title: esc(i.name), sub: sub.join('<span class="dot">·</span>'), action: 'edit-item', id: i.id,
      });
    }).join(''),
  })).join('');
  return unbilledBanner() + quick + lowChips + groups
    + `<p class="footnote">Toca el círculo cuando lo compres: se sumará a la despensa.</p>`;
}

function pantryRows() {
  const q = state.q.trim().toLowerCase();
  const all = D.items().filter((i) => !q || i.name.toLowerCase().includes(q));
  if (!all.length) {
    return q ? empty({ icon: 'search', title: 'Sin resultados', text: `No hay nada que coincida con «${esc(state.q)}».` })
      : empty({ icon: 'box', title: 'La despensa está vacía', text: 'Lo que compres aparecerá aquí para que sepáis cuánto queda de cada cosa.', action: 'new-item', actionLabel: 'Añadir artículo' });
  }
  const byCat = groupBy(all, (i) => i.category);
  return D.SHOP_CATS.filter((c) => byCat.has(c.id)).map((c) => group({
    header: `${c.emoji} ${c.name}`,
    body: byCat.get(c.id).sort((a, b) => a.name.localeCompare(b.name)).map((i) => {
      const st = i.stock || 0;
      const status = st <= 0 && (i.min > 0 || i.onList) ? '<span class="tag c-red">Agotado</span>'
        : D.isLow(i) ? '<span class="tag c-orange">Queda poco</span>'
          : i.min > 0 ? `<span class="muted">Mínimo ${esc(fmtQty(i.min))}</span>` : '';
      return row({
        title: esc(i.name), sub: status, action: 'edit-item', id: i.id,
        trail: `<button type="button" class="mini-btn ${i.onList ? 'on' : ''}" data-action="toggle-list" data-id="${i.id}" aria-label="${i.onList ? 'Quitar de' : 'Añadir a'} la lista">${icon('cart')}</button>
          <div class="mini-step"><button type="button" data-action="dec" data-id="${i.id}" aria-label="Gastar uno">${icon('minus')}</button>
          <span class="v">${esc(fmtQty(st))}<small>${esc(i.unit || 'ud')}</small></span>
          <button type="button" data-action="inc" data-id="${i.id}" aria-label="Añadir uno">${icon('plus')}</button></div>`,
      });
    }).join(''),
  })).join('');
}

function pantryView() {
  const low = D.lowStock().filter((i) => !i.onList);
  const lowBanner = low.length ? `<div class="banner">
    <span class="itile c-orange">${icon('warning')}</span>
    <div class="banner-main"><div class="banner-title">${low.length === 1 ? 'Un artículo se está acabando' : `${low.length} artículos se están acabando`}</div>
    <div class="banner-text">${esc(listNames(low.map((i) => i.name)))}</div></div>
    <button type="button" class="btn-tinted small" data-action="add-all-low">Añadir a la lista</button></div>` : '';
  return `<label class="search">${icon('search')}<input name="pantry-q" type="search" placeholder="Buscar en la despensa" value="${esc(state.q)}" autocomplete="off"></label>`
    + lowBanner + `<div id="pantry-list">${pantryRows()}</div>`;
}

function historyView() {
  const ps = D.purchases();
  if (!ps.length) return empty({ icon: 'clock', title: 'Sin compras todavía', text: 'Aquí verás lo que se ha ido comprando y quién lo compró.' });
  const byDate = groupBy(ps, (p) => p.date);
  return [...byDate.entries()].map(([date, arr]) => group({
    header: fmtDay(date),
    body: arr.map((p) => {
      const m = D.member(p.by);
      return row({
        lead: avatar(m, 'sm'),
        title: esc(p.name),
        sub: `${esc(qtyLabel(p.qty, p.unit))}<span class="dot">·</span>${esc(m?.name || 'Alguien')}`,
        trail: p.expenseId && store.get('expenses', p.expenseId) ? `<span class="muted-icon" title="Con gasto">${icon('receipt')}</span>` : '',
        action: p.itemId && store.get('items', p.itemId) ? 'edit-item' : '', id: p.itemId,
      });
    }).join(''),
  })).join('');
}

export default {
  id: 'shopping',
  title: () => 'Compras',
  badge: () => D.shoppingList().length,
  navRight: () => glassBtn('plus', 'new-item', 'Nuevo artículo'),
  onShow(opts) { if (opts.seg) state.seg = opts.seg; },
  render() {
    const n = D.shoppingList().length;
    const content = state.seg === 'pantry' ? pantryView() : state.seg === 'history' ? historyView() : listView();
    return largeTitle('Compras')
      + segmented('seg', [['list', n ? `Lista (${n})` : 'Lista'], ['pantry', 'Despensa'], ['history', 'Historial']], state.seg)
      + content;
  },
  actions: {
    ...shoppingActions,
    seg(el) { state.seg = el.dataset.value; app.render(); },
    'new-item': () => openItemSheet(null, { onList: state.seg === 'list' }),
    'add-low'(el) {
      const it = store.get('items', el.dataset.id);
      if (it) { D.toggleOnList(it.id); toast(`${it.name} añadido a la lista`, 'cart'); }
    },
    'add-all-low'() {
      const low = D.lowStock().filter((i) => !i.onList);
      store.batch(() => low.forEach((i) => D.toggleOnList(i.id)));
      toast(low.length === 1 ? 'Añadido a la lista' : `${low.length} artículos añadidos a la lista`, 'cart');
    },
    'toggle-list'(el) {
      const it = store.get('items', el.dataset.id);
      if (!it) return;
      const on = D.toggleOnList(it.id);
      toast(on ? `${it.name} añadido a la lista` : `${it.name} quitado de la lista`, 'cart');
    },
    inc(el) { D.adjustStock(el.dataset.id, 1); },
    dec(el) {
      const it = store.get('items', el.dataset.id);
      if (D.adjustStock(el.dataset.id, -1)) toast(`Queda poco ${it.name}: añadido a la lista`, 'cart');
    },
  },
  onInput(e) {
    if (e.target.name === 'quick-item') state.quick = e.target.value;
    if (e.target.name === 'pantry-q') {
      state.q = e.target.value;
      const l = document.getElementById('pantry-list');
      if (l) l.innerHTML = pantryRows();
    }
  },
  onKeydown(e) {
    if (e.target.name !== 'quick-item' || e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const v = e.target.value.trim();
    if (!v) { e.target.blur(); return; }
    state.quick = '';
    const r = D.addToList(v);
    if (r?.status === 'already') {
      e.target.value = '';
      toast(`${r.item.name} ya está en la lista`, 'info');
    }
  },
};

