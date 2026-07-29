const { metaTierEntries } = require('../../config/meta-tier');
const {
  buildTierGroups,
  buildMetaSummary,
  findEntry,
} = require('../../utils/meta-tier');
const { enableShareMenu } = require('../../utils/share');
const { writeStorage } = require('../../utils/storage');
const { META_TIER_VERSION } = require('../../config/meta-tier-version');

// 记下「这一期看过了」，首页的 NEW 角标据此熄灭；下一期梯度换了版本号会重新亮起
const META_SEEN_STORAGE_KEY = 'metaTierSeenVersion';

Page({
  data: {
    tierGroups: [],
    summary: null,
    detail: null,
    methodologyOpen: false,
  },

  onLoad() {
    enableShareMenu();
    this.setData({
      tierGroups: buildTierGroups(metaTierEntries),
      summary: buildMetaSummary(),
    });
    writeStorage(META_SEEN_STORAGE_KEY, META_TIER_VERSION, {
      schemaVersion: 1,
      validate: (value) => typeof value === 'string',
    });
  },

  onShareAppMessage() {
    const summary = this.data.summary || {};
    return {
      title: summary.publicationTitle || '环境梯度｜cEDH 套牌梯度表',
      path: '/pages/meta/meta',
    };
  },

  onShareTimeline() {
    return { title: (this.data.summary || {}).publicationTitle || '环境梯度｜cEDH 套牌梯度表' };
  },

  toggleMethodology() {
    this.setData({ methodologyOpen: !this.data.methodologyOpen });
  },

  openDetail(event) {
    const detail = findEntry(event.currentTarget.dataset.id);
    if (!detail) return;
    this.setData({ detail });
  },

  closeDetail() {
    this.setData({ detail: null });
  },

  // 吃掉详情面板内部的点击，避免冒泡到遮罩把面板关掉
  stopPropagation() {},

  previewCommander(event) {
    const url = event.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({ urls: [url], current: url, fail: () => {} });
  },

  // 个人主体不能用 web-view，打不开 topdeck.gg；沿用推荐结果页复制链接的既有做法
  copyDeckUrl() {
    const detail = this.data.detail;
    if (!detail || !detail.deckUrl) return;
    wx.setClipboardData({
      data: detail.deckUrl,
      success: () => wx.showToast({ title: '牌表链接已复制', icon: 'none' }),
      fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }),
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  },
});
