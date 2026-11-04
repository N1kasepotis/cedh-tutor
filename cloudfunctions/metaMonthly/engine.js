const crypto = require('crypto');

const MODEL = Object.freeze({
  version: 'relative-performance-v1', days: 90, minPlayers: 50, minSwissRounds: 4,
  minLeaderCoverage: 0.8, minFourSeatCoverage: 0.8,
  minEntries: 20, minPilots: 5, minEvents: 3, winPriorGames: 80, cutPriorEntries: 40,
  bootstrapSamples: 240,
});
const DAY = 86400;
function hash(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function periodWindow(period) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('INVALID_PERIOD');
  const [year, month] = period.split('-').map(Number);
  const end = Date.UTC(year, month, 1) / 1000;
  return { period, start: end - MODEL.days * DAY, end, monthStart: Date.UTC(year, month - 1, 1) / 1000 };
}
function previousPeriod(now = Date.now()) {
  const date = new Date(now);
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}
function names(value) {
  return String(value || '').normalize('NFKC').replace(/[’‘]/g, "'").split(/\s+\/\s+/)
    .map((name) => name.trim()).filter(Boolean).sort();
}
function nameKey(value) { return names(value).map((name) => name.toLowerCase()).join(' / '); }
function numeric(value) { return typeof value === 'number' && Number.isFinite(value); }
function rejected(reason) { return { ok: false, reason }; }

// Results are derived from completed tables, never from aggregate wins that may include byes or playoffs.
function normalizeEvent(event, info, window) {
  if (!event || !event.TID || !Array.isArray(event.standings) || !Array.isArray(event.rounds)) return rejected('invalid_schema');
  if (!numeric(event.startDate) || event.startDate < window.start || event.startDate >= window.end) return rejected('outside_window');
  if (!info || info.status !== 'Complete' || !numeric(info.endDate)) return rejected('missing_completion');
  if (info.endDate >= window.end || info.endDate < event.startDate) return rejected('finished_after_cutoff');
  if (event.isLeague || event.isTeamEvent || info.isTeamEvent) return rejected('unsupported_format');
  if (event.game !== 'Magic: The Gathering' || event.format !== 'EDH') return rejected('unsupported_format');
  if (/precon|pauper|bingo|off[ -]?meta|fringe|planechase|commander\s+draft/i.test(event.tournamentName || '')) return rejected('special_event');
  if (!Number.isInteger(event.swissNum) || event.swissNum < MODEL.minSwissRounds) return rejected('short_swiss');
  const players = new Map();
  for (const standing of event.standings) {
    if (!standing.id || players.has(standing.id)) return rejected('duplicate_player');
    players.set(standing.id, { id: hash(standing.id), leader: standing.leader || '', games: 0, wins: 0, draws: 0 });
  }
  const swiss = event.rounds.filter((round) => Number.isInteger(round.round) && round.round >= 1 && round.round <= event.swissNum);
  if (swiss.length !== event.swissNum || new Set(swiss.map((round) => round.round)).size !== swiss.length) return rejected('missing_round');
  const actual = new Set(); let pods = 0; let fourPods = 0; let skippedSeats = 0;
  for (const round of swiss) {
    const seen = new Set();
    if (!Array.isArray(round.tables)) return rejected('invalid_tables');
    for (const table of round.tables) {
      if (table.status === 'Bye') continue;
      if (table.status !== 'Completed' || !Array.isArray(table.players)) return rejected('unfinished_table');
      const ids = table.players.map((player) => player.id);
      if (new Set(ids).size !== ids.length || ids.some((id) => !id || !players.has(id) || seen.has(id))) return rejected('invalid_seats');
      ids.forEach((id) => { seen.add(id); actual.add(id); });
      for (const player of table.players) {
        const record = players.get(player.id);
        if (player.leader && record.leader && nameKey(player.leader) !== nameKey(record.leader)) return rejected('conflicting_leader');
        if (player.leader) record.leader = player.leader;
      }
      pods += 1;
      if (ids.length !== 4) { skippedSeats += ids.length; continue; }
      // Live V2 results use the explicit Draw sentinel. Completed + Unknown is missing data, not a draw.
      const drawn = table.winner_id === 'Draw' || (!table.winner_id && /^draw$/i.test(table.winner || ''));
      if (!drawn && !table.winner_id) return rejected('unknown_result');
      if (!drawn && !ids.includes(table.winner_id)) return rejected('invalid_winner');
      fourPods += 1;
      ids.forEach((id) => {
        const record = players.get(id);
        record.games += 1;
        if (!drawn && table.winner_id === id) record.wins += 1;
        if (drawn) record.draws += 1;
      });
    }
  }
  if (actual.size < MODEL.minPlayers) return rejected('small_event');
  if (!pods || fourPods / pods < MODEL.minFourSeatCoverage) return rejected('non_four_player_event');
  const active = [...actual].map((id) => ({ original: id, ...players.get(id) }));
  if (active.filter((player) => player.leader).length / active.length < MODEL.minLeaderCoverage) return rejected('missing_leaders');
  // Include later-round byes: the union of every playoff round must equal the declared cut.
  const qualifiers = new Set();
  event.rounds.filter((round) => typeof round.round === 'string' && /^Top \d+$|^Finals$/.test(round.round)).forEach((round) => {
    (round.tables || []).forEach((table) => (table.players || []).forEach((player) => qualifiers.add(player.id)));
  });
  const cutValid = Number.isInteger(event.topCut) && event.topCut > 0 && event.topCut <= actual.size
    && qualifiers.size === event.topCut && [...qualifiers].every((id) => actual.has(id));
  return { ok: true, event: {
    id: event.TID, title: String(event.tournamentName || event.TID).slice(0, 180),
    start: event.startDate, end: info.endDate, players: actual.size, fourPods, skippedSeats,
    cut: cutValid ? event.topCut : null,
    records: active.map((player) => ({
      pilot: player.id, leader: player.leader, games: player.games, wins: player.wins, draws: player.draws,
      cut: cutValid ? Number(qualifiers.has(player.original)) : null,
    })),
  } };
}
function canonicalCards(leader, cards) {
  const matches = names(leader).map((name) => cards[name.toLowerCase()]);
  if (!matches.length || matches.length > 2 || matches.some((card) => !card || !card.oracleId)) return null;
  if (new Set(matches.map((card) => card.oracleId)).size !== matches.length) return null;
  return matches.sort((a, b) => a.oracleId.localeCompare(b.oracleId));
}
function score(wins, games, cuts, expectedCuts, winBaseline, cutBaseline) {
  if (!games || !expectedCuts || !winBaseline || !cutBaseline) return null;
  const pWin = (wins + MODEL.winPriorGames * winBaseline) / (games + MODEL.winPriorGames);
  const cutLift = (cuts + MODEL.cutPriorEntries * cutBaseline) / (expectedCuts + MODEL.cutPriorEntries * cutBaseline);
  return 25 * (pWin / winBaseline + cutLift);
}
function seededRandom(seed) {
  let state = parseInt(hash(seed).slice(0, 8), 16) || 1;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function interval(row, eventIds, baselines) {
  const random = seededRandom(row.id); const scores = [];
  for (let run = 0; run < MODEL.bootstrapSamples; run += 1) {
    let wins = 0; let games = 0; let cuts = 0; let expected = 0;
    for (let index = 0; index < eventIds.length; index += 1) {
      const part = row.byEvent[eventIds[Math.floor(random() * eventIds.length)]];
      if (part) { wins += part.wins; games += part.games; cuts += part.cuts; expected += part.expected; }
    }
    const value = score(wins, games, cuts, expected, baselines.win, baselines.cut);
    if (value !== null) scores.push(value);
  }
  scores.sort((a, b) => a - b);
  if (scores.length < MODEL.bootstrapSamples * 0.8) return null;
  return [scores[Math.floor(scores.length * 0.025)], scores[Math.min(scores.length - 1, Math.floor(scores.length * 0.975))]];
}
const round = (value, digits = 2) => Number(value.toFixed(digits));
function buildSnapshot({ period, events, cards, excluded = {}, fetchedAt, previous = null }) {
  // API order and checkpoint order can differ; bootstrap draws must address the same event sequence.
  events = [...events].sort((a, b) => a.id.localeCompare(b.id));
  const window = periodWindow(period);
  const ids = events.map((event) => event.id);
  if (new Set(ids).size !== ids.length) throw new Error('DUPLICATE_EVENTS');
  if (events.length < 3) throw new Error('INSUFFICIENT_EVENTS');
  const groups = new Map(); let totalEntries = 0; let namedEntries = 0; let totalWins = 0; let totalGames = 0;
  let totalCutEntries = 0; let totalCutPlaces = 0; let unmapped = 0;
  for (const event of events) {
    if (event.start < window.start || event.end >= window.end) throw new Error('OUTSIDE_WINDOW');
    if (event.cut !== null) { totalCutEntries += event.players; totalCutPlaces += event.cut; }
    for (const record of event.records) {
      totalEntries += 1; totalWins += record.wins; totalGames += record.games;
      if (!record.leader) continue;
      const commanders = canonicalCards(record.leader, cards);
      if (!commanders) { unmapped += 1; continue; }
      namedEntries += 1;
      const id = commanders.map((card) => card.oracleId).join('+');
      if (!groups.has(id)) groups.set(id, { id, commanders, entries: 0, games: 0, wins: 0, draws: 0,
        cuts: 0, cutEntries: 0, expectedCuts: 0, pilots: new Set(), events: new Set(), byEvent: {}, monthEntries: 0 });
      const row = groups.get(id);
      row.entries += 1; row.games += record.games; row.wins += record.wins; row.draws += record.draws;
      row.pilots.add(record.pilot); row.events.add(event.id);
      if (event.start >= window.monthStart) row.monthEntries += 1;
      const cut = record.cut === null ? 0 : record.cut;
      const expected = event.cut === null ? 0 : event.cut / event.players;
      if (record.cut !== null) { row.cuts += cut; row.cutEntries += 1; row.expectedCuts += expected; }
      const part = row.byEvent[event.id] || { wins: 0, games: 0, cuts: 0, expected: 0 };
      part.wins += record.wins; part.games += record.games; part.cuts += cut; part.expected += expected;
      row.byEvent[event.id] = part;
    }
  }
  if (!totalGames || namedEntries / totalEntries < 0.75 || unmapped / Math.max(1, namedEntries + unmapped) > 0.05) throw new Error('LOW_COVERAGE');
  const baselines = { win: totalWins / totalGames, cut: totalCutPlaces / totalCutEntries };
  if (!baselines.win || !baselines.cut) throw new Error('MISSING_BASELINE');
  const previousRows = new Map((previous && previous.entries || []).map((entry) => [entry.id, entry]));
  const entries = [...groups.values()].map((row) => {
    const sampleReady = row.entries >= MODEL.minEntries && row.pilots.size >= MODEL.minPilots
      && row.events.size >= MODEL.minEvents && row.cutEntries >= MODEL.minEntries;
    const value = score(row.wins, row.games, row.cuts, row.expectedCuts, baselines.win, baselines.cut);
    const bounds = sampleReady ? interval(row, ids, baselines) : null;
    const tier = !bounds ? 'watch' : bounds[0] > 50 ? 't1' : bounds[1] < 50 ? 't3' : 't2';
    const previousRow = previousRows.get(row.id);
    return {
      id: row.id, name: row.commanders.map((card) => card.nameZh || card.name).join(' + '),
      nameEn: row.commanders.map((card) => card.name).join(' / '), commanders: row.commanders,
      colors: [...new Set(row.commanders.flatMap((card) => card.colors || []))].sort(),
      tier, score: value === null ? null : round(value, 1), interval: bounds && bounds.map((bound) => round(bound, 1)),
      entries: row.entries, monthEntries: row.monthEntries, pilots: row.pilots.size, events: row.events.size,
      games: row.games, wins: row.wins, draws: row.draws,
      winRate: row.games ? round(row.wins / row.games * 100, 1) : null,
      drawRate: row.games ? round(row.draws / row.games * 100, 1) : null,
      cuts: row.cuts, cutEntries: row.cutEntries, conversion: row.cutEntries ? round(row.cuts / row.cutEntries * 100, 1) : null,
      expectedCuts: round(row.expectedCuts), share: round(row.entries / totalEntries * 100, 2),
      delta: previousRow && value !== null && previousRow.score !== null && previous.modelVersion === MODEL.version
        ? round(value - previousRow.score, 1) : null,
      sourceEvents: [...row.events],
    };
  }).sort((a, b) => (b.score === null ? -Infinity : b.score) - (a.score === null ? -Infinity : a.score) || b.entries - a.entries || a.id.localeCompare(b.id));
  const snapshot = {
    schemaVersion: 1, modelVersion: MODEL.version, period, windowStart: new Date(window.start * 1000).toISOString(),
    windowEnd: new Date(window.end * 1000).toISOString(), asOf: new Date(window.end * 1000 - 1).toISOString(),
    fetchedAt, source: { name: 'TopDeck.gg', url: 'https://topdeck.gg', video: 'https://www.youtube.com/watch?v=N-ce6_qbOV8' },
    model: MODEL, baselines: { win: round(baselines.win * 100, 2), cut: round(baselines.cut * 100, 2) },
    coverage: { events: events.length, entries: totalEntries, mappedEntries: namedEntries, unmappedEntries: unmapped,
      leaderCoverage: round(namedEntries / totalEntries * 100, 1), games: totalGames,
      skippedSeats: events.reduce((sum, event) => sum + event.skippedSeats, 0), excluded },
    events: events.map(({ id, title, start, end, players, cut }) => ({ id, title, start, end, players, cut })), entries,
  };
  snapshot.hash = hash(snapshot);
  return snapshot;
}
module.exports = { MODEL, DAY, hash, periodWindow, previousPeriod, names, nameKey, normalizeEvent, buildSnapshot, score, canonicalCards };
