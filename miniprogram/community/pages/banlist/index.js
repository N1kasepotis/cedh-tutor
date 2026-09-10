const { banlist } = require('../../shared/catalog');
Page({
  data: {
    banlist,
    query: '',
    cards: banlist.cards,
    selected: null,
    pollId: '',
    choices: [
      { id: 'keep', label: '维持禁用' },
      { id: 'unban', label: '支持解禁' },
      { id: 'unknown', label: '不了解' },
    ],
  },
  search(event) {
    const query = event.detail.value.toLowerCase().trim();
    this.setData({
      query,
      cards: banlist.cards.filter((card) =>
        card.name.toLowerCase().includes(query),
      ),
    });
  },
  select(event) {
    const selected = banlist.cards.find(
      (card) => card.id === event.currentTarget.dataset.id,
    );
    this.setData({
      selected,
      pollId: `${banlist.round}:${selected.id}`,
      choices: [
        {
          id: 'keep',
          label: selected.status === '禁用' ? '维持禁用' : '维持行侣禁令',
        },
        { id: 'unban', label: '支持解禁' },
        { id: 'unknown', label: '不了解' },
      ],
    });
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },
  close() {
    this.setData({ selected: null });
  },
  source() {
    wx.setClipboardData({
      data: (this.data.selected && this.data.selected.source) || banlist.source,
    });
  },
  onShareAppMessage() {
    return {
      title: 'Commander 禁牌观察',
      path: '/community/pages/banlist/index',
    };
  },
});
