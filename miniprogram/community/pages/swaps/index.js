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
    busy: false,
    error: '',
    targets: [3, 5, 10],
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
      const decks = ui.decks();
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
          ? deck.matches.filter(
              (match) => !entry.baselineIds.includes(match.id),
            ).length
          : 0;
        return {
          ...entry,
          deckName: deck ? deck.name : '原套牌已删除',
          played,
          ready: played >= entry.target,
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
    this.setData({ picker: true });
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
      if (
        !deck ||
        !this.data.inCard ||
        !this.data.outCard ||
        !this.data.goal.trim()
      )
        throw new Error('请选择套牌、换入换出的牌，并写下目标');
      if (this.data.inCard.oracleId === this.data.outCard.oracleId)
        throw new Error('换牌记录需要两张不同的牌；更换卡画可在名片中操作');
      const entry = {
        id: local.id(),
        deckId: deck.id,
        inCard: this.data.inCard,
        outCard: this.data.outCard,
        goal: this.data.goal.trim(),
        target: this.data.targets[this.data.targetIndex],
        baselineIds: deck.matches.map((match) => match.id),
        createdAt: Date.now(),
        status: 'testing',
        review: '',
      };
      local.update((state) => {
        if (state.swaps.length >= 100)
          throw new Error('已保存 100 条换牌记录，请先删除不再需要的记录');
        state.swaps.unshift(entry);
      });
      this.setData({ inCard: null, outCard: null, goal: '' });
      this.reload();
      wx.showToast({ title: '开始观察', icon: 'success' });
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
      title: '删除换牌记录',
      content: '只删除这条备忘录，战绩保留。',
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
