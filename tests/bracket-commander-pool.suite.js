const test = require('node:test');
const assert = require('node:assert/strict');

const { commanders } = require('../miniprogram/config/commanders');
const {
  commanderIdentityKey,
  isQuestionnaireCommanderPoolMatch,
} = require('../miniprogram/utils/bracket-commander-pool');

function commander(name, count = 1) {
  return { name, count };
}

test('Questionnaire commander matching covers every unique entry in the 100-entry source config', () => {
  assert.equal(commanders.length, 100);

  const identityKeys = commanders.map((entry) => {
    const cards = [commander(entry.name)];
    assert.equal(isQuestionnaireCommanderPoolMatch(cards), true, entry.name);
    return commanderIdentityKey(cards);
  });

  assert.ok(identityKeys.every(Boolean));
  assert.equal(new Set(identityKeys).size, commanders.length);
});

test('Partner matching is order-insensitive but requires the exact listed pair', () => {
  const listedPair = [
    commander('Tymna the Weaver'),
    commander("Kraum, Ludevic's Opus"),
  ];
  const reversedPair = listedPair.slice().reverse();

  assert.equal(isQuestionnaireCommanderPoolMatch(listedPair), true);
  assert.equal(isQuestionnaireCommanderPoolMatch(reversedPair), true);
  assert.equal(commanderIdentityKey(listedPair), commanderIdentityKey(reversedPair));
  assert.equal(
    isQuestionnaireCommanderPoolMatch([commander("Kraum, Ludevic's Opus / Tymna the Weaver")]),
    true,
  );
  assert.equal(isQuestionnaireCommanderPoolMatch([commander("Kraum, Ludevic's Opus")]), false);
  assert.equal(
    isQuestionnaireCommanderPoolMatch([
      commander("Kraum, Ludevic's Opus"),
      commander('Bear Cub'),
    ]),
    false,
  );
});

test('DFC commanders match by front face while a back face alone does not', () => {
  assert.equal(isQuestionnaireCommanderPoolMatch([commander('Ral, Monsoon Mage')]), true);
  assert.equal(
    isQuestionnaireCommanderPoolMatch([
      commander('Ral, Monsoon Mage // Ral, Leyline Prodigy'),
    ]),
    true,
  );
  assert.equal(isQuestionnaireCommanderPoolMatch([commander('Ral, Leyline Prodigy')]), false);
});

test('Commander identity normalization accepts export suffixes, case, spacing, and curved apostrophes', () => {
  assert.equal(
    isQuestionnaireCommanderPoolMatch([commander("  kinnan,   bonder prodigy (IKO) 192  ")]),
    true,
  );
  assert.equal(isQuestionnaireCommanderPoolMatch([commander('K’rrik, Son of Yawgmoth')]), true);
});

test('Invalid or ambiguous commander identities are rejected', () => {
  assert.equal(isQuestionnaireCommanderPoolMatch(null), false);
  assert.equal(isQuestionnaireCommanderPoolMatch([]), false);
  assert.equal(isQuestionnaireCommanderPoolMatch([commander('Bear Cub')]), false);
  assert.equal(isQuestionnaireCommanderPoolMatch([commander('Kinnan, Bonder Prodigy', 2)]), false);
  assert.equal(isQuestionnaireCommanderPoolMatch([commander('Kinnan, Bonder Prodigy', '1')]), false);
  assert.equal(
    isQuestionnaireCommanderPoolMatch([
      commander('Kinnan, Bonder Prodigy'),
      commander('Kinnan, Bonder Prodigy'),
    ]),
    false,
  );
  assert.equal(
    isQuestionnaireCommanderPoolMatch([
      commander('Kinnan, Bonder Prodigy'),
      commander('Tymna the Weaver'),
      commander("Kraum, Ludevic's Opus"),
    ]),
    false,
  );
  assert.equal(
    isQuestionnaireCommanderPoolMatch([
      commander("Kraum, Ludevic's Opus / Tymna the Weaver"),
      commander('Bear Cub'),
    ]),
    false,
  );
  assert.equal(commanderIdentityKey([{ count: 1, name: '' }]), '');
});
