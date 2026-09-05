#!/usr/bin/env node
// 把 Commander Spellbook 的两卡组合技烤进 config/spellbook-combos.js。
//
// 为什么要这份数据：手工维护的 KNOWN_COMBOS 只有 42 条，牌表里绝大多数两卡组合技
// 根本没被认出来。Spellbook 是社区维护的组合技数据库（EDHREC 的组合技页就是它供的），
// 全量两卡组合技约 4000 条——**现有 39 条手工两卡条目，它一条不落地全都有**，
// 是严格超集。
//
// 为什么信它的档位判断：variant 上的 bracketTag 不是「这个组合技多强」，
// 而是「含有它的牌组会被估到哪一档」，由后端 estimate_bracket 从速度、是否真两卡、
// 产出是否致胜算出来（MIT 开源，规则可查）。字母到档位的映射取自它自己的模型定义：
//   R=4  S=3  P=3  O=2  C=2  E=1  B=禁牌
//
// 收哪些：**产出「Infinite …」的** ∪ **档位 ≥4 的**，剔除含禁牌的。前者是因为
// 官方 Bracket 2 的定义里明写「没有两卡无限组合技」，所以只要存在就该把下限顶到 3；
// 后者是「四级桌组合技」本身。
//
// 手工库（KNOWN_COMBOS）覆盖的配对**也收**：档位以这份为准。
// 手工库自己那套「早期→4，否则→2」的启发式实测 39 条里有 21 条与 Spellbook 不符，
// 其中 12 条把 Food Chain、Kiki-Jiki、Splinter Twin、Worldgorger 这类明显的
// 四级桌组合技判成了 3。手工库保留的是中文说法与家族归并，那部分它确实更好。
//
// 重新生成：node scripts/build-spellbook-combos.js
// 什么时候要重新生成：想同步 Spellbook 的新增组合技时。不跑也不会坏，只是漏新卡。

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'miniprogram', 'config', 'spellbook-combos.js');
const API = 'https://backend.commanderspellbook.com/variants/';
const PAGE_SIZE = 500;
const PAGE_GAP_MS = 300;

// 取自 Spellbook 后端 models/variant.py 的 BracketTag 与 bracket 生成字段
const TAG_TO_BRACKET = {
  R: 4, S: 3, P: 3, O: 2, C: 2, E: 1, B: 0,
};

// 产出特性有 361 种，逐条翻译既维护不动也没必要——用户要知道的是「这套牌能干什么」，
// 不是「无限魔法工艺触发」这个具体英文。归成九类，每类一句中文。
// 顺序即优先级：一个组合技同时产出无限法术力和胜利时，按胜利归类。
const CATEGORIES = [
  ['win', /^(Win the game|Each opponent loses the game|Infinite (damage|loss of life))/i, '直接胜利'],
  ['lock', /^(Lock|Infinite (?:turns|combat phases))|control (?:all|some) opponents/i, '锁定或无限回合'],
  ['mana', /^Infinite .*mana/i, '无限法术力'],
  ['draw', /^Infinite (?:card draw|draw triggers)/i, '无限抓牌'],
  ['tokens', /^Infinite creature tokens|^Infinite .*creatures/i, '无限衍生物'],
  ['storm', /^Infinite (?:storm count|magecraft|spell)/i, '无限施放与风暴数'],
  ['life', /^Infinite (?:lifegain|life)/i, '无限获得生命'],
  ['triggers', /^Infinite .*(?:trigger|ETB|LTB|untap|sacrifice)/i, '无限循环触发（需另配终结点）'],
  ['other', /^Infinite/i, '无限循环'],
];

function request(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'user-agent': 'cedh-tutor-build/1.0 (+https://github.com/N1kasepotis/cedh-tutor)',
        accept: 'application/json',
      },
    }, (response) => {
      let raw = '';
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          if (attempt < 3) {
            setTimeout(() => request(url, attempt + 1).then(resolve, reject), 1500 * (attempt + 1));
            return;
          }
          reject(new Error(`Spellbook 返回 ${response.statusCode}：${raw.slice(0, 160)}`));
          return;
        }
        try { resolve(JSON.parse(raw)); } catch (error) { reject(error); }
      });
    }).on('error', (error) => {
      if (attempt < 3) {
        setTimeout(() => request(url, attempt + 1).then(resolve, reject), 1500 * (attempt + 1));
        return;
      }
      reject(error);
    });
  });
}

function featureNames(variant) {
  return (variant.produces || []).map((item) => (item.feature && item.feature.name) || '');
}

function categoryOf(variant) {
  const names = featureNames(variant);
  for (let i = 0; i < CATEGORIES.length; i += 1) {
    const [key, pattern] = CATEGORIES[i];
    if (names.some((name) => pattern.test(name))) return key;
  }
  return 'other';
}

// API 分页顺序不构成档位保证。先显式排序，后面的配对去重才能保留最高档；
// 同档位按既有产出优先级，再按稳定 id 排序，避免网络返回顺序改变快照。
function prioritizeVariants(variants) {
  const rank = (variant) => CATEGORIES.findIndex(([key]) => key === categoryOf(variant));
  return variants.slice().sort((a, b) => {
    const bracket = (TAG_TO_BRACKET[b.bracketTag] || 0) - (TAG_TO_BRACKET[a.bracketTag] || 0);
    const category = rank(a) - rank(b);
    const aId = String(a.id || '');
    const bId = String(b.id || '');
    return bracket || category || (aId < bId ? -1 : aId > bId ? 1 : 0);
  });
}

// 与 utils/bracket.js 的 canonicalCardKey 同规则，用来跟手工库比对去重
function canonicalKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[‘’ʼ＇]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// 卡名表用换行拼成一整个字符串字面量。分隔符走常量而不是内联字面量：
// 这个脚本本身也是被脚本改过好几轮的，内联的 '\n' 每经一次转义处理就少一层反斜杠，
// 最后会在生成物里断成两行、直接语法错。
const NEWLINE = String.fromCharCode(10);

// 换行也要转义，否则字符串字面量会被真的换行截断
function quote(value) {
  return `'${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')}'`;
}

async function pullAll() {
  const collected = [];
  let url = `${API}?limit=${PAGE_SIZE}&q=${encodeURIComponent('cards=2')}`;
  let page = 0;
  while (url && page < 80) {
    /* eslint-disable no-await-in-loop */
    const payload = await request(url);
    (payload.results || []).forEach((item) => collected.push(item));
    page += 1;
    process.stdout.write(`\r  拉取第 ${page} 页，累计 ${collected.length} 条`);
    url = payload.next;
    if (url) await new Promise((resolve) => setTimeout(resolve, PAGE_GAP_MS));
  }
  process.stdout.write('\n');
  return collected;
}

// 生成物只放数据，匹配逻辑在手写的 utils/spellbook-combos.js 里。
// 「生成代码的代码」是转义地狱，而且数据要重新生成、逻辑不该跟着重新生成——
// 分开之后这个脚本只需要会拼字符串字面量。
function render(cards, records, categories, stats) {
  const lines = [];
  lines.push('// 由 scripts/build-spellbook-combos.js 生成，请勿手改。');
  lines.push(`// 数据来源：Commander Spellbook（MIT，社区维护的组合技数据库；EDHREC 的组合技页也用它）。`);
  lines.push(`// 生成日期：${new Date().toISOString().slice(0, 10)}`);
  lines.push('//');
  lines.push('// 收录范围：两卡组合技中「产出无限循环」∪「档位 ≥4」，剔除含禁牌的，');
  lines.push('// 手工库（config/bracket-data.js 的 KNOWN_COMBOS）覆盖的配对也在其中：');
  lines.push('// 档位以这份为准，手工库只保留中文与家族归并——它那套「早期→4，否则→2」的');
  lines.push('// 启发式实测 39 条里有 21 条与这里不符，其中 12 条把四级桌组合技判成了 3。');
  lines.push(`// 全库两卡组合技 ${stats.total} 条 → 命中范围 ${stats.inScope} 条 → 去重后收录 ${records.length} 条，涉及 ${cards.length} 张牌。`);
  lines.push('//');
  lines.push('// 档位取自 variant 的 bracketTag。它不是「这个组合技多强」，而是「含有它的牌组会被估到哪一档」，');
  lines.push('// 由 Spellbook 后端的 estimate_bracket 从速度、是否真两卡、产出是否致胜算出来。');
  lines.push('// 字母映射抄自它自己的模型定义（models/variant.py）：R=4 S=3 P=3 O=2 C=2 E=1，B 是禁牌。');
  lines.push('//');
  lines.push('// 存法：卡名去重存一份表，组合技只存 36 进制下标。三千条配对里卡名重复极多，');
  lines.push('// 直接存名字要 200KB 以上，存下标只要几十 KB——这一页的包体余量只有几百 KB。');
  lines.push('');
  lines.push('// 一行一张牌名');
  lines.push(`const SPELLBOOK_CARD_NAMES = ${quote(cards.join(NEWLINE))}.split(${quote(NEWLINE)});`);
  lines.push('');
  lines.push('// 每条记录 `左下标,右下标,档位,类别`，分号分隔');
  lines.push(`const SPELLBOOK_COMBO_ROWS = ${quote(records.join(';'))};`);
  lines.push('');
  lines.push('// 类别 → 中文说法。产出特性原本有 361 种，逐条翻译既维护不动也没必要：');
  lines.push('// 用户要知道的是「这套牌能干什么」，不是「无限魔法工艺触发」这个具体英文。');
  lines.push('const SPELLBOOK_CATEGORY_LABELS = {');
  categories.forEach(([key, , label]) => lines.push(`  ${key}: ${quote(label)},`));
  lines.push('};');
  lines.push('');
  lines.push('module.exports = {');
  lines.push('  SPELLBOOK_CARD_NAMES,');
  lines.push('  SPELLBOOK_COMBO_ROWS,');
  lines.push('  SPELLBOOK_CATEGORY_LABELS,');
  lines.push('};');
  lines.push('');
  return lines.join(NEWLINE);
}

async function main() {
  const { KNOWN_COMBOS } = require(path.join(ROOT, 'miniprogram', 'config', 'bracket-data.js'));
  const curated = new Set(KNOWN_COMBOS
    .filter((combo) => combo.cards.length === 2)
    .map((combo) => combo.cards.map(canonicalKey).sort().join('|')));
  console.log(`手工库已覆盖的两卡配对：${curated.size} 组`);

  const all = await pullAll();

  const cardIndex = new Map();
  const cards = [];
  const indexOf = (name) => {
    if (cardIndex.has(name)) return cardIndex.get(name);
    const position = cards.length;
    cards.push(name);
    cardIndex.set(name, position);
    return position;
  };

  const records = [];
  const seenPairs = new Set();
  let inScope = 0;
  let skippedCurated = 0;

  prioritizeVariants(all).forEach((variant) => {
    const bracket = TAG_TO_BRACKET[variant.bracketTag];
    if (!bracket) return; // 含禁牌（B）或标签缺失的一律不收
    const infinite = featureNames(variant).some((name) => /^Infinite/i.test(name));
    if (!infinite && bracket < 4) return;
    inScope += 1;

    const names = (variant.uses || []).map((use) => use.card && use.card.name).filter(Boolean);
    if (names.length !== 2) return;
    const pairKey = names.map(canonicalKey).sort().join('|');
    // 手工库覆盖的配对**也要收**。原先在这里排除掉，结果是手工库那套
    // 「早期→4，否则→2」的启发式说了算——实测 39 条里有 21 条与 Spellbook 不符，
    // 其中 12 条偏低（Food Chain、Kiki-Jiki、Splinter Twin、Worldgorger 这些
    // 明显的四级桌组合技全被判成 3）。档位交给它，手工库只保留中文与家族归并。
    if (curated.has(pairKey)) skippedCurated += 1;
    if (seenPairs.has(pairKey)) return; // 同一对牌可能有多条 variant，取档位最高的那条
    seenPairs.add(pairKey);

    const sorted = names.slice().sort();
    records.push([
      indexOf(sorted[0]).toString(36),
      indexOf(sorted[1]).toString(36),
      bracket,
      categoryOf(variant),
    ].join(','));
  });

  const source = render(cards, records, CATEGORIES, { total: all.length, inScope });
  fs.writeFileSync(OUT_FILE, source, 'utf8');

  console.log('');
  console.log(`全库两卡组合技 ${all.length} 条 → 命中收录范围 ${inScope} 条`);
  console.log(`  其中 ${skippedCurated} 条手工库也有（档位以这里为准，手工库保留中文与家族）`);
  console.log(`落表 ${records.length} 条，涉及 ${cards.length} 张牌`);
  console.log(`写入 ${path.relative(ROOT, OUT_FILE)}（${(Buffer.byteLength(source) / 1024).toFixed(1)}KB）`);

  // 自检：随机抽查若干条，确认能被索引反查出来
  delete require.cache[require.resolve(OUT_FILE)];
  const matcherPath = path.join(ROOT, 'miniprogram', 'utils', 'spellbook-combos.js');
  delete require.cache[require.resolve(matcherPath)];
  const generated = require(matcherPath);
  let checked = 0;
  let failed = 0;
  records.slice(0, 200).forEach((row) => {
    const parts = row.split(',');
    const pair = [cards[parseInt(parts[0], 36)], cards[parseInt(parts[1], 36)]];
    const deck = new Set(pair.map(canonicalKey));
    const hit = generated.matchSpellbookCombos(deck, canonicalKey);
    checked += 1;
    if (!hit.length || hit[0].cards.slice().sort().join('|') !== pair.slice().sort().join('|')) failed += 1;
  });
  console.log(`自检：抽 ${checked} 条反查，未命中 ${failed} 条`);
  if (failed) process.exit(1);
}

if (require.main === module) main().catch((error) => {
  console.error(`生成失败：${error.message}`);
  process.exit(1);
});

module.exports = { prioritizeVariants };
