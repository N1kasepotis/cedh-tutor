const { lifeTrackerConfig } = require('../../config/life-tracker');
const {
  createLifeTrackerState,
  resetLifeTrackerState,
  setLifeTrackerPlayerCount,
  changePlayerLife,
  isLifeTrackerState,
  seatFacingFor,
  pickFirstPlayerId,
  buildFirstPlayerRace,
  raceLevelsAt,
  setFirstPlayer,
} = require('../../utils/life-tracker');
const { readStorage, writeStorage } = require('../../utils/storage');
const { setKeepScreenOn } = require('../../utils/keep-screen-on');
const { enableShareMenu } = require('../../utils/share');
const { titleFontBase64 } = require('../../assets/title-font');

const LONG_PRESS_DELAY_MS = lifeTrackerConfig.holdDelayMs;
const ACCELERATED_START_MS = lifeTrackerConfig.holdIntervalMs;
const PERSIST_DEBOUNCE_MS = 180;
// 重置与切人数会抹掉一整局血量，但它们在长局里是高频合法操作：
// 给撤销而不是二次确认，既不丢数据也不给正常路径加一次点击
const UNDO_WINDOW_MS = 8000;

function colorForKey(key) {
  return lifeTrackerConfig.colors.find((color) => color.key === key)
    || lifeTrackerConfig.colors[0];
}

function cloneLifeState(state) {
  return {
    ...state,
    players: (state.players || []).map((player) => ({ ...player })),
  };
}

Page({
  data: {
    players: [],
    playerCount: lifeTrackerConfig.playerCount,
    playerCountOptions: lifeTrackerConfig.playerCountOptions,
    menuOpen: false,
    undoVisible: false,
    undoText: '',
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
    this.stopRace();
    this.dismissUndo();
    this.writeStorage();
    this.setData({ menuOpen: false });
  },

  onUnload() {
    this.clearLifePress(false);
    this.stopRace();
    this.dismissUndo();
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
    // 两人上下对坐（上位反转）；三人上一下二（首位横跨反转）；四人十字四分；
    // 五人两两对坐 + 一人坐右短边。谁坐哪条边查 config 的 seatFacing，不在这里硬算——
    // 那张表同时被边缘赛跑用来决定光该跑过哪一段，两处算法分家迟早对不上。
    // 重建 players 会抹掉正在跑的那一帧亮度：对局中随手加一点血就会把光打断。
    // 原样接过来，让赛跑自己去推进。
    const current = this.data.players || [];
    const players = this.gameState.players.map((player, index) => {
      const color = colorForKey(player.colorKey);
      return {
        ...player,
        color: color.hex,
        rgb: color.rgb,
        raceLevel: (current[index] && current[index].raceLevel) || 0,
        orientationClass: `player-facing-${seatFacingFor(playerCount, index)}`,
        // 抽完先手，中签者那条外缘留成他的颜色。抽签只热闹两秒，
        // 但「谁先手」整局都在用来数回合顺序，所以它得留下来。
        isFirstPlayer: player.id === this.gameState.firstPlayerId,
      };
    });
    this.setData({ players, playerCount });
  },

  // 快照 + 可点撤销条，代替「事后 toast」
  offerUndo(label) {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoSnapshot = this.undoPendingSnapshot || null;
    this.undoPendingSnapshot = null;
    if (!this.undoSnapshot) return;
    this.setData({ undoVisible: true, undoText: label });
    this.undoTimer = setTimeout(() => {
      this.undoTimer = null;
      this.dismissUndo();
    }, UNDO_WINDOW_MS);
  },

  dismissUndo() {
    if (this.undoTimer) clearTimeout(this.undoTimer);
    this.undoTimer = null;
    this.undoSnapshot = null;
    if (this.data.undoVisible) this.setData({ undoVisible: false, undoText: '' });
  },

  undoLastChange() {
    if (!this.undoSnapshot) return;
    this.gameState = this.undoSnapshot;
    this.dismissUndo();
    this.syncPlayers();
    this.writeStorage();
    wx.showToast({ title: '已恢复上一局', icon: 'none' });
  },

  applyLifeChange(playerId, delta) {
    // 一旦有人继续记血，撤销回上一局就不再是用户想要的了
    if (this.data.undoVisible) this.dismissUndo();
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
    const stored = writeStorage(lifeTrackerConfig.storageKey, this.gameState, {
      schemaVersion: lifeTrackerConfig.schemaVersion,
      validate: isLifeTrackerState,
    });
    // 存盘失败此前是完全静默的：屏幕上的血量照常在变，用户毫不知情，
    // 直到切后台被回收、回来发现整局归零。落盘是这一页唯一的持久化，不能只当它成功。
    // 只提示一次：这是每次加减血都会跑的防抖自动存盘，逐次弹窗会盖住计数本身。
    // 本局内存态仍然正确，所以措辞是「别切后台」而不是「已丢失」。
    if (!stored.ok && !this.storageWarned) {
      this.storageWarned = true;
      wx.showToast({ title: '本地存储写入失败，切后台可能丢失本局', icon: 'none', duration: 3000 });
    }
  },

  toggleDropdown() {
    this.setData({ menuOpen: !this.data.menuOpen });
  },

  // 抽先手：一道光沿屏幕外缘绕圈，经过每个人的座位边，减速，停在中签者那一段。
  //
  // 全程不出文字：一半座位是转 180 度的，任何一句「你先手」对另一半都是倒的。
  // 光没有方向，从哪个座位看都读得懂。
  drawFirstPlayer() {
    this.setData({ menuOpen: false });
    if (this.raceTimer) return; // 正在跑就别重入，否则两条序列会互相抢 raceLevels

    const playerCount = this.gameState.playerCount || this.gameState.players.length;
    const winnerId = pickFirstPlayerId(this.gameState, Math.random);
    if (!winnerId) return;

    const race = buildFirstPlayerRace(playerCount, winnerId);
    // 两人以下没有「绕圈」可言，直接给结果
    if (!race.sequence.length) {
      this.settleFirstPlayer(winnerId);
      return;
    }
    this.dismissUndo();
    this.runRaceStep(race, winnerId, 0);
  },

  runRaceStep(race, winnerId, index) {
    const last = index >= race.sequence.length - 1;
    const trail = (lifeTrackerConfig.firstPlayerRace || {}).trail;
    // 最后一格只留中签者独亮，彗尾清掉——「其余全灭、只剩一个」才是落定的那一下，
    // 拖着尾巴收尾会显得还没跑完
    this.applyRaceLevels(last ? { [winnerId]: 3 } : raceLevelsAt(race.sequence, index, trail));

    this.raceTimer = setTimeout(() => {
      this.raceTimer = null;
      if (last) {
        this.settleFirstPlayer(winnerId);
        return;
      }
      this.runRaceStep(race, winnerId, index + 1);
    }, last ? (lifeTrackerConfig.firstPlayerRace || {}).holdMs : race.delays[index]);
  },

  // 只推变化的那几格。整个 players 数组每 55ms 全量过桥是这一页最贵的做法，
  // 而一帧真正变化的最多就是彗尾那几格。
  applyRaceLevels(levels) {
    const patch = {};
    (this.data.players || []).forEach((player, index) => {
      const next = levels[player.id] || 0;
      if ((player.raceLevel || 0) === next) return;
      patch[`players[${index}].raceLevel`] = next;
    });
    if (Object.keys(patch).length) this.setData(patch);
  },

  settleFirstPlayer(winnerId) {
    this.gameState = setFirstPlayer(this.gameState, winnerId);
    this.applyRaceLevels({});
    this.syncPlayers();
    this.writeStorage();
  },

  // 切后台、切人数、重置、离开页面都要掐掉：让一条已经没意义的序列继续跑，
  // 结果就是它在新的一局里凭空点亮一个座位。
  stopRace() {
    if (this.raceTimer) clearTimeout(this.raceTimer);
    this.raceTimer = null;
    this.applyRaceLevels({});
  },

  resetGame() {
    this.clearLifePress(false);
    this.stopRace();
    this.undoPendingSnapshot = cloneLifeState(this.gameState);
    this.gameState = resetLifeTrackerState(this.gameState);
    this.syncPlayers();
    this.writeStorage();
    this.setData({ menuOpen: false });
    this.offerUndo('对局已重置');
  },

  setPlayerMode(event) {
    const count = Number(event.currentTarget.dataset.count);
    const current = this.gameState.playerCount || this.gameState.players.length;
    if (!count || count === current) {
      this.setData({ menuOpen: false });
      return;
    }
    this.clearLifePress(false);
    this.stopRace();
    this.undoPendingSnapshot = cloneLifeState(this.gameState);
    this.gameState = setLifeTrackerPlayerCount(this.gameState, count);
    this.syncPlayers();
    this.writeStorage();
    this.setData({ menuOpen: false });
    this.offerUndo(`已切换为 ${count} 人对局`);
  },

  goHome() {
    this.dismissUndo();
    this.writeStorage();
    wx.navigateBack({
      delta: 1,
      fail: () => wx.reLaunch({ url: '/pages/index/index' }),
    });
  },
});
