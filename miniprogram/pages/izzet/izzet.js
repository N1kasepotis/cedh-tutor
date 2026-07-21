const { izzetStormConfig } = require('../../config/izzet-storm');
const {
  createStormState,
  castInstantSorcery,
  castOtherSpell,
  shouldPromptRalUltimate,
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
  },

  // 每次进入都是全新页面实例；Ral 默认不在场。
  onLoad() {
    enableShareMenu();
    this.stormState = createStormState();
    this.izzetEngines = { ...izzetStormConfig.defaultEngines };
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

    this.setData({
      izzetEngineList: izzetStormConfig.engines.map((engine) => ({
        key: engine.key,
        name: engine.name,
        on: Boolean(engines[engine.key]),
      })),
      storm: this.stormState,
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
    const previousState = this.stormState;
    this.stormState = castInstantSorcery(this.stormState, this.izzetEngines, Math.random);
    this.syncStorm();
    if (shouldPromptRalUltimate(previousState, this.stormState)) {
      wx.showToast({ title: '转化可开大', icon: 'none' });
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
