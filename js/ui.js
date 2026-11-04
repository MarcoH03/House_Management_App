// Componentes de interfaz (devuelven HTML) con el estilo de iOS.
import { esc, fmtNum } from './util.js';
import { icon } from './icons.js';

export function largeTitle(title, eyebrow = '') {
  return `<header class="lt">${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ''}<h1 class="large-title">${esc(title)}</h1></header>`;
}

/** Lista agrupada con esquinas redondeadas (inset grouped). */
export function group({ header = '', footer = '', body = '', cls = '', headerTrail = '' }) {
  const head = header || headerTrail ? `<div class="group-header"><span>${header}</span>${headerTrail}</div>` : '';
  return `<section class="group ${cls}">${head}<div class="list">${body}</div>${footer ? `<div class="group-footer">${footer}</div>` : ''}</section>`;
}

/** Sección de contenido con título grande (como "Hoy" en Recordatorios). */
export function section({ title, trail = '', body, cls = '' }) {
  return `<section class="sec ${cls}"><div class="sec-header"><h2>${title}</h2>${trail}</div>${body}</section>`;
}

export function row({ lead = '', title = '', sub = '', trail = '', action = '', id = '', chevron = false, cls = '', attrs = '' }) {
  const act = action ? ` data-action="${action}" role="button" tabindex="0"` : '';
  return `<div class="row ${action ? 'tappable' : ''} ${cls}"${act}${id ? ` data-id="${esc(id)}"` : ''} ${attrs}>`
    + (lead ? `<div class="row-lead">${lead}</div>` : '')
    + `<div class="row-body"><div class="row-main"><div class="row-title">${title}</div>${sub ? `<div class="row-sub">${sub}</div>` : ''}</div>`
    + (trail ? `<div class="row-trail">${trail}</div>` : '')
    + (chevron ? `<span class="chev">${icon('chevronRight')}</span>` : '')
    + '</div></div>';
}

export const iconTile = (name, color = 'blue') => `<span class="itile c-${color}">${icon(name)}</span>`;
export const emojiTile = (emoji, color = 'gray', size = '') => `<span class="itile soft ${size} c-${color}"><span class="emoji">${emoji}</span></span>`;

const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function avatar(m, size = '') {
  if (!m) return `<span class="avatar ${size} c-gray">${icon('person')}</span>`;
  return `<span class="avatar ${size} c-${m.color || 'blue'}" aria-hidden="true">${esc(initials(m.name))}</span>`;
}

export function check({ on = false, action, id, color = 'blue', label = 'Completar' }) {
  return `<button type="button" class="check ${on ? 'on' : ''}" style="--cc:var(--${color})" data-action="${action}" data-id="${esc(id)}" aria-label="${esc(label)}">${icon('check')}</button>`;
}

export function segmented(name, options, value, action = 'seg') {
  return `<div class="seg" role="tablist">${options.map(([v, l]) =>
    `<button type="button" role="tab" aria-selected="${v === value}" class="seg-btn ${v === value ? 'on' : ''}" data-action="${action}" data-name="${name}" data-value="${v}">${l}</button>`).join('')}</div>`;
}

export function empty({ icon: ic, title, text = '', action = '', actionLabel = '' }) {
  return `<div class="empty">${ic ? `<div class="empty-icon">${icon(ic)}</div>` : ''}<div class="empty-title">${title}</div>`
    + `${text ? `<div class="empty-text">${text}</div>` : ''}`
    + `${action ? `<button type="button" class="btn-tinted" data-action="${action}">${actionLabel}</button>` : ''}</div>`;
}

export function progress(pct, color = 'blue') {
  const w = Math.max(0, Math.min(100, pct || 0));
  return `<div class="bar"><span style="width:${w}%;background:var(--${color})"></span></div>`;
}

export const glassBtn = (ic, action, label, cls = '', attrs = '') =>
  `<button type="button" class="glass glass-btn ${cls}" data-action="${action}" aria-label="${esc(label)}" ${attrs}>${icon(ic)}</button>`;

/* ---------- Campos de formulario ---------- */

export const F = {
  text({ name, value = '', placeholder = '', label = '', type = 'text', attrs = '', lead = '' }) {
    return `<label class="row field">${lead ? `<div class="row-lead">${lead}</div>` : ''}<div class="row-body">`
      + (label ? `<span class="field-label">${esc(label)}</span>` : '')
      + `<input class="field-input ${label ? 'right' : ''}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs}>`
      + '</div></label>';
  },
  area({ name, value = '', placeholder = '', rows = 3 }) {
    return `<label class="row field"><div class="row-body"><textarea class="field-area" name="${name}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea></div></label>`;
  },
  select({ name, label, value = '', options, lead = '' }) {
    const opts = options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(l)}</option>`).join('');
    return `<label class="row field">${lead ? `<div class="row-lead">${lead}</div>` : ''}<div class="row-body"><span class="field-label">${esc(label)}</span>`
      + `<span class="select-wrap"><select name="${name}">${opts}</select>${icon('chevronUpDown')}</span></div></label>`;
  },
  toggle({ name, label, checked = false, lead = '' }) {
    return `<label class="row field">${lead ? `<div class="row-lead">${lead}</div>` : ''}<div class="row-body"><span class="field-label grow">${esc(label)}</span>`
      + `<span class="switch"><input type="checkbox" role="switch" name="${name}" ${checked ? 'checked' : ''}><span></span></span></div></label>`;
  },
  stepper({ name, label, value = 0, step = 1, min = 0, unit = '', lead = '' }) {
    return `<div class="row field">${lead ? `<div class="row-lead">${lead}</div>` : ''}<div class="row-body"><span class="field-label grow">${esc(label)}</span>`
      + `<div class="stepper" data-inc="${step}" data-min="${min}"><input class="stepper-val" name="${name}" inputmode="decimal" value="${fmtNum(value)}" aria-label="${esc(label)}">`
      + `${unit ? `<span class="stepper-unit">${esc(unit)}</span>` : ''}`
      + `<div class="stepper-btns"><button type="button" data-step="-1" aria-label="Menos">${icon('minus')}</button><button type="button" data-step="1" aria-label="Más">${icon('plus')}</button></div></div></div></div>`;
  },
  date({ name, label, value = '', lead = '', clearable = true }) {
    return `<label class="row field">${lead ? `<div class="row-lead">${lead}</div>` : ''}<div class="row-body"><span class="field-label grow">${esc(label)}</span>`
      + `<span class="date-wrap ${value ? '' : 'empty'}"><input type="date" name="${name}" value="${esc(value)}"><span class="date-ph">Añadir</span></span>`
      + (clearable ? `<button type="button" class="date-clear ${value ? '' : 'hidden'}" data-clear-date aria-label="Quitar fecha">${icon('xmark')}</button>` : '')
      + '</div></label>';
  },
  button({ label, action, cls = '', lead = '' }) {
    return `<div class="row tappable field-btn ${cls}" data-action="${action}" role="button" tabindex="0">${lead ? `<div class="row-lead">${lead}</div>` : ''}<div class="row-body"><span>${label}</span></div></div>`;
  },
  picker({ name, value, options, kind = 'color' }) {
    return `<div class="picker picker-${kind}" data-picker><input type="hidden" name="${name}" value="${esc(value)}">${options.map((o) =>
      kind === 'color'
        ? `<button type="button" class="pick c-${o} ${o === value ? 'on' : ''}" data-pick="${o}" aria-label="${o}"></button>`
        : `<button type="button" class="pick ${o === value ? 'on' : ''}" data-pick="${o}">${o}</button>`).join('')}</div>`;
  },
};
