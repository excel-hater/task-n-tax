// 条件判定と達成率
import { COLORS } from '../data/words.js';
import { findObject, touches, isOnTop, isInside, gapDistance } from './world.js';

function regionOf(board, cond) {
  if (cond.region) return cond.region;
  return findObject(board, cond.zone);
}

export function evalCondition(board, cond) {
  switch (cond.type) {
    case 'color': {
      const o = findObject(board, cond.target);
      return !!o && o[cond.part] === cond.color;
    }
    case 'touch': {
      const a = findObject(board, cond.a);
      const b = findObject(board, cond.b);
      return !!a && !!b && touches(a, b);
    }
    case 'onTop': {
      const a = findObject(board, cond.a);
      const b = findObject(board, cond.b);
      return !!a && !!b && isOnTop(a, b);
    }
    case 'at': {
      const o = findObject(board, cond.target);
      const r = regionOf(board, cond);
      return !!o && !!r && isInside(o, r);
    }
    case 'size': {
      const o = findObject(board, cond.target);
      return !!o && o.w === cond.w && o.h === cond.h;
    }
    default:
      throw new Error(`未知の条件: ${cond.type}`);
  }
}

// conditions の達成状況。indices を渡すとその条件だけで達成率を計算する
export function judge(board, conditions, indices = null) {
  const use = indices ?? conditions.map((_, i) => i);
  const results = conditions.map((c) => evalCondition(board, c));
  let got = 0;
  let total = 0;
  for (const i of use) {
    total += conditions[i].points;
    if (results[i]) got += conditions[i].points;
  }
  return { results, rate: total > 0 ? got / total : 0, got, total };
}

// 未達成の条件までの「距離」の目安（NPCの評価用）。達成済みなら0
export function conditionDistance(board, cond) {
  if (evalCondition(board, cond)) return 0;
  switch (cond.type) {
    case 'touch': {
      const a = findObject(board, cond.a);
      const b = findObject(board, cond.b);
      return a && b ? gapDistance(a, b) : 10;
    }
    case 'onTop': {
      const a = findObject(board, cond.a);
      const b = findObject(board, cond.b);
      if (!a || !b) return 10;
      const dy = Math.abs(a.y + a.h - b.y);
      const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const dx = overlap >= 1 ? 0 : 1 - overlap;
      return dx + dy;
    }
    case 'at': {
      const o = findObject(board, cond.target);
      const r = regionOf(board, cond);
      if (!o || !r) return 10;
      const dx = Math.max(0, r.x - o.x) + Math.max(0, o.x + o.w - (r.x + r.w));
      const dy = Math.max(0, r.y - o.y) + Math.max(0, o.y + o.h - (r.y + r.h));
      return dx + dy;
    }
    case 'size': {
      const o = findObject(board, cond.target);
      return o ? Math.abs(o.w - cond.w) + Math.abs(o.h - cond.h) : 10;
    }
    default:
      return 1;
  }
}

function nameOf(board, id) {
  const o = findObject(board, id);
  if (!o) return id;
  return o.label ?? o.name ?? id;
}

// 条件の表示用テキスト。パズルに label があればそれを使う
export function conditionText(board, cond) {
  if (cond.label) return cond.label;
  switch (cond.type) {
    case 'color':
      return `${nameOf(board, cond.target)}の${cond.part === 'stroke' ? '枠' : '中身'}が${COLORS[cond.color].name}`;
    case 'touch':
      return `${nameOf(board, cond.a)}と${nameOf(board, cond.b)}が接する`;
    case 'onTop':
      return `${nameOf(board, cond.a)}が${nameOf(board, cond.b)}の上に乗る`;
    case 'at':
      return `${nameOf(board, cond.target)}が${cond.zone ? nameOf(board, cond.zone) : '指定の場所'}の中にある`;
    case 'size':
      return `${nameOf(board, cond.target)}の大きさが${cond.w}×${cond.h}`;
    default:
      return cond.type;
  }
}
