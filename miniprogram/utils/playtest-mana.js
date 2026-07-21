// 试玩法术力池纯逻辑：五色 + 无色增减、状态机、持久化（wx.setStorageSync）。
// 页面只做渲染与手势，所有规则集中在这里以便 Node 测试。

const MANA_COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];

const MANA_STORAGE_KEY = 'playtest-mana-pool';
const { readStorage, writeStorage } = require('./storage');

function createManaPool() {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

function addMana(pool, color, amount) {
  if (amount === undefined) amount = 1;
  if (!MANA_COLORS.includes(color) || !Number.isFinite(amount) || amount <= 0) return false;
  pool[color] = Math.min(99, pool[color] + Math.floor(amount));
  return true;
}

function removeMana(pool, color, amount) {
  if (amount === undefined) amount = 1;
  if (!MANA_COLORS.includes(color) || !Number.isFinite(amount) || amount <= 0) return false;
  pool[color] = Math.max(0, pool[color] - Math.floor(amount));
  return true;
}

function resetManaPool(pool) {
  MANA_COLORS.forEach((c) => { pool[c] = 0; });
  return pool;
}

function hasMana(pool) {
  return MANA_COLORS.some((c) => pool[c] > 0);
}

function totalMana(pool) {
  return MANA_COLORS.reduce((sum, c) => sum + pool[c], 0);
}

function saveManaPool(pool) {
  return writeStorage(MANA_STORAGE_KEY, { ...pool }, {
    schemaVersion: 1,
    validate: isManaPool,
  }).ok;
}

function loadManaPool() {
  const stored = readStorage(MANA_STORAGE_KEY, {
    schemaVersion: 1,
    defaultValue: null,
    validate: (value) => Boolean(value && typeof value === 'object'),
  });
  const pool = createManaPool();
  if (!stored.value) return pool;
  MANA_COLORS.forEach((c) => {
    const value = Number(stored.value[c]);
    if (Number.isFinite(value)) pool[c] = Math.max(0, Math.min(99, Math.floor(value)));
  });
  return pool;
}

function isManaPool(pool) {
  return Boolean(pool && typeof pool === 'object' && MANA_COLORS.every((color) => (
    Number.isFinite(pool[color]) && pool[color] >= 0 && pool[color] <= 99
  )));
}

module.exports = {
  MANA_COLORS,
  createManaPool,
  addMana,
  removeMana,
  resetManaPool,
  hasMana,
  totalMana,
  saveManaPool,
  loadManaPool,
};
