const crypto = require('crypto');
const cloud = require('wx-server-sdk');
const { createService } = require('./service');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
let privateConfig = {};
try { privateConfig = require('./runtime-secrets.json'); } catch (_) { /* Optional when environment variables are configured. */ }
let seed = null;
try { seed = require('./seed.json'); } catch (_) { /* First deployment can start without a seed. */ }
let history = [];
try { history = require('./history.json'); } catch (_) { /* Historical backfill is optional. */ }
function matches(value, expected) {
  if (typeof value !== 'string' || typeof expected !== 'string' || expected.length < 32) return false;
  const left = Buffer.from(value); const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
exports.main = async (event = {}) => {
  const service = createService({ db: cloud.database(), seed, key: process.env.TOPDECK_API_KEY || privateConfig.topdeckKey });
  try {
    if (event.action === 'get') return { ok: true, data: await service.current(event.period) };
    const context = cloud.getWXContext();
    if (context.SOURCE !== 'wx_trigger' && !matches(event.adminToken, process.env.META_ADMIN_TOKEN || privateConfig.adminToken)) return { ok: false, code: 'FORBIDDEN' };
    if (context.SOURCE === 'wx_trigger') await service.recordTrigger();
    if (event.action === 'status') return { ok: true, data: await service.status() };
    if (event.action === 'seed') {
      if (!seed) return { ok: false, code: 'NO_SEED' };
      for (const snapshot of history) await service.publish(snapshot);
      await service.publish(seed);
      return { ok: true, data: { status: 'seeded', period: seed.period, hash: seed.hash } };
    }
    if (event.action && event.action !== 'tick') return { ok: false, code: 'INVALID_ACTION' };
    return { ok: true, data: await service.tick({ force: event.force === true }) };
  } catch (error) {
    const code = /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'SERVICE_UNAVAILABLE';
    // Never log event, headers, request body or SDK errors that can contain credentials.
    console.error('META_MONTHLY', code);
    return { ok: false, code };
  }
};
