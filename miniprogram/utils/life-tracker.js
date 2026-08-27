const { lifeTrackerConfig } = require('../config/life-tracker');

function clampLife(value) {
  const numeric = Math.round(Number(value) || 0);
  return Math.max(lifeTrackerConfig.minLife, Math.min(lifeTrackerConfig.maxLife, numeric));
}

function normalizePlayerCount(value) {
  const count = Number(value);
  return lifeTrackerConfig.playerCountOptions.includes(count)
    ? count
    : lifeTrackerConfig.playerCount;
}

function initialLifeFor(playerCount) {
  const overrides = lifeTrackerConfig.initialLifeByPlayerCount || {};
  const life = overrides[normalizePlayerCount(playerCount)];
  return Number.isInteger(life) ? life : lifeTrackerConfig.initialLife;
}

function shuffledColorKeys(rng = Math.random, playerCount = lifeTrackerConfig.playerCount) {
  const keys = lifeTrackerConfig.colors.map((color) => color.key);
  for (let index = keys.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.max(0, Math.min(0.999999, Number(rng()) || 0)) * (index + 1));
    [keys[index], keys[target]] = [keys[target], keys[index]];
  }
  return keys.slice(0, normalizePlayerCount(playerCount));
}

// 座位朝向：'top' / 'bottom' / 'right'，即这个人坐在屏幕的哪条边。
// 表里缺项时回退成「首位坐上边、其余坐下边」，也就是加侧坐之前的老行为——
// 这样 seatFacing 万一被改坏，页面还是能用，只是五人局的侧位不再侧着。
function seatFacingFor(playerCount, seatIndex) {
  const table = lifeTrackerConfig.seatFacing || {};
  const facings = table[normalizePlayerCount(playerCount)];
  const facing = Array.isArray(facings) ? facings[seatIndex] : null;
  if (facing === 'top' || facing === 'bottom' || facing === 'right') return facing;
  return seatIndex === 0 ? 'top' : 'bottom';
}

// 围坐一圈的座位顺序（顺时针）。表里缺项时回退成 DOM 顺序——
// 那不是真的围坐顺序，但至少每个人都会被跑到一次，不会漏人。
function seatRingFor(playerCount) {
  const count = normalizePlayerCount(playerCount);
  const ring = (lifeTrackerConfig.seatRing || {})[count];
  const valid = Array.isArray(ring)
    && ring.length === count
    && new Set(ring).size === count
    && ring.every((seat) => Number.isInteger(seat) && seat >= 1 && seat <= count);
  return valid ? ring.slice() : Array.from({ length: count }, (_, index) => index + 1);
}

// 先手由 rng 均匀抽出，**再**倒推动画要跑多少步。
//
// 反过来做（先定步数、看它落在谁头上）看着更「自然」，但概率会依赖节奏参数——
// 改一下 laps 或 easing 就悄悄改了公平性，而且没法测。抽签必须是可验证均匀的，
// 动画只是把一个已经定下来的结果演出来。
function pickFirstPlayerId(state, rng = Math.random) {
  const players = state && Array.isArray(state.players) ? state.players : [];
  if (!players.length) return null;
  const roll = Math.max(0, Math.min(0.999999, Number(rng()) || 0));
  return players[Math.floor(roll * players.length)].id;
}

// 生成赛跑序列：每一步点亮哪个座位、停留多久。
// 序列最后一项必然是中签者——步数就是按这个倒推出来的。
function buildFirstPlayerRace(playerCount, winnerId, options = {}) {
  const ring = seatRingFor(playerCount);
  const size = ring.length;
  const winnerIndex = ring.indexOf(Number(winnerId));
  if (size < 2 || winnerIndex < 0) return { sequence: [], delays: [] };

  const config = { ...(lifeTrackerConfig.firstPlayerRace || {}), ...options };
  const laps = Math.max(1, Math.round(Number(config.laps) || 1));
  const minStep = Math.max(1, Number(config.minStepMs) || 1);
  const maxStep = Math.max(minStep, Number(config.maxStepMs) || minStep);
  const easing = Math.max(1, Number(config.easing) || 1);

  // 固定从环首起跑。起点随机没有增益——中签者已经是均匀抽的，随机起点只会让
  // 「跑了多久」这件事在两局之间莫名其妙地抖。
  const steps = laps * size + winnerIndex;
  const sequence = [];
  for (let step = 0; step <= steps; step += 1) sequence.push(ring[step % size]);

  const span = Math.max(1, steps);
  const delays = sequence.map((_, index) => Math.round(
    minStep + (maxStep - minStep) * ((index / span) ** easing),
  ));
  return { sequence, delays };
}

// 某一步的亮度分布：头部最亮，往回递减成一条彗尾。
// 只亮一格的话，快段就是纯闪烁；有尾巴才读得出「一道光在跑」。
function raceLevelsAt(sequence, index, trail) {
  const levels = {};
  const depth = Math.max(0, Math.round(Number(trail) || 0));
  for (let back = 0; back <= depth; back += 1) {
    const at = index - back;
    if (at < 0) break;
    const seatId = sequence[at];
    if (seatId === undefined) break;
    const level = depth + 1 - back;
    // 座位少于尾长时同一格会被扫到两次，取最亮的那次
    if (!levels[seatId] || levels[seatId] < level) levels[seatId] = level;
  }
  return levels;
}

function setFirstPlayer(state, playerId) {
  if (!state || !Array.isArray(state.players)) return state;
  const id = Number(playerId);
  const exists = state.players.some((player) => player.id === id);
  return { ...state, firstPlayerId: exists ? id : null };
}

function normalizePlayerName(value, index) {
  const name = String(value || '').trim().slice(0, 12);
  return name || `玩家 ${index + 1}`;
}

function createLifeTrackerState(options = {}) {
  const names = Array.isArray(options.names) ? options.names : [];
  const playerCount = normalizePlayerCount(options.playerCount);
  const colorKeys = shuffledColorKeys(options.rng, playerCount);
  return {
    playerCount,
    // 新开一局还没抽先手。重置与切人数都走这里，所以先手会跟着一起清掉——
    // 那正是「新的一局」该有的样子。
    firstPlayerId: null,
    players: Array.from({ length: playerCount }, (_, index) => ({
      id: index + 1,
      name: normalizePlayerName(names[index], index),
      life: initialLifeFor(playerCount),
      colorKey: colorKeys[index],
    })),
  };
}

function resetLifeTrackerState(state, rng = Math.random) {
  const players = state && Array.isArray(state.players) ? state.players : [];
  return createLifeTrackerState({
    names: players.map((player) => player && player.name),
    playerCount: state && (state.playerCount || players.length),
    rng,
  });
}

// 切换人数 = 按新人数重开对局；已有座位名按序保留，多出的座位用默认名。
function setLifeTrackerPlayerCount(state, playerCount, rng = Math.random) {
  const players = state && Array.isArray(state.players) ? state.players : [];
  return createLifeTrackerState({
    names: players.map((player) => player && player.name),
    playerCount,
    rng,
  });
}

function changePlayerLife(state, playerId, delta) {
  if (!state || !Array.isArray(state.players)) return state;
  return {
    ...state,
    players: state.players.map((player) => player.id === Number(playerId)
      ? { ...player, life: clampLife(player.life + Number(delta || 0)) }
      : player),
  };
}

function renamePlayer(state, playerId, name) {
  if (!state || !Array.isArray(state.players)) return state;
  const index = state.players.findIndex((player) => player.id === Number(playerId));
  if (index < 0) return state;
  const players = state.players.slice();
  players[index] = { ...players[index], name: normalizePlayerName(name, index) };
  return { ...state, players };
}

// playerCount 字段可缺省（旧版四人存档），缺省时以 players.length 为准；有则必须与人数一致。
function isLifeTrackerState(value) {
  if (!value || !Array.isArray(value.players)) return false;
  const declaredCount = value.playerCount === undefined
    ? value.players.length
    : Number(value.playerCount);
  if (!lifeTrackerConfig.playerCountOptions.includes(declaredCount)) return false;
  if (value.players.length !== declaredCount) return false;
  // 先手可以没有（没抽过、或旧存档），有就必须是本局真实存在的座位号。
  // 存了个越界的 id 会让那条常驻边永远不显示，而且不报错——正是最难查的那类。
  const firstPlayerId = value.firstPlayerId;
  if (firstPlayerId !== undefined && firstPlayerId !== null
    && !(Number.isInteger(firstPlayerId) && firstPlayerId >= 1 && firstPlayerId <= declaredCount)) {
    return false;
  }
  const colors = new Set(lifeTrackerConfig.colors.map((color) => color.key));
  return Boolean(value.players.every((player, index) => player
    && player.id === index + 1
    && typeof player.name === 'string'
    && player.name.length > 0
    && Number.isInteger(player.life)
    && player.life >= lifeTrackerConfig.minLife
    && player.life <= lifeTrackerConfig.maxLife
    && colors.has(player.colorKey))
    && new Set(value.players.map((player) => player.colorKey)).size === declaredCount);
}

module.exports = {
  clampLife,
  normalizePlayerCount,
  initialLifeFor,
  shuffledColorKeys,
  seatFacingFor,
  seatRingFor,
  pickFirstPlayerId,
  buildFirstPlayerRace,
  raceLevelsAt,
  setFirstPlayer,
  createLifeTrackerState,
  resetLifeTrackerState,
  setLifeTrackerPlayerCount,
  changePlayerLife,
  renamePlayer,
  isLifeTrackerState,
};
