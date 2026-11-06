const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const https = require('node:https');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const network = require('../cloudfunctions/metaMonthly/network');
const officialNames = require('../cloudfunctions/metaMonthly/commander-names.json');
const { namesFromPage } = require('../scripts/build-commander-names');
const engine = require('../cloudfunctions/metaMonthly/engine');
const { createService, PREFIX } = require('../cloudfunctions/metaMonthly/service');
const ui = require('../miniprogram/utils/monthly-meta');
const seed = require('../cloudfunctions/metaMonthly/seed.json');
const window = engine.periodWindow('2026-10');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
function fixture(id = 'event', size = 52) {
  const standings = Array.from({ length: size }, (_, n) => ({ id: `private-${n}`, leader: 'Commander' }));
  const rounds = Array.from({ length: 4 }, (_, n) => ({ round: n + 1, tables: Array.from({ length: Math.floor(size / 4) }, (_, p) => {
    const players = standings.slice(p * 4, p * 4 + 4);
    return { status: 'Completed', players, winner_id: players[0].id };
  }) }));
  rounds.push({ round: 'Top 4', tables: [{ players: standings.slice(0, 4) }] });
  return { TID: id, tournamentName: id, game: 'Magic: The Gathering', format: 'EDH', swissNum: 4,
    topCut: 4, startDate: window.monthStart + 100, standings, rounds };
}
const info = { status: 'Complete', endDate: window.end - 100 };
function memoryDb() {
  const docs = new Map(); let writes = 0;
  const db = { docs, get writes() { return writes; }, collection() { return { doc(id) { return {
    async get() { if (!docs.has(id)) throw new Error('document does not exist'); return { data: { _id: id, ...structuredClone(docs.get(id)) } }; },
    async set({ data }) { assert.equal('_id' in data, false, 'CloudBase rejects immutable _id in set.data'); writes += 1; docs.set(id, structuredClone(data)); },
    async remove() { if (db.failRemovals) throw new Error('DATABASE_UNAVAILABLE'); docs.delete(id); return { stats: { removed: 1 } }; },
  }; } }; }, async runTransaction(fn) { return fn(db); } };
  return db;
}
test('monthly windows use UTC calendar boundaries and reject invalid periods', () => {
  assert.equal(engine.previousPeriod(Date.UTC(2027, 0, 3)), '2026-12');
  assert.equal(window.end - window.start, 90 * 86400);
  assert.throws(() => engine.periodWindow('2026-13'), /INVALID_PERIOD/);
  assert.equal(engine.normalizeEvent(fixture(), { ...info, endDate: window.end }, window).reason, 'finished_after_cutoff');
});
test('monthly derives four-seat Swiss games and distinguishes explicit draws from unknown results', () => {
  const event = fixture(); event.rounds[0].tables[0].winner_id = 'Draw';
  const result = engine.normalizeEvent(event, info, window);
  assert.equal(result.ok, true); assert.equal(result.event.records[0].draws, 1);
  assert.equal(result.event.records.reduce((n, p) => n + p.games, 0), 208);
  event.rounds[0].tables[0].winner_id = null; event.rounds[0].tables[0].winner = 'Unknown';
  assert.equal(engine.normalizeEvent(event, info, window).reason, 'unknown_result');
});
test('monthly rejects conflicting leaders, duplicate seats and specialty formats', () => {
  let event = fixture(); event.rounds[0].tables[0].players = [{ id: 'private-0', leader: 'Other' }, ...event.standings.slice(1, 4)];
  assert.equal(engine.normalizeEvent(event, info, window).reason, 'conflicting_leader');
  event = fixture(); event.rounds[0].tables[1].players[0] = event.standings[0];
  assert.equal(engine.normalizeEvent(event, info, window).reason, 'invalid_seats');
  event = fixture(); event.tournamentName = 'Precon championship';
  assert.equal(engine.normalizeEvent(event, info, window).reason, 'special_event');
});
test('monthly excludes three-seat tables and byes, verifies cut membership across all playoff rounds', () => {
  const event = fixture(); event.rounds[0].tables[0].players.pop();
  event.rounds[1].tables.push({ status: 'Bye', players: [event.standings[0]] });
  event.topCut = 8; event.rounds.push({ round: 'Finals', tables: [{ players: event.standings.slice(4, 8) }] });
  const result = engine.normalizeEvent(event, info, window).event;
  assert.equal(result.skippedSeats, 3); assert.equal(result.records[0].games, 3);
  assert.equal(result.cut, 8); assert.equal(result.records.reduce((n, p) => n + p.cut, 0), 8);
  event.topCut = 16; assert.equal(engine.normalizeEvent(event, info, window).event.cut, null);
});
test('monthly score has neutral baseline 50 and shrinks small samples', () => {
  assert.equal(engine.score(25, 100, 10, 10, 0.25, 0.1), 50);
  const small = engine.score(1, 1, 1, 0.1, 0.25, 0.1);
  const large = engine.score(100, 100, 100, 10, 0.25, 0.1);
  assert.ok(small > 50 && small < large);
  assert.equal(engine.score(0, 0, 0, 0, 0.25, 0.1), null);
});
test('monthly snapshots are deterministic, keep private pilot IDs out and reject duplicate events', () => {
  const events = ['a', 'b', 'c'].map((id) => engine.normalizeEvent(fixture(id), info, window).event);
  const cards = { commander: { oracleId: 'oracle', name: 'Commander', colors: ['U'], image: 'https://cards.scryfall.io/small/test.jpg' } };
  const input = { period: '2026-10', events, cards, fetchedAt: '2026-11-04T00:00:00Z' };
  const a = engine.buildSnapshot(input); assert.deepEqual(a, engine.buildSnapshot(input));
  assert.deepEqual(a, engine.buildSnapshot({ ...input, events: [...events].reverse() }));
  assert.equal(a.entries[0].score, 50); assert.ok(a.entries[0].interval);
  assert.equal(JSON.stringify(a).includes('private-'), false); assert.equal(JSON.stringify(a).includes('pilot"'), false);
  assert.throws(() => engine.buildSnapshot({ ...input, events: [...events, events[0]] }), /DUPLICATE_EVENTS/);
});
test('monthly frontend validates real snapshot, rejects corrupt data and projects small list fields', () => {
  assert.equal(ui.validSnapshot(seed), true);
  const bad = structuredClone(seed); bad.entries[0].wins = bad.entries[0].games + 1;
  assert.equal(ui.validSnapshot(bad), false);
  const groups = ui.groups(seed, { highSample: true, query: 'Tymna' });
  assert.ok(groups.length); const row = groups[0].rows[0];
  assert.ok(row.entries >= 100); assert.equal('sourceEvents' in row, false);
  assert.equal('normal' in row.commanders[0], false);
  assert.ok(Buffer.byteLength(JSON.stringify(ui.groups(seed))) < 50000);
  const watch = ui.groups(seed).find(group => group.id === 'watch');
  assert.ok(watch.count > 0); assert.equal(watch.rows.length, 0);
  assert.equal(ui.isFresh({ checkedAt: 100 }, 99), false);
});
test('monthly cloud get is read-only; historical publication cannot roll back current pointer', async () => {
  const db = memoryDb(); const service = createService({ db, seed });
  assert.equal((await service.current()).snapshot.hash, seed.hash); assert.equal(db.writes, 0);
  await service.publish(seed);
  const { hash, ...payload } = seed;
  const old = { ...payload, period: '2026-09' }; old.hash = engine.hash(old);
  await service.publish(old);
  assert.equal((await service.current()).snapshot.period, '2026-10');
  assert.equal((await service.current('2026-09')).snapshot.period, '2026-09');
  // An older backfill remains selectable even though current does not move backwards.
  assert.ok((await service.current()).periods.includes('2026-09'));
});
// 首页月报入口的更新日期：云端只回最新一期和发布时间，不回整份月报。
// 同一份内容重新发布（比如重跑 seed）不算更新，日期不该跟着变
test('monthly latest is a tiny public read and re-publishing the same content keeps the update time', async () => {
  const db = memoryDb(); let clock = Date.UTC(2026, 10, 5, 2);
  const service = createService({ db, seed, now: () => clock });
  assert.deepEqual(await service.latest(), { latestPeriod: seed.period, publishedAt: null }, '还没发布过，只有随函数带的快照');
  assert.equal((await service.current()).publishedAt, null);
  assert.equal(db.writes, 0, '读不写库');

  await service.publish(seed);
  const first = clock;
  assert.deepEqual(await service.latest(), { latestPeriod: seed.period, publishedAt: first });
  assert.equal((await service.current()).publishedAt, first);
  assert.equal((await service.current(seed.period)).publishedAt, first);

  clock += 86400000;
  await service.publish(seed);
  assert.equal((await service.latest()).publishedAt, first, '同一份内容重跑不算更新');
  assert.equal((await service.current(seed.period)).publishedAt, first);

  const { hash, ...payload } = seed;
  const revised = { ...payload, fetchedAt: '2026-11-06T00:00:00.000Z' }; revised.hash = engine.hash(revised);
  await service.publish(revised);
  assert.equal((await service.latest()).publishedAt, clock, '内容变了才是新的更新');
  assert.equal((await service.current()).snapshot.hash, revised.hash);

  const newest = clock; clock += 86400000;
  const old = { ...payload, period: '2026-09' }; old.hash = engine.hash(old);
  await service.publish(old);
  assert.deepEqual(await service.latest(), { latestPeriod: seed.period, publishedAt: newest }, '补发旧月份不改首页的日期');
  const backfilled = clock;
  assert.equal((await service.current('2026-09')).publishedAt, backfilled);
  clock += 86400000;
  await service.publish(old);
  assert.equal((await service.current('2026-09')).publishedAt, backfilled, '旧月份原样重发也不算更新，比的是这一期自己的内容');

  const next = { ...payload, period: '2026-11' }; next.hash = engine.hash(next);
  await service.publish(next);
  assert.deepEqual(await service.latest(), { latestPeriod: '2026-11', publishedAt: clock }, '最新一期来自云端记录，不是随函数带的快照');

  // 快照文档读不到时退回随函数带的快照，那份快照没有发布时间
  const pointer = db.docs.get(`${PREFIX}current`);
  db.docs.delete(pointer.snapshotId);
  const fallback = await service.current();
  assert.equal(fallback.snapshot.hash, seed.hash);
  assert.equal(fallback.publishedAt, null);
});

test('monthly cloud entry serves latest to anyone and never runs maintenance for it', async () => {
  const calls = [];
  const spy = (name) => async () => { calls.push(name); return { latestPeriod: '2026-10', publishedAt: null }; };
  const service = { current: spy('current'), latest: spy('latest'), tick: spy('tick'), status: spy('status'), publish: spy('publish'), recordTrigger: spy('trigger') };
  const main = cloudEntry({ service });
  const answer = await main({ action: 'latest' });
  assert.equal(answer.ok, true);
  assert.deepEqual(answer.data, { latestPeriod: '2026-10', publishedAt: null });
  assert.deepEqual(calls, ['latest']);
  calls.length = 0;
  assert.equal((await main({ action: 'latest', force: true, period: '2026-09' })).ok, true);
  assert.deepEqual(calls, ['latest'], '多余参数不会变成别的操作');
});

test('home update label uses Beijing dates, asks at most every six hours and keeps the old date on failure', async () => {
  const latest = require('../miniprogram/utils/monthly-latest');
  assert.equal(latest.updatedLabel(Date.parse('2026-11-04T20:27:19Z')), '11月5日更新', 'UTC 晚上已经是北京第二天');
  assert.equal(latest.updatedLabel(Date.parse('2026-11-30T15:59:59Z')), '11月30日更新');
  assert.equal(latest.updatedLabel(Date.parse('2026-11-30T16:00:00Z')), '12月1日更新');
  assert.equal(latest.updatedLabel(Date.parse('2026-12-31T16:00:00Z')), '1月1日更新');
  for (const bad of [null, undefined, NaN, Infinity, '1794000000000', 0, Date.UTC(2026, 9, 31)]) {
    assert.equal(latest.updatedLabel(bad), '', String(bad));
  }

  const store = new Map(); const calls = [];
  let answer = { ok: true, data: { latestPeriod: '2026-10', publishedAt: Date.UTC(2026, 10, 5, 2) } };
  const api = {
    getStorageSync: (key) => (store.has(key) ? store.get(key) : ''),
    setStorageSync: (key, value) => store.set(key, structuredClone(value)),
    cloud: { init() {}, async callFunction(options) { calls.push(options); if (answer instanceof Error) throw answer; return { result: answer }; } },
  };
  const now = Date.UTC(2026, 10, 6, 1);
  assert.equal(latest.readLatest(api), null);
  assert.deepEqual(await latest.refreshLatest(api, now), { latestPeriod: '2026-10', publishedAt: Date.UTC(2026, 10, 5, 2) });
  assert.deepEqual(calls.map((call) => ({ name: call.name, data: call.data })), [{ name: 'metaMonthly', data: { action: 'latest' } }], '只问发布时间，不拉整份月报');
  assert.ok(calls[0].timeout <= 10000);
  assert.equal(await latest.refreshLatest(api, now + latest.TTL - 1), null, '六小时内不再问');
  assert.equal(calls.length, 1);
  answer = { ok: true, data: { latestPeriod: '2026-11', publishedAt: Date.UTC(2026, 11, 4) } };
  assert.equal((await latest.refreshLatest(api, now + latest.TTL)).latestPeriod, '2026-11');
  assert.equal(latest.updatedLabel(latest.readLatest(api).publishedAt), '12月4日更新');

  const later = now + latest.TTL * 3;
  for (const failure of [new Error('offline'), { ok: false, code: 'FORBIDDEN' },
    { ok: true, data: { latestPeriod: '2026-13', publishedAt: Date.UTC(2026, 11, 4) } },
    { ok: true, data: { latestPeriod: '2026-11', publishedAt: '2026-12-04' } }]) {
    answer = failure;
    await assert.rejects(latest.refreshLatest(api, later));
  }
  assert.equal(latest.readLatest(api).publishedAt, Date.UTC(2026, 11, 4), '问失败或拿到坏数据，本机记的日期不动');

  store.clear();
  answer = { ok: true, data: { latestPeriod: '2026-10', publishedAt: null } };
  assert.equal((await latest.refreshLatest(api, now)).publishedAt, null);
  assert.equal(latest.updatedLabel(latest.readLatest(api).publishedAt), '', '云端还没发布过就不显示');
  assert.equal(await latest.refreshLatest(api, now + 1), null, '也记下检查时间，不会每次都问');

  store.clear();
  assert.equal(latest.remember({ latestPeriod: '2026-10', snapshot: {} }, api, now), false, '旧版云函数不带发布时间，不记');
  assert.equal(latest.remember({ latestPeriod: '2026-10', publishedAt: null, snapshot: {} }, api, now), false, '月报页拿到的是没发布过的随包快照，也不记');
  assert.equal(latest.readLatest(api), null);
  assert.equal(latest.remember({ latestPeriod: '2026-10', publishedAt: Date.UTC(2026, 10, 5, 2), snapshot: {} }, api, now), true);
  const before = calls.length;
  assert.equal(await latest.refreshLatest(api, now + 1000), null, '月报页刚记过，首页不用再问');
  assert.equal(calls.length, before);
  await assert.rejects(latest.fetchLatest({ ...api, cloud: undefined }), /UNAVAILABLE/);

  const metaJs = fs.readFileSync(path.join(root, 'miniprogram/pages/meta/meta.js'), 'utf8');
  assert.match(metaJs, /if \(result\.snapshot\.period === result\.latestPeriod\) \{\s*monthly\.cache\(result\);\s*monthlyLatest\.remember\(result\);\s*\}/,
    '月报页只在拿到最新一期时记日期，翻旧月份不算');
});
test('monthly cloud worker checkpoints, resumes, publishes once and releases its lease', async () => {
  const db = memoryDb(); let fetches = 0;
  const api = { async fetchEvents() { fetches += 1; return ['a', 'b', 'c'].map((id) => fixture(id)); }, async fetchInfo() { return info; }, async sleep() {},
    async fetchCards() { return { commander: { oracleId: 'oracle', name: 'Commander', colors: ['U'], image: 'https://cards.scryfall.io/small/test.jpg' } }; } };
  const service = createService({ db, api, key: 'test', now: () => Date.UTC(2026, 10, 4) });
  assert.equal((await service.tick()).status, 'collecting');
  assert.equal((await service.tick()).status, 'verifying');
  assert.equal((await service.tick()).status, 'published');
  assert.equal((await service.tick()).status, 'up_to_date'); assert.equal(fetches, 1);
  assert.equal(db.docs.get(`${PREFIX}lease`).until, 0);
});
test('monthly cloud worker respects leases and preserves existing report on fetch failure', async () => {
  const db = memoryDb(); const now = Date.UTC(2026, 10, 4);
  db.docs.set(`${PREFIX}lease`, { until: now + 1000 });
  const service = createService({ db, seed, now: () => now, api: { async fetchEvents() { throw new Error('UPSTREAM_UNAVAILABLE'); } } });
  assert.equal((await service.tick()).status, 'busy');
  db.docs.delete(`${PREFIX}lease`);
  await assert.rejects(service.tick(), /UPSTREAM_UNAVAILABLE/);
  assert.equal((await service.current()).snapshot.hash, seed.hash);
  assert.equal(db.docs.get(`${PREFIX}lease`).until, 0);
});
test('monthly scheduler records a server heartbeat and exposes only aggregate maintenance status', async () => {
  const db = memoryDb(); const now = Date.UTC(2026, 10, 4);
  const service = createService({ db, now: () => now });
  await service.recordTrigger();
  const status = await service.status();
  assert.equal(status.lastTriggeredAt, now); assert.equal(status.phase, 'not_started');
  assert.equal('candidateIds' in status, false); assert.equal('key' in status, false);
});
test('checked-in snapshots were built by the current model and rules', () => {
  const history = require('../cloudfunctions/metaMonthly/history.json');
  const all = [...history, seed];
  assert.deepEqual(all.map((snapshot) => snapshot.period), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  all.forEach((snapshot) => {
    const { hash, ...payload } = snapshot;
    assert.equal(engine.hash(payload), hash, snapshot.period);
    assert.deepEqual(snapshot.model, engine.MODEL, `${snapshot.period} was built by another model version; rebuild it`);
    snapshot.events.forEach((event) => assert.doesNotMatch(event.title, /bracket\s*[1-4]\b/i));
  });
});
test('monthly applies each published entry rule', () => {
  const reason = (change, eventInfo = info, size = 52) => {
    const event = fixture('event', size); change(event);
    return engine.normalizeEvent(event, eventInfo, window).reason;
  };
  assert.equal(reason(() => {}), undefined);
  assert.equal(reason((event) => { event.swissNum = 3; }), 'short_swiss');
  assert.equal(reason(() => {}, info, 48), 'small_event');
  assert.equal(reason((event) => { event.isLeague = true; }), 'unsupported_format');
  assert.equal(reason((event) => { event.isTeamEvent = true; }), 'unsupported_format');
  assert.equal(reason(() => {}, { ...info, isTeamEvent: true }), 'unsupported_format');
  assert.equal(reason((event) => { event.format = 'Standard'; }), 'unsupported_format');
  assert.equal(reason((event) => { event.game = 'Other Game'; }), 'unsupported_format');
  assert.equal(reason((event) => { event.startDate = window.start - 1; }), 'outside_window');
  assert.equal(reason((event) => { event.startDate = window.end; }), 'outside_window');
  assert.equal(reason((event) => {
    event.rounds.forEach((round) => round.tables.slice(0, 4).forEach((table) => { table.players = table.players.slice(0, 3); }));
  }, info, 64), 'non_four_player_event');
  assert.equal(reason((event) => { event.standings.slice(0, 20).forEach((player) => { player.leader = ''; }); }), 'missing_leaders');
  ['Caballo MTG Quinta Edición (Bracket 3)', 'Bracket 1 Night', 'bracket2 open', 'Tester', 'tester cesh', 'Commander Precon SEA']
    .forEach((name) => assert.equal(reason((event) => { event.tournamentName = name; }), 'special_event', name));
  ['Bracket 5 cEDH Open', 'Testing Grounds cEDH', 'Contester Cup', 'Tavern Brawl 5 cEDH', 'Bracket 10']
    .forEach((name) => assert.equal(reason((event) => { event.tournamentName = name; }), undefined, name));
});
test('monthly counts wins only from finished Swiss tables', () => {
  const records = (change) => { const event = fixture(); change(event); return engine.normalizeEvent(event, info, window); };
  const drawn = records((event) => { event.rounds[0].tables[0].winner_id = 'Draw'; }).event.records;
  assert.equal(drawn[0].wins, 3); assert.equal(drawn[0].draws, 1); assert.equal(drawn[0].games, 4);
  assert.equal(drawn[1].wins, 0); assert.equal(drawn[1].draws, 1);
  assert.equal(records((event) => { event.rounds[0].tables[0].winner_id = 'someone-else'; }).reason, 'invalid_winner');
  const extraRound = records((event) => {
    event.rounds.push({ round: 5, tables: [{ status: 'Completed', players: event.standings.slice(0, 4), winner_id: event.standings[0].id }] });
  });
  assert.equal(extraRound.event.records[0].games, 4, 'rounds past swissNum are not Swiss');
});
test('monthly score matches the published formula', () => {
  // p = (25 + 80 * 0.25) / (100 + 80) = 0.25 and c = (20 + 40 * 0.1) / (10 + 40 * 0.1) = 24 / 14
  assert.ok(Math.abs(engine.score(25, 100, 20, 10, 0.25, 0.1) - 25 * (1 + 24 / 14)) < 1e-9);
  // p = (100 + 80 * 0.25) / 180 and c = 1
  assert.ok(Math.abs(engine.score(100, 100, 10, 10, 0.25, 0.1) - 25 * ((120 / 180) / 0.25 + 1)) < 1e-9);
});
const testCard = (name, oracleId) => ({ oracleId, name, colors: ['U'], image: 'https://cards.scryfall.io/small/test.jpg' });
const tierCards = { winner: testCard('Winner', 'w'), loser: testCard('Loser', 'l'), 'four pilots': testCard('Four Pilots', 'f') };
// Seat one wins every table, so Winner cannot lose and Loser cannot win.
function tierEvents() {
  return ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => {
    const event = fixture(id);
    event.standings.forEach((player, n) => { player.leader = n >= 48 ? 'Four Pilots' : n % 4 === 0 ? 'Winner' : 'Loser'; });
    return engine.normalizeEvent(event, info, window).event;
  });
}
const tierInput = () => ({ period: '2026-10', events: tierEvents(), cards: tierCards, fetchedAt: '2026-11-04T00:00:00Z' });
test('monthly tiers follow the interval, gate on sample size and use the right baselines', () => {
  const snapshot = engine.buildSnapshot(tierInput());
  assert.deepEqual(snapshot.baselines, { win: 25, cut: 7.69 });
  const row = (id) => snapshot.entries.find((entry) => entry.id === id);
  assert.equal(row('w').tier, 't1'); assert.ok(row('w').interval[0] > 50);
  assert.equal(row('l').tier, 't3'); assert.ok(row('l').interval[1] < 50);
  assert.equal(row('l').cuts, 18); assert.equal(row('l').cutEntries, 216); assert.equal(row('l').expectedCuts, 16.62);
  assert.equal(row('f').entries, 24); assert.equal(row('f').pilots, 4);
  assert.equal(row('f').tier, 'watch', 'twenty entries from four pilots is not a sample'); assert.equal(row('f').interval, null);
});
test('monthly change column needs the same model version', () => {
  const current = engine.buildSnapshot(tierInput()).entries.find((entry) => entry.id === 'w');
  const delta = (previous) => engine.buildSnapshot({ ...tierInput(), previous }).entries.find((entry) => entry.id === 'w').delta;
  assert.equal(delta({ modelVersion: engine.MODEL.version, entries: [{ id: 'w', score: 10 }] }), Number((current.score - 10).toFixed(1)));
  assert.equal(delta({ modelVersion: 'older-model', entries: [{ id: 'w', score: 10 }] }), null);
  assert.equal(delta({ modelVersion: engine.MODEL.version, entries: [{ id: 'w', score: null }] }), null);
});
test('monthly refuses a report with too little mapped data', () => {
  const blanks = tierEvents().map((event) => ({ ...event, records: event.records.map((record, n) => (n < 20 ? { ...record, leader: '' } : record)) }));
  assert.throws(() => engine.buildSnapshot({ ...tierInput(), events: blanks }), /LOW_COVERAGE/);
  const { loser, ...partial } = tierCards;
  assert.throws(() => engine.buildSnapshot({ ...tierInput(), cards: partial }), /LOW_COVERAGE/);
});
test('monthly uses official Chinese names from the checked-in list', () => {
  const names = Object.entries(officialNames);
  assert.ok(names.length > 1000);
  names.forEach(([oracleId, name]) => { assert.match(oracleId, /^[0-9a-f-]{36}$/); assert.match(name, /[一-鿿]/); });
  const [oracleId, officialName] = names[0];
  const snapshot = engine.buildSnapshot({ ...tierInput(), cards: { ...tierCards, winner: testCard('Winner', oracleId) } });
  const row = snapshot.entries.find((entry) => entry.id === oracleId);
  assert.equal(row.name, officialName); assert.equal(row.commanders[0].nameZh, officialName);
  assert.equal(snapshot.entries.find((entry) => entry.id === 'l').name, 'Loser', 'no official name means the English name');
  assert.deepEqual(namesFromPage([
    { oracle_id: 'a', printed_name: '织命使堤谟娜' },
    { oracle_id: 'b', card_faces: [{ printed_name: '风雨法师拉尔' }, { printed_name: '背面' }] },
    { card_faces: [{ oracle_id: 'c', printed_name: '正面' }] },
    { oracle_id: 'd', name: 'No Printed Name' },
    { oracle_id: 'e', printed_name: 'English Only' },
  ]), { a: '织命使堤谟娜', b: '风雨法师拉尔', c: '正面' });
});
const NOV = Date.UTC(2026, 10, 4);
const workerApi = (overrides = {}) => ({
  async fetchEvents() { return ['a', 'b', 'c', 'd', 'e'].map((id) => fixture(id)); }, async fetchInfo() { return info; }, async sleep() {},
  async fetchCards() { return { commander: testCard('Commander', 'oracle') }; }, ...overrides,
});
const checkpoints = (db) => [...db.docs.keys()].filter((id) => id.startsWith(`${PREFIX}event_`));
async function runUntilPublished(service) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await service.tick();
    if (result.status === 'published') return result;
  }
  throw new Error('never published');
}
test('monthly worker waits out the grace days, then drops events that are unfinished or ended late', async () => {
  let fetches = 0;
  const waiting = createService({ db: memoryDb(), key: 'k', now: () => Date.UTC(2026, 10, 2, 23), api: workerApi({ async fetchEvents() { fetches += 1; return []; } }) });
  assert.equal((await waiting.tick()).status, 'grace_period'); assert.equal(fetches, 0);
  const infos = { a: { status: 'Running' }, b: { status: 'Complete', endDate: window.end }, c: info, d: info, e: info };
  const service = createService({ db: memoryDb(), key: 'k', now: () => Date.UTC(2026, 10, 3), api: workerApi({ async fetchInfo(_, id) { return infos[id]; } }) });
  assert.equal((await runUntilPublished(service)).events, 3);
  const { snapshot } = await service.current('2026-10');
  assert.deepEqual(snapshot.coverage.excluded, { missing_completion: 1, finished_after_cutoff: 1 });
  snapshot.events.forEach((event) => assert.equal(event.end, info.endDate, 'the real end date replaces the early placeholder'));
});
test('monthly worker deletes per-player checkpoints after publishing and retries when that fails', async () => {
  const db = memoryDb();
  const service = createService({ db, key: 'k', now: () => NOV, api: workerApi() });
  await runUntilPublished(service);
  assert.equal(checkpoints(db).length, 0);
  assert.equal((await service.status()).cleaned, true);

  const flaky = memoryDb(); flaky.failRemovals = true;
  const retrying = createService({ db: flaky, key: 'k', now: () => NOV, api: workerApi() });
  await runUntilPublished(retrying);
  assert.equal(checkpoints(flaky).length, 5, 'a failed delete leaves the checkpoints');
  assert.equal((await retrying.status()).cleaned, false);
  assert.ok((await retrying.current('2026-10')).snapshot, 'a failed delete must not touch the report');
  flaky.failRemovals = false;
  assert.equal((await retrying.tick()).status, 'up_to_date');
  assert.equal(checkpoints(flaky).length, 0);
  assert.equal((await retrying.status()).cleaned, true);
});
test('monthly worker clears checkpoints a stuck job left behind last month', async () => {
  const db = memoryDb();
  const orphan = `${PREFIX}event_2026-09_${engine.hash('old').slice(0, 20)}`;
  db.docs.set(`${PREFIX}job_2026-09`, { period: '2026-09', modelVersion: engine.MODEL.version, phase: 'info', candidateIds: ['old'], cursor: 0, includedIds: [], excluded: {} });
  db.docs.set(orphan, { event: {} });
  const service = createService({ db, key: 'k', now: () => NOV, api: workerApi() });
  assert.equal((await service.tick()).status, 'collecting');
  assert.equal(db.docs.has(orphan), false);
});
test('monthly publish refuses tampered snapshots and failed read-backs without moving the pointer', async () => {
  const tampered = memoryDb();
  await assert.rejects(createService({ db: tampered }).publish({ ...seed, period: '2026-11' }), /INVALID_SNAPSHOT_HASH/);
  assert.equal(tampered.docs.size, 0);
  const lossy = memoryDb(); const original = lossy.collection;
  lossy.collection = () => { const inner = original(); return { doc(id) {
    const doc = inner.doc(id);
    return { ...doc, async get() { const result = await doc.get(); if (id.includes('_snapshot_')) result.data.snapshot.hash = 'different'; return result; } };
  } }; };
  await assert.rejects(createService({ db: lossy }).publish(seed), /PUBLISH_VERIFY_FAILED/);
  assert.equal(lossy.docs.has(`${PREFIX}current`), false);
});
function fakeUpstream(respond) {
  const original = https.request; const calls = [];
  https.request = (url, options, callback) => {
    calls.push({ url, headers: options.headers });
    return Object.assign(new EventEmitter(), { setTimeout() {}, write() {}, destroy() {}, end() {
      const response = Object.assign(new EventEmitter(), { statusCode: 200 });
      setImmediate(() => { callback(response); response.emit('data', Buffer.from(JSON.stringify(respond(url)))); response.emit('end'); });
    } });
  };
  return { calls, restore() { https.request = original; } };
}
test('monthly network only reaches known hosts and sends the key only to TopDeck', async () => {
  const scryfall = { data: [
    { oracle_id: 't', name: 'Tymna the Weaver', color_identity: ['W', 'B'], image_uris: { small: 'https://cards.scryfall.io/small/t.jpg', normal: 'https://cards.scryfall.io/normal/t.jpg' } },
    { oracle_id: 'e', name: 'Etali, Primal Conqueror // Etali, Primal Sickness', card_faces: [{ name: 'Etali, Primal Conqueror', image_uris: { small: 'https://cards.scryfall.io/small/e.jpg' } }] },
    { oracle_id: 'x', name: 'Off Our Image Host', image_uris: { small: 'https://elsewhere.example/x.jpg' } },
  ] };
  const upstream = fakeUpstream((url) => (url.includes('scryfall') ? scryfall : []));
  try {
    await assert.rejects(network.jsonRequest('https://elsewhere.example/api', { key: 'secret' }), /INVALID_HOST/);
    assert.equal(upstream.calls.length, 0);
    await assert.rejects(network.fetchEvents('', engine.periodWindow('2026-10')), /MISSING_TOPDECK_KEY/);
    await network.fetchEvents('secret', engine.periodWindow('2026-10'));
    assert.equal(upstream.calls[0].headers.Authorization, 'secret');
    const cards = await network.fetchCards(['Tymna the Weaver / Etali, Primal Conqueror', 'Off Our Image Host', 'Missing Card'], {});
    assert.equal('Authorization' in upstream.calls[1].headers, false, 'the TopDeck key must not reach Scryfall');
    assert.equal(cards['tymna the weaver'].oracleId, 't');
    assert.equal(cards['etali, primal conqueror'].oracleId, 'e');
    assert.equal(cards['off our image host'], undefined);
    assert.equal(cards['missing card'], undefined);
  } finally { upstream.restore(); }
});
function cloudEntry({ source = 'wx_client', adminToken = 'a'.repeat(32), service }) {
  const file = path.join(root, 'cloudfunctions/metaMonthly/index.js');
  const scope = { exports: {} };
  const stubs = {
    'wx-server-sdk': { init() {}, DYNAMIC_CURRENT_ENV: 'env', database: () => ({}), getWXContext: () => ({ SOURCE: source }) },
    './service': { createService: () => service },
    './runtime-secrets.json': { topdeckKey: 'key', adminToken },
    './seed.json': { period: '2026-10', hash: 'h' },
    './history.json': [],
  };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { exports: scope.exports, process: { env: {} }, Buffer, console: { error() {} },
    require: (name) => stubs[name] || require(name) }, { filename: file });
  return scope.exports.main;
}
test('monthly cloud entry lets anyone read but only the timer or the token run maintenance', async () => {
  const calls = [];
  const spy = (name) => async () => { calls.push(name); return {}; };
  const service = { current: spy('current'), tick: spy('tick'), status: spy('status'), publish: spy('publish'), recordTrigger: spy('trigger') };
  const token = 'a'.repeat(32);
  const main = cloudEntry({ service });
  assert.equal((await main({ action: 'get' })).ok, true);
  assert.deepEqual(calls, ['current']); calls.length = 0;
  const forged = [{}, { action: 'tick' }, { action: 'status' }, { action: 'seed' }, { Type: 'Timer', TriggerName: 'x' }, { SOURCE: 'wx_trigger', action: 'tick' },
    { action: 'tick', adminToken: 'wrong' }, { action: 'tick', adminToken: '' }, { action: 'tick', adminToken: 'a'.repeat(31) }, { action: 'tick', force: true }];
  for (const event of forged) assert.equal((await main(event)).code, 'FORBIDDEN', JSON.stringify(event));
  assert.deepEqual(calls, [], 'a refused call must not reach the service');
  assert.equal((await main({ action: 'status', adminToken: token })).ok, true);
  assert.deepEqual(calls, ['status']); calls.length = 0;
  assert.equal((await main({ action: 'seed', adminToken: token })).ok, true);
  assert.deepEqual(calls, ['publish']); calls.length = 0;
  assert.equal((await main({ action: 'other', adminToken: token })).code, 'INVALID_ACTION');
  assert.equal((await cloudEntry({ source: 'wx_trigger', service })({ Type: 'Timer' })).ok, true);
  assert.deepEqual(calls, ['trigger', 'tick']); calls.length = 0;
  assert.equal((await cloudEntry({ adminToken: 'short', service })({ action: 'status', adminToken: 'short' })).code, 'FORBIDDEN', 'a short configured token must not work');
  const failing = { ...service, status: async () => { throw new Error('internal detail'); } };
  assert.equal((await cloudEntry({ service: failing })({ action: 'status', adminToken: token })).code, 'SERVICE_UNAVAILABLE');
});
test('monthly search opens the collapsed tier and finds archetype and Chinese names', () => {
  const closed = ui.groups(seed).find((group) => group.id === 'watch');
  assert.equal(closed.expanded, false); assert.equal(closed.toggleable, true); assert.equal(closed.rows.length, 0);
  const target = seed.entries.find((row) => row.tier === 'watch');
  const open = ui.groups(seed, { query: target.nameEn.split(' / ')[0] }).find((group) => group.id === 'watch');
  assert.equal(open.expanded, true); assert.equal(open.toggleable, false, 'nothing to toggle while searching');
  assert.ok(open.rows.some((row) => row.id === target.id));
  assert.ok(ui.groups(seed, { query: 'blue farm' }).flatMap((group) => group.rows).some((row) => row.name.includes('织命使堤谟娜')));
  const single = (name) => seed.entries.find((row) => row.commanders.length === 1 && row.commanders[0].name === name);
  // Aang has no official printing, so only the editorial list can supply this name, and it stores the card as A // B.
  assert.equal(ui.decorate(single('Aang, at the Crossroads')).name, '身处十字路口的安昂', 'editorial names match on the front face');
  assert.equal(ui.decorate(single('Chatterfang, Squirrel General')).name, '松鼠将军聒牙', 'official names come with the snapshot');
  assert.equal(ui.decorate(single('Dack Fayden, Helping Hand')).displayName, 'Dack Fayden', 'no official name means English');
  assert.ok(ui.groups(seed, { query: '聒牙' }).flatMap((group) => group.rows).length > 0);
});
test('monthly filters by color and sorts by entries', () => {
  const rows = (groups) => groups.flatMap((group) => group.rows);
  const blue = rows(ui.groups(seed, { color: 'U', expandedWatch: true }));
  assert.ok(blue.length > 0 && blue.length < seed.entries.length);
  blue.forEach((row) => assert.ok(seed.entries.find((entry) => entry.id === row.id).colors.includes('U')));
  const byEntries = ui.groups(seed, { order: 'entries' }).find((group) => group.id === 't2').rows.map((row) => row.entries);
  assert.deepEqual(byEntries, [...byEntries].sort((a, b) => b - a));
  assert.notDeepEqual(ui.groups(seed).find((group) => group.id === 't2').rows.map((row) => row.entries), byEntries);
  assert.ok(rows(ui.groups(seed, { highSample: true })).every((row) => row.entries >= 100));
});
test('monthly client helpers: cache age, delay notice, event links and empty rates', () => {
  const sixHours = 6 * 60 * 60 * 1000;
  assert.equal(ui.isFresh({ checkedAt: 1000 }, 1000), true);
  assert.equal(ui.isFresh({ checkedAt: 1000 }, 1000 + sixHours - 1), true);
  assert.equal(ui.isFresh({ checkedAt: 1000 }, 1000 + sixHours), false);
  assert.equal(ui.isDelayed('2026-09', Date.UTC(2026, 10, 5)), false, 'the job may still be running');
  assert.equal(ui.isDelayed('2026-09', Date.UTC(2026, 10, 6)), true);
  assert.equal(ui.isDelayed('2026-10', Date.UTC(2026, 10, 20)), false);
  assert.equal(ui.isDelayed('2026-11', Date.UTC(2027, 0, 6)), true, 'works across a year boundary');
  assert.equal(ui.isDelayed('2026-12', Date.UTC(2027, 0, 6)), false);
  assert.equal(ui.isDelayed(undefined, Date.UTC(2026, 10, 20)), false);
  assert.equal(ui.eventUrl('topdeck-invitational-2026'), 'https://topdeck.gg/event/topdeck-invitational-2026');
  assert.equal(ui.eventUrl('a b/c'), 'https://topdeck.gg/event/a%20b%2Fc');
  const row = seed.entries.find((entry) => entry.tier === 't1');
  assert.equal(ui.decorate(row).tierRgb, ui.TIERS.find((tier) => tier.id === 't1').rgb);
  assert.equal(ui.decorate({ ...row, drawRate: null }).drawLabel, '—');
});
function metaPage(overrides = {}, scope = {}) {
  const file = path.join(root, 'miniprogram/pages/meta/meta.js');
  const localRequire = createRequire(file); let definition;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { Page(value) { definition = value; }, wx: {}, console, ...scope,
    require(name) { return name === '../../utils/monthly-meta' ? { ...ui, ...overrides } : localRequire(name); } });
  return { ...definition, data: structuredClone(definition.data), setData(value) { Object.assign(this.data, value); } };
}
test('monthly page caches only the latest month, waits for typing to stop and copies real links', async () => {
  const cached = []; let result;
  const page = metaPage({ fetchMonthly: async () => result, cache: (value) => cached.push(value.snapshot.period) });
  result = { snapshot: { ...seed, period: '2026-09' }, periods: [], latestPeriod: seed.period };
  await page.loadMonthly('2026-09', true);
  assert.deepEqual(cached, []);
  result = { snapshot: seed, periods: [], latestPeriod: seed.period };
  await page.loadMonthly(undefined, true);
  assert.deepEqual(cached, [seed.period]);

  const timers = []; const cleared = []; const copied = []; const toasts = [];
  const typing = metaPage({}, {
    setTimeout: (run) => { timers.push(run); return timers.length; }, clearTimeout: (id) => { cleared.push(id); },
    wx: { setClipboardData(options) { copied.push(options.data); options.success(); }, showToast(options) { toasts.push(options.title); } },
  });
  typing.applyMonthly(seed, [seed.period]);
  const before = typing.data.monthGroups;
  typing.searchMonthly({ detail: { value: 'a' } });
  assert.equal(typing.data.monthQuery, 'a');
  assert.equal(typing.data.monthGroups, before, 'no filtering on every keystroke');
  typing.searchMonthly({ detail: { value: 'ab' } });
  assert.equal(cleared[cleared.length - 1], 1, 'a new keystroke cancels the pending filter');
  timers[1]();
  assert.notEqual(typing.data.monthGroups, before);
  typing.onUnload();
  assert.equal(cleared[cleared.length - 1], 2);

  typing.copyMonthlySource();
  typing.copyMonthlyEvent({ currentTarget: { dataset: { id: 'topdeck-invitational-2026' } } });
  assert.deepEqual(copied, ['https://topdeck.gg', 'https://topdeck.gg/event/topdeck-invitational-2026']);
  assert.equal(toasts.length, 2);

  typing.openMonthlyDetail({ currentTarget: { dataset: { id: seed.entries[0].id } } });
  assert.equal(typing.data.monthlyDetail.tierRgb, ui.TIERS.find((tier) => tier.id === seed.entries[0].tier).rgb);
  assert.equal(typing.data.monthlyDetail.sources.length, seed.entries[0].sourceEvents.length);
});
test('monthly page credits TopDeck wherever data appears and states its limits', () => {
  const wxml = read('miniprogram/pages/meta/meta.wxml');
  const credit = 'bindtap="copyMonthlySource">数据来自 TopDeck.gg　复制链接<';
  const firstScreen = wxml.slice(wxml.indexOf('class="month-overview"'), wxml.indexOf('month-search-label'));
  const footer = wxml.slice(wxml.indexOf('class="month-source"'), wxml.indexOf('class="month-method"'));
  const detail = wxml.slice(wxml.indexOf('detail-panel month-detail'), wxml.indexOf('detail-panel surface'));
  [firstScreen, footer, detail].forEach((part) => assert.ok(part.includes(credit)));
  assert.doesNotMatch(wxml, /↗/, 'the link is copied, not opened');
  assert.match(wxml, /class="month-caption">公开赛事，以欧美为主</);
  assert.match(wxml, /目前以欧美为主，中文地区的赛事很少/);
  assert.match(wxml, /单月升降不等于强弱变化/);
  assert.match(wxml, /Bracket 1 到 4 的赛事不计入/);
  assert.match(wxml, /wx:if="\{\{monthDelayed\}\}"/);
  assert.match(wxml, /<view>平局率 <text>\{\{monthlyDetail\.drawLabel\}\}<\/text><\/view>/);
  assert.doesNotMatch(wxml, /和局/, 'the app says 平局 everywhere, including the tracker');
  assert.match(wxml, /class="detail-panel month-detail"[^>]*style="--tier-rgb: \{\{monthlyDetail\.tierRgb\}\};"/);
  assert.match(wxml, /data-id="\{\{item\.id\}\}" bindtap="copyMonthlyEvent">\{\{item\.title\}\}<text class="month-caption">复制赛事链接</);
  assert.match(wxml, /<button wx:if="\{\{group\.toggleable\}\}"/);
  assert.match(read('miniprogram/styles/themes/dark-table.wxss'), /\.meta\s*\{[^}]*color:\s*var\(--cedh-text\)/);
  const pageJson = JSON.parse(read('miniprogram/pages/meta/meta.json'));
  assert.equal(pageJson.enablePullDownRefresh, true);
  assert.equal(pageJson.backgroundTextStyle, 'light', 'dark dots on a dark page cannot be seen');
});
test('monthly deploy script runs on the Windows PowerShell this machine has', () => {
  const script = read('scripts/deploy-monthly-meta.ps1');
  assert.match(script, /^[\x00-\x7f]*$/, 'without a BOM, non-ASCII text is garbled when PowerShell 5.1 reads the script');
  assert.doesNotMatch(script, /ToHexString|RandomNumberGenerator\]::Fill/, 'these need PowerShell 7');
  assert.match(script, /Where-Object \{ \$_\.Name -ne 'runtime-secrets\.json' \}/);
  assert.match(script, /finally \{[\s\S]*Remove-Staging \$resolved/, 'the staging copy holds secrets and must always be removed');
  // 2026-11-06, the first run with the real CLI: its result table is UTF-8, and read in this machine's gb2312 the box
  // characters became CJK letters, so a good deploy was reported as DEPLOY_FAILED. A CLI child also still held the logs
  // when finally ran, the removal failed on the first file, and the folder kept the secrets copy.
  assert.match(script, /Get-Content -LiteralPath \$stdout, \$stderr -Raw -Encoding UTF8/);
  const remover = script.slice(script.indexOf('function Remove-Staging'), script.indexOf('# A run whose window was closed'));
  const wipe = remover.indexOf("WriteAllText($secrets, '{}')");
  assert.ok(wipe > 0 && wipe < remover.indexOf('Remove-Item -LiteralPath $folder'), 'wipe the secrets before trying to remove the folder');
  assert.match(remover, /for \(\$i = 0; \$i -lt \$attempts/, 'retry while a CLI child still holds the logs');
  assert.match(script, /ForEach-Object \{ \$null = Remove-Staging \$_\.FullName \d+ \}/, 'a locked leftover must not stop the next deploy');
  // PowerShell runs .NET regex, whose word classes count CJK letters as word characters; JavaScript's do not.
  // Translate them so these checks use the same semantics the script does.
  const dotnet = (pattern) => new RegExp(pattern.replace(/\\W/g, '[^\\p{L}\\p{N}_]').replace(/\\w/g, '[\\p{L}\\p{N}_]'), 'u');
  const succeeded = dotnet(script.match(/\$succeeded = '([^']+)'/)[1]);
  const failed = dotnet(script.match(/\$failed = '([^']+)'/)[1]);
  assert.equal(dotnet('metaMonthly\\W+true').test('\u9239? metaMonthly \u9239? true'), false, 'the old pattern is what failed on 2026-11-06');
  const bar = String.fromCharCode(0x2502);
  assert.ok(succeeded.test(`${bar} metaMonthly ${bar} true    ${bar} 10 ${bar}`));
  assert.ok(succeeded.test('\u9239? metaMonthly \u9239? true    \u9239? 10'), 'still matches if the box characters are ever mis-decoded');
  assert.ok(!succeeded.test(`${bar} metaMonthly ${bar} false ${bar}\n${bar} other ${bar} true ${bar}`), 'a true on another row does not count');
  assert.ok(failed.test(`${bar} metaMonthly ${bar} false ${bar}`));
  // On 2026-11-04 a run ended without its finally block and left the secrets copy behind.
  const sweep = script.indexOf("-Filter 'cedh-monthly-deploy-*'");
  assert.ok(sweep > 0 && sweep < script.indexOf('New-Item -ItemType Directory'), 'each run first removes what an interrupted run left behind');
  assert.match(script, /taskkill\.exe \/T \/F \/PID/, 'a CLI that never exits must not block the cleanup');
  assert.match(script, /DEPLOY_TIMEOUT/);
  assert.doesNotMatch(script, /2>&1/, 'capturing output in silence looks like a hang, which invites closing the window');
});
test('third-party data is carved out of the MIT license', () => {
  const notice = read('NOTICE.md');
  assert.match(notice, /does not cover/);
  ['cloudfunctions/metaMonthly/seed.json', 'cloudfunctions/metaMonthly/history.json', 'cloudfunctions/metaMonthly/commander-names.json', 'tools/meta-tier/current.json']
    .forEach((file) => { assert.ok(notice.includes(file), file); assert.ok(fs.existsSync(path.join(root, file)), file); });
  assert.match(notice, /TopDeck\.gg/);
  assert.match(read('README.md'), /NOTICE\.md/);
});
test('monthly page retains its report offline and ignores a superseded month request', async () => {
  const fs = require('fs'); const path = require('path'); const vm = require('vm');
  const file = path.resolve(__dirname, '../miniprogram/pages/meta/meta.js');
  const localRequire = require('module').createRequire(file); let definition; let fetch;
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { Page(value) { definition = value; }, wx: {}, console,
    require(name) { return name === '../../utils/monthly-meta' ? { ...ui, fetchMonthly: (...args) => fetch(...args) } : localRequire(name); } });
  const page = { ...definition, data: structuredClone(definition.data), setData(value) { Object.assign(this.data, value); } };
  page.applyMonthly(seed, [seed.period]);
  fetch = async () => { throw new Error('OFFLINE'); };
  await page.loadMonthly();
  assert.equal(page.data.monthOffline, true); assert.equal(page.data.monthSummary.period, seed.period);
  assert.ok(page.data.monthError); assert.equal(page.data.monthLoading, false);
  const pending = []; fetch = () => new Promise(resolve => pending.push(resolve));
  const first = page.loadMonthly('2026-08', true); const second = page.loadMonthly('2026-09', true);
  pending[1]({ snapshot: { ...seed, period: '2026-09' }, periods: [], latestPeriod: seed.period }); await second;
  pending[0]({ snapshot: { ...seed, period: '2026-08' }, periods: [], latestPeriod: seed.period }); await first;
  assert.equal(page.data.monthSummary.period, '2026-09'); assert.equal(page.data.monthLoading, false);
});
