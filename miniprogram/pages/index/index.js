const { enableShareMenu } = require('../../utils/share');
const { homePixelFontBase64 } = require('../../assets/home-pixel-font');
const { titleFontBase64 } = require('../../assets/title-font');

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

Page({
  data: {
    homeNavClearancePx: 96,
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

  showMetaComingSoon() {
    wx.showToast({
      title: '功能还在开发中，敬请期待！',
      icon: 'none',
      duration: 2400,
    });
  },
});
