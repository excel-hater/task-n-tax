// モードごとのルール（数値）。ひとりで挑戦（solo）は CONFIG.SOLO.RULES で通常の値を上書きする
import { CONFIG } from '../config.js';

const SOLO_RULES = { ...CONFIG, ...CONFIG.SOLO.RULES };

export function rules(state) {
  return state?.mode === 'solo' ? SOLO_RULES : CONFIG;
}

export function isSolo(state) {
  return state?.mode === 'solo';
}

// solo のタイムボーナス
export function timeBonus(rate, timeMs) {
  const { TIME_BONUS_MAX, TIME_BONUS_ZERO_MS } = CONFIG.SOLO;
  return Math.floor(TIME_BONUS_MAX * rate * Math.max(0, 1 - timeMs / TIME_BONUS_ZERO_MS) + 1e-9);
}

export function cooldownOf(type) {
  return CONFIG.SOLO.COOLDOWN_MS[type] ?? 0;
}
