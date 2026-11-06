const { readStorage, writeStorage } = require('./storage');
const config = require('../config/community');

// 首页月报入口的“X月X日更新”。首页只问云函数最新一期是哪个月、什么时候发布（几十字节），
// 不拉五百多 KB 的整份月报；赛事月报页拉到最新一期时顺手记一份，首页就不用再问。
const LATEST_KEY = 'metaMonthlyLatest';
// 和月报页的缓存同一个节奏。月报每月发一次，晚几个小时看到新日期没有关系
const TTL = 6 * 60 * 60 * 1000;
// 用户在国内，日期按北京时间算，云端的定时任务也按北京时间排
const BEIJING_OFFSET = 8 * 60 * 60 * 1000;
const PERIOD = /^20\d{2}-(0[1-9]|1[0-2])$/;
// 月报 2026 年 11 月上线，更早的时间戳只可能是坏数据
const EARLIEST = Date.UTC(2026, 10, 1);

const validTime = (value) => typeof value === 'number' && Number.isFinite(value) && value >= EARLIEST;

function validLatest(value) {
  return Boolean(value && PERIOD.test(value.latestPeriod)
    && (value.publishedAt === null || validTime(value.publishedAt))
    && Number.isFinite(value.checkedAt));
}

function updatedLabel(publishedAt) {
  if (!validTime(publishedAt)) return '';
  const date = new Date(publishedAt + BEIJING_OFFSET);
  return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日更新`;
}

function readLatest(api) {
  return readStorage(LATEST_KEY, { api, defaultValue: null, validate: validLatest }).value;
}

// 月报页拿到最新一期时调用。旧版云函数不带发布时间，这时什么都不记
function remember(result, api, now = Date.now()) {
  if (!result || !PERIOD.test(result.latestPeriod) || !validTime(result.publishedAt)) return false;
  const value = { latestPeriod: result.latestPeriod, publishedAt: result.publishedAt, checkedAt: now };
  return writeStorage(LATEST_KEY, value, { api, validate: validLatest }).ok;
}

function isFresh(value, now = Date.now()) {
  return Boolean(value && now >= value.checkedAt && now - value.checkedAt < TTL);
}

let initialized = false;
async function fetchLatest(api = wx) {
  if (!api.cloud || !config.env) throw new Error('UNAVAILABLE');
  if (!initialized) {
    api.cloud.init({ env: config.env, traceUser: false });
    initialized = true;
  }
  const response = await api.cloud.callFunction({ name: 'metaMonthly', data: { action: 'latest' }, timeout: 8000 });
  const result = response && response.result;
  const data = result && result.ok ? result.data : null;
  if (!data || !PERIOD.test(data.latestPeriod) || !(data.publishedAt === null || validTime(data.publishedAt))) {
    throw new Error('INVALID_LATEST');
  }
  return { latestPeriod: data.latestPeriod, publishedAt: data.publishedAt };
}

// 六小时内问过就不再问。云端还没发布过（发布时间为空）也记下检查时间，免得每次进首页都问
async function refreshLatest(api = wx, now = Date.now()) {
  if (isFresh(readLatest(api), now)) return null;
  const latest = await fetchLatest(api);
  writeStorage(LATEST_KEY, { ...latest, checkedAt: now }, { api, validate: validLatest });
  return latest;
}

module.exports = { LATEST_KEY, TTL, updatedLabel, readLatest, remember, isFresh, fetchLatest, refreshLatest };
