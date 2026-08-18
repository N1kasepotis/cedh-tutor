const { metaTierEntries } = require('../../config/meta-tier');
const {
  buildTierGroups,
  buildMetaSummary,
  findEntry,
} = require('../../utils/meta-tier');
const { enableShareMenu } = require('../../utils/share');
const { homePixelFontBase64 } = require('../../assets/home-pixel-font');

Page({
  data: {
    tierGroups: [],
    summary: null,
    detail: null,
    methodologyOpen: false,
  },

  onLoad() {
    enableShareMenu();
    // 首页那次 loadFontFace 是 global: false 的页级注册，本页拿不到，必须自己再注册一次。
    // 字体文件已在包内，重复注册不产生额外下载；失败则回退等宽栈，不遮挡首帧。
    if (typeof wx.loadFontFace === 'function') {
      wx.loadFontFace({
        family: 'HomePixel',
        source: `url("data:font/ttf;base64,${homePixelFontBase64}")`,
        global: false,
        scopes: ['webview'],
        success: () => {},
        fail: () => {},
      });
    }
    this.setData({
      tierGroups: buildTierGroups(metaTierEntries),
      summary: buildMetaSummary(),
    });
  },

  // 档位展开 / 收起。只翻 expanded，不重建 entries——重建会把整份列表再过一次桥。
  // 只改被点那一档的 expanded，用路径写法定点更新。
  // 整体替换 tierGroups 会让每个档位对象都换新身份，微信据此把所有 tier-block 重渲染一遍：
  // 其余档位的 <image> 全部卸载重挂，配合 lazy-load，重挂时已在视野内的图可能不再触发
  // 加载观察器——梯度表「有时候图完全显示不出来」就是这么来的，顺带每次展开还白白重下一遍。
  toggleTier(event) {
    const id = event.currentTarget.dataset.id;
    const index = this.data.tierGroups.findIndex((tier) => tier.id === id);
    if (index < 0) return;
    this.setData({
      [`tierGroups[${index}].expanded`]: !this.data.tierGroups[index].expanded,
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
