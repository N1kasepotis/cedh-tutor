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
const { buildSnapshot } = require('../scripts/refresh-commander-stats');
const { commanderStatsManifest } = require('../miniprogram/config/commander-stats');
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

test('poll proportions exclude unknown ballots and whole percent labels sum to 100', () => {
  const choices = [{ id: 'up' }, { id: 'down' }, { id: 'unknown' }];
  const result = calculatePollStats({ up: 1, down: 7, unknown: 9 }, choices);
  assert.equal(result.sample, 17);
  assert.equal(result.known, 8);
  assert.equal(result.unknown, 9);
  assert.deepEqual(result.rows.map((row) => row.percent), [13, 87]);
  assert.equal(calculatePollStats({ unknown: 1 }, choices).rows[0].percent, 0);
  for (let up = 0; up <= 20; up += 1) {
    for (let down = 0; down <= 20; down += 1) {
      const rows = calculatePollStats({ up, down }, choices).rows;
      assert.equal(rows.reduce((sum, row) => sum + row.percent, 0), up + down ? 100 : 0);
      rows.forEach((row) => assert.ok(row.percent >= 0 && row.percent <= 100));
    }
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
});

test('few observed entries do not prove a commander is competitively irrelevant', () => {
  const tags = deriveCommanderMetaTags({ name: 'Rare deck', sourceStats: { entries: 3, winRate: 0, metaShare: 0.0001 } }, metaTagConfig);
  assert.equal(tags.includes('irrelevant'), false);
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
