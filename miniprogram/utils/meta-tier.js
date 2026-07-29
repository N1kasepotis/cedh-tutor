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

function decorateEntry(entry) {
  return {
    ...entry,
    art: buildCommanderArt(entry.commanders),
    // 中英同名时不重复显示（源数据里不少条目 name_zh === name_en）
    showEnName: Boolean(entry.nameEn) && entry.nameEn !== entry.nameZh,
    commanderLine: (entry.commanders || [])
      .map((commander) => commander.cn || commander.en)
      .filter(Boolean)
      .join(' + '),
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
    .map((tier) => ({
      ...tier,
      rgb: hexToRgbTriplet(tier.color),
      entries: byTier.get(tier.id) || [],
    }))
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

function buildMetaSummary() {
  const publishedLabel = formatPublishedAt(metaTierConfig.publishedAt);
  const entryCount = (metaTierEntries || []).length;
  return {
    brand: metaTierConfig.brand,
    methodology: metaTierConfig.methodology,
    publicationTitle: metaTierConfig.publicationTitle,
    publicationId: metaTierConfig.publicationId,
    publishedLabel,
    entryCount,
    // 抬头只留一行事实：署名 + 条目数 + 日期。
    // 原先分了 kicker / 标题 / meta 三行，日期出现 3 次、署名出现 3 次（含页脚），
    // 而这是个「翻榜单」的页面——抬头越短，越早看到正文。
    factsLine: [
      `${metaTierConfig.brand} 编辑`,
      `${entryCount} 个原型`,
      publishedLabel,
    ].filter(Boolean).join(' · '),
  };
}

module.exports = {
  buildTierGroups,
  buildCommanderArt,
  decorateEntry,
  findEntry,
  tierOf,
  buildMetaSummary,
  formatPublishedAt,
  hexToRgbTriplet,
};
