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
    distanceRpx: 300,
    maxLinksPerParticle: 4,
    maxLines: 96,
    lineWidthRpx: 1.35,
    opacity: {
      min: 0.06,
      max: 0.22,
    },
    tiers: {
      high: {
        enabled: true,
        distanceRpx: 320,
        maxLinksPerParticle: 4,
        maxLines: 104,
      },
      medium: {
        enabled: true,
        distanceRpx: 260,
        maxLinksPerParticle: 3,
        maxLines: 68,
      },
      low: {
        enabled: true,
        distanceRpx: 190,
        maxLinksPerParticle: 3,
        maxLines: 28,
      },
    },
  },

  flow: {
    minSpeedRpx: 0.28,
    maxSpeedRpx: 0.72,
    fieldScale: 0.007,
    timeScale: 0.00055,
    jitterRpx: 0.06,
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

  // 各功能页粒子随页面主题走：accent=模块主色、neutral=同族浅色、connection=连线色。
  // 页面 wxml 以 palette="名称" 指定；未指定或名称未收录时回退顶层香槟金默认。
  palettes: {
    'neon-arcade': { accentColor: '#FF7BC8', neutralColor: '#68C7FF', connectionColor: '#B9E8FF' },
    'noir-gold': { accentColor: '#E69B52', neutralColor: '#F5EAD1', connectionColor: '#F0BE8A' },
    tracker: { accentColor: '#CDB774', neutralColor: '#E6D8AD', connectionColor: '#D8C48E' },
    random: { accentColor: '#BE709E', neutralColor: '#E5BAD3', connectionColor: '#D094B8' },
    playtest: { accentColor: '#7E8DCD', neutralColor: '#C8D0EE', connectionColor: '#A3B0E0' },
    bracket: { accentColor: '#49B380', neutralColor: '#BDEBD2', connectionColor: '#7FCCA6' },
    cabbage: { accentColor: '#2FA75D', neutralColor: '#B2E3C4', connectionColor: '#5BBF6A' },
    izzet: { accentColor: '#5AA9FF', neutralColor: '#BCD9FF', connectionColor: '#8CC0FF' },
    // 环境梯度：取 T0 档位色 #EF5B4C 一族的红——背景与「最高档」同色系，
    // 页面强调色仍是中性石板灰，不与数据自带的档位色打架
    meta: { accentColor: '#EF5B4C', neutralColor: '#F5B3AC', connectionColor: '#E07A6E' },
  },

  bounds: {
    paddingRpx: 32,
  },
};

module.exports = {
  particleConfig,
};
