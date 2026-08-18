const { enableShareMenu } = require('../../utils/share');
const { HOME_VORONOI_EDGES } = require('../../config/home-voronoi');
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

// MTGso 小程序。AppID 与默认路径取自其官方跳转页 https://www.mtgso.cn/to-miniprogram.html
// （那一页本身走的是 weixin://dl/business/ URL Scheme，只适用于外部浏览器唤起；
// 小程序内部要用 wx.navigateToMiniProgram，两者不通用，能复用的只有这两个值。）
const MTGSO_APPID = 'wx5df3db45daa5d9c0';
const MTGSO_PATH = 'pages/index/index';

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
    // 整页背景 Voronoi 线场：构建期算好的静态几何，进页面推一次就不再动数据。
    // 动效全部交给 CSS transform，不走 setData——每帧过桥重算是移动端最贵的做法。
    fieldLines: HOME_VORONOI_EDGES.map((edge, index) => ({ ...edge, k: `l${index}` })),
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

  // 外跳 MTGso。微信自己会在跳转前弹确认框（基础库 2.3.0 起统一行为），
  // 所以这里不再自建二次确认，重复问一遍只会更烦。
  // fail 必须写：用户在那个确认框上点「取消」也会走 fail，
  // 不接住就是一个没人处理的 Promise 拒绝——本项目已经为同类问题踩过一次坑。
  goMtgso() {
    wx.navigateToMiniProgram({
      appId: MTGSO_APPID,
      path: MTGSO_PATH,
      fail: () => {},
    });
  },
});
