const { hands } = require('../../shared/catalog');
Page({
  data: {
    questions: hands,
    index: 0,
    hand: hands[0],
    revealed: false,
    choices: [
      { id: 'keep', label: '保留' },
      { id: 'mull', label: '调度' },
      { id: 'unknown', label: '还没想好' },
    ],
  },
  onLoad(options) {
    const index = hands.findIndex((hand) => hand.id === options.id);
    if (index >= 0) this.selectIndex(index);
  },
  selectIndex(index) {
    this.setData({ index, hand: hands[index], revealed: false });
  },
  select(event) {
    this.selectIndex(Number(event.detail.value));
  },
  reveal() {
    this.setData({ revealed: true });
  },
  practice() {
    wx.navigateTo({ url: '/pages/playtest/playtest' });
  },
  onShareAppMessage() {
    return {
      title: `这手留不留：${this.data.hand.title}`,
      path: `/community/pages/hands/index?id=${this.data.hand.id}`,
    };
  },
});
