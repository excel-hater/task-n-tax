// クレーム受付（割り込み）
import { CONFIG } from '../../config.js';
import { canDispatch, puzzleOf } from '../../engine/game.js';
import { ownedPatents } from '../../engine/patent.js';
import { magicText } from '../../engine/magic.js';
import { similarity } from '../../engine/similarity.js';
import { h } from '../dom.js';
import { renderBoard } from '../board.js';
import { playerName, pct, yen } from '../format.js';
import { topbar } from './common.js';

export function renderClaim(app, seat) {
  const st = app.state;
  const w = st.claimWindow;
  const entry = st.log.find((e) => e.id === w.logId);
  const caster = st.players[w.casterSeat];
  const mine = ownedPatents(st, seat);
  const me = st.players[seat];
  const puzzle = puzzleOf(st);

  return h('main', { class: 'screen game-screen' },
    topbar(app, { title: 'クレーム受付', seat }),
    h('div', { class: 'claim-wrap' },
      h('section', { class: 'card claim-card' },
        h('h2', {}, `${me.name}さん、クレームしますか？`),
        h('p', {}, `${playerName(st, w.casterSeat)} が一時魔法を実行しました：`),
        h('p', { class: 'claim-magic' }, magicText(entry.magic)),
        h('p', { class: 'muted small' },
          `クレーム費用 ${yen(CONFIG.CLAIM_COST)}（銀行へ）。類似度 ${pct(CONFIG.SIMILARITY_THRESHOLD)} 以上で成立し、${caster.name}から ${CONFIG.CLAIM_PAYOUT_BASE}×類似度 G を受け取ります。不成立なら慰謝料 ${yen(CONFIG.CLAIM_FAIL_COMPENSATION)} を払います。`,
          CONFIG.SHOW_SIMILARITY_BEFORE_CLAIM ? '' : '類似度は請求したあとに分かります。'),
        h('ul', { class: 'patents' }, mine.map((p) => {
          const a = { type: 'CLAIM', seat, patentId: p.id };
          return h('li', { class: 'patent' },
            h('div', { class: 'patent-head' }, h('span', { class: 'patent-id' }, p.id), h('span', { class: 'patent-magic' }, magicText(p.magic))),
            CONFIG.SHOW_SIMILARITY_BEFORE_CLAIM ? h('div', { class: 'patent-meta' }, `類似度 ${pct(similarity(entry.magic, p.magic))}`) : null,
            h('div', { class: 'patent-actions' },
              h('button', { class: 'btn btn-primary btn-small', disabled: !canDispatch(st, a), onclick: () => app.act(a) }, `この特許で請求 ${yen(CONFIG.CLAIM_COST)}`)),
          );
        })),
        me.money < CONFIG.CLAIM_COST ? h('p', { class: 'warn' }, 'お金が足りないので請求できません') : null,
        h('div', { class: 'row-actions' },
          h('button', { class: 'btn btn-large', onclick: () => app.act({ type: 'PASS_CLAIM', seat }) }, 'しない')),
      ),
      h('section', { class: 'card board-card' },
        h('h3', {}, `${caster.name}の盤面（実行後）`),
        renderBoard(caster.board, { allowedWords: puzzle.words }),
      ),
    ),
  );
}
