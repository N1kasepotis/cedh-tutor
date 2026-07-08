const { enableShareMenu } = require('../../utils/share');
const { titleFontBase64 } = require('../../assets/title-font');

Page({
  data: {
    glassLayers: [1, 2, 3, 4, 5],
  },

  onLoad() {
    enableShareMenu();
    // 内嵌字体全平台统一标题渲染：不依赖各系统自带字体（iOS Avenir 压缩肥体 vs Android Roboto）。
    if (wx.loadFontFace) {
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
      title: 'cEDH Tutor · 竞技指挥官导师',
      path: '/pages/index/index',
    };
  },

  onShareTimeline() {
    return {
      title: 'cEDH Tutor · 竞技指挥官导师',
    };
  },

  getHomeParticles() {
    return this.selectComponent('#homeParticles');
  },

  handleHomeTouchStart(event) {
    const particles = this.getHomeParticles();
    if (particles) particles.setTouchFromEvent(event);
  },

  handleHomeTouchMove(event) {
    const particles = this.getHomeParticles();
    if (particles) particles.setTouchFromEvent(event);
  },

  handleHomeTouchEnd() {
    const particles = this.getHomeParticles();
    if (particles) particles.clearTouch();
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

  goPlaytest() {
    wx.navigateTo({
      url: '/pages/playtest/playtest',
    });
  },
});
