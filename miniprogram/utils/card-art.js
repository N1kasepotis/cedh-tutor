// 卡图直连：把卡名解析成 cards.scryfall.io 的直链，绕开 API 的 302 跳转。
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
// 直链按三级取，越靠前代价越低：
//   ① 构建期烤好的     config/commander-art.js，本地 100 位主将，**零请求**
//   ② 上次会话落的盘   同一副牌第二次打开，**零请求**
//   ③ 本次批量解析     /cards/collection，75 张一批，一副百张牌 2 次请求
// 三级都没有，才由调用方回落到按名取图的 302 慢路。
//
// 直链一律取自 collection 返回的 image_uris，不自己拼路径：
// 双面牌、异画、特殊系列的路径规则并不统一，自己拼迟早拼错。
//（落盘与烤表时会把地址压成 <id, 时间戳>，但那是**拿到真地址后逐档比对过**才压的，
//  判据在 utils/scryfall-cdn.js，跟「凭卡名瞎猜」是两回事。）

const { normalizeCardName, collectionIdentifier } = require('./scryfall');
const { buildCdnArt, compactCdnArt } = require('./scryfall-cdn');
const { buildBakedArt, hasBakedArt } = require('../config/commander-art');
const { readStorage, writeStorage } = require('./storage');

const SCRYFALL_COLLECTION_API = 'https://api.scryfall.com/cards/collection';
const COLLECTION_BATCH_SIZE = 75; // Scryfall 对该端点的硬上限
const REQUEST_TIMEOUT_MS = 12000;
// 缓存整副牌绰绰有余，同时给「连开几副牌」留余量；超出按插入序淘汰最旧的
const MAX_CACHED_CARDS = 600;

const CARD_ART_STORAGE_KEY = 'cardArtIndex';
const CARD_ART_SCHEMA_VERSION = 1;
// 落盘的直链带版本时间戳。卡换了新扫描图时旧地址仍然可用（CDN 上是实打实的文件），
// 只是可能不是最新那版扫描。给整张表一个 30 天保质期，到期整体丢弃重解析——
// 逐条记时间戳不值得，一次性丢弃省下的代码比省下的那几次请求更重要。
const CARD_ART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// 名字（小写规范化后）→ { small, normal, artCrop }
const artCache = new Map();
// 同名并发只发一次请求：syncView 会被反复调用，不去重会把同一批名字打好几遍
const inflight = new Map();

let hydrated = false;
let dirty = false;
let flushScheduled = false;

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

function trimCache() {
  while (artCache.size > MAX_CACHED_CARDS) {
    const oldest = artCache.keys().next().value;
    if (oldest === undefined) break;
    artCache.delete(oldest);
  }
}

// 把上次会话解析过的直链读回内存。只在第一次用到时读，不在 require 时读——
// 页面 require 这个模块是必然发生的，读盘却未必用得上。
function hydrateFromStorage() {
  if (hydrated) return;
  hydrated = true;

  const stored = readStorage(CARD_ART_STORAGE_KEY, {
    schemaVersion: CARD_ART_SCHEMA_VERSION,
    defaultValue: null,
  });
  const value = stored && stored.ok ? stored.value : null;
  if (!value || !Array.isArray(value.rows)) return;

  const savedAt = Number(value.savedAt);
  if (!Number.isFinite(savedAt) || Date.now() - savedAt > CARD_ART_MAX_AGE_MS) return;

  value.rows.forEach((row) => {
    if (!Array.isArray(row) || !row[0]) return;
    // 三项是压缩形式 <键, id, 时间戳>，四项是字面量 <键, small, normal, artCrop>
    const images = row.length === 3
      ? buildCdnArt(row[1], row[2])
      : { small: row[1] || '', normal: row[2] || '', artCrop: row[3] || '' };
    if (!images || (!images.small && !images.normal)) return;
    artCache.set(row[0], images);
  });
  trimCache();
}

function serializeCache() {
  const rows = [];
  artCache.forEach((images, key) => {
    // 构建期烤过的不落盘：那份表已经在包里了，再写一份到 storage 纯属占字节。
    // （烤表命中时 resolveKnown 会把它升进内存缓存，所以这里必须显式滤掉。）
    if (hasBakedArt(key)) return;
    const compact = compactCdnArt(images);
    if (compact) rows.push([key, compact.id, compact.stamp]);
    else rows.push([key, images.small, images.normal, images.artCrop]);
  });
  return rows;
}

// 落盘推迟到当前这一轮渲染之后：setStorageSync 是同步调用，
// 跟「解析完统一刷一次视图」的 setData 挤在同一个 tick 里，会直接加到首屏耗时上。
function scheduleFlush() {
  if (!dirty || flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    flushScheduled = false;
    if (!dirty) return;
    dirty = false;
    // 写失败无所谓：这只是省一趟请求的缓存，下次照旧能解析出来
    writeStorage(CARD_ART_STORAGE_KEY, {
      savedAt: Date.now(),
      rows: serializeCache(),
    }, { schemaVersion: CARD_ART_SCHEMA_VERSION });
  }, 0);
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
    dirty = true;
  });
  trimCache();
}

// 给已经手握 Scryfall 卡对象的调用方用：把里面的图顺手收进缓存，别再单独请求一次。
//
// 强度分级读牌表时本来就要把整副牌打一遍 /cards/collection 拿 cmc、类别、价格，
// 那份响应里**本来就带着 image_uris**，以前直接丢掉了，然后 hero 底图再去走一次
// 302 按名取图。收进来之后这张图是白得的，一次请求都不用加。
function rememberCardArt(card) {
  rememberCard(card);
  scheduleFlush();
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
    // 同一批里两张牌可能砍出同一个正面名，去重免得白占批量额度
    const identifiers = [];
    const seen = new Set();
    names.forEach((name) => {
      const identifier = collectionIdentifier(name);
      if (!identifier || seen.has(identifier)) return;
      seen.add(identifier);
      identifiers.push({ name: identifier });
    });
    if (!identifiers.length) {
      resolve();
      return;
    }
    wx.request({
      url: SCRYFALL_COLLECTION_API,
      method: 'POST',
      timeout: REQUEST_TIMEOUT_MS,
      header: { 'content-type': 'application/json', Accept: 'application/json' },
      data: { identifiers },
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

// 已经有直链的名字（内存 / 上次会话 / 构建期烤表）不必再问 Scryfall。
// 命中构建期烤表的顺手升进内存缓存，省掉之后每次查询重新拼串。
function resolveKnown(key) {
  if (!key) return null;
  const cached = artCache.get(key);
  if (cached) return cached;
  const baked = buildBakedArt(key);
  if (baked) {
    artCache.set(key, baked);
    return baked;
  }
  return null;
}

// 批量预解析一组卡名。返回的 Promise 永远 resolve；解析不到的名字留给调用方回落。
//
// options.onBatch：每批解析完调一次。传进来的名字**按调用方给的顺序**分批，
// 所以把「屏幕上真会显示的那几张」排在最前面，第一批一回来就能刷出图，
// 不必等整副牌跑完。百张牌是两批，这一下就把首图时间砍掉一半，而请求数不变。
function prefetchCardArt(names, options) {
  hydrateFromStorage();

  const onBatch = options && typeof options.onBatch === 'function' ? options.onBatch : null;
  const wanted = [];
  const seen = new Set();
  (names || []).forEach((raw) => {
    const key = cacheKey(raw);
    if (!key || seen.has(key) || inflight.has(key) || resolveKnown(key)) return;
    seen.add(key);
    wanted.push(normalizeCardName(raw));
  });
  if (!wanted.length) return Promise.resolve();

  const batches = chunk(wanted, COLLECTION_BATCH_SIZE);
  // 批次串行而不是并发：Scryfall 明确要求控制调用节奏，
  // 并发几批换不来多少速度，却更容易吃到 429
  const run = batches.reduce(
    (gate, batch) => gate.then(() => requestBatch(batch)).then(() => {
      // 回调里通常是一次 setData，抛异常不该把后面几批一起带走
      if (!onBatch) return;
      try {
        onBatch();
      } catch (error) {
        // 刷视图失败不影响解析本身，后面的批次继续跑
      }
    }),
    Promise.resolve(),
  );
  const settle = run.then(() => {
    wanted.forEach((name) => inflight.delete(cacheKey(name)));
    scheduleFlush();
  });
  wanted.forEach((name) => inflight.set(cacheKey(name), settle));
  return settle;
}

// 取已解析的直链；没解析到返回 null，由调用方决定回落
function getCardArt(name, version) {
  hydrateFromStorage();
  const images = resolveKnown(cacheKey(name));
  if (!images) return null;
  return images[version || 'small'] || images.normal || null;
}

function clearCardArtCache() {
  artCache.clear();
  inflight.clear();
  hydrated = false;
  dirty = false;
}

module.exports = {
  SCRYFALL_COLLECTION_API,
  COLLECTION_BATCH_SIZE,
  MAX_CACHED_CARDS,
  CARD_ART_STORAGE_KEY,
  CARD_ART_SCHEMA_VERSION,
  extractImageUris,
  rememberCardArt,
  prefetchCardArt,
  getCardArt,
  clearCardArtCache,
};
