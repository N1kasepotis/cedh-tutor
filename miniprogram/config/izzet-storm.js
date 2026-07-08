// 伊捷风暴：Krark / Ral 抛硬币风暴的计数器。引擎只留卡名，不放解释文字。
const izzetStormConfig = {
  engines: [
    { key: 'krark', name: 'Krark, the Thumbless' },
    { key: 'krarksThumb', name: "Krark's Thumb" },
    { key: 'ralMonsoon', name: 'Ral, Monsoon Mage' },
  ],
  // 引擎默认全关，进入页面后按场随手开
  defaultEngines: {
    krark: false,
    krarksThumb: false,
    ralMonsoon: false,
  },
  initialState: {
    krarkCount: 1,
  },
};

module.exports = {
  izzetStormConfig,
};
