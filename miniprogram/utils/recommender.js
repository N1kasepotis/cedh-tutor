const {
  buildPreferenceProfile,
  calculateColorMatchMultiplier,
  calculateCostTier,
  calculateScore,
} = require('./recommender/profile');
const {
  buildEffectiveMatchTags,
} = require('./recommender/tags');
const {
  calculateStatsMultiplier,
} = require('./recommender/stats');
const {
  calculateStatsAdjustedScore,
  formatFitScore,
  recommendCommanders,
} = require('./recommender/ranking');

module.exports = {
  buildPreferenceProfile,
  buildEffectiveMatchTags,
  calculateColorMatchMultiplier,
  calculateCostTier,
  calculateScore,
  calculateStatsAdjustedScore,
  calculateStatsMultiplier,
  formatFitScore,
  recommendCommanders,
};
