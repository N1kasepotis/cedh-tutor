const SCRYFALL_NAMED_API = 'https://api.scryfall.com/cards/named?fuzzy=';
const SCRYFALL_CARD_API = 'https://api.scryfall.com/cards/';
const SCRYFALL_REQUEST_TIMEOUT_MS = 8000;
const IMAGE_REQUEST_CACHE_LIMIT = 64;
const MAX_CONCURRENT_IMAGE_REQUESTS = 4;
const imageRequestCache = new Map();
const imageRequestQueue = [];
let activeImageRequests = 0;

function pumpImageRequestQueue() {
  while (activeImageRequests < MAX_CONCURRENT_IMAGE_REQUESTS && imageRequestQueue.length) {
    const job = imageRequestQueue.shift();
    activeImageRequests += 1;
    let task;
    try {
      task = job.task();
    } catch (error) {
      activeImageRequests -= 1;
      job.reject(error);
      continue;
    }
    Promise.resolve(task).then(
      (value) => {
        activeImageRequests -= 1;
        job.resolve(value);
        pumpImageRequestQueue();
      },
      (error) => {
        activeImageRequests -= 1;
        job.reject(error);
        pumpImageRequestQueue();
      },
    );
  }
}

function enqueueImageRequest(task) {
  const promise = new Promise((resolve, reject) => {
    imageRequestQueue.push({ task, resolve, reject });
  });
  pumpImageRequestQueue();
  return promise;
}

// 归一化卡名：把 Moxfield/MTGO 导出常用的弯引号（' ' ʼ ＇）替换为 ASCII 直引号。
// Scryfall 对弯引号（编码后 %E2%80%99）会返回 400，直引号才能命中；
// 重音字母（Lim-Dûl 等）不动——Scryfall 原生支持，strip 反而会查不到。
function normalizeCardName(name) {
  return String(name || '')
    .replace(/[‘’ʼ＇]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// /cards/collection 的 name 标识符**只认正面名，给全名一律 not_found**。
// 实测（2026-08）双面、拆分、融合、冒险四类全都如此：
//   'Agadeem's Awakening // Agadeem, the Undercrypt'  → 未找到
//   'Agadeem's Awakening'                            → 命中（返回的 name 反而是全名）
// Moxfield / Archidekt 导出的 MDFC 地、冒险生物全是全名写法，cEDH 牌组一副五到十五张。
// 不砍掉后半截，这些卡在批量端点上永远查不到：卡图退回 302 慢路，强度分级那边
// 则是连 cmc、类别、价格一起查不到，被直接算进「元数据未覆盖」。
// 只作用于批量端点的标识符——?fuzzy= 那条路径反而认全名，不要拿这个函数去改它。
function collectionIdentifier(name) {
  return normalizeCardName(name).split(/\s*\/\/\s*/)[0].trim();
}

// encodeURIComponent 不编码 ! ' ( ) *，会在 URL 里留下裸撇号。
// 微信 <image> / getImageInfo 的 URL 解析比浏览器严格，裸撇号会导致带撇号的卡
// （Thassa's Oracle、Lion's Eye Diamond 等）图片加载失败——补全这几个字符的编码。
function encodeCardParam(name) {
  return encodeURIComponent(name).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildScryfallNamedUrl(cardName) {
  return `${SCRYFALL_NAMED_API}${encodeCardParam(normalizeCardName(cardName))}`;
}

// 使用 fuzzy 匹配，兼容特殊字符（如 Splinter Twin 含空格、带撇号卡名等）
// 直连图片地址：Scryfall 会 302 到 CDN 图片，<image> 组件可直接加载，
// 不依赖 wx.request（也就不受 request 合法域名限制）。
// 默认使用 normal 版本（完整卡框图），所有卡均支持。
function buildScryfallImageUrl(cardName, version) {
  return `${buildScryfallNamedUrl(cardName)}&format=image&version=${version || 'normal'}`;
}

// 按 Scryfall ID 取图：比 ?fuzzy= 名字模糊匹配精确，不受中英文卡名与印次歧义影响。
// 环境梯度里每位指挥官都带经编辑核对过的 scryfall_id，走这条路不会取错卡；
// 同样是 <image> 直连 302 到 CDN，不经 wx.request。
function buildScryfallImageUrlById(scryfallId, version) {
  const id = encodeURIComponent(String(scryfallId || '').trim());
  if (!id) return '';
  return `${SCRYFALL_CARD_API}${id}?format=image&version=${version || 'normal'}`;
}

function extractCardImageUris(card) {
  const imageUris = card && (card.image_uris
    || (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris))
    || {};

  return {
    artCrop: imageUris.art_crop || imageUris.normal || '',
    normal: imageUris.normal || imageUris.large || imageUris.art_crop || '',
    large: imageUris.large || imageUris.normal || '',
  };
}

function fetchCardImageUris(cardName) {
  const normalizedName = normalizeCardName(cardName);
  if (!normalizedName) return Promise.reject(new Error('Invalid card name'));
  if (imageRequestCache.has(normalizedName)) return imageRequestCache.get(normalizedName);

  const request = enqueueImageRequest(() => new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.request) {
      reject(new Error('wx.request unavailable'));
      return;
    }

    wx.request({
      url: buildScryfallNamedUrl(normalizedName),
      method: 'GET',
      timeout: SCRYFALL_REQUEST_TIMEOUT_MS,
      // 不设 User-Agent：它是禁止的请求头，wx.request 已带自身 UA，显式设置会被基础库拒绝
      header: {
        Accept: 'application/json',
      },
      success: (response) => {
        if (!response || response.statusCode !== 200) {
          const statusCode = response && response.statusCode;
          reject(new Error(`Scryfall API returned ${statusCode || 'invalid response'}`));
          return;
        }
        if (!response.data || typeof response.data !== 'object') {
          reject(new Error('Scryfall API returned invalid data'));
          return;
        }

        const images = extractCardImageUris(response.data);
        if (!images.artCrop && !images.normal && !images.large) {
          reject(new Error('Scryfall card has no image'));
          return;
        }
        resolve(images);
      },
      fail: (cause) => reject(cause instanceof Error ? cause : new Error('Scryfall request failed')),
    });
  }));

  // 同一张卡的并发请求复用一个 Promise；失败后删除，允许用户下次重试。
  const cachedRequest = request.catch((error) => {
    imageRequestCache.delete(normalizedName);
    throw error;
  });
  imageRequestCache.set(normalizedName, cachedRequest);
  if (imageRequestCache.size > IMAGE_REQUEST_CACHE_LIMIT) {
    const oldestKey = imageRequestCache.keys().next().value;
    if (oldestKey !== normalizedName) imageRequestCache.delete(oldestKey);
  }
  return cachedRequest;
}

module.exports = {
  SCRYFALL_NAMED_API,
  SCRYFALL_CARD_API,
  SCRYFALL_REQUEST_TIMEOUT_MS,
  MAX_CONCURRENT_IMAGE_REQUESTS,
  normalizeCardName,
  collectionIdentifier,
  buildScryfallNamedUrl,
  buildScryfallImageUrl,
  buildScryfallImageUrlById,
  extractCardImageUris,
  fetchCardImageUris,
};
