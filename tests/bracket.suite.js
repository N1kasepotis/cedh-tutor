const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseBracketDeck,
  buildDeckMetrics,
  evaluateBracket,
  buildBracketSummary,
  analyzeBracketDeck,
} = require('../miniprogram/utils/bracket');
const {
  BRACKET_MANIFEST,
  BRACKET_LABELS,
  GAME_CHANGERS,
  BANNED_CARDS,
  SIGNAL_GROUPS,
  TOP_COMBO_FAMILIES,
  KNOWN_COMBOS,
  COMBO_PATTERNS,
} = require('../miniprogram/config/bracket-data');

const root = path.join(__dirname, '..');

function analyze(lines, options = {}) {
  return analyzeBracketDeck(lines.join('\n'), options).result;
}

function makeMetadata(entries) {
  const byName = {};
  entries.forEach((entry) => {
    const typeLine = entry.typeLine || 'Creature';
    byName[entry.name.toLowerCase()] = {
      name: entry.name,
      cmc: entry.cmc,
      typeLine,
      frontTypeLine: entry.frontTypeLine || typeLine.split(' // ')[0],
      ...(Object.prototype.hasOwnProperty.call(entry, 'strengthFeatures')
        ? { strengthFeatures: entry.strengthFeatures }
        : {}),
      usd: Object.prototype.hasOwnProperty.call(entry, 'usd') ? entry.usd : null,
    };
  });
  return {
    byName,
    requestedCount: entries.length,
    resolvedCount: entries.length,
    notFoundCount: 0,
    failedLookupCount: 0,
    failedBatchCount: 0,
    available: entries.length > 0,
  };
}

test('Bracket parser keeps every meaningful line and never guesses a commander', () => {
  const plain = parseBracketDeck('1 Sol Ring\n1 Command Tower');
  assert.equal(plain.cards.length, 2);
  assert.equal(plain.commanders.length, 0);
  assert.ok(plain.issues.some((issue) => issue.code === 'MISSING_COMMANDER_SECTION'));

  const parsed = parseBracketDeck([
    'Commander:',
    '1 Kinnan, Bonder Prodigy',
    'Creatures (12)',
    '1 Sol Ring',
    '0 Invalid Quantity',
    'Mystery Zone:',
    'Sideboard',
    '1 Fierce Guardianship',
  ].join('\n'));

  assert.deepEqual(parsed.commanders.map((card) => card.name), ['Kinnan, Bonder Prodigy']);
  assert.deepEqual(parsed.cards.map((card) => card.name), ['Kinnan, Bonder Prodigy', 'Sol Ring']);
  assert.equal(parsed.cards[1].section, 'main');
  assert.ok(parsed.issues.some((issue) => issue.code === 'INVALID_QUANTITY' && issue.line === 5));
  assert.ok(parsed.issues.some((issue) => issue.code === 'UNKNOWN_SECTION' && issue.line === 6));
  assert.deepEqual(parsed.ignored.map((line) => line.raw), ['1 Fierce Guardianship']);

  const customGroups = parseBracketDeck([
    'Commander',
    '1 Bear Cub',
    'Ramp (10)',
    '1 Kinnan, Bonder Prodigy',
    'Removal / Interaction:',
    '1 Swords to Plowshares',
  ].join('\n'));
  assert.deepEqual(customGroups.commanders.map((card) => card.name), ['Bear Cub']);
  assert.ok(customGroups.issues.filter((issue) => issue.code === 'UNKNOWN_SECTION').length === 2);
  assert.ok(customGroups.cards.slice(1).every((card) => card.section === 'main'));

  const commentedGroups = parseBracketDeck([
    '// Commander',
    '1 Bear Cub',
    '// Ramp',
    '1 Sol Ring',
    '// Creatures',
    '1 Llanowar Elves',
  ].join('\n'));
  assert.deepEqual(commentedGroups.commanders.map((card) => card.name), ['Bear Cub']);
  assert.equal(commentedGroups.cards[1].section, 'main');
  assert.equal(commentedGroups.cards[2].section, 'main');
  assert.ok(commentedGroups.issues.some((issue) => issue.code === 'UNKNOWN_SECTION'));

  const metadataWithoutQuantity = parseBracketDeck('Farewell (NEO) 13');
  assert.equal(metadataWithoutQuantity.cards[0].name, 'Farewell');
});

test('Bracket import matches playtest blank-line commander and Partners separation', () => {
  const singleText = [
    ...Array.from({ length: 99 }, () => '1 Forest'),
    '',
    '1 Kinnan, Bonder Prodigy',
  ].join('\n');
  const single = parseBracketDeck(singleText);
  assert.deepEqual(single.commanders.map((card) => card.name), ['Kinnan, Bonder Prodigy']);
  assert.equal(single.cards[0].section, 'main');
  assert.equal(single.hasCommanderSection, true);
  assert.ok(!single.issues.some((issue) => issue.code === 'MISSING_COMMANDER_SECTION'));
  const singleResult = analyzeBracketDeck(singleText).result;
  assert.equal(singleResult.deckCardCount, 100);
  assert.equal(singleResult.confidence, 'medium');

  const partners = parseBracketDeck([
    '1 Forest',
    '',
    '',
    '1 Tymna the Weaver',
    "1 Kraum, Ludevic's Opus",
  ].join('\n'));
  assert.deepEqual(partners.commanders.map((card) => card.name), [
    'Tymna the Weaver',
    "Kraum, Ludevic's Opus",
  ]);

  const leadingBlank = parseBracketDeck('\n\n1 Forest\n1 Sol Ring');
  assert.equal(leadingBlank.commanders.length, 0);

  const explicitWins = parseBracketDeck('Deck\n1 Forest\n\n1 Kinnan, Bonder Prodigy');
  assert.equal(explicitWins.commanders.length, 0);
  assert.ok(explicitWins.cards.every((card) => card.section === 'main'));

  const aliases = parseBracketDeck('Command\n1 Bear Cub\nCards\n1 Forest');
  assert.deepEqual(aliases.commanders.map((card) => card.name), ['Bear Cub']);
  assert.deepEqual(aliases.cards.slice(1).map((card) => card.section), ['main']);

  const tooMany = parseBracketDeck('1 Forest\n\n1 Bear Cub\n1 Isamaru, Hound of Konda\n1 Ragavan, Nimble Pilferer');
  assert.ok(tooMany.issues.some((issue) => issue.code === 'COMMANDER_COUNT_UNUSUAL'));
});

test('Game Changers use the February 2026 snapshot and normalize curved apostrophes', () => {
  assert.equal(GAME_CHANGERS.length, 53);
  assert.ok(GAME_CHANGERS.includes('Farewell'));
  assert.ok(GAME_CHANGERS.includes('Biorhythm'));
  assert.ok(!GAME_CHANGERS.includes('Food Chain'));
  assert.ok(!GAME_CHANGERS.includes('Deflecting Swat'));
  assert.ok(!GAME_CHANGERS.includes('Expropriate'));

  const result = analyze([
    'Deck',
    '1 Gaea’s Cradle (USG) 321',
    '1 Farewell',
    '1 Biorhythm',
    '1 Food Chain',
    '1 Deflecting Swat',
    '1 Expropriate',
  ]);
  assert.deepEqual(result.gameChangers, ['Biorhythm', 'Farewell', "Gaea's Cradle"]);
  assert.equal(result.floorBracket, 3);
});

test('Efficient win conditions are distinct from resource engines without duplicate signal credit', () => {
  const winConditions = SIGNAL_GROUPS.efficientWinCondition;
  assert.equal(winConditions.label, '高效制胜');
  assert.deepEqual(winConditions.cards, [
    'Underworld Breach',
    'Laboratory Maniac',
    'Bloodchief Ascension',
    "Thassa's Oracle",
    'Brain Freeze',
  ]);
  assert.ok(!SIGNAL_GROUPS.engine.cards.includes('Underworld Breach'));

  winConditions.cards.forEach((card) => {
    const memberships = Object.entries(SIGNAL_GROUPS)
      .filter(([, group]) => group.cards.includes(card))
      .map(([key]) => key);
    assert.deepEqual(memberships, ['efficientWinCondition']);
  });

  const classified = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '1 Underworld Breach',
    '1 Laboratory Maniac',
    '1 Bloodchief Ascension',
    '96 Forest',
  ]);
  const winConditionSignal = classified.signals.find((signal) => signal.key === 'efficientWinCondition');
  assert.equal(winConditionSignal.count, 3);
  assert.ok(!classified.signals.some((signal) => signal.key === 'engine'));
  assert.equal(classified.structuralStrengthBracket, 3, 'the category is one B3 axis, not a standalone B4 trigger');
  assert.equal(classified.assignedBracket, 3);

  const breachOnly = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '1 Underworld Breach',
    '98 Forest',
  ]);
  assert.equal(breachOnly.floorBracket, 3, 'Underworld Breach remains a Game Changer');
  assert.equal(breachOnly.structuralStrengthBracket, 1, 'one win condition does not create a strength axis');
  assert.equal(breachOnly.assignedBracket, 3);
  assert.doesNotMatch(buildBracketSummary(breachOnly), /高效制胜/);

  ['Laboratory Maniac', 'Bloodchief Ascension'].forEach((card) => {
    const isolated = analyze([
      'Commander',
      '1 Bear Cub',
      'Deck',
      `1 ${card}`,
      '98 Forest',
    ]);
    assert.equal(isolated.floorBracket, 1, `${card} alone has no hard floor`);
    assert.equal(isolated.assignedBracket, 1, `${card} alone does not raise the recommendation`);
  });

  const winConditionPair = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '1 Laboratory Maniac',
    '1 Bloodchief Ascension',
    '97 Forest',
  ]);
  assert.equal(winConditionPair.structuralStrengthBracket, 3);
  assert.equal(winConditionPair.assignedBracket, 3);

  const mixedThresholds = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '1 Dark Ritual',
    '1 Culling the Weak',
    '1 Laboratory Maniac',
    '96 Forest',
  ]);
  assert.deepEqual(
    mixedThresholds.contributingSignals.map((signal) => signal.key),
    ['fastMana'],
    'only axes that meet their own threshold are exposed as contributing evidence',
  );
  const mixedStrengthEvidence = mixedThresholds.evidence
    .filter((item) => item.kind === 'strength')
    .map((item) => `${item.title} ${item.detail}`)
    .join('\n');
  assert.match(mixedStrengthEvidence, /快速法术力 2/);
  assert.doesNotMatch(mixedStrengthEvidence, /高效制胜/);
  const mixedSummary = buildBracketSummary(mixedThresholds);
  assert.match(mixedSummary, /快速法术力/);
  assert.doesNotMatch(mixedSummary, /高效制胜/);

  const metadataResult = makeMetadata(winConditions.cards.map((name) => ({
    name,
    cmc: 2,
    strengthFeatures: {
      known: true,
      nonland: true,
      lowCostCardFlow: true,
    },
  })));
  const excludedFromFlow = analyze([
    'Deck',
    '1 Underworld Breach',
    '1 Laboratory Maniac',
    '1 Bloodchief Ascension',
  ], { metadataResult });
  assert.equal(excludedFromFlow.efficiencyProfile.cardFlowCount, 0, 'the same cards cannot also earn low-cost card-flow credit');
});

test('Known combo matching is exact, order-independent, and never fires on a partial package', () => {
  assert.ok(KNOWN_COMBOS.length >= 30);
  assert.ok(KNOWN_COMBOS.every((combo) => Number.isInteger(combo.recommendedBracket)));
  assert.ok(KNOWN_COMBOS.every((combo) => !Object.prototype.hasOwnProperty.call(combo, 'minimumBracket')));
  const present = analyze([
    'Deck',
    '1 Demonic Consultation',
    "1 Thassa's Oracle",
  ]);
  assert.ok(present.detectedCombos.some((combo) => combo.id === 'thoracle-consult'));
  assert.equal(present.floorBracket, 4);

  const legacyOption = analyze([
    'Deck',
    '1 Demonic Consultation',
    "1 Thassa's Oracle",
  ], { comboIntent: false });
  assert.equal(legacyOption.floorBracket, 4, 'manual combo intent is ignored; exact complete combos are automatic');

  const partial = analyze(['Deck', "1 Thassa's Oracle"]);
  assert.equal(partial.detectedCombos.length, 0);

  const setupPair = analyze(['Deck', '1 Exquisite Blood', '1 Sanguine Bond']);
  assert.equal(setupPair.floorBracket, 2, 'a non-early two-card loop only violates the B1 hard baseline');
  assert.equal(setupPair.assignedBracket, 3, 'the combo still raises the qualitative recommendation');

  const bloodchiefPair = analyze(['Deck', '1 Bloodchief Ascension', '1 Mindcrank']);
  assert.ok(bloodchiefPair.detectedCombos.some((combo) => combo.id === 'bloodchief-mindcrank'));
  assert.equal(bloodchiefPair.floorBracket, 2);
  assert.equal(bloodchiefPair.assignedBracket, 3);

  const threeCardPackage = analyze([
    'Deck',
    '1 Underworld Breach',
    "1 Lion's Eye Diamond",
    '1 Brain Freeze',
  ]);
  assert.equal(threeCardPackage.floorBracket, 3, 'the three-card package has no two-card hard violation; its two Game Changers create B3 floor');
  assert.equal(threeCardPackage.assignedBracket, 4);
});

test('Top 15 combo data is ranked, uniquely identified, and every exact variant belongs to a family', () => {
  assert.equal(TOP_COMBO_FAMILIES.length, 15);
  assert.deepEqual(TOP_COMBO_FAMILIES.map((family) => family.rank),
    Array.from({ length: 15 }, (_, index) => index + 1));
  assert.equal(new Set(TOP_COMBO_FAMILIES.map((family) => family.familyId)).size, 15);
  assert.deepEqual(TOP_COMBO_FAMILIES.map((family) => family.familyId), [
    'thoracle',
    'breach-led',
    'kinnan-basalt',
    'dualcaster-copy',
    'food-chain',
    'floodcaller-bounce',
    'sisay-emiel-derevi',
    'devoted-druid',
    'dargo-loop',
    'scepter-reversal',
    'magda-clock',
    'tivit-sieve',
    'malcolm-glint-horn',
    'vivi-quicksilver',
    'kitten-teferi-amber',
  ]);
  assert.ok(KNOWN_COMBOS.every((combo) => combo.familyId));
  assert.ok(COMBO_PATTERNS.every((pattern) => pattern.familyId));
  assert.ok(COMBO_PATTERNS.some((pattern) => pattern.countsAsCompleteFamily));
  assert.ok(COMBO_PATTERNS.some((pattern) => pattern.kind === 'pattern'));
  assert.ok(COMBO_PATTERNS.some((pattern) => pattern.kind === 'engine'));
});

test('Combo variants collapse to one family before evidence and strength are counted', () => {
  const oracle = analyze([
    'Deck',
    "1 Thassa's Oracle",
    '1 Demonic Consultation',
    '1 Tainted Pact',
  ]);
  assert.equal(oracle.detectedCombos.length, 2);
  assert.deepEqual(oracle.detectedComboFamilies.map((family) => family.familyId), ['thoracle']);
  assert.deepEqual(oracle.detectedComboFamilies[0].matchedVariantIds.sort(), ['thoracle-consult', 'thoracle-pact']);
  assert.equal(oracle.evidence.filter((item) => item.code === 'COMBO_FAMILY_THORACLE').length, 1);

  const foodChain = analyze([
    'Deck',
    '1 Food Chain',
    '1 Squee, the Immortal',
    '1 Eternal Scourge',
    '1 Misthollow Griffin',
  ]);
  assert.equal(foodChain.detectedCombos.length, 3);
  assert.deepEqual(foodChain.detectedComboFamilies.map((family) => family.familyId), ['food-chain']);
  assert.equal(foodChain.structuralStrengthBracket, 3, 'three variants of one family are still one B3 family');
  assert.equal(foodChain.evidence.filter((item) => item.code === 'COMBO_FAMILY_FOOD_CHAIN').length, 1);

  const twoFamilies = analyze([
    'Deck',
    '1 Food Chain',
    '1 Squee, the Immortal',
    '1 Isochron Scepter',
    '1 Dramatic Reversal',
  ]);
  assert.deepEqual(twoFamilies.detectedComboFamilies.map((family) => family.familyId), [
    'food-chain',
    'scepter-reversal',
  ]);
  assert.equal(twoFamilies.structuralStrengthBracket, 4, 'two different complete families create B4 structural density');

  const dualcaster = analyze([
    'Deck',
    '1 Dualcaster Mage',
    '1 Twinflame',
    '1 Heat Shimmer',
    '1 Molten Duplication',
  ]);
  assert.equal(dualcaster.detectedCombos.length, 3);
  assert.deepEqual(dualcaster.detectedComboFamilies.map((family) => family.familyId), ['dualcaster-copy']);
  assert.equal(dualcaster.floorBracket, 4);

  const worldgorger = analyze([
    'Deck',
    '1 Worldgorger Dragon',
    '1 Animate Dead',
    '1 Dance of the Dead',
    '1 Necromancy',
  ]);
  assert.equal(worldgorger.detectedCombos.length, 3);
  assert.deepEqual(worldgorger.detectedComboFamilies.map((family) => family.familyId), ['worldgorger']);
  assert.equal(worldgorger.structuralStrengthBracket, 3);
});

test('Contextual win cards require their complete family and extra conditions', () => {
  const ordinaryOutlets = analyze([
    'Deck',
    '1 Orcish Bowmasters',
    '1 Lightning Bolt',
    '1 Mount Doom',
    '1 Finale of Devastation',
    '1 Walking Ballista',
    '1 Dualcaster Mage',
    '1 Etali, Primal Conqueror',
    '1 Altar of Dementia',
    '1 Goblin Bombardment',
    '1 Mayhem Devil',
    '1 Aetherflux Reservoir',
    '1 Twinshot Sniper',
    '1 Tivit, Seller of Secrets',
    '1 Glint-Horn Buccaneer',
    '1 Vivi Ornitier',
  ]);
  assert.deepEqual(ordinaryOutlets.contextualWinConditions, []);
  assert.ok(!ordinaryOutlets.signals.some((signal) => signal.key === 'efficientWinCondition'));

  const cases = [
    {
      name: 'Kinnan Finale',
      lines: ['Deck', '1 Kinnan, Bonder Prodigy', '1 Basalt Monolith', '1 Finale of Devastation'],
      expected: 'Finale of Devastation',
    },
    {
      name: 'Dualcaster',
      lines: ['Deck', '1 Dualcaster Mage', '1 Twinflame'],
      expected: 'Dualcaster Mage',
    },
    {
      name: 'Food Chain Etali commander',
      lines: ['Commander', '1 Etali, Primal Conqueror', 'Deck', '1 Food Chain', '1 Squee, the Immortal'],
      expected: 'Etali, Primal Conqueror',
    },
    {
      name: 'Floodcaller Reservoir',
      lines: ['Deck', '1 Valley Floodcaller', '1 Retraction Helix', '1 Sol Ring', '1 Aetherflux Reservoir'],
      expected: 'Aetherflux Reservoir',
    },
    {
      name: 'Sisay Mount Doom',
      lines: ['Deck', '1 Sisay, Weatherlight Captain', '1 Emiel the Blessed', '1 Derevi, Empyrial Tactician', '1 Bloom Tender', '1 Mount Doom'],
      expected: 'Mount Doom',
    },
    {
      name: 'Devoted Druid Ballista',
      lines: ['Deck', '1 Devoted Druid', '1 Swift Reconfiguration', '1 Walking Ballista'],
      expected: 'Walking Ballista',
    },
    {
      name: 'Dargo Mayhem Devil',
      lines: ['Commander', '1 Dargo, the Shipwrecker', 'Deck', '1 Birgi, God of Storytelling', '1 Goblin Bombardment', '1 Mayhem Devil'],
      expected: 'Mayhem Devil',
    },
    {
      name: 'Scepter Ballista with mana',
      lines: ['Deck', '1 Isochron Scepter', '1 Dramatic Reversal', '1 Sol Ring', '1 Mana Vault', '1 Walking Ballista'],
      expected: 'Walking Ballista',
    },
    {
      name: 'Magda Twinshot recovery chain',
      lines: ['Deck', '1 Magda, Brazen Outlaw', '1 Clock of Omens', '1 Barkform Harvester', '1 The One Ring', '1 Sculpting Steel', '1 Twinshot Sniper'],
      expected: 'Twinshot Sniper',
    },
    {
      name: 'Tivit',
      lines: ['Deck', '1 Tivit, Seller of Secrets', '1 Time Sieve'],
      expected: 'Tivit, Seller of Secrets',
    },
    {
      name: 'Malcolm',
      lines: ['Deck', '1 Malcolm, Keen-Eyed Navigator', '1 Glint-Horn Buccaneer'],
      expected: 'Glint-Horn Buccaneer',
    },
    {
      name: 'Vivi with draw link',
      lines: ['Deck', '1 Vivi Ornitier', '1 Quicksilver Elemental', '1 Curiosity'],
      expected: 'Vivi Ornitier',
    },
    {
      name: 'Kitten Reservoir',
      lines: ['Deck', '1 Displacer Kitten', '1 Teferi, Time Raveler', '1 Mox Amber', '1 Aetherflux Reservoir'],
      expected: 'Aetherflux Reservoir',
    },
  ];
  cases.forEach((entry) => {
    const result = analyze(entry.lines);
    assert.ok(result.contextualWinConditions.includes(entry.expected), entry.name);
    const signal = result.signals.find((item) => item.key === 'efficientWinCondition');
    assert.ok(signal && signal.cards.includes(entry.expected), entry.name);
  });

  const foodChainMainDeckEtali = analyze([
    'Deck',
    '1 Food Chain',
    '1 Squee, the Immortal',
    '1 Etali, Primal Conqueror',
  ]);
  assert.ok(!foodChainMainDeckEtali.contextualWinConditions.includes('Etali, Primal Conqueror'));

  const scepterWithoutMana = analyze([
    'Deck',
    '1 Isochron Scepter',
    '1 Dramatic Reversal',
    '1 Walking Ballista',
  ]);
  assert.ok(!scepterWithoutMana.contextualWinConditions.includes('Walking Ballista'));

  const magdaWithoutRecovery = analyze([
    'Deck',
    '1 Magda, Brazen Outlaw',
    '1 Clock of Omens',
    '1 Universal Automaton',
    '1 Lightning Bolt',
    '1 Twinshot Sniper',
  ]);
  assert.deepEqual(magdaWithoutRecovery.contextualWinConditions, []);
});

test('Variable-component combo patterns are recognized conservatively without inflating family count', () => {
  const cases = [
    {
      id: 'hullbreaker-repeatable-artifacts',
      lines: ['Deck', '1 Hullbreaker Horror', '1 Mox Amber', '1 Sol Ring'],
    },
    {
      id: 'lumra-land-recursion',
      lines: ['Commander', '1 Lumra, Bellow of the Woods', 'Deck', '1 Lotus Cobra', '1 Altar of Dementia', '1 Misty Rainforest', '1 Verdant Catacombs'],
    },
    {
      id: 'tayam-role-loop',
      lines: ['Commander', '1 Tayam, Luminous Enigma', 'Deck', '1 Devoted Druid', "1 Ashnod's Altar", '1 Hapatra, Vizier of Poisons'],
    },
    {
      id: 'protean-hulk-pile',
      lines: ['Deck', '1 Protean Hulk', '1 Viscera Seer', '1 Karmic Guide', '1 Reveillark'],
    },
    {
      id: 'doomsday-pile',
      lines: ['Deck', '1 Doomsday', '1 Gush', '1 Street Wraith'],
    },
    {
      id: 'arcum-ring-mind-over-matter',
      lines: ['Commander', '1 Arcum Dagsson', 'Deck', '1 The One Ring', '1 Mind Over Matter'],
    },
  ];
  cases.forEach((entry) => {
    const result = analyze(entry.lines);
    assert.ok(result.detectedComboPatterns.some((pattern) => pattern.id === entry.id), entry.id);
    assert.equal(result.detectedComboFamilies.length, 0, `${entry.id} is not a fixed Top 15 family`);
  });

  const twoPatterns = analyze([
    'Deck',
    '1 Hullbreaker Horror',
    '1 Mox Amber',
    '1 Sol Ring',
    '1 Doomsday',
    '1 Gush',
    '1 Street Wraith',
  ]);
  assert.equal(twoPatterns.detectedComboPatterns.length, 2);
  assert.equal(twoPatterns.structuralStrengthBracket, 3, 'two broad patterns do not imitate two exact families');

  const hullbreakerPartial = analyze(['Deck', '1 Hullbreaker Horror', '1 Sol Ring']);
  assert.equal(hullbreakerPartial.detectedComboPatterns.length, 0);

  const dargoOutsideCommandZone = analyze([
    'Deck',
    '1 Dargo, the Shipwrecker',
    '1 Birgi, God of Storytelling',
    '1 Goblin Bombardment',
  ]);
  assert.ok(!dargoOutsideCommandZone.detectedComboFamilies.some((family) => family.familyId === 'dargo-loop'));
});

test('Combo assembly mana value grades speed objectively and feeds the early-combo B5 condition', () => {
  const {
    comboSpeedTier,
    isEarlyCombo,
  } = require('../miniprogram/utils/bracket');
  const objectiveDeck = [
    'Commander',
    '1 Test Commander',
    'Deck',
    '1 Isochron Scepter',
    '1 Dramatic Reversal',
    '1 Chrome Mox',
    '1 Mox Diamond',
    '1 Mana Vault',
    '1 Demonic Tutor',
    '1 Vampiric Tutor',
    '1 Mystical Tutor',
    '1 Force of Will',
    '1 Fierce Guardianship',
    '89 Forest',
  ];

  const slow = analyze(objectiveDeck, {
    metadataResult: makeMetadata([
      { name: 'Isochron Scepter', cmc: 2, typeLine: 'Artifact' },
      { name: 'Dramatic Reversal', cmc: 3, typeLine: 'Instant' },
    ]),
  });
  const slowFamily = slow.detectedComboFamilies.find((family) => family.familyId === 'scepter-reversal');
  assert.ok(slowFamily, 'Scepter + Reversal 家族应被识别');
  assert.notEqual(slowFamily.speed, 'early', '该家族无人工 early 标注，速度只能来自客观装配成本');
  assert.equal(slowFamily.assemblyManaValue, 5);
  assert.equal(slowFamily.assemblySpeed, 3);
  assert.ok(slow.assignedBracket < 5, '合计 5 费（速度 3）不构成早期组合技，不应触发 B5');
  assert.ok(slow.evidence.some((item) => item.code === 'COMBO_FAMILY_SCEPTER_REVERSAL'
    && item.detail.startsWith('检测到完整')
    && item.detail.includes('条件型无限法术力')
    && item.detail.includes('启动法术力 2+3')
    && !item.detail.includes('前期即可启动')
    && !item.detail.includes('全套法术力值合计')));

  const fast = analyze(objectiveDeck, {
    metadataResult: makeMetadata([
      { name: 'Isochron Scepter', cmc: 2, typeLine: 'Artifact' },
      { name: 'Dramatic Reversal', cmc: 2, typeLine: 'Instant' },
    ]),
  });
  const fastFamily = fast.detectedComboFamilies.find((family) => family.familyId === 'scepter-reversal');
  assert.equal(fastFamily.assemblyManaValue, 4);
  assert.equal(fastFamily.assemblySpeed, 4);
  assert.equal(fast.competitivePromoted, true, '合计 ≤4 费的客观早期组合技联动竞技特征触发升档');
  assert.equal(fast.assignedBracket, 4.5, '刚达竞技阈值且零余量的牌表归 B4.5，不再直接进入 B5');
  assert.ok(fast.evidence.some((item) => item.code === 'COMPETITIVE_SIGNAL_DENSITY'));
  assert.ok(fast.evidence.some((item) => item.code === 'COMBO_FAMILY_SCEPTER_REVERSAL'
    && item.detail.includes('启动法术力 2+2')
    && !item.detail.includes('前期即可启动')));

  const offline = analyze(objectiveDeck);
  const offlineFamily = offline.detectedComboFamilies.find((family) => family.familyId === 'scepter-reversal');
  assert.equal(offlineFamily.assemblyManaValue, undefined, '无元数据时不产生装配字段');
  assert.ok(offline.evidence.every((item) => !item.detail.includes('启动法术力')), '离线路径无元数据，不显示启动法术力');
  assert.ok(offline.assignedBracket < 5, '离线时该家族不因客观速度进入 B5');

  assert.equal(comboSpeedTier(0), 5);
  assert.equal(comboSpeedTier(4), 4);
  assert.equal(comboSpeedTier(6), 3);
  assert.equal(comboSpeedTier(8), 2);
  assert.equal(comboSpeedTier(9), 1);
  assert.equal(comboSpeedTier(-1), null);
  assert.equal(isEarlyCombo({ speed: 'early' }), true, '人工标注仍是离线兜底');
  assert.equal(isEarlyCombo({ speed: 'setup', assemblySpeed: 4 }), true);
  assert.equal(isEarlyCombo({ speed: 'setup', assemblySpeed: 3 }), false);
});

test('Pattern combo assembly cost is the minimal recipe, not the sum of every redundant option', () => {
  // Magda + Clock of Omens 只需 3 张成套（Magda + Clock + 一件神器生物），
  // 牌表里的 7 个可选神器矮人是冗余，不应把它们全部加进装配成本（旧 bug 得 23）
  const dwarves = ['Universal Automaton', 'Metallic Mimic', 'Adaptive Automaton',
    'Roaming Throne', 'Barkform Harvester', 'Three Tree Mascot', 'Mirror of the Forebears'];
  const lines = [
    'Commander', '1 Magda, Brazen Outlaw', 'Deck',
    '1 Clock of Omens', ...dwarves.map((name) => `1 ${name}`),
    `${99 - dwarves.length - 1} Mountain`,
  ];
  const parsed = parseBracketDeck(lines.join('\n'));
  const manaValues = {
    'magda, brazen outlaw': 3, 'clock of omens': 4, 'universal automaton': 1,
    'metallic mimic': 2, 'adaptive automaton': 3, 'roaming throne': 4,
    'barkform harvester': 4, 'three tree mascot': 2, 'mirror of the forebears': 3,
  };
  const metadataResult = makeMetadata(Array.from(new Set(parsed.cards.map((card) => card.name)))
    .map((name) => ({
      name,
      cmc: Object.prototype.hasOwnProperty.call(manaValues, name.toLowerCase())
        ? manaValues[name.toLowerCase()] : 5,
      typeLine: 'Artifact',
    })));
  const magda = evaluateBracket(parsed, { metadataResult });
  const family = magda.detectedComboFamilies.find((item) => item.familyId === 'magda-clock');
  assert.ok(family, 'Magda + Clock 家族应被识别');
  // Magda 3 + Clock 4 + 最便宜的神器矮人 Universal Automaton 1 = 8，绝非 3+4+全部矮人 = 23
  assert.equal(family.assemblyManaValue, 8, '装配成本取最小成套（固定件 + 每个可选组最便宜一张）');
  assert.ok(family.assemblyManaValue < 23, '不再把所有冗余可选件加进合计');
  const evidence = magda.evidence.find((item) => item.code === 'COMBO_FAMILY_MAGDA_CLOCK');
  // 启动法术力明细：Magda 3 + Clock 4 + 最便宜矮人 1，只 3 件成套，不含冗余 → 「3+4+1」而非 23
  assert.ok(evidence.detail.startsWith('检测到完整'));
  assert.ok(evidence.detail.includes('无限珍宝'));
  assert.ok(evidence.detail.includes('启动法术力 3+4+1'));
  assert.ok(!evidence.detail.includes('23'));
  assert.ok(!evidence.detail.includes('前期即可启动'));

  // 换掉 Universal Automaton（1 费）后，剩下最便宜的可选件是 Three Tree Mascot（2 费）→ 3+4+2 = 9
  const lines2 = lines.filter((line) => line !== '1 Universal Automaton');
  const parsed2 = parseBracketDeck(lines2.join('\n'));
  const magda2 = evaluateBracket(parsed2, { metadataResult });
  const family2 = magda2.detectedComboFamilies.find((item) => item.familyId === 'magda-clock');
  assert.equal(family2.assemblyManaValue, 9, '可选组取当前命中里最便宜的一张，随牌表变化');
  assert.deepEqual(family2.assemblyBreakdown, [3, 4, 2], '启动法术力明细随最便宜可选件变化');
});

test('Price never subdivides the competitive verdict once the 500 dollar budget line is removed', () => {
  // 越过 B5 基准的完整竞技结构：快速法术力 6、高效导师 6、免费互动 4
  const cedhLines = [
    'Commander',
    '1 Kinnan, Bonder Prodigy',
    'Deck',
    '1 Chrome Mox',
    '1 Mox Diamond',
    '1 Mana Vault',
    '1 Dark Ritual',
    '1 Cabal Ritual',
    '1 Lotus Petal',
    '1 Demonic Tutor',
    '1 Vampiric Tutor',
    '1 Mystical Tutor',
    '1 Demonic Consultation',
    '1 Diabolic Intent',
    '1 Wishclaw Talisman',
    '1 Force of Will',
    '1 Fierce Guardianship',
    '1 Pact of Negation',
    '1 Mental Misstep',
    "1 Thassa's Oracle",
    '82 Midrange Filler',
  ];
  const parsedNames = Array.from(new Set(
    parseBracketDeck(cedhLines.join('\n')).cards.map((card) => card.name),
  ));
  const priceMetadata = (usd) => makeMetadata(parsedNames.map((name) => ({
    name,
    cmc: 2,
    usd,
    typeLine: 'Creature',
  })));

  // 极便宜的完整竞技牌表仍是 B5——预算线已删除，造价不再细分档位
  const cheap = analyze(cedhLines, { metadataResult: priceMetadata(1) });
  assert.equal(cheap.assignedBracket, 5, '$1/张的竞技牌表不再因低造价降为 B4.5');
  assert.equal(cheap.competitivePromoted, true);
  assert.equal(cheap.clearCompetitiveSurplus, true);
  assert.ok(cheap.evidence.every((item) => item.code !== 'BUDGET_COMPETITIVE_SPLIT'));
  assert.ok(cheap.confidenceIssues.every((issue) => !issue.includes('预算线')));

  // 昂贵版本同样 B5，造价对档位无影响
  const rich = analyze(cedhLines, { metadataResult: priceMetadata(200) });
  assert.equal(rich.assignedBracket, 5);
  assert.ok(rich.evidence.every((item) => item.code !== 'BUDGET_COMPETITIVE_SPLIT'));

  // 无造价数据也不再产生预算相关的置信度悬置
  const noPrice = analyze(cedhLines);
  assert.equal(noPrice.assignedBracket, 5);
  assert.ok(noPrice.confidenceIssues.every((issue) => !issue.includes('预算') && !issue.includes('无法区分 B5 与 B4.5')));
});

test('Band position splits every bracket into balanced 偏弱/中等/偏强 with axis-backed evidence', () => {
  const completeDeck = (extras) => [
    ...Array.from({ length: 99 - extras.length }, () => '1 Forest'),
    ...extras.map((name) => `1 ${name}`),
    '',
    '1 Bear Cub',
  ];
  const runLadder = (label, expectedBracket, steps) => {
    const results = steps.map((extras) => analyze(completeDeck(extras)));
    results.forEach((result, index) => {
      assert.equal(result.assignedBracket, expectedBracket,
        `${label} 第 ${index} 步应停留在 B${expectedBracket}`);
    });
    const scores = results.map((result) => result.bandPosition.score);
    scores.forEach((score, index) => {
      if (index > 0) assert.ok(score >= scores[index - 1], `${label} 位置分数应随强度单调不降`);
    });
    return results.map((result) => result.bandPosition.tier);
  };
  const assertBalanced = (label, tiers) => {
    const counts = { low: 0, mid: 0, high: 0 };
    tiers.forEach((tier) => { counts[tier] += 1; });
    ['low', 'mid', 'high'].forEach((tier) => {
      assert.ok(counts[tier] >= 1, `${label} 缺少 ${tier} 标签：${tiers.join(',')}`);
    });
    const maximumShare = Math.max(counts.low, counts.mid, counts.high) / tiers.length;
    assert.ok(maximumShare <= 0.6, `${label} 单一偏向占比 ${maximumShare} 超过 60%：${tiers.join(',')}`);
  };

  // B1：向 B3 门槛推进（全部非 Game Changers、不成组合技）
  const b1Tiers = runLadder('B1', 1, [
    [],
    ['Mystic Remora'],
    ['Mystic Remora', 'Sylvan Library'],
    ['Mystic Remora', 'Sylvan Library', 'Sol Ring'],
    ['Mystic Remora', 'Sylvan Library', 'Sol Ring', 'Diabolic Intent'],
    ['Mystic Remora', 'Sylvan Library', 'Sol Ring', 'Diabolic Intent', 'Tainted Pact'],
  ]);
  assert.deepEqual(b1Tiers, ['low', 'low', 'mid', 'mid', 'high', 'high']);
  assertBalanced('B1', b1Tiers);

  // B3：入档仅靠 2 张快速法术力，逐步逼近 B4 的多条门槛
  const b3Base = ['Sol Ring', 'Lotus Petal'];
  const b3Tiers = runLadder('B3', 3, [
    b3Base,
    [...b3Base, 'Diabolic Intent'],
    [...b3Base, 'Diabolic Intent', 'Wishclaw Talisman'],
    [...b3Base, 'Diabolic Intent', 'Wishclaw Talisman', 'Mox Amber'],
    [...b3Base, 'Diabolic Intent', 'Wishclaw Talisman', 'Mox Amber', 'Spellseeker'],
    [...b3Base, 'Diabolic Intent', 'Wishclaw Talisman', 'Mox Amber', 'Spellseeker', 'Pact of Negation'],
    [...b3Base, 'Diabolic Intent', 'Wishclaw Talisman', 'Mox Amber', 'Spellseeker', 'Pact of Negation', 'Null Rod', 'Static Orb', 'Trinisphere'],
  ]);
  assert.deepEqual(b3Tiers, ['low', 'low', 'low', 'mid', 'mid', 'high', 'high']);
  assertBalanced('B3', b3Tiers);

  // B4：按 B5 四项必要条件的联合接近程度衡量
  const b4Base = ['Sol Ring', 'Lotus Petal', 'Mox Amber', 'Mox Opal'];
  const b4Tiers = runLadder('B4', 4, [
    b4Base,
    [...b4Base, 'Diabolic Intent', 'Wishclaw Talisman'],
    [...b4Base, 'Diabolic Intent', 'Wishclaw Talisman', 'Spellseeker'],
    [...b4Base, 'Diabolic Intent', 'Wishclaw Talisman', 'Spellseeker', 'Pact of Negation'],
    [...b4Base, 'Diabolic Intent', 'Wishclaw Talisman', 'Spellseeker', 'Pact of Negation', 'Mental Misstep'],
    [...b4Base, 'Diabolic Intent', 'Wishclaw Talisman', 'Spellseeker', 'Pact of Negation', 'Mental Misstep', 'Null Rod', 'Static Orb', 'Trinisphere'],
  ]);
  assert.deepEqual(b4Tiers, ['low', 'low', 'mid', 'mid', 'high', 'high']);
  assertBalanced('B4', b4Tiers);

  // B4.5 与 B5 竞技档都不做区间定位。B4.5 无对应 meta，一句带过不赘述（不提 meta）；B5 说明待 meta 分析
  const competitiveCore = ['Sol Ring', 'Lotus Petal', 'Mox Amber', 'Demonic Consultation', 'Diabolic Intent',
    'Wishclaw Talisman', 'Pact of Negation', 'Mental Misstep', "Thassa's Oracle"];
  const b45Deck = analyze(completeDeck(competitiveCore));
  assert.equal(b45Deck.assignedBracket, 4.5);
  assert.equal(b45Deck.bandPosition.deferred, true);
  assert.equal(b45Deck.bandPosition.tier, null);
  const b45Band = b45Deck.evidence.find((item) => item.code === 'BAND_POSITION');
  assert.equal(b45Band.title, '区间定位：B4.5 暂不区分');
  assert.ok(b45Band.detail.includes('准竞技') && b45Band.detail.includes('不再细分'));
  assert.ok(!b45Band.detail.includes('meta'), 'B4.5 无对应 meta，不赘述 meta 分析');
  assert.ok(b45Band.detail.length < 40, 'B4.5 区间定位说明保持一句带过');
  assert.ok(!buildBracketSummary(b45Deck).includes('区间定位'));

  const b5Deck = analyze(completeDeck([...competitiveCore, 'Mox Opal', 'Dark Ritual', 'Spellseeker',
    'Deadly Rollick', 'Cabal Ritual', 'Neoform']));
  assert.equal(b5Deck.assignedBracket, 5);
  assert.equal(b5Deck.bandPosition.deferred, true);
  assert.equal(b5Deck.bandPosition.tier, null);
  assert.ok(b5Deck.evidence.some((item) => item.code === 'BAND_POSITION'
    && item.title === '区间定位：B5 暂不区分'
    && item.detail.includes('meta')));
  assert.ok(!buildBracketSummary(b5Deck).includes('区间定位'));

  // B2：额外回合下限入档也有区间区分
  const b2Low = analyze(completeDeck(['Time Warp']));
  assert.equal(b2Low.assignedBracket, 2);
  assert.equal(b2Low.bandPosition.tier, 'low');
  const b2High = analyze(completeDeck(['Time Warp', 'Sol Ring', 'Diabolic Intent', 'Wishclaw Talisman', 'Pact of Negation']));
  assert.equal(b2High.assignedBracket, 2);
  assert.equal(b2High.bandPosition.tier, 'high');

  // 规则下限锁定的 B4（炸地）结构远未达标 → 偏弱；只描述区间内位置，不论述与下一档的接近度
  const denialFloor = analyze(['Deck', '1 Armageddon']);
  assert.equal(denialFloor.assignedBracket, 4);
  assert.equal(denialFloor.bandPosition.tier, 'low');
  const denialEvidence = denialFloor.evidence.find((item) => item.code === 'BAND_POSITION');
  assert.match(denialEvidence.detail, /落在 B4 区间下段/);
  assert.doesNotMatch(denialEvidence.detail, /接近度|推进度|判定门槛|平均达成|瓶颈|%/);

  // 证据、摘要与顺序：区间定位紧邻置信度之前，文案只给区间内位置、无接近度百分比
  const positioned = analyze(completeDeck(['Sol Ring', 'Lotus Petal', 'Diabolic Intent', 'Wishclaw Talisman', 'Mox Amber']));
  assert.equal(positioned.assignedBracket, 3);
  const codes = positioned.evidence.map((item) => item.code);
  assert.equal(codes[codes.length - 1], 'CONFIDENCE_PROFILE');
  assert.equal(codes[codes.length - 2], 'BAND_POSITION');
  const positionedEvidence = positioned.evidence.find((item) => item.code === 'BAND_POSITION');
  assert.match(positionedEvidence.title, /^区间定位：B3 (偏弱|中等|偏强)$/);
  assert.match(positionedEvidence.detail, /^落在 B3 区间(下段|中段|上段)/);
  assert.doesNotMatch(positionedEvidence.detail, /接近度|推进度|判定门槛|最接近的路径|%/);
  assert.match(buildBracketSummary(positioned), /区间定位(偏弱|中等|偏强)$/);
  assert.doesNotMatch(buildBracketSummary(positioned), /接近度|推进度|判定门槛/);
});

test('bracket report page shows verdict chain, signal overview and per-reason roles', () => {
  const pageJs = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.js'), 'utf8');
  const pageWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.wxml'), 'utf8');
  const pageWxss = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.wxss'), 'utf8');

  // 判定链条：下限 → 结构 → 数据辅助 → 竞技特征（B4.5 准竞技 / B5 竞技），复合推导可视化
  assert.match(pageJs, /function buildVerdictSteps\(result\)/);
  assert.match(pageJs, /pushStep\('规则下限', result\.floorBracket, false\)/);
  assert.match(pageJs, /pushStep\('结构强度', result\.assignedWithoutMetrics/);
  assert.match(pageJs, /pushStep\('数据辅助', result\.assignedBeforePromotion/);
  assert.match(pageJs, /if \(result\.competitivePromoted\) pushStep\('竞技特征', result\.competitiveBracket, true\)/);
  assert.match(pageJs, /if \(result\.expensivePoolPromoted\) pushStep\('主将池', 5, true\)/);
  assert.doesNotMatch(pageJs, /commanderPoolPromoted|budgetCompetitive|预算细分/);
  assert.match(pageWxml, /class="verdict-chain" aria-label="判定链条"/);
  assert.match(pageWxml, /class="chain-step \{\{item\.changed \? 'is-raised' : ''\}\}/);
  assert.match(pageWxss, /\.chain-step\.is-raised\s*\{[^}]*rgba\(var\(--module-accent-rgb\)/);
  assert.match(pageWxss, /\.chain-step\.is-final\s*\{[^}]*rgba\(var\(--module-accent-rgb\)/);

  // 构筑信号总览：全部命中信号轴与张数
  assert.match(pageJs, /const signalOverview = \(result\.signals \|\| \[\]\)\.map/);
  assert.match(pageWxml, /class="signal-overview" wx:if="\{\{result\.signalOverview\.length\}\}"/);
  assert.match(pageWxml, /class="signal-chip"[\s\S]*\{\{item\.label\}\}[\s\S]*×\{\{item\.count\}\}/);

  // 每条依据的作用标签：下限 / 强度区间 / 辅助上调 / 特殊升降档 / 参考
  assert.match(pageJs, /function reasonRoleLabel\(item\)/);
  assert.match(pageJs, /return '竞技特征'/);
  assert.match(pageJs, /return `下限 B\$\{item\.minimumBracket\}`/);
  assert.match(pageJs, /return '辅助上调'/);
  assert.match(pageJs, /强度区间 B/);
  assert.doesNotMatch(pageJs, /强度带|B5→B4\.5|BUDGET_COMPETITIVE/);
  assert.match(pageWxml, /class="reason-role mono">\{\{item\.roleLabel\}\}/);
  assert.match(pageWxss, /\.reason-role\s*\{[^}]*white-space:\s*nowrap/);

  // 区间定位：hero 档位下方只显示偏弱/中等/偏强（度量文字空则不渲染），证据条对应角色标签
  // B4.5 与 B5 竞技档 deferred → bandPositioned 为假 → 不渲染区间定位行
  assert.match(pageJs, /return '区间定位'/);
  assert.match(pageJs, /const bandPositioned = Boolean\(bandPosition && !bandPosition\.deferred && bandPosition\.tier\)/);
  assert.match(pageJs, /bandPositionClass: bandPositioned \? `band-\$\{bandPosition\.tier\}` : ''/);
  assert.match(pageWxml, /class="band-position \{\{result\.bandPositionClass\}\}" wx:if="\{\{result\.bandPositionZh\}\}"/);
  assert.match(pageWxml, /class="band-position-tier">\{\{result\.bandPositionZh\}\}/);
  assert.match(pageWxml, /class="band-position-metric mono" wx:if="\{\{result\.bandPositionMetricText\}\}">/);
  assert.match(pageWxss, /\.band-position\.band-high \.band-position-tier\s*\{[^}]*rgba\(var\(--module-accent-rgb\), 0\.95\)/);
  assert.match(pageWxss, /\.band-position\.band-low \.band-position-tier\s*\{[^}]*var\(--cedh-text-soft\)/);
});

test('Mass land denial creates a deterministic B4 floor', () => {
  const result = analyze(['Deck', '1 Armageddon']);
  assert.equal(result.floorBracket, 4);
  assert.equal(result.assignedBracket, 4);
  assert.ok(result.evidence.some((item) => item.code === 'MASS_LAND_DENIAL'));

  const fall = analyze(['Deck', '1 Fall of the Thran']);
  assert.deepEqual(fall.massLandDenial, ['Fall of the Thran']);
  assert.equal(fall.floorBracket, 4);

  ['Worldfire', 'Apocalypse', 'Bearer of the Heavens', 'Worldpurge', 'Sway of the Stars']
    .forEach((name) => {
      const reset = analyze(['Deck', `1 ${name}`]);
      assert.deepEqual(reset.massLandDenial, [name]);
      assert.equal(reset.floorBracket, 4);
    });
});

test('Extra-turn density affects the recommendation without inventing a hard chain', () => {
  const isolated = analyze(['Deck', '1 Time Warp']);
  const repeated = analyze(['Deck', '1 Time Warp', '1 Temporal Manipulation']);
  const dense = analyze([
    'Deck',
    '1 Time Warp',
    '1 Temporal Manipulation',
    '1 Capture of Jingzhou',
    '1 Nexus of Fate',
  ]);

  assert.equal(isolated.floorBracket, 2);
  assert.equal(repeated.floorBracket, 2);
  assert.equal(repeated.assignedBracket, 3);
  assert.equal(dense.assignedBracket, 4);
  assert.ok(dense.evidence.some((item) => item.code === 'EXTRA_TURN_DENSITY'));

  const turnOrderOnly = analyze(['Deck', '1 Aeon Engine']);
  assert.deepEqual(turnOrderOnly.extraTurns, []);
  assert.equal(turnOrderOnly.floorBracket, 1);
});

test('B1 and B5 are inferred conservatively without a declared environment', () => {
  const lowSignalDeck = ['Commander', '1 Bear Cub', 'Deck', '99 Forest'];
  const lowSignal = analyze(lowSignalDeck);
  assert.equal(lowSignal.assignedBracket, 1);
  assert.ok(lowSignal.evidence.some((item) => item.code === 'AUTO_LOW_SIGNAL_BASELINE'));

  const incomplete = analyze(['Commander', '1 Bear Cub', 'Deck', '98 Forest']);
  assert.equal(incomplete.assignedBracket, 2);
  assert.equal(incomplete.provisional, true);

  const competitiveDeck = [
    'Commander',
    '1 Kinnan, Bonder Prodigy',
    'Deck',
    '1 Chrome Mox',
    '1 Mox Diamond',
    '1 Mana Vault',
    '1 Demonic Tutor',
    '1 Vampiric Tutor',
    '1 Mystical Tutor',
    '1 Demonic Consultation',
    '1 Force of Will',
    '1 Fierce Guardianship',
    "1 Thassa's Oracle",
    '89 Forest',
  ];
  // 竞技升档收紧：刚达竞技阈值（零余量附近）的牌表归 B4.5，不再直接进入 B5
  const competitive = analyze(competitiveDeck);
  assert.equal(competitive.competitiveProfile, true);
  assert.equal(competitive.competitivePromoted, true);
  assert.equal(competitive.assignedBracket, 4.5, '入门竞技结构余量不足 B5 基准，归 B4.5');
  assert.ok(competitive.competitiveSurplusScore < 0.6);
  assert.ok(competitive.evidence.some((item) => item.code === 'COMPETITIVE_SIGNAL_DENSITY'
    && item.detail.includes('未达 B5 基准')));

  // 快速法术力、高效导师与免费互动都超出阈值时余量越线，才归 B5
  const stackedDeck = competitiveDeck
    .filter((line) => line !== '89 Forest')
    .concat([
      '1 Dark Ritual', '1 Cabal Ritual', '1 Lotus Petal',
      '1 Diabolic Intent', '1 Wishclaw Talisman',
      '1 Pact of Negation', '1 Mental Misstep',
      '82 Forest',
    ]);
  const stacked = analyze(stackedDeck);
  assert.equal(stacked.assignedBracket, 5, '余量越过 B5 基准的完整竞技结构才判 B5');
  assert.ok(stacked.competitiveSurplusScore >= 0.6);
  assert.ok(stacked.evidence.some((item) => item.code === 'COMPETITIVE_SIGNAL_DENSITY'
    && item.detail.includes('越过 B5 基准')));

  const dataHeavyCompetitiveDeck = competitiveDeck
    .map((line) => (line === '89 Forest' ? '89 Midrange Filler' : line));
  const dataHeavyParsed = parseBracketDeck(dataHeavyCompetitiveDeck.join('\n'));
  const deliberatelySlowAndExpensive = makeMetadata(Array.from(
    new Set(dataHeavyParsed.cards.map((card) => card.name)),
  ).map((name) => ({ name, cmc: 5, usd: 100 })));
  const competitiveWithMetadata = analyze(dataHeavyCompetitiveDeck, {
    metadataResult: deliberatelySlowAndExpensive,
  });
  assert.equal(competitiveWithMetadata.assignedBracket, 4.5, 'curve and price must not create or cancel the competitive verdict');
  assert.equal(competitiveWithMetadata.priceInfluenced, false);

  // 100 人主将池不再改变档位：池内主将 + B4 结构保持 B4
  const oneAxisShort = competitiveDeck
    .filter((line) => line !== '1 Chrome Mox')
    .concat('1 Llanowar Elves');
  const poolCommander = analyze(oneAxisShort);
  assert.equal(poolCommander.assignedBeforePromotion, 4);
  assert.equal(poolCommander.competitivePromoted, false);
  assert.equal(poolCommander.assignedBracket, 4, '主将池成员不再触发任何升档');
  assert.ok(poolCommander.evidence.every((item) => item.code !== 'QUESTIONNAIRE_COMMANDER_POOL'));

  const poolB3 = analyze([
    'Commander',
    '1 Kinnan, Bonder Prodigy',
    'Deck',
    '1 Sol Ring',
    '98 Forest',
  ]);
  assert.equal(poolB3.assignedBracket, 3);
  assert.equal(poolB3.competitivePromoted, false);

  const banned = competitiveDeck
    .map((line) => (line === '1 Mana Vault' ? '1 Mana Crypt' : line));
  assert.equal(analyze(banned).assignedBracket, 4);
  assert.equal(analyze(banned).legalityStatus, 'needs-fix');
  assert.equal(analyze(banned).competitivePromoted, false);

  const assignments = ['exhibition', 'general', 'cedh']
    .map((intent) => analyze(lowSignalDeck, { intent }).assignedBracket);
  assert.deepEqual(assignments, [1, 1, 1], 'legacy intent input must not change automatic assignment');
});

test('Competitive gate recognizes non-blue and command-engine cEDH, not just the blue-black turbo shape', () => {
  const build = (commander, recognized, land = 'Mountain') => [
    'Commander',
    `1 ${commander}`,
    'Deck',
    ...recognized.map((name) => `1 ${name}`),
    `${99 - recognized.length} ${land}`,
  ].join('\n');

  // Magda：单红组合技主将，通用导师稀缺（只有 Gamble / Wishclaw），但主将区引擎 + 早期组合技
  // → 曾被「导师 ≥3」硬门槛压回 B4，现在按组装一致性（主将区引擎抵导师）进入 B5
  const magda = analyzeBracketDeck(build('Magda, Brazen Outlaw', [
    'Sol Ring', 'Mana Vault', 'Grim Monolith', 'Chrome Mox', 'Mox Opal', 'Mox Amber',
    'Lotus Petal', 'Ancient Tomb', 'Jeweled Amulet', 'Simian Spirit Guide',
    'Gamble', 'Wishclaw Talisman',
    'Deflecting Swat', 'Fury', 'Mindbreak Trap',
    'Magda, Brazen Outlaw', 'Clock of Omens', 'Universal Automaton', 'Metallic Mimic', 'Adaptive Automaton',
  ])).result;
  const magdaTutors = (magda.signals.find((s) => s.key === 'efficientTutor') || { count: 0 }).count;
  assert.ok(magdaTutors < 3, 'Magda 牌表通用导师应低于旧硬门槛');
  assert.equal(magda.competitiveProfile, true, '主将区引擎 + 早期组合技应满足竞技门槛');
  assert.equal(magda.assignedBracket, 5, '单色组合技主将不应因缺通用导师而被压回 B4');

  // Rakdos 引擎牌组：无已收录组合技、无主将区引擎，但极高多轴密度（引擎 3）应满足制胜路径
  const engineBreadth = analyzeBracketDeck(build('Rowan, Scion of War', [
    'Sol Ring', 'Mana Vault', 'Chrome Mox', 'Mox Opal', 'Mox Amber', 'Lotus Petal', 'Dark Ritual', 'Cabal Ritual',
    'Demonic Tutor', 'Vampiric Tutor', 'Imperial Seal', 'Gamble', 'Diabolic Intent',
    'Deflecting Swat', 'Deadly Rollick', 'Fury', 'Grief',
    'Necropotence', "Bolas's Citadel", 'Ad Nauseam',
  ], 'Swamp')).result;
  assert.equal(engineBreadth.competitiveProfile, true, '20 信号 / 4 高轴 / 引擎 3 应满足极高多轴密度制胜路径');
  assert.equal(engineBreadth.assignedBracket, 5);

  // 护栏一 · 速度地板：休闲主将区引擎（快速法术力不足）不进竞技
  const casual = analyzeBracketDeck(build('Korvold, Fae-Cursed King', [
    'Sol Ring', 'Arcane Signet', 'Demonic Tutor', 'Deadly Rollick', 'Cultivate', 'Rampant Growth',
  ], 'Swamp')).result;
  assert.equal(casual.competitiveProfile, false, '快速法术力不足 3 的休闲主将牌组被速度地板挡住');
  assert.ok(casual.assignedBracket <= 4);

  // 护栏二 · 制胜路径：快速好牌堆但无组合技 / 无主将区引擎 / 未达极高密度 → 停在 B4
  const toothless = analyzeBracketDeck([
    'Commander', '1 Bear Cub', 'Deck',
    '1 Sol Ring', '1 Mana Vault', '1 Chrome Mox',
    '1 Demonic Tutor', '1 Vampiric Tutor', '1 Mystical Tutor',
    '1 Rhystic Study', '1 Mystic Remora',
    '1 Force of Will', '1 Fierce Guardianship',
    '89 Island',
  ].join('\n')).result;
  assert.equal(toothless.competitiveProfile, false, '无制胜路径的快速好牌堆不应升为竞技');
  assert.equal(toothless.assignedBracket, 4);

  // 护栏三 · 锋利度：主将区引擎但零互动 / 零组合技 / 无密度的纯 durdle 不进竞技
  const durdle = analyzeBracketDeck(build('Najeela, the Blade-Blossom', [
    'Sol Ring', 'Mana Vault', 'Chrome Mox', 'Demonic Tutor', 'Llanowar Elves', 'Birds of Paradise',
  ], 'Forest')).result;
  assert.equal(durdle.competitiveProfile, false, '缺锋利度轴（互动/组合技/密度）的主将引擎牌组不进竞技');
});

test('Commander pool membership alone does not change the bracket without the expensive-fast conditions', () => {
  const partnerDeck = (commanders) => [
    'Commander',
    ...commanders.map((name) => `1 ${name}`),
    'Deck',
    '1 Armageddon',
    `${99 - commanders.length} Forest`,
  ];

  // 主将池升档需同时满足 快速法术力 >3 + 造价 >$1500；无元数据（造价未知）时池内主将不单独升档
  const listedPartners = analyze(partnerDeck([
    'Tymna the Weaver',
    "Kraum, Ludevic's Opus",
  ]));
  assert.equal(listedPartners.deckCardCount, 100);
  assert.equal(listedPartners.assignedBeforePromotion, 4);
  assert.equal(listedPartners.assignedBracket, 4);
  assert.equal(listedPartners.competitivePromoted, false);
  assert.equal(listedPartners.expensivePoolPromoted, false);
  assert.ok(listedPartners.evidence.every((item) => item.code !== 'EXPENSIVE_POOL_PROMOTION'));

  const outsidePool = analyze(partnerDeck([
    'Tymna the Weaver',
    'Bear Cub',
  ]));
  assert.equal(outsidePool.assignedBracket, 4);
  assert.equal(outsidePool.assignedBracket, listedPartners.assignedBracket, '缺造价数据时池内外主将档位一致');

  const kinnanFloor = analyze([
    'Commander',
    '1 Kinnan, Bonder Prodigy',
    'Deck',
    '1 Armageddon',
    '97 Forest',
  ]);
  assert.equal(kinnanFloor.deckCardCount, 99);
  assert.equal(kinnanFloor.assignedBracket, 4);
  assert.equal(kinnanFloor.expensivePoolPromoted, false);
});

test('Expensive fast-mana deck with a pool commander promotes B4/B4.5 to B5', () => {
  const fastMana = ['Sol Ring', 'Mana Vault', 'Chrome Mox', 'Mox Opal', 'Mox Amber'];
  const gameChangers = ['Ancient Tomb', 'The One Ring', 'Cyclonic Rift'];
  const filler = Array.from({ length: 55 }, (_, i) => `Filler ${i + 1}`);
  const recognized = [...fastMana, ...gameChangers, ...filler];
  const buildLines = (commander) => [
    'Commander', `1 ${commander}`, 'Deck',
    ...recognized.map((name) => `1 ${name}`),
    `${99 - recognized.length} Forest`,
  ].join('\n');
  const priceOf = (name) => {
    if (name === 'Forest') return 0.1;
    if (fastMana.includes(name)) return 200;
    if (gameChangers.includes(name)) return 60;
    return 12;
  };
  const metadataFor = (parsed, priceMultiplier = 1) => makeMetadata(
    Array.from(new Set(parsed.cards.map((card) => card.name))).map((name) => ({
      name,
      cmc: 2,
      usd: name === 'Forest' ? 0.1 : priceOf(name) * priceMultiplier,
      typeLine: name === 'Forest' ? 'Basic Land — Forest' : 'Artifact',
    })),
  );

  // Kinnan（池内）+ 6 张快速法术力 + 约 $1852（>$1500）→ 由 B4 升 B5
  const parsed = parseBracketDeck(buildLines('Kinnan, Bonder Prodigy'));
  const promoted = evaluateBracket(parsed, { metadataResult: metadataFor(parsed) });
  assert.equal(promoted.competitiveBracket, 4, '结构与竞技判定先落在 B4');
  assert.ok(promoted.expensivePoolFastMana > 3, '快速法术力需超过 3 张');
  assert.ok(promoted.deckMetrics.priceReliable && promoted.deckMetrics.estimatedTotalUsd > 1500);
  assert.equal(promoted.expensivePoolPromoted, true);
  assert.equal(promoted.assignedBracket, 5);
  const evidence = promoted.evidence.find((item) => item.code === 'EXPENSIVE_POOL_PROMOTION');
  assert.ok(evidence && evidence.detail.includes('cEDH 数据库排名前 100')
    && evidence.detail.includes('$1500') && evidence.detail.includes('升为 B5'));
  assert.match(buildBracketSummary(promoted), /cEDH 数据库排名前 100[\s\S]*升到B5强度/);

  // 护栏一：池外主将（Bear Cub）→ 不升档
  const outParsed = parseBracketDeck(buildLines('Bear Cub'));
  const outsidePool = evaluateBracket(outParsed, { metadataResult: metadataFor(outParsed) });
  assert.equal(outsidePool.expensivePoolPromoted, false);
  assert.equal(outsidePool.assignedBracket, 4);

  // 护栏二：造价不足（每张便宜十倍 → 远低于 $1500）→ 不升档
  const cheap = evaluateBracket(parsed, { metadataResult: metadataFor(parsed, 0.1) });
  assert.ok(cheap.deckMetrics.estimatedTotalUsd < 1500);
  assert.equal(cheap.expensivePoolPromoted, false);
  assert.equal(cheap.assignedBracket, 4);

  // 护栏三：无元数据（造价未知）→ 不升档
  const noPrice = evaluateBracket(parsed);
  assert.equal(noPrice.expensivePoolPromoted, false);
  assert.equal(noPrice.assignedBracket, 4);
});

test('Deck metrics weight quantities, exclude lands from curve, and never price missing cards as zero', () => {
  const parsed = parseBracketDeck([
    'Commander',
    '1 Test Commander',
    'Deck',
    '2 Cheap Spell',
    '3 Expensive Spell',
    '4 Forest',
    '1 Ancient Tomb',
    'Companion',
    '1 Lutri, the Spellchaser',
  ].join('\n'));
  const metadataResult = makeMetadata([
    { name: 'Test Commander', cmc: 4, typeLine: 'Legendary Creature', usd: 5 },
    { name: 'Cheap Spell', cmc: 1, typeLine: 'Instant', usd: 1.5 },
    { name: 'Expensive Spell', cmc: 6, typeLine: 'Sorcery', usd: null },
    { name: 'Forest', cmc: 0, typeLine: 'Basic Land — Forest', usd: 0.2 },
    { name: 'Ancient Tomb', cmc: 0, typeLine: 'Land', usd: 80 },
    { name: 'Lutri, the Spellchaser', cmc: 3, typeLine: 'Legendary Creature', usd: 2 },
  ]);
  const metrics = buildDeckMetrics(parsed.cards, metadataResult);

  assert.equal(metrics.totalCardCount, 11, 'Companion must not enter deck metrics');
  assert.equal(metrics.manaCoverage, 1);
  assert.equal(metrics.nonlandCoveredCount, 6);
  assert.equal(metrics.averageManaValue, 4);
  assert.deepEqual(metrics.curveBuckets.map((bucket) => bucket.count), [2, 0, 0, 1, 0, 3]);
  assert.equal(metrics.priceEligibleCount, 7, 'basic lands are excluded, nonbasic lands remain priced');
  assert.equal(metrics.priceCoveredCount, 4, 'missing price stays uncovered');
  assert.equal(metrics.priceCoverage, 0.5714);
  assert.equal(metrics.estimatedTotalUsd, 88);
});

test('Mana curve is a reliable one-step support signal and never changes the rule floor', () => {
  const lowCurveMetadata = makeMetadata([
    { name: 'Bear Cub', cmc: 2, usd: 1 },
    { name: 'Curve Filler', cmc: 1, usd: 1 },
    { name: 'Sol Ring', cmc: 1, typeLine: 'Artifact', usd: 1 },
    { name: 'Lotus Petal', cmc: 0, typeLine: 'Artifact', usd: 1 },
  ]);
  const lowSignal = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '99 Curve Filler',
  ], { metadataResult: lowCurveMetadata });
  assert.equal(lowSignal.structuralStrengthBracket, 1);
  assert.equal(lowSignal.curveStrengthBracket, 4);
  assert.equal(lowSignal.assignedBracket, 2, 'curve alone may only move B1 to B2');
  assert.equal(lowSignal.floorBracket, 1);
  assert.equal(lowSignal.curveInfluenced, true);

  const lowCoverage = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '99 Curve Filler',
  ], {
    metadataResult: makeMetadata([{ name: 'Bear Cub', cmc: 1, usd: 1 }]),
  });
  assert.equal(lowCoverage.assignedBracket, 1);
  assert.equal(lowCoverage.deckMetrics.curveReliable, false);
  assert.equal(lowCoverage.curveInfluenced, false);

  const landHeavyPartial = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '39 Low Curve Spell',
    '40 Forest',
    '20 Missing High Curve Spell',
  ], {
    metadataResult: makeMetadata([
      { name: 'Bear Cub', cmc: 1, usd: 1 },
      { name: 'Low Curve Spell', cmc: 1, typeLine: 'Instant', usd: 1 },
      { name: 'Forest', cmc: 0, typeLine: 'Basic Land — Forest', usd: 0.1 },
    ]),
  });
  assert.equal(landHeavyPartial.deckMetrics.metadataCoverage, 0.8);
  assert.equal(landHeavyPartial.deckMetrics.manaCoverage, 0.6667);
  assert.equal(landHeavyPartial.deckMetrics.curveReliable, false, 'covered lands cannot hide missing nonlands');
  assert.equal(landHeavyPartial.assignedBracket, 1);

  const structured = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '1 Sol Ring',
    '1 Lotus Petal',
    '97 Curve Filler',
  ], { metadataResult: lowCurveMetadata });
  assert.equal(structured.structuralStrengthBracket, 3);
  assert.equal(structured.assignedBracket, 4, 'optimized curve may support an existing B3 profile by one tier');
  assert.equal(structured.floorBracket, 1);
  assert.ok(structured.evidence.some((item) => item.code === 'MANA_CURVE_SUPPORT' && item.kind === 'strength' && item.title === '合理法术力曲线'));

  const floorLocked = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '1 Armageddon',
    '98 Curve Filler',
  ], {
    metadataResult: makeMetadata([
      { name: 'Bear Cub', cmc: 2, usd: 1 },
      { name: 'Armageddon', cmc: 4, typeLine: 'Sorcery', usd: 5 },
      { name: 'Curve Filler', cmc: 1, usd: 1 },
    ]),
  });
  assert.equal(floorLocked.curveRaisedStrength, true);
  assert.equal(floorLocked.curveInfluenced, false, 'a floor-locked final bracket must not be attributed to curve');
  assert.equal(floorLocked.assignedBracket, 4);

  const incomplete = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '98 Curve Filler',
  ], { metadataResult: lowCurveMetadata });
  assert.equal(incomplete.curveInfluenced, false, 'incomplete lists may display a curve but cannot use it for assignment');
});

test('Early mana, low-cost interaction, and card flow support one tier without stacking', () => {
  const feature = (overrides = {}) => ({
    known: true,
    playableLand: false,
    nonland: true,
    alwaysTappedLand: false,
    turnOneManaLand: false,
    regularRamp12: false,
    lowCostInteraction: false,
    graveyardInteraction: false,
    protection: false,
    lowCostCardFlow: false,
    ...overrides,
  });
  const roleEntries = [
    {
      name: 'Ready Land',
      cmc: 0,
      typeLine: 'Basic Land — Forest',
      strengthFeatures: feature({ playableLand: true, nonland: false, turnOneManaLand: true }),
    },
    { name: 'Sol Ring', cmc: 1, typeLine: 'Artifact', strengthFeatures: feature({ regularRamp12: true }) },
    { name: 'Lotus Petal', cmc: 0, typeLine: 'Artifact', strengthFeatures: feature() },
    ...Array.from({ length: 4 }, (_, index) => ({
      name: `Regular Ramp ${index + 1}`,
      cmc: 2,
      typeLine: 'Artifact',
      strengthFeatures: feature({ regularRamp12: true }),
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      name: `Low Interaction ${index + 1}`,
      cmc: 2,
      typeLine: 'Instant',
      strengthFeatures: feature({
        lowCostInteraction: true,
        graveyardInteraction: index === 0,
        protection: index === 1 || index === 2,
      }),
    })),
    ...Array.from({ length: 7 }, (_, index) => ({
      name: `Low Flow ${index + 1}`,
      cmc: 2,
      typeLine: 'Sorcery',
      strengthFeatures: feature({ lowCostCardFlow: true }),
    })),
    { name: 'Known Filler', cmc: 4, typeLine: 'Creature', strengthFeatures: feature() },
    { name: 'Bear Cub', cmc: 4, typeLine: 'Creature', strengthFeatures: feature() },
    { name: 'Kinnan, Bonder Prodigy', cmc: 4, typeLine: 'Creature', strengthFeatures: feature() },
  ];
  const metadataResult = makeMetadata(roleEntries);
  const efficientDeck = [
    'Commander',
    '1 Bear Cub',
    'Deck',
    '30 Ready Land',
    '1 Sol Ring',
    '1 Lotus Petal',
    ...Array.from({ length: 4 }, (_, index) => `1 Regular Ramp ${index + 1}`),
    ...Array.from({ length: 8 }, (_, index) => `1 Low Interaction ${index + 1}`),
    ...Array.from({ length: 7 }, (_, index) => `1 Low Flow ${index + 1}`),
    '48 Known Filler',
  ];

  const supported = analyze(efficientDeck, { metadataResult });
  assert.equal(supported.structuralStrengthBracket, 3);
  assert.equal(supported.curveStrengthBracket, 1, 'the new axes are independent of the mana curve');
  assert.equal(supported.efficiencyProfile.strongAxisCount, 3);
  assert.equal(supported.efficiencyStrengthBracket, 4);
  assert.equal(supported.assignedBracket, 4);
  assert.equal(supported.efficiencyInfluenced, true);
  assert.ok(supported.evidence.some((item) => item.code === 'CONSTRUCTION_EFFICIENCY_SUPPORT' && item.title === '高效构筑'));
  assert.ok(supported.evidence.every((item) => !String(item.title).includes('支持')), '依据标题不使用「支持」措辞');
  // 该 B4 完全由构筑效率的临界上调撑起（efficiencyInfluenced），并非硬性规则锁定——
  // 去掉该辅助会回落 B3，因此置信度不能是「高」，只能是「中」并说明档位依赖启发式。
  assert.equal(supported.confidence, 'medium', '档位靠软性辅助临界上调时不能声称高置信度');
  assert.ok(supported.softStepInfluenced, '构筑效率的临界上调应记为软性步进');
  assert.ok(supported.confidenceIssues.some((issue) => issue.includes('临界上调')));
  assert.ok(supported.evidence.some((item) => item.code === 'CONFIDENCE_PROFILE' && item.title === '判定置信度：中'));

  // 主将池升档规则已删除：换上池内主将后档位不变
  const poolSupported = analyze(efficientDeck.map((line) => (
    line === '1 Bear Cub' ? '1 Kinnan, Bonder Prodigy' : line
  )), { metadataResult });
  assert.equal(poolSupported.assignedBeforePromotion, 4);
  assert.equal(poolSupported.assignedBracket, 4);
  assert.equal(poolSupported.competitivePromoted, false);

  const noStructuralSignals = efficientDeck
    .filter((line) => line !== '1 Sol Ring' && line !== '1 Lotus Petal')
    .map((line) => (line === '48 Known Filler' ? '50 Known Filler' : line));
  const oneStepOnly = analyze(noStructuralSignals, { metadataResult });
  assert.equal(oneStepOnly.structuralStrengthBracket, 1);
  assert.equal(oneStepOnly.efficiencyStrengthBracket, 4);
  assert.equal(oneStepOnly.assignedBracket, 2, 'metadata axes collectively support at most one tier');

  const partialMetadata = makeMetadata(roleEntries.filter((entry) => entry.name !== 'Known Filler'));
  const lowCoverage = analyze(efficientDeck, { metadataResult: partialMetadata });
  assert.ok(lowCoverage.efficiencyProfile.featureCoverage < 0.8);
  assert.equal(lowCoverage.efficiencyProfile.reliable, false);
  assert.equal(lowCoverage.efficiencyInfluenced, false);
  assert.equal(lowCoverage.assignedBracket, 3, 'missing Oracle features never count as absent weaknesses');
});

test('confidence reflects judgment reliability, not just input completeness', () => {
  const feat = (o = {}) => ({
    known: true, playableLand: false, nonland: true, alwaysTappedLand: false,
    turnOneManaLand: false, regularRamp12: false, lowCostInteraction: false,
    graveyardInteraction: false, protection: false, lowCostCardFlow: false, ...o,
  });

  // 硬规则锁定的 B4（4 张 Game Changers），全元数据、收录名单已识别几乎所有单卡、无软性步进 → 应为「高」
  const lockedEntries = [
    { name: 'Ready Land', cmc: 0, typeLine: 'Basic Land — Forest', strengthFeatures: feat({ playableLand: true, nonland: false, turnOneManaLand: true }) },
    { name: 'Rhystic Study', cmc: 3, typeLine: 'Enchantment', strengthFeatures: feat() },
    { name: 'Smothering Tithe', cmc: 4, typeLine: 'Enchantment', strengthFeatures: feat() },
    { name: 'Consecrated Sphinx', cmc: 6, typeLine: 'Creature', strengthFeatures: feat() },
    { name: 'Seedborn Muse', cmc: 5, typeLine: 'Creature', strengthFeatures: feat() },
    { name: 'Sol Ring', cmc: 1, typeLine: 'Artifact', strengthFeatures: feat({ regularRamp12: true }) },
    { name: 'Mana Vault', cmc: 1, typeLine: 'Artifact', strengthFeatures: feat({ regularRamp12: true }) },
    { name: 'Grim Monolith', cmc: 2, typeLine: 'Artifact', strengthFeatures: feat({ regularRamp12: true }) },
    { name: 'Mox Diamond', cmc: 0, typeLine: 'Artifact', strengthFeatures: feat() },
    ...Array.from({ length: 4 }, (_, i) => ({ name: `Ramp ${i + 1}`, cmc: 2, typeLine: 'Artifact', strengthFeatures: feat({ regularRamp12: true }) })),
    ...Array.from({ length: 8 }, (_, i) => ({ name: `Interaction ${i + 1}`, cmc: 2, typeLine: 'Instant', strengthFeatures: feat({ lowCostInteraction: true, graveyardInteraction: i === 0, protection: i === 1 || i === 2 }) })),
    ...Array.from({ length: 7 }, (_, i) => ({ name: `Flow ${i + 1}`, cmc: 2, typeLine: 'Sorcery', strengthFeatures: feat({ lowCostCardFlow: true }) })),
    { name: 'Bear Cub', cmc: 2, typeLine: 'Creature', strengthFeatures: feat() },
  ];
  const lockedDeck = [
    'Commander', '1 Bear Cub', 'Deck', '30 Ready Land',
    '1 Rhystic Study', '1 Smothering Tithe', '1 Consecrated Sphinx', '1 Seedborn Muse',
    '1 Sol Ring', '1 Mana Vault', '1 Grim Monolith', '1 Mox Diamond',
    ...Array.from({ length: 4 }, (_, i) => `1 Ramp ${i + 1}`),
    ...Array.from({ length: 8 }, (_, i) => `1 Interaction ${i + 1}`),
    ...Array.from({ length: 7 }, (_, i) => `1 Flow ${i + 1}`),
    '42 Bear Cub',
  ];
  const locked = analyze(lockedDeck, { metadataResult: makeMetadata(lockedEntries) });
  assert.equal(locked.assignedBracket, 4);
  assert.equal(locked.floorBracket, 4, '4 张 Game Changers 把下限硬锁在 B4');
  assert.equal(locked.softStepInfluenced, false, '档位来自硬规则而非软性辅助');
  assert.ok(locked.recognitionDensity >= 0.25);
  assert.equal(locked.confidence, 'high', '硬规则锁定 + 数据齐备 + 识别大部分单卡 + 无边界悬置 才配得上高置信度');

  // 全元数据但绝大多数是收录名单外的普通牌（engine 无法评估强度）→ 即使数据完整也只能「中」
  const sparseEntries = [
    { name: 'Ready Land', cmc: 0, typeLine: 'Basic Land — Forest', strengthFeatures: feat({ playableLand: true, nonland: false, turnOneManaLand: true }) },
    { name: 'Sol Ring', cmc: 1, typeLine: 'Artifact', strengthFeatures: feat({ regularRamp12: true }) },
    { name: 'Bear Cub', cmc: 2, typeLine: 'Creature', strengthFeatures: feat() },
    ...Array.from({ length: 25 }, (_, i) => ({ name: `Vanilla ${i + 1}`, cmc: 4, typeLine: 'Creature', strengthFeatures: feat() })),
  ];
  const sparseDeck = [
    'Commander', '1 Bear Cub', 'Deck', '40 Ready Land', '1 Sol Ring',
    ...Array.from({ length: 25 }, (_, i) => `1 Vanilla ${i + 1}`),
    '33 Bear Cub',
  ];
  const sparse = analyze(sparseDeck, { metadataResult: makeMetadata(sparseEntries) });
  assert.equal(sparse.structurallyComplete, true, '牌表完整、数据齐备');
  assert.ok(sparse.recognitionDensity < 0.25, '收录名单只识别到极少数单卡');
  assert.equal(sparse.confidence, 'medium', '无法评估整副牌强度时不得声称高置信度');
  assert.ok(sparse.confidenceIssues.some((issue) => issue.includes('收录名单只识别到')));

  // 出乎意料的 pattern：检测到未确认的组合技结构，实际强度可能更高 → 拉低置信度
  const comboStructureDeck = [
    'Commander', '1 Bear Cub', 'Deck',
    '1 Viscera Seer', '1 Reveillark', '1 Karmic Guide',
    ...Array.from({ length: 60 }, (_, i) => `1 Filler ${i + 1}`),
    '36 Forest',
  ];
  const comboStructureMeta = makeMetadata([
    { name: 'Viscera Seer', cmc: 1, typeLine: 'Creature', strengthFeatures: feat({ freeSacOutlet: true }) },
    { name: 'Reveillark', cmc: 5, typeLine: 'Creature', strengthFeatures: feat({ recursion: true, repeatable: true }) },
    { name: 'Karmic Guide', cmc: 5, typeLine: 'Creature', strengthFeatures: feat({ recursion: true, repeatable: true }) },
  ]);
  const comboStructure = analyze(comboStructureDeck, { metadataResult: comboStructureMeta });
  if (comboStructure.unlistedComboStructure) {
    assert.equal(comboStructure.confidence, 'medium');
    assert.ok(comboStructure.confidenceIssues.some((issue) => issue.includes('未能确认的组合技结构')));
  }
});

test('theme cohesion and unlisted combo structure are conservative shared support factors', () => {
  const completeLowSignalDeck = [
    'Commander',
    '1 Bear Cub',
    'Deck',
    '99 Theme Filler',
  ];
  const cohesionProfile = {
    reliable: true,
    band: 4,
    dominantTheme: {
      key: 'equipment',
      label: '武具',
      memberCount: 14,
      supportCount: 6,
      density: 0.31,
      commanderAligned: true,
      qualifies: true,
      strong: true,
    },
    triggerCards: ['Equipment Core', 'Equipment Payoff'],
  };
  const comboPotentialProfile = {
    reliable: true,
    band: 4,
    potentialLoops: [
      { id: 'creature-sacrifice-loop', label: '生物牺牲递归', cards: ['Outlet', 'Recursion', 'Payoff'] },
      { id: 'artifact-sacrifice-loop', label: '神器牺牲递归', cards: ['Artifact Outlet', 'Artifact Recursion', 'Artifact Payoff'] },
    ],
    triggerCards: ['Outlet', 'Recursion', 'Payoff', 'Artifact Outlet', 'Artifact Recursion', 'Artifact Payoff'],
  };
  const supported = analyze(completeLowSignalDeck, {
    cohesionProfile,
    comboPotentialProfile,
  });

  assert.equal(supported.floorBracket, 1, 'inferred support never changes the rules floor');
  assert.equal(supported.structuralStrengthBracket, 1);
  assert.equal(supported.assignedBracket, 2, 'multiple metadata factors still share one support step');
  assert.equal(supported.cohesionInfluenced, true);
  assert.equal(supported.comboPotentialInfluenced, true);
  assert.equal(supported.detectedComboFamilies.length, 0, 'potential loops never masquerade as complete combos');
  assert.equal(supported.detectedComboPatterns.length, 0);
  assert.ok(supported.evidence.some((item) => item.code === 'THEME_COHESION_SUPPORT' && item.title === '高密度主题主线'));
  assert.ok(supported.evidence.some((item) => item.code === 'UNLISTED_COMBO_STRUCTURE'));
  assert.match(buildBracketSummary(supported), /武具成员与支援牌形成清晰主线/);
  assert.match(buildBracketSummary(supported), /组合技结构线索/);
  assert.match(buildBracketSummary(supported), /辅助判断合计只上调一次/);

  const structured = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '1 Sol Ring',
    '1 Lotus Petal',
    '97 Theme Filler',
  ], { cohesionProfile, comboPotentialProfile });
  assert.equal(structured.structuralStrengthBracket, 3);
  assert.equal(structured.assignedBracket, 4);
  assert.equal(structured.assignedBracket < 5, true, 'inferred support cannot independently create B5');

  const incomplete = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '98 Theme Filler',
  ], { cohesionProfile, comboPotentialProfile });
  assert.equal(incomplete.cohesionInfluenced, false);
  assert.equal(incomplete.comboPotentialInfluenced, false);
});

test('USD estimate is only a weak B3 support and never acts as a floor or standalone strength score', () => {
  const expensiveLowSignal = analyze([
    'Commander',
    '1 Bear Cub',
    'Deck',
    '99 Luxury Filler',
  ], {
    metadataResult: makeMetadata([
      { name: 'Bear Cub', cmc: 3, usd: 100 },
      { name: 'Luxury Filler', cmc: 3, usd: 100 },
    ]),
  });
  assert.equal(expensiveLowSignal.deckMetrics.estimatedTotalUsd, 10000);
  assert.equal(expensiveLowSignal.assignedBracket, 1);
  assert.equal(expensiveLowSignal.floorBracket, 1);
  assert.equal(expensiveLowSignal.priceInfluenced, false);

  const multiAxisDeck = [
    'Commander',
    '1 Bear Cub',
    'Deck',
    '1 Sol Ring',
    '1 Lotus Petal',
    '1 Force of Will',
    '1 Fierce Guardianship',
    '95 Midrange Filler',
  ];
  const cheapMetadata = makeMetadata([
    { name: 'Bear Cub', cmc: 3, usd: 1 },
    { name: 'Sol Ring', cmc: 3, typeLine: 'Artifact', usd: 1 },
    { name: 'Lotus Petal', cmc: 3, typeLine: 'Artifact', usd: 1 },
    { name: 'Force of Will', cmc: 3, typeLine: 'Instant', usd: 1 },
    { name: 'Fierce Guardianship', cmc: 3, typeLine: 'Instant', usd: 1 },
    { name: 'Midrange Filler', cmc: 3, usd: 1 },
  ]);
  const expensiveMetadata = makeMetadata(Object.values(cheapMetadata.byName).map((entry) => ({
    ...entry,
    usd: 20,
  })));
  const cheap = analyze(multiAxisDeck, { metadataResult: cheapMetadata });
  const expensive = analyze(multiAxisDeck, { metadataResult: expensiveMetadata });
  const partialExpensive = analyze(multiAxisDeck, {
    metadataResult: makeMetadata(Object.values(cheapMetadata.byName)
      .filter((entry) => entry.name !== 'Midrange Filler')
      .map((entry) => ({ ...entry, usd: 1000 }))),
  });

  assert.equal(cheap.structuralStrengthBracket, 3);
  assert.equal(cheap.supportingSignalAxes, 2);
  assert.equal(cheap.assignedBracket, 3);
  assert.equal(expensive.assignedBracket, 4);
  assert.equal(expensive.priceInfluenced, true);
  assert.equal(expensive.floorBracket, cheap.floorBracket, 'price must never change the rules floor');
  assert.equal(partialExpensive.deckMetrics.priceReliable, false);
  assert.equal(partialExpensive.assignedBracket, 3, 'high partial sum cannot compensate for low coverage');
  assert.equal(partialExpensive.priceInfluenced, false);

  const floorLockedDeck = multiAxisDeck
    .map((line) => (line === '95 Midrange Filler' ? '94 Midrange Filler' : line))
    .concat('1 Armageddon');
  const floorLockedMetadata = makeMetadata(Object.values(expensiveMetadata.byName)
    .concat({ name: 'Armageddon', cmc: 4, typeLine: 'Sorcery', usd: 20 }));
  const floorLocked = analyze(floorLockedDeck, { metadataResult: floorLockedMetadata });
  assert.equal(floorLocked.priceRaisedStrength, true);
  assert.equal(floorLocked.priceInfluenced, false, 'a rules floor must remain the visible cause of the final bracket');
  assert.equal(floorLocked.assignedBracket, 4);
});

test('Adding exact hard violations never lowers the bracket floor', () => {
  const base = analyze(['Deck', '1 Forest']);
  const gameChanger = analyze(['Deck', '1 Forest', '1 Farewell']);
  const manyGameChangers = analyze(['Deck', '1 Farewell', '1 Biorhythm', '1 Rhystic Study', '1 Mystical Tutor']);
  const landDenial = analyze(['Deck', '1 Forest', '1 Ravages of War']);

  assert.ok(gameChanger.floorBracket >= base.floorBracket);
  assert.ok(manyGameChangers.floorBracket >= gameChanger.floorBracket);
  assert.equal(manyGameChangers.floorBracket, 4, 'four Game Changers must exceed the Upgraded allowance');
  assert.ok(landDenial.floorBracket >= base.floorBracket);
});

test('Free/alt-cost interaction alone caps at B3 and never independently reaches B4', () => {
  // 四张非 Game Changer 替费（Solitude/Fury/Grief/Endurance），无快速法术力/导师/combo：
  // 替费是反应性牌，只算「升级」信号封顶 B3，不再单独把结构冲到 B4。
  const freeControl = analyze([
    'Commander', '1 Bear Cub',
    'Deck',
    '1 Solitude', '1 Fury', '1 Grief', '1 Endurance',
    '95 Midrange Filler',
  ]);
  assert.equal(freeControl.floorBracket, 1, '这些替费都不是 Game Changer，规则下限保持 B1');
  assert.equal(freeControl.structuralStrengthBracket, 3, '替费密度只算升级信号，封顶 B3');
  assert.equal(freeControl.assignedBracket, 3, '纯替费控制不再单独进 B4');

  // 再堆一张替费（共五张）也仍是 B3——密度本身不再独立升档，需搭配主动信号或 GC 下限。
  const moreFree = analyze([
    'Commander', '1 Bear Cub',
    'Deck',
    '1 Solitude', '1 Fury', '1 Grief', '1 Endurance', '1 Subtlety',
    '94 Midrange Filler',
  ]);
  assert.equal(moreFree.structuralStrengthBracket, 3, '五张替费仍封顶 B3');
  assert.equal(moreFree.assignedBracket, 3);
});

test('Named Commander bans and Lutri companion status are reported without inventing a bracket', () => {
  assert.equal(BANNED_CARDS.length, 42);
  assert.ok(BANNED_CARDS.includes('Tinker'));
  assert.ok(BANNED_CARDS.includes("Yawgmoth's Bargain"));
  const banned = analyze(['Deck', '1 Mana Crypt']);
  assert.deepEqual(banned.bannedCards, ['Mana Crypt']);
  assert.equal(banned.legalityStatus, 'needs-fix');
  assert.equal(banned.provisional, true);

  const lutriCompanion = analyze(['Companion', '1 Lutri, the Spellchaser', 'Deck', '1 Island']);
  assert.deepEqual(lutriCompanion.bannedCards, ['Lutri, the Spellchaser']);

  const lutriDeck = analyze(['Deck', '1 Lutri, the Spellchaser']);
  assert.equal(lutriDeck.bannedCards.length, 0);
});

test('Oversized input is bounded and every parse error makes the result provisional', () => {
  const tooManyLines = Array.from({ length: 410 }, (_, index) => `1 Card ${index + 1}`).join('\n');
  const parsed = parseBracketDeck(tooManyLines);
  assert.equal(parsed.cards.length, 400);
  assert.ok(parsed.issues.some((issue) => issue.code === 'INPUT_LIMIT_EXCEEDED'));

  const invalid = analyzeBracketDeck('Deck\n0 Farewell\n1 Forest').result;
  assert.equal(invalid.provisional, true);
  assert.ok(invalid.parseIssues.some((issue) => issue.code === 'INVALID_QUANTITY' && issue.raw === '0 Farewell'));
});

test('Every result carries internal version metadata, evidence, confidence boundaries, and no 1–10 score', () => {
  const parsed = parseBracketDeck('Deck\n1 Sol Ring');
  const result = evaluateBracket(parsed);
  assert.ok(result.evidence.length >= 1);
  assert.ok(result.evidence.every((item) => item.ruleVersion === BRACKET_MANIFEST.ruleVersion));
  assert.equal(result.versions.evaluatorVersion, BRACKET_MANIFEST.evaluatorVersion);
  assert.equal(BRACKET_MANIFEST.evaluatorVersion, '2.7.0');
  assert.equal(BRACKET_MANIFEST.dataVersion, 'curated-en-2026-07-15-combo-families');
  assert.equal(result.versions.supportedLanguage, 'en');
  assert.equal(result.confidence, 'low');
  assert.equal(result.deckMetrics.estimatedTotalUsd, null);
  assert.doesNotMatch(JSON.stringify(result), /1-10|powerScore|saltScore/i);

  const syntacticallyValidUnknowns = analyzeBracketDeck([
    'Commander',
    '1 Definitely Not a Card',
    'Deck',
    '99 Also Not a Card',
  ].join('\n')).result;
  assert.equal(syntacticallyValidUnknowns.deckCardCount, 100);
  assert.equal(syntacticallyValidUnknowns.recognizedTriggerCount, 0);
  assert.equal(syntacticallyValidUnknowns.confidence, 'low');
  assert.equal(syntacticallyValidUnknowns.provisional, true);
});

test('Bracket summaries explain every applied step in natural, branch-specific language', () => {
  const base = {
    assignedBracket: 3,
    assignedWithoutMetrics: 3,
    assignedBeforePrice: 3,
    assignedBeforePromotion: 3,
    floorBracket: 1,
    structuralStrengthBracket: 3,
    structurallyComplete: true,
    legalityStatus: 'not-fully-verified',
    deckCardCount: 100,
    parseIssues: [],
    evidence: [],
    signals: [
      { key: 'fastMana', label: '快速法术力', count: 2 },
      { key: 'efficientTutor', label: '高效导师', count: 3 },
    ],
    detectedCombos: [],
    extraTurns: [],
    curveInfluenced: false,
    efficiencyInfluenced: false,
    priceInfluenced: false,
    supportingSignalAxes: 2,
    deckMetrics: {
      manaCoverage: 0.88,
      averageManaValue: 2.14,
      lowCurveRatio: 0.61,
      priceCoverage: 0.91,
      priceEligibleCount: 72,
      estimatedTotalUsd: 1500,
    },
    efficiencyProfile: {
      featureCoverage: 0.86,
      manaDeveloped: true,
      interactionDeveloped: true,
      flowDeveloped: false,
    },
  };

  const metadataSummary = buildBracketSummary({
    ...base,
    assignedBracket: 4,
    assignedBeforePromotion: 4,
    curveInfluenced: true,
    efficiencyInfluenced: true,
  });
  assert.match(metadataSummary, /平均 MV 为 2\.14[\s\S]*MV≤2 占 61%[\s\S]*低曲线门槛/);
  assert.match(metadataSummary, /前期法术力和低费互动与保护[\s\S]*对应门槛/);
  assert.doesNotMatch(metadataSummary, /覆盖 88%|覆盖 86%/);
  assert.doesNotMatch(metadataSummary, /低费过牌与滤牌/);
  assert.match(metadataSummary, /合计只上调一次[\s\S]*因此归于B4强度/);

  const priceSummary = buildBracketSummary({
    ...base,
    assignedBracket: 4,
    assignedBeforePromotion: 4,
    priceInfluenced: true,
  });
  assert.match(priceSummary, /曲线、构筑效率、主题稳定性和组合技结构没有先触发升档/);
  assert.match(priceSummary, /2 条强结构轴/);
  assert.doesNotMatch(priceSummary, /覆盖 91%|72 张计价牌/);
  assert.match(priceSummary, /基本地以外的牌估算约 \$1,500[\s\S]*\$1,200 的辅助线/);

  // 竞技阈值达标但余量未越过 B5 基准：B4.5 准竞技专属叙述
  const thresholdSummary = buildBracketSummary({
    ...base,
    assignedBracket: 4.5,
    competitiveSurplusScore: 0.25,
    signals: [
      { key: 'fastMana', label: '快速法术力', count: 3 },
      { key: 'efficientTutor', label: '高效导师', count: 3 },
      { key: 'freeInteraction', label: '免费互动', count: 2 },
    ],
    detectedCombos: [{ speed: 'early' }],
  });
  assert.match(thresholdSummary, /已经达到竞技构筑所需的密度[\s\S]*早期组合技/);
  assert.match(thresholdSummary, /余量约 25%[\s\S]*未越过 B5 基准[\s\S]*归于B4\.5准竞技强度/);
  assert.doesNotMatch(thresholdSummary, /主将池|预算线/);

  const competitiveSummary = buildBracketSummary({
    ...base,
    assignedBracket: 5,
    assignedWithoutMetrics: 5,
    assignedBeforePromotion: 5,
    signals: [
      { key: 'fastMana', label: '快速法术力', count: 3 },
      { key: 'efficientTutor', label: '高效导师', count: 3 },
      { key: 'freeInteraction', label: '免费互动', count: 2 },
    ],
    detectedCombos: [{ speed: 'early' }],
  });
  assert.match(competitiveSummary, /快速法术力、高效导师和免费互动[\s\S]*早期组合技/);
  assert.match(competitiveSummary, /因此归于B5强度/);

  const incompleteSummary = buildBracketSummary({
    ...base,
    assignedBracket: 2,
    assignedWithoutMetrics: 2,
    assignedBeforePromotion: 2,
    structuralStrengthBracket: 1,
    structurallyComplete: false,
    deckCardCount: 99,
    parseIssues: [{ code: 'MISSING_COMMANDER_SECTION' }],
    signals: [],
  });
  assert.match(incompleteSummary, /基础档位暂归于B2[\s\S]*暂时归于B2强度/);
  assert.doesNotMatch(incompleteSummary, /99 张|主将区段|牌表完整|覆盖/);

  const legalitySummary = buildBracketSummary({
    ...base,
    assignedBracket: 4,
    assignedWithoutMetrics: 4,
    assignedBeforePromotion: 4,
    floorBracket: 4,
    structuralStrengthBracket: 1,
    legalityStatus: 'needs-fix',
    evidence: [{ kind: 'rule', title: '大规模炸地与锁地' }],
    signals: [],
  });
  assert.match(legalitySummary, /大规模炸地与锁地[\s\S]*规则下限是 B4/);
  assert.match(legalitySummary, /暂时归于B4强度/);
  assert.doesNotMatch(legalitySummary, /禁牌|合法|修正/);

  const b1Summary = buildBracketSummary({
    ...base,
    assignedBracket: 1,
    assignedWithoutMetrics: 1,
    assignedBeforePromotion: 1,
    structuralStrengthBracket: 1,
    signals: [],
  });
  assert.match(b1Summary, /规则下限是 B1[\s\S]*没有发现会抬高下限的牌/);
  assert.match(b1Summary, /因此归于B1强度/);
  assert.doesNotMatch(b1Summary, /牌表结构完整/);
  const allSummaries = [
    metadataSummary,
    priceSummary,
    thresholdSummary,
    competitiveSummary,
    incompleteSummary,
    legalitySummary,
    b1Summary,
  ].join('\n');
  assert.doesNotMatch(allSummaries, /[。；]|覆盖\s*\d|牌表(?:结构)?完整|已收录的禁牌|张计价牌/);
  assert.doesNotMatch(allSummaries, /建议按 B|按 B[1-5] 使用/);
  assert.doesNotMatch(
    allSummaries,
    /综合可见|共同指向|综合建议|综合判定|高覆盖造价/,
  );

  const evidenceCopy = analyze([
    'Commander',
    '1 Kinnan, Bonder Prodigy',
    'Deck',
    '98 Island',
    '1 Sol Ring',
  ]).evidence.map((item) => item.detail).join('\n');
  assert.doesNotMatch(evidenceCopy, /[。；]/);
});

test('Bracket page and two home entries are wired without creating a Meta page', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const indexJs = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8');
  const indexWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const indexWxss = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxss'), 'utf8');
  const bracketJs = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.js'), 'utf8');
  const bracketWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.wxml'), 'utf8');
  const bracketWxss = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.wxss'), 'utf8');
  const bracketUtils = fs.readFileSync(path.join(root, 'miniprogram/utils/bracket.js'), 'utf8');
  const bracketData = fs.readFileSync(path.join(root, 'miniprogram/config/bracket-data.js'), 'utf8');
  const bracketJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.json'), 'utf8'));

  assert.ok(appJson.pages.includes('pages/bracket/bracket'));
  assert.ok(!appJson.pages.some((page) => /meta/i.test(page)));
  assert.ok(!fs.existsSync(path.join(root, 'miniprogram/pages/meta')));
  assert.match(indexWxml, /强度分级[\s\S]*BRACKET ANALYSIS/);
  assert.match(indexWxml, /环境梯度[\s\S]*META TIER LIST/);
  assert.match(indexJs, /goBracket\(\)[\s\S]*url:\s*'\/pages\/bracket\/bracket'/);
  assert.match(indexJs, /showMetaComingSoon\(\)[\s\S]*title:\s*'功能还在开发中，敬请期待！'[\s\S]*icon:\s*'none'/);
  const metaHandler = indexJs.slice(indexJs.indexOf('showMetaComingSoon()'));
  assert.doesNotMatch(metaHandler, /navigateTo/);
  assert.equal(bracketJson.navigationBarTitleText, '强度分级');
  assert.match(bracketJs, /fetchBracketCardMetadata/);
  assert.match(bracketJs, /evaluateBracket\(parsed, \{ metadataResult \}\)/);
  assert.match(bracketJs, /requestId !== this\.analysisRequestId/);
  assert.match(bracketJs, /onUnload\(\)[\s\S]*analysisRequestId/);
  // 完整证据抽屉已删除：全部证据直接列在判定依据内
  assert.doesNotMatch(bracketJs, /signalRows|comboRows|comboPotentialRows|gameChangersText|showDetails|toggleDetails/);
  assert.doesNotMatch(bracketWxml, /查看完整证据|details-toggle|details-body|detail-group|combo-row|showDetails/);
  assert.match(bracketWxml, /法术力曲线/);
  assert.match(bracketWxml, /非基本地预估造价（美元）/);
  // 档位色阶：结果态根类挂 tierClass（小数档点号转连字符），B1→B4.5→B5 冷灰蓝→翡翠→鎏金→燃橙→橙红→绯红渐显竞技
  assert.match(bracketWxml, /class="page bracket \{\{result \? 'has-result ' \+ result\.tierClass : 'is-input'\}\}"/);
  assert.match(bracketJs, /tierClass: `bracket-tier-\$\{String\(result\.assignedBracket\)\.replace\('\.', '-'\)\}`/);
  [
    ['1', '140,\\s*168,\\s*180'],
    ['2', '73,\\s*179,\\s*128'],
    ['3', '212,\\s*178,\\s*63'],
    ['4', '224,\\s*129,\\s*60'],
    ['4-5', '224,\\s*104,\\s*76'],
    ['5', '224,\\s*79,\\s*92'],
  ].forEach(([tier, rgb]) => {
    assert.match(
      bracketWxss,
      new RegExp(`\\.bracket\\.bracket-tier-${tier}\\s*{[^}]*--module-accent-rgb:\\s*${rgb}`),
      `bracket-tier-${tier} 应定义专属 accent 色`,
    );
  });
  assert.match(bracketJs, /覆盖范围：曲线[\s\S]*价格[\s\S]*构筑/);
  assert.match(bracketData, /label:\s*'高效导师'/);
  assert.match(bracketData, /label:\s*'高效制胜'/);
  assert.match(bracketData, /label:\s*'高效主将区引擎'/);
  assert.doesNotMatch([bracketData, bracketUtils].join('\n'), /\u6307\u6325\u533a/);
  assert.match(bracketUtils, /cardFlow:\s*cardSet\(\['efficientTutor', 'engine', 'efficientWinCondition'\]\)/);
  assert.doesNotMatch(bracketData, /高效检索/);
  assert.match(bracketWxml, /class="efficiency-summary"/);
  assert.match(bracketJs, /T1 可用地[\s\S]*常规加速[\s\S]*互动与保护[\s\S]*低费过牌/);
  assert.doesNotMatch(bracketJs, /（横置/);
  assert.doesNotMatch(bracketUtils, /（横置/);
  assert.match(bracketWxml, /支持 MTGO \/ Moxfield \/ MTGso 纯文本牌表/);
  assert.match(bracketWxml, /每行「数量 卡名」，主将以 Commander 标题或空行与主牌分隔/);
  assert.doesNotMatch(bracketWxml, /[。；]/);
  assert.ok(bracketWxml.indexOf('支持 MTGO') < bracketWxml.indexOf('<textarea'));
  assert.match(bracketWxml, /analyze-button \{\{canAnalyze \? 'is-ready' : 'is-idle'\}\} \{\{analyzing \? 'is-analyzing' : ''\}\}/);
  assert.match(bracketWxml, /disabled="\{\{!canAnalyze \|\| analyzing\}\}"/);
  assert.match(bracketWxml, /aria-busy="\{\{analyzing\}\}"/);
  assert.match(bracketWxml, /aria-label="\{\{analyzing \? '正在读取卡牌数据' : '开始分析牌表'\}\}"/);
  assert.match(bracketWxml, /class="analyze-visual" aria-hidden="true"[\s\S]*class="analyze-texture"[\s\S]*class="analyze-frame"[\s\S]*class="analyze-scan"/);
  assert.doesNotMatch(bracketWxml, /analyze-paper|analyze-particle/);
  assert.match(bracketWxml, /读取卡牌数据/);
  assert.doesNotMatch(bracketWxml, /读取卡牌数据…/);
  assert.doesNotMatch(bracketWxml, /analyze-mark|analyze-copy|analyze-subtitle|BRACKET ASSIGNMENT|牌张 \/ 组合技 \/ 构筑效率/);
  assert.doesNotMatch(bracketWxml, /data-loader/);
  assert.match(bracketWxss, /\.analyze-button\s*\{[\s\S]*position:\s*relative[\s\S]*min-height:\s*106rpx[\s\S]*overflow:\s*hidden/);
  assert.match(bracketWxss, /\.analyze-button\.is-idle[\s\S]*\.analyze-button\.is-ready[\s\S]*\.analyze-button\.is-analyzing/);
  assert.match(bracketWxss, /\.analyze-button\.is-analyzing\[disabled\][\s\S]*opacity:\s*1/);
  assert.match(bracketWxss, /\.analyze-content\s*\{[\s\S]*justify-content:\s*center[\s\S]*padding:\s*0 88rpx/);
  assert.match(bracketWxss, /\.analyze-title\s*\{[\s\S]*text-align:\s*center[\s\S]*white-space:\s*nowrap/);
  assert.match(bracketWxss, /\.analyze-status\s*\{[\s\S]*position:\s*absolute[\s\S]*right:\s*24rpx[\s\S]*transform:\s*translateY\(-50%\)/);
  assert.doesNotMatch(bracketWxss, /\.analyze-(?:mark|copy|subtitle)\s*\{/);
  assert.match(bracketWxss, /\.analyze-texture\s*\{[\s\S]*repeating-linear-gradient\(176deg[\s\S]*repeating-linear-gradient\(9deg/);
  assert.match(bracketWxss, /\.analyze-scan\s*\{[\s\S]*linear-gradient\(180deg[\s\S]*animation:\s*bracket-vertical-scan 2\.15s/);
  assert.match(bracketWxss, /@keyframes bracket-vertical-scan[\s\S]*translate3d\(0, 300%, 0\)/);
  assert.doesNotMatch(bracketWxss, /translate3d\([^,]+%, 0, 0\)/);
  assert.doesNotMatch(bracketWxss, /#ff2f7d|#35c8ff|#c864ff|bracket-spectrum-flow/);
  assert.doesNotMatch(bracketWxss, /box-shadow:\s*0 0 18rpx|text-shadow:[^;]*0 0 10rpx/);
  assert.doesNotMatch(bracketWxss, /analyze-paper|analyze-particle|bracket-paper-flow|bracket-particle-fall/);
  assert.match(bracketWxss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.analyze-scan\s*\{[\s\S]*animation:\s*none[\s\S]*\.result-enter\s*\{[\s\S]*animation:\s*none/);
  assert.match(bracketWxml, /maxlength="50000"/);
  assert.match(bracketWxml, /placeholder="粘贴你想测试强度的套牌"/);
  assert.match(bracketWxml, /disabled="\{\{analyzing\}\}"[\s\S]*aria-label="英文 Commander 牌表"/);
  assert.match(bracketWxml, /aria-label="清空当前牌表"/);
  assert.match(bracketWxml, /另有 \{\{result\.remainingParseErrorCount\}\} 行未展示/);
  assert.doesNotMatch(bracketWxml, /auto-height="false"/);
  assert.doesNotMatch(bracketWxml, /对局环境|格式说明|离线分析|BRACKET ANALYSIS|>强度分级|组合技作为主要胜法|<switch/);
  const bracketCopySources = [bracketWxml, bracketJs, bracketUtils, bracketData].join('\n');
  assert.doesNotMatch(bracketCopySources, /胜法|组合包|胜法包|规则包|数据包|·/);
  assert.doesNotMatch(bracketWxml, /边界与提示|缺失项不按 0 计|version-line|result\.warnings|result\.parseIssueRows/);
  assert.doesNotMatch(bracketWxss, /\.version-line|\.warning-row|\.warning-group|\.meta-dot/);
  assert.doesNotMatch(bracketJs, /versionText|完整合法性未校验/);
  assert.match(bracketWxml, /wx:if="\{\{result\.hasLegalityWarning\}\}"/);
  assert.match(bracketWxml, /legality-chip needs-fix">\{\{result\.legalityLabel\}\}/);
  assert.match(bracketJs, /legalityLabel:\s*'发现禁牌状态'/);
  assert.match(bracketJs, /卡牌数据暂不可用，已按本地规则分析/);
  assert.match(bracketWxml, /class="result-meta-line"/);
  // 主将卡图嵌入 hero 底层：不新增版面区域，单主将整幅、双拍档分屏，失败整层隐藏
  assert.match(bracketJs, /buildScryfallImageUrl\(name, 'art_crop'\)/);
  assert.match(bracketJs, /decorateResult\(evaluateBracket\(parsed, \{ metadataResult \}\), parsed\.commanders\)/);
  assert.match(bracketJs, /decorateResult\(evaluateBracket\(parsed\), parsed\.commanders\)/);
  assert.match(bracketWxml, /class="hero-art" wx:if="\{\{result\.heroArt\.mode !== 'none' && !heroArtHidden\}\}" aria-hidden="true"/);
  assert.match(bracketWxml, /wx:if="\{\{result\.heroArt\.mode === 'single'\}\}"[^>]*binderror="hideHeroArt"/);
  assert.match(bracketWxml, /wx:if="\{\{result\.heroArt\.mode === 'dual'\}\}" class="hero-art-split"/);
  assert.ok(bracketWxml.indexOf('hero-art') > bracketWxml.indexOf('result-hero'), '卡图应嵌在 hero 内部');
  assert.ok(bracketWxml.indexOf('hero-art') < bracketWxml.indexOf('result-mainline'), '卡图是底层而非新增区域');
  assert.match(bracketWxss, /\.hero-art\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*none/);
  assert.match(bracketWxss, /\.hero-art-scrim\s*\{[\s\S]*?rgba\(var\(--module-accent-rgb\)/);
  assert.match(bracketWxss, /\.hero-body\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1/);
  assert.match(bracketWxml, /class="result-confidence">置信度：\{\{result\.confidenceLabel\}\}/);
  assert.doesNotMatch(bracketWxml, /result\.deckCardCount/);
  assert.match(bracketWxss, /\.result-confidence\s*\{[\s\S]*margin-left:\s*auto[\s\S]*text-align:\s*right/);
  assert.deepEqual(
    [1, 2, 3, 4].map((bracket) => BRACKET_LABELS[bracket].turn),
    ['通常至少 9 回合取胜', '通常至少 8 回合取胜', '通常至少 6 回合取胜', '通常至少 4 回合取胜'],
  );
  // 准竞技缺少昂贵快速法术力或足够余量，起手爆发达不到成熟 cEDH：只有 B5 能写「任意回合」
  assert.equal(BRACKET_LABELS[4.5].turn, '通常至少 3 回合取胜');
  assert.equal(BRACKET_LABELS[5].turn, '可能在任意回合结束');
  assert.notEqual(BRACKET_LABELS[4.5].turn, BRACKET_LABELS[5].turn);
  assert.doesNotMatch(bracketWxml, /class="meta-item"/);
  assert.doesNotMatch(bracketWxml, /class="signal-strip"/);
  assert.match(bracketWxml, /wx:for="\{\{result\.efficiencyRows\}\}"[\s\S]*wx:for="\{\{result\.coverageRows\}\}"/);
  assert.match(bracketJs, /ordinal:\s*String\(index \+ 1\)\.padStart\(2, '0'\)/);
  assert.match(bracketJs, /const efficiencyRows = \[[\s\S]*const coverageRows = \[/);
  assert.match(bracketWxml, /class="result-action-dock"[\s\S]*aria-label="修改当前牌表"/);
  assert.match(bracketWxss, /\.result-action-dock\s*\{[\s\S]*position:\s*fixed/);
  assert.match(bracketWxss, /\.clear-link\s*\{[\s\S]*min-height:\s*76rpx/);
  assert.doesNotMatch(bracketWxss, /\.details-toggle|\.details-body|\.detail-group|\.combo-row|bracket-details-enter/);
  assert.match(bracketWxss, /\.edit-button\s*\{[\s\S]*min-height:\s*82rpx/);
  assert.doesNotMatch(bracketJs, /selectedIntent|intentOptions|selectIntent|showImportHelp|toggleImportHelp|comboIntent|handleComboIntent/);
  assert.doesNotMatch(bracketUtils, /comboIntent|DECLARED_INTENT/);
  assert.match(bracketWxss, /\.bracket\.is-input[\s\S]*overflow:\s*hidden/);
  assert.match(bracketWxss, /\.input-stage\s*\{[\s\S]*flex:\s*1 1 0[\s\S]*min-height:\s*0/);
  assert.match(bracketWxss, /\.deck-input\s*\{[\s\S]*flex:\s*1 1 0[\s\S]*height:\s*100%[\s\S]*min-height:\s*0/);
  assert.match(bracketJs, /\.slice\(0, 3\)/);

  assert.doesNotMatch(indexWxss, /--home-accent-rgb|\.home-button-(?:edhti|match|bracket|playtest|life|random|tracker|meta)\s*\{/);
  assert.match(indexWxss, /\.home-button\s*{[\s\S]*border-bottom:\s*1px solid rgba\(0,0,0,0\.35\)/);
  assert.match(indexWxss, /\.home-index-active\s*{[\s\S]*background:\s*#0A0A0A/);
});
