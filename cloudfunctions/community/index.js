const cloud = require('wx-server-sdk');
const https = require('https');
const { createService } = require('./service');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const COLLECTION = 'community';
const repository = {
  transaction: (callback) =>
    db.runTransaction(async (transaction) =>
      callback({
        get: async (id) => {
          const result = await transaction.collection(COLLECTION).doc(id).get();
          return result.data || null;
        },
        set: (id, data) => {
          const { _id, ...value } = data;
          return transaction
            .collection(COLLECTION)
            .doc(id)
            .set({ data: value });
        },
      }),
    ),
};
function resolveCard(id) {
  // The validator permits UUIDs only; clients cannot supply a host or URL.
  return new Promise((resolve, reject) => {
    const request = https.get(
      `https://api.scryfall.com/cards/${id}`,
      {
        headers: { 'User-Agent': 'cEDH-Tutor/1.0', Accept: 'application/json' },
        timeout: 8000,
      },
      (response) => {
        let body = '';
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error('CARD_SERVICE'));
          return;
        }
        response.on('data', (chunk) => {
          body += chunk;
          if (body.length > 300000) request.destroy(new Error('CARD_SERVICE'));
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new Error('CARD_SERVICE')));
    request.on('error', reject);
  });
}
const service = createService({
  repository,
  resolveCard,
  moderate: async (content, openid) => {
    const result = await cloud.openapi.security.msgSecCheck({
      content,
      openid,
      scene: 1,
      version: 2,
    });
    return (
      (result.errCode === 0 &&
        result.result &&
        result.result.suggest === 'pass') ||
      (result.errcode === 0 &&
        result.result &&
        result.result.suggest === 'pass')
    );
  },
});
exports.main = async (event) => {
  const context = cloud.getWXContext();
  try {
    return { ok: true, data: await service(event, { openid: context.OPENID }) };
  } catch (error) {
    const publicCodes = [
      'FORBIDDEN',
      'INVALID_INPUT',
      'INVALID_CARD',
      'INVALID_VOTE',
      'RATE_LIMIT',
      'MODERATION',
      'CONFLICT',
      'NOT_FOUND',
    ];
    // No raw SDK errors, content, OPENID, or tokens returned or logged.
    return {
      ok: false,
      code: publicCodes.includes(error.code) ? error.code : 'SERVICE_ERROR',
    };
  }
};
