// Obtiene la tasa representativa del mercado informal en Cuba (elTOque) y
// escribe un JSON { source, asOf, fetchedAt, rates: { USD: 665, EUR: 760, MLC: 433 } }
// con cuántos CUP vale 1 unidad de cada moneda.
//
// 1) API oficial de elTOque si existe el secreto ELTOQUE_API_TOKEN.
// 2) Si no, el canal público de Telegram de elTOque (t.me/s/eltoquecom).
//
// Uso: node fetch-rates.mjs salida.json   (sale con código 0 aunque falle; solo
// escribe el archivo si obtuvo tasas válidas).
import { writeFileSync, readFileSync } from 'node:fs';

const out = process.argv[2] || 'rates.json';
const MAP = { ECU: 'EUR', EUR: 'EUR', USD: 'USD', MLC: 'MLC', USDT_TRC20: 'USDT', USDT: 'USDT', CAD: 'CAD', MXN: 'MXN', BRL: 'BRL', GBP: 'GBP', CHF: 'CHF', CLA: 'CLA' };

const clean = (rates) => Object.fromEntries(
  Object.entries(rates).filter(([, v]) => Number.isFinite(v) && v > 1 && v < 1e6),
);

async function fromApi(token) {
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 3600e3);
  const urls = [
    `https://tasas.eltoque.com/v1/trmi?date_from=${encodeURIComponent(fmt(from))}&date_to=${encodeURIComponent(fmt(now))}`,
    'https://tasas.eltoque.com/v1/trmi',
  ];
  for (const url of urls) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
    if (!res.ok) { console.log(`API ${res.status} en ${url}`); continue; }
    const j = await res.json();
    const t = j.tasas || j.rates || {};
    const rates = {};
    for (const [k, v] of Object.entries(t)) if (MAP[k]) rates[MAP[k]] = Number(v);
    const r = clean(rates);
    if (r.USD) {
      let asOf = now.toISOString();
      if (j.date) {
        const d = new Date(`${j.date}T${pad(j.hour ?? 0)}:${pad(j.minutes ?? 0)}:${pad(j.seconds ?? 0)}-05:00`);
        if (!Number.isNaN(d.getTime())) asOf = d.toISOString();
      }
      return { source: 'eltoque-api', asOf, rates: r };
    }
  }
  return null;
}

export function parseTelegram(html) {
  const blocks = html.split('tgme_widget_message_wrap').slice(1);
  let best = null;
  for (const b of blocks) {
    const textMatch = b.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/);
    const time = b.match(/<time datetime="([^"]+)"/);
    if (!textMatch || !time) continue;
    const text = textMatch[1].replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
    if (!/tasa representativa del mercado informal/i.test(text)) continue;
    const head = text.split(/Hay ofertas/i)[0];
    const rates = {};
    for (const m of head.matchAll(/\b([A-Z]{3,5})\s*:\s*([\d.,]+)\s*CUP/g)) {
      const k = MAP[m[1]] || m[1];
      rates[k] = Number(m[2].replace(/,/g, ''));
    }
    const r = clean(rates);
    if (!r.USD) continue;
    const asOf = new Date(time[1]).toISOString();
    if (!best || asOf > best.asOf) best = { source: 'eltoque-telegram', asOf, rates: r };
  }
  return best;
}

async function fromTelegram() {
  let url = 'https://t.me/s/eltoquecom';
  for (let page = 0; page < 6; page++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HogarRates/1.0)' } });
    if (!res.ok) return null;
    const html = await res.text();
    const found = parseTelegram(html);
    if (found) return found;
    const ids = [...html.matchAll(/data-post="eltoquecom\/(\d+)"/g)].map((m) => Number(m[1]));
    if (!ids.length) return null;
    url = `https://t.me/s/eltoquecom?before=${Math.min(...ids)}`;
  }
  return null;
}

async function main() {
  let result = null;
  try {
    if (process.env.ELTOQUE_API_TOKEN) result = await fromApi(process.env.ELTOQUE_API_TOKEN);
  } catch (e) { console.log('API elTOque falló:', e.message); }
  if (!result) {
    try { result = await fromTelegram(); } catch (e) { console.log('Telegram falló:', e.message); }
  }
  if (!result) { console.log('No se obtuvieron tasas; no se publica rates.json'); return; }
  // Si la tasa no ha cambiado, no se reescribe el archivo (evita commits vacíos).
  try {
    const prev = JSON.parse(readFileSync(out, 'utf8'));
    if (prev.asOf === result.asOf && JSON.stringify(prev.rates) === JSON.stringify(result.rates)) {
      console.log('Las tasas no han cambiado:', JSON.stringify(result.rates));
      return;
    }
  } catch { /* no había archivo previo */ }
  result.fetchedAt = new Date().toISOString();
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log('Tasas:', JSON.stringify(result));
}

if (process.argv[1] && process.argv[1].endsWith('fetch-rates.mjs')) {
  if (process.argv[3] === '--parse') {
    console.log(JSON.stringify(parseTelegram(readFileSync(process.argv[4], 'utf8'))));
  } else {
    main();
  }
}
