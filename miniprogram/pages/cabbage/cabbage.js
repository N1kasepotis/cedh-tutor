const { cabbageConfig } = require('../../config/cabbage');
const {
  createCabbageState,
  tokenNeedsTap,
  castTokens,
  addToken,
  tapToken,
  removeToken,
  cabbageActivate,
  cabbageAvailable,
  untapAll,
  untapOneFood,
  calculateMana,
} = require('../../utils/cabbage');
const { enableShareMenu } = require('../../utils/share');

function setKeepScreenOn(on) {
  if (wx.setKeepScreenOn) wx.setKeepScreenOn({ keepScreenOn: on });
}

Page({
  data: {
    cabbageEngineList: [],
    cabbageTokens: [],
    cabbageMana: { green: 0, generic: 0, treasure: 0 },
    cabbageAvail: 0,
  },

  // 每次进入都是全新页面实例 → 引擎回到默认（切出即自动 deselect）
  onLoad() {
    enableShareMenu();
    this.cabbageState = createCabbageState();
    this.cabbageEngines = { ...cabbageConfig.defaultEngines };
    this.cabbageHistory = [];
    this.syncCabbage();
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
    return { title: '卷心菜对账：食物引擎产费追踪', path: '/pages/cabbage/cabbage' };
  },

  onShareTimeline() {
    return { title: '卷心菜对账：食物引擎产费追踪' };
  },

  syncCabbage() {
    const engines = this.cabbageEngines;
    const state = this.cabbageState;

    this.setData({
      cabbageEngineList: cabbageConfig.engines.map((engine) => ({
        key: engine.key,
        name: engine.name,
        zhName: engine.zhName || '',
        on: Boolean(engines[engine.key]),
      })),
      cabbageTokens: cabbageConfig.tokens.map((token) => ({
        key: token.key,
        name: token.name,
        u: state[token.key].u,
        t: state[token.key].t,
        showTap: tokenNeedsTap(token.key, engines),
      })),
      cabbageMana: calculateMana(state, engines),
      cabbageAvail: cabbageAvailable(state),
    });
  },

  // 和伊捷风暴同一套：改衍生物的操作都经 commitCabbage 落地，底部的“撤销”退一步。引擎开关不进历史。
  // 只有状态按值真的变了才进历史：只剩 1 个食品时点「横置 2 个食品」、计数已是 0 时点 − 这类无效点击
  // 不占撤销位，连点多少次也挤不掉之前的真实操作。快照在调用 utils 之前按值取，不依赖 utils 是否原地改。
  commitCabbage(change) {
    const before = JSON.stringify(this.cabbageState);
    const next = change(this.cabbageState);
    if (JSON.stringify(next) !== before) {
      this.cabbageHistory.push(JSON.parse(before));
      if (this.cabbageHistory.length > 50) this.cabbageHistory.shift();
    }
    this.cabbageState = next;
    this.syncCabbage();
  },

  toggleCabbageEngine(event) {
    const key = event.currentTarget.dataset.key;
    this.cabbageEngines = { ...this.cabbageEngines, [key]: !this.cabbageEngines[key] };
    this.syncCabbage();
  },

  cabbageCast() {
    this.commitCabbage((state) => castTokens(state, this.cabbageEngines));
  },

  cabbageAddToken(event) {
    const key = event.currentTarget.dataset.key;
    this.commitCabbage((state) => addToken(state, key));
  },

  cabbageTapToken(event) {
    const key = event.currentTarget.dataset.key;
    this.commitCabbage((state) => tapToken(state, key, this.cabbageEngines));
  },

  cabbageRemoveToken(event) {
    const key = event.currentTarget.dataset.key;
    this.commitCabbage((state) => removeToken(state, key));
  },

  cabbageActivate() {
    this.commitCabbage((state) => cabbageActivate(state));
  },

  cabbageUntapAll() {
    this.commitCabbage((state) => untapAll(state));
  },

  cabbageUntapOneFood() {
    this.commitCabbage((state) => untapOneFood(state));
  },

  cabbageUndo() {
    if (!this.cabbageHistory.length) return;
    this.cabbageState = this.cabbageHistory.pop();
    this.syncCabbage();
  },

  cabbageReset() {
    this.commitCabbage(() => createCabbageState());
  },
});
