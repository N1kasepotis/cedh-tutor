const { metaTierEntries } = require('../../config/meta-tier');
const {
  buildTierGroups,
  buildMetaSummary,
  findEntry,
} = require('../../utils/meta-tier');
const { enableShareMenu } = require('../../utils/share');
const { homePixelFontBase64 } = require('../../assets/home-pixel-font');
const monthly = require('../../utils/monthly-meta');
const monthlyLatest = require('../../utils/monthly-latest');

// 观察中有几百行，搜索会把它们展开过桥。等输入停一下再筛，别每敲一个字传一次。
const SEARCH_DELAY_MS = 150;

function copyLink(url, title) {
  wx.setClipboardData({
    data: url,
    success: () => wx.showToast({ title, icon: 'none' }),
    fail: () => wx.showToast({ title: '复制失败，请重试', icon: 'none' }),
  });
}

Page({
  data: {
    mode: 'monthly', monthSummary: null, monthGroups: [], monthPeriods: [], monthIndex: 0,
    monthLoading: false, monthError: '', monthOffline: false, monthDelayed: false, monthQuery: '', monthHighSample: false,
    monthOrder: 'score', monthColor: '', monthColorIndex: 0,
    monthColorLabels: ['全部颜色', '含白色', '含蓝色', '含黑色', '含红色', '含绿色'],
    monthMethodOpen: false, monthWatchOpen: false, monthlyDetail: null,
    tierGroups: [],
    summary: null,
    detail: null,
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
    const saved = monthly.cached();
    if (saved && saved.snapshot) this.applyMonthly(saved.snapshot, saved.periods || []);
    if (!monthly.isFresh(saved)) this.loadMonthly();
  },

  onUnload() { this.monthRequest = (this.monthRequest || 0) + 1; clearTimeout(this.monthSearchTimer); },
  onPullDownRefresh() { this.loadMonthly(this.monthSnapshot && this.monthSnapshot.period, true).finally(() => wx.stopPullDownRefresh({})); },
  selectMode(event) {
    const mode = event.currentTarget.dataset.mode;
    if (!['monthly', 'editorial'].includes(mode)) return;
    this.setData({ mode, detail: null, monthlyDetail: null });
  },
  applyMonthly(snapshot, periods) {
    this.monthSnapshot = snapshot;
    const options = [...new Set([snapshot.period, ...periods])].filter((period) => /^20\d{2}-(0[1-9]|1[0-2])$/.test(period)).sort().reverse();
    this.setData({ monthSummary: {
      period: snapshot.period, asOf: snapshot.asOf.slice(0, 10), events: snapshot.coverage.events,
      entries: snapshot.coverage.entries, coverage: snapshot.coverage.leaderCoverage,
      baselineWin: snapshot.baselines.win, baselineCut: snapshot.baselines.cut,
      excluded: Object.values(snapshot.coverage.excluded || {}).reduce((sum, value) => sum + value, 0),
      minEntries: snapshot.model.minEntries, minPilots: snapshot.model.minPilots, minEvents: snapshot.model.minEvents,
    }, monthPeriods: options, monthIndex: options.indexOf(snapshot.period), monthDelayed: monthly.isDelayed(options[0]) });
    this.filterMonthly();
  },
  async loadMonthly(period, force = false) {
    if (this.data.monthLoading && !force) return;
    const request = this.monthRequest = (this.monthRequest || 0) + 1;
    this.setData({ monthLoading: true, monthError: '', monthOffline: false });
    try {
      const result = await monthly.fetchMonthly(period);
      if (request !== this.monthRequest) return;
      this.applyMonthly(result.snapshot, result.periods || []);
      if (result.snapshot.period === result.latestPeriod) {
        monthly.cache(result);
        monthlyLatest.remember(result);
      }
    } catch (_) {
      if (request !== this.monthRequest) return;
      this.setData({ monthOffline: Boolean(this.monthSnapshot), monthError: this.monthSnapshot ? '暂未刷新，正在显示已保存的月报' : '月报暂时无法读取，请重试' });
    } finally { if (request === this.monthRequest) this.setData({ monthLoading: false }); }
  },
  retryMonthly() { this.loadMonthly(this.monthSnapshot && this.monthSnapshot.period); },
  changeMonth(event) { const period = this.data.monthPeriods[Number(event.detail.value)]; if (period) this.loadMonthly(period, true); },
  searchMonthly(event) {
    this.setData({ monthQuery: event.detail.value });
    clearTimeout(this.monthSearchTimer);
    this.monthSearchTimer = setTimeout(() => this.filterMonthly(), SEARCH_DELAY_MS);
  },
  toggleHighSample() { this.setData({ monthHighSample: !this.data.monthHighSample }); this.filterMonthly(); },
  changeMonthlyColor(event) {
    const index = Number(event.detail.value); if (!Number.isInteger(index) || index < 0 || index > 5) return;
    this.setData({ monthColorIndex: index, monthColor: ['', 'W', 'U', 'B', 'R', 'G'][index] }); this.filterMonthly();
  },
  selectMonthlyOrder(event) { const order = event.currentTarget.dataset.order; if (!['score', 'entries'].includes(order)) return; this.setData({ monthOrder: order }); this.filterMonthly(); },
  toggleMonthMethod() { this.setData({ monthMethodOpen: !this.data.monthMethodOpen }); },
  toggleMonthWatch() { this.setData({ monthWatchOpen: !this.data.monthWatchOpen }); this.filterMonthly(); },
  filterMonthly() {
    if (!this.monthSnapshot) return;
    this.setData({ monthGroups: monthly.groups(this.monthSnapshot, {
      query: this.data.monthQuery, highSample: this.data.monthHighSample, order: this.data.monthOrder,
      color: this.data.monthColor, expandedWatch: this.data.monthWatchOpen,
    }) });
  },
  openMonthlyDetail(event) {
    const row = this.monthSnapshot && this.monthSnapshot.entries.find((entry) => entry.id === event.currentTarget.dataset.id);
    if (!row) return;
    const sources = this.monthSnapshot.events.filter((source) => row.sourceEvents.includes(source.id));
    this.setData({ monthlyDetail: { ...monthly.decorate(row), sources } });
  },
  closeMonthlyDetail() { this.setData({ monthlyDetail: null }); },
  copyMonthlySource() { copyLink(monthly.SOURCE_URL, 'TopDeck 链接已复制'); },
  copyMonthlyEvent(event) { copyLink(monthly.eventUrl(event.currentTarget.dataset.id), '赛事链接已复制'); },

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
    if (this.data.mode === 'monthly') return { title: `${this.data.monthSummary ? this.data.monthSummary.period + ' ' : ''}cEDH 环境月报`, path: '/pages/meta/meta' };
    const summary = this.data.summary || {};
    return {
      title: summary.publicationTitle || '环境梯度｜cEDH 套牌梯度表',
      path: '/pages/meta/meta',
    };
  },

  onShareTimeline() {
    if (this.data.mode === 'monthly') return { title: `${this.data.monthSummary ? this.data.monthSummary.period + ' ' : ''}cEDH 环境月报` };
    return { title: (this.data.summary || {}).publicationTitle || '环境梯度｜cEDH 套牌梯度表' };
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
    // 失败要出声。这跟字体加载不是一回事：字体挂了会回退系统字体栈，用户照样能读；
    // 而这是用户主动点主将图要看大图，静默失败就是一次「按了没反应」的死点击，
    // 用户只会以为程序卡住。弱网下图还没下下来正是最容易命中的场景。
    wx.previewImage({
      urls: [url],
      current: url,
      fail: () => wx.showToast({ title: '图片打开失败，请稍后重试', icon: 'none' }),
    });
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
