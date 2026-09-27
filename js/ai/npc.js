// NPCの意思決定。decide(state, seat) は次に行うアクションを1つ返す純粋関数。
// 乱数は状態から決まるシードで作るので、同じ状態なら同じ判断になる。
import { CONFIG } from '../config.js';
import { createRng, mixSeed } from '../rng.js';
import { applyMagic } from '../engine/magic.js';
import { similarity, claimPayout } from '../engine/similarity.js';
import { currentActor, puzzleOf, hintBoard } from '../engine/game.js';
import { ownedPatents, freeSlots, isUsable } from '../engine/patent.js';
import { evaluate, searchCandidates, alternativeWordings } from './search.js';

function levelOf(p) {
  return CONFIG.NPC.LEVELS[p.npcLevel] ?? CONFIG.NPC.LEVELS[2];
}

function rngFor(state, seat, salt) {
  const p = state.players[seat];
  return createRng(mixSeed(state.seed, state.round, state.nextLogId, seat, p.actionsLeft, p.turnsTaken, state.hintIndex, salt));
}

function search(board, puzzle, level, rng, indices = null) {
  return searchCandidates(board, {
    conditions: puzzle.conditions,
    indices,
    words: puzzle.words,
    sampleRate: level.sampleRate,
    scoreNoise: level.scoreNoise,
    rng,
  });
}

// 誰の番でもなく進行だけが必要な場面（全体公開・ラウンド終了）も含めて、NPCが次に行うアクション。
// 人間の入力待ちなら null
export function autoAction(state) {
  if (state.phase === 'reveal') return { type: 'START_ACTION' };
  if (state.phase === 'roundEnd') return { type: 'NEXT_ROUND' };
  const seat = currentActor(state);
  if (seat === null || seat === undefined) return null;
  if (state.players[seat].kind !== 'npc') return null;
  return decide(state, seat);
}

export function decide(state, seat) {
  if (state.claimWindow) return decideClaim(state, seat);
  if (state.phase === 'hint') return decideHint(state, seat);
  if (state.phase === 'action') return decideAction(state, seat);
  return null;
}

// ---- クレーム ----
export function decideClaim(state, seat) {
  const p = state.players[seat];
  const level = levelOf(p);
  const w = state.claimWindow;
  const entry = state.log.find((e) => e.id === w.logId);
  if (p.money < CONFIG.CLAIM_COST) return { type: 'PASS_CLAIM', seat };
  const rng = rngFor(state, seat, `claim${w.askIndex}`);
  let best = null;
  for (const pat of ownedPatents(state, seat)) {
    const est = similarity(entry.magic, pat.magic) + (rng.next() * 2 - 1) * level.simNoise;
    const expected = est >= CONFIG.SIMILARITY_THRESHOLD ? claimPayout(Math.min(1, est)) : -CONFIG.CLAIM_FAIL_COMPENSATION;
    if (!best || expected > best.expected) best = { pat, expected };
  }
  if (best && best.expected - CONFIG.CLAIM_COST >= CONFIG.NPC.CLAIM_MARGIN) {
    return { type: 'CLAIM', seat, patentId: best.pat.id };
  }
  return { type: 'PASS_CLAIM', seat };
}

// ---- ヒント段階 ----
function discardCandidate(state, seat, puzzle) {
  // 今回使えない特許のうち古いものから捨てる
  const unusable = ownedPatents(state, seat).filter((p) => !isUsable(p, puzzle));
  unusable.sort((a, b) => a.createdRound - b.createdRound);
  return unusable[0] ?? null;
}

export function decideHint(state, seat) {
  const p = state.players[seat];
  const puzzle = puzzleOf(state);
  const level = levelOf(p);
  if (p.prepatentsUsed >= CONFIG.PREPATENT_FREE_MAX) return { type: 'END_HINT', seat };
  if (freeSlots(state, seat) <= 0) {
    const d = discardCandidate(state, seat, puzzle);
    return d ? { type: 'DISCARD', seat, patentId: d.id } : { type: 'END_HINT', seat };
  }
  const board = hintBoard(puzzle);
  const indices = puzzle.hint.conditions;
  const cur = evaluate(board, puzzle.conditions, indices).score;
  const rng = rngFor(state, seat, 'hint');
  const cands = search(board, puzzle, level, rng, indices);
  const mine = ownedPatents(state, seat).filter((q) => q.createdRound === state.round);
  for (const c of cands) {
    if (c.score <= cur + CONFIG.NPC.IMPROVE_EPS) break;
    if (mine.some((q) => similarity(q.magic, c.magic) >= CONFIG.NPC.POST_ANSWER_SAME_SIM)) continue;
    return { type: 'PREPATENT', seat, magic: c.magic };
  }
  return { type: 'END_HINT', seat };
}

// ---- 行動段階 ----
// 一時魔法として唱えたときに見込まれるクレームの損失
export function expectedClaimLoss(state, seat, magic) {
  let worst = 0;
  for (const pat of Object.values(state.patents)) {
    if (pat.owner === null || pat.owner === seat) continue;
    const sim = similarity(magic, pat.magic);
    if (sim < CONFIG.SIMILARITY_THRESHOLD) continue;
    const payout = claimPayout(sim);
    if (payout - CONFIG.CLAIM_COST <= 0) continue; // 請求しても割に合わないので請求されない見込み
    worst = Math.max(worst, payout);
  }
  return worst * CONFIG.NPC.CLAIM_RISK;
}

function isLastTurn(p) {
  return p.turnsTaken >= CONFIG.MAX_TURNS_PER_ROUND - 1;
}

export function decideAction(state, seat) {
  const p = state.players[seat];
  if (p.answered) return decideAfterAnswer(state, seat);
  const puzzle = puzzleOf(state);
  const level = levelOf(p);
  if (p.rate >= 1) return { type: 'ANSWER', seat };
  if (p.actionsLeft <= 0) return isLastTurn(p) ? { type: 'ANSWER', seat } : { type: 'END_TURN', seat };
  if (p.money < CONFIG.CAST_COST) return { type: 'ANSWER', seat };

  const cur = evaluate(p.board, puzzle.conditions).score;
  const rng = rngFor(state, seat, 'act');
  const cands = search(p.board, puzzle, level, rng);
  // 評価に乱れがあっても、実際に良くなる手の中から選ぶ
  const best = cands.find((c) => c.trueScore > cur + CONFIG.NPC.IMPROVE_EPS) ?? null;

  // 特許魔法の候補（自分・他人）
  const patentOpts = [];
  if (level.lookAtPatents) {
    for (const pat of Object.values(state.patents)) {
      if (pat.owner === null || !isUsable(pat, puzzle)) continue;
      const own = pat.owner === seat;
      const cost = CONFIG.CAST_COST + (own ? 0 : CONFIG.LICENSE_FEE);
      if (p.money < cost) continue;
      const score = evaluate(applyMagic(p.board, pat.magic).board, puzzle.conditions).score;
      patentOpts.push({ type: 'CAST_PATENT', patentId: pat.id, score, cost });
    }
  } else {
    for (const pat of ownedPatents(state, seat)) {
      if (!isUsable(pat, puzzle)) continue;
      const score = evaluate(applyMagic(p.board, pat.magic).board, puzzle.conditions).score;
      patentOpts.push({ type: 'CAST_PATENT', patentId: pat.id, score, cost: CONFIG.CAST_COST });
    }
  }

  const bestScore = Math.max(best ? best.trueScore : -Infinity, ...patentOpts.map((o) => o.score));
  if (bestScore <= cur + CONFIG.NPC.IMPROVE_EPS) return { type: 'ANSWER', seat };

  const options = patentOpts.filter((o) => o.score >= bestScore - CONFIG.NPC.IMPROVE_EPS);
  if (best && best.trueScore >= bestScore - CONFIG.NPC.IMPROVE_EPS) {
    // 言い換えのうちクレームの危険が最も小さいものを選ぶ
    let temp = null;
    for (const magic of [best.magic, ...alternativeWordings(best)]) {
      const loss = level.lookAtPatents ? expectedClaimLoss(state, seat, magic) : 0;
      if (!temp || loss < temp.loss) temp = { magic, loss };
    }
    options.push({ type: 'CAST_TEMP', magic: temp.magic, cost: CONFIG.CAST_COST + temp.loss });
    const applyCost = CONFIG.PATENT_COST + CONFIG.CAST_COST;
    if (freeSlots(state, seat) > 0 && p.money >= applyCost) {
      options.push({ type: 'APPLY_AND_CAST', magic: best.magic, cost: applyCost - CONFIG.NPC.PATENT_VALUE });
    }
  }
  if (options.length === 0) return { type: 'ANSWER', seat };
  options.sort((a, b) => a.cost - b.cost);
  const o = options[0];
  if (o.type === 'CAST_PATENT') return { type: 'CAST_PATENT', seat, patentId: o.patentId };
  return { type: o.type, seat, magic: o.magic };
}

// 解答後：他人が次に使いそうな魔法を特許にする。枠が足りなければ使えない特許を捨てる
export function decideAfterAnswer(state, seat) {
  const p = state.players[seat];
  const puzzle = puzzleOf(state);
  const level = levelOf(p);
  const fresh = p.actionsLeft === CONFIG.ACTIONS_PER_TURN;
  if (!fresh || p.money < CONFIG.PATENT_COST + CONFIG.NPC.MONEY_RESERVE) return { type: 'END_TURN', seat };
  const others = state.players.filter((q) => q.id !== seat && !q.answered);
  if (others.length === 0) return { type: 'END_TURN', seat };
  const rng = rngFor(state, seat, 'post');
  const target = others[rng.int(others.length)];
  const cands = search(target.board, puzzle, level, rng);
  const cur = evaluate(target.board, puzzle.conditions).score;
  const c = cands[0];
  if (!c || c.trueScore <= cur + CONFIG.NPC.IMPROVE_EPS) return { type: 'END_TURN', seat };
  const mine = ownedPatents(state, seat);
  if (mine.some((q) => similarity(q.magic, c.magic) >= CONFIG.NPC.POST_ANSWER_SAME_SIM)) return { type: 'END_TURN', seat };
  if (freeSlots(state, seat) <= 0) {
    const d = discardCandidate(state, seat, puzzle);
    return d ? { type: 'DISCARD', seat, patentId: d.id } : { type: 'END_TURN', seat };
  }
  return { type: 'APPLY_PATENT', seat, magic: c.magic };
}
