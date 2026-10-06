const { isPartnerShell } = require('./tags');

function readNumber(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readThreshold(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getPlayRateStats(commander) {
  const stats = commander && commander.sourceStats || {};
  return {
    entries: readNumber(stats.entries),
    metaShare: readNumber(stats.metaShare),
  };
}

function isBelowPlayThreshold(play, entriesLimit, metaShareLimit) {
  return (play.entries != null && play.entries < entriesLimit)
    || (play.metaShare != null && play.metaShare < metaShareLimit);
}

function isLowPlayCommander(commander, config) {
  const diversity = config && config.diversity || {};
  const play = getPlayRateStats(commander);
  const entriesLimit = readThreshold(diversity.lowPlayEntriesBelow, 0);
  const metaShareLimit = readThreshold(diversity.lowPlayMetaShareBelow, 0);

  return isBelowPlayThreshold(play, entriesLimit, metaShareLimit);
}

function isLowPlayPartnerCommander(commander, config) {
  const partnerConfig = config && config.lowPlayPartner || {};
  if (!partnerConfig.enabled || !isPartnerShell(commander)) return false;

  const play = getPlayRateStats(commander);
  const diversity = config && config.diversity || {};
  const entriesLimit = readThreshold(
    partnerConfig.entriesBelow,
    readThreshold(diversity.lowPlayEntriesBelow, 0),
  );
  const metaShareLimit = readThreshold(
    partnerConfig.metaShareBelow,
    readThreshold(diversity.lowPlayMetaShareBelow, 0),
  );

  return isBelowPlayThreshold(play, entriesLimit, metaShareLimit);
}

function isSparsePartnerCommander(commander, config) {
  const partnerConfig = config && config.sparsePartner || {};
  if (!partnerConfig.enabled || !isPartnerShell(commander)) return false;

  const play = getPlayRateStats(commander);
  const entriesLimit = readThreshold(partnerConfig.entriesBelowOrEqual, 0);
  const metaShareLimit = readThreshold(partnerConfig.metaShareBelowOrEqual, 0);

  return (play.entries != null && play.entries <= entriesLimit)
    || (play.metaShare != null && play.metaShare <= metaShareLimit);
}

function isOutdatedCommander(commander, config) {
  const outdatedConfig = config && config.outdated || {};
  if (!outdatedConfig.enabled) return false;

  const elements = Array.isArray(commander && commander.deckElements)
    ? commander.deckElements
    : [];
  const metaTags = Array.isArray(commander && commander.metaTags)
    ? commander.metaTags
    : [];
  const outdatedElement = outdatedConfig.deckElement || 'outdated_meta';

  return (commander && commander.metaStatus === 'outdated')
    || elements.includes(outdatedElement)
    || metaTags.includes('outdated');
}

function isIrrelevantCommander(commander, config) {
  const irrelevantConfig = config && config.irrelevant || {};
  if (!irrelevantConfig.enabled) return false;

  const elements = Array.isArray(commander && commander.deckElements)
    ? commander.deckElements
    : [];
  const metaTags = Array.isArray(commander && commander.metaTags)
    ? commander.metaTags
    : [];
  const irrelevantElement = irrelevantConfig.deckElement || 'irrelevant_meta';
  if ((commander && commander.metaStatus === 'irrelevant') || elements.includes(irrelevantElement) || metaTags.includes('irrelevant')) {
    return true;
  }

  // 少量参赛记录只能说明当前样本少，不能推出构筑与环境无关。
  // 此状态仅接受显式编辑标记；使用率的启发式权重单独处理。
  return false;
}

function getPlayRateSortValue(commander) {
  const play = getPlayRateStats(commander);
  if (play.entries != null) return play.entries;
  if (play.metaShare != null) return play.metaShare * 100000;
  return Number.MAX_SAFE_INTEGER;
}

function clampMultiplier(multiplier, config) {
  const minMultiplier = Number(config && config.minMultiplier || 0);
  const maxMultiplier = readThreshold(config && config.maxMultiplier, 1);
  return Math.max(minMultiplier, Math.min(maxMultiplier, multiplier));
}

function calculateSourceStatsMultiplier(commander, config) {
  if (!config || config.enabled === false) return 1;

  const stats = commander && commander.sourceStats || {};
  // Tournament top-cut conversion and game win rate have different denominators.
  const conversionRate = readNumber(stats.conversionRate);
  const entries = readNumber(stats.entries);
  const metaShare = readNumber(stats.metaShare);
  const conversionConfig = config.conversionRate || {};
  const playConfig = config.playRate || {};
  let multiplier = 1;

  if (conversionRate != null && conversionRate < Number(conversionConfig.lowBelow || 0)) {
    multiplier *= Number(conversionConfig.lowMultiplier || 1);
  }

  // 超过配置阈值且参赛量达标时加权；不是统计显著性检验。
  const highAbove = readThreshold(conversionConfig.highAbove, Infinity);
  const highMinEntries = readThreshold(conversionConfig.highMinEntries, 0);
  if (
    conversionRate != null && conversionRate >= highAbove
    && entries != null && entries >= highMinEntries
  ) {
    multiplier *= Number(conversionConfig.highMultiplier || 1);
  }

  const isLowEntries = entries != null && entries < Number(playConfig.minEntries || 0);
  const isLowMetaShare = metaShare != null && metaShare < Number(playConfig.minMetaShare || 0);
  if (isLowEntries || isLowMetaShare) {
    multiplier *= Number(playConfig.lowMultiplier || 1);
  }

  const highEntries = readThreshold(playConfig.highEntries, Infinity);
  const highMetaShare = readThreshold(playConfig.highMetaShare, Infinity);
  const topEntries = readThreshold(playConfig.topEntries, Infinity);
  const topMetaShare = readThreshold(playConfig.topMetaShare, Infinity);
  const isTopPlay = (entries != null && entries >= topEntries) || (metaShare != null && metaShare >= topMetaShare);
  const isHighPlay = (entries != null && entries >= highEntries) || (metaShare != null && metaShare >= highMetaShare);

  if (isTopPlay) {
    multiplier *= Number(playConfig.topMultiplier || playConfig.highMultiplier || 1);
  } else if (isHighPlay) {
    multiplier *= Number(playConfig.highMultiplier || 1);
  }

  if (isLowPlayPartnerCommander(commander, config)) {
    const partnerConfig = config.lowPlayPartner || {};
    multiplier *= Number(partnerConfig.multiplier || 1);
  }

  if (isSparsePartnerCommander(commander, config)) {
    const partnerConfig = config.sparsePartner || {};
    multiplier *= Number(partnerConfig.multiplier || 1);
  }

  return clampMultiplier(multiplier, config);
}

function calculateMetaStatusMultiplier(commander, config) {
  if (!config || config.enabled === false) return 1;

  let multiplier = 1;

  if (isOutdatedCommander(commander, config)) {
    const outdatedConfig = config.outdated || {};
    multiplier *= Number(outdatedConfig.multiplier || 1);
  }

  if (isIrrelevantCommander(commander, config)) {
    const irrelevantConfig = config.irrelevant || {};
    multiplier *= Number(irrelevantConfig.multiplier || 1);
  }

  return multiplier;
}

function calculateStatsMultiplier(commander, config) {
  if (!config || config.enabled === false) return 1;

  return clampMultiplier(
    calculateSourceStatsMultiplier(commander, config) * calculateMetaStatusMultiplier(commander, config),
    config,
  );
}

module.exports = {
  calculateStatsMultiplier,
  calculateMetaStatusMultiplier,
  calculateSourceStatsMultiplier,
  getPlayRateSortValue,
  getPlayRateStats,
  isSparsePartnerCommander,
  isIrrelevantCommander,
  isLowPlayCommander,
  isLowPlayPartnerCommander,
  isOutdatedCommander,
  readNumber,
  readThreshold,
};
