const { hands, handSources } = require('../../shared/catalog');
const cardIndex = require('../../shared/hand-cards');
// 座次放在对局条件里，选择器只留序号和主将
const labels = hands.map((hand, index) => `${index + 1} / ${hands.length}　${hand.short}`);
// 与套牌试玩的手牌区一样用 small 图做瓦片，点开看 normal 大图；卡图直链随包提供，不发请求
function tiles(hand) {
  return hand.cards.map((name) => ({
    name,
    thumb: (cardIndex[name] && cardIndex[name].thumb) || '',
    image: (cardIndex[name] && cardIndex[name].image) || '',
  }));
}
Page({
  data: {
    labels,
    index: 0,
    hand: hands[0],
    cards: tiles(hands[0]),
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
    this.setData({
      index,
      hand,
      cards: tiles(hand),
      source: handSources[hand.source],
      revealed: false,
    });
  },
  select(event) {
    this.selectIndex(Number(event.detail.value));
  },
  previewCard(event) {
    const current = this.data.cards[Number(event.currentTarget.dataset.index)];
    if (!current || !current.image) return;
    wx.previewImage({
      current: current.image,
      urls: this.data.cards.map((card) => card.image).filter(Boolean),
    });
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
