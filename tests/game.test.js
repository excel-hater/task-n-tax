import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { createGame, dispatch, currentActor, rankings } from '../js/engine/game.js';
import { serialize, deserialize } from '../js/engine/save.js';
import { getPuzzle } from '../js/data/puzzles.js';

const players4 = [0, 1, 2, 3].map((i) => ({ name: `P${i}`, kind: 'human' }));
const PUZZLE_IDS = ['p01', 'p03', 'p06', 'p02', 'p09'];

// 固定の手順：各ラウンドの最初の手番の人だけが solution を一時魔法で唱えて解答し、他の人はすぐ解答する
function scriptedStep(state, progress) {
  const seat = currentActor(state);
  if (state.phase === 'hint') return { type: 'END_HINT', seat };
  if (state.phase === 'reveal') return { type: 'START_ACTION' };
  if (state.phase === 'roundEnd') return { type: 'NEXT_ROUND' };
  const p = state.players[seat];
  if (p.answered) return { type: 'END_TURN', seat };
  if (seat !== state.turnOrder[0]) return { type: 'ANSWER', seat };
  const solution = getPuzzle(state.puzzleId).solution;
  const done = progress[state.round] ?? 0;
  if (done >= solution.length) return { type: 'ANSWER', seat };
  if (p.actionsLeft === 0) return { type: 'END_TURN', seat };
  progress[state.round] = done + 1;
  return { type: 'CAST_TEMP', seat, magic: solution[done] };
}

function playScripted(stopAfter = Infinity) {
  let s = createGame({ players: players4, seed: 42, puzzleIds: PUZZLE_IDS });
  const progress = {};
  let steps = 0;
  while (s.phase !== 'gameEnd' && steps < stopAfter) {
    s = dispatch(s, scriptedStep(s, progress)).state;
    steps++;
  }
  return { state: s, progress };
}

test('固定の手順で4人が5ラウンドを完走し、最終所持金が期待値と一致する', () => {
  assert.equal(CONFIG.ROUNDS, 5);
  const { state } = playScripted();
  assert.equal(state.phase, 'gameEnd');
  assert.equal(state.roundResults.length, 5);
  // r1 p01(2手) 席0 1位: +300+100-2 / r2 p03(4手) 席1 2手番目に解答で4位: +300-4
  // r3 p06(6手) 席2 4位: +300-6 / r4 p02(2手) 席3 1位: +300+100-2 / r5 p09(3手) 席0 1位: +300+100-3
  assert.deepEqual(state.players.map((p) => p.money), [1795, 1296, 1294, 1398]);
  assert.deepEqual(rankings(state).map((r) => r.seat), [0, 3, 1, 2]);
  assert.deepEqual(state.roundResults[1].players.map((p) => p.rank), [3, 4, 1, 2]);
  assert.equal(state.roundResults[2].players[2].rate, 1);
});

test('手番の開始プレイヤーはラウンドごとに1つずれる', () => {
  let s = createGame({ players: players4, seed: 1, puzzleIds: PUZZLE_IDS });
  assert.deepEqual(s.turnOrder, [0, 1, 2, 3]);
  const progress = {};
  while (s.round === 1) s = dispatch(s, scriptedStep(s, progress)).state;
  assert.deepEqual(s.turnOrder, [1, 2, 3, 0]);
});

test('手番の上限に達するとラウンドが終わり、未解答の人は自動で解答（順位ボーナスなし）', () => {
  let s = createGame({ players: players4.slice(0, 2), seed: 1, puzzleIds: PUZZLE_IDS });
  s = dispatch(s, { type: 'END_HINT', seat: 0 }).state;
  s = dispatch(s, { type: 'END_HINT', seat: 1 }).state;
  s = dispatch(s, { type: 'START_ACTION' }).state;
  const solution = getPuzzle('p01').solution;
  s = dispatch(s, { type: 'CAST_TEMP', seat: 0, magic: solution[0] }).state;
  s = dispatch(s, { type: 'CAST_TEMP', seat: 0, magic: solution[1] }).state;
  for (let i = 0; i < CONFIG.MAX_TURNS_PER_ROUND * 2; i++) s = dispatch(s, { type: 'END_TURN', seat: currentActor(s) }).state;
  assert.equal(s.phase, 'roundEnd');
  const r = s.roundResults[0].players;
  assert.ok(r.every((p) => p.auto));
  assert.equal(r[0].clearReward, CONFIG.CLEAR_REWARD);
  assert.equal(r[0].rankBonus, 0);
  assert.equal(s.players[0].money, CONFIG.INITIAL_MONEY + CONFIG.CLEAR_REWARD - 2 * CONFIG.CAST_COST);
});

test('保存→読込で状態が一致し、同じ続きになる', () => {
  const { state: mid, progress } = playScripted(37);
  const loaded = deserialize(serialize(mid));
  assert.deepEqual(loaded, mid);
  const p1 = { ...progress };
  const p2 = { ...progress };
  let a = mid;
  let b = loaded;
  while (a.phase !== 'gameEnd') {
    a = dispatch(a, scriptedStep(a, p1)).state;
    b = dispatch(b, scriptedStep(b, p2)).state;
  }
  assert.deepEqual(a, b);
});

test('同じシードなら同じ問題順になる', () => {
  const a = createGame({ players: players4, seed: 'abc' });
  const b = createGame({ players: players4, seed: 'abc' });
  assert.deepEqual(a.puzzleIds, b.puzzleIds);
  assert.equal(new Set(a.puzzleIds).size, CONFIG.ROUNDS);
});
