// ゲームの数値はすべてここに集約する。調整は tools/simulate.js の結果を見ながら行う。
export const CONFIG = {
  // ゲーム全体
  ROUNDS: 5,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 4,
  INITIAL_MONEY: 1000,

  // お金
  CAST_COST: 1,
  LICENSE_FEE: 5,
  PATENT_COST: 10,
  PREPATENT_FREE_MAX: 2,
  PATENT_SLOTS: 6,
  CLAIM_COST: 20,
  CLAIM_PAYOUT_BASE: 100,
  CLAIM_FAIL_COMPENSATION: 5,

  // 類似度
  SIMILARITY_THRESHOLD: 0.1,
  SIMILARITY_VECTOR_WEIGHT: 0.5,
  SHOW_SIMILARITY_BEFORE_CLAIM: false,

  // 報酬
  CLEAR_REWARD: 300,
  RANK_BONUS: [100, 60, 30, 0],
  RANK_BONUS_MIN_RATE: 0.5,
  AUTO_ANSWER_RANK_BONUS: false, // ラウンド終了時の自動解答に順位ボーナスを出すか

  // 手番
  ACTIONS_PER_TURN: 3,
  MAX_TURNS_PER_ROUND: 6,

  // 盤面と魔法
  GRID_W: 12,
  GRID_H: 8,
  VECTOR_MAX: 4,
  MAX_WORDS: 4,
  SIZE_BIG_MIN_AREA: 4, // 面積がこれ以上なら「大きい」
  SIZE_SMALL_MAX_AREA: 1, // 面積がこれ以下なら「小さい」

  // NPC
  NPC: {
    RATE_WEIGHT: 100, // 評価値における達成率の重み
    DIST_WEIGHT: 3, // 未達成の位置条件までの距離1あたりの減点
    IMPROVE_EPS: 0.001,
    TOP_EFFECTS: 3, // 効果とベクトルを組み合わせるときに残す上位数
    TOP_VECTORS: 6,
    WORD_COMBOS_PER_TARGET: 3, // 同じ対象集合を選ぶ単語の組み合わせを何通り残すか
    CLAIM_RISK: 0.8, // 一時魔法がクレームされる見込み
    PATENT_VALUE: 4, // 特許を1つ持つことの価値（申請して実行を選ぶ判断に使う）
    CLAIM_MARGIN: 10, // 期待収入がクレーム費用をこれだけ上回れば請求する
    MONEY_RESERVE: 50, // 解答後の特許申請で残しておく所持金
    POST_ANSWER_SAME_SIM: 0.9, // 既に持つ特許とこれ以上似ていれば新たに申請しない
    LEVELS: {
      1: { label: 'よわい', sampleRate: 0.35, scoreNoise: 25, simNoise: 0.25, lookAtPatents: false },
      2: { label: 'ふつう', sampleRate: 0.7, scoreNoise: 6, simNoise: 0.1, lookAtPatents: true },
      3: { label: 'つよい', sampleRate: 1, scoreNoise: 0, simNoise: 0, lookAtPatents: true },
    },
  },

  // UI
  UI: {
    SAVE_KEY: 'magic-patent-game/save/v1',
    SETTINGS_KEY: 'magic-patent-game/settings/v1',
    NPC_SPEED_MS: { slow: 900, normal: 450, fast: 120 },
    CELL: 40, // SVG 1マスの大きさ
  },
};
