const {
  calculateColorMatchMultiplier,
  calculateScore,
} = require('./profile');
const { buildEffectiveMatchTags, isPartnerShell } = require('./tags');
const {
  calculateMetaStatusMultiplier,
  calculateSourceStatsMultiplier,
  calculateStatsMultiplier,
  getPlayRateSortValue,
  isLowPlayCommander,
  isLowPlayPartnerCommander,
  readNumber,
  readThreshold,
} = require('./stats');

function calculateStatsAdjustedScore(fitScore, statsMultiplier, config) {
  const influence = readThreshold(config && config.scoreInfluence, 1);
  const boundedInfluence = Math.max(0, Math.min(1, influence));
  const adjustment = 1 + (Number(statsMultiplier || 1) - 1) * boundedInfluence;
  return Math.round(Number(fitScore || 0) * adjustment * 100) / 100;
}

function hasTopPlayRate(commander, priorityConfig) {
  const stats = commander && commander.sourceStats || {};
  const entries = readNumber(stats.entries);
  const metaShare = readNumber(stats.metaShare);
  const minEntries = readThreshold(priorityConfig.minEntries, Infinity);
  const minMetaShare = readThreshold(priorityConfig.minMetaShare, Infinity);

  return (entries != null && entries >= minEntries)
    || (metaShare != null && metaShare >= minMetaShare);
}

function hasTopWinRate(commander, priorityConfig) {
  const stats = commander && commander.sourceStats || {};
  const winRate = readNumber(stats.conversionRate != null ? stats.conversionRate : stats.winRate);
  const minWinRate = readThreshold(priorityConfig.minWinRate, Infinity);

  return winRate != null && winRate >= minWinRate;
}

function calculateCompetitivePriorityMultiplier(profile, commander, config) {
  const priorityConfig = config && config.competitiveMetaPriority || {};
  if (!priorityConfig.enabled) return 1;

  const selectedPriority = priorityConfig.selectedPriority || 'competitive';
  if (!profile || profile.__selectedPriority !== selectedPriority) return 1;

  return hasTopPlayRate(commander, priorityConfig) && hasTopWinRate(commander, priorityConfig)
    ? Number(priorityConfig.multiplier || 1)
    : 1;
}

function calculatePreferencePenaltyMultiplier(profile, commander, config) {
  if (!profile || !config) return 1;

  const dislikesPartners = Number(profile.partnerAverse || 0) > 0;
  if (dislikesPartners && isPartnerShell(commander)) {
    const multiplier = Number(config.partnerDislikeMultiplier);
    return Number.isFinite(multiplier) ? Math.max(0, Math.min(1, multiplier)) : 1;
  }

  return 1;
}

function roundScore(score) {
  return Math.round(Number(score || 0) * 100) / 100;
}

function buildFitScoreCalibration(ranked, config, scoreKey) {
  const display = config && config.fitDisplay || {};
  const topPercentileAtNinety = readThreshold(display.topPercentileAtNinety, 0.1);
  const boundedPercentile = Math.max(0.01, Math.min(0.5, topPercentileAtNinety));
  const key = scoreKey || 'fitScore';
  const scores = (ranked || [])
    .map((commander) => Number(commander && commander[key] || 0))
    .filter((score) => score > 0)
    .sort((a, b) => b - a);

  const maxScore = scores[0] || 0;
  const thresholdIndex = Math.min(scores.length - 1, Math.max(0, Math.ceil(scores.length * boundedPercentile) - 1));
  const ninetyThreshold = scores[thresholdIndex] || maxScore;

  return {
    maxScore,
    ninetyThreshold,
    topBandExponent: readThreshold(display.topBandExponent, 1),
  };
}

function applyDiversitySlots(ranked, limit, config) {
  const diversity = config && config.diversity || {};
  if (!diversity.enabled || ranked.length <= 1) return ranked.slice(0, limit);

  const tailSlots = Math.max(0, Math.min(Number(diversity.tailSlots || 0), limit - 1));
  if (!tailSlots) return ranked.slice(0, limit);

  const topFitScore = Math.max(Number(ranked[0] && ranked[0].fitScore || 0), 0);
  const minFitScore = topFitScore * readThreshold(diversity.minFitRatio, 0.85);
  const regularCount = Math.max(1, limit - tailSlots);
  const selected = ranked.slice(0, regularCount);
  const selectedNames = new Set(selected.map((commander) => commander.name));
  const poolEnd = Math.max(regularCount, Number(diversity.candidatePool || 24));
  const candidatePool = ranked
    .slice(regularCount, poolEnd)
    .filter((commander) => !selectedNames.has(commander.name));

  const coldTail = candidatePool
    .filter((commander) => commander.fitScore >= minFitScore && isLowPlayCommander(commander, config))
    .sort((a, b) => {
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
      const partnerPenalty = readThreshold(config && config.lowPlayPartner && config.lowPlayPartner.diversityPriorityPenalty, 0);
      const aPartnerPenalty = isLowPlayPartnerCommander(a, config) ? partnerPenalty : 0;
      const bPartnerPenalty = isLowPlayPartnerCommander(b, config) ? partnerPenalty : 0;
      if (aPartnerPenalty !== bPartnerPenalty) return aPartnerPenalty - bPartnerPenalty;
      return getPlayRateSortValue(a) - getPlayRateSortValue(b);
    })
    .slice(0, tailSlots);

  coldTail.forEach((commander) => selectedNames.add(commander.name));

  const fill = ranked
    .filter((commander) => !selectedNames.has(commander.name))
    .slice(0, limit - selected.length - coldTail.length);

  return [...selected, ...coldTail, ...fill].slice(0, limit);
}

function formatFitScore(score, maxScore, calibration) {
  const safeMax = Math.max(Number(maxScore || 0), 0);
  const value = Math.max(Number(score || 0), 0);
  const threshold = Math.max(Number(calibration && calibration.ninetyThreshold || 0), 0);
  const topBandExponent = Math.max(1, readThreshold(calibration && calibration.topBandExponent, 1));
  let percent;

  if (safeMax <= 0) {
    percent = 0;
  } else if (threshold > 0 && threshold < safeMax) {
    if (value >= threshold) {
      const topBandRatio = (Math.min(value, safeMax) - threshold) / (safeMax - threshold);
      percent = 90 + Math.pow(topBandRatio, topBandExponent) * 10;
    } else {
      percent = (value / threshold) * 90;
    }
  } else {
    percent = (value / safeMax) * 100;
  }

  return `\u5951\u5408\u5ea6\uff1a${Math.round(Math.max(0, Math.min(100, percent)))}%`;
}

function recommendCommanders(profile, commanders, limit, dimensionLabels, costTierConfig, statsWeightConfig, matchingConfig) {
  const max = Math.max(1, Number(limit || 5));
  const ranked = (commanders || [])
    .map((commander) => {
      const baseScore = calculateScore(profile, buildEffectiveMatchTags(commander));
      const statsMultiplier = calculateStatsMultiplier(commander, statsWeightConfig);
      const sourceStatsMultiplier = calculateSourceStatsMultiplier(commander, statsWeightConfig);
      const metaStatusMultiplier = calculateMetaStatusMultiplier(commander, statsWeightConfig);
      const colorMultiplier = calculateColorMatchMultiplier(profile, commander, matchingConfig);
      const preferencePenaltyMultiplier = calculatePreferencePenaltyMultiplier(profile, commander, matchingConfig);
      const fitScore = Math.round(baseScore * colorMultiplier * 100) / 100;
      const baseAdjustedScore = calculateStatsAdjustedScore(fitScore, sourceStatsMultiplier, statsWeightConfig);
      const competitivePriorityMultiplier = calculateCompetitivePriorityMultiplier(profile, commander, statsWeightConfig);

      return {
        ...commander,
        baseScore,
        fitScore,
        statsMultiplier,
        sourceStatsMultiplier,
        metaStatusMultiplier,
        competitivePriorityMultiplier,
        colorMultiplier,
        preferencePenaltyMultiplier,
        score: roundScore(baseAdjustedScore * metaStatusMultiplier * competitivePriorityMultiplier * preferencePenaltyMultiplier),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
      return String(a.name).localeCompare(String(b.name));
    });

  const selected = applyDiversitySlots(ranked, max, statsWeightConfig);
  const topScore = selected.length ? Math.max(selected[0].score, 0) : 0;
  const calibration = buildFitScoreCalibration(ranked, statsWeightConfig, 'score');
  const labelMaxScore = Math.max(calibration.maxScore, topScore);

  return selected.map((commander) => ({
    ...commander,
    fitLabel: formatFitScore(commander.score, labelMaxScore, calibration),
  }));
}

module.exports = {
  applyDiversitySlots,
  buildFitScoreCalibration,
  calculateCompetitivePriorityMultiplier,
  calculatePreferencePenaltyMultiplier,
  calculateStatsAdjustedScore,
  formatFitScore,
  recommendCommanders,
};
