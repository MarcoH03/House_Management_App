// Inicio: resumen de la casa (compras, tareas, presupuesto y actividad).
import { store } from '../store.js';
import { app } from '../app.js';
import * as D from '../domain.js';
import { esc, fmtLongDate, fmtMoney, today, monthOf, timeAgo, fmtMonth, isIOS, isStandalone, fmtQty } from '../util.js';
import { icon } from '../icons.js';
import { largeTitle, section, group, row, avatar, check, progress } from '../ui.js';
import { unbilledBanner, shoppingActions, openItemSheet } from './shopping.js';
import { openTaskSheet, taskRow, completeWithFeedback } from './tasks.js';
import { openExpenseSheet } from './money.js';
import { syncIndicator, openInstallSheet } from './settings.js';

function tile({ tab, seg, color, ic, label, value, sub = '' }) {
  return `<button type="button" class="tile" data-action="go" data-tab="${tab}" ${seg ? `data-seg="${seg}"` : ''}>
    <span class="tile-icon c-${color}">${icon(ic)}</span><span class="tile-value">${value}</span>
    <span class="tile-label">${label}${sub ? `<small>${sub}</small>` : ''}</span></button>`;
}

export default {
  id: 'home',
  title: () => store.data.settings.name || 'Casa',
  navRight: () => syncIndicator(),
  render() {
    const t0 = today();
    const list = D.shoppingList();
    const low = D.lowStock();
    const pending = D.pendingTasks();
    const me = D.meId();
    const due = D.sortTasks(pending.filter((t) => t.due && t.due <= t0))
      .sort((a, b) => (b.assignee === me) - (a.assignee === me));
    const overdue = pending.filter((t) => t.due && t.due < t0).length;
    const mine = pending.filter((t) => t.assignee === me).length;
    const s = D.monthSummary(monthOf(t0));
    const cur = D.currency();
    const meName = me ? D.memberName(me) : '';

    const install = isIOS && !isStandalone() && !store.meta.installHint ? `<div class="banner">
      <span class="itile c-blue">${icon('phone')}</span>
      <div class="banner-main"><div class="banner-title">Instálala en tu iPhone</div><div class="banner-text">Compartir → Añadir a pantalla de inicio</div></div>
      <button type="button" class="btn-tinted small" data-action="install">Cómo</button>
      <button type="button" class="icon-btn" data-action="dismiss-install" aria-label="Cerrar">${icon('xmark')}</button></div>` : '';

    const tiles = `<div class="tiles">
      ${tile({ tab: 'shopping', seg: 'list', color: 'blue', ic: 'cart', label: 'Por comprar', value: list.length })}
      ${tile({ tab: 'tasks', seg: 'pending', color: 'orange', ic: 'checklist', label: 'Tareas', value: pending.length, sub: overdue ? `${overdue} atrasada${overdue > 1 ? 's' : ''}` : me && mine ? `${mine} tuya${mine > 1 ? 's' : ''}` : '' })}
      ${tile({ tab: 'shopping', seg: 'pantry', color: low.length ? 'red' : 'teal', ic: 'box', label: 'Queda poco', value: low.length })}
      ${tile({ tab: 'tasks', seg: 'pending', color: 'red', ic: 'calendar', label: 'Para hoy', value: due.length })}
    </div>`;

    const pct = s.totalBudget ? (s.totalSpent / s.totalBudget) * 100 : 0;
    const budget = `<button type="button" class="card budget-card" data-action="go" data-tab="money">
      <div class="bc-top"><span class="itile c-green">${icon('wallet')}</span><span class="bc-title">${esc(fmtMonth(s.month, false))}</span><span class="chev">${icon('chevronRight')}</span></div>
      ${s.totalBudget
        ? `<div class="bc-value ${s.remaining < 0 ? 'neg' : ''}">${esc(fmtMoney(Math.abs(s.remaining), cur))}<small>${s.remaining < 0 ? 'por encima del presupuesto' : 'disponibles'}</small></div>
           ${progress(pct, pct > 100 ? 'red' : pct > 85 ? 'orange' : 'green')}
           <div class="bc-sub">Gastado ${esc(fmtMoney(s.totalSpent, cur))} de ${esc(fmtMoney(s.totalBudget, cur))}</div>`
        : `<div class="bc-value">${esc(fmtMoney(s.totalSpent, cur))}<small>gastado este mes</small></div>
           <div class="bc-sub">Define un presupuesto en Finanzas para saber cuánto queda.</div>`}
    </button>`;

    const quick = `<div class="quick-actions">
      <button type="button" class="qa" data-action="add-item">${icon('cart')}<span>Compra</span></button>
      <button type="button" class="qa" data-action="add-task">${icon('checklist')}<span>Tarea</span></button>
      <button type="button" class="qa" data-action="add-expense">${icon('receipt')}<span>Gasto</span></button></div>`;

    const todayBody = due.length
      ? group({ body: due.slice(0, 6).map(taskRow).join('') })
      : `<div class="card soft-empty">${icon('sparkles')}<span>No hay nada pendiente para hoy.</span></div>`;

    const listBody = list.length
      ? group({
        body: list.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6).map((i) => row({
          lead: check({ action: 'buy', id: i.id, color: 'green', label: `Marcar ${i.name} como comprado` }),
          title: esc(i.name),
          sub: (i.listQty || 1) !== 1 || i.unit !== 'ud' ? esc(`${fmtQty(i.listQty || 1)} ${i.unit}`) : '',
          action: 'edit-item', id: i.id,
        })).join(''),
      })
      : `<div class="card soft-empty">${icon('cart')}<span>La lista de la compra está vacía.</span></div>`;

    const acts = D.activity(8);
    const activity = acts.length ? section({
      title: 'Actividad reciente',
      body: group({
        body: acts.map((a) => {
          const m = D.member(a.by);
          return row({ lead: avatar(m, 'sm'), title: `<b>${esc(m?.name || 'Alguien')}</b> ${esc(a.text)}`, sub: esc(timeAgo(a.at)), cls: 'compact' });
        }).join(''),
      }),
    }) : '';

    return largeTitle(store.data.settings.name || 'Casa', fmtLongDate() + (meName ? ` · Hola, ${meName}` : ''))
      + install + unbilledBanner() + tiles + budget + quick
      + section({ title: 'Para hoy', trail: `<button type="button" class="link-btn" data-action="go" data-tab="tasks">Ver todas</button>`, body: todayBody })
      + section({ title: 'Lista de la compra', trail: list.length > 6 ? `<button type="button" class="link-btn" data-action="go" data-tab="shopping" data-seg="list">Ver todo (${list.length})</button>` : '', body: listBody })
      + activity;
  },
  actions: {
    ...shoppingActions,
    go(el) { app.go(el.dataset.tab, { seg: el.dataset.seg, top: true }); },
    'add-item': () => openItemSheet(null, { onList: true }),
    'add-task': () => openTaskSheet(),
    'add-expense': () => openExpenseSheet(),
    'complete-task': completeWithFeedback,
    'open-task': (el) => openTaskSheet(el.dataset.id),
    install: openInstallSheet,
    'dismiss-install': () => store.setMeta({ installHint: true }),
  },
};
