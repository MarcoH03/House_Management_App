// Utilidades generales: escape, fechas, formato de números y dinero.

export const LOCALE = (navigator.language || '').toLowerCase().startsWith('es') ? navigator.language : 'es-ES';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Normaliza texto para comparar (sin tildes, minúsculas). */
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const pad = (n) => String(n).padStart(2, '0');

export function dateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const today = () => dateStr();

export function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return dateStr(d);
}
export function addMonths(s, n) {
  const d = parseDate(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return dateStr(d);
}
export const diffDays = (a, b) => Math.round((parseDate(a) - parseDate(b)) / 86400000);
export const monthOf = (s) => String(s).slice(0, 7);
export function shiftMonth(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function fmtMonth(key, withYear = true) {
  const [y, m] = key.split('-').map(Number);
  const opts = withYear ? { month: 'long', year: 'numeric' } : { month: 'long' };
  return cap(new Date(y, m - 1, 1).toLocaleDateString(LOCALE, opts));
}

/** Fecha relativa corta: Hoy, Mañana, Ayer, Viernes, Lun 12 nov… */
export function fmtDay(s) {
  if (!s) return '';
  const d = diffDays(s, today());
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d === -1) return 'Ayer';
  const dt = parseDate(s);
  if (d > 1 && d < 7) return cap(dt.toLocaleDateString(LOCALE, { weekday: 'long' }));
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (dt.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return cap(dt.toLocaleDateString(LOCALE, opts).replace(/\./g, ''));
}

export const fmtLongDate = (d = new Date()) =>
  cap(d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }));

export function fmtMoney(n, currency = 'EUR') {
  const v = Number(n) || 0;
  const cents = Math.round(Math.abs(v) * 100) % 100 !== 0;
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toFixed(2)} ${currency}`;
  }
}

/** Símbolo de la moneda y si va antes o después del número. */
export function currencyInfo(currency = 'EUR') {
  try {
    const parts = new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).formatToParts(1);
    const i = parts.findIndex((p) => p.type === 'currency');
    const n = parts.findIndex((p) => p.type === 'integer');
    return { symbol: parts[i].value, before: i < n };
  } catch {
    return { symbol: currency, before: false };
  }
}

/** Acepta "12,50", "12.5", "1.234,56" o "1,234.56". */
export function parseAmount(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let t = String(v || '').replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  if (t.includes(',') && t.includes('.')) {
    t = t.lastIndexOf(',') > t.lastIndexOf('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else {
    t = t.replace(',', '.');
  }
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
}

/** Importe con el código de moneda detrás: "33 250 CUP", "50 USD", "12,50 EUR". */
export function fmtCur(n, code = 'CUP', { sign = false } = {}) {
  const v = Number(n) || 0;
  const cents = Math.round(Math.abs(v) * 100) % 100 !== 0;
  const opts = { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 };
  let num;
  try { num = Math.abs(v).toLocaleString(LOCALE, { ...opts, useGrouping: 'always' }); } catch { num = Math.abs(v).toLocaleString(LOCALE, opts); }
  const pre = v < 0 ? '−' : sign && v > 0 ? '+' : '';
  return `${pre}${num}\u00a0${code}`;
}

export const fmtQty = (n) => round2(n).toLocaleString(LOCALE, { maximumFractionDigits: 2 });
export const fmtNum = (n) => round2(n).toLocaleString(LOCALE, { maximumFractionDigits: 2, useGrouping: false });

export function timeAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'ahora';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} días`;
  return new Date(ts).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

export function listNames(names, max = 3) {
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')} y ${names.length - max} más`;
}

export const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** Base64 seguro para UTF-8. */
export function toB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export function fromB64(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
