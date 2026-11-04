// Tareas del hogar: pendientes por fecha, responsables y repeticiones.
import { store } from '../store.js';
import { app } from '../app.js';
import * as D from '../domain.js';
import { esc, fmtDay, today, addDays, timeAgo } from '../util.js';
import { icon } from '../icons.js';
import { largeTitle, group, row, check, segmented, empty, glassBtn, F, avatar, iconTile } from '../ui.js';
import { openSheet, confirmDialog, toast } from '../overlays.js';

const state = { seg: 'pending', who: 'all', quick: '' };

export function openTaskSheet(id, defaults = {}) {
  const prev = id ? store.get('tasks', id) : null;
  const t = prev || { title: '', notes: '', assignee: D.meId(), due: today(), repeat: 'none', rotate: false, done: false, ...defaults };
  const ms = D.members();
  const body =
    group({
      body: F.text({ name: 'title', value: t.title, placeholder: 'Título (p. ej. Sacar la basura)', attrs: `autocapitalize="sentences" autocomplete="off"${prev ? '' : ' autofocus'}` })
        + F.area({ name: 'notes', value: t.notes, placeholder: 'Notas', rows: 2 }),
    })
    + group({
      body: F.select({ name: 'assignee', label: 'Responsable', value: t.assignee || '', lead: iconTile('person', 'blue'), options: [['', 'Sin asignar'], ...ms.map((m) => [m.id, m.name])] }),
    })
    + group({
      body: F.date({ name: 'due', label: 'Fecha', value: t.due || '', lead: iconTile('calendar', 'red') })
        + F.select({ name: 'repeat', label: 'Repetir', value: t.repeat || 'none', lead: iconTile('repeat', 'gray'), options: D.REPEATS })
        + F.toggle({ name: 'rotate', label: 'Turnarse entre todos', checked: !!t.rotate, lead: iconTile('people', 'orange') }),
      footer: 'Las tareas que se repiten se reprograman solas al completarlas. Con «Turnarse», pasan al siguiente miembro de la casa.',
    })
    + (prev ? group({ body: F.button({ label: 'Eliminar tarea', action: 'delete', cls: 'destructive' }) }) : '');

  openSheet({
    title: prev ? 'Tarea' : 'Nueva tarea',
    body,
    require: 'title',
    onDone(v) {
      D.saveTask({ ...t, title: v.title.trim(), notes: v.notes.trim(), assignee: v.assignee || null, due: v.due || null, repeat: v.repeat, rotate: v.rotate });
    },
    actions: {
      async delete(el, api) {
        if (await confirmDialog({ title: `¿Eliminar «${t.title}»?` })) {
          store.remove('tasks', t.id);
          api.close();
        }
      },
    },
  });
}

export function taskRow(t) {
  const m = D.member(t.assignee);
  const sub = [];
  sub.push(m ? `<span class="who">${avatar(m, 'xs')}${esc(m.name)}</span>` : '<span class="muted">Sin asignar</span>');
  if (t.due) sub.push(`<span class="${t.due < today() ? 'overdue' : ''}">${esc(fmtDay(t.due))}</span>`);
  if (t.repeat && t.repeat !== 'none') sub.push(`<span class="rep">${icon('repeat')}${esc(D.repeatLabel(t.repeat))}</span>`);
  return row({
    lead: check({ action: 'complete-task', id: t.id, color: m?.color || 'blue', label: `Completar ${t.title}` }),
    title: esc(t.title) + (t.notes ? `<div class="row-note">${esc(t.notes.split('\n')[0])}</div>` : ''),
    sub: sub.join('<span class="dot">·</span>'),
    action: 'open-task', id: t.id,
  });
}

export function completeWithFeedback(el) {
  const t = store.get('tasks', el.dataset.id);
  if (!t) return;
  el.classList.add('on');
  el.closest('.row')?.classList.add('leaving');
  setTimeout(() => {
    const r = D.completeTask(t.id);
    if (r?.repeat) {
      const who = r.assignee ? ` · le toca a ${D.memberName(r.assignee)}` : '';
      toast(`Hecho. Próxima: ${fmtDay(r.next).toLowerCase()}${who}`, 'repeat');
    } else toast('Tarea completada');
  }, 420);
}

const filterFn = () => {
  if (state.who === 'all') return () => true;
  if (state.who === 'none') return (t) => !t.assignee;
  return (t) => t.assignee === state.who;
};

function pendingView() {
  const all = D.sortTasks(D.pendingTasks().filter(filterFn()));
  const quick = `<div class="group quick-group"><div class="list"><div class="row quick">
      <div class="row-lead"><span class="quick-plus">${icon('plus')}</span></div>
      <div class="row-body"><input name="quick-task" class="field-input" placeholder="Nueva tarea para hoy" enterkeyhint="done" autocomplete="off" autocapitalize="sentences" value="${esc(state.quick)}"></div>
    </div></div></div>`;
  if (!all.length) {
    return quick + empty({ icon: 'checklist', title: 'Todo hecho', text: state.who === 'all' ? 'No hay tareas pendientes. Añade una con el botón +.' : 'No hay tareas pendientes con este filtro.' });
  }
  const t0 = today();
  const week = addDays(t0, 7);
  const buckets = [
    ['Atrasadas', (t) => t.due && t.due < t0, 'red'],
    ['Hoy', (t) => t.due === t0],
    ['Mañana', (t) => t.due === addDays(t0, 1)],
    ['Próximos 7 días', (t) => t.due > addDays(t0, 1) && t.due <= week],
    ['Más adelante', (t) => t.due > week],
    ['Sin fecha', (t) => !t.due],
  ];
  return quick + buckets.map(([name, fn, color]) => {
    const arr = all.filter(fn);
    if (!arr.length) return '';
    return group({ header: color ? `<span class="c-text-${color}">${name}</span>` : name, body: arr.map(taskRow).join('') });
  }).join('');
}

function doneView() {
  const done = D.tasks().filter((t) => t.done).filter(filterFn()).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const recurring = D.tasks().filter((t) => !t.done && t.lastDoneAt).filter(filterFn()).sort((a, b) => b.lastDoneAt - a.lastDoneAt).slice(0, 10);
  if (!done.length && !recurring.length) return empty({ icon: 'checklist', title: 'Nada completado aún', text: 'Las tareas que completéis aparecerán aquí.' });
  return (done.length ? group({
    header: 'Completadas',
    body: done.map((t) => row({
      lead: check({ on: true, action: 'undo-task', id: t.id, color: D.member(t.doneBy)?.color || 'gray', label: 'Marcar como pendiente' }),
      title: `<span class="struck">${esc(t.title)}</span>`,
      sub: `${esc(D.memberName(t.doneBy))}<span class="dot">·</span>${esc(timeAgo(t.doneAt))}`,
      action: 'open-task', id: t.id,
    })).join(''),
  }) : '')
    + (recurring.length ? group({
      header: 'Recurrentes hechas recientemente',
      body: recurring.map((t) => row({
        lead: `<span class="itile c-gray">${icon('repeat')}</span>`,
        title: esc(t.title),
        sub: `${esc(D.memberName(t.lastDoneBy))}<span class="dot">·</span>${esc(timeAgo(t.lastDoneAt))}`,
        action: 'open-task', id: t.id,
      })).join(''),
    }) : '')
    + (done.length ? `<div class="center"><button type="button" class="btn-plain destructive" data-action="clear-done">Eliminar completadas</button></div>` : '');
}

export default {
  id: 'tasks',
  title: () => 'Tareas',
  badge: () => D.pendingTasks().filter((t) => t.due && t.due <= today()).length,
  navRight: () => glassBtn('plus', 'new-task', 'Nueva tarea'),
  onShow(opts) { if (opts.seg) state.seg = opts.seg; if (opts.who) state.who = opts.who; },
  render() {
    const ms = D.members();
    if (state.who !== 'all' && state.who !== 'none' && !D.member(state.who)) state.who = 'all';
    const me = D.meId();
    const ordered = me ? [D.member(me), ...ms.filter((m) => m.id !== me)] : ms;
    const chips = ms.length ? `<div class="chips">${[
      `<button type="button" class="chip ${state.who === 'all' ? 'on' : ''}" data-action="who" data-value="all">Todas</button>`,
      ...ordered.map((m) => `<button type="button" class="chip ${state.who === m.id ? 'on' : ''}" data-action="who" data-value="${m.id}">${avatar(m, 'xs')}${esc(m.id === me ? `${m.name} (yo)` : m.name)}</button>`),
      `<button type="button" class="chip ${state.who === 'none' ? 'on' : ''}" data-action="who" data-value="none">Sin asignar</button>`,
    ].join('')}</div>` : '';
    return largeTitle('Tareas')
      + segmented('seg', [['pending', 'Pendientes'], ['done', 'Hechas']], state.seg)
      + chips
      + (state.seg === 'done' ? doneView() : pendingView());
  },
  actions: {
    seg(el) { state.seg = el.dataset.value; app.render(); },
    who(el) { state.who = el.dataset.value; app.render(); },
    'new-task': () => openTaskSheet(null, state.who !== 'all' && state.who !== 'none' ? { assignee: state.who } : {}),
    'open-task': (el) => openTaskSheet(el.dataset.id),
    'complete-task': completeWithFeedback,
    'undo-task'(el) { D.uncompleteTask(el.dataset.id); },
    async 'clear-done'() {
      if (await confirmDialog({ title: '¿Eliminar las tareas completadas?', message: 'Las tareas recurrentes no se verán afectadas.' })) D.clearDoneTasks();
    },
  },
  onInput(e) { if (e.target.name === 'quick-task') state.quick = e.target.value; },
  onKeydown(e) {
    if (e.target.name !== 'quick-task' || e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    const v = e.target.value.trim();
    if (!v) { e.target.blur(); return; }
    state.quick = '';
    const assignee = state.who !== 'all' && state.who !== 'none' ? state.who : state.who === 'none' ? null : D.meId();
    D.saveTask({ title: v, notes: '', assignee, due: today(), repeat: 'none', rotate: false, done: false });
  },
};
