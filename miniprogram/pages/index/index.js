const { enableShareMenu } = require('../../utils/share');
const { readStorage } = require('../../utils/storage');
const { META_TIER_VERSION } = require('../../config/meta-tier-version');
const { homePixelFontBase64 } = require('../../assets/home-pixel-font');
const { titleFontBase64 } = require('../../assets/title-font');

// NEW 角标绑定梯度快照版本，而不是「用户没点过就一直亮」：
// 永久常亮的角标是注意力税，会训练用户忽略所有角标；绑版本则每次梯度真更新时重新亮起，
// 角标从此有稳定含义——「有新一期梯度」，而不是「这个功能比较新」。
const META_SEEN_STORAGE_KEY = 'metaTierSeenVersion';

function getHomeNavClearancePx() {
  let windowInfo = {};

  try {
    windowInfo = typeof wx.getWindowInfo === 'function'
      ? wx.getWindowInfo()
      : wx.getSystemInfoSync();
  } catch (error) {
    windowInfo = {};
  }

  const statusBarHeight = Number(windowInfo.statusBarHeight) || 20;
  const windowHeight = Number(windowInfo.windowHeight) || 0;

  try {
    const menuRect = wx.getMenuButtonBoundingClientRect();
    const menuBottom = Number(menuRect && menuRect.bottom);
    const menuBottomIsPlausible = Number.isFinite(menuBottom)
      && menuBottom > statusBarHeight
      && (!windowHeight || menuBottom < windowHeight / 2);

    if (menuBottomIsPlausible) {
      return Math.ceil(menuBottom + 8);
    }
  } catch (error) {
    // A status-bar fallback keeps older base-library versions usable.
  }

  return Math.ceil(statusBarHeight + 56);
}

const HOME_ACTION_COUNT = 8;
// 审查黑条：每次进首页随机涂黑注释墙里的一整行——直接把那一行自己的文字盒染成实心黑，
// 因此黑条与文字天然等宽等高、必定盖住，不做任何像素定位（字体回退/屏高断点都不会错位）。
const REDACTION_LINE_COUNT = 9;

Page({
  data: {
    homeNavClearancePx: 96,
    // 事故色 glitch 行：每次进首页随机让一个功能入口"故障"成电光蓝，制造不可预测的粗野破坏感
    glitchIndex: 0,
    redactionLine: 3,
    metaIsNew: false,
  },

  onLoad() {
    enableShareMenu();
    this.setData({ homeNavClearancePx: getHomeNavClearancePx() });

    if (typeof wx.loadFontFace === 'function') {
      wx.loadFontFace({
        family: 'HomePixel',
        source: `url("data:font/ttf;base64,${homePixelFontBase64}")`,
        global: false,
        scopes: ['webview'],
        success: () => {},
        fail: () => {},
      });
      wx.loadFontFace({
        family: 'cEDHDisplay',
        source: `url("data:font/woff2;base64,${titleFontBase64}")`,
        global: false,
        scopes: ['webview'],
        success: () => {},
        fail: () => {},
      });
    }
  },

  // 在 onShow 而非 onLoad 判定：从环境梯度返回首页时角标要当场熄灭，
  // 不能等到下次冷启动才更新
  onShow() {
    const seen = readStorage(META_SEEN_STORAGE_KEY, {
      schemaVersion: 1,
      defaultValue: '',
      validate: (value) => typeof value === 'string',
    });
    this.setData({
      glitchIndex: Math.floor(Math.random() * HOME_ACTION_COUNT),
      redactionLine: Math.floor(Math.random() * REDACTION_LINE_COUNT),
      metaIsNew: seen.value !== META_TIER_VERSION,
    });
  },

  onShareAppMessage() {
    return {
      title: 'cEDH Tutor 竞技指挥官导师',
      path: '/pages/index/index',
    };
  },

  onShareTimeline() {
    return {
      title: 'cEDH Tutor 竞技指挥官导师',
    };
  },

  goQuiz() {
    wx.navigateTo({
      url: '/pages/quiz/quiz',
    });
  },

  goEdhti() {
    wx.navigateTo({
      url: '/pages/edhti/edhti',
    });
  },

  goTracker() {
    wx.navigateTo({
      url: '/pages/tracker/tracker',
    });
  },

  goRandom() {
    wx.navigateTo({
      url: '/pages/random/random',
    });
  },

  goLifeTracker() {
    wx.navigateTo({
      url: '/pages/life-tracker/life-tracker',
    });
  },

  goPlaytest() {
    wx.navigateTo({
      url: '/pages/playtest/playtest',
    });
  },

  goBracket() {
    wx.navigateTo({
      url: '/pages/bracket/bracket',
    });
  },

  goMeta() {
    wx.navigateTo({
      url: '/pages/meta/meta',
    });
  },
});
