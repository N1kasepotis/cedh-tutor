const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../cloudfunctions/metaMonthly/engine');
const { createService, PREFIX } = require('../cloudfunctions/metaMonthly/service');
const ui = require('../miniprogram/utils/monthly-meta');
const seed = require('../cloudfunctions/metaMonthly/seed.json');
const window = engine.periodWindow('2026-10');
function fixture(id = 'event') {
  const standings = Array.from({ length: 52 }, (_, n) => ({ id: `private-${n}`, leader: 'Commander' }));
  const rounds = Array.from({ length: 4 }, (_, n) => ({ round: n + 1, tables: Array.from({ length: 13 }, (_, p) => {
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
test('monthly cloud worker checkpoints, resumes, publishes once and releases its lease', async () => {
  const db = memoryDb(); let fetches = 0;
  const api = { async fetchEvents() { fetches += 1; return ['a', 'b', 'c'].map(fixture); }, async fetchInfo() { return info; }, async sleep() {},
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
