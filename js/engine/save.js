// 保存・読込。GameState はプレーンオブジェクトなので JSON にそのまま変換できる
import { STATE_VERSION } from './game.js';

export function serialize(state) {
  return JSON.stringify(state);
}

export function deserialize(text) {
  const state = JSON.parse(text);
  if (!state || state.version !== STATE_VERSION) throw new Error('保存データの形式が違います');
  return state;
}

// storage は localStorage 互換（getItem / setItem / removeItem）
export function saveTo(storage, key, state) {
  storage.setItem(key, serialize(state));
}

export function loadFrom(storage, key) {
  const text = storage.getItem(key);
  if (!text) return null;
  try {
    return deserialize(text);
  } catch {
    return null;
  }
}

export function clearSave(storage, key) {
  storage.removeItem(key);
}
