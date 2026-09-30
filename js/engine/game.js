// ゲームの状態遷移。状態の更新は dispatch(state, action) → { state, events } だけで行う。
// state は JSON でそのまま保存できるプレーンオブジェクト。
import { rules, isSolo, timeBonus, cooldownOf } from './rules.js';
import { createRng, seedFrom, shuffle } from '../rng.js';
import { PUZZLES, getPuzzle } from '../data/puzzles.js';
import { applyMagic, validateMagic, copyMagic, magicText } from './magic.js';
import { judge } from './judge.js';
import { similarity, claimPayout } from './similarity.js';
import { cloneBoard } from './world.js';
import { ownedPatents, freeSlots, isUsable, createPatent, discardPatent, pickupPatent } from './patent.js';

export const STATE_VERSION = 1;

export class GameError extends Error {}

function fail(msg) {
  throw new GameError(msg);
}

function emptyStats() {
  return {
    clear: 0, rank: 0, licenseIn: 0, claimIn: 0, compIn: 0,
    cast: 0, licenseOut: 0, patent: 0, claimCost: 0, claimOut: 0, compOut: 0,
    timeBonus: 0, claimsMade: 0, claimsWon: 0, casts: 0, tempCasts: 0, patentCasts: 0, patentsApplied: 0,
  };
}

// players: [{ name, kind: 'human'|'npc', npcLevel }] / mode: 'standard' | 'solo'（ひとりで挑戦）
export function createGame({ players, seed = Date.now(), puzzleIds = null, mode = 'standard' }) {
  const R = rules({ mode });
  if (players.length < R.MIN_PLAYERS || players.length > R.MAX_PLAYERS) {
    fail(R.MIN_PLAYERS === R.MAX_PLAYERS ? `人数は${R.MIN_PLAYERS}人です` : `人数は${R.MIN_PLAYERS}〜${R.MAX_PLAYERS}人です`);
  }
  if (mode === 'solo' && players.some((p) => p.kind === 'npc')) fail('ひとりで挑戦ではNPCは使えません');
  const seedNum = seedFrom(seed);
  const rng = createRng(seedNum);
  let ids = puzzleIds;
  if (!ids) {
    const pool = shuffle(PUZZLES.map((p) => p.id), rng);
    ids = Array.from({ length: R.ROUNDS }, (_, i) => pool[i % pool.length]);
  }
  const state = {
    version: STATE_VERSION,
    mode,
    seed: seedNum,
    seedLabel: String(seed), // 入力されたままのシード（表示と記録用）
    rngState: rng.state,
    round: 0,
    phase: 'setup',
    puzzleIds: ids,
    puzzleId: null,
    turnOrder: [],
    turnIndex: 0,
    hintIndex: 0,
    players: players.map((p, i) => ({
      id: i,
      name: p.name || `プレイヤー${i + 1}`,
      kind: p.kind === 'npc' ? 'npc' : 'human',
      npcLevel: p.npcLevel ?? 2,
      money: R.INITIAL_MONEY,
      board: [],
      answered: false,
      autoAnswered: false,
      answerRank: null,
      rate: 0,
      clearReward: 0,
      rankBonus: 0,
      timeBonus: 0,
      timeMs: null, // solo：このラウンドの解答タイム
      clock: 0, // solo：このラウンドの行動段階で最後に行動した経過ミリ秒
      busyUntil: 0, // solo：実行後硬直が明ける経過ミリ秒
      turnsTaken: 0,
      actionsLeft: 0,
      prepatentsUsed: 0,
      roundStartMoney: R.INITIAL_MONEY,
      stats: emptyStats(),
    })),
    patents: {},
    nextPatentId: 1,
    bin: [],
    claimWindow: null,
    log: [],
    nextLogId: 1,
    answerCount: 0,
    roundResults: [],
  };
  startRound(state);
  return state;
}

export function puzzleOf(state) {
  return getPuzzle(state.puzzleId);
}

// いま操作すべきプレイヤーの席番号（いなければ null）
export function currentActor(state) {
  if (state.claimWindow) return state.claimWindow.askOrder[state.claimWindow.askIndex];
  if (state.phase === 'hint') return state.turnOrder[state.hintIndex];
  if (state.phase === 'action') return state.turnOrder[state.turnIndex];
  return null;
}

export function rankings(state) {
  return state.players
    .map((p) => ({ seat: p.id, name: p.name, money: p.money }))
    .sort((a, b) => b.money - a.money || a.seat - b.seat);
}

export function hintBoard(puzzle) {
  return cloneBoard(puzzle.board.filter((o) => puzzle.hint.objects.includes(o.id)));
}

function startRound(state) {
  state.round += 1;
  state.puzzleId = state.puzzleIds[state.round - 1];
  const puzzle = getPuzzle(state.puzzleId);
  const n = state.players.length;
  const start = (state.round - 1) % n;
  state.turnOrder = Array.from({ length: n }, (_, i) => (start + i) % n);
  state.turnIndex = 0;
  state.hintIndex = 0;
  state.claimWindow = null;
  state.log = [];
  state.answerCount = 0;
  for (const p of state.players) {
    p.board = cloneBoard(puzzle.board);
    p.answered = false;
    p.autoAnswered = false;
    p.answerRank = null;
    p.rate = judge(p.board, puzzle.conditions).rate;
    p.clearReward = 0;
    p.rankBonus = 0;
    p.timeBonus = 0;
    p.timeMs = null;
    p.clock = 0;
    p.busyUntil = 0;
    p.turnsTaken = 0;
    p.actionsLeft = 0;
    p.prepatentsUsed = 0;
    p.roundStartMoney = p.money;
  }
  state.phase = 'hint';
}

function addLog(state, entry) {
  const e = { id: state.nextLogId++, round: state.round, ...entry };
  state.log.push(e);
  return e;
}

// お金の移動。from / to は席番号か null（銀行）
function pay(state, from, to, amount, fromKey, toKey) {
  if (amount <= 0) return;
  if (from !== null) {
    state.players[from].money -= amount;
    if (fromKey) state.players[from].stats[fromKey] += amount;
  }
  if (to !== null) {
    state.players[to].money += amount;
    if (toKey) state.players[to].stats[toKey] += amount;
  }
}

function requireMoney(p, cost) {
  if (p.money < cost) fail(`お金が足りません（必要 ${cost}G）`);
}

function requireSlot(state, seat) {
  if (freeSlots(state, seat) <= 0) fail(`特許枠がいっぱいです（${rules(state).PATENT_SLOTS}枠）`);
}

function requireTurn(state, seat) {
  if (state.phase !== 'action') fail('行動段階ではありません');
  if (state.claimWindow) fail('クレーム受付中です');
  if (currentActor(state) !== seat) fail('あなたの手番ではありません');
  return state.players[seat];
}

function useAction(p) {
  if (p.actionsLeft <= 0) fail('この手番のアクションは残っていません');
  p.actionsLeft -= 1;
}

function requireNotAnswered(p) {
  if (p.answered) fail('解答済みなので盤面は変えられません');
}

function castOnBoard(state, seat, magic) {
  const p = state.players[seat];
  const puzzle = getPuzzle(state.puzzleId);
  const r = applyMagic(p.board, magic);
  p.board = r.board;
  p.rate = judge(p.board, puzzle.conditions).rate;
  p.stats.casts += 1;
  return r;
}

function openClaimWindow(state, logEntry, casterSeat) {
  const n = state.players.length;
  const askOrder = [];
  for (let i = 1; i < n; i++) {
    const seat = (casterSeat + i) % n;
    if (ownedPatents(state, seat).length > 0) askOrder.push(seat);
  }
  if (askOrder.length === 0) return;
  state.claimWindow = { logId: logEntry.id, casterSeat, askOrder, askIndex: 0 };
}

function advanceClaimWindow(state) {
  const w = state.claimWindow;
  w.askIndex += 1;
  if (w.askIndex >= w.askOrder.length) state.claimWindow = null;
}

function answer(state, seat, auto, events) {
  const p = state.players[seat];
  const puzzle = getPuzzle(state.puzzleId);
  const j = judge(p.board, puzzle.conditions);
  p.answered = true;
  p.autoAnswered = auto;
  p.rate = j.rate;
  state.answerCount += 1;
  p.answerRank = state.answerCount;
  const reward = Math.floor(rules(state).CLEAR_REWARD * j.rate + 1e-9);
  const bonusAllowed = j.rate >= rules(state).RANK_BONUS_MIN_RATE && (!auto || rules(state).AUTO_ANSWER_RANK_BONUS);
  const bonus = bonusAllowed ? rules(state).RANK_BONUS[p.answerRank - 1] ?? 0 : 0;
  p.clearReward = reward;
  p.rankBonus = bonus;
  pay(state, null, seat, reward, null, 'clear');
  pay(state, null, seat, bonus, null, 'rank');
  // solo：解答した時点の経過時間がタイム。速いほどタイムボーナスが多い
  let tb = 0;
  if (isSolo(state)) {
    p.timeMs = p.clock;
    tb = timeBonus(j.rate, p.timeMs);
    p.timeBonus = tb;
    pay(state, null, seat, tb, null, 'timeBonus');
  }
  addLog(state, { type: 'answer', seat, auto, rate: j.rate, rank: p.answerRank, reward, bonus, timeMs: p.timeMs, timeBonus: tb });
  events.push({ type: 'answer', seat, auto, rate: j.rate, reward, bonus, rank: p.answerRank, timeMs: p.timeMs, timeBonus: tb });
}

function startAction(state, events) {
  state.phase = 'action';
  state.turnIndex = 0;
  for (const p of state.players) {
    p.clock = 0;
    p.busyUntil = 0;
  }
  beginTurn(state);
  events.push({ type: 'turn', seat: currentActor(state) });
}

function beginTurn(state) {
  const p = state.players[currentActor(state)];
  p.actionsLeft = rules(state).ACTIONS_PER_TURN;
}

function endTurn(state, events) {
  const p = state.players[currentActor(state)];
  p.turnsTaken += 1;
  p.actionsLeft = 0;
  const allAnswered = state.players.every((q) => q.answered);
  const allDone = state.players.every((q) => q.turnsTaken >= rules(state).MAX_TURNS_PER_ROUND);
  if (allAnswered || allDone) {
    endRound(state, events);
    return;
  }
  state.turnIndex = (state.turnIndex + 1) % state.players.length;
  beginTurn(state);
  events.push({ type: 'turn', seat: currentActor(state) });
}

function endRound(state, events) {
  for (const seat of state.turnOrder) {
    if (!state.players[seat].answered) answer(state, seat, true, events);
  }
  state.claimWindow = null;
  state.phase = 'roundEnd';
  state.roundResults.push({
    round: state.round,
    puzzleId: state.puzzleId,
    players: state.players.map((p) => ({
      seat: p.id,
      rate: p.rate,
      rank: p.answerRank,
      auto: p.autoAnswered,
      clearReward: p.clearReward,
      rankBonus: p.rankBonus,
      timeMs: p.timeMs,
      timeBonus: p.timeBonus,
      delta: p.money - p.roundStartMoney,
      money: p.money,
    })),
  });
  events.push({ type: 'roundEnd', round: state.round });
}

function revealPatentsOfRound(state) {
  const puzzle = getPuzzle(state.puzzleId);
  const invalid = [];
  for (const p of Object.values(state.patents)) {
    if (p.hidden) {
      p.hidden = false;
      addLog(state, { type: 'prepatent', seat: p.owner, patentId: p.id, magic: copyMagic(p.magic) });
    }
    if (p.owner !== null && !isUsable(p, puzzle)) invalid.push(p.id);
  }
  return invalid;
}

const handlers = {
  PREPATENT(state, a, events) {
    if (state.phase !== 'hint') fail('ヒント段階ではありません');
    if (currentActor(state) !== a.seat) fail('あなたの番ではありません');
    const p = state.players[a.seat];
    if (p.prepatentsUsed >= rules(state).PREPATENT_FREE_MAX) fail(`先行特許は${rules(state).PREPATENT_FREE_MAX}つまでです`);
    requireSlot(state, a.seat);
    const err = validateMagic(a.magic, puzzleOf(state).words);
    if (err) fail(err);
    const pat = createPatent(state, a.seat, a.magic, 'hint');
    p.prepatentsUsed += 1;
    p.stats.patentsApplied += 1;
    events.push({ type: 'patent', seat: a.seat, patentId: pat.id });
  },

  END_HINT(state, a, events) {
    if (state.phase !== 'hint') fail('ヒント段階ではありません');
    if (currentActor(state) !== a.seat) fail('あなたの番ではありません');
    state.hintIndex += 1;
    if (state.hintIndex >= state.players.length) {
      state.phase = 'reveal';
      const invalid = revealPatentsOfRound(state);
      events.push({ type: 'reveal', invalidPatents: invalid });
      // solo は全体公開の画面を挟まず、すぐ行動段階（計時開始）へ
      if (isSolo(state)) startAction(state, events);
    }
  },

  START_ACTION(state, a, events) {
    if (state.phase !== 'reveal') fail('全体公開の段階ではありません');
    startAction(state, events);
  },

  CAST_PATENT(state, a, events) {
    const p = requireTurn(state, a.seat);
    requireNotAnswered(p);
    const pat = state.patents[a.patentId];
    if (!pat || pat.owner === null) fail('その特許は使えません');
    if (!isUsable(pat, puzzleOf(state))) fail('この問題では使えない単語を含む特許です');
    const own = pat.owner === a.seat;
    const fee = own ? 0 : rules(state).LICENSE_FEE;
    requireMoney(p, rules(state).CAST_COST + fee);
    useAction(p);
    pay(state, a.seat, null, rules(state).CAST_COST, 'cast', null);
    pay(state, a.seat, pat.owner, fee, 'licenseOut', 'licenseIn');
    const r = castOnBoard(state, a.seat, pat.magic);
    p.stats.patentCasts += 1;
    const entry = addLog(state, {
      type: 'cast', seat: a.seat, magic: copyMagic(pat.magic), viaPatentId: pat.id, patentOwner: pat.owner,
      fee, fizzled: r.fizzled, rate: p.rate,
    });
    events.push({ type: 'cast', logId: entry.id, seat: a.seat });
  },

  CAST_TEMP(state, a, events) {
    const p = requireTurn(state, a.seat);
    requireNotAnswered(p);
    const err = validateMagic(a.magic, puzzleOf(state).words);
    if (err) fail(err);
    requireMoney(p, rules(state).TEMP_CAST_COST);
    useAction(p);
    pay(state, a.seat, null, rules(state).TEMP_CAST_COST, 'cast', null);
    const r = castOnBoard(state, a.seat, a.magic);
    p.stats.tempCasts += 1;
    const entry = addLog(state, { type: 'cast', seat: a.seat, magic: copyMagic(a.magic), viaPatentId: null, fizzled: r.fizzled, rate: p.rate, claim: null });
    events.push({ type: 'cast', logId: entry.id, seat: a.seat });
    openClaimWindow(state, entry, a.seat);
    if (state.claimWindow) events.push({ type: 'claimOpen', logId: entry.id });
  },

  APPLY_PATENT(state, a, events) {
    const p = requireTurn(state, a.seat);
    const err = validateMagic(a.magic, puzzleOf(state).words);
    if (err) fail(err);
    requireSlot(state, a.seat);
    requireMoney(p, rules(state).PATENT_COST);
    useAction(p);
    pay(state, a.seat, null, rules(state).PATENT_COST, 'patent', null);
    const pat = createPatent(state, a.seat, a.magic, 'action');
    p.stats.patentsApplied += 1;
    addLog(state, { type: 'patent', seat: a.seat, patentId: pat.id, magic: copyMagic(pat.magic) });
    events.push({ type: 'patent', seat: a.seat, patentId: pat.id });
  },

  APPLY_AND_CAST(state, a, events) {
    const p = requireTurn(state, a.seat);
    requireNotAnswered(p);
    const err = validateMagic(a.magic, puzzleOf(state).words);
    if (err) fail(err);
    requireSlot(state, a.seat);
    requireMoney(p, rules(state).PATENT_COST + rules(state).CAST_COST);
    useAction(p);
    pay(state, a.seat, null, rules(state).PATENT_COST, 'patent', null);
    pay(state, a.seat, null, rules(state).CAST_COST, 'cast', null);
    const pat = createPatent(state, a.seat, a.magic, 'action');
    p.stats.patentsApplied += 1;
    addLog(state, { type: 'patent', seat: a.seat, patentId: pat.id, magic: copyMagic(pat.magic) });
    const r = castOnBoard(state, a.seat, pat.magic);
    p.stats.patentCasts += 1;
    const entry = addLog(state, {
      type: 'cast', seat: a.seat, magic: copyMagic(pat.magic), viaPatentId: pat.id, patentOwner: a.seat, fee: 0, fizzled: r.fizzled, rate: p.rate,
    });
    events.push({ type: 'cast', logId: entry.id, seat: a.seat });
  },

  PICKUP(state, a, events) {
    const p = requireTurn(state, a.seat);
    if (!state.bin.includes(a.patentId)) fail('その特許はゴミ箱にありません');
    requireSlot(state, a.seat);
    useAction(p);
    pickupPatent(state, a.seat, a.patentId);
    addLog(state, { type: 'pickup', seat: a.seat, patentId: a.patentId, magic: copyMagic(state.patents[a.patentId].magic) });
    events.push({ type: 'pickup', seat: a.seat, patentId: a.patentId });
  },

  DISCARD(state, a, events) {
    if (state.claimWindow) fail('クレーム受付中です');
    const okPhase = state.phase === 'hint' || state.phase === 'action';
    if (!okPhase || currentActor(state) !== a.seat) fail('あなたの番ではありません');
    const pat = state.patents[a.patentId];
    if (!pat || pat.owner !== a.seat) fail('自分の特許ではありません');
    discardPatent(state, a.patentId);
    addLog(state, { type: 'discard', seat: a.seat, patentId: a.patentId, magic: copyMagic(pat.magic) });
    events.push({ type: 'discard', seat: a.seat, patentId: a.patentId });
  },

  ANSWER(state, a, events) {
    const p = requireTurn(state, a.seat);
    requireNotAnswered(p);
    answer(state, a.seat, false, events);
    endTurn(state, events);
  },

  END_TURN(state, a, events) {
    requireTurn(state, a.seat);
    endTurn(state, events);
  },

  CLAIM(state, a, events) {
    const w = state.claimWindow;
    if (!w) fail('クレーム受付中ではありません');
    if (currentActor(state) !== a.seat) fail('あなたの確認の番ではありません');
    const pat = state.patents[a.patentId];
    if (!pat || pat.owner !== a.seat) fail('自分の特許を選んでください');
    const claimer = state.players[a.seat];
    requireMoney(claimer, rules(state).CLAIM_COST);
    const entry = state.log.find((e) => e.id === w.logId);
    pay(state, a.seat, null, rules(state).CLAIM_COST, 'claimCost', null);
    claimer.stats.claimsMade += 1;
    const sim = similarity(entry.magic, pat.magic);
    const success = sim >= rules(state).SIMILARITY_THRESHOLD;
    let amount;
    if (success) {
      amount = claimPayout(sim);
      pay(state, w.casterSeat, a.seat, amount, 'claimOut', 'claimIn');
      claimer.stats.claimsWon += 1;
      entry.claim = { by: a.seat, patentId: pat.id, similarity: sim, amount };
    } else {
      amount = rules(state).CLAIM_FAIL_COMPENSATION;
      pay(state, a.seat, w.casterSeat, amount, 'compOut', 'compIn');
    }
    addLog(state, {
      type: 'claim', seat: a.seat, target: w.casterSeat, castLogId: w.logId, patentId: pat.id,
      patentMagic: copyMagic(pat.magic), magic: copyMagic(entry.magic), similarity: sim, success, amount,
    });
    events.push({ type: 'claim', seat: a.seat, target: w.casterSeat, similarity: sim, success, amount, patentId: pat.id });
    if (success) state.claimWindow = null;
    else advanceClaimWindow(state);
  },

  PASS_CLAIM(state, a, events) {
    if (!state.claimWindow) fail('クレーム受付中ではありません');
    if (currentActor(state) !== a.seat) fail('あなたの確認の番ではありません');
    advanceClaimWindow(state);
    events.push({ type: 'passClaim', seat: a.seat });
  },

  NEXT_ROUND(state, a, events) {
    if (state.phase !== 'roundEnd') fail('ラウンドはまだ終わっていません');
    if (state.round >= rules(state).ROUNDS) {
      state.phase = 'gameEnd';
      events.push({ type: 'gameEnd' });
    } else {
      startRound(state);
      events.push({ type: 'roundStart', round: state.round });
    }
  },
};

export function dispatch(state, action) {
  const handler = handlers[action?.type];
  if (!handler) throw new GameError(`未知のアクション: ${action?.type}`);
  if (state.claimWindow && action.type !== 'CLAIM' && action.type !== 'PASS_CLAIM') {
    fail('クレーム受付中です');
  }
  const next = structuredClone(state);
  const events = [];
  const timed = isTimedAction(state, action);
  if (timed) {
    // 行動の直前に時計を進める（時間切れの自動解答はこの時刻をタイムにする）
    const p = next.players[action.seat];
    checkClock(p, action);
    p.clock = action.t;
  }
  handler(next, action, events);
  if (timed) {
    const p = next.players[action.seat];
    p.busyUntil = action.t + cooldownOf(action.type);
  }
  return { state: next, events };
}

// solo の行動段階の行動は、経過時間 t（ミリ秒）付きで受け取り、実行後硬直を課す
const TIMED_ACTIONS = new Set(['CAST_PATENT', 'CAST_TEMP', 'APPLY_PATENT', 'APPLY_AND_CAST', 'PICKUP', 'DISCARD', 'ANSWER', 'END_TURN']);

function isTimedAction(state, action) {
  return isSolo(state) && state.phase === 'action' && TIMED_ACTIONS.has(action.type) && !!state.players[action.seat];
}

function checkClock(p, action) {
  const t = action.t;
  if (typeof t !== 'number' || !Number.isFinite(t) || t < 0) fail('経過時間（t）が必要です');
  if (t < p.clock) fail('経過時間が巻き戻っています');
  if (t < p.busyUntil) fail(`硬直中です（あと${((p.busyUntil - t) / 1000).toFixed(1)}秒）`);
}

// solo：いま硬直中か、あと何ミリ秒か（UI用）
export function busyRemaining(state, seat, t) {
  if (!isSolo(state) || state.phase !== 'action') return 0;
  return Math.max(0, state.players[seat].busyUntil - t);
}

// 行動段階でいま実行できるかの判定（UIのボタン制御用）
export function canDispatch(state, action) {
  try {
    dispatch(state, action);
    return true;
  } catch (e) {
    if (e instanceof GameError) return false;
    throw e;
  }
}

export { magicText };
