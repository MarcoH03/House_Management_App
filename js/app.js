// Shell de la app: barra de navegación, barra de pestañas, enrutado y render.
import { store } from './store.js';
import { icon } from './icons.js';
import { scrollPos, setRootBack } from './overlays.js';

const TABS = [
  ['home', 'Inicio', 'house'],
  ['shopping', 'Compras', 'cart'],
  ['tasks', 'Tareas', 'checklist'],
  ['money', 'Finanzas', 'wallet'],
  ['settings', 'Ajustes', 'sliders'],
];

export const app = {
  views: {},
  tab: 'home',
  scroll: {},
  globalActions: {},
  pendingRender: false,

  register(v) { this.views[v.id] = v; },

  get current() {
    return store.meta.onboarded ? this.views[this.tab] : this.views.onboarding;
  },

  init() {
    this.viewEl = document.getElementById('view');
    this.navEl = document.getElementById('navbar');
    this.tabEl = document.getElementById('tabbar');
    this.tabEl.innerHTML = TABS.map(([id, label, ic]) =>
      `<button type="button" class="tab" data-tab="${id}" aria-label="${label}">${icon(ic)}<span>${label}</span><b class="badge" hidden></b></button>`).join('');

    this.tabEl.addEventListener('click', (e) => {
      const t = e.target.closest('[data-tab]');
      if (!t) return;
      if (t.dataset.tab === this.tab) window.scrollTo({ top: 0, behavior: 'smooth' });
      else this.go(t.dataset.tab);
    });

    const dispatch = (e) => {
      const a = e.target.closest('[data-action]');
      if (!a || !(this.viewEl.contains(a) || this.navEl.contains(a))) return;
      const v = this.current;
      const fn = v?.actions?.[a.dataset.action] || this.globalActions[a.dataset.action];
      if (fn) {
        e.preventDefault();
        fn(a, e);
      }
    };
    document.addEventListener('click', dispatch);
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('.row[role=button]')) dispatch(e);
    });
    for (const type of ['input', 'change', 'keydown']) {
      this.viewEl.addEventListener(type, (e) => {
        const h = this.current?.[`on${type[0].toUpperCase()}${type.slice(1)}`];
        if (h) h.call(this.current, e);
      });
    }
    this.viewEl.addEventListener('focusout', () => {
      if (this.pendingRender) setTimeout(() => {
        if (!this.viewEl.contains(document.activeElement)) this.render();
      }, 50);
    });
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    // «Atrás» sin ventanas abiertas: desde otra pestaña vuelve a Inicio.
    setRootBack(() => {
      if (this.tab !== 'home' && store.meta.onboarded) {
        this.go('home', { top: true, fromBack: true });
        try { history.replaceState(null, '', '#home'); } catch { /* nada */ }
      }
    });
  },

  go(tab, opts = {}) {
    if (!this.views[tab]) return;
    // Volver a Inicio desde otra pestaña = deshacer la entrada del historial.
    if (tab === 'home' && this.tab !== 'home' && !opts.fromBack && history.state?.hogarTab) {
      history.back();
      return;
    }
    if (tab !== this.tab) {
      this.scroll[this.tab] = scrollPos();
      const from = this.tab;
      this.tab = tab;
      // Al salir de Inicio se añade una entrada al historial, para que «atrás» vuelva a Inicio.
      try {
        if (from === 'home' && tab !== 'home' && !opts.fromBack) history.pushState({ hogarTab: tab }, '', `#${tab}`);
        else if (!opts.fromBack) history.replaceState(history.state, '', `#${tab}`);
      } catch { /* sin historial */ }
    }
    this.views[tab].onShow?.(opts);
    this.render();
    window.scrollTo(0, opts.top ? 0 : this.scroll[tab] || 0);
    this.onScroll();
  },

  /** Vuelve a pintar la vista. Si el cambio viene de fuera y el usuario
   *  está escribiendo, espera a que termine para no cerrar el teclado. */
  render(source = 'local') {
    const v = this.current;
    if (!v) return;
    const active = document.activeElement;
    const typing = active && this.viewEl.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName);
    if (typing && source !== 'local') {
      this.pendingRender = true;
      return;
    }
    this.pendingRender = false;
    document.body.classList.toggle('onboarding', !store.meta.onboarded);
    const focus = typing ? { name: active.name, start: active.selectionStart, end: active.selectionEnd } : null;

    this.viewEl.innerHTML = `<div class="page page-${v.id}">${v.render()}</div>`;
    const title = v.title?.() || '';
    this.navEl.innerHTML = `<div class="nav-inner"><div class="nav-side left">${v.navLeft?.() || ''}</div>`
      + `<div class="nav-title">${title.replace(/</g, '&lt;')}</div><div class="nav-side right">${v.navRight?.() || ''}</div></div>`;

    if (focus?.name) {
      const el = this.viewEl.querySelector(`[name="${focus.name}"]`);
      if (el) {
        el.focus({ preventScroll: true });
        try { el.setSelectionRange(focus.start, focus.end); } catch { /* no aplica */ }
      }
    }
    v.mounted?.(this.viewEl);
    this.updateTabs();
    this.onScroll();
  },

  updateTabs() {
    for (const b of this.tabEl.querySelectorAll('.tab')) {
      const on = b.dataset.tab === this.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-current', on ? 'page' : 'false');
      const n = this.views[b.dataset.tab]?.badge?.() || 0;
      const badge = b.querySelector('.badge');
      badge.hidden = !n;
      badge.textContent = n > 99 ? '99+' : n;
    }
  },

  onScroll() {
    const lt = this.viewEl.querySelector('.large-title');
    const limit = lt ? lt.offsetTop + lt.offsetHeight - 50 : 10;
    this.navEl.classList.toggle('scrolled', scrollPos() > Math.max(4, limit));
  },
};
