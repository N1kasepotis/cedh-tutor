const { commanders } = require('../../config/commanders');
const { trackerConfig } = require('../../config/tracker');
const {
  RESULT_LABELS,
  buildSeatWinRateSeries,
  buildTrackerExportText,
  buildWinRateSeries,
  calculateDeckStats,
  createEmptyDeck,
  filterCommanders,
  normalizeTrackerData,
  serializeTrackerData,
  sortMatches,
  todayString,
} = require('../../utils/tracker');
const { paintChart } = require('../../utils/tracker-charts');
const { formatCommanderDisplayLines } = require('../../utils/result-display');
const { enableShareMenu } = require('../../utils/share');

function getCanvasRequestFrame(canvas) {
  return canvas && canvas.requestAnimationFrame
    ? canvas.requestAnimationFrame.bind(canvas)
    : (callback) => setTimeout(callback, 16);
}

Page({
  data: {
    decks: [],
    resultOptions: trackerConfig.resultOptions,
    seatOptions: trackerConfig.seatOptions,
    maxDecks: trackerConfig.maxDecks,
    canAddDeck: true,
  },

  onLoad() {
    enableShareMenu();
    this.loadTrackerData();
  },

  onReady() {
    this.drawAllChartsSoon();
  },

  onShareAppMessage() {
    return {
      title: '记录你的主将战绩：胜率与座位曲线',
      path: '/pages/tracker/tracker',
    };
  },

  onShareTimeline() {
    return { title: '记录你的主将战绩：胜率与座位曲线' };
  },

  loadTrackerData() {
    let raw;
    try {
      raw = wx.getStorageSync(trackerConfig.storageKey);
    } catch (e) {
      raw = null;
    }
    const data = normalizeTrackerData(raw, commanders, trackerConfig);
    this.applyDecks(data.decks, false);
  },

  decorateDecks(decks) {
    return decks.map((deck, index) => {
      const stats = calculateDeckStats(deck, trackerConfig.stats);
      const displayLines = deck.commander
        ? formatCommanderDisplayLines(deck.commander.name)
        : [`第 ${index + 1} 套牌`];
      const matches = sortMatches(deck.matches).map((match) => ({
        ...match,
        label: RESULT_LABELS[match.result],
        seatClass: match.seat || 'seat-unknown',
      }));

      return {
        ...deck,
        matches,
        stats,
        query: deck.query || (deck.commander && deck.commander.name) || '',
        displayName: displayLines.join(' '),
        displayLines,
        pendingDate: deck.pendingDate || todayString(),
        pendingResult: deck.pendingResult || 'win',
        pendingSeat: deck.pendingSeat || 'seat1',
        suggestions: deck.suggestions || [],
        showSuggestions: Boolean(deck.showSuggestions && deck.suggestions && deck.suggestions.length),
      };
    });
  },

  applyDecks(decks, shouldPersist = true) {
    const normalizedDecks = decks.length ? decks : [createEmptyDeck(0)];
    const decorated = this.decorateDecks(normalizedDecks);

    if (shouldPersist) {
      wx.setStorageSync(trackerConfig.storageKey, serializeTrackerData({
        version: trackerConfig.version,
        decks: decorated,
      }));
    }

    this.setData({
      decks: decorated,
      canAddDeck: decorated.length < trackerConfig.maxDecks,
    }, () => this.drawAllChartsSoon());
  },

  drawAllChartsSoon() {
    const requestFrame = getCanvasRequestFrame(this.canvas);
    requestFrame(() => this.drawAllCharts());
  },

  handleCommanderInput(event) {
    const deckId = event.currentTarget.dataset.id;
    const query = event.detail.value;
    const decks = this.data.decks.map((deck) => {
      if (deck.id !== deckId) return deck;

      return {
        ...deck,
        query,
        commander: query ? deck.commander : null,
        suggestions: filterCommanders(commanders, query, trackerConfig.suggestionLimit),
        showSuggestions: true,
      };
    });

    this.applyDecks(decks, false);
  },

  focusCommanderInput(event) {
    const deckId = event.currentTarget.dataset.id;
    const decks = this.data.decks.map((deck) => {
      if (deck.id !== deckId) return deck;

      return {
        ...deck,
        suggestions: filterCommanders(commanders, deck.query, trackerConfig.suggestionLimit),
        showSuggestions: true,
      };
    });

    this.applyDecks(decks, false);
  },

  selectCommander(event) {
    const deckId = event.currentTarget.dataset.deckId;
    const name = event.currentTarget.dataset.name;
    const selected = commanders.find((commander) => commander.name === name);
    if (!selected) return;

    const commander = {
      name: selected.name,
      colorIdentity: selected.colorIdentity,
      edhtop16Url: selected.edhtop16Url,
    };
    const decks = this.data.decks.map((deck) => (
      deck.id === deckId
        ? {
          ...deck,
          commander,
          query: commander.name,
          suggestions: [],
          showSuggestions: false,
        }
        : deck
    ));

    this.applyDecks(decks);
  },

  addDeck() {
    if (this.data.decks.length >= trackerConfig.maxDecks) {
      wx.showToast({ title: '最多记录 5 套牌', icon: 'none' });
      return;
    }

    this.applyDecks([
      ...this.data.decks,
      createEmptyDeck(this.data.decks.length),
    ]);
  },

  deleteDeck(event) {
    const deckId = event.currentTarget.dataset.id;

    wx.showModal({
      title: '删除套牌',
      content: '会删除该主将的全部对局记录',
      confirmText: '删除套牌',
      success: (result) => {
        if (!result.confirm) return;
        const decks = this.data.decks.filter((deck) => deck.id !== deckId);
        this.applyDecks(decks.length ? decks : [createEmptyDeck(0)]);
      },
    });
  },

  changePendingDate(event) {
    const deckId = event.currentTarget.dataset.id;
    const date = event.detail.value || todayString();
    const decks = this.data.decks.map((deck) => (
      deck.id === deckId ? { ...deck, pendingDate: date } : deck
    ));

    this.applyDecks(decks, false);
  },

  selectPendingResult(event) {
    const deckId = event.currentTarget.dataset.id;
    const result = event.currentTarget.dataset.result;
    if (!RESULT_LABELS[result]) return;

    const decks = this.data.decks.map((deck) => (
      deck.id === deckId ? { ...deck, pendingResult: result } : deck
    ));

    this.applyDecks(decks, false);
  },

  selectPendingSeat(event) {
    const deckId = event.currentTarget.dataset.id;
    const seat = event.currentTarget.dataset.seat;
    const isValidSeat = trackerConfig.seatOptions.some((option) => option.id === seat);
    if (!isValidSeat) return;

    const decks = this.data.decks.map((deck) => (
      deck.id === deckId ? { ...deck, pendingSeat: seat } : deck
    ));

    this.applyDecks(decks, false);
  },

  addMatch(event) {
    const deckId = event.currentTarget.dataset.id;

    const decks = this.data.decks.map((deck) => {
      if (deck.id !== deckId) return deck;
      const result = RESULT_LABELS[deck.pendingResult] ? deck.pendingResult : 'win';
      const seat = trackerConfig.seatOptions.some((option) => option.id === deck.pendingSeat)
        ? deck.pendingSeat
        : 'seat1';

      return {
        ...deck,
        matches: sortMatches([
          ...deck.matches,
          {
            id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            date: deck.pendingDate || todayString(),
            result,
            seat,
          },
        ]),
      };
    });

    this.applyDecks(decks);
  },

  confirmDeleteMatch(event) {
    const deckId = event.currentTarget.dataset.deckId;
    const matchId = event.currentTarget.dataset.matchId;
    if (!deckId || !matchId) return;

    wx.showModal({
      title: '取消对局',
      content: '确定删除这条对局记录？',
      confirmText: '删除对局',
      success: (result) => {
        if (!result.confirm) return;
        this.removeMatch(deckId, matchId);
      },
    });
  },

  removeMatch(deckId, matchId) {
    const decks = this.data.decks.map((deck) => (
      deck.id === deckId
        ? { ...deck, matches: deck.matches.filter((match) => match.id !== matchId) }
        : deck
    ));

    this.applyDecks(decks);
  },

  exportData() {
    const data = buildTrackerExportText({
      version: trackerConfig.version,
      decks: this.data.decks,
    }, trackerConfig.stats);

    wx.setClipboardData({
      data,
      success() {
        wx.showToast({ title: trackerConfig.export.clipboardLabel, icon: 'none' });
      },
    });
  },

  clearData() {
    wx.showModal({
      title: '清空战绩',
      content: '会删除本机保存的所有指挥官战绩',
      confirmText: '清空',
      success: (result) => {
        if (!result.confirm) return;
        try {
          wx.removeStorageSync(trackerConfig.storageKey);
        } catch (e) {
          // storage unavailable, skip
        }
        this.applyDecks([createEmptyDeck(0)], false);
      },
    });
  },

  drawAllCharts() {
    (this.data.decks || []).forEach((deck) => {
      this.drawChart(`winrateChart-${deck.id}`, buildWinRateSeries(deck.matches, trackerConfig.stats), 'winrate');
      this.drawChart(`seatWinrateChart-${deck.id}`, buildSeatWinRateSeries(deck.matches, trackerConfig.stats), 'seatWinrate');
    });
  },

  drawChart(canvasId, series, type) {
    const query = this.createSelectorQuery();
    query.select(`#${canvasId}`).fields({ node: true, size: true }).exec((result) => {
      const info = result && result[0];
      if (!info || !info.node) return;

      const canvas = info.node;
      const ctx = canvas.getContext('2d');
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const dpr = windowInfo.pixelRatio || 1;
      const width = info.width || 320;
      const height = info.height || 120;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);

      paintChart(ctx, width, height, series, type);
    });
  },
});
