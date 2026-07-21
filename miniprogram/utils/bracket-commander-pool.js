const { normalizeCardName } = require('./scryfall');
const { CARD_ALIASES } = require('../config/bracket-data');

const PARTNER_SEPARATOR = /\s+\/\s+/;
const DFC_SEPARATOR = /\s+\/\/\s+/;
const IDENTITY_SEPARATOR = '\u001f';

let questionnaireCommanderIdentityKeys = null;

function normalizeImportedCommanderName(name) {
  return normalizeCardName(name)
    .replace(/\s+\([A-Z0-9]{2,8}\)\s+[A-Z0-9★]+(?:\s+\*F\*)?$/i, '')
    .replace(/\s+\*F\*$/i, '')
    .trim();
}

function canonicalCommanderFaceKey(name) {
  const normalized = normalizeImportedCommanderName(name).split(DFC_SEPARATOR)[0].trim();
  if (!normalized) return '';

  const normalizedKey = normalized.toLowerCase();
  const alias = CARD_ALIASES[normalizedKey];
  return normalizeCardName(alias || normalized)
    .split(DFC_SEPARATOR)[0]
    .trim()
    .toLowerCase();
}

function expandCommanderName(name) {
  const normalized = normalizeImportedCommanderName(name);
  if (!normalized) return [];

  // A single slash is this project’s partner separator. A double slash is a
  // single transforming card, whose front face is its command-zone identity.
  const names = normalized.includes(' / ') && !normalized.includes(' // ')
    ? normalized.split(PARTNER_SEPARATOR)
    : [normalized];
  return names.map(canonicalCommanderFaceKey).filter(Boolean);
}

function commanderIdentityKey(commanderCards) {
  if (!Array.isArray(commanderCards) || commanderCards.length < 1 || commanderCards.length > 2) {
    return '';
  }

  const names = [];
  for (const card of commanderCards) {
    if (!card || card.count !== 1) return '';
    const expanded = expandCommanderName(card.name);
    if (!expanded.length) return '';
    names.push(...expanded);
  }

  if (names.length < 1 || names.length > 2 || new Set(names).size !== names.length) return '';
  return names.sort().join(IDENTITY_SEPARATOR);
}

function getQuestionnaireCommanderIdentityKeys() {
  if (questionnaireCommanderIdentityKeys) return questionnaireCommanderIdentityKeys;

  // Keep the 100-entry questionnaire config as the only source of truth. The
  // larger config is evaluated only when a bracket candidate actually needs a
  // pool lookup, then CommonJS and this Set cache make subsequent checks cheap.
  const { commanders } = require('../config/commanders');
  questionnaireCommanderIdentityKeys = new Set(
    commanders
      .map((commander) => commanderIdentityKey([{ count: 1, name: commander.name }]))
      .filter(Boolean),
  );
  return questionnaireCommanderIdentityKeys;
}

function isQuestionnaireCommanderPoolMatch(commanderCards) {
  const identityKey = commanderIdentityKey(commanderCards);
  return Boolean(identityKey && getQuestionnaireCommanderIdentityKeys().has(identityKey));
}

module.exports = {
  commanderIdentityKey,
  isQuestionnaireCommanderPoolMatch,
};
