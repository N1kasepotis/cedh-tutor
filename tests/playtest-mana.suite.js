// 试玩法力池纯逻辑测试
const assert = require('node:assert');
const test = require('node:test');
const {
  MANA_COLORS,
  createManaPool,
  addMana,
  removeMana,
  resetManaPool,
  hasMana,
  totalMana,
} = require('../miniprogram/utils/playtest-mana');

test('createManaPool 六色从零开始', () => {
  const pool = createManaPool();
  assert.deepStrictEqual(pool, { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
});

test('addMana 基本增加与上限', () => {
  const pool = createManaPool();
  assert.ok(addMana(pool, 'G'));
  assert.equal(pool.G, 1);
  assert.ok(addMana(pool, 'G', 5));
  assert.equal(pool.G, 6);

  pool.C = 99;
  assert.ok(addMana(pool, 'C'));
  assert.equal(pool.C, 99);
});

test('addMana 拒绝非法颜色与负数', () => {
  const pool = createManaPool();
  assert.ok(!addMana(pool, 'X'));
  assert.ok(!addMana(pool, 'W', -1));
  assert.ok(!addMana(pool, 'W', 0));
  assert.equal(pool.W, 0);
});

test('removeMana 扣减不低于零', () => {
  const pool = createManaPool();
  pool.R = 3;
  assert.ok(removeMana(pool, 'R'));
  assert.equal(pool.R, 2);
  removeMana(pool, 'R', 5);
  assert.equal(pool.R, 0);
});

test('resetManaPool 归零全部', () => {
  const pool = { W: 3, U: 2, B: 1, R: 4, G: 5, C: 0 };
  resetManaPool(pool);
  assert.equal(totalMana(pool), 0);
});

test('hasMana 检测非零', () => {
  const pool = createManaPool();
  assert.ok(!hasMana(pool));
  pool.C = 1;
  assert.ok(hasMana(pool));
});

test('totalMana 求和', () => {
  const pool = { W: 2, U: 3, B: 0, R: 1, G: 4, C: 0 };
  assert.equal(totalMana(pool), 10);
});

test('MANA_COLORS 六色顺序正确', () => {
  assert.deepStrictEqual(MANA_COLORS, ['W', 'U', 'B', 'R', 'G', 'C']);
});
