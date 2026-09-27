import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { moveShape, resizeShape, touches, isOnTop, isInside, validateBoard, cloneBoard } from '../js/engine/world.js';
import { applyMagic, validateMagic, selectTargets } from '../js/engine/magic.js';
import { judge } from '../js/engine/judge.js';
import { PUZZLES } from '../js/data/puzzles.js';
import { WORDS } from '../js/data/words.js';

const floor = { id: 'floor', kind: 'fixed', name: '床', x: 0, y: 7, w: 12, h: 1 };
const shelf = { id: 'shelf', kind: 'fixed', name: '棚', x: 4, y: 4, w: 4, h: 1 };
const rect = (x, y, extra = {}) => ({ id: 'r', kind: 'shape', shape: 'rect', x, y, w: 1, h: 1, stroke: 'black', fill: 'white', ...extra });

test('移動：盤面の端で止まる', () => {
  const b = [rect(10, 2)];
  moveShape(b, b[0], 4, -4);
  assert.deepEqual([b[0].x, b[0].y], [11, 0]);
});

test('移動：固定物の直前で止まり、もう一方の軸は進み続ける', () => {
  const b = [floor, shelf, rect(5, 6)];
  moveShape(b, b[2], 0, -4);
  assert.deepEqual([b[2].x, b[2].y], [5, 5]);
  const c = [floor, shelf, rect(5, 1)];
  moveShape(c, c[2], 2, 4);
  assert.deepEqual([c[2].x, c[2].y], [7, 3]);
  assert.ok(isOnTop(c[2], shelf));
});

test('大きさ：左下基準で伸び縮みし、最小1、置けなければ変化なし', () => {
  const b = [floor, rect(0, 6)];
  assert.ok(resizeShape(b, b[1], 1));
  assert.deepEqual([b[1].x, b[1].y, b[1].w, b[1].h], [0, 5, 2, 2]);
  assert.ok(resizeShape(b, b[1], -1));
  assert.ok(!resizeShape(b, b[1], -1));
  const edge = [floor, rect(11, 6)];
  assert.ok(!resizeShape(edge, edge[1], 1));
  assert.equal(edge[1].w, 1);
});

test('幾何判定：接触・上に乗る・領域内', () => {
  const a = { x: 0, y: 0, w: 2, h: 2 };
  assert.ok(touches(a, { x: 2, y: 1, w: 1, h: 1 }));
  assert.ok(touches(a, { x: 1, y: 1, w: 1, h: 1 }));
  assert.ok(!touches(a, { x: 2, y: 2, w: 1, h: 1 }), '角だけは接触としない');
  assert.ok(!touches(a, { x: 3, y: 0, w: 1, h: 1 }));
  assert.ok(isOnTop({ x: 3, y: 2, w: 2, h: 2 }, shelf));
  assert.ok(!isOnTop({ x: 2, y: 2, w: 2, h: 2 }, shelf), '横の重なりが0');
  assert.ok(isInside({ x: 1, y: 1, w: 1, h: 1 }, a));
  assert.ok(!isInside({ x: 1, y: 1, w: 2, h: 1 }, a));
});

test('魔法：対象語で絞り込み、部位を指定した色だけを変える', () => {
  const b = [floor, rect(0, 6, { id: 'a' }), rect(2, 6, { id: 'b', fill: 'red' }), { ...rect(4, 6), id: 'c', shape: 'circle' }];
  assert.deepEqual(selectTargets(b, ['四角']).map((o) => o.id), ['a', 'b']);
  assert.deepEqual(selectTargets(b, ['赤い', '四角']).map((o) => o.id), ['b']);
  const r = applyMagic(b, { words: ['四角', '枠', '黄色に'], vector: { dx: 1, dy: 0 } });
  const a = r.board.find((o) => o.id === 'a');
  assert.equal(a.stroke, 'yellow');
  assert.equal(a.fill, 'white');
  assert.equal(a.x, 1);
  assert.equal(b[1].stroke, 'black', '元の盤面は変わらない');
  const both = applyMagic(b, { words: ['円', '青に'], vector: { dx: 0, dy: 0 } }).board.find((o) => o.id === 'c');
  assert.equal(both.stroke, 'blue');
  assert.equal(both.fill, 'blue');
});

test('魔法：対象がなければ不発', () => {
  const b = [floor, rect(0, 6)];
  assert.ok(applyMagic(b, { words: ['星'], vector: { dx: 1, dy: 0 } }).fizzled);
  assert.ok(applyMagic(b, { words: ['赤に'], vector: { dx: 1, dy: 0 } }).fizzled);
});

test('魔法の検証', () => {
  assert.equal(validateMagic({ words: ['四角'], vector: { dx: 0, dy: 0 } }), null);
  assert.ok(validateMagic({ words: [], vector: { dx: 0, dy: 0 } }));
  assert.ok(validateMagic({ words: ['四角', '四角'], vector: { dx: 0, dy: 0 } }));
  assert.ok(validateMagic({ words: ['四角'], vector: { dx: CONFIG.VECTOR_MAX + 1, dy: 0 } }));
  assert.ok(validateMagic({ words: ['四角', '円', '三角', '枠', '中身'], vector: { dx: 0, dy: 0 } }));
  assert.ok(validateMagic({ words: ['円'], vector: { dx: 0, dy: 0 } }, ['四角']));
});

for (const p of PUZZLES) {
  test(`パズル ${p.id}：データが正しく、solution で達成率100%`, () => {
    assert.deepEqual(validateBoard(p.board), []);
    const ids = new Set(p.board.map((o) => o.id));
    for (const id of p.hint.objects) assert.ok(ids.has(id), `hint の物体 ${id}`);
    for (const w of p.words) assert.ok(WORDS[w], `単語 ${w}`);
    assert.ok(p.words.length >= 20 && p.words.length <= 30, '単語は20〜30語');
    assert.ok(judge(p.board, p.conditions).rate < 1, '最初から達成済みではない');
    let board = cloneBoard(p.board);
    for (const magic of p.solution) {
      assert.equal(validateMagic(magic, p.words), null);
      const r = applyMagic(board, magic);
      assert.ok(!r.fizzled, `不発: ${magic.words}`);
      board = r.board;
    }
    const j = judge(board, p.conditions);
    assert.deepEqual(j.results, p.conditions.map(() => true));
    assert.equal(j.rate, 1);
  });
}
