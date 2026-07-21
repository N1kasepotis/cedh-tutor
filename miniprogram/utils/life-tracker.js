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
  createLifeTrackerState,
  resetLifeTrackerState,
  setLifeTrackerPlayerCount,
  changePlayerLife,
  renamePlayer,
  isLifeTrackerState,
};
