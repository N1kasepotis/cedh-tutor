'use strict';

function calculatePollStats(counts, choices) {
  const rows = choices.map((choice) => {
    const count = counts[choice.id] === undefined ? 0 : counts[choice.id];
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('CORRUPT_TALLY');
    return { ...choice, count };
  });
  const sample = rows.reduce((total, row) => total + row.count, 0);
  if (!Number.isSafeInteger(sample)) throw new Error('CORRUPT_TALLY');
  const unknown = rows.find((row) => row.id === 'unknown')?.count || 0;
  const known = sample - unknown;
  const opinions = rows.filter((row) => row.id !== 'unknown').map((row, index) => {
    const exact = known ? row.count / known * 100 : 0;
    const percent = Math.floor(exact);
    return { ...row, percent, remainder: exact - percent, index };
  });
  // Largest remainders: whole-percent labels add to 100, including a 1/8 vs 7/8 vote.
  const missing = known ? 100 - opinions.reduce((total, row) => total + row.percent, 0) : 0;
  opinions.slice().sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, missing).forEach((row) => { row.percent += 1; });
  return { sample, unknown, known, rows: opinions.map(({ remainder, index, ...row }) => row) };
}

module.exports = { calculatePollStats };
