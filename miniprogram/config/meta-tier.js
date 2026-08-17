// 由 scripts/build-meta-tier.js 从 tools/meta-tier/current.json 生成，请勿手改。
// 数据来源：cEDH小屋 人工编辑的 cEDH 套牌梯度表，经授权收录。
// 快照版本 2026.07.28-1（2026-07-28T00:23:00+08:00）——本页是快照，不联网刷新。
// 更新方式：覆盖 tools/meta-tier/current.json 后重跑 node scripts/build-meta-tier.js

const metaTierConfig = {
  "brand": "cEDH小屋",
  "title": "cEDH 小屋 Tier List",
  "description": "由 cEDH小屋编辑的中文 cEDH 套牌原型分级与分析。",
  "methodology": "榜单由 cEDH小屋人工编辑。\n赛事数据、环境表现与易上手程度用于辅助判断，表单顺序不直接决定“强度”。强度与个人水平高度相关。\n如有主将疏漏，可基本归类为 T3 、T4。",
  "publicationId": "2026.07.28-1",
  "publicationTitle": "2026年7月cedh梯度表",
  "publishedAt": "2026-07-28T00:23:00+08:00",
  "tiers": [
    {
      "id": "t0",
      "label": "T0",
      "color": "#ef5b4c",
      "description": "定义环境，强度与影响力最突出。"
    },
    {
      "id": "t1",
      "label": "T1",
      "color": "#f0aa4a",
      "description": "顶级竞争力，稳定且经过充分验证。"
    },
    {
      "id": "t2",
      "label": "T2",
      "color": "#64b9a5",
      "description": "成熟可战，具备明确优势但存在环境限制。"
    },
    {
      "id": "t3",
      "label": "T3",
      "color": "#70a7c7",
      "description": "小众可行，需要更强的环境判断或驾驶经验。"
    },
    {
      "id": "t4",
      "label": "T4",
      "color": "#8c8f94",
      "description": "边缘或实验性原型，仍保留 cEDH 构筑目标。"
    }
  ]
};

const metaTierEntries = [
  {
    "id": "blue-farm",
    "tier": "t0",
    "nameZh": "Blue Farm",
    "nameEn": "Blue Farm",
    "tags": [
      "中速 Midrange"
    ],
    "summary": "以高质量抓牌引擎和四色牌池建立资源优势的cEDH长青代表性中速组合技。",
    "winConditions": [
      "经典UUB",
      "裂隙线与高效咒语链"
    ],
    "strengths": [
      "牌张质量极高",
      "堤谟娜与寇姆持续补牌"
    ],
    "weaknesses": [
      "构筑与操作选择复杂",
      "容易成为全桌优先压制目标"
    ],
    "analysis": "四色提供最完整的互动、导师与加速配置。双指挥官都能把对局自然推进到资源占优的位置，是衡量其他中速套牌的重要基准。",
    "deckUrl": "https://topdeck.gg/deck/cedh-win-a-badlands-a-commander-invitational-qualifier/GFToELdqNdTrwgyc1iScl6OVtLa2",
    "commanders": [
      {
        "cn": "织命使堤谟娜",
        "en": "Tymna the Weaver",
        "scryfallId": "bc7cbe9b-324e-42b8-94e2-36e91cb32163",
        "small": "https://cards.scryfall.io/small/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081",
        "art": "https://cards.scryfall.io/art_crop/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081",
        "normal": "https://cards.scryfall.io/normal/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081"
      },
      {
        "cn": "卢德维佳作寇姆",
        "en": "Kraum, Ludevic's Opus",
        "scryfallId": "557fcd17-6cb3-414a-b2b1-ea9ae32e5aec",
        "small": "https://cards.scryfall.io/small/front/5/5/557fcd17-6cb3-414a-b2b1-ea9ae32e5aec.jpg?1783937084",
        "art": "https://cards.scryfall.io/art_crop/front/5/5/557fcd17-6cb3-414a-b2b1-ea9ae32e5aec.jpg?1783937084",
        "normal": "https://cards.scryfall.io/normal/front/5/5/557fcd17-6cb3-414a-b2b1-ea9ae32e5aec.jpg?1783937084"
      }
    ]
  },
  {
    "id": "kinnan",
    "tier": "t0",
    "nameZh": "持绊逸才季宁",
    "nameEn": "Kinnan, Bonder Prodigy",
    "tags": [
      "法术力爆发",
      "绿色哥们儿"
    ],
    "summary": "主将异能能带来大量法术力，同时配合玄武巨石一卡无限费。并以指挥官异能持续制造威胁的蓝绿引擎套牌。",
    "winConditions": [
      "无限法术力",
      "大量高费高质量生物"
    ],
    "strengths": [
      "指挥官费用低",
      "资源与致胜组件高度重合",
      "能快速越过常规节奏"
    ],
    "weaknesses": [
      "惧怕针对法术力源的压制",
      "惧怕扫场"
    ],
    "analysis": "季宁把普通加速转化成爆发资源，并在长局中提供稳定的法术力出口。它既能快速达成组合技，也能通过高质量永久物持续施压。",
    "deckUrl": "https://topdeck.gg/deck/tm-circuit-verse-2-song/YU5xxo3WblMGnLhtGcKyziTX2sL2",
    "commanders": [
      {
        "cn": "持绊逸才季宁",
        "en": "Kinnan, Bonder Prodigy",
        "scryfallId": "63cda4a0-0dff-4edb-ae67-a2b7e2971350",
        "small": "https://cards.scryfall.io/small/front/6/3/63cda4a0-0dff-4edb-ae67-a2b7e2971350.jpg?1783931023",
        "art": "https://cards.scryfall.io/art_crop/front/6/3/63cda4a0-0dff-4edb-ae67-a2b7e2971350.jpg?1783931023",
        "normal": "https://cards.scryfall.io/normal/front/6/3/63cda4a0-0dff-4edb-ae67-a2b7e2971350.jpg?1783931023"
      }
    ]
  },
  {
    "id": "ral-monsoon-mage",
    "tier": "t1",
    "nameZh": "风雨法师拉尔",
    "nameEn": "Ral, Monsoon Mage",
    "tags": [
      "Turbo",
      "风暴"
    ],
    "summary": "通过减费与咒语密度构建爆发回合的蓝红高速组合技。",
    "winConditions": [
      "风暴说书"
    ],
    "strengths": [
      "启动窗口多",
      "低曲线"
    ],
    "weaknesses": [
      "对资源计算要求高",
      "中场盘相对困难"
    ],
    "analysis": "拉尔把大量本就适合 cEDH 的低费瞬间与法术连接成完整引擎。最近由于不断的有单卡加强以及玩家策略的不断优化，正成为环境当中不可忽视的威胁。",
    "deckUrl": "https://topdeck.gg/deck/the-horizon/bRZf5LzkbWPvDPpxmQm5MtTqMM33",
    "commanders": [
      {
        "cn": "风雨法师拉尔",
        "en": "Ral, Monsoon Mage // Ral, Leyline Prodigy",
        "scryfallId": "438d8a26-ddc9-4829-8aff-22d6af6575cf",
        "small": "https://cards.scryfall.io/small/front/4/3/438d8a26-ddc9-4829-8aff-22d6af6575cf.jpg?1783911228",
        "art": "https://cards.scryfall.io/art_crop/front/4/3/438d8a26-ddc9-4829-8aff-22d6af6575cf.jpg?1783911228",
        "normal": "https://cards.scryfall.io/normal/front/4/3/438d8a26-ddc9-4829-8aff-22d6af6575cf.jpg?1783911228"
      }
    ]
  },
  {
    "id": "rograkh-thrasios",
    "tier": "t1",
    "nameZh": "罗噶克 + 萨拉希洛斯",
    "nameEn": "Rograkh & Thrasios",
    "tags": [
      "法术力爆发",
      "苗地",
      "绿色哥们儿"
    ],
    "summary": "结合零费指挥官资源与萨拉希洛斯出口的铁木尔苗地组合技套牌。",
    "winConditions": [
      "无限法术力配合萨拉希洛斯",
      "玩苗地永久物循环"
    ],
    "strengths": [
      "指挥区组件成本低",
      "可兼顾速度与续航"
    ],
    "weaknesses": [
      "惧怕扫场",
      "制胜链条长，依赖熟练度"
    ],
    "analysis": "罗噶克提供爆发起点，配合苗地可以快速的获得大量的法术力，在游戏的中期达成一种伪“风暴”的生物循环，具有难以用语言表达的游戏体验。",
    "deckUrl": "https://topdeck.gg/deck/pittsburgh-2026-tcedh-10k-25000/BP2zsiHEccO3Pe128MLPcCbygql1",
    "commanders": [
      {
        "cn": "罗噶之子罗噶克",
        "en": "Rograkh, Son of Rohgahh",
        "scryfallId": "a4fab67f-00c2-4125-9262-d21a29411797",
        "small": "https://cards.scryfall.io/small/front/a/4/a4fab67f-00c2-4125-9262-d21a29411797.jpg?1783928807",
        "art": "https://cards.scryfall.io/art_crop/front/a/4/a4fab67f-00c2-4125-9262-d21a29411797.jpg?1783928807",
        "normal": "https://cards.scryfall.io/normal/front/a/4/a4fab67f-00c2-4125-9262-d21a29411797.jpg?1783928807"
      },
      {
        "cn": "屈东英雄萨拉希洛斯",
        "en": "Thrasios, Triton Hero",
        "scryfallId": "21e27b91-c7f1-4709-aa0d-8b5d81b22a0a",
        "small": "https://cards.scryfall.io/small/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081",
        "art": "https://cards.scryfall.io/art_crop/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081",
        "normal": "https://cards.scryfall.io/normal/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081"
      }
    ]
  },
  {
    "id": "sisay",
    "tier": "t1",
    "nameZh": "晴空号船长西赛",
    "nameEn": "Sisay, Weatherlight Captain",
    "tags": [
      "工具箱 Toolbox",
      "五色传奇"
    ],
    "summary": "用指挥官把五色传奇工具箱转化为确定性组合路线。",
    "winConditions": [
      "连续检索传奇永久物形成组合技，不同组法有不同的制胜线路"
    ],
    "strengths": [
      "指挥区内置导师",
      "路线灵活"
    ],
    "weaknesses": [
      "依赖指挥官留场与启动",
      "复杂路线对操作精度要求高"
    ],
    "analysis": "西赛的核心优势是把大量单卡工具组织成可重复访问的路线。对手必须尊重每一次激活窗口，套牌也因此拥有很强的威慑力。",
    "deckUrl": "https://topdeck.gg/deck/last-chance-redemption/yjYxM96teWXrjakkVOdc3LqfiyA2",
    "commanders": [
      {
        "cn": "晴空号船长西赛",
        "en": "Sisay, Weatherlight Captain",
        "scryfallId": "5a293c45-1e73-4527-be2f-2dcd5c47b610",
        "small": "https://cards.scryfall.io/small/front/5/a/5a293c45-1e73-4527-be2f-2dcd5c47b610.jpg?1783933156",
        "art": "https://cards.scryfall.io/art_crop/front/5/a/5a293c45-1e73-4527-be2f-2dcd5c47b610.jpg?1783933156",
        "normal": "https://cards.scryfall.io/normal/front/5/a/5a293c45-1e73-4527-be2f-2dcd5c47b610.jpg?1783933156"
      }
    ]
  },
  {
    "id": "rograkh-silas",
    "tier": "t1",
    "nameZh": "罗噶克 + 赛拉司",
    "nameEn": "Rograkh & Silas Renn",
    "tags": [
      "Turbo"
    ],
    "summary": "利用零费指挥官与格利极牌池追求极低回合数的高速组合技。",
    "winConditions": [
      "冥界裂隙",
      "uub"
    ],
    "strengths": [
      "爆发速度极高",
      "罗噶克支撑多种免费资源",
      "牌池紧凑高效"
    ],
    "weaknesses": [
      "持续资源能力有限"
    ],
    "analysis": "这是最纯粹的 Turbo 基准之一。它牺牲部分长局能力换取速度和法术力效率，适合主动寻找窗口的操作方式。",
    "deckUrl": "https://topdeck.gg/deck/torneo-cedh-junio-rigor-mortis-galdakao/dqMmjoXLlqUFlt0E4U6zAUBbP4G3",
    "commanders": [
      {
        "cn": "罗噶之子罗噶克",
        "en": "Rograkh, Son of Rohgahh",
        "scryfallId": "a4fab67f-00c2-4125-9262-d21a29411797",
        "small": "https://cards.scryfall.io/small/front/a/4/a4fab67f-00c2-4125-9262-d21a29411797.jpg?1783928807",
        "art": "https://cards.scryfall.io/art_crop/front/a/4/a4fab67f-00c2-4125-9262-d21a29411797.jpg?1783928807",
        "normal": "https://cards.scryfall.io/normal/front/a/4/a4fab67f-00c2-4125-9262-d21a29411797.jpg?1783928807"
      },
      {
        "cn": "致知专家赛拉司雷恩",
        "en": "Silas Renn, Seeker Adept",
        "scryfallId": "4e3fe912-1374-47c7-b73f-89ef55c479c1",
        "small": "https://cards.scryfall.io/small/front/4/e/4e3fe912-1374-47c7-b73f-89ef55c479c1.jpg?1783937082",
        "art": "https://cards.scryfall.io/art_crop/front/4/e/4e3fe912-1374-47c7-b73f-89ef55c479c1.jpg?1783937082",
        "normal": "https://cards.scryfall.io/normal/front/4/e/4e3fe912-1374-47c7-b73f-89ef55c479c1.jpg?1783937082"
      }
    ]
  },
  {
    "id": "tymna-thrasios",
    "tier": "t1",
    "nameZh": "TnT",
    "nameEn": "Tymna & Thrasios",
    "tags": [
      "中速 Midrange"
    ],
    "summary": "以双重指挥区资源引擎支撑互动密集型四色中速策略。",
    "winConditions": [
      "无限法术力",
      "UUB"
    ],
    "strengths": [
      "长局资源能力强",
      "构筑弹性高",
      "互动密度充足"
    ],
    "weaknesses": [
      "速度通常低于纯 Turbo",
      "胜利路线可能被坟场或沉默效应拆分"
    ],
    "analysis": "TnT 的价值在于稳定与可塑性。它可以根据预期环境调整永久物、互动和组合比例，是典型的玩家导向型套牌。",
    "deckUrl": "https://topdeck.gg/deck/from-the-vault-cedh-32-1k/PGlcyu3I8ZQAOJ7Iw3Ez69CYiER2",
    "commanders": [
      {
        "cn": "织命使堤谟娜",
        "en": "Tymna the Weaver",
        "scryfallId": "bc7cbe9b-324e-42b8-94e2-36e91cb32163",
        "small": "https://cards.scryfall.io/small/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081",
        "art": "https://cards.scryfall.io/art_crop/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081",
        "normal": "https://cards.scryfall.io/normal/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081"
      },
      {
        "cn": "屈东英雄萨拉希洛斯",
        "en": "Thrasios, Triton Hero",
        "scryfallId": "21e27b91-c7f1-4709-aa0d-8b5d81b22a0a",
        "small": "https://cards.scryfall.io/small/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081",
        "art": "https://cards.scryfall.io/art_crop/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081",
        "normal": "https://cards.scryfall.io/normal/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081"
      }
    ]
  },
  {
    "id": "etali-primal-conqueror",
    "tier": "t1",
    "nameZh": "始霸埃泰力",
    "nameEn": "Etali, Primal Conqueror",
    "tags": [
      "Turbo",
      "食物链"
    ],
    "summary": "以埃泰力的进场异能作为资源与终结手段的红绿组合技。",
    "winConditions": [
      "食物链组合技+反复施放埃泰力"
    ],
    "strengths": [
      "指挥区提供高影响力进场异能",
      "红绿爆发法术力充足"
    ],
    "weaknesses": [
      "持续资源能力有限"
    ],
    "analysis": "非常简单直接的主将，拥有强大的爆发力，但是也特别怕琉晶研究。",
    "deckUrl": "https://topdeck.gg/deck/baked-ziti-3/B1yctEd4MvYogwWDAwqY53tLT4K2",
    "commanders": [
      {
        "cn": "始霸埃泰力",
        "en": "Etali, Primal Conqueror // Etali, Primal Sickness",
        "scryfallId": "95c14c4d-6c16-4826-8d93-d89ad04aee09",
        "small": "https://cards.scryfall.io/small/front/9/5/95c14c4d-6c16-4826-8d93-d89ad04aee09.jpg?1783916997",
        "art": "https://cards.scryfall.io/art_crop/front/9/5/95c14c4d-6c16-4826-8d93-d89ad04aee09.jpg?1783916997",
        "normal": "https://cards.scryfall.io/normal/front/9/5/95c14c4d-6c16-4826-8d93-d89ad04aee09.jpg?1783916997"
      }
    ]
  },
  {
    "id": "kefka",
    "tier": "t1",
    "nameZh": "宫廷魔法师凯夫卡",
    "nameEn": "Kefka, Court Mage",
    "tags": [
      "中速 Midrange",
      "资源压制"
    ],
    "summary": "以格利极互动和指挥官资源交换能力建立优势的新型中速原型。",
    "winConditions": [
      "UUB",
      "裂隙"
    ],
    "strengths": [
      "颜色组合优质",
      "指挥官兼顾推进与干扰",
      "适应中速桌"
    ],
    "weaknesses": [
      "主将还是费用太高"
    ],
    "analysis": "喜欢格色主将绝对会喜欢的单卡，上场之后拥有强大的压迫力，但可惜弱点还是主将太笨重。",
    "deckUrl": "https://topdeck.gg/deck/cedh-monthly-dual-land-tournament/A8N9blZZuvOMluITWdLrt3UwlaC2",
    "commanders": [
      {
        "cn": "宫廷魔法师凯夫卡",
        "en": "Kefka, Court Mage // Kefka, Ruler of Ruin",
        "scryfallId": "8fcf3fbb-1ddd-437e-81c1-f5a3133f5ee8",
        "small": "https://cards.scryfall.io/small/front/8/f/8fcf3fbb-1ddd-437e-81c1-f5a3133f5ee8.jpg?1783906572",
        "art": "https://cards.scryfall.io/art_crop/front/8/f/8fcf3fbb-1ddd-437e-81c1-f5a3133f5ee8.jpg?1783906572",
        "normal": "https://cards.scryfall.io/normal/front/8/f/8fcf3fbb-1ddd-437e-81c1-f5a3133f5ee8.jpg?1783906572"
      }
    ]
  },
  {
    "id": "ishai-rograkh",
    "tier": "t1",
    "nameZh": "依谢 + 罗噶克",
    "nameEn": "Ishai & Rograkh",
    "tags": [
      "Turbo",
      "战斗压力",
      "琉晶研究"
    ],
    "summary": "用零费伙伴支撑爆发资源，并由依谢提供持续战斗压力的洁斯凯原型。",
    "winConditions": [
      "冥界裂隙线"
    ],
    "strengths": [
      "稳定的研究导师"
    ],
    "weaknesses": [
      "非常的吃环境理解"
    ],
    "analysis": "新晋的搭档主将，游戏计划主要就是围绕着琉晶研究、神秘印鱼展开。",
    "deckUrl": "https://topdeck.gg/deck/summer-classic-3/xzbsPerPxyRegrjBo0kEjfk04lT2",
    "commanders": [
      {
        "cn": "欧祝泰族龙语者依谢",
        "en": "Ishai, Ojutai Dragonspeaker",
        "scryfallId": "2e89ce6a-6bc9-427f-a8b2-c07a9fc3218f",
        "small": "https://cards.scryfall.io/small/front/2/e/2e89ce6a-6bc9-427f-a8b2-c07a9fc3218f.jpg?1783934777",
        "art": "https://cards.scryfall.io/art_crop/front/2/e/2e89ce6a-6bc9-427f-a8b2-c07a9fc3218f.jpg?1783934777",
        "normal": "https://cards.scryfall.io/normal/front/2/e/2e89ce6a-6bc9-427f-a8b2-c07a9fc3218f.jpg?1783934777"
      },
      {
        "cn": "罗噶之子罗噶克",
        "en": "Rograkh, Son of Rohgahh",
        "scryfallId": "a4fab67f-00c2-4125-9262-d21a29411797",
        "small": "https://cards.scryfall.io/small/front/a/4/a4fab67f-00c2-4125-9262-d21a29411797.jpg?1783928807",
        "art": "https://cards.scryfall.io/art_crop/front/a/4/a4fab67f-00c2-4125-9262-d21a29411797.jpg?1783928807",
        "normal": "https://cards.scryfall.io/normal/front/a/4/a4fab67f-00c2-4125-9262-d21a29411797.jpg?1783928807"
      }
    ]
  },
  {
    "id": "magda",
    "tier": "t1",
    "nameZh": "莽勇狂徒玛格妲",
    "nameEn": "Magda, Brazen Outlaw",
    "tags": [
      "工具箱 Toolbox",
      "神器"
    ],
    "summary": "以珍宝作为法术力和导师资源的红色神器工具箱。",
    "winConditions": [
      "magda专属的预兆时钟组合技"
    ],
    "strengths": [
      "指挥官费用低",
      "导师异能难以用常规反击处理",
      "制胜路线启动难以阻止。"
    ],
    "weaknesses": [
      "依赖指挥官",
      "单红互动范围有限"
    ],
    "analysis": "玛格妲最近构筑倾向于突然爆发解决战斗，相比原来更具侵略性，舍弃了很多防守端的锁，桌上必须持续计算其珍宝数量。",
    "deckUrl": "https://topdeck.gg/deck/bonfire-3-red-white-bluefarm/qujVfPt8DvYuYAUFqthXwNCcgqu1",
    "commanders": [
      {
        "cn": "莽勇狂徒玛格妲",
        "en": "Magda, Brazen Outlaw",
        "scryfallId": "079e6263-e54c-4899-a336-5315909b9322",
        "small": "https://cards.scryfall.io/small/front/0/7/079e6263-e54c-4899-a336-5315909b9322.jpg?1783928229",
        "art": "https://cards.scryfall.io/art_crop/front/0/7/079e6263-e54c-4899-a336-5315909b9322.jpg?1783928229",
        "normal": "https://cards.scryfall.io/normal/front/0/7/079e6263-e54c-4899-a336-5315909b9322.jpg?1783928229"
      }
    ]
  },
  {
    "id": "krrik",
    "tier": "t1",
    "nameZh": "约格莫夫之子格锐克",
    "nameEn": "K'rrik, Son of Yawgmoth",
    "tags": [
      "Turbo",
      "单色",
      "生物组合技"
    ],
    "summary": "把生命值转化为黑色法术力，以极高速度串联导师和组合组件。",
    "winConditions": [
      "单黑生物组合",
      "导师链与吸血终结"
    ],
    "strengths": [
      "法术力规则独特",
      "爆发回合强",
      "单色法术力稳定"
    ],
    "weaknesses": [
      "生命压力与指挥官依赖明显"
    ],
    "analysis": "强大快速的纯黑组合技主将，组合技线路复杂且多变，但非常需要玩家自己的熟练度来支撑。",
    "deckUrl": "https://topdeck.gg/deck/landfall-3er-clasificatorio-al-nacional-de-cedh/wmEZh09DzrT2LTtSVI3k0VAUJgk1",
    "commanders": [
      {
        "cn": "约格莫夫之子格锐克",
        "en": "K'rrik, Son of Yawgmoth",
        "scryfallId": "4f087b1c-97e0-4379-a94d-beac53685314",
        "small": "https://cards.scryfall.io/small/front/4/f/4f087b1c-97e0-4379-a94d-beac53685314.jpg?1783911216",
        "art": "https://cards.scryfall.io/art_crop/front/4/f/4f087b1c-97e0-4379-a94d-beac53685314.jpg?1783911216",
        "normal": "https://cards.scryfall.io/normal/front/4/f/4f087b1c-97e0-4379-a94d-beac53685314.jpg?1783911216"
      }
    ]
  },
  {
    "id": "tivit",
    "tier": "t2",
    "nameZh": "密报商棣维特",
    "nameEn": "Tivit, Seller of Secrets",
    "tags": [
      "控制 Control",
      "中速 Midrange",
      "神器"
    ],
    "summary": "用高韧性指挥官制造资源，并以神器额外回合组合结束对局。",
    "winConditions": [
      "时间筛与棣维特形成额外回合循环",
      "UUB"
    ],
    "strengths": [
      "指挥官落地价值高",
      "抗普通去除",
      "控制计划清晰"
    ],
    "weaknesses": [
      "指挥官费用高",
      "早期节奏受快速桌影响"
    ],
    "analysis": "棣维特适合把对局拖入资源交换阶段。指挥官一旦成功结算，会带来很大优势。而前期则需要稳定的控场，希望顺利的将游戏拖入中后期，而一旦进入中后期，单靠主将就能获得很大的优势。",
    "deckUrl": "https://topdeck.gg/deck/rule-them-all-cedh-european-qualifier/HNKlW4eE3PVOLZkbsLlNML7RQei2",
    "commanders": [
      {
        "cn": "密报商棣维特",
        "en": "Tivit, Seller of Secrets",
        "scryfallId": "9235977e-a999-4ed0-83a3-742be87b13bb",
        "small": "https://cards.scryfall.io/small/front/9/2/9235977e-a999-4ed0-83a3-742be87b13bb.jpg?1783923378",
        "art": "https://cards.scryfall.io/art_crop/front/9/2/9235977e-a999-4ed0-83a3-742be87b13bb.jpg?1783923378",
        "normal": "https://cards.scryfall.io/normal/front/9/2/9235977e-a999-4ed0-83a3-742be87b13bb.jpg?1783923378"
      }
    ]
  },
  {
    "id": "tymna-dargo",
    "tier": "t2",
    "nameZh": "堤谟娜 + 达戈",
    "nameEn": "Tymna & Dargo",
    "tags": [
      "Turbo",
      "牺牲"
    ],
    "summary": "让达戈充当法术力与牺牲组件，并由堤谟娜补充资源的马尔都爆发主将。",
    "winConditions": [
      "达戈牺牲循环",
      "玛铎导师链"
    ],
    "strengths": [
      "指挥区提供组合组件",
      "爆发法术力强",
      "堤谟娜改善续航"
    ],
    "weaknesses": [
      "缺少蓝色堆叠互动"
    ],
    "analysis": "爆发上限高，而且主将作为牺牲源拥有强大的turbo实力，裂隙在这套牌当中非常厉害。",
    "deckUrl": "https://topdeck.gg/deck/socc-on-the-stack/SiDkLCGFJvd9g8I2hwnMQnwUH9m2",
    "commanders": [
      {
        "cn": "织命使堤谟娜",
        "en": "Tymna the Weaver",
        "scryfallId": "bc7cbe9b-324e-42b8-94e2-36e91cb32163",
        "small": "https://cards.scryfall.io/small/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081",
        "art": "https://cards.scryfall.io/art_crop/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081",
        "normal": "https://cards.scryfall.io/normal/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081"
      },
      {
        "cn": "碎船巨人达戈",
        "en": "Dargo, the Shipwrecker",
        "scryfallId": "5cd87cf8-4d5d-4aba-8dfa-800b1fb3799b",
        "small": "https://cards.scryfall.io/small/front/5/c/5cd87cf8-4d5d-4aba-8dfa-800b1fb3799b.jpg?1783928817",
        "art": "https://cards.scryfall.io/art_crop/front/5/c/5cd87cf8-4d5d-4aba-8dfa-800b1fb3799b.jpg?1783928817",
        "normal": "https://cards.scryfall.io/normal/front/5/c/5cd87cf8-4d5d-4aba-8dfa-800b1fb3799b.jpg?1783928817"
      }
    ]
  },
  {
    "id": "vivi-ornitier",
    "tier": "t2",
    "nameZh": "比比·奥尼提尔",
    "nameEn": "Vivi Ornitier",
    "tags": [
      "Turbo",
      "风暴"
    ],
    "summary": "围绕低费咒语和指挥官增值构建的高速蓝红组合技。",
    "winConditions": [
      "风暴组合技"
    ],
    "strengths": [
      "启动速度快"
    ],
    "weaknesses": [
      "对指挥官依赖较高"
    ],
    "analysis": "比比和好奇互动可以带来非常强大的效果，游戏计划一般围绕好奇+大量的低费非生物咒语展开，达成一种风暴循环，在过程中还能使用主将进行费用补充。",
    "deckUrl": "https://topdeck.gg/deck/the-bonefire-2-magic-may-hem/f9fY4V4MyMMe2vkN6KYxjpPRrvd2",
    "commanders": [
      {
        "cn": "比比·奥尼提尔",
        "en": "Vivi Ornitier",
        "scryfallId": "ecc1027a-8c07-44a0-bdde-fa2844cff694",
        "small": "https://cards.scryfall.io/small/front/e/c/ecc1027a-8c07-44a0-bdde-fa2844cff694.jpg?1783906561",
        "art": "https://cards.scryfall.io/art_crop/front/e/c/ecc1027a-8c07-44a0-bdde-fa2844cff694.jpg?1783906561",
        "normal": "https://cards.scryfall.io/normal/front/e/c/ecc1027a-8c07-44a0-bdde-fa2844cff694.jpg?1783906561"
      }
    ]
  },
  {
    "id": "yoshimaru-thrasios",
    "tier": "t2",
    "nameZh": "义丸 + 萨拉希洛斯",
    "nameEn": "Yoshimaru & Thrasios",
    "tags": [
      "中速 Midrange",
      "法术力爆发",
      "苗地",
      "绿色哥们儿"
    ],
    "summary": "和鬼仔人鱼一样，但是有白色，多了止咒、封口等单卡。",
    "winConditions": [
      "无限法术力配合萨拉希洛斯",
      "指挥官伤害与中速压制"
    ],
    "strengths": [
      "萨拉希洛斯提供续航",
      "颜色拥有优质互动"
    ],
    "weaknesses": [
      "速度偏慢"
    ],
    "analysis": "和鬼仔人鱼类似，依赖苗地。鬼仔人鱼优势有更加快速顺滑的前期展开，但是鬼仔狗有止咒、封口等更加优质的保护咒语。",
    "deckUrl": "https://topdeck.gg/deck/atlantic-city-tcg-show-cedh-15k/dQ1EcYlXSRPdX0w48llDyKaLeKy2",
    "commanders": [
      {
        "cn": "忠犬义丸",
        "en": "Yoshimaru, Ever Faithful",
        "scryfallId": "aa409269-3698-42a2-8c51-75557b27a6f6",
        "small": "https://cards.scryfall.io/small/front/a/a/aa409269-3698-42a2-8c51-75557b27a6f6.jpg?1783923987",
        "art": "https://cards.scryfall.io/art_crop/front/a/a/aa409269-3698-42a2-8c51-75557b27a6f6.jpg?1783923987",
        "normal": "https://cards.scryfall.io/normal/front/a/a/aa409269-3698-42a2-8c51-75557b27a6f6.jpg?1783923987"
      },
      {
        "cn": "屈东英雄萨拉希洛斯",
        "en": "Thrasios, Triton Hero",
        "scryfallId": "21e27b91-c7f1-4709-aa0d-8b5d81b22a0a",
        "small": "https://cards.scryfall.io/small/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081",
        "art": "https://cards.scryfall.io/art_crop/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081",
        "normal": "https://cards.scryfall.io/normal/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081"
      }
    ]
  },
  {
    "id": "cabbage-merchant",
    "tier": "t2",
    "nameZh": "卷心菜商",
    "nameEn": "The Cabbage Merchant",
    "tags": [
      "神器",
      "食物",
      "绿色哥们儿"
    ],
    "summary": "将对手的非生物咒语转化为食物，并利用食物提供法术力。",
    "winConditions": [
      "食品组合技",
      "高法术力出口或场面终结"
    ],
    "strengths": [
      "能被对手正常施法被动推进",
      "食物同时提供法术力与组合材料"
    ],
    "weaknesses": [
      "对生物密集桌面的触发较少",
      "单绿色保护与检索范围有限"
    ],
    "analysis": "AI 初步建议，已根据近期 EDHTop16 常见度纳入待审核区。具体构筑路线与 Tier 位置由 cEDH小屋人工核验后确定。",
    "deckUrl": "https://topdeck.gg/deck/its-gonna-be-may-part-2-electric-boogaloocedh-tourney/aq61gCRnzKb2YNjsxE82u5LVJKW2",
    "commanders": [
      {
        "cn": "卷心菜商",
        "en": "The Cabbage Merchant",
        "scryfallId": "2fea0356-6684-4730-9eb4-0262856bc1f9",
        "small": "https://cards.scryfall.io/small/front/2/f/2fea0356-6684-4730-9eb4-0262856bc1f9.jpg?1783904816",
        "art": "https://cards.scryfall.io/art_crop/front/2/f/2fea0356-6684-4730-9eb4-0262856bc1f9.jpg?1783904816",
        "normal": "https://cards.scryfall.io/normal/front/2/f/2fea0356-6684-4730-9eb4-0262856bc1f9.jpg?1783904816"
      }
    ]
  },
  {
    "id": "aang-at-the-crossroads",
    "tier": "t2",
    "nameZh": "身处十字路口的安昂",
    "nameEn": "Aang, at the Crossroads",
    "tags": [
      "围绕主将构筑"
    ],
    "summary": "围绕安昂变身与多色协同构建的组合技。",
    "winConditions": [
      "围绕指挥官异能构筑的一整套链条"
    ],
    "strengths": [
      "生物与异能为主，不容易被互动"
    ],
    "weaknesses": [
      "游戏计划稍显局限"
    ],
    "analysis": "完全围绕主将异能构筑的100张牌，游戏计划线性单一，一旦大家都熟悉这套牌就变得特别难赢。",
    "deckUrl": "https://topdeck.gg/deck/commander-invitational-qualifier-riddle-rune-1/yDmurQQALDMAZ5XelLf8KibSaaB3",
    "commanders": [
      {
        "cn": "身处十字路口的安昂",
        "en": "Aang, at the Crossroads // Aang, Destined Savior",
        "scryfallId": "fea89ca0-8070-4f28-9851-994314f9d248",
        "small": "https://cards.scryfall.io/small/front/f/e/fea89ca0-8070-4f28-9851-994314f9d248.jpg?1783904940",
        "art": "https://cards.scryfall.io/art_crop/front/f/e/fea89ca0-8070-4f28-9851-994314f9d248.jpg?1783904940",
        "normal": "https://cards.scryfall.io/normal/front/f/e/fea89ca0-8070-4f28-9851-994314f9d248.jpg?1783904940"
      }
    ]
  },
  {
    "id": "inalla-archmage-ritualist",
    "tier": "t2",
    "nameZh": "仪法大师因娜拉",
    "nameEn": "Inalla, Archmage Ritualist",
    "tags": [
      "Turbo",
      "法术师",
      "格利极"
    ],
    "summary": "利用显赫异能复制法术师并串联确定性组合的格利极 Turbo。",
    "winConditions": [
      "围绕主将异能的法术师组合技"
    ],
    "strengths": [
      "核心异能无需施放指挥官",
      "致胜路线紧凑且导师密度高"
    ],
    "weaknesses": [
      "组合路线操作复杂",
      "组合技会吃任意的阻抗"
    ],
    "analysis": "快速直接的组合技，但是整个链条背下来简单，灵活使用十分困难，面对不同场景需要大量练习，最近多了kfk的中速路线，稍微好了一些。",
    "deckUrl": "https://topdeck.gg/deck/mtm-series-iii-european-qualifier/wYNiB0N21fSXpdcCkVpLOR4lAUE2",
    "commanders": [
      {
        "cn": "仪法大师因娜拉",
        "en": "Inalla, Archmage Ritualist",
        "scryfallId": "7c6e803a-451c-4aa6-97a2-400077f32c47",
        "small": "https://cards.scryfall.io/small/front/7/c/7c6e803a-451c-4aa6-97a2-400077f32c47.jpg?1783935937",
        "art": "https://cards.scryfall.io/art_crop/front/7/c/7c6e803a-451c-4aa6-97a2-400077f32c47.jpg?1783935937",
        "normal": "https://cards.scryfall.io/normal/front/7/c/7c6e803a-451c-4aa6-97a2-400077f32c47.jpg?1783935937"
      }
    ]
  },
  {
    "id": "stella-lee-wild-card",
    "tier": "t2",
    "nameZh": "狂野王牌史黛拉李",
    "nameEn": "Stella Lee, Wild Card",
    "tags": [
      "Turbo"
    ],
    "summary": "通过连续施放咒语开启复制能力，通过无限复制重置的咒语来循环制胜。",
    "winConditions": [
      "可反复重置史黛拉的咒语复制循环",
      "冥界裂隙咒语链"
    ],
    "strengths": [
      "指挥官兼具选牌和组合能力",
      "低曲线与蓝色保护自然契合"
    ],
    "weaknesses": [
      "依赖指挥官横置启动",
      "第三个咒语的条件公开且可被针对"
    ],
    "analysis": "AI 初步建议，已根据近期 EDHTop16 常见度纳入待审核区。具体构筑路线与 Tier 位置由 cEDH小屋人工核验后确定。",
    "deckUrl": "https://topdeck.gg/deck/mulligan-championship-series-february-5k/aLSCW1qFOEPuimuhzaqgbu6AdDw1",
    "commanders": [
      {
        "cn": "狂野王牌史黛拉李",
        "en": "Stella Lee, Wild Card",
        "scryfallId": "2a8a7696-b5d9-4378-9d5c-2c9007e4df63",
        "small": "https://cards.scryfall.io/small/front/2/a/2a8a7696-b5d9-4378-9d5c-2c9007e4df63.jpg?1783911971",
        "art": "https://cards.scryfall.io/art_crop/front/2/a/2a8a7696-b5d9-4378-9d5c-2c9007e4df63.jpg?1783911971",
        "normal": "https://cards.scryfall.io/normal/front/2/a/2a8a7696-b5d9-4378-9d5c-2c9007e4df63.jpg?1783911971"
      }
    ]
  },
  {
    "id": "terra-magical-adept",
    "tier": "t2",
    "nameZh": "魔导战士蒂娜",
    "nameEn": "Terra, Magical Adept",
    "tags": [
      "五色"
    ],
    "summary": "围绕蒂娜进场异能，配合冥界裂隙的五色套牌。",
    "winConditions": [
      "主要是走冥界裂隙路线"
    ],
    "strengths": [
      "主将进场异能填坟带来的更容易达成的冥界裂隙组合技"
    ],
    "weaknesses": [
      "操作复杂"
    ],
    "analysis": "围绕蒂娜进场异能，配合冥界裂隙的五色套牌。",
    "deckUrl": "https://topdeck.gg/deck/curio-caverns-tavern-brawl-3-cedh-15k/LG1FIIInnobc28qEox3TAAEG9LI3",
    "commanders": [
      {
        "cn": "魔导战士蒂娜",
        "en": "Terra, Magical Adept // Esper Terra",
        "scryfallId": "fbd447aa-588d-4c4d-925e-a7d3bdf6a65c",
        "small": "https://cards.scryfall.io/small/front/f/b/fbd447aa-588d-4c4d-925e-a7d3bdf6a65c.jpg?1783906567",
        "art": "https://cards.scryfall.io/art_crop/front/f/b/fbd447aa-588d-4c4d-925e-a7d3bdf6a65c.jpg?1783906567",
        "normal": "https://cards.scryfall.io/normal/front/f/b/fbd447aa-588d-4c4d-925e-a7d3bdf6a65c.jpg?1783906567"
      }
    ]
  },
  {
    "id": "kenrith",
    "tier": "t2",
    "nameZh": "复归国王肯理斯",
    "nameEn": "Kenrith, the Returned King",
    "tags": [
      "五色",
      "中速 Midrange"
    ],
    "summary": "以五色牌池和多功能指挥官支撑高度可定制的中速组合。",
    "winConditions": [
      "无限法术力配合指挥官",
      "五色通用组合"
    ],
    "strengths": [
      "构筑自由度高",
      "指挥官是完整法术力出口"
    ],
    "weaknesses": [
      "指挥官费用高"
    ],
    "analysis": "肯理斯能把任何无限资源转化为胜利，也能在公平回合中提供多种小优势。代价是套牌容易缺少足够鲜明的第一计划。",
    "deckUrl": "https://topdeck.gg/deck/jeweled-lotus-lattenkamp-2026/JcZxZy4vAuaaqVij3tgdSaqO2mE3",
    "commanders": [
      {
        "cn": "复归国王肯理斯",
        "en": "Kenrith, the Returned King",
        "scryfallId": "0e259db1-14db-4314-998c-6a076a28d8cb",
        "small": "https://cards.scryfall.io/small/front/0/e/0e259db1-14db-4314-998c-6a076a28d8cb.jpg?1783916113",
        "art": "https://cards.scryfall.io/art_crop/front/0/e/0e259db1-14db-4314-998c-6a076a28d8cb.jpg?1783916113",
        "normal": "https://cards.scryfall.io/normal/front/0/e/0e259db1-14db-4314-998c-6a076a28d8cb.jpg?1783916113"
      }
    ]
  },
  {
    "id": "korvold",
    "tier": "t2",
    "nameZh": "受诅国王寇沃",
    "nameEn": "Korvold, Fae-Cursed King",
    "tags": [
      "中速 Midrange",
      "牺牲",
      "勇得"
    ],
    "summary": "将牺牲动作转化为抓牌的勇得引擎与组合套牌。",
    "winConditions": [
      "食物链循环"
    ],
    "strengths": [
      "指挥官抓牌上限高",
      "与珍宝和牺牲组件自然协同"
    ],
    "weaknesses": [
      "指挥官费用高",
      "首次施放被阻止后很难再起"
    ],
    "analysis": "寇沃一旦结算，所有珍宝和牺牲动作都可以抓牌，特别具有压制力。",
    "deckUrl": "https://topdeck.gg/deck/seaedh-16/xxah4cWc8oUmLHYyFpJQyiCFdmq1",
    "commanders": [
      {
        "cn": "受诅国王寇沃",
        "en": "Korvold, Fae-Cursed King",
        "scryfallId": "607c1793-8e5a-4ebf-87c6-7f9c99bbd29a",
        "small": "https://cards.scryfall.io/small/front/6/0/607c1793-8e5a-4ebf-87c6-7f9c99bbd29a.jpg?1783906027",
        "art": "https://cards.scryfall.io/art_crop/front/6/0/607c1793-8e5a-4ebf-87c6-7f9c99bbd29a.jpg?1783906027",
        "normal": "https://cards.scryfall.io/normal/front/6/0/607c1793-8e5a-4ebf-87c6-7f9c99bbd29a.jpg?1783906027"
      }
    ]
  },
  {
    "id": "gwenom-remorseless",
    "tier": "t2",
    "nameZh": "无悔的毒液格温",
    "nameEn": "Gwenom, Remorseless",
    "tags": [
      "新原型",
      "生物组合",
      "待验证"
    ],
    "summary": "围绕毒液格温异能的资源能力构建的新套牌。",
    "winConditions": [
      "指挥官协同的永久物组合",
      "资源引擎建立优势后终结"
    ],
    "strengths": [
      "指挥官提供独特构筑轴线",
      "近期环境中具备一定存在感"
    ],
    "weaknesses": [
      "线路单一",
      "被熟悉了之后就很难赢了"
    ],
    "analysis": "简单直接的套牌，主将异能触发之后，会惩罚所有不熟悉这套牌的玩家，但是于此同时，如果这套牌被所有人都熟悉，就很难制胜了。",
    "deckUrl": "https://topdeck.gg/deck/curio-caverns-tavern-brawl-4-cedh-16k/TW1P4nx2FecEfyFPEr0Y8WND9ME2",
    "commanders": [
      {
        "cn": "无悔的毒液格温",
        "en": "Gwenom, Remorseless",
        "scryfallId": "46b6cc5d-7a37-4e8b-a1a5-9a573056610c",
        "small": "https://cards.scryfall.io/small/front/4/6/46b6cc5d-7a37-4e8b-a1a5-9a573056610c.jpg?1783905344",
        "art": "https://cards.scryfall.io/art_crop/front/4/6/46b6cc5d-7a37-4e8b-a1a5-9a573056610c.jpg?1783905344",
        "normal": "https://cards.scryfall.io/normal/front/4/6/46b6cc5d-7a37-4e8b-a1a5-9a573056610c.jpg?1783905344"
      }
    ]
  },
  {
    "id": "derevi",
    "tier": "t2",
    "nameZh": "穹光策士德蕾薇",
    "nameEn": "Derevi, Empyrial Tactician",
    "tags": [
      "生物中速"
    ],
    "summary": "利用重置获取大量资源的bant资源性中速套牌。",
    "winConditions": [
      "埃米尔+苗地+主将组合技"
    ],
    "strengths": [
      "可绕过指挥官税入场",
      "通过战斗阶段可以赚取费用，甚至是配合至尊戒获取手牌"
    ],
    "weaknesses": [
      "套牌操作复杂",
      "容错空间小"
    ],
    "analysis": "德蕾薇能把细小的战斗触发转化为法术力以及手牌资源。它尤其依赖对环境速度的准确判断。",
    "deckUrl": "https://topdeck.gg/deck/802cedh-presents-hot-heels-of-summer-part-2/ig2RLb5RfTXNLIFlkXll9XAJa2h2",
    "commanders": [
      {
        "cn": "穹光策士德蕾薇",
        "en": "Derevi, Empyrial Tactician",
        "scryfallId": "3a1d0dad-18a8-489e-ac11-08f64b72fda4",
        "small": "https://cards.scryfall.io/small/front/3/a/3a1d0dad-18a8-489e-ac11-08f64b72fda4.jpg?1783936231",
        "art": "https://cards.scryfall.io/art_crop/front/3/a/3a1d0dad-18a8-489e-ac11-08f64b72fda4.jpg?1783936231",
        "normal": "https://cards.scryfall.io/normal/front/3/a/3a1d0dad-18a8-489e-ac11-08f64b72fda4.jpg?1783936231"
      }
    ]
  },
  {
    "id": "brigid-clachans-heart",
    "tier": "t2",
    "nameZh": "小村之心布莉姬",
    "nameEn": "Brigid, Clachan's Heart",
    "tags": [
      "法术力爆发",
      "苗地",
      "绿色哥们儿"
    ],
    "summary": "围绕布莉姬双面异能构建的苗地类型套牌。",
    "winConditions": [
      "指挥官翻面之后可以产出大量费用。",
      "配合苗地和大量低费生物可以产出很多费用。"
    ],
    "strengths": [
      "费用多",
      "路线上全是生物难以互动"
    ],
    "weaknesses": [
      "路线成熟度仍需验证",
      "容易受到永久物去除影响"
    ],
    "analysis": "速度比较快的白绿主将，可以在主将变身回合具有高爆发能力，一回合可以出很多永久物。路线比较特殊，组件如果桌上其他人没见过可能就会赢的很突然。",
    "deckUrl": "https://topdeck.gg/deck/k-town-beatdown-4/iUApsHTjYoQiJLI1ej7WdEomp7M2",
    "commanders": [
      {
        "cn": "小村之心布莉姬",
        "en": "Brigid, Clachan's Heart // Brigid, Doun's Mind",
        "scryfallId": "cb7d5bbb-4f68-4e38-8bb0-a95af21b24c8",
        "small": "https://cards.scryfall.io/small/front/c/b/cb7d5bbb-4f68-4e38-8bb0-a95af21b24c8.jpg?1783904517",
        "art": "https://cards.scryfall.io/art_crop/front/c/b/cb7d5bbb-4f68-4e38-8bb0-a95af21b24c8.jpg?1783904517",
        "normal": "https://cards.scryfall.io/normal/front/c/b/cb7d5bbb-4f68-4e38-8bb0-a95af21b24c8.jpg?1783904517"
      }
    ]
  },
  {
    "id": "tayam",
    "tier": "t2",
    "nameZh": "灿光谜兽塔亚姆",
    "nameEn": "Tayam, Luminous Enigma",
    "tags": [
      "中速 Midrange",
      "坟场+永久物组合",
      "绿色哥们儿"
    ],
    "summary": "用指示物和坟场循环构建韧性极强的永久物组合体系。",
    "winConditions": [
      "坟场组合技"
    ],
    "strengths": [
      "组合组件可互相回收",
      "抗单点互动",
      "擅长复杂资源战"
    ],
    "weaknesses": [
      "操作与触发管理复杂",
      "调色困难主将难出"
    ],
    "analysis": "塔亚姆的深度来自大量彼此交叉的循环路线，每一个生物以及每一个卡位都值得仔细选择，目前最大的问题就在于制胜依赖主将但是主将非常难出，不仅费用是4费而且需要3种颜色，构筑当中还必须要携带单色的功能地、基本地，调色十分困难。",
    "deckUrl": "https://topdeck.gg/deck/mox-mania-ii-perfect-storm-comics-games/9Qtmz7MpFKeHBE6KG3sKlDf7yLy2",
    "commanders": [
      {
        "cn": "灿光谜兽塔亚姆",
        "en": "Tayam, Luminous Enigma",
        "scryfallId": "05b837a2-5773-4340-87f9-b4d6a43deb27",
        "small": "https://cards.scryfall.io/small/front/0/5/05b837a2-5773-4340-87f9-b4d6a43deb27.jpg?1783931228",
        "art": "https://cards.scryfall.io/art_crop/front/0/5/05b837a2-5773-4340-87f9-b4d6a43deb27.jpg?1783931228",
        "normal": "https://cards.scryfall.io/normal/front/0/5/05b837a2-5773-4340-87f9-b4d6a43deb27.jpg?1783931228"
      }
    ]
  },
  {
    "id": "arcum-dagsson",
    "tier": "t2",
    "nameZh": "阿肯达格森",
    "nameEn": "Arcum Dagsson",
    "tags": [
      "神器",
      "工具箱 Toolbox",
      "单色"
    ],
    "summary": "通过牺牲神器生物直接检索关键非生物神器的单蓝工具箱。",
    "winConditions": [
      "神器锁与独特的组合技"
    ],
    "strengths": [
      "指挥官导师能力强",
      "神器路线明确",
      "蓝色提供保护"
    ],
    "weaknesses": [
      "指挥官需横置启动",
      "容易被生物去除和召唤失调拖慢"
    ],
    "analysis": "启动条件比较严格，但是成功启动后的工具箱能力仍然值得尊重。",
    "deckUrl": "https://topdeck.gg/deck/the-birdcage-vii-2fast2finch/oUlN9S1weOZzrMzf6X0agE5lLWl1",
    "commanders": [
      {
        "cn": "阿肯达格森",
        "en": "Arcum Dagsson",
        "scryfallId": "f5ecf811-2efc-4fa6-9af8-ef09f559ec1a",
        "small": "https://cards.scryfall.io/small/front/f/5/f5ecf811-2efc-4fa6-9af8-ef09f559ec1a.jpg?1783930205",
        "art": "https://cards.scryfall.io/art_crop/front/f/5/f5ecf811-2efc-4fa6-9af8-ef09f559ec1a.jpg?1783930205",
        "normal": "https://cards.scryfall.io/normal/front/f/5/f5ecf811-2efc-4fa6-9af8-ef09f559ec1a.jpg?1783930205"
      }
    ]
  },
  {
    "id": "dargo-kodama",
    "tier": "t3",
    "nameZh": "达戈 + 东树木灵",
    "nameEn": "Dargo & Kodama",
    "tags": [
      "永久物组合",
      "牺牲",
      "古鲁"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/jeweled-lotus-lattenkamp-2026/yU3r3RPdbEbRPD0ZuiWCEVQhphP2",
    "commanders": [
      {
        "cn": "碎船巨人达戈",
        "en": "Dargo, the Shipwrecker",
        "scryfallId": "5cd87cf8-4d5d-4aba-8dfa-800b1fb3799b",
        "small": "https://cards.scryfall.io/small/front/5/c/5cd87cf8-4d5d-4aba-8dfa-800b1fb3799b.jpg?1783928817",
        "art": "https://cards.scryfall.io/art_crop/front/5/c/5cd87cf8-4d5d-4aba-8dfa-800b1fb3799b.jpg?1783928817",
        "normal": "https://cards.scryfall.io/normal/front/5/c/5cd87cf8-4d5d-4aba-8dfa-800b1fb3799b.jpg?1783928817"
      },
      {
        "cn": "东树木灵",
        "en": "Kodama of the East Tree",
        "scryfallId": "af5105ee-09e2-4344-ab39-00f0e9034c47",
        "small": "https://cards.scryfall.io/small/front/a/f/af5105ee-09e2-4344-ab39-00f0e9034c47.jpg?1783928789",
        "art": "https://cards.scryfall.io/art_crop/front/a/f/af5105ee-09e2-4344-ab39-00f0e9034c47.jpg?1783928789",
        "normal": "https://cards.scryfall.io/normal/front/a/f/af5105ee-09e2-4344-ab39-00f0e9034c47.jpg?1783928789"
      }
    ]
  },
  {
    "id": "yuriko-tigers-shadow",
    "tier": "t3",
    "nameZh": "虎影百合子",
    "nameEn": "Yuriko, the Tiger's Shadow",
    "tags": [
      "节奏 Tempo",
      "忍者",
      "牌库顶"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/1-path-to-exile-cedh-tournament-european-qualifier/VVmovbr8EqPsmZ4DOsyZLNqvZQy2",
    "commanders": [
      {
        "cn": "虎影百合子",
        "en": "Yuriko, the Tiger's Shadow",
        "scryfallId": "fe9be3e0-076c-4703-9750-2a6b0a178bc9",
        "small": "https://cards.scryfall.io/small/front/f/e/fe9be3e0-076c-4703-9750-2a6b0a178bc9.jpg?1783915606",
        "art": "https://cards.scryfall.io/art_crop/front/f/e/fe9be3e0-076c-4703-9750-2a6b0a178bc9.jpg?1783915606",
        "normal": "https://cards.scryfall.io/normal/front/f/e/fe9be3e0-076c-4703-9750-2a6b0a178bc9.jpg?1783915606"
      }
    ]
  },
  {
    "id": "zirda",
    "tier": "t3",
    "nameZh": "熠晓灵狐泽尔达",
    "nameEn": "Zirda, the Dawnwaker",
    "tags": [
      "神器",
      "Turbo"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/autism-awareness-cedh-event-3rd-annual/Q87hfI7uuFU5XXq5GZzTxtCaCQw2",
    "commanders": [
      {
        "cn": "熠晓灵狐泽尔达",
        "en": "Zirda, the Dawnwaker",
        "scryfallId": "1bd8e61c-2ee8-4243-a848-7008810db8a0",
        "small": "https://cards.scryfall.io/small/front/1/b/1bd8e61c-2ee8-4243-a848-7008810db8a0.jpg?1783931007",
        "art": "https://cards.scryfall.io/art_crop/front/1/b/1bd8e61c-2ee8-4243-a848-7008810db8a0.jpg?1783931007",
        "normal": "https://cards.scryfall.io/normal/front/1/b/1bd8e61c-2ee8-4243-a848-7008810db8a0.jpg?1783931007"
      }
    ]
  },
  {
    "id": "tymna-malcolm",
    "tier": "t3",
    "nameZh": "堤谟娜 + 马科姆",
    "nameEn": "Tymna & Malcolm",
    "tags": [
      "中速 Midrange",
      "海盗",
      "四人桌优势"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/njcedh-low-stakes-red-seal-gaming-june-27th/b7XpP9Z6dSPaaZMIBpHg9FFY2w02",
    "commanders": [
      {
        "cn": "织命使堤谟娜",
        "en": "Tymna the Weaver",
        "scryfallId": "bc7cbe9b-324e-42b8-94e2-36e91cb32163",
        "small": "https://cards.scryfall.io/small/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081",
        "art": "https://cards.scryfall.io/art_crop/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081",
        "normal": "https://cards.scryfall.io/normal/front/b/c/bc7cbe9b-324e-42b8-94e2-36e91cb32163.jpg?1783937081"
      },
      {
        "cn": "锐目领航员马科姆",
        "en": "Malcolm, Keen-Eyed Navigator",
        "scryfallId": "51187cdb-85ee-4f68-9e29-d84d296f0825",
        "small": "https://cards.scryfall.io/small/front/5/1/51187cdb-85ee-4f68-9e29-d84d296f0825.jpg?1783913885",
        "art": "https://cards.scryfall.io/art_crop/front/5/1/51187cdb-85ee-4f68-9e29-d84d296f0825.jpg?1783913885",
        "normal": "https://cards.scryfall.io/normal/front/5/1/51187cdb-85ee-4f68-9e29-d84d296f0825.jpg?1783913885"
      }
    ]
  },
  {
    "id": "gitrog-monster",
    "tier": "t3",
    "nameZh": "噬人蛙怪",
    "nameEn": "The Gitrog Monster",
    "tags": [
      "坟场",
      "组合技 Combo",
      "地牌"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/lcq-for-the-cedh-european-championship/EOObQc22o3SXUM4Fn4eVkoLmgu13",
    "commanders": [
      {
        "cn": "噬人蛙怪",
        "en": "The Gitrog Monster",
        "scryfallId": "40489e28-878d-44a2-847f-07beef1aa0f8",
        "small": "https://cards.scryfall.io/small/front/4/0/40489e28-878d-44a2-847f-07beef1aa0f8.jpg?1783906028",
        "art": "https://cards.scryfall.io/art_crop/front/4/0/40489e28-878d-44a2-847f-07beef1aa0f8.jpg?1783906028",
        "normal": "https://cards.scryfall.io/normal/front/4/0/40489e28-878d-44a2-847f-07beef1aa0f8.jpg?1783906028"
      }
    ]
  },
  {
    "id": "najeela",
    "tier": "t3",
    "nameZh": "剑花娜吉拉",
    "nameEn": "Najeela, the Blade-Blossom",
    "tags": [
      "战斗",
      "五色",
      "中速 Midrange"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/commandergeddon-10-brought-to-you-by-jenes-mtg/Tn7hc9tJIjhoDu0yDp7OHtJRG3i2",
    "commanders": [
      {
        "cn": "剑花娜吉拉",
        "en": "Najeela, the Blade-Blossom",
        "scryfallId": "2cb1d1da-6077-46b5-8c63-39882b8016f2",
        "small": "https://cards.scryfall.io/small/front/2/c/2cb1d1da-6077-46b5-8c63-39882b8016f2.jpg?1783934856",
        "art": "https://cards.scryfall.io/art_crop/front/2/c/2cb1d1da-6077-46b5-8c63-39882b8016f2.jpg?1783934856",
        "normal": "https://cards.scryfall.io/normal/front/2/c/2cb1d1da-6077-46b5-8c63-39882b8016f2.jpg?1783934856"
      }
    ]
  },
  {
    "id": "tevesh-thrasios",
    "tier": "t3",
    "nameZh": "刹特 + 萨拉希洛斯",
    "nameEn": "Tevesh Szat & Thrasios",
    "tags": [
      "控制 Control",
      "中速 Midrange",
      "四人桌优势"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/cedh-shuffle-2-the-reshuffle/uXA5k4QaHJUcobxlLSprQO6rRfp2",
    "commanders": [
      {
        "cn": "愚者末日泰维司刹特",
        "en": "Tevesh Szat, Doom of Fools",
        "scryfallId": "8f244716-78ab-46f5-b6e9-fc1e6db28052",
        "small": "https://cards.scryfall.io/small/front/8/f/8f244716-78ab-46f5-b6e9-fc1e6db28052.jpg?1783928825",
        "art": "https://cards.scryfall.io/art_crop/front/8/f/8f244716-78ab-46f5-b6e9-fc1e6db28052.jpg?1783928825",
        "normal": "https://cards.scryfall.io/normal/front/8/f/8f244716-78ab-46f5-b6e9-fc1e6db28052.jpg?1783928825"
      },
      {
        "cn": "屈东英雄萨拉希洛斯",
        "en": "Thrasios, Triton Hero",
        "scryfallId": "21e27b91-c7f1-4709-aa0d-8b5d81b22a0a",
        "small": "https://cards.scryfall.io/small/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081",
        "art": "https://cards.scryfall.io/art_crop/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081",
        "normal": "https://cards.scryfall.io/normal/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081"
      }
    ]
  },
  {
    "id": "rocco",
    "tier": "t3",
    "nameZh": "乐舞会主厨罗孔",
    "nameEn": "Rocco, Cabaretti Caterer",
    "tags": [
      "工具箱 Toolbox",
      "生物组合",
      "纳雅"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/cedh-dual-tournament-6-march-29th/D9PZpKML81bz909R8849RkD6GC62",
    "commanders": [
      {
        "cn": "乐舞会主厨罗孔",
        "en": "Rocco, Cabaretti Caterer",
        "scryfallId": "b6cf8b35-2a81-40fd-b383-becb81bef806",
        "small": "https://cards.scryfall.io/small/front/b/6/b6cf8b35-2a81-40fd-b383-becb81bef806.jpg?1783923072",
        "art": "https://cards.scryfall.io/art_crop/front/b/6/b6cf8b35-2a81-40fd-b383-becb81bef806.jpg?1783923072",
        "normal": "https://cards.scryfall.io/normal/front/b/6/b6cf8b35-2a81-40fd-b383-becb81bef806.jpg?1783923072"
      }
    ]
  },
  {
    "id": "rowan-scion-of-war",
    "tier": "t3",
    "nameZh": "尚武后裔萝婉",
    "nameEn": "Rowan, Scion of War",
    "tags": [
      "Turbo",
      "生命资源",
      "拉铎司"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/christmas-for-cedh-charity-tournament-lost-levels-card/u7T8OPfcuaWFomt0m51uoJuFfzy2",
    "commanders": [
      {
        "cn": "尚武后裔萝婉",
        "en": "Rowan, Scion of War",
        "scryfallId": "4ee179ab-a15b-4bd6-b7f8-1e1abeeb31b7",
        "small": "https://cards.scryfall.io/small/front/4/e/4ee179ab-a15b-4bd6-b7f8-1e1abeeb31b7.jpg?1783915070",
        "art": "https://cards.scryfall.io/art_crop/front/4/e/4ee179ab-a15b-4bd6-b7f8-1e1abeeb31b7.jpg?1783915070",
        "normal": "https://cards.scryfall.io/normal/front/4/e/4ee179ab-a15b-4bd6-b7f8-1e1abeeb31b7.jpg?1783915070"
      }
    ]
  },
  {
    "id": "lumra-bellow-of-the-woods",
    "tier": "t3",
    "nameZh": "林间嚎吼卢玛拉",
    "nameEn": "Lumra, Bellow of the Woods",
    "tags": [
      "坟场",
      "地牌引擎",
      "单绿色"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/njcedh-presents-sinkhole-2/taEVTzIjSPg5jvcKLDLD3VYZ7lk1",
    "commanders": [
      {
        "cn": "林间嚎吼卢玛拉",
        "en": "Lumra, Bellow of the Woods",
        "scryfallId": "ae4f3aaf-3960-48cd-b34b-32e4ae5ae088",
        "small": "https://cards.scryfall.io/small/front/a/e/ae4f3aaf-3960-48cd-b34b-32e4ae5ae088.jpg?1785161492",
        "art": "https://cards.scryfall.io/art_crop/front/a/e/ae4f3aaf-3960-48cd-b34b-32e4ae5ae088.jpg?1785161492",
        "normal": "https://cards.scryfall.io/normal/front/a/e/ae4f3aaf-3960-48cd-b34b-32e4ae5ae088.jpg?1785161492"
      }
    ]
  },
  {
    "id": "crystal-inhuman-princess",
    "tier": "t3",
    "nameZh": "异人族公主水晶",
    "nameEn": "Crystal, Inhuman Princess",
    "tags": [
      "实验性",
      "中速 Midrange",
      "生物组合"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/mulligan-championship-series-july-w-guaranteed-plateau/GHPNb0E7DnWMVIsJIhYSXre58rB3",
    "commanders": [
      {
        "cn": "异人族公主水晶",
        "en": "Crystal, Inhuman Princess",
        "scryfallId": "1e9aec49-08d7-4fc8-87dd-69ab8910688a",
        "small": "https://cards.scryfall.io/small/front/1/e/1e9aec49-08d7-4fc8-87dd-69ab8910688a.jpg?1783981173",
        "art": "https://cards.scryfall.io/art_crop/front/1/e/1e9aec49-08d7-4fc8-87dd-69ab8910688a.jpg?1783981173",
        "normal": "https://cards.scryfall.io/normal/front/1/e/1e9aec49-08d7-4fc8-87dd-69ab8910688a.jpg?1783981173"
      }
    ]
  },
  {
    "id": "wandering-minstrel",
    "tier": "t3",
    "nameZh": "异国的诗人",
    "nameEn": "The Wandering Minstrel",
    "tags": [
      "地牌引擎",
      "新原型",
      "五色出口"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/from-the-vault-anniversary-3-mox-ruby/xblLwsycN3fTTV5W284gwPUXBRa2",
    "commanders": [
      {
        "cn": "异国的诗人",
        "en": "The Wandering Minstrel",
        "scryfallId": "77bc419d-ff69-4e7c-afe6-faca383a5ed7",
        "small": "https://cards.scryfall.io/small/front/7/7/77bc419d-ff69-4e7c-afe6-faca383a5ed7.jpg?1783906560",
        "art": "https://cards.scryfall.io/art_crop/front/7/7/77bc419d-ff69-4e7c-afe6-faca383a5ed7.jpg?1783906560",
        "normal": "https://cards.scryfall.io/normal/front/7/7/77bc419d-ff69-4e7c-afe6-faca383a5ed7.jpg?1783906560"
      }
    ]
  },
  {
    "id": "tasigur",
    "tier": "t3",
    "nameZh": "金牙塔西格",
    "nameEn": "Tasigur, the Golden Fang",
    "tags": [
      "控制 Control",
      "坟场",
      "苏勒台"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/cardart-monthly-volcanic-island/mwVyp8cBdTY0t24IAomKClv2qzP2",
    "commanders": [
      {
        "cn": "金牙塔西格",
        "en": "Tasigur, the Golden Fang",
        "scryfallId": "175ad810-3cdd-43c7-99a9-8a2e8ad6dbae",
        "small": "https://cards.scryfall.io/small/front/1/7/175ad810-3cdd-43c7-99a9-8a2e8ad6dbae.jpg?1783907079",
        "art": "https://cards.scryfall.io/art_crop/front/1/7/175ad810-3cdd-43c7-99a9-8a2e8ad6dbae.jpg?1783907079",
        "normal": "https://cards.scryfall.io/normal/front/1/7/175ad810-3cdd-43c7-99a9-8a2e8ad6dbae.jpg?1783907079"
      }
    ]
  },
  {
    "id": "winota-joiner-of-forces",
    "tier": "t3",
    "nameZh": "聚力领袖薇诺塔",
    "nameEn": "Winota, Joiner of Forces",
    "tags": [
      "锁牌 Stax",
      "战斗",
      "波洛斯"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/best-in-the-west-platinum-qualifier-3k/jAoxgyuEIWXvpCLXzXg1haW5Vp62",
    "commanders": [
      {
        "cn": "聚力领袖薇诺塔",
        "en": "Winota, Joiner of Forces",
        "scryfallId": "5dd13a6c-23d3-44ce-a628-cb1c19d777c4",
        "small": "https://cards.scryfall.io/small/front/5/d/5dd13a6c-23d3-44ce-a628-cb1c19d777c4.jpg?1783931014",
        "art": "https://cards.scryfall.io/art_crop/front/5/d/5dd13a6c-23d3-44ce-a628-cb1c19d777c4.jpg?1783931014",
        "normal": "https://cards.scryfall.io/normal/front/5/d/5dd13a6c-23d3-44ce-a628-cb1c19d777c4.jpg?1783931014"
      }
    ]
  },
  {
    "id": "malcolm-vial-smasher",
    "tier": "t3",
    "nameZh": "马科姆 + 砸瓶女汉子",
    "nameEn": "Malcolm & Vial Smasher",
    "tags": [
      "中速 Midrange",
      "海盗",
      "格利极"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/land-go-expo-nashville-hot-redemption-event/kVD4ADHTRrbeoimFWT9qWjcVOsk2",
    "commanders": [
      {
        "cn": "锐目领航员马科姆",
        "en": "Malcolm, Keen-Eyed Navigator",
        "scryfallId": "51187cdb-85ee-4f68-9e29-d84d296f0825",
        "small": "https://cards.scryfall.io/small/front/5/1/51187cdb-85ee-4f68-9e29-d84d296f0825.jpg?1783913885",
        "art": "https://cards.scryfall.io/art_crop/front/5/1/51187cdb-85ee-4f68-9e29-d84d296f0825.jpg?1783913885",
        "normal": "https://cards.scryfall.io/normal/front/5/1/51187cdb-85ee-4f68-9e29-d84d296f0825.jpg?1783913885"
      },
      {
        "cn": "砸瓶女汉子",
        "en": "Vial Smasher the Fierce",
        "scryfallId": "cc7be939-2202-40fe-8899-a05682d76190",
        "small": "https://cards.scryfall.io/small/front/c/c/cc7be939-2202-40fe-8899-a05682d76190.jpg?1783909586",
        "art": "https://cards.scryfall.io/art_crop/front/c/c/cc7be939-2202-40fe-8899-a05682d76190.jpg?1783909586",
        "normal": "https://cards.scryfall.io/normal/front/c/c/cc7be939-2202-40fe-8899-a05682d76190.jpg?1783909586"
      }
    ]
  },
  {
    "id": "ob-nixilis-captive-kingpin",
    "tier": "t3",
    "nameZh": "受困魔头欧尼希兹",
    "nameEn": "Ob Nixilis, Captive Kingpin",
    "tags": [
      "组合技 Combo",
      "拉铎司",
      "伤害引擎"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/weekly-mulligans-february-1st/xgoFcKyBmNMBHadFuS5eGzPiBGD2",
    "commanders": [
      {
        "cn": "受困魔头欧尼希兹",
        "en": "Ob Nixilis, Captive Kingpin",
        "scryfallId": "ddb68233-3683-41bd-9b6e-4f07a1b54244",
        "small": "https://cards.scryfall.io/small/front/d/d/ddb68233-3683-41bd-9b6e-4f07a1b54244.jpg?1783916511",
        "art": "https://cards.scryfall.io/art_crop/front/d/d/ddb68233-3683-41bd-9b6e-4f07a1b54244.jpg?1783916511",
        "normal": "https://cards.scryfall.io/normal/front/d/d/ddb68233-3683-41bd-9b6e-4f07a1b54244.jpg?1783916511"
      }
    ]
  },
  {
    "id": "atraxa-grand-unifier",
    "tier": "t3",
    "nameZh": "大一统飞将亚崔夏",
    "nameEn": "Atraxa, Grand Unifier",
    "tags": [
      "中速 Midrange",
      "四色",
      "进场价值"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/black-sun-games-western-maryland-cedh-showdown-2/zMz87gNhecYPt1oHbGsWJQ76O112",
    "commanders": [
      {
        "cn": "大一统飞将亚崔夏",
        "en": "Atraxa, Grand Unifier",
        "scryfallId": "4a1f905f-1d55-4d02-9d24-e58070793d3f",
        "small": "https://cards.scryfall.io/small/front/4/a/4a1f905f-1d55-4d02-9d24-e58070793d3f.jpg?1783918003",
        "art": "https://cards.scryfall.io/art_crop/front/4/a/4a1f905f-1d55-4d02-9d24-e58070793d3f.jpg?1783918003",
        "normal": "https://cards.scryfall.io/normal/front/4/a/4a1f905f-1d55-4d02-9d24-e58070793d3f.jpg?1783918003"
      }
    ]
  },
  {
    "id": "marneus-calgar",
    "tier": "t3",
    "nameZh": "玛尔涅斯·寇卡尔",
    "nameEn": "Marneus Calgar",
    "tags": [
      "中速 Midrange",
      "衍生物",
      "艾斯波"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/la-giostra-del-regno-1758571809304/BfmiooAwwNgtNw9Y2hXDMTBCu8B2",
    "commanders": [
      {
        "cn": "玛尔涅斯·寇卡尔",
        "en": "Marneus Calgar",
        "scryfallId": "e7517e8e-b424-4731-ba9d-6132bdefa6bf",
        "small": "https://cards.scryfall.io/small/front/e/7/e7517e8e-b424-4731-ba9d-6132bdefa6bf.jpg?1783920949",
        "art": "https://cards.scryfall.io/art_crop/front/e/7/e7517e8e-b424-4731-ba9d-6132bdefa6bf.jpg?1783920949",
        "normal": "https://cards.scryfall.io/normal/front/e/7/e7517e8e-b424-4731-ba9d-6132bdefa6bf.jpg?1783920949"
      }
    ]
  },
  {
    "id": "urza-lord-high-artificer",
    "tier": "t3",
    "nameZh": "铸物勋爵克撒",
    "nameEn": "Urza, Lord High Artificer",
    "tags": [
      "神器",
      "控制 Control",
      "单蓝"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/spokane-spring-open-cedh/R9HvO8Mck7hmRrXJosPt9HrTCBu1",
    "commanders": [
      {
        "cn": "铸物勋爵克撒",
        "en": "Urza, Lord High Artificer",
        "scryfallId": "7b7a348a-51f7-4dc5-8fe7-1c70fea5e050",
        "small": "https://cards.scryfall.io/small/front/7/b/7b7a348a-51f7-4dc5-8fe7-1c70fea5e050.jpg?1783915686",
        "art": "https://cards.scryfall.io/art_crop/front/7/b/7b7a348a-51f7-4dc5-8fe7-1c70fea5e050.jpg?1783915686",
        "normal": "https://cards.scryfall.io/normal/front/7/b/7b7a348a-51f7-4dc5-8fe7-1c70fea5e050.jpg?1783915686"
      }
    ]
  },
  {
    "id": "glarb-calamitys-augur",
    "tier": "t3",
    "nameZh": "灾祸卜算师格拉布",
    "nameEn": "Glarb, Calamity's Augur",
    "tags": [
      "中速 Midrange",
      "苏勒台",
      "牌库顶"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/802cedh-presents-hot-heels-of-summer-part-2/zpMQwKAsSgfy59edol38iIKIz932",
    "commanders": [
      {
        "cn": "灾祸卜算师格拉布",
        "en": "Glarb, Calamity's Augur",
        "scryfallId": "ffc70b2d-5a3a-49ea-97db-175a62248302",
        "small": "https://cards.scryfall.io/small/front/f/f/ffc70b2d-5a3a-49ea-97db-175a62248302.jpg?1783910796",
        "art": "https://cards.scryfall.io/art_crop/front/f/f/ffc70b2d-5a3a-49ea-97db-175a62248302.jpg?1783910796",
        "normal": "https://cards.scryfall.io/normal/front/f/f/ffc70b2d-5a3a-49ea-97db-175a62248302.jpg?1783910796"
      }
    ]
  },
  {
    "id": "leonardo-michelangelo",
    "tier": "t3",
    "nameZh": "衡心定盘莱昂纳多 / 乐天真心米开朗基罗",
    "nameEn": "Leonardo, the Balance / Michelangelo, the Heart",
    "tags": [
      "五色",
      "衍生物",
      "拍档"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/gamer-geeks-fbb-beatdown/dU1r3vb0vTbj52udXh01aBiKmS92",
    "commanders": [
      {
        "cn": "衡心定盘莱昂纳多",
        "en": "Leonardo, the Balance",
        "scryfallId": "72e637db-7112-406f-809b-0eda248488b5",
        "small": "https://cards.scryfall.io/small/front/7/2/72e637db-7112-406f-809b-0eda248488b5.jpg?1783904176",
        "art": "https://cards.scryfall.io/art_crop/front/7/2/72e637db-7112-406f-809b-0eda248488b5.jpg?1783904176",
        "normal": "https://cards.scryfall.io/normal/front/7/2/72e637db-7112-406f-809b-0eda248488b5.jpg?1783904176"
      },
      {
        "cn": "乐天真心米开朗基罗",
        "en": "Michelangelo, the Heart",
        "scryfallId": "bac2d744-db65-4b56-8634-c87fd00c090e",
        "small": "https://cards.scryfall.io/small/front/b/a/bac2d744-db65-4b56-8634-c87fd00c090e.jpg?1783904173",
        "art": "https://cards.scryfall.io/art_crop/front/b/a/bac2d744-db65-4b56-8634-c87fd00c090e.jpg?1783904173",
        "normal": "https://cards.scryfall.io/normal/front/b/a/bac2d744-db65-4b56-8634-c87fd00c090e.jpg?1783904173"
      }
    ]
  },
  {
    "id": "april-oneil-leonardo",
    "tier": "t3",
    "nameZh": "现场直击的艾普·奥尼尔 / 衡心定盘莱昂纳多",
    "nameEn": "April O'Neil, Live on the Scene / Leonardo, the Balance",
    "tags": [
      "五色",
      "线索",
      "拍档"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/commandergeddon-10-brought-to-you-by-jenes-mtg/N04neeQn7LMLFkYxG5CzehkmuKC3",
    "commanders": [
      {
        "cn": "现场直击的艾普·奥尼尔",
        "en": "April O'Neil, Live on the Scene",
        "scryfallId": "7265ab42-5434-4127-acd6-8905ab63d62d",
        "small": "https://cards.scryfall.io/small/front/7/2/7265ab42-5434-4127-acd6-8905ab63d62d.jpg?1783904171",
        "art": "https://cards.scryfall.io/art_crop/front/7/2/7265ab42-5434-4127-acd6-8905ab63d62d.jpg?1783904171",
        "normal": "https://cards.scryfall.io/normal/front/7/2/7265ab42-5434-4127-acd6-8905ab63d62d.jpg?1783904171"
      },
      {
        "cn": "衡心定盘莱昂纳多",
        "en": "Leonardo, the Balance",
        "scryfallId": "72e637db-7112-406f-809b-0eda248488b5",
        "small": "https://cards.scryfall.io/small/front/7/2/72e637db-7112-406f-809b-0eda248488b5.jpg?1783904176",
        "art": "https://cards.scryfall.io/art_crop/front/7/2/72e637db-7112-406f-809b-0eda248488b5.jpg?1783904176",
        "normal": "https://cards.scryfall.io/normal/front/7/2/72e637db-7112-406f-809b-0eda248488b5.jpg?1783904176"
      }
    ]
  },
  {
    "id": "thrasios-vial-smasher",
    "tier": "t4",
    "nameZh": "萨拉希洛斯 + 砸瓶女汉子",
    "nameEn": "Thrasios & Vial Smasher",
    "tags": [
      "中速 Midrange",
      "四色",
      "法术力出口"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/mana-masters-x-red-bull-summer-2026/anttRGkYwtaHrvP58XWHXYGpk962",
    "commanders": [
      {
        "cn": "屈东英雄萨拉希洛斯",
        "en": "Thrasios, Triton Hero",
        "scryfallId": "21e27b91-c7f1-4709-aa0d-8b5d81b22a0a",
        "small": "https://cards.scryfall.io/small/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081",
        "art": "https://cards.scryfall.io/art_crop/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081",
        "normal": "https://cards.scryfall.io/normal/front/2/1/21e27b91-c7f1-4709-aa0d-8b5d81b22a0a.jpg?1783937081"
      },
      {
        "cn": "砸瓶女汉子",
        "en": "Vial Smasher the Fierce",
        "scryfallId": "cc7be939-2202-40fe-8899-a05682d76190",
        "small": "https://cards.scryfall.io/small/front/c/c/cc7be939-2202-40fe-8899-a05682d76190.jpg?1783909586",
        "art": "https://cards.scryfall.io/art_crop/front/c/c/cc7be939-2202-40fe-8899-a05682d76190.jpg?1783909586",
        "normal": "https://cards.scryfall.io/normal/front/c/c/cc7be939-2202-40fe-8899-a05682d76190.jpg?1783909586"
      }
    ]
  },
  {
    "id": "raph-mikey-troublemakers",
    "tier": "t4",
    "nameZh": "经常捣乱的拉夫与麦奇",
    "nameEn": "Raph & Mikey, Troublemakers",
    "tags": [
      "新原型",
      "生物组合",
      "待验证"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/the-beatdown/USgKs5gu0xYq7T61b6rld4JuP6S2",
    "commanders": [
      {
        "cn": "经常捣乱的拉夫与麦奇",
        "en": "Raph & Mikey, Troublemakers",
        "scryfallId": "8795fba4-0ff3-4c04-a81c-60408608a00c",
        "small": "https://cards.scryfall.io/small/front/8/7/8795fba4-0ff3-4c04-a81c-60408608a00c.jpg?1783904069",
        "art": "https://cards.scryfall.io/art_crop/front/8/7/8795fba4-0ff3-4c04-a81c-60408608a00c.jpg?1783904069",
        "normal": "https://cards.scryfall.io/normal/front/8/7/8795fba4-0ff3-4c04-a81c-60408608a00c.jpg?1783904069"
      }
    ]
  },
  {
    "id": "ashling-limitless",
    "tier": "t4",
    "nameZh": "瀚力无边灰儿",
    "nameEn": "Ashling, the Limitless",
    "tags": [
      "实验性",
      "单色",
      "法术力引擎"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/stage-select-underground-sea-final-boss-x-commander/FQRVO20M93dnkLGPm3oiCrXVRjr1",
    "commanders": [
      {
        "cn": "瀚力无边灰儿",
        "en": "Ashling, the Limitless",
        "scryfallId": "5924c01f-2815-4e37-b700-3ba6cc81e0e4",
        "small": "https://cards.scryfall.io/small/front/5/9/5924c01f-2815-4e37-b700-3ba6cc81e0e4.jpg?1783904607",
        "art": "https://cards.scryfall.io/art_crop/front/5/9/5924c01f-2815-4e37-b700-3ba6cc81e0e4.jpg?1783904607",
        "normal": "https://cards.scryfall.io/normal/front/5/9/5924c01f-2815-4e37-b700-3ba6cc81e0e4.jpg?1783904607"
      }
    ]
  },
  {
    "id": "scion-ur-dragon",
    "tier": "t4",
    "nameZh": "太初龙后裔",
    "nameEn": "Scion of the Ur-Dragon",
    "tags": [
      "五色",
      "坟场",
      "龙"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/njcedh-presents-sinkhole-2/TdXy6jQ5i2U0AdoDDYW7mrjxO4Q2",
    "commanders": [
      {
        "cn": "太初龙后裔",
        "en": "Scion of the Ur-Dragon",
        "scryfallId": "565b2a40-57b1-451f-8c2a-e02222502288",
        "small": "https://cards.scryfall.io/small/front/5/6/565b2a40-57b1-451f-8c2a-e02222502288.jpg?1783935875",
        "art": "https://cards.scryfall.io/art_crop/front/5/6/565b2a40-57b1-451f-8c2a-e02222502288.jpg?1783935875",
        "normal": "https://cards.scryfall.io/normal/front/5/6/565b2a40-57b1-451f-8c2a-e02222502288.jpg?1783935875"
      }
    ]
  },
  {
    "id": "malcolm-tana",
    "tier": "t4",
    "nameZh": "马科姆 + 塔娜",
    "nameEn": "Malcolm & Tana",
    "tags": [
      "中速 Midrange",
      "海盗",
      "铁木尔"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/march-14th-cedh-3k/cBuYamMaaXdVpzJEeG0PVQtifA43",
    "commanders": [
      {
        "cn": "锐目领航员马科姆",
        "en": "Malcolm, Keen-Eyed Navigator",
        "scryfallId": "51187cdb-85ee-4f68-9e29-d84d296f0825",
        "small": "https://cards.scryfall.io/small/front/5/1/51187cdb-85ee-4f68-9e29-d84d296f0825.jpg?1783913885",
        "art": "https://cards.scryfall.io/art_crop/front/5/1/51187cdb-85ee-4f68-9e29-d84d296f0825.jpg?1783913885",
        "normal": "https://cards.scryfall.io/normal/front/5/1/51187cdb-85ee-4f68-9e29-d84d296f0825.jpg?1783913885"
      },
      {
        "cn": "沃血塔娜",
        "en": "Tana, the Bloodsower",
        "scryfallId": "a3d8d64f-a403-42a7-881b-4f70e9fe15a2",
        "small": "https://cards.scryfall.io/small/front/a/3/a3d8d64f-a403-42a7-881b-4f70e9fe15a2.jpg?1783937081",
        "art": "https://cards.scryfall.io/art_crop/front/a/3/a3d8d64f-a403-42a7-881b-4f70e9fe15a2.jpg?1783937081",
        "normal": "https://cards.scryfall.io/normal/front/a/3/a3d8d64f-a403-42a7-881b-4f70e9fe15a2.jpg?1783937081"
      }
    ]
  },
  {
    "id": "norman-osborn",
    "tier": "t4",
    "nameZh": "诺曼·奥斯本",
    "nameEn": "Norman Osborn",
    "tags": [
      "新原型",
      "变身",
      "中速 Midrange"
    ],
    "summary": "",
    "winConditions": [],
    "strengths": [],
    "weaknesses": [],
    "analysis": "",
    "deckUrl": "https://topdeck.gg/deck/commander-invitational-qualifier-gamer-geeks-warrior-5k/SuUFynNyU2aS73BZbvj1N2uWSwn2",
    "commanders": [
      {
        "cn": "诺曼·奥斯本",
        "en": "Norman Osborn // Green Goblin",
        "scryfallId": "d5c53af9-7150-4e78-8771-2de7980aa307",
        "small": "https://cards.scryfall.io/small/front/d/5/d5c53af9-7150-4e78-8771-2de7980aa307.jpg?1783905356",
        "art": "https://cards.scryfall.io/art_crop/front/d/5/d5c53af9-7150-4e78-8771-2de7980aa307.jpg?1783905356",
        "normal": "https://cards.scryfall.io/normal/front/d/5/d5c53af9-7150-4e78-8771-2de7980aa307.jpg?1783905356"
      }
    ]
  }
];

module.exports = {
  metaTierConfig,
  metaTierEntries,
};
