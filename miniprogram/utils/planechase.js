// 竞逐时空（Planechase）的确定性内核：牌库、时空骰、换境与费用。
// 纯函数 + 可注入 rng，不碰 wx，Node 侧可完整测。
//
// 为什么不是「currentIndex 指向数组」——有三张牌直接打破那个模型：
//   · 境界交融「展示直到两张时空牌，同时时空换入两者」→ 同时存在两个当前时空
//   · 艾蕾侬的树种核心「时空换入该处，但不时空换出任一时空」→ 换入不伴随换出
//   · 乙太混沦「空白结果均为混沌，直到有牌手时空换出任一时空」→ 持续性骰面修正
// 指针表达不了任何一条，所以用分区模型：planarDeck（有序）+ activePlanes（数组）。
//
// 本模块只做分区操作；触发、反击、复制、状态动作时序由 planechase-session 负责。
// 玩家牌库、战场、支付与完整堆叠由实体牌桌处理，不能把操作记录当作完整规则引擎。

const { PLANECHASE_CARDS } = require('../config/planechase');
const { PLANAR_ACTIONS } = require('../config/planechase-rules');
const { rollInteger } = require('./random');

// CR 901.3a：时空骰是六面骰，一面 {PW}，一面 {CHAOS}，其余四面空白。
const DIE_FACES = Object.freeze(['planeswalk', 'chaos', 'blank', 'blank', 'blank', 'blank']);

// 乙太混沦：「时空骰掷出的空白结果均为{CHAOS}结果，直到有牌手时空换出任一时空为止」。
// 此正则仅用于快照文字审查；实际效应匹配使用稳定的 Oracle 身份。
const BLANK_IS_CHAOS_PATTERN = /空白结果均为/;

// 时空牌的第二条异能一律以「每当引发混沌时」起句；生成器已自检 45 张全部具备。
const CHAOS_LINE_PATTERN = /^每当引发混沌/;

const NEWLINE = String.fromCharCode(10);

function isPhenomenonRow(row) {
  return Boolean(row) && row[0] === 'X';
}

// 把一条烤好的数据展开成页面要用的形状。正文按换行拆成「常驻」与「混沌」两段：
// 掷出混沌时只高亮后者，玩家不必在整段文字里找该读哪句。
function cardAt(index) {
  const row = PLANECHASE_CARDS[index];
  if (!row) return null;
  const lines = String(row[3] || '').split(NEWLINE).filter((line) => line.trim());
  const chaosLines = lines.filter((line) => CHAOS_LINE_PATTERN.test(line));
  const staticLines = lines.filter((line) => !CHAOS_LINE_PATTERN.test(line));
  return {
    index,
    kind: row[0],
    isPhenomenon: isPhenomenonRow(row),
    name: row[1],
    type: row[2],
    text: row[3],
    // 异象只有一条「当你遭遇～时」，没有混沌异能，因此整段都归 staticLines
    staticLines,
    chaosLines,
    id: row[4],
    stamp: row[5],
    oracleId: row[6],
  };
}

function cardCount() {
  return PLANECHASE_CARDS.length;
}

// CR 901.15a 单一共享时空套牌：张数至少 min(40, 10×人数)；异象不超过人数的两倍。
function planarDeckLimits(playerCount) {
  const players = Math.max(1, Math.trunc(Number(playerCount) || 0) || 1);
  return {
    minCards: Math.min(40, 10 * players),
    maxPhenomena: 2 * players,
  };
}

function shuffleInPlace(items, rng) {
  const random = typeof rng === 'function' ? rng : Math.random;
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = rollInteger(0, i, random);
    const swap = items[i];
    items[i] = items[j];
    items[j] = swap;
  }
  return items;
}

// 建库：收全部时空牌，异象按上限裁到合规。
// 两人局上限是 4，而本地牌库有 5 张异象——不裁就是一副不合规的牌，
// 而且这件事必须说出来，不能默默少一张。
function buildPlanarDeck(playerCount, rng) {
  const limits = planarDeckLimits(playerCount);
  const planes = [];
  const phenomena = [];
  PLANECHASE_CARDS.forEach((row, index) => {
    (isPhenomenonRow(row) ? phenomena : planes).push(index);
  });

  shuffleInPlace(phenomena, rng);
  const kept = phenomena.slice(0, limits.maxPhenomena);
  const trimmed = phenomena.slice(limits.maxPhenomena).map((index) => PLANECHASE_CARDS[index][1]);

  const deck = shuffleInPlace(planes.concat(kept), rng);
  return { deck, trimmed, limits };
}

// CR 901.5：开局翻牌库顶；若翻到异象则置于牌库底并重复，直到翻出时空牌为止。
// **此过程中翻开的牌，其异能一律不触发**——所以这里不设 pending、不动 dieModifier。
function revealStartingPlane(state) {
  const guard = state.planarDeck.length + 1;
  for (let step = 0; step < guard; step += 1) {
    const next = state.planarDeck.shift();
    if (next === undefined) return null;
    if (!isPhenomenonRow(PLANECHASE_CARDS[next])) {
      state.activePlanes = [next];
      return next;
    }
    state.planarDeck.push(next);
  }
  return null;
}

function createGame(playerCount, rng) {
  const { deck, trimmed, limits } = buildPlanarDeck(playerCount, rng);
  const state = {
    playerCount: Math.max(1, Math.trunc(Number(playerCount) || 0) || 1),
    planarDeck: deck,
    activePlanes: [],
    dieModifier: 'none',
    rollsThisTurn: 0,
    pending: null,
    trimmed,
    limits,
    lastRoll: null,
  };
  revealStartingPlane(state);
  return state;
}

// CR 116.2i / 901.9：费用只计算本回合此前作为特殊动作掷骰的次数。
function rollCost(state) {
  return state && Number.isInteger(state.rollsThisTurn) ? state.rollsThisTurn : 0;
}

// 只掷，不结算；调用方必须先保存结果与待处理能力，才能展示提交后的状态。
function rollPlanarDie(state, rng, options = {}) {
  if (!state) return null;
  const effect = options.effect === true;
  const cost = effect ? 0 : rollCost(state);
  const rolled = DIE_FACES[rollInteger(1, DIE_FACES.length, rng) - 1];
  const modified = rolled === 'blank' && state.dieModifier === 'blankIsChaos';
  const face = modified ? 'chaos' : rolled;
  if (!effect) state.rollsThisTurn += 1;
  state.lastRoll = { face, rolled, cost, modified, source: effect ? 'effect' : 'special' };
  return state.lastRoll;
}

function phenomenonModifierFor(index) {
  const row = PLANECHASE_CARDS[index];
  if (!row || !isPhenomenonRow(row)) return 'none';
  return planarActionFor(index) === 'aether' ? 'blankIsChaos' : 'none';
}

// CR 901.11：把面朝上的牌置于牌库底，翻开牌库顶。
//
// 乙太混沦的持续时间是「直到有牌手时空换出任一**时空**」（英文 oracle：
// "until a player planeswalks away from a plane"）——异象自身那次自动换出
// 离开的是异象、不是时空，**因此不结束它**。这一条极易写反。
function planeswalk(state) {
  if (!state || !state.planarDeck.length) return null;

  const leftAPlane = state.activePlanes.some((index) => !isPhenomenonRow(PLANECHASE_CARDS[index]));
  if (leftAPlane) state.dieModifier = 'none';

  state.activePlanes.forEach((index) => state.planarDeck.push(index));
  const next = state.planarDeck.shift();
  state.activePlanes = [next];
  state.pending = isPhenomenonRow(PLANECHASE_CARDS[next]) ? 'encounter' : null;
  return next;
}

// 单个未复制遭遇触发的便捷内核。页面使用 session 分开记录能力与状态动作，
// 不能拿这个函数直接结算仍有同源触发留在堆叠的异象。
function resolveEncounter(state, options = {}) {
  if (!state || state.pending !== 'encounter') return null;
  // 遭遇触发被反击时仍会离开异象，但不能执行其效果（CR 704.6f）。
  if (options.resolveAbility !== false) {
    const modifier = phenomenonModifierFor(state.activePlanes[0]);
    if (modifier !== 'none') state.dieModifier = modifier;
  }
  state.pending = null;
  return planeswalk(state);
}

// 「展示到第 n 张时空牌为止」：境界交融要两张，艾蕾侬与撒维尼亚各要一张。
// 只返回展示结果，不改牌库——怎么处置由玩家在界面上决定。
function revealUntilPlanes(state, count) {
  if (!state || !Array.isArray(state.planarDeck)) return [];
  const wanted = Math.max(1, Math.trunc(Number(count) || 0) || 1);
  const revealed = [];
  let found = 0;
  for (let i = 0; i < state.planarDeck.length && found < wanted; i += 1) {
    const index = state.planarDeck[i];
    revealed.push(index);
    if (!isPhenomenonRow(PLANECHASE_CARDS[index])) found += 1;
  }
  return revealed;
}

// 把展示出的牌里的时空牌设为当前时空，其余置底。境界交融走这条。
function planeswalkTo(state, indices, options = {}) {
  if (!state || !Array.isArray(indices) || !indices.length) return null;
  if (!isDeckSelection(state, indices)) return null;
  const chosen = indices.filter((index) => !isPhenomenonRow(PLANECHASE_CARDS[index]));
  if (!chosen.length) return null;

  const rest = indices.filter((index) => chosen.indexOf(index) < 0);
  const orderedRest = options.bottomOrder || rest;
  if (!isPermutation(orderedRest, rest)) return null;
  // 树种核心不换出任何「时空」；若旧来源在异象期间结算，异象仍需换出。
  const append = options.append === true && state.activePlanes.every((index) => !isPhenomenonRow(PLANECHASE_CARDS[index]));

  const leftAPlane = state.activePlanes.some((index) => !isPhenomenonRow(PLANECHASE_CARDS[index]));
  if (leftAPlane && !append) state.dieModifier = 'none';

  const taken = new Set(indices);
  state.planarDeck = state.planarDeck.filter((index) => !taken.has(index));
  if (!append) state.activePlanes.forEach((index) => state.planarDeck.push(index));
  orderedRest.forEach((index) => state.planarDeck.push(index));
  state.activePlanes = append ? state.activePlanes.concat(chosen) : chosen.slice();
  state.pending = null;
  return state.activePlanes.slice();
}

function isPermutation(items, expected) {
  return Array.isArray(items) && items.length === expected.length
    && new Set(items).size === items.length && items.every((index) => expected.includes(index));
}

function isDeckSelection(state, indices) {
  return Boolean(state && Array.isArray(state.planarDeck) && Array.isArray(indices)
    && indices.length && new Set(indices).size === indices.length
    && indices.every((index) => Number.isInteger(index) && cardAt(index) && state.planarDeck.includes(index)));
}

// 撒维尼亚：仅展示牌的混沌触发，牌本身不换入；触发结算前展示牌已全部置底。
function bottomRevealed(state, indices, order = indices) {
  if (!isDeckSelection(state, indices) || !isPermutation(order, indices)) return false;
  const taken = new Set(indices);
  state.planarDeck = state.planarDeck.filter((index) => !taken.has(index)).concat(order);
  return true;
}

function planarActionFor(index) {
  const row = PLANECHASE_CARDS[index];
  return row ? PLANAR_ACTIONS[row[6]] || '' : '';
}

// 新回合：费用归零。骰面修正不在此清除——它只由「换出一个时空」结束。
function endTurn(state) {
  if (!state) return state;
  state.rollsThisTurn = 0;
  state.lastRoll = null;
  return state;
}

function setDieModifier(state, modifier) {
  if (!state) return state;
  state.dieModifier = modifier === 'blankIsChaos' ? 'blankIsChaos' : 'none';
  return state;
}

function cloneGame(state) {
  if (!state) return null;
  return {
    playerCount: state.playerCount,
    planarDeck: state.planarDeck.slice(),
    activePlanes: state.activePlanes.slice(),
    dieModifier: state.dieModifier,
    rollsThisTurn: state.rollsThisTurn,
    pending: state.pending,
    trimmed: (state.trimmed || []).slice(),
    limits: Object.assign({}, state.limits),
    lastRoll: state.lastRoll ? Object.assign({}, state.lastRoll) : null,
  };
}

module.exports = {
  DIE_FACES,
  BLANK_IS_CHAOS_PATTERN,
  CHAOS_LINE_PATTERN,
  cardAt,
  cardCount,
  planarDeckLimits,
  buildPlanarDeck,
  createGame,
  revealStartingPlane,
  rollCost,
  rollPlanarDie,
  planeswalk,
  resolveEncounter,
  revealUntilPlanes,
  planeswalkTo,
  bottomRevealed,
  planarActionFor,
  isPermutation,
  endTurn,
  setDieModifier,
  cloneGame,
};
