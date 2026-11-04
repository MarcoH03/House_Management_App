// Sincronización entre dispositivos usando un archivo JSON en un repositorio
// PRIVADO de GitHub (API REST "contents"). Cada dispositivo descarga el archivo,
// lo fusiona con sus datos locales (last-write-wins por registro) y sube el
// resultado. Si otro dispositivo escribió entre medias, GitHub responde 409 y
// se repite el ciclo.
import { store } from './store.js';
import { toB64, fromB64 } from './util.js';

const CFG_KEY = 'hogar:sync';
const LAST_KEY = 'hogar:lastSync';
const API = 'https://api.github.com';
const POLL_MS = 20000;

const state = {
  cfg: load(),
  status: 'off', // off | idle | syncing | error | offline
  error: null,
  lastSync: Number(localStorage.getItem(LAST_KEY)) || 0,
  etag: null,
  sha: null,
  busy: false,
  again: false,
};
const listeners = new Set();
let debounceTimer = null;
let started = false;

function load() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || null;
  } catch {
    return null;
  }
}

function setStatus(s, error = null) {
  state.status = s;
  state.error = error;
  for (const fn of listeners) fn(state);
}

class SyncError extends Error {
  constructor(message, { offline = false, auth = false } = {}) {
    super(message);
    this.offline = offline;
    this.auth = auth;
  }
}

/** Acepta "usuario", "usuario/repo" o una URL de GitHub. */
export function parseRepo(owner, repo) {
  let o = String(owner || '').trim();
  let r = String(repo || '').trim();
  const m = o.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/i);
  if (m) { o = m[1]; r = r || m[2]; } else if (o.includes('/') && !r) [o, r] = o.split('/');
  return { owner: o.replace(/^@/, ''), repo: r.replace(/\.git$/, '') };
}

function cleanCfg(c) {
  const { owner, repo } = parseRepo(c.owner, c.repo);
  return {
    owner, repo,
    token: String(c.token || '').trim(),
    branch: String(c.branch || '').trim(),
    path: String(c.path || '').trim().replace(/^\/+/, '') || 'hogar.json',
  };
}

async function api(method, path, { body, headers = {}, cfg = state.cfg } = {}) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new SyncError('Sin conexión con GitHub.', { offline: true });
  }
  return res;
}

async function httpError(res, context = '') {
  let msg = '';
  try { msg = (await res.json()).message || ''; } catch { /* sin cuerpo */ }
  if (res.status === 401) return new SyncError('El token no es válido o ha caducado. Crea uno nuevo y vuelve a conectar.', { auth: true });
  if (res.status === 403 || res.status === 429) {
    if (res.headers.get('x-ratelimit-remaining') === '0' || res.status === 429) return new SyncError('GitHub ha limitado las peticiones temporalmente. Se reintentará en unos minutos.');
    return new SyncError('El token no tiene permiso para escribir en el repositorio. Revisa que tenga «Contents: Read and write».', { auth: true });
  }
  if (res.status === 404) return new SyncError(`No se encuentra el repositorio${context}. Comprueba el nombre y que el token tenga acceso a él.`, { auth: true });
  return new SyncError(`Error de GitHub (${res.status}) ${msg}`.trim());
}

const contentsPath = (c = state.cfg) =>
  `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}`;

async function pull() {
  const c = state.cfg;
  const q = c.branch ? `?ref=${encodeURIComponent(c.branch)}` : '';
  const headers = state.etag && state.sha ? { 'If-None-Match': state.etag } : {};
  const res = await api('GET', contentsPath() + q, { headers });
  if (res.status === 304) return { unchanged: true };
  if (res.status === 404) {
    state.sha = null;
    state.etag = null;
    return { missing: true };
  }
  if (!res.ok) throw await httpError(res);
  const j = await res.json();
  let content = j.content;
  if (!content && j.size > 0) {
    // Archivos de más de 1 MB: se leen como blob.
    const b = await api('GET', `/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/git/blobs/${j.sha}`);
    if (!b.ok) throw await httpError(b);
    content = (await b.json()).content;
  }
  state.sha = j.sha;
  state.etag = res.headers.get('ETag');
  const text = content ? fromB64(content) : '';
  let data = null;
  try { data = text.trim() ? JSON.parse(text) : null; } catch { throw new SyncError('El archivo de datos en GitHub está dañado.'); }
  return { data };
}

/** Devuelve false si hubo conflicto (otro dispositivo escribió antes). */
async function push() {
  const c = state.cfg;
  const who = store.get('members', store.meta.me)?.name;
  const body = {
    message: `Actualizar datos${who ? ` (${who})` : ''}`,
    content: toB64(JSON.stringify(store.exportData())),
  };
  if (state.sha) body.sha = state.sha;
  if (c.branch) body.branch = c.branch;
  const res = await api('PUT', contentsPath(), { body });
  if (res.status === 409 || res.status === 422) return false;
  if (!res.ok) throw await httpError(res);
  const j = await res.json();
  state.sha = j.content?.sha || null;
  state.etag = null;
  return true;
}

async function run() {
  if (!state.cfg) return;
  if (state.busy) { state.again = true; return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  state.busy = true;
  setStatus('syncing');
  try {
    let done = false;
    for (let attempt = 0; attempt < 4 && !done; attempt++) {
      const remote = await pull();
      let needPush = !!store.meta.dirty || !!remote.missing;
      if (remote.data) needPush = store.merge(remote.data) || needPush;
      if (!needPush) { done = true; break; }
      const rev = store.meta.rev;
      if (await push()) {
        if (store.meta.rev === rev) store.setMeta({ dirty: false }, true);
        done = true;
      } else {
        state.etag = null; // conflicto: volver a descargar y fusionar
      }
    }
    if (!done) throw new SyncError('Otro dispositivo está guardando a la vez. Se reintentará enseguida.');
    state.lastSync = Date.now();
    localStorage.setItem(LAST_KEY, String(state.lastSync));
    setStatus('idle');
  } catch (e) {
    console.warn('[sync]', e);
    setStatus(e.offline ? 'offline' : 'error', e.message || String(e));
  } finally {
    state.busy = false;
    if (state.again) { state.again = false; run(); }
  }
}

export const sync = {
  get configured() { return !!state.cfg; },
  get cfg() { return state.cfg; },
  get status() { return state.status; },
  get error() { return state.error; },
  get lastSync() { return state.lastSync; },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Comprueba el acceso y guarda la configuración. Lanza errores legibles. */
  async connect(raw) {
    const cfg = cleanCfg(raw);
    if (!cfg.owner || !cfg.repo) throw new SyncError('Indica el usuario y el nombre del repositorio.');
    if (!cfg.token) throw new SyncError('Falta el token de acceso.');
    const res = await api('GET', `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`, { cfg });
    if (!res.ok) throw await httpError(res, ` «${cfg.owner}/${cfg.repo}»`);
    const info = await res.json();
    if (!info.private) {
      throw new SyncError('Ese repositorio es público y cualquiera podría ver los datos de tu casa. Usa un repositorio privado.');
    }
    state.cfg = cfg;
    state.etag = null;
    state.sha = null;
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
    store.setMeta({ dirty: true }, true);
    this.start();
    await run();
    if (state.status === 'error') throw new SyncError(state.error);
  },

  disconnect() {
    state.cfg = null;
    state.etag = null;
    state.sha = null;
    localStorage.removeItem(CFG_KEY);
    setStatus('off');
  },

  now() { return run(); },

  schedule(ms = 1200) {
    if (!state.cfg) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(run, ms);
  },

  start() {
    if (started) return;
    started = true;
    store.subscribe((src) => { if (src === 'local') this.schedule(); });
    setInterval(() => { if (document.visibilityState === 'visible') run(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') run();
      else if (store.meta.dirty) run(); // intenta subir antes de que iOS congele la app
    });
    window.addEventListener('online', () => run());
    window.addEventListener('offline', () => state.cfg && setStatus('offline'));
  },

  init() {
    if (state.cfg) {
      setStatus('idle');
      this.start();
      run();
    }
  },

  /** Código para que otro dispositivo se una a la casa (incluye el token). */
  shareCode() {
    const c = state.cfg;
    if (!c) return '';
    const payload = { v: 1, o: c.owner, r: c.repo, t: c.token, b: c.branch || undefined, p: c.path !== 'hogar.json' ? c.path : undefined };
    return toB64(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  decodeCode(code) {
    let s = String(code || '').trim();
    const m = s.match(/join=([A-Za-z0-9_\-+/=%]+)/);
    if (m) s = decodeURIComponent(m[1]);
    s = s.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    try {
      const p = JSON.parse(fromB64(s));
      if (!p.o || !p.r || !p.t) throw new Error();
      return { owner: p.o, repo: p.r, token: p.t, branch: p.b || '', path: p.p || 'hogar.json' };
    } catch {
      throw new SyncError('El código no es válido. Cópialo de nuevo desde Ajustes en otro dispositivo de la casa.');
    }
  },
};
