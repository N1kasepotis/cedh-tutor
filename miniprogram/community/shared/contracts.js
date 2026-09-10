'use strict';

// Portable domain contract. scripts/sync-community.js copies this to the cloud function.
const SLOT_LABELS = ['设计之选', '我的打法', '私藏单卡'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const VIEWS = ['casual', 'competitive', 'both'];
const REASONS = ['balance', 'diversity', 'experience', 'identity', 'unsure'];
const TABLE_FIELDS = [
  {
    key: 'level',
    label: '本桌目标',
    options: ['轻松主题局', '优化休闲局', '高强度对局', 'cEDH'],
  },
  {
    key: 'proxy',
    label: '代牌',
    options: ['接受清晰代牌', '先说明再决定', '本桌不用代牌'],
  },
  {
    key: 'combo',
    label: '无限组合',
    options: ['可以使用', '开局前说明', '本桌避免'],
  },
  {
    key: 'turns',
    label: '额外回合',
    options: ['可以使用', '避免连续加回合', '本桌避免'],
  },
  {
    key: 'time',
    label: '预计时长',
    options: ['30 分钟', '60 分钟', '90 分钟', '不限时'],
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
  if (Array.from(clean).length > max || (required && !clean))
    fail('INVALID_INPUT');
  return clean;
}
function passport(input) {
  if (!input || !Array.isArray(input.slots) || input.slots.length !== 3)
    fail('INVALID_INPUT');
  return {
    nickname: text(input.nickname, 20, true),
    deckName: text(input.deckName, 50),
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
  if (
    !input ||
    !allowed.includes(input.choice) ||
    !VIEWS.includes(input.perspective)
  )
    fail('INVALID_VOTE');
  if (input.reason && !REASONS.includes(input.reason)) fail('INVALID_VOTE');
  return {
    choice: input.choice,
    perspective: input.perspective,
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
  return typeof value === 'string' &&
    /^https:\/\/cards\.scryfall\.io\//.test(value)
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
    displayName: String(
      raw.printed_name || front.printed_name || raw.name || '',
    ),
    lang: String(raw.lang || 'en'),
    set: String(raw.set || ''),
    number: String(raw.collector_number || ''),
    artist: String(raw.artist || front.artist || ''),
    image: imageUrl(images.normal),
    art: imageUrl(images.art_crop),
    back: imageUrl(
      faces[1] && faces[1].image_uris && faces[1].image_uris.normal,
    ),
    rules: String(
      raw.printed_text ||
        raw.oracle_text ||
        faces
          .map(
            (face) =>
              `${face.name}\n${face.printed_text || face.oracle_text || ''}`,
          )
          .join('\n\n'),
    ),
  };
}
function compare(left, right) {
  return SLOT_LABELS.map((label, index) => {
    const a = left && left.slots && left.slots[index];
    const b = right && right.slots && right.slots[index];
    return {
      label,
      left: a || null,
      right: b || null,
      match:
        !a || !b
          ? '尚未选牌'
          : a.printId === b.printId
            ? '同牌同版本'
            : a.oracleId === b.oracleId
              ? '同一张牌，不同版本'
              : '不同选择',
    };
  });
}
module.exports = {
  SLOT_LABELS,
  UUID,
  VIEWS,
  REASONS,
  TABLE_FIELDS,
  fail,
  text,
  passport,
  table,
  ballot,
  emptyCounts,
  replaceBallot,
  card,
  compare,
};
