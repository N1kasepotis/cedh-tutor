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
    // 优先用构建期烤进快照的 cards.scryfall.io 直链：梯度表一屏就有十几张图，
    // 按 ID 取图会打 api.scryfall.com/cards/<id>?format=image，那是 API 端点，
    // 每张图先查表再回 302 跳到 CDN，等于两次建连，全部叠在首屏上。
    // 快照是构建期产物，这步没有理由留到运行时——现在是零 API 请求、直连 CDN。
    // 回落保留：万一某条没烤上（构建时没网），仍按 ID 取图，不至于开天窗。
    images: named.map((commander) => ({
      cn: commander.cn || commander.en,
      en: commander.en,
      art: commander.art || buildScryfallImageUrlById(commander.scryfallId, 'art_crop'),
      normal: commander.normal || buildScryfallImageUrlById(commander.scryfallId, 'normal'),
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

// 列表行留给文字的宽度约 396rpx。中日文按 1 字≈1 字号估算，拉丁字母约 0.5 字号。
// 超出就先换短名（语义层面），仍超出再降字号（排版层面），两级都用完才算到头——
// 一律不换行、不省略号：断在词中间比小一号更难认。
const NAME_ZH_FIT = 14;
const NAME_EN_FIT = 38;

// 双拍档牌组名在源数据里是两个主将全名用 / 拼的。编辑自己在别处已经用
// 「罗噶克 + 萨拉希洛斯」这种短名写法，这里只是把漏写短名的那几条补齐成同一体例。
function shortenPartnerZh(nameZh) {
  const parts = String(nameZh || '').split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return nameZh;
  return parts.map((part) => COMMANDER_SHORT_NAMES[part] || part).join(' + ');
}

function shortenPartnerEn(nameEn) {
  const parts = String(nameEn || '').split('/').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return nameEn;
  return parts.map(englishProperNoun).filter(Boolean).join(' + ');
}

// 字号档位与「我的主将」页同一套做法：按字数挂类名，样式表里逐级降字号
function fitClass(length, compactAt, tightAt) {
  if (length > tightAt) return 'name-tight';
  if (length > compactAt) return 'name-compact';
  return '';
}

// 第二行的职责是「这到底是哪套牌」。通常是中文名对应的英文原名；
// 但牌组名本身就是英文原型代号时（Blue Farm 这类，name_zh 与 name_en 逐字相同），
// 显示英文原名等于把第一行重抄一遍，于是被 showEnName 抑制、整行只剩一个代号——
// 看不出是哪两位主将。这种情况改用主将英文名兜底。
function buildSecondaryName(entry) {
  if (entry.nameEn && entry.nameEn !== entry.nameZh) return entry.nameEn;
  return (entry.commanders || []).map((commander) => commander.en).filter(Boolean).join(' / ');
}

function decorateEntry(entry) {
  const nameZh = entry.nameZh && entry.nameZh.length > NAME_ZH_FIT
    ? shortenPartnerZh(entry.nameZh)
    : entry.nameZh;
  const secondary = buildSecondaryName(entry);
  const nameEn = secondary.length > NAME_EN_FIT
    ? shortenPartnerEn(secondary)
    : secondary;

  return {
    ...entry,
    art: buildCommanderArt(entry.commanders),
    displayNameZh: nameZh,
    displayNameEn: nameEn,
    // 中英同名时不重复显示（源数据里不少条目 name_zh === name_en）
    showEnName: Boolean(nameEn) && nameEn !== nameZh,
    nameZhClass: fitClass(String(nameZh || '').length, NAME_ZH_FIT, NAME_ZH_FIT + 3),
    nameEnClass: fitClass(String(nameEn || '').length, 26, 34),
    hasDeckUrl: Boolean(entry.deckUrl),
  };
}

// 列表投影：只带列表真正渲染的字段。
//
// setData 是小程序里唯一的跨线程通道，推过去的每个字节都要序列化。此前列表直接推
// decorateEntry 的完整结果（内含 summary / winConditions / strengths / weaknesses /
// analysis / commanders / deckUrl），56 行合计 67KB，其中 34.7KB 列表一个字都不渲染。
// 详情面板本来就走 findEntry(id) 从 metaTierEntries 重新取完整条目，列表里那份副本
// 从来没有被任何代码读过——纯粹是过桥运费。
//
// 卡图同理：列表只用 art（art_crop），normal 与 cn 是详情面板放大用的，不必随列表过桥。
function toListItem(entry) {
  const full = decorateEntry(entry);
  return {
    id: full.id,
    tags: full.tags,
    displayNameZh: full.displayNameZh,
    displayNameEn: full.displayNameEn,
    showEnName: full.showEnName,
    nameZhClass: full.nameZhClass,
    nameEnClass: full.nameEnClass,
    art: {
      mode: full.art.mode,
      images: full.art.images.map((image) => ({ en: image.en, art: image.art })),
    },
  };
}

// 按档位分组；空档位不渲染，避免出现只有标题的空行
function buildTierGroups(entries) {
  const byTier = new Map();
  (entries || []).forEach((entry) => {
    if (!byTier.has(entry.tier)) byTier.set(entry.tier, []);
    byTier.get(entry.tier).push(toListItem(entry));
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

// 详情面板里没有任何档位分组做参照，若再用页面那个中性石板灰做强调色，
// 整个小窗就一点彩度都没有。把该牌组所属档位的颜色带进去：既补上彩度，
// 也让人一眼知道「这是从哪一档点进来的」。
function findEntry(entryId) {
  const entry = (metaTierEntries || []).find((item) => item.id === entryId);
  if (!entry) return null;
  const tier = tierOf(entryId);
  return {
    ...decorateEntry(entry),
    tierLabel: tier ? tier.label : '',
    tierRgb: tier ? hexToRgbTriplet(tier.color) : hexToRgbTriplet(''),
  };
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
    bylineLine: `${metaTierConfig.brand}　${publishedLabel}`,
  };
}

module.exports = {
  buildTierGroups,
  toListItem,
  buildCommanderArt,
  shortenPartnerZh,
  shortenPartnerEn,
  buildSecondaryName,
  shortCommanderName,
  englishProperNoun,
  fitClass,
  NAME_ZH_FIT,
  NAME_EN_FIT,
  decorateEntry,
  findEntry,
  tierOf,
  buildMetaSummary,
  formatPublishedAt,
  hexToRgbTriplet,
};
