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
const { formatCommanderDisplayLines, splitCommanderNames } = require('../../utils/result-display');
const { buildScryfallImageUrl } = require('../../utils/scryfall');
const { prefetchCardArt, getCardArt } = require('../../utils/card-art');
const { enableShareMenu } = require('../../utils/share');
const { readStorage, removeStorage, writeStorage } = require('../../utils/storage');

function buildChartSignature(decks) {
  return (decks || []).map((deck) => [
    deck.id,
    ...(deck.matches || []).map((match) => `${match.id}:${match.date}:${match.result}:${match.seat || ''}`),
  ].join('|')).join('||');
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
    this.pageActive = true;
    // 头像直链的解析这一轮是否已结束。未结束时头像先不给地址（只显示占位底），
    // 避免「先渲染回落链、解析完再换直链」造成同一张图下载两次。
    this.artReady = false;
    this.chartDataSignature = '';
    enableShareMenu();
    this.loadTrackerData();
  },

  onShow() {
    this.pageActive = true;
    this.drawAllChartsSoon();
  },

  onHide() {
    this.pageActive = false;
    this.clearChartDrawTimer();
  },

  onUnload() {
    this.pageActive = false;
    this.clearChartDrawTimer();
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
    const stored = readStorage(trackerConfig.storageKey, {
      schemaVersion: trackerConfig.version,
      defaultValue: null,
      validate: (value) => Boolean(value && Array.isArray(value.decks)),
    });
    const data = normalizeTrackerData(stored.value, commanders, trackerConfig);
    this.applyDecks(data.decks, false);

    // 主将头像批量解析成 CDN 直链：最多 5 副牌 × 2 位拍档，一次请求就够。
    // 微信的 image 换了 src 会重新下载同一张图，所以只在确实解析到直链时才重渲染一次；
    // 解析结果通常是全中或全不中，不会来回抖。
    const names = data.decks
      .filter((deck) => deck.commander)
      .flatMap((deck) => splitCommanderNames(deck.commander.name).slice(0, 2));
    if (!names.length) this.artReady = true;
    if (names.length) {
      prefetchCardArt(names).then(() => {
        // 无论命中与否都要重渲染：没命中的那些还等着这一步放开回落地址
        this.artReady = true;
        if (this.pageActive) this.applyDecks(data.decks, false);
      });
    }
  },

  decorateDecks(decks) {
    return decks.map((deck, index) => {
      const stats = calculateDeckStats(deck, trackerConfig.stats);
      const displayLines = deck.commander
        ? formatCommanderDisplayLines(deck.commander.name, { abbreviatePartners: false })
        : [`第 ${index + 1} 套牌`];
      const longestDisplayLineLength = displayLines.reduce(
        (length, line) => Math.max(length, String(line || '').length),
        0,
      );
      const commanderNameClass = [
        displayLines.length > 1 ? 'partner' : 'single',
        longestDisplayLineLength > 27
          ? 'name-tight'
          : (longestDisplayLineLength > 22 ? 'name-compact' : ''),
      ].filter(Boolean).join(' ');
      const matches = sortMatches(deck.matches).map((match, matchIndex) => ({
        ...match,
        sequence: matchIndex + 1,
        label: RESULT_LABELS[match.result],
        seatClass: match.seat || 'seat-unknown',
      }));
      const newestMatches = matches.slice().reverse();
      const pendingResult = deck.pendingResult || 'win';
      const pendingSeat = deck.pendingSeat || 'seat1';
      const historyExpanded = Boolean(deck.historyExpanded);
      const historyRenderLimit = Math.max(5, Number(trackerConfig.historyRenderLimit) || 50);
      const commanderAvatars = deck.commander
        ? splitCommanderNames(deck.commander.name).slice(0, 2).map((name) => ({
          name,
          // 直链优先；这一轮解析还没结束就先不给地址（只显示占位底），
          // 结束后仍没解析到才按名回落。先回落再换直链会让同一张图下载两次。
          url: getCardArt(name, 'artCrop')
            || (this.artReady ? buildScryfallImageUrl(name, 'art_crop') : ''),
        }))
        : [];

      return {
        ...deck,
        matches,
        visibleMatches: historyExpanded ? newestMatches.slice(0, historyRenderLimit) : newestMatches.slice(0, 5),
        historyExpanded,
        historyToggleLabel: historyExpanded
          ? '收起'
          : (newestMatches.length > historyRenderLimit ? `展开最近 ${historyRenderLimit} 条` : '展开全部'),
        commanderAvatars,
        commanderNameClass,
        stats,
        query: deck.query || (deck.commander && deck.commander.name) || '',
        displayName: displayLines.join(' '),
        displayLines,
        pendingDate: deck.pendingDate || todayString(),
        pendingResult,
        pendingResultIndex: Math.max(0, trackerConfig.resultOptions.findIndex((option) => option.id === pendingResult)),
        pendingResultLabel: RESULT_LABELS[pendingResult] || RESULT_LABELS.win,
        pendingSeat,
        pendingSeatIndex: Math.max(0, trackerConfig.seatOptions.findIndex((option) => option.id === pendingSeat)),
        pendingSeatLabel: (trackerConfig.seatOptions.find((option) => option.id === pendingSeat) || trackerConfig.seatOptions[0]).label,
        suggestions: deck.suggestions || [],
        showSuggestions: Boolean(deck.showSuggestions && deck.suggestions && deck.suggestions.length),
      };
    });
  },

  applyDecks(decks, shouldPersist = true) {
    const normalizedDecks = decks.length ? decks : [createEmptyDeck(0)];
    const decorated = this.decorateDecks(normalizedDecks);
    const chartSignature = buildChartSignature(decorated);
    const shouldRedrawCharts = chartSignature !== this.chartDataSignature;
    this.chartDataSignature = chartSignature;

    if (shouldPersist) {
      const stored = writeStorage(trackerConfig.storageKey, serializeTrackerData({
        version: trackerConfig.version,
        decks: decorated,
      }), {
        schemaVersion: trackerConfig.version,
        validate: (value) => Boolean(value && Array.isArray(value.decks)),
      });
      if (!stored.ok) wx.showToast({ title: '战绩保存失败，请重试', icon: 'none' });
    }

    this.setData({
      decks: decorated,
      canAddDeck: decorated.length < trackerConfig.maxDecks,
    }, () => {
      if (shouldRedrawCharts) this.drawAllChartsSoon();
    });
  },

  drawAllChartsSoon() {
    if (!this.pageActive || this.chartDrawTimer) return;
    this.chartDrawTimer = setTimeout(() => {
      this.chartDrawTimer = null;
      if (this.pageActive) this.drawAllCharts();
    }, 16);
  },

  clearChartDrawTimer() {
    if (this.chartDrawTimer) clearTimeout(this.chartDrawTimer);
    this.chartDrawTimer = null;
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

  changePendingResultPicker(event) {
    const deckId = event.currentTarget.dataset.id;
    const option = trackerConfig.resultOptions[Number(event.detail.value)];
    const result = option && option.id;
    if (!RESULT_LABELS[result]) return;

    const decks = this.data.decks.map((deck) => (
      deck.id === deckId ? { ...deck, pendingResult: result } : deck
    ));

    this.applyDecks(decks, false);
  },

  changePendingSeatPicker(event) {
    const deckId = event.currentTarget.dataset.id;
    const option = trackerConfig.seatOptions[Number(event.detail.value)];
    const seat = option && option.id;
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

      const record = {
        id: deck.editingMatchId || `match-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: deck.pendingDate || todayString(),
        result,
        seat,
      };
      const matches = deck.editingMatchId
        ? deck.matches.map((match) => (match.id === deck.editingMatchId ? record : match))
        : [...deck.matches, record];

      return { ...deck, matches: sortMatches(matches), editingMatchId: null };
    });

    this.applyDecks(decks);
  },

  editMatch(event) {
    const deckId = event.currentTarget.dataset.deckId;
    const matchId = event.currentTarget.dataset.matchId;
    const decks = this.data.decks.map((deck) => {
      if (deck.id !== deckId) return deck;
      const match = deck.matches.find((item) => item.id === matchId);
      if (!match) return deck;
      return {
        ...deck,
        editingMatchId: match.id,
        pendingDate: match.date,
        pendingResult: match.result,
        pendingSeat: match.seat || 'seat1',
      };
    });
    this.applyDecks(decks, false);
  },

  cancelEdit(event) {
    const deckId = event.currentTarget.dataset.id;
    const decks = this.data.decks.map((deck) => (
      deck.id === deckId ? { ...deck, editingMatchId: null } : deck
    ));
    this.applyDecks(decks, false);
  },

  toggleMatchHistory(event) {
    const deckId = event.currentTarget.dataset.id;
    const decks = this.data.decks.map((deck) => (
      deck.id === deckId ? { ...deck, historyExpanded: !deck.historyExpanded } : deck
    ));
    this.applyDecks(decks, false);
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
        const removed = removeStorage(trackerConfig.storageKey);
        if (!removed.ok) {
          wx.showToast({ title: '本机战绩清除失败', icon: 'none' });
          return;
        }
        this.applyDecks([createEmptyDeck(0)], false);
      },
    });
  },

  drawAllCharts() {
    if (!this.pageActive) return;
    (this.data.decks || []).forEach((deck) => {
      this.drawChart(`winrateChart-${deck.id}`, buildWinRateSeries(deck.matches, trackerConfig.stats), 'winrate');
      this.drawChart(`seatWinrateChart-${deck.id}`, buildSeatWinRateSeries(deck.matches, trackerConfig.stats), 'seatWinrate');
    });
  },

  drawChart(canvasId, series, type) {
    const query = this.createSelectorQuery();
    query.select(`#${canvasId}`).fields({ node: true, size: true }).exec((result) => {
      if (!this.pageActive) return;
      const info = result && result[0];
      if (!info || !info.node) return;

      const canvas = info.node;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      // 统计图尺寸较小，2x 已足够清晰；限制超高 DPR 避免多牌组时瞬时放大画布内存。
      const dpr = Math.min(Number(windowInfo.pixelRatio || 1), 2);
      const width = info.width || 320;
      const height = info.height || 120;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.scale(dpr, dpr);

      paintChart(ctx, width, height, series, type);
    });
  },
});
