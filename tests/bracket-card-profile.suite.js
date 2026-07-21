const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractStrengthFeatures,
  buildEfficiencyProfile,
  buildCohesionProfile,
  buildComboPotentialProfile,
} = require('../miniprogram/utils/bracket-card-profile');

function card(name, fields = {}) {
  return {
    name,
    cmc: 0,
    type_line: 'Land',
    oracle_text: '',
    ...fields,
  };
}

function features(name, fields) {
  return extractStrengthFeatures(card(name, fields));
}

test('land readiness separates unconditional, favorable, conditional, fetch, and dependent lands', () => {
  const forest = features('Forest', {
    type_line: 'Basic Land — Forest',
    produced_mana: ['G'],
  });
  const temple = features('Temple of Mystery', {
    oracle_text: 'Temple of Mystery enters tapped.\n{T}: Add {G} or {U}.',
  });
  const shock = features('Watery Grave', {
    oracle_text: 'As Watery Grave enters, you may pay 2 life. If you don\'t, it enters tapped.\n{T}: Add {U} or {B}.',
  });
  const fastLand = features('Spirebluff Canal', {
    oracle_text: 'Spirebluff Canal enters tapped unless you control two or fewer other lands.\n{T}: Add {U} or {R}.',
  });
  const checkLand = features('Glacial Fortress', {
    oracle_text: 'Glacial Fortress enters tapped unless you control a Plains or an Island.\n{T}: Add {W} or {U}.',
  });
  const battlebond = features('Rejuvenating Springs', {
    oracle_text: 'Rejuvenating Springs enters tapped unless you have two or more opponents.\n{T}: Add {G} or {U}.',
  });
  const fetch = features('Polluted Delta', {
    oracle_text: '{T}, Pay 1 life, Sacrifice Polluted Delta: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.',
  });
  const tappedFetch = features('Evolving Wilds', {
    oracle_text: '{T}, Sacrifice Evolving Wilds: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.',
  });
  const reflectingPool = features('Reflecting Pool', {
    produced_mana: ['W', 'U', 'B', 'R', 'G', 'C'],
    oracle_text: '{T}: Add one mana of any type that a land you control could produce.',
  });
  const filterLand = features('Sungrass Prairie', {
    produced_mana: ['G', 'W'],
    oracle_text: '{1}, {T}: Add {G}{W}.',
  });
  const dryad = features('Dryad Arbor', {
    type_line: 'Land Creature — Forest Dryad',
    produced_mana: ['G'],
    oracle_text: '{T}: Add {G}.',
  });

  assert.equal(forest.turnOneManaLand, true);
  assert.equal(temple.alwaysTappedLand, true);
  assert.equal(temple.turnOneManaLand, false);
  assert.equal(shock.turnOneManaLand, true);
  assert.equal(fastLand.turnOneManaLand, true);
  assert.equal(checkLand.turnOneManaLand, false);
  assert.equal(battlebond.turnOneManaLand, true);
  assert.equal(fetch.turnOneManaLand, true);
  assert.equal(tappedFetch.turnOneManaLand, false);
  assert.equal(reflectingPool.turnOneManaLand, false);
  assert.equal(filterLand.turnOneManaLand, false);
  assert.equal(dryad.turnOneManaLand, false, 'summoning-sick land creatures are not stable T1 sources');
});

test('only playable modal DFC land faces enter land readiness', () => {
  const tappedMdfc = extractStrengthFeatures(card('Bala Ged Recovery // Bala Ged Sanctuary', {
    layout: 'modal_dfc',
    cmc: 3,
    type_line: 'Sorcery // Land',
    oracle_text: undefined,
    card_faces: [
      { name: 'Bala Ged Recovery', cmc: 3, type_line: 'Sorcery', oracle_text: 'Return target card from your graveyard to your hand.' },
      { name: 'Bala Ged Sanctuary', cmc: 0, type_line: 'Land', oracle_text: 'Bala Ged Sanctuary enters tapped.\n{T}: Add {G}.', produced_mana: ['G'] },
    ],
  }));
  const untappedMdfc = extractStrengthFeatures(card('Sea Gate Restoration // Sea Gate, Reborn', {
    layout: 'modal_dfc',
    cmc: 7,
    type_line: 'Sorcery // Land',
    oracle_text: undefined,
    card_faces: [
      { name: 'Sea Gate Restoration', cmc: 7, type_line: 'Sorcery', oracle_text: 'Draw cards equal to the number of cards in your hand plus one.' },
      { name: 'Sea Gate, Reborn', cmc: 0, type_line: 'Land', oracle_text: 'As Sea Gate, Reborn enters, you may pay 3 life. If you don\'t, it enters tapped.\n{T}: Add {U}.', produced_mana: ['U'] },
    ],
  }));
  const transformBack = extractStrengthFeatures(card('Test Front // Test Back', {
    layout: 'transform',
    cmc: 2,
    type_line: 'Creature // Land',
    oracle_text: undefined,
    card_faces: [
      { name: 'Test Front', cmc: 2, type_line: 'Creature', oracle_text: '' },
      { name: 'Test Back', cmc: 0, type_line: 'Land', oracle_text: '{T}: Add {G}.', produced_mana: ['G'] },
    ],
  }));

  assert.equal(tappedMdfc.playableLand, true);
  assert.equal(tappedMdfc.alwaysTappedLand, true);
  assert.equal(tappedMdfc.turnOneManaLand, false);
  assert.equal(untappedMdfc.turnOneManaLand, true);
  assert.equal(transformBack.playableLand, false, 'a transform back face cannot be played as a land');
});

test('regular 1–2 MV ramp excludes rituals, sacrifice mana, high MV, and cost reduction', () => {
  const positive = [
    features('Llanowar Elves', { cmc: 1, type_line: 'Creature — Elf Druid', oracle_text: '{T}: Add {G}.' }),
    features('Arcane Signet', { cmc: 2, type_line: 'Artifact', oracle_text: '{T}: Add one mana of any color in your commander\'s color identity.' }),
    features("Nature's Lore", { cmc: 2, type_line: 'Sorcery', oracle_text: 'Search your library for a Forest card, put that card onto the battlefield, then shuffle.' }),
    features('Wild Growth', { cmc: 1, type_line: 'Enchantment — Aura', oracle_text: 'Enchant land\nWhenever enchanted land is tapped for mana, its controller adds an additional {G}.' }),
    features('Growth Spiral', { cmc: 2, type_line: 'Instant', oracle_text: 'Draw a card. You may put a land card from your hand onto the battlefield.' }),
  ];
  const negative = [
    features('Dark Ritual', { cmc: 1, type_line: 'Instant', oracle_text: 'Add {B}{B}{B}.' }),
    features('Blood Pet', { cmc: 1, type_line: 'Creature', oracle_text: 'Sacrifice Blood Pet: Add {B}.' }),
    features('Cultivate', { cmc: 3, type_line: 'Sorcery', oracle_text: 'Search your library for up to two basic land cards, put one onto the battlefield tapped and the other into your hand.' }),
    features('Goblin Electromancer', { cmc: 2, type_line: 'Creature', oracle_text: 'Instant and sorcery spells you cast cost {1} less to cast.' }),
  ];

  assert.ok(positive.every((entry) => entry.regularRamp12));
  assert.ok(negative.every((entry) => !entry.regularRamp12));
  assert.equal(positive[4].lowCostCardFlow, true, 'priority is applied by the aggregate profile, not by deleting secondary features');
});

test('interaction, graveyard interaction, and protection use constrained text semantics', () => {
  const counterspell = features('Counterspell', { cmc: 2, type_line: 'Instant', oracle_text: 'Counter target spell.' });
  const swords = features('Swords to Plowshares', { cmc: 1, type_line: 'Instant', oracle_text: 'Exile target creature. Its controller gains life equal to its power.' });
  const lantern = features('Soul-Guide Lantern', { cmc: 1, type_line: 'Artifact', oracle_text: 'When Soul-Guide Lantern enters, exile target card from a graveyard.\n{T}, Sacrifice Soul-Guide Lantern: Draw a card.' });
  const safekeeping = features("Tamiyo's Safekeeping", { cmc: 1, type_line: 'Instant', oracle_text: 'Target permanent you control gains hexproof and indestructible until end of turn. You gain 2 life.' });
  const silence = features('Silence', { cmc: 1, type_line: 'Instant', oracle_text: "Your opponents can't cast spells this turn." });
  const plusCounter = features('Training Trick', { cmc: 1, type_line: 'Instant', oracle_text: 'Put a +1/+1 counter on target creature.' });
  const selfHexproof = features('Slippery Bogle', { cmc: 1, type_line: 'Creature', oracle_text: 'Hexproof' });
  const reanimate = features('Reanimate', { cmc: 1, type_line: 'Sorcery', oracle_text: 'Put target creature card from a graveyard onto the battlefield under your control.' });
  const dauthi = features('Dauthi Voidwalker', { cmc: 2, type_line: 'Creature', oracle_text: "If a card would be put into an opponent's graveyard from anywhere, instead exile it with a void counter." });
  const chant = features("Orim's Chant", { cmc: 1, type_line: 'Instant', oracle_text: "Target player can't cast spells this turn." });

  assert.equal(counterspell.lowCostInteraction, true);
  assert.equal(swords.lowCostInteraction, true);
  assert.equal(lantern.graveyardInteraction, true);
  assert.equal(safekeeping.protection, true);
  assert.equal(silence.protection, true);
  assert.equal(plusCounter.lowCostInteraction, false);
  assert.equal(selfHexproof.protection, false, 'a permanent merely having hexproof is not a protection spell');
  assert.equal(reanimate.graveyardInteraction, false, 'graveyard use is not graveyard disruption');
  assert.equal(dauthi.graveyardInteraction, true);
  assert.equal(chant.protection, true);
});

test('low-cost flow recognizes draw/filtering but not tutors or opponent-only draw', () => {
  const positives = [
    features('Ponder', { cmc: 1, type_line: 'Sorcery', oracle_text: 'Look at the top three cards of your library, then put them back in any order. You may shuffle.\nDraw a card.' }),
    features('Consider', { cmc: 1, type_line: 'Instant', oracle_text: 'Look at the top card of your library. You may put that card into your graveyard.\nDraw a card.' }),
    features('Preordain', { cmc: 1, type_line: 'Sorcery', oracle_text: 'Scry 2, then draw a card.' }),
    features('Faithless Looting', { cmc: 1, type_line: 'Sorcery', oracle_text: 'Draw two cards, then discard two cards.' }),
    features('Night\'s Whisper', { cmc: 2, type_line: 'Sorcery', oracle_text: 'You draw two cards and you lose 2 life.' }),
    features("Sensei's Divining Top", { cmc: 1, type_line: 'Artifact', oracle_text: '{1}: Look at the top three cards of your library, then put them back in any order.' }),
    features("Wrenn's Resolve", { cmc: 2, type_line: 'Sorcery', oracle_text: 'Exile the top two cards of your library. Until the end of your next turn, you may play those cards.' }),
    features('Merfolk Looter', { cmc: 2, type_line: 'Creature', oracle_text: '{T}: Draw a card, then discard a card.' }),
  ];
  const tutor = features('Demonic Tutor', { cmc: 2, type_line: 'Sorcery', oracle_text: 'Search your library for a card, put that card into your hand, then shuffle.' });
  const opponentDraw = features('Generous Gift of Knowledge', { cmc: 1, type_line: 'Sorcery', oracle_text: 'Target opponent draws two cards.' });
  const eachOpponentDraw = features('Group Gift', { cmc: 1, type_line: 'Sorcery', oracle_text: 'Each opponent draws a card.' });
  const expensiveDraw = features('Concentrate', { cmc: 4, type_line: 'Sorcery', oracle_text: 'Draw three cards.' });

  assert.ok(positives.every((entry) => entry.lowCostCardFlow));
  assert.equal(tutor.lowCostCardFlow, false);
  assert.equal(opponentDraw.lowCostCardFlow, false);
  assert.equal(eachOpponentDraw.lowCostCardFlow, false);
  assert.equal(expensiveDraw.lowCostCardFlow, false);
});

test('cohesion tags require real members and payoffs instead of loose keyword proximity', () => {
  const equipment = features('Short Sword', { cmc: 1, type_line: 'Artifact — Equipment', oracle_text: 'Equipped creature gets +1/+1.\nEquip {1}.' });
  const equipmentPayoff = features('Equipment Mentor', { cmc: 2, type_line: 'Creature', oracle_text: 'Whenever an Equipment enters the battlefield under your control, draw a card.' });
  const aura = features('Ethereal Armor', { cmc: 1, type_line: 'Enchantment — Aura', oracle_text: 'Enchant creature\nEnchanted creature gets +1/+1.' });
  const auraPayoff = features('Aura Mentor', { cmc: 2, type_line: 'Creature', oracle_text: 'Aura spells you cast cost {1} less to cast.' });
  const looting = features('Faithless Looting', { cmc: 1, type_line: 'Sorcery', oracle_text: 'Draw two cards, then discard two cards.' });
  const targetedDiscard = features('Chosen Discard', { cmc: 1, type_line: 'Sorcery', oracle_text: 'Target opponent reveals their hand. You choose a nonland card from it. That player discards that card.' });
  const discardPayoff = features('Discard Payoff', { cmc: 2, type_line: 'Creature', oracle_text: 'Whenever an opponent discards a card, that player loses 1 life.' });
  const plusCounter = features('Counter Maker', { cmc: 2, type_line: 'Creature', oracle_text: 'Put a +1/+1 counter on target creature.' });
  const counterPayoff = features('Counter Payoff', { cmc: 3, type_line: 'Creature', oracle_text: 'Creatures you control with +1/+1 counters on them have trample.' });
  const voidCounter = features('Void Marker', { cmc: 2, type_line: 'Creature', oracle_text: 'Put a void counter on target permanent.' });
  const temporaryPump = features('Temporary Pump', { cmc: 1, type_line: 'Instant', oracle_text: 'Target creature gets +1/+1 until end of turn.' });
  const manaRock = features('Arcane Signet', { cmc: 2, type_line: 'Artifact', oracle_text: '{T}: Add one mana of any color in your commander\'s color identity.' });
  const disenchant = features('Disenchant', { cmc: 2, type_line: 'Instant', oracle_text: 'Destroy target artifact or enchantment.' });

  assert.deepEqual(equipment.cohesionRoles, ['artifact-member', 'equipment-member']);
  assert.ok(equipmentPayoff.cohesionRoles.includes('equipment-support'));
  assert.ok(aura.cohesionRoles.includes('aura-member'));
  assert.ok(auraPayoff.cohesionRoles.includes('aura-support'));
  assert.ok(looting.cohesionRoles.includes('discard-member'));
  assert.ok(targetedDiscard.cohesionRoles.includes('discard-member'));
  assert.ok(!looting.cohesionRoles.includes('discard-support'));
  assert.ok(discardPayoff.cohesionRoles.includes('discard-support'));
  assert.ok(plusCounter.cohesionRoles.includes('counter-member'));
  assert.ok(counterPayoff.cohesionRoles.includes('counter-support'));
  assert.equal(voidCounter.cohesionRoles.length, 0);
  assert.equal(temporaryPump.cohesionRoles.length, 0);
  assert.deepEqual(manaRock.cohesionRoles, ['artifact-member']);
  assert.equal(disenchant.cohesionRoles.length, 0, 'artifact removal is not artifact synergy');
});

test('combo roles only retain low-friction sacrifice, recursion, and terminal payoff text', () => {
  const outlet = features('Viscera Seer', { cmc: 1, type_line: 'Creature', oracle_text: 'Sacrifice a creature: Scry 1.' });
  const tappedOutlet = features('Slow Outlet', { cmc: 1, type_line: 'Creature', oracle_text: '{T}, Sacrifice a creature: Scry 1.' });
  const energyOutlet = features('Energy Outlet', { cmc: 1, type_line: 'Creature', oracle_text: '{E}, Sacrifice a creature: Scry 1.' });
  const recursion = features('Gravecrawler', { cmc: 1, type_line: 'Creature — Zombie', oracle_text: 'You may cast Gravecrawler from your graveyard as long as you control a Zombie.' });
  const broadGraveyardCaster = features('Graveyard Lecturer', { cmc: 1, type_line: 'Creature', oracle_text: 'You may cast creature spells from your graveyard.' });
  const broadGraveyardReturner = features('Graveyard Medic', { cmc: 1, type_line: 'Creature', oracle_text: 'Return target creature card from your graveyard to the battlefield.' });
  const expensiveRecursion = features('Slow Returner', { cmc: 2, type_line: 'Creature', oracle_text: 'You may cast Slow Returner from your graveyard.' });
  const restrictedRecursion = features('Turn-Limited Returner', { cmc: 1, type_line: 'Creature', oracle_text: 'You may cast Turn-Limited Returner from your graveyard only once each turn.' });
  const payoff = features('Zulaport Cutthroat', { cmc: 2, type_line: 'Creature', oracle_text: 'Whenever Zulaport Cutthroat or another creature you control dies, each opponent loses 1 life.' });
  const artifactOutlet = features('Artifact Outlet', { cmc: 2, type_line: 'Artifact', oracle_text: 'Sacrifice an artifact: Add {C}.' });
  const artifactRecursion = features('Tiny Relic', { cmc: 1, type_line: 'Artifact', oracle_text: 'You may cast Tiny Relic from your graveyard.' });
  const artifactPayoff = features('Vault Disciple', { cmc: 1, type_line: 'Creature', oracle_text: 'Whenever an artifact is put into a graveyard from the battlefield, target opponent loses 1 life.' });

  assert.ok(outlet.comboRoles.includes('free-creature-sacrifice'));
  assert.ok(!tappedOutlet.comboRoles.includes('free-creature-sacrifice'));
  assert.ok(!energyOutlet.comboRoles.includes('free-creature-sacrifice'));
  assert.ok(recursion.comboRoles.includes('creature-recursion'));
  assert.ok(!broadGraveyardCaster.comboRoles.includes('creature-recursion'), 'casting other cards from the graveyard is not self-recursion');
  assert.ok(!broadGraveyardReturner.comboRoles.includes('creature-recursion'), 'a one-shot return spell is not repeatable self-recursion');
  assert.ok(!expensiveRecursion.comboRoles.includes('creature-recursion'));
  assert.ok(!restrictedRecursion.comboRoles.includes('creature-recursion'));
  assert.ok(payoff.comboRoles.includes('creature-death-payoff'));
  assert.ok(artifactOutlet.comboRoles.includes('free-artifact-sacrifice'));
  assert.ok(artifactRecursion.comboRoles.includes('artifact-recursion'));
  assert.ok(artifactPayoff.comboRoles.includes('artifact-death-payoff'));
});

function profileMetadata(entries) {
  const byName = {};
  entries.forEach((entry) => {
    byName[entry.name.toLowerCase()] = {
      name: entry.name,
      strengthFeatures: { known: true, playableLand: false, nonland: true, ...entry.features },
    };
  });
  return { byName };
}

function profileCard(name, count = 1) {
  return { name, key: name.toLowerCase(), count, section: 'main' };
}

test('efficiency profile weights land slots, counts unique role cards, and applies all three thresholds', () => {
  const entries = [
    { name: 'Forest', features: { playableLand: true, nonland: false, turnOneManaLand: true } },
    ...Array.from({ length: 4 }, (_, index) => ({ name: `Ramp ${index + 1}`, features: { regularRamp12: true } })),
    ...Array.from({ length: 8 }, (_, index) => ({
      name: `Interaction ${index + 1}`,
      features: {
        lowCostInteraction: true,
        graveyardInteraction: index === 0,
        protection: index === 1 || index === 2,
      },
    })),
    ...Array.from({ length: 7 }, (_, index) => ({ name: `Flow ${index + 1}`, features: { lowCostCardFlow: true } })),
    { name: 'Known Filler', features: {} },
  ];
  const cards = [
    profileCard('Forest', 30),
    ...entries.filter((entry) => /^Ramp|^Interaction|^Flow/.test(entry.name)).map((entry) => profileCard(entry.name)),
    profileCard('Known Filler', 50),
  ];
  const profile = buildEfficiencyProfile(cards, profileMetadata(entries));

  assert.equal(profile.totalSlotCount, 99);
  assert.equal(profile.knownSlotCount, 99);
  assert.equal(profile.landCount, 30);
  assert.equal(profile.turnOneManaLandCount, 30);
  assert.equal(profile.regularRampCount, 4);
  assert.equal(profile.interactionCount, 8);
  assert.equal(profile.graveyardInteractionCount, 1);
  assert.equal(profile.protectionCount, 2);
  assert.equal(profile.cardFlowCount, 7);
  assert.equal(profile.strongAxisCount, 3);
  assert.equal(profile.band, 4);
  assert.equal(profile.reliable, true);
});

test('coverage gaps, role priority, exact exclusions, and illegal quantities cannot inflate axes', () => {
  const entries = [
    { name: 'Forest', features: { playableLand: true, nonland: false, turnOneManaLand: true } },
    { name: 'Sol Ring', features: { regularRamp12: true } },
    { name: 'Force of Will', features: { lowCostInteraction: true } },
    { name: 'Mystic Remora', features: { lowCostCardFlow: true } },
    { name: 'Growth Spiral', features: { regularRamp12: true, lowCostCardFlow: true } },
    { name: 'Remand', features: { lowCostInteraction: true, lowCostCardFlow: true } },
  ];
  const cards = [
    profileCard('Forest', 30),
    profileCard('Sol Ring', 20),
    profileCard('Force of Will', 20),
    profileCard('Mystic Remora', 20),
    profileCard('Growth Spiral', 4),
    profileCard('Remand', 5),
  ];
  const profile = buildEfficiencyProfile(cards, profileMetadata(entries), {
    regularRamp: new Set(['sol ring']),
    interaction: new Set(['force of will']),
    cardFlow: new Set(['mystic remora']),
  });

  assert.equal(profile.knownSlotCount, 99);
  assert.equal(profile.regularRampCount, 1, 'role cards are unique and Growth Spiral stays in ramp');
  assert.equal(profile.interactionCount, 1, 'Remand stays in interaction instead of also counting as flow');
  assert.equal(profile.cardFlowCount, 0);

  const partial = buildEfficiencyProfile(cards.concat(profileCard('Missing Data', 100)), profileMetadata(entries));
  assert.ok(partial.featureCoverage < 0.8);
  assert.equal(partial.reliable, false);
  assert.equal(partial.band, 1, 'unknown metadata is never treated as a zero-feature success');
});

test('cohesion profile requires supported density and recognizes a strong Equipment mainline', () => {
  const equipmentMembers = Array.from({ length: 13 }, (_, index) => ({
    name: `Equipment Member ${index + 1}`,
    features: { cohesionRoles: ['artifact-member', 'equipment-member'] },
  }));
  const equipmentSupports = Array.from({ length: 6 }, (_, index) => ({
    name: `Equipment Support ${index + 1}`,
    features: { cohesionRoles: ['equipment-support'] },
  }));
  const fillers = Array.from({ length: 50 }, (_, index) => ({
    name: `Equipment Filler ${index + 1}`,
    features: {},
  }));
  const entries = [
    { name: 'Forest', features: { playableLand: true, nonland: false } },
    ...equipmentMembers,
    ...equipmentSupports,
    ...fillers,
  ];
  const cards = [
    profileCard('Forest', 30),
    ...entries.slice(1).map((entry) => profileCard(entry.name)),
  ];
  const profile = buildCohesionProfile(cards, profileMetadata(entries));

  assert.equal(profile.totalSlotCount, 99);
  assert.equal(profile.nonlandUniqueCount, 69);
  assert.equal(profile.reliable, true);
  assert.equal(profile.dominantTheme.key, 'equipment');
  assert.equal(profile.dominantTheme.strong, true);
  assert.equal(profile.band, 4);

  const unsupportedEntries = [
    { name: 'Forest', features: { playableLand: true, nonland: false } },
    ...Array.from({ length: 20 }, (_, index) => ({
      name: `Unsupported Equipment ${index + 1}`,
      features: { cohesionRoles: ['artifact-member', 'equipment-member'] },
    })),
    ...Array.from({ length: 49 }, (_, index) => ({
      name: `Unsupported Filler ${index + 1}`,
      features: {},
    })),
  ];
  const unsupported = buildCohesionProfile([
    profileCard('Forest', 30),
    ...unsupportedEntries.slice(1).map((entry) => profileCard(entry.name)),
  ], profileMetadata(unsupportedEntries));

  assert.equal(unsupported.reliable, true);
  assert.equal(unsupported.dominantTheme, null, 'many members without support/payoff are not a stable mainline');
  assert.equal(unsupported.band, 1);
});

test('cohesion profile suppresses incomplete coverage and selects one dominant overlapping theme', () => {
  const overlapMembers = Array.from({ length: 17 }, (_, index) => ({
    name: `Overlap Equipment ${index + 1}`,
    features: { cohesionRoles: ['artifact-member', 'equipment-member'] },
  }));
  const overlapSupports = Array.from({ length: 6 }, (_, index) => ({
    name: `Overlap Support ${index + 1}`,
    features: { cohesionRoles: ['artifact-support', 'equipment-support'] },
  }));
  const fillers = Array.from({ length: 46 }, (_, index) => ({
    name: `Overlap Filler ${index + 1}`,
    features: {},
  }));
  const entries = [
    { name: 'Forest', features: { playableLand: true, nonland: false } },
    ...overlapMembers,
    ...overlapSupports,
    ...fillers,
  ];
  const cards = [
    profileCard('Forest', 30),
    ...entries.slice(1).map((entry) => profileCard(entry.name)),
  ];
  const profile = buildCohesionProfile(cards, profileMetadata(entries));

  assert.deepEqual(
    profile.themes.filter((theme) => theme.qualifies).map((theme) => theme.key),
    ['equipment', 'artifact'],
    'the same cards may establish both Equipment and Artifact signals',
  );
  assert.equal(profile.dominantTheme.key, 'equipment', 'overlapping signals still expose only one mainline');
  assert.equal(profile.band, 4);

  const partialEntries = entries.filter((entry) => !/^Overlap Filler (?:[1-9]|1\d|20)$/.test(entry.name));
  const partial = buildCohesionProfile(cards, profileMetadata(partialEntries));

  assert.ok(partial.featureCoverage < 0.8);
  assert.equal(partial.reliable, false);
  assert.equal(partial.dominantTheme, null);
  assert.equal(partial.band, 1);
});

test('combo potential needs distinct cards and grades one or two independent structures conservatively', () => {
  const roleEntries = [
    { name: 'Creature Outlet', features: { comboRoles: ['free-creature-sacrifice'] } },
    { name: 'Creature Returner', features: { comboRoles: ['creature-recursion'] } },
    { name: 'Creature Payoff', features: { comboRoles: ['creature-death-payoff'] } },
    { name: 'Artifact Outlet', features: { comboRoles: ['free-artifact-sacrifice'] } },
    { name: 'Artifact Returner', features: { comboRoles: ['artifact-recursion'] } },
    { name: 'Artifact Payoff', features: { comboRoles: ['artifact-death-payoff'] } },
  ];
  const fillers = Array.from({ length: 63 }, (_, index) => ({
    name: `Combo Filler ${index + 1}`,
    features: {},
  }));
  const entries = [
    { name: 'Forest', features: { playableLand: true, nonland: false } },
    ...roleEntries,
    ...fillers,
  ];
  const cards = [
    profileCard('Forest', 30),
    ...entries.slice(1).map((entry) => profileCard(entry.name)),
  ];
  const twoStructures = buildComboPotentialProfile(cards, profileMetadata(entries));

  assert.equal(twoStructures.reliable, true);
  assert.equal(twoStructures.potentialLoops.length, 2);
  assert.equal(twoStructures.band, 4);
  assert.equal(new Set(twoStructures.triggerCards.map((name) => name.toLowerCase())).size, 6);
  assert.ok(twoStructures.potentialLoops.every((loop) => new Set(loop.cards).size === 3));

  const knownComboExcluded = buildComboPotentialProfile(cards, profileMetadata(entries), {
    excludedCards: new Set(['Artifact Outlet']),
  });
  assert.deepEqual(
    knownComboExcluded.potentialLoops.map((loop) => loop.id),
    ['creature-sacrifice-recursion'],
    'a card already covered by a known combo cannot inflate the unlisted structure score',
  );
  assert.equal(knownComboExcluded.band, 3);

  const singleCardEntries = [
    { name: 'Forest', features: { playableLand: true, nonland: false } },
    {
      name: 'All-in-One Creature',
      features: {
        comboRoles: ['free-creature-sacrifice', 'creature-recursion', 'creature-death-payoff'],
      },
    },
    ...Array.from({ length: 68 }, (_, index) => ({
      name: `Distinctness Filler ${index + 1}`,
      features: {},
    })),
  ];
  const singleCard = buildComboPotentialProfile([
    profileCard('Forest', 30),
    ...singleCardEntries.slice(1).map((entry) => profileCard(entry.name)),
  ], profileMetadata(singleCardEntries));

  assert.equal(singleCard.reliable, true);
  assert.equal(singleCard.potentialLoops.length, 0, 'one multifunction card cannot fill three combo roles');
  assert.equal(singleCard.band, 1);
});

test('combo potential is disabled when compact card-feature coverage is incomplete', () => {
  const roleEntries = [
    { name: 'Creature Outlet', features: { comboRoles: ['free-creature-sacrifice'] } },
    { name: 'Creature Returner', features: { comboRoles: ['creature-recursion'] } },
    { name: 'Creature Payoff', features: { comboRoles: ['creature-death-payoff'] } },
    { name: 'Artifact Outlet', features: { comboRoles: ['free-artifact-sacrifice'] } },
    { name: 'Artifact Returner', features: { comboRoles: ['artifact-recursion'] } },
    { name: 'Artifact Payoff', features: { comboRoles: ['artifact-death-payoff'] } },
  ];
  const knownFillers = Array.from({ length: 43 }, (_, index) => ({
    name: `Covered Combo Filler ${index + 1}`,
    features: {},
  }));
  const entries = [
    { name: 'Forest', features: { playableLand: true, nonland: false } },
    ...roleEntries,
    ...knownFillers,
  ];
  const cards = [
    profileCard('Forest', 30),
    ...entries.slice(1).map((entry) => profileCard(entry.name)),
    profileCard('Missing Combo Metadata', 20),
  ];
  const profile = buildComboPotentialProfile(cards, profileMetadata(entries));

  assert.equal(profile.totalSlotCount, 99);
  assert.equal(profile.knownSlotCount, 79);
  assert.ok(profile.featureCoverage < 0.8);
  assert.equal(profile.reliable, false);
  assert.equal(profile.potentialLoops.length, 0);
  assert.equal(profile.band, 1);
});
