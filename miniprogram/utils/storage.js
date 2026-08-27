// 微信同步存储的统一边界。
// - 新数据使用带版本的 envelope，便于以后迁移。
// - 读取时兼容历史裸值，不因升级丢失用户已有数据。
// - 所有 API 都返回结果对象，不把存储异常扩散到页面生命周期。

const STORAGE_MARKER = 'cedh-storage';
const DEFAULT_SCHEMA_VERSION = 1;

function storageError(code, cause) {
  const error = new Error(code);
  error.code = code;
  error.cause = cause || null;
  return error;
}

function getStorageApi(api) {
  if (api) return api;
  if (typeof wx !== 'undefined') return wx;
  return null;
}

function createEnvelope(value, schemaVersion, now) {
  const version = Number(schemaVersion === undefined ? DEFAULT_SCHEMA_VERSION : schemaVersion);
  return {
    __storage: STORAGE_MARKER,
    schemaVersion: Number.isInteger(version) && version > 0 ? version : DEFAULT_SCHEMA_VERSION,
    updatedAt: typeof now === 'function' ? now() : Date.now(),
    data: value,
  };
}

function isEnvelope(value) {
  return Boolean(value
    && typeof value === 'object'
    && value.__storage === STORAGE_MARKER
    && Object.prototype.hasOwnProperty.call(value, 'data'));
}

// 校验函数是各页自己写的，读盘时喂给它的又是磁盘上的任意内容（可能损坏、
// 可能是未来版本的形状）。写得不够防御的校验器（`(v) => v.answers && ...`
// 这种）碰上 null 就会抛，而这个模块的契约是「返回显式结果，不抛」——
// 一抛就绕过了整套失败处理，页面拿不到 ok:false，也就不会提示用户。
// 同一个函数里 migrate 早就是包起来的，validate 漏包属于不一致。
// 抛出等同于判否：数据可疑就当它不可用，而不是让异常冒到调用栈上。
function runValidate(validate, value) {
  if (typeof validate !== 'function') return true;
  try {
    return Boolean(validate(value));
  } catch (cause) {
    return false;
  }
}

function writeStorage(key, value, options = {}) {
  const api = getStorageApi(options.api);
  if (!api || typeof api.setStorageSync !== 'function') {
    return { ok: false, error: storageError('storage_unavailable') };
  }

  if (!runValidate(options.validate, value)) {
    return { ok: false, error: storageError('invalid_storage_value') };
  }

  const targetVersion = Number(options.schemaVersion === undefined
    ? DEFAULT_SCHEMA_VERSION
    : options.schemaVersion);
  if (!options.raw && (!Number.isInteger(targetVersion) || targetVersion < 1)) {
    return { ok: false, error: storageError('invalid_storage_version') };
  }

  try {
    // 防止旧版应用覆盖由新版应用写下的未来版本数据。
    if (!options.raw && typeof api.getStorageSync === 'function') {
      const existing = api.getStorageSync(key);
      if (isEnvelope(existing) && Number(existing.schemaVersion) > targetVersion) {
        return { ok: false, error: storageError('unsupported_storage_version') };
      }
    }
    const storedValue = options.raw
      ? value
      : createEnvelope(value, targetVersion, options.now);
    api.setStorageSync(key, storedValue);
    return { ok: true, value };
  } catch (cause) {
    return { ok: false, error: storageError('storage_write_failed', cause) };
  }
}

function readStorage(key, options = {}) {
  const api = getStorageApi(options.api);
  const fallback = options.defaultValue;
  if (!api || typeof api.getStorageSync !== 'function') {
    return { ok: false, value: fallback, source: 'unavailable', error: storageError('storage_unavailable') };
  }

  let stored;
  try {
    stored = api.getStorageSync(key);
  } catch (cause) {
    return { ok: false, value: fallback, source: 'error', error: storageError('storage_read_failed', cause) };
  }

  if (stored === undefined || stored === null || stored === '') {
    return { ok: true, value: fallback, source: 'empty' };
  }

  const enveloped = isEnvelope(stored);
  const storedVersion = enveloped ? Number(stored.schemaVersion) : 0;
  const currentVersion = Number(options.schemaVersion === undefined
    ? DEFAULT_SCHEMA_VERSION
    : options.schemaVersion);
  if (!Number.isInteger(currentVersion) || currentVersion < 1
    || (enveloped && (!Number.isInteger(storedVersion) || storedVersion < 1))) {
    return { ok: false, value: fallback, source: 'invalid', error: storageError('invalid_storage_version') };
  }
  if (enveloped && storedVersion > currentVersion) {
    return {
      ok: false,
      value: fallback,
      source: 'future',
      error: storageError('unsupported_storage_version'),
    };
  }

  let value = enveloped ? stored.data : stored;
  try {
    if (typeof options.migrate === 'function' && storedVersion < currentVersion) {
      value = options.migrate(value, storedVersion, currentVersion);
    }
  } catch (cause) {
    return { ok: false, value: fallback, source: 'invalid', error: storageError('storage_migration_failed', cause) };
  }

  if (!runValidate(options.validate, value)) {
    return { ok: false, value: fallback, source: 'invalid', error: storageError('invalid_storage_value') };
  }

  // 成功读取历史裸值或旧版本后，尽力升级；升级失败不影响本次读取。
  let upgraded = false;
  if (options.autoUpgrade !== false && (!enveloped || storedVersion < currentVersion)) {
    upgraded = writeStorage(key, value, {
      api,
      schemaVersion: currentVersion,
      validate: options.validate,
      now: options.now,
    }).ok;
  }

  return {
    ok: true,
    value,
    source: enveloped ? 'envelope' : 'legacy',
    upgraded,
  };
}

function removeStorage(key, options = {}) {
  const api = getStorageApi(options.api);
  if (!api || typeof api.removeStorageSync !== 'function') {
    return { ok: false, error: storageError('storage_unavailable') };
  }

  try {
    api.removeStorageSync(key);
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: storageError('storage_remove_failed', cause) };
  }
}

module.exports = {
  STORAGE_MARKER,
  DEFAULT_SCHEMA_VERSION,
  createEnvelope,
  isEnvelope,
  readStorage,
  writeStorage,
  removeStorage,
};
