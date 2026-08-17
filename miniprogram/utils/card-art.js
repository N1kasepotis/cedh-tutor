// 卡图直连：把卡名批量解析成 cards.scryfall.io 的直链，绕开 API 的 302 跳转。
//
// 为什么必须绕：项目原本所有卡图都指向
//   api.scryfall.com/cards/named?fuzzy=<名字>&format=image&version=small
// 这是 **API 端点而不是 CDN**。它每次都要服务端做一次模糊名检索，再回一个 302
// 指到 cards.scryfall.io。于是每张卡图的代价是「两次建连 + 一次服务端检索」，
// 而且这些请求全部算进 Scryfall 的调用频率约束里。
//
// 实测（同一张 Sol Ring 的 small 图，各三次取中位）：
//   经 API 重定向  3.31 / 5.75 / 4.33 s
//   直连 CDN       1.56 / 1.64 / 1.49 s      → 约 2.8 倍
// 缓存寿命差得更多：API 的 302 是 max-age=172800（2 天），
// CDN 图片是 max-age=31556952（1 年）。走 API 等于每两天把整副牌重下一遍。
//
// 一副 100 张的牌组，原本是约 100 次带 302 的 API 请求；
// 走这里是 2 次 collection 批量请求（75/批），之后每张图直连 CDN 且长期可缓存。
//
// 直链一律取自 collection 返回的 image_uris，不自己拼路径：
// 双面牌、异画、特殊系列的路径规则并不统一，自己拼迟早拼错。

const { normalizeCardName } = require('./scryfall');

const SCRYFALL_COLLECTION_API = 'https://api.scryfall.com/cards/collection';
const COLLECTION_BATCH_SIZE = 75; // Scryfall 对该端点的硬上限
const REQUEST_TIMEOUT_MS = 12000;
// 缓存整副牌绰绰有余，同时给「连开几副牌」留余量；超出按插入序淘汰最旧的
const MAX_CACHED_CARDS = 600;

// 名字（小写规范化后）→ { small, normal, artCrop }
const artCache = new Map();
// 同名并发只发一次请求：syncView 会被反复调用，不去重会把同一批名字打好几遍
const inflight = new Map();

function cacheKey(name) {
  return normalizeCardName(name).toLowerCase();
}

function extractImageUris(card) {
  // 双面牌的 image_uris 挂在 card_faces[0] 上，卡对象本身没有
  const uris = (card && card.image_uris)
    || (card && Array.isArray(card.card_faces) && card.card_faces[0] && card.card_faces[0].image_uris)
    || null;
  if (!uris) return null;
  const small = uris.small || uris.normal || '';
  const normal = uris.normal || uris.large || uris.small || '';
  const artCrop = uris.art_crop || normal;
  if (!small && !normal) return null;
  return { small, normal, artCrop };
}

function rememberCard(card) {
  const images = extractImageUris(card);
  if (!images) return;
  // 一张牌要落多个键，因为「牌表里写的名字」和「Scryfall 的正式卡名」经常不是一个字符串。
  //
  // 双面牌是重灾区：牌表写 `Malakir Rebirth`，Scryfall 的 card.name 是
  // `Malakir Rebirth // Malakir Mire`。初版只存了 card.name 与
  // card_faces.join(' // ')——这两个**完全相同**，单个正面名一次都没存进去，
  // 于是每张双面牌都查不到直链、全程走回落的 302 慢路。
  // cEDH 牌组里 MDFC 地是主力（Agadeem's Awakening、Turntimber Symbiosis 等），
  // 一副五到十五张，这一个疏漏足以把整体体验拖回改动之前。
  const names = [card && card.name];
  if (card && Array.isArray(card.card_faces)) {
    names.push(card.card_faces.map((face) => face && face.name).filter(Boolean).join(' // '));
    // 每一面的名字单独也要能查到——牌表通常只写正面
    card.card_faces.forEach((face) => names.push(face && face.name));
  }
  names.filter(Boolean).forEach((name) => {
    const key = cacheKey(name);
    if (!key) return;
    artCache.set(key, images);
  });
  while (artCache.size > MAX_CACHED_CARDS) {
    const oldest = artCache.keys().next().value;
    if (oldest === undefined) break;
    artCache.delete(oldest);
  }
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function requestBatch(names) {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || !wx.request) {
      resolve();
      return;
    }
    wx.request({
      url: SCRYFALL_COLLECTION_API,
      method: 'POST',
      timeout: REQUEST_TIMEOUT_MS,
      header: { 'content-type': 'application/json', Accept: 'application/json' },
      data: { identifiers: names.map((name) => ({ name })) },
      success: (response) => {
        const data = response && response.statusCode === 200 ? response.data : null;
        if (data && Array.isArray(data.data)) data.data.forEach(rememberCard);
        // not_found 不当错误：牌表里本来就可能有拼错的名字或自定义卡，
        // 它们会自然回落到原来的按名取图路径，不该拖垮整批
        resolve();
      },
      // 取图失败不是致命错误——调用方总有回落路径，所以这里不 reject，
      // 免得每个调用点都要写一遍 catch
      fail: () => resolve(),
    });
  });
}

// 批量预解析一组卡名。返回的 Promise 永远 resolve；解析不到的名字留给调用方回落。
function prefetchCardArt(names) {
  const wanted = [];
  const seen = new Set();
  (names || []).forEach((raw) => {
    const key = cacheKey(raw);
    if (!key || seen.has(key) || artCache.has(key) || inflight.has(key)) return;
    seen.add(key);
    wanted.push(normalizeCardName(raw));
  });
  if (!wanted.length) return Promise.resolve();

  const batches = chunk(wanted, COLLECTION_BATCH_SIZE);
  // 批次串行而不是并发：Scryfall 明确要求控制调用节奏，
  // 并发几批换不来多少速度，却更容易吃到 429
  const run = batches.reduce(
    (gate, batch) => gate.then(() => requestBatch(batch)),
    Promise.resolve(),
  );
  const settle = run.then(() => {
    wanted.forEach((name) => inflight.delete(cacheKey(name)));
  });
  wanted.forEach((name) => inflight.set(cacheKey(name), settle));
  return settle;
}

// 取已解析的直链；没解析到返回 null，由调用方决定回落
function getCardArt(name, version) {
  const images = artCache.get(cacheKey(name));
  if (!images) return null;
  return images[version || 'small'] || images.normal || null;
}

function clearCardArtCache() {
  artCache.clear();
  inflight.clear();
}

module.exports = {
  SCRYFALL_COLLECTION_API,
  COLLECTION_BATCH_SIZE,
  MAX_CACHED_CARDS,
  extractImageUris,
  prefetchCardArt,
  getCardArt,
  clearCardArtCache,
};
