const { buildScryfallImageUrl } = require('./scryfall');

const CANONICAL_PARTNER_DISPLAY_ORDER = [
  ['Tymna the Weaver', "Kraum, Ludevic's Opus"],
  ['Tymna the Weaver', 'Thrasios, Triton Hero'],
];

function commanderOrderKey(name) {
  return normalizeCommanderName(name).replace(/[^a-z0-9]/g, '');
}

function orderPartnerNames(parts) {
  if (!Array.isArray(parts) || parts.length !== 2) return parts;

  const byKey = new Map(parts.map((part) => [commanderOrderKey(part), part]));
  for (let i = 0; i < CANONICAL_PARTNER_DISPLAY_ORDER.length; i += 1) {
    const order = CANONICAL_PARTNER_DISPLAY_ORDER[i];
    const keys = order.map(commanderOrderKey);
    if (keys.every((key) => byKey.has(key))) {
      return keys.map((key) => byKey.get(key));
    }
  }

  return parts;
}

function splitCommanderNames(name) {
  const value = String(name || '').trim();
  if (!value) return [];

  // 单斜杠是本项目里双拍档的写法；双斜杠通常是单张双面牌名，应整体保留。
  if (value.indexOf(' / ') >= 0 && value.indexOf(' // ') < 0) {
    return orderPartnerNames(value.split(/\s+\/\s+/).map((item) => item.trim()).filter(Boolean));
  }

  return [value];
}

function isDoubleFacedName(name) {
  return String(name || '').indexOf(' // ') >= 0;
}

function isPartnerName(name) {
  const value = String(name || '');
  return value.indexOf(' / ') >= 0 && !isDoubleFacedName(value);
}

function shortenPartnerFaceName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex >= 0) return trimmed.slice(0, commaIndex).trim();

  // 部分拍档没有逗号分隔副称号；展示时保留可识别的主名字，避免长名挤压版面。
  const lower = trimmed.toLowerCase();
  const titleConnectors = [' the ', ' of '];
  for (let i = 0; i < titleConnectors.length; i += 1) {
    const connector = titleConnectors[i];
    const index = lower.indexOf(connector);
    if (index > 0) {
      return trimmed.slice(0, index).trim();
    }
  }

  return trimmed;
}

function formatCommanderDisplayName(name) {
  const value = String(name || '').trim();
  if (!value) return '';

  if (isPartnerName(value)) {
    return splitCommanderNames(value).map(shortenPartnerFaceName).join(' / ');
  }

  if (isDoubleFacedName(value)) {
    return value.split(/\s+\/\/\s+/)[0].trim();
  }

  return value;
}

function formatCommanderDisplayLines(name) {
  const value = String(name || '').trim();
  if (!value) return [];

  if (isPartnerName(value)) {
    return splitCommanderNames(value).map(shortenPartnerFaceName);
  }

  return [formatCommanderDisplayName(value)];
}

function normalizeCommanderName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function readNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseFitPercent(item) {
  if (item && Number.isFinite(Number(item.fitPercent))) return Number(item.fitPercent);

  const label = String((item && item.fitLabel) || '');
  const match = label.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (match) return Number(match[1]);

  return readNumber(item && (item.fitScore != null ? item.fitScore : item.score), 0);
}

function buildPreviewCards(commanderName) {
  // 预填直连图片 URL：卡图立即可显示，不依赖 API 请求成功；
  // 之后 loadPreviewImages 若成功，会升级为 CDN 正式地址。
  return splitCommanderNames(commanderName).map((name) => ({
    name,
    artCrop: buildScryfallImageUrl(name),
    normal: buildScryfallImageUrl(name, 'normal'),
    loading: true,
  }));
}

function decoratePreviewSlots(recommendation) {
  const displayLines = formatCommanderDisplayLines(recommendation.name);
  const previewCards = recommendation.previewCards && recommendation.previewCards.length
    ? recommendation.previewCards
    : buildPreviewCards(recommendation.name);
  const emptyPreview = {
    name: '',
    artCrop: '',
    normal: '',
    loading: false,
  };
  const leftPreview = previewCards[0] || emptyPreview;
  const rightPreview = previewCards.length > 1 ? previewCards[1] : emptyPreview;
  const singlePreview = previewCards.length > 1 ? emptyPreview : leftPreview;
  const isDualPreview = previewCards.length > 1;

  return {
    ...recommendation,
    displayName: displayLines.join(' / '),
    displayLines,
    previewCards,
    leftPreview,
    rightPreview,
    singlePreview,
    isDualPreview,
    isSinglePreview: !isDualPreview,
    previewMode: isDualPreview ? 'dual-preview' : 'single-preview',
  };
}

function isPartnerRecommendation(item) {
  const elements = Array.isArray(item && item.deckElements) ? item.deckElements : [];
  return elements.includes('partner_shell') || isPartnerName(item && item.name);
}

function hasCommanderOverlap(item, usedNames) {
  return splitCommanderNames(item.name)
    .map(normalizeCommanderName)
    .filter(Boolean)
    .some((name) => usedNames.has(name));
}

function markCommanderNames(item, usedNames) {
  splitCommanderNames(item.name)
    .map(normalizeCommanderName)
    .filter(Boolean)
    .forEach((name) => usedNames.add(name));
}

function sortRecommendationsForDisplay(recommendations, limit = 5) {
  const displayLimit = Math.max(1, Number(limit || 5));
  const maxPartnerDecks = 3;
  const sorted = (recommendations || [])
    .map((item, originalIndex) => ({
      ...item,
      originalIndex,
      fitPercent: parseFitPercent(item),
    }))
    .sort((a, b) => {
      if (b.fitPercent !== a.fitPercent) return b.fitPercent - a.fitPercent;
      if (readNumber(b.fitScore) !== readNumber(a.fitScore)) return readNumber(b.fitScore) - readNumber(a.fitScore);
      if (readNumber(b.score) !== readNumber(a.score)) return readNumber(b.score) - readNumber(a.score);
      return a.originalIndex - b.originalIndex;
    });

  const selected = [];
  const usedCommanderNames = new Set();
  let partnerDeckCount = 0;

  const canUsePartnerSlot = (item) => !isPartnerRecommendation(item) || partnerDeckCount < maxPartnerDecks;

  const pushSelected = (item) => {
    selected.push(item);
    if (isPartnerRecommendation(item)) partnerDeckCount += 1;
  };

  sorted.forEach((item) => {
    if (selected.length >= displayLimit) return;
    if (hasCommanderOverlap(item, usedCommanderNames)) return;
    if (!canUsePartnerSlot(item)) return;

    pushSelected(item);
    markCommanderNames(item, usedCommanderNames);
  });

  sorted.forEach((item) => {
    if (selected.length >= displayLimit) return;
    if (selected.some((selectedItem) => selectedItem.name === item.name)) return;
    if (!canUsePartnerSlot(item)) return;
    pushSelected(item);
  });

  sorted.forEach((item) => {
    if (selected.length >= displayLimit) return;
    if (selected.some((selectedItem) => selectedItem.name === item.name)) return;
    pushSelected(item);
  });

  return selected.slice(0, displayLimit).map((item, index) => decoratePreviewSlots({
    ...item,
    rank: index + 1,
    isTop: index === 0,
  }));
}

module.exports = {
  buildPreviewCards,
  decoratePreviewSlots,
  formatCommanderDisplayLines,
  formatCommanderDisplayName,
  isPartnerRecommendation,
  parseFitPercent,
  sortRecommendationsForDisplay,
  splitCommanderNames,
};
