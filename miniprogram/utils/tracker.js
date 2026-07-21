const RESULT_LABELS = {
  win: '胜',
  loss: '负',
  draw: '平',
};

const SEAT_OPTIONS = [
  { id: 'seat1', label: 'Seat 1' },
  { id: 'seat2', label: 'Seat 2' },
  { id: 'seat3', label: 'Seat 3' },
  { id: 'seat4', label: 'Seat 4' },
];

const SEAT_LABELS = SEAT_OPTIONS.reduce((labels, seat) => ({
  ...labels,
  [seat.id]: seat.label,
}), {});

function pad2(value) {
  return String(value).padStart(2, '0');
}

function todayString(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function normalizeDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return String(value);
  return todayString();
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyDeck(index = 0) {
  return {
    id: createId(`deck${index + 1}`),
    commander: null,
    matches: [],
    query: '',
    pendingDate: todayString(),
    pendingResult: 'win',
    pendingSeat: 'seat1',
  };
}

function normalizeCommander(commander) {
  if (!commander || !commander.name) return null;

  return {
    name: commander.name,
    colorIdentity: commander.colorIdentity || '',
    edhtop16Url: commander.edhtop16Url || '',
  };
}

function normalizeResult(value) {
  return RESULT_LABELS[value] ? value : 'win';
}

function normalizeSeat(value) {
  return SEAT_LABELS[value] ? value : null;
}

function sortMatches(matches) {
  return (matches || [])
    .filter((match) => match && RESULT_LABELS[match.result])
    .map((match, index) => ({
      id: match.id || createId(`match${index + 1}`),
      date: normalizeDate(match.date),
      result: match.result,
      seat: normalizeSeat(match.seat),
      seatLabel: normalizeSeat(match.seat) ? SEAT_LABELS[normalizeSeat(match.seat)] : '座位未知',
    }))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return String(a.id).localeCompare(String(b.id));
    });
}

function normalizeTrackerData(raw, commanderLibrary, config) {
  const maxDecks = Number(config && config.maxDecks || 5);
  const libraryByName = new Map((commanderLibrary || []).map((commander) => [commander.name, commander]));
  const sourceDecks = raw && Array.isArray(raw.decks) ? raw.decks : [];
  const decks = sourceDecks.slice(0, maxDecks).map((deck, index) => {
    const libraryCommander = deck && deck.commander && libraryByName.get(deck.commander.name);
    const commander = normalizeCommander(libraryCommander || deck.commander);

    return {
      id: deck.id || createId(`deck${index + 1}`),
      commander,
      matches: sortMatches(deck.matches),
      query: commander ? commander.name : '',
      pendingDate: normalizeDate(deck.pendingDate),
      pendingResult: normalizeResult(deck.pendingResult),
      pendingSeat: normalizeSeat(deck.pendingSeat) || 'seat1',
    };
  });

  if (!decks.length) decks.push(createEmptyDeck(0));

  return {
    version: Number(config && config.version || 1),
    decks,
  };
}

function serializeTrackerData(data) {
  return {
    version: data.version || 1,
    decks: (data.decks || []).map((deck) => ({
      id: deck.id,
      commander: normalizeCommander(deck.commander),
      matches: sortMatches(deck.matches).map((match) => ({
        id: match.id,
        date: match.date,
        result: match.result,
        seat: match.seat,
      })),
    })),
  };
}

function buildTrackerExportText(data, config) {
  const decks = data && Array.isArray(data.decks) ? data.decks : [];
  const lines = [
    'cEDH 导师战绩',
    `共 ${decks.length} 套牌`,
  ];

  if (!decks.length) {
    lines.push('', '暂无套牌记录');
    return lines.join('\n');
  }

  decks.forEach((deck, index) => {
    const commanderName = deck && deck.commander && deck.commander.name
      ? deck.commander.name
      : '未选择指挥官';
    const matches = sortMatches(deck && deck.matches);
    const stats = calculateDeckStats({ matches }, config);

    lines.push(
      '',
      `${index + 1}. ${commanderName}`,
      `总场次：${stats.total}`,
      `胜率：${stats.winRateLabel}`,
      `战绩：${stats.wins}胜 / ${stats.losses}负 / ${stats.draws}平`,
    );

    if (!matches.length) {
      lines.push('对局记录：暂无');
      return;
    }

    lines.push('对局记录：');
    matches.forEach((match) => {
      lines.push(`${match.date} ｜ ${RESULT_LABELS[match.result]} ｜ ${match.seatLabel || '座位未知'}`);
    });
  });

  return lines.join('\n');
}

function compactText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function fuzzyMatch(name, query) {
  const text = compactText(name);
  const needle = compactText(query);
  const tokens = String(query || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (!needle) return true;
  if (tokens.length > 1) {
    return tokens.every((token) => text.includes(token) || fuzzyMatch(name, token));
  }
  if (text.includes(needle)) return true;

  let cursor = 0;
  for (let index = 0; index < text.length && cursor < needle.length; index += 1) {
    if (text[index] === needle[cursor]) cursor += 1;
  }
  return cursor === needle.length;
}

function filterCommanders(commanders, query, limit = 8) {
  const trimmed = String(query || '').trim();
  return (commanders || [])
    .filter((commander) => fuzzyMatch(commander.name, trimmed))
    .sort((a, b) => {
      const aName = String(a.name || '').toLowerCase();
      const bName = String(b.name || '').toLowerCase();
      const q = trimmed.toLowerCase();
      const aStarts = q && aName.startsWith(q) ? 0 : 1;
      const bStarts = q && bName.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return aName.localeCompare(bName);
    })
    .slice(0, Math.max(1, Number(limit || 8)))
    .map(normalizeCommander);
}

function formatRate(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function calculateDeckStats(deck, config) {
  const matches = sortMatches(deck && deck.matches);
  const wins = matches.filter((match) => match.result === 'win').length;
  const losses = matches.filter((match) => match.result === 'loss').length;
  const draws = matches.filter((match) => match.result === 'draw').length;
  const denominator = wins + losses + ((config && config.drawsCountForWinRate) ? draws : 0);
  const winRate = denominator > 0 ? wins / denominator : 0;

  return {
    total: matches.length,
    wins,
    losses,
    draws,
    winRate,
    winRateLabel: formatRate(winRate),
  };
}

function buildWinRateSeries(matches, config) {
  const daily = new Map();
  sortMatches(matches).forEach((match) => {
    const entry = daily.get(match.date) || { wins: 0, losses: 0, draws: 0 };
    if (match.result === 'win') entry.wins += 1;
    if (match.result === 'loss') entry.losses += 1;
    if (match.result === 'draw') entry.draws += 1;
    daily.set(match.date, entry);
  });

  return Array.from(daily.entries()).map(([date, entry], index) => {
    const denominator = entry.wins + entry.losses
      + ((config && config.drawsCountForWinRate) ? entry.draws : 0);
    const rate = denominator > 0 ? entry.wins / denominator : 0;
    return {
      index: index + 1,
      date,
      label: date.slice(5),
      rate,
      rateLabel: formatRate(rate),
      sampleSize: denominator,
    };
  });
}

function getWeekLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay() || 7;
  const thursday = new Date(date);
  thursday.setDate(date.getDate() + 4 - day);
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
  return `${thursday.getFullYear()}-W${pad2(week)}`;
}

function getBucketLabel(dateString, bucket) {
  if (bucket === 'month') return dateString.slice(0, 7);
  return getWeekLabel(dateString);
}

function buildFrequencySeries(matches, config) {
  const bucket = config && config.frequencyBucket === 'month' ? 'month' : 'week';
  const counts = new Map();

  sortMatches(matches).forEach((match) => {
    const label = getBucketLabel(match.date, bucket);
    counts.set(label, (counts.get(label) || 0) + 1);
  });

  return Array.from(counts.entries()).map(([label, count]) => ({
    label,
    count,
  }));
}

function buildSeatWinRateSeries(matches, config) {
  const seatStats = new Map(SEAT_OPTIONS.map((seat) => [seat.id, {
    seat: seat.id,
    label: seat.label,
    wins: 0,
    losses: 0,
    draws: 0,
  }]));

  sortMatches(matches).forEach((match) => {
    if (!match.seat || !seatStats.has(match.seat)) return;
    const stats = seatStats.get(match.seat);

    if (match.result === 'win') stats.wins += 1;
    if (match.result === 'loss') stats.losses += 1;
    if (match.result === 'draw') stats.draws += 1;
  });

  return SEAT_OPTIONS.map((seat) => {
    const stats = seatStats.get(seat.id);
    const denominator = stats.wins + stats.losses + ((config && config.drawsCountForWinRate) ? stats.draws : 0);
    const rate = denominator > 0 ? stats.wins / denominator : 0;

    return {
      ...stats,
      sampleSize: denominator,
      rate,
      rateLabel: formatRate(rate),
    };
  });
}

module.exports = {
  RESULT_LABELS,
  SEAT_OPTIONS,
  buildFrequencySeries,
  buildSeatWinRateSeries,
  buildTrackerExportText,
  buildWinRateSeries,
  calculateDeckStats,
  createEmptyDeck,
  filterCommanders,
  normalizeTrackerData,
  serializeTrackerData,
  sortMatches,
  todayString,
};
