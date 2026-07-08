function toInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.trunc(number);
}

function sanitizeRange(minInput, maxInput) {
  const rawMin = toInteger(minInput, 1);
  const rawMax = toInteger(maxInput, 100);
  const min = Math.min(rawMin, rawMax);
  const max = Math.max(rawMin, rawMax);

  return { min, max };
}

function rollInteger(minInput, maxInput, randomFn = Math.random) {
  const { min, max } = sanitizeRange(minInput, maxInput);
  const randomValue = Number(randomFn());
  const safeRandom = Math.max(0, Math.min(0.999999999999, Number.isFinite(randomValue) ? randomValue : 0));

  return Math.floor(safeRandom * (max - min + 1)) + min;
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
