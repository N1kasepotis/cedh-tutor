// Independent uniform answers simulate the questionnaire, not actual players.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { edhtiQuestions } = require('../miniprogram/config/edhti');
const AXES = [['competitive', 'fun'], ['social', 'solo'], ['complex', 'direct'], ['mainstream', 'offmeta']];
const LETTERS = [['C', 'F'], ['T', 'S'], ['X', 'D'], ['M', 'O']];

function questionFingerprint(questions) {
  const scoring = questions.map((question) => ({
    id: question.id, answers: question.answers.map((answer) => answer.scores || {}),
  }));
  return crypto.createHash('sha256').update(JSON.stringify(scoring)).digest('hex');
}

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function estimatePersonaOdds(questions, trials = 2000000, seed = 20261006) {
  if (!Number.isSafeInteger(trials) || trials <= 0) throw new Error('trials must be a positive safe integer');
  if (!questions.length || questions.some((question) => !question.answers || !question.answers.length)) {
    throw new Error('every question needs at least one answer');
  }
  const vectors = questions.map((question) => question.answers.map((answer) => AXES.map(([a, b]) => (
    Number((answer.scores || {})[a] || 0) - Number((answer.scores || {})[b] || 0)
  ))));
  const rng = mulberry32(seed);
  const counts = {};
  for (let trial = 0; trial < trials; trial += 1) {
    const totals = [0, 0, 0, 0];
    for (const answers of vectors) {
      const vector = answers[Math.floor(rng() * answers.length)];
      for (let axis = 0; axis < 4; axis += 1) totals[axis] += vector[axis];
    }
    const code = totals.map((total, axis) => LETTERS[axis][total >= 0 ? 0 : 1]).join('');
    counts[code] = (counts[code] || 0) + 1;
  }
  const odds = Object.fromEntries(Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => [code, Number((count / trials * 100).toFixed(2))]));
  return { odds, manifest: {
    method: 'seeded-monte-carlo', assumption: 'independent-uniform-answers',
    trials, seed, questionCount: questions.length,
    optionCounts: questions.map((question) => question.answers.length),
    scoringFingerprint: questionFingerprint(questions),
  } };
}

if (require.main === module) {
  const result = estimatePersonaOdds(edhtiQuestions);
  if (process.argv.includes('--write')) {
    const file = path.resolve(__dirname, '../miniprogram/config/edhti.js');
    const source = fs.readFileSync(file, 'utf8');
    const block = /const edhtiPersonaOdds = \{[\s\S]*?\n\};(?:\s*const edhtiOddsManifest = \{[\s\S]*?\n\};)?/;
    if (!block.test(source)) throw new Error('odds block was not found');
    const next = source.replace(
      block,
      `const edhtiPersonaOdds = ${JSON.stringify(result.odds, null, 2)};\n\nconst edhtiOddsManifest = ${JSON.stringify(result.manifest, null, 2)};`,
    );
    if (next !== source) fs.writeFileSync(file, next, 'utf8');
  }
  console.log(JSON.stringify(result, null, 2));
}
module.exports = { estimatePersonaOdds, questionFingerprint };
