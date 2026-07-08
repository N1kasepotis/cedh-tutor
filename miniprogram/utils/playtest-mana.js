// 试玩法力池纯逻辑：五色 + 无色增减、状态机、持久化（wx.setStorageSync）。
// 页面只做渲染与手势，所有规则集中在这里以便 Node 测试。

const MANA_COLORS = ['W', 'U', 'B', 'R', 'G', 'C'];

const MANA_STORAGE_KEY = 'playtest-mana-pool';

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
  try { wx.setStorageSync(MANA_STORAGE_KEY, { ...pool }); } catch (_) { /* noop */ }
}

function loadManaPool() {
  try {
    const saved = wx.getStorageSync(MANA_STORAGE_KEY);
    if (saved && typeof saved === 'object') {
      const pool = createManaPool();
      MANA_COLORS.forEach((c) => {
        if (typeof saved[c] === 'number') pool[c] = Math.max(0, Math.min(99, saved[c]));
      });
      return pool;
    }
  } catch (_) { /* noop */ }
  return createManaPool();
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
