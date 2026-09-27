// 魔法の解釈と適用。魔法 = { words: [単語...], vector: { dx, dy } }
import { CONFIG } from '../config.js';
import { WORDS, wordInfo } from '../data/words.js';
import { cloneBoard, isShape, moveShape, resizeShape, area } from './world.js';

export function parseMagic(magic) {
  const res = { targets: [], parts: [], colors: [], grow: 0 };
  for (const w of magic.words) {
    const info = wordInfo(w);
    if (info.kind === 'shape' || info.kind === 'prop') res.targets.push(info);
    else if (info.kind === 'part') res.parts.push(info.part);
    else if (info.kind === 'effect') {
      if (info.color) res.colors.push(info.color);
      if (info.grow) res.grow += info.grow;
    }
  }
  return res;
}

// 問題があればエラー文を返す。allowedWords を渡すとその単語だけを許す
export function validateMagic(magic, allowedWords = null) {
  if (!magic || !Array.isArray(magic.words) || !magic.vector) return '魔法の形式が不正です';
  const { words, vector } = magic;
  if (words.length < 1) return '単語を1つ以上選んでください';
  if (words.length > CONFIG.MAX_WORDS) return `単語は${CONFIG.MAX_WORDS}語までです`;
  if (new Set(words).size !== words.length) return '同じ単語は2回使えません';
  for (const w of words) {
    if (!WORDS[w]) return `未知の単語: ${w}`;
    if (allowedWords && !allowedWords.includes(w)) return `この問題では使えない単語: ${w}`;
  }
  const { dx, dy } = vector;
  const m = CONFIG.VECTOR_MAX;
  if (!Number.isInteger(dx) || !Number.isInteger(dy) || Math.abs(dx) > m || Math.abs(dy) > m) {
    return `ベクトルは −${m}〜+${m} の整数です`;
  }
  return null;
}

function matches(shape, t) {
  if (t.kind === 'shape') return shape.shape === t.shape;
  if (t.color) return shape.fill === t.color;
  if (t.size === 'big') return area(shape) >= CONFIG.SIZE_BIG_MIN_AREA;
  if (t.size === 'small') return area(shape) <= CONFIG.SIZE_SMALL_MAX_AREA;
  return false;
}

// 対象語をすべて満たす図形（AND）。対象語がなければ空
export function selectTargets(board, words) {
  const targets = [];
  for (const w of words) {
    const info = WORDS[w];
    if (info && (info.kind === 'shape' || info.kind === 'prop')) targets.push(info);
  }
  if (targets.length === 0) return [];
  return board.filter((o) => isShape(o) && targets.every((t) => matches(o, t)));
}

// 盤面に魔法を適用する。元の盤面は変えず、新しい盤面を返す
export function applyMagic(board, magic) {
  const next = cloneBoard(board);
  const parsed = parseMagic(magic);
  const targets = selectTargets(next, magic.words);
  if (targets.length === 0) return { board: next, targetIds: [], fizzled: true };
  const parts = parsed.parts.length ? parsed.parts : ['stroke', 'fill'];
  for (const s of targets) {
    for (const c of parsed.colors) for (const p of parts) s[p] = c;
    const step = Math.sign(parsed.grow);
    for (let i = 0; i < Math.abs(parsed.grow); i++) resizeShape(next, s, step);
    moveShape(next, s, magic.vector.dx, magic.vector.dy);
  }
  return { board: next, targetIds: targets.map((t) => t.id), fizzled: false };
}

export function magicKey(magic) {
  return `${magic.words.slice().sort().join(',')}|${magic.vector.dx},${magic.vector.dy}`;
}

export function vectorText(v) {
  const f = (n) => (n > 0 ? `+${n}` : `${n}`);
  return `(${f(v.dx)}, ${f(v.dy)})`;
}

export function magicText(magic) {
  return `［${magic.words.join('・')}］${vectorText(magic.vector)}`;
}

export function copyMagic(magic) {
  return { words: magic.words.slice(), vector: { dx: magic.vector.dx, dy: magic.vector.dy } };
}
