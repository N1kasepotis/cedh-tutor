const { card, UUID } = require('../shared/contracts');
let queue = Promise.resolve();
let last = 0;
function request(query) {
  const work = async () => {
    const delay = Math.max(0, 550 - (Date.now() - last));
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    last = Date.now();
    return new Promise((resolve, reject) => {
      wx.request({
        url: `https://api.scryfall.com/cards/search?${query}`,
        timeout: 12000,
        header: { Accept: 'application/json' },
        success(response) {
          if (response.statusCode === 404) {
            resolve({ cards: [], more: false });
            return;
          }
          if (
            response.statusCode !== 200 ||
            !response.data ||
            !Array.isArray(response.data.data)
          ) {
            reject(
              new Error(
                response.statusCode === 429
                  ? '查询较频繁，请稍后再试'
                  : '卡牌服务暂时不可用',
              ),
            );
            return;
          }
          try {
            resolve({
              cards: response.data.data.map(card),
              more: Boolean(response.data.has_more),
            });
          } catch (_) {
            reject(new Error('卡牌资料不完整，请重试'));
          }
        },
        fail() {
          reject(new Error('卡牌加载失败，请检查网络后重试'));
        },
      });
    });
  };
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}
function search(value, page = 1) {
  const query = String(value || '')
    .trim()
    .slice(0, 100);
  if (!query) return Promise.resolve({ cards: [], more: false });
  return request(
    `q=${encodeURIComponent(query)}&unique=cards&include_multilingual=true&page=${page}`,
  ).then((result) => {
    const needle = query.toLocaleLowerCase();
    const rank = (entry) => {
      const names = [entry.name, entry.displayName].map((name) =>
        name.toLocaleLowerCase(),
      );
      if (names.includes(needle)) return 0;
      return names.some((name) => name.startsWith(needle)) ? 1 : 2;
    };
    return {
      ...result,
      cards: result.cards.sort((left, right) => rank(left) - rank(right)),
    };
  });
}
function prints(oracleId, lang, page = 1) {
  if (!UUID.test(oracleId)) return Promise.reject(new Error('卡牌资料不完整'));
  const safeLang = [
    'en',
    'zhs',
    'zht',
    'ja',
    'de',
    'fr',
    'it',
    'es',
    'pt',
    'ko',
    'ru',
    'any',
  ].includes(lang)
    ? lang
    : 'any';
  return request(
    `q=${encodeURIComponent(`oracleid:${oracleId} lang:${safeLang}`)}&unique=prints&include_multilingual=true&order=released&page=${page}`,
  );
}
module.exports = { search, prints };
