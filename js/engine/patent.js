// 特許：申請・先行技術（類似特許）の検索・ゴミ箱。状態を直接書き換える補助関数（game.js の dispatch 内から使う）
import { rules } from './rules.js';
import { copyMagic } from './magic.js';
import { similarity } from './similarity.js';

export function ownedPatents(state, seat) {
  return Object.values(state.patents).filter((p) => p.owner === seat);
}

export function binPatents(state) {
  return state.bin.map((id) => state.patents[id]);
}

export function freeSlots(state, seat) {
  return rules(state).PATENT_SLOTS - ownedPatents(state, seat).length;
}

// この問題で使える特許か（単語がすべて今回の単語一覧にある）
export function isUsable(patent, puzzle) {
  return patent.magic.words.every((w) => puzzle.words.includes(w));
}

export function createPatent(state, seat, magic, origin) {
  const id = `P${state.nextPatentId++}`;
  state.patents[id] = {
    id,
    owner: seat,
    magic: copyMagic(magic),
    createdRound: state.round,
    createdBy: seat,
    origin, // 'hint' | 'action'
    hidden: origin === 'hint', // ヒント段階の申請は全体公開まで他人に見せない
  };
  return state.patents[id];
}

export function discardPatent(state, patentId) {
  const p = state.patents[patentId];
  p.owner = null;
  p.hidden = false;
  state.bin.push(patentId);
}

export function pickupPatent(state, seat, patentId) {
  state.bin = state.bin.filter((id) => id !== patentId);
  state.patents[patentId].owner = seat;
}

// 先行技術チェック：魔法に似た既存の特許を類似度の高い順に返す（申請の却下はしない。表示とNPCの判断用）
export function findSimilarPatents(state, magic, { excludeOwner = undefined, minSimilarity = 0 } = {}) {
  const res = [];
  for (const p of Object.values(state.patents)) {
    if (p.owner === null) continue;
    if (excludeOwner !== undefined && p.owner === excludeOwner) continue;
    const sim = similarity(magic, p.magic);
    if (sim >= minSimilarity) res.push({ patent: p, similarity: sim });
  }
  return res.sort((a, b) => b.similarity - a.similarity);
}
