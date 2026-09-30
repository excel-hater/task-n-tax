#!/usr/bin/env node
// 全員NPCで大量に対戦して統計を出す。
//   node tools/simulate.js --games 100 --seed 1 [--players 4] [--levels 3,2,2,1] [--json]
import { CONFIG } from '../js/config.js';
import { createGame, dispatch, rankings } from '../js/engine/game.js';
import { autoAction } from '../js/ai/npc.js';

function parseArgs(argv) {
  const args = { games: 100, seed: 1, players: 4, levels: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--games') args.games = Number(argv[++i]);
    else if (a === '--seed') args.seed = argv[++i];
    else if (a === '--players') args.players = Number(argv[++i]);
    else if (a === '--levels') args.levels = argv[++i].split(',').map(Number);
    else if (a === '--json') args.json = true;
  }
  return args;
}

const MAX_STEPS = 20000;

export function playNpcGame(seed, levels) {
  const players = levels.map((lv, i) => ({ name: `NPC${i + 1}`, kind: 'npc', npcLevel: lv }));
  let state = createGame({ players, seed });
  let steps = 0;
  let decideMs = 0;
  let decisions = 0;
  while (state.phase !== 'gameEnd') {
    const t0 = performance.now();
    const action = autoAction(state);
    decideMs += performance.now() - t0;
    decisions++;
    if (!action) throw new Error(`NPCが行動を決められない: phase=${state.phase}`);
    state = dispatch(state, action).state;
    if (++steps > MAX_STEPS) throw new Error('手数が上限を超えた');
  }
  return { state, steps, decideMs, decisions };
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function std(xs) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function pct(xs, q) {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const levels = args.levels ?? Array.from({ length: args.players }, () => 2);
  const money = [];
  const winnerIncome = { clear: [], rank: [], licenseIn: [], claimIn: [], compIn: [] };
  const bySeatMoney = levels.map(() => []);
  const winsBySeat = levels.map(() => 0);
  const rates = [];
  let claimsMade = 0;
  let claimsWon = 0;
  let tempCasts = 0;
  let patentCasts = 0;
  let patentsApplied = 0;
  let errors = 0;
  let totalDecideMs = 0;
  let totalDecisions = 0;
  let maxDecideMs = 0;
  const t0 = performance.now();

  for (let g = 0; g < args.games; g++) {
    const seed = `${args.seed}-${g}`;
    let result;
    try {
      result = playNpcGame(seed, levels);
    } catch (e) {
      errors++;
      console.error(`game ${g} (seed ${seed}) で例外:`, e);
      continue;
    }
    const { state } = result;
    totalDecideMs += result.decideMs;
    totalDecisions += result.decisions;
    maxDecideMs = Math.max(maxDecideMs, result.decideMs / result.decisions);
    for (const p of state.players) {
      money.push(p.money);
      bySeatMoney[p.id].push(p.money);
      claimsMade += p.stats.claimsMade;
      claimsWon += p.stats.claimsWon;
      tempCasts += p.stats.tempCasts;
      patentCasts += p.stats.patentCasts;
      patentsApplied += p.stats.patentsApplied;
    }
    for (const r of state.roundResults) for (const p of r.players) rates.push(p.rate);
    const winner = state.players[rankings(state)[0].seat];
    winsBySeat[winner.id]++;
    for (const k of Object.keys(winnerIncome)) winnerIncome[k].push(winner.stats[k]);
  }

  const summary = {
    games: args.games,
    errors,
    levels,
    elapsedSec: +((performance.now() - t0) / 1000).toFixed(1),
    avgDecideMs: +(totalDecideMs / Math.max(1, totalDecisions)).toFixed(2),
    money: {
      mean: +mean(money).toFixed(1), std: +std(money).toFixed(1),
      min: Math.min(...money), p25: pct(money, 0.25), median: pct(money, 0.5), p75: pct(money, 0.75), max: Math.max(...money),
    },
    meanMoneyBySeat: bySeatMoney.map((xs) => +mean(xs).toFixed(1)),
    winsBySeat,
    winnerIncomeMean: Object.fromEntries(Object.entries(winnerIncome).map(([k, xs]) => [k, +mean(xs).toFixed(1)])),
    meanRate: +mean(rates).toFixed(3),
    claims: { made: claimsMade, won: claimsWon, successRate: claimsMade ? +(claimsWon / claimsMade).toFixed(3) : null },
    casts: { temp: tempCasts, patent: patentCasts },
    patentsApplied,
  };

  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  const lv = (l) => CONFIG.NPC.LEVELS[l]?.label ?? l;
  console.log(`=== 全員NPC ${summary.games}ゲーム（強さ: ${levels.map(lv).join(', ')}） ===`);
  console.log(`例外: ${errors}件 / 所要 ${summary.elapsedSec}秒 / NPCの1判断あたり平均 ${summary.avgDecideMs}ms`);
  console.log('');
  console.log('■ 最終所持金');
  const m = summary.money;
  console.log(`  平均 ${m.mean}G（標準偏差 ${m.std}）  最小 ${m.min} / 25% ${m.p25} / 中央 ${m.median} / 75% ${m.p75} / 最大 ${m.max}`);
  console.log(`  席ごとの平均: ${summary.meanMoneyBySeat.map((x, i) => `席${i + 1}=${x}`).join('  ')}`);
  console.log(`  席ごとの勝利数: ${summary.winsBySeat.map((x, i) => `席${i + 1}=${x}`).join('  ')}`);
  console.log('');
  console.log('■ 勝者の収入の内訳（1ゲームあたり平均）');
  const w = summary.winnerIncomeMean;
  console.log(`  達成報酬 ${w.clear} / 順位ボーナス ${w.rank} / 使用料 ${w.licenseIn} / クレーム ${w.claimIn} / 慰謝料 ${w.compIn}`);
  console.log('');
  console.log('■ その他');
  console.log(`  平均達成率 ${(summary.meanRate * 100).toFixed(1)}%`);
  console.log(`  クレーム ${claimsMade}回 / 成立 ${claimsWon}回 / 成功率 ${summary.claims.successRate === null ? '-' : (summary.claims.successRate * 100).toFixed(1) + '%'}`);
  console.log(`  実行：一時魔法 ${tempCasts}回 / 特許魔法 ${patentCasts}回 / 特許申請 ${patentsApplied}件`);
  if (errors > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
