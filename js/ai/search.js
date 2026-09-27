// 候補魔法の列挙と評価（NPCの解の探索）。DOMに依存しない。
// 戦略を差し替えやすいように、評価関数と探索を分けている。
import { CONFIG } from '../config.js';
import { WORDS } from '../data/words.js';
import { applyMagic, selectTargets } from '../engine/magic.js';
import { judge, conditionDistance } from '../engine/judge.js';

// 盤面の評価値：達成率 × 重み − 未達成の条件までの距離 × 重み
export function evaluate(board, conditions, indices = null) {
  const idx = indices ?? conditions.map((_, i) => i);
  const j = judge(board, conditions, idx);
  let dist = 0;
  for (const i of idx) if (!j.results[i]) dist += conditionDistance(board, conditions[i]) * conditions[i].points;
  return { score: j.rate * CONFIG.NPC.RATE_WEIGHT - dist * CONFIG.NPC.DIST_WEIGHT, rate: j.rate };
}

function vectors() {
  const res = [];
  const m = CONFIG.VECTOR_MAX;
  for (let dx = -m; dx <= m; dx++) for (let dy = -m; dy <= m; dy++) res.push({ dx, dy });
  return res;
}
const ALL_VECTORS = vectors();

// 同じ対象集合を選ぶ単語の組み合わせをまとめる。{ key, ids, combos: [[words...]] }
export function targetGroups(board, words) {
  const targetWords = words.filter((w) => WORDS[w].kind === 'shape' || WORDS[w].kind === 'prop');
  const combos = targetWords.map((w) => [w]);
  for (let i = 0; i < targetWords.length; i++) {
    for (let j = i + 1; j < targetWords.length; j++) combos.push([targetWords[i], targetWords[j]]);
  }
  const groups = new Map();
  for (const c of combos) {
    const ids = selectTargets(board, c).map((o) => o.id);
    if (ids.length === 0) continue;
    const key = ids.slice().sort().join(',');
    if (!groups.has(key)) groups.set(key, { key, ids, combos: [] });
    const g = groups.get(key);
    if (g.combos.length < CONFIG.NPC.WORD_COMBOS_PER_TARGET) g.combos.push(c);
  }
  return [...groups.values()];
}

// 効果語の組み合わせ（効果なしを含む）
export function effectOptions(words) {
  const has = (w) => words.includes(w);
  const res = [[]];
  const parts = [null, has('枠') ? '枠' : null, has('中身') ? '中身' : null];
  for (const w of words) {
    const info = WORDS[w];
    if (info.kind !== 'effect') continue;
    if (info.color) {
      res.push([w]);
      for (const part of parts.slice(1)) if (part) res.push([part, w]);
    } else res.push([w]);
  }
  return res;
}

function tieBreak(a, b) {
  return b.score - a.score || a.magic.words.length - b.magic.words.length ||
    Math.abs(a.magic.vector.dx) + Math.abs(a.magic.vector.dy) - (Math.abs(b.magic.vector.dx) + Math.abs(b.magic.vector.dy));
}

// 盤面から評価の高い候補魔法を返す（良い順）。
// opts: { conditions, indices, words, sampleRate, scoreNoise, rng }
export function searchCandidates(board, opts) {
  const { conditions, indices = null, words, sampleRate = 1, scoreNoise = 0, rng = null } = opts;
  const rand = () => (rng ? rng.next() : Math.random());
  const effects = effectOptions(words);
  const out = [];
  const evalMagic = (magic, group, effect) => {
    const r = applyMagic(board, magic);
    const e = evaluate(r.board, conditions, indices);
    const noise = scoreNoise ? (rand() * 2 - 1) * scoreNoise : 0;
    const c = { magic, score: e.score + noise, trueScore: e.score, rate: e.rate, group, effect };
    out.push(c);
    return c;
  };
  for (const group of targetGroups(board, words)) {
    const base = group.combos[0];
    const effRes = [];
    for (const eff of effects) {
      if (base.length + eff.length > CONFIG.MAX_WORDS) continue;
      if (eff.length && rand() > sampleRate) continue;
      effRes.push(evalMagic({ words: [...base, ...eff], vector: { dx: 0, dy: 0 } }, group, eff));
    }
    const vecRes = [];
    for (const v of ALL_VECTORS) {
      if (v.dx === 0 && v.dy === 0) continue;
      if (rand() > sampleRate) continue;
      vecRes.push(evalMagic({ words: base.slice(), vector: v }, group, []));
    }
    const topE = effRes.filter((c) => c.effect.length).sort(tieBreak).slice(0, CONFIG.NPC.TOP_EFFECTS);
    const topV = vecRes.sort(tieBreak).slice(0, CONFIG.NPC.TOP_VECTORS);
    for (const e of topE) {
      for (const v of topV) {
        evalMagic({ words: [...base, ...e.effect], vector: { ...v.magic.vector } }, group, e.effect);
      }
    }
  }
  return out.sort(tieBreak);
}

// 候補の魔法について、同じ効果を持つ別の単語の組み合わせを列挙する（クレームを避ける言い換え用）
export function alternativeWordings(candidate) {
  return candidate.group.combos.map((c) => ({ words: [...c, ...candidate.effect], vector: { ...candidate.magic.vector } }))
    .filter((m) => m.words.length <= CONFIG.MAX_WORDS);
}
