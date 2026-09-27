import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { createGame, dispatch, currentActor } from '../js/engine/game.js';
import { autoAction, decide } from '../js/ai/npc.js';
import { searchCandidates } from '../js/ai/search.js';
import { getPuzzle, PUZZLES } from '../js/data/puzzles.js';
import { playNpcGame } from '../tools/simulate.js';

test('全員NPCで1ゲームを例外なく完走する（各強さ）', () => {
  for (const levels of [[1, 1], [2, 2, 2], [3, 2, 1, 3]]) {
    const { state } = playNpcGame(`t-${levels.join('')}`, levels);
    assert.equal(state.phase, 'gameEnd');
    assert.equal(state.roundResults.length, CONFIG.ROUNDS);
  }
});

test('同じ状態なら同じ判断をする', () => {
  const a = playNpcGame('same', [1, 2, 3]).state;
  const b = playNpcGame('same', [1, 2, 3]).state;
  assert.deepEqual(a, b);
});

test('探索：1手で条件を満たす手を見つける', () => {
  const p = getPuzzle('p04');
  const cands = searchCandidates(p.board, { conditions: p.conditions, words: p.words });
  assert.ok(cands[0].rate >= 0.5, `最良の候補の達成率 ${cands[0].rate}`);
});

test('強いNPCはどのパズルでも達成率50%以上に届く', () => {
  for (const p of PUZZLES) {
    let s = createGame({
      players: [{ kind: 'npc', npcLevel: 3 }, { kind: 'npc', npcLevel: 3 }],
      seed: 1,
      puzzleIds: [p.id, p.id, p.id, p.id, p.id],
    });
    while (s.phase !== 'roundEnd') s = dispatch(s, autoAction(s)).state;
    const best = Math.max(...s.players.map((q) => q.rate));
    assert.ok(best >= 0.5, `${p.id}: ${best}`);
  }
});

test('クレーム：似た特許があれば請求し、似ていなければ見送る', () => {
  let s = createGame({
    players: [{ kind: 'human' }, { kind: 'npc', npcLevel: 3 }],
    seed: 1,
    puzzleIds: ['p01', 'p02', 'p03', 'p04', 'p05'],
  });
  const pat = { words: ['四角'], vector: { dx: 4, dy: -3 } };
  s = dispatch(s, { type: 'END_HINT', seat: 0 }).state;
  s = dispatch(s, { type: 'PREPATENT', seat: 1, magic: pat }).state;
  s = dispatch(s, { type: 'END_HINT', seat: 1 }).state;
  s = dispatch(s, { type: 'START_ACTION' }).state;
  const far = dispatch(s, { type: 'CAST_TEMP', seat: 0, magic: { words: ['三角', '赤に'], vector: { dx: 0, dy: 0 } } }).state;
  assert.equal(decide(far, 1).type, 'PASS_CLAIM');
  const near = dispatch(s, { type: 'CAST_TEMP', seat: 0, magic: { words: ['四角'], vector: { dx: 4, dy: -2 } } }).state;
  assert.equal(currentActor(near), 1);
  assert.equal(decide(near, 1).type, 'CLAIM');
});
