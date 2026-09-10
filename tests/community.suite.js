const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const domain = require('../miniprogram/community/shared/contracts');
const { banlist } = require('../miniprogram/community/shared/catalog');
const { createService } = require('../cloudfunctions/community/service');
const {
  serializeTrackerData,
  normalizeTrackerData,
  buildTrackerExportText,
} = require('../miniprogram/utils/tracker');
const { trackerConfig } = require('../miniprogram/config/tracker');
const PRINT = '00000000-0000-0000-0000-000000000001';
const rawCard = {
  id: PRINT,
  oracle_id: '00000000-0000-0000-0000-000000000002',
  name: 'Test Card',
  lang: 'en',
  image_uris: { normal: 'https://cards.scryfall.io/normal/front/test.jpg' },
};
const passport = {
  nickname: '牌友',
  slots: [0, 1, 2].map(() => ({ printId: PRINT, reason: '设计很有趣' })),
};
function fixture(options = {}) {
  const records = new Map();
  let tail = Promise.resolve();
  let clock = 100000;
  const repository = {
    transaction: (work) => {
      const next = tail.then(async () => {
        const draft = new Map(structuredClone([...records]));
        const output = await work({
          get: async (id) => draft.get(id) || null,
          set: async (id, value) => {
            draft.set(id, structuredClone(value));
          },
        });
        records.clear();
        draft.forEach((v, k) => records.set(k, v));
        return output;
      });
      tail = next.catch(() => {});
      return next;
    },
  };
  const service = createService({
    repository,
    moderate: async () => true,
    resolveCard: async () => rawCard,
    now: () => clock,
    ...options,
  });
  return {
    records,
    service,
    advance: () => {
      clock += 60000;
    },
  };
}
const owner = { openid: 'owner' };
const friend = { openid: 'friend' };
test('corrupt local records and storage failures cannot be overwritten as successful drafts', () => {
  const local = require('../miniprogram/community/utils/local');
  const previous = global.wx;
  let writes = 0;
  try {
    global.wx = {
      getStorageSync: () => ({
        passports: { broken: {} },
        stances: {},
        tables: [],
        swaps: [],
      }),
      setStorageSync: () => {
        writes += 1;
      },
    };
    assert.throws(() => local.update(() => {}), /读取失败/);
    assert.equal(writes, 0);
    global.wx = {
      getStorageSync: () => '',
      setStorageSync: () => {
        throw new Error('quota');
      },
    };
    assert.throws(() => local.update(() => {}), /保存失败/);
  } finally {
    global.wx = previous;
  }
});
test('malformed card service responses reject rather than leaving the picker loading forever', async () => {
  const previous = global.wx;
  try {
    global.wx = {
      request: ({ success }) =>
        success({ statusCode: 200, data: { data: [{ id: 'invalid' }] } }),
    };
    const { search } = require('../miniprogram/community/utils/cards');
    await assert.rejects(search('test'), /资料不完整/);
  } finally {
    global.wx = previous;
  }
});
const pollId = `${banlist.round}:${banlist.cards[0].id}`;
const vote = (choice, perspective = 'both') => ({
  action: 'vote',
  pollId,
  vote: { choice, perspective, reason: 'balance' },
});
test('client and deployed backend share identical reviewed contracts', () => {
  for (const file of ['contracts.js', 'catalog.js'])
    assert.equal(
      fs.readFileSync(
        path.join(__dirname, '../miniprogram/community/shared', file),
        'utf8',
      ),
      fs.readFileSync(
        path.join(__dirname, '../cloudfunctions/community', file),
        'utf8',
      ),
    );
});
test('all community imports resolve inside the mini program or its own subpackage', () => {
  const root = path.resolve(__dirname, '../miniprogram');
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.js')) {
        const source = fs.readFileSync(file, 'utf8');
        for (const match of source.matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
          const target = path.resolve(path.dirname(file), match[1]);
          assert.ok(
            target.startsWith(root + path.sep),
            `Import escapes mini program: ${file} -> ${match[1]}`,
          );
          assert.ok(
            fs.existsSync(target + '.js') || fs.existsSync(target + '.json'),
            `Missing import: ${file} -> ${match[1]}`,
          );
        }
      }
    }
  }
  walk(path.join(root, 'community'));
});
test('ban snapshot preserves companion-only restriction and distinguishes category bans', () => {
  assert.equal(
    banlist.cards.find((card) => card.id === 'lutri-the-spellchaser').status,
    '仅禁作行侣',
  );
  assert.equal(banlist.cards.length, 43);
  assert.equal(
    new Set(banlist.cards.map((card) => card.id)).size,
    banlist.cards.length,
  );
  assert.equal(banlist.restrictions.length, 3);
});
test('public passport rejects missing slots, forged image URLs and oversized user text', () => {
  assert.throws(() => domain.passport({ nickname: 'a', slots: [] }));
  assert.throws(() =>
    domain.passport({ ...passport, nickname: '你'.repeat(21) }),
  );
  assert.throws(() =>
    domain.passport({
      ...passport,
      slots: [{ printId: '../../secret' }, ...passport.slots.slice(1)],
    }),
  );
  assert.equal(
    domain.card({
      ...rawCard,
      image_uris: { normal: 'https://attacker.invalid/a' },
    }).image,
    '',
  );
  assert.equal(
    domain.passport({ ...passport, arbitrary: 'discard' }).arbitrary,
    undefined,
  );
});
test('concurrent duplicate ballots, opinion changes, perspective changes and repeated retractions count once', async () => {
  const { service } = fixture();
  await Promise.all(
    Array.from({ length: 12 }, () => service(vote('keep'), owner)),
  );
  let summary = await service({ action: 'poll', pollId }, friend);
  assert.equal(summary.counts.all.keep, 1);
  assert.equal(summary.mine, null);
  await service(vote('unban', 'competitive'), owner);
  summary = await service({ action: 'poll', pollId }, owner);
  assert.equal(summary.counts.all.keep, 0);
  assert.equal(summary.counts.all.unban, 1);
  assert.equal(summary.counts.both.keep, 0);
  assert.equal(summary.counts.competitive.unban, 1);
  await service(vote('unknown'), friend);
  await service({ action: 'vote', pollId, retract: true }, owner);
  summary = await service({ action: 'vote', pollId, retract: true }, owner);
  assert.equal(summary.counts.all.unban, 0);
  assert.equal(summary.counts.all.unknown, 1);
  assert.equal(summary.mine, null);
});
test('unknown polls, forged identity, invalid votes and corrupt tallies fail closed', async () => {
  const { service } = fixture();
  await assert.rejects(service(vote('keep'), {}), { code: 'FORBIDDEN' });
  await assert.rejects(
    service({ ...vote('keep'), pollId: 'arbitrary' }, owner),
    { code: 'INVALID_VOTE' },
  );
  await assert.rejects(service(vote('buy'), owner), { code: 'INVALID_VOTE' });
  assert.throws(
    () =>
      domain.replaceBallot(
        null,
        { choice: 'keep', perspective: 'both' },
        null,
        ['keep'],
      ),
    { code: 'CORRUPT_TALLY' },
  );
});
test('moderation review/risky/error cannot create publicly retrievable content', async () => {
  for (const moderate of [
    async () => false,
    async () => {
      throw new Error('unavailable');
    },
  ]) {
    const { service, records } = fixture({ moderate });
    await assert.rejects(
      service(
        {
          action: 'publish',
          kind: 'passport',
          draftId: 'draft',
          content: passport,
        },
        owner,
      ),
    );
    assert.equal(
      [...records.keys()].filter((key) => key.startsWith('share-')).length,
      0,
    );
  }
});
test('public snapshots resolve genuine prints; revisions and deletion enforce ownership', async () => {
  const { service } = fixture();
  const request = {
    action: 'publish',
    kind: 'passport',
    draftId: 'draft',
    content: passport,
  };
  const published = await service(request, owner);
  assert.equal(published.content.slots[0].image, rawCard.image_uris.normal);
  assert.deepEqual(await service(request, owner), published);
  const read = await service({ action: 'getShare', id: published.id }, friend);
  assert.equal(read.isOwner, false);
  assert.equal(read.owner, undefined);
  assert.equal(read.openid, undefined);
  await assert.rejects(
    service(
      { ...request, content: { ...passport, nickname: 'changed' }, version: 0 },
      owner,
    ),
    { code: 'CONFLICT' },
  );
  await assert.rejects(
    service({ action: 'revoke', id: published.id }, friend),
    { code: 'FORBIDDEN' },
  );
  await service({ action: 'revoke', id: published.id }, owner);
  await assert.rejects(
    service({ action: 'getShare', id: published.id }, owner),
    { code: 'NOT_FOUND' },
  );
});
test('table confirmation is idempotent and never carries into an updated agreement', async () => {
  const { service } = fixture();
  const content = { level: 1, proxy: 0, combo: 1, turns: 1, time: 1 };
  const request = {
    action: 'publish',
    kind: 'table',
    draftId: 'table',
    content,
  };
  const published = await service(request, owner);
  const agree = { action: 'agree', id: published.id, version: 1, agreed: true };
  await service(agree, friend);
  const twice = await service(agree, friend);
  assert.equal(twice.agreement.count, 1);
  await service(
    { ...request, version: 1, content: { ...content, combo: 2 } },
    owner,
  );
  await assert.rejects(service(agree, friend), { code: 'CONFLICT' });
  const next = await service({ action: 'getShare', id: published.id }, friend);
  assert.equal(next.agreement.count, 0);
  assert.equal(next.agreement.agreed, false);
});
test('per-user rate limits reset without affecting another player', async () => {
  const { service, advance } = fixture();
  for (let i = 0; i < 90; i += 1)
    await service({ action: 'poll', pollId }, owner);
  await assert.rejects(service({ action: 'poll', pollId }, owner), {
    code: 'RATE_LIMIT',
  });
  await service({ action: 'poll', pollId }, friend);
  advance();
  await service({ action: 'poll', pollId }, owner);
});
test('postgame reviews survive tracker load, save and export without changing legacy matches', () => {
  const review = {
    turningPoint: '保留了反击',
    keyCard: 'Swan Song',
    nextChange: '测试另一张去除',
  };
  const legacy = {
    id: 'old',
    date: '2026-09-01',
    result: 'loss',
    seat: 'seat2',
  };
  const raw = {
    decks: [
      { id: 'deck', matches: [legacy, { ...legacy, id: 'new', review }] },
    ],
  };
  const saved = serializeTrackerData(
    normalizeTrackerData(raw, [], trackerConfig),
  );
  assert.deepEqual(
    saved.decks[0].matches.find((match) => match.id === 'old'),
    legacy,
  );
  assert.deepEqual(
    saved.decks[0].matches.find((match) => match.id === 'new').review,
    review,
  );
  assert.match(buildTrackerExportText(saved, {}), /关键单卡：Swan Song/);
});
