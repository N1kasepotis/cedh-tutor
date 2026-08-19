const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const readSource = (relative) => fs.readFileSync(path.join(REPO, relative), 'utf8');

// 一副百张牌的卡图，历史上依次踩过三个坑：
//   ① 每张打一次 api.scryfall.com/cards/named?...&format=image（API 端点，要 302）
//   ② 改批量之后，双面牌的正面名一次都没进缓存，MDFC 地全程走回落慢路
//   ③ /cards/collection 根本不认 `A // B` 全名，牌表里的 MDFC 一张都查不到
// 这一组锁的是三个坑各自的修法，外加「本地主将根本不该发请求」这条新的下限。

// ---------------------------------------------------------------------------
// 构建期烤表
// ---------------------------------------------------------------------------

test('构建期烤表覆盖全部本地主将，且存的是 CDN 直链', () => {
  const { commanders } = require('../miniprogram/config/commanders');
  const { buildBakedArt, hasBakedArt, BAKED_ART } = require('../miniprogram/config/commander-art');
  const { normalizeCardName } = require('../miniprogram/utils/scryfall');

  // 与 result-display 的 splitCommanderNames 同规则：单斜杠是拍档，双斜杠是双面牌名
  const splitPartners = (name) => {
    const value = String(name || '').trim();
    if (value.indexOf(' / ') >= 0 && value.indexOf(' // ') < 0) {
      return value.split(/\s+\/\s+/).map((item) => item.trim()).filter(Boolean);
    }
    return [value];
  };

  const missing = [];
  commanders.forEach((commander) => {
    splitPartners(commander.name).forEach((name) => {
      const key = normalizeCardName(name).toLowerCase();
      if (!hasBakedArt(key)) missing.push(name);
    });
  });

  // 漏了就是改了 config/commanders.js 却忘了重跑 scripts/build-commander-art.js。
  // 漏掉的主将不会坏，只是推荐结果 / EDHTI / 强度分级的卡图退回 302 慢路——
  // 正因为「不会坏」，没有这道门禁就永远发现不了。
  assert.deepEqual(missing, [],
    `这些主将没烤进 config/commander-art.js，请重跑 node scripts/build-commander-art.js：${missing.join('、')}`);

  assert.ok(BAKED_ART.length >= 100, `烤表只有 ${BAKED_ART.length} 条，明显不完整`);

  // 烤出来的必须是 CDN 直链。烤成 api.scryfall.com 等于把 302 慢路固化进包里，
  // 比不烤更糟——不烤至少还有运行时批量解析能救。
  BAKED_ART.slice(0, 40).forEach(([key]) => {
    const art = buildBakedArt(key);
    assert.ok(art, `${key} 拼不出地址`);
    ['small', 'normal', 'artCrop'].forEach((version) => {
      assert.match(art[version], /^https:\/\/cards\.scryfall\.io\//,
        `${key} 的 ${version} 不是 CDN 直链：${art[version]}`);
      assert.doesNotMatch(art[version], /api\.scryfall\.com/);
    });
    assert.match(art.artCrop, /\/art_crop\//);
    assert.match(art.small, /\/small\//);
  });
});

test('CDN 地址的压缩与还原互为逆运算', () => {
  const { buildCdnArt, compactCdnArt } = require('../miniprogram/utils/scryfall-cdn');

  const id = '91fdb56b-54d5-4272-8319-505ff987fe9b';
  const built = buildCdnArt(id, '1712');
  assert.equal(built.small, `https://cards.scryfall.io/small/front/9/1/${id}.jpg?1712`);
  assert.equal(built.artCrop, `https://cards.scryfall.io/art_crop/front/9/1/${id}.jpg?1712`);

  const compact = compactCdnArt(built);
  assert.deepEqual(compact, { id, stamp: '1712' });

  // 任何一档对不上就必须返回 null，让调用方原样存三条地址。
  // 宁可多占字节，也不能存一条拼错的地址——那会变成线上 404，且只在真机上暴露。
  assert.equal(compactCdnArt({ ...built, normal: 'https://cards.scryfall.io/normal/front/0/0/other.jpg' }), null);
  assert.equal(compactCdnArt({ ...built, artCrop: '' }), null);
  assert.equal(compactCdnArt(null), null);
  assert.equal(buildCdnArt('not-a-uuid', '1'), null);
});

// ---------------------------------------------------------------------------
// `A // B` 全名：批量端点只认正面名
// ---------------------------------------------------------------------------

test('批量端点标识符只发正面名：双面 / 拆分 / 融合 / 冒险四类', () => {
  const { collectionIdentifier } = require('../miniprogram/utils/scryfall');

  // 实测 2026-08：这四类的全名在 /cards/collection 上一律 not_found，正面名才命中。
  // Moxfield / Archidekt 导出的就是全名写法，所以这不是边角情况。
  assert.equal(collectionIdentifier("Agadeem's Awakening // Agadeem, the Undercrypt"), "Agadeem's Awakening");
  assert.equal(collectionIdentifier('Fire // Ice'), 'Fire');
  assert.equal(collectionIdentifier('Wear // Tear'), 'Wear');
  assert.equal(collectionIdentifier('Brazen Borrower // Petty Theft'), 'Brazen Borrower');
  // 没有斜杠的原样返回，别把普通卡名也切了
  assert.equal(collectionIdentifier('Sol Ring'), 'Sol Ring');
  // 分隔符两侧空格数不固定（不同导出器写法不一），都要能砍
  assert.equal(collectionIdentifier('Fire//Ice'), 'Fire');
  assert.equal(collectionIdentifier('Fire  //  Ice'), 'Fire');
});

test('两条批量链路都必须用正面名标识符', () => {
  const cardArt = readSource('miniprogram/utils/card-art.js');
  const metadata = readSource('miniprogram/utils/bracket-metadata.js');

  // 卡图那条：漏了就是每张 MDFC 都退回 302 慢路
  assert.match(cardArt, /collectionIdentifier/,
    '卡图批量解析必须把全名砍成正面名');
  assert.doesNotMatch(cardArt, /identifiers:\s*names\.map\(\(name\) => \(\{ name \}\)\)/,
    '不能直接把牌表原文当标识符发出去');

  // 强度分级那条：漏了不是慢，是 cmc / 类别 / 价格根本查不到，
  // 那些卡会被算进「元数据未覆盖」，直接影响档位判定
  assert.match(metadata, /names\.map\(collectionIdentifier\)/,
    '强度分级的批量元数据请求同样必须用正面名');
  assert.doesNotMatch(metadata, /identifiers:\s*names\.map\(\(name\) => \(\{ name \}\)\)/);
});

// ---------------------------------------------------------------------------
// 三级取图：烤表 / 落盘 / 本次解析
// ---------------------------------------------------------------------------

function withMockWx(run) {
  const originalWx = global.wx;
  const store = new Map();
  const state = {
    requestCount: 0, lastIdentifiers: null, batches: [], cards: [],
  };

  global.wx = {
    request(options) {
      state.requestCount += 1;
      state.lastIdentifiers = (options.data.identifiers || []).map((item) => item.name);
      state.batches.push(state.lastIdentifiers);
      setTimeout(() => options.success({
        statusCode: 200,
        data: { data: state.cards, not_found: [] },
      }), 0);
    },
    setStorageSync: (key, value) => store.set(key, JSON.parse(JSON.stringify(value))),
    getStorageSync: (key) => (store.has(key) ? store.get(key) : ''),
    removeStorageSync: (key) => store.delete(key),
  };

  return Promise.resolve()
    .then(() => run(state, store))
    .finally(() => { global.wx = originalWx; });
}

const SOL_RING = {
  name: 'Sol Ring',
  image_uris: {
    small: 'https://cards.scryfall.io/small/front/9/1/91fdb56b-54d5-4272-8319-505ff987fe9b.jpg?1712',
    normal: 'https://cards.scryfall.io/normal/front/9/1/91fdb56b-54d5-4272-8319-505ff987fe9b.jpg?1712',
    art_crop: 'https://cards.scryfall.io/art_crop/front/9/1/91fdb56b-54d5-4272-8319-505ff987fe9b.jpg?1712',
  },
};

test('本地主将走烤表：一次请求都不发', () => withMockWx(async (state) => {
  const { prefetchCardArt, getCardArt, clearCardArtCache } = require('../miniprogram/utils/card-art');
  clearCardArtCache();

  // 这三位在 config/commanders.js 里，直链构建期就有了
  const names = ["Kraum, Ludevic's Opus", 'Tymna the Weaver', 'Thrasios, Triton Hero'];
  names.forEach((name) => {
    assert.match(getCardArt(name, 'artCrop'), /^https:\/\/cards\.scryfall\.io\/art_crop\//,
      `${name} 应直接命中烤表`);
  });

  await prefetchCardArt(names);
  // 这是这次改动的核心收益：推荐结果 / EDHTI / 战绩头像的卡图不再有任何网络往返。
  // 一旦这里变成非零，说明烤表没被查、或者查表顺序被写反了。
  assert.equal(state.requestCount, 0, '本地主将不该产生任何 Scryfall 请求');
}));

test('落盘：下次进来零请求；烤表内容不重复落盘', () => withMockWx(async (state, store) => {
  const { prefetchCardArt, getCardArt, clearCardArtCache } = require('../miniprogram/utils/card-art');
  clearCardArtCache();
  state.cards = [SOL_RING];

  // 顺带塞一位烤表里的主将，用来验证它不会被重复写进 storage
  await prefetchCardArt(['Sol Ring', 'Tymna the Weaver']);
  assert.equal(state.requestCount, 1);
  await new Promise((resolve) => setTimeout(resolve, 5)); // 落盘推迟了一跳

  const saved = store.get('cardArtIndex');
  assert.ok(saved && saved.data && Array.isArray(saved.data.rows), '应写下 cardArtIndex');
  const keys = saved.data.rows.map((row) => row[0]);
  assert.deepEqual(keys, ['sol ring'],
    '只有运行时解析出来的才落盘；烤表已经在包里，再写一份纯属占字节');
  // 压缩成 <键, id, 时间戳>：setStorageSync 是同步调用，写多少字节就卡多少毫秒
  assert.equal(saved.data.rows[0].length, 3, '规则对得上的地址必须压缩存储');

  // 模拟新会话：内存缓存清空，storage 保留
  clearCardArtCache();
  state.requestCount = 0;
  assert.equal(getCardArt('Sol Ring', 'normal'), SOL_RING.image_uris.normal);
  await prefetchCardArt(['Sol Ring']);
  assert.equal(state.requestCount, 0, '上次会话解析过的牌不该再问一次 Scryfall');
}));

test('落盘的表过期后整体作废，不拿陈旧地址糊弄', () => withMockWx(async (state, store) => {
  const { prefetchCardArt, getCardArt, clearCardArtCache } = require('../miniprogram/utils/card-art');
  clearCardArtCache();
  state.cards = [SOL_RING];
  await prefetchCardArt(['Sol Ring']);
  await new Promise((resolve) => setTimeout(resolve, 5));

  const saved = store.get('cardArtIndex');
  saved.data.savedAt = Date.now() - 31 * 24 * 60 * 60 * 1000; // 超过 30 天保质期
  store.set('cardArtIndex', saved);

  clearCardArtCache();
  assert.equal(getCardArt('Sol Ring', 'normal'), null, '过期的表应整体丢弃，退回重新解析');
}));

test('双面牌：发出去的是正面名，回来的三种写法都要能查到', () => withMockWx(async (state) => {
  const { prefetchCardArt, getCardArt, clearCardArtCache } = require('../miniprogram/utils/card-art');
  clearCardArtCache();
  state.cards = [{
    name: 'Malakir Rebirth // Malakir Mire',
    card_faces: [
      {
        name: 'Malakir Rebirth',
        image_uris: {
          small: 'https://cards.scryfall.io/small/front/6/0/609d3ecf-f88d-4268-a8d3-4bf2bcf5df60.jpg?1',
          normal: 'https://cards.scryfall.io/normal/front/6/0/609d3ecf-f88d-4268-a8d3-4bf2bcf5df60.jpg?1',
          art_crop: 'https://cards.scryfall.io/art_crop/front/6/0/609d3ecf-f88d-4268-a8d3-4bf2bcf5df60.jpg?1',
        },
      },
      { name: 'Malakir Mire' },
    ],
  }];

  // 牌表里写的是全名（Moxfield 导出就是这样）
  await prefetchCardArt(['Malakir Rebirth // Malakir Mire']);
  assert.deepEqual(state.lastIdentifiers, ['Malakir Rebirth'],
    '发全名的话 Scryfall 会回 not_found，这张牌就永远解析不到');

  ['Malakir Rebirth', 'Malakir Mire', 'Malakir Rebirth // Malakir Mire'].forEach((name) => {
    assert.match(getCardArt(name, 'small'), /^https:\/\/cards\.scryfall\.io\//,
      `「${name}」查不到直链，会退回 302 慢路`);
  });
}));

// ---------------------------------------------------------------------------
// 调用点：直链优先、慢路兜底
// ---------------------------------------------------------------------------

// 这条必须真的驱动页面对象跑一遍，光看源码看不出「谁排在前面」。
test('试玩页：手牌排在第一批，第一批一回来就刷视图', () => withMockWx(async (state) => {
  const { clearCardArtCache } = require('../miniprogram/utils/card-art');
  clearCardArtCache();

  const originalPage = global.Page;
  const originalGetApp = global.getApp;
  let page = null;
  global.Page = (config) => { page = config; };
  global.getApp = () => ({});
  const pagePath = require.resolve('../miniprogram/pages/playtest/playtest.js');
  delete require.cache[pagePath];
  try {
    require(pagePath);
  } finally {
    global.Page = originalPage;
    global.getApp = originalGetApp;
  }

  // 一副真实规模的牌：七张手牌 + 一位主将会显示成图，牌库里那九十多张一张都不显示
  const hand = Array.from({ length: 7 }, (_, i) => ({ id: `h${i}`, name: `Hand Card ${i}` }));
  const command = [{ id: 'c0', name: 'Commander Card' }];
  const library = Array.from({ length: 92 }, (_, i) => `Library Card ${i}`);

  const syncViewAt = [];
  const context = {
    artReady: false,
    game: { hand, battlefield: [], command },
    syncView() { syncViewAt.push(this.artReady); },
    visibleCardNames: page.visibleCardNames,
    prefetchDeckArt: page.prefetchDeckArt,
  };

  await new Promise((resolve) => {
    const done = () => resolve();
    context.syncView = function syncView() {
      syncViewAt.push(this.artReady);
      if (this.artReady) done();
    };
    context.prefetchDeckArt({
      commanders: [{ name: 'Commander Card' }],
      main: library.map((name) => ({ name })),
    });
  });

  // 分批仍是 75 一批，百张牌两批——重排名字不该让请求数变多
  assert.equal(state.batches.length, 2, `请求数应为 2，实际 ${state.batches.length}`);

  // 第一批必须以八张会显示的卡打头。排在后面的话，第一批回来时屏幕上
  // 还是一张图都没有，得等第二批——首图时间白白翻倍。
  const head = state.batches[0].slice(0, 8);
  assert.deepEqual(head, [...hand.map((card) => card.name), 'Commander Card'].slice(0, 8),
    '会显示的卡没排在第一批最前面');

  // 至少刷两次视图：第一批回来刷一次（此时 artReady 还是 false，
  // 没解析到的仍显示占位底），全部跑完再刷一次并放开回落。
  assert.ok(syncViewAt.length >= 2, `应至少刷两次视图，实际 ${syncViewAt.length} 次`);
  assert.equal(syncViewAt[0], false,
    '第一批回来时不能就放开回落——后面那批一到会把已显示的图换掉重下一遍');
  assert.equal(syncViewAt[syncViewAt.length - 1], true, '跑完必须放开回落');
}));

test('推荐结果的卡位首帧就是直链，不再先填 302 地址再替换', () => {
  const { decoratePreviewSlots } = require('../miniprogram/utils/result-display');
  const decorated = decoratePreviewSlots({ name: "Kraum, Ludevic's Opus / Tymna the Weaver" });

  decorated.previewCards.forEach((card) => {
    // 先填 api 地址、解析完再换成 CDN，等于每张卡下载两次，第一次还走的是慢的那条。
    // 微信的 <image> 只要 src 变了就会重新下载，没有「同一张图」的概念。
    assert.match(card.artCrop, /^https:\/\/cards\.scryfall\.io\//,
      `${card.name} 的首帧地址还是 API 端点，会先下一次慢的再下一次快的`);
    assert.equal(card.loading, false, '地址当场就有，不该还挂着 loading');
  });
});

test('强度分级 hero 底图直链优先，按名取图只作兜底', () => {
  const js = readSource('miniprogram/pages/bracket/bracket.js');
  assert.match(js, /getCardArt\(name, 'artCrop'\) \|\| buildScryfallImageUrl\(name, 'art_crop'\)/,
    'hero 底图必须先问缓存/烤表，取不到才回落');
});

// 这条断言必须真的跑一遍元数据请求，不能去源码里 grep `rememberCardArt(`——
// 本仓的测试连注释一起扫，把那一行注释掉，grep 版本照样绿。
test('读牌表那趟请求顺手把卡图收下，hero 底图不再单独发一次', () => withMockWx(async (state) => {
  const { fetchBracketCardMetadata } = require('../miniprogram/utils/bracket-metadata');
  const { getCardArt, clearCardArtCache } = require('../miniprogram/utils/card-art');
  clearCardArtCache();

  // 强度分级读牌表时本来就要为整副牌打 /cards/collection 拿 cmc / 类别 / 价格，
  // 那份响应里带着 image_uris。丢掉的话，hero 底图就得再走一次 302 按名取图。
  //
  // 特意用一张普通牌而不是主将：主将会直接命中构建期烤表，那样这条链路断了也测不出来。
  const commander = {
    name: 'Deflecting Swat',
    cmc: 3,
    type_line: 'Instant',
    oracle_id: '0f9a7d1e-0000-4000-8000-000000000001',
    image_uris: {
      small: 'https://cards.scryfall.io/small/front/a/b/ab000000-0000-4000-8000-000000000002.jpg?7',
      normal: 'https://cards.scryfall.io/normal/front/a/b/ab000000-0000-4000-8000-000000000002.jpg?7',
      art_crop: 'https://cards.scryfall.io/art_crop/front/a/b/ab000000-0000-4000-8000-000000000002.jpg?7',
    },
  };
  state.cards = [commander];

  assert.equal(getCardArt(commander.name, 'artCrop'), null, '前置条件：这张牌还没解析过');
  await fetchBracketCardMetadata([commander.name]);

  assert.equal(getCardArt(commander.name, 'artCrop'), commander.image_uris.art_crop,
    '元数据响应里的 image_uris 被丢掉了，hero 底图会白白多发一次 302 请求');
}));
