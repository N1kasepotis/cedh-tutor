const { enableShareMenu } = require('../../utils/share');
const { HOME_VORONOI_EDGES, HOME_VORONOI_NODES } = require('../../config/home-voronoi');
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
    // 背景 Voronoi 线场：构建期算好的静态几何，进页面推一次就不再动数据。
    // 动效全部交给 CSS transform，不走 setData——每帧过桥重算是移动端最贵的做法。
    fieldLines: HOME_VORONOI_EDGES.map((edge, index) => ({ ...edge, k: `l${index}` })),
    fieldNodes: HOME_VORONOI_NODES.map((node, index) => ({ ...node, k: `n${index}` })),
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

  onShow() {
    this.setData({
      glitchIndex: Math.floor(Math.random() * HOME_ACTION_COUNT),
      redactionLine: Math.floor(Math.random() * REDACTION_LINE_COUNT),
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
