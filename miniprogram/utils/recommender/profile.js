const COLOR_OPTION_TO_IDENTITY = {
  white: 'W',
  blue: 'U',
  black: 'B',
  red: 'R',
  green: 'G',
  colorless: 'C',
};

function addWeights(target, weights, scale) {
  const weightScale = Number.isFinite(Number(scale)) ? Number(scale) : 1;

  Object.keys(weights || {}).forEach((key) => {
    target[key] = (target[key] || 0) + Number(weights[key] || 0) * weightScale;
  });
}

function getMultiSelectScale(question, selectedIds, optionId) {
  const decay = Array.isArray(question && question.multiSelectDecay)
    ? question.multiSelectDecay
    : null;

  if (!decay || !Array.isArray(selectedIds) || selectedIds.length <= 1) return 1;

  const selectedIndex = selectedIds.indexOf(optionId);
  if (selectedIndex < 0) return 1;

  const scale = Number(decay[selectedIndex]);
  if (Number.isFinite(scale)) return scale;

  const fallbackScale = Number(decay[decay.length - 1]);
  return Number.isFinite(fallbackScale) ? fallbackScale : 1;
}

function buildPreferenceProfile(questions, answers) {
  const profile = {};

  (questions || []).forEach((question) => {
    const selected = answers && answers[question.id];
    const selectedIds = Array.isArray(selected) ? selected : [selected];

    if (question.id === 'colors') {
      profile.__selectedColors = selectedIds.filter((id) => id && id !== 'any');
    }

    if (question.id === 'priority') {
      profile.__selectedPriority = selectedIds[0];
    }

    (question.options || []).forEach((option) => {
      if (selectedIds.includes(option.id)) {
        addWeights(profile, option.weights, getMultiSelectScale(question, selectedIds, option.id));
      }
    });
  });

  return profile;
}

function calculateScore(profile, tags) {
  return Object.keys(profile || {}).reduce((sum, key) => {
    if (key.startsWith('__')) return sum;
    return sum + Number(profile[key] || 0) * Number((tags || {})[key] || 0);
  }, 0);
}

function getColorCount(colorIdentity) {
  if (!colorIdentity || colorIdentity === 'C') return 0;
  return new Set(String(colorIdentity).split('')).size;
}

function calculateCostTier(colorIdentity, config) {
  const count = getColorCount(colorIdentity);
  const rule = (config && config.rules || []).find((item) => count >= item.minColors && count <= item.maxColors);
  return rule ? rule.label : '\u4e2d';
}

function getCommanderColorOptions(colorIdentity) {
  if (!colorIdentity || colorIdentity === 'C') return ['colorless'];

  return Object.keys(COLOR_OPTION_TO_IDENTITY).filter((optionId) => {
    const identity = COLOR_OPTION_TO_IDENTITY[optionId];
    return identity !== 'C' && String(colorIdentity).includes(identity);
  });
}

function calculateColorMatchMultiplier(profile, commander, config) {
  const selectedColors = Array.isArray(profile && profile.__selectedColors)
    ? profile.__selectedColors
    : [];

  if (!selectedColors.length) return 1;

  const commanderColors = getCommanderColorOptions(commander && commander.colorIdentity);
  const hasOverlap = selectedColors.some((color) => commanderColors.includes(color));
  const unselectedColorCount = commanderColors.filter((color) => !selectedColors.includes(color)).length;
  const unselectedMultiplier = Number(config && config.unselectedColorMultiplier);
  const safeUnselectedMultiplier = Number.isFinite(unselectedMultiplier)
    ? Math.max(0, Math.min(1, unselectedMultiplier))
    : 1;

  if (hasOverlap) {
    return Math.pow(safeUnselectedMultiplier, unselectedColorCount);
  }

  const multiplier = Number(config && config.colorMismatchMultiplier);
  const mismatchMultiplier = Number.isFinite(multiplier) ? multiplier : 1;
  return mismatchMultiplier * Math.pow(safeUnselectedMultiplier, Math.max(0, unselectedColorCount - 1));
}

module.exports = {
  buildPreferenceProfile,
  calculateColorMatchMultiplier,
  calculateCostTier,
  calculateScore,
  getColorCount,
  getCommanderColorOptions,
};
