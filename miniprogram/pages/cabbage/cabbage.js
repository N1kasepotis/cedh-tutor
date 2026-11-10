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

  // 和伊捷风暴同一套：每次改动衍生物之前存一份快照，底部的“撤销”退一步。引擎开关不进历史。
  // 状态里只有每种衍生物的 u / t 两个数，按值复制一份，不依赖 utils 是否原地改。
  pushCabbageHistory() {
    this.cabbageHistory.push(JSON.parse(JSON.stringify(this.cabbageState)));
    if (this.cabbageHistory.length > 50) this.cabbageHistory.shift();
  },

  toggleCabbageEngine(event) {
    const key = event.currentTarget.dataset.key;
    this.cabbageEngines = { ...this.cabbageEngines, [key]: !this.cabbageEngines[key] };
    this.syncCabbage();
  },

  cabbageCast() {
    this.pushCabbageHistory();
    this.cabbageState = castTokens(this.cabbageState, this.cabbageEngines);
    this.syncCabbage();
  },

  cabbageAddToken(event) {
    this.pushCabbageHistory();
    this.cabbageState = addToken(this.cabbageState, event.currentTarget.dataset.key);
    this.syncCabbage();
  },

  cabbageTapToken(event) {
    this.pushCabbageHistory();
    this.cabbageState = tapToken(this.cabbageState, event.currentTarget.dataset.key, this.cabbageEngines);
    this.syncCabbage();
  },

  cabbageRemoveToken(event) {
    this.pushCabbageHistory();
    this.cabbageState = removeToken(this.cabbageState, event.currentTarget.dataset.key);
    this.syncCabbage();
  },

  cabbageActivate() {
    this.pushCabbageHistory();
    this.cabbageState = cabbageActivate(this.cabbageState);
    this.syncCabbage();
  },

  cabbageUntapAll() {
    this.pushCabbageHistory();
    this.cabbageState = untapAll(this.cabbageState);
    this.syncCabbage();
  },

  cabbageUntapOneFood() {
    this.pushCabbageHistory();
    this.cabbageState = untapOneFood(this.cabbageState);
    this.syncCabbage();
  },

  cabbageUndo() {
    if (!this.cabbageHistory.length) return;
    this.cabbageState = this.cabbageHistory.pop();
    this.syncCabbage();
  },

  cabbageReset() {
    this.pushCabbageHistory();
    this.cabbageState = createCabbageState();
    this.syncCabbage();
  },
});
