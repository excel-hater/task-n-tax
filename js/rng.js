// シード付き乱数（mulberry32）。状態は32bit整数1つなので GameState にそのまま保存できる。

export function seedFrom(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value >>> 0;
  const s = String(value ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 1つ乱数を引く。{ value: [0,1), state: 次の状態 } を返す
export function rngNext(state) {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: next };
}

// 状態を内部に持つ乱数生成器。NPCやシャッフルの一時利用向け
export function createRng(seed) {
  let state = seedFrom(seed);
  return {
    next() {
      const r = rngNext(state);
      state = r.state;
      return r.value;
    },
    int(n) {
      return Math.floor(this.next() * n);
    },
    get state() {
      return state;
    },
  };
}

export function shuffle(array, rng) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 複数の値から決定的なシードを作る
export function mixSeed(...parts) {
  return seedFrom(parts.join('|'));
}
