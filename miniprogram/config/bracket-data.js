// Commander Brackets 离线规则快照。
// 只保存评估需要的英文卡名与高置信触发器，不内置牌价、卡图或完整 Oracle 文本。
// 官方基线：
// - https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-october-21-2025
// - https://magic.wizards.com/en/news/announcements/commander-brackets-beta-update-february-9-2026
// - https://magic.wizards.com/en/banned-restricted-list

const BRACKET_MANIFEST = Object.freeze({
  schemaVersion: 1,
  ruleVersion: 'commander-brackets-2026-02-09',
  dataVersion: 'curated-en-2026-07-15-combo-families',
  evaluatorVersion: '2.7.0',
  supportedLanguage: 'en',
});

// 区间定位：档位内部再分「偏弱 / 中等 / 偏强」（B4.5 与 B5 竞技档暂不区分，待赛事 meta 分析加入）。
// 位置分数复用档位判定使用的同一批信号轴，不引入新的主观打分：
// B1–B3 取向上一档判定门槛的推进度按 accumulationSpan 归一（约两个门槛宽度的总推进 = 区间顶部），
// B4 取 B5 四项必要条件平均达成度的平方（联合满足的接近程度）。
// 切点经确定性阶梯牌表校准：同档牌表沿区间扫描时三个标签占比大致均衡，不出现单一偏向垄断。
// promotion 同时是档位判定门槛：结构判定只有超过 B4 偏强（联合接近度 ≥ cuts.high）才可能离开 B4；
// 达到竞技特征后余量 ≥ b5SurplusMin 才判 B5，否则归 B4.5 准竞技；余量落在 ±b5SurplusBand 内时置信度说明贴线。
const BAND_POSITION_CONFIG = Object.freeze({
  labels: Object.freeze({
    low: Object.freeze({ key: 'low', zh: '偏弱', segment: '下段' }),
    mid: Object.freeze({ key: 'mid', zh: '中等', segment: '中段' }),
    high: Object.freeze({ key: 'high', zh: '偏强', segment: '上段' }),
  }),
  cuts: Object.freeze({ mid: 0.3, high: 0.6 }),
  accumulationSpan: 2.2,
  surplusGain: 1.2,
  promotion: Object.freeze({ b5SurplusMin: 0.6, b5SurplusBand: 0.08 }),
});

// 组合技速度分档（方法论借鉴开源的 Commander Spellbook estimate-bracket）：
// 已确认组合技按全套牌张法术力值合计分速度档，速度 ≥ earlyMinSpeed（合计 ≤4 费）
// 视为客观「早期组合技」；元数据缺失时退回变体上的人工 speed 标注。
const COMBO_SPEED_CONFIG = Object.freeze({
  tiers: Object.freeze([
    Object.freeze({ maxManaValue: 0, speed: 5 }),
    Object.freeze({ maxManaValue: 4, speed: 4 }),
    Object.freeze({ maxManaValue: 6, speed: 3 }),
    Object.freeze({ maxManaValue: 8, speed: 2 }),
  ]),
  fallbackSpeed: 1,
  earlyMinSpeed: 4,
});

const BRACKET_LABELS = Object.freeze({
  1: { name: 'Exhibition', zh: '主题展示', turn: '通常至少 9 回合取胜' },
  2: { name: 'Core', zh: '核心', turn: '通常至少 8 回合取胜' },
  3: { name: 'Upgraded', zh: '强化', turn: '通常至少 6 回合取胜' },
  4: { name: 'Optimized', zh: '优化', turn: '通常至少 4 回合取胜' },
  // 准竞技（余量未越线的入门竞技结构或预算构筑）起手爆发不到成熟 cEDH 的水平，因此不写「任意回合」
  4.5: { name: 'Fringe cEDH', zh: '准竞技', turn: '通常至少 3 回合取胜' },
  5: { name: 'cEDH', zh: '竞技', turn: '可能在任意回合结束' },
});

// 2025-10-21 官方完整更新，叠加 2026-02-09 新增 Farewell / Biorhythm。
const GAME_CHANGERS = Object.freeze([
  'Drannith Magistrate',
  'Humility',
  "Serra's Sanctum",
  'Smothering Tithe',
  'Enlightened Tutor',
  "Teferi's Protection",
  'Consecrated Sphinx',
  'Cyclonic Rift',
  'Force of Will',
  'Fierce Guardianship',
  'Gifts Ungiven',
  'Intuition',
  'Mystical Tutor',
  'Narset, Parter of Veils',
  'Rhystic Study',
  "Thassa's Oracle",
  'Ad Nauseam',
  "Bolas's Citadel",
  'Braids, Cabal Minion',
  'Demonic Tutor',
  'Imperial Seal',
  'Necropotence',
  'Opposition Agent',
  'Orcish Bowmasters',
  'Tergrid, God of Fright',
  'Vampiric Tutor',
  'Gamble',
  "Jeska's Will",
  'Underworld Breach',
  'Crop Rotation',
  "Gaea's Cradle",
  'Natural Order',
  'Seedborn Muse',
  'Survival of the Fittest',
  'Worldly Tutor',
  'Aura Shards',
  'Coalition Victory',
  'Grand Arbiter Augustin IV',
  'Notion Thief',
  'Ancient Tomb',
  'Chrome Mox',
  'Field of the Dead',
  'Glacial Chasm',
  'Grim Monolith',
  "Lion's Eye Diamond",
  'Mana Vault',
  "Mishra's Workshop",
  'Mox Diamond',
  'Panoptic Mirror',
  'The One Ring',
  'The Tabernacle at Pendrell Vale',
  'Farewell',
  'Biorhythm',
]);

// 当前官方 Commander 具名禁牌；Conspiracy / ante / 冒犯性牌等类别禁令不在轻量名字集内。
const BANNED_CARDS = Object.freeze([
  'Ancestral Recall',
  'Balance',
  'Black Lotus',
  'Chaos Orb',
  'Channel',
  'Dockside Extortionist',
  'Emrakul, the Aeons Torn',
  'Erayo, Soratami Ascendant',
  'Falling Star',
  'Fastbond',
  'Flash',
  'Golos, Tireless Pilgrim',
  'Griselbrand',
  'Hullbreacher',
  'Iona, Shield of Emeria',
  'Karakas',
  'Jeweled Lotus',
  'Leovold, Emissary of Trest',
  'Library of Alexandria',
  'Limited Resources',
  'Mana Crypt',
  'Mox Emerald',
  'Mox Jet',
  'Mox Pearl',
  'Mox Ruby',
  'Mox Sapphire',
  'Nadu, Winged Wisdom',
  'Paradox Engine',
  'Primeval Titan',
  'Prophet of Kruphix',
  'Recurring Nightmare',
  'Rofellos, Llanowar Emissary',
  'Shahrazad',
  'Sundering Titan',
  'Sylvan Primordial',
  'Time Vault',
  'Time Walk',
  'Tinker',
  'Tolarian Academy',
  'Trade Secrets',
  'Upheaval',
  "Yawgmoth's Bargain",
]);

const BANNED_AS_COMPANION = Object.freeze(['Lutri, the Spellchaser']);

const MASS_LAND_DENIAL = Object.freeze([
  'Armageddon',
  'Ravages of War',
  'Catastrophe',
  'Cataclysm',
  'Jokulhaups',
  'Obliterate',
  'Decree of Annihilation',
  'Ruination',
  'Wake of Destruction',
  'Boom // Bust',
  'Death Cloud',
  'Global Ruin',
  'Keldon Firebombers',
  'Impending Disaster',
  'Myojin of Infinite Rage',
  'Sunder',
  'Worldslayer',
  'Worldfire',
  'Apocalypse',
  'Bearer of the Heavens',
  'Worldpurge',
  'Sway of the Stars',
  'Fall of the Thran',
  'Desolation Angel',
  'Devastation',
  'Burning of Xinye',
  'Wildfire',
  'Destructive Force',
  'Thoughts of Ruin',
  'Tectonic Break',
  'Epicenter',
]);

const EXTRA_TURNS = Object.freeze([
  'Time Warp',
  'Temporal Manipulation',
  'Capture of Jingzhou',
  'Nexus of Fate',
  'Expropriate',
  "Karn's Temporal Sundering",
  'Part the Waterveil',
  'Walk the Aeons',
  'Time Stretch',
  'Temporal Mastery',
  "Alrund's Epiphany",
  'Savor the Moment',
  'Beacon of Tomorrows',
  'Temporal Trespass',
  'Time Sieve',
  "Magistrate's Scepter",
  'Final Fortune',
  'Last Chance',
  "Warrior's Oath",
  'Chance for Glory',
  'Stitch in Time',
]);

const SIGNAL_GROUPS = Object.freeze({
  fastMana: Object.freeze({
    label: '快速法术力',
    cards: Object.freeze([
      'Ancient Tomb', 'Chrome Mox', 'Grim Monolith', "Lion's Eye Diamond", 'Mana Vault',
      "Mishra's Workshop", 'Mox Diamond', "Gaea's Cradle", "Serra's Sanctum", 'Sol Ring',
      'Lotus Petal', 'Mox Amber', 'Mox Opal', 'Dark Ritual', 'Culling the Weak',
      'Cabal Ritual', 'Simian Spirit Guide', 'Elvish Spirit Guide', 'Jeweled Amulet',
      'Mana Crypt', 'Jeweled Lotus',
    ]),
  }),
  efficientTutor: Object.freeze({
    label: '高效导师',
    cards: Object.freeze([
      'Demonic Tutor', 'Vampiric Tutor', 'Imperial Seal', 'Mystical Tutor',
      'Enlightened Tutor', 'Worldly Tutor', 'Gamble', 'Intuition', 'Gifts Ungiven',
      'Crop Rotation', 'Natural Order', 'Survival of the Fittest', 'Demonic Consultation',
      'Tainted Pact', 'Diabolic Intent', 'Entomb', 'Wishclaw Talisman', 'Recruiter of the Guard',
      'Imperial Recruiter', 'Neoform', 'Eldritch Evolution', 'Finale of Devastation',
      'Chord of Calling', 'Fabricate', 'Transmute Artifact', 'Reshape', 'Spellseeker',
      'Ranger-Captain of Eos', 'Solve the Equation',
    ]),
  }),
  freeInteraction: Object.freeze({
    // 免费互动含全色系的额外费用/免疫费互动，避免评估偏向蓝色：
    // 蓝 Force of Will / Force of Negation / Fierce Guardianship / Mental Misstep，
    // 白 Solitude / Flawless Maneuver，红 Fury / Deflecting Swat，
    // 黑 Grief / Deadly Rollick，绿 Endurance / Force of Vigor / Obscuring Haze。
    label: '免费互动',
    cards: Object.freeze([
      'Force of Will', 'Fierce Guardianship', 'Force of Negation', 'Pact of Negation',
      'Mental Misstep', 'Mindbreak Trap', 'Deadly Rollick', 'Deflecting Swat',
      'Flawless Maneuver', 'Subtlety', 'Endurance', 'Grief',
      'Solitude', 'Fury', 'Force of Vigor', 'Obscuring Haze', 'Force of Despair',
    ]),
  }),
  staxOrDenial: Object.freeze({
    label: 'Stax',
    cards: Object.freeze([
      'Drannith Magistrate', 'Humility', 'Opposition Agent', 'Grand Arbiter Augustin IV',
      'Collector Ouphe', 'Null Rod', 'Deafening Silence', 'Rule of Law', 'Archon of Emeria',
      'Trinisphere', 'Winter Orb', 'Static Orb', 'Damping Sphere', "Grafdigger's Cage",
      'Cursed Totem', 'Aven Mindcensor', 'Lavinia, Azorius Renegade', 'Blood Moon',
      'Magus of the Moon', 'Back to Basics', 'Rest in Peace',
    ]),
  }),
  engine: Object.freeze({
    label: '高效资源引擎',
    cards: Object.freeze([
      'Ad Nauseam', 'Necropotence', 'Rhystic Study', 'Mystic Remora',
      'The One Ring', "Bolas's Citadel", 'Consecrated Sphinx', 'Smothering Tithe',
      'Seedborn Muse', 'Survival of the Fittest', 'Sylvan Library', 'Esper Sentinel',
      'Trouble in Pairs', 'Archivist of Oghma', 'Faerie Mastermind', "Jeska's Will",
    ]),
  }),
  efficientWinCondition: Object.freeze({
    label: '高效制胜',
    cards: Object.freeze([
      'Underworld Breach', 'Laboratory Maniac', 'Bloodchief Ascension',
      "Thassa's Oracle", 'Brain Freeze',
    ]),
  }),
  commandZoneEngine: Object.freeze({
    label: '高效主将区引擎',
    commanderOnly: true,
    cards: Object.freeze([
      'Kinnan, Bonder Prodigy', 'Najeela, the Blade-Blossom', "Yuriko, the Tiger's Shadow",
      'Winota, Joiner of Forces', 'Urza, Lord High Artificer', 'Sisay, Weatherlight Captain',
      'Magda, Brazen Outlaw', 'Tymna the Weaver', "Kraum, Ludevic's Opus",
      'Malcolm, Keen-Eyed Navigator', 'Tivit, Seller of Secrets', 'Atraxa, Grand Unifier',
      'The Gitrog Monster', 'Korvold, Fae-Cursed King', 'Kenrith, the Returned King',
      'Inalla, Archmage Ritualist', 'Rocco, Cabaretti Caterer',
    ]),
  }),
});

// Top 15 按组合技家族维护，变体同时命中时只计一次。
// intrinsic 牌始终计入高效制胜，family 牌只在完整家族与额外条件同时命中时计入。
const TOP_COMBO_FAMILIES = Object.freeze([
  { rank: 1, familyId: 'thoracle', label: 'Oracle + Consultation / Pact', pattern: 'direct-win', result: '直接胜利', winCards: [{ name: "Thassa's Oracle", scope: 'intrinsic' }] },
  { rank: 2, familyId: 'breach-led', label: 'Breach + LED + Brain Freeze', pattern: 'storm-loop', result: '磨牌与坟场循环', winCards: [{ name: 'Underworld Breach', scope: 'intrinsic' }, { name: 'Brain Freeze', scope: 'intrinsic' }] },
  { rank: 3, familyId: 'kinnan-basalt', label: 'Kinnan + Basalt', pattern: 'resource-loop', result: '无限无色法术力', winCards: [{ name: 'Finale of Devastation', scope: 'family' }, { name: 'Walking Ballista', scope: 'family' }] },
  { rank: 4, familyId: 'dualcaster-copy', label: 'Dualcaster + Copy Spell', pattern: 'terminal-loop', result: '无限攻击衍生物', winCards: [{ name: 'Dualcaster Mage', scope: 'family' }] },
  { rank: 5, familyId: 'food-chain', label: 'Food Chain Cast Loop', pattern: 'resource-loop', result: '无限生物法术力', winCards: [{ name: 'Etali, Primal Conqueror', scope: 'family', commanderOnly: true }, { name: "Thassa's Oracle", scope: 'intrinsic' }] },
  { rank: 6, familyId: 'floodcaller-bounce', label: 'Valley Floodcaller Bounce Loop', pattern: 'storm-loop', result: '无限风暴与有条件的法术力', winCards: [{ name: 'Brain Freeze', scope: 'intrinsic' }, { name: 'Finale of Devastation', scope: 'family' }, { name: 'Aetherflux Reservoir', scope: 'family' }] },
  { rank: 7, familyId: 'sisay-emiel-derevi', label: 'Sisay + Emiel + Derevi', pattern: 'resource-loop', result: '无限法术力与主将循环', winCards: [{ name: 'Mount Doom', scope: 'family' }, { name: 'Orcish Bowmasters', scope: 'family' }] },
  { rank: 8, familyId: 'devoted-druid', label: 'Devoted Druid Mana Loop', pattern: 'resource-loop', result: '无限绿色法术力', winCards: [{ name: 'Finale of Devastation', scope: 'family' }, { name: 'Walking Ballista', scope: 'family' }] },
  { rank: 9, familyId: 'dargo-loop', label: 'Dargo Recast Loop', pattern: 'terminal-loop', result: '重复施放与牺牲循环', winCards: [{ name: 'Altar of Dementia', scope: 'family' }, { name: 'Goblin Bombardment', scope: 'family' }, { name: 'Mayhem Devil', scope: 'family' }] },
  { rank: 10, familyId: 'scepter-reversal', label: 'Scepter + Dramatic Reversal', pattern: 'resource-loop', result: '有条件的无限法术力', winCards: [{ name: 'Finale of Devastation', scope: 'family', requiresAtLeast: [{ cards: ['Sol Ring', 'Mana Vault', 'Grim Monolith', 'Arcane Signet', 'Fellwar Stone', 'Mox Amber', 'Mox Opal'], count: 2 }] }, { name: 'Walking Ballista', scope: 'family', requiresAtLeast: [{ cards: ['Sol Ring', 'Mana Vault', 'Grim Monolith', 'Arcane Signet', 'Fellwar Stone', 'Mox Amber', 'Mox Opal'], count: 2 }] }] },
  { rank: 11, familyId: 'magda-clock', label: 'Magda + Clock of Omens', pattern: 'resource-loop', result: '无限珍宝', winCards: [{ name: 'Twinshot Sniper', scope: 'family', requiresAll: ['Barkform Harvester', 'The One Ring', 'Sculpting Steel'] }, { name: 'Lightning Bolt', scope: 'family', requiresAll: ['Barkform Harvester', 'The One Ring', 'Sculpting Steel'] }] },
  { rank: 12, familyId: 'tivit-sieve', label: 'Tivit + Time Sieve', pattern: 'extra-turn-loop', result: '无限额外回合', winCards: [{ name: 'Tivit, Seller of Secrets', scope: 'family' }] },
  { rank: 13, familyId: 'malcolm-glint-horn', label: 'Malcolm + Glint-Horn', pattern: 'terminal-loop', result: '珍宝与全桌伤害循环', winCards: [{ name: 'Glint-Horn Buccaneer', scope: 'family' }] },
  { rank: 14, familyId: 'vivi-quicksilver', label: 'Vivi + Quicksilver Elemental', pattern: 'resource-loop', result: '无限有色法术力', winCards: [{ name: 'Vivi Ornitier', scope: 'family', requiresAny: ['Curiosity', 'Ophidian Eye', 'Tandem Lookout'] }] },
  { rank: 15, familyId: 'kitten-teferi-amber', label: 'Kitten + Teferi + Mox Amber', pattern: 'draw-loop', result: '抓牌、风暴与法术力循环', winCards: [{ name: "Thassa's Oracle", scope: 'intrinsic' }, { name: 'Brain Freeze', scope: 'intrinsic' }, { name: 'Aetherflux Reservoir', scope: 'family' }] },
]);

// 只收录“所有列出卡都出现”即可确认的高置信变体，每条都归入一个家族。
const KNOWN_COMBOS = Object.freeze([
  { id: 'thoracle-consult', familyId: 'thoracle', cards: ["Thassa's Oracle", 'Demonic Consultation'], label: 'Oracle + Consultation', speed: 'early', result: '直接胜利', recommendedBracket: 4 },
  { id: 'thoracle-pact', familyId: 'thoracle', cards: ["Thassa's Oracle", 'Tainted Pact'], label: 'Oracle + Pact', speed: 'early', result: '直接胜利', recommendedBracket: 4 },
  { id: 'breach-led-freeze', familyId: 'breach-led', cards: ['Underworld Breach', "Lion's Eye Diamond", 'Brain Freeze'], label: 'Breach + LED + Brain Freeze', speed: 'early', result: '磨牌与坟场循环', recommendedBracket: 4 },
  { id: 'kinnan-basalt', familyId: 'kinnan-basalt', cards: ['Kinnan, Bonder Prodigy', 'Basalt Monolith'], label: 'Kinnan + Basalt', speed: 'early', result: '无限无色法术力', recommendedBracket: 4 },
  { id: 'dualcaster-twinflame', familyId: 'dualcaster-copy', cards: ['Dualcaster Mage', 'Twinflame'], label: 'Dualcaster + Twinflame', speed: 'early', result: '无限攻击衍生物', recommendedBracket: 4 },
  { id: 'dualcaster-heat', familyId: 'dualcaster-copy', cards: ['Dualcaster Mage', 'Heat Shimmer'], label: 'Dualcaster + Heat Shimmer', speed: 'early', result: '无限攻击衍生物', recommendedBracket: 4 },
  { id: 'dualcaster-duplication', familyId: 'dualcaster-copy', cards: ['Dualcaster Mage', 'Molten Duplication'], label: 'Dualcaster + Molten Duplication', speed: 'early', result: '无限攻击衍生物', recommendedBracket: 4 },
  { id: 'food-chain-squee', familyId: 'food-chain', cards: ['Food Chain', 'Squee, the Immortal'], label: 'Food Chain + Squee', speed: 'setup', result: '无限生物法术力', recommendedBracket: 3 },
  { id: 'food-chain-scourge', familyId: 'food-chain', cards: ['Food Chain', 'Eternal Scourge'], label: 'Food Chain + Eternal Scourge', speed: 'setup', result: '无限生物法术力', recommendedBracket: 3 },
  { id: 'food-chain-griffin', familyId: 'food-chain', cards: ['Food Chain', 'Misthollow Griffin'], label: 'Food Chain + Misthollow Griffin', speed: 'setup', result: '无限生物法术力', recommendedBracket: 3 },
  { id: 'druid-vizier', familyId: 'devoted-druid', cards: ['Devoted Druid', 'Vizier of Remedies'], label: 'Devoted Druid + Vizier', speed: 'early', result: '无限绿色法术力', recommendedBracket: 4 },
  { id: 'druid-reconfiguration', familyId: 'devoted-druid', cards: ['Devoted Druid', 'Swift Reconfiguration'], label: 'Devoted Druid + Reconfiguration', speed: 'early', result: '无限绿色法术力', recommendedBracket: 4 },
  { id: 'druid-brewmaster', familyId: 'devoted-druid', cards: ['Devoted Druid', "Hazel's Brewmaster"], label: "Devoted Druid + Hazel's Brewmaster", speed: 'early', result: '无限绿色法术力', recommendedBracket: 4 },
  { id: 'scepter-reversal', familyId: 'scepter-reversal', cards: ['Isochron Scepter', 'Dramatic Reversal'], label: 'Scepter + Dramatic Reversal', speed: 'setup', result: '有条件的无限法术力', recommendedBracket: 3 },
  { id: 'tivit-time-sieve', familyId: 'tivit-sieve', cards: ['Tivit, Seller of Secrets', 'Time Sieve'], label: 'Tivit + Time Sieve', speed: 'early', result: '无限额外回合', recommendedBracket: 4 },
  { id: 'malcolm-glint-horn', familyId: 'malcolm-glint-horn', cards: ['Malcolm, Keen-Eyed Navigator', 'Glint-Horn Buccaneer'], label: 'Malcolm + Glint-Horn', speed: 'early', result: '珍宝与全桌伤害循环', recommendedBracket: 4 },
  { id: 'vivi-quicksilver', familyId: 'vivi-quicksilver', cards: ['Vivi Ornitier', 'Quicksilver Elemental'], label: 'Vivi + Quicksilver Elemental', speed: 'early', result: '无限有色法术力', recommendedBracket: 4 },
  { id: 'kitten-teferi-amber', familyId: 'kitten-teferi-amber', cards: ['Displacer Kitten', 'Teferi, Time Raveler', 'Mox Amber'], label: 'Kitten + Teferi + Mox Amber', speed: 'early', result: '抓牌、风暴与法术力循环', recommendedBracket: 4 },
  { id: 'heliod-ballista', familyId: 'heliod-ballista', cards: ['Heliod, Sun-Crowned', 'Walking Ballista'], label: 'Heliod + Ballista', speed: 'early', result: '无限伤害', recommendedBracket: 4 },
  { id: 'kiki-conscripts', familyId: 'kiki', cards: ['Kiki-Jiki, Mirror Breaker', 'Zealous Conscripts'], label: 'Kiki + Conscripts', speed: 'setup', result: '无限攻击衍生物', recommendedBracket: 3 },
  { id: 'kiki-celebrant', familyId: 'kiki', cards: ['Kiki-Jiki, Mirror Breaker', 'Combat Celebrant'], label: 'Kiki + Celebrant', speed: 'setup', result: '无限战斗', recommendedBracket: 3 },
  { id: 'twin-pestermite', familyId: 'splinter-twin', cards: ['Splinter Twin', 'Pestermite'], label: 'Twin + Pestermite', speed: 'setup', result: '无限攻击衍生物', recommendedBracket: 3 },
  { id: 'twin-exarch', familyId: 'splinter-twin', cards: ['Splinter Twin', 'Deceiver Exarch'], label: 'Twin + Exarch', speed: 'setup', result: '无限攻击衍生物', recommendedBracket: 3 },
  { id: 'blood-bond', familyId: 'exquisite-blood', cards: ['Exquisite Blood', 'Sanguine Bond'], label: 'Exquisite Blood + Sanguine Bond', speed: 'setup', result: '生命流失循环', recommendedBracket: 3 },
  { id: 'blood-vito', familyId: 'exquisite-blood', cards: ['Exquisite Blood', 'Vito, Thorn of the Dusk Rose'], label: 'Exquisite Blood + Vito', speed: 'setup', result: '生命流失循环', recommendedBracket: 3 },
  { id: 'bloodchief-mindcrank', familyId: 'bloodchief-mindcrank', cards: ['Bloodchief Ascension', 'Mindcrank'], label: 'Bloodchief + Mindcrank', speed: 'setup', result: '磨牌与失血循环', recommendedBracket: 3 },
  { id: 'niv-curiosity', familyId: 'niv-curiosity', cards: ['Niv-Mizzet, Parun', 'Curiosity'], label: 'Niv-Mizzet + Curiosity', speed: 'setup', result: '抓牌与伤害循环', recommendedBracket: 3 },
  { id: 'niv-eye', familyId: 'niv-curiosity', cards: ['Niv-Mizzet, Parun', 'Ophidian Eye'], label: 'Niv-Mizzet + Ophidian Eye', speed: 'setup', result: '抓牌与伤害循环', recommendedBracket: 3 },
  { id: 'basalt-rings', familyId: 'basalt-infinite-mana', cards: ['Basalt Monolith', 'Rings of Brighthearth'], label: 'Basalt + Rings', speed: 'setup', result: '无限无色法术力', recommendedBracket: 3 },
  { id: 'basalt-artifact', familyId: 'basalt-infinite-mana', cards: ['Basalt Monolith', 'Power Artifact'], label: 'Basalt + Power Artifact', speed: 'setup', result: '无限无色法术力', recommendedBracket: 3 },
  { id: 'grim-artifact', familyId: 'grim-power-artifact', cards: ['Grim Monolith', 'Power Artifact'], label: 'Grim + Power Artifact', speed: 'early', result: '无限无色法术力', recommendedBracket: 4 },
  { id: 'deadeye-drake', familyId: 'deadeye-drake', cards: ['Deadeye Navigator', 'Peregrine Drake'], label: 'Deadeye + Drake', speed: 'setup', result: '无限法术力', recommendedBracket: 3 },
  { id: 'mikaeus-triskelion', familyId: 'mikaeus-triskelion', cards: ['Mikaeus, the Unhallowed', 'Triskelion'], label: 'Mikaeus + Triskelion', speed: 'setup', result: '无限伤害', recommendedBracket: 3 },
  { id: 'rip-helm', familyId: 'rip-helm', cards: ['Rest in Peace', 'Helm of Obedience'], label: 'Rest in Peace + Helm', speed: 'setup', result: '放逐牌库', recommendedBracket: 3 },
  { id: 'squirrel-earthcraft', familyId: 'squirrel-earthcraft', cards: ['Squirrel Nest', 'Earthcraft'], label: 'Squirrel Nest + Earthcraft', speed: 'setup', result: '无限松鼠', recommendedBracket: 3 },
  { id: 'chain-onyx', familyId: 'chain-smog', cards: ['Chain of Smog', 'Professor Onyx'], label: 'Chain of Smog + Professor Onyx', speed: 'early', result: 'Magecraft 生命流失循环', recommendedBracket: 4 },
  { id: 'chain-apprentice', familyId: 'chain-smog', cards: ['Chain of Smog', 'Witherbloom Apprentice'], label: 'Chain of Smog + Apprentice', speed: 'early', result: 'Magecraft 生命流失循环', recommendedBracket: 4 },
  { id: 'aluren-acererak', familyId: 'aluren-acererak', cards: ['Aluren', 'Acererak the Archlich'], label: 'Aluren + Acererak', speed: 'early', result: '地城循环', recommendedBracket: 4 },
  { id: 'citadel-top-reservoir', familyId: 'citadel-top', cards: ["Bolas's Citadel", "Sensei's Divining Top", 'Aetherflux Reservoir'], label: 'Citadel + Top + Reservoir', speed: 'setup', result: '抓牌与生命循环', recommendedBracket: 3 },
  { id: 'worldgorger-animate', familyId: 'worldgorger', cards: ['Worldgorger Dragon', 'Animate Dead'], label: 'Worldgorger + Animate Dead', speed: 'setup', result: '有条件的法术力循环', recommendedBracket: 3 },
  { id: 'worldgorger-dance', familyId: 'worldgorger', cards: ['Worldgorger Dragon', 'Dance of the Dead'], label: 'Worldgorger + Dance of the Dead', speed: 'setup', result: '有条件的法术力循环', recommendedBracket: 3 },
  { id: 'worldgorger-necromancy', familyId: 'worldgorger', cards: ['Worldgorger Dragon', 'Necromancy'], label: 'Worldgorger + Necromancy', speed: 'setup', result: '有条件的法术力循环', recommendedBracket: 3 },
]);

// anyOfGroups 每组至少命中一张，atLeastGroups 按不同牌名计数。
// 后六条只是高置信结构模式，会提供强度证据，但不会冒充 Top 15 的完整固定家族。
const COMBO_PATTERNS = Object.freeze([
  { id: 'floodcaller-knack-artifact', familyId: 'floodcaller-bounce', countsAsCompleteFamily: true, required: ['Valley Floodcaller'], anyOfGroups: [['Retraction Helix', 'Banishing Knack'], ['Mox Amber', 'Mox Opal', 'Chrome Mox', 'Lotus Petal', "Lion's Eye Diamond", "Mishra's Bauble", "Urza's Bauble", "Tormod's Crypt", 'Welding Jar', 'Everflowing Chalice', 'Jeweled Amulet', 'Sol Ring', 'Mana Vault', 'Grim Monolith']], label: 'Valley Floodcaller Bounce Loop', speed: 'early', result: '无限风暴与有条件的法术力', recommendedBracket: 4 },
  { id: 'sisay-emiel-derevi-mana', familyId: 'sisay-emiel-derevi', countsAsCompleteFamily: true, required: ['Sisay, Weatherlight Captain', 'Emiel the Blessed', 'Derevi, Empyrial Tactician'], anyOfGroups: [['Bloom Tender', 'Selvala, Heart of the Wilds']], label: 'Sisay + Emiel + Derevi', speed: 'early', result: '无限法术力与主将循环', recommendedBracket: 4 },
  { id: 'dargo-breach-altar', familyId: 'dargo-loop', countsAsCompleteFamily: true, commanderRequired: ['Dargo, the Shipwrecker'], required: ['Underworld Breach', 'Lotus Petal', 'Altar of Dementia'], label: 'Dargo Breach Loop', speed: 'early', result: '重复施放与磨牌循环', recommendedBracket: 4 },
  { id: 'dargo-engine-sacrifice', familyId: 'dargo-loop', countsAsCompleteFamily: true, commanderRequired: ['Dargo, the Shipwrecker'], anyOfGroups: [['Birgi, God of Storytelling', 'Relic of Legends', 'Pitiless Plunderer'], ['Altar of Dementia', 'Goblin Bombardment']], label: 'Dargo Recast Loop', speed: 'early', result: '重复施放与牺牲循环', recommendedBracket: 4 },
  { id: 'dargo-technomancer-recursion', familyId: 'dargo-loop', countsAsCompleteFamily: true, commanderRequired: ['Dargo, the Shipwrecker'], required: ['Ruthless Technomancer'], anyOfGroups: [['Cursed Mirror', 'Corpse Dance', 'Mardu Siegebreaker']], label: 'Dargo Technomancer Loop', speed: 'early', result: '重复施放与牺牲循环', recommendedBracket: 4 },
  { id: 'magda-clock-artifact-dwarf', familyId: 'magda-clock', countsAsCompleteFamily: true, required: ['Magda, Brazen Outlaw', 'Clock of Omens'], anyOfGroups: [['Universal Automaton', 'Metallic Mimic', 'Adaptive Automaton', 'Roaming Throne', 'Barkform Harvester', 'Three Tree Mascot', 'Bloodline Pretender', 'Mirror of the Forebears']], label: 'Magda + Clock of Omens', speed: 'early', result: '无限珍宝', recommendedBracket: 4 },
  { id: 'hullbreaker-repeatable-artifacts', familyId: 'hullbreaker-pattern', kind: 'pattern', required: ['Hullbreaker Horror'], atLeastGroups: [{ cards: ['Mox Amber', 'Mox Opal', 'Chrome Mox', 'Lotus Petal', "Lion's Eye Diamond", 'Sol Ring', 'Mana Vault', 'Grim Monolith', 'Arcane Signet', 'Fellwar Stone'], count: 2 }], label: 'Hullbreaker Horror ＋ 低费法术力物', speed: 'setup', result: '可以达成无限释放与无限漂浮法术力', recommendedBracket: 3 },
  { id: 'lumra-land-recursion', familyId: 'lumra-pattern', kind: 'pattern', commanderRequired: ['Lumra, Bellow of the Woods'], required: ['Lotus Cobra'], anyOfGroups: [['Altar of Dementia', 'Greater Good', 'Squandered Resources']], atLeastGroups: [{ cards: ['Arid Mesa', 'Bloodstained Mire', 'Flooded Strand', 'Marsh Flats', 'Misty Rainforest', 'Polluted Delta', 'Scalding Tarn', 'Verdant Catacombs', 'Windswept Heath', 'Wooded Foothills', 'Prismatic Vista', 'Fabled Passage'], count: 2 }], label: 'Lotus Cobra ＋ 切地 ＋ 牺牲引擎', speed: 'setup', result: '反复切地滚出法术力与抓牌', recommendedBracket: 3 },
  { id: 'tayam-role-loop', familyId: 'tayam-pattern', kind: 'pattern', commanderRequired: ['Tayam, Luminous Enigma'], required: ['Devoted Druid'], anyOfGroups: [['Ashnod\'s Altar', 'Phyrexian Altar', 'Altar of Dementia', 'Blasting Station'], ['Hapatra, Vizier of Poisons', 'Young Wolf', 'Strangleroot Geist', 'Promise of Bunrei']], label: 'Devoted Druid ＋ 祭坛 ＋ 不死生物', speed: 'setup', result: '反复牺牲与回场，滚出无限法术力或磨牌', recommendedBracket: 3 },
  { id: 'protean-hulk-pile', familyId: 'protean-hulk-pattern', kind: 'pattern', required: ['Protean Hulk'], anyOfGroups: [['Viscera Seer', 'Carrion Feeder', 'Altar of Dementia', 'Phyrexian Altar', "Ashnod's Altar"]], atLeastGroups: [{ cards: ['Karmic Guide', 'Reveillark', 'Mikaeus, the Unhallowed', 'Walking Ballista', 'Body Snatcher', 'Activated Sleeper', 'Melira, Sylvok Outcast', 'Lesser Masticore', 'Disciple of the Vault'], count: 2 }], label: 'Protean Hulk ＋ 检索目标 ＋ 牺牲引擎', speed: 'early', result: '牺牲后直接搜出整套制胜组件', recommendedBracket: 3 },
  { id: 'doomsday-pile', familyId: 'doomsday-pattern', kind: 'pattern', required: ['Doomsday'], atLeastGroups: [{ cards: ["Thassa's Oracle", 'Laboratory Maniac', 'Jace, Wielder of Mysteries', 'Gush', 'Street Wraith', "Lion's Eye Diamond", 'Gitaxian Probe', 'Consider', 'Edge of Autumn'], count: 2 }], label: 'Doomsday ＋ 牌堆组件', speed: 'early', result: '叠好牌库后直接过牌取胜', recommendedBracket: 3 },
  { id: 'arcum-ring-mind-over-matter', familyId: 'arcum-engine-pattern', kind: 'engine', commanderRequired: ['Arcum Dagsson'], required: ['The One Ring', 'Mind Over Matter'], label: 'Arcum Ring 抽牌引擎', speed: 'setup', result: '抽牌与重置引擎', recommendedBracket: 3 },
]);

const CARD_ALIASES = Object.freeze({
  "tergrid, god of fright // tergrid's lantern": 'Tergrid, God of Fright',
  "birgi, god of storytelling // harnfel, horn of bounty": 'Birgi, God of Storytelling',
  'etali, primal conqueror // etali, primal sickness': 'Etali, Primal Conqueror',
  'boom // bust': 'Boom // Bust',
});

module.exports = {
  BRACKET_MANIFEST,
  BRACKET_LABELS,
  BAND_POSITION_CONFIG,
  COMBO_SPEED_CONFIG,
  GAME_CHANGERS,
  BANNED_CARDS,
  BANNED_AS_COMPANION,
  MASS_LAND_DENIAL,
  EXTRA_TURNS,
  SIGNAL_GROUPS,
  TOP_COMBO_FAMILIES,
  KNOWN_COMBOS,
  COMBO_PATTERNS,
  CARD_ALIASES,
};
