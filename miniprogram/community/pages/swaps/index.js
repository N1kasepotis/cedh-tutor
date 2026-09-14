const local = require('../../utils/local');
const ui = require('../../utils/page');
Page({
  data: {
    decks: [],
    deckIndex: 0,
    swaps: [],
    inCard: null,
    outCard: null,
    goal: '',
    review: '',
    editing: '',
    picker: false,
    cardTarget: '',
    busy: false,
    error: '',
    targets: [0, 3, 5, 10],
    targetLabels: ['随时复盘', '打 3 场后提醒', '打 5 场后提醒', '打 10 场后提醒'],
    targetIndex: 0,
  },
  onLoad(options) {
    this.initialDeck = options.deckId;
  },
  onShow() {
    this.reload();
  },
  reload() {
    try {
      const decks = [{ id: '', name: '不关联套牌', matches: [] }, ...ui.decks()];
      const index = this.initialDeck
        ? Math.max(
            0,
            decks.findIndex((deck) => deck.id === this.initialDeck),
          )
        : Math.min(this.data.deckIndex, Math.max(0, decks.length - 1));
      this.initialDeck = null;
      const state = local.load();
      const swaps = state.swaps.map((entry) => {
        const deck = decks.find((deck) => deck.id === entry.deckId);
        const played = deck
          ? deck.matches.filter((match) => !entry.baselineIds.includes(match.id)).length
          : 0;
        return {
          ...entry,
          deckName: deck ? deck.name : '原套牌已删除',
          played,
          ready: entry.target > 0 && played >= entry.target,
        };
      });
      this.setData({ decks, deckIndex: index, swaps });
    } catch (error) {
      ui.error(this, error);
    }
  },
  deck(event) {
    this.setData({ deckIndex: Number(event.detail.value) });
  },
  target(event) {
    this.setData({ targetIndex: Number(event.detail.value) });
  },
  goal(event) {
    this.setData({ goal: event.detail.value });
  },
  review(event) {
    this.setData({ review: event.detail.value });
  },
  choose(event) {
    this.cardTarget = event.currentTarget.dataset.target;
    // 换出与换入是两个问题：切换目标时选牌弹层从头搜索
    this.setData({ picker: true, cardTarget: this.cardTarget });
  },
  closePicker() {
    this.setData({ picker: false });
  },
  selected(event) {
    this.setData({ [this.cardTarget]: event.detail });
  },
  save() {
    try {
      const deck = this.data.decks[this.data.deckIndex];
      if (!deck || !this.data.inCard || !this.data.outCard)
        throw new Error('选好换入和换出的牌就能保存');
      if (this.data.inCard.printId === this.data.outCard.printId)
        throw new Error('换入和换出选了同一个版本');
      const entry = {
        id: local.id(),
        deckId: deck.id,
        inCard: this.data.inCard,
        outCard: this.data.outCard,
        goal: this.data.goal.trim(),
        target: deck.id ? this.data.targets[this.data.targetIndex] : 0,
        baselineIds: deck.matches.map((match) => match.id),
        createdAt: Date.now(),
        status: 'testing',
        review: '',
      };
      local.update((state) => {
        state.swaps.unshift(entry);
      });
      this.setData({ inCard: null, outCard: null, goal: '' });
      this.reload();
      wx.showToast({ title: '已记录', icon: 'success' });
    } catch (error) {
      ui.error(this, error);
    }
  },
  edit(event) {
    const entry = this.data.swaps.find(
      (item) => item.id === event.currentTarget.dataset.id,
    );
    this.setData({ editing: entry.id, review: entry.review });
  },
  finish(event) {
    const status = event.currentTarget.dataset.status;
    if (!['kept', 'reverted', 'testing'].includes(status)) return;
    try {
      local.update((state) => {
        const entry = state.swaps.find((item) => item.id === this.data.editing);
        if (!entry) throw new Error('记录已不存在');
        entry.review = this.data.review.trim();
        entry.status = status;
      });
      this.setData({ editing: '', review: '' });
      this.reload();
    } catch (error) {
      ui.error(this, error);
    }
  },
  remove(event) {
    const id = event.currentTarget.dataset.id;
    wx.showModal({
      title: '删除调牌记录',
      content: '删除这条调牌记录，保留战绩',
      success: (result) => {
        if (!result.confirm) return;
        try {
          local.update((state) => {
            state.swaps = state.swaps.filter((item) => item.id !== id);
          });
          this.reload();
        } catch (error) {
          ui.error(this, error);
        }
      },
    });
  },
  tracker() {
    wx.navigateTo({ url: '/pages/tracker/tracker' });
  },
});
