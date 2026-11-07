// Finanzas: cuentas con saldo en varias monedas, entradas, gastos,
// transferencias y cambios de moneda. Todo se resume en CUP; el equivalente en
// dólares aparece solo en los totales, redondeado y en palabras («unos 58 USD»).
import { store } from '../store.js';
import { app } from '../app.js';
import * as D from '../domain.js';
import { esc, fmtCur, fmtMonth, fmtDay, monthOf, shiftMonth, today, parseAmount, fmtNum, groupBy, round2, timeAgo, LOCALE } from '../util.js';
import { icon } from '../icons.js';
import { largeTitle, group, row, empty, glassBtn, F, emojiTile, avatar, iconTile } from '../ui.js';
import { openSheet, confirmDialog, toast, actionSheet, alertDialog } from '../overlays.js';
import { refreshRates, SOURCE_LABEL } from '../rates.js';

const BASE = D.BASE;
const state = { month: monthOf(today()) };

/** Equivalencia en dólares redondeada y en palabras: «unos 58 USD». */
export function usdWords(cup) {
  const r = D.rateOf('USD');
  if (!r || !cup) return '';
  const usd = Math.abs(cup) / r;
  if (usd < 1) return 'menos de 1 USD';
  return `unos ${fmtCur(Math.round(usd), 'USD')}`;
}
const oneAccount = () => D.accounts().length <= 1;
const usdRounded = (usd) => (Math.abs(usd) < 1 ? 'menos de 1 USD' : `unos ${fmtCur(Math.round(Math.abs(usd)), 'USD')}`);
const allCurrencies = () => D.sortCurrencies([...D.CURRENCY_CATALOG.map((c) => c[0]), ...D.currenciesInUse()]);
const curOptions = (list) => list.map((c) => [c, c]);
const accountOptions = () => D.accounts().map((a) => [a.id, `${a.emoji} ${a.name}${D.isMainAccount(a.id) && D.accounts().length > 1 ? ' (principal)' : ''}`]);
/** Nombre de la cuenta principal, solo si hay varias (con una sola no hace falta decirlo). */
const mainName = () => (D.accounts().length > 1 ? D.mainAccount()?.name || '' : '');
const memberOptions = () => [['', '—'], ...D.members().map((m) => [m.id, m.name])];
const categoryOptions = () => [['', 'Sin categoría'], ...D.categories().map((b) => [b.id, `${b.emoji} ${b.name}`])];

/* ---------- Piezas de formulario ---------- */

/** Importe grande con selector de moneda debajo (como en Wallet). */
export function moneyHero({ label, amount = '', currency = BASE, currencies = allCurrencies(), name = 'amount', curName = 'currency' }) {
  return `<div class="amount-hero"><div class="amount-label">${esc(label)}</div>
    <label class="amount-line"><input name="${name}" class="amount-input" inputmode="decimal" placeholder="0" autocomplete="off" value="${amount ? esc(fmtNum(amount)) : ''}"></label>
    <span class="cur-pick"><select name="${curName}" aria-label="Moneda">${currencies.map((c) => `<option value="${c}" ${c === currency ? 'selected' : ''}>${D.curInfo(c).flag} ${c}</option>`).join('')}</select>${icon('chevronUpDown')}</span>
    <div class="money-hint" data-hint></div></div>`;
}

function rateRow(rate = '') {
  return `<label class="row field" data-rate-row><div class="row-lead">${iconTile('exchange', 'orange')}</div><div class="row-body">
    <span class="field-label" data-rate-label>Tasa</span>
    <input class="field-input right" name="rate" inputmode="decimal" autocomplete="off" value="${rate ? esc(fmtNum(rate)) : ''}" placeholder="0"><span class="suffix">CUP</span></div></label>`;
}

/**
 * Campos de pago reutilizables (gasto, entrada, compra).
 * kind: 'expense' | 'income'
 */
export function paymentBody({ kind, t, label }) {
  const isExp = kind === 'expense';
  const accId = t.accountId || D.defaultAccountId();
  return moneyHero({ label, amount: t.amount, currency: t.currency || BASE })
    + group({
      body: F.text({ name: 'desc', value: t.desc || '', placeholder: isExp ? '¿En qué? (p. ej. Factura de la luz)' : '¿De dónde? (p. ej. Salario, remesa…)', attrs: 'autocapitalize="sentences" autocomplete="off"' })
        + (oneAccount() ? '' : F.select({ name: 'accountId', label: isExp ? 'Pagar desde' : 'Guardar en', value: accId, options: accountOptions() }))
        + (isExp ? F.select({ name: 'categoryId', label: 'Categoría', value: t.categoryId || '', options: categoryOptions() }) : '')
        + F.date({ name: 'date', label: 'Fecha', value: t.date || today(), clearable: false })
        + F.select({ name: 'by', label: isExp ? 'Pagado por' : 'Recibido por', value: t.by || '', options: memberOptions() })
        + (oneAccount() ? `<input type="hidden" name="accountId" value="${esc(accId)}">` : ''),
    })
    + (isExp ? group({ header: 'Etiquetas <span class="opt">(opcional)</span>', body: `<div class="pad">${tagPicker(t.tagIds || [], t.categoryId || '')}</div>` }) : '')
    + group({
      cls: 'rate-group',
      body: rateRow(t.currency && t.currency !== BASE ? t.rate : ''),
      footer: 'Cambiarla solo afecta a este movimiento.',
    });
}

function tagChips(selected, catId) {
  const sel = new Set(selected);
  return D.tagsForCategory(catId).map((g) => `<button type="button" class="tchip ${sel.has(g.id) ? 'on' : ''}" style="--c:${chColor(g.color)}" data-tag="${g.id}" aria-pressed="${sel.has(g.id)}"><i></i>${esc(g.name)}</button>`).join('');
}

export function tagPicker(selected = [], catId = '') {
  return `<div class="tagpick" data-tagpick><input type="hidden" name="tagIds" value="${esc(selected.join(','))}">
    <div class="tchips" data-tchips>${tagChips(selected, catId)}<button type="button" class="tchip add" data-newtag>${icon('plus')}Nueva</button></div></div>`;
}

/** Comportamiento del selector de etiquetas (multiselección y creación en línea). */
export function bindTagPicker(root) {
  const box = root.querySelector('[data-tagpick]');
  if (!box) return;
  const hidden = box.querySelector('[name=tagIds]');
  const ids = () => hidden.value.split(',').filter(Boolean);
  const redraw = () => {
    const catId = root.querySelector('[name=categoryId]')?.value || '';
    box.querySelector('[data-tchips]').innerHTML = `${tagChips(ids(), catId)}<button type="button" class="tchip add" data-newtag>${icon('plus')}Nueva</button>`;
  };
  box.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-tag]');
    if (chip) {
      const cur = new Set(ids());
      if (cur.has(chip.dataset.tag)) cur.delete(chip.dataset.tag); else cur.add(chip.dataset.tag);
      hidden.value = [...cur].join(',');
      chip.classList.toggle('on');
      chip.setAttribute('aria-pressed', chip.classList.contains('on'));
      return;
    }
    const add = e.target.closest('[data-newtag]');
    if (!add) return;
    add.outerHTML = '<input class="tchip-input" data-tag-input placeholder="Nombre" autocapitalize="sentences" autocomplete="off" enterkeyhint="done">';
    const inp = box.querySelector('[data-tag-input]');
    inp.focus();
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const name = inp.value.trim();
      if (name) {
        const g = D.saveTag({ name });
        if (g && !ids().includes(g.id)) hidden.value = [...ids(), g.id].join(',');
      }
      redraw();
    };
    inp.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); commit(); }
      if (ev.key === 'Escape') { ev.stopPropagation(); inp.value = ''; commit(); }
    });
    inp.addEventListener('blur', commit);
  });
  root.querySelector('[name=categoryId]')?.addEventListener('change', redraw);
}

/** Lógica viva: equivalencia en CUP, tasa (oculta salvo que se pida) y saldo disponible. */
export function bindPayment(api, { kind, prev }) {
  const b = api.body;
  if (kind === 'expense') bindTagPicker(b);
  const rateGroup = b.querySelector('.rate-group');
  const rateIn = b.querySelector('[name=rate]');
  const hint = b.querySelector('[data-hint]');
  const label = b.querySelector('[data-rate-label]');
  let touched = !!prev;
  let showRate = false;
  let lastCur = b.querySelector('[name=currency]').value;
  rateIn.addEventListener('input', () => { touched = true; });
  const upd = () => {
    const v = api.values();
    const cur = v.currency;
    if (cur !== lastCur) { touched = !!(prev && prev.currency === cur); lastCur = cur; if (touched) rateIn.value = fmtNum(prev.rate); }
    const foreign = cur !== BASE;
    if (foreign && !touched) rateIn.value = D.rateOf(cur) ? fmtNum(D.rateOf(cur)) : '';
    const amt = parseAmount(v.amount);
    const r = foreign ? parseAmount(rateIn.value) : 1;
    rateGroup.hidden = !foreign || !(showRate || !r);
    label.textContent = `1 ${cur} =`;
    const lines = [];
    if (foreign) {
      lines.push(r
        ? `${amt ? `Son <b>${esc(fmtCur(amt * r))}</b> · ` : ''}<button type="button" class="hint-link" data-show-rate>1 ${esc(cur)} = ${esc(fmtCur(r))}</button>`
        : 'Escribe abajo a cuánto está el cambio');
    }
    if (kind === 'expense' && v.accountId) {
      const acc = D.account(v.accountId);
      const have = (D.ledger()[v.accountId]?.[cur] || 0) + (prev && prev.accountId === v.accountId && prev.currency === cur ? prev.amount : 0);
      const where = oneAccount() ? '' : ` en ${acc?.name || 'la cuenta'}`;
      lines.push(amt > have
        ? `<span class="c-text-red">Solo hay ${esc(fmtCur(have, cur))}${esc(where)}</span>`
        : `Hay ${esc(fmtCur(have, cur))}${esc(where)}`);
    }
    if (v.accountId && !oneAccount() && !D.isMainAccount(v.accountId)) {
      lines.push(`<span class="note">${icon('info')} No sale de la cuenta principal: no contará en ${kind === 'expense' ? 'lo gastado' : 'las entradas'} del mes.</span>`);
    }
    hint.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
  };
  b.addEventListener('click', (e) => {
    if (!e.target.closest('[data-show-rate]')) return;
    showRate = true;
    upd();
    rateIn.focus();
  });
  b.addEventListener('input', upd);
  b.addEventListener('change', upd);
  upd();
}

/** Lee y valida los campos de pago. Devuelve null si falta algo. */
export function readPayment(v, api, { optional = false } = {}) {
  const amount = parseAmount(v.amount);
  if (!(amount > 0)) {
    if (optional) return { amount: 0 };
    shake(api.body.querySelector('.amount-hero'));
    return null;
  }
  const rate = v.currency === BASE ? 1 : parseAmount(v.rate);
  if (!(rate > 0)) {
    shake(api.body.querySelector('.rate-group'));
    return null;
  }
  return { amount, currency: v.currency, rate };
}

function shake(el) {
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

/* ---------- Hojas de movimientos ---------- */

function openPaymentSheet(kind, id, defaults = {}) {
  const prev = id ? store.get('txns', id) : null;
  const t = prev || { type: kind, amount: 0, currency: BASE, accountId: D.defaultAccountId(), date: today(), by: D.meId() || '', desc: '', categoryId: '', ...defaults };
  const isExp = kind === 'expense';
  openSheet({
    title: prev ? (isExp ? 'Gasto' : 'Entrada de dinero') : (isExp ? 'Nuevo gasto' : 'Entrada de dinero'),
    body: paymentBody({ kind, t, label: isExp ? '¿Cuánto costó?' : '¿Cuánto dinero entró?' })
      + (prev ? group({ body: F.button({ label: isExp ? 'Eliminar gasto' : 'Eliminar entrada', action: 'delete', cls: 'destructive' }) }) : ''),
    onMount(api) {
      bindPayment(api, { kind, prev });
      if (!prev) setTimeout(() => api.body.querySelector('[name=amount]')?.focus(), 350);
    },
    onDone(v, api) {
      const p = readPayment(v, api);
      if (!p) return false;
      if (!v.accountId) { alertDialog('Crea una cuenta', 'Necesitas al menos una cuenta para anotar movimientos.'); return false; }
      store.batch(() => {
        const saved = D.saveTxn({ ...t, ...p, type: kind, desc: v.desc.trim(), accountId: v.accountId, categoryId: isExp ? v.categoryId : undefined, tagIds: isExp ? (v.tagIds || '').split(',').filter(Boolean) : undefined, date: v.date || today(), by: v.by || null });
        D.addCurrencyToAccount(v.accountId, p.currency);
        for (const pid of defaults.purchaseIds || []) store.patch('purchases', pid, { billed: true, expenseId: saved.id });
      });
      if (!prev) toast(`${isExp ? 'Gasto' : 'Entrada'} de ${fmtCur(p.amount, p.currency)} anotado`, isExp ? 'receipt' : 'income');
    },
    actions: { delete: deleteAction(t) },
  });
}

function deleteAction(t) {
  return async (el, api) => {
    if (await confirmDialog({ title: '¿Eliminar este movimiento?', message: `${t.desc || TYPE_LABEL[t.type]} · ${fmtCur(t.amount, t.currency)}` })) {
      store.remove('txns', t.id);
      api.close();
    }
  };
}

export const openExpenseSheet = (id, defaults) => openPaymentSheet('expense', id, defaults);
export const openIncomeSheet = (id, defaults) => openPaymentSheet('income', id, defaults);

export function openTransferSheet(id, defaults = {}) {
  const prev = id ? store.get('txns', id) : null;
  const accs = D.accounts();
  if (accs.length < 2 && !prev) {
    alertDialog('Necesitas dos cuentas', 'Crea otra cuenta en Finanzas para poder pasar dinero de una a otra.');
    return;
  }
  // Por defecto: de una cuenta de reserva a la principal (lo habitual al empezar el mes).
  const main = D.mainAccountId();
  const from = defaults.accountId || accs.find((a) => a.id !== main)?.id || accs[0]?.id;
  const to = from === main ? accs.find((a) => a.id !== main)?.id : main;
  const t = prev || { type: 'transfer', amount: 0, currency: BASE, accountId: from, toAccountId: to, date: today(), desc: '', ...defaults };
  openSheet({
    title: 'Transferir',
    body: moneyHero({ label: '¿Cuánto quieres pasar?', amount: t.amount, currency: t.currency })
      + group({
        body: F.select({ name: 'accountId', label: 'Desde', value: t.accountId, options: accountOptions(), lead: iconTile('expense', 'red') })
          + F.select({ name: 'toAccountId', label: 'Hacia', value: t.toAccountId, options: accountOptions(), lead: iconTile('income', 'green') })
          + F.date({ name: 'date', label: 'Fecha', value: t.date, clearable: false })
          + F.text({ name: 'desc', label: 'Nota', value: t.desc, placeholder: 'Opcional' }),
      })
      + (prev ? group({ body: F.button({ label: 'Eliminar transferencia', action: 'delete', cls: 'destructive' }) }) : ''),
    onMount(api) {
      const hint = api.body.querySelector('[data-hint]');
      const upd = () => {
        const v = api.values();
        const have = (D.ledger()[v.accountId]?.[v.currency] || 0) + (prev && prev.accountId === v.accountId && prev.currency === v.currency ? prev.amount : 0);
        const from = D.account(v.accountId)?.name || 'la cuenta';
        hint.innerHTML = parseAmount(v.amount) > have
          ? `<span class="c-text-red">Solo hay ${esc(fmtCur(have, v.currency))} en ${esc(from)}</span>`
          : `Hay ${esc(fmtCur(have, v.currency))} en ${esc(from)}`;
      };
      api.body.addEventListener('input', upd);
      api.body.addEventListener('change', upd);
      upd();
    },
    onDone(v, api) {
      const amount = parseAmount(v.amount);
      if (!(amount > 0)) { shake(api.body.querySelector('.amount-hero')); return false; }
      if (v.accountId === v.toAccountId) { alertDialog('Elige dos cuentas distintas', 'El origen y el destino no pueden ser la misma cuenta.'); return false; }
      store.batch(() => {
        D.saveTxn({ ...t, amount, currency: v.currency, accountId: v.accountId, toAccountId: v.toAccountId, date: v.date || today(), desc: v.desc.trim() });
        D.addCurrencyToAccount(v.toAccountId, v.currency);
      });
      if (!prev) toast(`${fmtCur(amount, v.currency)} transferidos`, 'transfer');
    },
    actions: { delete: deleteAction(t) },
  });
}

export function openExchangeSheet(id, defaults = {}) {
  const prev = id ? store.get('txns', id) : null;
  const t = prev || { type: 'exchange', accountId: D.defaultAccountId(), currency: 'USD', amount: 0, toCurrency: BASE, toAmount: 0, date: today(), desc: '', ...defaults };
  const curs = allCurrencies();
  const sel = (name, value) => `<span class="cur-pick sm"><select name="${name}" aria-label="Moneda">${curs.map((c) => `<option value="${c}" ${c === value ? 'selected' : ''}>${D.curInfo(c).flag} ${c}</option>`).join('')}</select>${icon('chevronUpDown')}</span>`;
  const body = (oneAccount() ? `<input type="hidden" name="accountId" value="${esc(t.accountId || '')}">` : group({ body: F.select({ name: 'accountId', label: 'Cuenta', value: t.accountId, options: accountOptions(), lead: iconTile('bank', 'blue') }) }))
    + `<div class="xchg">
        <div class="xchg-side"><div class="xchg-label">Cambio</div>
          <div class="xchg-line"><input name="amount" class="xchg-input" inputmode="decimal" placeholder="0" autocomplete="off" value="${t.amount ? esc(fmtNum(t.amount)) : ''}">${sel('currency', t.currency)}</div>
          <div class="xchg-sub" data-have></div></div>
        <button type="button" class="xchg-swap glass" data-action="swap" aria-label="Intercambiar monedas">${icon('transfer')}</button>
        <div class="xchg-side"><div class="xchg-label">Me dan</div>
          <div class="xchg-line"><input name="toAmount" class="xchg-input" inputmode="decimal" placeholder="0" autocomplete="off" value="${t.toAmount ? esc(fmtNum(t.toAmount)) : ''}">${sel('toCurrency', t.toCurrency)}</div>
          <div class="xchg-sub" data-rate></div></div>
      </div>`
    + group({
      body: F.date({ name: 'date', label: 'Fecha', value: t.date, clearable: false })
        + F.text({ name: 'desc', label: 'Nota', value: t.desc, placeholder: 'Opcional (p. ej. con quién)' }),
      footer: 'La cantidad que te dan se calcula sola con la tasa del día. Si te dieron otra, escríbela.',
    })
    + (prev ? group({ body: F.button({ label: 'Eliminar cambio', action: 'delete', cls: 'destructive' }) }) : '');

  openSheet({
    title: 'Cambiar moneda',
    body,
    onMount(api) {
      const b = api.body;
      const toIn = b.querySelector('[name=toAmount]');
      let touched = !!prev;
      toIn.addEventListener('input', () => { touched = true; });
      const upd = (e) => {
        const v = api.values();
        if (e && e.target && e.target.name !== 'toAmount' && e.target.name !== 'date' && e.target.name !== 'desc') {
          if (e.target.name !== 'amount') touched = false;
        }
        const amt = parseAmount(v.amount);
        if (!touched) {
          const conv = D.convert(amt, v.currency, v.toCurrency);
          toIn.value = conv ? fmtNum(conv) : '';
        }
        const got = parseAmount(toIn.value);
        const have = (D.ledger()[v.accountId]?.[v.currency] || 0) + (prev && prev.accountId === v.accountId && prev.currency === v.currency ? prev.amount : 0);
        b.querySelector('[data-have]').innerHTML = amt > have
          ? `<span class="c-text-red">Solo hay ${esc(fmtCur(have, v.currency))}</span>`
          : `Hay ${esc(fmtCur(have, v.currency))}`;
        let rateText = '';
        if (amt && got && v.currency !== v.toCurrency) {
          rateText = v.toCurrency === BASE ? `1 ${v.currency} = ${fmtCur(got / amt)}`
            : v.currency === BASE ? `1 ${v.toCurrency} = ${fmtCur(amt / got)}`
              : `1 ${v.currency} = ${fmtCur(got / amt, v.toCurrency)}`;
        } else if (!D.rateOf(v.currency) || !D.rateOf(v.toCurrency)) rateText = 'Escribe cuánto te dan';
        b.querySelector('[data-rate]').textContent = rateText;
      };
      b.addEventListener('input', upd);
      b.addEventListener('change', upd);
      upd();
      if (!prev) setTimeout(() => b.querySelector('[name=amount]')?.focus(), 350);
    },
    actions: {
      swap(el, api) {
        const b = api.body;
        const a = b.querySelector('[name=currency]');
        const c = b.querySelector('[name=toCurrency]');
        [a.value, c.value] = [c.value, a.value];
        a.dispatchEvent(new Event('change', { bubbles: true }));
      },
      delete: deleteAction(t),
    },
    onDone(v, api) {
      const amount = parseAmount(v.amount);
      const toAmount = parseAmount(v.toAmount);
      if (v.currency === v.toCurrency) { alertDialog('Elige dos monedas distintas', 'Para pasar dinero entre cuentas usa «Transferir».'); return false; }
      if (!(amount > 0) || !(toAmount > 0)) { shake(api.body.querySelector('.xchg')); return false; }
      if (!v.accountId) { alertDialog('Crea una cuenta', 'Necesitas al menos una cuenta para anotar movimientos.'); return false; }
      store.batch(() => {
        D.saveTxn({ ...t, amount, toAmount, currency: v.currency, toCurrency: v.toCurrency, accountId: v.accountId, date: v.date || today(), desc: v.desc.trim() });
        D.addCurrencyToAccount(v.accountId, v.toCurrency);
      });
      if (!prev) toast(`${fmtCur(amount, v.currency)} → ${fmtCur(toAmount, v.toCurrency)}`, 'exchange');
    },
  });
}

export function openTxn(id) {
  const t = store.get('txns', id);
  if (!t) return;
  if (t.type === 'transfer') openTransferSheet(id);
  else if (t.type === 'exchange') openExchangeSheet(id);
  else openPaymentSheet(t.type, id);
}

export async function openNewMovement(defaults = {}) {
  const r = await actionSheet({
    actions: [
      { label: 'Gasto', value: 'expense', icon: 'expense' },
      { label: 'Entrada de dinero', value: 'income', icon: 'income' },
      ...(oneAccount() ? [] : [{ label: 'Pasar dinero entre cuentas', value: 'transfer', icon: 'transfer' }]),
      { label: 'Cambiar moneda', value: 'exchange', icon: 'exchange' },
    ],
  });
  if (r === 'expense') openExpenseSheet(null, defaults);
  if (r === 'income') openIncomeSheet(null, defaults);
  if (r === 'transfer') openTransferSheet(null, defaults);
  if (r === 'exchange') openExchangeSheet(null, defaults);
}

/* ---------- Cuentas ---------- */

function balanceText(bal) {
  const parts = Object.entries(bal).filter(([, v]) => v !== 0).map(([c, v]) => fmtCur(v, c));
  return parts.length ? parts.join(' · ') : 'Vacía';
}

export function openAccountSheet(id) {
  const a = D.account(id);
  if (!a) return;
  const bal = D.accountBalances(a);
  const list = D.accountTxns(id, 30);
  const body = `<div class="acc-hero">${emojiTile(a.emoji, a.color, 'xl')}
      <div class="acc-bals">${Object.entries(bal).map(([c, v]) => `<div class="acc-bal ${v < 0 ? 'neg' : ''}"><span class="flag">${D.curInfo(c).flag}</span>${esc(fmtCur(v, c))}</div>`).join('')}</div>
      <button type="button" class="link-btn" data-action="add-cur">${icon('plus')} Añadir otra moneda</button></div>`
    + (D.accounts().length > 1 && D.isMainAccount(id) ? `<div class="main-note">${icon('star')}<span><b>Cuenta principal.</b> Es el dinero del mes: su saldo es lo disponible y sus gastos son los que cuentan en el resumen.</span></div>` : '')
    + actionButtons()
    + (D.isMainAccount(id) ? '' : group({
      body: F.button({ label: 'Usar como cuenta principal', action: 'set-main', lead: iconTile('star', 'yellow') }),
      footer: 'La cuenta principal es la del dinero del mes. Las demás (reserva, ahorro…) se pueden usar igual, pero no cuentan en lo disponible ni en las estadísticas.',
    }))
    + (list.length ? group({ header: 'Últimos movimientos', body: list.map((t) => txnRow(t, id)).join('') }) : '')
    + group({ body: F.button({ label: 'Editar cuenta', action: 'edit' }) + F.button({ label: 'Eliminar cuenta', action: 'delete', cls: 'destructive' }) });

  const go = (fn) => (el, api) => { api.close(); setTimeout(() => fn(null, { accountId: id }), 300); };
  openSheet({
    title: a.name,
    body,
    actions: {
      'mv-expense': go(openExpenseSheet),
      'mv-income': go(openIncomeSheet),
      'mv-transfer': go(openTransferSheet),
      'mv-exchange': go(openExchangeSheet),
      'open-txn': (el, api) => { api.close(); setTimeout(() => openTxn(el.dataset.id), 300); },
      async 'add-cur'(el, api) {
        const have = new Set(a.currencies || []);
        const opts = allCurrencies().filter((c) => !have.has(c));
        const c = await actionSheet({ title: 'Añadir moneda a la cuenta', actions: opts.map((x) => ({ label: `${D.curInfo(x).flag} ${x} · ${D.curInfo(x).name}`, value: x })) });
        if (c) { D.addCurrencyToAccount(id, c); api.close(); setTimeout(() => openAccountSheet(id), 300); }
      },
      edit(el, api) { api.close(); setTimeout(() => openAccountEdit(id), 300); },
      'set-main'(el, api) {
        D.setMainAccount(id);
        api.close();
        toast(`«${a.name}» es ahora la cuenta principal`, 'star');
      },
      async delete(el, api) {
        const nonZero = Object.values(bal).some((v) => Math.abs(v) > 0.001);
        if (await confirmDialog({ title: `¿Eliminar «${a.name}»?`, message: nonZero ? `Todavía tiene ${balanceText(bal)}. Los movimientos se conservarán en el historial.` : 'Los movimientos se conservarán en el historial.' })) {
          store.remove('accounts', id);
          api.close();
        }
      },
    },
  });
}

export function openAccountEdit(id) {
  const prev = id ? D.account(id) : null;
  const a = prev || { name: '', emoji: D.accounts().length ? '💵' : '🏠', color: D.COLORS[D.accounts().length % D.COLORS.length], currencies: [BASE, 'USD'] };
  const curs = allCurrencies();
  openSheet({
    title: prev ? 'Editar cuenta' : 'Nueva cuenta',
    require: 'name',
    body: `<div class="hero-tile">${emojiTile(a.emoji, a.color, 'xl')}</div>`
      + group({ body: F.text({ name: 'name', value: a.name, placeholder: 'Nombre (p. ej. Ahorros, Comida, Remesas)', attrs: `autocapitalize="sentences" autocomplete="off"${prev ? '' : ' autofocus'}` }) })
      + (prev ? '' : group({
        header: 'Monedas',
        body: curs.slice(0, 6).map((c) => F.toggle({ name: `cur-${c}`, label: `${D.curInfo(c).flag} ${c} · ${D.curInfo(c).name}`, checked: a.currencies.includes(c) })).join(''),
        footer: 'Podrás añadir más monedas en cualquier momento.',
      }))
      + group({ header: 'Icono', body: `<div class="pad">${F.picker({ name: 'emoji', value: a.emoji, options: D.ACCOUNT_EMOJIS, kind: 'emoji' })}</div>` })
      + group({ header: 'Color', body: `<div class="pad">${F.picker({ name: 'color', value: a.color, options: D.COLORS })}</div>` }),
    onMount(api) {
      const tile = api.body.querySelector('.hero-tile');
      api.body.addEventListener('change', () => { const v = api.values(); tile.innerHTML = emojiTile(v.emoji, v.color, 'xl'); });
    },
    onDone(v) {
      const currencies = prev ? a.currencies : curs.filter((c) => v[`cur-${c}`]);
      D.saveAccount({ ...a, name: v.name, emoji: v.emoji, color: v.color, currencies: currencies.length ? currencies : [BASE] });
    },
  });
}

/* ---------- Tasas de cambio ---------- */

function sourceText(f) {
  if (!f.asOf) return 'Sin tasas todavía';
  const d = new Date(f.asOf);
  const when = Date.now() - d.getTime() < 86400000 ? timeAgo(d.getTime())
    : d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
  return `${SOURCE_LABEL[f.source] || f.source || 'Manual'} · ${when}`;
}

export function ratePill() {
  const r = D.rateOf('USD');
  return `<button type="button" class="glass rate-pill" data-action="rates" aria-label="Tasa de cambio del dólar">${r
    ? `<span class="rp-cur">1 USD =</span><b>${esc(fmtNum(r))}</b><span class="rp-cur">CUP</span>`
    : '<span class="rp-cur">Fijar tasa USD</span>'}</button>`;
}

export function openRatesSheet() {
  const f = D.fx();
  const codes = D.currenciesInUse().filter((c) => c !== BASE);
  if (!codes.includes('USD')) codes.unshift('USD');
  const rateField = (c) => `<label class="row field" data-code="${c}"><div class="row-lead">${emojiTile(D.curInfo(c).flag, 'gray')}</div><div class="row-body">
      <span class="field-label">1 ${c}</span><input class="field-input right" name="r-${c}" inputmode="decimal" autocomplete="off" placeholder="—" value="${D.rateOf(c) ? esc(fmtNum(D.rateOf(c))) : ''}"><span class="suffix">CUP</span></div></label>`;
  const body = `<div class="explain"><div class="explain-icon">${icon('exchange')}</div>
      <p>Cuántos <b>CUP</b> vale cada moneda en el mercado informal. Se usan para valorar los saldos y como propuesta al anotar gastos y cambios.</p>
      <p>Los movimientos ya anotados <b>conservan su tasa</b>: cambiarla aquí no altera el pasado.</p></div>`
    + group({
      header: 'Tasas', headerTrail: `<span class="src" data-src>${esc(sourceText(f))}</span>`,
      body: codes.map(rateField).join('') + row({ lead: `<span class="add-circle">${icon('plus')}</span>`, title: '<span class="tint">Añadir moneda</span>', action: 'add', cls: 'add-row' }),
    })
    + group({
      body: F.toggle({ name: 'auto', label: 'Actualizar desde elTOque', checked: f.auto !== false, lead: iconTile('sync', 'blue') })
        + F.button({ label: 'Buscar tasas de elTOque ahora', action: 'fetch' }),
      footer: 'Las tasas de elTOque se descargan automáticamente cuando hay unas más recientes. Si cambias una tasa a mano, se mantendrá hasta que elTOque publique una nueva (o siempre, si desactivas la actualización).',
    });

  openSheet({
    title: 'Tasas de cambio',
    body,
    actions: {
      async add(el, api) {
        const have = new Set([...api.body.querySelectorAll('[data-code]')].map((x) => x.dataset.code));
        const opts = D.CURRENCY_CATALOG.map((c) => c[0]).filter((c) => c !== BASE && !have.has(c));
        const c = await actionSheet({ title: 'Añadir moneda', actions: opts.map((x) => ({ label: `${D.curInfo(x).flag} ${x} · ${D.curInfo(x).name}`, value: x })) });
        if (!c) return;
        el.insertAdjacentHTML('beforebegin', rateField(c));
        api.body.querySelector(`[name="r-${c}"]`).focus();
      },
      async fetch(el, api) {
        el.classList.add('loading');
        const r = await refreshRates({ force: true });
        el.classList.remove('loading');
        if (r.status === 'unavailable') {
          alertDialog('No hay tasas publicadas', 'No se pudo descargar la tasa de elTOque. Revisa la conexión o escribe las tasas a mano.');
          return;
        }
        for (const [c, v] of Object.entries(r.data.rates)) {
          let inp = api.body.querySelector(`[name="r-${c}"]`);
          if (!inp) { api.body.querySelector('.add-row').insertAdjacentHTML('beforebegin', rateField(c)); inp = api.body.querySelector(`[name="r-${c}"]`); }
          inp.value = fmtNum(v);
        }
        api.body.querySelector('[data-src]').textContent = sourceText(D.fx());
        toast(`Tasas de elTOque: 1 USD = ${fmtCur(r.data.rates.USD)}`, 'exchange');
      },
    },
    onDone(v) {
      const cur = D.fx();
      const rates = {};
      let changed = false;
      for (const [k, val] of Object.entries(v)) {
        if (!k.startsWith('r-')) continue;
        const c = k.slice(2);
        const n = parseAmount(val);
        if (n > 0) rates[c] = n;
        if (round2(n) !== round2(cur.rates?.[c] || 0)) changed = true;
      }
      if (changed) D.setRates(rates, { source: 'manual', auto: v.auto });
      else if ((cur.auto !== false) !== v.auto) store.put('fx', { ...cur, auto: v.auto });
      if (changed) toast(`Tasas guardadas${rates.USD ? `: 1 USD = ${fmtCur(rates.USD)}` : ''}`, 'exchange');
      if (v.auto && !changed) refreshRates();
    },
  });
}

/* ---------- Categorías de gasto ---------- */

export function openCategorySheet(id) {
  const prev = id ? store.get('budgets', id) : null;
  const c = prev || { name: '', emoji: '🛒', color: 'green' };
  openSheet({
    title: prev ? c.name : 'Nueva categoría',
    require: 'name',
    body: `<div class="hero-tile">${emojiTile(c.emoji, c.color, 'xl')}</div>`
      + group({ body: F.text({ name: 'name', value: c.name, placeholder: 'Nombre de la categoría', attrs: `autocapitalize="sentences"${prev ? '' : ' autofocus'}` }) })
      + group({ header: 'Icono', body: `<div class="pad">${F.picker({ name: 'emoji', value: c.emoji, options: D.BUDGET_EMOJIS, kind: 'emoji' })}</div>` })
      + group({ header: 'Color', body: `<div class="pad">${F.picker({ name: 'color', value: c.color, options: D.CHART_COLORS })}</div>` })
      + (prev ? group({ body: F.button({ label: 'Eliminar categoría', action: 'delete', cls: 'destructive' }), footer: 'Los gastos de esta categoría quedarán como «Sin categoría».' }) : ''),
    onMount(api) {
      const tile = api.body.querySelector('.hero-tile');
      api.body.addEventListener('change', () => { const v = api.values(); tile.innerHTML = emojiTile(v.emoji, v.color, 'xl'); });
    },
    onDone(v) { D.saveCategory({ ...c, name: v.name.trim(), emoji: v.emoji, color: v.color }); },
    actions: {
      async delete(el, api) {
        if (await confirmDialog({ title: `¿Eliminar «${c.name}»?` })) { store.remove('budgets', c.id); api.close(); }
      },
    },
  });
}

export function openCategoriesSheet() {
  const render = () => group({
    body: D.categories().map((c) => row({ lead: emojiTile(c.emoji, c.color), title: esc(c.name), action: 'edit', id: c.id, chevron: true })).join('')
      + row({ lead: `<span class="add-circle">${icon('plus')}</span>`, title: '<span class="tint">Nueva categoría</span>', action: 'new' }),
    footer: 'Sirven para ver en qué se va el dinero de la casa cada mes.',
  });
  openSheet({
    title: 'Categorías de gasto',
    body: render(),
    actions: {
      edit: (el, api) => { api.close(); setTimeout(() => openCategorySheet(el.dataset.id), 300); },
      new: (el, api) => { api.close(); setTimeout(() => openCategorySheet(null), 300); },
    },
  });
}

/* ---------- Filas y vista ---------- */

const TYPE_LABEL = { income: 'Entrada', expense: 'Gasto', transfer: 'Transferencia', exchange: 'Cambio de moneda' };

function txnRow(t, ctxAccount = null) {
  const acc = D.account(t.accountId);
  const to = D.account(t.toAccountId);
  const m = D.member(t.by);
  const cat = store.get('budgets', t.categoryId);
  let lead; let title; let sub; let trail;
  const accName = !oneAccount() && acc ? acc.name : '';
  const join = (...xs) => xs.filter(Boolean).map(esc).join('<span class="dot"> · </span>');
  if (t.type === 'expense') {
    lead = cat ? emojiTile(cat.emoji, cat.color) : `<span class="itile c-red">${icon('expense')}</span>`;
    title = esc(t.desc || cat?.name || 'Gasto');
    const tg = (t.tagIds || []).map((id) => D.tag(id)).filter(Boolean);
    sub = join(t.desc ? cat?.name : '', accName)
      + (tg.length ? `<span class="ttags">${tg.map((g) => `<span class="ttag" style="--c:${chColor(g.color)}">${esc(g.name)}</span>`).join('')}</span>` : '');
    trail = `<span class="amt">${esc(fmtCur(-t.amount, t.currency))}</span>`;
  } else if (t.type === 'income') {
    lead = `<span class="itile c-green">${icon('income')}</span>`;
    title = esc(t.desc || 'Entrada de dinero');
    sub = join(accName || (m ? `Recibido por ${m.name}` : ''));
    trail = `<span class="amt pos">${esc(fmtCur(t.amount, t.currency, { sign: true }))}</span>`;
  } else if (t.type === 'transfer') {
    lead = `<span class="itile c-blue">${icon('transfer')}</span>`;
    title = esc(t.desc || 'Paso entre cuentas');
    sub = `${esc(acc?.name || '?')} → ${esc(to?.name || '?')}`;
    const sign = ctxAccount ? (t.toAccountId === ctxAccount ? 1 : -1) : 0;
    trail = `<span class="amt ${sign > 0 ? 'pos' : ''}">${esc(fmtCur(sign ? sign * t.amount : t.amount, t.currency, { sign: sign > 0 }))}</span>`;
  } else {
    lead = `<span class="itile c-orange">${icon('exchange')}</span>`;
    title = esc(t.desc || 'Cambio de moneda');
    sub = `${esc(fmtCur(t.amount, t.currency))} → ${esc(fmtCur(t.toAmount, t.toCurrency))}`;
    trail = '';
  }
  return row({ lead, title, sub, trail, action: 'open-txn', id: t.id });
}

function actionButtons() {
  const b = (action, ic, color, label) => `<button type="button" class="act" data-action="${action}"><span class="act-icon c-${color}">${icon(ic)}</span><span>${label}</span></button>`;
  const many = !oneAccount();
  return `<div class="acts ${many ? '' : 'three'}">${b('mv-expense', 'expense', 'red', 'Gasto')}${b('mv-income', 'income', 'green', 'Entrada')}${many ? b('mv-transfer', 'transfer', 'blue', 'Transferir') : ''}${b('mv-exchange', 'exchange', 'orange', 'Cambiar moneda')}</div>`;
}

export function totalsCard({ compact = false } = {}) {
  const tot = D.totals();
  const held = Object.entries(tot.byCur).filter(([, v]) => v !== 0);
  const foreign = held.some(([c]) => c !== BASE);
  const usd = tot.cup > 0 ? usdWords(tot.cup) : '';
  const main = D.mainAccount();
  return `<div class="sum-label">${mainName() ? `Disponible en ${esc(main.emoji)} ${esc(main.name)}` : 'Disponible'}</div>
    <div class="sum-value ${tot.cup < 0 ? 'neg' : ''}">${esc(fmtCur(tot.cup))}</div>
    ${usd ? `<div class="sum-usd">${esc(usd)}</div>` : ''}
    ${!compact && foreign ? `<div class="cur-chips"><span class="cur-chips-label">Tienes</span>${held.map(([c, v]) => `<span class="cur-chip">${D.curInfo(c).flag} ${esc(fmtCur(v, c))}</span>`).join('')}</div>` : ''}
    ${!compact && tot.missing.length ? `<div class="sum-note">Falta la tasa de ${esc(tot.missing.join(', '))}: tócala arriba para ponerla.</div>` : ''}`;
}

/* ---------- Desglose, estadísticas y gráficos ---------- */

const chColor = (c) => `var(--ch-${c}, var(--${c}))`;
const monthShort = (key) => fmtMonth(key, false).slice(0, 3);

/** Barra segmentada fina (sin texto): las cifras van en la lista de al lado. */
function splitBar(parts) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return '';
  return `<div class="split" role="img" aria-label="${esc(parts.map((p) => `${p.label}: ${Math.round((p.value / total) * 100)} %`).join(', '))}">${parts.filter((p) => p.value > 0)
    .map((p) => `<span style="flex:${p.value} 1 0;background:${chColor(p.color)}" title="${esc(p.label)}"></span>`).join('')}</div>`;
}

/** Variación respecto al mes anterior: flecha + texto (nunca solo color). */
function deltaBadge(delta, prevKey) {
  if (delta == null || !isFinite(delta)) return '';
  const r = Math.round(delta);
  const m = esc(fmtMonth(prevKey, false).toLowerCase());
  if (r === 0) return `<span class="delta same">Igual que en ${m}</span>`;
  return `<span class="delta ${r > 0 ? 'up' : 'down'}">${r > 0 ? '▲' : '▼'} ${Math.abs(r)} % ${r > 0 ? 'más' : 'menos'} que en ${m}</span>`;
}

/**
 * Columnas de los últimos meses. Énfasis: el mes elegido en color, el resto en gris.
 * Tocar una columna elige ese mes.
 */
function columnChart(series, { color = 'blue', selected, action = 'pick-month', label = 'Gasto' }) {
  const max = Math.max(...series.map((p) => p.cup), 0);
  if (!max) return '<div class="chart-empty">Aún no hay gastos en estos meses.</div>';
  const cols = series.map((p) => {
    const h = p.cup ? Math.max(3, (p.cup / max) * 100) : 0;
    const on = p.month === selected;
    const text = `${fmtMonth(p.month)}: ${fmtCur(p.cup)}`;
    return `<button type="button" class="col ${on ? 'on' : ''}" data-action="${action}" data-month="${p.month}" aria-label="${esc(`${label} ${text}`)}" title="${esc(text)}">
      <span class="col-val">${on || p.cup === max ? esc(fmtCur(p.cup).replace(/ CUP$/, '')) : ''}</span>
      <span class="col-track"><span class="col-bar" style="height:${h}%;${on ? `background:${chColor(color)}` : ''}"></span></span>
      <span class="col-label">${esc(monthShort(p.month))}</span></button>`;
  }).join('');
  return `<div class="cols">${cols}</div>`;
}

function categorySection(month) {
  const br = D.categoryBreakdown(month);
  if (!br.rows.length) return '';
  const parts = br.rows.map((r) => ({ value: r.cup, color: r.cat?.color || 'gray', label: r.cat?.name || 'Sin categoría' }));
  const rows = br.rows.map((r) => {
    const n = D.tagBreakdown(month, r.id).list.length;
    return row({
      lead: r.cat ? emojiTile(r.cat.emoji, r.cat.color) : emojiTile('🧾', 'gray'),
      title: esc(r.cat?.name || 'Sin categoría'),
      sub: `${n} ${n === 1 ? 'gasto' : 'gastos'}`,
      trail: `<div class="amt-col"><span class="amt">${esc(fmtCur(r.cup))}</span><span class="amt-sub">${Math.round(r.pct)} %</span></div>`,
      action: 'open-cat', id: r.id, chevron: true, cls: 'tall',
    });
  }).join('');
  return group({
    header: 'Gastos por categoría',
    headerTrail: `<span class="src">${esc(fmtCur(br.total))}</span>`,
    body: `<div class="split-wrap">${splitBar(parts)}</div>${rows}`,
    footer: `Toca una categoría para ver el desglose por etiquetas.${mainName() ? ` Solo cuentan los gastos de «${esc(mainName())}».` : ''}`,
  });
}

/** Estadísticas del mes en lenguaje sencillo, en una hoja aparte para no recargar Finanzas. */
export function openStatsSheet(month) {
  let m = month;
  const render = () => {
    const st = D.monthStats(m);
    const prevKey = D.prevMonth(m);
    const prev = D.spentIn(prevKey);
    const delta = prev ? ((st.total - prev) / prev) * 100 : null;
    const series = D.spendSeries(m, 6);
    const avg = series.filter((p) => p.cup).reduce((a, p, _, arr) => a + p.cup / arr.length, 0);
    const s = D.monthSummary(m);
    const amt = (n) => `<span class="amt">${esc(fmtCur(n))}</span>`;
    const facts = st.count ? group({
      header: esc(fmtMonth(m)),
      body: row({ title: 'Gastado en total', trail: amt(st.total) })
        + row({ title: 'Gasto medio por día', trail: amt(st.avgDaily) })
        + (st.projection != null ? row({ title: 'Si se sigue gastando así', sub: 'Lo que se habrá gastado a fin de mes', trail: amt(st.projection) }) : '')
        + (st.biggest ? row({ title: 'El gasto más grande', sub: esc(st.biggest.desc || store.get('budgets', st.biggest.categoryId)?.name || 'Gasto'), trail: amt(st.biggest.cup) }) : '')
        + (delta != null ? row({ title: `Comparado con ${esc(fmtMonth(prevKey, false).toLowerCase())}`, trail: deltaBadge(delta, prevKey).replace(/ que en [^<]*/, '') }) : ''),
    }) : empty({ icon: 'receipt', title: 'Sin gastos este mes', text: 'Toca otro mes en el gráfico.' });

    const people = Object.entries(s.byMember).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const peopleGroup = people.length && D.members().length > 1 ? group({
      header: 'Quién ha pagado',
      body: people.map(([id, v]) => row({ lead: avatar(D.member(id), 'sm'), title: esc(D.member(id)?.name || 'Sin indicar'), trail: amt(v) })).join(''),
    }) : '';

    return `<section class="group"><div class="group-header"><span>Lo gastado cada mes</span><span class="src">${avg ? `Media ${esc(fmtCur(Math.round(avg)))}` : ''}</span></div>
      <div class="card chart-card">${columnChart(series, { color: 'blue', selected: m, action: 'stats-month' })}</div>
      <div class="group-footer">Toca un mes para ver sus cifras.${mainName() ? ` Solo cuentan los gastos de «${esc(mainName())}», la cuenta principal.` : ''}</div></section>`
      + facts + peopleGroup;
  };
  openSheet({
    title: 'Estadísticas',
    body: render(),
    actions: { 'stats-month'(el, api) { m = el.dataset.month; api.setBody(render()); } },
  });
}

/** Detalle de una categoría: desglose por etiquetas, evolución y sus gastos. */
export function openCategoryDetail(catId, month) {
  let m = month;
  let filter = null;
  const render = () => {
    const cat = store.get('budgets', catId);
    const color = cat?.color || 'gray';
    const br = D.tagBreakdown(m, catId);
    const monthTotal = D.spentIn(m);
    const prevKey = D.prevMonth(m);
    const prev = D.spentIn(prevKey, catId);
    const delta = prev ? ((br.total - prev) / prev) * 100 : null;
    const share = monthTotal ? Math.round((br.total / monthTotal) * 100) : 0;
    const hero = `<div class="acc-hero">${cat ? emojiTile(cat.emoji, cat.color, 'xl') : emojiTile('🧾', 'gray', 'xl')}
      <div class="acc-total">${esc(fmtCur(br.total))}</div>
      <div class="hero-meta">${br.total ? `${share} % de lo gastado en ${esc(fmtMonth(m, false).toLowerCase())}` : esc(fmtMonth(m))}</div>
      <div class="hero-meta">${deltaBadge(delta, prevKey)}</div></div>`;

    const tagRows = br.rows.map((r) => {
      const on = filter === r.id;
      const c = r.tag?.color || 'gray';
      return row({
        lead: `<span class="swatch" style="background:${chColor(c)}"></span>`,
        title: esc(r.tag?.name || 'Sin etiqueta'),
        sub: `<div class="budget-sub"><div class="bar"><span style="width:${r.pct}%;background:${chColor(c)}"></span></div><span>${r.count} ${r.count === 1 ? 'gasto' : 'gastos'}</span></div>`,
        trail: `<div class="amt-col"><span class="amt">${esc(fmtCur(r.cup))}</span><span class="amt-sub">${Math.round(r.pct)} %</span></div>`,
        action: 'filter-tag', id: r.id || '-', cls: `tall ${on ? 'selected' : ''} ${filter !== null && !on ? 'dim' : ''}`,
      });
    }).join('');
    const tagGroup = br.list.length ? group({
      header: 'Por etiqueta',
      headerTrail: filter !== null ? '<button type="button" class="link-btn" data-action="filter-tag" data-id="__all">Ver todas</button>' : '',
      body: `<div class="split-wrap">${splitBar(br.rows.map((r) => ({ value: r.cup, color: r.tag?.color || 'gray', label: r.tag?.name || 'Sin etiqueta' })))}</div>${tagRows}`,
      footer: `${br.overlap ? 'Un gasto con varias etiquetas cuenta en cada una, por eso los porcentajes pueden sumar más de 100 %. ' : ''}Toca una etiqueta para ver solo sus gastos.`,
    }) : '';

    const series = D.spendSeries(m, 6, catId);
    const trend = `<section class="group"><div class="group-header"><span>Últimos 6 meses</span></div>
      <div class="card chart-card">${columnChart(series, { color, selected: m, action: 'cat-month', label: cat?.name || 'Sin categoría' })}</div></section>`;

    const list = br.list.filter((t) => filter === null || (filter === '' ? !(t.tagIds || []).some((id) => D.tag(id)) : (t.tagIds || []).includes(filter)));
    const listGroup = list.length ? group({ header: filter === null ? 'Gastos del mes' : `Gastos: ${esc(filter ? D.tag(filter)?.name || '' : 'sin etiqueta')}`, body: list.map((t) => txnRow(t)).join('') })
      : empty({ icon: 'receipt', title: 'Sin gastos este mes', text: 'Toca otro mes en el gráfico para ver sus gastos.' });

    return hero + tagGroup + trend + listGroup
      + (cat ? group({ body: F.button({ label: 'Editar categoría', action: 'edit-cat' }) }) : '');
  };

  openSheet({
    title: store.get('budgets', catId)?.name || 'Sin categoría',
    body: render(),
    actions: {
      'filter-tag'(el, api) {
        const id = el.dataset.id === '-' ? '' : el.dataset.id;
        filter = id === '__all' || filter === id ? null : id;
        api.setBody(render());
      },
      'cat-month'(el, api) { m = el.dataset.month; filter = null; api.setBody(render()); },
      'open-txn': (el, api) => { api.close(); setTimeout(() => openTxn(el.dataset.id), 300); },
      'edit-cat': (el, api) => { api.close(); setTimeout(() => openCategorySheet(catId), 300); },
    },
  });
}

/* ---------- Etiquetas (gestión) ---------- */

export function openTagEdit(id) {
  const prev = id ? D.tag(id) : null;
  const g = prev || { name: '', color: D.CHART_COLORS[D.tags().length % D.CHART_COLORS.length] };
  const uses = prev ? D.tagUsage(id) : 0;
  openSheet({
    title: prev ? 'Etiqueta' : 'Nueva etiqueta',
    require: 'name',
    body: group({ body: F.text({ name: 'name', value: g.name, placeholder: 'Nombre (p. ej. Carne, Cumpleaños)', attrs: `autocapitalize="sentences" autocomplete="off"${prev ? '' : ' autofocus'}` }) })
      + group({ header: 'Color', body: `<div class="pad">${F.picker({ name: 'color', value: g.color, options: D.CHART_COLORS })}</div>` })
      + (prev ? group({ body: F.button({ label: 'Eliminar etiqueta', action: 'delete', cls: 'destructive' }), footer: uses ? `Se quitará de ${uses} ${uses === 1 ? 'gasto' : 'gastos'}; los gastos no se borran.` : '' }) : ''),
    onDone(v) { D.saveTag({ ...g, name: v.name, color: v.color }); },
    actions: {
      async delete(el, api) {
        if (await confirmDialog({ title: `¿Eliminar «${g.name}»?` })) { D.removeTag(g.id); api.close(); }
      },
    },
  });
}

export function openTagsSheet() {
  const list = D.tags();
  openSheet({
    title: 'Etiquetas',
    body: group({
      body: list.map((g) => row({ lead: `<span class="swatch" style="background:${chColor(g.color)}"></span>`, title: esc(g.name), trail: String(D.tagUsage(g.id)), action: 'edit', id: g.id, chevron: true })).join('')
        + row({ lead: `<span class="add-circle">${icon('plus')}</span>`, title: '<span class="tint">Nueva etiqueta</span>', action: 'new' }),
      footer: 'También puedes crearlas al anotar un gasto. El número indica en cuántos gastos se usa cada una.',
    }),
    actions: {
      edit: (el, api) => { api.close(); setTimeout(() => openTagEdit(el.dataset.id), 300); },
      new: (el, api) => { api.close(); setTimeout(() => openTagEdit(null), 300); },
    },
  });
}

export default {
  id: 'money',
  title: () => 'Finanzas',
  navRight: () => ratePill() + glassBtn('plus', 'new-move', 'Nuevo movimiento'),
  onShow(opts) { if (opts.month) state.month = opts.month; },
  render() {
    const s = D.monthSummary(state.month);
    const led = D.ledger();
    const accs = D.accounts();
    const isCurrent = state.month === monthOf(today());

    const hero = `<div class="card summary">${totalsCard()}</div>`;

    const main = D.mainAccountId();
    const accRows = [...accs].sort((a, b) => (b.id === main) - (a.id === main)).map((a) => {
      const bal = D.accountBalances(a, led);
      return row({
        lead: emojiTile(a.emoji, a.color),
        title: esc(a.name) + (accs.length > 1 && a.id === main ? ' <span class="badge-main">Principal</span>' : ''),
        sub: esc(balanceText(bal)),
        action: 'open-account', id: a.id, chevron: true,
      });
    }).join('') + row({ lead: `<span class="add-circle">${icon('plus')}</span>`, title: '<span class="tint">Nueva cuenta</span>', action: 'new-account' });

    const monthNav = `<div class="month-nav">
      <button type="button" class="glass glass-btn sm" data-action="month" data-d="-1" aria-label="Mes anterior">${icon('chevronLeft')}</button>
      <div class="m">${esc(fmtMonth(state.month))}${isCurrent ? '' : '<button type="button" class="link-btn" data-action="month" data-d="0">Volver a este mes</button>'}</div>
      <button type="button" class="glass glass-btn sm" data-action="month" data-d="1" aria-label="Mes siguiente">${icon('chevronRight')}</button></div>`;

    const stat = (label, v, cls) => `<div class="stat"><span class="stat-label">${label}</span>
      <span class="stat-value ${cls}">${esc(fmtCur(v.cup))}</span><span class="stat-usd">${v.usd && v.cup ? esc(usdRounded(v.usd)) : '&nbsp;'}</span></div>`;
    const stats = `<div class="stats">${stat('Entradas', s.income, 'pos')}${stat('Gastado', s.spent, '')}</div>`;

    const catSection = categorySection(state.month);
    const statsRow = s.spent.cup ? group({ body: row({ lead: iconTile('chart', 'indigo'), title: 'Ver estadísticas del mes', sub: 'Media por día, previsión y meses anteriores', action: 'stats', chevron: true }) }) : '';

    const byDate = groupBy(s.list, (t) => t.date);
    const movements = s.list.length
      ? [...byDate.entries()].map(([date, arr]) => group({ header: fmtDay(date), body: arr.map((t) => txnRow(t, main)).join('') })).join('')
      : empty({ icon: 'receipt', title: 'Sin movimientos este mes', text: 'Anota las entradas de dinero, los gastos y los cambios de moneda para saber cuánto queda.', action: 'new-move', actionLabel: 'Nuevo movimiento' });

    return largeTitle('Finanzas') + hero + actionButtons()
      + group({ header: 'Cuentas', body: accRows, footer: accs.length > 1 ? 'El resumen del mes solo tiene en cuenta la cuenta principal. Para cambiarla, entra en otra cuenta.' : '' })
      + monthNav + stats + catSection + statsRow
      + `<h2 class="sub-title">Movimientos${mainName() ? ` <span class="sub-title-note">de ${esc(mainName())}</span>` : ''}</h2>` + movements
      + (mainName() && s.list.length ? '<p class="footnote after">Los movimientos de las otras cuentas están dentro de cada cuenta.</p>' : '');
  },
  actions: {
    month(el) {
      const d = Number(el.dataset.d);
      state.month = d === 0 ? monthOf(today()) : shiftMonth(state.month, d);
      app.render();
    },
    rates: openRatesSheet,
    'new-move': () => openNewMovement(),
    'mv-expense': () => openExpenseSheet(),
    'mv-income': () => openIncomeSheet(),
    'mv-transfer': () => openTransferSheet(),
    'mv-exchange': () => openExchangeSheet(),
    'open-txn': (el) => openTxn(el.dataset.id),
    'open-account': (el) => openAccountSheet(el.dataset.id),
    'new-account': () => openAccountEdit(null),
    'open-cat': (el) => openCategoryDetail(el.dataset.id, state.month),
    stats: () => openStatsSheet(state.month),
  },
};
