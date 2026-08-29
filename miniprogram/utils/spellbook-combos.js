// 在牌表里比对 Commander Spellbook 的两卡组合技。
//
// 数据在 config/spellbook-combos.js（构建期生成，纯数据），逻辑在这里（手写，不重新生成）。
// 分开是因为「生成代码的代码」是转义地狱，而且数据要跟着上游更新、逻辑不该跟着变。
//
// 为什么需要这一层：手工维护的 KNOWN_COMBOS 只有 42 条，牌表里绝大多数两卡组合技
// 根本认不出来。Spellbook 是社区维护的组合技库（EDHREC 的组合技页也用它），
// 全量两卡组合技约 4000 条，且**现有 39 条手工两卡条目它一条不落地全都有**。

const {
  SPELLBOOK_CARD_NAMES,
  SPELLBOOK_COMBO_ROWS,
  SPELLBOOK_CATEGORY_LABELS,
} = require('../config/spellbook-combos');

const DUAL_FACE_SEPARATOR = ' // ';

// 卡名键 → 该牌参与的组合技下标。只在第一次用到时建，且只建一次：
// 评估一副牌要查上百张，每次线性扫三千条配对是不能接受的。
let index = null;
let indexedWith = null;
let rows = null;

function comboRows() {
  if (!rows) rows = SPELLBOOK_COMBO_ROWS ? SPELLBOOK_COMBO_ROWS.split(';') : [];
  return rows;
}

// 双面牌两种写法都要能命中：Spellbook 与 Moxfield 都写全名 `A // B`，
// 但有的导出器只写正面名。只认一种就会漏掉那一半用户。
function nameVariants(name) {
  const cut = name.indexOf(DUAL_FACE_SEPARATOR);
  return cut > 0 ? [name, name.slice(0, cut)] : [name];
}

// 归一化规则由调用方注入，这里不自带一份。全项目只能有一条 canonicalCardKey——
// 两处各写一套迟早对不上，而对不上的表现是「组合技静默漏检」，恰恰是最难发现的那种。
function buildIndex(canonicalize) {
  if (index && indexedWith === canonicalize) return index;
  index = new Map();
  indexedWith = canonicalize;
  comboRows().forEach((row, position) => {
    const parts = row.split(',');
    [parseInt(parts[0], 36), parseInt(parts[1], 36)].forEach((cardIndex) => {
      const name = SPELLBOOK_CARD_NAMES[cardIndex];
      if (!name) return;
      nameVariants(name).forEach((variant) => {
        const key = canonicalize(variant);
        if (!key) return;
        const bucket = index.get(key);
        if (bucket) { if (bucket.indexOf(position) < 0) bucket.push(position); } else index.set(key, [position]);
      });
    });
  });
  return index;
}

function rowAt(position) {
  const parts = comboRows()[position].split(',');
  return {
    cards: [
      SPELLBOOK_CARD_NAMES[parseInt(parts[0], 36)],
      SPELLBOOK_CARD_NAMES[parseInt(parts[1], 36)],
    ],
    bracket: Number(parts[2]),
    category: parts[3],
    label: SPELLBOOK_CATEGORY_LABELS[parts[3]] || SPELLBOOK_CATEGORY_LABELS.other,
  };
}

// deckKeys：牌表全部卡名的归一化键集合。canonicalize：建这个集合时用的同一个归一化函数。
// 返回命中的两卡组合技，档位高的在前。
function matchSpellbookCombos(deckKeys, canonicalize) {
  if (!deckKeys || typeof deckKeys.has !== 'function') return [];
  if (typeof canonicalize !== 'function') return [];

  const table = buildIndex(canonicalize);
  const seen = new Set();
  const matches = [];
  const present = (name) => nameVariants(name).some((variant) => deckKeys.has(canonicalize(variant)));

  deckKeys.forEach((key) => {
    const bucket = table.get(key);
    if (!bucket) return;
    bucket.forEach((position) => {
      if (seen.has(position)) return;
      const row = rowAt(position);
      // 两张都在才算命中——这份库整份都是两卡组合技，不做部分匹配
      if (!row.cards.every(present)) return;
      seen.add(position);
      matches.push(row);
    });
  });

  // 档位高的排前面，同档位按卡名稳定排序：证据里只展示前几条，
  // 展示顺序不能随牌表的行序抖动
  matches.sort((a, b) => (b.bracket - a.bracket)
    || (a.cards[0] < b.cards[0] ? -1 : (a.cards[0] > b.cards[0] ? 1 : 0)));
  return matches;
}

// 查某一对牌在 Spellbook 眼里是几档；它不认识就返回 0。
// 手工库的两卡条目也走这条：它自己那套「早期→4，否则→2」的启发式实测
// 39 条里有 21 条与 Spellbook 不符，12 条把四级桌组合技判成了 3。
function spellbookBracketFor(cards, canonicalize) {
  if (!Array.isArray(cards) || cards.length !== 2) return 0;
  if (typeof canonicalize !== 'function') return 0;
  const table = buildIndex(canonicalize);
  const bucket = table.get(canonicalize(cards[0]));
  if (!bucket) return 0;
  const wanted = canonicalize(cards[1]);
  let best = 0;
  bucket.forEach((position) => {
    const row = rowAt(position);
    const matches = row.cards.some((name) => nameVariants(name)
      .some((variant) => canonicalize(variant) === wanted));
    if (matches && row.bracket > best) best = row.bracket;
  });
  return best;
}

function clearSpellbookIndex() {
  index = null;
  indexedWith = null;
  rows = null;
}

module.exports = {
  SPELLBOOK_CATEGORY_LABELS,
  matchSpellbookCombos,
  spellbookBracketFor,
  clearSpellbookIndex,
};
