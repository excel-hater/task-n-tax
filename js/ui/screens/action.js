// 行動画面（メイン）。NPCの手番は同じ画面を読み取り専用で表示する
import { CONFIG } from '../../config.js';
import { canDispatch, puzzleOf } from '../../engine/game.js';
import { findSimilarPatents } from '../../engine/patent.js';
import { validateMagic } from '../../engine/magic.js';
import { h } from '../dom.js';
import { renderBoard, previewBoard } from '../board.js';
import { renderMagicBuilder } from '../magicBuilder.js';
import { renderPatentList } from '../patentList.js';
import { renderLog, renderPlayers } from '../log.js';
import { playerName, pct, yen } from '../format.js';
import { topbar, instructionCard, tabs } from './common.js';

function sideTabs(app, seat, { interactive }) {
  const st = app.state;
  const puzzle = puzzleOf(st);
  const p = st.players[seat];
  return tabs(app, [
    {
      key: 'patents', label: '特許', render: () => renderPatentList({
        state: st, seat, puzzle, tab: app.ui.patentTab, onTab: (t) => app.setUi({ patentTab: t }),
        onLoad: interactive ? (pt) => app.setMagic(pt.magic) : null,
        act: (a) => app.act(a),
        allowCast: interactive && !p.answered,
        allowDiscard: interactive,
        allowPickup: interactive,
      }),
    },
    { key: 'log', label: `ログ ${st.log.length}`, render: () => renderLog(st) },
    { key: 'players', label: 'みんな', render: () => renderPlayers(st, { highlight: seat }) },
  ]);
}

function similarHint(st, seat, magic, puzzle) {
  if (!CONFIG.SHOW_SIMILARITY_BEFORE_CLAIM || validateMagic(magic, puzzle.words)) return null;
  const sims = findSimilarPatents(st, magic, { excludeOwner: seat, minSimilarity: CONFIG.SIMILARITY_THRESHOLD }).slice(0, 3);
  if (!sims.length) return null;
  return h('p', { class: 'warn small' }, '似た特許：', sims.map((x) => `${x.patent.id}（${playerName(st, x.patent.owner)}・${pct(x.similarity)}）`).join('、'));
}

export function renderAction(app, seat) {
  const st = app.state;
  const p = st.players[seat];
  const puzzle = puzzleOf(st);
  const magic = app.ui.magic;
  const answered = p.answered;
  const preview = answered ? null : previewBoard(p.board, magic, puzzle.words);

  const temp = { type: 'CAST_TEMP', seat, magic };
  const apply = { type: 'APPLY_PATENT', seat, magic };
  const applyCast = { type: 'APPLY_AND_CAST', seat, magic };
  const ans = { type: 'ANSWER', seat };
  const end = { type: 'END_TURN', seat };
  const btn = (label, a, cls = '', opts = {}) => h('button', { class: `btn ${cls}`, disabled: !canDispatch(st, a), onclick: () => app.act(a, opts) }, label);

  const buttons = answered
    ? [btn(`特許申請 ${yen(CONFIG.PATENT_COST)}`, apply, 'btn-primary', { clearMagic: true }), btn('手番終了', end)]
    : [
      btn(`一時魔法で実行 ${yen(CONFIG.CAST_COST)}`, temp, 'btn-primary'),
      btn(`特許申請 ${yen(CONFIG.PATENT_COST)}`, apply, '', { clearMagic: true }),
      btn(`申請して実行 ${yen(CONFIG.PATENT_COST + CONFIG.CAST_COST)}`, applyCast),
      h('button', { class: 'btn btn-accent', disabled: !canDispatch(st, ans), onclick: () => app.confirmAnswer(seat) }, '解答する'),
      btn('手番終了', end),
    ];

  return h('main', { class: 'screen game-screen' },
    topbar(app, { title: `${p.name}さんの手番`, seat }),
    h('div', { class: 'layout' },
      h('div', { class: 'col col-board' },
        h('section', { class: 'card board-card' },
          answered ? h('div', { class: 'banner' }, `解答済み（達成率 ${pct(p.rate)}）。盤面は固定されています。特許の操作とクレームだけできます`) : null,
          renderBoard(p.board, { magic: answered ? null : magic, allowedWords: puzzle.words }),
        ),
        instructionCard({ puzzle, board: p.board, preview }),
      ),
      h('div', { class: 'col col-panel' },
        renderMagicBuilder({ magic, words: puzzle.words, onChange: (m) => app.setMagic(m) }),
        h('section', { class: 'card actions-card' },
          similarHint(st, seat, magic, puzzle),
          h('div', { class: 'action-buttons' }, buttons),
          h('p', { class: 'muted small' }, `一時魔法は他の人の特許に似ているとクレームされることがあります。特許魔法の実行（特許一覧から）はクレームされません。`),
        ),
        sideTabs(app, seat, { interactive: true }),
      ),
    ),
  );
}

// NPCの手番を眺める画面
export function renderNpcTurn(app, seat, what = 'action') {
  const st = app.state;
  const p = st.players[seat];
  const puzzle = puzzleOf(st);
  const title = what === 'hint' ? `${p.name}（NPC）がヒントを見ています`
    : what === 'claim' ? `${p.name}（NPC）がクレームを検討中` : `${p.name}（NPC）の手番`;
  return h('main', { class: 'screen game-screen' },
    topbar(app, { title, seat }),
    h('div', { class: 'npc-bar' },
      h('span', { class: 'spinner', 'aria-hidden': 'true' }),
      h('span', {}, title),
      h('div', { class: 'npc-controls' },
        app.hasHumans() ? null : h('button', { class: 'btn btn-small', onclick: () => app.togglePause() }, app.ui.paused ? '再開' : '一時停止'),
        h('button', { class: 'btn btn-small', onclick: () => app.skipNpc() }, app.hasHumans() ? 'スキップ' : 'ラウンド終了まで'),
      ),
    ),
    what === 'hint'
      ? h('div', { class: 'layout' }, h('div', { class: 'col' }, h('section', { class: 'card' }, h('p', { class: 'muted' }, 'NPCのヒント段階の中身は全体公開まで見えません。'), renderPlayers(st, { highlight: seat }))))
      : h('div', { class: 'layout' },
        h('div', { class: 'col col-board' },
          h('section', { class: 'card board-card' }, renderBoard(p.board)),
          instructionCard({ puzzle, board: p.board, title: `${p.name}の指示の達成状況` }),
        ),
        h('div', { class: 'col col-panel' }, sideTabs(app, seat, { interactive: false })),
      ),
  );
}
