const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

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
  const drawCount = Math.min(Math.max(0, Number(count) || 0), source.length);
  const remaining = source.slice();
  const drawn = [];

  while (drawn.length < drawCount) {
    const randomValue = Number(randomFn());
    const safeRandom = Math.max(0, Math.min(0.999999999999, Number.isFinite(randomValue) ? randomValue : 0));
    const index = Math.floor(safeRandom * remaining.length);
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
      summary: '贴纸池至少需要 3 张',
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
  if (size < pick) return 0;
  let numerator = 1;
  let denominator = 1;
  for (let step = 0; step < pick; step += 1) {
    numerator *= size - step;
    denominator *= step + 1;
  }
  return numerator / denominator;
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

  for (let first = 0; first < sheets.length - 2; first += 1) {
    for (let second = first + 1; second < sheets.length - 1; second += 1) {
      for (let third = second + 1; third < sheets.length; third += 1) {
        const best = Math.max(
          sheets[first].sheetPower,
          sheets[second].sheetPower,
          sheets[third].sheetPower,
        );
        hits.forEach((item) => {
          if (best >= item.mana) item.hitCount += 1;
        });
      }
    }
  }

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
