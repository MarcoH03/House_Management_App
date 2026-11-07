// Hojas modales (sheets), alertas, hojas de acciones y avisos tipo HUD.
import { icon } from './icons.js';
import { esc, parseAmount, fmtNum, round2 } from './util.js';

const root = () => document.getElementById('overlays');

/* ---------- Botón «atrás» (Android y navegador) ----------
   Cada hoja o alerta abierta añade una entrada al historial; al pulsar «atrás»
   se cierra la de arriba en vez de salir de la app. */
const stack = [];
let pendingBacks = 0;
let rootBack = null;

/** Qué hacer con «atrás» cuando no hay nada abierto (lo define app.js). */
export function setRootBack(fn) { rootBack = fn; }

function pushOverlay(close) {
  const entry = { close };
  stack.push(entry);
  try { history.pushState({ hogarOverlay: stack.length }, ''); } catch { /* sin historial */ }
  return entry;
}

/** Quita la hoja de la pila. Si se cerró desde la app (no con «atrás»), retrocede el historial. */
function popOverlay(entry, fromHistory) {
  const i = stack.indexOf(entry);
  if (i < 0) return;
  stack.splice(i, 1);
  if (!fromHistory) {
    pendingBacks++;
    try { history.back(); } catch { pendingBacks--; }
  }
}

window.addEventListener('popstate', (e) => {
  // Profundidad de la entrada a la que se ha vuelto: se cierra todo lo que esté por encima.
  const depth = e.state?.hogarOverlay || 0;
  let closedAny = false;
  while (stack.length > depth) {
    stack.pop().close(true);
    closedAny = true;
  }
  if (closedAny) return;
  if (pendingBacks > 0) { pendingBacks--; return; } // retroceso hecho por la propia app
  if (depth > 0) { try { history.back(); } catch { /* nada */ } return; } // entrada huérfana
  rootBack?.(e);
});

export const overlaysOpen = () => stack.length > 0;

let lockCount = 0;
let savedY = 0;
function lock() {
  if (lockCount++ === 0) {
    savedY = window.scrollY;
    document.body.style.top = `-${savedY}px`;
    document.body.classList.add('locked');
  }
}
function unlock() {
  if (--lockCount <= 0) {
    lockCount = 0;
    document.body.classList.remove('locked');
    document.body.style.top = '';
    window.scrollTo(0, savedY);
  }
}
export const scrollPos = () => (lockCount ? savedY : window.scrollY);

export function readForm(el) {
  const out = {};
  el.querySelectorAll('[name]').forEach((f) => {
    if (f.type === 'checkbox') out[f.name] = f.checked;
    else if (f.type === 'radio') { if (f.checked) out[f.name] = f.value; }
    else out[f.name] = f.value;
  });
  return out;
}

function syncDate(input) {
  const wrap = input.closest('.date-wrap');
  wrap?.classList.toggle('empty', !input.value);
  wrap?.parentElement.querySelector('.date-clear')?.classList.toggle('hidden', !input.value);
}

/** Controles genéricos dentro de hojas: steppers, selectores, fechas. */
function handleControls(e) {
  const stepBtn = e.target.closest('[data-step]');
  if (stepBtn) {
    const st = stepBtn.closest('.stepper');
    const inp = st.querySelector('input');
    const inc = parseFloat(st.dataset.inc || '1');
    const min = parseFloat(st.dataset.min ?? '0');
    const v = Math.max(min, round2(parseAmount(inp.value) + inc * parseFloat(stepBtn.dataset.step)));
    inp.value = fmtNum(v);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    const grp = pick.closest('[data-picker]');
    grp.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('on', b === pick));
    const h = grp.querySelector('input[type=hidden]');
    h.value = pick.dataset.pick;
    h.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  const clr = e.target.closest('[data-clear-date]');
  if (clr) {
    e.preventDefault();
    const inp = clr.parentElement.querySelector('input[type=date]');
    inp.value = '';
    syncDate(inp);
    return true;
  }
  return false;
}

function setupDrag(sheet, handle, close) {
  let startY = null;
  let dy = 0;
  handle.addEventListener('touchstart', (e) => {
    if (e.target.closest('button')) return;
    startY = e.touches[0].clientY;
    dy = 0;
    sheet.style.transition = 'none';
  }, { passive: true });
  handle.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    dy = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  handle.addEventListener('touchend', () => {
    if (startY === null) return;
    startY = null;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 110) close();
  });
}

/**
 * Abre una hoja modal.
 * onDone(values, api) → si devuelve false la hoja no se cierra.
 * actions: { nombre(el, api, event) } para elementos [data-action] del cuerpo.
 * require: nombre del campo que debe estar relleno para activar ✓.
 */
export function openSheet({ title = '', body = '', onDone, doneLabel = 'Guardar', actions = {}, onMount, onClose, require, size = 'full' }) {
  lock();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div>
    <div class="sheet ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-head"><div class="grabber"></div>
        <button type="button" class="glass glass-btn" data-sheet="close" aria-label="Cerrar">${icon('xmark')}</button>
        <div class="sheet-title">${esc(title)}</div>
        ${onDone ? `<button type="button" class="glass glass-btn prominent" data-sheet="done" aria-label="${esc(doneLabel)}">${icon('check')}</button>` : '<span class="glass-spacer"></span>'}
      </div>
      <div class="sheet-body">${body}</div>
    </div>`;
  root().appendChild(wrap);
  const sheet = wrap.querySelector('.sheet');
  const bodyEl = wrap.querySelector('.sheet-body');
  const doneBtn = wrap.querySelector('[data-sheet="done"]');
  let closed = false;
  let entry = null;

  const api = {
    el: sheet,
    body: bodyEl,
    values: () => readForm(bodyEl),
    close,
    setBody(html) { bodyEl.innerHTML = html; validate(); },
  };

  function validate() {
    if (!require || !doneBtn) return;
    const f = bodyEl.querySelector(`[name="${require}"]`);
    doneBtn.disabled = !(f && f.value.trim());
  }

  function close(fromHistory = false) {
    if (closed) return;
    closed = true;
    popOverlay(entry, fromHistory === true);
    document.removeEventListener('keydown', onKey);
    wrap.classList.remove('open');
    setTimeout(() => { wrap.remove(); unlock(); }, 380);
    onClose?.();
  }

  async function done() {
    if (doneBtn?.disabled) return;
    sheet.classList.add('busy');
    try {
      const r = await onDone(api.values(), api);
      if (r !== false) close();
    } catch (err) {
      await alertDialog('No se pudo completar', err.message || String(err));
    } finally {
      sheet.classList.remove('busy');
    }
  }

  function onKey(e) {
    if (e.key === 'Escape' && wrap === root().lastElementChild) close();
  }
  document.addEventListener('keydown', onKey);

  wrap.addEventListener('click', (e) => {
    if (e.target.classList.contains('sheet-backdrop')) return close();
    const sb = e.target.closest('[data-sheet]');
    if (sb) {
      if (sb.dataset.sheet === 'close') close();
      else done();
      return;
    }
    if (handleControls(e)) return;
    const a = e.target.closest('[data-action]');
    if (a && bodyEl.contains(a) && actions[a.dataset.action]) actions[a.dataset.action](a, api, e);
  });
  bodyEl.addEventListener('input', (e) => {
    if (e.target.type === 'date') syncDate(e.target);
    validate();
  });
  bodyEl.addEventListener('change', (e) => { if (e.target.type === 'date') syncDate(e.target); });
  bodyEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && onDone && !e.isComposing) {
      e.preventDefault();
      done();
    }
  });

  setupDrag(sheet, wrap.querySelector('.sheet-head'), () => close());
  entry = pushOverlay(close);
  validate();
  onMount?.(api);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    wrap.classList.add('open');
    const af = bodyEl.querySelector('[autofocus]');
    if (af) af.focus({ preventScroll: true });
  }));
  return api;
}

/* ---------- Alertas ---------- */

export function dialog({ title, message = '', buttons = [{ label: 'Aceptar', value: true, style: 'primary' }] }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'alert-wrap';
    const vertical = buttons.length > 2 || buttons.some((b) => b.label.length > 14);
    wrap.innerHTML = `<div class="alert glass" role="alertdialog" aria-modal="true">
      <div class="alert-title">${esc(title)}</div>${message ? `<div class="alert-msg">${esc(message)}</div>` : ''}
      <div class="alert-btns ${vertical ? 'vertical' : ''}">${buttons.map((b, i) =>
        `<button type="button" class="alert-btn ${b.style || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    root().appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
    let done = false;
    const cancelValue = (buttons.find((b) => b.style === 'cancel') || buttons[0]).value;
    const finish = (value, fromHistory = false) => {
      if (done) return;
      done = true;
      popOverlay(entry, fromHistory);
      wrap.classList.remove('open');
      setTimeout(() => wrap.remove(), 220);
      resolve(value);
    };
    const entry = pushOverlay((fromHistory) => finish(cancelValue, fromHistory));
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      finish(buttons[Number(b.dataset.i)].value);
    });
  });
}

export const alertDialog = (title, message) => dialog({ title, message });

export const confirmDialog = ({ title, message = '', confirm = 'Eliminar', destructive = true }) =>
  dialog({
    title, message,
    buttons: [
      { label: 'Cancelar', value: false, style: 'cancel' },
      { label: confirm, value: true, style: destructive ? 'destructive' : 'primary' },
    ],
  });

/* ---------- Hoja de acciones ---------- */

export function actionSheet({ title = '', message = '', actions }) {
  return new Promise((resolve) => {
    lock();
    const wrap = document.createElement('div');
    wrap.className = 'asheet-wrap';
    wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="asheet">
      <div class="asheet-group glass">${title || message ? `<div class="asheet-head">${title ? `<div class="asheet-title">${esc(title)}</div>` : ''}${message ? `<div class="asheet-msg">${esc(message)}</div>` : ''}</div>` : ''}
      ${actions.map((a, i) => `<button type="button" class="asheet-btn ${a.destructive ? 'destructive' : ''}" data-i="${i}">${a.icon ? icon(a.icon) : ''}<span>${esc(a.label)}</span></button>`).join('')}</div>
      <button type="button" class="asheet-btn cancel glass" data-i="-1">Cancelar</button></div>`;
    root().appendChild(wrap);
    requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
    let done = false;
    const finish = (v, fromHistory = false) => {
      if (done) return;
      done = true;
      popOverlay(entry, fromHistory);
      wrap.classList.remove('open');
      setTimeout(() => { wrap.remove(); unlock(); }, 320);
      resolve(v);
    };
    const entry = pushOverlay((fromHistory) => finish(null, fromHistory));
    wrap.addEventListener('click', (e) => {
      if (e.target.classList.contains('sheet-backdrop')) return finish(null);
      const b = e.target.closest('[data-i]');
      if (!b) return;
      const i = Number(b.dataset.i);
      finish(i < 0 ? null : actions[i].value);
    });
  });
}

/* ---------- Aviso tipo HUD ---------- */

let toastTimer;
export function toast(text, ic = 'check') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast glass';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.innerHTML = `${ic ? icon(ic) : ''}<span>${esc(text)}</span>`;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
