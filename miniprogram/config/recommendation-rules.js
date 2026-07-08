const costTierConfig = {
  "rules": [
    {
      "minColors": 0,
      "maxColors": 1,
      "label": "低"
    },
    {
      "minColors": 2,
      "maxColors": 3,
      "label": "中"
    },
    {
      "minColors": 4,
      "maxColors": 5,
      "label": "高"
    }
  ]
};

// sourceStats.conversionRate 为 edhtop16 转化率；winRate 为局胜率；entries/metaShare 用作 play rate。
// 2026-07 根据 edhtop16 / EDHREC 年度盘点校准：
// - highAbove 奖励高转化率隐藏强将（如 Arcum Dagsson，唯一 >25% 转化的单色卡组），需 100+ 参赛样本；
// - competitiveMetaPriority.minWinRate 0.21→0.20，让 Kinnan / RogThras / Sisay 等公认 T1 进入竞技优先加成
//   （原门槛全库只有 Blue Farm 与 Dargo/Tymna 两套命中，过窄）。
const statsWeightConfig = {
  "enabled": true,
  "scoreInfluence": 0.2,
  "minMultiplier": 0.58,
  "conversionRate": {
    "lowBelow": 0.12,
    "lowMultiplier": 0.82,
    "highAbove": 0.24,
    "highMinEntries": 100,
    "highMultiplier": 1.05
  },
  "playRate": {
    "minEntries": 30,
    "minMetaShare": 0.001,
    "lowMultiplier": 0.96,
    "highEntries": 500,
    "highMetaShare": 0.015,
    "highMultiplier": 1.04,
    "topEntries": 1200,
    "topMetaShare": 0.04,
    "topMultiplier": 1.07
  },
  "competitiveMetaPriority": {
    "enabled": true,
    "selectedPriority": "competitive",
    "minEntries": 500,
    "minMetaShare": 0.015,
    "minWinRate": 0.2,
    "multiplier": 1.18
  },
  "fitDisplay": {
    "topPercentileAtNinety": 0.025,
    "topBandExponent": 14
  },
  "lowPlayPartner": {
    "enabled": true,
    "entriesBelow": 60,
    "metaShareBelow": 0.003,
    "multiplier": 0.88,
    "diversityPriorityPenalty": 1
  },
  "bottomHalfPartner": {
    "enabled": true,
    "entriesBelowOrEqual": 61,
    "metaShareBelowOrEqual": 0.001875,
    "multiplier": 0.7
  },
  "outdated": {
    "enabled": true,
    "deckElement": "outdated_meta",
    "multiplier": 0.78
  },
  "irrelevant": {
    "enabled": true,
    "deckElement": "irrelevant_meta",
    "multiplier": 0.55,
    "autoPartnerEntriesBelow": 30,
    "autoPartnerMetaShareBelow": 0.001
  },
  "diversity": {
    "enabled": true,
    "tailSlots": 1,
    "candidatePool": 24,
    "minFitRatio": 0.85,
    "lowPlayEntriesBelow": 60,
    "lowPlayMetaShareBelow": 0.003
  },
  "maxMultiplier": 1.08
};

const metaTagConfig = {
  "knownTags": [
    "irrelevant",
    "competitive",
    "fringe",
    "outdated",
    "fun"
  ],
  "competitive": {
    "minEntries": 500,
    "minMetaShare": 0.015,
    "minWinRateWithSample": 0.2,
    "minWinRateSampleEntries": 100
  },
  "fringe": {
    "minEntries": 16,
    "maxEntries": 120,
    "minWinRate": 0.12,
    "maxMetaShare": 0.004
  },
  "irrelevant": {
    "maxEntries": 18,
    "maxMetaShare": 0.001,
    "maxWinRate": 0.14
  },
  "outdated": {
    "names": [
      "Breya, Etherium Shaper",
      "Cazur, Ruthless Stalker / Ukkima, Stalking Shadow",
      "Godo, Bandit Warlord",
      "Ishai, Ojutai Dragonspeaker / Krark, the Thumbless",
      "Jeska, Thrice Reborn / Tymna the Weaver",
      "Krark, the Thumbless / Silas Renn, Seeker Adept",
      "Krark, the Thumbless / Thrasios, Triton Hero"
    ]
  },
  "fun": {
    "archetypes": [
      "Aggro"
    ],
    "deckElements": [
      "chaos_value",
      "coin_flip_engine",
      "combat_damage",
      "damage_pressure",
      "goblin_combo",
      "proactive_combat",
      "sacrifice_value",
      "voltron",
      "wheel_synergy"
    ]
  }
};

module.exports = {
  costTierConfig,
  metaTagConfig,
  statsWeightConfig,
};
