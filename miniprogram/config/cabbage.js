// 卷心菜对账：The Cabbage Merchant / Academy Manufactor 食物引擎的 token 与产费追踪。
// 引擎只留卡名，不放解释文字（界面极简）。
const cabbageConfig = {
  engines: [
    { key: 'cabbage', name: 'The Cabbage Merchant' },
    { key: 'jaheira', name: 'Jaheira, Friend of the Forest', zhName: '树林之友贾希拉' },
    { key: 'manufactor', name: 'Academy Manufactor', zhName: '大学院制造工人' },
    { key: 'peregrin', name: 'Peregrin Took', zhName: '佩里格林·图克' },
  ],
  // 引擎默认全关，进入页面后按场随手开
  defaultEngines: {
    cabbage: false,
    jaheira: false,
    manufactor: false,
    peregrin: false,
  },
  tokens: [
    { key: 'food', name: '食品' },
    { key: 'clue', name: '线索' },
    { key: 'treasure', name: '珍宝' },
  ],
};

module.exports = {
  cabbageConfig,
};
