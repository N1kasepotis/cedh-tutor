const { readStorage, writeStorage } = require('../../utils/storage');
const { UUID, VIEWS, table } = require('../shared/contracts');
const KEY = 'playerStudio';
function empty() {
  return { passports: {}, stances: {}, tables: [], swaps: [] };
}
function valid(value) {
  try {
    if (
      !value ||
      !value.passports ||
      Array.isArray(value.passports) ||
      !value.stances ||
      Array.isArray(value.stances) ||
      !Array.isArray(value.tables) ||
      !Array.isArray(value.swaps)
    )
      return false;
    const validCard = (card) =>
      card && UUID.test(card.printId) && typeof card.name === 'string';
    return (
      Object.values(value.passports).every(
        (entry) =>
          entry &&
          typeof entry.id === 'string' &&
          typeof entry.nickname === 'string' &&
          Array.isArray(entry.slots) &&
          entry.slots.length === 3 &&
          entry.slots.every((slot) => slot === null || validCard(slot)),
      ) &&
      Object.values(value.stances).every(
        (vote) =>
          vote &&
          ['keep', 'unban', 'mull', 'unknown'].includes(vote.choice) &&
          VIEWS.includes(vote.perspective),
      ) &&
      value.tables.every(
        (entry) =>
          entry && typeof entry.id === 'string' && Boolean(table(entry.values)),
      ) &&
      value.swaps.every(
        (entry) =>
          entry &&
          typeof entry.id === 'string' &&
          typeof entry.deckId === 'string' &&
          Array.isArray(entry.baselineIds) &&
          validCard(entry.inCard) &&
          validCard(entry.outCard) &&
          [3, 5, 10].includes(entry.target) &&
          ['testing', 'kept', 'reverted'].includes(entry.status),
      )
    );
  } catch (_) {
    return false;
  }
}
function load() {
  const result = readStorage(KEY, {
    schemaVersion: 1,
    defaultValue: empty(),
    validate: valid,
  });
  if (!result.ok) throw new Error('本机资料读取失败，已保留原始数据');
  return result.value;
}
function update(mutator) {
  const data = load();
  mutator(data);
  if (!writeStorage(KEY, data, { schemaVersion: 1, validate: valid }).ok)
    throw new Error('保存失败，请检查设备空间后重试');
  return data;
}
function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
module.exports = { load, update, id };
