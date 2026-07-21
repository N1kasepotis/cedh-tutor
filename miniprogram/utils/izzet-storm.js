// 伊捷风暴纯逻辑：Ral, Monsoon Mage 抛硬币 + storm/瞬间法术/自伤计数。
//
// 计数口径（MTG 规则）：
// - storm      = 本回合施放的所有咒语数（喂 Grapeshot / Empty the Warrens；复制不算施放，不加 storm）
// - spells     = 瞬间/法术施放数（storm 的子集；喂 Ral, Leyline Prodigy 忠诚）
// - wins/losses= 抛硬币胜负
// - selfDamage = Ral, Monsoon Mage 抛输的自伤

function createStormState() {
  return {
    storm: 0,
    spells: 0,
    wins: 0,
    losses: 0,
    selfDamage: 0,
  };
}

function cloneStorm(state) {
  return {
    storm: state.storm,
    spells: state.spells,
    wins: state.wins,
    losses: state.losses,
    selfDamage: state.selfDamage,
  };
}

// 单次抛硬币是否赢；固定只消耗一次 rng()，便于确定性测试。
function flipWin(rng) {
  const random = typeof rng === 'function' ? rng : Math.random;
  return random() < 0.5;
}

// 你的回合施放一张瞬间/法术：Ral 正面在场时只抛一次，输则自伤 1。
function castInstantSorcery(state, engines, rng) {
  const on = engines || {};
  const next = cloneStorm(state);

  if (on.ralMonsoon) {
    if (flipWin(rng)) next.wins += 1;
    else {
      next.losses += 1;
      next.selfDamage += 1;
    }
  }

  next.storm += 1;
  next.spells += 1;
  return next;
}

// 施放一张非瞬间/法术咒语：只加 storm（不抛币、不加 spells/ping）。
function castOtherSpell(state) {
  const next = cloneStorm(state);
  next.storm += 1;
  return next;
}

function shouldPromptRalUltimate(previousState, nextState) {
  return Number(nextState && nextState.spells) >= 6
    && Number(nextState && nextState.wins) > Number(previousState && previousState.wins);
}

// 手动校正：对某个计数字段 ±1（不低于 0）。
function adjustCounter(state, field, delta) {
  const next = cloneStorm(state);
  if (typeof next[field] !== 'number') return next;
  next[field] = Math.max(0, next[field] + Number(delta || 0));
  return next;
}

module.exports = {
  createStormState,
  flipWin,
  castInstantSorcery,
  castOtherSpell,
  shouldPromptRalUltimate,
  adjustCounter,
};
