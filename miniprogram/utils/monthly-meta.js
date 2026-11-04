const { readStorage, writeStorage } = require('./storage');
const { metaTierEntries } = require('../config/meta-tier');
const config = require('../config/community');
const CACHE_KEY = 'metaMonthlyCache';
const TTL = 6 * 60 * 60 * 1000;
const TIERS = [
  { id: 't1', label: '领先', hint: '区间高于基准', rgb: '100, 185, 165' },
  { id: 't2', label: '竞争', hint: '区间覆盖基准', rgb: '150, 160, 168' },
  { id: 't3', label: '承压', hint: '区间低于基准', rgb: '216, 183, 106' },
  { id: 'watch', label: '观察中', hint: '继续积累样本', rgb: '143, 144, 148' },
];
const chineseNames = {};
metaTierEntries.forEach((entry) => (entry.commanders || []).forEach((card) => { if (card.cn) chineseNames[card.en] = card.cn; }));
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const rate = (value) => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
function validSnapshot(value) {
  if (!value || value.schemaVersion !== 1 || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(value.period)
    || !/^[a-f0-9]{64}$/.test(value.hash) || !value.coverage || !value.model
    || !value.source || value.source.url !== 'https://topdeck.gg'
    || !Array.isArray(value.entries) || value.entries.length > 1000 || !Array.isArray(value.events)) return false;
  if (!count(value.coverage.entries) || !count(value.coverage.events) || !rate(value.coverage.leaderCoverage)
    || !Number.isFinite(Date.parse(value.asOf)) || !Number.isFinite(Date.parse(value.fetchedAt))) return false;
  const ids = new Set(); let entries = 0;
  for (const row of value.entries) {
    if (!row || typeof row.id !== 'string' || ids.has(row.id) || !TIERS.some((tier) => tier.id === row.tier)
      || !count(row.entries) || !count(row.games) || !count(row.wins) || !count(row.cuts) || !count(row.cutEntries)
      || row.wins > row.games || row.cuts > row.cutEntries || !rate(row.winRate) || !rate(row.conversion) || !rate(row.share)
      || row.score !== null && (!Number.isFinite(row.score) || row.score < 0 || row.score > 10000)
      || !Array.isArray(row.commanders) || row.commanders.length < 1 || row.commanders.length > 2
      || row.commanders.some((card) => !card || !card.name || !/^https:\/\/cards\.scryfall\.io\//.test(card.image || ''))) return false;
    ids.add(row.id); entries += row.entries;
  }
  return entries === value.coverage.mappedEntries && entries <= value.coverage.entries;
}
function cached(api) {
  return readStorage(CACHE_KEY, { api, defaultValue: null, validate: (value) => value && validSnapshot(value.snapshot) }).value;
}
function cache(result, api, now = Date.now()) {
  return writeStorage(CACHE_KEY, { ...result, checkedAt: now }, { api, validate: (value) => value && validSnapshot(value.snapshot) });
}
function isFresh(value, now = Date.now()) { return Boolean(value && Number.isFinite(value.checkedAt) && now >= value.checkedAt && now - value.checkedAt < TTL); }
let initialized = false;
async function fetchMonthly(period, api = wx) {
  if (!api.cloud || !config.env) throw new Error('月报暂时无法连接');
  if (!initialized) { api.cloud.init({ env: config.env, traceUser: false }); initialized = true; }
  const response = await api.cloud.callFunction({ name: 'metaMonthly', data: { action: 'get', ...(period ? { period } : {}) }, timeout: 15000 });
  const result = response && response.result;
  if (!result || !result.ok || !result.data || !validSnapshot(result.data.snapshot)) throw new Error('这一期月报暂时无法读取');
  return result.data;
}
const percent = (value) => value === null ? '—' : `${value}%`;
function decorate(row) {
  const commanders = row.commanders.map((card) => ({ ...card, nameZh: chineseNames[card.name] || card.nameZh || card.name }));
  return { ...row, name: commanders.map((card) => card.nameZh).join(' + '), commanders,
    displayName: commanders.map((card) => card.nameZh === card.name ? card.name.split(',')[0] : card.nameZh).join(' + '),
    scoreLabel: row.tier === 'watch' || row.score === null ? '—' : String(row.score),
    winLabel: percent(row.winRate), conversionLabel: percent(row.conversion), shareLabel: percent(row.share),
    deltaLabel: row.delta === null || row.delta === undefined ? '' : `${row.delta > 0 ? '+' : ''}${row.delta}`,
    intervalLabel: row.interval ? `${row.interval[0]}–${row.interval[1]}` : '样本积累中' };
}
function groups(snapshot, { query = '', highSample = false, order = 'score', color = '', expandedWatch = false } = {}) {
  const needle = query.trim().toLowerCase();
  let rows = snapshot.entries.map(decorate).filter((row) => (!highSample || row.entries >= 100)
    && (!color || row.colors.includes(color))
    && (!needle || `${row.name} ${row.nameEn}`.toLowerCase().includes(needle)));
  if (order === 'entries') rows = rows.sort((a, b) => b.entries - a.entries || a.name.localeCompare(b.name));
  return TIERS.map((tier) => ({ ...tier, rows: rows.filter((row) => row.tier === tier.id).map((row) => ({
    id: row.id, name: row.name, displayName: row.displayName, entries: row.entries,
    scoreLabel: row.scoreLabel, deltaLabel: row.deltaLabel, tier: row.tier,
    winLabel: row.winLabel, conversionLabel: row.conversionLabel,
    commanders: row.commanders.map(({ oracleId, image }) => ({ oracleId, image })),
  })), expanded: tier.id !== 'watch' || expandedWatch }))
    .filter((tier) => tier.rows.length);
}
module.exports = { TIERS, validSnapshot, cached, cache, isFresh, fetchMonthly, decorate, groups };
