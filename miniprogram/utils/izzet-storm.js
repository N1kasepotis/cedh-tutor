// 伊捷风暴纯逻辑：数字抛硬币 + storm/瞬间法术/ping 计数聚合。页面只做渲染，规则全在这里以便 Node 测试。
//
// 计数口径（MTG 规则）：
// - storm      = 本回合施放的所有咒语数（喂 Grapeshot / Empty the Warrens；复制不算施放，不加 storm）
// - spells     = 瞬间/法术施放数（storm 的子集；喂 Ral, Leyline Prodigy 忠诚，也是 Krark 触发基数）
// - copies     = Krark 抛赢产生的复制数
// - wins/losses= 抛硬币胜负
// - selfDamage = Ral, Monsoon Mage 抛输的自伤

function createStormState() {
  return {
    storm: 0,
    spells: 0,
    copies: 0,
    wins: 0,
    losses: 0,
    selfDamage: 0,
    lastCopies: 0,
  };
}

function cloneStorm(state) {
  return {
    storm: state.storm,
    spells: state.spells,
    copies: state.copies,
    wins: state.wins,
    losses: state.losses,
    selfDamage: state.selfDamage,
    lastCopies: state.lastCopies,
  };
}

// Krark 在场数：由页面侧设置的复制品计数器控制（Sakashima / Spark Double 等）。
function krarkTriggerCount(engines, krarkCount) {
  const on = engines || {};
  if (!on.krark) return 0;
  return Math.max(1, Number(krarkCount) || 1);
}

// 单次抛硬币是否赢。Krark's Thumb：抛 2 取 1（保留想要的那面）→ 有任一正面即赢（~75%）。
// 始终消耗固定次数的 rng()（thumb 恒 2 次、否则 1 次），便于测试用确定序列复现。
function flipWin(thumb, rng) {
  const random = typeof rng === 'function' ? rng : Math.random;
  const first = random() < 0.5;
  if (!thumb) return first;
  const second = random() < 0.5;
  return first || second;
}

// 施放一张瞬间/法术：抛完所有 Krark 币（+可选 Ral, Monsoon Mage 币），聚合计数。
function castInstantSorcery(state, engines, rng, krarkCount) {
  const on = engines || {};
  const next = cloneStorm(state);
  const thumb = !!on.krarksThumb;
  const triggers = krarkTriggerCount(on, krarkCount);
  let copies = 0;

  for (let i = 0; i < triggers; i += 1) {
    if (flipWin(thumb, rng)) {
      next.wins += 1;
      copies += 1;
    } else {
      next.losses += 1;
    }
  }

  // Ral, Monsoon Mage：每次施放额外抛一次，输则自伤 1。
  if (on.ralMonsoon) {
    if (flipWin(thumb, rng)) next.wins += 1;
    else {
      next.losses += 1;
      next.selfDamage += 1;
    }
  }

  next.storm += 1;
  next.spells += 1;
  next.copies += copies;
  next.lastCopies = copies;
  return next;
}

// 施放一张非瞬间/法术咒语：只加 storm（不抛币、不加 spells/ping）。
function castOtherSpell(state) {
  const next = cloneStorm(state);
  next.storm += 1;
  next.lastCopies = 0;
  return next;
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
  krarkTriggerCount,
  flipWin,
  castInstantSorcery,
  castOtherSpell,
  adjustCounter,
};
