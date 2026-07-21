const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STORAGE_MARKER,
  readStorage,
  removeStorage,
  writeStorage,
} = require('../miniprogram/utils/storage');

function createMemoryStorage(initial = {}) {
  const values = { ...initial };
  return {
    values,
    getStorageSync(key) { return values[key]; },
    setStorageSync(key, value) { values[key] = value; },
    removeStorageSync(key) { delete values[key]; },
  };
}

test('统一存储写入版本 envelope 并能无损读取', () => {
  const api = createMemoryStorage();
  const value = { decks: [{ id: 'deck-1' }] };

  assert.equal(writeStorage('tracker', value, {
    api,
    schemaVersion: 2,
    now: () => 123,
  }).ok, true);
  assert.deepEqual(api.values.tracker, {
    __storage: STORAGE_MARKER,
    schemaVersion: 2,
    updatedAt: 123,
    data: value,
  });

  const loaded = readStorage('tracker', {
    api,
    schemaVersion: 2,
    defaultValue: null,
    validate: (data) => Array.isArray(data.decks),
  });
  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, 'envelope');
  assert.deepEqual(loaded.value, value);
});

test('历史裸值首次读取自动升级，不丢失现有用户数据', () => {
  const legacy = { profile: { tempo: 3 }, recommendations: [] };
  const api = createMemoryStorage({ quizResult: legacy });
  const loaded = readStorage('quizResult', {
    api,
    schemaVersion: 1,
    defaultValue: null,
    validate: (data) => Array.isArray(data.recommendations),
    now: () => 456,
  });

  assert.equal(loaded.ok, true);
  assert.equal(loaded.source, 'legacy');
  assert.equal(loaded.upgraded, true);
  assert.deepEqual(loaded.value, legacy);
  assert.equal(api.values.quizResult.__storage, STORAGE_MARKER);
  assert.deepEqual(api.values.quizResult.data, legacy);
});

test('迁移、校验与未来版本都有安全回退', () => {
  const api = createMemoryStorage({
    old: { __storage: STORAGE_MARKER, schemaVersion: 1, updatedAt: 1, data: { count: 2 } },
    invalid: { nope: true },
    future: { __storage: STORAGE_MARKER, schemaVersion: 9, updatedAt: 1, data: { count: 9 } },
  });

  const migrated = readStorage('old', {
    api,
    schemaVersion: 2,
    defaultValue: { count: 0 },
    migrate: (data) => ({ count: data.count, migrated: true }),
    validate: (data) => Number.isFinite(data.count),
  });
  assert.deepEqual(migrated.value, { count: 2, migrated: true });
  assert.equal(api.values.old.schemaVersion, 2);

  const invalid = readStorage('invalid', {
    api,
    defaultValue: { count: 0 },
    validate: (data) => Number.isFinite(data.count),
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.source, 'invalid');
  assert.deepEqual(invalid.value, { count: 0 });

  const future = readStorage('future', {
    api,
    schemaVersion: 2,
    defaultValue: { count: 0 },
  });
  assert.equal(future.ok, false);
  assert.equal(future.source, 'future');
  assert.equal(api.values.future.schemaVersion, 9);
  assert.equal(writeStorage('future', { count: 2 }, { api, schemaVersion: 2 }).ok, false);
  assert.equal(api.values.future.schemaVersion, 9);
});

test('非法 schema 版本被拒绝并安全回退', () => {
  const api = createMemoryStorage({
    badVersion: { __storage: STORAGE_MARKER, schemaVersion: 'broken', data: { valid: true } },
  });
  const loaded = readStorage('badVersion', { api, defaultValue: null });
  assert.equal(loaded.ok, false);
  assert.equal(loaded.source, 'invalid');
  assert.equal(loaded.value, null);
  assert.equal(writeStorage('new', { valid: true }, { api, schemaVersion: 0 }).ok, false);
  assert.equal(writeStorage('new', { valid: true }, { api, schemaVersion: 'broken' }).ok, false);
});

test('存储 API 抛错时不让页面崩溃，并报告失败', () => {
  const api = {
    getStorageSync() { throw new Error('read'); },
    setStorageSync() { throw new Error('write'); },
    removeStorageSync() { throw new Error('remove'); },
  };

  assert.equal(readStorage('key', { api, defaultValue: 'safe' }).value, 'safe');
  assert.equal(readStorage('key', { api, defaultValue: 'safe' }).ok, false);
  assert.equal(writeStorage('key', 'value', { api }).ok, false);
  assert.equal(removeStorage('key', { api }).ok, false);
});

test('删除存储成功后不会残留 envelope', () => {
  const api = createMemoryStorage({ key: { value: true } });
  assert.equal(removeStorage('key', { api }).ok, true);
  assert.equal(Object.prototype.hasOwnProperty.call(api.values, 'key'), false);
});
