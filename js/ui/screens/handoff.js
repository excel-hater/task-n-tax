// 受け渡し画面
import { h } from '../dom.js';
import { roundLabel } from '../format.js';

const REASON = {
  hint: 'ヒントを見て、先行特許を決める番です',
  action: '行動の番です',
  claim: 'クレームするか決める番です',
};

export function renderHandoff(app, seat, reason) {
  const name = app.state.players[seat].name;
  return h('main', { class: 'screen handoff-screen' },
    h('div', { class: 'handoff-card' },
      h('p', { class: 'muted' }, roundLabel(app.state)),
      h('h2', {}, `${name}さんに端末を渡してください`),
      h('p', {}, REASON[reason] ?? ''),
      h('p', { class: 'muted small' }, '他の人は画面を見ないでください'),
      h('button', { class: 'btn btn-primary btn-large', onclick: () => app.setUi({ viewer: seat }) }, `${name}です。はじめる`),
    ),
  );
}
