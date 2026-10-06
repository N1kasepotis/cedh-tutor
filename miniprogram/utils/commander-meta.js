// competitive / fringe 是赛事统计启发式，outdated / irrelevant 是编辑标记，
// fun 描述构筑特点；这些标签均不表示经过校准的实战胜率。
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
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
    (entries != null && entries >= competitive.minEntries)
    || (metaShare != null && metaShare >= competitive.minMetaShare)
    || elements.includes('top_play_count')
    || elements.includes('high_play_count')
    || (entries != null && winRate != null && entries >= competitive.minWinRateSampleEntries && winRate >= competitive.minWinRateWithSample)
  ) {
    addMetaTag(tags, 'competitive');
  }

  const fringe = config.fringe;
  if (
    entries != null && metaShare != null && winRate != null
    && entries >= fringe.minEntries
    && entries <= fringe.maxEntries
    && metaShare <= fringe.maxMetaShare
    && winRate >= fringe.minWinRate
  ) {
    addMetaTag(tags, 'fringe');
  }

  // 少量参赛和低样本胜率只能说明观察不足，不能推断牌组没有竞技意义。
  // irrelevant 仅保留上面的显式编辑标记，不再由小样本自动生成。

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
  return commanders.map((commander) => {
    const stats = commander.sourceStats;
    const hasCounts = stats && Number.isSafeInteger(stats.entries) && stats.entries >= 0
      && Number.isSafeInteger(stats.topCuts) && stats.topCuts >= 0 && stats.topCuts <= stats.entries;
    const normalized = hasCounts ? {
      ...commander,
      sourceStats: { ...stats, conversionRate: stats.entries ? stats.topCuts / stats.entries : null },
    } : { ...commander, sourceStats: { ...(stats || {}), conversionRate: null } };
    return { ...normalized, metaTags: deriveCommanderMetaTags(normalized, config) };
  });
}

module.exports = {
  deriveCommanderMetaTags,
  applyCommanderMetaTags,
};
