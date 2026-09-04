const { randomConfig } = require('../../config/random');
const { stickerConfig, stickerSheets } = require('../../config/stickers');
const {
  buildRollOff,
  rollInteger,
  sanitizeRange,
} = require('../../utils/random');
const {
  buildStickerRound,
  normalizeStickerSheets,
} = require('../../utils/stickers');
const { enableShareMenu } = require('../../utils/share');
const { readStorage, writeStorage } = require('../../utils/storage');

const stickerStorageKey = stickerConfig.storageKey;

function decorateRolls(rollOffResult) {
  const winnerSeats = new Set(rollOffResult.winners.map((winner) => winner.seat));

  return rollOffResult.rolls.map((roll) => ({
    ...roll,
    isWinner: winnerSeats.has(roll.seat),
  }));
}

function createEmptyStickerRound() {
  return {
    drawnSheets: [],
    best: { sheetName: '', word: '', vowelCount: 0 },
    summary: '本局最高产出：X 点红色法术力',
  };
}

Page({
  data: {
    minInput: String(randomConfig.number.defaultMin),
    maxInput: String(randomConfig.number.defaultMax),
    presets: randomConfig.number.presets,
    numberResultLabel: 'X',
    rollOffRolls: [
      { seat: 'seat1', label: 'Seat 1', value: '-', isWinner: false },
      { seat: 'seat2', label: 'Seat 2', value: '-', isWinner: false },
      { seat: 'seat3', label: 'Seat 3', value: '-', isWinner: false },
      { seat: 'seat4', label: 'Seat 4', value: '-', isWinner: false },
    ],
    rollOffResultLabel: '点击按钮决定谁先手',
    rollOffTie: false,
    stickerPool: [],
    stickerRound: createEmptyStickerRound(),
    stickerAnimating: false,
    canDrawStickers: true,
  },

  onLoad() {
    enableShareMenu();
    this.loadStickerPool();
  },

  onShareAppMessage() {
    return {
      title: '先手判定、随机数与开局贴纸小工具',
      path: '/pages/random/random',
    };
  },

  onShareTimeline() {
    return { title: '先手判定、随机数与开局贴纸小工具' };
  },

  changeMin(event) {
    this.setData({ minInput: event.detail.value });
  },

  changeMax(event) {
    this.setData({ maxInput: event.detail.value });
  },

  rollNumber() {
    const { min, max } = sanitizeRange(this.data.minInput, this.data.maxInput);
    const value = rollInteger(min, max);

    this.setData({
      minInput: String(min),
      maxInput: String(max),
      numberResultLabel: String(value),
    });
  },

  rollPreset(event) {
    const min = event.currentTarget.dataset.min;
    const max = event.currentTarget.dataset.max;
    const value = rollInteger(min, max);

    this.setData({
      minInput: String(min),
      maxInput: String(max),
      numberResultLabel: String(value),
    });
  },

  rollOff() {
    const result = buildRollOff(randomConfig.rollOff.playerCount, randomConfig.rollOff.sides);

    this.setData({
      rollOffRolls: decorateRolls(result),
      rollOffResultLabel: result.resultLabel,
      rollOffTie: result.isTie,
    });
  },

  loadStickerPool() {
    const stored = readStorage(stickerStorageKey, {
      schemaVersion: 1,
      defaultValue: stickerSheets,
      validate: Array.isArray,
    });
    this.applyStickerPool(normalizeStickerSheets(stored.value, stickerSheets), false);
  },

  applyStickerPool(pool, shouldPersist = true) {
    const normalized = normalizeStickerSheets(pool, stickerSheets);

    if (shouldPersist) {
      const stored = writeStorage(stickerStorageKey, normalized, {
        schemaVersion: 1,
        validate: Array.isArray,
      });
      if (!stored.ok) wx.showToast({ title: '贴纸设置保存失败', icon: 'none' });
    }

    this.setData({
      stickerPool: normalized,
      canDrawStickers: normalized.length >= stickerConfig.drawCount,
    });
  },

  drawStickers() {
    if (!this.data.canDrawStickers) {
      wx.showToast({ title: '贴纸池至少需要 3 张', icon: 'none' });
      return;
    }

    if (this.stickerDrawTimer) clearTimeout(this.stickerDrawTimer);
    this.setData({ stickerAnimating: true });
    this.stickerDrawTimer = setTimeout(() => {
      this.stickerDrawTimer = null;
      this.setData({
        stickerRound: buildStickerRound(this.data.stickerPool, Math.random, stickerConfig.drawCount),
        stickerAnimating: false,
      });
    }, 220);
  },

  onUnload() {
    if (this.stickerDrawTimer) clearTimeout(this.stickerDrawTimer);
    this.stickerDrawTimer = null;
  },

  // 独立全屏计数器入口（进入即锁定全屏、开启常亮、引擎每次进入重置）
  goCabbage() {
    wx.navigateTo({ url: '/pages/cabbage/cabbage' });
  },

  goIzzet() {
    wx.navigateTo({ url: '/pages/izzet/izzet' });
  },

  goPlanechase() {
    wx.navigateTo({ url: '/pages/planechase/planechase' });
  },
});
