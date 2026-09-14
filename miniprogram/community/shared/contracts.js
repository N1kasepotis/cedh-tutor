'use strict';

// Portable domain contract. scripts/sync-community.js copies this to the cloud function.
const SLOT_LABELS = ['最喜欢的设计', '代表打法的牌', '常用妙妙牌'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const VIEWS = ['casual', 'competitive', 'both', 'unspecified'];
const REASONS = ['balance', 'diversity', 'experience', 'identity', 'unsure'];
const TABLE_FIELDS = [
  {
    key: 'level',
    label: '对局强度',
    options: ['休闲主题', '优化休闲', '高强度', 'cEDH'],
  },
  {
    key: 'proxy',
    label: '代牌',
    options: ['可以用', '聊完再定', '不用'],
  },
  {
    key: 'combo',
    label: '无限组合技',
    options: ['可以用', '提前说一声', '不使用'],
  },
  {
    key: 'turns',
    label: '额外回合',
    options: ['可以用', '不连续加回合', '不使用'],
  },
  {
    key: 'time',
    label: '预计时长',
    options: ['30 分钟', '60 分钟', '90 分钟', '不限时'],
  },
];
// Passport tags are picked by the player and never inferred from the chosen cards. The wording
// reuses the table agreement's power levels and the questionnaire's speed and interaction options.
const PASSPORT_TAGS = [
  { key: 'level', label: TABLE_FIELDS[0].label, options: TABLE_FIELDS[0].options },
  { key: 'speed', label: '套牌速度', options: ['Turbo', '中速', '控制'] },
  {
    key: 'interaction',
    label: '干扰对手',
    options: ['Stax 锁场', '适度互动', '康完你的康他的', '各扫门前雪'],
  },
];
function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function text(value, max, required = false) {
  if (typeof value !== 'string') {
    if (required) fail('INVALID_INPUT');
    return '';
  }
  const clean = value.trim().replace(/[\u0000-\u001f\u007f]/g, ' ');
  if (Array.from(clean).length > max || (required && !clean)) fail('INVALID_INPUT');
  return clean;
}
function passportTags(input) {
  if (input === undefined || input === null) return {};
  if (typeof input !== 'object' || Array.isArray(input)) fail('INVALID_INPUT');
  const result = {};
  PASSPORT_TAGS.forEach(({ key, options }) => {
    const value = input[key];
    if (value === undefined || value === null) return;
    if (!Number.isInteger(value) || value < 0 || value >= options.length)
      fail('INVALID_INPUT');
    result[key] = value;
  });
  return result;
}
// Display helper: malformed tags are hidden instead of breaking a draft or a shared passport.
function tagLabels(input) {
  try {
    const tags = passportTags(input);
    return PASSPORT_TAGS.filter(({ key }) => key in tags).map(
      ({ key, options }) => options[tags[key]],
    );
  } catch (_) {
    return [];
  }
}
function passport(input) {
  if (!input || !Array.isArray(input.slots) || input.slots.length !== 3)
    fail('INVALID_INPUT');
  return {
    nickname: text(input.nickname, 20),
    deckName: text(input.deckName, 50),
    tags: passportTags(input.tags),
    slots: input.slots.map((slot) => {
      if (!slot || !UUID.test(slot.printId)) fail('INVALID_CARD');
      return {
        printId: slot.printId.toLowerCase(),
        reason: text(slot.reason, 40),
      };
    }),
  };
}
function table(input) {
  if (!input) fail('INVALID_INPUT');
  const result = {};
  TABLE_FIELDS.forEach(({ key, options }) => {
    const value = input[key];
    if (!Number.isInteger(value) || value < 0 || value >= options.length)
      fail('INVALID_INPUT');
    result[key] = value;
  });
  return result;
}
function ballot(input, allowed) {
  const perspective = (input && input.perspective) || 'unspecified';
  if (!input || !allowed.includes(input.choice) || !VIEWS.includes(perspective))
    fail('INVALID_VOTE');
  if (input.reason && !REASONS.includes(input.reason)) fail('INVALID_VOTE');
  return {
    choice: input.choice,
    perspective,
    reason: input.reason || 'unsure',
  };
}
function emptyCounts(choices) {
  const counts = {};
  ['all', ...VIEWS].forEach((view) => {
    counts[view] = {};
    choices.forEach((choice) => {
      counts[view][choice] = 0;
    });
  });
  return counts;
}
// Replace a ballot, never increment on client command. Called inside the DB transaction.
function replaceBallot(counts, oldVote, nextVote, choices) {
  const next = emptyCounts(choices);
  Object.keys(next).forEach((view) =>
    choices.forEach((choice) => {
      const number = counts && counts[view] && counts[view][choice];
      if (number !== undefined && (!Number.isSafeInteger(number) || number < 0))
        fail('CORRUPT_TALLY');
      next[view][choice] = number || 0;
    }),
  );
  [
    [oldVote, -1],
    [nextVote, 1],
  ].forEach(([vote, delta]) => {
    if (!vote) return;
    if (!choices.includes(vote.choice) || !VIEWS.includes(vote.perspective))
      fail('CORRUPT_TALLY');
    ['all', vote.perspective].forEach((view) => {
      next[view][vote.choice] += delta;
      if (next[view][vote.choice] < 0) fail('CORRUPT_TALLY');
    });
  });
  return next;
}
function imageUrl(value) {
  return typeof value === 'string' && /^https:\/\/cards\.scryfall\.io\//.test(value)
    ? value
    : '';
}
function card(raw) {
  if (!raw || !UUID.test(raw.id)) fail('INVALID_CARD');
  const faces = raw.card_faces || [];
  const front = faces[0] || raw;
  const images = raw.image_uris || front.image_uris || {};
  return {
    printId: raw.id,
    oracleId: raw.oracle_id || front.oracle_id || raw.id,
    name: String(raw.name || ''),
    displayName: String(raw.printed_name || front.printed_name || raw.name || ''),
    lang: String(raw.lang || 'en'),
    set: String(raw.set || ''),
    number: String(raw.collector_number || ''),
    artist: String(raw.artist || front.artist || ''),
    image: imageUrl(images.normal),
    thumb: imageUrl(images.small),
    art: imageUrl(images.art_crop),
    back: imageUrl(faces[1] && faces[1].image_uris && faces[1].image_uris.normal),
    rules: String(
      raw.printed_text ||
        raw.oracle_text ||
        faces
          .map((face) => `${face.name}\n${face.printed_text || face.oracle_text || ''}`)
          .join('\n\n'),
    ),
  };
}
module.exports = {
  SLOT_LABELS,
  UUID,
  VIEWS,
  REASONS,
  TABLE_FIELDS,
  PASSPORT_TAGS,
  fail,
  text,
  passportTags,
  tagLabels,
  passport,
  table,
  ballot,
  emptyCounts,
  replaceBallot,
  card,
};
