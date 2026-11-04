const https = require('https');
const { names } = require('./engine');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function jsonRequest(url, { body, key, timeout = 12000 } = {}) {
  if (!/^https:\/\/(topdeck\.gg|api\.scryfall\.com)\//.test(url)) return Promise.reject(new Error('INVALID_HOST'));
  return new Promise((resolve, reject) => {
    const encoded = body === undefined ? null : JSON.stringify(body);
    const request = https.request(url, {
      method: encoded ? 'POST' : 'GET',
      headers: { Accept: 'application/json', 'User-Agent': 'cedh-tutor-monthly/1.0',
        ...(encoded ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encoded) } : {}),
        ...(key ? { Authorization: key } : {}) },
    }, (response) => {
      let bytes = 0; const chunks = [];
      response.on('data', (chunk) => {
        bytes += chunk.length;
        if (bytes > 32 * 1024 * 1024) { response.destroy(); reject(new Error('RESPONSE_TOO_LARGE')); return; }
        chunks.push(chunk);
      });
      response.on('error', () => reject(new Error('UPSTREAM_NETWORK')));
      response.on('end', () => {
        if (response.statusCode !== 200) { reject(new Error(`UPSTREAM_HTTP_${response.statusCode}`)); return; }
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (_) { reject(new Error('INVALID_UPSTREAM_JSON')); }
      });
    });
    request.setTimeout(timeout, () => request.destroy(new Error('UPSTREAM_TIMEOUT')));
    request.on('error', (error) => reject(new Error(error.message === 'UPSTREAM_TIMEOUT' ? error.message : 'UPSTREAM_NETWORK')));
    if (encoded) request.write(encoded);
    request.end();
  });
}
async function fetchEvents(key, window) {
  if (!key) throw new Error('MISSING_TOPDECK_KEY');
  const data = await jsonRequest('https://topdeck.gg/api/v2/tournaments', { key, timeout: 20000, body: {
    game: 'Magic: The Gathering', format: 'EDH', start: window.start, end: window.end - 1, participantMin: 50,
    columns: ['id', 'winsSwiss', 'lossesSwiss', 'draws', 'byes'], rounds: true, players: ['id'],
  } });
  if (!Array.isArray(data) || data.length > 2000) throw new Error('INVALID_EVENT_LIST');
  return data;
}
const fetchInfo = (key, id) => jsonRequest(`https://topdeck.gg/api/v2/tournaments/${encodeURIComponent(id)}/info`, { key, timeout: 6000 });
async function fetchCards(leaders, existing = {}) {
  const missing = [...new Set(leaders.flatMap(names))].filter((name) => !existing[name.toLowerCase()]);
  const cards = { ...existing };
  for (let offset = 0; offset < missing.length; offset += 75) {
    if (offset) await sleep(150);
    const wanted = missing.slice(offset, offset + 75);
    const result = await jsonRequest('https://api.scryfall.com/cards/collection', { body: { identifiers: wanted.map((name) => ({ name })) } });
    if (!Array.isArray(result.data)) throw new Error('INVALID_CARD_LIST');
    for (const card of result.data) {
      const face = card.card_faces && card.card_faces[0];
      const image = card.image_uris || (face && face.image_uris) || {};
      if (!card.oracle_id || !card.name || !image.small || !/^https:\/\/cards\.scryfall\.io\//.test(image.small)) continue;
      const name = face ? face.name : card.name;
      const normalized = { oracleId: card.oracle_id, name, nameZh: '', colors: card.color_identity || [], image: image.small,
        normal: image.normal || image.small, art: image.art_crop || image.small };
      cards[name.toLowerCase()] = normalized;
      cards[card.name.toLowerCase()] = normalized;
      // Collection results are not position-aligned when a requested name is absent.
      for (const requested of wanted) if (requested.toLowerCase() === name.toLowerCase() || requested.toLowerCase() === card.name.toLowerCase()) cards[requested.toLowerCase()] = normalized;
    }
  }
  return cards;
}
module.exports = { jsonRequest, fetchEvents, fetchInfo, fetchCards, sleep };
