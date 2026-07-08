const performanceConfig = {
  // auto / high / medium / low / off
  defaultMode: 'auto',

  tiers: {
    high: {
      count: 80,
      softEdge: true,
      blurScale: 1,
      composite: 'source-over',
    },
    medium: {
      count: 55,
      softEdge: true,
      blurScale: 0.55,
      composite: 'source-over',
    },
    low: {
      count: 30,
      softEdge: false,
      blurScale: 0,
      composite: 'source-over',
    },
  },

  fps: {
    downgradeBelow: 45,
    downgradeAfterMs: 1500,
    upgradeAbove: 55,
    upgradeAfterMs: 2500,
  },
};

module.exports = {
  performanceConfig,
};
