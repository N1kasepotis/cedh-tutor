const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);
const { rollInteger } = require('./random');

function createId(prefix = 'sheet') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function countUniqueVowels(word) {
  const seen = new Set();
  String(word || '').toLowerCase().split('').forEach((letter) => {
    if (VOWELS.has(letter)) seen.add(letter);
  });
  return seen.size;
}

function normalizeWords(words) {
  const source = Array.isArray(words) ? words : [];
  return [0, 1, 2].map((index) => String(source[index] || '').trim());
}

function normalizeStickerSheet(sheet, index = 0) {
  const words = normalizeWords(sheet && sheet.words);
  const fallbackName = words.filter(Boolean).join(' ') || `Sticker Sheet ${index + 1}`;

  return {
    id: String(sheet && sheet.id || `sheet-${index + 1}`),
    name: String(sheet && sheet.name || fallbackName).trim() || fallbackName,
    words,
  };
}

function normalizeStickerSheets(sheets, fallback = []) {
  const source = Array.isArray(sheets) ? sheets : fallback;
  return source.map((sheet, index) => normalizeStickerSheet(sheet, index));
}

function createBlankStickerSheet(index = 0) {
  return {
    id: createId('custom-sheet'),
    name: `Sticker Sheet ${index + 1}`,
    words: ['', '', ''],
  };
}

function decorateStickerSheet(sheet, sheetIndex = 0) {
  const normalized = normalizeStickerSheet(sheet, sheetIndex);
  const words = normalized.words.map((word, wordIndex) => ({
    text: word,
    word,
    wordIndex,
    vowelCount: countUniqueVowels(word),
    isBest: false,
  }));
  const bestWord = words.reduce((best, current) => (
    current.vowelCount > best.vowelCount ? current : best
  ), words[0] || { text: '', word: '', wordIndex: 0, vowelCount: 0 });

  return {
    ...normalized,
    words,
    bestWord,
    sheetPower: bestWord.vowelCount,
  };
}

function drawStickerSheets(pool, count = 3, randomFn = Math.random) {
  const source = normalizeStickerSheets(pool);
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('draw count must be a nonnegative integer');
  const drawCount = Math.min(count, source.length);
  const remaining = source.slice();
  const drawn = [];

  while (drawn.length < drawCount) {
    const index = rollInteger(0, remaining.length - 1, randomFn);
    drawn.push(remaining.splice(index, 1)[0]);
  }

  return drawn;
}

function findBestWord(decoratedSheets) {
  let best = {
    sheetId: '',
    sheetName: '',
    word: '',
    wordIndex: 0,
    vowelCount: 0,
  };

  decoratedSheets.forEach((sheet) => {
    sheet.words.forEach((word) => {
      if (word.vowelCount > best.vowelCount) {
        best = {
          sheetId: sheet.id,
          sheetName: sheet.name,
          word: word.text,
          wordIndex: word.wordIndex,
          vowelCount: word.vowelCount,
        };
      }
    });
  });

  return best;
}

function markBestWords(decoratedSheets, best) {
  return decoratedSheets.map((sheet) => ({
    ...sheet,
    words: sheet.words.map((word) => ({
      ...word,
      isBest: sheet.id === best.sheetId
        && word.wordIndex === best.wordIndex
        && word.text === best.word,
    })),
  }));
}

function buildStickerRound(pool, randomFn = Math.random, count = 3) {
  const normalized = normalizeStickerSheets(pool);
  if (normalized.length < count) {
    return {
      drawnSheets: [],
      best: { sheetName: '', word: '', vowelCount: 0 },
      summary: `贴纸池至少需要 ${count} 张`,
    };
  }

  const decorated = drawStickerSheets(normalized, count, randomFn).map(decorateStickerSheet);
  const best = findBestWord(decorated);

  return {
    drawnSheets: markBestWords(decorated, best),
    best,
    summary: `本局最高产出：${best.vowelCount} 点红色法术力`,
  };
}

function getCombinationCount(size, pick) {
  if (!Number.isSafeInteger(size) || !Number.isSafeInteger(pick) || size < 0 || pick < 0 || size < pick) return 0;
  const gcd = (left, right) => {
    while (right) [left, right] = [right, left % right];
    return left;
  };
  let combinations = 1;
  const steps = Math.min(pick, size - pick);
  for (let step = 1; step <= steps; step += 1) {
    // 先约分再相乘：最终结果可安全表示，也不保证先乘后除的中间值精确。
    let numerator = size - steps + step;
    let denominator = step;
    const common = gcd(numerator, denominator);
    numerator /= common;
    denominator /= common;
    const remaining = gcd(combinations, denominator);
    combinations /= remaining;
    denominator /= remaining;
    if (denominator !== 1)
      throw new RangeError('combination count exceeds safe integer precision');
    combinations *= numerator;
    if (!Number.isSafeInteger(combinations))
      throw new RangeError('combination count exceeds safe integer precision');
  }
  return combinations;
}

function formatProbability(value) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function calculateStickerOdds(pool, thresholds = [6, 5, 4], count = 3) {
  const sheets = normalizeStickerSheets(pool).map(decorateStickerSheet);
  const totalCombos = getCombinationCount(sheets.length, count);
  const hits = thresholds.map((mana) => ({ mana, hitCount: 0 }));

  if (!totalCombos) {
    return {
      totalCombos: 0,
      thresholds: hits.map((item) => ({
        ...item,
        probability: 0,
        probabilityLabel: '0.0%',
      })),
    };
  }

  // Complement: all size-k draws minus draws containing only below-threshold sheets.
  // This remains correct for any draw count, rather than hard-coding triples.
  hits.forEach((item) => {
    const below = sheets.filter((sheet) => sheet.sheetPower < item.mana).length;
    item.hitCount = totalCombos - getCombinationCount(below, count);
  });

  return {
    totalCombos,
    thresholds: hits.map((item) => {
      const probability = item.hitCount / totalCombos;
      return {
        ...item,
        probability,
        probabilityLabel: formatProbability(probability),
      };
    }),
  };
}

module.exports = {
  buildStickerRound,
  calculateStickerOdds,
  countUniqueVowels,
  createBlankStickerSheet,
  decorateStickerSheet,
  drawStickerSheets,
  normalizeStickerSheets,
};
