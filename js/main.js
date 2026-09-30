// 起動・画面遷移。状態の更新は必ず engine の dispatch を通す
import { CONFIG } from './config.js';
import { createGame, dispatch, currentActor, GameError, busyRemaining } from './engine/game.js';
import { isSolo } from './engine/rules.js';
import { updateRecords, soloResult, formatTime } from './engine/records.js';
import { saveTo, loadFrom, clearSave } from './engine/save.js';
import { autoAction } from './ai/npc.js';
import { h } from './ui/dom.js';
import { emptyMagic } from './ui/magicBuilder.js';
import { playerName, pct, yen } from './ui/format.js';
import { renderTitle, renderSetup, defaultSetup, seatsForMode, rulesBody } from './ui/screens/setup.js';
import { renderHandoff } from './ui/screens/handoff.js';
import { renderHint } from './ui/screens/hint.js';
import { renderReveal } from './ui/screens/reveal.js';
import { renderAction, renderNpcTurn } from './ui/screens/action.js';
import { renderClaim } from './ui/screens/claim.js';
import { renderRoundResult, renderFinal } from './ui/screens/results.js';
import { magicText } from './engine/magic.js';

const root = document.getElementById('app');
const toastBox = document.getElementById('toast');

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function loadSettings() {
  try {
    const raw = storage()?.getItem(CONFIG.UI.SETTINGS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const d = defaultSetup();
    return { ...d, ...s, seats: d.seats.map((seat, i) => ({ ...seat, ...(s.seats?.[i] ?? {}) })) };
  } catch {
    return null;
  }
}

function loadRecords() {
  try {
    return JSON.parse(storage()?.getItem(CONFIG.UI.RECORDS_KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

// ひとりで挑戦で、時間を付けて送る行動
const TIMED = new Set(['CAST_PATENT', 'CAST_TEMP', 'APPLY_PATENT', 'APPLY_AND_CAST', 'PICKUP', 'DISCARD', 'ANSWER', 'END_TURN']);

const app = {
  state: null,
  timer: null,
  busyTimer: null,
  clockKey: null, // 計時中のラウンド
  clockBase: 0, // performance.now() − 経過ミリ秒
  lastRecord: null, // ひとりで挑戦の直近の結果 { result, isBest, previousBest }
  ui: {
    screen: 'title',
    viewer: null, // ホットシートで、いま端末を持っている人の席
    magic: emptyMagic(),
    magicBySeat: {},
    magicRound: null,
    tab: 'patents',
    patentTab: 'mine',
    dialog: null,
    paused: false,
    setup: loadSettings() ?? defaultSetup(),
  },

  // ---- 状態 ----
  hasHumans() {
    return !!this.state && this.state.players.some((p) => p.kind === 'human');
  },
  humanCount() {
    return this.state ? this.state.players.filter((p) => p.kind === 'human').length : 0;
  },
  hasSave() {
    const st = storage();
    return !!st && !!loadFrom(st, CONFIG.UI.SAVE_KEY);
  },
  save() {
    const st = storage();
    if (!st || !this.state) return;
    try {
      if (this.state.phase === 'gameEnd') clearSave(st, CONFIG.UI.SAVE_KEY);
      else saveTo(st, CONFIG.UI.SAVE_KEY, this.state);
      st.setItem(CONFIG.UI.SETTINGS_KEY, JSON.stringify(this.ui.setup));
    } catch {
      // 保存できなくても遊べるようにする
    }
  },

  newGame() {
    const setup = this.ui.setup;
    const seats = seatsForMode(setup).map((s, i) => ({ ...s, name: s.name.trim() || `プレイヤー${i + 1}` }));
    const seed = setup.seed.trim() || String(Math.floor(Math.random() * 1e9));
    this.startGame(setup.mode === 'challenge'
      ? { players: [{ name: seats[0].name, kind: 'human' }], seed, mode: 'solo' }
      : { players: seats, seed });
  },
  retrySolo() {
    this.startGame({ players: [{ name: this.state.players[0].name, kind: 'human' }], seed: this.state.seedLabel, mode: 'solo' });
  },
  startGame(opts) {
    this.state = createGame(opts);
    this.clockKey = null;
    this.lastRecord = null;
    Object.assign(this.ui, { viewer: null, magicBySeat: {}, magicRound: null, dialog: null, paused: false, tab: 'patents', patentTab: 'mine' });
    this.save();
    this.render();
  },
  resume() {
    const st = storage();
    this.state = st ? loadFrom(st, CONFIG.UI.SAVE_KEY) : null;
    this.clockKey = null; // 保存した経過時間から計時を再開する
    Object.assign(this.ui, { viewer: null, magicBySeat: {}, dialog: null, paused: false });
    this.render();
  },
  toTitle() {
    clearTimeout(this.timer);
    this.state = null;
    Object.assign(this.ui, { screen: 'title', dialog: null });
    this.render();
  },

  // ---- 操作 ----
  // ---- ひとりで挑戦の計時 ----
  timing() {
    const st = this.state;
    return !!st && isSolo(st) && st.phase === 'action';
  },
  // 行動段階の経過ミリ秒
  now() {
    if (!this.timing()) return 0;
    const p = this.state.players[0];
    if (this.clockKey !== this.state.round) {
      // 再開したときは、最後に保存した経過時間から数え直す（再読み込みで考える時間を得られないように）
      this.clockKey = this.state.round;
      this.clockBase = performance.now() - Math.max(p.clock, this.savedClock());
    }
    return Math.max(p.clock, Math.floor(performance.now() - this.clockBase));
  },
  savedClock() {
    try {
      const c = JSON.parse(storage()?.getItem(`${CONFIG.UI.SAVE_KEY}/clock`) ?? 'null');
      return c && c.seed === this.state.seed && c.round === this.state.round ? c.ms : 0;
    } catch {
      return 0;
    }
  },
  saveClock() {
    if (!this.timing()) return;
    try {
      storage()?.setItem(`${CONFIG.UI.SAVE_KEY}/clock`, JSON.stringify({ seed: this.state.seed, round: this.state.round, ms: this.now() }));
    } catch {
      // 保存できなくても続ける
    }
  },
  // 時間が要る行動に経過時間を付ける（ボタンの有効判定にも使う）
  stamp(action) {
    return this.timing() && TIMED.has(action.type) ? { ...action, t: this.now() } : action;
  },
  busyMs() {
    return this.timing() ? busyRemaining(this.state, 0, this.now()) : 0;
  },
  records() {
    return loadRecords();
  },
  saveRecord() {
    const result = soloResult(this.state);
    const r = updateRecords(loadRecords(), { ...result, date: new Date().toISOString() });
    try {
      storage()?.setItem(CONFIG.UI.RECORDS_KEY, JSON.stringify(r.records));
    } catch {
      // 保存できなくても結果は表示する
    }
    this.lastRecord = { result, isBest: r.isBest, previousBest: r.previousBest };
  },

  act(action, { clearMagic = false } = {}) {
    let res;
    action = this.stamp(action);
    try {
      res = dispatch(this.state, action);
    } catch (e) {
      if (e instanceof GameError) {
        toast(e.message, 'error');
        return false;
      }
      throw e;
    }
    this.state = res.state;
    if (clearMagic) this.setMagicSilently(emptyMagic(), action.seat);
    if (isSolo(this.state) && this.state.phase === 'gameEnd') this.saveRecord();
    this.handleEvents(res.events);
    this.save();
    this.render();
    return true;
  },
  setUi(patch) {
    Object.assign(this.ui, patch);
    this.render();
  },
  setMagic(m) {
    this.setMagicSilently({ words: m.words.slice(), vector: { ...m.vector } }, currentActor(this.state));
    this.render();
  },
  setMagicSilently(m, seat) {
    if (seat === null || seat === undefined) return;
    this.ui.magicBySeat[seat] = m;
  },
  togglePause() {
    this.ui.paused = !this.ui.paused;
    this.render();
  },

  confirmAnswer(seat) {
    const p = this.state.players[seat];
    this.ui.dialog = {
      title: '解答しますか？',
      body: h('div', {},
        h('p', {}, `いまの達成率は ${pct(p.rate)} です。解答すると、この盤面で採点され、以後このラウンドでは盤面を変えられません。`),
        h('p', { class: 'muted small' }, `順位ボーナスは達成率 ${pct(CONFIG.RANK_BONUS_MIN_RATE)} 以上のときだけ付きます。`)),
      buttons: [
        { label: 'やめる' },
        { label: '解答する', primary: true, onClick: () => this.act({ type: 'ANSWER', seat }) },
      ],
    };
    this.render();
  },
  showRules() {
    this.ui.dialog = { title: '遊び方', body: rulesBody(), buttons: [{ label: '閉じる', primary: true }] };
    this.render();
  },
  openMenu() {
    const speeds = [['slow', 'ゆっくり'], ['normal', 'ふつう'], ['fast', 'はやい']];
    this.ui.dialog = {
      title: 'メニュー',
      body: h('div', { class: 'menu' },
        isSolo(this.state)
          ? h('p', { class: 'warn small' }, 'ひとりで挑戦では、メニューを開いていても時間は止まりません。')
          : h('label', { class: 'field' }, h('span', {}, 'NPCの速さ'),
            h('select', { class: 'input', onchange: (e) => { this.ui.setup.npcSpeed = e.target.value; this.save(); } },
              speeds.map(([v, l]) => h('option', { value: v, selected: this.ui.setup.npcSpeed === v }, l)))),
        h('p', { class: 'muted small' }, `シード：${this.state?.seedLabel ?? this.state?.seed ?? '-'}（ゲームは自動で保存されます）`)),
      buttons: [
        { label: '遊び方', onClick: () => this.showRules() },
        { label: 'タイトルへ', onClick: () => this.toTitle() },
        { label: '閉じる', primary: true },
      ],
    };
    this.render();
  },
  closeDialog(btn) {
    this.ui.dialog = null;
    if (btn?.onClick) btn.onClick();
    else this.render();
  },

  // イベントのうち、人間に見せるべきものをダイアログやトーストにする
  handleEvents(events) {
    const st = this.state;
    for (const ev of events) {
      if (ev.type === 'claim') {
        const involved = [ev.seat, ev.target].filter((s) => st.players[s].kind === 'human');
        if (!involved.length) continue;
        const pat = st.patents[ev.patentId];
        const claimEntry = st.log.findLast((e) => e.type === 'claim');
        this.ui.dialog = {
          title: ev.success ? 'クレーム成立' : 'クレーム不成立',
          body: h('div', {},
            h('p', {}, `${playerName(st, ev.seat)} が ${playerName(st, ev.target)} にクレームしました。`),
            h('p', {}, '実行された魔法：', h('b', {}, magicText(claimEntry.magic))),
            h('p', {}, `請求に使った特許：${pat.id} `, h('b', {}, magicText(pat.magic))),
            h('p', { class: 'big' }, `類似度 ${pct(ev.similarity)}`),
            h('p', {}, ev.success
              ? `${playerName(st, ev.target)} → ${playerName(st, ev.seat)} に ${yen(ev.amount)} 支払い`
              : `${playerName(st, ev.seat)} → ${playerName(st, ev.target)} に慰謝料 ${yen(ev.amount)} 支払い`),
            h('p', { class: 'muted small' }, `クレーム費用 ${yen(CONFIG.CLAIM_COST)} は請求者が銀行に支払い済み`)),
          buttons: [{ label: 'OK', primary: true }],
        };
      } else if (ev.type === 'answer' && st.players[ev.seat].kind === 'human' && !ev.auto) {
        const extra = ev.timeMs !== null && ev.timeMs !== undefined
          ? `・タイム ${formatTime(ev.timeMs)}${ev.timeBonus ? `＋タイムボーナス ${yen(ev.timeBonus)}` : ''}`
          : ev.bonus ? `＋順位ボーナス ${yen(ev.bonus)}` : '';
        toast(`解答しました：達成率 ${pct(ev.rate)}・報酬 ${yen(ev.reward)}${extra}`);
      } else if (ev.type === 'patent' && st.players[ev.seat].kind === 'human') {
        toast(`特許 ${ev.patentId} を取得しました`);
      } else if (ev.type === 'cast' && st.players[ev.seat].kind === 'human') {
        const e = st.log.find((x) => x.id === ev.logId);
        if (e?.fizzled) toast('対象の図形がなく、魔法は不発でした', 'error');
      }
    }
  },

  // ---- NPC ----
  npcAction() {
    if (!this.state) return null;
    const a = autoAction(this.state);
    if (!a) return null;
    if ((a.type === 'START_ACTION' || a.type === 'NEXT_ROUND') && this.hasHumans()) return null;
    return a;
  },
  scheduleNpc() {
    clearTimeout(this.timer);
    if (!this.state || this.ui.dialog || this.ui.paused) return;
    const a = this.npcAction();
    if (!a) return;
    const ms = CONFIG.UI.NPC_SPEED_MS[this.ui.setup.npcSpeed] ?? CONFIG.UI.NPC_SPEED_MS.normal;
    this.timer = setTimeout(() => this.act(a), ms);
  },
  // 人間の入力が必要になるまで（観戦ではラウンド終了まで）NPCの行動をまとめて進める
  skipNpc() {
    clearTimeout(this.timer);
    const startRound = this.state.round;
    for (let i = 0; i < 5000; i++) {
      const a = this.npcAction();
      if (!a) break;
      if (!this.hasHumans() && (this.state.phase === 'roundEnd' || this.state.round !== startRound)) break;
      const res = dispatch(this.state, a);
      this.state = res.state;
      this.handleEvents(res.events);
      if (this.ui.dialog) break;
    }
    this.save();
    this.render();
  },

  // ---- 描画 ----
  syncMagic(seat) {
    if (this.ui.magicRound !== this.state.round) {
      this.ui.magicBySeat = {};
      this.ui.magicRound = this.state.round;
    }
    this.ui.magic = (seat !== null && this.ui.magicBySeat[seat]) || emptyMagic();
  },
  screen() {
    const st = this.state;
    if (!st) return this.ui.screen === 'setup' ? renderSetup(this) : renderTitle(this);
    if (st.phase === 'gameEnd') return renderFinal(this);
    if (st.phase === 'roundEnd') return renderRoundResult(this);
    if (st.phase === 'reveal') return renderReveal(this);
    const seat = currentActor(st);
    this.syncMagic(seat);
    const p = st.players[seat];
    const reason = st.claimWindow ? 'claim' : st.phase;
    if (p.kind === 'npc') return renderNpcTurn(this, seat, reason);
    if (this.humanCount() >= 2 && this.ui.viewer !== seat) return renderHandoff(this, seat, reason);
    if (st.claimWindow) return renderClaim(this, seat);
    if (st.phase === 'hint') return renderHint(this, seat);
    return renderAction(this, seat);
  },
  render() {
    const y = window.scrollY;
    const key = this.screenKey();
    root.replaceChildren(this.screen());
    if (this.ui.dialog) root.append(renderDialog(this));
    // 同じ画面の再描画ではスクロール位置を保ち、画面が変わったら先頭へ
    window.scrollTo(0, key === this.lastKey ? y : 0);
    this.lastKey = key;
    this.scheduleNpc();
    this.scheduleBusyEnd();
    updateClock();
  },
  // 硬直が明けたらボタンを押せるように描き直す
  scheduleBusyEnd() {
    clearTimeout(this.busyTimer);
    const ms = this.busyMs();
    if (ms > 0) this.busyTimer = setTimeout(() => this.render(), ms + 30);
  },
  screenKey() {
    const st = this.state;
    if (!st) return this.ui.screen;
    const seat = currentActor(st);
    const handoff = this.humanCount() >= 2 && seat !== null && st.players[seat].kind === 'human' && this.ui.viewer !== seat;
    return `${st.round}-${st.phase}-${seat}-${!!st.claimWindow}-${handoff}`;
  },
};

function renderDialog(app) {
  const d = app.ui.dialog;
  return h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': d.title },
    h('div', { class: 'dialog' },
      h('h2', {}, d.title),
      h('div', { class: 'dialog-body' }, d.body),
      h('div', { class: 'dialog-actions' }, (d.buttons ?? [{ label: 'OK', primary: true }]).map((b) =>
        h('button', { class: `btn${b.primary ? ' btn-primary' : ''}`, onclick: () => app.closeDialog(b) }, b.label))),
    ),
  );
}

let toastTimer = null;
function toast(text, kind = 'info') {
  toastBox.replaceChildren(h('div', { class: `toast toast-${kind}` }, text));
  toastBox.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastBox.classList.remove('show'), 2600);
}

// タイマーと硬直バーは、全体を描き直さずに文字と幅だけ更新する
function updateClock() {
  if (!app.timing()) return;
  const el = document.getElementById('solo-timer');
  if (el) el.textContent = formatTime(app.now());
  const bar = document.getElementById('busy-bar');
  if (bar) {
    const p = app.state.players[0];
    const left = app.busyMs();
    const total = Math.max(1, p.busyUntil - p.clock);
    bar.style.width = `${(left / total) * 100}%`;
    bar.closest('.busy').classList.toggle('busy-on', left > 0);
    const label = document.getElementById('busy-label');
    if (label) label.textContent = left > 0 ? `硬直 ${(left / 1000).toFixed(1)}秒` : '行動できます';
  }
}
setInterval(updateClock, 100);
setInterval(() => app.saveClock(), 1000);
window.addEventListener('pagehide', () => app.saveClock());

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && app.ui.dialog) app.closeDialog(null);
});

app.render();
window.magicPatentApp = app; // デバッグ用
