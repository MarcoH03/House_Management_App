// Punto de entrada: registra vistas, arranca la sincronización y el service worker.
import { store } from './store.js';
import { sync } from './sync.js';
import { app } from './app.js';
import home from './views/home.js';
import shopping from './views/shopping.js';
import tasks from './views/tasks.js';
import money from './views/money.js';
import settings, { showSyncStatus, openJoinSheet, openWhoSheet } from './views/settings.js';
import onboarding from './views/onboarding.js';
import * as D from './domain.js';
import { startRates, refreshRates } from './rates.js';

[home, shopping, tasks, money, settings, onboarding].forEach((v) => app.register(v));

app.globalActions['sync-status'] = showSyncStatus;
app.globalActions['sync-now'] = () => sync.now();

// Enlace de invitación: #join=CÓDIGO
let joinCode = null;
const m = location.hash.match(/join=([^&]+)/);
if (m) {
  joinCode = decodeURIComponent(m[1]);
  history.replaceState(null, '', location.pathname + location.search);
} else {
  const tab = location.hash.slice(1);
  if (app.views[tab] && tab !== 'onboarding') app.tab = tab;
}

D.migrateFinance();
app.init();
app.render();

store.subscribe((src) => {
  if (src === 'remote' || src === 'meta') D.migrateFinance();
  if (src === 'meta' && store.meta.onboarded) refreshRates();
  app.render(src);
});
sync.subscribe(() => {
  // Solo cambia el indicador: se repinta la barra/ajustes sin molestar al usuario.
  if (app.tab === 'home' || app.tab === 'settings') app.render('sync');
});
sync.init();
startRates();

if (joinCode) {
  if (store.meta.onboarded) {
    setTimeout(() => openJoinSheet(joinCode, () => { if (!D.meId()) openWhoSheet(); }), 400);
  } else {
    onboarding.setJoinCode(joinCode);
    setTimeout(() => onboarding.actions['start-join'](), 400);
  }
}

// Refresca las fechas relativas ("hoy", "hace 5 min") al volver a la app.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') app.render('sync');
});

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    // Hay una versión nueva: recarga si no hay ninguna hoja abierta.
    const reload = () => { reloading = true; location.reload(); };
    if (!document.querySelector('.sheet-wrap, .alert-wrap')) reload();
    else document.addEventListener('visibilitychange', reload, { once: true });
  });
}
