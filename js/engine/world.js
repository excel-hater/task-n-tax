// 盤面・移動・幾何判定。盤面は物体の配列で、各物体はマス単位の矩形 {x, y, w, h} を持つ。
//   図形   { id, kind: 'shape', shape: 'rect'|'circle'|'triangle', x, y, w, h, stroke, fill }
//   固定物 { id, kind: 'fixed', name, x, y, w, h }      … 図形はこれと重なれない
//   区域   { id, kind: 'zone', name, x, y, w, h }       … 表示用の枠。当たり判定はない
import { CONFIG } from '../config.js';

export function cloneBoard(board) {
  return board.map((o) => ({ ...o }));
}

export function findObject(board, id) {
  return board.find((o) => o.id === id);
}

export function isShape(o) {
  return o.kind === 'shape';
}

// 面積をもって重なるか
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function span(a0, a1, b0, b1) {
  return Math.min(a1, b1) - Math.max(a0, b0);
}

// 接する：辺が隣接しているか、重なっている。角だけが触れている場合は含めない
export function touches(a, b) {
  const sx = span(a.x, a.x + a.w, b.x, b.x + b.w);
  const sy = span(a.y, a.y + a.h, b.y, b.y + b.h);
  if (sx < 0 || sy < 0) return false;
  return sx > 0 || sy > 0;
}

// a の下端が b の上端にちょうど接し、横方向に1マス以上重なる
export function isOnTop(a, b) {
  return a.y + a.h === b.y && span(a.x, a.x + a.w, b.x, b.x + b.w) >= 1;
}

export function isInside(a, region) {
  return a.x >= region.x && a.y >= region.y && a.x + a.w <= region.x + region.w && a.y + a.h <= region.y + region.h;
}

export function inGrid(r) {
  return r.x >= 0 && r.y >= 0 && r.w >= 1 && r.h >= 1 && r.x + r.w <= CONFIG.GRID_W && r.y + r.h <= CONFIG.GRID_H;
}

// 図形をこの矩形に置けるか（盤面内で、固定物と重ならない）
export function canPlace(board, rect) {
  if (!inGrid(rect)) return false;
  return !board.some((o) => o.kind === 'fixed' && rectsOverlap(o, rect));
}

// 1マスずつ動かす。各ステップで x → y の順に1マス進め、進めない軸はそこで止まる（もう一方の軸は進み続ける）
export function moveShape(board, shape, dx, dy) {
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  let remX = Math.abs(dx);
  let remY = Math.abs(dy);
  let { x, y } = shape;
  for (let i = 0; i < steps; i++) {
    if (remX > 0) {
      const cand = { x: x + sx, y, w: shape.w, h: shape.h };
      if (canPlace(board, cand)) {
        x = cand.x;
        remX--;
      } else remX = 0;
    }
    if (remY > 0) {
      const cand = { x, y: y + sy, w: shape.w, h: shape.h };
      if (canPlace(board, cand)) {
        y = cand.y;
        remY--;
      } else remY = 0;
    }
  }
  shape.x = x;
  shape.y = y;
}

// 大きさを ±1 する。左下を基準に、右と上へ伸び縮みする。置けない場合は変化しない
export function resizeShape(board, shape, delta) {
  const w = shape.w + delta;
  const h = shape.h + delta;
  if (w < 1 || h < 1) return false;
  const cand = { x: shape.x, y: shape.y + shape.h - h, w, h };
  if (!canPlace(board, cand)) return false;
  Object.assign(shape, cand);
  return true;
}

export function area(o) {
  return o.w * o.h;
}

// 2つの矩形の隙間（マンハッタン距離）。接していれば0。NPCの評価に使う
export function gapDistance(a, b) {
  const gx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
  const gy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  if (gx === 0 && gy === 0 && !touches(a, b)) return 1; // 角だけ触れている
  return gx + gy;
}

export function validateBoard(board) {
  const errors = [];
  const ids = new Set();
  for (const o of board) {
    if (ids.has(o.id)) errors.push(`id重複: ${o.id}`);
    ids.add(o.id);
    if (!inGrid(o)) errors.push(`盤面外: ${o.id}`);
    if (o.kind === 'shape' && !canPlace(board, o)) errors.push(`固定物と重なる: ${o.id}`);
  }
  return errors;
}
