const scoreKeys = [
  'competitive',
  'fun',
  'social',
  'solo',
  'complex',
  'direct',
  'mainstream',
  'offmeta',
];

const EDHTI_COMMANDER_TAG_ORDER = [
  'combo',
  'power',
  'aggro',
  'politics',
  'judge',
  'offbeat',
  'talk',
  'salt',
];

function stableHash(value) {
  const text = String(value || '');
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  // Avalanche the FNV state so short, similar tag signatures still spread well.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function buildCommanderTagSignature(persona, tags) {
  const values = EDHTI_COMMANDER_TAG_ORDER.map((key) => `${key}:${Number(tags && tags[key] || 0)}`);
  return `${persona && persona.code || ''}|${values.join('|')}`;
}

// Rendezvous hashing：完整标签画像决定池内选择，同一答案稳定复现；
// 候选顺序变化不会整体洗牌，新增/移除主将只影响命中该主将的画像。
function selectEdhtiCommander(persona, tags) {
  const pool = persona && persona.commanderPool;
  if (!Array.isArray(pool) || !pool.length) return null;

  const signature = buildCommanderTagSignature(persona, tags);
  let selected = null;
  let selectedScore = -1;

  pool.forEach((commander) => {
    const name = typeof commander === 'string' ? commander : commander && commander.name;
    if (!name) return;
    const score = stableHash(`${signature}|${name}`);
    if (score > selectedScore || (score === selectedScore && name < selected)) {
      selected = name;
      selectedScore = score;
    }
  });

  return selected;
}

function createEmptyScores() {
  return Object.fromEntries(scoreKeys.map((key) => [key, 0]));
}

function createEmptyTags(tagLabels) {
  return Object.fromEntries(Object.keys(tagLabels || {}).map((key) => [key, 0]));
}

function addWeightedValues(target, values) {
  Object.entries(values || {}).forEach(([key, value]) => {
    target[key] = Number(target[key] || 0) + Number(value || 0);
  });
}

function getSelectedAnswers(questions, answerMap) {
  return (questions || []).map((question) => {
    const answerIndex = answerMap && answerMap[question.id];
    return question.answers && question.answers[answerIndex];
  }).filter(Boolean);
}

function tallyEdhtiAnswers(questions, answerMap, tagLabels) {
  const scores = createEmptyScores();
  const tags = createEmptyTags(tagLabels || {
    salt: '',
    talk: '',
    judge: '',
    combo: '',
    power: '',
    offbeat: '',
    aggro: '',
    politics: '',
  });

  getSelectedAnswers(questions, answerMap).forEach((answer) => {
    addWeightedValues(scores, answer.scores);
    addWeightedValues(tags, answer.tags);
  });

  const code = [
    scores.competitive >= scores.fun ? 'C' : 'F',
    scores.social >= scores.solo ? 'T' : 'S',
    scores.complex >= scores.direct ? 'X' : 'D',
    scores.mainstream >= scores.offmeta ? 'M' : 'O',
  ].join('');

  return {
    scores,
    tags,
    code,
    axisWinners: {
      intent: scores.competitive >= scores.fun ? '竞技' : '娱乐',
      table: scores.social >= scores.solo ? '社交' : '执行',
      complexity: scores.complex >= scores.direct ? '复杂' : '直接',
      meta: scores.mainstream >= scores.offmeta ? '主流' : '冷门',
    },
  };
}

function normalizeEdhtiTags(tags, tagLabels) {
  const labels = tagLabels || {};
  const entries = Object.entries(tags || {});
  const values = entries.map(([, value]) => Number(value || 0));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);

  return entries
    .map(([key, value]) => ({
      key,
      label: labels[key] || key,
      raw: Number(value || 0),
      value: Math.round(((Number(value || 0) - min) / Math.max(max - min, 1)) * 100),
    }))
    .sort((a, b) => b.value - a.value);
}

function buildEdhtiResult(questions, answerMap, personas, tagLabels) {
  const tally = tallyEdhtiAnswers(questions, answerMap, tagLabels);
  const persona = personas && personas[tally.code];

  return {
    ...tally,
    persona,
    normalizedTags: normalizeEdhtiTags(tally.tags, tagLabels),
  };
}

module.exports = {
  EDHTI_COMMANDER_TAG_ORDER,
  buildEdhtiResult,
  buildCommanderTagSignature,
  createEmptyScores,
  getSelectedAnswers,
  normalizeEdhtiTags,
  selectEdhtiCommander,
  stableHash,
  tallyEdhtiAnswers,
};
