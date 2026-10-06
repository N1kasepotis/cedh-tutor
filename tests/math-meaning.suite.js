const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSourceStatsMultiplier, readNumber } = require('../miniprogram/utils/recommender/stats');
const { calculateCompetitivePriorityMultiplier } = require('../miniprogram/utils/recommender/ranking');
const { deriveCommanderMetaTags } = require('../miniprogram/utils/commander-meta');
const { metaTagConfig } = require('../miniprogram/config/recommendation-rules');
const { calculateDeckStats, buildWinRateSeries, buildSeatWinRateSeries, buildFrequencySeries } = require('../miniprogram/utils/tracker');
const { paintChart } = require('../miniprogram/utils/tracker-charts');
const { edhtiQuestions, edhtiPersonaOdds, edhtiOddsManifest } = require('../miniprogram/config/edhti');
const { estimatePersonaOdds, questionFingerprint } = require('../scripts/edhti-odds');
const { tallyEdhtiAnswers } = require('../miniprogram/utils/edhti');
const { calculateStickerOdds, decorateStickerSheet } = require('../miniprogram/utils/stickers');
const { calculatePollStats } = require('../miniprogram/community/utils/poll-stats');
const { commanders } = require('../miniprogram/config/commanders');
const { buildDeckMetrics } = require('../miniprogram/utils/bracket');
const { parseMtgoDeckText, shuffleInPlace } = require('../miniprogram/utils/playtest');
const { rollInteger, sanitizeRange, createSequenceRandom } = require('../miniprogram/utils/random');
const { buildSnapshot, attachWinRateVerification, verifySnapshotGames } = require('../scripts/refresh-commander-stats');
const { commanderStatsManifest, commanderStats } = require('../miniprogram/config/commander-stats');
const { buildSingleComponents, buildColorComponents, buildResourceComponents, topThreeFromComponents } = require('../scripts/diagnose-coverage');
const { questions, matchingConfig } = require('../miniprogram/config/questionnaire');
const { statsWeightConfig } = require('../miniprogram/config/commanders');
const { buildPreferenceProfile, recommendCommanders } = require('../miniprogram/utils/recommender');

test('coverage scoring agrees with production ranking including intermediate rounding and selection order', () => {
  const baseline = Object.fromEntries(questions.filter(q => q.type !== 'multiple').map(q => [q.id, q.options[0].id]));
  const variants = [
    { ...baseline, colors: ['white', 'blue', 'black', 'red', 'green'], resourceEngine: ['graveyard', 'permanentEngine'] },
    { ...baseline, priority: 'fun', partnerPreference: 'dislike', colors: ['blue', 'black'], resourceEngine: ['permanentEngine', 'graveyard'] },
    { ...baseline, priority: 'competitive', colors: ['any'], resourceEngine: ['spellChain', 'graveyard'] },
  ];
  for (const answers of variants) {
    const single = buildSingleComponents([answers])[0];
    const color = buildColorComponents([answers.colors])[0];
    const resource = buildResourceComponents([answers.resourceEngine])[0];
    const compact = entries => entries.map(({ name, fitScore, score }) => ({ name, fitScore, score }));
    assert.deepEqual(compact(topThreeFromComponents(single, color, resource)),
      compact(recommendCommanders(buildPreferenceProfile(questions, answers), commanders, 3, null, null, statsWeightConfig, matchingConfig)));
  }
});

test('missing observations are unknown; conversion and game wins are different metrics', () => {
  for (const value of [null, undefined, '', true, false, NaN, Infinity]) assert.equal(readNumber(value), null);
  assert.equal(readNumber(0), 0);
  const config = { conversionRate: { lowBelow: 0.12, lowMultiplier: 0.8, highAbove: 0.24, highMinEntries: 100, highMultiplier: 1.05 }, maxMultiplier: 2 };
  assert.equal(calculateSourceStatsMultiplier({ sourceStats: { winRate: 0.05, entries: 100 } }, config), 1);
  assert.equal(calculateSourceStatsMultiplier({ sourceStats: { conversionRate: 0.3 } }, config), 1);
  assert.equal(calculateSourceStatsMultiplier({ sourceStats: { conversionRate: 0.3, entries: 100 } }, config), 1.05);
  const priority = { competitiveMetaPriority: { enabled: true, minEntries: 100, minConversionRate: 0.2, multiplier: 1.18 } };
  const profile = { __selectedPriority: 'competitive' };
  assert.equal(calculateCompetitivePriorityMultiplier(profile, { sourceStats: { entries: 100, winRate: 0.8 } }, priority), 1);
  assert.equal(calculateCompetitivePriorityMultiplier(profile, { sourceStats: { entries: 100, conversionRate: 0.21, winRate: 0.05 } }, priority), 1.18);
  assert.deepEqual(deriveCommanderMetaTags({ name: 'Unknown' }, metaTagConfig), []);
});

test('commander snapshot conversion is derived once from top cuts and entries', () => {
  for (const commander of commanders) {
    const { entries, topCuts, conversionRate } = commander.sourceStats;
    assert.ok(Number.isSafeInteger(entries) && entries > 0, commander.name);
    if (topCuts == null) { assert.equal(conversionRate, null); continue; }
    assert.ok(Number.isSafeInteger(topCuts) && topCuts >= 0 && topCuts <= entries, commander.name);
    assert.equal(conversionRate, topCuts / entries, commander.name);
  }
});

test('undefined win rates stay separate from measured zero, including draws and unknown seats', () => {
  const matches = [
    { id: 'a', date: '2026-10-01', result: 'win', seat: 'seat1' },
    { id: 'b', date: '2026-10-01', result: 'loss', seat: 'seat1' },
    { id: 'c', date: '2026-10-02', result: 'draw', seat: 'seat2' },
    { id: 'd', date: '2026-10-03', result: 'loss' },
  ];
  assert.equal(calculateDeckStats({ matches: [] }).winRate, null);
  assert.equal(calculateDeckStats({ matches: [matches[2]] }).winRateLabel, '—');
  const stats = calculateDeckStats({ matches });
  assert.equal(stats.winRate, 1 / 3);
  assert.equal(stats.sampleSize, 3);
  const seats = buildSeatWinRateSeries(matches);
  assert.equal(seats[0].rate, 0.5);
  assert.equal(seats[1].rate, null);
  assert.equal(seats.reduce((n, seat) => n + seat.sampleSize, 0), 2);
  assert.deepEqual(buildWinRateSeries(matches).map((point) => point.rate), [0.5, null, 0]);
  assert.equal(calculateDeckStats({ matches }, { drawsCountForWinRate: true }).winRate, 0.25);
});

test('daily charts expose their numeric axis and leave a gap on draw-only days', () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]), set: () => true });
  paintChart(ctx, 320, 160, [
    { rate: 0.5, label: '10-01' }, { rate: null, label: '10-02' }, { rate: 0, label: '10-03' },
  ], 'winrate');
  assert.equal(calls.filter((call) => call[0] === 'arc').length, 2, 'draw-only day is never plotted at 0%');
  assert.equal(calls.filter((call) => call[0] === 'lineTo').length, 2, 'only the two axis segments connect; data across a missing day does not');
  assert.equal(calls.filter((call) => call[0] === 'fillText' && /%$/.test(call[1])).length, 3);
});

test('ISO week buckets include year boundaries and do not use local DST durations', () => {
  const dates = ['2020-12-31', '2021-01-01', '2021-01-04', '2026-03-08', '2026-03-09'];
  const matches = dates.map((date, index) => ({ id: String(index), date, result: 'win' }));
  assert.deepEqual(buildFrequencySeries(matches), [
    { label: '2020-W53', count: 2 }, { label: '2021-W01', count: 1 },
    { label: '2026-W10', count: 1 }, { label: '2026-W11', count: 1 },
  ]);
});

test('EDHTI simulation samples the fifth answer and stamps the actual scoring input', () => {
  const questions = [{ id: 'one', answers: [0, 1, 2, 3, 4].map((index) => ({ scores: index === 4 ? { competitive: 1 } : { fun: 1 } })) }];
  const simulated = estimatePersonaOdds(questions, 100000, 42);
  assert.ok(Math.abs(simulated.odds.CTXM - 20) < 0.5, 'exact probability is one of five equally likely answers');
  assert.equal(edhtiOddsManifest.scoringFingerprint, questionFingerprint(edhtiQuestions));
  assert.deepEqual(edhtiOddsManifest.optionCounts, edhtiQuestions.map((question) => question.answers.length));
  assert.deepEqual(estimatePersonaOdds(edhtiQuestions, edhtiOddsManifest.trials, edhtiOddsManifest.seed).odds, edhtiPersonaOdds);
});

test('simulated EDHTI axis differences match the production tally on independent answer maps', () => {
  const counts = {};
  let state = 20261007;
  const random = () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
  const trials = 100000;
  for (let trial = 0; trial < trials; trial += 1) {
    const answers = Object.fromEntries(edhtiQuestions.map((question) => [question.id, Math.floor(random() * question.answers.length)]));
    const { code } = tallyEdhtiAnswers(edhtiQuestions, answers);
    counts[code] = (counts[code] || 0) + 1;
  }
  for (const [code, expected] of Object.entries(edhtiPersonaOdds)) {
    assert.ok(Math.abs((counts[code] || 0) / trials * 100 - expected) < 0.7, `${code}: independent tally disagrees with generated distribution`);
  }
});

test('sticker odds match independent subset enumeration for every draw size', () => {
  const pool = ['aeiouy', 'aeiou', 'aeio', 'aei', 'ae', 'a'].map((word, index) => ({ id: String(index), words: [word, '', ''] }));
  const powers = pool.map((sheet) => decorateStickerSheet(sheet).sheetPower);
  for (let pick = 1; pick <= pool.length; pick += 1) {
    const subsets = [];
    for (let mask = 1; mask < 2 ** pool.length; mask += 1) {
      const indices = powers.map((_, index) => index).filter((index) => mask & (1 << index));
      if (indices.length === pick) subsets.push(Math.max(...indices.map((index) => powers[index])));
    }
    const odds = calculateStickerOdds(pool, [6, 5, 4], pick);
    assert.equal(odds.totalCombos, subsets.length);
    for (const row of odds.thresholds) {
      const hitCount = subsets.filter((power) => power >= row.mana).length;
      assert.equal(row.hitCount, hitCount);
      assert.equal(row.probability, hitCount / subsets.length);
      assert.ok(row.probability >= 0 && row.probability <= 1);
    }
  }
});

test('sticker combination counts preserve exact integers even when multiplication before division would overflow', () => {
  const pool = Array.from({ length: 80 }, (_, index) => ({ id: String(index), words: [index === 0 ? 'aeiouy' : 'a', '', ''] }));
  const choose = (size, pick) => {
    let value = 1n;
    for (let step = 1; step <= Math.min(pick, size - pick); step += 1)
      value = value * BigInt(size - Math.min(pick, size - pick) + step) / BigInt(step);
    return value;
  };
  for (const [size, pick] of [[56, 23], [56, 27], [57, 24], [60, 20], [80, 12]]) {
    const exact = choose(size, pick);
    const expectedHits = exact - choose(size - 1, pick);
    const result = calculateStickerOdds(pool.slice(0, size), [6], pick);
    assert.equal(result.totalCombos, Number(exact));
    assert.equal(result.thresholds[0].hitCount, Number(expectedHits));
  }
  assert.throws(() => calculateStickerOdds(pool, [6], 40), RangeError);
});

test('poll proportions exclude unknown ballots and whole percent labels sum to 100', () => {
  const choices = [{ id: 'up' }, { id: 'down' }, { id: 'unknown' }];
  const result = calculatePollStats({ up: 1, down: 7, unknown: 9 }, choices);
  assert.equal(result.sample, 17);
  assert.equal(result.known, 8);
  assert.equal(result.unknown, 9);
  assert.deepEqual(result.rows.map((row) => row.percent), [13, 87]);
  assert.deepEqual(calculatePollStats({ up: 145, down: 55 }, choices).rows.map((row) => row.percent), [73, 27], 'equal remainders use choice order, not floating-point noise');
  assert.equal(calculatePollStats({ unknown: 1 }, choices).rows[0].percent, 0);
  for (let up = 0; up <= 20; up += 1) {
    for (let down = 0; down <= 20; down += 1) {
      const rows = calculatePollStats({ up, down }, choices).rows;
      assert.equal(rows.reduce((sum, row) => sum + row.percent, 0), up + down ? 100 : 0);
      rows.forEach((row) => assert.ok(row.percent >= 0 && row.percent <= 100));
    }
  }
  const exactPercentages = (counts) => {
    const total = counts.reduce((sum, value) => sum + BigInt(value), 0n);
    const parts = counts.map((value, index) => ({ index, percent: Number(BigInt(value) * 100n / total), remainder: BigInt(value) * 100n % total }));
    const missing = 100 - parts.reduce((sum, row) => sum + row.percent, 0);
    parts.slice().sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)
      .slice(0, missing).forEach((row) => { row.percent += 1; });
    return parts.map((row) => row.percent);
  };
  for (const counts of [[145, 55], [Number.MAX_SAFE_INTEGER - 1, 1], [4000000000000000, 5007199254740991], [0, Number.MAX_SAFE_INTEGER]]) {
    const rows = calculatePollStats({ up: counts[0], down: counts[1] }, choices).rows;
    assert.deepEqual(rows.map((row) => row.percent), exactPercentages(counts));
  }
  assert.throws(() => calculatePollStats({ up: -1 }, choices), /CORRUPT_TALLY/);
});

test('metadata coverage and priced-card sample size measure their own observations', () => {
  const cards = Array.from({ length: 20 }, (_, index) => ({ name: `Card ${index}`, key: `card ${index}`, count: 1 }));
  const byName = Object.fromEntries(cards.map((card, index) => [card.key, { typeLine: 'Creature', cmc: index < 10 ? 2 : null, usd: index < 15 ? 10 : null }]));
  const metrics = buildDeckMetrics(cards, { byName });
  assert.equal(metrics.metadataCoverage, 1, 'all twenty have metadata even when their MV is unavailable');
  assert.equal(metrics.manaCoverage, 0.5);
  assert.equal(metrics.priceCoverage, 0.75);
  assert.equal(metrics.priceCoveredCount, 15);
  assert.equal(metrics.priceReliable, false, 'fifteen observed prices do not satisfy a twenty-price minimum');
  for (const entry of Object.values(byName)) entry.usd = 10;
  assert.equal(buildDeckMetrics(cards, { byName }).priceReliable, true);
});

test('safe random ranges include their highest endpoint and reject precision loss', () => {
  assert.equal(rollInteger(0, Number.MAX_SAFE_INTEGER - 1, () => 1), Number.MAX_SAFE_INTEGER - 1);
  assert.equal(rollInteger(-6, -1, () => 1), -1);
  assert.deepEqual(sanitizeRange('', ''), { min: 1, max: 100 });
  assert.throws(() => sanitizeRange(0, Number.MAX_SAFE_INTEGER), RangeError);
  assert.throws(() => sanitizeRange(-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), RangeError);
  assert.throws(() => sanitizeRange(0, '9007199254740993'), RangeError);
});

test('integer random buckets have equal cardinality and exact boundaries, including large ranges', () => {
  // BigInt is an independent integer oracle, used only in Node tests, not the Mini Program.
  for (const span of [3n, 5n, 20n, 2n ** 32n + 1n, 2n ** 52n + 1n, 2n ** 53n - 1n]) {
    const large = span > 2n ** 32n;
    const space = large ? 2n ** 53n : 2n ** 32n;
    const size = space / span;
    const limit = size * span;
    const candidates = new Set([0n, size - 1n, size, 2n * size - 1n, 2n * size, limit - 1n]);
    for (const candidate of candidates) {
      const values = large
        ? [Number(candidate >> 32n) / 2 ** 21, Number(candidate & (2n ** 32n - 1n)) / 2 ** 32]
        : [Number(candidate) / 2 ** 32];
      const expected = Number(candidate / size);
      for (const min of [0, -100, Number.MAX_SAFE_INTEGER - Number(span) + 1]) {
        const max = min + Number(span) - 1;
        assert.equal(rollInteger(min, max, createSequenceRandom(values)), min + expected,
          `span=${span}, candidate=${candidate}, min=${min}`);
      }
    }
  }
});

test('integer random rejects incomplete buckets and bounds retries for a stuck source', () => {
  let calls = 0;
  const smallValues = [1 - Number.EPSILON / 2, 0.5];
  assert.equal(rollInteger(0, 2, () => { calls += 1; return smallValues.shift(); }), 1);
  assert.equal(calls, 2);
  const largeValues = [1 - Number.EPSILON / 2, 1 - Number.EPSILON / 2, 0, 7 / 2 ** 32];
  calls = 0;
  assert.equal(rollInteger(0, 2 ** 52, () => { calls += 1; return largeValues.shift(); }), 7);
  assert.equal(calls, 4);
  calls = 0;
  assert.throws(() => rollInteger(0, 2, () => { calls += 1; return 1 - Number.EPSILON / 2; }), RangeError);
  assert.equal(calls, 128);
});

test('Fisher-Yates has all six equally sized paths for three cards and conserves malformed RNG input', () => {
  const outcomes = new Set();
  for (let last = 0; last < 3; last += 1) {
    for (let second = 0; second < 2; second += 1) {
      outcomes.add(shuffleInPlace(['A', 'B', 'C'], createSequenceRandom([(last + 0.5) / 3, (second + 0.5) / 2])).join(''));
    }
  }
  assert.equal(outcomes.size, 6);
  for (const value of [1, -1, NaN, Infinity]) {
    const cards = shuffleInPlace(['A', 'B', 'C'], () => value);
    assert.deepEqual(cards.slice().sort(), ['A', 'B', 'C']);
  }
});

test('unsectioned deck input keeps every card in the main deck regardless of trailing newline', () => {
  const text = ['1 Alpha', '1 Beta', '1 Gamma', '1 Delta', '1 Epsilon'].join('\n');
  const a = parseMtgoDeckText(text);
  const b = parseMtgoDeckText(text + '\n');
  assert.equal(a.main.length, 5);
  assert.equal(a.commanders.length, 0);
  assert.deepEqual(a, b);
});

test('sticker draw counts cannot round a fractional number up into another experiment', () => {
  const { drawStickerSheets } = require('../miniprogram/utils/stickers');
  assert.throws(() => drawStickerSheets([], 1.5), RangeError);
  assert.throws(() => drawStickerSheets([], Infinity), RangeError);
  assert.deepEqual(drawStickerSheets([], 0), []);
});

test('tournament refresh keeps a single source window and never substitutes the curated pool denominator', () => {
  const nodes = [
    { name: 'A / B', stats: { count: 2, topCuts: 1, conversionRate: 0.5, metaShare: 0.2, winRate: 0.25 } },
    { name: 'C', stats: { count: 3, topCuts: 0, conversionRate: 0, metaShare: 0.3, winRate: 0 } },
  ];
  const snapshot = buildSnapshot(nodes, [{ name: 'B / A' }], '2026-10-06T00:00:00Z');
  assert.equal(snapshot.manifest.shareDenominator, 10, 'source includes entries outside both the requested roster and listed rows');
  assert.equal(snapshot.snapshot['B / A'].entries, 2);
  assert.equal(snapshot.snapshot['B / A'].metaShare, 0.2);
  assert.throws(() => buildSnapshot([{ ...nodes[0], stats: { ...nodes[0].stats, conversionRate: 0.3 } }], []), /inconsistent/);
  assert.throws(() => buildSnapshot([nodes[0], { ...nodes[1], stats: { ...nodes[1].stats, metaShare: 0.15 } }], []), /mixed/);
  assert.throws(() => buildSnapshot(nodes, [{ name: 'Missing' }]), /no row/);
  assert.equal(commanderStatsManifest.rosterRows, commanders.length);
  for (const commander of commanders) {
    assert.ok(Math.abs(commander.sourceStats.metaShare - commander.sourceStats.entries / commanderStatsManifest.shareDenominator) < 1e-10);
  }
  if (commanderStatsManifest.winRateVerification) {
    const report = require(`../docs/audits/${commanderStatsManifest.winRateVerification.reportFile}`);
    const verified = attachWinRateVerification({ manifest: {}, snapshot: commanderStats }, report);
    assert.deepEqual(verified.manifest.winRateVerification, commanderStatsManifest.winRateVerification, 'verification claims must bind to the current rates and receipt hash');
    assert.equal(verified.manifest.winRateDefinition, commanderStatsManifest.winRateDefinition);
  }
});

test('few observed entries do not prove a commander is competitively irrelevant', () => {
  const tags = deriveCommanderMetaTags({ name: 'Rare deck', sourceStats: { entries: 3, winRate: 0, metaShare: 0.0001 } }, metaTagConfig);
  assert.equal(tags.includes('irrelevant'), false);
});

test('entry verification pools reported results including draws and rejects stale or incomplete receipts', async () => {
  const nodes = [{ id: 'commander-A', name: 'A', stats: { count: 2, topCuts: 1, conversionRate: 0.5, metaShare: 0.2, winRate: 2 / 11 } }];
  const roster = [{ name: 'A' }];
  const result = buildSnapshot(nodes, roster);
  const page = (id, wins, losses, draws, next) => ({ data: { node: { entries: {
    edges: [{ node: { id, wins, losses, draws } }], pageInfo: { hasNextPage: !!next, endCursor: next },
  } } } });
  const requests = [];
  const request = async (id, variables) => {
    requests.push(variables);
    return variables.cursor ? page('entry-2', 1, 8, 0, null) : page('entry-1', 1, 0, 1, 'next');
  };
  const report = await verifySnapshotGames(nodes, roster, result, request);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].cursor, 'next');
  assert.deepEqual([report.rows[0].wins, report.rows[0].losses, report.rows[0].draws], [2, 8, 1]);
  assert.equal(report.rows[0].rebuilt, 2 / 11, 'pool results rather than average the two entry percentages or exclude draws');
  assert.equal(result.manifest.winRateDefinition, 'sum(wins)/sum(wins+losses+draws)');
  assert.equal(result.manifest.winRateVerification.rows, 1);
  assert.throws(() => attachWinRateVerification(buildSnapshot(nodes, roster), { ...report, rows: [] }), /invalid/);
  assert.throws(() => attachWinRateVerification(buildSnapshot(nodes, roster), { ...report, rows: [{ ...report.rows[0], entries: 1 }] }), /match/);
  assert.throws(() => attachWinRateVerification(buildSnapshot(nodes, roster), { ...report, filters: { ...report.filters, minEventSize: 16 } }), /invalid/);
  const changed = [{ ...nodes[0], stats: { ...nodes[0].stats, winRate: 0.5 } }];
  assert.throws(() => attachWinRateVerification(buildSnapshot(changed, roster), report), /match/);
  await assert.rejects(() => verifySnapshotGames(nodes, roster, buildSnapshot(nodes, roster), async () => page('entry-1', 1, 0, 1, null)), /match/);
  await assert.rejects(() => verifySnapshotGames(nodes, roster, buildSnapshot(nodes, roster), async () => page('entry-1', 1, 0, 1, 'next')), /duplicate/);
});

test('damaged match dates remain unknown and do not fabricate current-day observations', () => {
  const { sortMatches } = require('../miniprogram/utils/tracker');
  const rows = [
    { date: '2024-02-29', result: 'win' },
    { date: '2023-02-29', result: 'loss' },
    { date: '2026-13-01', result: 'loss' },
    { date: '2026-04-31', result: 'draw' },
    { date: '', result: 'win' },
  ];
  assert.equal(sortMatches(rows).length, 5, 'results are preserved');
  assert.equal(sortMatches(rows).filter(match => !match.date).length, 4);
  assert.deepEqual(buildWinRateSeries(rows, {}).map(point => point.date), ['2024-02-29']);
  assert.deepEqual(buildFrequencySeries(rows, { frequencyBucket: 'month' }), [{ label: '2024-02', count: 1 }]);
  assert.equal(calculateDeckStats({ matches: rows }, {}).winRate, 0.5);
});
