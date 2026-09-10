const local = require('./local');
const { readStorage } = require('../../utils/storage');
const { trackerConfig } = require('../../config/tracker');
function error(page, value) {
  if (!page.disposed)
    page.setData({ error: value.message || String(value), busy: false });
}
async function run(page, work) {
  if (page.data.busy) return;
  page.setData({ busy: true, error: '' });
  try {
    await work();
  } catch (reason) {
    error(page, reason);
  } finally {
    if (!page.disposed) page.setData({ busy: false });
  }
}
function decks() {
  const read = readStorage(trackerConfig.storageKey, {
    schemaVersion: trackerConfig.version,
    defaultValue: { decks: [] },
    validate: (v) => v && Array.isArray(v.decks),
  });
  if (!read.ok) throw new Error('战绩读取失败，暂时无法关联套牌');
  return read.value.decks.map((deck, i) => ({
    id: deck.id,
    name: (deck.commander && deck.commander.name) || `第 ${i + 1} 套牌`,
    matches: deck.matches || [],
  }));
}
function save(page, mutator) {
  return run(page, () => {
    local.update(mutator);
    wx.showToast({ title: '已保存', icon: 'success' });
  });
}
module.exports = { error, run, decks, save };
