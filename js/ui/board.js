// 盤面のSVG描画とプレビュー
import { CONFIG } from '../config.js';
import { COLORS } from '../data/words.js';
import { applyMagic, selectTargets, validateMagic } from '../engine/magic.js';
import { s, h } from './dom.js';

const C = CONFIG.UI.CELL;

function hex(color) {
  return COLORS[color]?.hex ?? '#888';
}

function shapeEl(o, extra = {}) {
  const pad = 4;
  const x = o.x * C + pad;
  const y = o.y * C + pad;
  const w = o.w * C - pad * 2;
  const hh = o.h * C - pad * 2;
  const attrs = { fill: hex(o.fill), stroke: hex(o.stroke), 'stroke-width': 5, 'stroke-linejoin': 'round', ...extra };
  if (o.shape === 'rect') return s('rect', { x, y, width: w, height: hh, rx: 3, ...attrs });
  if (o.shape === 'circle') return s('ellipse', { cx: x + w / 2, cy: y + hh / 2, rx: w / 2, ry: hh / 2, ...attrs });
  return s('polygon', { points: `${x + w / 2},${y} ${x + w},${y + hh} ${x},${y + hh}`, ...attrs });
}

function changed(a, b) {
  return a.x !== b.x || a.y !== b.y || a.w !== b.w || a.h !== b.h || a.fill !== b.fill || a.stroke !== b.stroke;
}

// board: 描画する盤面 / magic: プレビューする魔法（任意） / hidden: ヒント段階の伏せ表示
export function renderBoard(board, { magic = null, allowedWords = null, hint = false, caption = null } = {}) {
  const W = CONFIG.GRID_W * C;
  const H = CONFIG.GRID_H * C;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'board', role: 'img', 'aria-label': '盤面' });

  // マス目
  const grid = s('g', { class: 'grid' });
  for (let x = 0; x <= CONFIG.GRID_W; x++) grid.append(s('line', { x1: x * C, y1: 0, x2: x * C, y2: H }));
  for (let y = 0; y <= CONFIG.GRID_H; y++) grid.append(s('line', { x1: 0, y1: y * C, x2: W, y2: y * C }));
  svg.append(s('rect', { x: 0, y: 0, width: W, height: H, class: 'board-bg' }), grid);

  for (const o of board.filter((q) => q.kind === 'zone')) {
    svg.append(
      s('rect', { x: o.x * C + 2, y: o.y * C + 2, width: o.w * C - 4, height: o.h * C - 4, class: 'zone', rx: 6 }),
      s('text', { x: o.x * C + 8, y: o.y * C + 18, class: 'zone-label' }, o.name),
    );
  }
  for (const o of board.filter((q) => q.kind === 'fixed')) {
    svg.append(
      s('rect', { x: o.x * C, y: o.y * C, width: o.w * C, height: o.h * C, class: 'fixed' }),
      s('text', { x: (o.x + o.w / 2) * C, y: (o.y + o.h / 2) * C + 6, class: 'fixed-label', 'text-anchor': 'middle' }, o.name),
    );
  }

  let preview = null;
  let targetIds = new Set();
  if (magic && magic.words.length && !validateMagic(magic, allowedWords)) {
    preview = applyMagic(board, magic).board;
    targetIds = new Set(selectTargets(board, magic.words).map((o) => o.id));
  }

  for (const o of board.filter((q) => q.kind === 'shape')) {
    if (targetIds.has(o.id)) {
      svg.append(s('rect', { x: o.x * C, y: o.y * C, width: o.w * C, height: o.h * C, class: 'target-ring', rx: 6 }));
    }
    svg.append(shapeEl(o));
  }

  if (preview) {
    const g = s('g', { class: 'preview' });
    for (const o of preview.filter((q) => q.kind === 'shape')) {
      const before = board.find((q) => q.id === o.id);
      if (!changed(before, o)) continue;
      const bx = (before.x + before.w / 2) * C;
      const by = (before.y + before.h / 2) * C;
      const ax = (o.x + o.w / 2) * C;
      const ay = (o.y + o.h / 2) * C;
      if (bx !== ax || by !== ay) g.append(s('line', { x1: bx, y1: by, x2: ax, y2: ay, class: 'preview-arrow', 'marker-end': 'url(#arrowhead)' }));
      g.append(shapeEl(o, { 'stroke-dasharray': '6 4', opacity: 0.55 }));
    }
    svg.append(
      s('defs', {}, s('marker', { id: 'arrowhead', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
        s('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'arrowhead' }))),
      g,
    );
  }

  if (hint) svg.append(s('text', { x: W - 12, y: 28, class: 'hint-mark', 'text-anchor': 'end' }, '一部だけ表示中'));

  return h('figure', { class: 'board-wrap' }, svg, caption ? h('figcaption', {}, caption) : null);
}

// プレビュー後の盤面（UIの条件表示用）
export function previewBoard(board, magic, allowedWords) {
  if (!magic || !magic.words.length || validateMagic(magic, allowedWords)) return null;
  return applyMagic(board, magic).board;
}
