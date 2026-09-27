// タイトル / 設定画面
import { CONFIG } from '../../config.js';
import { h } from '../dom.js';

export const MODES = {
  versus: { label: '対戦', desc: '2〜4人。各席を人間かNPCに設定して、1台の端末を回して遊びます' },
  solo: { label: '一人遊び', desc: 'あなた1人とNPCで遊びます' },
  watch: { label: '観戦', desc: '全員NPC。バランス確認用に眺めます' },
};

export function defaultSetup() {
  return {
    mode: 'solo',
    count: 4,
    seats: [
      { name: 'あなた', kind: 'human', npcLevel: 2 },
      { name: 'アルマ', kind: 'npc', npcLevel: 2 },
      { name: 'ベルン', kind: 'npc', npcLevel: 2 },
      { name: 'セシル', kind: 'npc', npcLevel: 2 },
    ],
    seed: '',
    npcSpeed: 'normal',
  };
}

// モードに合わせて席の種類を決める
export function seatsForMode(setup) {
  const seats = setup.seats.slice(0, setup.count).map((s) => ({ ...s }));
  if (setup.mode === 'solo') seats.forEach((s, i) => (s.kind = i === 0 ? 'human' : 'npc'));
  if (setup.mode === 'watch') seats.forEach((s) => (s.kind = 'npc'));
  return seats;
}

export function renderTitle(app) {
  return h('main', { class: 'screen title-screen' },
    h('div', { class: 'title-hero' },
      h('div', { class: 'title-mark', 'aria-hidden': 'true' }, '✦'),
      h('h1', {}, '魔法特許ゲーム'),
      h('p', { class: 'lead' }, '魔法を先に発明して特許を取り、他人が使うたびに使用料を稼ごう。'),
    ),
    h('div', { class: 'title-actions' },
      app.hasSave() ? h('button', { class: 'btn btn-primary btn-large', onclick: () => app.resume() }, 'つづきから') : null,
      h('button', { class: `btn ${app.hasSave() ? '' : 'btn-primary '}btn-large`, onclick: () => app.setUi({ screen: 'setup' }) }, 'あたらしく始める'),
      h('button', { class: 'btn btn-ghost btn-large', onclick: () => app.showRules() }, '遊び方'),
    ),
  );
}

export function renderSetup(app) {
  const st = app.ui.setup;
  const set = (patch) => app.setUi({ setup: { ...st, ...patch } });
  const setSeat = (i, patch) => set({ seats: st.seats.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const seats = seatsForMode(st);
  const humans = seats.filter((s) => s.kind === 'human').length;

  const modeBtns = Object.entries(MODES).map(([k, m]) =>
    h('button', { class: `seg${st.mode === k ? ' seg-on' : ''}`, onclick: () => set({ mode: k }), 'aria-pressed': st.mode === k ? 'true' : 'false' }, m.label));

  const counts = [];
  for (let n = CONFIG.MIN_PLAYERS; n <= CONFIG.MAX_PLAYERS; n++) {
    counts.push(h('button', { class: `seg${st.count === n ? ' seg-on' : ''}`, onclick: () => set({ count: n }) }, `${n}人`));
  }

  const seatRows = seats.map((s, i) => h('div', { class: 'seat-row' },
    h('span', { class: 'seat-no' }, `席${i + 1}`),
    h('input', { class: 'input', value: st.seats[i].name, maxlength: 10, 'aria-label': `席${i + 1}の名前`, oninput: (e) => { st.seats[i].name = e.target.value; } }),
    st.mode === 'versus'
      ? h('select', { class: 'input', 'aria-label': `席${i + 1}の種類`, onchange: (e) => setSeat(i, { kind: e.target.value }) },
        h('option', { value: 'human', selected: s.kind === 'human' }, '人間'),
        h('option', { value: 'npc', selected: s.kind === 'npc' }, 'NPC'))
      : h('span', { class: 'seat-kind' }, s.kind === 'human' ? '人間' : 'NPC'),
    s.kind === 'npc'
      ? h('select', { class: 'input', 'aria-label': `席${i + 1}のNPCの強さ`, onchange: (e) => setSeat(i, { npcLevel: Number(e.target.value) }) },
        Object.entries(CONFIG.NPC.LEVELS).map(([lv, info]) => h('option', { value: lv, selected: Number(lv) === s.npcLevel }, info.label)))
      : h('span', { class: 'seat-kind muted' }, '−'),
  ));

  const valid = st.mode !== 'versus' || humans >= 1;

  return h('main', { class: 'screen setup-screen' },
    h('h2', {}, 'ゲームの設定'),
    h('section', { class: 'card' },
      h('h3', {}, 'モード'),
      h('div', { class: 'segs' }, modeBtns),
      h('p', { class: 'muted' }, MODES[st.mode].desc),
      h('h3', {}, '人数'),
      h('div', { class: 'segs' }, counts),
      h('h3', {}, 'プレイヤー'),
      h('div', { class: 'seats' }, seatRows),
      st.mode === 'versus' && humans === 0 ? h('p', { class: 'warn' }, '人間が1人もいません。全員NPCなら「観戦」を選んでください') : null,
    ),
    h('section', { class: 'card' },
      h('h3', {}, 'オプション'),
      h('label', { class: 'field' }, h('span', {}, 'シード（空欄ならランダム）'),
        h('input', { class: 'input', value: st.seed, placeholder: '例：1234', oninput: (e) => { st.seed = e.target.value; } })),
      h('label', { class: 'field' }, h('span', {}, 'NPCの速さ'),
        h('select', { class: 'input', onchange: (e) => set({ npcSpeed: e.target.value }) },
          [['slow', 'ゆっくり'], ['normal', 'ふつう'], ['fast', 'はやい']].map(([v, l]) => h('option', { value: v, selected: st.npcSpeed === v }, l)))),
    ),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-ghost', onclick: () => app.setUi({ screen: 'title' }) }, 'もどる'),
      h('button', { class: 'btn btn-primary btn-large', disabled: !valid, onclick: () => app.newGame() }, 'ゲーム開始'),
    ),
  );
}

export function rulesBody() {
  const c = CONFIG;
  return h('div', { class: 'rules' },
    h('p', {}, `${c.ROUNDS}ラウンドで、最後に所持金がいちばん多い人の勝ち。初期所持金は${c.INITIAL_MONEY}G。`),
    h('h4', {}, '1ラウンドの流れ'),
    h('ol', {},
      h('li', {}, h('b', {}, 'ヒント：'), `盤面と指示の一部だけが見えます。全体を予想して、魔法を${c.PREPATENT_FREE_MAX}つまで無料で特許にできます。`),
      h('li', {}, h('b', {}, '全体公開：'), '盤面と指示の全体、全員の先行特許が公開されます。'),
      h('li', {}, h('b', {}, '行動：'), `手番ごとに${c.ACTIONS_PER_TURN}回まで行動。魔法で自分の盤面を操作して、指示の達成をめざします。`),
      h('li', {}, h('b', {}, '解答：'), `「解答」を押すと、達成率×${c.CLEAR_REWARD}G と、解答の早さに応じた順位ボーナス（${c.RANK_BONUS.join(' / ')}G、達成率${c.RANK_BONUS_MIN_RATE * 100}%以上）がもらえます。`),
    ),
    h('h4', {}, '魔法'),
    h('p', {}, `単語（1〜${c.MAX_WORDS}語）＋ベクトル。対象（四角・赤い など）で図形を選び、効果（黄色に・大きく など）をかけ、ベクトルの分だけ動かします。「枠」「中身」で色をかける場所を選べます。実行は1回${c.CAST_COST}G。`),
    h('h4', {}, '特許と使用料'),
    h('ul', {},
      h('li', {}, `特許は1人${c.PATENT_SLOTS}枠まで。行動段階の申請は${c.PATENT_COST}G。捨てた特許はゴミ箱に入り、誰でも無料で拾えます。`),
      h('li', {}, `他人の特許魔法で実行すると、使用料${c.LICENSE_FEE}Gを保持者に払います。`),
      h('li', {}, '一時魔法（その場で作った魔法）はタダ。ただし、実行直後に他の人からクレームされることがあります。'),
    ),
    h('h4', {}, 'クレーム'),
    h('p', {}, `他人の一時魔法が自分の特許に似ていたら、その直後にクレームできます（費用${c.CLAIM_COST}G）。類似度が${c.SIMILARITY_THRESHOLD * 100}%以上なら成立し、相手から ${c.CLAIM_PAYOUT_BASE}×類似度 G を受け取ります。不成立なら慰謝料${c.CLAIM_FAIL_COMPENSATION}Gを払います。類似度＝ベクトルの似かた（向きと長さ）と単語の重なりの平均。`),
  );
}
