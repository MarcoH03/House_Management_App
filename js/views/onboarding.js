// Bienvenida: crear una casa nueva o unirse a una existente.
import { store } from '../store.js';
import { app } from '../app.js';
import * as D from '../domain.js';
import { icon } from '../icons.js';
import { group, F } from '../ui.js';
import { alertDialog } from '../overlays.js';
import { openJoinSheet, openWhoSheet } from './settings.js';

const state = { step: 'welcome', house: '', me: '', others: [''], currency: 'EUR', joinCode: '' };

const feature = (ic, color, title, text) =>
  `<div class="feature"><span class="feature-icon c-${color}">${icon(ic)}</span><div><div class="feature-title">${title}</div><div class="feature-text">${text}</div></div></div>`;

export default {
  id: 'onboarding',
  title: () => '',
  setJoinCode(code) { state.joinCode = code; },
  render() {
    if (state.step === 'create') {
      return `<div class="onb onb-form">
        <button type="button" class="glass glass-btn back" data-action="back" aria-label="Atrás">${icon('chevronLeft')}</button>
        <h1 class="large-title">Tu casa</h1>
        <p class="lead-text">Podrás cambiar todo esto más adelante en Ajustes.</p>
        ${group({ body: F.text({ name: 'house', label: 'Nombre', value: state.house, placeholder: 'Casa', attrs: 'autocapitalize="sentences"' }) })}
        ${group({ header: 'Tu nombre', body: F.text({ name: 'me', value: state.me, placeholder: 'Tu nombre', attrs: 'autocapitalize="words" autocomplete="given-name"' }) })}
        ${group({
          header: 'Quién más vive contigo',
          body: state.others.map((n, i) => F.text({ name: `other-${i}`, value: n, placeholder: `Persona ${i + 2}`, attrs: 'autocapitalize="words"' })).join('')
            + `<div class="row tappable" data-action="more" role="button"><div class="row-lead"><span class="add-circle">${icon('plus')}</span></div><div class="row-body"><span class="tint">Añadir otra persona</span></div></div>`,
          footer: 'Servirá para asignar tareas y saber quién ha comprado o pagado cada cosa.',
        })}
        <div class="onb-actions"><button type="button" class="btn-prominent" data-action="create">Empezar</button></div>
      </div>`;
    }
    return `<div class="onb">
      <div class="onb-hero"><img class="onb-icon" src="icons/icon-180.png" alt=""><h1>Te damos la bienvenida a Hogar</h1></div>
      <div class="features">
        ${feature('cart', 'blue', 'Compras y despensa', 'Una lista de la compra compartida y lo que queda de cada cosa en casa.')}
        ${feature('checklist', 'orange', 'Tareas del hogar', 'Reparte las tareas, asígnalas y turnaos las que se repiten.')}
        ${feature('wallet', 'green', 'Presupuesto', 'Cuentas en CUP, USD y otras monedas, con las tasas de elTOque.')}
        ${feature('sync', 'indigo', 'Sincronizado', 'Todos los dispositivos de la casa ven la misma información.')}
      </div>
      <div class="onb-actions">
        <button type="button" class="btn-prominent" data-action="start-create">Crear mi casa</button>
        <button type="button" class="btn-plain" data-action="start-join">Unirme a una casa existente</button>
      </div></div>`;
  },
  actions: {
    'start-create'() { state.step = 'create'; app.render(); window.scrollTo(0, 0); },
    back() { state.step = 'welcome'; app.render(); },
    more() {
      state.others.push('');
      app.render();
      app.viewEl.querySelector(`[name="other-${state.others.length - 1}"]`)?.focus();
    },
    'start-join'() {
      openJoinSheet(state.joinCode, () => {
        if (!store.data.settings.name && !D.members().length) {
          alertDialog('La casa está vacía', 'Se ha conectado correctamente, pero aún no hay datos. Crea la casa desde este dispositivo.');
          state.step = 'create';
          app.render();
          return;
        }
        openWhoSheet();
      });
    },
    create() {
      if (!state.me.trim()) {
        alertDialog('Falta tu nombre', 'Escribe tu nombre para continuar.');
        return;
      }
      D.createHousehold({ name: state.house, myName: state.me, others: state.others });
      app.go('home', { top: true });
    },
  },
  onInput(e) {
    const n = e.target.name;
    if (n === 'house' || n === 'me') state[n] = e.target.value;
    else if (n?.startsWith('other-')) state.others[Number(n.slice(6))] = e.target.value;
  },
};

