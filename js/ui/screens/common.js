// 画面共通の部品
import { judge, conditionText } from '../../engine/judge.js';
import { h } from '../dom.js';
import { PHASE_LABEL, playerName, roundLabel, yen, pct } from '../format.js';
import { CONFIG } from '../../config.js';

export function topbar(app, { title = null, seat = null } = {}) {
  const st = app.state;
  const p = seat !== null && seat !== undefined ? st.players[seat] : null;
  return h('header', { class: 'topbar' },
    h('div', { class: 'topbar-main' },
      h('span', { class: 'brand' }, '魔法特許'),
      h('span', { class: 'pill' }, roundLabel(st)),
      h('span', { class: 'pill pill-phase' }, PHASE_LABEL[st.phase] ?? st.phase),
      title ? h('span', { class: 'topbar-title' }, title) : null,
    ),
    p ? h('div', { class: 'topbar-stats' },
      h('span', { class: 'stat' }, h('span', { class: 'stat-label' }, '所持金'), h('b', {}, yen(p.money))),
      st.phase === 'action' && !st.claimWindow ? h('span', { class: 'stat' }, h('span', { class: 'stat-label' }, '残りアクション'),
        h('span', { class: 'dots', 'aria-label': `${p.actionsLeft}回` },
          Array.from({ length: CONFIG.ACTIONS_PER_TURN }, (_, i) => h('span', { class: `dot${i < p.actionsLeft ? ' dot-on' : ''}` })))) : null,
      st.phase === 'action' ? h('span', { class: 'stat' }, h('span', { class: 'stat-label' }, '手番'), h('b', {}, `${Math.min(p.turnsTaken + 1, CONFIG.MAX_TURNS_PER_ROUND)}/${CONFIG.MAX_TURNS_PER_ROUND}`)) : null,
    ) : null,
    h('button', { class: 'btn btn-ghost btn-small topbar-menu', onclick: () => app.openMenu() }, 'メニュー'),
  );
}

// 指示と達成条件。preview を渡すと、実行後にどう変わるかも表示する
export function instructionCard({ puzzle, board, preview = null, text = null, indices = null, title = '指示' }) {
  const idx = indices ?? puzzle.conditions.map((_, i) => i);
  const now = judge(board, puzzle.conditions, idx);
  const after = preview ? judge(preview, puzzle.conditions, idx) : null;
  return h('section', { class: 'card instruction' },
    h('h3', {}, title),
    h('p', { class: 'instruction-text' }, text ?? puzzle.text),
    h('ul', { class: 'conds' }, idx.map((i) => {
      const c = puzzle.conditions[i];
      const ok = now.results[i];
      const next = after ? after.results[i] : ok;
      return h('li', { class: `cond${ok ? ' cond-ok' : ''}` },
        h('span', { class: 'cond-mark', 'aria-hidden': 'true' }, ok ? '✓' : '・'),
        h('span', { class: 'cond-text' }, conditionText(puzzle.board, c)),
        h('span', { class: 'cond-pts' }, `${c.points}点`),
        after && next !== ok ? h('span', { class: `cond-change ${next ? 'up' : 'down'}` }, next ? '→ 達成' : '→ 未達成') : null,
      );
    })),
    h('div', { class: 'rate' },
      h('span', {}, '達成率 '),
      h('b', {}, pct(now.rate)),
      after && after.rate !== now.rate ? h('span', { class: `rate-change ${after.rate > now.rate ? 'up' : 'down'}` }, ` → ${pct(after.rate)}`) : null,
      indices ? h('span', { class: 'muted small' }, '（見えている条件のみ）') : null,
    ),
  );
}

export function tabs(app, items) {
  const cur = items.find((i) => i.key === app.ui.tab) ?? items[0];
  return h('section', { class: 'card tabs-card' },
    h('div', { class: 'tabs', role: 'tablist' }, items.map((i) =>
      h('button', { class: `tab${i.key === cur.key ? ' tab-on' : ''}`, role: 'tab', 'aria-selected': i.key === cur.key ? 'true' : 'false', onclick: () => app.setUi({ tab: i.key }) }, i.label))),
    h('div', { class: 'tab-body' }, cur.render()),
  );
}

export function nameOf(app, seat) {
  return playerName(app.state, seat);
}
