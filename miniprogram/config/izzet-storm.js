// 伊捷风暴：Ral, Monsoon Mage 抛硬币风暴计数器。引擎只留卡名，不放解释文字。
const izzetStormConfig = {
  engines: [
    { key: 'ralMonsoon', name: 'Ral, Monsoon Mage' },
  ],
  // 默认不在场；用户确认 Ral 正面在场后再开启。
  defaultEngines: {
    ralMonsoon: false,
  },
};

module.exports = {
  izzetStormConfig,
};
