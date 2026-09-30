// ラウンド結果 / 最終結果
import { CONFIG } from '../../config.js';
import { rankings } from '../../engine/game.js';
import { getPuzzle } from '../../data/puzzles.js';
import { h } from '../dom.js';
import { playerName, pct, yen } from '../format.js';
import { topbar } from './common.js';
import { isSolo } from '../../engine/rules.js';
import { formatTime, soloResult } from '../../engine/records.js';

function signed(n) {
  return n > 0 ? `+${n}G` : `${n}G`;
}

export function renderRoundResult(app) {
  const st = app.state;
  if (isSolo(st)) return renderSoloRoundResult(app);
  const r = st.roundResults.at(-1);
  const puzzle = getPuzzle(r.puzzleId);
  const rows = r.players.slice().sort((a, b) => a.rank - b.rank);
  const last = st.round >= CONFIG.ROUNDS;
  return h('main', { class: 'screen result-screen' },
    topbar(app, { title: `ラウンド${r.round}の結果` }),
    h('section', { class: 'card' },
      h('h2', {}, `ラウンド${r.round}「${puzzle.title}」の結果`),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'results' },
          h('thead', {}, h('tr', {}, ['解答順', 'プレイヤー', '達成率', '達成報酬', '順位ボーナス', '今回の収支', '所持金'].map((t) => h('th', {}, t)))),
          h('tbody', {}, rows.map((x) => h('tr', {},
            h('td', { class: 'num' }, `${x.rank}${x.auto ? '（時間切れ）' : ''}`),
            h('td', {}, playerName(st, x.seat)),
            h('td', { class: 'num' }, pct(x.rate)),
            h('td', { class: 'num' }, yen(x.clearReward)),
            h('td', { class: 'num' }, yen(x.rankBonus)),
            h('td', { class: `num ${x.delta >= 0 ? 'up' : 'down'}` }, signed(x.delta)),
            h('td', { class: 'num' }, h('b', {}, yen(x.money))),
          ))),
        ),
      ),
      h('p', { class: 'muted small' }, `順位ボーナスは達成率${pct(CONFIG.RANK_BONUS_MIN_RATE)}以上で解答したときだけ。時間切れの自動解答には付きません。`),
    ),
    h('div', { class: 'row-actions' },
      app.hasHumans()
        ? h('button', { class: 'btn btn-primary btn-large', onclick: () => app.act({ type: 'NEXT_ROUND' }) }, last ? '最終結果へ' : '次のラウンドへ')
        : h('p', { class: 'muted' }, 'まもなく次へ進みます…'),
    ),
  );
}

const INCOME = [['clear', '達成報酬'], ['rank', '順位ボーナス'], ['licenseIn', '使用料収入'], ['claimIn', 'クレーム収入'], ['compIn', '慰謝料収入']];
const EXPENSE = [['cast', '実行'], ['patent', '特許申請'], ['licenseOut', '使用料支払い'], ['claimCost', 'クレーム費用'], ['claimOut', 'クレーム支払い'], ['compOut', '慰謝料支払い']];

export function renderFinal(app) {
  const st = app.state;
  if (isSolo(st)) return renderSoloFinal(app);
  const ranks = rankings(st);
  const top = ranks[0].money;
  return h('main', { class: 'screen result-screen' },
    topbar(app, { title: '最終結果' }),
    h('section', { class: 'card final-card' },
      h('h2', {}, '最終結果'),
      h('ol', { class: 'final-rank' }, ranks.map((r, i) => h('li', { class: r.money === top ? 'winner' : '' },
        h('span', { class: 'final-pos' }, `${i + 1}位`),
        h('span', { class: 'final-name' }, playerName(st, r.seat), r.money === top ? h('span', { class: 'badge badge-new' }, '優勝') : null),
        h('span', { class: 'final-money' }, yen(r.money)),
      ))),
    ),
    h('section', { class: 'card' },
      h('h3', {}, '収支の内訳'),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'results' },
          h('thead', {}, h('tr', {}, h('th', {}, ''), st.players.map((p) => h('th', {}, p.name)))),
          h('tbody', {},
            INCOME.map(([k, label]) => h('tr', {}, h('td', {}, label), st.players.map((p) => h('td', { class: 'num up' }, p.stats[k] ? `+${p.stats[k]}` : '0')))),
            EXPENSE.map(([k, label]) => h('tr', {}, h('td', {}, label), st.players.map((p) => h('td', { class: 'num down' }, p.stats[k] ? `−${p.stats[k]}` : '0')))),
            h('tr', {}, h('td', {}, 'クレーム（成立/請求）'), st.players.map((p) => h('td', { class: 'num' }, `${p.stats.claimsWon}/${p.stats.claimsMade}`))),
          ),
        ),
      ),
    ),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn', onclick: () => app.toTitle() }, 'タイトルへ'),
      h('button', { class: 'btn btn-primary btn-large', onclick: () => app.newGame() }, '同じ設定でもう一度'),
    ),
  );
}

// ---- ひとりで挑戦 ----
function renderSoloRoundResult(app) {
  const st = app.state;
  const r = st.roundResults.at(-1);
  const x = r.players[0];
  const puzzle = getPuzzle(r.puzzleId);
  const last = st.round >= CONFIG.ROUNDS;
  const row = (label, value, cls = '') => h('tr', {}, h('td', {}, label), h('td', { class: `num ${cls}` }, value));
  return h('main', { class: 'screen result-screen' },
    topbar(app, { title: `ラウンド${r.round}の結果` }),
    h('section', { class: 'card' },
      h('h2', {}, `ラウンド${r.round}「${puzzle.title}」の結果`),
      h('div', { class: 'solo-headline' },
        h('div', {}, h('span', { class: 'stat-label' }, 'タイム'), h('b', {}, formatTime(x.timeMs))),
        h('div', {}, h('span', { class: 'stat-label' }, '達成率'), h('b', {}, pct(x.rate))),
      ),
      x.auto ? h('p', { class: 'warn small' }, '手番の上限で時間切れになり、自動で解答しました') : null,
      h('table', { class: 'results' }, h('tbody', {},
        row('達成報酬', yen(x.clearReward), 'up'),
        row('タイムボーナス', yen(x.timeBonus ?? 0), 'up'),
        row('今回の収支', signed(x.delta), x.delta >= 0 ? 'up' : 'down'),
        row('所持金（スコア）', h('b', {}, yen(x.money))),
      )),
    ),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-primary btn-large', onclick: () => app.act({ type: 'NEXT_ROUND' }) }, last ? '最終結果へ' : '次のラウンドへ（ヒント段階は計時なし）'),
    ),
  );
}

function renderSoloFinal(app) {
  const st = app.state;
  const p = st.players[0];
  const rec = app.lastRecord;
  const result = rec?.result ?? soloResult(st);
  const prev = rec?.previousBest;
  return h('main', { class: 'screen result-screen' },
    topbar(app, { title: '最終結果' }),
    h('section', { class: 'card final-card' },
      h('h2', {}, 'ひとりで挑戦の結果'),
      rec?.isBest ? h('p', { class: 'best-banner' }, prev ? 'ベスト更新！' : 'はじめての記録！') : null,
      h('div', { class: 'solo-headline' },
        h('div', {}, h('span', { class: 'stat-label' }, 'スコア'), h('b', { class: 'score' }, `${result.score}`)),
        h('div', {}, h('span', { class: 'stat-label' }, '合計タイム'), h('b', {}, formatTime(result.timeMs))),
      ),
      h('p', { class: 'muted small' }, `シード：${result.seed}`,
        prev ? `　／　これまでの自己ベスト：${prev.score}（${formatTime(prev.timeMs)}）` : ''),
      h('div', { class: 'table-wrap' },
        h('table', { class: 'results' },
          h('thead', {}, h('tr', {}, ['R', '問題', '達成率', 'タイム', '達成報酬', 'タイムボーナス', '収支'].map((t) => h('th', {}, t)))),
          h('tbody', {}, st.roundResults.map((r) => {
            const x = r.players[0];
            return h('tr', {},
              h('td', { class: 'num' }, `${r.round}`),
              h('td', {}, getPuzzle(r.puzzleId).title),
              h('td', { class: 'num' }, pct(x.rate)),
              h('td', { class: 'num' }, `${formatTime(x.timeMs)}${x.auto ? '（時間切れ）' : ''}`),
              h('td', { class: 'num' }, yen(x.clearReward)),
              h('td', { class: 'num' }, yen(x.timeBonus ?? 0)),
              h('td', { class: `num ${x.delta >= 0 ? 'up' : 'down'}` }, signed(x.delta)),
            );
          })),
        ),
      ),
      h('p', { class: 'muted small' }, `実行 ${p.stats.casts}回（一時魔法 ${p.stats.tempCasts}・特許魔法 ${p.stats.patentCasts}）／特許申請 ${p.stats.patentsApplied}件／実行の支払い ${yen(p.stats.cast)}／特許の支払い ${yen(p.stats.patent)}`),
    ),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn', onclick: () => app.toTitle() }, 'タイトルへ'),
      h('button', { class: 'btn btn-primary btn-large', onclick: () => app.retrySolo() }, '同じシードで再挑戦'),
    ),
  );
}
