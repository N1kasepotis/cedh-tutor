const SCRYFALL_NAMED_API = 'https://api.scryfall.com/cards/named?fuzzy=';
const SCRYFALL_USER_AGENT = 'cEDH-Tutor/1.0';

// 归一化卡名：把 Moxfield/MTGO 导出常用的弯引号（' ' ʼ ＇）替换为 ASCII 直引号。
// Scryfall 对弯引号（编码后 %E2%80%99）会返回 400，直引号才能命中；
// 重音字母（Lim-Dûl 等）不动——Scryfall 原生支持，strip 反而会查不到。
function normalizeCardName(name) {
  return String(name || '')
    .replace(/[‘’ʼ＇]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
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
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.request) {
      reject(new Error('wx.request unavailable'));
      return;
    }

    if (!cardName || typeof cardName !== 'string') {
      reject(new Error('Invalid card name'));
      return;
    }

    wx.request({
      url: buildScryfallNamedUrl(cardName),
      method: 'GET',
      header: {
        Accept: 'application/json',
        'User-Agent': SCRYFALL_USER_AGENT,
      },
      success: (response) => {
        if (response.statusCode === 200) {
          resolve(extractCardImageUris(response.data));
        } else {
          reject(new Error(`Scryfall API returned ${response.statusCode}`));
        }
      },
      fail: reject,
    });
  });
}

module.exports = {
  SCRYFALL_NAMED_API,
  normalizeCardName,
  buildScryfallNamedUrl,
  buildScryfallImageUrl,
  extractCardImageUris,
  fetchCardImageUris,
};
