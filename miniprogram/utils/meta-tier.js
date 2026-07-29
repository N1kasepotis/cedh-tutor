const { metaTierConfig, metaTierEntries } = require('../config/meta-tier');
const { buildScryfallImageUrlById } = require('./scryfall');

// 环境梯度是「浏览」功能，与强度分级完全解耦：
// 梯度表是 cEDH小屋署名的人工编辑判断，强度分级是本地确定性规则 + 可审计判定链。
// 把前者注入后者会毁掉判定链的可审计性，也会让同一副牌的档位随第三方编辑改动而变。
// 因此本模块只做展示派生，不导出任何可被 utils/bracket.js 使用的评分。

function formatPublishedAt(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : '';
}

// 单主将居中、双拍档左右分屏——沿用结算页与套牌试玩主将区的既有语汇
function buildCommanderArt(commanders) {
  const named = (commanders || []).filter((commander) => commander && commander.scryfallId).slice(0, 2);
  if (!named.length) return { mode: 'none', images: [] };
  return {
    mode: named.length === 2 ? 'dual' : 'single',
    images: named.map((commander) => ({
      cn: commander.cn || commander.en,
      en: commander.en,
      art: buildScryfallImageUrlById(commander.scryfallId, 'art_crop'),
      normal: buildScryfallImageUrlById(commander.scryfallId, 'normal'),
    })),
  };
}

// 双拍档的中文全名连起来能到 22 字，一行放不下就被截成「…艾普·奥尼尔 / 衡心…」，
// 断在词中间反而更难认。这里退回「只留专名」的短名。
//
// 短名无法从数据推导：中文卡名的修饰语与专名之间没有分隔符（织命使堤谟娜、
// 屈东英雄萨拉希洛斯），按字数切必然切错。因此人工维护下表——全部 56 条里只有
// 9 行超长、涉及 11 个名字，规模可控。新增长名未收录时走英文专名兜底，
// 至少不会断在词中间。
const COMMANDER_SHORT_NAMES = Object.freeze({
  '现场直击的艾普·奥尼尔': '奥尼尔',
  衡心定盘莱昂纳多: '莱昂纳多',
  乐天真心米开朗基罗: '米开朗基罗',
  屈东英雄萨拉希洛斯: '萨拉希洛斯',
  愚者末日泰维司刹特: '泰维司刹特',
  欧祝泰族龙语者依谢: '依谢',
  织命使堤谟娜: '堤谟娜',
  罗噶之子罗噶克: '罗噶克',
  致知专家赛拉司雷恩: '赛拉司雷恩',
  锐目领航员马科姆: '马科姆',
});

// 英文卡名的专名一律在首个逗号前，没有逗号则在 " the " 前——这条是可靠的
function englishProperNoun(nameEn) {
  return String(nameEn || '').split(',')[0].split(' the ')[0].trim();
}

function shortCommanderName(commander) {
  const cn = (commander && commander.cn) || '';
  if (COMMANDER_SHORT_NAMES[cn]) return COMMANDER_SHORT_NAMES[cn];
  if (cn) return cn;
  return englishProperNoun(commander && commander.en);
}

// 中文全名连起来超过这个字数就换短名。约等于列表行留给主将的可视宽度。
const COMMANDER_LINE_MAX = 16;

function buildCommanderLine(commanders) {
  const list = commanders || [];
  const full = list.map((commander) => commander.cn || commander.en).filter(Boolean);
  const joined = full.join(' + ');
  if (joined.length <= COMMANDER_LINE_MAX) return joined;
  return list.map(shortCommanderName).filter(Boolean).join(' + ');
}

function decorateEntry(entry) {
  return {
    ...entry,
    art: buildCommanderArt(entry.commanders),
    // 中英同名时不重复显示（源数据里不少条目 name_zh === name_en）
    showEnName: Boolean(entry.nameEn) && entry.nameEn !== entry.nameZh,
    commanderLine: buildCommanderLine(entry.commanders),
    hasDeckUrl: Boolean(entry.deckUrl),
  };
}

// 按档位分组；空档位不渲染，避免出现只有标题的空行
function buildTierGroups(entries) {
  const byTier = new Map();
  (entries || []).forEach((entry) => {
    if (!byTier.has(entry.tier)) byTier.set(entry.tier, []);
    byTier.get(entry.tier).push(decorateEntry(entry));
  });

  return metaTierConfig.tiers
    .map((tier) => {
      const entries = byTier.get(tier.id) || [];
      return {
        ...tier,
        rgb: hexToRgbTriplet(tier.color),
        entries,
        count: entries.length,
      };
    })
    .filter((tier) => tier.entries.length);
}

function hexToRgbTriplet(hex) {
  const match = String(hex || '').replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!match) return '140, 143, 148';
  const value = parseInt(match[1], 16);
  /* eslint-disable no-bitwise */
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
  /* eslint-enable no-bitwise */
}

function findEntry(entryId) {
  const entry = (metaTierEntries || []).find((item) => item.id === entryId);
  return entry ? decorateEntry(entry) : null;
}

function tierOf(entryId) {
  const entry = (metaTierEntries || []).find((item) => item.id === entryId);
  if (!entry) return null;
  return metaTierConfig.tiers.find((tier) => tier.id === entry.tier) || null;
}

// 展示标题：上游标题是「2026年7月cedh梯度表」，页面上改用季节说法。换期时改这里。
const DISPLAY_TITLE = '夏末梯度表';

function buildMetaSummary() {
  const publishedLabel = formatPublishedAt(metaTierConfig.publishedAt);
  return {
    brand: metaTierConfig.brand,
    title: DISPLAY_TITLE,
    publicationId: metaTierConfig.publicationId,
    publishedLabel,
    entryCount: (metaTierEntries || []).length,
    // 署名行只回答「谁 + 何时」。条目数移到各档位自己身上——
    // 分布本身就是信息（T0 只有 2 个、T3 有 22 个），放在总计里反而看不出来。
    // 不用 · 分隔：全页已去掉点号，靠空格与 tabular-nums 的数字形态区分即可。
    bylineLine: `${metaTierConfig.brand} 编辑　${publishedLabel}`,
  };
}

module.exports = {
  buildTierGroups,
  buildCommanderArt,
  buildCommanderLine,
  shortCommanderName,
  englishProperNoun,
  COMMANDER_LINE_MAX,
  decorateEntry,
  findEntry,
  tierOf,
  buildMetaSummary,
  formatPublishedAt,
  hexToRgbTriplet,
};
