// Finanzas: cuentas con saldo en varias monedas, entradas, gastos,
// transferencias y cambios de moneda. Todo se resume en CUP (y en USD, más pequeño).
import { store } from '../store.js';
import { app } from '../app.js';
import * as D from '../domain.js';
import { esc, fmtCur, fmtMonth, fmtDay, monthOf, shiftMonth, today, parseAmount, fmtNum, groupBy, round2, timeAgo, LOCALE } from '../util.js';
import { icon } from '../icons.js';
import { largeTitle, group, row, empty, glassBtn, F, emojiTile, progress, avatar, iconTile } from '../ui.js';
import { openSheet, confirmDialog, toast, actionSheet, alertDialog } from '../overlays.js';
import { refreshRates, SOURCE_LABEL } from '../rates.js';

const BASE = D.BASE;
const state = { month: monthOf(today()) };

const usdLine = (cup) => {
  const r = D.rateOf('USD');
  return r ? `≈ ${fmtCur(cup / r, 'USD')}` : '';
};
const allCurrencies = () => D.sortCurrencies([...D.CURRENCY_CATALOG.map((c) => c[0]), ...D.currenciesInUse()]);
const curOptions = (list) => list.map((c) => [c, c]);
const accountOptions = () => D.accounts().map((a) => [a.id, `${a.emoji} ${a.name}`]);
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
    <span class="field-label">Tasa <span class="muted" data-rate-label></span></span>
    <input class="field-input right" name="rate" inputmode="decimal" autocomplete="off" value="${rate ? esc(fmtNum(rate)) : ''}" placeholder="0"><span class="suffix">CUP</span></div></label>`;
}

/**
 * Campos de pago reutilizables (gasto, entrada, compra).
 * kind: 'expense' | 'income'
 */
export function paymentBody({ kind, t, label }) {
  const isExp = kind === 'expense';
  return moneyHero({ label, amount: t.amount, currency: t.currency || BASE })
    + group({
      body: F.text({ name: 'desc', value: t.desc || '', placeholder: isExp ? 'Concepto (p. ej. Factura de la luz)' : 'Concepto (p. ej. Salario, remesa…)', attrs: 'autocapitalize="sentences" autocomplete="off"' })
        + (D.accounts().length ? F.select({ name: 'accountId', label: isExp ? 'Pagar desde' : 'Cuenta', value: t.accountId || D.defaultAccountId(), options: accountOptions() }) : '')
        + (isExp ? F.select({ name: 'categoryId', label: 'Categoría', value: t.categoryId || '', options: categoryOptions() }) : '')
        + F.date({ name: 'date', label: 'Fecha', value: t.date || today(), clearable: false })
        + F.select({ name: 'by', label: isExp ? 'Pagado por' : 'Recibido por', value: t.by || '', options: memberOptions() }),
    })
    + group({
      cls: 'rate-group',
      body: rateRow(t.currency && t.currency !== BASE ? t.rate : ''),
      footer: `<span data-rate-foot></span>`,
    });
}

/** Lógica viva: tasa, equivalencia en CUP y saldo disponible. */
export function bindPayment(api, { kind, prev }) {
  const b = api.body;
  const rateGroup = b.querySelector('.rate-group');
  const rateIn = b.querySelector('[name=rate]');
  const hint = b.querySelector('[data-hint]');
  const foot = b.querySelector('[data-rate-foot]');
  const label = b.querySelector('[data-rate-label]');
  let touched = !!prev;
  let lastCur = b.querySelector('[name=currency]').value;
  rateIn.addEventListener('input', () => { touched = true; });
  const upd = () => {
    const v = api.values();
    const cur = v.currency;
    if (cur !== lastCur) { touched = !!(prev && prev.currency === cur); lastCur = cur; if (touched) rateIn.value = fmtNum(prev.rate); }
    const foreign = cur !== BASE;
    rateGroup.hidden = !foreign;
    if (foreign && !touched) rateIn.value = D.rateOf(cur) ? fmtNum(D.rateOf(cur)) : '';
    label.textContent = foreign ? `(1 ${cur})` : '';
    const amt = parseAmount(v.amount);
    const r = foreign ? parseAmount(rateIn.value) : 1;
    const parts = [];
    if (foreign) parts.push(r ? `≈ ${fmtCur(amt * r)}` : 'Indica la tasa de cambio');
    if (kind === 'expense' && v.accountId) {
      const acc = D.account(v.accountId);
      const have = (D.ledger()[v.accountId]?.[cur] || 0) + (prev && prev.accountId === v.accountId && prev.currency === cur ? prev.amount : 0);
      parts.push(`<span class="${amt > have ? 'c-text-red' : ''}">Saldo en ${esc(acc?.name || 'la cuenta')}: ${esc(fmtCur(have, cur))}</span>`);
    }
    hint.innerHTML = parts.join('<span class="dot"> · </span>');
    foot.textContent = foreign
      ? `${D.rateOf(cur) ? `Tasa actual: ${fmtCur(D.rateOf(cur))}. ` : ''}El movimiento se guarda con esta tasa y no cambiará aunque cambie el mercado.`
      : '';
  };
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
    body: paymentBody({ kind, t, label: isExp ? 'Importe del gasto' : 'Cantidad recibida' })
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
        const saved = D.saveTxn({ ...t, ...p, type: kind, desc: v.desc.trim(), accountId: v.accountId, categoryId: isExp ? v.categoryId : undefined, date: v.date || today(), by: v.by || null });
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
  const from = defaults.accountId || accs[0]?.id;
  const t = prev || { type: 'transfer', amount: 0, currency: BASE, accountId: from, toAccountId: accs.find((a) => a.id !== from)?.id, date: today(), desc: '', ...defaults };
  openSheet({
    title: 'Transferir',
    body: moneyHero({ label: 'Cantidad a pasar', amount: t.amount, currency: t.currency })
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
        hint.innerHTML = `<span class="${parseAmount(v.amount) > have ? 'c-text-red' : ''}">Disponible: ${esc(fmtCur(have, v.currency))}</span>`;
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
  const body = (D.accounts().length ? group({ body: F.select({ name: 'accountId', label: 'Cuenta', value: t.accountId, options: accountOptions(), lead: iconTile('bank', 'blue') }) }) : '')
    + `<div class="xchg">
        <div class="xchg-side"><div class="xchg-label">Entregas</div>
          <div class="xchg-line"><input name="amount" class="xchg-input" inputmode="decimal" placeholder="0" autocomplete="off" value="${t.amount ? esc(fmtNum(t.amount)) : ''}">${sel('currency', t.currency)}</div>
          <div class="xchg-sub" data-have></div></div>
        <button type="button" class="xchg-swap glass" data-action="swap" aria-label="Intercambiar monedas">${icon('transfer')}</button>
        <div class="xchg-side"><div class="xchg-label">Recibes</div>
          <div class="xchg-line"><input name="toAmount" class="xchg-input" inputmode="decimal" placeholder="0" autocomplete="off" value="${t.toAmount ? esc(fmtNum(t.toAmount)) : ''}">${sel('toCurrency', t.toCurrency)}</div>
          <div class="xchg-sub" data-rate></div></div>
      </div>`
    + group({
      body: F.date({ name: 'date', label: 'Fecha', value: t.date, clearable: false })
        + F.text({ name: 'desc', label: 'Nota', value: t.desc, placeholder: 'Opcional (p. ej. con quién)' }),
      footer: 'Lo que recibes se calcula con la tasa actual. Si te dieron otra cantidad, escríbela: se guardará la tasa real del cambio.',
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
        b.querySelector('[data-have]').innerHTML = `<span class="${amt > have ? 'c-text-red' : ''}">Tienes ${esc(fmtCur(have, v.currency))}</span>`;
        let rateText = '';
        if (amt && got && v.currency !== v.toCurrency) {
          rateText = v.toCurrency === BASE ? `1 ${v.currency} = ${fmtCur(got / amt)}`
            : v.currency === BASE ? `1 ${v.toCurrency} = ${fmtCur(amt / got)}`
              : `1 ${v.currency} = ${fmtCur(got / amt, v.toCurrency)}`;
        } else if (!D.rateOf(v.currency) || !D.rateOf(v.toCurrency)) rateText = 'Falta la tasa de alguna moneda: escribe lo que recibes';
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
      { label: 'Transferir entre cuentas', value: 'transfer', icon: 'transfer' },
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
  const parts = Object.entries(bal).map(([c, v]) => fmtCur(v, c));
  return parts.length ? parts.join(' · ') : 'Sin saldo';
}

export function openAccountSheet(id) {
  const a = D.account(id);
  if (!a) return;
  const bal = D.accountBalances(a);
  const val = D.valuation(bal);
  const list = D.accountTxns(id, 30);
  const body = `<div class="acc-hero">${emojiTile(a.emoji, a.color, 'xl')}
      <div class="acc-total">${esc(fmtCur(val.cup))}</div>
      <div class="acc-usd">${val.usd != null ? esc(`≈ ${fmtCur(val.usd, 'USD')}`) : ''}</div></div>`
    + actionButtons()
    + group({
      header: 'Saldo por moneda',
      body: Object.entries(bal).map(([c, v]) => row({
        lead: emojiTile(D.curInfo(c).flag, 'gray'),
        title: esc(c), sub: esc(D.curInfo(c).name),
        trail: `<div class="amt-col"><span class="amt ${v < 0 ? 'neg' : ''}">${esc(fmtCur(v, c))}</span>${c !== BASE && D.rateOf(c) ? `<span class="amt-sub">≈ ${esc(fmtCur(v * D.rateOf(c)))}</span>` : ''}</div>`,
      })).join('') + row({ lead: `<span class="add-circle">${icon('plus')}</span>`, title: '<span class="tint">Añadir moneda</span>', action: 'add-cur' }),
    })
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
    ? `<span class="rp-cur">USD</span><b>${esc(fmtNum(r))}</b><span class="rp-cur">CUP</span>`
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
      + group({ header: 'Color', body: `<div class="pad">${F.picker({ name: 'color', value: c.color, options: D.COLORS })}</div>` })
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
  const who = m ? `<span class="dot">·</span>${esc(m.name)}` : '';
  if (t.type === 'expense') {
    lead = cat ? emojiTile(cat.emoji, cat.color) : `<span class="itile c-red">${icon('expense')}</span>`;
    title = esc(t.desc || cat?.name || 'Gasto');
    sub = `${esc(acc?.name || 'Cuenta eliminada')}${cat && t.desc ? `<span class="dot">·</span>${esc(cat.name)}` : ''}${who}`;
    trail = `<span class="amt">${esc(fmtCur(-t.amount, t.currency))}</span>${t.currency !== BASE ? `<span class="amt-sub">${esc(fmtCur(t.cup))}</span>` : ''}`;
  } else if (t.type === 'income') {
    lead = `<span class="itile c-green">${icon('income')}</span>`;
    title = esc(t.desc || 'Entrada de dinero');
    sub = `${esc(acc?.name || 'Cuenta eliminada')}${who}`;
    trail = `<span class="amt pos">${esc(fmtCur(t.amount, t.currency, { sign: true }))}</span>${t.currency !== BASE ? `<span class="amt-sub">${esc(fmtCur(t.cup))}</span>` : ''}`;
  } else if (t.type === 'transfer') {
    lead = `<span class="itile c-blue">${icon('transfer')}</span>`;
    title = esc(t.desc || 'Transferencia');
    sub = `${esc(acc?.name || '?')} → ${esc(to?.name || '?')}`;
    const sign = ctxAccount ? (t.toAccountId === ctxAccount ? 1 : -1) : 0;
    trail = `<span class="amt ${sign > 0 ? 'pos' : ''}">${esc(fmtCur(sign ? sign * t.amount : t.amount, t.currency, { sign: sign > 0 }))}</span>`;
  } else {
    lead = `<span class="itile c-orange">${icon('exchange')}</span>`;
    title = esc(t.desc || `Cambio ${t.currency} → ${t.toCurrency}`);
    const r = t.toCurrency === BASE ? `1 ${t.currency} = ${fmtCur(t.rate)}` : t.currency === BASE && t.rate ? `1 ${t.toCurrency} = ${fmtCur(1 / t.rate)}` : '';
    sub = `${esc(acc?.name || 'Cuenta eliminada')}${r ? `<span class="dot">·</span>${esc(r)}` : ''}`;
    trail = `<span class="amt">${esc(fmtCur(-t.amount, t.currency))}</span><span class="amt-sub pos">${esc(fmtCur(t.toAmount, t.toCurrency, { sign: true }))}</span>`;
  }
  return row({ lead, title, sub, trail: `<div class="amt-col">${trail}</div>`, action: 'open-txn', id: t.id });
}

function actionButtons() {
  const b = (action, ic, color, label) => `<button type="button" class="act" data-action="${action}"><span class="act-icon c-${color}">${icon(ic)}</span><span>${label}</span></button>`;
  return `<div class="acts">${b('mv-expense', 'expense', 'red', 'Gasto')}${b('mv-income', 'income', 'green', 'Entrada')}${b('mv-transfer', 'transfer', 'blue', 'Transferir')}${b('mv-exchange', 'exchange', 'orange', 'Cambiar')}</div>`;
}

export function totalsCard({ compact = false } = {}) {
  const tot = D.totals();
  const chips = Object.entries(tot.byCur).filter(([, v]) => v !== 0);
  const foreign = chips.some(([c]) => c !== BASE);
  return `<div class="sum-label">Disponible</div>
    <div class="sum-value ${tot.cup < 0 ? 'neg' : ''}">${esc(fmtCur(tot.cup))}</div>
    ${tot.usd != null ? `<div class="sum-usd">≈ ${esc(fmtCur(tot.usd, 'USD'))}</div>` : ''}
    ${!compact && chips.length ? `<div class="cur-chips">${chips.map(([c, v]) => `<span class="cur-chip">${D.curInfo(c).flag} ${esc(fmtCur(v, c))}</span>`).join('')}</div>` : ''}
    ${!compact && foreign ? `<div class="sum-note">${tot.missing.length ? `Falta la tasa de ${esc(tot.missing.join(', '))}. ` : ''}Las divisas se valoran al cambio actual${D.rateOf('USD') ? ` (1 USD = ${esc(fmtCur(D.rateOf('USD')))})` : ''}.</div>` : ''}`;
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

    const accRows = accs.map((a) => {
      const bal = D.accountBalances(a, led);
      const val = D.valuation(bal);
      const onlyBase = Object.keys(bal).every((c) => c === BASE);
      return row({
        lead: emojiTile(a.emoji, a.color),
        title: esc(a.name),
        sub: esc(balanceText(bal)),
        trail: onlyBase ? '' : `<div class="amt-col"><span class="amt">≈ ${esc(fmtCur(val.cup))}</span>${val.usd != null ? `<span class="amt-sub">≈ ${esc(fmtCur(val.usd, 'USD'))}</span>` : ''}</div>`,
        action: 'open-account', id: a.id, chevron: true, cls: 'tall',
      });
    }).join('') + row({ lead: `<span class="add-circle">${icon('plus')}</span>`, title: '<span class="tint">Nueva cuenta</span>', action: 'new-account' });

    const monthNav = `<div class="month-nav">
      <button type="button" class="glass glass-btn sm" data-action="month" data-d="-1" aria-label="Mes anterior">${icon('chevronLeft')}</button>
      <div class="m">${esc(fmtMonth(state.month))}${isCurrent ? '' : '<button type="button" class="link-btn" data-action="month" data-d="0">Volver a este mes</button>'}</div>
      <button type="button" class="glass glass-btn sm" data-action="month" data-d="1" aria-label="Mes siguiente">${icon('chevronRight')}</button></div>`;

    const stat = (label, v, cls) => `<div class="stat"><span class="stat-label">${label}</span>
      <span class="stat-value ${cls}">${esc(fmtCur(v.cup))}</span><span class="stat-usd">${v.usd != null && v.cup ? esc(`≈ ${fmtCur(v.usd, 'USD')}`) : '&nbsp;'}</span></div>`;
    const stats = `<div class="stats">${stat('Entradas', s.income, 'pos')}${stat('Gastado', s.spent, '')}</div>`;

    const cats = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]);
    const catGroup = cats.length ? group({
      header: 'En qué se ha gastado',
      body: cats.map(([cid, cup]) => {
        const c = store.get('budgets', cid);
        const pct = s.spent.cup ? (cup / s.spent.cup) * 100 : 0;
        return row({
          lead: c ? emojiTile(c.emoji, c.color) : emojiTile('🧾', 'gray'),
          title: esc(c?.name || 'Sin categoría'),
          sub: `<div class="budget-sub">${progress(pct, c?.color || 'gray')}<span>${Math.round(pct)}% del gasto del mes</span></div>`,
          trail: `<div class="amt-col"><span class="amt">${esc(fmtCur(cup))}</span><span class="amt-sub">${esc(usdLine(cup))}</span></div>`,
          cls: 'tall',
        });
      }).join(''),
    }) : '';

    const people = Object.entries(s.byMember).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const peopleGroup = people.length && D.members().length > 1 ? group({
      header: 'Quién ha pagado',
      body: people.map(([id, v]) => row({ lead: avatar(D.member(id), 'sm'), title: esc(D.member(id)?.name || 'Sin indicar'), trail: `<span class="amt">${esc(fmtCur(v))}</span>` })).join(''),
    }) : '';

    const byDate = groupBy(s.list, (t) => t.date);
    const movements = s.list.length
      ? [...byDate.entries()].map(([date, arr]) => group({ header: fmtDay(date), body: arr.map((t) => txnRow(t)).join('') })).join('')
      : empty({ icon: 'receipt', title: 'Sin movimientos este mes', text: 'Anota las entradas de dinero, los gastos y los cambios de moneda para saber cuánto queda.', action: 'new-move', actionLabel: 'Nuevo movimiento' });

    return largeTitle('Finanzas') + hero + actionButtons()
      + group({ header: 'Cuentas', body: accRows })
      + monthNav + stats + catGroup + peopleGroup
      + '<h2 class="sub-title">Movimientos</h2>' + movements;
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
  },
};
