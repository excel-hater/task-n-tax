import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { createGame, dispatch, currentActor, GameError, busyRemaining } from '../js/engine/game.js';
import { timeBonus } from '../js/engine/rules.js';
import { updateRecords, soloResult, formatTime, bestOf } from '../js/engine/records.js';
import { getPuzzle } from '../js/data/puzzles.js';

const SOLO = CONFIG.SOLO;
const me = [{ name: 'わたし', kind: 'human' }];
const PUZZLE_IDS = ['p01', 'p03', 'p06', 'p02', 'p09'];
const m = (words, dx = 0, dy = 0) => ({ words, vector: { dx, dy } });

function run(state, ...actions) {
  for (const a of actions) state = dispatch(state, a).state;
  return state;
}

// ヒント段階を終えて行動段階へ（solo は全体公開を挟まない）
function toAction(prepatents = []) {
  let s = createGame({ players: me, seed: 1, puzzleIds: PUZZLE_IDS, mode: 'solo' });
  for (const magic of prepatents) s = run(s, { type: 'PREPATENT', seat: 0, magic });
  return run(s, { type: 'END_HINT', seat: 0 });
}

test('solo は1人で作れる。通常モードは1人では作れない。solo にNPCは入れない', () => {
  const s = createGame({ players: me, seed: 1, mode: 'solo' });
  assert.equal(s.mode, 'solo');
  assert.equal(s.phase, 'hint');
  assert.throws(() => createGame({ players: me, seed: 1 }), GameError);
  assert.throws(() => createGame({ players: [...me, ...me], seed: 1, mode: 'solo' }), GameError);
  assert.throws(() => createGame({ players: [{ kind: 'npc' }], seed: 1, mode: 'solo' }), /NPC/);
});

test('ヒント終了で全体公開を挟まずに行動段階へ入り、時計は0から', () => {
  const s = toAction([m(['四角'], 4, -3)]);
  assert.equal(s.phase, 'action');
  assert.equal(currentActor(s), 0);
  assert.equal(s.players[0].clock, 0);
  assert.equal(s.log.filter((e) => e.type === 'prepatent').length, 1);
});

test('一時魔法は3G、特許魔法は1G。クレーム受付は開かない', () => {
  let s = toAction([m(['四角'], 4, -3)]);
  const pid = Object.keys(s.patents)[0];
  s = run(s, { type: 'CAST_TEMP', seat: 0, magic: m(['三角']), t: 0 });
  assert.equal(s.players[0].money, CONFIG.INITIAL_MONEY - SOLO.RULES.TEMP_CAST_COST);
  assert.equal(s.claimWindow, null);
  s = run(s, { type: 'CAST_PATENT', seat: 0, patentId: pid, t: SOLO.COOLDOWN_MS.CAST_TEMP });
  assert.equal(s.players[0].money, CONFIG.INITIAL_MONEY - SOLO.RULES.TEMP_CAST_COST - SOLO.RULES.CAST_COST);
});

test('特許は3枠まで。4つめは申請も拾いもできない', () => {
  let s = toAction([m(['四角']), m(['円'])]);
  s = run(s, { type: 'APPLY_PATENT', seat: 0, magic: m(['三角']), t: 0 });
  assert.equal(Object.keys(s.patents).length, 3);
  const t = SOLO.COOLDOWN_MS.APPLY_PATENT;
  assert.throws(() => dispatch(s, { type: 'APPLY_PATENT', seat: 0, magic: m(['星']), t }), /特許枠/);
  s = run(s, { type: 'DISCARD', seat: 0, patentId: 'P1', t });
  s = run(s, { type: 'APPLY_PATENT', seat: 0, magic: m(['星']), t: t + SOLO.COOLDOWN_MS.DISCARD });
  s = run(s, { type: 'END_TURN', seat: 0, t: t + SOLO.COOLDOWN_MS.DISCARD + SOLO.COOLDOWN_MS.APPLY_PATENT });
  assert.throws(() => dispatch(s, { type: 'PICKUP', seat: 0, patentId: 'P1', t: 60000 }), /特許枠/);
});

test('実行後硬直：硬直中は拒否、明ければ通る。一時魔法と特許魔法で長さが違う。時間は巻き戻せない', () => {
  let s = toAction([m(['四角'], 1, 0)]);
  s = run(s, { type: 'CAST_TEMP', seat: 0, magic: m(['三角']), t: 1000 });
  assert.equal(busyRemaining(s, 0, 2000), SOLO.COOLDOWN_MS.CAST_TEMP - 1000);
  assert.throws(() => dispatch(s, { type: 'CAST_PATENT', seat: 0, patentId: 'P1', t: 1000 + SOLO.COOLDOWN_MS.CAST_TEMP - 1 }), /硬直中/);
  const t1 = 1000 + SOLO.COOLDOWN_MS.CAST_TEMP;
  s = run(s, { type: 'CAST_PATENT', seat: 0, patentId: 'P1', t: t1 });
  assert.equal(s.players[0].busyUntil, t1 + SOLO.COOLDOWN_MS.CAST_PATENT);
  assert.ok(SOLO.COOLDOWN_MS.CAST_PATENT < SOLO.COOLDOWN_MS.CAST_TEMP);
  assert.throws(() => dispatch(s, { type: 'END_TURN', seat: 0, t: t1 - 1 }), /巻き戻/);
  assert.throws(() => dispatch(s, { type: 'END_TURN', seat: 0 }), /経過時間/);
});

test('ヒント段階の操作には時間が要らない', () => {
  let s = createGame({ players: me, seed: 1, puzzleIds: PUZZLE_IDS, mode: 'solo' });
  s = run(s, { type: 'PREPATENT', seat: 0, magic: m(['四角']) }, { type: 'DISCARD', seat: 0, patentId: 'P1' });
  assert.deepEqual(s.bin, ['P1']);
});

test('タイムボーナスの計算', () => {
  assert.equal(timeBonus(1, 0), SOLO.TIME_BONUS_MAX);
  assert.equal(timeBonus(1, SOLO.TIME_BONUS_ZERO_MS / 2), SOLO.TIME_BONUS_MAX / 2);
  assert.equal(timeBonus(1, SOLO.TIME_BONUS_ZERO_MS), 0);
  assert.equal(timeBonus(1, SOLO.TIME_BONUS_ZERO_MS * 3), 0);
  assert.equal(timeBonus(0.5, 0), SOLO.TIME_BONUS_MAX / 2);
});

test('固定の手順で5ラウンドを完走し、スコアと合計タイムが手計算と一致する', () => {
  let s = createGame({ players: me, seed: 1, puzzleIds: PUZZLE_IDS, mode: 'solo' });
  let guard = 0;
  let castsBefore = 0; // このラウンドより前に唱えた数
  while (s.phase !== 'gameEnd' && guard++ < 500) {
    if (s.phase === 'hint') { s = run(s, { type: 'END_HINT', seat: 0 }); continue; }
    if (s.phase === 'roundEnd') { s = run(s, { type: 'NEXT_ROUND' }); continue; }
    const p = s.players[0];
    const t = p.busyUntil; // 硬直が明けたらすぐ次の行動
    const solution = getPuzzle(s.puzzleId).solution;
    const done = p.stats.tempCasts - castsBefore;
    if (done >= solution.length) {
      s = run(s, { type: 'ANSWER', seat: 0, t });
      castsBefore = p.stats.tempCasts;
    } else if (p.actionsLeft === 0) s = run(s, { type: 'END_TURN', seat: 0, t });
    else s = run(s, { type: 'CAST_TEMP', seat: 0, magic: solution[done], t });
  }
  assert.equal(s.phase, 'gameEnd');
  // 手数 2,4,6,2,3。一時魔法 3G・硬直3秒、手番終了 硬直1秒
  //   タイム：6s, 13s(0,3,6,終了9,10), 19s, 6s, 9s → ボーナス 95, 89, 84, 95, 92
  //   1ラウンドの収支 = 300 + ボーナス − 3×手数
  assert.deepEqual(s.roundResults.map((r) => r.players[0].timeMs), [6000, 13000, 19000, 6000, 9000]);
  assert.deepEqual(s.roundResults.map((r) => r.players[0].timeBonus), [95, 89, 84, 95, 92]);
  assert.deepEqual(s.roundResults.map((r) => r.players[0].rankBonus), [0, 0, 0, 0, 0]);
  assert.deepEqual(soloResult(s), { seed: s.seed, score: 1000 + 389 + 377 + 366 + 389 + 383, timeMs: 53000 });
});

test('時間切れ（手番上限）の自動解答では、最後に行動した時刻がタイムになる', () => {
  let s = toAction();
  let t = 0;
  for (let i = 0; i < CONFIG.MAX_TURNS_PER_ROUND; i++) {
    s = run(s, { type: 'END_TURN', seat: 0, t });
    t += SOLO.COOLDOWN_MS.END_TURN;
  }
  assert.equal(s.phase, 'roundEnd');
  const r = s.roundResults[0].players[0];
  assert.ok(r.auto);
  assert.equal(r.timeMs, t - SOLO.COOLDOWN_MS.END_TURN);
});

test('記録：初回・更新・同点ならタイムが短い方・シードごと', () => {
  let r = updateRecords({}, { seed: 7, score: 2000, timeMs: 60000, date: 'd1' });
  assert.ok(r.isBest);
  r = updateRecords(r.records, { seed: 7, score: 1900, timeMs: 30000, date: 'd2' });
  assert.ok(!r.isBest);
  assert.equal(bestOf(r.records, 7).score, 2000);
  r = updateRecords(r.records, { seed: 7, score: 2000, timeMs: 50000, date: 'd3' });
  assert.ok(r.isBest);
  assert.equal(r.records['7'].plays, 3);
  assert.equal(bestOf(r.records, 8), null);
  r = updateRecords(r.records, { seed: 8, score: 100, timeMs: 1, date: 'd4' });
  assert.ok(r.isBest);
  assert.equal(bestOf(r.records, 7).timeMs, 50000);
});

test('タイムの表示', () => {
  assert.equal(formatTime(0), '0:00.0');
  assert.equal(formatTime(53000), '0:53.0');
  assert.equal(formatTime(61250), '1:01.3');
});
