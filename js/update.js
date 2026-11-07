// App de Android: comprueba si hay una versión nueva publicada en GitHub Releases
// (las que crea el workflow de compilación, con etiquetas «android-N»).
import { isNative, build, REPO } from './platform.js';

let latest = null;
let lastCheck = 0;
const listeners = new Set();

export const updateInfo = () => latest;
export const onUpdate = (fn) => listeners.add(fn);

export async function checkForUpdate({ force = false } = {}) {
  if (!isNative || !build.build) return null;
  if (!force && Date.now() - lastCheck < 6 * 3600e3) return latest;
  lastCheck = Date.now();
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=10`, {
      headers: { Accept: 'application/vnd.github+json' }, cache: 'no-store',
    });
    if (!res.ok) return latest;
    const list = await res.json();
    const rel = list.find((r) => !r.draft && /^android-\d+$/.test(r.tag_name));
    const n = rel ? Number(rel.tag_name.slice(8)) : 0;
    const asset = rel?.assets?.find((a) => a.name.endsWith('.apk'));
    latest = n > build.build ? { build: n, url: asset?.browser_download_url || rel.html_url, notes: rel.body || '' } : null;
    for (const fn of listeners) fn(latest);
  } catch { /* sin conexión: se intentará más tarde */ }
  return latest;
}

/** Abre la descarga del APK en el navegador del teléfono. */
export function downloadUpdate() {
  if (latest?.url) window.location.href = latest.url;
}
