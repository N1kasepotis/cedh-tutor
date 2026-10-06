function toInteger(value, fallback) {
  if (value === null || value === undefined || String(value).trim() === '') return fallback;
  const number = Number(value);
  const integer = Math.trunc(number);
  if (!Number.isSafeInteger(integer)) throw new RangeError('请输入安全整数范围内的数');
  return integer;
}

function sanitizeRange(minInput, maxInput) {
  const rawMin = toInteger(minInput, 1);
  const rawMax = toInteger(maxInput, 100);
  const min = Math.min(rawMin, rawMax);
  const max = Math.max(rawMin, rawMax);
  if (!Number.isSafeInteger(max - min + 1)) throw new RangeError('随机范围太大，请缩小上下限之差');

  return { min, max };
}

function rollInteger(minInput, maxInput, randomFn = Math.random) {
  const { min, max } = sanitizeRange(minInput, maxInput);
  const span = max - min + 1;
  if (span === 1) return min;
  const wordSpace = 2 ** 32;
  const large = span > wordSpace;
  // Power-of-two scaling extracts integer blocks without multiplying by span.
  // Large ranges combine 21 + 32 bits from separate draws; all candidates are safe integers.
  const space = large ? 2 ** 53 : wordSpace;
  const limit = space - space % span;
  const bucketSize = limit / span;
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const first = Number(randomFn());
    // Preserve the existing fallback for malformed injected sources. Math.random is in [0, 1).
    if (!Number.isFinite(first) || first < 0) return min;
    if (first >= 1) return max;
    let candidate = Math.floor(first * wordSpace);
    if (large) {
      const second = Number(randomFn());
      if (!Number.isFinite(second) || second < 0) return min;
      if (second >= 1) return max;
      candidate = Math.floor(first * 2 ** 21) * wordSpace + Math.floor(second * wordSpace);
    }
    // Reject the incomplete final bucket rather than giving some outputs extra candidates.
    // Equal bucket sizes imply equal chances only when the source blocks are independent and uniform.
    if (candidate < limit) {
      const offset = (candidate - candidate % bucketSize) / bucketSize;
      return min + offset;
    }
  }
  throw new RangeError('随机源连续返回无法使用的数，请重试');
}

function createSequenceRandom(values) {
  let index = 0;
  const sequence = Array.isArray(values) && values.length ? values : [0];

  return function sequenceRandom() {
    const value = sequence[Math.min(index, sequence.length - 1)];
    index += 1;
    return value;
  };
}

function buildRollOff(playerCount = 4, sides = 20, randomFn = Math.random) {
  const safePlayerCount = Math.max(2, toInteger(playerCount, 4));
  const safeSides = Math.max(2, toInteger(sides, 20));
  const rolls = [];

  for (let index = 0; index < safePlayerCount; index += 1) {
    rolls.push({
      seat: `seat${index + 1}`,
      label: `Seat ${index + 1}`,
      value: rollInteger(1, safeSides, randomFn),
    });
  }

  const maxValue = Math.max(...rolls.map((roll) => roll.value));
  const winners = rolls.filter((roll) => roll.value === maxValue);
  const isTie = winners.length > 1;
  const resultLabel = isTie
    ? `${winners.map((winner) => winner.label).join(' / ')} 并列最高，需要重掷`
    : `${winners[0].label} 先手`;

  return {
    rolls,
    winners,
    isTie,
    maxValue,
    resultLabel,
  };
}

module.exports = {
  buildRollOff,
  createSequenceRandom,
  rollInteger,
  sanitizeRange,
};
