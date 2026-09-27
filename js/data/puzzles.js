// パズル（状況と指示）の定義。
//   board      初期盤面
//   text       指示文
//   conditions 達成条件（機械判定用）。points が配点
//   hint       ヒント段階で見せる内容 { objects: 見せる物体id, text: 伏せ字の指示文, conditions: 見えている条件の添字 }
//   words      使える単語（ダミーを含む）
//   solution   解の魔法列（テストで検証する）

const floor = { id: 'floor', kind: 'fixed', name: '床', x: 0, y: 7, w: 12, h: 1 };

function shape(id, sh, x, y, fill, opts = {}) {
  return { id, kind: 'shape', shape: sh, x, y, w: opts.w ?? 1, h: opts.h ?? 1, stroke: opts.stroke ?? 'black', fill, label: opts.label };
}
function fixed(id, name, x, y, w, h) {
  return { id, kind: 'fixed', name, x, y, w, h };
}
function zone(id, name, x, y, w, h) {
  return { id, kind: 'zone', name, x, y, w, h };
}
function m(words, dx = 0, dy = 0) {
  return { words, vector: { dx, dy } };
}

export const PUZZLES = [
  {
    id: 'p01',
    title: '棚の上の四角',
    board: [
      floor,
      fixed('shelf', '棚', 7, 4, 4, 1),
      shape('rect1', 'rect', 1, 5, 'white', { w: 2, h: 2, label: '四角' }),
      shape('circle1', 'circle', 10, 3, 'blue', { stroke: 'gray', label: '青い円' }),
      shape('tri1', 'triangle', 5, 6, 'red', { label: '三角' }),
    ],
    text: '四角の枠だけ黄色にして、中身だけ青い円と接触させた上で、棚の上に乗っける',
    conditions: [
      { type: 'color', target: 'rect1', part: 'stroke', color: 'yellow', points: 1 },
      { type: 'touch', a: 'rect1', b: 'circle1', points: 1 },
      { type: 'onTop', a: 'rect1', b: 'shelf', points: 1 },
    ],
    hint: {
      objects: ['floor', 'shelf', 'rect1'],
      text: '四角の枠だけ＿＿にして、＿＿＿＿＿＿と接触させた上で、棚の上に乗っける',
      conditions: [2],
    },
    words: ['四角', '円', '三角', '星', '赤い', '青い', '黄色い', '白い', '大きい', '小さい', '枠', '中身', '赤に', '青に', '黄色に', '緑に', '白に', '大きく', '小さく', 'そっと', 'すばやく'],
    solution: [m(['四角', '枠', '黄色に'], 4, -3), m(['四角'], 3, 0)],
  },
  {
    id: 'p02',
    title: '大きな赤い円',
    board: [
      floor,
      shape('rect1', 'rect', 2, 5, 'blue', { w: 3, h: 2, label: '青い四角' }),
      shape('circle1', 'circle', 8, 6, 'red', { label: '赤い円' }),
      shape('circle2', 'circle', 10, 6, 'yellow', { label: '黄色い円' }),
      shape('tri1', 'triangle', 5, 6, 'green', { label: '三角' }),
    ],
    text: '赤い円を大きくして青い四角の上に乗せ、三角の中身を黄色にする',
    conditions: [
      { type: 'size', target: 'circle1', w: 2, h: 2, points: 1 },
      { type: 'onTop', a: 'circle1', b: 'rect1', points: 1 },
      { type: 'color', target: 'tri1', part: 'fill', color: 'yellow', points: 1 },
    ],
    hint: {
      objects: ['floor', 'rect1', 'circle1', 'circle2'],
      text: '赤い円を＿＿＿して青い四角の上に乗せ、＿＿の中身を＿＿にする',
      conditions: [1],
    },
    words: ['四角', '円', '三角', '星', '赤い', '青い', '黄色い', '緑の', '大きい', '小さい', '枠', '中身', '赤に', '青に', '黄色に', '緑に', '紫に', '大きく', '小さく', 'ふわりと', 'しっかり'],
    solution: [m(['赤い', '円', '大きく'], -4, -2), m(['三角', '中身', '黄色に'])],
  },
  {
    id: 'p03',
    title: '壁の向こう',
    board: [
      floor,
      fixed('wall', '壁', 6, 3, 1, 4),
      shape('tri1', 'triangle', 2, 6, 'green', { label: '緑の三角' }),
      shape('circle1', 'circle', 9, 6, 'yellow', { label: '黄色い円' }),
      shape('rect1', 'rect', 0, 6, 'purple', { label: '紫の四角' }),
    ],
    text: '緑の三角と黄色い円を接触させ、両方の枠を赤にする',
    conditions: [
      { type: 'touch', a: 'tri1', b: 'circle1', points: 2 },
      { type: 'color', target: 'tri1', part: 'stroke', color: 'red', points: 1 },
      { type: 'color', target: 'circle1', part: 'stroke', color: 'red', points: 1 },
    ],
    hint: {
      objects: ['floor', 'wall', 'tri1', 'circle1'],
      text: '緑の三角と黄色い円を＿＿＿＿、両方の枠を＿にする',
      conditions: [0],
    },
    words: ['四角', '円', '三角', '赤い', '青い', '黄色い', '緑の', '紫の', '大きい', '枠', '中身', '赤に', '青に', '黄色に', '緑に', '紫に', '大きく', '小さく', 'そっと', 'すばやく'],
    solution: [m(['黄色い', '円', '枠', '赤に']), m(['三角', '枠', '赤に'], 0, -4), m(['三角'], 4, 0), m(['三角'], 2, 4)],
  },
  {
    id: 'p04',
    title: '青い箱詰め',
    board: [
      floor,
      zone('box', '箱', 9, 5, 3, 2),
      shape('rect1', 'rect', 1, 6, 'red', { label: '赤い四角' }),
      shape('rect2', 'rect', 3, 6, 'yellow', { label: '黄色い四角' }),
      shape('rect3', 'rect', 5, 5, 'white', { w: 2, h: 2, label: '大きい四角' }),
      shape('tri1', 'triangle', 7, 6, 'green', { label: '三角' }),
    ],
    text: '小さい四角を2つとも中身だけ青にして、右下の箱に入れる',
    conditions: [
      { type: 'color', target: 'rect1', part: 'fill', color: 'blue', points: 1 },
      { type: 'color', target: 'rect2', part: 'fill', color: 'blue', points: 1 },
      { type: 'at', target: 'rect1', zone: 'box', points: 1 },
      { type: 'at', target: 'rect2', zone: 'box', points: 1 },
    ],
    hint: {
      objects: ['floor', 'box', 'rect1', 'rect2'],
      text: '小さい四角を2つとも＿＿＿＿＿にして、＿＿の箱に入れる',
      conditions: [2, 3],
    },
    words: ['四角', '円', '三角', '星', '赤い', '青い', '黄色い', '白い', '大きい', '小さい', '枠', '中身', '赤に', '青に', '黄色に', '白に', '黒に', '大きく', '小さく', 'そっと', 'しっかり'],
    solution: [m(['小さい', '四角', '中身', '青に'], 4, 0), m(['小さい', '四角'], 4, 0)],
  },
  {
    id: 'p05',
    title: '育つ三角',
    board: [
      floor,
      fixed('shelf', '棚', 2, 3, 4, 1),
      shape('tri1', 'triangle', 8, 6, 'white', { label: '三角' }),
      shape('circle1', 'circle', 10, 6, 'red', { label: '円' }),
      shape('rect1', 'rect', 0, 6, 'blue', { label: '四角' }),
    ],
    text: '三角を大きくして棚の上に乗せ、三角の枠と円の中身を緑にする',
    conditions: [
      { type: 'size', target: 'tri1', w: 2, h: 2, points: 1 },
      { type: 'onTop', a: 'tri1', b: 'shelf', points: 1 },
      { type: 'color', target: 'tri1', part: 'stroke', color: 'green', points: 1 },
      { type: 'color', target: 'circle1', part: 'fill', color: 'green', points: 1 },
    ],
    hint: {
      objects: ['floor', 'shelf', 'tri1'],
      text: '三角を＿＿＿して棚の上に乗せ、三角の枠と＿の中身を＿にする',
      conditions: [0, 1],
    },
    words: ['四角', '円', '三角', '赤い', '青い', '白い', '緑の', '大きい', '小さい', '枠', '中身', '赤に', '青に', '緑に', '白に', '紫に', '大きく', '小さく', 'すばやく', 'ふわりと'],
    solution: [m(['三角', '大きく', '緑に'], 0, -4), m(['三角'], -4, 0), m(['円', '中身', '緑に'])],
  },
  {
    id: 'p06',
    title: '三つの円',
    board: [
      floor,
      fixed('shelf', '棚', 3, 4, 6, 1),
      shape('c1', 'circle', 1, 6, 'red', { label: '赤い円' }),
      shape('c2', 'circle', 5, 6, 'blue', { label: '青い円' }),
      shape('c3', 'circle', 10, 6, 'yellow', { label: '黄色い円' }),
      shape('tri1', 'triangle', 7, 6, 'green', { label: '三角' }),
    ],
    text: '3つの円をすべて棚の上に乗せる',
    conditions: [
      { type: 'onTop', a: 'c1', b: 'shelf', points: 1 },
      { type: 'onTop', a: 'c2', b: 'shelf', points: 1 },
      { type: 'onTop', a: 'c3', b: 'shelf', points: 1 },
    ],
    hint: {
      objects: ['floor', 'shelf', 'c1', 'c3'],
      text: '＿つの円をすべて棚の上に乗せる',
      conditions: [0, 2],
    },
    words: ['四角', '円', '三角', '星', '赤い', '青い', '黄色い', '緑の', '黒い', '大きい', '小さい', '枠', '中身', '赤に', '青に', '黄色に', '大きく', '小さく', 'そっと', 'しっかり'],
    solution: [
      m(['円'], 0, -3),
      m(['赤い', '円'], 2, 0),
      m(['黄色い', '円'], -2, 0),
      m(['青い', '円'], -4, 0),
      m(['青い', '円'], 0, -2),
      m(['青い', '円'], 3, 0),
    ],
  },
  {
    id: 'p07',
    title: '大小入れ替え',
    board: [
      floor,
      shape('rect1', 'rect', 1, 4, 'red', { w: 3, h: 3, label: '大きい四角' }),
      shape('rect2', 'rect', 6, 6, 'blue', { label: '小さい四角' }),
      shape('tri1', 'triangle', 10, 6, 'yellow', { label: '三角' }),
    ],
    text: '大きい四角を小さくして三角と接触させ、小さい四角は大きくする（どちらも2×2に）',
    conditions: [
      { type: 'size', target: 'rect1', w: 2, h: 2, points: 1 },
      { type: 'size', target: 'rect2', w: 2, h: 2, points: 1 },
      { type: 'touch', a: 'rect1', b: 'tri1', points: 1 },
    ],
    hint: {
      objects: ['floor', 'rect1', 'rect2'],
      text: '大きい四角を＿＿＿して＿＿と接触させ、小さい四角は大きくする（どちらも2×2に）',
      conditions: [0, 1],
    },
    words: ['四角', '円', '三角', '星', '赤い', '青い', '黄色い', '白い', '大きい', '小さい', '枠', '中身', '赤に', '青に', '黄色に', '大きく', '小さく', 'そっと', 'すばやく', 'ふわりと'],
    solution: [m(['大きい', '四角', '小さく'], 4, 0), m(['小さい', '四角', '大きく']), m(['赤い', '四角'], 4, 0)],
  },
  {
    id: 'p08',
    title: '円を下ろす',
    board: [
      floor,
      fixed('shelf', '棚', 6, 3, 5, 1),
      shape('circle1', 'circle', 8, 2, 'green', { label: '円' }),
      shape('rect1', 'rect', 1, 5, 'black', { w: 2, h: 2, stroke: 'gray', label: '黒い四角' }),
      shape('tri1', 'triangle', 9, 6, 'blue', { label: '三角' }),
    ],
    text: '黒い四角の中身を白くして、棚の上の円を床に下ろし、四角と接触させる',
    conditions: [
      { type: 'color', target: 'rect1', part: 'fill', color: 'white', points: 1 },
      { type: 'onTop', a: 'circle1', b: 'floor', points: 1 },
      { type: 'touch', a: 'circle1', b: 'rect1', points: 1 },
    ],
    hint: {
      objects: ['floor', 'shelf', 'circle1'],
      text: '＿＿＿＿の中身を＿くして、棚の上の円を床に下ろし、＿＿と接触させる',
      conditions: [1],
    },
    words: ['四角', '円', '三角', '赤い', '青い', '緑の', '白い', '黒い', '大きい', '小さい', '枠', '中身', '赤に', '青に', '緑に', '白に', '黒に', '大きく', '小さく', 'そっと', 'しっかり'],
    solution: [m(['黒い', '四角', '中身', '白に']), m(['円'], -3, 0), m(['円'], 0, 4), m(['円'], -2, 0)],
  },
  {
    id: 'p09',
    title: '三角の囲い',
    board: [
      floor,
      zone('pen', '囲い', 0, 4, 3, 3),
      fixed('shelf', '棚', 9, 3, 3, 1),
      shape('t1', 'triangle', 4, 6, 'yellow', { label: '黄色い三角' }),
      shape('t2', 'triangle', 8, 6, 'blue', { label: '青い三角' }),
      shape('t3', 'triangle', 10, 2, 'green', { label: '緑の三角' }),
      shape('circle1', 'circle', 6, 6, 'red', { label: '円' }),
    ],
    text: '三角の枠をすべて赤にして、左の囲いに集める',
    conditions: [
      { type: 'color', target: 't1', part: 'stroke', color: 'red', points: 1 },
      { type: 'color', target: 't2', part: 'stroke', color: 'red', points: 1 },
      { type: 'color', target: 't3', part: 'stroke', color: 'red', points: 1 },
      { type: 'at', target: 't1', zone: 'pen', points: 1 },
      { type: 'at', target: 't2', zone: 'pen', points: 1 },
      { type: 'at', target: 't3', zone: 'pen', points: 1 },
    ],
    hint: {
      objects: ['floor', 'pen', 't1', 't2'],
      text: '三角の＿をすべて＿にして、左の囲いに集める',
      conditions: [3, 4],
    },
    words: ['四角', '円', '三角', '赤い', '青い', '黄色い', '緑の', '白い', '小さい', '枠', '中身', '赤に', '青に', '黄色に', '緑に', '黒に', '大きく', '小さく', 'そっと', 'ふわりと'],
    solution: [m(['三角', '枠', '赤に'], -4, 0), m(['青い', '三角'], -3, 0), m(['緑の', '三角'], -4, 4)],
  },
  {
    id: 'p10',
    title: '紫の台座',
    board: [
      floor,
      fixed('stand', '台', 5, 6, 3, 1),
      shape('rect1', 'rect', 0, 6, 'purple', { label: '紫の四角' }),
      shape('circle1', 'circle', 10, 6, 'purple', { label: '紫の円' }),
    ],
    text: '紫の四角を3×3まで大きくして、枠も紫にし、台の上に乗せる',
    conditions: [
      { type: 'size', target: 'rect1', w: 3, h: 3, points: 1 },
      { type: 'onTop', a: 'rect1', b: 'stand', points: 1 },
      { type: 'color', target: 'rect1', part: 'stroke', color: 'purple', points: 1 },
    ],
    hint: {
      objects: ['floor', 'stand', 'rect1'],
      text: '紫の四角を＿＿＿まで大きくして、枠も＿にし、台の上に乗せる',
      conditions: [1],
    },
    words: ['四角', '円', '三角', '星', '赤い', '青い', '紫の', '白い', '大きい', '小さい', '枠', '中身', '赤に', '青に', '紫に', '白に', '大きく', '小さく', 'すばやく', 'しっかり'],
    solution: [m(['四角', '大きく', '枠', '紫に'], 0, -2), m(['四角', '大きく'], 4, 0), m(['四角'], 1, 1)],
  },
];

export function getPuzzle(id) {
  const p = PUZZLES.find((x) => x.id === id);
  if (!p) throw new Error(`未知のパズル: ${id}`);
  return p;
}
