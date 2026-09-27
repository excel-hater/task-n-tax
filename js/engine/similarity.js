// 魔法の類似度 = w × ベクトル類似度 + (1 − w) × 単語類似度
import { CONFIG } from '../config.js';

export function vectorSimilarity(a, b) {
  const za = a.dx === 0 && a.dy === 0;
  const zb = b.dx === 0 && b.dy === 0;
  if (za && zb) return 1;
  if (za || zb) return 0;
  const la = Math.hypot(a.dx, a.dy);
  const lb = Math.hypot(b.dx, b.dy);
  const cos = (a.dx * b.dx + a.dy * b.dy) / (la * lb);
  return Math.max(0, cos) * (Math.min(la, lb) / Math.max(la, lb));
}

export function wordSimilarity(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function similarity(m1, m2) {
  const w = CONFIG.SIMILARITY_VECTOR_WEIGHT;
  const s = w * vectorSimilarity(m1.vector, m2.vector) + (1 - w) * wordSimilarity(m1.words, m2.words);
  // 浮動小数点の誤差で境界がぶれないように丸める
  return Math.round(s * 1e9) / 1e9;
}

export function claimPayout(sim) {
  return Math.floor(CONFIG.CLAIM_PAYOUT_BASE * sim + 1e-9);
}
