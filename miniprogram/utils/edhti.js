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
  buildEdhtiResult,
  createEmptyScores,
  getSelectedAnswers,
  normalizeEdhtiTags,
  tallyEdhtiAnswers,
};
