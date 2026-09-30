// ひとりで挑戦のベスト記録（シードごと）。保存はUI側（localStorage）で行う
// records: { [seed]: { best: { score, timeMs, date }, plays } }

export function isBetter(a, b) {
  if (!b) return true;
  return a.score > b.score || (a.score === b.score && a.timeMs < b.timeMs);
}

export function updateRecords(records, { seed, score, timeMs, date }) {
  const key = String(seed);
  const prev = records?.[key];
  const run = { score, timeMs, date };
  const isBest = isBetter(run, prev?.best);
  const entry = { best: isBest ? run : prev.best, plays: (prev?.plays ?? 0) + 1 };
  return { records: { ...(records ?? {}), [key]: entry }, isBest, previousBest: prev?.best ?? null };
}

export function bestOf(records, seed) {
  return records?.[String(seed)]?.best ?? null;
}

// ゲームの結果（スコアと合計タイム）
export function soloResult(state) {
  const p = state.players[0];
  const timeMs = state.roundResults.reduce((sum, r) => sum + (r.players[0].timeMs ?? 0), 0);
  return { seed: state.seedLabel ?? String(state.seed), score: p.money, timeMs };
}

export function formatTime(ms) {
  if (ms === null || ms === undefined) return '−';
  const total = Math.max(0, ms) / 1000;
  const m = Math.floor(total / 60);
  const s = total - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
