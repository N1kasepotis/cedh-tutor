const { lifeTrackerConfig } = require('../../config/life-tracker');
const {
  createLifeTrackerState,
  resetLifeTrackerState,
  setLifeTrackerPlayerCount,
  changePlayerLife,
  isLifeTrackerState,
} = require('../../utils/life-tracker');
const { readStorage, writeStorage } = require('../../utils/storage');
const { setKeepScreenOn } = require('../../utils/keep-screen-on');
const { enableShareMenu } = require('../../utils/share');
const { titleFontBase64 } = require('../../assets/title-font');

const LONG_PRESS_DELAY_MS = lifeTrackerConfig.holdDelayMs;
const ACCELERATED_START_MS = lifeTrackerConfig.holdIntervalMs;
const PERSIST_DEBOUNCE_MS = 180;

function colorForKey(key) {
  return lifeTrackerConfig.colors.find((color) => color.key === key)
    || lifeTrackerConfig.colors[0];
}

Page({
  data: {
    players: [],
    playerCount: lifeTrackerConfig.playerCount,
    playerCountOptions: lifeTrackerConfig.playerCountOptions,
    menuOpen: false,
  },

  onLoad() {
    enableShareMenu();
    this.loadDisplayFont();

    const stored = readStorage(lifeTrackerConfig.storageKey, {
      schemaVersion: lifeTrackerConfig.schemaVersion,
      defaultValue: null,
      validate: isLifeTrackerState,
    });
    this.gameState = stored.value
      ? { playerCount: stored.value.players.length, ...stored.value }
      : createLifeTrackerState();
    this.syncPlayers();
  },

  onShow() {
    setKeepScreenOn(true);
  },

  onHide() {
    this.clearLifePress(false);
    this.writeStorage();
    this.setData({ menuOpen: false });
  },

  onUnload() {
    this.clearLifePress(false);
    this.writeStorage();
    setKeepScreenOn(false);
  },

  onShareAppMessage() {
    return {
      title: 'EDH 血量记录',
      path: '/pages/life-tracker/life-tracker',
    };
  },

  onShareTimeline() {
    return { title: 'EDH 血量记录' };
  },

  loadDisplayFont() {
    if (!wx.loadFontFace) return;
    wx.loadFontFace({
      family: 'cEDHDisplay',
      source: `url("data:font/woff2;base64,${titleFontBase64}")`,
      global: false,
      scopes: ['webview'],
      success: () => {},
      fail: () => {},
    });
  },

  syncPlayers() {
    const playerCount = this.gameState.playerCount || this.gameState.players.length;
    // 两人上下对坐（上位反转）；三人上一下二（首位横跨反转）；四人十字四分
    const topCount = playerCount === 4 ? 2 : 1;
    const players = this.gameState.players.map((player, index) => {
      const color = colorForKey(player.colorKey);
      return {
        ...player,
        color: color.hex,
        rgb: color.rgb,
        orientationClass: index < topCount ? 'player-facing-top' : 'player-facing-bottom',
      };
    });
    this.setData({ players, playerCount });
  },

  applyLifeChange(playerId, delta) {
    this.gameState = changePlayerLife(this.gameState, playerId, delta);
    this.syncPlayers();
    this.scheduleStorageWrite();
  },

  startLifePress(event) {
    const playerId = Number(event.currentTarget.dataset.id);
    const delta = Number(event.currentTarget.dataset.delta);
    if (!playerId || !delta) return;

    this.clearLifePress(false);
    this.lifePress = { playerId, delta, repeated: false, repeatDelay: ACCELERATED_START_MS };
    this.lifePressTimer = setTimeout(() => {
      if (!this.lifePress) return;
      this.lifePress.repeated = true;
      this.applyLifeChange(playerId, delta);
      this.scheduleAcceleratedChange();
    }, LONG_PRESS_DELAY_MS);
  },

  scheduleAcceleratedChange() {
    if (!this.lifePress) return;
    const press = this.lifePress;
    this.lifeRepeatTimer = setTimeout(() => {
      if (!this.lifePress) return;
      this.applyLifeChange(press.playerId, press.delta);
      press.repeatDelay = Math.max(48, Math.round(press.repeatDelay * 0.88));
      this.scheduleAcceleratedChange();
    }, press.repeatDelay);
  },

  endLifePress() {
    this.clearLifePress(true);
    this.writeStorage();
  },

  cancelLifePress() {
    this.clearLifePress(false);
    this.writeStorage();
  },

  clearLifePress(applyShortTap) {
    if (this.lifePressTimer) clearTimeout(this.lifePressTimer);
    if (this.lifeRepeatTimer) clearTimeout(this.lifeRepeatTimer);
    this.lifePressTimer = null;
    this.lifeRepeatTimer = null;

    const press = this.lifePress;
    this.lifePress = null;
    if (applyShortTap && press && !press.repeated) {
      this.applyLifeChange(press.playerId, press.delta);
    }
  },

  scheduleStorageWrite() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => this.writeStorage(), PERSIST_DEBOUNCE_MS);
  },

  writeStorage() {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    if (!this.gameState) return;
    writeStorage(lifeTrackerConfig.storageKey, this.gameState, {
      schemaVersion: lifeTrackerConfig.schemaVersion,
      validate: isLifeTrackerState,
    });
  },

  toggleDropdown() {
    this.setData({ menuOpen: !this.data.menuOpen });
  },

  resetGame() {
    this.clearLifePress(false);
    this.gameState = resetLifeTrackerState(this.gameState);
    this.syncPlayers();
    this.writeStorage();
    this.setData({ menuOpen: false });
    wx.showToast({ title: '对局已重置', icon: 'none' });
  },

  setPlayerMode(event) {
    const count = Number(event.currentTarget.dataset.count);
    const current = this.gameState.playerCount || this.gameState.players.length;
    if (!count || count === current) {
      this.setData({ menuOpen: false });
      return;
    }
    this.clearLifePress(false);
    this.gameState = setLifeTrackerPlayerCount(this.gameState, count);
    this.syncPlayers();
    this.writeStorage();
    this.setData({ menuOpen: false });
    wx.showToast({ title: `已切换为 ${count} 人对局`, icon: 'none' });
  },

  goHome() {
    this.writeStorage();
    wx.navigateBack({
      delta: 1,
      fail: () => wx.reLaunch({ url: '/pages/index/index' }),
    });
  },
});
