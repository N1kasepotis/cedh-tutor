const { normalizeCardName } = require('./scryfall');
const { isQuestionnaireCommanderPoolMatch } = require('./bracket-commander-pool');
const {
  buildEfficiencyProfile,
  buildCohesionProfile,
  buildComboPotentialProfile,
} = require('./bracket-card-profile');
const {
  BRACKET_MANIFEST,
  BRACKET_LABELS,
  BAND_POSITION_CONFIG,
  COMBO_SPEED_CONFIG,
  GAME_CHANGERS,
  BANNED_CARDS,
  BANNED_AS_COMPANION,
  MASS_LAND_DENIAL,
  EXTRA_TURNS,
  SIGNAL_GROUPS,
  TOP_COMBO_FAMILIES,
  KNOWN_COMBOS,
  COMBO_PATTERNS,
  CARD_ALIASES,
} = require('../config/bracket-data');

const SECTION_HEADERS = Object.freeze({
  commander: 'commander',
  commanders: 'commander',
  command: 'commander',
  deck: 'main',
  main: 'main',
  mainboard: 'main',
  maindeck: 'main',
  'main deck': 'main',
  decklist: 'main',
  cards: 'main',
  creature: 'main',
  creatures: 'main',
  artifact: 'main',
  artifacts: 'main',
  enchantment: 'main',
  enchantments: 'main',
  instant: 'main',
  instants: 'main',
  sorcery: 'main',
  sorceries: 'main',
  land: 'main',
  lands: 'main',
  planeswalker: 'main',
  planeswalkers: 'main',
  battle: 'main',
  battles: 'main',
  companion: 'companion',
  companions: 'companion',
  sideboard: 'ignored',
  maybeboard: 'ignored',
  considering: 'ignored',
  tokens: 'ignored',
});

const MAX_DECK_LINES = 400;
const MAX_DECK_CHARS = 50000;
const MANA_CURVE_RELIABLE_COVERAGE = 0.8;
const MANA_CURVE_MIN_NONLAND_CARDS = 20;
const PRICE_RELIABLE_COVERAGE = 0.75;
const PRICE_MIN_ELIGIBLE_CARDS = 20;
const PRICE_SUPPORT_THRESHOLD_USD = 1200;
// 高造价竞技主将升档：结构落在 B4/B4.5、快速法术力 > 此张数、可靠造价 > 此价，且主将命中 100 人竞技主将池 → B5。
const EXPENSIVE_POOL_MIN_FAST_MANA = 3;
const EXPENSIVE_POOL_PRICE_THRESHOLD_USD = 1500;
// 识别密度低于此线（收录名单只覆盖不到四分之一非地牌）时，判定可能遗漏未收录的高强度变量单卡，置信度封顶「中」。
const RECOGNITION_DENSITY_FLOOR = 0.25;
const CURVE_BUCKET_DEFINITIONS = Object.freeze([
  Object.freeze({ key: 'mv01', label: '0–1' }),
  Object.freeze({ key: 'mv2', label: '2' }),
  Object.freeze({ key: 'mv3', label: '3' }),
  Object.freeze({ key: 'mv4', label: '4' }),
  Object.freeze({ key: 'mv5', label: '5' }),
  Object.freeze({ key: 'mv6plus', label: '6+' }),
]);
const STRONG_SIGNAL_THRESHOLDS = Object.freeze({
  fastMana: 2,
  efficientTutor: 3,
  freeInteraction: 2,
  staxOrDenial: 2,
  engine: 3,
  efficientWinCondition: 2,
  commandZoneEngine: 1,
});

function isStrongSignal(signal) {
  const threshold = signal && STRONG_SIGNAL_THRESHOLDS[signal.key];
  return Boolean(threshold && signal.count >= threshold);
}

function normalizeImportedCardName(name) {
  return normalizeCardName(name)
    .replace(/\s+\([A-Z0-9]{2,8}\)\s+[A-Z0-9★-]+(?:\s+\*F\*)?$/i, '')
    .replace(/\s+\*F\*$/i, '')
    .trim();
}

function canonicalCardKey(name) {
  const normalized = normalizeImportedCardName(name).toLowerCase();
  const aliased = CARD_ALIASES[normalized];
  return normalizeCardName(aliased || normalized).toLowerCase();
}

let efficiencyExclusionsCache = null;

function getEfficiencyExclusions() {
  if (efficiencyExclusionsCache) return efficiencyExclusionsCache;
  const cardSet = (groupKeys) => new Set(groupKeys.reduce((cards, key) => (
    cards.concat((SIGNAL_GROUPS[key] && SIGNAL_GROUPS[key].cards) || [])
  ), []).map(canonicalCardKey));
  efficiencyExclusionsCache = Object.freeze({
    regularRamp: cardSet(['fastMana']),
    interaction: cardSet(['freeInteraction', 'staxOrDenial']),
    cardFlow: cardSet(['efficientTutor', 'engine', 'efficientWinCondition']),
  });
  return efficiencyExclusionsCache;
}

function readMetadata(byName, key) {
  if (!byName || !key) return null;
  if (byName instanceof Map) return byName.get(key) || null;
  return Object.prototype.hasOwnProperty.call(byName, key) ? byName[key] : null;
}

function metadataForCard(card, metadataResult) {
  const byName = metadataResult && metadataResult.byName;
  return readMetadata(byName, card.key)
    || readMetadata(byName, normalizeImportedCardName(card.name).toLowerCase());
}

function curveBucketIndex(manaValue) {
  if (manaValue <= 1) return 0;
  if (manaValue >= 6) return 5;
  return Math.max(1, Math.floor(manaValue) - 1);
}

function roundMetric(value, places) {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

// 识别密度：轻量规则集实际认识多少张非地牌。metadata 可判定为地的排除，
// 无 metadata 的牌保守计为非地（正是无法评估强度的部分）；分子为落在收录名单里的非地牌。
function measureRecognitionCoverage(cards, metadataResult, recognizedKeys) {
  const nonlandKeys = new Set();
  (Array.isArray(cards) ? cards : []).forEach((card) => {
    if (card.section === 'companion') return;
    const key = canonicalCardKey(card.name);
    if (!key || nonlandKeys.has(key)) return;
    const metadata = metadataForCard(card, metadataResult);
    if (metadata) {
      const typeLine = normalizeCardName(metadata.frontTypeLine || metadata.typeLine).split(' // ')[0];
      if (/\bLand\b/i.test(typeLine)) return;
    }
    nonlandKeys.add(key);
  });
  let recognized = 0;
  nonlandKeys.forEach((key) => {
    if (recognizedKeys.has(key)) recognized += 1;
  });
  const nonlandUnique = nonlandKeys.size;
  return {
    nonlandUnique,
    recognizedNonlandUnique: recognized,
    recognitionDensity: nonlandUnique ? roundMetric(recognized / nonlandUnique, 4) : 0,
  };
}

function buildDeckMetrics(cards, metadataResult = {}) {
  const deckCards = (Array.isArray(cards) ? cards : [])
    .filter((card) => card.section !== 'companion');
  const curveBuckets = CURVE_BUCKET_DEFINITIONS.map((bucket) => ({ ...bucket, count: 0 }));
  const totalCardCount = deckCards.reduce((total, card) => total + card.count, 0);
  let metadataCoveredCount = 0;
  let manaCoveredCount = 0;
  let nonlandCoveredCount = 0;
  let lowCurveCount = 0;
  let highCurveCount = 0;
  let weightedManaValue = 0;
  let priceEligibleCount = 0;
  let priceCoveredCount = 0;
  let estimatedTotalUsd = 0;

  deckCards.forEach((card) => {
    const count = Number(card.count) || 0;
    if (count <= 0) return;
    const metadata = metadataForCard(card, metadataResult);
    if (!metadata) {
      // Unknown cards remain uncovered; they are never treated as free.
      priceEligibleCount += count;
      return;
    }

    metadataCoveredCount += count;
    const typeLine = normalizeCardName(metadata.frontTypeLine || metadata.typeLine).split(' // ')[0];
    const isLand = /\bLand\b/i.test(typeLine);
    const isBasicLand = /\bBasic\b[^/]*\bLand\b/i.test(typeLine);
    const manaValue = metadata.cmc === null || metadata.cmc === undefined || metadata.cmc === ''
      ? NaN
      : Number(metadata.cmc);

    if (typeLine && Number.isFinite(manaValue) && manaValue >= 0) {
      manaCoveredCount += count;
      if (!isLand) {
        nonlandCoveredCount += count;
        weightedManaValue += manaValue * count;
        if (manaValue <= 2) lowCurveCount += count;
        if (manaValue >= 5) highCurveCount += count;
        curveBuckets[curveBucketIndex(manaValue)].count += count;
      }
    }

    if (!isBasicLand) {
      priceEligibleCount += count;
      const usd = metadata.usd === null || metadata.usd === undefined || metadata.usd === ''
        ? NaN
        : Number(metadata.usd);
      if (Number.isFinite(usd) && usd >= 0) {
        priceCoveredCount += count;
        estimatedTotalUsd += usd * count;
      }
    }
  });

  const metadataCoverage = totalCardCount ? manaCoveredCount / totalCardCount : 0;
  const unresolvedManaCount = Math.max(0, totalCardCount - manaCoveredCount);
  // Resolved lands are known to be outside the curve. Every unresolved card is treated
  // as a possible nonland so missing high-MV spells cannot be hidden by covered lands.
  const curveCoverageDenominator = nonlandCoveredCount + unresolvedManaCount;
  const manaCoverage = curveCoverageDenominator
    ? nonlandCoveredCount / curveCoverageDenominator
    : 0;
  const priceCoverage = priceEligibleCount ? priceCoveredCount / priceEligibleCount : 0;
  const averageManaValue = nonlandCoveredCount
    ? weightedManaValue / nonlandCoveredCount
    : null;
  const lowCurveRatio = nonlandCoveredCount ? lowCurveCount / nonlandCoveredCount : 0;
  const highCurveRatio = nonlandCoveredCount ? highCurveCount / nonlandCoveredCount : 0;

  return {
    available: metadataCoveredCount > 0,
    totalCardCount,
    metadataCoveredCount,
    manaCoveredCount,
    metadataCoverage: roundMetric(metadataCoverage, 4),
    manaCoverage: roundMetric(manaCoverage, 4),
    nonlandCoveredCount,
    averageManaValue: averageManaValue === null ? null : roundMetric(averageManaValue, 2),
    lowCurveRatio: roundMetric(lowCurveRatio, 4),
    highCurveRatio: roundMetric(highCurveRatio, 4),
    curveBuckets,
    curveReliable: manaCoverage >= MANA_CURVE_RELIABLE_COVERAGE
      && nonlandCoveredCount >= MANA_CURVE_MIN_NONLAND_CARDS,
    priceEligibleCount,
    priceCoveredCount,
    priceCoverage: roundMetric(priceCoverage, 4),
    estimatedTotalUsd: priceCoveredCount ? roundMetric(estimatedTotalUsd, 2) : null,
    priceReliable: priceCoverage >= PRICE_RELIABLE_COVERAGE
      && priceEligibleCount >= PRICE_MIN_ELIGIBLE_CARDS,
    lookupRequestedCount: Number(metadataResult.requestedCount) || 0,
    lookupResolvedCount: Number(metadataResult.resolvedCount) || 0,
    lookupFailedBatchCount: Number(metadataResult.failedBatchCount) || 0,
  };
}

function curveSupportBand(deckMetrics) {
  if (!deckMetrics.curveReliable || deckMetrics.averageManaValue === null) return 1;
  if (deckMetrics.averageManaValue <= 2.25 && deckMetrics.lowCurveRatio >= 0.58) return 4;
  if (deckMetrics.averageManaValue <= 2.9 && deckMetrics.lowCurveRatio >= 0.42) return 3;
  return 1;
}

function strongSignalAxisCount(signals) {
  return signals.filter(isStrongSignal).length;
}

function normalizeHeader(line) {
  return normalizeCardName(line)
    .replace(/^\[|\]$/g, '')
    .replace(/:$/, '')
    .replace(/\s*\(\d+\)$/, '')
    .trim()
    .toLowerCase();
}

function looksLikeUnknownSection(line) {
  const normalized = normalizeCardName(line);
  if (!/:$|\(\d+\):?$/.test(normalized)) return false;
  return /^[A-Za-z][A-Za-z0-9 '\/&-]*(?:\s*\(\d+\))?:?$/.test(normalized);
}

function looksLikeCommentSection(line) {
  const normalized = normalizeCardName(line);
  return normalized.length <= 60
    && /^[A-Za-z][A-Za-z0-9 '\/&-]*(?:\s+[A-Za-z0-9 '\/&-]+){0,4}$/.test(normalized);
}

function parseCardLine(rawLine, lineNumber, section) {
  const trimmed = normalizeCardName(rawLine);
  let count = 1;
  let name = normalizeImportedCardName(trimmed);
  const quantityMatch = trimmed.match(/^(\d+)\s*[xX]?\s+(.+)$/);

  if (quantityMatch) {
    count = Number(quantityMatch[1]);
    name = normalizeImportedCardName(quantityMatch[2]);
    if (!Number.isInteger(count) || count < 1 || count > 100) {
      return {
        issue: {
          code: 'INVALID_QUANTITY',
          severity: 'error',
          line: lineNumber,
          raw: rawLine,
          message: `第 ${lineNumber} 行数量无效`,
        },
      };
    }
  } else if (/^\d/.test(trimmed) || /^\d+\s*[xX](?!\s)/.test(trimmed)) {
    return {
      issue: {
        code: 'INVALID_QUANTITY',
        severity: 'error',
        line: lineNumber,
        raw: rawLine,
        message: `第 ${lineNumber} 行数量格式无效`,
      },
    };
  }

  if (!name || name.length > 160 || !/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(name)) {
    return {
      issue: {
        code: 'INVALID_CARD_LINE',
        severity: 'error',
        line: lineNumber,
        raw: rawLine,
        message: `第 ${lineNumber} 行无法解析为英文卡名`,
      },
    };
  }

  return {
    card: {
      line: lineNumber,
      raw: rawLine,
      count,
      name,
      key: canonicalCardKey(name),
      section,
    },
  };
}

function parseBracketDeck(text) {
  const originalSource = String(text || '').replace(/\r\n?/g, '\n');
  const source = originalSource.slice(0, MAX_DECK_CHARS);
  const sourceLines = source.split('\n');
  const cards = [];
  const commanders = [];
  const companions = [];
  const ignored = [];
  const issues = [];
  let section = 'main';
  let hasCommanderSection = false;
  let explicitSection = false;
  let sawCards = false;
  let sawBlank = false;
  let afterBlank = false;

  if (originalSource.length > MAX_DECK_CHARS || sourceLines.length > MAX_DECK_LINES) {
    issues.push({
      code: 'INPUT_LIMIT_EXCEEDED',
      severity: 'error',
      line: MAX_DECK_LINES + 1,
      raw: '',
      message: `牌表超过 ${MAX_DECK_LINES} 行或 ${MAX_DECK_CHARS} 字符上限`,
    });
  }

  sourceLines.slice(0, MAX_DECK_LINES).forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmed = normalizeCardName(rawLine);
    if (!trimmed) {
      if (sawCards) {
        sawBlank = true;
        afterBlank = true;
      }
      return;
    }

    const commentMatch = trimmed.match(/^(?:#|\/\/)\s*(.+)$/);
    const headerCandidate = commentMatch ? commentMatch[1] : trimmed;
    const header = normalizeHeader(headerCandidate);
    if (SECTION_HEADERS[header]) {
      explicitSection = true;
      section = SECTION_HEADERS[header];
      return;
    }

    if (commentMatch) {
      if ((section === 'commander' || section === 'companion')
        && looksLikeCommentSection(headerCandidate)) {
        issues.push({
          code: 'UNKNOWN_SECTION',
          severity: 'warning',
          line: lineNumber,
          raw: rawLine,
          message: `第 ${lineNumber} 行是未识别区段`,
        });
        section = 'main';
        return;
      }
      ignored.push({ line: lineNumber, raw: rawLine, reason: 'comment' });
      return;
    }

    if (section === 'ignored') {
      ignored.push({ line: lineNumber, raw: rawLine, reason: 'sideboard' });
      return;
    }

    if (looksLikeUnknownSection(trimmed)) {
      explicitSection = true;
      issues.push({
        code: 'UNKNOWN_SECTION',
        severity: 'warning',
        line: lineNumber,
        raw: rawLine,
        message: `第 ${lineNumber} 行是未识别区段`,
      });
      // 未识别的类型分组不能沿用 Commander / Companion，避免把后续主牌误标为主将区。
      section = 'main';
      return;
    }

    const parsed = parseCardLine(rawLine, lineNumber, section);
    if (parsed.issue) {
      issues.push(parsed.issue);
      return;
    }

    sawCards = true;
    cards.push({ ...parsed.card, afterBlank });
  });

  if (!explicitSection && sawBlank) {
    cards.forEach((card) => {
      if (card.afterBlank) card.section = 'commander';
    });
  }

  cards.forEach((card) => {
    if (card.section === 'commander') commanders.push(card);
    if (card.section === 'companion') companions.push(card);
    delete card.afterBlank;
  });
  hasCommanderSection = commanders.length > 0;

  if (commanders.length > 2) {
    issues.push({
      code: 'COMMANDER_COUNT_UNUSUAL',
      severity: 'warning',
      line: 0,
      raw: '',
      message: `解析到 ${commanders.length} 位主将；通常应为 1–2 位`,
    });
  }

  if (cards.length && !hasCommanderSection) {
    issues.push({
      code: 'MISSING_COMMANDER_SECTION',
      severity: 'warning',
      line: 0,
      raw: '',
      message: '未发现 Commander 标题或主牌后的空行分隔；不会猜测主将',
    });
  }

  return {
    cards,
    commanders,
    companions,
    ignored,
    issues,
    hasCommanderSection,
  };
}

function toLookup(items) {
  const lookup = new Map();
  items.forEach((item) => lookup.set(canonicalCardKey(item), item));
  return lookup;
}

function buildCardIndex(cards) {
  const index = new Map();
  cards.forEach((card) => {
    const previous = index.get(card.key);
    if (previous) {
      previous.count += card.count;
      previous.sections.add(card.section);
    } else {
      index.set(card.key, {
        name: card.name,
        key: card.key,
        count: card.count,
        sections: new Set([card.section]),
      });
    }
  });
  return index;
}

function findTaggedCards(index, sourceCards, options = {}) {
  const lookup = toLookup(sourceCards);
  const found = [];
  index.forEach((entry, key) => {
    if (!lookup.has(key)) return;
    if (options.commanderOnly && !entry.sections.has('commander')) return;
    found.push(lookup.get(key));
  });
  return found.sort((a, b) => a.localeCompare(b));
}

function uniqueCardNames(cards) {
  const names = [];
  const seen = new Set();
  (cards || []).forEach((name) => {
    const key = canonicalCardKey(name);
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push(name);
  });
  return names;
}

function findPresentCards(index, sourceCards, options = {}) {
  return uniqueCardNames((sourceCards || []).filter((name) => {
    const entry = index.get(canonicalCardKey(name));
    if (!entry) return false;
    return !options.commanderOnly || entry.sections.has('commander');
  }));
}

function matchesAtLeastGroups(index, groups) {
  return (groups || []).every((group) => (
    findPresentCards(index, group.cards).length >= (Number(group.count) || 1)
  ));
}

function matchComboPattern(index, pattern) {
  const required = pattern.required || [];
  const commanderRequired = pattern.commanderRequired || [];
  const anyOfGroups = pattern.anyOfGroups || [];
  const atLeastGroups = pattern.atLeastGroups || [];
  if (findPresentCards(index, required).length !== uniqueCardNames(required).length) return null;
  if (findPresentCards(index, commanderRequired, { commanderOnly: true }).length
    !== uniqueCardNames(commanderRequired).length) return null;
  if (!anyOfGroups.every((group) => findPresentCards(index, group).length > 0)) return null;
  if (!matchesAtLeastGroups(index, atLeastGroups)) return null;

  const matchedCards = uniqueCardNames([
    ...required,
    ...commanderRequired,
    ...anyOfGroups.reduce((cards, group) => cards.concat(findPresentCards(index, group)), []),
    ...atLeastGroups.reduce((cards, group) => cards.concat(findPresentCards(index, group.cards)), []),
  ]);
  return { ...pattern, cards: matchedCards, matchKind: 'pattern' };
}

function detectKnownCombos(index) {
  const exactMatches = KNOWN_COMBOS
    .filter((combo) => combo.cards.every((name) => index.has(canonicalCardKey(name))))
    .map((combo) => ({ ...combo, cards: combo.cards.slice(), matchKind: 'exact' }));
  const completePatternMatches = COMBO_PATTERNS
    .filter((pattern) => pattern.countsAsCompleteFamily)
    .map((pattern) => matchComboPattern(index, pattern))
    .filter(Boolean);
  return exactMatches.concat(completePatternMatches);
}

function detectComboPatterns(index) {
  return COMBO_PATTERNS
    .filter((pattern) => !pattern.countsAsCompleteFamily)
    .map((pattern) => matchComboPattern(index, pattern))
    .filter(Boolean);
}

function collapseComboFamilies(detectedCombos) {
  const topFamilies = new Map(TOP_COMBO_FAMILIES.map((family) => [family.familyId, family]));
  const families = new Map();
  (detectedCombos || []).forEach((combo) => {
    const familyId = combo.familyId || combo.id;
    const topFamily = topFamilies.get(familyId);
    const existing = families.get(familyId) || {
      id: familyId,
      familyId,
      rank: topFamily ? topFamily.rank : null,
      label: topFamily ? topFamily.label : combo.label,
      result: topFamily ? topFamily.result : combo.result,
      speed: combo.speed,
      recommendedBracket: 1,
      hardMinimum: 0,
      cards: [],
      matchedVariantIds: [],
      matchedVariants: [],
      matchKind: 'family',
    };
    existing.speed = existing.speed === 'early' || combo.speed === 'early' ? 'early' : combo.speed;
    existing.recommendedBracket = Math.max(
      existing.recommendedBracket,
      Number(combo.recommendedBracket) || 1,
    );
    existing.hardMinimum = Math.max(existing.hardMinimum, comboHardMinimum(combo));
    existing.cards = uniqueCardNames(existing.cards.concat(combo.cards || []));
    existing.matchedVariantIds.push(combo.id);
    // 保留可选/计数组结构，供装配成本按「最小成套」而非「全部命中」计算
    existing.matchedVariants.push({
      id: combo.id,
      cards: (combo.cards || []).slice(),
      required: (combo.required || []).slice(),
      commanderRequired: (combo.commanderRequired || []).slice(),
      anyOfGroups: (combo.anyOfGroups || []).map((group) => group.slice()),
      atLeastGroups: (combo.atLeastGroups || []).map((group) => ({
        cards: (group.cards || []).slice(),
        count: Number(group.count) || 1,
      })),
    });
    families.set(familyId, existing);
  });
  return Array.from(families.values()).sort((a, b) => {
    const rankA = Number.isInteger(a.rank) ? a.rank : Number.MAX_SAFE_INTEGER;
    const rankB = Number.isInteger(b.rank) ? b.rank : Number.MAX_SAFE_INTEGER;
    return rankA - rankB || a.label.localeCompare(b.label);
  });
}

function resolveContextualWinConditions(index, detectedComboFamilies) {
  const matchedFamilies = new Set((detectedComboFamilies || []).map((family) => family.familyId));
  const resolved = [];
  TOP_COMBO_FAMILIES.forEach((family) => {
    if (!matchedFamilies.has(family.familyId)) return;
    (family.winCards || []).forEach((winCard) => {
      if (winCard.scope !== 'family') return;
      if (!findPresentCards(index, [winCard.name], { commanderOnly: winCard.commanderOnly }).length) return;
      if (findPresentCards(index, winCard.requiresAll || []).length
        !== uniqueCardNames(winCard.requiresAll || []).length) return;
      if ((winCard.requiresAny || []).length
        && !findPresentCards(index, winCard.requiresAny).length) return;
      if (!matchesAtLeastGroups(index, winCard.requiresAtLeast || [])) return;
      resolved.push(winCard.name);
    });
  });
  return uniqueCardNames(resolved);
}

function signalBand(signals) {
  const counts = Object.fromEntries(signals.map((signal) => [signal.key, signal.count]));
  const fast = counts.fastMana || 0;
  const tutors = counts.efficientTutor || 0;
  const free = counts.freeInteraction || 0;
  const denial = counts.staxOrDenial || 0;
  const engines = counts.engine || 0;
  const winConditions = counts.efficientWinCondition || 0;
  const command = counts.commandZoneEngine || 0;
  // 免费互动是反应性/保护性的：它护住一套打法，本身不构成打法。因此单独的替费密度不足以
  // 独立进 B4（optimized/高强度需要主动牌力）——只在与主动信号搭配时（fast≥2 & tutors≥3 &
  // free≥2）计入 B4，或经 Game Changer 张数下限（官方 3 张规则）进档。Stax 是主动控制轴，
  // denial≥4 仍可独立 B4。参见四支柱门槛里「锋利度」同样是必要非充分。
  if (fast >= 4
    || tutors >= 5
    || denial >= 4
    || (fast >= 2 && tutors >= 3 && free >= 2)
    || (command >= 1 && fast >= 3 && tutors >= 3)) return 4;

  // 一两张替费仍算「升级」结构信号（B3），与官方 1–3 张 Game Changer→Upgraded 对齐；
  // 但不再让纯替费密度独自冲到 B4。
  if (fast >= 2
    || tutors >= 3
    || free >= 2
    || denial >= 2
    || engines >= 3
    || winConditions >= 2
    || (command >= 1 && (fast >= 1 || tutors >= 2))) return 3;

  return 1;
}

// 组装一致性：可靠地找到并拼出制胜线的能力。通用导师是经典路径，但主将区引擎（每局常驻、
// 可反复取用）与抓牌引擎同样带来一致性——单色导师稀缺的组合技主将（如 Magda）靠主将本身
// 而非通用导师达成一致性，因此不能用「导师 ≥3」这条蓝黑范式硬门槛一刀切。
function consistencyReach(tutors, command, engines) {
  return (tutors || 0) + (command >= 1 ? 2 : 0) + Math.min(engines || 0, 2);
}

// 竞技构筑门槛：把 cEDH 拆成四条与颜色/原型无关的支柱，每条都能用多种方式满足，
// 避免只认「快速法术力 + 通用导师 + 免费反击 + 已收录双卡组合技」这一蓝黑 turbo 范式。
function hasCompetitiveSignalDensity(signals, detectedComboFamilies, detectedComboPatterns = []) {
  const counts = Object.fromEntries(signals.map((signal) => [signal.key, signal.count]));
  const fast = counts.fastMana || 0;
  const tutors = counts.efficientTutor || 0;
  const free = counts.freeInteraction || 0;
  const denial = counts.staxOrDenial || 0;
  const engines = counts.engine || 0;
  const winConditions = counts.efficientWinCondition || 0;
  const command = counts.commandZoneEngine || 0;
  const totalSignals = signals.reduce((total, signal) => total + signal.count, 0);
  const highAxes = [
    fast >= 3,
    tutors >= 4,
    free >= 2,
    denial >= 3,
    engines >= 3,
    winConditions >= 2,
    command >= 1,
  ].filter(Boolean).length;
  const hasEarlyCombo = detectedComboFamilies.concat(detectedComboPatterns)
    .some(isEarlyCombo);
  // 支柱一，速度：爆发性法术力，色彩无关；也是挡住休闲牌组的硬地板（premium 快速法术力密度）。
  const hasSpeed = fast >= 3;
  // 支柱二，一致性：导师或主将区引擎或抓牌引擎，任一路径凑够都行。
  const hasConsistency = consistencyReach(tutors, command, engines) >= 3;
  // 支柱三，制胜路径：已收录早期组合技、curated 主将区引擎（本身即制胜/组合技引擎）、或极高多轴密度。
  const hasExtremeBreadth = totalSignals >= 14
    && highAxes >= 4
    && (command >= 1 || engines >= 3 || winConditions >= 2 || denial >= 3 || hasEarlyCombo);
  const hasWinPath = hasEarlyCombo || command >= 1 || hasExtremeBreadth;
  // 支柱四，锋利度：至少一条真实的抗干扰/压制/爆发轴，挡住「快速法术力 + 导师 + 好牌堆」的纯 durdle。
  const hasEdge = free >= 2 || denial >= 2 || hasEarlyCombo || hasExtremeBreadth;

  return hasSpeed && hasConsistency && hasWinPath && hasEdge;
}

function normalizeBracketDisplayCopy(value) {
  return String(value || '')
    .replace(/[；。]+/g, '，')
    .replace(/，{2,}/g, '，')
    .replace(/^，+|，+$/g, '');
}

function buildEvidence(code, kind, cards, title, detail, minimumBracket) {
  return {
    code,
    kind,
    cards: cards.slice(),
    title,
    detail: normalizeBracketDisplayCopy(detail),
    minimumBracket,
    ruleVersion: BRACKET_MANIFEST.ruleVersion,
  };
}

function comboHardMinimum(combo) {
  if (Number.isInteger(combo.hardMinimum)) return combo.hardMinimum;
  if (combo.cards.length !== 2) return 0;
  // 自动可检验基线：完整双卡循环排除 B1；早期双卡组合技直接进入 B4 下限。
  return combo.speed === 'early' ? 4 : 2;
}

// 速度分档：组合技全套牌张法术力值合计 → 1..5（越小越快，档表在 config）。
function comboSpeedTier(manaValue) {
  if (!Number.isFinite(manaValue) || manaValue < 0) return null;
  const tier = COMBO_SPEED_CONFIG.tiers.find((entry) => manaValue <= entry.maxManaValue);
  return tier ? tier.speed : COMBO_SPEED_CONFIG.fallbackSpeed;
}

function metadataManaValue(name, metadataResult) {
  const metadata = metadataForCard({ name }, metadataResult);
  const manaValue = metadata && metadata.cmc !== null && metadata.cmc !== undefined && metadata.cmc !== ''
    ? Number(metadata.cmc)
    : NaN;
  return Number.isFinite(manaValue) && manaValue >= 0 ? manaValue : null;
}

// 单个变体的「最小成套」装配：固定件（required / commanderRequired）全算，
// 可选组（anyOf）取已命中里最便宜一张，计数组（atLeast）取已命中里最便宜的 count 张。
// 无组结构的精确组合技退回全卡。任一必需件缺 cmc 时返回 null（装配未知）。
// 返回 { total, components }，components 为按成套顺序排列的各件法术力值（用于「启动法术力 x+x」展示）。
function variantAssembly(variant, metadataResult) {
  const matchedKeys = new Set((variant.cards || []).map(canonicalCardKey));
  const fixed = (variant.required || []).concat(variant.commanderRequired || []);
  const anyOfGroups = variant.anyOfGroups || [];
  const atLeastGroups = variant.atLeastGroups || [];
  const hasStructure = fixed.length || anyOfGroups.length || atLeastGroups.length;
  const components = [];

  if (!hasStructure) {
    if (!(variant.cards || []).length) return null;
    for (let i = 0; i < variant.cards.length; i += 1) {
      const manaValue = metadataManaValue(variant.cards[i], metadataResult);
      if (manaValue === null) return null;
      components.push(manaValue);
    }
    return { total: components.reduce((sum, mv) => sum + mv, 0), components };
  }

  for (let i = 0; i < fixed.length; i += 1) {
    const manaValue = metadataManaValue(fixed[i], metadataResult);
    if (manaValue === null) return null;
    components.push(manaValue);
  }
  for (let i = 0; i < anyOfGroups.length; i += 1) {
    const matchedValues = (anyOfGroups[i] || [])
      .filter((name) => matchedKeys.has(canonicalCardKey(name)))
      .map((name) => metadataManaValue(name, metadataResult))
      .filter((manaValue) => manaValue !== null);
    if (!matchedValues.length) return null;
    components.push(Math.min(...matchedValues));
  }
  for (let i = 0; i < atLeastGroups.length; i += 1) {
    const need = Number(atLeastGroups[i].count) || 1;
    const matchedValues = (atLeastGroups[i].cards || [])
      .filter((name) => matchedKeys.has(canonicalCardKey(name)))
      .map((name) => metadataManaValue(name, metadataResult))
      .filter((manaValue) => manaValue !== null)
      .sort((a, b) => a - b);
    if (matchedValues.length < need) return null;
    for (let j = 0; j < need; j += 1) components.push(matchedValues[j]);
  }
  return { total: components.reduce((sum, mv) => sum + mv, 0), components };
}

// 已确认家族的客观装配成本：逐变体求最小成套，取可完整覆盖变体中的最快一线（total 最小）；
// 任一变体覆盖不全（缺 cmc）则跳过，全部缺失时不添加字段（保持元数据缺失路径逐字节不变）。
function resolveComboAssembly(family, metadataResult) {
  if (!metadataResult) return family;
  let best = null;
  (family.matchedVariants || []).forEach((variant) => {
    const assembly = variantAssembly(variant, metadataResult);
    if (assembly && (best === null || assembly.total < best.total)) best = assembly;
  });
  if (best === null) return family;
  return {
    ...family,
    assemblyManaValue: best.total,
    assemblySpeed: comboSpeedTier(best.total),
    assemblyBreakdown: best.components.slice(),
  };
}

// 「早期组合技」双轨判定：人工 speed 标注（离线兜底）或客观速度档达标（元数据可用时）。
function isEarlyCombo(combo) {
  if (combo.speed === 'early') return true;
  return Number.isInteger(combo.assemblySpeed)
    && combo.assemblySpeed >= COMBO_SPEED_CONFIG.earlyMinSpeed;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function bandAxis(key, label, progress) {
  return { key, label, progress: roundMetric(clamp01(progress), 4) };
}

function bandAxisSum(axes) {
  return axes.reduce((total, axis) => total + axis.progress, 0);
}

function signalGroupLabel(key) {
  return (SIGNAL_GROUPS[key] && SIGNAL_GROUPS[key].label) || key;
}

function bandSignalCounts(signals) {
  const counts = Object.fromEntries((signals || []).map((signal) => [signal.key, signal.count]));
  return {
    fast: counts.fastMana || 0,
    tutors: counts.efficientTutor || 0,
    free: counts.freeInteraction || 0,
    denial: counts.staxOrDenial || 0,
    engines: counts.engine || 0,
    winConditions: counts.efficientWinCondition || 0,
    command: counts.commandZoneEngine || 0,
  };
}

// 抗干扰韧性轴（色彩中立）：蓝系靠免费反击，其他颜色靠 Stax、主将区引擎或更深的导师／
// 引擎冗余抵抗对手互动。取各路径最大值，使不沾蓝的 cEDH 不因免费反击少而被压档。
const RESILIENCE_AXIS_LABEL = '抗干扰韧性';
const CONSISTENCY_AXIS_LABEL = '组装一致性';
function competitiveResilience(counts) {
  return Math.max(
    counts.free / 2,
    counts.denial / 3,
    counts.command >= 1 ? 0.8 : 0,
    clamp01((counts.tutors - 3) / 3),
    clamp01((counts.engines + counts.winConditions) / 3),
  );
}
function competitiveResilienceSurplus(counts) {
  return Math.max(
    (counts.free - 2) / 3,
    (counts.denial - 3) / 3,
    counts.command >= 1 ? 0.4 : 0,
    clamp01((counts.tutors - 4) / 3),
    clamp01((counts.engines + counts.winConditions - 1) / 3),
  );
}

// B5 四项必要条件的联合接近度（B4 区间定位与竞技升档门槛共用）：
// 平均达成度取平方，表达「四项必须同时满足」的联合接近程度。
function bandApproachToBFive(counts, combos, signals) {
  const totalSignals = (signals || []).reduce((total, signal) => total + signal.count, 0);
  const highAxes = [
    counts.fast >= 3, counts.tutors >= 4, counts.free >= 2, counts.denial >= 3,
    counts.engines >= 3, counts.winConditions >= 2, counts.command >= 1,
  ].filter(Boolean).length;
  const comboTrigger = combos.reduce((best, combo) => {
    if (Number.isInteger(combo.assemblySpeed)) {
      return Math.max(best, clamp01(combo.assemblySpeed / COMBO_SPEED_CONFIG.earlyMinSpeed));
    }
    if (isEarlyCombo(combo)) return Math.max(best, 1);
    return Math.max(best, combo.matchKind === 'pattern' ? 0.35 : 0.5);
  }, 0);
  const breadthTrigger = (Math.min(totalSignals / 14, 1) + Math.min(highAxes / 4, 1)) / 2;
  const axes = [
    bandAxis('fastMana', signalGroupLabel('fastMana'), counts.fast / 3),
    bandAxis('consistency', CONSISTENCY_AXIS_LABEL, consistencyReach(counts.tutors, counts.command, counts.engines) / 3),
    bandAxis('resilience', RESILIENCE_AXIS_LABEL, competitiveResilience(counts)),
    bandAxis('winTrigger', '早期组合技或多轴密度', Math.max(comboTrigger, breadthTrigger)),
  ];
  const mean = bandAxisSum(axes) / axes.length;
  return {
    axes,
    mean,
    score: roundMetric(clamp01(mean * mean), 4),
    bottleneckAxis: axes.reduce((low, axis) => (axis.progress < low.progress ? axis : low), axes[0]),
  };
}

// 超出 B5 竞技强度阈值的余量（B4.5 与 B5 的升档门槛）。
function bandCompetitiveSurplus(counts, combos) {
  const speedSurplus = combos.reduce((best, combo) => {
    if (Number.isInteger(combo.assemblySpeed)) {
      return Math.max(best, clamp01(combo.assemblySpeed - COMBO_SPEED_CONFIG.earlyMinSpeed));
    }
    return Math.max(best, combo.speed === 'early' ? 0.5 : 0);
  }, 0);
  const axes = [
    bandAxis('fastMana', signalGroupLabel('fastMana'), (counts.fast - 3) / 3),
    bandAxis('consistency', CONSISTENCY_AXIS_LABEL, (consistencyReach(counts.tutors, counts.command, counts.engines) - 3) / 3),
    bandAxis('resilience', RESILIENCE_AXIS_LABEL, competitiveResilienceSurplus(counts)),
    bandAxis('comboSpeed', '组合技装配速度', speedSurplus),
  ];
  return {
    axes,
    score: roundMetric(clamp01((bandAxisSum(axes) / axes.length) * BAND_POSITION_CONFIG.surplusGain), 4),
  };
}

// 区间定位：在已判定档位内再分「偏弱 / 中等 / 偏强」。
// 分数只复用档位判定本身的信号轴（阈值与 signalBand / hasCompetitiveSignalDensity 一一对应）：
// B1–B3 = 向上一档判定门槛的推进度累计（accumulationSpan 归一），
// B4 = B5 四项必要条件平均达成度的平方（联合满足的接近程度）。
// B4.5 与 B5 暂不区分：竞技档内强弱取决于赛事 meta 表现，结构信号不足以支撑可信排序。
// 离线路径同样可算，不依赖元数据。
function computeBandPosition({
  assignedBracket,
  signals,
  detectedComboFamilies,
  detectedComboPatterns,
  extraTurns,
}) {
  const bandCounts = bandSignalCounts(signals);
  const fast = bandCounts.fast;
  const tutors = bandCounts.tutors;
  const free = bandCounts.free;
  const denial = bandCounts.denial;
  const engines = bandCounts.engines;
  const winConditions = bandCounts.winConditions;
  const command = bandCounts.command;
  const extraTurnCount = (extraTurns || []).length;
  const combos = (detectedComboFamilies || []).concat(detectedComboPatterns || []);
  const config = BAND_POSITION_CONFIG;

  if (assignedBracket >= 4.5) {
    // B5 是有真实赛事 meta 的竞技档，说明为何不细分；B4.5 准竞技是 B4 与 cEDH 之间的过渡、无对应 meta，一句带过不赘述。
    // 不承诺「日后接入 meta 后提供」：环境梯度是署名的人工编辑判断，把它注入确定性分类器
    // 会毁掉判定链的可审计性，也会让同一副牌的档位随第三方编辑改动而变。两者刻意保持解耦。
    const evidenceText = assignedBracket === 5
      ? 'B5 竞技档内的强弱区分取决于赛事 meta 表现（对局数据、席位胜率与常见配置对照），结构信号不足以支撑可信排序，本工具不对该档内部排序'
      : 'B4.5 准竞技是 B4 与 cEDH 之间的过渡，档内不再细分强弱';
    return {
      tier: null,
      zh: '',
      score: null,
      percent: null,
      metric: 'deferred',
      nextBracket: null,
      axes: [],
      topAxis: null,
      bottleneckAxis: null,
      conjunctMeanPercent: null,
      metricText: '',
      summaryText: '',
      evidenceText,
      deferred: true,
    };
  }

  let axes = [];
  let score = 0;
  let metric = 'progress';
  let nextBracket = null;
  let bottleneckAxis = null;
  let conjunctMeanPercent = null;

  if (assignedBracket <= 2) {
    // 结构强度区间没有 B2（signalBand 只产出 1/3/4），B1 与 B2 的上一档判定门槛都是 B3。
    nextBracket = 3;
    axes = [
      bandAxis('fastMana', signalGroupLabel('fastMana'), fast / 2),
      bandAxis('efficientTutor', signalGroupLabel('efficientTutor'), tutors / 3),
      bandAxis('freeInteraction', signalGroupLabel('freeInteraction'), free / 2),
      bandAxis('staxOrDenial', signalGroupLabel('staxOrDenial'), denial / 2),
      bandAxis('engine', signalGroupLabel('engine'), engines / 3),
      bandAxis('efficientWinCondition', signalGroupLabel('efficientWinCondition'), winConditions / 2),
      bandAxis('extraTurns', '额外回合', extraTurnCount / 2),
    ];
    if (command >= 1) {
      axes.push(bandAxis(
        'commandZonePath',
        '主将区引擎路径',
        (1 + Math.max(Math.min(fast, 1), Math.min(tutors / 2, 1))) / 2,
      ));
    }
    score = bandAxisSum(axes) / config.accumulationSpan;
  } else if (assignedBracket === 3) {
    nextBracket = 4;
    const combinedGate = (Math.min(fast / 2, 1) + Math.min(tutors / 3, 1) + Math.min(free / 2, 1)) / 3;
    axes = [
      bandAxis('fastMana', signalGroupLabel('fastMana'), (fast - 2) / 2),
      bandAxis('efficientTutor', signalGroupLabel('efficientTutor'), (tutors - 3) / 2),
      bandAxis('freeInteraction', signalGroupLabel('freeInteraction'), (free - 2) / 2),
      bandAxis('staxOrDenial', signalGroupLabel('staxOrDenial'), (denial - 2) / 2),
      // 结尾不带「组合门槛」：展示时会接「因子影响力较高」，由「因子」承担名词，
      // 与其余轴（快速法术力 / 完整组合技 / 额外回合…）统一为纯名词短语
      bandAxis('combinedEfficiency', '快速法术力、高效导师与免费互动', combinedGate),
      bandAxis('comboFamilies', '完整组合技', (detectedComboFamilies || []).length / 2),
      bandAxis('extraTurns', '额外回合', (extraTurnCount - 2) / 2),
    ];
    if (command >= 1) {
      axes.push(bandAxis(
        'commandZonePath',
        '主将区引擎路径',
        (Math.min(fast / 3, 1) + Math.min(tutors / 3, 1)) / 2,
      ));
    }
    score = bandAxisSum(axes) / config.accumulationSpan;
  } else {
    // assignedBracket === 4（4.5 与 5 已提前返回）
    nextBracket = 5;
    const approach = bandApproachToBFive(bandCounts, combos, signals);
    axes = approach.axes;
    conjunctMeanPercent = Math.round(approach.mean * 100);
    score = approach.score;
    bottleneckAxis = approach.bottleneckAxis;
  }

  score = roundMetric(clamp01(score), 4);
  const tierKey = score >= config.cuts.high ? 'high' : (score >= config.cuts.mid ? 'mid' : 'low');
  const label = config.labels[tierKey];
  const percent = Math.round(score * 100);
  const topAxis = axes.reduce((best, axis) => (axis.progress > best.progress ? axis : best), axes[0]);
  const bracketCode = `B${assignedBracket}`;

  // 只描述在当前档位内的相对位置（偏弱/中等/偏强 + 影响力最高的强度轴），不再论述与下一档的接近度。
  const metricText = '';
  const summaryText = `区间定位${label.zh}`;
  // 用「因子影响力较高」而不是「最集中」：topAxis 取的是推进度最高的轴，
  // 描述的是该因子对区间定位的影响力，不是牌张的密集程度
  const evidenceText = topAxis && topAxis.progress > 0
    ? `落在 ${bracketCode} 区间${label.segment}，其中${topAxis.label}因子影响力较高`
    : `落在 ${bracketCode} 区间${label.segment}`;

  return {
    tier: tierKey,
    zh: label.zh,
    score,
    percent,
    metric,
    nextBracket,
    axes,
    topAxis,
    bottleneckAxis,
    conjunctMeanPercent,
    metricText,
    summaryText,
    evidenceText,
  };
}

function evaluateBracket(parsed, options = {}) {
  const index = buildCardIndex(parsed.cards || []);
  const gameChangers = findTaggedCards(index, GAME_CHANGERS);
  const bannedCards = findTaggedCards(index, BANNED_CARDS);
  const bannedCompanions = findTaggedCards(index, BANNED_AS_COMPANION)
    .filter((name) => {
      const entry = index.get(canonicalCardKey(name));
      return entry && entry.sections.has('companion');
    });
  const massLandDenial = findTaggedCards(index, MASS_LAND_DENIAL);
  const extraTurns = findTaggedCards(index, EXTRA_TURNS);
  const detectedCombos = detectKnownCombos(index);
  const detectedComboFamilies = collapseComboFamilies(detectedCombos)
    .map((family) => resolveComboAssembly(family, options.metadataResult));
  const detectedComboPatterns = detectComboPatterns(index);
  const contextualWinConditions = resolveContextualWinConditions(index, detectedComboFamilies);
  const signals = Object.entries(SIGNAL_GROUPS).map(([key, group]) => {
    let cards = findTaggedCards(index, group.cards, { commanderOnly: group.commanderOnly });
    if (key === 'efficientWinCondition') {
      cards = uniqueCardNames(cards.concat(contextualWinConditions)).sort((a, b) => a.localeCompare(b));
    }
    return { key, label: group.label, count: cards.length, cards };
  }).filter((signal) => signal.count > 0);
  const contributingSignals = signals.filter(isStrongSignal);
  const deckCardCount = (parsed.cards || [])
    .filter((card) => card.section !== 'companion')
    .reduce((total, card) => total + card.count, 0);
  const structurallyComplete = deckCardCount === 100
    && parsed.hasCommanderSection
    && (parsed.issues || []).length === 0;
  const deckMetrics = options.deckMetrics
    || buildDeckMetrics(parsed.cards || [], options.metadataResult || {});
  const efficiencyProfile = options.efficiencyProfile
    || buildEfficiencyProfile(
      parsed.cards || [],
      options.metadataResult || {},
      getEfficiencyExclusions(),
    );
  const cohesionProfile = options.cohesionProfile
    || buildCohesionProfile(parsed.cards || [], options.metadataResult || {});
  const knownComboCardKeys = new Set();
  detectedComboFamilies.forEach((combo) => {
    (combo.cards || []).forEach((name) => knownComboCardKeys.add(canonicalCardKey(name)));
  });
  detectedComboPatterns.forEach((pattern) => {
    (pattern.cards || []).forEach((name) => knownComboCardKeys.add(canonicalCardKey(name)));
  });
  const comboPotentialProfile = options.comboPotentialProfile
    || buildComboPotentialProfile(
      parsed.cards || [],
      options.metadataResult || {},
      { excludedCards: knownComboCardKeys },
    );

  const evidence = [];
  let floorBracket = 1;

  if (gameChangers.length) {
    const minimum = gameChangers.length > 3 ? 4 : 3;
    floorBracket = Math.max(floorBracket, minimum);
    evidence.push(buildEvidence(
      gameChangers.length > 3 ? 'GAME_CHANGER_OVER_LIMIT' : 'GAME_CHANGER_PRESENT',
      'rule',
      gameChangers,
      `${gameChangers.length} 张 Game Changers`,
      gameChangers.length > 3
        ? '超过 Upgraded 的 3 张基线，规则下限进入 Optimized。'
        : 'Core 不使用 Game Changers，规则下限进入 Upgraded。',
      minimum,
    ));
  }

  if (massLandDenial.length) {
    floorBracket = Math.max(floorBracket, 4);
    evidence.push(buildEvidence(
      'MASS_LAND_DENIAL',
      'rule',
      massLandDenial,
      '大规模炸地与锁地',
      '检测到大规模摧毁或锁住土地的牌（Mass Land Denial），基线只适合 Optimized 及以上。',
      4,
    ));
  }

  if (extraTurns.length) {
    floorBracket = Math.max(floorBracket, 2);
    evidence.push(buildEvidence(
      'EXTRA_TURN_CARD',
      'rule',
      extraTurns,
      `${extraTurns.length} 张额外回合牌`,
      extraTurns.length >= 3
        ? '数量较高，需在对局前说明是否会连续或循环额外回合。'
        : 'Exhibition 基线不使用额外回合牌。',
      2,
    ));
  }

  detectedComboFamilies.forEach((combo) => {
    const minimum = combo.hardMinimum;
    // 启动法术力：最小成套各件的法术力值明细，如 3+4+1（元数据缺失时省略此项）
    const thresholdText = Array.isArray(combo.assemblyBreakdown) && combo.assemblyBreakdown.length
      ? `，启动法术力 ${combo.assemblyBreakdown.join('+')}`
      : '';
    const comboKind = minimum ? '完整双卡组合技' : '完整组合技';
    const tail = minimum ? `自动触发 B${minimum} 规则下限` : '自动上调建议档位';
    const detail = `检测到${comboKind}，${combo.result}${thresholdText}，${tail}`;
    if (minimum) floorBracket = Math.max(floorBracket, minimum);
    evidence.push(buildEvidence(
      `COMBO_FAMILY_${combo.familyId.toUpperCase().replace(/-/g, '_')}`,
      minimum ? 'rule' : 'strength',
      combo.cards,
      combo.label,
      detail,
      minimum,
    ));
  });

  detectedComboPatterns.forEach((pattern) => {
    evidence.push(buildEvidence(
      `COMBO_PATTERN_${pattern.id.toUpperCase().replace(/-/g, '_')}`,
      'strength',
      pattern.cards,
      pattern.label,
      `${pattern.result}。这类组件可以互相替换，不是固定的两张牌，能不能凑齐要看当局抓到什么，所以只提高强度判断，不直接锁定档位下限`,
      0,
    ));
  });

  const signalStrengthBracket = signalBand(signals);
  const comboRecommendedBracket = detectedComboFamilies.reduce(
    (maximum, combo) => Math.max(maximum, Number(combo.recommendedBracket) || 1),
    1,
  );
  const comboStrengthBracket = detectedComboFamilies.length
    ? Math.max(comboRecommendedBracket, detectedComboFamilies.length >= 2 ? 4 : 1)
    : 1;
  const patternStrengthBracket = detectedComboPatterns.reduce(
    (maximum, pattern) => Math.max(maximum, Number(pattern.recommendedBracket) || 1),
    1,
  );
  const extraTurnStrengthBracket = extraTurns.length >= 4 ? 4 : (extraTurns.length >= 2 ? 3 : 1);
  const structuralStrengthBracket = Math.max(
    signalStrengthBracket,
    comboStrengthBracket,
    patternStrengthBracket,
    extraTurnStrengthBracket,
  );
  const curveStrengthBracket = curveSupportBand(deckMetrics);
  let curveSupportedStrengthBracket = structuralStrengthBracket;
  if (structurallyComplete && curveStrengthBracket >= 3) {
    curveSupportedStrengthBracket = Math.min(
      4,
      curveStrengthBracket,
      structuralStrengthBracket + 1,
    );
  }
  const curveRaisedStrength = curveSupportedStrengthBracket > structuralStrengthBracket;
  const efficiencyStrengthBracket = efficiencyProfile.reliable
    ? efficiencyProfile.band
    : 1;
  let efficiencySupportedStrengthBracket = structuralStrengthBracket;
  if (structurallyComplete && efficiencyStrengthBracket >= 3) {
    efficiencySupportedStrengthBracket = Math.min(
      4,
      efficiencyStrengthBracket,
      structuralStrengthBracket + 1,
    );
  }
  const efficiencyRaisedStrength = efficiencySupportedStrengthBracket > structuralStrengthBracket;
  const cohesionStrengthBracket = cohesionProfile.reliable ? cohesionProfile.band : 1;
  let cohesionSupportedStrengthBracket = structuralStrengthBracket;
  if (structurallyComplete && cohesionStrengthBracket >= 3) {
    cohesionSupportedStrengthBracket = Math.min(
      4,
      cohesionStrengthBracket,
      structuralStrengthBracket + 1,
    );
  }
  const cohesionRaisedStrength = cohesionSupportedStrengthBracket > structuralStrengthBracket;
  const comboPotentialStrengthBracket = comboPotentialProfile.reliable
    ? comboPotentialProfile.band
    : 1;
  let comboPotentialSupportedStrengthBracket = structuralStrengthBracket;
  if (structurallyComplete && comboPotentialStrengthBracket >= 3) {
    comboPotentialSupportedStrengthBracket = Math.min(
      4,
      comboPotentialStrengthBracket,
      structuralStrengthBracket + 1,
    );
  }
  const comboPotentialRaisedStrength = comboPotentialSupportedStrengthBracket
    > structuralStrengthBracket;
  // All metadata-derived signals share one support ceiling. They corroborate the known
  // structure but can never stack into multiple automatic bracket jumps.
  const metadataAdjustedStrengthBracket = Math.max(
    structuralStrengthBracket,
    curveSupportedStrengthBracket,
    efficiencySupportedStrengthBracket,
    cohesionSupportedStrengthBracket,
    comboPotentialSupportedStrengthBracket,
  );

  const supportingSignalAxes = strongSignalAxisCount(signals);
  const priceRaisedStrength = Boolean(
    structurallyComplete
    && deckMetrics.priceReliable
    && deckMetrics.estimatedTotalUsd !== null
    && deckMetrics.estimatedTotalUsd >= PRICE_SUPPORT_THRESHOLD_USD
    && structuralStrengthBracket === 3
    && metadataAdjustedStrengthBracket === 3
    && supportingSignalAxes >= 2
  );
  const strengthBracket = priceRaisedStrength ? 4 : metadataAdjustedStrengthBracket;
  if (signalStrengthBracket >= 3) {
    const activeLabels = contributingSignals
      .map((signal) => `${signal.label} ${signal.count}`)
      .slice(0, 4);
    evidence.push(buildEvidence(
      signalStrengthBracket === 4 ? 'OPTIMIZED_SIGNAL_DENSITY' : 'UPGRADED_SIGNAL_DENSITY',
      'strength',
      [],
      signalStrengthBracket === 4 ? '高密度效率信号' : '强化构筑信号',
      activeLabels.length ? activeLabels.join('、') : '检测到紧凑组合技组件。',
      signalStrengthBracket,
    ));
  }
  if (extraTurnStrengthBracket >= 3) {
    evidence.push(buildEvidence(
      'EXTRA_TURN_DENSITY',
      'strength',
      extraTurns,
      extraTurnStrengthBracket === 4 ? '高密度额外回合' : '多张额外回合',
      extraTurnStrengthBracket === 4
        ? '数量已超出“少量且不连续”的低档体验基线，建议 Optimized。'
        : '多张额外回合会提高连续施放的一致性，建议至少 Upgraded。',
      extraTurnStrengthBracket,
    ));
  }
  if (deckMetrics.averageManaValue !== null) {
    const average = deckMetrics.averageManaValue.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    const lowRatio = Math.round(deckMetrics.lowCurveRatio * 100);
    evidence.push(buildEvidence(
      'MANA_CURVE_SUPPORT',
      curveRaisedStrength ? 'strength' : 'context',
      [],
      curveRaisedStrength ? '合理法术力曲线' : '法术力曲线',
      `平均 MV ${average}，MV≤2 占 ${lowRatio}%${curveRaisedStrength ? '；此项最多上调一档，不改变规则下限。' : '。'}`,
      curveRaisedStrength ? curveSupportedStrengthBracket : 0,
    ));
  }
  if (efficiencyProfile.reliable && efficiencyRaisedStrength) {
    evidence.push(buildEvidence(
      'CONSTRUCTION_EFFICIENCY_SUPPORT',
      'strength',
      efficiencyProfile.triggerCards,
      '高效构筑',
      `T1 地源 ${efficiencyProfile.turnOneManaLandCount}/${efficiencyProfile.landCount}，常规加速 ${efficiencyProfile.regularRampCount}；低费互动 ${efficiencyProfile.interactionCount}（坟场 ${efficiencyProfile.graveyardInteractionCount} / 保护 ${efficiencyProfile.protectionCount}）；低费过牌 ${efficiencyProfile.cardFlowCount}。这些项目只作辅助，并与法术力曲线、主题稳定性和组合技结构共用最多一次上调额度。`,
      efficiencySupportedStrengthBracket,
    ));
  }
  const dominantTheme = cohesionProfile.dominantTheme;
  if (cohesionProfile.reliable && dominantTheme && dominantTheme.qualifies) {
    const themeDensity = Math.round((dominantTheme.density || 0) * 100);
    const commanderText = dominantTheme.commanderAligned
      ? '，主将区也贴合这条主线'
      : '';
    evidence.push(buildEvidence(
      'THEME_COHESION_SUPPORT',
      cohesionRaisedStrength ? 'strength' : 'context',
      cohesionProfile.triggerCards || [],
      cohesionRaisedStrength ? '高密度主题主线' : '主题稳定性',
      `${dominantTheme.label}成员 ${dominantTheme.memberCount}，支援与收益 ${dominantTheme.supportCount}，相关牌占已识别非地牌 ${themeDensity}%${commanderText}${cohesionRaisedStrength ? '，功能冗余达到辅助升档门槛' : '，主线清晰但不会单独继续升档'}`,
      cohesionRaisedStrength ? cohesionSupportedStrengthBracket : 0,
    ));
  }
  if (comboPotentialProfile.reliable && (comboPotentialProfile.potentialLoops || []).length) {
    evidence.push(buildEvidence(
      'UNLISTED_COMBO_STRUCTURE',
      comboPotentialRaisedStrength ? 'strength' : 'context',
      comboPotentialProfile.triggerCards || [],
      '组合技结构',
      `牺牲、递归与终结收益形成 ${(comboPotentialProfile.potentialLoops || []).length} 条可衔接路线，可能包含未收录的组合技，这项只作为强度辅助，不按完整组合技处理`,
      comboPotentialRaisedStrength ? comboPotentialSupportedStrengthBracket : 0,
    ));
  }
  if (deckMetrics.estimatedTotalUsd !== null) {
    const estimated = Math.round(deckMetrics.estimatedTotalUsd);
    evidence.push(buildEvidence(
      priceRaisedStrength ? 'DECK_PRICE_SUPPORT' : 'DECK_PRICE_CONTEXT',
      priceRaisedStrength ? 'strength' : 'context',
      [],
      '非基本地预估造价（美元）',
      `按 Scryfall 当前非闪价格，对基本地以外的牌估算约 $${estimated}${priceRaisedStrength ? '。牌表已有多轴 B3 构筑，结合这一造价升至 B4。' : '。这项数据不会单独改变档位。'}`,
      priceRaisedStrength ? strengthBracket : 0,
    ));
  }

  const hasLegalityIssue = Boolean(bannedCards.length || bannedCompanions.length);
  const competitiveProfile = structurallyComplete
    && !hasLegalityIssue
    && hasCompetitiveSignalDensity(signals, detectedComboFamilies, detectedComboPatterns);
  const automaticBase = structurallyComplete ? 1 : 2;
  const assignedWithoutMetrics = Math.min(
    Math.max(floorBracket, structuralStrengthBracket, automaticBase), 4,
  );
  const assignedWithCurve = Math.min(
    Math.max(floorBracket, curveSupportedStrengthBracket, automaticBase), 4,
  );
  const assignedWithEfficiency = Math.min(
    Math.max(floorBracket, efficiencySupportedStrengthBracket, automaticBase), 4,
  );
  const assignedWithCohesion = Math.min(
    Math.max(floorBracket, cohesionSupportedStrengthBracket, automaticBase), 4,
  );
  const assignedWithComboPotential = Math.min(
    Math.max(floorBracket, comboPotentialSupportedStrengthBracket, automaticBase), 4,
  );
  const assignedBeforePrice = Math.min(
    Math.max(floorBracket, metadataAdjustedStrengthBracket, automaticBase), 4,
  );
  const assignedBeforePromotion = Math.min(
    Math.max(floorBracket, strengthBracket, automaticBase), 4,
  );
  // 竞技升档：结构判定先落在 B4、B5 必要条件的联合接近度超过区间「偏强」线，且具备完整
  // 竞技特征才离开 B4；再看超出竞技强度阈值的余量——余量越过 B5 基准判 B5，否则归 B4.5 准竞技。
  // 韧性轴色彩中立（免费反击 / Stax / 主将区引擎 / 冗余皆可），不偏向蓝色。
  const promotionCounts = bandSignalCounts(signals);
  const promotionCombos = detectedComboFamilies.concat(detectedComboPatterns);
  const bandFourApproach = bandApproachToBFive(promotionCounts, promotionCombos, signals);
  const competitiveSurplus = bandCompetitiveSurplus(promotionCounts, promotionCombos);
  const exceedsBandFourHigh = bandFourApproach.score >= BAND_POSITION_CONFIG.cuts.high;
  const competitivePromoted = Boolean(
    competitiveProfile
    && assignedBeforePromotion === 4
    && exceedsBandFourHigh,
  );
  const clearCompetitiveSurplus = competitiveSurplus.score
    >= BAND_POSITION_CONFIG.promotion.b5SurplusMin;
  const competitiveBracket = competitivePromoted
    ? (clearCompetitiveSurplus ? 5 : 4.5)
    : assignedBeforePromotion;
  // 高造价竞技主将升档：落在 B4/B4.5 的完整牌表，若快速法术力 >3 张、可靠造价 >$1500、
  // 且单主将或完整 Partners 命中 100 人竞技主将池，则升为 B5——高价快攻 + 已知竞技主将的组合按 cEDH 处理。
  const fastManaCardCount = promotionCounts.fast;
  const expensivePoolPromoted = Boolean(
    (competitiveBracket === 4 || competitiveBracket === 4.5)
    && structurallyComplete
    && !hasLegalityIssue
    && fastManaCardCount > EXPENSIVE_POOL_MIN_FAST_MANA
    && deckMetrics.priceReliable
    && deckMetrics.estimatedTotalUsd !== null
    && deckMetrics.estimatedTotalUsd > EXPENSIVE_POOL_PRICE_THRESHOLD_USD
    && isQuestionnaireCommanderPoolMatch(parsed.commanders),
  );
  const assignedBracket = expensivePoolPromoted ? 5 : competitiveBracket;
  const curveInfluenced = assignedWithCurve > assignedWithoutMetrics;
  const efficiencyInfluenced = assignedWithEfficiency > assignedWithoutMetrics;
  const cohesionInfluenced = assignedWithCohesion > assignedWithoutMetrics;
  const comboPotentialInfluenced = assignedWithComboPotential > assignedWithoutMetrics;
  const priceInfluenced = assignedBeforePromotion > assignedBeforePrice;

  if (competitiveProfile) {
    const surplusPercent = Math.round(competitiveSurplus.score * 100);
    const surplusLinePercent = Math.round(BAND_POSITION_CONFIG.promotion.b5SurplusMin * 100);
    let competitiveDetail;
    if (!competitivePromoted) {
      competitiveDetail = '快速法术力、高效导师与抗干扰韧性（免费互动、Stax、主将区引擎或冗余任一）同时达到竞技密度，并且有早期组合技或足够集中的多轴构筑，但结构判定未落在 B4，不触发竞技升档';
    } else if (clearCompetitiveSurplus) {
      competitiveDetail = `快速法术力、高效导师与抗干扰韧性（免费互动、Stax、主将区引擎或冗余任一）同时达到竞技密度，并且有早期组合技或足够集中的多轴构筑，超出竞技强度阈值的余量 ${surplusPercent}% 越过 B5 基准（${surplusLinePercent}%）`;
    } else {
      competitiveDetail = `快速法术力、高效导师与抗干扰韧性（免费互动、Stax、主将区引擎或冗余任一）同时达到竞技密度，并且有早期组合技或足够集中的多轴构筑，但超出竞技强度阈值的余量约 ${surplusPercent}%，未达 B5 基准（${surplusLinePercent}%），归入 B4.5 准竞技`;
    }
    evidence.push(buildEvidence(
      'COMPETITIVE_SIGNAL_DENSITY',
      'strength',
      contributingSignals.reduce((cards, signal) => cards.concat(signal.cards), []),
      '竞技构筑特征',
      competitiveDetail,
      competitivePromoted ? competitiveBracket : 0,
    ));
  }
  if (expensivePoolPromoted) {
    evidence.push(buildEvidence(
      'EXPENSIVE_POOL_PROMOTION',
      'strength',
      (parsed.commanders || []).map((card) => card.name),
      '高造价竞技主将升档',
      `快速法术力 ${fastManaCardCount} 张、按基本地以外的牌估算约 $${Math.round(deckMetrics.estimatedTotalUsd)}（超过 $${EXPENSIVE_POOL_PRICE_THRESHOLD_USD}），高造价与快速法术力搭配 cEDH 数据库排名前 100 的主将按 cEDH 强度处理，由 B${competitiveBracket} 升为 B5`,
      5,
    ));
  }
  if (!evidence.some((item) => item.kind === 'rule' || item.kind === 'strength')) {
    evidence.push(buildEvidence(
      assignedBracket === 1 ? 'AUTO_LOW_SIGNAL_BASELINE' : 'AUTO_CORE_BASELINE',
      'strength',
      [],
      assignedBracket === 1 ? '低信号完整牌表' : '自动核心基线',
      assignedBracket === 1
        ? '牌表结构完整，且当前轻量规则集未检测到更高档触发。'
        : '牌表不完整或存在解析提示，自动判定不会降至 B1。',
      assignedBracket,
    ));
  }

  const warnings = [];
  if (deckCardCount !== 100) warnings.push(`当前解析 ${deckCardCount} 张；完整 Commander 牌表通常为 100 张。`);
  if (bannedCards.length || bannedCompanions.length) warnings.push('检测到已收录的禁牌状态，请先修正合法性。');
  if (!deckMetrics.curveReliable) {
    const coverage = Math.floor(deckMetrics.manaCoverage * 100);
    warnings.push(`法术力数据覆盖 ${coverage}% / ${deckMetrics.nonlandCoveredCount} 张非地牌；未同时达到 80% 与 20 张时，曲线只展示、不参与档位。`);
  }
  if (!deckMetrics.priceReliable) {
    const coverage = Math.floor(deckMetrics.priceCoverage * 100);
    warnings.push(`非基本地预估造价数据覆盖 ${coverage}%（口径为基本地以外的 ${deckMetrics.priceEligibleCount} 张牌）；未同时达到 75% 与 20 张时，缺失价格不按 0 计算，造价不参与档位。`);
  }
  if (deckMetrics.lookupFailedBatchCount) warnings.push('部分 Scryfall 卡牌数据请求失败，本次已使用可用数据并保留未覆盖项。');
  if (deckMetrics.estimatedTotalUsd !== null) warnings.push('造价采用 Scryfall 当前代表印次的非闪 USD 参考价，不代表具体版本或本地成交价。');
  warnings.push('轻量数据集只核验已收录的强度触发牌，不做全量拼写、色组或类别禁牌校验。');

  const recognizedTriggerCards = [
    ...gameChangers,
    ...bannedCards,
    ...bannedCompanions,
    ...massLandDenial,
    ...extraTurns,
  ];
  detectedComboFamilies.forEach((combo) => recognizedTriggerCards.push(...combo.cards));
  detectedComboPatterns.forEach((pattern) => recognizedTriggerCards.push(...pattern.cards));
  recognizedTriggerCards.push(...contextualWinConditions);
  signals.forEach((signal) => recognizedTriggerCards.push(...signal.cards));
  if (efficiencyProfile.reliable && efficiencyStrengthBracket >= 3) {
    recognizedTriggerCards.push(...efficiencyProfile.triggerCards);
  }
  if (cohesionProfile.reliable && cohesionStrengthBracket >= 3) {
    recognizedTriggerCards.push(...(cohesionProfile.triggerCards || []));
  }
  if (comboPotentialProfile.reliable && comboPotentialStrengthBracket >= 3) {
    recognizedTriggerCards.push(...(comboPotentialProfile.triggerCards || []));
  }
  const recognizedTriggerKeys = new Set(recognizedTriggerCards.map(canonicalCardKey));
  const recognitionCoverage = measureRecognitionCoverage(
    parsed.cards || [],
    options.metadataResult || {},
    recognizedTriggerKeys,
  );
  // 置信度衡量「档位判断有多可能出错」，不只是「输入有多完整」——除了数据缺口，
  // 还纳入判断的认知暴露：无法评估强度的单卡、未确认的组合技结构、只靠软性辅助上调支撑的档位。
  const softStepInfluenced = Boolean(
    curveInfluenced
    || efficiencyInfluenced
    || cohesionInfluenced
    || comboPotentialInfluenced
    || priceInfluenced,
  );
  const unlistedComboStructure = Boolean(
    comboPotentialProfile.reliable
    && (comboPotentialProfile.potentialLoops || []).length,
  );
  // 数据足以评估整副牌（curveReliable）但收录名单只覆盖一小部分非地牌时，可能遗漏未收录的高强度变量单卡。
  const sparseRecognition = Boolean(
    deckMetrics.curveReliable
    && recognitionCoverage.nonlandUnique > 0
    && recognitionCoverage.recognitionDensity < RECOGNITION_DENSITY_FLOOR,
  );
  const confidenceIssues = [];
  if (!structurallyComplete) confidenceIssues.push('牌表结构不完整或存在解析问题');
  if (recognizedTriggerKeys.size === 0) confidenceIssues.push('未识别到任何强度触发牌');
  if (!deckMetrics.curveReliable) confidenceIssues.push('法术力数据覆盖不足');
  if (!efficiencyProfile.reliable) confidenceIssues.push('构筑特征覆盖不足');
  if (sparseRecognition) {
    confidenceIssues.push(`收录名单只识别到非地牌的 ${Math.round(recognitionCoverage.recognitionDensity * 100)}%，其余单卡不在收录的强度触发牌名单内，可能存在改变判定的未收录高强度变量单卡`);
  }
  if (unlistedComboStructure) {
    confidenceIssues.push('检测到未能确认的组合技结构，实际强度可能高于当前档位');
  }
  if (softStepInfluenced) {
    confidenceIssues.push('当前档位来自数据辅助的临界上调而非硬性规则，去掉该辅助会回落一档');
  }
  if (competitivePromoted
    && Math.abs(competitiveSurplus.score - BAND_POSITION_CONFIG.promotion.b5SurplusMin)
      <= BAND_POSITION_CONFIG.promotion.b5SurplusBand) {
    confidenceIssues.push('超出竞技强度阈值的余量贴近 B5 基准，少量高效单卡的增减可能改变 B4.5 与 B5 的细分');
  }
  const confidence = !structurallyComplete || recognizedTriggerKeys.size === 0
    ? 'low'
    : (confidenceIssues.length ? 'medium' : 'high');
  const confidenceText = confidence === 'high' ? '高' : (confidence === 'medium' ? '中' : '低');
  const bandPosition = computeBandPosition({
    assignedBracket,
    signals,
    detectedComboFamilies,
    detectedComboPatterns,
    extraTurns,
  });
  evidence.push(buildEvidence(
    'BAND_POSITION',
    'context',
    [],
    bandPosition.deferred
      ? `区间定位：B${assignedBracket} 暂不区分`
      : `区间定位：B${assignedBracket} ${bandPosition.zh}`,
    bandPosition.evidenceText,
    0,
  ));
  evidence.push(buildEvidence(
    'CONFIDENCE_PROFILE',
    'context',
    [],
    `判定置信度：${confidenceText}`,
    confidenceIssues.length
      ? confidenceIssues.join('，')
      : '牌表结构完整，数据覆盖达标，收录名单已识别大部分单卡，档位由硬性规则或清晰结构锁定、无悬而未决项',
    0,
  ));
  const label = BRACKET_LABELS[assignedBracket];
  const floorLabel = BRACKET_LABELS[floorBracket];

  return {
    assignedBracket,
    assignedWithoutMetrics,
    assignedBeforePrice,
    assignedBeforePromotion,
    competitiveBracket,
    competitiveProfile,
    competitivePromoted,
    clearCompetitiveSurplus,
    expensivePoolPromoted,
    expensivePoolFastMana: fastManaCardCount,
    bandFourApproachScore: bandFourApproach.score,
    competitiveSurplusScore: competitiveSurplus.score,
    floorBracket,
    strengthBracket,
    structuralStrengthBracket,
    curveStrengthBracket,
    curveRaisedStrength,
    efficiencyStrengthBracket,
    efficiencyRaisedStrength,
    cohesionStrengthBracket,
    cohesionRaisedStrength,
    comboPotentialStrengthBracket,
    comboPotentialRaisedStrength,
    metadataAdjustedStrengthBracket,
    priceRaisedStrength,
    curveInfluenced,
    efficiencyInfluenced,
    cohesionInfluenced,
    comboPotentialInfluenced,
    priceInfluenced,
    supportingSignalAxes,
    label,
    floorLabel,
    confidence,
    confidenceIssues,
    bandPosition,
    recognitionDensity: recognitionCoverage.recognitionDensity,
    recognizedNonlandUnique: recognitionCoverage.recognizedNonlandUnique,
    nonlandUniqueCount: recognitionCoverage.nonlandUnique,
    softStepInfluenced,
    unlistedComboStructure,
    deckCardCount,
    structurallyComplete,
    legalityStatus: bannedCards.length || bannedCompanions.length ? 'needs-fix' : 'not-fully-verified',
    provisional: Boolean(
      bannedCards.length
      || bannedCompanions.length
      || !structurallyComplete
      || recognizedTriggerKeys.size === 0
    ),
    recognizedTriggerCount: recognizedTriggerKeys.size,
    gameChangers,
    bannedCards: bannedCards.concat(bannedCompanions),
    massLandDenial,
    extraTurns,
    detectedCombos,
    detectedComboFamilies,
    detectedComboPatterns,
    contextualWinConditions,
    signals,
    contributingSignals,
    deckMetrics,
    efficiencyProfile,
    cohesionProfile,
    comboPotentialProfile,
    evidence,
    warnings: Array.from(new Set(warnings)),
    parseIssues: (parsed.issues || []).map((issue) => ({ ...issue })),
    versions: { ...BRACKET_MANIFEST },
  };
}

function uniqueSummaryLabels(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function joinChineseLabels(values) {
  const labels = uniqueSummaryLabels(values);
  if (labels.length < 2) return labels[0] || '';
  if (labels.length === 2) return `${labels[0]}和${labels[1]}`;
  return `${labels.slice(0, -1).join('、')}和${labels[labels.length - 1]}`;
}

function bracketSummaryNumber(value, places = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toFixed(places).replace(/0+$/, '').replace(/\.$/, '');
}

function bracketSummaryPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.floor(number * 100) : 0;
}

function bracketSummaryUsd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return String(Math.round(number)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function ruleSummaryLabels(result) {
  return uniqueSummaryLabels((result.evidence || [])
    .filter((item) => item && item.kind === 'rule')
    .map((item) => item.title))
    .slice(0, 3);
}

function structuralSummaryLabels(result) {
  const labels = [];
  if ((result.detectedComboFamilies || result.detectedCombos || []).length) labels.push('完整组合技');
  if ((result.detectedComboPatterns || []).length) labels.push('组合技框架');
  if ((result.extraTurns || []).length >= 2) labels.push('额外回合密度');
  const signals = Array.isArray(result.contributingSignals)
    ? result.contributingSignals
    : (result.signals || []).filter(isStrongSignal);
  signals.forEach((signal) => labels.push(signal.label));
  return uniqueSummaryLabels(labels).slice(0, 4);
}

function competitiveSummaryLabels(result) {
  const signals = Array.isArray(result.contributingSignals)
    ? result.contributingSignals
    : (result.signals || []).filter(isStrongSignal);
  return uniqueSummaryLabels(signals
    .map((signal) => signal.label))
    .slice(0, 4);
}

function efficiencySummaryLabels(result) {
  const profile = result.efficiencyProfile || {};
  const labels = [];
  if (profile.manaStrong || profile.manaDeveloped) labels.push('前期法术力');
  if (profile.interactionStrong || profile.interactionDeveloped) labels.push('低费互动与保护');
  if (profile.flowStrong || profile.flowDeveloped) labels.push('低费过牌与滤牌');
  return labels;
}

function finalizeBracketSummary(sentences) {
  return normalizeBracketDisplayCopy((sentences || [])
    .map(normalizeBracketDisplayCopy)
    .filter(Boolean)
    .join('，'));
}

function pushBandPositionSentence(sentences, result) {
  const position = result && result.bandPosition;
  if (position && position.summaryText) sentences.push(position.summaryText);
}

function buildBracketSummary(result, parseErrorCount = 0) {
  const sentences = [];
  const assignedBracket = Number(result.assignedBracket) || 1;
  const floorBracket = Number(result.floorBracket) || 1;
  const structuralStrengthBracket = Number(result.structuralStrengthBracket) || 1;
  const structurallyComplete = result.structurallyComplete === true;
  const errorCount = Math.max(0, Number(parseErrorCount) || 0);
  const provisionalResult = result.provisional === true
    || result.legalityStatus === 'needs-fix'
    || !structurallyComplete
    || errorCount > 0;

  if (assignedBracket === 1) {
    sentences.push('规则下限是 B1');
    sentences.push('没有发现会抬高下限的牌，也没有检测到足以升档的组合技、额外回合或效率组件');
    sentences.push(provisionalResult ? '当前暂时归于B1强度' : '因此归于B1强度');
    pushBandPositionSentence(sentences, result);
    return finalizeBracketSummary(sentences);
  }

  if (result.expensivePoolPromoted) {
    const rules = ruleSummaryLabels(result);
    sentences.push(rules.length
      ? `因为检测到${joinChineseLabels(rules)}，规则下限是 B${floorBracket}`
      : `规则下限是 B${floorBracket}`);
    const preBracket = Number(result.competitiveBracket) || 4;
    sentences.push(preBracket === 4.5
      ? '牌表已具备竞技构筑特征，先落在 B4.5 准竞技'
      : `结构判断落在 B${preBracket}`);
    const metrics = result.deckMetrics || {};
    sentences.push(`快速法术力有 ${Number(result.expensivePoolFastMana) || 0} 张、按基本地以外的牌估算约 $${bracketSummaryUsd(metrics.estimatedTotalUsd)}（超过 $${bracketSummaryUsd(EXPENSIVE_POOL_PRICE_THRESHOLD_USD)}），且主将命中 cEDH 数据库排名前 100`);
    sentences.push('高造价与快速法术力搭配 cEDH 数据库排名前 100 的主将按 cEDH 强度处理，因此升到B5强度');
    pushBandPositionSentence(sentences, result);
    return finalizeBracketSummary(sentences);
  }

  if (assignedBracket === 5 || assignedBracket === 4.5) {
    const rules = ruleSummaryLabels(result);
    sentences.push(rules.length
      ? `因为检测到${joinChineseLabels(rules)}，规则下限是 B${floorBracket}`
      : `规则下限是 B${floorBracket}`);
    const competitiveLabels = competitiveSummaryLabels(result);
    const densityText = competitiveLabels.length
      ? `${joinChineseLabels(competitiveLabels)}已经达到竞技构筑所需的密度`
      : '核心效率组件已经达到竞技构筑所需的密度';
    const hasEarlyCombo = (result.detectedComboFamilies || result.detectedCombos || [])
      .concat(result.detectedComboPatterns || [])
      .some(isEarlyCombo);
    sentences.push(hasEarlyCombo
      ? `${densityText}，同时检测到早期组合技`
      : `${densityText}，资源引擎或其他效率轴也足够集中`);
    const surplusScore = Number(result.competitiveSurplusScore);
    if (assignedBracket === 4.5) {
      // 竞技特征达标但余量未越过 B5 基准：准竞技归 B4.5
      sentences.push(Number.isFinite(surplusScore)
        ? `不过超出竞技强度阈值的余量约 ${Math.round(surplusScore * 100)}%，未越过 B5 基准，归于B4.5准竞技强度`
        : '不过超出竞技强度阈值的余量未越过 B5 基准，归于B4.5准竞技强度');
    } else {
      if (Number.isFinite(surplusScore)) {
        sentences.push(`超出竞技强度阈值的余量约 ${Math.round(surplusScore * 100)}% 越过 B5 基准`);
      }
      sentences.push('因此归于B5强度');
    }
    pushBandPositionSentence(sentences, result);
    return finalizeBracketSummary(sentences);
  }

  const rules = ruleSummaryLabels(result);
  sentences.push(rules.length
    ? `因为检测到${joinChineseLabels(rules)}，规则下限是 B${floorBracket}`
    : `规则下限是 B${floorBracket}`);

  const automaticBase = structurallyComplete ? 1 : 2;
  const assignedWithoutMetrics = Number.isFinite(Number(result.assignedWithoutMetrics))
    ? Number(result.assignedWithoutMetrics)
    : Math.min(Math.max(floorBracket, structuralStrengthBracket, automaticBase), 4);
  const structuralLabels = structuralSummaryLabels(result);
  if (assignedWithoutMetrics > floorBracket) {
    if (!structurallyComplete && assignedWithoutMetrics === 2 && structuralStrengthBracket <= 1) {
      sentences.push('基础档位暂归于B2');
    } else {
      const reasonText = structuralLabels.length
        ? joinChineseLabels(structuralLabels)
        : '现有构筑信号';
      sentences.push(`${reasonText}把基础构筑判断推到 B${assignedWithoutMetrics}`);
    }
  } else if (structuralStrengthBracket >= floorBracket
    && structuralStrengthBracket > 1
    && structuralLabels.length) {
    sentences.push(`${joinChineseLabels(structuralLabels)}给出的构筑判断也落在 B${assignedWithoutMetrics}`);
  }

  const metrics = result.deckMetrics || {};
  const auxiliaryInfluences = [];
  if (result.curveInfluenced) {
    sentences.push(`平均 MV 为 ${bracketSummaryNumber(metrics.averageManaValue)}，其中 MV≤2 占 ${bracketSummaryPercent(metrics.lowCurveRatio)}%，达到低曲线门槛`);
    auxiliaryInfluences.push('curve');
  }
  if (result.efficiencyInfluenced) {
    const axes = efficiencySummaryLabels(result);
    const axisText = axes.length ? joinChineseLabels(axes) : '构筑效率';
    sentences.push(`${axisText}达到对应门槛`);
    auxiliaryInfluences.push('efficiency');
  }
  if (result.cohesionInfluenced) {
    const theme = result.cohesionProfile && result.cohesionProfile.dominantTheme;
    sentences.push(`${theme && theme.label ? theme.label : '主题'}成员与支援牌形成清晰主线，执行稳定性达到辅助门槛`);
    auxiliaryInfluences.push('cohesion');
  }
  if (result.comboPotentialInfluenced) {
    const loopCount = result.comboPotentialProfile
      && Array.isArray(result.comboPotentialProfile.potentialLoops)
      ? result.comboPotentialProfile.potentialLoops.length
      : 0;
    sentences.push(`牺牲、递归与终结收益形成 ${loopCount || 1} 条组合技结构线索`);
    auxiliaryInfluences.push('combo-potential');
  }
  if (auxiliaryInfluences.length > 1) {
    sentences.push('这些辅助判断合计只上调一次');
  } else if (auxiliaryInfluences.length === 1) {
    sentences.push('这项辅助判断在基础档位上上调一档');
  }

  if (result.priceInfluenced) {
    sentences.push(`曲线、构筑效率、主题稳定性和组合技结构没有先触发升档，牌表本身已有 ${Number(result.supportingSignalAxes) || 0} 条强结构轴，按基本地以外的牌估算约 $${bracketSummaryUsd(metrics.estimatedTotalUsd)}，超过 $${bracketSummaryUsd(PRICE_SUPPORT_THRESHOLD_USD)} 的辅助线，因此从 B3 上调到 B4`);
  }

  const metricInfluenced = result.curveInfluenced
    || result.efficiencyInfluenced
    || result.cohesionInfluenced
    || result.comboPotentialInfluenced
    || result.priceInfluenced;
  if (!metricInfluenced && assignedBracket === assignedWithoutMetrics) {
    sentences.push('除此之外，没有出现需要继续升档的内容');
  }
  if (provisionalResult) {
    sentences.push(`按已经识别的强度内容，暂时归于B${assignedBracket}强度`);
  } else {
    sentences.push(`因此归于B${assignedBracket}强度`);
  }
  pushBandPositionSentence(sentences, result);
  return finalizeBracketSummary(sentences);
}

function analyzeBracketDeck(text, options = {}) {
  const parsed = parseBracketDeck(text);
  return {
    parsed,
    result: evaluateBracket(parsed, options),
  };
}

module.exports = {
  canonicalCardKey,
  parseBracketDeck,
  detectKnownCombos,
  detectComboPatterns,
  collapseComboFamilies,
  comboSpeedTier,
  resolveComboAssembly,
  isEarlyCombo,
  computeBandPosition,
  resolveContextualWinConditions,
  buildDeckMetrics,
  evaluateBracket,
  buildBracketSummary,
  analyzeBracketDeck,
  MAX_DECK_LINES,
  MAX_DECK_CHARS,
};
