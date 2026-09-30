// 表示用の文字列
import { CONFIG } from '../config.js';
import { magicText } from '../engine/magic.js';

export function playerName(state, seat) {
  if (seat === null || seat === undefined) return '（なし）';
  const p = state.players[seat];
  return p.kind === 'npc' ? `${p.name}（NPC）` : p.name;
}

export function yen(n) {
  return `${n}G`;
}

export function pct(rate) {
  return `${Math.round(rate * 100)}%`;
}

export function patentLabel(patent) {
  return `${patent.id} ${magicText(patent.magic)}`;
}

export function logText(state, e) {
  const who = playerName(state, e.seat);
  switch (e.type) {
    case 'cast': {
      const via = e.viaPatentId
        ? e.patentOwner === e.seat
          ? `自分の特許 ${e.viaPatentId}`
          : `${playerName(state, e.patentOwner)}の特許 ${e.viaPatentId}（使用料 ${yen(e.fee)}）`
        : '一時魔法';
      return `${who}：${magicText(e.magic)} を実行［${via}］${e.fizzled ? ' → 不発' : ''}　達成率 ${pct(e.rate)}`;
    }
    case 'claim':
      return e.success
        ? `${who} → ${playerName(state, e.target)} にクレーム（${e.patentId}・類似度 ${pct(e.similarity)}）：成立、${yen(e.amount)} 受け取り`
        : `${who} → ${playerName(state, e.target)} にクレーム（${e.patentId}・類似度 ${pct(e.similarity)}）：不成立、慰謝料 ${yen(e.amount)} 支払い`;
    case 'patent':
      return `${who}：特許申請 ${e.patentId} ${magicText(e.magic)}`;
    case 'prepatent':
      return `${who}の先行特許 ${e.patentId} ${magicText(e.magic)}`;
    case 'discard':
      return `${who}：特許 ${e.patentId} を捨てた`;
    case 'pickup':
      return `${who}：ゴミ箱から特許 ${e.patentId} を拾った`;
    case 'answer':
      if (e.timeMs !== null && e.timeMs !== undefined) {
        const t = (e.timeMs / 1000).toFixed(1);
        return `${who}：${e.auto ? '時間切れで自動解答' : '解答'}（達成率 ${pct(e.rate)}・タイム ${t}秒）報酬 ${yen(e.reward)} ＋ タイムボーナス ${yen(e.timeBonus)}`;
      }
      return `${who}：${e.auto ? '時間切れで自動解答' : '解答'}（達成率 ${pct(e.rate)}・${e.rank}番目）報酬 ${yen(e.reward)}${e.bonus ? ` ＋ 順位ボーナス ${yen(e.bonus)}` : ''}`;
    default:
      return `${who}：${e.type}`;
  }
}

export function costText(n) {
  return n === 0 ? '無料' : yen(n);
}

export const PHASE_LABEL = {
  hint: 'ヒント',
  reveal: '全体公開',
  action: '行動',
  roundEnd: 'ラウンド終了',
  gameEnd: 'ゲーム終了',
};

export function roundLabel(state) {
  return `ラウンド ${state.round} / ${CONFIG.ROUNDS}`;
}
