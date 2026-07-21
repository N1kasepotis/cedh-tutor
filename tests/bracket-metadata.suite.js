const test = require('node:test');
const assert = require('node:assert/strict');

const {
  SCRYFALL_COLLECTION_API,
  SCRYFALL_SEARCH_API,
  SCRYFALL_COLLECTION_BATCH_SIZE,
  SCRYFALL_PRICE_SEARCH_BATCH_SIZE,
  SCRYFALL_COLLECTION_TIMEOUT_MS,
  extractBracketCardMetadata,
  fetchBracketCardMetadata,
} = require('../miniprogram/utils/bracket-metadata');

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve));
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForRequestCount(requests, expectedCount, timeoutMs = 2000) {
  const startedAt = Date.now();
  while (requests.length < expectedCount) {
    if (Date.now() - startedAt >= timeoutMs) {
      assert.fail(`timed out waiting for ${expectedCount} requests; received ${requests.length}`);
    }
    await wait(10);
  }
}

test('Scryfall collection lookup batches 75 names and preserves partial/missing metadata', async () => {
  const originalWx = global.wx;
  const requests = [];
  global.wx = {
    request(options) {
      requests.push(options);
    },
  };

  try {
    const names = Array.from({ length: 76 }, (_, index) => `Batch Metadata Card ${index + 1}`);
    const pending = fetchBracketCardMetadata(names.concat(' batch metadata card 1 ', ''));
    assert.equal(requests.length, 1, 'the first sequential batch should start immediately');
    const joinedPending = fetchBracketCardMetadata([names[0]]);
    assert.equal(requests.length, 1, 'an in-flight card lookup must be shared instead of duplicated');

    const first = requests[0];
    assert.equal(first.url, SCRYFALL_COLLECTION_API);
    assert.equal(first.method, 'POST');
    assert.equal(first.timeout, SCRYFALL_COLLECTION_TIMEOUT_MS);
    assert.equal(first.data.identifiers.length, SCRYFALL_COLLECTION_BATCH_SIZE);
    assert.deepEqual(first.data.identifiers[0], { name: names[0] });
    assert.equal(first.header.Accept, 'application/json');
    assert.equal(first.header['Content-Type'], 'application/json');
    // 不设 User-Agent（禁止头，基础库会拒绝并报 Refused to set unsafe header）
    assert.equal(first.header['User-Agent'], undefined);

    const returnedCards = first.data.identifiers.slice(0, 74).map((identifier, index) => ({
      name: identifier.name,
      cmc: index === 0 ? 0 : 2,
      type_line: index === 0 ? 'Legendary Land' : 'Instant',
      prices: { usd: index === 1 ? null : '1.25' },
    }));
    first.success({
      statusCode: 200,
      data: {
        data: returnedCards,
        not_found: [first.data.identifiers[74]],
      },
    });
    assert.equal((await joinedPending).resolvedCount, 1);

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requests.length, 2);
    assert.equal(requests[1].data.identifiers.length, 1);
    requests[1].success({ statusCode: 422, data: { object: 'error' } });

    const result = await pending;
    assert.equal(result.requestedCount, 76, 'blank and case-insensitive duplicates are removed');
    assert.equal(result.resolvedCount, 74);
    assert.equal(result.notFoundCount, 1);
    assert.equal(result.failedLookupCount, 1);
    assert.equal(result.failedBatchCount, 1);
    assert.equal(result.collectionRetryCount, 0, '422 must not be retried');
    assert.equal(result.byName['batch metadata card 1'].cmc, 0, 'valid zero MV must be preserved');
    assert.equal(result.byName['batch metadata card 1'].typeLine, 'Legendary Land');
    assert.equal(result.byName['batch metadata card 1'].usd, 1.25);
    assert.equal(result.byName['batch metadata card 2'].usd, null, 'missing USD must not become zero');
    assert.equal(result.byName['batch metadata card 76'], undefined, 'failed names remain retryable and uncached');

    const cached = await fetchBracketCardMetadata([names[0]]);
    assert.equal(requests.length, 2, 'successful metadata should be reused from memory');
    assert.equal(cached.resolvedCount, 1);
    const cachedMissing = await fetchBracketCardMetadata([names[74]]);
    assert.equal(requests.length, 2, 'explicit not_found identifiers should be cached');
    assert.equal(cachedMissing.notFoundCount, 1);

    const retryPending = fetchBracketCardMetadata([names[75]]);
    assert.equal(requests.length, 3, 'a failed batch must remain retryable');
    requests[2].success({
      statusCode: 200,
      data: {
        data: [{
          name: names[75],
          cmc: 4,
          type_line: 'Creature',
          prices: { usd: '3.50' },
        }],
        not_found: [],
      },
    });
    assert.equal((await retryPending).resolvedCount, 1);

    const printedAliasName = 'Printed Lookup Alias';
    const printedAliasPending = fetchBracketCardMetadata([printedAliasName]);
    assert.equal(requests.length, 4);
    requests[3].success({
      statusCode: 200,
      data: {
        data: [{
          name: 'Canonical Alias Card',
          printed_name: printedAliasName,
          cmc: 2,
          type_line: 'Instant',
          prices: { usd: '4.00' },
        }],
        not_found: [],
      },
    });
    assert.equal((await printedAliasPending).resolvedCount, 1, 'printed names should map to canonical cards');

    const unmatchedAliasName = 'Unmatched Returned Alias';
    const unmatchedPending = fetchBracketCardMetadata([unmatchedAliasName]);
    assert.equal(requests.length, 5);
    requests[4].success({
      statusCode: 200,
      data: {
        data: [{
          name: 'Different Canonical Card',
          cmc: 2,
          type_line: 'Instant',
          prices: { usd: '1.00' },
        }],
        not_found: [],
      },
    });
    const unmatched = await unmatchedPending;
    assert.equal(unmatched.notFoundCount, 0);
    assert.equal(unmatched.failedLookupCount, 1);
    const unmatchedRetry = fetchBracketCardMetadata([unmatchedAliasName]);
    assert.equal(requests.length, 6, 'unmatched valid responses must remain retryable, not negative-cached');
    requests[5].success({
      statusCode: 200,
      data: { data: [], not_found: [{ name: unmatchedAliasName }] },
    });
    assert.equal((await unmatchedRetry).notFoundCount, 1);

    const allFailPending = fetchBracketCardMetadata(['All Fail Metadata Card']);
    assert.equal(requests.length, 7);
    requests[6].fail({ errMsg: 'request:fail offline' });
    await waitForRequestCount(requests, 8);
    assert.equal(requests.length, 8, 'a wx transport failure gets exactly one retry');
    requests[7].fail({ errMsg: 'request:fail offline again' });
    const allFail = await allFailPending;
    assert.equal(allFail.resolvedCount, 0);
    assert.equal(allFail.failedLookupCount, 1);
    assert.equal(allFail.failedBatchCount, 1);
    assert.equal(allFail.collectionRetryCount, 1);

    const requestCount = requests.length;
    const empty = await fetchBracketCardMetadata([]);
    assert.equal(requests.length, requestCount);
    assert.deepEqual(empty, {
      byName: {},
      requestedCount: 0,
      resolvedCount: 0,
      notFoundCount: 0,
      failedLookupCount: 0,
      failedBatchCount: 0,
      collectionRetryCount: 0,
      priceFallbackEligibleCount: 0,
      priceFallbackRequestedCount: 0,
      priceFallbackResolvedCount: 0,
      priceFallbackNotFoundCount: 0,
      priceFallbackFailedLookupCount: 0,
      priceFallbackFailedBatchCount: 0,
      priceFallbackRetryCount: 0,
      available: false,
    });

    const noNumericData = extractBracketCardMetadata({
      name: 'No Numeric Data',
      oracle_id: 'ABC-123',
      cmc: null,
      type_line: 'Creature',
      prices: { usd: null },
    });
    assert.equal(noNumericData.cmc, null);
    assert.equal(noNumericData.oracleId, 'abc-123');
    const compactFeatures = extractBracketCardMetadata({
      name: 'Compact Interaction',
      oracle_id: 'COMPACT-INTERACTION',
      cmc: 1,
      type_line: 'Instant',
      oracle_text: 'Counter target spell.',
      prices: { usd: '1.00' },
    });
    assert.equal(compactFeatures.strengthFeatures.lowCostInteraction, true);
    assert.equal(compactFeatures.oracleText, undefined);
    assert.equal(compactFeatures.oracle_text, undefined, 'raw Oracle text is not retained in cached metadata');
    const compactRoleFeatures = extractBracketCardMetadata({
      name: 'Compact Synergy Roles',
      oracle_id: 'COMPACT-SYNERGY-ROLES',
      cmc: 1,
      type_line: 'Artifact — Equipment',
      oracle_text: 'Whenever an Equipment enters the battlefield under your control, draw a card.\nSacrifice another creature: Add {C}.',
      prices: { usd: '1.00' },
    });
    assert.ok(compactRoleFeatures.strengthFeatures.cohesionRoles.includes('equipment-member'));
    assert.ok(compactRoleFeatures.strengthFeatures.cohesionRoles.includes('equipment-support'));
    assert.ok(compactRoleFeatures.strengthFeatures.comboRoles.includes('free-creature-sacrifice'));
    assert.equal(compactRoleFeatures.oracleText, undefined);
    assert.equal(compactRoleFeatures.oracle_text, undefined);
    assert.equal(compactRoleFeatures.strengthFeatures.oracleText, undefined);
    assert.equal(compactRoleFeatures.strengthFeatures.oracle_text, undefined,
      'compact strength features retain role tags without retaining raw Oracle text');
    assert.equal(extractBracketCardMetadata({
      name: 'Spell Front // Land Back',
      cmc: 3,
      type_line: 'Sorcery // Land',
      card_faces: [
        { name: 'Spell Front', type_line: 'Sorcery' },
        { name: 'Land Back', type_line: 'Land' },
      ],
      prices: { usd: '2.00' },
    }).frontTypeLine, 'Sorcery', 'MDFC curve classification must use the front face');
    const faceFallback = extractBracketCardMetadata({
      name: 'Face Metadata Fallback',
      cmc: null,
      oracle_id: null,
      type_line: 'Creature // Land',
      card_faces: [{
        name: 'Face Metadata Fallback Front',
        cmc: 5,
        oracle_id: 'FACE-ORACLE-ID',
        type_line: 'Creature',
      }],
      prices: { usd: null },
    });
    assert.equal(faceFallback.cmc, 5, 'first-face CMC fills an absent parent CMC');
    assert.equal(faceFallback.oracleId, 'face-oracle-id', 'first-face oracle_id fills an absent parent id');
    const parentMetadataWins = extractBracketCardMetadata({
      name: 'Parent Metadata Wins',
      cmc: 0,
      oracle_id: 'PARENT-ORACLE-ID',
      type_line: 'Land // Creature',
      card_faces: [{
        cmc: 4,
        oracle_id: 'face-should-not-win',
        type_line: 'Land',
      }],
      prices: { usd: '0' },
    });
    assert.equal(parentMetadataWins.cmc, 0, 'valid parent zero CMC is not replaced');
    assert.equal(parentMetadataWins.oracleId, 'parent-oracle-id');
  } finally {
    if (originalWx === undefined) delete global.wx;
    else global.wx = originalWx;
  }
});

test('missing nonfoil USD prices use grouped oracle searches with cache-safe partial results', async () => {
  const originalWx = global.wx;
  const requests = [];
  global.wx = {
    request(options) {
      requests.push(options);
    },
  };

  try {
    const names = Array.from({ length: 13 }, (_, index) => `Oracle Price Card ${index + 1}`);
    const oracleIds = names.map((name, index) => `oracle-price-${index + 1}`);
    const pending = fetchBracketCardMetadata(names);
    assert.equal(requests.length, 1);
    requests[0].success({
      statusCode: 200,
      data: {
        data: names.map((name, index) => ({
          name,
          oracle_id: oracleIds[index],
          cmc: index + 1,
          type_line: index % 2 ? 'Instant' : 'Creature',
          prices: { usd: null, usd_foil: '99.00' },
        })),
        not_found: [],
      },
    });

    await nextTurn();
    assert.equal(requests.length, 2, 'the first grouped price batch starts after collection');
    const firstSearch = requests[1];
    assert.ok(firstSearch.url.startsWith(`${SCRYFALL_SEARCH_API}?q=`));
    assert.equal(firstSearch.method, 'GET');
    assert.equal(firstSearch.timeout, SCRYFALL_COLLECTION_TIMEOUT_MS);
    assert.equal(firstSearch.header.Accept, 'application/json');
    assert.equal(firstSearch.header['User-Agent'], undefined);
    const decodedFirstUrl = decodeURIComponent(firstSearch.url);
    assert.match(decodedFirstUrl, /\(oracleid:oracle-price-1 or oracleid:oracle-price-2/);
    assert.match(decodedFirstUrl, /game:paper usd>0/);
    assert.match(decodedFirstUrl, /unique=cards/);
    assert.equal(
      (decodedFirstUrl.match(/oracleid:/g) || []).length,
      SCRYFALL_PRICE_SEARCH_BATCH_SIZE,
      'one search must cover a URL-safe group instead of one card',
    );

    firstSearch.success({
      statusCode: 200,
      data: {
        data: oracleIds.slice(0, 9).map((oracleId, index) => ({
          name: names[index],
          ...(index === 0
            ? { card_faces: [{ name: names[index], oracle_id: oracleId }] }
            : { oracle_id: oracleId }),
          prices: { usd: String(index + 1), usd_foil: '100.00' },
        })),
      },
    });

    await nextTurn();
    assert.equal(requests.length, 3, 'price batches are sequenced rather than burst together');
    const secondSearch = requests[2];
    assert.equal(
      (decodeURIComponent(secondSearch.url).match(/oracleid:/g) || []).length,
      3,
    );
    secondSearch.fail({ errMsg: 'request:fail timeout' });
    await waitForRequestCount(requests, 4);
    assert.equal(requests.length, 4, 'transient price lookup gets one controlled retry');
    assert.equal(requests[3].url, secondSearch.url);
    requests[3].success({
      statusCode: 200,
      data: {
        data: oracleIds.slice(10, 12).map((oracleId, offset) => ({
          name: names[offset + 10],
          oracle_id: oracleId,
          prices: { usd: String(20 + offset), usd_foil: '0.01' },
        })),
      },
    });

    const result = await pending;
    assert.equal(result.resolvedCount, 13, 'price failures must not discard curve/type metadata');
    assert.equal(result.failedBatchCount, 0);
    assert.equal(result.priceFallbackEligibleCount, 13);
    assert.equal(result.priceFallbackRequestedCount, 13);
    assert.equal(result.priceFallbackResolvedCount, 11);
    assert.equal(result.priceFallbackNotFoundCount, 2);
    assert.equal(result.priceFallbackFailedLookupCount, 0);
    assert.equal(result.priceFallbackFailedBatchCount, 0);
    assert.equal(result.priceFallbackRetryCount, 1);
    assert.equal(result.byName['oracle price card 1'].usd, 1);
    assert.equal(result.byName['oracle price card 10'].usd, null, 'valid missing USD remains null');
    assert.equal(result.byName['oracle price card 10'].cmc, 10, 'other card data survives');
    assert.equal(result.byName['oracle price card 11'].usd, 20);
    assert.equal(result.byName['oracle price card 13'].usd, null);
    assert.equal(
      result.byName['oracle price card 13'].usd,
      null,
      'foil price must never fill the nonfoil USD field',
    );

    const requestCount = requests.length;
    const cached = await fetchBracketCardMetadata(names);
    assert.equal(requests.length, requestCount, 'successful and valid-not-found price results are cached');
    assert.equal(cached.byName['oracle price card 1'].usd, 1);
    assert.equal(cached.byName['oracle price card 10'].usd, null);
    assert.equal(cached.priceFallbackEligibleCount, 2);
    assert.equal(cached.priceFallbackRequestedCount, 0);
    assert.equal(cached.priceFallbackNotFoundCount, 2);

    const mixedName = 'Oracle Price Network Gap';
    const mixedPending = fetchBracketCardMetadata(names.concat(mixedName));
    assert.equal(requests.length, requestCount + 1);
    requests[requestCount].success({
      statusCode: 200,
      data: {
        data: [{
          name: mixedName,
          oracle_id: 'oracle-price-network-gap',
          cmc: 6,
          type_line: 'Artifact',
          prices: { usd: null },
        }],
        not_found: [],
      },
    });
    await nextTurn();
    assert.equal(requests.length, requestCount + 2);
    requests[requestCount + 1].success({ statusCode: 403, data: { object: 'error' } });
    const mixed = await mixedPending;
    assert.equal(mixed.priceFallbackNotFoundCount, 2, 'cached valid misses remain visible');
    assert.equal(mixed.priceFallbackFailedLookupCount, 1, 'cached misses must not hide a new failure');
    assert.equal(mixed.byName[mixedName.toLowerCase()].cmc, 6);
  } finally {
    if (originalWx === undefined) delete global.wx;
    else global.wx = originalWx;
  }
});

test('transient price failures retry once while HTTP rejection and network failure stay retryable later', async () => {
  const originalWx = global.wx;
  const requests = [];
  global.wx = {
    request(options) {
      requests.push(options);
    },
  };

  try {
    const name = 'Retryable Oracle Price Card';
    const oracleId = 'retryable-oracle-price';
    const pending = fetchBracketCardMetadata([name]);
    requests[0].success({
      statusCode: 200,
      data: {
        data: [{
          name,
          oracle_id: oracleId,
          cmc: 7,
          type_line: 'Sorcery',
          prices: { usd: null },
        }],
        not_found: [],
      },
    });
    await nextTurn();
    assert.equal(requests.length, 2);
    const rateLimitedAt = Date.now();
    requests[1].success({
      statusCode: 429,
      header: { 'Retry-After': '0.25' },
      data: { object: 'error' },
    });
    await waitForRequestCount(requests, 3);
    assert.equal(requests.length, 3, '429 is transient and triggers one retry');
    assert.ok(
      Date.now() - rateLimitedAt >= 180,
      'numeric Retry-After must take precedence over the shorter generic delay',
    );
    requests[2].success({ statusCode: 500, data: { object: 'error' } });

    const transientFailure = await pending;
    assert.equal(requests.length, 3, 'a failed retry must not trigger a third attempt');
    assert.equal(transientFailure.priceFallbackFailedBatchCount, 1);
    assert.equal(transientFailure.priceFallbackFailedLookupCount, 1);
    assert.equal(transientFailure.priceFallbackRetryCount, 1);
    assert.equal(transientFailure.byName[name.toLowerCase()].cmc, 7);
    assert.equal(transientFailure.byName[name.toLowerCase()].usd, null);

    const rejectedPending = fetchBracketCardMetadata([name]);
    await nextTurn();
    assert.equal(requests.length, 4, 'failed fallback is not negative-cached');
    requests[3].success({ statusCode: 403, data: { object: 'error' } });
    const rejected = await rejectedPending;
    assert.equal(requests.length, 4, '403 must not be retried');
    assert.equal(rejected.priceFallbackRetryCount, 0);
    assert.equal(rejected.priceFallbackFailedLookupCount, 1);

    const validMissingPending = fetchBracketCardMetadata([name]);
    await nextTurn();
    assert.equal(requests.length, 5, 'HTTP rejection also remains retryable next time');
    requests[4].success({ statusCode: 200, data: { data: [] } });
    const validMissing = await validMissingPending;
    assert.equal(validMissing.priceFallbackNotFoundCount, 1);
    assert.equal(validMissing.priceFallbackFailedLookupCount, 0);

    const requestCount = requests.length;
    const cachedMissing = await fetchBracketCardMetadata([name]);
    assert.equal(requests.length, requestCount, 'only a valid empty search is negative-cached');
    assert.equal(cachedMissing.byName[name.toLowerCase()].usd, null);
    assert.equal(cachedMissing.priceFallbackRequestedCount, 0);
    assert.equal(cachedMissing.priceFallbackNotFoundCount, 1);
  } finally {
    if (originalWx === undefined) delete global.wx;
    else global.wx = originalWx;
  }
});
