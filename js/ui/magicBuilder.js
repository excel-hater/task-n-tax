// 魔法作成パネル：単語タイル・ベクトルパッド
import { CONFIG } from '../config.js';
import { WORDS, WORD_KIND_LABEL } from '../data/words.js';
import { vectorText } from '../engine/magic.js';
import { h } from './dom.js';

const KIND_ORDER = ['shape', 'prop', 'part', 'effect', 'filler'];

export function emptyMagic() {
  return { words: [], vector: { dx: 0, dy: 0 } };
}

// magic: 現在の魔法 / words: 使える単語 / onChange(newMagic)
export function renderMagicBuilder({ magic, words, onChange, disabled = false }) {
  const full = magic.words.length >= CONFIG.MAX_WORDS;
  const toggle = (w) => {
    const has = magic.words.includes(w);
    if (!has && full) return;
    onChange({ ...magic, words: has ? magic.words.filter((x) => x !== w) : [...magic.words, w] });
  };
  const setVec = (dx, dy) => {
    const m = CONFIG.VECTOR_MAX;
    const clamp = (n) => Math.max(-m, Math.min(m, n));
    onChange({ ...magic, vector: { dx: clamp(dx), dy: clamp(dy) } });
  };

  const selected = h('div', { class: 'spell' },
    h('span', { class: 'spell-label' }, '魔法'),
    magic.words.length
      ? magic.words.map((w) => h('button', { class: 'chip chip-on', onclick: () => toggle(w), disabled, title: '外す' }, w, h('span', { class: 'chip-x', 'aria-hidden': 'true' }, '×')))
      : h('span', { class: 'muted' }, `単語を選んでください（最大${CONFIG.MAX_WORDS}語）`),
    h('span', { class: 'spell-vec' }, vectorText(magic.vector)),
    h('button', { class: 'btn btn-ghost btn-small', onclick: () => onChange({ words: [], vector: { dx: 0, dy: 0 } }), disabled }, 'クリア'),
  );

  const groups = KIND_ORDER.map((kind) => {
    const ws = words.filter((w) => WORDS[w].kind === kind);
    if (!ws.length) return null;
    return h('div', { class: 'tile-group' },
      h('div', { class: 'tile-kind' }, WORD_KIND_LABEL[kind]),
      h('div', { class: 'tiles' }, ws.map((w) => {
        const on = magic.words.includes(w);
        return h('button', {
          class: `tile tile-${kind}${on ? ' tile-on' : ''}`,
          onclick: () => toggle(w),
          disabled: disabled || (!on && full),
          'aria-pressed': on ? 'true' : 'false',
        }, w);
      })),
    );
  });

  const { dx, dy } = magic.vector;
  const m = CONFIG.VECTOR_MAX;
  const pad = h('div', { class: 'vpad' },
    h('div', { class: 'vpad-grid' },
      h('span'),
      h('button', { class: 'vbtn', onclick: () => setVec(dx, dy - 1), disabled: disabled || dy <= -m, 'aria-label': '上へ' }, '↑'),
      h('span'),
      h('button', { class: 'vbtn', onclick: () => setVec(dx - 1, dy), disabled: disabled || dx <= -m, 'aria-label': '左へ' }, '←'),
      h('button', { class: 'vbtn vbtn-center', onclick: () => setVec(0, 0), disabled, 'aria-label': '移動なし' }, '0'),
      h('button', { class: 'vbtn', onclick: () => setVec(dx + 1, dy), disabled: disabled || dx >= m, 'aria-label': '右へ' }, '→'),
      h('span'),
      h('button', { class: 'vbtn', onclick: () => setVec(dx, dy + 1), disabled: disabled || dy >= m, 'aria-label': '下へ' }, '↓'),
      h('span'),
    ),
    h('div', { class: 'vpad-info' },
      h('div', { class: 'vpad-title' }, 'ベクトル（移動）'),
      h('div', { class: 'vpad-value' }, vectorText(magic.vector)),
      h('div', { class: 'muted small' }, `横・縦それぞれ −${m}〜+${m}`),
    ),
  );

  return h('section', { class: 'card magic-builder' },
    h('h3', {}, '魔法をつくる'),
    selected,
    h('div', { class: 'builder-body' }, h('div', { class: 'tile-groups' }, groups), pad),
  );
}
