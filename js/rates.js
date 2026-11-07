// Tasas de cambio publicadas junto a la app (rates.json, generado por un
// GitHub Action a partir de elTOque). Si la descarga falla, se siguen usando
// las últimas tasas guardadas, que el usuario puede editar a mano.
import { store } from './store.js';
import * as D from './domain.js';
import { isNative, PUBLIC_URL } from './platform.js';

let last = 0;
let inflight = null;

export const SOURCE_LABEL = {
  'eltoque-api': 'elTOque',
  'eltoque-telegram': 'elTOque (Telegram)',
  manual: 'Manual',
};

/** Descarga rates.json. Devuelve el objeto o null. */
export async function fetchPublished() {
  // La app nativa lleva una copia dentro; la actual se lee de la web publicada.
  const urls = isNative ? [`${PUBLIC_URL}rates.json`, './rates.json'] : ['./rates.json'];
  for (const url of urls) {
    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const j = await res.json();
      if (j && j.rates && Number(j.rates.USD) > 0) return j;
    } catch { /* probar la siguiente */ }
  }
  return null;
}

/**
 * Aplica las tasas publicadas si son más recientes que las guardadas.
 * force: las aplica aunque estén desactivadas las automáticas o sean más antiguas.
 * Devuelve { status: 'updated' | 'same' | 'older' | 'off' | 'unavailable', data }.
 */
export async function refreshRates({ force = false } = {}) {
  if (!store.meta.onboarded) return { status: 'off' };
  if (inflight) return inflight;
  inflight = (async () => {
    const data = await fetchPublished();
    last = Date.now();
    if (!data) return { status: 'unavailable' };
    const cur = D.fx();
    if (!force && cur.auto === false) return { status: 'off', data };
    const asOf = new Date(data.asOf).toISOString();
    if (!force && cur.asOf && asOf <= cur.asOf) return { status: cur.source === 'manual' ? 'older' : 'same', data };
    D.setRates({ ...cur.rates, ...data.rates }, { source: data.source || 'eltoque-api', asOf });
    return { status: 'updated', data };
  })();
  try { return await inflight; } finally { inflight = null; }
}

export function startRates() {
  const tick = () => { if (document.visibilityState === 'visible' && Date.now() - last > 30 * 60000) refreshRates(); };
  tick();
  setInterval(tick, 5 * 60000);
  document.addEventListener('visibilitychange', tick);
}
