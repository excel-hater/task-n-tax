import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { vectorSimilarity, wordSimilarity, similarity, claimPayout } from '../js/engine/similarity.js';
import { createGame, dispatch, currentActor, GameError } from '../js/engine/game.js';

const v = (dx, dy) => ({ dx, dy });
const m = (words, dx = 0, dy = 0) => ({ words, vector: { dx, dy } });
const players4 = [0, 1, 2, 3].map((i) => ({ name: `P${i}`, kind: 'human' }));
const START = CONFIG.INITIAL_MONEY;

function run(state, ...actions) {
  for (const a of actions) state = dispatch(state, a).state;
  return state;
}

// p01 固定・4人。prepatents: { seat: [magic...] } を先行特許にして行動段階へ進める
function setup(prepatents = {}) {
  let s = createGame({ players: players4, seed: 1, puzzleIds: ['p01', 'p02', 'p03', 'p04', 'p05'] });
  for (let i = 0; i < 4; i++) {
    const seat = currentActor(s);
    for (const magic of prepatents[seat] ?? []) s = run(s, { type: 'PREPATENT', seat, magic });
    s = run(s, { type: 'END_HINT', seat });
  }
  assert.equal(s.phase, 'reveal');
  return run(s, { type: 'START_ACTION' });
}

function patentOf(s, seat, index = 0) {
  return Object.values(s.patents).filter((p) => p.owner === seat)[index].id;
}

test('ベクトル類似度の境界', () => {
  assert.equal(vectorSimilarity(v(0, 0), v(0, 0)), 1);
  assert.equal(vectorSimilarity(v(0, 0), v(1, 0)), 0);
  assert.equal(vectorSimilarity(v(2, 0), v(-2, 0)), 0);
  assert.equal(vectorSimilarity(v(2, 0), v(0, 3)), 0);
  assert.equal(vectorSimilarity(v(1, 0), v(4, 0)), 0.25);
  assert.ok(Math.abs(vectorSimilarity(v(1, 1), v(2, 2)) - 0.5) < 1e-12);
});

test('単語類似度（Jaccard）と合成', () => {
  assert.equal(wordSimilarity(['四角', '枠'], ['四角', '枠']), 1);
  assert.equal(wordSimilarity(['四角', '枠'], ['四角', '中身']), 1 / 3);
  assert.equal(wordSimilarity(['四角'], ['円']), 0);
  assert.equal(similarity(m(['四角'], 1, 0), m(['四角'], 1, 0)), 1);
  assert.equal(similarity(m(['四角', '枠', '赤に'], 0, 0), m(['四角', '円', '青に'], 1, 0)), 0.1);
  assert.equal(claimPayout(0.1), 10);
  assert.equal(claimPayout(1), 100);
});

test('クレーム成立：類似度ちょうど0.1で成立し、費用と支払いが正しい', () => {
  const pat = m(['四角', '円', '青に'], 1, 0); // 実行する魔法との類似度 0.1
  let s = setup({ 2: [pat] });
  const cast = m(['四角', '枠', '赤に']);
  s = run(s, { type: 'CAST_TEMP', seat: 0, magic: cast });
  assert.deepEqual(s.claimWindow.askOrder, [2]);
  assert.equal(currentActor(s), 2);
  s = run(s, { type: 'CLAIM', seat: 2, patentId: patentOf(s, 2) });
  assert.equal(s.claimWindow, null);
  assert.equal(s.players[0].money, START - CONFIG.CAST_COST - 10);
  assert.equal(s.players[2].money, START - CONFIG.CLAIM_COST + 10);
  assert.equal(currentActor(s), 0, '手番は実行者に戻る');
  assert.equal(s.log.find((e) => e.type === 'cast').claim.amount, 10);
});

test('クレーム不成立：慰謝料を払い、次の候補へ進む。最初の成立で閉じる', () => {
  const weak = m(['三角', '中身', '緑に'], 0, 0); // 実行魔法との類似度 0.5×0 + 0.5×0 = 0
  const strong = m(['四角'], 4, -3);
  let s = setup({ 1: [weak], 2: [strong], 3: [strong] });
  s = run(s, { type: 'CAST_TEMP', seat: 0, magic: m(['四角'], 4, -3) });
  assert.deepEqual(s.claimWindow.askOrder, [1, 2, 3]);
  // クレーム受付中は他のアクションができない
  assert.throws(() => dispatch(s, { type: 'END_TURN', seat: 0 }), GameError);
  s = run(s, { type: 'CLAIM', seat: 1, patentId: patentOf(s, 1) });
  assert.equal(s.players[1].money, START - CONFIG.CLAIM_COST - CONFIG.CLAIM_FAIL_COMPENSATION);
  assert.equal(currentActor(s), 2);
  s = run(s, { type: 'CLAIM', seat: 2, patentId: patentOf(s, 2) });
  assert.equal(s.claimWindow, null, '成立したので3番には聞かない');
  assert.equal(s.players[2].money, START - CONFIG.CLAIM_COST + 100);
  assert.equal(s.players[0].money, START - CONFIG.CAST_COST + CONFIG.CLAIM_FAIL_COMPENSATION - 100);
  assert.equal(s.players[3].money, START);
});

test('クレーム受付：全員がしないで閉じる。特許を持たない人には聞かない', () => {
  let s = setup({ 3: [m(['円'], 1, 1)] });
  s = run(s, { type: 'CAST_TEMP', seat: 0, magic: m(['四角'], 1, 0) });
  assert.deepEqual(s.claimWindow.askOrder, [3]);
  s = run(s, { type: 'PASS_CLAIM', seat: 3 });
  assert.equal(s.claimWindow, null);
  assert.equal(s.players[0].money, START - CONFIG.CAST_COST);
});

test('特許魔法の実行：他人の特許は使用料、自分の特許は実行コストのみ。クレーム対象外', () => {
  const pat = m(['四角'], 4, -3);
  let s = setup({ 0: [pat], 3: [m(['円'])] });
  s = run(s, { type: 'END_TURN', seat: 0 });
  s = run(s, { type: 'CAST_PATENT', seat: 1, patentId: patentOf(s, 0) });
  assert.equal(s.claimWindow, null);
  assert.equal(s.players[1].money, START - CONFIG.CAST_COST - CONFIG.LICENSE_FEE);
  assert.equal(s.players[0].money, START + CONFIG.LICENSE_FEE);
  assert.equal(s.players[1].board.find((o) => o.id === 'rect1').x, 5);
  s = run(s, { type: 'END_TURN', seat: 1 }, { type: 'END_TURN', seat: 2 }, { type: 'END_TURN', seat: 3 });
  s = run(s, { type: 'CAST_PATENT', seat: 0, patentId: patentOf(s, 0) });
  assert.equal(s.players[0].money, START + CONFIG.LICENSE_FEE - CONFIG.CAST_COST);
});

test('申請・申請して実行・枠の上限・捨てる・拾う', () => {
  let s = setup();
  s = run(s, { type: 'APPLY_PATENT', seat: 0, magic: m(['円'], 1, 0) });
  s = run(s, { type: 'APPLY_AND_CAST', seat: 0, magic: m(['四角'], 4, -3) });
  assert.equal(s.players[0].money, START - CONFIG.PATENT_COST * 2 - CONFIG.CAST_COST);
  assert.equal(s.claimWindow, null, '申請して実行はクレーム対象外');
  const discarded = patentOf(s, 0);
  s = run(s, { type: 'DISCARD', seat: 0, patentId: discarded });
  assert.deepEqual(s.bin, [discarded]);
  assert.equal(s.patents[discarded].owner, null);
  s = run(s, { type: 'END_TURN', seat: 0 });
  s = run(s, { type: 'PICKUP', seat: 1, patentId: discarded });
  assert.equal(s.patents[discarded].owner, 1);
  assert.deepEqual(s.bin, []);
  assert.equal(s.players[1].actionsLeft, CONFIG.ACTIONS_PER_TURN - 1);
  // 枠の上限
  for (let i = 0; i < CONFIG.PATENT_SLOTS - 1; i++) {
    if (s.players[1].actionsLeft === 0) {
      s = run(s, { type: 'END_TURN', seat: 1 }, { type: 'END_TURN', seat: 2 }, { type: 'END_TURN', seat: 3 }, { type: 'END_TURN', seat: 0 });
    }
    s = run(s, { type: 'APPLY_PATENT', seat: 1, magic: m(['円'], i - 2, 1) });
  }
  if (s.players[1].actionsLeft === 0) {
    s = run(s, { type: 'END_TURN', seat: 1 }, { type: 'END_TURN', seat: 2 }, { type: 'END_TURN', seat: 3 }, { type: 'END_TURN', seat: 0 });
  }
  assert.throws(() => dispatch(s, { type: 'APPLY_PATENT', seat: 1, magic: m(['三角']) }), /特許枠/);
});

test('アクションは1手番3回まで。お金が足りなければ実行できない', () => {
  let s = setup();
  for (let i = 0; i < CONFIG.ACTIONS_PER_TURN; i++) s = run(s, { type: 'CAST_TEMP', seat: 0, magic: m(['三角']) });
  assert.throws(() => dispatch(s, { type: 'CAST_TEMP', seat: 0, magic: m(['三角']) }), /アクション/);
  s = run(s, { type: 'END_TURN', seat: 0 });
  s.players[1].money = CONFIG.PATENT_COST - 1;
  assert.throws(() => dispatch(s, { type: 'APPLY_PATENT', seat: 1, magic: m(['三角']) }), /お金/);
});

test('ヒント段階：先行特許は2つまで無料、全体公開まで非公開', () => {
  let s = createGame({ players: players4, seed: 1, puzzleIds: ['p01', 'p02', 'p03', 'p04', 'p05'] });
  s = run(s, { type: 'PREPATENT', seat: 0, magic: m(['四角']) }, { type: 'PREPATENT', seat: 0, magic: m(['円']) });
  assert.throws(() => dispatch(s, { type: 'PREPATENT', seat: 0, magic: m(['三角']) }), /2つまで/);
  assert.ok(Object.values(s.patents).every((p) => p.hidden));
  assert.equal(s.players[0].money, START);
  for (let seat = 0; seat < 4; seat++) s = run(s, { type: 'END_HINT', seat });
  assert.ok(Object.values(s.patents).every((p) => !p.hidden));
  assert.equal(s.log.filter((e) => e.type === 'prepatent').length, 2);
});

test('解答後は盤面を変えられないが、特許の操作とクレームはできる', () => {
  let s = setup({ 1: [m(['四角'], 4, -3)] });
  s = run(s, { type: 'ANSWER', seat: 0 });
  assert.equal(currentActor(s), 1);
  s = run(s, { type: 'END_TURN', seat: 1 }, { type: 'END_TURN', seat: 2 }, { type: 'END_TURN', seat: 3 });
  assert.throws(() => dispatch(s, { type: 'CAST_TEMP', seat: 0, magic: m(['四角']) }), /解答済み/);
  s = run(s, { type: 'APPLY_PATENT', seat: 0, magic: m(['四角'], 3, 0) });
  s = run(s, { type: 'END_TURN', seat: 0 });
  s = run(s, { type: 'CAST_TEMP', seat: 1, magic: m(['四角'], 3, 0) });
  assert.deepEqual(s.claimWindow.askOrder, [0]);
  s = run(s, { type: 'CLAIM', seat: 0, patentId: patentOf(s, 0) });
  assert.ok(s.log.at(-1).success);
});
