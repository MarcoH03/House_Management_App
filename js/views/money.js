// Finanzas: presupuesto mensual por categorías, gastos y lo que queda.
import { store } from '../store.js';
import { app } from '../app.js';
import * as D from '../domain.js';
import { esc, fmtMoney, fmtMonth, fmtDay, monthOf, shiftMonth, today, parseAmount, fmtNum, groupBy, currencyInfo } from '../util.js';
import { icon } from '../icons.js';
import { largeTitle, group, row, empty, glassBtn, F, emojiTile, progress, avatar } from '../ui.js';
import { openSheet, confirmDialog, toast } from '../overlays.js';

const state = { month: monthOf(today()) };
const money = (n) => fmtMoney(n, D.currency());

/** Campo grande para el importe (como en Wallet). */
export function amountField(value = '', label = 'Importe') {
  const { symbol, before } = currencyInfo(D.currency());
  const cur = `<span class="amount-cur">${esc(symbol)}</span>`;
  return `<div class="amount-hero"><div class="amount-label">${esc(label)}</div>
    <label class="amount-line">${before ? cur : ''}<input name="amount" class="amount-input" inputmode="decimal" placeholder="0" autocomplete="off" value="${value ? esc(fmtNum(value)) : ''}">${before ? '' : cur}</label></div>`;
}

const budgetOptions = () => [...D.budgets().map((b) => [b.id, `${b.emoji} ${b.name}`]), ['', 'Sin categoría']];

export function openExpenseSheet(id, defaults = {}) {
  const prev = id ? store.get('expenses', id) : null;
  const e = prev || { amount: 0, desc: '', budgetId: D.budgets()[0]?.id || '', date: today(), by: D.meId() || '', ...defaults };
  const body = amountField(e.amount, prev ? 'Importe' : 'Nuevo gasto')
    + group({
      body: F.text({ name: 'desc', value: e.desc, placeholder: 'Concepto (p. ej. Factura de la luz)', attrs: 'autocapitalize="sentences" autocomplete="off"' })
        + F.select({ name: 'budgetId', label: 'Categoría', value: e.budgetId || '', options: budgetOptions() })
        + F.date({ name: 'date', label: 'Fecha', value: e.date, clearable: false })
        + F.select({ name: 'by', label: 'Pagado por', value: e.by || '', options: [['', '—'], ...D.members().map((m) => [m.id, m.name])] }),
    })
    + (prev ? group({ body: F.button({ label: 'Eliminar gasto', action: 'delete', cls: 'destructive' }) }) : '');

  openSheet({
    title: prev ? 'Gasto' : 'Nuevo gasto',
    body,
    onMount(api) { if (!prev) setTimeout(() => api.body.querySelector('[name=amount]')?.focus(), 350); },
    onDone(v, api) {
      const amount = parseAmount(v.amount);
      if (!(amount > 0)) {
        const el = api.body.querySelector('.amount-hero');
        el.classList.remove('shake');
        void el.offsetWidth;
        el.classList.add('shake');
        return false;
      }
      store.batch(() => {
        const saved = D.saveExpense({ ...e, amount, desc: v.desc.trim(), budgetId: v.budgetId, date: v.date || today(), by: v.by || null });
        for (const pid of defaults.purchaseIds || []) store.patch('purchases', pid, { billed: true, expenseId: saved.id });
      });
      if (!prev) toast(`Gasto de ${money(amount)} anotado`, 'receipt');
    },
    actions: {
      async delete(el, api) {
        if (await confirmDialog({ title: '¿Eliminar este gasto?', message: `${e.desc || 'Sin concepto'} · ${money(e.amount)}` })) {
          store.remove('expenses', e.id);
          api.close();
        }
      },
    },
  });
}

export function openBudgetSheet(id, month = state.month) {
  const prev = id ? store.get('budgets', id) : null;
  const b = prev || { name: '', emoji: '🛒', color: 'green', amounts: {} };
  const amount = prev ? D.budgetAmount(b, month) : 0;
  const exps = prev ? D.expensesIn(month).filter((x) => x.budgetId === id) : [];
  const body =
    `<div class="hero-tile">${emojiTile(b.emoji, b.color, 'xl')}</div>`
    + group({
      body: F.text({ name: 'name', value: b.name, placeholder: 'Nombre de la categoría', attrs: `autocapitalize="sentences" autocomplete="off"${prev ? '' : ' autofocus'}` })
        + F.text({ name: 'amount', label: 'Presupuesto al mes', value: amount ? fmtNum(amount) : '', placeholder: '0', attrs: 'inputmode="decimal" autocomplete="off"' }),
      footer: `El importe se aplica desde ${fmtMonth(month).toLowerCase()} en adelante; los meses anteriores no cambian.`,
    })
    + group({ header: 'Icono', body: `<div class="pad">${F.picker({ name: 'emoji', value: b.emoji, options: D.BUDGET_EMOJIS, kind: 'emoji' })}</div>` })
    + group({ header: 'Color', body: `<div class="pad">${F.picker({ name: 'color', value: b.color, options: D.COLORS })}</div>` })
    + (exps.length ? group({ header: `Gastos de ${fmtMonth(month, false).toLowerCase()}`, body: exps.map(expenseRow).join('') }) : '')
    + (prev ? group({ body: F.button({ label: 'Eliminar categoría', action: 'delete', cls: 'destructive' }), footer: 'Los gastos de esta categoría se conservarán como «Sin categoría».' }) : '');

  openSheet({
    title: prev ? b.name : 'Nueva categoría',
    body,
    require: 'name',
    onMount(api) {
      const tile = api.body.querySelector('.hero-tile');
      api.body.addEventListener('change', () => {
        const v = api.values();
        tile.innerHTML = emojiTile(v.emoji, v.color, 'xl');
      });
    },
    onDone(v) {
      D.saveBudget({ ...b, name: v.name.trim(), emoji: v.emoji, color: v.color }, month, Math.max(0, parseAmount(v.amount)));
    },
    actions: {
      'open-expense': (el) => openExpenseSheet(el.dataset.id),
      async delete(el, api) {
        if (await confirmDialog({ title: `¿Eliminar «${b.name}»?`, message: 'Los gastos ya anotados no se borrarán.' })) {
          store.remove('budgets', b.id);
          api.close();
        }
      },
    },
  });
}

function expenseRow(e) {
  const b = store.get('budgets', e.budgetId);
  const m = D.member(e.by);
  return row({
    lead: b ? emojiTile(b.emoji, b.color) : emojiTile('🧾', 'gray'),
    title: esc(e.desc || b?.name || 'Gasto'),
    sub: `${esc(b?.name || 'Sin categoría')}${m ? `<span class="dot">·</span>${esc(m.name)}` : ''}`,
    trail: `<span class="amt">−${esc(money(e.amount))}</span>`,
    action: 'open-expense', id: e.id,
  });
}

function summaryCard(s) {
  const segs = s.rows.filter((r) => r.spent > 0);
  const base = Math.max(s.totalBudget, s.totalSpent) || 1;
  const bar = `<div class="stack">${segs.map((r) => `<span style="width:${(r.spent / base) * 100}%;background:var(--${r.b.color})"></span>`).join('')}${s.otherSpent ? `<span style="width:${(s.otherSpent / base) * 100}%;background:var(--gray)"></span>` : ''}</div>`;
  const legend = segs.length ? `<div class="legend">${segs.slice(0, 6).map((r) => `<span><i style="background:var(--${r.b.color})"></i>${esc(r.b.name)}</span>`).join('')}</div>` : '';
  if (!s.totalBudget) {
    return `<div class="card summary"><div class="sum-label">Gastado en ${fmtMonth(s.month, false).toLowerCase()}</div>
      <div class="sum-value">${esc(money(s.totalSpent))}</div>
      <div class="sum-sub">Asigna un presupuesto a cada categoría para ver cuánto queda.</div>${s.totalSpent ? bar + legend : ''}</div>`;
  }
  const pct = Math.round((s.totalSpent / s.totalBudget) * 100);
  return `<div class="card summary"><div class="sum-label">${s.remaining >= 0 ? 'Queda' : 'Te has pasado'}</div>
    <div class="sum-value ${s.remaining < 0 ? 'neg' : ''}">${esc(money(Math.abs(s.remaining)))}</div>
    <div class="sum-sub">Gastado ${esc(money(s.totalSpent))} de ${esc(money(s.totalBudget))} · ${pct}%</div>${bar}${legend}</div>`;
}

export default {
  id: 'money',
  title: () => 'Finanzas',
  navRight: () => glassBtn('plus', 'new-expense', 'Nuevo gasto'),
  onShow(opts) { if (opts.month) state.month = opts.month; },
  render() {
    const s = D.monthSummary(state.month);
    const isCurrent = state.month === monthOf(today());
    const monthNav = `<div class="month-nav">
      <button type="button" class="glass glass-btn sm" data-action="month" data-d="-1" aria-label="Mes anterior">${icon('chevronLeft')}</button>
      <div class="m">${esc(fmtMonth(state.month))}${isCurrent ? '' : '<button type="button" class="link-btn" data-action="month" data-d="0">Volver a hoy</button>'}</div>
      <button type="button" class="glass glass-btn sm" data-action="month" data-d="1" aria-label="Mes siguiente">${icon('chevronRight')}</button></div>`;

    const budgetRows = s.rows.map((r) => {
      const over = r.remaining < 0;
      const pct = r.amount ? (r.spent / r.amount) * 100 : r.spent ? 100 : 0;
      return row({
        lead: emojiTile(r.b.emoji, r.b.color),
        title: esc(r.b.name),
        sub: `<div class="budget-sub">${progress(pct, over ? 'red' : r.b.color)}<span>${r.amount ? `${esc(money(r.spent))} de ${esc(money(r.amount))}` : `${esc(money(r.spent))} gastado · sin presupuesto`}</span></div>`,
        trail: r.amount ? `<div class="amt-col"><span class="amt ${over ? 'neg' : ''}">${esc(money(Math.abs(r.remaining)))}</span><span class="amt-sub">${over ? 'de más' : 'quedan'}</span></div>` : '',
        action: 'open-budget', id: r.b.id, chevron: true, cls: 'tall',
      });
    }).join('')
      + (s.otherSpent ? row({ lead: emojiTile('🧾', 'gray'), title: 'Sin categoría', sub: esc(money(s.otherSpent)) }) : '')
      + row({ lead: `<span class="add-circle">${icon('plus')}</span>`, title: '<span class="tint">Nueva categoría</span>', action: 'new-budget' });

    const people = Object.entries(s.byMember).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const peopleGroup = people.length > 0 && D.members().length > 1 ? group({
      header: 'Quién ha pagado',
      body: people.map(([id, v]) => {
        const m = D.member(id);
        return row({ lead: avatar(m, 'sm'), title: esc(m?.name || 'Sin indicar'), trail: `<span class="amt">${esc(money(v))}</span>` });
      }).join(''),
    }) : '';

    const byDate = groupBy(s.expenses, (e) => e.date);
    const movements = s.expenses.length
      ? [...byDate.entries()].map(([date, arr]) => group({ header: fmtDay(date), body: arr.map(expenseRow).join('') })).join('')
      : empty({ icon: 'receipt', title: 'Sin gastos este mes', text: 'Anota cada gasto de la casa para saber cuánto queda del presupuesto.', action: 'new-expense', actionLabel: 'Anotar gasto' });

    return largeTitle('Finanzas') + monthNav + summaryCard(s)
      + group({ header: 'Presupuestos', body: budgetRows })
      + peopleGroup
      + `<h2 class="sub-title">Movimientos</h2>` + movements;
  },
  actions: {
    month(el) {
      const d = Number(el.dataset.d);
      state.month = d === 0 ? monthOf(today()) : shiftMonth(state.month, d);
      app.render();
    },
    'new-expense': () => openExpenseSheet(null, { date: state.month === monthOf(today()) ? today() : `${state.month}-01` }),
    'open-expense': (el) => openExpenseSheet(el.dataset.id),
    'open-budget': (el) => openBudgetSheet(el.dataset.id, state.month),
    'new-budget': () => openBudgetSheet(null, state.month),
  },
};
