const { izzetStormConfig } = require('../../config/izzet-storm');
const {
  createStormState,
  castInstantSorcery,
  castOtherSpell,
  adjustCounter,
} = require('../../utils/izzet-storm');
const { enableShareMenu } = require('../../utils/share');

function setKeepScreenOn(on) {
  if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: on });
}

Page({
  data: {
    izzetEngineList: [],
    storm: createStormState(),
    izzetShowCopies: true,
    izzetShowSelfDamage: false,
    izzetKrarkCount: 0,
  },

  // 每次进入都是全新页面实例 → 引擎回到默认（切出即自动 deselect）
  onLoad() {
    enableShareMenu();
    this.stormState = createStormState();
    this.izzetEngines = { ...izzetStormConfig.defaultEngines };
    this.krarkCount = izzetStormConfig.initialState.krarkCount;
    this.stormHistory = [];
    this.syncStorm();
  },

  onShow() {
    setKeepScreenOn(true);
  },

  onHide() {
    setKeepScreenOn(false);
  },

  onUnload() {
    setKeepScreenOn(false);
  },

  onShareAppMessage() {
    return { title: '伊捷风暴：抛硬币风暴计数器', path: '/pages/izzet/izzet' };
  },

  onShareTimeline() {
    return { title: '伊捷风暴：抛硬币风暴计数器' };
  },

  syncStorm() {
    const engines = this.izzetEngines;
    const krarkTriggers = engines.krark ? this.krarkCount : 0;
    const flipsPerCast = (krarkTriggers + (engines.ralMonsoon ? 1 : 0)) * (engines.krarksThumb ? 2 : 1);

    this.setData({
      izzetEngineList: izzetStormConfig.engines.map((engine) => ({
        key: engine.key,
        name: engine.name,
        on: Boolean(engines[engine.key]),
      })),
      storm: this.stormState,
      izzetShowCopies: Boolean(engines.krark),
      izzetShowSelfDamage: Boolean(engines.ralMonsoon),
      izzetKrarkCount: engines.krark ? this.krarkCount : 0,
    });
  },

  pushStormHistory() {
    this.stormHistory.push({ ...this.stormState });
    if (this.stormHistory.length > 50) this.stormHistory.shift();
  },

  toggleIzzetEngine(event) {
    const key = event.currentTarget.dataset.key;
    this.izzetEngines = { ...this.izzetEngines, [key]: !this.izzetEngines[key] };
    this.syncStorm();
  },

  stormCastSpell() {
    this.pushStormHistory();
    this.stormState = castInstantSorcery(this.stormState, this.izzetEngines, Math.random, this.krarkCount);
    this.syncStorm();
    if (this.stormState.lastCopies > 0) {
      wx.showToast({ title: `复制 +${this.stormState.lastCopies}`, icon: 'none' });
    }
  },

  stormCastOther() {
    this.pushStormHistory();
    this.stormState = castOtherSpell(this.stormState);
    this.syncStorm();
  },

  stormAdjust(event) {
    const { field, delta } = event.currentTarget.dataset;
    this.pushStormHistory();
    this.stormState = adjustCounter(this.stormState, field, Number(delta));
    this.syncStorm();
  },

  krarkCountUp() {
    this.krarkCount = Math.min(this.krarkCount + 1, 8);
    this.syncStorm();
  },

  krarkCountDown() {
    this.krarkCount = Math.max(this.krarkCount - 1, 1);
    this.syncStorm();
  },

  stormUndo() {
    if (!this.stormHistory.length) return;
    this.stormState = this.stormHistory.pop();
    this.syncStorm();
  },

  stormReset() {
    this.pushStormHistory();
    this.stormState = createStormState();
    this.syncStorm();
  },
});
