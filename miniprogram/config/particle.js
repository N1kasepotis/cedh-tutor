const particleConfig = {
  defaultEnabled: true,
  paletteName: 'champagne-gold',
  accentColor: '#B78A61',
  neutralColor: '#E2D8C9',
  backgroundFallback: '#FFFFFF',

  radius: {
    minRpx: 1.5,
    maxRpx: 4.8,
  },

  opacity: {
    min: 0.14,
    max: 0.38,
  },

  softEdge: {
    blurMultiplier: 3.8,
    mediumBlurMultiplier: 1.8,
    shadowAlphaMultiplier: 0.72,
  },

  tone: {
    accentRatio: 0.58,
  },

  connections: {
    enabled: true,
    color: '#C2A36D',
    distanceRpx: 210,
    maxLinksPerParticle: 2,
    maxLines: 52,
    lineWidthRpx: 1.35,
    opacity: {
      min: 0.06,
      max: 0.22,
    },
    tiers: {
      high: {
        enabled: true,
        distanceRpx: 220,
        maxLines: 56,
      },
      medium: {
        enabled: true,
        distanceRpx: 178,
        maxLines: 34,
      },
      low: {
        enabled: true,
        distanceRpx: 138,
        maxLines: 12,
      },
    },
  },

  flow: {
    minSpeedRpx: 0.15,
    maxSpeedRpx: 0.4,
    fieldScale: 0.007,
    timeScale: 0.00035,
    jitterRpx: 0.035,
  },

  touch: {
    radiusRpx: 140,
    strengthRpx: 3.2,
    // 切向搅动：指尖周围尘埃轻微绕转，互动从「躲开手指」升级为「搅动星尘」（设 0 即纯排斥）
    swirlRpx: 1.6,
    maxDisplacementRpx: 7,
    releaseDamping: 0.93,
  },

  // 微弱明暗呼吸：尘埃像在光里明灭闪烁，静止场也有生命（各粒子按 seed 错相，慢周期）
  twinkle: {
    speedMs: 0.0016,
    amp: 0.16,
  },

  bounds: {
    paddingRpx: 32,
  },
};

module.exports = {
  particleConfig,
};
