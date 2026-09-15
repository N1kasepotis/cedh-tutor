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
    page.nickname({ detail: { value: '牌友' } });
    page.persist();
    assert.equal(page.data.error, '');
    assert.equal(
      saved.get('playerStudio').data.passports.player.id,
      page.draftId,
    );
    assert.equal(saved.get('playerStudio').data.passports.player.nickname, '牌友');
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
test('EDH hub panels and text fields reuse the shared glass surface', () => {
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
// 对局约定的标签叫“条约”，也不再从这里跳去战绩页复盘；分区名按用户要求从“EDH 牌桌”改为“EDH hub”
test('EDH hub keeps its new name, a lean passport entry and no tracker shortcut', () => {
  const dir = path.join(__dirname, '../miniprogram/community/pages/hub');
  const wxml = fs.readFileSync(path.join(dir, 'index.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
  assert.doesNotMatch(wxml, /最喜欢的设计|编辑我的名片|feature-copy|feature-action/);
  assert.doesNotMatch(wxml, /对局复盘|bindtap="tracker"/);
  assert.doesNotMatch(js, /pages\/tracker\/tracker/);
  assert.match(js, /id: 'table',[\s\S]*?tag: '条约'/);
  assert.doesNotMatch(js, /'开局'/);
  assert.match(wxml, /<text class="title">EDH hub<\/text>/);
  assert.match(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'), /"navigationBarTitleText": "EDH hub"/);
  const mini = path.join(__dirname, '../miniprogram');
  assert.match(fs.readFileSync(path.join(mini, 'pages/index/index.wxml'), 'utf8'), /<text>EDH hub<\/text>/);
  const stale = [];
  const walk = (folder) =>
    fs.readdirSync(folder, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(wxml|wxss|js|json)$/.test(entry.name) && fs.readFileSync(full, 'utf8').includes('EDH 牌桌'))
        stale.push(path.relative(mini, full));
    });
  walk(mini);
  assert.deepEqual(stale, [], '这些文件还在用旧名');
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

// 禁牌表投票不再区分休闲、竞技这类牌手类别，也不收补充说明：只交立场，票数只看全部参与者；
// 本机旧表态里填过的类别照样能读
test('ban vote asks only for a stance and counts every player together', async () => {
  const filename = path.resolve(__dirname, '../miniprogram/community/components/poll/index.js');
  const markup = fs.readFileSync(
    path.join(__dirname, '../miniprogram/community/components/poll/index.wxml'),
    'utf8',
  );
  assert.doesNotMatch(
    markup + fs.readFileSync(filename, 'utf8'),
    /perspective|views|<picker|toggleDetails|补充投票信息|休闲 EDH|两者都玩|理由/,
  );
  const previous = global.wx;
  const stored = new Map();
  const calls = [];
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
          return {
            result: {
              ok: true,
              data: {
                counts: {
                  all: { keep: 2, unban: 1, unknown: 1 },
                  casual: { keep: 2, unban: 0, unknown: 0 },
                  competitive: { keep: 0, unban: 1, unknown: 0 },
                },
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
        pollId: 'ban:test-card',
        choices: [
          { id: 'keep', label: '维持禁用' },
          { id: 'unban', label: '解禁' },
          { id: 'unknown', label: '不了解' },
        ],
        compact: false,
      },
      data: structuredClone(definition.data),
      setData(value) {
        Object.assign(this.data, value);
      },
      triggerEvent() {},
    };
    poll.loadPoll();
    await settle();
    assert.equal(poll.data.sample, 4);
    assert.deepEqual(
      Array.from(poll.data.rows, (row) => [row.id, row.count, row.percent]),
      [
        ['keep', 2, 67],
        ['unban', 1, 33],
      ],
      '票数只看全部参与者',
    );
    poll.choose({ currentTarget: { dataset: { choice: 'unban' } } });
    assert.equal(poll.data.error, '', '只存立场的本机表态能通过校验');
    assert.equal(poll.data.remembered, true);
    await poll.submit();
    await settle();
    const votes = calls.filter((call) => call.action === 'vote');
    assert.equal(votes.length, 1);
    assert.deepEqual({ ...votes[0].vote }, { choice: 'unban' }, '投票只交立场');

    // 旧版本存下的表态带着牌手类别和补充说明，照样能读回来
    stored.get('playerStudio').data.stances['ban:test-card'] = {
      choice: 'keep',
      perspective: 'competitive',
      reason: 'balance',
    };
    poll.loadPoll();
    await settle();
    assert.equal(poll.data.localChoice, 'keep');
    assert.equal(poll.data.error, '');
  } finally {
    global.wx = previous;
  }
});

// 三张牌认识你底部按用户要求精简：草稿自动存本机，去掉“保存到本机”；“生成分享名片”成功后原位变成“分享给牌友”，
// “生成名片图片”生成后原位变成“保存到相册”；完整卡牌、只看卡画是标题行里的两个文字选项，不再单独占一行开关
test('passport bottom keeps one share button, one image button and an inline image style choice', () => {
  const dir = path.join(__dirname, '../miniprogram/community/pages/passport');
  const wxml = fs.readFileSync(path.join(dir, 'index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(dir, 'index.wxss'), 'utf8');
  assert.doesNotMatch(wxml, /保存到本机|bindtap="save"|<switch|只展示卡画|feedback/);
  assert.match(
    wxml,
    /wx:if="\{\{!shareReady\}\}"[^>]*bindtap="publish"[\s\S]*?生成分享名片[\s\S]*?wx:else[^>]*open-type="share"[\s\S]*?分享给牌友/,
  );
  assert.match(
    wxml,
    /wx:if="\{\{!posterPath\}\}"[^>]*bindtap="generatePoster"[\s\S]*?生成名片图片[\s\S]*?wx:else[^>]*bindtap="saveImage"[\s\S]*?保存到相册/,
  );
  assert.match(wxml, /loading="\{\{busy && task === 'share'\}\}"/);
  assert.match(wxml, /loading="\{\{busy && task === 'poster'\}\}"/);
  assert.match(wxml, /class="mode-option \{\{artOnly \? '' : 'mode-on'\}\}"[^>]*bindtap="mode"[^>]*>完整卡牌</);
  assert.match(wxml, /class="mode-option \{\{artOnly \? 'mode-on' : ''\}\}"[^>]*bindtap="mode"[^>]*>只看卡画</);
  assert.match(wxss, /\.mode-option\s*\{[^}]*min-height:\s*44px/, '文字选项保留 44px 热区');
  assert.equal((wxml.match(/bindblur="persist"/g) || []).length, 2, '署名和短评离开输入框时存本机');

  const filename = path.join(dir, 'index.js');
  const saved = new Map();
  const previous = global.wx;
  try {
    global.wx = {
      getStorageSync: (key) => saved.get(key) || '',
      setStorageSync: (key, value) => saved.set(key, value),
      showToast: () => {},
    };
    let definition;
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
        for (const [key, next] of Object.entries(value)) {
          const item = /^(\w+)\[(\d+)\]$/.exec(key);
          if (item) this.data[item[1]][Number(item[2])] = next;
          else this.data[key] = next;
        }
      },
    };
    const draft = () =>
      saved.get('playerStudio') ? saved.get('playerStudio').data.passports.player : null;
    page.onLoad({});
    assert.equal(page.save, undefined, '不再有手动保存');
    page.slotIndex = 0;
    page.selected({
      detail: {
        printId: '00000000-0000-0000-0000-000000000001',
        name: 'Sol Ring',
        displayName: 'Sol Ring',
        lang: 'en',
        set: 'msc',
        number: '211',
      },
    });
    assert.equal(draft().slots[0].name, 'Sol Ring', '选好牌立刻存本机');
    page.reason({ currentTarget: { dataset: { index: '0' } }, detail: { value: '每局都想第一回合放下' } });
    assert.equal(draft().slots[0].reason, '', '打字时不反复写存储');
    page.persist();
    assert.equal(draft().slots[0].reason, '每局都想第一回合放下', '离开输入框时存本机');
    page.nickname({ detail: { value: '周末指挥官' } });
    page.onHide();
    assert.equal(draft().nickname, '周末指挥官', '离开页面时存本机');
    page.setData({ posterPath: 'poster.png' });
    page.mode({ currentTarget: { dataset: { art: false } } });
    assert.equal(page.data.posterPath, 'poster.png', '点当前样式不丢掉已生成的图片');
    page.mode({ currentTarget: { dataset: { art: true } } });
    assert.deepEqual([page.data.artOnly, page.data.posterPath], [true, ''], '换样式后重新生成');
  } finally {
    global.wx = previous;
  }
});

// 用户反馈“停止分享”会让人诧异，像是有什么一直在进行。名片和对局约定都改叫“撤回分享链接”，颜色降到次要文字；
// 名片页挪到页面最下面，不再紧挨“分享给牌友”；点了先弹窗说清旧链接会打不开，确认了才撤回
test('withdrawing a shared link says what it does, sits apart from sharing and asks first', () => {
  const root = path.join(__dirname, '../miniprogram/community');
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  const passportWxml = read('pages/passport/index.wxml');
  const tableWxml = read('pages/table/index.wxml');
  for (const markup of [passportWxml, tableWxml]) {
    assert.doesNotMatch(markup, /停止分享/);
    assert.match(markup, /class="link quiet-link"\s+bindtap="revoke"[^>]*>\s*撤回分享链接\s*</);
  }
  assert.ok(
    passportWxml.indexOf('撤回分享链接') > passportWxml.indexOf('保存到相册'),
    '名片页的撤回放在图片按钮之后，不紧挨分享按钮',
  );
  assert.match(
    read('styles.wxss'),
    /\.studio button\.link\.quiet-link:not\(\[size='mini'\]\)\s*\{\s*color: var\(--cedh-text-soft\);/,
  );

  const previous = global.wx;
  try {
    for (const page of ['passport', 'table']) {
      const filename = path.join(root, `pages/${page}/index.js`);
      const modals = [];
      let answer = false;
      global.wx = {
        getStorageSync: () => '',
        setStorageSync: () => {},
        showToast: () => {},
        showModal: (options) => {
          modals.push(options);
          options.success({ confirm: answer, cancel: !answer });
        },
      };
      let definition;
      vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
        Page: (value) => {
          definition = value;
        },
        require: createRequire(filename),
        wx: global.wx,
      });
      let withdrawn = 0;
      const instance = {
        ...definition,
        data: structuredClone(definition.data),
        setData(value) {
          Object.assign(this.data, value);
        },
        withdraw() {
          withdrawn += 1;
        },
      };
      instance.revoke();
      assert.equal(withdrawn, 0, `${page} 取消时不撤回`);
      answer = true;
      instance.revoke();
      assert.equal(withdrawn, 1, `${page} 确认后才撤回`);
      assert.equal(modals[0].title, '撤回分享链接');
      assert.match(modals[0].content, /之前收到的链接会看不到/);
      assert.equal(modals[0].confirmText, '撤回');
    }
  } finally {
    global.wx = previous;
  }
});

// 发布前按 design skills 扫查 EDH hub：六页的回弹底色跟页面一样深，不再露出默认白底；入口页去掉“三张牌认识你”这行字；
// 装饰箭头不念给读屏，没有标签的输入框补读屏名称；名片图片的两个文字选项和起手卡图瓦片有按压反馈；卡图缺失时的牌名不小于 10px
test('EDH hub release sweep: dark bounce background, lean entry, labelled inputs and press feedback', () => {
  const root = path.join(__dirname, '../miniprogram/community');
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  for (const name of ['hub', 'passport', 'banlist', 'table', 'swaps', 'hands']) {
    const config = JSON.parse(read(`pages/${name}/index.json`));
    assert.deepEqual(
      [config.navigationBarBackgroundColor, config.navigationBarTextStyle, config.backgroundColor],
      ['#070707', 'white', '#070707'],
      `${name} 的导航栏与回弹底色应与页面一样深`,
    );
  }
  const hub = read('pages/hub/index.wxml');
  assert.doesNotMatch(hub, /三张牌认识你|feature-title/);
  assert.doesNotMatch(read('pages/hub/index.wxss'), /feature-title/);
  assert.match(hub, /class="portrait-entry"[^>]*aria-label="我的三张牌"/);
  assert.equal((hub.match(/<text class="entry-arrow" aria-hidden="true">↗<\/text>/g) || []).length, 2);
  assert.match(read('pages/banlist/index.wxml'), /<text class="ban-arrow" aria-hidden="true">→<\/text>/);
  for (const [file, pattern] of [
    ['pages/passport/index.wxml', /placeholder="\{\{reasonHints\[index\]\}\}"\s+aria-label="\{\{item\}\}的短评"/],
    ['pages/banlist/index.wxml', /placeholder="搜索牌名，例如 Mana Crypt"\s+aria-label="搜索禁牌"/],
    ['components/card-picker/index.wxml', /placeholder="中英文牌名"\s+aria-label="搜索单卡"/],
    ['pages/swaps/index.wxml', /placeholder="这张牌在哪些对局有用，是否值得保留"\s+aria-label="复盘这次调牌"/],
  ]) {
    assert.match(read(file), pattern, `${file} 的输入框缺读屏名称`);
  }
  const passport = read('pages/passport/index.wxml');
  assert.equal(
    (passport.match(/<view\s+class="mode-option[^>]*hover-class="pressable-active"/g) || []).length,
    2,
    '两个文字选项有按压反馈',
  );
  assert.doesNotMatch(passport, /<text\s+class="mode-option/);
  assert.match(passport, /aria-label="\{\{artOnly \? '名片图片改用完整卡牌' : '名片图片用完整卡牌，已选'\}\}"/);
  assert.match(read('pages/hands/index.wxml'), /class="card-tile hand-card"\s+hover-class="pressable-active"/);
  const fallback = read('pages/hands/index.wxss').match(/\.hand-card \.card-name\s*\{[^}]*\}/)[0];
  assert.match(fallback, /font-size:\s*10px/, '卡图缺失时的牌名不小于 10px');
});

// 名片海报：暗色收藏档案 × 玩家批注。先认识玩家（署名字最大），再读三张牌（整张卡等比加投影、
// 短评比牌名更大更亮、版本编号退到卡图下），最后在底部参与区接力（邀请语、小程序码、版权与画师）。
// 顶部没有英文抬头和强调色短线，也不画色条、编号、标签和类别记号；文字只用暖灰层级。
async function drawPassportPoster(passport, { artOnly = false } = {}) {
  const filename = path.resolve(__dirname, '../miniprogram/community/utils/poster.js');
  const log = [];
  let fill = '';
  const sizeOf = (value) => Number(/(\d+)px/.exec(value)[1]);
  const ctx = {
    font: '10px sans-serif',
    textAlign: 'left',
    strokeStyle: '',
    lineWidth: 1,
    shadowColor: '',
    shadowOffsetY: 0,
    set fillStyle(value) {
      fill = value;
    },
    get fillStyle() {
      return fill;
    },
    set shadowBlur(value) {
      log.push({ op: 'shadow', blur: value });
    },
    get shadowBlur() {
      return 0;
    },
    // 拉丁字符按半个字宽估算，汉字按一个字宽
    measureText(value) {
      const size = sizeOf(this.font);
      return {
        width: Array.from(String(value)).reduce(
          (sum, character) => sum + (character.charCodeAt(0) < 256 ? 0.55 : 1) * size,
          0,
        ),
      };
    },
    fillText(text, x, y) {
      log.push({ op: 'text', text: String(text), x, y, fill, size: sizeOf(this.font) });
    },
    fillRect: (x, y, w, h) => log.push({ op: 'rect', x, y, w, h, fill }),
    drawImage: (img, ...rest) =>
      log.push({
        op: 'image',
        url: img.url,
        count: rest.length + 1,
        x: rest[0],
        y: rest[1],
        w: rest[2],
        h: rest[3],
      }),
    fill: () => log.push({ op: 'fill', fill }),
    createRadialGradient: () => ({ addColorStop() {} }),
    stroke() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    quadraticCurveTo() {},
    closePath() {},
    rect() {},
    clip() {},
    save() {},
    restore() {},
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    createImage: () => {
      const img = { width: 488, height: 680 };
      Object.defineProperty(img, 'src', {
        set(value) {
          img.url = value;
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
  let exported = null;
  const sandbox = {
    module: { exports: {} },
    require: createRequire(filename),
    wx: {
      getImageInfo: ({ src, success }) => success({ path: src }),
      canvasToTempFilePath: (options) => {
        exported = options;
        options.success({ tempFilePath: 'poster.png' });
      },
    },
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox);
  const result = await sandbox.module.exports.render(page, passport, artOnly);
  return { result, log, canvas, exported };
}
function posterSlot(name, extra = {}) {
  return {
    name,
    displayName: name,
    reason: '每局都想在第一回合放下',
    lang: 'en',
    set: 'msc',
    number: '211',
    artist: 'Myles Wohl',
    image: 'https://cards.scryfall.io/normal/front/a.jpg',
    art: 'https://cards.scryfall.io/art_crop/front/a.jpg',
    ...extra,
  };
}

test('passport poster reads as a player archive with the QR relay at the bottom', async () => {
  const neutrals = ['#F4EEE4', '#ECE5D9', '#CEC6B9', '#B2AA9D', '#8C8478', '#6F675C'];
  const slots = [
    posterSlot('Swords to Plowshares', { displayName: '化剑为犁', lang: 'zhs' }),
    posterSlot("Uro, Titan of Nature's Wrath"),
    posterSlot('Deflecting Swat', { artist: 'Izzy' }),
  ];
  for (const [artOnly, nickname] of [
    [false, '周末指挥官'],
    [true, ''],
  ]) {
    const { result, log, canvas, exported } = await drawPassportPoster(
      { nickname, slots },
      { artOnly },
    );
    assert.equal(result, 'poster.png');
    assert.equal(canvas.width, 900);
    assert.deepEqual(
      [exported.destWidth, exported.destHeight],
      [900, canvas.height],
      '按实际画布尺寸导出',
    );
    const texts = log.filter((entry) => entry.op === 'text');
    const joined = texts.map((entry) => entry.text).join('');
    assert.ok(!texts.some((entry) => /^0[1-3]$/.test(entry.text)), '不画 01 到 03 的编号');
    assert.ok(
      !log.some((entry) => entry.op === 'rect' && entry.x === 0 && entry.w <= 12 && entry.h >= 400),
      '不画左侧色条',
    );
    assert.ok(!joined.includes('PLAYER PROFILE') && !joined.includes('cEDH Tutor'), '顶部不放英文抬头');
    // 色块只剩整幅底色与暗角、整宽 1px 灰线和颗粒；填充只剩卡牌投影底板与小程序码白底
    const plainRect = (entry) =>
      (entry.w === 900 && (entry.fill === '#110F0C' || typeof entry.fill !== 'string')) ||
      (entry.fill === '#2C2822' && entry.w === 772 && entry.h === 1) ||
      (typeof entry.fill === 'string' && entry.fill.startsWith('rgba(') && entry.w <= 2 && entry.h === 1);
    assert.deepEqual(
      log.filter((entry) => entry.op === 'rect' && !plainRect(entry)),
      [],
      '标题下不画强调色短线，也没有其他色块',
    );
    assert.ok(
      log
        .filter((entry) => entry.op === 'fill')
        .every((entry) => ['#110F0C', '#FFFFFF'].includes(entry.fill)),
      '填充只有卡牌投影底板和小程序码白底',
    );
    assert.deepEqual(
      texts.filter((entry) => !neutrals.includes(entry.fill)).map((entry) => entry.text),
      [],
      '文字只用暖灰层级，强调色不上字',
    );
    for (const entry of texts) {
      assert.ok(entry.x >= 64 && entry.x <= 836, `${entry.text} 超出左右边距`);
      assert.ok(entry.y <= canvas.height - 40, `${entry.text} 超出画布底部`);
    }

    // 身份层：署名（没署名时是“我的三张牌”）是全图最大的字；“三张牌认识我”只在有署名时出现
    const title = texts.find((entry) => entry.text === (nickname || '我的三张牌'));
    assert.ok(title && texts.every((entry) => entry.size <= title.size), '署名字最大');
    assert.ok(texts.every((entry) => entry.y >= title.y), '署名上方不再有任何文字');
    assert.equal(joined.includes('三张牌认识我'), Boolean(nickname));

    // 三张牌：整张卡等比画入并带投影；短评比牌名更大、更亮；中文印刷版本附小号英文原名
    const images = log.filter((entry) => entry.op === 'image');
    const code = images.filter((entry) => entry.url === '/assets/cT_logo_v.2.jpg');
    const cards = images.filter((entry) => entry.url !== '/assets/cT_logo_v.2.jpg');
    assert.equal(cards.length, 3);
    for (const card of cards) {
      assert.equal(card.count, 5, '卡图整张画入，不裁切');
      assert.ok(Math.abs(card.h / card.w - 680 / 488) < 0.01, '保留卡图原比例');
    }
    assert.ok(
      log.filter((entry) => entry.op === 'shadow' && entry.blur > 0).length >= 3,
      '每张卡都有投影',
    );
    const reasons = texts.filter((entry) => entry.text === '每局都想在第一回合放下');
    const names = ['化剑为犁', "Uro, Titan of Nature's Wrath", 'Deflecting Swat'].map((text) =>
      texts.find((entry) => entry.text === text),
    );
    assert.equal(reasons.length, 3);
    assert.ok(names.every(Boolean), '三张牌名都画出来');
    assert.ok(
      reasons.every((reason) => names.every((name) => reason.size > name.size)),
      '短评字号大于牌名',
    );
    assert.ok(
      reasons.every((reason) =>
        names.every((name) => neutrals.indexOf(reason.fill) < neutrals.indexOf(name.fill)),
      ),
      '短评比牌名更亮',
    );
    const original = texts.find((entry) => entry.text === 'Swords to Plowshares');
    assert.ok(original && original.size < names[0].size, '中文印刷版本附较小的英文原名');
    assert.equal(
      texts.filter((entry) => entry.text === 'Deflecting Swat').length,
      1,
      '英文版本的牌名只写一次',
    );
    for (const label of domain.SLOT_LABELS) assert.ok(joined.includes(label));
    // 收藏注释：版本、编号和语言用小字贴在每张卡图下方
    assert.ok(joined.includes('MSC #211 / ZHS') && joined.includes('MSC #211 / EN'));
    const notes = texts.filter((entry) => entry.text === 'M' && entry.x === 64);
    assert.equal(notes.length, 3, '三张牌各有一行收藏注释');
    notes.forEach((note, index) => {
      const bottom = cards[index].y + cards[index].h;
      assert.ok(note.y > bottom && note.y < bottom + 60, '收藏注释贴在卡图下方');
      assert.ok(note.size < reasons[index].size);
    });

    // 底部参与区：小程序码在右侧，邀请语、版权和画师都在三张牌下面
    const lastCardBottom = Math.max(...cards.map((card) => card.y + card.h));
    assert.equal(code.length, 1, '画一次小程序码');
    assert.ok(code[0].x >= 640 && code[0].y > lastCardBottom, '小程序码在底部右侧');
    for (const phrase of [
      '这是我看待万智牌的方式，你呢？',
      '长按识别',
      'Wizards of the Coast',
      'Myles Wohl',
      'Izzy',
    ]) {
      const entry = texts.find((item) => item.text.includes(phrase));
      assert.ok(entry && entry.y > lastCardBottom, `${phrase} 在底部参与区`);
    }
  }
});

// 短评折行：逗号句号不放在行首（连同前一个字一起换行）；末行只剩一两个字时，优先在上一行的逗号后断开，
// 找不到停顿就挪到末行凑满四个字
test('poster reasons keep punctuation off line starts and never end on a lone character', async () => {
  const reasons = [
    '开局先找它然后慢慢等对手把威胁全部拍，再处理掉',
    '喜欢它的规则设计：一句话，没有多余的字',
    '零费改对象，对手的移除换去拆他自己的主将',
  ];
  const slots = reasons.map((reason) => posterSlot('Sol Ring', { reason }));
  const { log } = await drawPassportPoster({ nickname: '牌友', slots });
  assert.deepEqual(
    log.filter((entry) => entry.op === 'text' && entry.size === 30).map((entry) => entry.text),
    [
      '开局先找它然后慢慢等对手把威胁全部',
      '拍，再处理掉',
      '喜欢它的规则设计：一句话，',
      '没有多余的字',
      '零费改对象，对手的移除换去拆他自',
      '己的主将',
    ],
  );
});

// 用户要求去掉名片标签：契约不再收标签，编辑页、牌友分享页和海报里都没有标签
test('passport has no player tags in the contract, editor, share view or poster', async () => {
  assert.equal(domain.PASSPORT_TAGS, undefined);
  assert.equal(
    domain.passport({ ...passport, tags: { level: 3 } }).tags,
    undefined,
    '提交上来的标签被丢弃',
  );
  const dir = path.join(__dirname, '../miniprogram/community/pages/passport');
  const page = ['index.js', 'index.wxml', 'index.wxss']
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
  assert.doesNotMatch(page, /tagFields|tagIndexes|friendTags|tag-field|标签/);
  const { log } = await drawPassportPoster({
    nickname: '牌友',
    tags: { level: 3, speed: 0, interaction: 2 },
    slots: [0, 1, 2].map(() => posterSlot('Sol Ring')),
  });
  const words = [
    ...domain.TABLE_FIELDS[0].options,
    'Turbo',
    '中速',
    '控制',
    'Stax 锁场',
    '适度互动',
    '康完你的康他的',
    '各扫门前雪',
  ];
  assert.deepEqual(
    log.filter((entry) => entry.op === 'text' && words.includes(entry.text)).map((entry) => entry.text),
    [],
    '海报不画标签',
  );
});

// 三张牌名片：填写提示改成让人想分享的问法；选牌弹层记住为哪个问题打开，换了问题就从头搜索，
// 同一格误关再打开仍保留上次结果
test('passport prompts invite sharing and the card picker starts fresh for a different question', () => {
  const dir = path.join(__dirname, '../miniprogram/community');
  const pageJs = fs.readFileSync(path.join(dir, 'pages/passport/index.js'), 'utf8');
  const pageWxml = fs.readFileSync(path.join(dir, 'pages/passport/index.wxml'), 'utf8');
  assert.match(pageJs, /hints: \['看一眼就心动的那张', '牌友一看就知道你怎么玩的那张', '每次打出来都让全桌愣一下的那张'\]/);
  assert.match(pageWxml, /placeholder="牌桌上大家怎么叫你，不填也行"/);
  // 短评提示按三类选牌分别问：设计问喜欢它哪一点，打法问怎么玩，妙妙牌问它妙在哪
  assert.match(
    pageJs,
    /reasonHints: \['原画、规则设计还是实战体验？', '用它说说你喜欢怎么玩', '它在你的牌组里妙在哪？'\]/,
  );
  assert.match(pageWxml, /placeholder="\{\{reasonHints\[index\]\}\}"/);
  assert.doesNotMatch(pageJs + pageWxml, /你最欣赏哪张牌的设计|说说为什么选它/);
  assert.match(pageWxml, /<card-picker[^>]*context="\{\{'slot-' \+ slotIndex\}\}"/);
  assert.match(
    fs.readFileSync(path.join(dir, 'pages/swaps/index.wxml'), 'utf8'),
    /<card-picker[^>]*context="\{\{cardTarget\}\}"/,
  );

  const filename = path.join(dir, 'components/card-picker/index.js');
  let definition;
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    Component: (value) => {
      definition = value;
    },
    require: createRequire(filename),
  });
  const picker = {
    ...definition.methods,
    data: structuredClone(definition.data),
    setData(value) {
      Object.assign(this.data, value);
    },
  };
  definition.lifetimes.attached.call(picker);
  const open = definition.observers['visible, context'];
  open.call(picker, true, 'slot-0');
  picker.setData({ query: 'Sol Ring', results: [{ printId: 'x' }], mode: 'prints', language: 2 });
  open.call(picker, false, 'slot-0');
  open.call(picker, true, 'slot-0');
  assert.equal(picker.data.query, 'Sol Ring', '同一格重开保留上次搜索');
  open.call(picker, true, 'slot-1');
  assert.equal(picker.data.query, '', '换了问题清空搜索词');
  assert.equal(picker.data.results.length, 0);
  assert.equal(picker.data.mode, 'search');
  assert.equal(picker.data.language, 0);
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
