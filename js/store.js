// Almacén local de datos con fusión "last-write-wins" por registro.
// Cada registro lleva `updatedAt`; los borrados se guardan como lápidas
// ({id, deleted:true, updatedAt}) para que se propaguen a otros dispositivos.

const DATA_KEY = 'hogar:data';
const META_KEY = 'hogar:meta';
export const COLS = ['members', 'items', 'purchases', 'tasks', 'budgets', 'expenses', 'activity'];
const ACTIVITY_TTL = 60 * 86400000;

function blank() {
  const d = { schema: 1, settings: { id: 'settings', name: '', currency: 'EUR', updatedAt: 0 } };
  for (const c of COLS) d[c] = {};
  return d;
}

export function normalize(raw) {
  const d = blank();
  if (!raw || typeof raw !== 'object') return d;
  if (raw.settings && typeof raw.settings === 'object') d.settings = { ...d.settings, ...raw.settings };
  const cutoff = Date.now() - ACTIVITY_TTL;
  for (const c of COLS) {
    const src = raw[c];
    if (!src || typeof src !== 'object') continue;
    for (const r of Array.isArray(src) ? src : Object.values(src)) {
      if (!r || typeof r !== 'object' || !r.id) continue;
      if (c === 'activity' && (r.at || r.updatedAt || 0) < cutoff) continue;
      d[c][r.id] = r;
    }
  }
  return d;
}

const ts = (r) => (r && r.updatedAt) || 0;

/**
 * Fusiona dos copias. Devuelve el resultado y dos indicadores:
 * - changed: la copia local ha recibido algo nuevo del remoto.
 * - localNewer: la copia local tiene algo que el remoto aún no tiene.
 */
export function mergeData(local, remote) {
  const out = blank();
  let changed = false;
  let localNewer = false;
  const pick = (l, r) => {
    if (!l) { changed = true; return r; }
    if (!r) { localNewer = true; return l; }
    if (ts(r) > ts(l)) { changed = true; return r; }
    if (ts(l) > ts(r)) localNewer = true;
    return l;
  };
  out.settings = pick(local.settings, remote.settings);
  for (const c of COLS) {
    const ids = new Set([...Object.keys(local[c] || {}), ...Object.keys(remote[c] || {})]);
    for (const id of ids) out[c][id] = pick(local[c]?.[id], remote[c]?.[id]);
  }
  return { data: out, changed, localNewer };
}

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

class Store {
  constructor() {
    this.data = normalize(load(DATA_KEY, null));
    this.meta = { me: null, onboarded: false, dirty: false, rev: 0, ...load(META_KEY, {}) };
    this.listeners = new Set();
    this._batch = 0;
    this._pending = false;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(source) {
    for (const fn of this.listeners) fn(source);
  }

  save() {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(this.data)); } catch (e) { console.error(e); }
  }
  saveMeta() {
    try { localStorage.setItem(META_KEY, JSON.stringify(this.meta)); } catch (e) { console.error(e); }
  }
  setMeta(patch, silent = false) {
    Object.assign(this.meta, patch);
    this.saveMeta();
    if (!silent) this.emit('meta');
  }

  _now(prev) {
    const t = Date.now();
    return prev && prev >= t ? prev + 1 : t;
  }

  list(col) {
    return Object.values(this.data[col]).filter((r) => !r.deleted);
  }
  get(col, id) {
    const r = id ? this.data[col][id] : null;
    return r && !r.deleted ? r : null;
  }
  put(col, rec) {
    const id = rec.id || Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const prev = this.data[col][id];
    const updatedAt = this._now(ts(prev));
    const r = { ...rec, id, updatedAt, createdAt: rec.createdAt || prev?.createdAt || updatedAt };
    this.data[col][id] = r;
    this._changed();
    return r;
  }
  patch(col, id, changes) {
    const prev = this.get(col, id);
    if (!prev) return null;
    return this.put(col, { ...prev, ...changes });
  }
  remove(col, id) {
    const prev = this.data[col][id];
    if (!prev) return;
    this.data[col][id] = { id, deleted: true, updatedAt: this._now(ts(prev)) };
    this._changed();
  }
  setSettings(changes) {
    const s = this.data.settings;
    this.data.settings = { ...s, ...changes, updatedAt: this._now(ts(s)) };
    this._changed();
  }

  /** Agrupa varios cambios en una sola notificación/guardado. */
  batch(fn) {
    this._batch++;
    try {
      return fn();
    } finally {
      this._batch--;
      if (!this._batch && this._pending) {
        this._pending = false;
        this._flush();
      }
    }
  }
  _changed() {
    this.meta.dirty = true;
    this.meta.rev = (this.meta.rev || 0) + 1;
    if (this._batch) { this._pending = true; return; }
    this._flush();
  }
  _flush() {
    this.save();
    this.saveMeta();
    this.emit('local');
  }

  /** Fusiona datos remotos. Devuelve true si lo local tiene algo que subir. */
  merge(remote) {
    const { data, changed, localNewer } = mergeData(this.data, normalize(remote));
    if (changed) {
      this.data = data;
      this.save();
      this.emit('remote');
    }
    return localNewer;
  }

  /** Importa una copia de seguridad combinándola con los datos actuales. */
  importData(raw) {
    const { data } = mergeData(this.data, normalize(raw));
    this.data = data;
    this._changed();
  }

  exportData() {
    return this.data;
  }

  reset() {
    localStorage.removeItem(DATA_KEY);
    localStorage.removeItem(META_KEY);
  }
}

export const store = new Store();
