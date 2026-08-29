const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildPreferenceProfile,
  buildEffectiveMatchTags,
  recommendCommanders,
  calculateCostTier,
  calculateColorMatchMultiplier,
  calculateStatsMultiplier,
  formatFitScore,
} = require('../miniprogram/utils/recommender');
const { questions, dimensionLabels, matchingConfig } = require('../miniprogram/config/questionnaire');
const {
  commanders,
  costTierConfig,
  metaTagConfig,
  statsWeightConfig,
} = require('../miniprogram/config/commanders');
const { particleConfig } = require('../miniprogram/config/particle');
const { performanceConfig } = require('../miniprogram/config/performance');

const root = path.join(__dirname, '..');

test('questionnaire keeps the required Chinese flow editable in config', () => {
  assert.equal(questions.length, 12);
  assert.deepEqual(
    questions.map((question) => question.id),
    ['speed', 'winCondition', 'interaction', 'budget', 'complexity', 'colors', 'commanderDependency', 'partnerPreference', 'style', 'axis', 'priority', 'resourceEngine'],
  );
  assert.deepEqual(
    questions[0].options.map((option) => option.text),
    ['Turbo', '中速', '控制'],
  );
  assert.equal(questions[0].options[0].id, 'turbo');
  assert.equal(questions[0].options[0].weights.combo || 0, 0);
  assert.deepEqual(
    questions[1].options.map((option) => option.text),
    ['组合技', '战斗伤害/烫血', '风暴'],
  );
  assert.ok((questions[1].options[1].weights.combat || 0) >= 6);
  assert.ok((questions[1].options[1].weights.damagePressure || 0) >= 4);
  assert.equal(questions[1].options[2].id, 'storm');
  assert.ok(questions[1].options[2].weights.storm >= 3);
  assert.deepEqual(
    questions[2].options.map((option) => option.text),
    ['Stax 锁场', '适度互动', '康完你的康他的', '各扫门前雪'],
  );
  assert.equal(dimensionLabels.stax, 'Stax');
  assert.equal(JSON.stringify(questions).includes('别急'), false);
  assert.deepEqual(
    questions[9].options.map((option) => option.text),
    ['线性游戏计划', '灵活性优先'],
  );

  questions.forEach((question) => {
    assert.ok(question.id);
    assert.ok(Array.isArray(question.options) && question.options.length >= 2);
    question.options.forEach((option) => {
      assert.ok(option.id && option.text);
      assert.ok(option.weights && Object.keys(option.weights).length > 0);
    });
  });

  const colorQuestion = questions.find((question) => question.id === 'colors');
  assert.equal(colorQuestion.type, 'multiple');
  assert.deepEqual(colorQuestion.options.map((option) => option.id), ['white', 'blue', 'black', 'red', 'green', 'colorless', 'any']);

  colorQuestion.options
    .filter((option) => option.id !== 'any')
    .forEach((option) => {
      assert.ok(
        option.weights[option.id] >= 6,
        `${option.id} color selection should have heavy primary weight`,
      );
    });

  const commanderDependencyQuestion = questions.find((question) => question.id === 'commanderDependency');
  assert.equal(commanderDependencyQuestion.type, 'single');
  assert.deepEqual(
    commanderDependencyQuestion.options.map((option) => option.id),
    ['high', 'medium', 'low'],
  );

  const partnerPreferenceQuestion = questions.find((question) => question.id === 'partnerPreference');
  assert.equal(partnerPreferenceQuestion.type, 'single');
  assert.deepEqual(
    partnerPreferenceQuestion.options.map((option) => option.id),
    ['dislike', 'like', 'any'],
  );

  const resourceEngineQuestion = questions.find((question) => question.id === 'resourceEngine');
  assert.equal(resourceEngineQuestion.title, '资源累计方式');
  assert.equal(resourceEngineQuestion.type, 'multiple');
  assert.deepEqual(
    resourceEngineQuestion.options.map((option) => option.id),
    ['spellChain', 'permanentEngine', 'artifact', 'enchantmentEngine', 'graveyard', 'cradleReset', 'any'],
  );
  assert.deepEqual(
    resourceEngineQuestion.options.map((option) => option.text),
    ['祭礼链条', '生物引擎', '神器与珍宝引擎', '结界引擎', '坟场利用', '盖亚的育苗地重置', '无所谓'],
  );
  assert.deepEqual(resourceEngineQuestion.multiSelectDecay, [1, 0.78, 0.6, 0.45, 0.32, 0.22]);
  assert.ok(resourceEngineQuestion.options.find((option) => option.id === 'spellChain').weights.spellChain >= 6);
  assert.ok(resourceEngineQuestion.options.find((option) => option.id === 'permanentEngine').weights.permanentEngine >= 6);
  assert.ok(resourceEngineQuestion.options.find((option) => option.id === 'artifact').weights.artifact >= 6);
  assert.ok(resourceEngineQuestion.options.find((option) => option.id === 'enchantmentEngine').weights.enchantmentEngine >= 6);
  assert.ok(resourceEngineQuestion.options.find((option) => option.id === 'graveyard').weights.graveyard >= 6);
  assert.ok(resourceEngineQuestion.options.find((option) => option.id === 'cradleReset').weights.cradleReset >= 6);
  assert.equal(dimensionLabels.spellChain, '祭礼链条');
  assert.equal(dimensionLabels.permanentEngine, '生物引擎');
  assert.equal(dimensionLabels.artifact, '神器与珍宝引擎');
  assert.equal(dimensionLabels.enchantmentEngine, '结界引擎');
  assert.equal(dimensionLabels.graveyard, '坟场利用');
  assert.equal(dimensionLabels.cradleReset, '盖亚的育苗地重置');
});

test('questionnaire options never use empty or zero-only weights', () => {
  questions.forEach((question) => {
    question.options.forEach((option) => {
      const positiveWeights = Object.values(option.weights || {}).filter((value) => Number(value) > 0);

      assert.ok(
        positiveWeights.length > 0,
        `${question.id}/${option.id} should have at least one positive matching weight`,
      );
    });
  });
});

test('each questionnaire option maps to real commander style tags', () => {
  const minimumByKey = {
    colorless: 1,
    graveyard: 3,
    artifact: 5,
    enchantmentEngine: 3,
    spellChain: 8,
    permanentEngine: 12,
    cradleReset: 1,
  };

  questions.forEach((question) => {
    question.options.forEach((option) => {
      const weightedKeys = Object.entries(option.weights || {})
        .filter(([, value]) => Number(value) > 0)
        .map(([key]) => key);
      const coverage = commanders.filter((commander) => {
        const tags = buildEffectiveMatchTags(commander);
        return weightedKeys.some((key) => Number(tags[key] || 0) > 0);
      });
      const minimum = Math.max(...weightedKeys.map((key) => minimumByKey[key] || 5));

      assert.ok(
        coverage.length >= minimum,
        `${question.id}/${option.id} should match at least ${minimum} commanders, got ${coverage.length}`,
      );
    });
  });
});

test('each questionnaire option has broad commander coverage', () => {
  const minimumByOption = {
    // 剪掉两套死档拍档牌（Rograkh/Tevesh、Dargo/Reyhan）后，活跃拍档池为 19
    'partnerPreference/like': 19,
  };

  questions.forEach((question) => {
    question.options.forEach((option) => {
      const weightedKeys = Object.entries(option.weights || {})
        .filter(([, value]) => Number(value) > 0)
        .map(([key]) => key);
      const coverage = commanders.filter((commander) => {
        const tags = buildEffectiveMatchTags(commander);
        return weightedKeys.some((key) => Number(tags[key] || 0) > 0);
      });
      const minimum = minimumByOption[`${question.id}/${option.id}`] || Math.floor(commanders.length * 0.35);

      assert.ok(
        coverage.length >= minimum,
        `${question.id}/${option.id} should cover at least ${minimum} commanders, got ${coverage.length}`,
      );
    });
  });
});

test('previously thin questionnaire choices have direct commander tags', () => {
  const directCoverage = (key) => commanders.filter((commander) => {
    const tags = buildEffectiveMatchTags(commander);
    return Number(tags[key] || 0) > 0;
  }).length;

  assert.ok(directCoverage('lowInteraction') >= 50);
  assert.ok(directCoverage('graveyard') >= 40);
  assert.ok(directCoverage('budgetFriendly') >= 45);
  assert.ok(directCoverage('commanderDependent') >= 50);
});

test('resource engine preference separates spell, permanent, artifact, enchantment, graveyard, and Cradle shells', () => {
  const resourceEngineQuestion = questions.find((question) => question.id === 'resourceEngine');
  assert.equal(resourceEngineQuestion.title, '资源累计方式');

  const recommendationsFor = (resourceEngine) => recommendCommanders(
    buildPreferenceProfile(questions, { resourceEngine }),
    commanders,
    5,
    dimensionLabels,
    costTierConfig,
    statsWeightConfig,
    matchingConfig,
  );

  const spellResults = recommendationsFor('spellChain');
  const artifactResults = recommendationsFor('artifact');
  const enchantmentResults = recommendationsFor('enchantmentEngine');
  const graveyardResults = recommendationsFor('graveyard');
  const cradleResults = recommendationsFor('cradleReset');

  assert.ok(spellResults.some((commander) => buildEffectiveMatchTags(commander).spellChain > 0));
  assert.ok(artifactResults.some((commander) => buildEffectiveMatchTags(commander).artifact > 0));
  assert.ok(enchantmentResults.some((commander) => buildEffectiveMatchTags(commander).enchantmentEngine > 0));
  assert.ok(graveyardResults.some((commander) => buildEffectiveMatchTags(commander).graveyard > 0));
  assert.ok(cradleResults.some((commander) => buildEffectiveMatchTags(commander).cradleReset > 0));
  assert.notDeepEqual(
    spellResults.map((commander) => commander.name),
    artifactResults.map((commander) => commander.name),
  );
});

test('resource engine supports selecting multiple engine styles at once', () => {
  const resourceEngineQuestion = questions.find((question) => question.id === 'resourceEngine');
  const spellChainOption = resourceEngineQuestion.options.find((option) => option.id === 'spellChain');
  const artifactOption = resourceEngineQuestion.options.find((option) => option.id === 'artifact');
  const cradleOption = resourceEngineQuestion.options.find((option) => option.id === 'cradleReset');
  const profile = buildPreferenceProfile(questions, {
    resourceEngine: ['spellChain', 'artifact', 'cradleReset'],
  });

  assert.equal(profile.spellChain, spellChainOption.weights.spellChain);
  assert.equal(profile.artifact, artifactOption.weights.artifact * resourceEngineQuestion.multiSelectDecay[1]);
  assert.equal(profile.cradleReset, cradleOption.weights.cradleReset * resourceEngineQuestion.multiSelectDecay[2]);
  assert.equal(profile.storm, spellChainOption.weights.storm);
  assert.equal(
    profile.speed,
    spellChainOption.weights.speed + artifactOption.weights.speed * resourceEngineQuestion.multiSelectDecay[1],
  );
  assert.equal(profile.permanentEngine || 0, cradleOption.weights.permanentEngine * resourceEngineQuestion.multiSelectDecay[2]);
  assert.equal(profile.enchantmentEngine || 0, 0);
  assert.equal(profile.graveyard || 0, 0);
});

test('combat damage preference strongly rewards true burn-pressure commanders', () => {
  const profile = buildPreferenceProfile(questions, {
    winCondition: 'combat',
    colors: ['blue', 'black'],
    commanderDependency: 'medium',
    style: 'proactive',
    priority: 'fun',
  });
  const yuriko = commanders.find((commander) => commander.name === "Yuriko, the Tiger's Shadow");
  const talion = commanders.find((commander) => commander.name === 'Talion, the Kindly Lord');
  const genericDimirControl = {
    name: 'Generic Dimir Control',
    colorIdentity: 'UB',
    matchTags: {
      control: 4,
      interaction: 4,
      blue: 2,
      black: 2,
      commanderFlexible: 3,
    },
    deckElements: ['control_posture'],
    edhtop16Url: 'https://edhtop16.com/commander/Generic%20Dimir%20Control',
    sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
  };

  assert.ok(profile.damagePressure >= 4);
  assert.ok((yuriko.matchTags.damagePressure || 0) >= 4);
  assert.ok((talion.matchTags.damagePressure || 0) <= 2);
  assert.ok((talion.matchTags.control || 0) >= 3);
  assert.ok((talion.matchTags.value || 0) >= 2);

  const recommendations = recommendCommanders(
    profile,
    [genericDimirControl, talion, yuriko],
    3,
    dimensionLabels,
    costTierConfig,
    statsWeightConfig,
    matchingConfig,
  );

  assert.deepEqual(
    recommendations.map((commander) => commander.name),
    ["Yuriko, the Tiger's Shadow", 'Talion, the Kindly Lord', 'Generic Dimir Control'],
  );
});

test('Talion is weighted as Dimir control value rather than combat burn', () => {
  const talion = commanders.find((commander) => commander.name === 'Talion, the Kindly Lord');
  const yuriko = commanders.find((commander) => commander.name === "Yuriko, the Tiger's Shadow");
  const profile = buildPreferenceProfile(questions, {
    speed: 'slowControl',
    winCondition: 'combo',
    interaction: 'stackControl',
    colors: ['blue', 'black'],
    style: 'lateGame',
    axis: 'flexibility',
    priority: 'competitive',
  });

  const recommendations = recommendCommanders(
    profile,
    [talion, yuriko],
    2,
    dimensionLabels,
    costTierConfig,
    statsWeightConfig,
    matchingConfig,
  );

  assert.equal(recommendations[0].name, 'Talion, the Kindly Lord');
});

test('Ishai partner shells are not overweighted as combat decks', () => {
  const ishaiCommanders = commanders.filter((commander) => commander.name.includes('Ishai, Ojutai Dragonspeaker'));

  assert.ok(ishaiCommanders.length >= 1);
  ishaiCommanders.forEach((commander) => {
    assert.ok((commander.matchTags.combat || 0) <= 1, `${commander.name} combat weight should stay low`);
    assert.equal(commander.matchTags.damagePressure || 0, 0, `${commander.name} should not get burn-pressure weight`);
  });
});

test('storm win-condition preference can match storm deck elements', () => {
  assert.equal(dimensionLabels.storm, '风暴');

  const profile = buildPreferenceProfile(questions, {
    speed: 'turbo',
    winCondition: 'storm',
  });
  const recommendations = recommendCommanders(profile, [
    {
      name: 'Storm Shell',
      colorIdentity: 'UR',
      matchTags: { combo: 1 },
      deckElements: ['storm_combo'],
    },
    {
      name: 'Generic Combo',
      colorIdentity: 'UB',
      matchTags: { combo: 4, speed: 1 },
      deckElements: [],
    },
  ], 1, dimensionLabels, costTierConfig);

  assert.equal(recommendations[0].name, 'Storm Shell');
});

test('commander library uses a pruned local edhtop16 pool with accurate required fields', () => {
  assert.equal(commanders.length, 100);
  assert.equal(commanders.some((commander) => commander.name === 'Prismari, the Inspiration'), false);

  const colorBuckets = new Set();
  const archetypes = new Set();
  const names = new Set();

  commanders.forEach((commander) => {
    assert.ok(commander.name, 'commander keeps English name');
    assert.ok(!names.has(commander.name), `${commander.name} should be unique`);
    names.add(commander.name);
    assert.match(commander.colorIdentity, /^(C|[WUBRG]+)$/);
    assert.match(commander.edhtop16Url, /^https:\/\/edhtop16\.com\/commander\/.+/);
    assert.ok(Array.isArray(commander.archetypeTags) && commander.archetypeTags.length > 0, `${commander.name} needs archetype tags`);
    assert.ok(commander.matchTags && Object.keys(commander.matchTags).length >= 4, `${commander.name} needs match tags`);
    assert.ok(
      ['commanderDependent', 'commanderFlexible', 'commanderIndependent'].some((key) => commander.matchTags[key] > 0),
      `${commander.name} needs commander dependency tags`,
    );
    assert.ok(Array.isArray(commander.deckElements) && commander.deckElements.length >= 5, `${commander.name} needs expanded deck elements`);

    if (commander.colorIdentity === 'C') colorBuckets.add('colorless');
    else colorBuckets.add(commander.colorIdentity.length);
    commander.archetypeTags.forEach((tag) => archetypes.add(tag));
  });

  ['colorless', 1, 2, 3, 4, 5].forEach((bucket) => {
    assert.ok(colorBuckets.has(bucket), `missing color bucket ${bucket}`);
  });
  ['Turbo', 'Stax', 'Midrange', 'Aggro', 'Control'].forEach((tag) => {
    assert.ok(archetypes.has(tag), `missing archetype ${tag}`);
  });
});

test('commander data imports recommendation rules from a focused config file', () => {
  const rulesPath = path.join(root, 'miniprogram/config/recommendation-rules.js');
  const commandersPath = path.join(root, 'miniprogram/config/commanders.js');
  const commandersSource = fs.readFileSync(commandersPath, 'utf8');
  const header = commandersSource.slice(0, commandersSource.indexOf('const commanders = ['));

  assert.ok(fs.existsSync(rulesPath), 'recommendation rules config should exist');
  assert.match(commandersSource, /require\('\.\/recommendation-rules'\)/);
  assert.doesNotMatch(header, /const statsWeightConfig =/);
  assert.doesNotMatch(header, /const metaTagConfig =/);
});

test('commander library reflects requested partner removals and current top-100 pruning', () => {
  const byName = (name) => commanders.find((commander) => commander.name === name);
  const franciscoThrasios = byName('Francisco, Fowl Marauder / Thrasios, Triton Hero');
  const krarkTymna = byName('Krark, the Thumbless / Tymna the Weaver');
  const krarkRograkh = byName('Krark, the Thumbless / Rograkh, Son of Rohgahh');
  const nickFury = byName('Nick Fury, Agent of S.H.I.E.L.D.');
  const lonis = byName('Lonis, Cryptozoologist');

  assert.equal(franciscoThrasios, undefined);
  assert.equal(krarkTymna, undefined);
  assert.equal(krarkRograkh, undefined);
  assert.equal(nickFury, undefined);

  assert.equal(lonis, undefined);
});

test('commander library derives broad online-reviewed meta tags', () => {
  const byName = (name) => commanders.find((commander) => commander.name === name);
  const countTag = (tag) => commanders.filter((commander) => commander.metaTags.includes(tag)).length;

  ['irrelevant', 'competitive', 'fringe', 'outdated', 'fun'].forEach((tag) => {
    assert.ok(metaTagConfig.knownTags.includes(tag), `${tag} should be a known meta tag`);
  });

  commanders.forEach((commander) => {
    assert.ok(Array.isArray(commander.metaTags), `${commander.name} needs metaTags`);
  });

  assert.ok(countTag('competitive') >= 12, 'competitive should cover established meta decks');
  assert.ok(countTag('fringe') >= 35, 'fringe should cover lower-play but plausible decks');
  assert.equal(countTag('irrelevant'), 0, 'irrelevant decks should be pruned from the active pool');
  assert.equal(countTag('outdated'), 0, 'outdated decks should be pruned from the active pool');
  assert.ok(countTag('fun') >= 10, 'fun should cover expressive or high-variance decks');

  assert.ok(byName("Kraum, Ludevic's Opus / Tymna the Weaver").metaTags.includes('competitive'));
  assert.ok(byName('Magda, Brazen Outlaw').metaTags.includes('competitive'));
  assert.equal(byName('Breya, Etherium Shaper'), undefined);
  assert.equal(byName('Slicer, Hired Muscle // Slicer, High-Speed Antagonist'), undefined);
});

test('expanded deck elements capture representative reddit-reviewed archetypes', () => {
  const byName = (needle) => commanders.find((commander) => commander.name.includes(needle));

  assert.deepEqual(
    ['blue_farm', 'ad_naus', 'breach_oracle', 'farm_value', 'top_play_count'].every((tag) => (
      byName("Kraum, Ludevic's Opus / Tymna").deckElements.includes(tag)
    )),
    true,
  );
  assert.deepEqual(
    ['mana_engine', 'infinite_mana', 'creature_combo', 'top_play_count'].every((tag) => (
      byName('Kinnan').deckElements.includes(tag)
    )),
    true,
  );
  assert.deepEqual(
    ['turbo_naus', 'fast_mana', 'breach_oracle', 'high_play_count'].every((tag) => (
      byName('Rograkh, Son of Rohgahh / Silas').deckElements.includes(tag)
    )),
    true,
  );
  assert.deepEqual(
    ['treasure_engine', 'artifact_combo', 'stax_piece', 'high_play_count'].every((tag) => (
      byName('Magda').deckElements.includes(tag)
    )),
    true,
  );
  assert.deepEqual(
    ['time_sieve', 'artifact_combo', 'stax_compatible', 'midrange_value'].every((tag) => (
      byName('Tivit').deckElements.includes(tag)
    )),
    true,
  );
  assert.equal(byName('Slicer'), undefined);
});

test('reddit-reviewed commander tags stay aligned with community archetypes', () => {
  const byName = (name) => commanders.find((commander) => commander.name === name);
  const kinnan = byName('Kinnan, Bonder Prodigy');
  const sisay = byName('Sisay, Weatherlight Captain');
  const magda = byName('Magda, Brazen Outlaw');
  const tivit = byName('Tivit, Seller of Secrets');
  const tayam = byName('Tayam, Luminous Enigma');
  const krarkSakashima = byName('Krark, the Thumbless / Sakashima of a Thousand Faces');
  const winota = byName('Winota, Joiner of Forces');
  const najeela = byName('Najeela, the Blade-Blossom');
  const yuriko = byName("Yuriko, the Tiger's Shadow");
  const talion = byName('Talion, the Kindly Lord');

  assert.ok((kinnan.matchTags.permanentEngine || 0) >= 4);
  assert.ok(kinnan.deckElements.includes('basalt_monolith_combo'));
  assert.ok(kinnan.deckElements.includes('artifact_mana'));

  assert.ok((sisay.matchTags.permanentEngine || 0) >= 4);
  assert.ok(sisay.deckElements.includes('activated_ability'));
  assert.ok(sisay.deckElements.includes('mana_engine'));

  assert.ok(magda.archetypeTags.includes('Stax'));
  assert.ok(magda.archetypeTags.includes('Turbo'));
  assert.ok(magda.deckElements.includes('treasure_engine'));
  assert.ok(magda.deckElements.includes('artifact_combo'));

  assert.ok((tivit.matchTags.artifact || 0) >= 3);
  assert.ok(tivit.deckElements.includes('time_sieve'));
  assert.ok(tivit.deckElements.includes('stax_compatible'));

  assert.ok((tayam.matchTags.graveyard || 0) >= 4);
  assert.ok(tayam.deckElements.includes('graveyard_loop'));
  assert.ok(tayam.deckElements.includes('stax_grind'));

  assert.ok(krarkSakashima.archetypeTags.includes('Storm'));
  assert.ok((krarkSakashima.matchTags.storm || 0) >= 4);
  assert.ok(krarkSakashima.deckElements.includes('coin_flip_engine'));
  assert.ok(krarkSakashima.deckElements.includes('copy_spells'));

  assert.ok(winota.archetypeTags.includes('Stax'));
  assert.ok(winota.archetypeTags.includes('Aggro'));
  assert.ok(winota.deckElements.includes('winota_stax'));

  assert.ok((najeela.matchTags.combat || 0) >= 4);
  assert.ok(najeela.deckElements.includes('combat_combo'));
  assert.ok(najeela.deckElements.includes('extra_combat'));

  assert.ok(yuriko.deckElements.includes('ninja_combat'));
  assert.ok(yuriko.deckElements.includes('topdeck_damage'));
  assert.ok((yuriko.matchTags.damagePressure || 0) >= 4);

  assert.ok(talion.archetypeTags.includes('Control'));
  assert.ok(talion.deckElements.includes('commander_card_advantage'));
  assert.equal(talion.deckElements.includes('damage_pressure'), false);
});

test('mono-red commander tuning keeps Magda while dead mono-red shells stay removed', () => {
  const magda = commanders.find((commander) => commander.name === 'Magda, Brazen Outlaw');
  const godo = commanders.find((commander) => commander.name === 'Godo, Bandit Warlord');

  assert.equal(magda.colorIdentity, 'R');
  assert.equal(godo, undefined);
  assert.ok((magda.matchTags.stax || 0) >= 4);
  assert.ok((magda.matchTags.speed || 0) >= 1);
  assert.ok(magda.deckElements.includes('treasure_engine'));
});

test('Maralen is not weighted as a broad UBG control deck', () => {
  const maralen = commanders.find((commander) => commander.name === 'Maralen, Fae Ascendant');

  assert.ok(maralen, 'Maralen should exist in the commander library');
  assert.deepEqual(maralen.archetypeTags, ['Turbo', 'Midrange']);
  assert.ok((maralen.matchTags.combo || 0) >= 3);
  assert.ok((maralen.matchTags.midrange || 0) <= 1);
  assert.equal(maralen.matchTags.control || 0, 0);
  assert.equal(maralen.matchTags.stax || 0, 0);
  assert.equal(maralen.matchTags.flexibility || 0, 0);
  assert.equal(maralen.matchTags.lateGame || 0, 0);

  const genericSultaiControl = {
    control: 4,
    lateGame: 5,
    interaction: 5,
    midrange: 3,
    value: 3,
    flexibility: 4,
    blue: 3,
    black: 2,
    green: 2,
    mediumBudget: 3,
  };
  const recommendations = recommendCommanders(genericSultaiControl, commanders, 5, dimensionLabels, costTierConfig);

  assert.equal(
    recommendations.some((commander) => commander.name === 'Maralen, Fae Ascendant'),
    false,
    'generic Sultai control preferences should not push Maralen into the top 5',
  );
});

test('Tymna Kraum is weighted as Blue Farm combo midrange for competitive WUBR profiles', () => {
  const answers = {
    speed: 'turbo',
    winCondition: 'combo',
    interaction: 'moderate',
    budget: 'high',
    complexity: 'complex',
    colors: ['white', 'blue', 'black', 'red'],
    style: 'proactive',
    axis: 'flexibility',
    priority: 'competitive',
  };
  const profile = buildPreferenceProfile(questions, answers);
  const recommendations = recommendCommanders(profile, commanders, 5, dimensionLabels, costTierConfig, statsWeightConfig, matchingConfig);

  assert.ok(
    recommendations.some((commander) => commander.name === "Kraum, Ludevic's Opus / Tymna the Weaver"),
    'Blue Farm-style preferences should keep Tymna/Kraum in the top 5',
  );
});

test('colorless preference gives Zhulodok a real recommendation path', () => {
  const zhulodok = commanders.find((commander) => commander.name === 'Zhulodok, Void Gorger');

  assert.ok(zhulodok, 'Zhulodok should exist in the commander library');
  assert.equal(zhulodok.colorIdentity, 'C');
  assert.ok((zhulodok.matchTags.colorless || 0) >= 3);

  const answers = {
    speed: 'midrange',
    winCondition: 'combat',
    interaction: 'moderate',
    budget: 'low',
    complexity: 'simple',
    colors: ['colorless'],
    style: 'lateGame',
    axis: 'flexibility',
    priority: 'fun',
  };
  const profile = buildPreferenceProfile(questions, answers);
  const recommendations = recommendCommanders(profile, commanders, 5, dimensionLabels, costTierConfig, statsWeightConfig, matchingConfig);

  assert.ok(
    recommendations.some((commander) => commander.name === 'Zhulodok, Void Gorger'),
    'a colorless midrange/value profile should keep Zhulodok in the top 5',
  );
});

test('selected colors penalize commanders with no color overlap', () => {
  const profile = buildPreferenceProfile(questions, {
    winCondition: 'combo',
    colors: ['white'],
  });
  const candidates = [
    {
      name: 'White Candidate',
      colorIdentity: 'W',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/White%20Candidate',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
    {
      name: 'Blue Candidate',
      colorIdentity: 'U',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Blue%20Candidate',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
  ];

  const recommendations = recommendCommanders(profile, candidates, 2, dimensionLabels, costTierConfig, statsWeightConfig, matchingConfig);

  assert.equal(recommendations[0].name, 'White Candidate');
  assert.ok(recommendations[0].score > recommendations[1].score);
});

test('selected colors increasingly punish unselected commander colors', () => {
  const profile = buildPreferenceProfile(questions, {
    colors: ['white'],
  });
  const exactWhite = calculateColorMatchMultiplier(profile, { colorIdentity: 'W' }, matchingConfig);
  const oneExtraColor = calculateColorMatchMultiplier(profile, { colorIdentity: 'WU' }, matchingConfig);
  const twoExtraColors = calculateColorMatchMultiplier(profile, { colorIdentity: 'WUB' }, matchingConfig);
  const fourExtraColors = calculateColorMatchMultiplier(profile, { colorIdentity: 'WUBRG' }, matchingConfig);
  const noOverlapOneColor = calculateColorMatchMultiplier(profile, { colorIdentity: 'U' }, matchingConfig);
  const noOverlapThreeColors = calculateColorMatchMultiplier(profile, { colorIdentity: 'UBR' }, matchingConfig);

  assert.ok(matchingConfig.unselectedColorMultiplier < 1);
  assert.equal(exactWhite, 1);
  assert.ok(oneExtraColor < exactWhite);
  assert.ok(twoExtraColors < oneExtraColor);
  assert.ok(fourExtraColors < twoExtraColors);
  assert.equal(noOverlapOneColor, matchingConfig.colorMismatchMultiplier);
  assert.ok(noOverlapThreeColors < noOverlapOneColor);
});

test('recommendations rank matching colors above extra unselected colors when fit is equal', () => {
  const profile = buildPreferenceProfile(questions, {
    winCondition: 'combo',
    colors: ['white'],
  });
  const candidates = [
    {
      name: 'Five Color Candidate',
      colorIdentity: 'WUBRG',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Five%20Color%20Candidate',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
    {
      name: 'Azorius Candidate',
      colorIdentity: 'WU',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Azorius%20Candidate',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
    {
      name: 'White Candidate',
      colorIdentity: 'W',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/White%20Candidate',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
  ];

  const recommendations = recommendCommanders(profile, candidates, 3, dimensionLabels, costTierConfig, statsWeightConfig, matchingConfig);

  assert.deepEqual(
    recommendations.map((commander) => commander.name),
    ['White Candidate', 'Azorius Candidate', 'Five Color Candidate'],
  );
  assert.ok(recommendations[0].colorMultiplier > recommendations[1].colorMultiplier);
  assert.ok(recommendations[1].colorMultiplier > recommendations[2].colorMultiplier);
});

test('commander dependency criterion ranks decks by desired commander reliance', () => {
  const profile = buildPreferenceProfile(questions, {
    commanderDependency: 'low',
    colors: ['any'],
  });
  const candidates = [
    {
      name: 'Commander Independent',
      colorIdentity: 'UB',
      matchTags: { commanderIndependent: 5 },
      edhtop16Url: 'https://edhtop16.com/commander/Commander%20Independent',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
    {
      name: 'Commander Dependent',
      colorIdentity: 'UB',
      matchTags: { commanderDependent: 5 },
      edhtop16Url: 'https://edhtop16.com/commander/Commander%20Dependent',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
  ];

  const recommendations = recommendCommanders(profile, candidates, 2, dimensionLabels, costTierConfig, statsWeightConfig, matchingConfig);

  assert.equal(recommendations[0].name, 'Commander Independent');
  assert.ok(recommendations[0].score > recommendations[1].score);
});

test('partner preference criterion adjusts partner shell ranking', () => {
  const dislikeProfile = buildPreferenceProfile(questions, {
    partnerPreference: 'dislike',
  });
  const likeProfile = buildPreferenceProfile(questions, {
    partnerPreference: 'like',
  });
  const candidates = [
    {
      name: 'Partner Shell',
      colorIdentity: 'UB',
      matchTags: { partnerFriendly: 4 },
      deckElements: ['partner_shell'],
      edhtop16Url: 'https://edhtop16.com/commander/Partner%20Shell',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
    {
      name: 'Solo Shell',
      colorIdentity: 'UB',
      matchTags: { partnerAverse: 4 },
      deckElements: ['solo_commander'],
      edhtop16Url: 'https://edhtop16.com/commander/Solo%20Shell',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
  ];

  const dislikeRecommendations = recommendCommanders(
    dislikeProfile,
    candidates,
    2,
    dimensionLabels,
    costTierConfig,
    statsWeightConfig,
    matchingConfig,
  );
  const likeRecommendations = recommendCommanders(
    likeProfile,
    candidates,
    2,
    dimensionLabels,
    costTierConfig,
    statsWeightConfig,
    matchingConfig,
  );

  assert.equal(dislikeRecommendations[0].name, 'Solo Shell');
  assert.ok(dislikeRecommendations[0].score > dislikeRecommendations[1].score);
  assert.equal(likeRecommendations[0].name, 'Partner Shell');
  assert.ok(likeRecommendations[0].score > likeRecommendations[1].score);
});

test('cost tier is derived from color count and never shows RMB amount', () => {
  assert.deepEqual(costTierConfig.rules, [
    { minColors: 0, maxColors: 1, label: '低' },
    { minColors: 2, maxColors: 3, label: '中' },
    { minColors: 4, maxColors: 5, label: '高' },
  ]);

  assert.equal(calculateCostTier('C', costTierConfig), '低');
  assert.equal(calculateCostTier('U', costTierConfig), '低');
  assert.equal(calculateCostTier('UB', costTierConfig), '中');
  assert.equal(calculateCostTier('WUB', costTierConfig), '中');
  assert.equal(calculateCostTier('WUBR', costTierConfig), '高');
  assert.equal(calculateCostTier('WUBRG', costTierConfig), '高');
});

test('stats multiplier lowers decks with weak conversion or play rate', () => {
  const strongDeck = {
    sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
  };
  const lowConversionDeck = {
    sourceStats: { winRate: 0.08, entries: 120, metaShare: 0.006 },
  };
  const lowPlayDeck = {
    sourceStats: { winRate: 0.2, entries: 20, metaShare: 0.0006 },
  };
  const bothWeakDeck = {
    sourceStats: { winRate: 0.08, entries: 20, metaShare: 0.0006 },
  };

  assert.equal(calculateStatsMultiplier(strongDeck, statsWeightConfig), 1);
  assert.ok(calculateStatsMultiplier(lowConversionDeck, statsWeightConfig) < 1);
  assert.ok(calculateStatsMultiplier(lowPlayDeck, statsWeightConfig) < 1);
  assert.ok(
    calculateStatsMultiplier(bothWeakDeck, statsWeightConfig) < calculateStatsMultiplier(lowConversionDeck, statsWeightConfig),
  );
});

test('low-play partner shells receive an extra configurable weight reduction', () => {
  const coldSoloDeck = {
    name: 'Cold Solo',
    sourceStats: { winRate: 0.2, entries: 20, metaShare: 0.0006 },
    deckElements: ['solo_commander'],
  };
  const coldPartnerDeck = {
    name: 'Cold Partner A / Cold Partner B',
    sourceStats: { winRate: 0.2, entries: 20, metaShare: 0.0006 },
    deckElements: ['partner_shell'],
  };
  const establishedPartnerDeck = {
    name: 'Established Partner A / Established Partner B',
    sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    deckElements: ['partner_shell'],
  };

  assert.ok(statsWeightConfig.lowPlayPartner.enabled);
  assert.ok(statsWeightConfig.lowPlayPartner.multiplier < 1);
  assert.ok(calculateStatsMultiplier(coldPartnerDeck, statsWeightConfig) < calculateStatsMultiplier(coldSoloDeck, statsWeightConfig));
  assert.equal(calculateStatsMultiplier(establishedPartnerDeck, statsWeightConfig), 1);
});

test('irrelevant and outdated meta tags trigger the same recommendation penalties as legacy fields', () => {
  const currentDeck = {
    name: 'Current Tagged Baseline',
    sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    metaTags: [],
  };
  const irrelevantDeck = {
    ...currentDeck,
    name: 'Irrelevant Tagged Baseline',
    metaTags: ['irrelevant'],
  };
  const outdatedDeck = {
    ...currentDeck,
    name: 'Outdated Tagged Baseline',
    metaTags: ['outdated'],
  };

  assert.ok(calculateStatsMultiplier(irrelevantDeck, statsWeightConfig) < calculateStatsMultiplier(currentDeck, statsWeightConfig));
  assert.ok(calculateStatsMultiplier(outdatedDeck, statsWeightConfig) < calculateStatsMultiplier(currentDeck, statsWeightConfig));
});

test('bottom-half partner shells receive a configurable 0.7 weight reduction', () => {
  const config = {
    ...statsWeightConfig,
    minMultiplier: 0,
    maxMultiplier: 2,
    conversionRate: { lowBelow: 0, lowMultiplier: 1 },
    playRate: {
      minEntries: 0,
      minMetaShare: 0,
      lowMultiplier: 1,
      highEntries: 999999,
      highMetaShare: 1,
      highMultiplier: 1,
      topEntries: 999999,
      topMetaShare: 1,
      topMultiplier: 1,
    },
    lowPlayPartner: { ...statsWeightConfig.lowPlayPartner, enabled: false },
    outdated: { ...statsWeightConfig.outdated, enabled: false },
    irrelevant: { ...statsWeightConfig.irrelevant, enabled: false },
    bottomHalfPartner: {
      enabled: true,
      entriesBelowOrEqual: 61,
      metaShareBelowOrEqual: 0.001875,
      multiplier: 0.7,
    },
  };
  const bottomPartnerDeck = {
    name: 'Bottom Partner A / Bottom Partner B',
    sourceStats: { winRate: 0.2, entries: 50, metaShare: 0.0015 },
    deckElements: ['partner_shell'],
  };
  const upperPartnerDeck = {
    name: 'Upper Partner A / Upper Partner B',
    sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    deckElements: ['partner_shell'],
  };
  const bottomSoloDeck = {
    name: 'Bottom Solo',
    sourceStats: { winRate: 0.2, entries: 50, metaShare: 0.0015 },
    deckElements: ['solo_commander'],
  };

  assert.ok(statsWeightConfig.bottomHalfPartner.enabled);
  assert.equal(statsWeightConfig.bottomHalfPartner.multiplier, 0.7);
  assert.equal(calculateStatsMultiplier(bottomPartnerDeck, config), 0.7);
  assert.equal(calculateStatsMultiplier(upperPartnerDeck, config), 1);
  assert.equal(calculateStatsMultiplier(bottomSoloDeck, config), 1);
});

test('outdated commanders receive a configurable recommendation penalty', () => {
  const currentDeck = {
    name: 'Current Baseline',
    sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    deckElements: ['current_meta'],
  };
  const outdatedDeck = {
    name: 'Outdated Baseline',
    sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    deckElements: ['outdated_meta'],
  };
  const profile = { combo: 10 };
  const candidates = [
    {
      ...outdatedDeck,
      colorIdentity: 'UB',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Outdated%20Baseline',
    },
    {
      ...currentDeck,
      colorIdentity: 'UB',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Current%20Baseline',
    },
  ];

  assert.ok(statsWeightConfig.outdated.enabled);
  assert.ok(statsWeightConfig.outdated.multiplier < 1);
  assert.ok(calculateStatsMultiplier(outdatedDeck, statsWeightConfig) < calculateStatsMultiplier(currentDeck, statsWeightConfig));
  assert.equal(commanders.find((commander) => commander.name === 'Jeska, Thrice Reborn / Tymna the Weaver'), undefined);

  const recommendations = recommendCommanders(profile, candidates, 2, dimensionLabels, costTierConfig, statsWeightConfig);
  assert.equal(recommendations[0].name, 'Current Baseline');
  assert.ok(recommendations[0].score > recommendations[1].score);
});

test('outdated and irrelevant partner shells receive separate meta penalties', () => {
  const byName = (name) => commanders.find((commander) => commander.name === name);
  const krarkTymna = byName('Krark, the Thumbless / Tymna the Weaver');
  const activePartner = byName('Dargo, the Shipwrecker / Tymna the Weaver');
  const outdatedPartner = {
    name: 'Outdated Partner Test / Tymna the Weaver',
    colorIdentity: 'WB',
    sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    deckElements: ['partner_shell', 'outdated_meta'],
  };
  const irrelevantPartner = {
    name: 'Irrelevant Partner Test / Tymna the Weaver',
    colorIdentity: 'WB',
    sourceStats: { winRate: 0.08, entries: 12, metaShare: 0.0004 },
    deckElements: ['partner_shell', 'irrelevant_meta'],
  };

  assert.ok(statsWeightConfig.irrelevant.enabled);
  assert.ok(statsWeightConfig.irrelevant.multiplier < statsWeightConfig.outdated.multiplier);
  assert.equal(byName('Jeska, Thrice Reborn / Tymna the Weaver'), undefined);
  assert.equal(byName('Rograkh, Son of Rohgahh / Tymna the Weaver'), undefined);
  assert.equal(krarkTymna, undefined);
  assert.ok(calculateStatsMultiplier(outdatedPartner, statsWeightConfig) < calculateStatsMultiplier(activePartner, statsWeightConfig));
  assert.ok(calculateStatsMultiplier(irrelevantPartner, statsWeightConfig) < calculateStatsMultiplier(outdatedPartner, statsWeightConfig));
});

test('dead outdated or low-relevance decks are pruned from the active pool', () => {
  const names = [
    'Breya, Etherium Shaper',
    'Cazur, Ruthless Stalker / Ukkima, Stalking Shadow',
    'Krark, the Thumbless / Silas Renn, Seeker Adept',
    'Krark, the Thumbless / Thrasios, Triton Hero',
    'Ishai, Ojutai Dragonspeaker / Krark, the Thumbless',
    'Xyris, the Writhing Storm',
  ];

  names.forEach((name) => {
    const commander = commanders.find((item) => item.name === name);

    assert.equal(commander, undefined, `${name} should be pruned from the active commander library`);
  });
});

test('banned dockside access tag is not used by data or recommendation logic', () => {
  const commanderSource = fs.readFileSync(path.join(root, 'miniprogram/config/commanders.js'), 'utf8');
  const tagSource = fs.readFileSync(path.join(root, 'miniprogram/utils/recommender/tags.js'), 'utf8');

  assert.doesNotMatch(commanderSource, /dockside_access/);
  assert.doesNotMatch(tagSource, /dockside_access/);
});

test('generic access elements do not masquerade as full resource engines', () => {
  const effectiveTags = buildEffectiveMatchTags({
    name: 'Access Only Temur Test',
    colorIdentity: 'URG',
    archetypeTags: ['Midrange'],
    matchTags: {},
    deckElements: ['red_breach', 'green_creature_mana', 'mana_engine'],
  });

  ['storm', 'spellChain', 'artifact', 'graveyard', 'combo', 'cradleReset'].forEach((tag) => {
    assert.equal(effectiveTags[tag] || 0, 0, `${tag} should require a real engine tag, not generic access`);
  });
});

test('Cradle reset requires explicit Cradle tags instead of broad green engine tags', () => {
  const broadGreenEngine = buildEffectiveMatchTags({
    name: 'Broad Green Engine Test',
    colorIdentity: 'G',
    matchTags: {},
    deckElements: ['green_creature_mana', 'green_mana_engine', 'mana_engine'],
  });
  const explicitCradleEngine = buildEffectiveMatchTags({
    name: 'Explicit Cradle Test',
    colorIdentity: 'URG',
    matchTags: {},
    deckElements: ['cradle_combo', 'temur_cradle'],
  });

  assert.equal(broadGreenEngine.cradleReset || 0, 0);
  assert.ok((broadGreenEngine.permanentEngine || 0) > 0);
  assert.ok((explicitCradleEngine.cradleReset || 0) >= 4);
});

test('irrelevant commanders cannot keep competitive questionnaire weight', () => {
  const effectiveTags = buildEffectiveMatchTags({
    name: 'Irrelevant Competitive Test',
    colorIdentity: 'URG',
    matchTags: { competitive: 5, combat: 3 },
    metaTags: ['irrelevant'],
    deckElements: ['irrelevant_meta', 'combat_damage'],
  });

  assert.equal(effectiveTags.competitive || 0, 0);
  assert.ok((effectiveTags.combat || 0) > 0);
});

test('Xyris is pruned instead of remaining as a near-perfect recommendation risk', () => {
  const profile = buildPreferenceProfile(questions, {
    speed: 'midrange',
    winCondition: 'combat',
    interaction: 'moderate',
    budget: 'medium',
    complexity: 'simple',
    colors: ['blue', 'red', 'green'],
    commanderDependency: 'low',
    partnerPreference: 'dislike',
    style: 'proactive',
    axis: 'flexibility',
    priority: 'fun',
    resourceEngine: ['permanentEngine'],
  });
  const recommendations = recommendCommanders(
    profile,
    commanders,
    commanders.length,
    dimensionLabels,
    costTierConfig,
    statsWeightConfig,
    matchingConfig,
  );
  const xyris = recommendations.find((commander) => commander.name === 'Xyris, the Writhing Storm');

  assert.equal(commanders.find((commander) => commander.name === 'Xyris, the Writhing Storm'), undefined);
  assert.equal(xyris, undefined);
  assert.notEqual(recommendations[0].name, 'Xyris, the Writhing Storm');
});

test('low-play partner shells can be auto-classified as irrelevant without tagging solo decks', () => {
  const config = {
    ...statsWeightConfig,
    conversionRate: { lowBelow: 0, lowMultiplier: 1 },
    playRate: {
      minEntries: 0,
      minMetaShare: 0,
      lowMultiplier: 1,
      highEntries: 999999,
      highMetaShare: 1,
      highMultiplier: 1,
      topEntries: 999999,
      topMetaShare: 1,
      topMultiplier: 1,
    },
    lowPlayPartner: { ...statsWeightConfig.lowPlayPartner, enabled: false },
    irrelevant: { ...statsWeightConfig.irrelevant, enabled: true },
  };
  const coldPartnerDeck = {
    name: 'Auto Fringe Partner A / Auto Fringe Partner B',
    sourceStats: { winRate: 0.2, entries: 20, metaShare: 0.0006 },
    deckElements: ['partner_shell'],
  };
  const coldSoloDeck = {
    name: 'Auto Fringe Solo',
    sourceStats: { winRate: 0.2, entries: 20, metaShare: 0.0006 },
    deckElements: ['solo_commander'],
  };

  assert.ok(calculateStatsMultiplier(coldPartnerDeck, config) < calculateStatsMultiplier(coldSoloDeck, config));
});

test('stats multiplier boosts decks with higher play count', () => {
  const normalPlayDeck = {
    sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
  };
  const highPlayDeck = {
    sourceStats: { winRate: 0.2, entries: 800, metaShare: 0.03 },
  };
  const topPlayDeck = {
    sourceStats: { winRate: 0.2, entries: 1800, metaShare: 0.06 },
  };

  assert.ok(calculateStatsMultiplier(highPlayDeck, statsWeightConfig) > calculateStatsMultiplier(normalPlayDeck, statsWeightConfig));
  assert.ok(calculateStatsMultiplier(highPlayDeck, statsWeightConfig) <= 1.05);
  assert.ok(calculateStatsMultiplier(topPlayDeck, statsWeightConfig) <= 1.08);
  assert.ok(statsWeightConfig.scoreInfluence <= 0.25);
});

test('recommendations rank low conversion or low play decks below equally matched strong decks', () => {
  const profile = { combo: 10 };
  const candidates = [
    {
      name: 'Low Conversion',
      colorIdentity: 'UB',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Low%20Conversion',
      sourceStats: { winRate: 0.08, entries: 120, metaShare: 0.006 },
    },
    {
      name: 'Low Play',
      colorIdentity: 'UB',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Low%20Play',
      sourceStats: { winRate: 0.2, entries: 20, metaShare: 0.0006 },
    },
    {
      name: 'Strong Baseline',
      colorIdentity: 'UB',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Strong%20Baseline',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
  ];

  const recommendations = recommendCommanders(profile, candidates, 3, dimensionLabels, costTierConfig, statsWeightConfig);

  assert.equal(recommendations[0].name, 'Strong Baseline');
  assert.ok(recommendations[0].score > recommendations[1].score);
  assert.ok(recommendations[0].score > recommendations[2].score);
});

test('recommendations rank high play decks above equally matched normal play decks', () => {
  const profile = { combo: 10 };
  const candidates = [
    {
      name: 'Normal Play',
      colorIdentity: 'UB',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Normal%20Play',
      sourceStats: { winRate: 0.2, entries: 120, metaShare: 0.006 },
    },
    {
      name: 'High Play',
      colorIdentity: 'UB',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/High%20Play',
      sourceStats: { winRate: 0.2, entries: 800, metaShare: 0.03 },
    },
  ];

  const recommendations = recommendCommanders(profile, candidates, 2, dimensionLabels, costTierConfig, statsWeightConfig);

  assert.equal(recommendations[0].name, 'High Play');
  assert.ok(recommendations[0].score > recommendations[1].score);
});

test('competitive priority strongly favors decks with both top play rate and top win rate', () => {
  const profile = buildPreferenceProfile(questions, {
    priority: 'competitive',
  });
  const candidates = [
    {
      name: 'Top Play And Top Win',
      colorIdentity: 'UB',
      matchTags: { competitive: 10, consistency: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Top%20Play%20And%20Top%20Win',
      sourceStats: { winRate: 0.22, entries: 650, metaShare: 0.02 },
    },
    {
      name: 'Top Play Only',
      colorIdentity: 'UB',
      matchTags: { competitive: 10, consistency: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Top%20Play%20Only',
      sourceStats: { winRate: 0.18, entries: 1800, metaShare: 0.06 },
    },
    {
      name: 'Top Win Only',
      colorIdentity: 'UB',
      matchTags: { competitive: 10, consistency: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Top%20Win%20Only',
      sourceStats: { winRate: 0.24, entries: 80, metaShare: 0.002 },
    },
  ];

  const recommendations = recommendCommanders(profile, candidates, 3, dimensionLabels, costTierConfig, statsWeightConfig);

  assert.equal(recommendations[0].name, 'Top Play And Top Win');
  assert.ok(recommendations[0].score > recommendations[1].score);
  assert.ok(recommendations[0].score > recommendations[2].score);
});

test('play rate cannot outrank a clearly better questionnaire fit', () => {
  const profile = { combo: 10 };
  const candidates = [
    {
      name: 'Better Fit Low Play',
      colorIdentity: 'UB',
      matchTags: { combo: 10 },
      edhtop16Url: 'https://edhtop16.com/commander/Better%20Fit%20Low%20Play',
      sourceStats: { winRate: 0.2, entries: 20, metaShare: 0.0006 },
    },
    {
      name: 'Worse Fit Top Play',
      colorIdentity: 'UB',
      matchTags: { combo: 9.5 },
      edhtop16Url: 'https://edhtop16.com/commander/Worse%20Fit%20Top%20Play',
      sourceStats: { winRate: 0.2, entries: 1800, metaShare: 0.06 },
    },
  ];

  const recommendations = recommendCommanders(profile, candidates, 2, dimensionLabels, costTierConfig, statsWeightConfig);

  assert.equal(recommendations[0].name, 'Better Fit Low Play');
  assert.ok(recommendations[0].fitScore > recommendations[1].fitScore);
});

test('recommendations reserve a tail slot for high-fit low-play diversity', () => {
  const profile = { combo: 10 };
  const candidates = [
    ['Hot 1', 10, 1800, 0.06],
    ['Hot 2', 9.9, 1500, 0.05],
    ['Hot 3', 9.8, 1300, 0.045],
    ['Hot 4', 9.7, 1000, 0.03],
    ['Hot 5', 9.6, 900, 0.025],
    ['Cold Flexible', 9.5, 20, 0.0006],
  ].map(([name, combo, entries, metaShare]) => ({
    name,
    colorIdentity: 'UB',
    matchTags: { combo },
    edhtop16Url: `https://edhtop16.com/commander/${encodeURIComponent(name)}`,
    sourceStats: { winRate: 0.2, entries, metaShare },
  }));

  const recommendations = recommendCommanders(profile, candidates, 5, dimensionLabels, costTierConfig, statsWeightConfig);

  assert.equal(recommendations.length, 5);
  assert.ok(recommendations.some((commander) => commander.name === 'Cold Flexible'));
  assert.equal(recommendations[recommendations.length - 1].name, 'Cold Flexible');
});

test('low-play diversity tail prioritizes cold solo decks over cold partner shells', () => {
  const profile = { combo: 10 };
  const candidates = [
    ['Hot 1', 10, 1800, 0.06, []],
    ['Hot 2', 9.9, 1500, 0.05, []],
    ['Hot 3', 9.8, 1300, 0.045, []],
    ['Hot 4', 9.7, 1000, 0.03, []],
    ['Hot 5', 9.6, 900, 0.025, []],
    ['Cold Partner A / Cold Partner B', 9.5, 20, 0.0006, ['partner_shell']],
    ['Cold Solo', 9.5, 20, 0.0006, ['solo_commander']],
  ].map(([name, combo, entries, metaShare, deckElements]) => ({
    name,
    colorIdentity: 'UB',
    matchTags: { combo },
    deckElements,
    edhtop16Url: `https://edhtop16.com/commander/${encodeURIComponent(name)}`,
    sourceStats: { winRate: 0.2, entries, metaShare },
  }));

  const recommendations = recommendCommanders(profile, candidates, 5, dimensionLabels, costTierConfig, statsWeightConfig);

  assert.equal(recommendations.length, 5);
  assert.ok(recommendations.some((commander) => commander.name === 'Cold Solo'));
  assert.equal(recommendations[recommendations.length - 1].name, 'Cold Solo');
  assert.equal(recommendations.some((commander) => commander.name === 'Cold Partner A / Cold Partner B'), false);
});

test('recommendations rank by fit and expose only score and link fields', () => {
  const answers = {};
  questions.forEach((question) => {
    answers[question.id] = question.type === 'multiple'
      ? [question.options[0].id, question.options[1].id]
      : question.options[0].id;
  });

  const profile = buildPreferenceProfile(questions, answers);
  const recommendations = recommendCommanders(profile, commanders, 5, dimensionLabels, costTierConfig, statsWeightConfig, matchingConfig);

  assert.equal(recommendations.length, 5);
  assert.ok(recommendations[0].score >= recommendations[recommendations.length - 1].score);
  recommendations.forEach((commander) => {
    assert.match(commander.fitLabel, /^契合度：\d+%$/);
    assert.match(commander.edhtop16Url, /^https:\/\/edhtop16\.com\/commander\//);
    assert.equal(Object.hasOwn(commander, 'costTierLabel'), false);
    assert.equal(Object.hasOwn(commander, 'reason'), false);
  });

  const fallback = recommendCommanders({ unheardPreference: 99 }, commanders, 5, dimensionLabels, costTierConfig);
  assert.equal(fallback.length, 5);
});

test('fit score display is calibrated so 90+ is reserved for only the strongest matches', () => {
  const profile = buildPreferenceProfile(questions, {
    speed: 'midrange',
    winCondition: 'combo',
    interaction: 'moderate',
    colors: ['blue', 'black'],
    priority: 'competitive',
    resourceEngine: ['spellChain', 'graveyard'],
  });
  const recommendations = recommendCommanders(
    profile,
    commanders,
    commanders.length,
    dimensionLabels,
    costTierConfig,
    statsWeightConfig,
    matchingConfig,
  );
  const overNinety = recommendations.filter((commander) => {
    const match = commander.fitLabel.match(/(\d+)%/);
    return match && Number(match[1]) >= 90;
  });

  assert.ok(overNinety.length <= Math.ceil(commanders.length * 0.05));
  assert.ok(overNinety.length >= 2);
});

test('displayed fit scores make the selected top recommendation clearly stand out', () => {
  const percentFrom = (commander) => Number(commander.fitLabel.match(/(\d+)%/)[1]);
  const scenarios = [
    {
      speed: 'midrange',
      winCondition: 'combo',
      interaction: 'moderate',
      colors: ['blue', 'black'],
      priority: 'competitive',
      resourceEngine: ['spellChain', 'graveyard'],
    },
    {
      speed: 'slowControl',
      winCondition: 'combo',
      interaction: 'stackControl',
      colors: ['blue', 'black'],
      commanderDependency: 'low',
      partnerPreference: 'dislike',
      style: 'lateGame',
      axis: 'flexibility',
      priority: 'competitive',
      resourceEngine: ['graveyard', 'enchantmentEngine'],
    },
  ];

  scenarios.forEach((answers) => {
    const recommendations = recommendCommanders(
      buildPreferenceProfile(questions, answers),
      commanders,
      5,
      dimensionLabels,
      costTierConfig,
      statsWeightConfig,
      matchingConfig,
    );
    const percents = recommendations.map(percentFrom);

    assert.equal(percents[0], 100);
    assert.ok(percents[1] <= 94, `second place should not look almost tied: ${percents.join(', ')}`);
    assert.ok(percents[0] - percents[4] >= 10, `top five needs visible spread: ${percents.join(', ')}`);
    assert.ok(percents.filter((percent) => percent >= 95).length <= 1, `95+ should be rare in the visible result: ${percents.join(', ')}`);
  });
});

test('formatFitScore uses a strict top-band curve instead of linear top normalization', () => {
  const calibration = { ninetyThreshold: 80, topBandExponent: 14 };

  assert.equal(formatFitScore(0, 100, calibration), '契合度：0%');
  assert.equal(formatFitScore(40, 100, calibration), '契合度：45%');
  assert.equal(formatFitScore(80, 100, calibration), '契合度：90%');
  assert.equal(formatFitScore(90, 100, calibration), '契合度：90%');
  assert.equal(formatFitScore(98, 100, calibration), '契合度：92%');
  assert.equal(formatFitScore(150, 100, calibration), '契合度：100%');
});

test('recommendation logic is split into focused modules behind the existing facade', () => {
  const moduleRoot = path.join(root, 'miniprogram/utils/recommender');
  [
    'profile.js',
    'tags.js',
    'stats.js',
    'ranking.js',
  ].forEach((file) => {
    assert.ok(fs.existsSync(path.join(moduleRoot, file)), `${file} should exist`);
  });

  const facade = fs.readFileSync(path.join(root, 'miniprogram/utils/recommender.js'), 'utf8');
  assert.match(facade, /require\('\.\/recommender\/profile'\)/);
  assert.match(facade, /require\('\.\/recommender\/tags'\)/);
  assert.match(facade, /require\('\.\/recommender\/stats'\)/);
  assert.match(facade, /require\('\.\/recommender\/ranking'\)/);
  assert.ok(facade.split('\n').length < 90, 'recommender facade should stay small');
});
