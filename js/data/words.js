// 単語辞書。魔法は単語列（1〜MAX_WORDS語）＋ベクトルでできている。
// kind:
//   shape  … 対象を形で絞り込む
//   prop   … 対象を現在の中身の色や大きさで絞り込む
//   part   … 色の効果をかける場所（省略すると枠と中身の両方）
//   effect … 対象を変化させる
//   filler … 意味を持たない飾りの言葉（ダミー）

export const COLORS = {
  red: { name: '赤', hex: '#e5484d' },
  blue: { name: '青', hex: '#3b82f6' },
  yellow: { name: '黄色', hex: '#f5c518' },
  green: { name: '緑', hex: '#30a46c' },
  white: { name: '白', hex: '#f8fafc' },
  black: { name: '黒', hex: '#1f2430' },
  purple: { name: '紫', hex: '#8e4ec6' },
  gray: { name: '灰色', hex: '#9aa3ad' },
};

export const SHAPES = {
  rect: '四角',
  circle: '円',
  triangle: '三角',
};

const list = [
  // 対象（形）
  { w: '四角', kind: 'shape', shape: 'rect' },
  { w: '円', kind: 'shape', shape: 'circle' },
  { w: '三角', kind: 'shape', shape: 'triangle' },
  { w: '星', kind: 'shape', shape: 'star' },
  // 対象（性質）
  { w: '赤い', kind: 'prop', color: 'red' },
  { w: '青い', kind: 'prop', color: 'blue' },
  { w: '黄色い', kind: 'prop', color: 'yellow' },
  { w: '緑の', kind: 'prop', color: 'green' },
  { w: '白い', kind: 'prop', color: 'white' },
  { w: '黒い', kind: 'prop', color: 'black' },
  { w: '紫の', kind: 'prop', color: 'purple' },
  { w: '大きい', kind: 'prop', size: 'big' },
  { w: '小さい', kind: 'prop', size: 'small' },
  // 部位
  { w: '枠', kind: 'part', part: 'stroke' },
  { w: '中身', kind: 'part', part: 'fill' },
  // 効果
  { w: '赤に', kind: 'effect', color: 'red' },
  { w: '青に', kind: 'effect', color: 'blue' },
  { w: '黄色に', kind: 'effect', color: 'yellow' },
  { w: '緑に', kind: 'effect', color: 'green' },
  { w: '白に', kind: 'effect', color: 'white' },
  { w: '黒に', kind: 'effect', color: 'black' },
  { w: '紫に', kind: 'effect', color: 'purple' },
  { w: '大きく', kind: 'effect', grow: 1 },
  { w: '小さく', kind: 'effect', grow: -1 },
  // 飾り
  { w: 'そっと', kind: 'filler' },
  { w: 'すばやく', kind: 'filler' },
  { w: 'ふわりと', kind: 'filler' },
  { w: 'しっかり', kind: 'filler' },
];

export const WORDS = Object.fromEntries(list.map((e) => [e.w, e]));

export function wordInfo(w) {
  const info = WORDS[w];
  if (!info) throw new Error(`未知の単語: ${w}`);
  return info;
}

export const WORD_KIND_LABEL = {
  shape: '対象',
  prop: '性質',
  part: '部位',
  effect: '効果',
  filler: '飾り',
};
