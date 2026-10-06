// Uses the same public, read-only persisted query as EDHTop16's commander list.
// Endpoint/protocol observed in its public router bundle on 2026-10-06.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { commanders } = require('../miniprogram/config/commanders');
const { normalizeCardName } = require('../miniprogram/utils/scryfall');
const SOURCE_URL = 'https://edhtop16.com/api/graphql';
const QUERY_ID = '86fac9d8c2353944c65306a21cd17574';
const ENTRIES_QUERY_ID = 'f3b0fec0f117f025ead64c4eec63399f';
const FILTERS = Object.freeze({ timePeriod: 'SIX_MONTHS', sortBy: 'POPULARITY', minEntries: 0, minSize: 50, colorId: null });
const ENTRY_FILTERS = Object.freeze({ minEventSize: FILTERS.minSize, timePeriod: FILTERS.timePeriod, sortBy: 'TOP' });
const WIN_RATE_FORMULA = 'sum(wins)/sum(wins+losses+draws)';
const key = (name) => normalizeCardName(name).toLowerCase().split(' / ').sort().join(' / ');

function buildSnapshot(nodes, roster, retrievedAt = new Date().toISOString()) {
  if (!Array.isArray(nodes) || !nodes.length) throw new Error('empty source snapshot');
  const byKey = new Map();
  const denominators = new Set();
  for (const node of nodes) {
    const stats = node && node.stats;
    if (!node.name || byKey.has(key(node.name)) || !stats
      || !Number.isSafeInteger(stats.count) || stats.count < 0
      || !Number.isSafeInteger(stats.topCuts) || stats.topCuts < 0 || stats.topCuts > stats.count
      || !['conversionRate', 'metaShare', 'winRate'].every((field) => typeof stats[field] === 'number' && Number.isFinite(stats[field]) && stats[field] >= 0 && stats[field] <= 1)) {
      throw new Error('invalid or duplicate source statistics');
    }
    if (stats.count) {
      if (Math.abs(stats.conversionRate - stats.topCuts / stats.count) > 1e-10 || !stats.metaShare) throw new Error('source conversion/share is inconsistent');
      const denominator = Math.round(stats.count / stats.metaShare);
      if (!Number.isSafeInteger(denominator) || denominator < stats.count || Math.abs(stats.metaShare - stats.count / denominator) > 1e-10) throw new Error('invalid share denominator');
      denominators.add(denominator);
    } else if (stats.topCuts || stats.conversionRate || stats.metaShare || stats.winRate) throw new Error('nonzero rate without source entries');
    byKey.set(key(node.name), node);
  }
  if (denominators.size !== 1) throw new Error('mixed source share denominators');
  const snapshot = {};
  for (const commander of roster) {
    const node = byKey.get(key(commander.name));
    if (!node) throw new Error(`source has no row for ${commander.name}; keep the existing snapshot`);
    snapshot[commander.name] = {
      entries: node.stats.count, topCuts: node.stats.topCuts,
      metaShare: node.stats.metaShare,
      // Keep the source rate; entry counts alone do not establish its denominator.
      winRate: node.stats.count ? node.stats.winRate : null,
    };
  }
  return { manifest: {
    source: 'https://edhtop16.com/', endpoint: SOURCE_URL, retrievedAt,
    filters: FILTERS, sourceRows: nodes.length, rosterRows: roster.length,
    // Inferred from count/metaShare in every positive row, not the sum of listed rows.
    shareDenominator: [...denominators][0],
    shareDenominatorMethod: 'consistent-source-count-divided-by-metaShare',
    conversionDefinition: 'topCuts/entries',
    winRateDefinition: 'source-reported; aggregation denominator not independently verified',
  }, snapshot };
}

async function querySource(queryId, variables) {
  const response = await fetch(SOURCE_URL, { method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'cedh-tutor-fact-audit/1.0' },
    body: JSON.stringify({ query: null, variables, extensions: { 'pastoria-id': queryId } }),
  });
  if (!response.ok) throw new Error(`EDHTop16 HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.errors || !payload.data) throw new Error('source query changed; review it before updating');
  return payload;
}

async function fetchNodes() {
  const nodes = [];
  const cursors = new Set();
  let cursor = null;
  for (let page = 0; page < 30; page += 1) {
    const payload = await querySource(QUERY_ID, { ...FILTERS, count: 250, cursor });
    const list = payload.data && payload.data.commanders;
    if (payload.errors || !list || !Array.isArray(list.edges) || !list.pageInfo || typeof list.pageInfo.hasNextPage !== 'boolean') throw new Error('source query changed; review it before updating');
    nodes.push(...list.edges.map((edge) => edge.node));
    if (!list.pageInfo.hasNextPage) return nodes;
    cursor = list.pageInfo.endCursor;
    if (typeof cursor !== 'string' || cursors.has(cursor)) throw new Error('source pagination loop');
    cursors.add(cursor);
    await new Promise((resolve) => setTimeout(resolve, 550));
  }
  throw new Error('source pagination exceeded limit');
}

function attachWinRateVerification(result, report) {
  const names = Object.keys(result.snapshot);
  if (!report || report.endpoint !== SOURCE_URL || report.queryId !== ENTRIES_QUERY_ID
    || report.formula !== WIN_RATE_FORMULA || !report.filters
    || Object.entries(ENTRY_FILTERS).some(([field, value]) => report.filters[field] !== value)
    || !Number.isFinite(Date.parse(report.retrievedAt)) || new Date(report.retrievedAt).toISOString() !== report.retrievedAt
    || !Array.isArray(report.rows) || report.rows.length !== names.length) throw new Error('invalid win-rate audit');
  const seen = new Set();
  for (const row of report.rows) {
    const source = result.snapshot[row.name];
    if (!source || seen.has(row.name) || row.entries !== source.entries
      || !['entries', 'wins', 'losses', 'draws', 'games'].every((field) => Number.isSafeInteger(row[field]) && row[field] >= 0)
      || row.games !== row.wins + row.losses + row.draws || !row.games
      || typeof source.winRate !== 'number' || row.expected !== source.winRate
      || row.rebuilt !== row.wins / row.games || Math.abs(row.rebuilt - source.winRate) > 1e-12) {
      throw new Error('win-rate audit does not match this snapshot');
    }
    seen.add(row.name);
  }
  const reportSha256 = createHash('sha256').update(JSON.stringify(report)).digest('hex');
  result.manifest.winRateDefinition = WIN_RATE_FORMULA;
  result.manifest.winRateVerification = { retrievedAt: report.retrievedAt, method: 'recompute-all-roster-entry-results',
    queryId: ENTRIES_QUERY_ID, rows: report.rows.length, reportSha256,
    reportFile: `edhtop16-win-rates-${report.retrievedAt.slice(0, 10)}-${reportSha256.slice(0, 12)}.json` };
  return result;
}

// Independent of the source aggregate: traverse each roster entry and pool its
// reported results. No individual player data is retained in the audit receipt.
async function verifySnapshotGames(nodes, roster, result, request = querySource) {
  const byName = new Map(nodes.map((node) => [key(node.name), node]));
  const report = { retrievedAt: new Date().toISOString(), endpoint: SOURCE_URL, queryId: ENTRIES_QUERY_ID,
    filters: ENTRY_FILTERS, formula: WIN_RATE_FORMULA, rows: [] };
  for (const commander of roster) {
    const source = byName.get(key(commander.name));
    if (!source || typeof source.id !== 'string' || !source.id) throw new Error('source entry identity is missing');
    const seen = new Set();
    const cursors = new Set();
    const totals = { wins: 0, losses: 0, draws: 0 };
    let cursor = null;
    for (let page = 0; page < 30; page += 1) {
      const payload = await request(ENTRIES_QUERY_ID, { id: source.id, count: 250, cursor, maxStanding: null, ...ENTRY_FILTERS });
      const connection = payload.data && payload.data.node && payload.data.node.entries;
      if (payload.errors || !connection || !Array.isArray(connection.edges) || !connection.pageInfo
        || typeof connection.pageInfo.hasNextPage !== 'boolean') throw new Error('source entry query changed');
      for (const { node } of connection.edges) {
        if (!node || typeof node.id !== 'string' || !node.id || seen.has(node.id)) throw new Error('invalid or duplicate source entry');
        seen.add(node.id);
        for (const field of Object.keys(totals)) {
          if (!Number.isSafeInteger(node[field]) || node[field] < 0 || !Number.isSafeInteger(totals[field] + node[field])) throw new Error('invalid source result count');
          totals[field] += node[field];
        }
      }
      if (!connection.pageInfo.hasNextPage) break;
      cursor = connection.pageInfo.endCursor;
      if (!connection.edges.length || typeof cursor !== 'string' || !cursor || cursors.has(cursor) || page === 29) throw new Error('source entry pagination failed');
      cursors.add(cursor);
      if (request === querySource) await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const games = totals.wins + totals.losses + totals.draws;
    report.rows.push({ name: commander.name, entries: seen.size, ...totals, games,
      rebuilt: games ? totals.wins / games : null, expected: result.snapshot[commander.name].winRate });
    if (request === querySource) {
      if (report.rows.length % 10 === 0) console.error(`Read entry results: ${report.rows.length}/${roster.length}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  // Fails before writing when entries disappeared, the window changed, or rates differ.
  attachWinRateVerification(result, report);
  return report;
}

function writeSnapshot(result, output = path.resolve(__dirname, '../miniprogram/config/commander-stats.js')) {
  const source = '// Generated by scripts/refresh-commander-stats.js; do not edit rates by hand.\n'
    + 'const commanderStatsManifest = ' + JSON.stringify(result.manifest, null, 2) + ';\n\n'
    + 'const commanderStats = ' + JSON.stringify(result.snapshot, null, 2) + ';\n\n'
    + 'module.exports = { commanderStatsManifest, commanderStats };\n';
  const temporary = output + '.' + process.pid + '.tmp';
  try { fs.writeFileSync(temporary, source, { encoding: 'utf8', flag: 'wx' }); fs.renameSync(temporary, output); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}

if (require.main === module) fetchNodes().then(async (nodes) => {
  const result = buildSnapshot(nodes, commanders);
  if (process.argv.includes('--verify-games')) {
    const report = await verifySnapshotGames(nodes, commanders, result);
    if (process.argv.includes('--write')) {
      // Immutable receipts keep the previous proof intact if snapshot replacement fails.
      const auditPath = path.resolve(__dirname, '../docs/audits', result.manifest.winRateVerification.reportFile);
      fs.mkdirSync(path.dirname(auditPath), { recursive: true });
      if (fs.existsSync(auditPath)) {
        const existing = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
        const hash = createHash('sha256').update(JSON.stringify(existing)).digest('hex');
        if (hash !== result.manifest.winRateVerification.reportSha256) throw new Error('audit receipt already exists with different contents');
      } else fs.writeFileSync(auditPath, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    }
  }
  if (process.argv.includes('--write')) writeSnapshot(result);
  console.log(JSON.stringify(result.manifest, null, 2));
}).catch((error) => { console.error(error.message); process.exitCode = 1; });
module.exports = { buildSnapshot, fetchNodes, writeSnapshot, attachWinRateVerification, verifySnapshotGames, FILTERS };
