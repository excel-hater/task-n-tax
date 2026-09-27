// ログと全員の状況
import { CONFIG } from '../config.js';
import { ownedPatents } from '../engine/patent.js';
import { h } from './dom.js';
import { logText, playerName, pct, yen } from './format.js';

export function renderLog(state) {
  const entries = state.log.slice().reverse();
  if (!entries.length) return h('p', { class: 'muted empty' }, 'まだ何も起きていません');
  return h('ol', { class: 'log' }, entries.map((e) =>
    h('li', { class: `log-item log-${e.type}${e.type === 'claim' ? (e.success ? ' log-ok' : ' log-ng') : ''}` }, logText(state, e)),
  ));
}

export function renderPlayers(state, { highlight = null } = {}) {
  return h('table', { class: 'players' },
    h('thead', {}, h('tr', {}, h('th', {}, 'プレイヤー'), h('th', {}, '所持金'), h('th', {}, '達成率'), h('th', {}, '手番'), h('th', {}, '特許'))),
    h('tbody', {}, state.players.map((p) => h('tr', { class: p.id === highlight ? 'row-on' : '' },
      h('td', {}, playerName(state, p.id), p.answered ? h('span', { class: 'badge' }, `解答済 ${p.answerRank}番`) : null),
      h('td', { class: 'num' }, yen(p.money)),
      h('td', { class: 'num' }, state.phase === 'hint' ? '−' : pct(p.rate)),
      h('td', { class: 'num' }, `${p.turnsTaken}/${CONFIG.MAX_TURNS_PER_ROUND}`),
      h('td', { class: 'num' }, `${ownedPatents(state, p.id).length}`),
    ))),
  );
}
