// ヒント画面：一部の盤面と伏せ字の指示を見て、先行特許を決める
import { CONFIG } from '../../config.js';
import { canDispatch, hintBoard, puzzleOf } from '../../engine/game.js';
import { h } from '../dom.js';
import { renderBoard, previewBoard } from '../board.js';
import { renderMagicBuilder } from '../magicBuilder.js';
import { renderPatentList } from '../patentList.js';
import { renderPlayers } from '../log.js';
import { topbar, instructionCard, tabs } from './common.js';

export function renderHint(app, seat) {
  const st = app.state;
  const p = st.players[seat];
  const puzzle = puzzleOf(st);
  const board = hintBoard(puzzle);
  const magic = app.ui.magic;
  const preview = previewBoard(board, magic, puzzle.words);
  const left = CONFIG.PREPATENT_FREE_MAX - p.prepatentsUsed;
  const pre = { type: 'PREPATENT', seat, magic };

  return h('main', { class: 'screen game-screen' },
    topbar(app, { title: `${p.name}さんのヒント`, seat }),
    h('div', { class: 'layout' },
      h('div', { class: 'col col-board' },
        h('section', { class: 'card board-card' }, renderBoard(board, { magic, allowedWords: puzzle.words, hint: true })),
        instructionCard({ puzzle, board, preview, text: puzzle.hint.text, indices: puzzle.hint.conditions, title: '指示（一部）' }),
      ),
      h('div', { class: 'col col-panel' },
        renderMagicBuilder({ magic, words: puzzle.words, onChange: (m) => app.setMagic(m) }),
        h('section', { class: 'card actions-card' },
          h('p', { class: 'muted small' }, `全体を予想して、魔法を${CONFIG.PREPATENT_FREE_MAX}つまで無料で特許にできます（残り${left}）。全体公開まで他の人には見えません。`),
          h('div', { class: 'action-buttons' },
            h('button', { class: 'btn btn-primary', disabled: !canDispatch(st, pre), onclick: () => app.act(pre, { clearMagic: true }) }, `先行特許にする（無料・残り${left}）`),
            h('button', { class: 'btn', onclick: () => app.act({ type: 'END_HINT', seat }) }, 'ヒントを終える'),
          ),
        ),
        tabs(app, [
          { key: 'patents', label: '特許', render: () => renderPatentList({ state: st, seat, puzzle, tab: app.ui.patentTab, onTab: (t) => app.setUi({ patentTab: t }), onLoad: (pt) => app.setMagic(pt.magic), act: (a) => app.act(a), allowDiscard: true }) },
          { key: 'players', label: 'みんな', render: () => renderPlayers(st, { highlight: seat }) },
        ]),
      ),
    ),
  );
}
