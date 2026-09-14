const { hands, handSources } = require('../../shared/catalog');
// 座次放在对局条件里，选择器只留序号和主将
const labels = hands.map((hand, index) => `${index + 1} / ${hands.length}　${hand.short}`);
Page({
  data: {
    labels,
    index: 0,
    hand: hands[0],
    source: handSources[hands[0].source],
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
    const hand = hands[index];
    this.setData({ index, hand, source: handSources[hand.source], revealed: false });
  },
  select(event) {
    this.selectIndex(Number(event.detail.value));
  },
  reveal() {
    this.setData({ revealed: true });
  },
  copySource() {
    wx.setClipboardData({ data: this.data.source.url });
  },
  onShareAppMessage() {
    const { hand } = this.data;
    return {
      title: `这手留不留：${hand.short}，${hand.seat} 号位`,
      path: `/community/pages/hands/index?id=${hand.id}`,
    };
  },
});
