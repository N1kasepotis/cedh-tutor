const { normalizeCardName, collectionIdentifier } = require('./scryfall');
const { extractStrengthFeatures } = require('./bracket-card-profile');
const { rememberCardArt } = require('./card-art');

const SCRYFALL_COLLECTION_API = 'https://api.scryfall.com/cards/collection';
const SCRYFALL_SEARCH_API = 'https://api.scryfall.com/cards/search';
const SCRYFALL_COLLECTION_BATCH_SIZE = 75;
const SCRYFALL_PRICE_SEARCH_BATCH_SIZE = 10;
const SCRYFALL_COLLECTION_TIMEOUT_MS = 12000;
const TRANSIENT_RETRY_DELAY_MS = 120;
const RATE_LIMIT_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 5000;
const METADATA_CACHE_LIMIT = 1536;
const PRICE_CACHE_LIMIT = 1536;
const MISSING_CACHE_LIMIT = 512;

const metadataCache = new Map();
const oraclePriceCache = new Map();
const missingMetadataCache = new Set();
const missingPriceOracleCache = new Set();
const inFlightMetadataRequests = new Map();
const inFlightPriceRequests = new Map();

function metadataKey(name) {
  return normalizeCardName(name).toLowerCase();
}

function normalizeOracleId(value) {
  return value === null || value === undefined ? '' : String(value).trim().toLowerCase();
}

function parseUsdPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function extractBracketCardMetadata(card) {
  if (!card || typeof card !== 'object') return null;
  const name = normalizeCardName(card.name);
  if (!name) return null;

  const frontFace = Array.isArray(card.card_faces) && card.card_faces[0]
    ? card.card_faces[0]
    : null;
  const rawCmc = card.cmc === null || card.cmc === undefined || card.cmc === ''
    ? frontFace && frontFace.cmc
    : card.cmc;
  const cmc = rawCmc === null || rawCmc === undefined || rawCmc === ''
    ? NaN
    : Number(rawCmc);
  const typeLine = normalizeCardName(card.type_line);
  const frontTypeLine = normalizeCardName(
    (frontFace && frontFace.type_line) || typeLine.split(' // ')[0],
  );

  return {
    name,
    oracleId: normalizeOracleId(
      card.oracle_id || (frontFace && frontFace.oracle_id),
    ) || null,
    cmc: Number.isFinite(cmc) && cmc >= 0 ? cmc : null,
    typeLine,
    frontTypeLine,
    strengthFeatures: extractStrengthFeatures(card),
    // Only Scryfall's nonfoil USD field is accepted. Missing prices stay null.
    usd: parseUsdPrice(card.prices && card.prices.usd),
  };
}

function trimMapCache(cache, limit) {
  while (cache.size > limit) {
    cache.delete(cache.keys().next().value);
  }
}

function trimSetCache(cache, limit) {
  while (cache.size > limit) {
    cache.delete(cache.values().next().value);
  }
}

function cacheCardMetadata(card) {
  const metadata = extractBracketCardMetadata(card);
  if (!metadata) return;

  // 这份响应里本来就带着 image_uris，以前直接丢掉，然后 hero 底图再去按名走一次 302。
  // 顺手收进卡图缓存，等于白得——强度分级页面的主将图因此一次请求都不用加。
  rememberCardArt(card);

  if (metadata.usd === null && metadata.oracleId && oraclePriceCache.has(metadata.oracleId)) {
    metadata.usd = oraclePriceCache.get(metadata.oracleId);
  }
  if (metadata.usd !== null && metadata.oracleId) {
    oraclePriceCache.set(metadata.oracleId, metadata.usd);
    missingPriceOracleCache.delete(metadata.oracleId);
    trimMapCache(oraclePriceCache, PRICE_CACHE_LIMIT);
  }

  const aliases = [metadata.name, card.printed_name];
  if (Array.isArray(card.card_faces)) {
    card.card_faces.forEach((face) => {
      if (face && face.name) aliases.push(face.name);
      if (face && face.printed_name) aliases.push(face.printed_name);
    });
  }

  aliases.forEach((name) => {
    const key = metadataKey(name);
    if (!key) return;
    metadataCache.set(key, metadata);
    missingMetadataCache.delete(key);
  });
  trimMapCache(metadataCache, METADATA_CACHE_LIMIT);
}

function markMissing(identifier) {
  const name = identifier && typeof identifier === 'object' ? identifier.name : identifier;
  const key = metadataKey(name);
  if (!key || metadataCache.has(key)) return;
  missingMetadataCache.add(key);
  trimSetCache(missingMetadataCache, MISSING_CACHE_LIMIT);
}

function parseRetryAfterMs(response) {
  const headers = response && (response.header || response.headers);
  if (!headers || typeof headers !== 'object') return null;
  const retryAfterKey = Object.keys(headers).find((key) => key.toLowerCase() === 'retry-after');
  if (!retryAfterKey) return null;
  const seconds = Number(headers[retryAfterKey]);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(MAX_RETRY_DELAY_MS, Math.round(seconds * 1000));
}

function createRequestError(message, statusCode, transient, retryAfterMs) {
  const error = new Error(message);
  error.statusCode = statusCode || null;
  error.transient = Boolean(transient);
  error.retryAfterMs = Number.isFinite(retryAfterMs) ? retryAfterMs : null;
  return error;
}

function isTransientStatus(statusCode) {
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function getRetryDelayMs(error) {
  if (error && error.statusCode === 429) {
    const requestedDelay = Number.isFinite(error.retryAfterMs)
      ? error.retryAfterMs
      : RATE_LIMIT_RETRY_DELAY_MS;
    return Math.min(MAX_RETRY_DELAY_MS, Math.max(TRANSIENT_RETRY_DELAY_MS, requestedDelay));
  }
  return TRANSIENT_RETRY_DELAY_MS;
}

function waitBeforeRetry(error) {
  return new Promise((resolve) => {
    setTimeout(resolve, getRetryDelayMs(error));
  });
}

function requestJson(options, parsePayload) {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.request) {
      reject(createRequestError('wx.request unavailable', null, false));
      return;
    }

    wx.request({
      ...options,
      success: (response) => {
        const statusCode = response && response.statusCode;
        if (statusCode !== 200) {
          reject(createRequestError(
            `Scryfall returned ${statusCode || 'invalid response'}`,
            statusCode,
            isTransientStatus(statusCode),
            statusCode === 429 ? parseRetryAfterMs(response) : null,
          ));
          return;
        }

        try {
          resolve(parsePayload(response.data));
        } catch (cause) {
          reject(createRequestError(
            cause && cause.message ? cause.message : 'Scryfall returned invalid data',
            statusCode,
            false,
          ));
        }
      },
      fail: (cause) => {
        const message = cause && cause.errMsg ? cause.errMsg : 'Scryfall request failed';
        reject(createRequestError(message, null, true));
      },
    });
  });
}

function requestWithSingleRetry(requestFactory) {
  return requestFactory().then(
    (value) => ({ value, retryCount: 0 }),
    (error) => {
      if (!error || !error.transient) {
        if (error) error.retryCount = 0;
        throw error;
      }
      return waitBeforeRetry(error).then(() => requestFactory().then(
        (value) => ({ value, retryCount: 1 }),
        (finalError) => {
          if (finalError) finalError.retryCount = 1;
          throw finalError;
        },
      ));
    },
  );
}

function requestCollectionBatch(names) {
  return requestWithSingleRetry(() => requestJson({
    url: SCRYFALL_COLLECTION_API,
    method: 'POST',
    timeout: SCRYFALL_COLLECTION_TIMEOUT_MS,
    // 不设 User-Agent：禁止的请求头，wx.request 自带 UA，显式设置会被基础库拒绝（Refused to set unsafe header）
    header: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    data: {
      // 只能发正面名：collection 端点对 `A // B` 全名一律回 not_found。
      // 以前直接发牌表原文，于是每张 MDFC 地、冒险生物、拆分牌都拿不到
      // cmc / 类别 / 价格——不是慢，是**根本没进强度判定**，还会把「元数据覆盖率」压低。
      // 同一批里两张牌砍出同一个正面名时去重，免得白占批量额度。
      identifiers: Array.from(new Set(names.map(collectionIdentifier).filter(Boolean)))
        .map((name) => ({ name })),
    },
  }, (payload) => {
    if (!payload || !Array.isArray(payload.data)) {
      throw new Error('Scryfall collection returned invalid data');
    }
    return {
      cards: payload.data,
      notFound: Array.isArray(payload.not_found) ? payload.not_found : [],
    };
  }));
}

function buildPriceSearchUrl(oracleIds) {
  const oracleQuery = oracleIds.map((oracleId) => `oracleid:${oracleId}`).join(' or ');
  const query = `(${oracleQuery}) game:paper usd>0`;
  return `${SCRYFALL_SEARCH_API}?q=${encodeURIComponent(query)}&unique=cards&order=usd&dir=asc`;
}

function requestPriceSearchBatch(oracleIds) {
  return requestWithSingleRetry(() => requestJson({
    url: buildPriceSearchUrl(oracleIds),
    method: 'GET',
    timeout: SCRYFALL_COLLECTION_TIMEOUT_MS,
    // 不设 User-Agent（同上，禁止头）
    header: {
      Accept: 'application/json',
    },
  }, (payload) => {
    if (!payload || !Array.isArray(payload.data)) {
      throw new Error('Scryfall search returned invalid data');
    }
    return { cards: payload.data };
  }));
}

function applyPriceSearchResult(oracleIds, cards) {
  const requested = new Set(oracleIds);
  const resolved = new Map();
  cards.forEach((card) => {
    const metadata = extractBracketCardMetadata(card);
    const oracleId = metadata ? metadata.oracleId : '';
    const usd = metadata ? metadata.usd : null;
    if (!requested.has(oracleId) || usd === null) return;
    if (!resolved.has(oracleId) || usd < resolved.get(oracleId)) {
      resolved.set(oracleId, usd);
    }
  });

  resolved.forEach((usd, oracleId) => {
    oraclePriceCache.set(oracleId, usd);
    missingPriceOracleCache.delete(oracleId);
  });
  trimMapCache(oraclePriceCache, PRICE_CACHE_LIMIT);

  oracleIds.forEach((oracleId) => {
    if (resolved.has(oracleId)) return;
    // A valid complete search response with no usable nonfoil USD is safe to
    // negative-cache for this session. Transport and HTTP failures never reach here.
    missingPriceOracleCache.add(oracleId);
  });
  trimSetCache(missingPriceOracleCache, MISSING_CACHE_LIMIT);

  metadataCache.forEach((metadata) => {
    if (metadata && metadata.usd === null && resolved.has(metadata.oracleId)) {
      metadata.usd = resolved.get(metadata.oracleId);
    }
  });
}

function emptyPriceDiagnostics() {
  return {
    priceFallbackEligibleCount: 0,
    priceFallbackRequestedCount: 0,
    priceFallbackResolvedCount: 0,
    priceFallbackNotFoundCount: 0,
    priceFallbackFailedLookupCount: 0,
    priceFallbackFailedBatchCount: 0,
    priceFallbackRetryCount: 0,
  };
}

function buildMetadataResult(names, diagnostics) {
  const byName = {};
  let resolvedCount = 0;
  let notFoundCount = 0;

  names.forEach((name) => {
    const key = metadataKey(name);
    if (metadataCache.has(key)) {
      byName[key] = metadataCache.get(key);
      resolvedCount += 1;
    } else if (missingMetadataCache.has(key)) {
      notFoundCount += 1;
    }
  });

  return {
    byName,
    requestedCount: names.length,
    resolvedCount,
    notFoundCount,
    failedLookupCount: Math.max(0, names.length - resolvedCount - notFoundCount),
    failedBatchCount: diagnostics.failedBatchCount || 0,
    collectionRetryCount: diagnostics.collectionRetryCount || 0,
    ...emptyPriceDiagnostics(),
    ...(diagnostics.price || {}),
    available: resolvedCount > 0,
  };
}

function runCollectionBatch(batch) {
  return requestCollectionBatch(batch)
    .then(({ value, retryCount }) => {
      value.cards.forEach(cacheCardMetadata);
      // Only the API's explicit not_found list is safe to negative-cache. A returned
      // alias may have a different canonical name and should remain retryable otherwise.
      //
      // not_found 回声里是**我们发出去的正面名**，牌表里写的可能是 `A // B` 全名，
      // 得映射回原始那一条再标；直接标正面名的话，全名那条永远标不上，
      // 每次开页都要为同一张不存在的卡重发一次请求。
      const missingIdentifiers = new Set(
        value.notFound
          .map((item) => metadataKey(item && typeof item === 'object' ? item.name : item))
          .filter(Boolean),
      );
      if (missingIdentifiers.size) {
        batch.forEach((name) => {
          if (missingIdentifiers.has(metadataKey(collectionIdentifier(name)))) markMissing(name);
        });
      }
      return { failed: false, retryCount };
    })
    .catch((error) => ({ failed: true, retryCount: error && error.retryCount ? error.retryCount : 0 }));
}

function scheduleCollectionBatch(batch, gate) {
  let trackedRequest;
  const source = gate
    ? gate.then(() => runCollectionBatch(batch))
    : runCollectionBatch(batch);
  trackedRequest = source.then((outcome) => {
    batch.forEach((name) => {
      const key = metadataKey(name);
      if (inFlightMetadataRequests.get(key) === trackedRequest) {
        inFlightMetadataRequests.delete(key);
      }
    });
    return outcome;
  });
  batch.forEach((name) => inFlightMetadataRequests.set(metadataKey(name), trackedRequest));
  return trackedRequest;
}

function collectPriceFallbackOracleIds(names) {
  const oracleIds = [];
  const seen = new Set();
  names.forEach((name) => {
    const metadata = metadataCache.get(metadataKey(name));
    if (!metadata || metadata.usd !== null || !metadata.oracleId || seen.has(metadata.oracleId)) return;
    seen.add(metadata.oracleId);
    oracleIds.push(metadata.oracleId);
  });
  return oracleIds;
}

function runPriceSearchBatch(batch) {
  return requestPriceSearchBatch(batch)
    .then(({ value, retryCount }) => {
      applyPriceSearchResult(batch, value.cards);
      return { failed: false, retryCount };
    })
    .catch((error) => ({ failed: true, retryCount: error && error.retryCount ? error.retryCount : 0 }));
}

function schedulePriceSearchBatch(batch, gate) {
  let trackedRequest;
  const source = gate
    ? gate.then(() => runPriceSearchBatch(batch))
    : runPriceSearchBatch(batch);
  trackedRequest = source.then((outcome) => {
    batch.forEach((oracleId) => {
      if (inFlightPriceRequests.get(oracleId) === trackedRequest) {
        inFlightPriceRequests.delete(oracleId);
      }
    });
    return outcome;
  });
  batch.forEach((oracleId) => inFlightPriceRequests.set(oracleId, trackedRequest));
  return trackedRequest;
}

function fetchMissingPrices(names) {
  const eligibleOracleIds = collectPriceFallbackOracleIds(names);
  if (!eligibleOracleIds.length) return Promise.resolve(emptyPriceDiagnostics());

  const lookupOracleIds = eligibleOracleIds.filter((oracleId) => (
    !oraclePriceCache.has(oracleId) && !missingPriceOracleCache.has(oracleId)
  ));
  const existingRequests = new Set();
  lookupOracleIds.forEach((oracleId) => {
    const request = inFlightPriceRequests.get(oracleId);
    if (request) existingRequests.add(request);
  });
  const pendingOracleIds = lookupOracleIds.filter((oracleId) => !inFlightPriceRequests.has(oracleId));
  const batches = [];
  for (let index = 0; index < pendingOracleIds.length; index += SCRYFALL_PRICE_SEARCH_BATCH_SIZE) {
    batches.push(pendingOracleIds.slice(index, index + SCRYFALL_PRICE_SEARCH_BATCH_SIZE));
  }

  const requests = new Set(existingRequests);
  let gate = existingRequests.size ? Promise.all(Array.from(existingRequests)) : null;
  batches.forEach((batch) => {
    const request = schedulePriceSearchBatch(batch, gate);
    requests.add(request);
    gate = request;
  });

  return Promise.all(Array.from(requests)).then((outcomes) => {
    let resolvedCount = 0;
    let notFoundCount = 0;
    eligibleOracleIds.forEach((oracleId) => {
      if (oraclePriceCache.has(oracleId)) resolvedCount += 1;
      else if (missingPriceOracleCache.has(oracleId)) notFoundCount += 1;
    });
    const resolvedLookupCount = lookupOracleIds.filter(
      (oracleId) => oraclePriceCache.has(oracleId),
    ).length;
    const notFoundLookupCount = lookupOracleIds.filter(
      (oracleId) => missingPriceOracleCache.has(oracleId),
    ).length;
    return {
      priceFallbackEligibleCount: eligibleOracleIds.length,
      priceFallbackRequestedCount: lookupOracleIds.length,
      priceFallbackResolvedCount: resolvedCount,
      priceFallbackNotFoundCount: notFoundCount,
      priceFallbackFailedLookupCount: Math.max(
        0,
        lookupOracleIds.length - resolvedLookupCount - notFoundLookupCount,
      ),
      priceFallbackFailedBatchCount: outcomes.filter((outcome) => outcome && outcome.failed).length,
      priceFallbackRetryCount: outcomes.reduce(
        (total, outcome) => total + (outcome && outcome.retryCount ? outcome.retryCount : 0),
        0,
      ),
    };
  });
}

// onProgress 让调用方把「不确定的等待」变成「有终点的等待」：
// 只在批次真正完成时推进，不做假动画
function fetchBracketCardMetadata(cardNames, options) {
  const onProgress = options && typeof options.onProgress === 'function'
    ? options.onProgress
    : null;
  const names = [];
  const seen = new Set();
  (Array.isArray(cardNames) ? cardNames : []).forEach((name) => {
    const normalized = normalizeCardName(name);
    const key = metadataKey(normalized);
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push(normalized);
  });

  const existingRequests = new Set();
  names.forEach((name) => {
    const request = inFlightMetadataRequests.get(metadataKey(name));
    if (request) existingRequests.add(request);
  });
  const pendingNames = names.filter((name) => {
    const key = metadataKey(name);
    return !metadataCache.has(key)
      && !missingMetadataCache.has(key)
      && !inFlightMetadataRequests.has(key);
  });
  const batches = [];
  for (let index = 0; index < pendingNames.length; index += SCRYFALL_COLLECTION_BATCH_SIZE) {
    batches.push(pendingNames.slice(index, index + SCRYFALL_COLLECTION_BATCH_SIZE));
  }

  // 命中缓存的卡不产生请求，进度一开始就该把它们算进去
  let done = names.length - pendingNames.length - existingRequests.size;
  const report = (phase) => {
    if (!onProgress) return;
    onProgress({
      done: Math.max(0, Math.min(done, names.length)),
      total: names.length,
      phase,
    });
  };
  report('cards');

  const requests = new Set(existingRequests);
  let gate = existingRequests.size ? Promise.all(Array.from(existingRequests)) : null;
  batches.forEach((batch) => {
    const request = scheduleCollectionBatch(batch, gate);
    requests.add(onProgress ? request.then((outcome) => {
      done += batch.length;
      report('cards');
      return outcome;
    }) : request);
    gate = request;
  });

  return Promise.all(Array.from(requests)).then((outcomes) => {
    report('prices');
    const diagnostics = {
      failedBatchCount: outcomes.filter((outcome) => outcome && outcome.failed).length,
      collectionRetryCount: outcomes.reduce(
        (total, outcome) => total + (outcome && outcome.retryCount ? outcome.retryCount : 0),
        0,
      ),
    };
    return fetchMissingPrices(names).then((price) => buildMetadataResult(names, {
      ...diagnostics,
      price,
    }));
  });
}

module.exports = {
  SCRYFALL_COLLECTION_API,
  SCRYFALL_SEARCH_API,
  SCRYFALL_COLLECTION_BATCH_SIZE,
  SCRYFALL_PRICE_SEARCH_BATCH_SIZE,
  SCRYFALL_COLLECTION_TIMEOUT_MS,
  extractBracketCardMetadata,
  fetchBracketCardMetadata,
};
