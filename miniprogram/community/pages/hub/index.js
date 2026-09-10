const local = require('../../utils/local');
const ui = require('../../utils/page');
Page({
  data: {
    saved: 0,
    pending: 0,
    error: '',
    entries: [
      {
        id: 'passport',
        number: '01',
        title: '三张牌认识你',
        description: '做一张名片，也看看牌友的选择',
        tag: '表达',
      },
      {
        id: 'banlist',
        number: '02',
        title: '禁牌观察',
        description: '官方禁表与你对禁牌的看法',
        tag: '讨论',
      },
      {
        id: 'table',
        number: '03',
        title: '本桌怎么玩',
        description: '开局前，把期待说清楚',
        tag: '开局',
      },
      {
        id: 'swaps',
        number: '04',
        title: '换牌备忘录',
        description: '记录调整，跟踪实战，再做决定',
        tag: '调整',
      },
      {
        id: 'hands',
        number: '05',
        title: '这手留不留',
        description: '七张牌，两种思路',
        tag: '练习',
      },
    ],
  },
  onShow() {
    try {
      const state = local.load();
      this.setData({
        saved: Object.keys(state.passports).length,
        pending: state.swaps.filter((item) => item.status === 'testing').length,
      });
    } catch (error) {
      ui.error(this, error);
    }
  },
  open(event) {
    const id = event.currentTarget.dataset.id;
    if (this.data.entries.some((entry) => entry.id === id))
      wx.navigateTo({ url: `/community/pages/${id}/index` });
  },
  tracker() {
    wx.navigateTo({ url: '/pages/tracker/tracker' });
  },
  onShareAppMessage() {
    return {
      title: '牌友空间：分享你的三张牌',
      path: '/community/pages/hub/index',
    };
  },
});
