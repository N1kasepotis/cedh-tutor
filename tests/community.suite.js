const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const domain = require('../miniprogram/community/shared/contracts');
const { banlist } = require('../miniprogram/community/shared/catalog');
const { createService } = require('../cloudfunctions/community/service');
const banImages = require('../miniprogram/community/shared/ban-cards');

const vm = require('node:vm');
const { createRequire } = require('node:module');

test('one player profile takes precedence and legacy deck drafts remain available for migration', () => {
  const { playerPassport } = require('../miniprogram/community/utils/local');
  const old = { id: 'deck-draft', slots: [{ name: 'card' }, null, null] };
  const fuller = { id: 'fuller', slots: [{}, {}, {}] };
  const state = { passports: { deck: old, second: fuller } };
  assert.equal(playerPassport(state), fuller);
  assert.equal(state.passports.deck, old);
  state.passports.player = { id: 'player-draft', slots: [null, null, null] };
  assert.equal(playerPassport(state), state.passports.player);
  assert.equal(playerPassport({ passports: {} }), null);
});

test('unavailable tracker data does not prevent initializing and saving a player passport', () => {
  const filename = path.resolve(
    __dirname,
    '../miniprogram/community/pages/passport/index.js',
  );
  const previous = global.wx;
  const saved = new Map();
  let definition;
  try {
    global.wx = {
      getStorageSync: (key) =>
        key === trackerConfig.storageKey
          ? { broken: true }
          : saved.get(key) || '',
      setStorageSync: (key, value) => saved.set(key, value),
      showToast: () => {},
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      Page: (value) => {
        definition = value;
      },
      require: createRequire(filename),
      wx: global.wx,
    });
    const page = {
      ...definition,
      data: structuredClone(definition.data),
      setData(value) {
        Object.assign(this.data, value);
      },
    };
    page.onLoad({});
    assert.equal(page.data.deckOptions, undefined);
    assert.equal(typeof page.draftId, 'string');
    assert.equal(page.data.error, '');
    page.save();
    assert.equal(page.data.error, '');
    assert.equal(
      saved.get('playerStudio').data.passports.player.id,
      page.draftId,
    );
    assert.match(page.data.feedback, /已保存到本机/);
  } finally {
    global.wx = previous;
  }
});

test('poster identifies blocked download domains and releases a stalled image request', async () => {
  const filename = path.resolve(
    __dirname,
    '../miniprogram/community/utils/poster.js',
  );
  const ctx = {
    fillRect() {},
    fillText() {},
    measureText: () => ({ width: 1 }),
  };
  const canvas = { getContext: () => ctx };
  const page = {
    createSelectorQuery() {
      return {
        select() {
          return this;
        },
        fields() {
          return this;
        },
        exec(callback) {
          callback([{ node: canvas }]);
        },
      };
    },
  };
  for (const [getImageInfo, expected] of [
    [
      (options) => options.fail({ errMsg: 'url not in domain list' }),
      /微信下载域名配置异常/,
    ],
    [() => {}, /卡图下载超时/],
  ]) {
    const sandbox = {
      module: { exports: {} },
      require: createRequire(filename),
      wx: { getImageInfo },
      setTimeout: (callback) => setImmediate(callback),
      clearTimeout: clearImmediate,
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox);
    await assert.rejects(
      sandbox.module.exports.render(
        page,
        {
          nickname: '',
          slots: [{ image: 'https://cards.scryfall.io/test.jpg' }],
        },
        false,
      ),
      expected,
    );
  }
});

test('poster wraps English at word boundaries while keeping long tokens within the panel', () => {
  const { wrap } = require('../miniprogram/community/utils/poster');
  const lines = [];
  const ctx = { measureText: (value) => ({ width: value.length }), fillText: (value) => lines.push(value) };
  wrap(ctx, 'Players Like Really Long Card Names', 0, 0, 16, 20, 4);
  assert.deepEqual(lines, ['Players Like', 'Really Long Card', 'Names']);
  lines.length = 0;
  wrap(ctx, 'ABCDEFGHIJKLMNOPQRST', 0, 0, 8, 20, 4);
  assert.equal(lines.join(''), 'ABCDEFGHIJKLMNOPQRST');
  assert.ok(lines.every((line) => line.length <= 8));
});

test('every banned card has a complete image entry from a matching print', () => {
  assert.deepEqual(
    Object.keys(banImages).sort(),
    banlist.cards.map((card) => card.id).sort(),
  );
  for (const card of banlist.cards) {
    const entry = banImages[card.id];
    assert.ok(entry.name.split(' // ').includes(card.name));
    assert.match(entry.printId, domain.UUID);
    for (const key of ['image', 'art']) {
      const url = new URL(entry[key]);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'cards.scryfall.io');
      assert.ok(url.pathname.includes(entry.printId));
    }
  }
});

test('retired report action cannot create any public or report record', async () => {
  const { service } = fixture();
  await assert.rejects(
    service({ action: 'report', id: 'a'.repeat(64), reason: 'other' }, owner),
    { code: 'INVALID_INPUT' },
  );
});
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
      fs.readFileSync(path.join(__dirname, '../cloudfunctions/community', file), 'utf8'),
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
  assert.equal(new Set(banlist.cards.map((card) => card.id)).size, banlist.cards.length);
  assert.equal(banlist.restrictions.length, 3);
});
test('public passport rejects missing slots, forged image URLs and oversized user text', () => {
  assert.throws(() => domain.passport({ nickname: 'a', slots: [] }));
  assert.throws(() => domain.passport({ ...passport, nickname: '你'.repeat(21) }));
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

test('three selected prints can be shared without a nickname or written reasons', async () => {
  let moderationCalls = 0;
  const { service } = fixture({
    moderate: async () => {
      moderationCalls++;
      return true;
    },
  });
  const content = { slots: [0, 1, 2].map(() => ({ printId: PRINT })) };
  const result = await service(
    { action: 'publish', kind: 'passport', draftId: 'no-text', content },
    owner,
  );
  const shared = await service({ action: 'getShare', id: result.id }, friend);
  assert.equal(shared.content.nickname, '');
  assert.equal(shared.content.slots.length, 3);
  assert.equal(moderationCalls, 0);
  await service(
    {
      action: 'publish',
      kind: 'passport',
      draftId: 'with-text',
      content: { ...content, nickname: '牌友' },
    },
    owner,
  );
  assert.equal(moderationCalls, 1);
});

test('optional voting context counts as unspecified and migrates old tallies on change', async () => {
  const { service } = fixture();
  const result = await service(
    { action: 'vote', pollId, vote: { choice: 'keep' } },
    owner,
  );
  assert.equal(result.counts.all.keep, 1);
  assert.equal(result.counts.unspecified.keep, 1);
  assert.equal(result.counts.both.keep, 0);
  const changed = await service(vote('unban', 'competitive'), owner);
  assert.equal(changed.counts.unspecified.keep, 0);
  assert.equal(changed.counts.competitive.unban, 1);
  const legacy = {
    all: { keep: 1 },
    casual: { keep: 0 },
    competitive: { keep: 0 },
    both: { keep: 1 },
  };
  const next = domain.replaceBallot(
    legacy,
    { choice: 'keep', perspective: 'both' },
    { choice: 'keep', perspective: 'unspecified' },
    ['keep'],
  );
  assert.equal(next.all.keep, 1);
  assert.equal(next.both.keep, 0);
  assert.equal(next.unspecified.keep, 1);
});
test('concurrent duplicate ballots, opinion changes, perspective changes and repeated retractions count once', async () => {
  const { service } = fixture();
  await Promise.all(Array.from({ length: 12 }, () => service(vote('keep'), owner)));
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
  await assert.rejects(service({ ...vote('keep'), pollId: 'arbitrary' }, owner), {
    code: 'INVALID_VOTE',
  });
  await assert.rejects(service(vote('buy'), owner), { code: 'INVALID_VOTE' });
  assert.throws(
    () =>
      domain.replaceBallot(null, { choice: 'keep', perspective: 'both' }, null, ['keep']),
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
    assert.equal([...records.keys()].filter((key) => key.startsWith('share-')).length, 0);
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
  await assert.rejects(service({ action: 'revoke', id: published.id }, friend), {
    code: 'FORBIDDEN',
  });
  await service({ action: 'revoke', id: published.id }, owner);
  await assert.rejects(service({ action: 'getShare', id: published.id }, owner), {
    code: 'NOT_FOUND',
  });
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
  await service({ ...request, version: 1, content: { ...content, combo: 2 } }, owner);
  await assert.rejects(service(agree, friend), { code: 'CONFLICT' });
  const next = await service({ action: 'getShare', id: published.id }, friend);
  assert.equal(next.agreement.count, 0);
  assert.equal(next.agreement.agreed, false);
});
test('per-user rate limits reset without affecting another player', async () => {
  const { service, advance } = fixture();
  for (let i = 0; i < 90; i += 1) await service({ action: 'poll', pollId }, owner);
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
    decks: [{ id: 'deck', matches: [legacy, { ...legacy, id: 'new', review }] }],
  };
  const saved = serializeTrackerData(normalizeTrackerData(raw, [], trackerConfig));
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

// 六页的文字面板和输入框沿用功能页的玻璃层：面板挂 .surface，吃 dark-table 那条顶部高光
// 与柔和投影；输入框用 input-glass + hairline + radius token。赛后一分钟的输入框在 tracker
// 页里，同样换成玻璃底，不再是一块不透明的深色。
test('EDH 牌桌 panels and text fields reuse the shared glass surface', () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const glass = read('miniprogram/styles/themes/dark-table.wxss').match(
    /([^{}]*)\{\s*box-shadow: var\(--cedh-shadow-soft\), inset 0 1rpx 0 rgba\(255, 255, 255, 0\.72\);\s*\}/,
  );
  assert.ok(glass, 'dark-table 应有一条玻璃面板规则');
  assert.match(glass[1], /\.studio \.surface/);
  assert.match(glass[1], /\.picker-shell \.surface/);

  for (const name of ['hub', 'passport', 'banlist', 'table', 'swaps', 'hands']) {
    const markup = read(`miniprogram/community/pages/${name}/index.wxml`);
    for (const [, value] of markup.matchAll(/class="([^"]*)"/g)) {
      const tokens = value.split(/\s+/);
      if (tokens.includes('panel')) assert.ok(tokens.includes('surface'), `${name} 的 class="${value}" 缺少 surface`);
    }
  }
  assert.match(read('miniprogram/community/pages/passport/index.wxml'), /class="portrait-slot surface"/);

  const field = read('miniprogram/community/styles.wxss').match(
    /\.studio input,\s*\.studio textarea,\s*\.picker-shell input\s*\{[^}]*\}/,
  )[0];
  assert.match(field, /background: var\(--cedh-input-glass\)/);
  assert.match(field, /border: var\(--cedh-hairline\)/);
  assert.match(field, /border-radius: var\(--cedh-radius-2\)/);
  assert.match(
    read('miniprogram/community/pages/table/index.wxss'),
    /\.agreement-value\s*\{[^}]*background: var\(--cedh-input-glass\)/,
  );

  const reviewInput = read('miniprogram/pages/tracker/tracker.wxss').match(/\n\.review-input\s*\{[^}]*\}/)[0];
  assert.match(reviewInput, /background: var\(--cedh-input-glass\)/);
  assert.match(reviewInput, /border: var\(--cedh-hairline\)/);
});

test('ban grid drops the repeated 禁用 label and only marks the Lutri restriction', () => {
  const markup = fs.readFileSync(
    path.join(__dirname, '../miniprogram/community/pages/banlist/index.wxml'),
    'utf8',
  );
  const grid = markup.slice(
    markup.indexOf('<view class="ban-grid">'),
    markup.indexOf('<view wx:if="{{!cards.length}}"'),
  );
  assert.match(
    grid,
    /<text wx:if="\{\{item\.status !== '禁用'\}\}" class="limited-status">\{\{item\.status\}\}<\/text>/,
  );
  assert.equal((grid.match(/\{\{item\.status\}\}/g) || []).length, 1, '列表只在非「禁用」状态时渲染状态文字');
  assert.match(
    grid,
    /aria-label="\{\{item\.status === '禁用' \? item\.name : item\.name \+ '，' \+ item\.status\}\}，查看卡牌与投票"/,
  );
  assert.deepEqual(
    banlist.cards.filter((card) => card.status !== '禁用').map((card) => card.id),
    ['lutri-the-spellchaser'],
  );
});

test('practice hands cite public cEDH discussion, drop authored titles and avoid banned cards', () => {
  const { hands, handSources, poll } = require('../miniprogram/community/shared/catalog');
  const banned = new Set(banlist.cards.filter((card) => card.status === '禁用').map((card) => card.name));
  assert.equal(hands.length, 10);
  assert.equal(new Set(hands.map((hand) => hand.id)).size, hands.length);
  for (const hand of hands) {
    assert.equal(hand.title, undefined, `${hand.id} 不再使用自拟的起手标题`);
    assert.ok(hand.commander && hand.short && hand.stage && hand.table, `${hand.id} 缺少主将或对局条件`);
    assert.ok([1, 2, 3, 4].includes(hand.seat));
    assert.equal(hand.cards.length, 7);
    assert.equal(new Set(hand.cards).size, 7, `${hand.id} 应是七张不同的牌`);
    for (const card of hand.cards) assert.ok(!banned.has(card), `${hand.id} 含有禁牌 ${card}`);
    assert.ok(['keep', 'mull'].includes(hand.verdict));
    assert.ok(hand.reasons.length >= 2, `${hand.id} 需要写清理由`);
    for (const line of hand.reasons) assert.doesNotMatch(line, /^\s*$|[。.…]$|·/);
    assert.match((handSources[hand.source] || {}).url || '', /^https:\/\//, `${hand.id} 需要可复制的来源链接`);
    assert.deepEqual(poll(`hand:${hand.id}`).choices, ['keep', 'mull', 'unknown']);
  }
  assert.deepEqual([...new Set(hands.map((hand) => hand.verdict))].sort(), ['keep', 'mull']);
  assert.equal(poll('hand:yuriko-resource-v1'), null, '旧的自拟题目不再接受投票');
});

test('hands page shows seat, stage and the cited verdict with a copyable source link', () => {
  const dir = path.join(__dirname, '../miniprogram/community/pages/hands');
  const wxml = fs.readFileSync(path.join(dir, 'index.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
  assert.doesNotMatch(wxml + js, /hand\.title/);
  assert.match(wxml, /\{\{hand\.seat\}\} 号位/);
  assert.match(wxml, /\{\{hand\.stage\}\}/);
  assert.match(wxml, /wx:for="\{\{hand\.reasons\}\}"/);
  assert.match(wxml, /hand\.verdict === 'keep' \? '留' : '调度'/);
  assert.match(wxml, /bindtap="copySource"/);
  assert.match(js, /wx\.setClipboardData\(\{ data: this\.data\.source\.url \}\)/);
  assert.match(js, /title: `这手留不留：\$\{hand\.short\}，\$\{hand\.seat\} 号位`/);
});

// 入口页按用户要求精简：三张牌入口不写三类选牌说明、不留“编辑我的名片 →”一行，
// 对局约定的标签叫“条约”，也不再从这里跳去战绩页复盘
test('EDH 牌桌 hub keeps the passport entry lean and has no tracker shortcut', () => {
  const dir = path.join(__dirname, '../miniprogram/community/pages/hub');
  const wxml = fs.readFileSync(path.join(dir, 'index.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
  assert.doesNotMatch(wxml, /最喜欢的设计|编辑我的名片|feature-copy|feature-action/);
  assert.doesNotMatch(wxml, /对局复盘|bindtap="tracker"/);
  assert.doesNotMatch(js, /pages\/tracker\/tracker/);
  assert.match(js, /id: 'table',[\s\S]*?tag: '条约'/);
  assert.doesNotMatch(js, /'开局'/);
});

// 这手留不留按用户要求精简：七张牌格同宽同高；投票只有一步，不显示赛制、理由、改票撤票与刷新，
// 投过票才看比例；不再跳去试玩页
test('hands page stays lean: equal card boxes and a one-tap poll without extra controls', () => {
  const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const wxss = read('miniprogram/community/pages/hands/index.wxss');
  const tileSize = (css) => {
    const tile = css.match(/\.card-tile\s*\{[^}]*\}/)[0];
    return [tile.match(/width:\s*(\d+px)/)[1], tile.match(/height:\s*(\d+px)/)[1]];
  };
  assert.deepEqual(
    tileSize(wxss),
    tileSize(read('miniprogram/pages/playtest/playtest.wxss')),
    '七张牌用套牌试玩手牌区同样大小的卡图瓦片',
  );
  assert.doesNotMatch(wxss, /grid-column|last-child|nth-child/, '不让某一张牌显得更大');

  const wxml = read('miniprogram/community/pages/hands/index.wxml');
  assert.match(wxml, /<scroll-view class="hand" scroll-x/);
  assert.match(wxml, /class="card-tile hand-card"[\s\S]*?bindtap="previewCard"/);
  assert.match(wxml, /<image wx:if="\{\{item\.thumb\}\}" class="card-art"[^>]*lazy-load/);
  assert.match(wxml, /卡图 Scryfall[^<]*Wizards of the Coast/);
  assert.match(wxml, /<community-poll\s+compact="\{\{true\}\}"/);
  assert.doesNotMatch(wxml, /用我的套牌练习|bindtap="practice"|先投票/);
  const js = read('miniprogram/community/pages/hands/index.js');
  assert.doesNotMatch(js, /playtest/);
  assert.match(js, /`\$\{index \+ 1\} \/ \$\{hands\.length\}　\$\{hand\.short\}`/);

  const pollWxml = read('miniprogram/community/components/poll/index.wxml');
  assert.match(pollWxml, /<block wx:if="\{\{!compact && !closed\}\}">[\s\S]*?bindtap="toggleDetails"/);
  assert.match(pollWxml, /<view wx:if="\{\{!compact && !closed\}\}" class="actions">[\s\S]*?bindtap="submit"/);
  assert.match(pollWxml, /wx:if="\{\{stats && \(!compact \|\| localChoice\)\}\}"/, '练习题投过票才显示比例');
  assert.doesNotMatch(read('miniprogram/community/utils/api.js'), /投票选项已变化/);
});

// “投票选项已变化，请刷新”出在服务端不认新题号（换题后云函数还没重新部署）：每道题一进来就报，
// 刷新也没用。练习题现在点选项即投票；服务端不认题号时整块投票安静收起，也不发投票请求。
test('compact poll votes in one tap and goes quiet when the server does not know the question', async () => {
  const filename = path.resolve(__dirname, '../miniprogram/community/components/poll/index.js');
  const previous = global.wx;
  const stored = new Map();
  const calls = [];
  const events = [];
  let serverKnowsPoll = false;
  let definition;
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  try {
    global.wx = {
      getStorageSync: (key) => (stored.has(key) ? stored.get(key) : ''),
      setStorageSync: (key, value) => stored.set(key, value),
      cloud: {
        init() {},
        callFunction: async ({ data }) => {
          calls.push(data);
          if (!serverKnowsPoll) return { result: { ok: false, code: 'INVALID_VOTE' } };
          return {
            result: {
              ok: true,
              data: {
                counts: { all: { keep: 3, mull: 1, unknown: 1 } },
                mine: data.vote || null,
                updatedAt: 1,
              },
            },
          };
        },
      },
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      Component: (value) => {
        definition = value;
      },
      require: createRequire(filename),
      wx: global.wx,
    });
    const poll = {
      ...definition.methods,
      properties: {
        pollId: 'hand:ptw-kinnan-turn-one',
        choices: [
          { id: 'keep', label: '保留' },
          { id: 'mull', label: '调度' },
          { id: 'unknown', label: '还没想好' },
        ],
        compact: true,
      },
      data: structuredClone(definition.data),
      setData(value) {
        Object.assign(this.data, value);
      },
      triggerEvent(name, detail) {
        events.push({ name, choice: detail.choice });
      },
    };
    const tap = (choice) => poll.choose({ currentTarget: { dataset: { choice } } });
    const votes = () => calls.filter((call) => call.action === 'vote');

    poll.loadPoll();
    await settle();
    assert.equal(poll.data.closed, true, '服务端不认题号时收起投票');
    assert.equal(poll.data.error, '', '不再摆出用户无能为力的错误提示');
    tap('keep');
    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'answer');
    assert.equal(events[0].choice, 'keep');
    assert.equal(votes().length, 0, '题目未开放时不发投票请求');

    serverKnowsPoll = true;
    poll.loadPoll();
    await settle();
    assert.equal(poll.data.closed, false);
    tap('mull');
    await settle();
    assert.equal(votes().length, 1, '点选项即投票，不用再按一次投票');
    assert.equal(votes()[0].vote.choice, 'mull');
    assert.equal(poll.data.mine.choice, 'mull');
    assert.deepEqual(Array.from(poll.data.rows, (row) => [row.id, row.percent]), [['keep', 75], ['mull', 25]]);
    tap('mull');
    await settle();
    assert.equal(votes().length, 1, '重复点同一个选项不重复投票');
  } finally {
    global.wx = previous;
  }
});

// 名片海报按用户要求改成深暗极简：去掉三段色条、右上角大号“03”和每段序号；冷黑底、冷灰银白文字层级，
// 钴蓝只出现一次。全卡模式把整张牌等比放进左侧，卡画模式在左侧裁成画带；没署名时不重复“三张牌认识我”。
test('passport poster draws a quiet dark layout without colour spines or index numerals', async () => {
  const filename = path.resolve(__dirname, '../miniprogram/community/utils/poster.js');
  const source = fs.readFileSync(filename, 'utf8');
  const draw = async (artOnly, nickname) => {
    const log = [];
    let fill = '';
    let align = 'left';
    const ctx = {
      set fillStyle(value) {
        fill = value;
      },
      get fillStyle() {
        return fill;
      },
      set textAlign(value) {
        align = value;
      },
      get textAlign() {
        return align;
      },
      strokeStyle: '',
      lineWidth: 1,
      font: '10px sans-serif',
      measureText: (value) => ({ width: Array.from(String(value)).length * 12 }),
      fillText: (text, x, y) => log.push({ op: 'text', text: String(text), x, y, fill, align }),
      fillRect: (x, y, w, h) => log.push({ op: 'rect', x, y, w, h, fill }),
      drawImage: (...args) => log.push({ op: 'image', count: args.length }),
      fill: () => log.push({ op: 'fill', fill }),
      beginPath() {},
      moveTo() {},
      arcTo() {},
      closePath() {},
      rect() {},
      clip() {},
      stroke() {},
      save() {},
      restore() {},
    };
    const canvas = {
      getContext: () => ctx,
      createImage: () => {
        const img = { width: 488, height: 680 };
        Object.defineProperty(img, 'src', {
          set() {
            setImmediate(() => img.onload());
          },
        });
        return img;
      },
    };
    const page = {
      createSelectorQuery() {
        return {
          select() {
            return this;
          },
          fields() {
            return this;
          },
          exec(callback) {
            callback([{ node: canvas }]);
          },
        };
      },
    };
    const sandbox = {
      module: { exports: {} },
      require: createRequire(filename),
      wx: {
        getImageInfo: ({ src, success }) => success({ path: src }),
        canvasToTempFilePath: ({ success }) => success({ tempFilePath: 'poster.png' }),
      },
      setTimeout,
      clearTimeout,
    };
    vm.runInNewContext(source, sandbox);
    const slot = (name) => ({
      name,
      displayName: name,
      reason: '每局都想在第一回合放下',
      lang: 'en',
      set: 'msc',
      number: '211',
      artist: 'Myles Wohl',
      image: 'https://cards.scryfall.io/normal/front/a.jpg',
      art: 'https://cards.scryfall.io/art_crop/front/a.jpg',
    });
    const result = await sandbox.module.exports.render(
      page,
      { nickname, slots: [slot('Swords to Plowshares'), slot("Uro, Titan of Nature's Wrath"), slot('Sol Ring')] },
      artOnly,
    );
    return { result, log };
  };

  for (const [artOnly, nickname] of [[false, '周末指挥官'], [true, '']]) {
    const { result, log } = await draw(artOnly, nickname);
    assert.equal(result, 'poster.png');
    const texts = log.filter((entry) => entry.op === 'text');
    assert.ok(!texts.some((entry) => /^0[1-3]$/.test(entry.text)), '不再画 01 到 03 的编号');
    assert.ok(
      !log.some((entry) => entry.op === 'rect' && entry.x === 0 && entry.w <= 12 && entry.h >= 400),
      '不再画左侧色条',
    );
    const neutrals = ['#F1F2F5', '#B3B8C2', '#888E97', '#575E6A'];
    assert.deepEqual(
      texts.filter((entry) => !neutrals.includes(entry.fill)).map((entry) => entry.text),
      [],
      '文字只用银白与冷灰层级',
    );
    assert.equal(log.filter((entry) => entry.fill === '#2454FF').length, 1, '钴蓝只出现一次');
    for (const entry of texts) assert.ok(entry.x >= 64 && entry.x <= 836, `${entry.text} 超出左右边距`);
    const images = log.filter((entry) => entry.op === 'image');
    assert.equal(images.length, 3);
    assert.ok(
      images.every((entry) => entry.count === (artOnly ? 9 : 5)),
      artOnly ? '卡画模式裁成左侧画带' : '全卡模式整张等比放入',
    );
    const joined = texts.map((entry) => entry.text).join('');
    for (const label of ['最喜欢的设计', '代表打法的牌', '常用妙妙牌']) assert.ok(joined.includes(label));
    assert.equal(joined.includes('三张牌认识我'), Boolean(nickname), '没署名时不重复“三张牌认识我”');
    assert.ok(joined.includes('Wizards of the Coast') && joined.includes('Myles Wohl'), '卡图与画师署名保留');
  }
});

// 牌友打开分享名片时只看对方的三张牌和短评，不再和自己的选择逐项对照：万智牌太多，很难选到同一张
test('shared passport shows the friend picks without a card-by-card comparison', () => {
  const dir = path.join(__dirname, '../miniprogram/community/pages/passport');
  const wxml = fs.readFileSync(path.join(dir, 'index.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
  assert.doesNotMatch(wxml + js, /comparison|compare|我的选择|对方的选择/);
  assert.match(wxml, /friend\.content\.slots\[index\]\.displayName/);
  assert.match(wxml, /friend\.content\.slots\[index\]\.reason/);
  assert.equal(domain.compare, undefined, '只供对照用的 compare 已删除');
});

// 起手瓦片的卡图直链随包提供（scripts/build-hand-card-index.js 单批查询生成）：换题后没重跑脚本就会缺图
test('every practice hand card has a verified image from a matching print', () => {
  const { hands } = require('../miniprogram/community/shared/catalog');
  const handCards = require('../miniprogram/community/shared/hand-cards');
  const names = [...new Set(hands.flatMap((hand) => hand.cards))];
  assert.deepEqual(Object.keys(handCards).sort(), [...names].sort());
  for (const name of names) {
    const entry = handCards[name];
    assert.ok(entry.name.split(' // ').includes(name), `${name} 对应到了别的牌`);
    assert.match(entry.printId, domain.UUID);
    for (const key of ['thumb', 'image']) {
      const url = new URL(entry[key]);
      assert.equal(url.protocol, 'https:');
      assert.equal(url.hostname, 'cards.scryfall.io');
      assert.ok(url.pathname.includes(entry.printId), `${name} 的 ${key} 不是同一印刷版本`);
    }
  }
});
