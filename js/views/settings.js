// Ajustes: hogar, miembros, sincronización con GitHub y copias de seguridad.
import { store } from '../store.js';
import { sync } from '../sync.js';
import { app } from '../app.js';
import * as D from '../domain.js';
import { esc, timeAgo, today, isIOS, fmtCur } from '../util.js';
import { openRatesSheet, openCategoriesSheet, openTagsSheet } from './money.js';
import { icon } from '../icons.js';
import { largeTitle, group, row, F, avatar, iconTile } from '../ui.js';
import { openSheet, confirmDialog, alertDialog, toast, actionSheet } from '../overlays.js';

const VERSION = '1.2';

/* ---------- Estado de sincronización ---------- */

export function syncStatusText() {
  if (!sync.configured) return 'Solo en este dispositivo';
  switch (sync.status) {
    case 'syncing': return 'Sincronizando…';
    case 'error': return sync.error || 'Error de sincronización';
    case 'offline': return 'Sin conexión: se sincronizará al volver';
    default: return sync.lastSync ? `Sincronizado ${timeAgo(sync.lastSync)}` : 'Conectado';
  }
}

export function syncIndicator() {
  if (!sync.configured) return '';
  const s = sync.status;
  const ic = s === 'error' ? 'warning' : s === 'offline' ? 'cloudOff' : s === 'syncing' ? 'sync' : 'cloudCheck';
  const cls = s === 'error' ? 'warn' : s === 'syncing' ? 'spin' : '';
  return `<button type="button" class="glass glass-btn ${cls}" data-action="sync-status" aria-label="Sincronización: ${esc(syncStatusText())}">${icon(ic)}</button>`;
}

export async function showSyncStatus() {
  if (sync.status === 'error') {
    const r = await actionSheet({ title: 'No se pudo sincronizar', message: sync.error, actions: [{ label: 'Reintentar', value: 'retry', icon: 'sync' }, { label: 'Abrir ajustes', value: 'settings', icon: 'sliders' }] });
    if (r === 'retry') sync.now();
    if (r === 'settings') app.go('settings', { top: true });
    return;
  }
  sync.now();
  toast('Sincronizando…', 'sync');
}

/* ---------- Hojas de GitHub ---------- */

const GH_NEW_REPO = 'https://github.com/new?name=hogar-datos&visibility=private';
const GH_NEW_TOKEN = 'https://github.com/settings/personal-access-tokens/new';

export function openGithubSheet(after) {
  const c = sync.cfg || { owner: '', repo: 'hogar-datos', token: '', branch: '', path: 'hogar.json' };
  const body = `<div class="explain">
      <div class="explain-icon">${icon('github')}</div>
      <p>Los datos se guardan en un <b>repositorio privado</b> de tu cuenta de GitHub. Cada dispositivo de la casa lee y escribe ese archivo.</p>
      <ol>
        <li>Crea un repositorio <b>privado</b> (p. ej. «hogar-datos»). <a href="${GH_NEW_REPO}" target="_blank" rel="noopener">Crear repositorio</a></li>
        <li>Crea un token <i>fine-grained</i>: en «Repository access» elige <b>Only select repositories</b> y ese repositorio; en «Permissions → Contents» elige <b>Read and write</b>. <a href="${GH_NEW_TOKEN}" target="_blank" rel="noopener">Crear token</a></li>
        <li>Pega aquí los datos y pulsa ✓.</li>
      </ol></div>`
    + group({
      body: F.text({ name: 'owner', label: 'Usuario', value: c.owner, placeholder: 'tu-usuario', attrs: 'autocapitalize="off" autocorrect="off" spellcheck="false"' })
        + F.text({ name: 'repo', label: 'Repositorio', value: c.repo, placeholder: 'hogar-datos', attrs: 'autocapitalize="off" autocorrect="off" spellcheck="false"' })
        + F.text({ name: 'token', label: 'Token', value: c.token, type: 'password', placeholder: 'github_pat_…', attrs: 'autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off"' }),
      footer: 'El token solo se guarda en este dispositivo y en los que invites. No lo publiques en ningún sitio.',
    })
    + group({
      header: 'Avanzado',
      body: F.text({ name: 'branch', label: 'Rama', value: c.branch, placeholder: 'la principal', attrs: 'autocapitalize="off" autocorrect="off"' })
        + F.text({ name: 'path', label: 'Archivo', value: c.path, placeholder: 'hogar.json', attrs: 'autocapitalize="off" autocorrect="off"' }),
    });
  openSheet({
    title: 'Sincronizar con GitHub',
    body,
    doneLabel: 'Conectar',
    async onDone(v) {
      await sync.connect(v);
      toast('Conectado con GitHub', 'cloudCheck');
      after?.();
    },
  });
}

export function openJoinSheet(code = '', after) {
  const body = `<div class="explain"><div class="explain-icon">${icon('link')}</div>
      <p>En un dispositivo que ya use la app, ve a <b>Ajustes → Invitar a la casa</b> y copia el código. Pégalo aquí.</p></div>`
    + group({ body: F.area({ name: 'code', value: code, placeholder: 'Pega aquí el código o el enlace', rows: 4 }) });
  openSheet({
    title: 'Unirse a una casa',
    body,
    require: 'code',
    doneLabel: 'Unirse',
    async onDone(v) {
      const cfg = sync.decodeCode(v.code);
      await sync.connect(cfg);
      toast('Te has unido a la casa', 'house');
      after?.();
    },
  });
}

export function openShareSheet() {
  const code = sync.shareCode();
  const link = `${location.origin}${location.pathname}#join=${code}`;
  const body = `<div class="explain"><div class="explain-icon">${icon('people')}</div>
      <p>Envía este código a las personas de tu casa. En su iPhone deben abrir la app, elegir <b>Unirme a una casa existente</b> y pegarlo.</p></div>`
    + group({ body: `<div class="code-box" data-action="copy">${esc(code)}</div>` })
    + `<div class="btn-stack">
        <button type="button" class="btn-prominent" data-action="share">${icon('share')} Compartir…</button>
        <button type="button" class="btn-tinted wide" data-action="copy">${icon('copy')} Copiar código</button></div>`
    + '<p class="footnote warn">El código incluye el token de acceso a los datos de la casa. Compártelo solo por un canal privado con quien viva contigo.</p>';
  openSheet({
    title: 'Invitar a la casa',
    body,
    actions: {
      async copy() {
        try { await navigator.clipboard.writeText(code); toast('Código copiado', 'copy'); } catch { alertDialog('No se pudo copiar', 'Mantén pulsado el código para copiarlo.'); }
      },
      async share() {
        const text = `Únete a «${store.data.settings.name || 'nuestra casa'}» en la app Hogar.\n\n1. Abre ${location.origin}${location.pathname} y añádela a la pantalla de inicio.\n2. Elige «Unirme a una casa existente» y pega este código:\n\n${code}\n\n(o abre: ${link})`;
        if (navigator.share) {
          try { await navigator.share({ title: 'Únete a la casa', text }); } catch { /* cancelado */ }
        } else {
          try { await navigator.clipboard.writeText(text); toast('Invitación copiada', 'copy'); } catch { /* sin portapapeles */ }
        }
      },
    },
  });
}

/** Pregunta quién usa este dispositivo. */
export function openWhoSheet(after) {
  const ms = D.members();
  const body = `<p class="lead-text">Elige tu nombre para que la app sepa quién compra, paga o completa cada cosa desde este dispositivo.</p>`
    + group({ body: ms.map((m) => row({ lead: avatar(m), title: esc(m.name), action: 'pick', id: m.id, trail: store.meta.me === m.id ? icon('check', 'tint') : '' })).join('') })
    + group({ body: F.text({ name: 'newName', placeholder: 'No estoy en la lista: escribe tu nombre', attrs: 'autocapitalize="words" autocomplete="given-name"' }) });
  openSheet({
    title: '¿Quién eres?',
    body,
    onDone(v) {
      if (v.newName.trim()) {
        const m = D.saveMember({ name: v.newName });
        store.setMeta({ me: m.id, onboarded: true });
      } else if (!store.meta.me && ms.length) {
        return false;
      }
      after?.();
    },
    actions: {
      pick(el, api) {
        store.setMeta({ me: el.dataset.id, onboarded: true });
        api.close();
        after?.();
      },
    },
  });
}

/* ---------- Otras hojas ---------- */

function openHouseSheet() {
  const s = store.data.settings;
  openSheet({
    title: 'Casa',
    body: group({
      body: F.text({ name: 'name', label: 'Nombre', value: s.name, placeholder: 'Mi casa', attrs: 'autocapitalize="sentences"' }),
    }),
    require: 'name',
    onDone(v) { store.setSettings({ name: v.name.trim() }); },
  });
}

function openMemberSheet(id) {
  const prev = id ? D.member(id) : null;
  const m = prev || { name: '', color: D.nextColor() };
  const isMe = prev && store.meta.me === prev.id;
  openSheet({
    title: prev ? m.name : 'Nuevo miembro',
    body: `<div class="hero-tile" id="m-preview">${avatar(m, 'xl')}</div>`
      + group({ body: F.text({ name: 'name', value: m.name, placeholder: 'Nombre', attrs: `autocapitalize="words"${prev ? '' : ' autofocus'}` }) })
      + group({ header: 'Color', body: `<div class="pad">${F.picker({ name: 'color', value: m.color, options: D.COLORS.filter((c) => c !== 'gray') })}</div>` })
      + (prev && !isMe ? group({ body: F.button({ label: 'Soy yo (usar este dispositivo como ' + esc(m.name) + ')', action: 'me' }) }) : '')
      + (prev ? group({ body: F.button({ label: 'Eliminar miembro', action: 'delete', cls: 'destructive' }), footer: 'Sus tareas quedarán sin asignar.' }) : ''),
    require: 'name',
    onMount(api) {
      const prevEl = api.body.querySelector('#m-preview');
      const upd = () => { const v = api.values(); prevEl.innerHTML = avatar({ name: v.name || '?', color: v.color }, 'xl'); };
      api.body.addEventListener('input', upd);
      api.body.addEventListener('change', upd);
    },
    onDone(v) { D.saveMember({ ...m, name: v.name, color: v.color }); },
    actions: {
      me(el, api) { store.setMeta({ me: m.id }); api.close(); toast(`Ahora eres ${m.name} en este dispositivo`, 'person'); },
      async delete(el, api) {
        if (await confirmDialog({ title: `¿Eliminar a ${m.name}?`, message: 'Se quitará de la casa en todos los dispositivos.' })) {
          D.removeMember(m.id);
          api.close();
        }
      },
    },
  });
}

export function openInstallSheet() {
  const step = (n, text, ic) => row({ lead: `<span class="step-num">${n}</span>`, title: text, trail: ic ? `<span class="tint">${icon(ic)}</span>` : '' });
  openSheet({
    title: 'Instalar en el iPhone',
    body: `<div class="explain"><div class="explain-icon">${icon('phone')}</div><p>Instala Hogar en la pantalla de inicio para usarla como una app más: a pantalla completa y sin conexión.</p></div>`
      + group({
        body: step(1, 'Abre esta página en <b>Safari</b>')
          + step(2, 'Pulsa el botón <b>Compartir</b>', 'share')
          + step(3, 'Elige <b>Añadir a pantalla de inicio</b>', 'plus')
          + step(4, 'Activa <b>Abrir como app web</b> y pulsa <b>Añadir</b>'),
      }),
  });
}

function exportData() {
  const json = JSON.stringify(store.exportData(), null, 1);
  const name = `hogar-${today()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file], title: 'Copia de Hogar' }).catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ---------- Vista ---------- */

export default {
  id: 'settings',
  title: () => 'Ajustes',
  render() {
    const s = store.data.settings;
    const ms = D.members();
    const me = D.meId();
    const st = sync.status;
    const syncColor = !sync.configured ? 'gray' : st === 'error' ? 'orange' : st === 'offline' ? 'gray' : 'green';

    const head = `<div class="group"><div class="list">${row({
      lead: '<img class="house-icon" src="icons/icon-180.png" alt="">',
      title: `<span class="big-name">${esc(s.name || 'Mi casa')}</span>`,
      sub: `${ms.length} ${ms.length === 1 ? 'miembro' : 'miembros'}<span class="dot">·</span>Moneda principal: CUP`,
      action: 'house', chevron: true, cls: 'profile',
    })}</div></div>`;

    const membersGroup = group({
      header: 'Miembros de la casa',
      body: ms.map((m) => row({ lead: avatar(m), title: esc(m.name) + (m.id === me ? ' <span class="muted">(yo)</span>' : ''), action: 'member', id: m.id, chevron: true })).join('')
        + row({ lead: `<span class="add-circle">${icon('plus')}</span>`, title: '<span class="tint">Añadir miembro</span>', action: 'add-member' }),
      footer: 'Este dispositivo pertenece a ' + (me ? `<b>${esc(D.memberName(me))}</b>` : 'nadie todavía') + '. <a href="#" data-action="who">Cambiar</a>',
    });

    const syncGroup = sync.configured
      ? group({
        header: 'Sincronización',
        body: row({ lead: iconTile(st === 'error' ? 'warning' : 'cloud', syncColor), title: `GitHub · ${esc(sync.cfg.owner)}/${esc(sync.cfg.repo)}`, sub: `<span class="${st === 'error' ? 'c-text-red' : ''}">${esc(syncStatusText())}</span>` })
          + row({ lead: iconTile('sync', 'blue'), title: 'Sincronizar ahora', action: 'sync-now' })
          + row({ lead: iconTile('people', 'indigo'), title: 'Invitar a la casa', sub: 'Comparte el acceso con otros dispositivos', action: 'share', chevron: true })
          + row({ lead: iconTile('key', 'gray'), title: 'Cambiar repositorio o token', action: 'github', chevron: true })
          + row({ lead: iconTile('cloudOff', 'red'), title: '<span class="c-text-red">Desconectar este dispositivo</span>', action: 'disconnect' }),
        footer: 'Los cambios se envían al momento y se comprueban cada 20 segundos mientras la app está abierta.',
      })
      : group({
        header: 'Sincronización',
        body: row({ lead: iconTile('cloudOff', 'gray'), title: 'Sin sincronizar', sub: 'Los datos solo están en este dispositivo' })
          + row({ lead: iconTile('github', 'blue'), title: 'Configurar con GitHub', action: 'github', chevron: true })
          + row({ lead: iconTile('link', 'indigo'), title: 'Unirse con un código', action: 'join', chevron: true }),
        footer: 'Conecta la app a un repositorio privado de GitHub para compartir los datos entre los dispositivos de la casa.',
      });

    const usd = D.rateOf('USD');
    const financeGroup = group({
      header: 'Finanzas',
      body: row({ lead: iconTile('exchange', 'orange'), title: 'Tasas de cambio', trail: usd ? esc(`1 USD = ${fmtCur(usd)}`) : 'Sin fijar', action: 'rates', chevron: true })
        + row({ lead: iconTile('tray', 'purple'), title: 'Categorías de gasto', trail: String(D.categories().length), action: 'categories', chevron: true })
        + row({ lead: iconTile('tag', 'pink'), title: 'Etiquetas', trail: String(D.tags().length), action: 'tags', chevron: true }),
    });

    const dataGroup = group({
      header: 'Datos',
      body: row({ lead: iconTile('download', 'teal'), title: 'Exportar copia de seguridad', action: 'export' })
        + `<label class="row tappable" role="button"><div class="row-lead">${iconTile('upload', 'teal')}</div><div class="row-body"><div class="row-main"><div class="row-title">Importar copia</div></div></div><input type="file" accept="application/json,.json" name="import" hidden></label>`
        + row({ lead: iconTile('trash', 'red'), title: '<span class="c-text-red">Borrar datos de este dispositivo</span>', action: 'wipe' }),
    });

    const help = group({
      body: (isIOS ? row({ lead: iconTile('phone', 'gray'), title: 'Instalar en el iPhone', action: 'install', chevron: true }) : '')
        + row({ lead: iconTile('info', 'gray'), title: 'Versión', trail: VERSION }),
    });

    return largeTitle('Ajustes') + head + membersGroup + financeGroup + syncGroup + dataGroup + help;
  },
  actions: {
    house: openHouseSheet,
    member: (el) => openMemberSheet(el.dataset.id),
    'add-member': () => openMemberSheet(null),
    who: () => openWhoSheet(),
    github: () => openGithubSheet(),
    join: () => openJoinSheet('', () => { if (!D.meId()) openWhoSheet(); }),
    share: openShareSheet,
    async disconnect() {
      if (await confirmDialog({ title: '¿Desconectar este dispositivo?', message: 'Los datos se quedarán en el dispositivo, pero dejarán de sincronizarse.', confirm: 'Desconectar' })) sync.disconnect();
    },
    export: exportData,
    rates: openRatesSheet,
    categories: openCategoriesSheet,
    tags: openTagsSheet,
    install: openInstallSheet,
    async wipe() {
      if (await confirmDialog({ title: '¿Borrar los datos de este dispositivo?', message: sync.configured ? 'Se desconectará de la sincronización. Los datos en GitHub no se borran.' : 'Esta acción no se puede deshacer. Exporta antes una copia si la necesitas.', confirm: 'Borrar' })) {
        sync.disconnect();
        store.reset();
        location.hash = '';
        location.reload();
      }
    },
  },
  async onChange(e) {
    if (e.target.name !== 'import' || !e.target.files[0]) return;
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!data || typeof data !== 'object' || !data.settings) throw new Error('El archivo no es una copia de Hogar.');
      store.importData(data);
      toast('Copia importada', 'download');
    } catch (err) {
      alertDialog('No se pudo importar', err.message);
    }
    e.target.value = '';
  },
};
