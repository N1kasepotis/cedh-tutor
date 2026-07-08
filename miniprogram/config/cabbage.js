// 卷心菜对账：The Cabbage Merchant / Academy Manufactor 食物引擎的 token 与产费追踪。
// 引擎只留卡名，不放解释文字（界面极简）。
const cabbageConfig = {
  engines: [
    { key: 'cabbage', name: 'The Cabbage Merchant' },
    { key: 'jaheira', name: 'Jaheira, Friend of the Forest' },
    { key: 'manufactor', name: 'Academy Manufactor' },
    { key: 'peregrin', name: 'Peregrin Took' },
  ],
  // 引擎默认全关，进入页面后按场随手开
  defaultEngines: {
    cabbage: false,
    jaheira: false,
    manufactor: false,
    peregrin: false,
  },
  tokens: [
    { key: 'food', name: 'Food' },
    { key: 'clue', name: 'Clue' },
    { key: 'treasure', name: 'Treasure' },
  ],
};

module.exports = {
  cabbageConfig,
};
