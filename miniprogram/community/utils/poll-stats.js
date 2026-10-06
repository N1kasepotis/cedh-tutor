'use strict';

function percentParts(count, total) {
  if (!total) return { percent: 0, remainder: 0 };
  // Exact quotient/remainder of 100 * count without overflowing safe integers.
  // All rows share the denominator, so integer remainders preserve exact ties.
  let percent = 0;
  let remainder = 0;
  const gap = total - count;
  for (let step = 0; step < 100; step += 1) {
    if (remainder >= gap) { remainder -= gap; percent += 1; }
    else remainder += count;
  }
  return { percent, remainder };
}

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
    return { ...row, ...percentParts(row.count, known), index };
  });
  // Largest remainders: whole-percent labels add to 100, including a 1/8 vs 7/8 vote.
  const missing = known ? 100 - opinions.reduce((total, row) => total + row.percent, 0) : 0;
  opinions.slice().sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, missing).forEach((row) => { row.percent += 1; });
  return { sample, unknown, known, rows: opinions.map(({ remainder, index, ...row }) => row) };
}

module.exports = { calculatePollStats };
