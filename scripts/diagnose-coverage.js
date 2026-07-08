const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const { commanders, statsWeightConfig } = require('../miniprogram/config/commanders');
const { questions, matchingConfig } = require('../miniprogram/config/questionnaire');
const {
  calculateColorMatchMultiplier,
} = require('../miniprogram/utils/recommender/profile');
const { buildEffectiveMatchTags } = require('../miniprogram/utils/recommender/tags');
const {
  calculateMetaStatusMultiplier,
  calculateSourceStatsMultiplier,
} = require('../miniprogram/utils/recommender/stats');
const {
  calculateCompetitivePriorityMultiplier,
} = require('../miniprogram/utils/recommender/ranking');

const args = new Set(process.argv.slice(2));
const mode = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=')[1] || 'basis';

function roundScore(score) {
  return Math.round(Number(score || 0) * 100) / 100;
}

function getQuestion(id) {
  return questions.find((question) => question.id === id);
}

function combinations(values, maxSize) {
  const result = [];
  const walk = (start, picked, size) => {
    if (picked.length === size) {
      result.push([...picked]);
      return;
    }

    for (let index = start; index < values.length; index += 1) {
      picked.push(values[index]);
      walk(index + 1, picked, size);
      picked.pop();
    }
  };

  for (let size = 1; size <= maxSize; size += 1) {
    walk(0, [], size);
  }

  return result;
}

function uniqueVariants(variants) {
  const seen = new Set();
  const output = [];

  variants.forEach((variant) => {
    const key = [...variant].sort().join('|') || 'none';
    if (seen.has(key)) return;
    seen.add(key);
    output.push(variant);
  });

  return output;
}

function colorIdentityToOptionSet(colorIdentity) {
  if (!colorIdentity || colorIdentity === 'C') return ['colorless'];

  const map = {
    W: 'white',
    U: 'blue',
    B: 'black',
    R: 'red',
    G: 'green',
  };

  return String(colorIdentity)
    .split('')
    .map((symbol) => map[symbol])
    .filter(Boolean);
}

function buildColorVariants() {
  const colorOptions = getQuestion('colors').options
    .map((option) => option.id)
    .filter((id) => id !== 'any');

  if (mode === 'full') return [['any'], ...combinations(colorOptions, colorOptions.length)];
  if (mode === 'singletons') return [['any'], ...colorOptions.map((id) => [id])];

  const commanderIdentitySets = commanders.map((commander) => colorIdentityToOptionSet(commander.colorIdentity));
  return uniqueVariants([
    ['any'],
    ...combinations(colorOptions, 2),
    ...commanderIdentitySets,
  ]);
}

function buildResourceVariants() {
  const resourceOptions = getQuestion('resourceEngine').options
    .map((option) => option.id)
    .filter((id) => id !== 'any');

  if (mode === 'full') return [['any'], ...combinations(resourceOptions, resourceOptions.length)];
  if (mode === 'singletons') return [['any'], ...resourceOptions.map((id) => [id])];

  return uniqueVariants([
    ['any'],
    ...combinations(resourceOptions, 2),
  ]);
}

function buildSingleQuestionAnswerSets() {
  const singleQuestions = questions.filter((question) => question.type !== 'multiple');
  const answerSets = [];

  const walk = (index, answers) => {
    if (index >= singleQuestions.length) {
      answerSets.push({ ...answers });
      return;
    }

    const question = singleQuestions[index];
    question.options.forEach((option) => {
      answers[question.id] = option.id;
      walk(index + 1, answers);
    });
  };

  walk(0, {});
  return answerSets;
}

const commanderRuntime = commanders.map((commander) => ({
  commander,
  tags: buildEffectiveMatchTags(commander),
  sourceStatsMultiplier: calculateSourceStatsMultiplier(commander, statsWeightConfig),
  metaStatusMultiplier: calculateMetaStatusMultiplier(commander, statsWeightConfig),
}));

const sourceAdjustmentFactor = commanderRuntime.map((item) => {
  const influence = Number(statsWeightConfig && statsWeightConfig.scoreInfluence);
  const boundedInfluence = Number.isFinite(influence) ? Math.max(0, Math.min(1, influence)) : 1;
  return 1 + (Number(item.sourceStatsMultiplier || 1) - 1) * boundedInfluence;
});

const metaStatusMultiplier = commanderRuntime.map((item) => Number(item.metaStatusMultiplier || 1));

function addWeights(target, weights, scale = 1) {
  Object.keys(weights || {}).forEach((key) => {
    target[key] = (target[key] || 0) + Number(weights[key] || 0) * scale;
  });
}

function dotWeights(weights, tags) {
  return Object.keys(weights || {}).reduce((sum, key) => (
    key.startsWith('__') ? sum : sum + Number(weights[key] || 0) * Number(tags[key] || 0)
  ), 0);
}

function vectorFromWeights(weights) {
  const vector = new Float64Array(commanders.length);
  commanderRuntime.forEach((item, index) => {
    vector[index] = dotWeights(weights, item.tags);
  });
  return vector;
}

function selectedPriorityFromAnswers(answers) {
  return answers.priority || '';
}

function buildWeightedOptionSet(question, selectedIds) {
  const weights = {};
  const selected = Array.isArray(selectedIds) ? selectedIds : [selectedIds];
  const decay = Array.isArray(question.multiSelectDecay) ? question.multiSelectDecay : null;

  (question.options || []).forEach((option) => {
    const selectedIndex = selected.indexOf(option.id);
    if (selectedIndex < 0) return;
    const scale = decay && selected.length > 1
      ? Number(decay[selectedIndex] || decay[decay.length - 1] || 1)
      : 1;
    addWeights(weights, option.weights, Number.isFinite(scale) ? scale : 1);
  });

  return weights;
}

function buildSingleComponents(singleAnswerSets) {
  return singleAnswerSets.map((answers) => {
    const weights = {};
    questions
      .filter((question) => question.type !== 'multiple')
      .forEach((question) => {
        const option = question.options.find((item) => item.id === answers[question.id]);
        if (option) addWeights(weights, option.weights);
      });

    const priorityProfile = {
      __selectedPriority: selectedPriorityFromAnswers(answers),
    };
    const competitiveMultiplier = commanderRuntime.map((item) => calculateCompetitivePriorityMultiplier(
      priorityProfile,
      item.commander,
      statsWeightConfig,
    ));

    return {
      answers,
      scoreVector: vectorFromWeights(weights),
      competitiveMultiplier,
    };
  });
}

function buildColorComponents(colorVariants) {
  const question = getQuestion('colors');
  return colorVariants.map((selectedIds) => {
    const selectedColors = selectedIds.includes('any') ? [] : selectedIds;
    const weights = buildWeightedOptionSet(question, selectedIds);
    const profile = { __selectedColors: selectedColors };

    return {
      selectedIds,
      scoreVector: vectorFromWeights(weights),
      colorMultiplier: commanderRuntime.map((item) => calculateColorMatchMultiplier(profile, item.commander, matchingConfig)),
    };
  });
}

function buildResourceComponents(resourceVariants) {
  const question = getQuestion('resourceEngine');
  return resourceVariants.map((selectedIds) => ({
    selectedIds,
    scoreVector: vectorFromWeights(buildWeightedOptionSet(question, selectedIds)),
  }));
}

function scoreByIndex(baseScore, colorMultiplier, commanderIndex, competitiveMultiplier) {
  const fitScore = baseScore * colorMultiplier;
  return roundScore(
    fitScore
    * sourceAdjustmentFactor[commanderIndex]
    * metaStatusMultiplier[commanderIndex]
    * competitiveMultiplier,
  );
}

function topThreeFromComponents(single, color, resource) {
  const top = [];

  commanderRuntime.forEach((item, commanderIndex) => {
    const score = scoreByIndex(
      single.scoreVector[commanderIndex] + color.scoreVector[commanderIndex] + resource.scoreVector[commanderIndex],
      color.colorMultiplier[commanderIndex],
      commanderIndex,
      single.competitiveMultiplier[commanderIndex],
    );
    const candidate = { name: item.commander.name, score };
    let inserted = false;

    for (let index = 0; index < top.length; index += 1) {
      if (
        candidate.score > top[index].score
        || (candidate.score === top[index].score && candidate.name.localeCompare(top[index].name) < 0)
      ) {
        top.splice(index, 0, candidate);
        inserted = true;
        break;
      }
    }

    if (!inserted && top.length < 3) top.push(candidate);
    if (top.length > 3) top.length = 3;
  });

  return top;
}

function diagnoseCoverage() {
  const singleAnswerSets = buildSingleQuestionAnswerSets();
  const colorVariants = buildColorVariants();
  const resourceVariants = buildResourceVariants();
  const singleComponents = buildSingleComponents(singleAnswerSets);
  const colorComponents = buildColorComponents(colorVariants);
  const resourceComponents = buildResourceComponents(resourceVariants);
  const top3Counts = new Map(commanders.map((commander) => [commander.name, 0]));
  let profileCount = 0;

  singleComponents.forEach((single) => {
    colorComponents.forEach((color) => {
      resourceComponents.forEach((resource) => {
        const answers = {
          ...single.answers,
          colors: color.selectedIds,
          resourceEngine: resource.selectedIds,
        };
        const top = topThreeFromComponents(single, color, resource);
        profileCount += 1;

        top.forEach((entry, index) => {
          top3Counts.set(entry.name, top3Counts.get(entry.name) + 1);
        });
      });
    });
  });

  const dead = commanders
    .map((commander) => commander.name)
    .filter((name) => top3Counts.get(name) === 0);
  const alive = commanders.length - dead.length;
  const topCovered = [...top3Counts.entries()]
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  return {
    mode,
    profileCount,
    commanderCount: commanders.length,
    alive,
    dead,
    topCovered,
  };
}

function diagnoseVisualConsistency() {
  const files = fs.readdirSync(path.join(root, 'miniprogram/pages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, 'miniprogram/pages', entry.name, `${entry.name}.wxss`))
    .filter((file) => fs.existsSync(file));
  const metrics = files.map((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file);
    return {
      file: rel,
      hexColors: (source.match(/#[0-9a-fA-F]{3,8}\b/g) || []).length,
      rgbaColors: (source.match(/rgba?\(/g) || []).length,
      gradients: (source.match(/linear-gradient|radial-gradient|repeating-linear-gradient/g) || []).length,
      textShadows: (source.match(/text-shadow:/g) || []).length,
      boxShadows: (source.match(/box-shadow:/g) || []).length,
      fontFamilies: (source.match(/font-family:/g) || []).length,
      hardcodedRpx: (source.match(/\b\d+rpx\b/g) || []).length,
      usesTokens: source.includes('var(--cedh-'),
    };
  });
  const warnings = [];

  metrics.forEach((metric) => {
    if (!metric.usesTokens) warnings.push(`${metric.file}: no design-token usage detected`);
    if (metric.hexColors + metric.rgbaColors > 70) warnings.push(`${metric.file}: high local color count (${metric.hexColors + metric.rgbaColors})`);
    if (metric.fontFamilies > 3) warnings.push(`${metric.file}: many local font stacks (${metric.fontFamilies})`);
  });

  return { metrics, warnings };
}

function printReport() {
  const coverage = diagnoseCoverage();
  const visual = diagnoseVisualConsistency();

  console.log(JSON.stringify({
    coverage: {
      mode: coverage.mode,
      profileCount: coverage.profileCount,
      commanderCount: coverage.commanderCount,
      alive: coverage.alive,
      deadCount: coverage.dead.length,
      dead: coverage.dead,
      topCovered: coverage.topCovered,
    },
    visual,
  }, null, 2));
}

printReport();
