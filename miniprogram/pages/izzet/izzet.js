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
        zhName: engine.zhName || '',
        on: Boolean(engines[engine.key]),
      })),
      storm: this.stormState,
    });
  },

  // 和卷心菜同一套：只有状态按值真的变了才进历史。计数已是 0 时点 −、开局点「新回合」这类无效点击
  // 不占撤销位，连点也挤不掉之前的真实操作。返回改动前的快照，施法后的开大提示要拿它和新状态比。
  commitStorm(change) {
    const before = JSON.stringify(this.stormState);
    const next = change(this.stormState);
    if (JSON.stringify(next) !== before) {
      this.stormHistory.push(JSON.parse(before));
      if (this.stormHistory.length > 50) this.stormHistory.shift();
    }
    this.stormState = next;
    this.syncStorm();
    return JSON.parse(before);
  },

  toggleIzzetEngine(event) {
    const key = event.currentTarget.dataset.key;
    this.izzetEngines = { ...this.izzetEngines, [key]: !this.izzetEngines[key] };
    this.syncStorm();
  },

  stormCastSpell() {
    const previousState = this.commitStorm((state) => castInstantSorcery(state, this.izzetEngines, Math.random));
    if (shouldPromptRalUltimate(previousState, this.stormState)) {
      wx.showToast({ title: '转化可开大', icon: 'none' });
    }
  },

  stormCastOther() {
    this.commitStorm((state) => castOtherSpell(state));
  },

  stormAdjust(event) {
    const { field, delta } = event.currentTarget.dataset;
    this.commitStorm((state) => adjustCounter(state, field, Number(delta)));
  },

  stormUndo() {
    if (!this.stormHistory.length) return;
    this.stormState = this.stormHistory.pop();
    this.syncStorm();
  },

  stormReset() {
    this.commitStorm(() => createStormState());
  },
});
