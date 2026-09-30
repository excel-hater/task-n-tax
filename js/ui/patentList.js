// 特許一覧（自分 / 他人 / ゴミ箱）
import { magicText } from '../engine/magic.js';
import { canDispatch } from '../engine/game.js';
import { isUsable, ownedPatents } from '../engine/patent.js';
import { rules, isSolo, cooldownOf } from '../engine/rules.js';
import { h } from './dom.js';
import { playerName, yen } from './format.js';

// opts: { state, seat, puzzle, tab, onTab, onLoad, act, allowCast, allowPickup, allowDiscard }
export function renderPatentList(opts) {
  const { state, seat, puzzle, tab = 'mine', onTab, onLoad, act, stamp = (a) => a, allowCast = false, allowPickup = false, allowDiscard = false } = opts;
  const R = rules(state);
  const ok = (a) => canDispatch(state, stamp(a));
  const all = Object.values(state.patents);
  const visible = (p) => !p.hidden || p.owner === seat;
  const lists = {
    mine: all.filter((p) => p.owner === seat),
    others: all.filter((p) => p.owner !== null && p.owner !== seat && visible(p)),
    bin: state.bin.map((id) => state.patents[id]),
  };
  if (isSolo(state)) delete lists.others; // 1人なので他人はいない
  const labels = {
    mine: `自分 ${ownedPatents(state, seat).length}/${R.PATENT_SLOTS}`,
    others: `他人 ${lists.others?.length ?? 0}`,
    bin: `ゴミ箱 ${lists.bin.length}`,
  };

  const item = (p) => {
    const usable = isUsable(p, puzzle);
    const own = p.owner === seat;
    const buttons = [];
    if (onLoad) buttons.push(h('button', { class: 'btn btn-ghost btn-small', onclick: () => onLoad(p) }, '読み込む'));
    if (allowCast && p.owner !== null) {
      const cost = R.CAST_COST + (own ? 0 : R.LICENSE_FEE);
      const a = { type: 'CAST_PATENT', seat, patentId: p.id };
      const label = isSolo(state) ? `特許で実行 ${yen(cost)}・${(cooldownOf('CAST_PATENT') / 1000).toFixed(1)}秒` : `特許で実行 ${yen(cost)}`;
      buttons.push(h('button', { class: 'btn btn-primary btn-small', onclick: () => act(a), disabled: !ok(a) }, label));
    }
    if (allowDiscard && own) {
      const a = { type: 'DISCARD', seat, patentId: p.id };
      buttons.push(h('button', { class: 'btn btn-ghost btn-small', onclick: () => act(a), disabled: !ok(a) }, '捨てる'));
    }
    if (allowPickup && p.owner === null) {
      const a = { type: 'PICKUP', seat, patentId: p.id };
      buttons.push(h('button', { class: 'btn btn-small', onclick: () => act(a), disabled: !ok(a) }, '拾う（無料）'));
    }
    return h('li', { class: `patent${usable ? '' : ' patent-unusable'}` },
      h('div', { class: 'patent-head' },
        h('span', { class: 'patent-id' }, p.id),
        h('span', { class: 'patent-magic' }, magicText(p.magic)),
      ),
      h('div', { class: 'patent-meta' },
        p.owner === null ? 'ゴミ箱' : own ? '自分' : playerName(state, p.owner),
        ` ・ R${p.createdRound}`,
        p.hidden ? ' ・ 未公開' : '',
        usable ? '' : h('span', { class: 'badge badge-warn' }, 'この問題では使えない'),
      ),
      buttons.length ? h('div', { class: 'patent-actions' }, buttons) : null,
    );
  };

  const cur = lists[tab] ?? lists.mine;
  return h('div', { class: 'patent-list' },
    h('div', { class: 'subtabs', role: 'tablist' },
      Object.keys(lists).map((k) => h('button', { class: `subtab${k === tab ? ' subtab-on' : ''}`, role: 'tab', 'aria-selected': k === tab ? 'true' : 'false', onclick: () => onTab(k) }, labels[k])),
    ),
    cur.length ? h('ul', { class: 'patents' }, cur.map(item)) : h('p', { class: 'muted empty' }, 'ありません'),
  );
}
