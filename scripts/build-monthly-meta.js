// Local backfill and verification. Raw checkpoints belong in an explicit private directory, never Git.
const fs = require('fs');
const path = require('path');
const engine = require('../cloudfunctions/metaMonthly/engine');
const network = require('../cloudfunctions/metaMonthly/network');
function argument(name) { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; }
async function build({ period, cacheDir, output, previous = null }) {
  if (!cacheDir || !output) throw new Error('PRIVATE_CACHE_AND_OUTPUT_REQUIRED');
  fs.mkdirSync(cacheDir, { recursive: true });
  const window = engine.periodWindow(period);
  const sourceFile = path.join(cacheDir, `source-${period}.json`);
  const cachedSource = fs.existsSync(sourceFile);
  const raw = cachedSource ? JSON.parse(fs.readFileSync(sourceFile, 'utf8')) : await network.fetchEvents(process.env.TOPDECK_API_KEY, window);
  if (!cachedSource) fs.writeFileSync(sourceFile, JSON.stringify(raw));
  // Rebuilding from the cache must not pretend the data was just fetched.
  const fetchedAt = fs.statSync(sourceFile).mtime.toISOString();
  const events = []; const excluded = {}; const seen = new Set();
  const reject = (reason) => { excluded[reason] = (excluded[reason] || 0) + 1; };
  for (const event of raw) {
    if (seen.has(event.TID)) throw new Error('DUPLICATE_EVENTS');
    seen.add(event.TID);
    const early = engine.normalizeEvent(event, { status: 'Complete', endDate: window.end - 1 }, window);
    if (!early.ok) { reject(early.reason); continue; }
    const infoFile = path.join(cacheDir, `info-${engine.hash(event.TID).slice(0, 24)}.json`);
    let info;
    if (fs.existsSync(infoFile)) info = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
    else { info = await network.fetchInfo(process.env.TOPDECK_API_KEY, event.TID); fs.writeFileSync(infoFile, JSON.stringify(info)); await network.sleep(1350); }
    const normalized = engine.normalizeEvent(event, info, window);
    if (normalized.ok) events.push(normalized.event); else reject(normalized.reason);
    if ((events.length + Object.values(excluded).reduce((a, n) => a + n, 0)) % 10 === 0) console.log(`Verified ${period}: ${events.length} events`);
  }
  const cardFile = path.join(cacheDir, 'cards.json');
  const cards = await network.fetchCards(events.flatMap((event) => event.records.map((record) => record.leader)), fs.existsSync(cardFile) ? JSON.parse(fs.readFileSync(cardFile, 'utf8')) : {});
  fs.writeFileSync(cardFile, JSON.stringify(cards));
  const snapshot = engine.buildSnapshot({ period, events, cards, excluded, fetchedAt, previous });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(snapshot));
  console.log(JSON.stringify({ period, events: events.length, entries: snapshot.coverage.entries, coverage: snapshot.coverage.leaderCoverage,
    decks: snapshot.entries.length, ranked: snapshot.entries.filter((row) => row.tier !== 'watch').length, bytes: fs.statSync(output).size, excluded }));
  return snapshot;
}
// Pass --previous <last month's snapshot> or every "change since last month" comes out empty.
const previousSnapshot = () => (argument('--previous') ? JSON.parse(fs.readFileSync(argument('--previous'), 'utf8')) : null);
if (require.main === module) build({ period: argument('--period') || engine.previousPeriod(), cacheDir: argument('--cache'), output: argument('--output'), previous: previousSnapshot() })
  .catch((error) => { console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : 'BUILD_FAILED'); process.exitCode = 1; });
module.exports = { build };
