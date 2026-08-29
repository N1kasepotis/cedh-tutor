// Derived from https://github.com/Kuuusoda/edhti.
// Official card images and generated avatar assets are intentionally not bundled.

const edhtiAxes = {
  "intent": [
    "competitive",
    "fun"
  ],
  "table": [
    "social",
    "solo"
  ],
  "complexity": [
    "complex",
    "direct"
  ],
  "meta": [
    "mainstream",
    "offmeta"
  ]
};

const edhtiTagLabels = {
  "salt": "红温指数",
  "talk": "嘴遁指数",
  "judge": "裁判压力",
  "combo": "Combo脑",
  "power": "强度洁癖",
  "offbeat": "冷门雷达",
  "aggro": "拍怪冲动",
  "politics": "政治手腕"
};

const edhtiPersonaColors = {
  CTXM: '#28F6FF',
  CTXO: '#7AE7FF',
  CTDM: '#8C7CFF',
  CTDO: '#FF4FD8',
  CSXM: '#4CD7B8',
  CSXO: '#B88CFF',
  CSDM: '#5AA9FF',
  CSDO: '#FF6A5C',
  FTXM: '#FFB84D',
  FTXO: '#FF7BC8',
  FTDM: '#FF5A4E',
  FTDO: '#FF9D66',
  FSXM: '#4FD89A',
  FSXO: '#D7B46A',
  FSDM: '#C7F05A',
  FSDO: '#8DE1C2',
};

const edhtiPersonas = {
  CTXM: {
    code: 'CTXM',
    name: 'Combo百科',
    subtitle: '竞技社交复杂主流',
    description: '你不只是会赢，你还会解释自己为什么从这一层响应开始就已经赢了。你喜欢成熟强力的连锁、清晰的胜利窗口，也不介意用三分钟把牌桌带进你的逻辑宇宙。',
    quote: '别人会觉得你很懂、很快，也很需要一个计时器。',
    strategy: ["Storm","Spellslinger","Tutor","Compact Combo"],
    colors: '蓝红为核心，常见 Grixis / Jeskai / 五色',
    color: '#28F6FF',
    commander: {
      cn: '伊捷首法师米捷兹',
      en: 'Mizzix of the Izmagnus',
    },
    commanderPool: [
      "Niv-Mizzet, Parun",
      "Mizzix of the Izmagnus",
      "Vadrik, Astral Archmage",
      "Rielle, the Everwise",
      "Veyran, Voice of Duality",
      "Kalamax, the Stormsire",
      "Vivi Ornitier",
      "Wort, the Raidmother",
      "Zaffai, Thunder Conductor",
      "Melek, Izzet Paragon",
    ],
  },
  CTXO: {
    code: 'CTXO',
    name: '规则邪修',
    subtitle: '竞技社交复杂冷门',
    description: '你的快乐来自一句话：严格来说，这里还有一个响应窗口。你喜欢冷门互动、奇怪替代效应和别人没准备过的胜利路线。',
    quote: '别人会在你开始整理触发顺序时默默打开规则搜索。',
    strategy: ["Rules Puzzle","Copy Effects","Polymorph","Niche Combo"],
    colors: '蓝为核心，搭配红绿黑都能出怪东西',
    color: '#7AE7FF',
    commander: {
      cn: '万形归一欧瓦尔',
      en: 'Orvar, the All-Form',
    },
    commanderPool: [
      "Orvar, the All-Form",
      "Ivy, Gleeful Spellthief",
      "Volo, Guide to Monsters",
      "Zada, Hedron Grinder",
      "Feather, the Redeemed",
      "Hofri Ghostforge",
      "Cadric, Soul Kindler",
      "Ratadrabik of Urborg",
      "Brago, King Eternal",
      "Roon of the Hidden Realm",
    ],
  },
  CTDM: {
    code: 'CTDM',
    name: '强度嘴王',
    subtitle: '竞技社交直接主流',
    description: '你会先确认强度、节奏和威胁排序，然后用非常充分的理由说服全桌先处理别人。你爱强牌，也爱赢在信息差和桌面判断。',
    quote: '别人会怀疑你每一句话都有第二层目的。',
    strategy: ["Midrange","Tempo","Goodstuff","Politics"],
    colors: 'Esper / Grixis / 五色好牌',
    color: '#8C7CFF',
    commander: {
      cn: '密报商棣维特',
      en: 'Tivit, Seller of Secrets',
    },
    commanderPool: [
      "Queen Marchesa",
      "Breena, the Demagogue",
      "Shadrix Silverquill",
      "The Council of Four",
      "Tivit, Seller of Secrets",
      "Tasigur, the Golden Fang",
      "Kenrith, the Returned King",
      "Ms. Bumbleflower",
      "Gluntch, the Bestower",
      "Kynaios and Tiro of Meletis",
    ],
  },
  CTDO: {
    code: 'CTDO',
    name: '奇袭刺客',
    subtitle: '竞技社交直接冷门',
    description: '你不一定玩最热门的套牌，但你一定要让对手为轻敌付费。你喜欢短平快、出其不意、低调攒杀机。',
    quote: '别人经常在输掉前一回合才意识到你是最大威胁。',
    strategy: ["Aggro","Voltron","Stompy","Surprise Kill"],
    colors: 'Dimir / Boros / Mardu / Naya 奇袭',
    color: '#FF4FD8',
    commander: {
      cn: '虎影百合子',
      en: 'Yuriko, the Tiger\'s Shadow',
    },
    commanderPool: [
      "Slicer, Hired Muscle",
      "Alexios, Deimos of Kosmos",
      "Greven, Predator Captain",
      "Zangief, the Red Cyclone",
      "Ruhan of the Fomori",
      "Thantis, the Warweaver",
      "Marisi, Breaker of the Coil",
      "Firkraag, Cunning Instigator",
      "Karazikar, the Eye Tyrant",
      "Yuriko, the Tiger's Shadow",
    ],
  },
  CSXM: {
    code: 'CSXM',
    name: '引擎会计',
    subtitle: '竞技执行复杂主流',
    description: '你相信每一点法术力都应该变成资源，每个触发都要记账。你不太需要谈判，因为你的场面本身已经在陈述事实。',
    quote: '别人看你横置十个永久物时，会开始问现在是第几个主阶段。',
    strategy: ["Engine","Value Town","Graveyard","Ramp"],
    colors: 'Sultai / Bant / Temur 绿为核心',
    color: '#4CD7B8',
    commander: {
      cn: '受诅国王寇沃',
      en: 'Korvold, Fae-Cursed King',
    },
    commanderPool: [
      "Aesi, Tyrant of Gyre Strait",
      "Tatyova, Benthic Druid",
      "Chulane, Teller of Tales",
      "Yarok, the Desecrated",
      "Korvold, Fae-Cursed King",
      "Prosper, Tome-Bound",
      "Muldrotha, the Gravetide",
      "Teval, the Balanced Scale",
      "Meren of Clan Nel Toth",
      "The Gitrog Monster",
    ],
  },
  CSXO: {
    code: 'CSXO',
    name: '冷门匠人',
    subtitle: '竞技执行复杂冷门',
    description: '你喜欢把没人看的主将调到刚好能赢。你享受构筑过程，享受让一张冷门牌承担精密机器里的关键齿轮。',
    quote: '别人常常先笑你的主将，然后认真阅读第二遍。',
    strategy: ["Artifact","Enchantment","Sacrifice","Off-meta Engine"],
    colors: ' esper / Mardu / Jeskai 黑白为核心',
    color: '#B88CFF',
    commander: {
      cn: '云游诗人伊散',
      en: 'Yisan, the Wanderer Bard',
    },
    commanderPool: [
      "Grolnok, the Omnivore",
      "Eruth, Tormented Prophet",
      "Gnostro, Voice of the Crags",
      "Gorion, Wise Mentor",
      "Oji, the Exquisite Blade",
      "Myra the Magnificent",
      "Jan Jansen, Chaos Crafter",
      "Mishra, Artificer Prodigy",
      "Magar of the Magic Strings",
      "Yisan, the Wanderer Bard",
    ],
  },
  CSDM: {
    code: 'CSDM',
    name: '主流卷王',
    subtitle: '竞技执行直接主流',
    description: '你尊重数据、榜单和成熟构筑。你不一定话多，但你的套牌会准时加速、准时互动、准时提出致命问题。',
    quote: '别人会觉得你这套牌没有废牌，连地都像精挑细选过。',
    strategy: ["Goodstuff","Midrange","Aggro","Tempo"],
    colors: '五色好牌 / Sultai / Jeskai',
    color: '#5AA9FF',
    commander: {
      cn: '复归国王肯理斯',
      en: 'Kenrith, the Returned King',
    },
    commanderPool: [
      "Kenrith, the Returned King",
      "Atraxa, Praetors' Voice",
      "Atraxa, Grand Unifier",
      "Jodah, the Unifier",
      "Esika, God of the Tree",
      "Niv-Mizzet Reborn",
      "Omnath, Locus of Creation",
      "Tivit, Seller of Secrets",
      "Sisay, Weatherlight Captain",
      "Narset, Enlightened Master",
    ],
  },
  CSDO: {
    code: 'CSDO',
    name: '单刀怪客',
    subtitle: '竞技执行直接冷门',
    description: '你喜欢少废话，给压力，逼对手回答。你可以玩冷门，但冷门不是借口，能砍人才算合格。',
    quote: '别人会在第三回合开始重新计算自己的血量。',
    strategy: ["Voltron","Aggro","Stomp","Single-threat"],
    colors: 'Boros / Selesnya / Naya / Gruul 单体强化',
    color: '#FF6A5C',
    commander: {
      cn: '受雇狂徒切片',
      en: 'Slicer, Hired Muscle',
    },
    commanderPool: [
      "Light-Paws, Emperor's Voice",
      "Sram, Senior Edificer",
      "Wyleth, Soul of Steel",
      "Greven, Predator Captain",
      "Wilson, Refined Grizzly",
      "Thrun, the Last Troll",
      "Sigarda, Host of Herons",
      "Uril, the Miststalker",
      "Rafiq of the Many",
      "Slicer, Hired Muscle",
    ],
  },
  FTXM: {
    code: 'FTXM',
    name: '欢乐术士',
    subtitle: '娱乐社交复杂主流',
    description: '你喜欢大场面、奇妙连锁和全桌一起惊呼。赢当然不错，但你更在乎这局有没有能被讲三天的片段。',
    quote: '别人会期待你这局又准备了什么节目。',
    strategy: ["Group Hug","Chaos","Big Spells","Social"],
    colors: 'Bant / Five-color 群体互动',
    color: '#FFB84D',
    commander: {
      cn: '纠拧风暴塞利兹',
      en: 'Xyris, the Writhing Storm',
    },
    commanderPool: [
      "Phelddagrif",
      "Kwain, Itinerant Meddler",
      "Zedruu the Greathearted",
      "Kynaios and Tiro of Meletis",
      "Rocco, Street Chef",
      "Gluntch, the Bestower",
      "Brenard, Ginger Sculptor",
      "Arcades, the Strategist",
      "Sokrates, Athenian Teacher",
      "Xyris, the Writhing Storm",
    ],
  },
  FTXO: {
    code: 'FTXO',
    name: '混沌导演',
    subtitle: '娱乐社交复杂冷门',
    description: '你不只是打牌，你在导一场多人即兴剧。桌面越乱、选择越多、剧情越离谱，你越觉得这局值回票价。',
    quote: '别人会在你的回合同时笑、慌、查牌。',
    strategy: ["Chaos","Gift","Steal","Coin Flip"],
    colors: 'Grixis / Five-color 混沌',
    color: '#FF7BC8',
    commander: {
      cn: '毁灵师奈库萨',
      en: 'Nekusar, the Mindrazer',
    },
    commanderPool: [
      "Norin the Wary",
      "Blim, Comedic Genius",
      "Jon Irenicus, Shattered One",
      "Xantcha, Sleeper Agent",
      "Neera, Wild Mage",
      "Yidris, Maelstrom Wielder",
      "Karona, False God",
      "Vaevictis Asmadi, the Dire",
      "Aminatou, the Fateshifter",
      "Nekusar, the Mindrazer",
    ],
  },
  FTDM: {
    code: 'FTDM',
    name: '红温政客',
    subtitle: '娱乐社交直接主流',
    description: '你爱互动、爱谈局势，也爱把情绪写在脸上。你可能不是最想卷的人，但你绝不会让牌桌安静无事发生。',
    quote: '别人会觉得跟你打牌很有节目效果，偶尔也需要降温。',
    strategy: ["Aggro","Politics","Goad","Group Slug"],
    colors: 'Mardu / Rakdos / Jeskai 政治互动',
    color: '#FF5A4E',
    commander: {
      cn: '至善赛特鲁',
      en: 'Zedruu the Greathearted',
    },
    commanderPool: [
      "Breena, the Demagogue",
      "Firkraag, Cunning Instigator",
      "Gahiji, Honored One",
      "Saskia the Unyielding",
      "Marisi, Breaker of the Coil",
      "Kitt Kanto, Mayhem Diva",
      "Phabine, Boss's Confidant",
      "Jetmir, Nexus of Revels",
      "Jinnie Fay, Jetmir's Second",
      "Zedruu the Greathearted",
    ],
  },
  FTDO: {
    code: 'FTDO',
    name: '桌面社牛',
    subtitle: '娱乐社交直接冷门',
    description: '你能把奇怪主将玩成社交事件。你喜欢喊人结盟、临时交易、互相拱火，赢不赢先放一边，局一定要热起来。',
    quote: '别人会发现你还没出威胁，已经开始影响战斗方向。',
    strategy: ["Group Hug","Politics","Vote","Social"],
    colors: 'Bant / Jeskai / Five-color 社交',
    color: '#FF9D66',
    commander: {
      cn: '迈勒提斯的库瑙斯与提罗',
      en: 'Kynaios and Tiro of Meletis',
    },
    commanderPool: [
      "Ms. Bumbleflower",
      "Sokrates, Athenian Teacher",
      "Braids, Conjurer Adept",
      "Rocco, Street Chef",
      "Kwain, Itinerant Meddler",
      "Gluntch, the Bestower",
      "Brenard, Ginger Sculptor",
      "Xyris, the Writhing Storm",
      "Captain Howler, Sea Scourge",
      "Kynaios and Tiro of Meletis",
    ],
  },
  FSXM: {
    code: 'FSXM',
    name: '价值园丁',
    subtitle: '娱乐执行复杂主流',
    description: '你喜欢慢慢种出一片资源森林。你享受引擎运转、地牌进出、坟场循环，胜利最好像自然发生。',
    quote: '别人会低估你，直到你每回合抓五张、下三块地。',
    strategy: ["Landfall","Ramp","Value","Big Mana"],
    colors: 'Simic / Temur 绿为核心',
    color: '#4FD89A',
    commander: {
      cn: '深洋德鲁伊塔托娃',
      en: 'Tatyova, Benthic Druid',
    },
    commanderPool: [
      "Aesi, Tyrant of Gyre Strait",
      "Tatyova, Benthic Druid",
      "Omnath, Locus of Creation",
      "Lord Windgrace",
      "The Gitrog Monster",
      "Karametra, God of Harvests",
      "Hearthhull, the Worldseed",
      "Hazezon, Shaper of Sand",
      "Soul of Windgrace",
      "Zimone and Dina",
    ],
  },
  FSXO: {
    code: 'FSXO',
    name: '怪牌收藏',
    subtitle: '娱乐执行复杂冷门',
    description: '你会因为一张没人用的牌开始做一整套牌。你不急着证明它强，你只是想知道它到底能不能发光。',
    quote: '别人会在你展示牌表时不断说：这张牌我第一次见。',
    strategy: ["Tribal","Mutation","Clone","Off-meta"],
    colors: 'Sultai / Temur 怪异主题',
    color: '#D7B46A',
    commander: {
      cn: '腐潮穆杜塔',
      en: 'Muldrotha, the Gravetide',
    },
    commanderPool: [
      "Grolnok, the Omnivore",
      "Zellix, Sanity Flayer",
      "Volo, Guide to Monsters",
      "Ivy, Gleeful Spellthief",
      "Cadric, Soul Kindler",
      "Gnostro, Voice of the Crags",
      "Gorion, Wise Mentor",
      "Eruth, Tormented Prophet",
      "Rilsa Rael, Kingpin",
      "Muldrotha, the Gravetide",
    ],
  },
  FSDM: {
    code: 'FSDM',
    name: '拍怪莽夫',
    subtitle: '娱乐执行直接主流',
    description: '你喜欢简单快乐：跳费、拍威胁、进战斗。你不排斥强牌，但你更想让主将和大怪真的上桌做事。',
    quote: '别人知道你要做什么，但还是得回答你的场面。',
    strategy: ["Stompy","Big Creatures","Aggro","Dragons"],
    colors: 'Gruul / Temur / Mono-red 大生物',
    color: '#C7F05A',
    commander: {
      cn: '暴民头目克仑可',
      en: 'Krenko, Mob Boss',
    },
    commanderPool: [
      "Xenagos, God of Revels",
      "Etali, Primal Conqueror",
      "Ghalta, Primal Hunger",
      "Atarka, World Render",
      "Klauth, Unrivaled Ancient",
      "Animar, Soul of Elements",
      "Miirym, Sentinel Wyrm",
      "The Ur-Dragon",
      "Maelstrom Wanderer",
      "Krenko, Mob Boss",
    ],
  },
  FSDO: {
    code: 'FSDO',
    name: '河马送礼',
    subtitle: '娱乐执行直接冷门',
    description: '你喜欢用怪选择创造好玩的局。你可能会送牌、送血、送小礼物，然后看全桌因为这些礼物走向完全不同的结局。',
    quote: '别人不会立刻打你，但也不确定该不该信你。',
    strategy: ["Group Hug","Gift","Donate","Chaos"],
    colors: 'Jeskai / Five-color 送礼',
    color: '#8DE1C2',
    commander: {
      cn: '紫河马',
      en: 'Phelddagrif',
    },
    commanderPool: [
      "Blim, Comedic Genius",
      "Jon Irenicus, Shattered One",
      "Zedruu the Greathearted",
      "Karona, False God",
      "Xantcha, Sleeper Agent",
      "Phelddagrif",
      "Kynaios and Tiro of Meletis",
      "Brenard, Ginger Sculptor",
      "Gluntch, the Bestower",
      "Kwain, Itinerant Meddler",
    ],
  },
};

const edhtiPersonaOdds = {
  FTXO: 15.58,
  CTXO: 12.09,
  CTXM: 11.11,
  CSXO: 8.61,
  FTDO: 7.12,
  CSXM: 6.87,
  CTDM: 6.6,
  FSXO: 6.16,
  FTXM: 5.22,
  CTDO: 4.3,
  FTDM: 4.05,
  CSDM: 3.96,
  CSDO: 2.83,
  FSDO: 2.64,
  FSXM: 1.61,
  FSDM: 1.26,
};

const edhtiQuestions = [

  {
    "id": "q01",
    "bucket": "intent",
    "prompt": "坐下前大家说这局是B桌强度，你心里最先确认什么？",
    "answers": [
      {
        "text": "有没有无限和导师，别到时候说不清。",
        "scores": {
          "competitive": 3,
          "mainstream": 1
        },
        "tags": {
          "power": 2,
          "talk": 1
        }
      },
      {
        "text": "大家想打多快？我可以换套牌。",
        "scores": {
          "fun": 2,
          "social": 2
        },
        "tags": {
          "politics": 2
        }
      },
      {
        "text": "只要不是 cEDH，我这套应该能玩。",
        "scores": {
          "competitive": 1,
          "direct": 1
        },
        "tags": {
          "power": 1
        }
      },
      {
        "text": "B桌？我只想看我的怪东西能不能动。",
        "scores": {
          "fun": 3,
          "offmeta": 2
        },
        "tags": {
          "offbeat": 2
        }
      }
    ]
  },
  {
    "id": "q02",
    "bucket": "intent",
    "prompt": "你构筑一套新 EDH 时，第一张进牌表的通常是？",
    "answers": [
      {
        "text": "高效跳费、导师和保护。",
        "scores": {
          "competitive": 3,
          "mainstream": 2
        },
        "tags": {
          "power": 3
        }
      },
      {
        "text": "能代表主题的关键怪牌。",
        "scores": {
          "fun": 2,
          "offmeta": 2,
          "complex": 1
        },
        "tags": {
          "offbeat": 3
        }
      },
      {
        "text": "主将最好的一卡组合技。",
        "scores": {
          "competitive": 2,
          "complex": 2
        },
        "tags": {
          "combo": 3
        }
      },
      {
        "text": "能让全桌产生互动的牌。",
        "scores": {
          "fun": 2,
          "social": 2
        },
        "tags": {
          "politics": 2,
          "talk": 1
        }
      }
    ]
  },
  {
    "id": "q05",
    "bucket": "intent",
    "prompt": "你的制胜选择通常是？",
    "answers": [
      {
        "text": "最短路径，能赢就别拖。",
        "scores": {
          "competitive": 3,
          "direct": 2
        },
        "tags": {
          "power": 2
        }
      },
      {
        "text": "能赢，但最好赢得好看。",
        "scores": {
          "competitive": 1,
          "fun": 2,
          "complex": 1
        },
        "tags": {
          "combo": 1
        }
      },
      {
        "text": "让大家一个回合，看会不会被翻盘。",
        "scores": {
          "fun": 3,
          "social": 1
        },
        "tags": {
          "politics": 2
        }
      },
      {
        "text": "尝试那条成功率 40% 但很帅的线。",
        "scores": {
          "fun": 3,
          "offmeta": 2,
          "complex": 1
        },
        "tags": {
          "offbeat": 2
        }
      }
    ]
  },
  {
    "id": "q44",
    "bucket": "intent",
    "prompt": "一位牌手比其他人血量都低，如果你有击杀的机会，你想：",
    "answers": [
      {
        "text": "一脚爆抽，当场送走。",
        "scores": { "competitive": 3, "direct": 3 },
        "tags": { "aggro": 3, "salt": 1 }
      },
      {
        "text": "如果送走这位对手对最终取胜有帮助，我会执行。",
        "scores": { "competitive": 3, "complex": 2 },
        "tags": { "power": 2, "combo": 1 }
      },
      {
        "text": "先磨磨其他人的血量，让别人处理。",
        "scores": { "social": 2, "fun": 1 },
        "tags": { "politics": 2 }
      },
      {
        "text": "不管，我从来不喜欢猛袭思路。",
        "scores": { "fun": 2, "solo": 2 },
        "tags": { "combo": 1 }
      },
      {
        "text": "踢到留一丝血，这是我最后的温柔了。",
        "scores": { "fun": 3, "social": 3 },
        "tags": { "talk": 2, "politics": 1 }
      }
    ]
  },

  {
    "id": "q08",
    "bucket": "intent",
    "prompt": "你最喜欢别人怎么评价你的套牌？",
    "answers": [
      {
        "text": "这套真的很稳。",
        "scores": {
          "competitive": 2,
          "mainstream": 2
        },
        "tags": {
          "power": 2
        }
      },
      {
        "text": "这套太有你味了。",
        "scores": {
          "fun": 2,
          "offmeta": 2
        },
        "tags": {
          "offbeat": 2
        }
      },
      {
        "text": "我完全没想到你能这么赢。",
        "scores": {
          "competitive": 1,
          "complex": 2,
          "offmeta": 1
        },
        "tags": {
          "combo": 2,
          "judge": 1
        }
      },
      {
        "text": "这局因为你变得很好玩。",
        "scores": {
          "fun": 3,
          "social": 2
        },
        "tags": {
          "talk": 2,
          "politics": 1
        }
      }
    ]
  },
  {
    "id": "q09",
    "bucket": "table",
    "prompt": "你起手一般般，但可以靠话术来拱火，你会？",
    "answers": [
      {
        "text": "当然要talk。",
        "scores": {
          "social": 3,
          "competitive": 1
        },
        "tags": {
          "talk": 3,
          "politics": 3
        }
      },
      {
        "text": "会说两句，但主要还是自己发育。",
        "scores": {
          "solo": 2,
          "competitive": 1
        },
        "tags": {
          "politics": 1
        }
      },
      {
        "text": "不太想 talk，按牌打就行。",
        "scores": {
          "solo": 3,
          "direct": 1
        },
        "tags": {
          "talk": -1
        }
      },
      {
        "text": "如果能制造节目效果，我会拱火。",
        "scores": {
          "fun": 2,
          "social": 2
        },
        "tags": {
          "talk": 3,
          "politics": 2
        }
      }
    ]
  },
  {
    "id": "q10",
    "bucket": "table",
    "prompt": "有人准备攻击/康你，你第一反应是？",
    "answers": [
      {
        "text": "解释为什么另一个人才是威胁。",
        "scores": {
          "social": 3,
          "competitive": 1
        },
        "tags": {
          "talk": 3,
          "politics": 3
        }
      },
      {
        "text": "亮互动，让他自己判断。",
        "scores": {
          "solo": 2,
          "competitive": 2
        },
        "tags": {
          "power": 1
        }
      },
      {
        "text": "记仇，等我下回合处理。",
        "scores": {
          "solo": 2,
          "competitive": 1,
          "direct": 1
        },
        "tags": {
          "salt": 3
        }
      },
      {
        "text": "没事，打就打，来戏了。",
        "scores": {
          "fun": 3,
          "solo": 1
        },
        "tags": {
          "salt": -1
        }
      }
    ]
  },
  {
    "id": "q43",
    "bucket": "wildcard",
    "prompt": "生机核欧纳斯玩家主阶一已经说书15分钟了，场上操控了比其他三位玩家加起来还多三倍的永久物，只见他还在启动将地放入战场的异能，结算第12个不朽供给人的珍宝，你会：",
    "answers": [
      {
        "text": "看他操作，提醒他的miss trigger。",
        "scores": { "competitive": 2, "complex": 2, "social": 1 },
        "tags": { "judge": 2, "talk": 1 }
      },
      {
        "text": "趁机上厕所看手机。",
        "scores": { "fun": 3, "direct": 2 },
        "tags": { "salt": 1 }
      },
      {
        "text": "计算牌库顶下一张能抽到扫场或制胜的概率。",
        "scores": { "competitive": 3, "complex": 3, "solo": 2 },
        "tags": { "combo": 2, "power": 1 }
      },
      {
        "text": "看他操作，综合考虑一下晚上吃小炒黄牛肉还是汉堡。",
        "scores": { "fun": 3, "social": 2, "direct": 1 },
        "tags": { "talk": 2 }
      },
      {
        "text": "非法占卜一下牌库顶。",
        "scores": { "offmeta": 3, "fun": 2, "complex": 1 },
        "tags": { "offbeat": 2, "judge": 1 }
      }
    ]
  },
  {
    "id": "q11",
    "bucket": "table",
    "prompt": "桌上有人快赢了，你更常做什么？",
    "answers": [
      {
        "text": "组织大家按顺序交互动。",
        "scores": {
          "social": 3,
          "competitive": 2
        },
        "tags": {
          "talk": 2,
          "politics": 3
        }
      },
      {
        "text": "自己交最稳的解。",
        "scores": {
          "solo": 3,
          "competitive": 2
        },
        "tags": {
          "power": 1
        }
      },
      {
        "text": "如果能活，我先让别人交。",
        "scores": {
          "solo": 2,
          "competitive": 2
        },
        "tags": {
          "politics": 3
        }
      },
      {
        "text": "看看能不能借他的威胁制造更乱的局。",
        "scores": {
          "fun": 2,
          "solo": 1,
          "complex": 1
        },
        "tags": {
          "politics": 2,
          "offbeat": 1
        }
      }
    ]
  },
  {
    "id": "q12",
    "bucket": "table",
    "prompt": "你被康掉关键咒语时，通常会？",
    "answers": [
      {
        "text": "合理互动，继续下一步。",
        "scores": {
          "solo": 3,
          "competitive": 1
        },
        "tags": {
          "salt": -2
        }
      },
      {
        "text": "开始解释这张其实没那么强。",
        "scores": {
          "social": 2,
          "fun": 1
        },
        "tags": {
          "talk": 3,
          "salt": 2
        }
      },
      {
        "text": "记住这个人，威胁排序更新。",
        "scores": {
          "solo": 2,
          "competitive": 2,
          "direct": 1
        },
        "tags": {
          "salt": 3
        }
      },
      {
        "text": "笑出来，这说明它值得被康。",
        "scores": {
          "fun": 3,
          "solo": 1
        },
        "tags": {
          "salt": -1,
          "talk": 1
        }
      }
    ]
  },
  {
    "id": "q17",
    "bucket": "complexity",
    "prompt": "你发现一套需要三张永久物、两层触发和一次响应窗口的互动，会？",
    "answers": [
      {
        "text": "太美了，这就是 EDH。",
        "scores": {
          "complex": 3,
          "fun": 2,
          "offmeta": 1
        },
        "tags": {
          "judge": 3,
          "combo": 2
        }
      },
      {
        "text": "如果能稳定赢，可以研究。",
        "scores": {
          "competitive": 2,
          "complex": 2
        },
        "tags": {
          "combo": 3,
          "power": 1
        }
      },
      {
        "text": "太麻烦，换直观赢法。",
        "scores": {
          "direct": 3,
          "mainstream": 1
        },
        "tags": {
          "judge": -2
        }
      },
      {
        "text": "先写一段说明，避免当场吵架。",
        "scores": {
          "complex": 2,
          "social": 2
        },
        "tags": {
          "judge": 3,
          "talk": 2
        }
      }
    ]
  },
  {
    "id": "q41",
    "bucket": "table",
    "prompt": "第二回合你先动，大家第一回合除了你拍出贵族大主教都下地过了，你下地出了个2费ramp后发现大主教能颂威踢一脚，这时候你想：",
    "answers": [
      {
        "text": "算鸟不踢了，刚开局只有我ramp过，都不容易。",
        "scores": { "fun": 2, "social": 3 },
        "tags": { "talk": 1, "politics": 2 }
      },
      {
        "text": "给平时最c的朋友先来一脚以示尊敬。",
        "scores": { "social": 3, "direct": 1 },
        "tags": { "politics": 2, "talk": 2 }
      },
      {
        "text": "一滴血没必要吸引仇恨，让过了。",
        "scores": { "solo": 2, "competitive": 1 },
        "tags": { "politics": 1, "power": 1 }
      },
      {
        "text": "假装想踢，说\"算了留费责任吧\"假装有康/杀。",
        "scores": { "social": 2, "complex": 2 },
        "tags": { "politics": 3, "talk": 2, "judge": 1 }
      },
      {
        "text": "颂威是啥？",
        "scores": { "fun": 3, "direct": 2, "offmeta": 1 },
        "tags": { "talk": 1 }
      }
    ]
  },
  {
    "id": "q20",
    "bucket": "complexity",
    "prompt": "你更喜欢哪种胜利方式？",
    "answers": [
      {
        "text": "A+B 两张牌直接结束。",
        "scores": {
          "direct": 2,
          "competitive": 2,
          "mainstream": 1
        },
        "tags": {
          "combo": 1,
          "power": 1
        }
      },
      {
        "text": "五个组件串起来，全桌看懂后鼓掌。",
        "scores": {
          "complex": 3,
          "fun": 2
        },
        "tags": {
          "combo": 3,
          "judge": 2
        }
      },
      {
        "text": "不断赚资源，最后自然压死。",
        "scores": {
          "complex": 1,
          "competitive": 1,
          "solo": 1
        },
        "tags": {
          "power": 1
        }
      },
      {
        "text": "战斗阶段一拳带走。",
        "scores": {
          "direct": 3,
          "fun": 1,
          "solo": 1,
          "mainstream": 1
        },
        "tags": {
          "aggro": 3
        }
      }
    ]
  },
  {
    "id": "q42",
    "bucket": "complexity",
    "prompt": "你到了陌生的牌店打一把EDH，顺利的开局后你的上家对手操控破碎之人琼艾瑞尼卡斯给了你一个塔尼瓦（9/9，践踏，永久煽惑，时间跳跃，在你的维持开始时，由你操控的所有地越离），你心中默念：",
    "answers": [
      {
        "text": "你完了，我的牌垫上容不得脏东西。",
        "scores": { "direct": 3, "competitive": 2, "fun": 1 },
        "tags": { "salt": 2, "aggro": 2 }
      },
      {
        "text": "时间跳跃？有意思，这是我控制的永久物了，我看看异能该怎么正确结算。",
        "scores": { "complex": 3, "solo": 2, "competitive": 1 },
        "tags": { "judge": 3, "combo": 1 }
      },
      {
        "text": "这张牌并不算一个很好的选择，塔尼瓦太招仇恨而且锁地效率低下，而且触发破碎之人抓牌的时间只有平常赠礼的一半，实在一般。",
        "scores": { "competitive": 3, "complex": 2, "mainstream": 2 },
        "tags": { "power": 2, "combo": 1 }
      },
      {
        "text": "必须踢的时候我先踢优势最大的，然后轮流踢。",
        "scores": { "social": 3, "direct": 2, "competitive": 1 },
        "tags": { "politics": 3, "aggro": 1 }
      },
      {
        "text": "有意思，我也想送别人这个。",
        "scores": { "fun": 3, "offmeta": 3, "social": 1 },
        "tags": { "offbeat": 3, "talk": 1 }
      }
    ]
  },
  {
    "id": "q22",
    "bucket": "complexity",
    "prompt": "你最喜欢的资源类型是？",
    "answers": [
      {
        "text": "手牌、法术力、坟场一起循环。",
        "scores": {
          "complex": 3,
          "solo": 1
        },
        "tags": {
          "combo": 2
        }
      },
      {
        "text": "力量和防御力，简单直接。",
        "scores": {
          "direct": 3
        },
        "tags": {
          "aggro": 3
        }
      },
      {
        "text": "人情和承诺。",
        "scores": {
          "social": 3,
          "fun": 1
        },
        "tags": {
          "politics": 3,
          "talk": 2
        }
      },
      {
        "text": "高效单卡、核心手牌。",
        "scores": {
          "competitive": 2,
          "mainstream": 2
        },
        "tags": {
          "power": 2
        }
      }
    ]
  },
  {
    "id": "q24",
    "bucket": "complexity",
    "prompt": "你是否喜欢用复杂互动考考裁判？",
    "answers": [
      {
        "text": "喜欢，但我会先确认大家愿意。",
        "scores": {
          "complex": 3,
          "social": 2
        },
        "tags": {
          "judge": 4,
          "talk": 1
        }
      },
      {
        "text": "喜欢，规则深水区就是乐趣。",
        "scores": {
          "complex": 3,
          "offmeta": 2
        },
        "tags": {
          "judge": 5
        }
      },
      {
        "text": "不喜欢，我要的是牌局流畅。",
        "scores": {
          "direct": 3,
          "fun": 1
        },
        "tags": {
          "judge": -3
        }
      },
      {
        "text": "如果那是最强打法，我会用。",
        "scores": {
          "competitive": 3,
          "complex": 1
        },
        "tags": {
          "judge": 2,
          "power": 2
        }
      }
    ]
  },
  {
    "id": "q25",
    "bucket": "meta",
    "prompt": "你选主将时更容易被什么打动？",
    "answers": [
      {
        "text": "热度高，牌表成熟。",
        "scores": {
          "mainstream": 3,
          "competitive": 1
        },
        "tags": {
          "power": 2
        }
      },
      {
        "text": "没人玩，但我一眼看到潜力。",
        "scores": {
          "offmeta": 3,
          "complex": 1
        },
        "tags": {
          "offbeat": 3
        }
      },
      {
        "text": "朋友听到名字就有反应。",
        "scores": {
          "fun": 2,
          "social": 1,
          "offmeta": 1
        },
        "tags": {
          "talk": 1
        }
      },
      {
        "text": "能简单稳定地完成计划。",
        "scores": {
          "mainstream": 1,
          "direct": 2
        },
        "tags": {
          "power": 1
        }
      }
    ]
  },
  {
    "id": "q28",
    "bucket": "meta",
    "prompt": "你会为了冷门感牺牲多少强度？",
    "answers": [
      {
        "text": "不牺牲，冷门也要能赢。",
        "scores": {
          "competitive": 3,
          "offmeta": 1
        },
        "tags": {
          "power": 3
        }
      },
      {
        "text": "可以牺牲一点，换独特体验。",
        "scores": {
          "fun": 2,
          "offmeta": 2
        },
        "tags": {
          "offbeat": 2
        }
      },
      {
        "text": "牺牲很多也行，节目效果优先。",
        "scores": {
          "fun": 3,
          "offmeta": 3
        },
        "tags": {
          "offbeat": 4
        }
      },
      {
        "text": "我更喜欢成熟强牌。",
        "scores": {
          "mainstream": 3,
          "competitive": 1
        },
        "tags": {
          "power": 2
        }
      }
    ]
  },
  {
    "id": "q31",
    "bucket": "meta",
    "prompt": "新卡发售后，你更常做什么？",
    "answers": [
      {
        "text": "更新已有强力套牌的替换位。",
        "scores": {
          "competitive": 2,
          "mainstream": 2
        },
        "tags": {
          "power": 2
        }
      },
      {
        "text": "从传说生物里找没人注意的主将。",
        "scores": {
          "offmeta": 3,
          "fun": 1
        },
        "tags": {
          "offbeat": 3
        }
      },
      {
        "text": "找会改变现有 combo 的组件。",
        "scores": {
          "complex": 2,
          "competitive": 2
        },
        "tags": {
          "combo": 3
        }
      },
      {
        "text": "看有没有适合朋友局的搞笑牌。",
        "scores": {
          "fun": 3,
          "social": 1
        },
        "tags": {
          "talk": 1
        }
      }
    ]
  },
  {
    "id": "q32",
    "bucket": "meta",
    "prompt": "如果你的冷门套牌突然变成热门，你会？",
    "answers": [
      {
        "text": "开心，说明我眼光准。",
        "scores": {
          "competitive": 1,
          "mainstream": 1
        },
        "tags": {
          "power": 1
        }
      },
      {
        "text": "有点失落，开始找下一个。",
        "scores": {
          "offmeta": 3
        },
        "tags": {
          "offbeat": 3
        }
      },
      {
        "text": "继续优化，热门资料更多了。",
        "scores": {
          "competitive": 2,
          "mainstream": 2
        },
        "tags": {
          "power": 2
        }
      },
      {
        "text": "只要朋友还爱看，我无所谓。",
        "scores": {
          "fun": 2,
          "social": 1
        },
        "tags": {
          "talk": 1
        }
      }
    ]
  },
  {
    "id": "q33",
    "bucket": "wildcard",
    "prompt": "你开局连续被康/攻击两轮，你会？",
    "answers": [
      {
        "text": "开始公开威胁排序，争取停火。",
        "scores": {
          "social": 3,
          "competitive": 1
        },
        "tags": {
          "talk": 3,
          "politics": 2
        }
      },
      {
        "text": "攒一波反打。",
        "scores": {
          "solo": 3,
          "direct": 1
        },
        "tags": {
          "salt": 2,
          "aggro": 1
        }
      },
      {
        "text": "这局体验已经变味了。",
        "scores": {
          "fun": 1,
          "solo": 1
        },
        "tags": {
          "salt": 4
        }
      },
      {
        "text": "反正我是主角，继续演。",
        "scores": {
          "fun": 3,
          "solo": 1
        },
        "tags": {
          "talk": 2,
          "salt": -1
        }
      }
    ]
  },
  {
    "id": "q34",
    "bucket": "wildcard",
    "prompt": "你手里有一张会让全桌重洗资源的牌，什么时候打？",
    "answers": [
      {
        "text": "最有利于我赢的时候。",
        "scores": {
          "competitive": 3,
          "solo": 1
        },
        "tags": {
          "power": 2
        }
      },
      {
        "text": "局面僵住，需要节目效果的时候。",
        "scores": {
          "fun": 3,
          "solo": 1
        },
        "tags": {
          "talk": 1
        }
      },
      {
        "text": "能让别人红温但不翻脸的时候。",
        "scores": {
          "social": 2,
          "fun": 1
        },
        "tags": {
          "salt": 2,
          "politics": 2
        }
      },
      {
        "text": "我一般不带这种牌。",
        "scores": {
          "direct": 1,
          "solo": 2
        },
        "tags": {
          "salt": -1
        }
      }
    ]
  },
  {
    "id": "q37",
    "bucket": "wildcard",
    "prompt": "别人误解了你的场面强度以为你很弱，你会？",
    "answers": [
      {
        "text": "纠正他，我不想靠误解赢。",
        "scores": {
          "social": 2,
          "fun": 1
        },
        "tags": {
          "talk": 2
        }
      },
      {
        "text": "不说，信息也是资源。",
        "scores": {
          "competitive": 3,
          "solo": 2
        },
        "tags": {
          "power": 2
        }
      },
      {
        "text": "只解释到不会吵架为止。",
        "scores": {
          "social": 2,
          "competitive": 1
        },
        "tags": {
          "politics": 2
        }
      },
      {
        "text": "顺势演一下弱。",
        "scores": {
          "fun": 2,
          "solo": 1
        },
        "tags": {
          "politics": 3,
          "talk": 1
        }
      }
    ]
  },
  {
    "id": "q39",
    "bucket": "wildcard",
    "prompt": "你觉得最有成就感的一局是？",
    "answers": [
      {
        "text": "顶着三家互动还是赢了。",
        "scores": {
          "competitive": 3,
          "complex": 1
        },
        "tags": {
          "power": 2,
          "salt": 1
        }
      },
      {
        "text": "冷门主将打出全桌没见过的线。",
        "scores": {
          "offmeta": 3,
          "complex": 2
        },
        "tags": {
          "offbeat": 3,
          "judge": 1
        }
      },
      {
        "text": "大家笑到最后还想再来一局。",
        "scores": {
          "fun": 3,
          "social": 2
        },
        "tags": {
          "talk": 2
        }
      },
      {
        "text": "战斗阶段干净利落结束。",
        "scores": {
          "direct": 3
        },
        "tags": {
          "aggro": 3
        }
      }
    ]
  },
];

Object.keys(edhtiPersonas).forEach((code) => {
  edhtiPersonas[code].color = edhtiPersonaColors[code] || '#F8FBFF';
});

module.exports = {
  edhtiAxes,
  edhtiPersonaColors,
  edhtiPersonaOdds,
  edhtiPersonas,
  edhtiQuestions,
  edhtiTagLabels,
};
