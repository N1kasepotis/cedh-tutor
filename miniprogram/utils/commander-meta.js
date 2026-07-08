// 指挥官 meta 标签推导：根据 edhtop16 统计与配置阈值给指挥官打
// competitive / fringe / irrelevant / outdated / fun 标签。
// 阈值配置见 config/recommendation-rules.js 的 metaTagConfig。

function hasAny(values, wanted) {
  const source = Array.isArray(values) ? values : [];
  return source.some((value) => wanted.includes(value));
}

function addMetaTag(tags, tag) {
  if (!tags.includes(tag)) tags.push(tag);
}

function readStat(commander, key) {
  const value = commander && commander.sourceStats && commander.sourceStats[key];
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function deriveCommanderMetaTags(commander, config) {
  const tags = [];
  const elements = Array.isArray(commander.deckElements) ? commander.deckElements : [];
  const archetypes = Array.isArray(commander.archetypeTags) ? commander.archetypeTags : [];
  const matchTags = commander.matchTags || {};
  const entries = readStat(commander, 'entries');
  const metaShare = readStat(commander, 'metaShare');
  const winRate = readStat(commander, 'winRate');

  if (commander.metaStatus === 'irrelevant' || elements.includes('irrelevant_meta')) {
    addMetaTag(tags, 'irrelevant');
  }

  if (commander.metaStatus === 'outdated' || elements.includes('outdated_meta') || config.outdated.names.includes(commander.name)) {
    addMetaTag(tags, 'outdated');
  }

  const competitive = config.competitive;
  if (
    entries >= competitive.minEntries
    || metaShare >= competitive.minMetaShare
    || elements.includes('top_play_count')
    || elements.includes('high_play_count')
    || (entries >= competitive.minWinRateSampleEntries && winRate >= competitive.minWinRateWithSample)
  ) {
    addMetaTag(tags, 'competitive');
  }

  const fringe = config.fringe;
  if (
    entries >= fringe.minEntries
    && entries <= fringe.maxEntries
    && metaShare <= fringe.maxMetaShare
    && winRate >= fringe.minWinRate
  ) {
    addMetaTag(tags, 'fringe');
  }

  const irrelevant = config.irrelevant;
  if (
    (entries <= irrelevant.maxEntries || metaShare <= irrelevant.maxMetaShare)
    && winRate <= irrelevant.maxWinRate
  ) {
    addMetaTag(tags, 'irrelevant');
  }

  if (
    Number(matchTags.fun || 0) > 0
    || hasAny(archetypes, config.fun.archetypes)
    || hasAny(elements, config.fun.deckElements)
  ) {
    addMetaTag(tags, 'fun');
  }

  return tags;
}

function applyCommanderMetaTags(commanders, config) {
  return commanders.map((commander) => ({
    ...commander,
    metaTags: deriveCommanderMetaTags(commander, config),
  }));
}

module.exports = {
  deriveCommanderMetaTags,
  applyCommanderMetaTags,
};
