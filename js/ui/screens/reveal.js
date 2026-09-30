// 全体公開画面
import { puzzleOf } from '../../engine/game.js';
import { isUsable } from '../../engine/patent.js';
import { magicText } from '../../engine/magic.js';
import { h } from '../dom.js';
import { renderBoard } from '../board.js';
import { playerName } from '../format.js';
import { topbar, instructionCard } from './common.js';

export function renderReveal(app) {
  const st = app.state;
  const puzzle = puzzleOf(st);
  const owned = Object.values(st.patents).filter((p) => p.owner !== null);
  const invalid = owned.filter((p) => !isUsable(p, puzzle));
  const byPlayer = st.players.map((pl) => ({ pl, list: owned.filter((p) => p.owner === pl.id) }));

  return h('main', { class: 'screen game-screen' },
    topbar(app, { title: `「${puzzle.title}」全体公開` }),
    h('div', { class: 'layout' },
      h('div', { class: 'col col-board' },
        h('section', { class: 'card board-card' }, renderBoard(puzzle.board)),
        instructionCard({ puzzle, board: puzzle.board }),
      ),
      h('div', { class: 'col col-panel' },
        h('section', { class: 'card' },
          h('h3', {}, '全員の特許'),
          invalid.length ? h('p', { class: 'warn' }, `この問題では使えない単語を含む特許があります：${invalid.map((p) => p.id).join('、')}（実行はできませんが、クレームには使えます）`) : null,
          byPlayer.map(({ pl, list }) => h('div', { class: 'reveal-player' },
            h('h4', {}, playerName(st, pl.id)),
            list.length
              ? h('ul', { class: 'patents compact' }, list.map((p) => h('li', { class: `patent${isUsable(p, puzzle) ? '' : ' patent-unusable'}` },
                h('span', { class: 'patent-id' }, p.id), ' ', h('span', { class: 'patent-magic' }, magicText(p.magic)),
                p.createdRound === st.round && p.origin === 'hint' ? h('span', { class: 'badge badge-new' }, '先行') : null)))
              : h('p', { class: 'muted small' }, '特許なし'),
          )),
        ),
        h('div', { class: 'row-actions' },
          app.hasHumans()
            ? h('button', { class: 'btn btn-primary btn-large', onclick: () => app.act({ type: 'START_ACTION' }) }, '行動段階へ')
            : h('p', { class: 'muted' }, 'まもなく行動段階へ進みます…'),
        ),
      ),
    ),
  );
}
