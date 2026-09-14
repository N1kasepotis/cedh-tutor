const local = require('../../utils/local');
const ui = require('../../utils/page');
const cardIndex = require('../../shared/ban-cards');
const coverCards = ['ancestral-recall', 'black-lotus', 'time-walk'].map(
  (id) => cardIndex[id],
);
Page({
  data: {
    coverCards,
    pending: 0,
    error: '',
    entries: [
      {
        id: 'banlist',
        title: '禁牌表',
        description: '卡图与解禁投票',
        tag: '讨论',
      },
      {
        id: 'table',
        title: '对局约定',
        description: '聊好这桌怎么玩',
        tag: '条约',
      },
      {
        id: 'swaps',
        title: '调牌记录',
        description: '记下换牌与实战感受',
        tag: '调整',
      },
      {
        id: 'hands',
        title: '这手留不留',
        description: '社区讨论过的真实起手',
        tag: '练习',
      },
    ],
  },
  onShow() {
    try {
      const state = local.load();
      const profile = local.playerPassport(state);
      this.setData({
        coverCards:
          profile &&
          profile.slots.every((slot) => slot && slot.image)
            ? profile.slots
            : coverCards,
        pending: state.swaps.filter((item) => item.status === 'testing').length,
      });
    } catch (error) {
      ui.error(this, error);
    }
  },
  open(event) {
    const id = event.currentTarget.dataset.id;
    if (id === 'passport' || this.data.entries.some((entry) => entry.id === id))
      wx.navigateTo({ url: `/community/pages/${id}/index` });
  },
  onShareAppMessage() {
    return {
      title: 'EDH 牌桌：分享你的三张牌',
      path: '/community/pages/hub/index',
    };
  },
});
