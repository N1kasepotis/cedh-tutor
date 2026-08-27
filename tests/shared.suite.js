const test = require('node:test');
const assert = require('node:assert/strict');

function createMockContext() {
  const calls = [];
  return {
    calls,
    textAlign: 'left',
    fillStyle: '',
    font: '',
    measureText(text) {
      return { width: Array.from(String(text)).length * 10 };
    },
    fillText(text, x, y) {
      calls.push({ op: 'fillText', text, x, y });
    },
    beginPath() { calls.push({ op: 'beginPath' }); },
    closePath() { calls.push({ op: 'closePath' }); },
    moveTo(x, y) { calls.push({ op: 'moveTo', x, y }); },
    lineTo(x, y) { calls.push({ op: 'lineTo', x, y }); },
    quadraticCurveTo(cpx, cpy, x, y) { calls.push({ op: 'quadraticCurveTo', cpx, cpy, x, y }); },
  };
}

test('canvas-kit 按字符断行遵守宽度与行数上限', () => {
  const { buildCharWrappedLines } = require('../miniprogram/utils/canvas-kit');
  const ctx = createMockContext();

  assert.deepEqual(buildCharWrappedLines(ctx, '一二三四五六七', 30, 10), ['一二三', '四五六', '七']);
  assert.deepEqual(buildCharWrappedLines(ctx, '一二三四五六七', 30, 2), ['一二三', '四五六']);
  assert.deepEqual(buildCharWrappedLines(ctx, '', 30, 2), []);
  // 单字符超宽也至少占一行，不会死循环
  assert.deepEqual(buildCharWrappedLines(ctx, '宽', 5, 2), ['宽']);
});

test('canvas-kit 按词断行保持英文单词完整', () => {
  const { buildWordWrappedLines } = require('../miniprogram/utils/canvas-kit');
  const ctx = createMockContext();

  // "Tymna the Weaver" → "Tymna"(50) / "the"(30) / "Weaver"(60)，宽度 100 时 "Tymna the" 恰好放下
  assert.deepEqual(buildWordWrappedLines(ctx, 'Tymna the Weaver', 100, 3), ['Tymna the', 'Weaver']);
  assert.deepEqual(buildWordWrappedLines(ctx, '  spaced   out  ', 1000, 3), ['spaced out']);
  assert.deepEqual(buildWordWrappedLines(ctx, '', 100, 3), []);
});

test('canvas-kit 超宽文本以省略号收尾', () => {
  const { drawFittedText } = require('../miniprogram/utils/canvas-kit');
  const ctx = createMockContext();

  drawFittedText(ctx, 'abcdef', 0, 0, 40);
  const drawn = ctx.calls.filter((call) => call.op === 'fillText');
  assert.equal(drawn.length, 1);
  assert.equal(drawn[0].text, 'abc…');

  ctx.calls.length = 0;
  drawFittedText(ctx, 'ab', 0, 0, 40);
  assert.equal(ctx.calls[0].text, 'ab');
});

test('canvas-kit 圆角矩形半径不超过短边一半', () => {
  const { drawRoundRect } = require('../miniprogram/utils/canvas-kit');
  const ctx = createMockContext();

  drawRoundRect(ctx, 0, 0, 100, 20, 50);
  const firstMove = ctx.calls.find((call) => call.op === 'moveTo');
  // 半径被钳到 height/2 = 10
  assert.deepEqual({ x: firstMove.x, y: firstMove.y }, { x: 10, y: 0 });
  assert.equal(ctx.calls.filter((call) => call.op === 'quadraticCurveTo').length, 4);
});

test('canvas-kit 字距绘制会还原 textAlign', () => {
  const { drawTrackedText } = require('../miniprogram/utils/canvas-kit');
  const ctx = createMockContext();
  ctx.textAlign = 'center';

  drawTrackedText(ctx, '导师', 100, 0, 4);
  assert.equal(ctx.textAlign, 'center');
  const drawn = ctx.calls.filter((call) => call.op === 'fillText');
  assert.equal(drawn.length, 2);
  // 总宽 = 10 + 4 + 10 = 24，居中起点 = 100 - 12 = 88，第二字 = 88 + 10 + 4 = 102
  assert.equal(drawn[0].x, 88);
  assert.equal(drawn[1].x, 102);
});

test('scryfall 模块构造 URL 并解析单双面卡图', () => {
  const {
    normalizeCardName,
    buildScryfallNamedUrl,
    buildScryfallImageUrl,
    extractCardImageUris,
  } = require('../miniprogram/utils/scryfall');

  // 撇号必须编码为 %27（裸撇号会让微信 <image> 加载失败）
  assert.equal(
    buildScryfallNamedUrl("Kraum, Ludevic's Opus"),
    'https://api.scryfall.com/cards/named?fuzzy=Kraum%2C%20Ludevic%27s%20Opus',
  );
  assert.ok(!buildScryfallNamedUrl("Thassa's Oracle").includes("'"), 'URL 里不应残留裸撇号');
  assert.ok(buildScryfallNamedUrl("Lion's Eye Diamond").includes('%27'));
  assert.ok(buildScryfallImageUrl('Tymna the Weaver').endsWith('&format=image&version=normal'));

  // 弯引号（Moxfield/MTGO 导出常见）归一化为直引号，Scryfall 才能命中；重音字母保留
  assert.equal(normalizeCardName('Gaea’s Cradle'), "Gaea's Cradle");
  assert.equal(normalizeCardName(String.fromCharCode(0x2018) + "Quote" + String.fromCharCode(0x2019) + " Test"), "'Quote' Test");
  assert.equal(normalizeCardName('Lim-Dûl the Necromancer'), 'Lim-Dûl the Necromancer');
  assert.equal(normalizeCardName('  Sol   Ring  '), 'Sol Ring');
  assert.ok(!buildScryfallNamedUrl('Gaea’s Cradle').includes('%E2%80%99'), '弯引号必须先归一化再编码，URL 里不应出现 %E2%80%99');

  const singleFace = extractCardImageUris({
    image_uris: { art_crop: 'art.jpg', normal: 'normal.jpg', large: 'large.jpg' },
  });
  assert.deepEqual(singleFace, { artCrop: 'art.jpg', normal: 'normal.jpg', large: 'large.jpg' });

  const doubleFace = extractCardImageUris({
    card_faces: [{ image_uris: { normal: 'face.jpg' } }],
  });
  assert.deepEqual(doubleFace, { artCrop: 'face.jpg', normal: 'face.jpg', large: 'face.jpg' });

  assert.deepEqual(extractCardImageUris(null), { artCrop: '', normal: '', large: '' });
});

test('scryfall 请求设置超时、复用并发请求且失败后允许重试', async () => {
  const originalWx = global.wx;
  const requests = [];
  global.wx = {
    request(options) {
      requests.push(options);
    },
  };

  try {
    const {
      SCRYFALL_REQUEST_TIMEOUT_MS,
      MAX_CONCURRENT_IMAGE_REQUESTS,
      fetchCardImageUris,
    } = require('../miniprogram/utils/scryfall');
    assert.equal(MAX_CONCURRENT_IMAGE_REQUESTS, 4);

    const first = fetchCardImageUris('Concurrent Test Card');
    const second = fetchCardImageUris('Concurrent Test Card');
    assert.equal(first, second);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].timeout, SCRYFALL_REQUEST_TIMEOUT_MS);

    requests[0].success({
      statusCode: 200,
      data: { image_uris: { normal: 'normal.jpg' } },
    });
    assert.equal((await first).normal, 'normal.jpg');

    const failed = fetchCardImageUris('Retry Test Card');
    requests[1].fail({ errMsg: 'timeout' });
    await assert.rejects(failed, /Scryfall request failed/);

    const retry = fetchCardImageUris('Retry Test Card');
    assert.equal(requests.length, 3);
    requests[2].success({ statusCode: 503, data: {} });
    await assert.rejects(retry, /503/);

    const requestBaseline = requests.length;
    const batch = Array.from({ length: 5 }, (_, index) => fetchCardImageUris(`Queue Test Card ${index}`));
    assert.equal(requests.length, requestBaseline + MAX_CONCURRENT_IMAGE_REQUESTS);
    requests[requestBaseline].success({ statusCode: 200, data: { image_uris: { normal: 'first.jpg' } } });
    await batch[0];
    assert.equal(requests.length, requestBaseline + 5);
    for (let index = requestBaseline + 1; index < requestBaseline + 5; index += 1) {
      requests[index].success({ statusCode: 200, data: { image_uris: { normal: `${index}.jpg` } } });
    }
    await Promise.all(batch);
  } finally {
    global.wx = originalWx;
  }
});

test('commander-meta 按配置阈值推导标签', () => {
  const { deriveCommanderMetaTags } = require('../miniprogram/utils/commander-meta');
  const { metaTagConfig } = require('../miniprogram/config/recommendation-rules');

  const hot = deriveCommanderMetaTags({
    name: 'Test Hot',
    sourceStats: {
      entries: metaTagConfig.competitive.minEntries,
      metaShare: 0,
      winRate: 99,
    },
  }, metaTagConfig);
  assert.ok(hot.includes('competitive'));

  const dead = deriveCommanderMetaTags({
    name: 'Test Dead',
    metaStatus: 'irrelevant',
    sourceStats: { entries: 0, metaShare: 0, winRate: 0 },
  }, metaTagConfig);
  assert.ok(dead.includes('irrelevant'));
  assert.ok(!dead.includes('competitive'));

  const outdated = deriveCommanderMetaTags({
    name: metaTagConfig.outdated.names[0] || 'Test Outdated',
    metaStatus: metaTagConfig.outdated.names.length ? undefined : 'outdated',
    sourceStats: { entries: 0, metaShare: 0, winRate: 99 },
  }, metaTagConfig);
  assert.ok(outdated.includes('outdated'));
});

test('quiz-flow 多选切换遵守 any 互斥与增删规则', () => {
  const { toggleMultiSelect } = require('../miniprogram/utils/quiz-flow');

  assert.deepEqual(toggleMultiSelect([], 'aggro', 'any'), ['aggro']);
  assert.deepEqual(toggleMultiSelect(['aggro'], 'combo', 'any'), ['aggro', 'combo']);
  assert.deepEqual(toggleMultiSelect(['aggro', 'combo'], 'aggro', 'any'), ['combo']);
  // 点 any 清空其他；再点 any 取消
  assert.deepEqual(toggleMultiSelect(['aggro', 'combo'], 'any', 'any'), ['any']);
  assert.deepEqual(toggleMultiSelect(['any'], 'any', 'any'), []);
  // 已选 any 时点其他选项，any 被移除
  assert.deepEqual(toggleMultiSelect(['any'], 'aggro', 'any'), ['aggro']);
  assert.deepEqual(toggleMultiSelect(undefined, 'aggro', 'any'), ['aggro']);
});

test('quiz-flow 答案判定、选项编号与步骤状态', () => {
  const {
    buildStepStates,
    formatOptionCode,
    hasAnswerValue,
  } = require('../miniprogram/utils/quiz-flow');

  assert.equal(formatOptionCode(0), '01');
  assert.equal(formatOptionCode(9), '10');

  assert.equal(hasAnswerValue([]), false);
  assert.equal(hasAnswerValue(['a']), true);
  assert.equal(hasAnswerValue(''), false);
  assert.equal(hasAnswerValue('a'), true);

  const steps = buildStepStates(3, 1);
  assert.deepEqual(steps.map((step) => step.state), ['done', 'current', 'idle']);
  assert.deepEqual(steps.map((step) => step.label), ['01', '02', '03']);
});

test('高转化率奖励只命中大样本高胜率主将', () => {
  const { calculateSourceStatsMultiplier } = require('../miniprogram/utils/recommender/stats');
  const { statsWeightConfig } = require('../miniprogram/config/recommendation-rules');

  const baseline = calculateSourceStatsMultiplier({
    sourceStats: { entries: 600, metaShare: 0.02, winRate: 0.2 },
  }, statsWeightConfig);
  const highConversion = calculateSourceStatsMultiplier({
    sourceStats: { entries: 215, metaShare: 0.0066, winRate: 0.255 },
  }, statsWeightConfig);
  const smallSampleFluke = calculateSourceStatsMultiplier({
    sourceStats: { entries: 40, metaShare: 0.0012, winRate: 0.4 },
  }, statsWeightConfig);

  // Arcum 型（215 场 25.5%）应获得 highMultiplier；40 场小样本高胜率不奖励
  const midPlayBaseline = calculateSourceStatsMultiplier({
    sourceStats: { entries: 215, metaShare: 0.0066, winRate: 0.2 },
  }, statsWeightConfig);
  assert.ok(highConversion > midPlayBaseline);
  assert.ok(smallSampleFluke <= calculateSourceStatsMultiplier({
    sourceStats: { entries: 40, metaShare: 0.0012, winRate: 0.2 },
  }, statsWeightConfig));
  assert.ok(baseline >= 1);
});

test('所有页面都配置了转发与朋友圈分享', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../miniprogram/app.json'), 'utf8'));

  appJson.pages.forEach((pagePath) => {
    const js = fs.readFileSync(path.join(__dirname, '../miniprogram', `${pagePath}.js`), 'utf8');
    assert.match(js, /onShareAppMessage\(\)/, `${pagePath} 缺少 onShareAppMessage`);
    assert.match(js, /onShareTimeline\(\)/, `${pagePath} 缺少 onShareTimeline`);
    assert.match(js, /enableShareMenu\(\)|wx\.showShareMenu\s*\(/, `${pagePath} 缺少 showShareMenu 显式开启`);
  });
});

test('commander-meta 批量打标签与 config/commanders 输出一致', () => {
  const { applyCommanderMetaTags } = require('../miniprogram/utils/commander-meta');
  const { commanders, metaTagConfig } = require('../miniprogram/config/commanders');

  assert.equal(commanders.length, 100);
  assert.ok(commanders.every((commander) => Array.isArray(commander.metaTags)));

  // 对已打标签的数据再跑一次推导，结果应逐一稳定（幂等）
  const reapplied = applyCommanderMetaTags(commanders, metaTagConfig);
  reapplied.forEach((commander, index) => {
    assert.deepEqual(commander.metaTags, commanders[index].metaTags, commander.name);
  });
});

// 微信的异步 API 无参调用会返回 Promise：没人 catch 时拒绝会冒成框架级的
// Error: timeout（栈里全是 WAServiceMainContext，没有任何应用帧，极难定位）。
// 这类调用必须显式传回调，退回 callback 风格。
test('异步 wx API 不使用无参调用，避免未处理的 Promise 拒绝', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');

  const SYNC_APIS = new Set([
    'getWindowInfo', 'getSystemInfoSync', 'getMenuButtonBoundingClientRect',
    'onMemoryWarning', 'offMemoryWarning', 'createSelectorQuery',
    'getStorageSync', 'setStorageSync', 'removeStorageSync', 'clearStorageSync',
    'getAppBaseInfo', 'getDeviceInfo', 'nextTick', 'getLaunchOptionsSync',
  ]);

  const offenders = [];
  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        return;
      }
      if (!entry.name.endsWith('.js')) return;
      const source = fs.readFileSync(full, 'utf8');
      const pattern = /wx\.([A-Za-z]+)\s*\(\s*\)/g;
      let match = pattern.exec(source);
      while (match) {
        if (!SYNC_APIS.has(match[1])) {
          const line = source.slice(0, match.index).split('\n').length;
          offenders.push(`${path.relative(root, full)}:${line} wx.${match[1]}()`);
        }
        match = pattern.exec(source);
      }
    });
  };
  walk(path.join(root, 'miniprogram'));

  assert.deepEqual(offenders, [], `这些异步 wx 调用需要显式回调：\n${offenders.join('\n')}`);
});

// 发布门禁：除首页与导出海报外，非导出页面禁用 radial-gradient 背景光斑。
// 唯一例外是血量记录的玩家分区光晕——它用 --player-rgb 给每位玩家上色，是该页的核心视觉。
// 例外写在这里而不是留在 README 散文里：一条「明知会被违反」的发布检查项，
// 只会训练人忽略整张检查单。
test('非导出页面不使用 radial-gradient 背景光斑（血量记录玩家分区是唯一例外）', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');

  const ALLOWED = 'miniprogram/pages/life-tracker/life-tracker.wxss';
  const offenders = [];
  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        return;
      }
      if (!entry.name.endsWith('.wxss')) return;
      if (!fs.readFileSync(full, 'utf8').includes('radial-gradient')) return;
      const rel = path.relative(root, full).split(path.sep).join('/');
      if (rel !== ALLOWED) offenders.push(rel);
    });
  };
  walk(path.join(root, 'miniprogram'));

  assert.deepEqual(offenders, [], `这些页面不应使用 radial-gradient：\n${offenders.join('\n')}`);

  // 例外本身也要有边界：血量记录里的光晕只能用于玩家分区着色，不能蔓延成通用装饰
  const lifeTracker = fs.readFileSync(path.join(root, ALLOWED), 'utf8');
  const glows = lifeTracker.match(/radial-gradient\([^;]*/g) || [];
  assert.equal(glows.length, 1, '血量记录只应有一处玩家分区光晕');
  assert.match(glows[0], /--player-rgb/, '该光晕必须由 --player-rgb 驱动（每位玩家一色），否则就是普通装饰光斑');
});

// var(--x) 取不到值不会报错，只会悄悄回退成继承值——字号、间距、颜色全都会静默失真，
// 而且 Node 测试和真机都看不出「本该是 22rpx」。曾经 --cedh-text-11 被两页用了却从未定义。
test('WXSS 不得使用未定义的设计 token', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');

  const files = [];
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.wxss')) files.push(full);
  });
  walk(path.join(root, 'miniprogram'));

  const defined = new Set();
  const used = new Map();
  files.forEach((file) => {
    const source = fs.readFileSync(file, 'utf8');
    Array.from(source.matchAll(/(--cedh-[a-z0-9-]+)\s*:/g))
      .forEach((match) => defined.add(match[1]));
    Array.from(source.matchAll(/var\((--cedh-[a-z0-9-]+)/g)).forEach((match) => {
      if (!used.has(match[1])) used.set(match[1], new Set());
      used.get(match[1]).add(path.relative(root, file).split(path.sep).join('/'));
    });
  });

  const missing = Array.from(used.keys()).filter((token) => !defined.has(token)).sort()
    .map((token) => `${token} ← ${Array.from(used.get(token)).join(', ')}`);
  assert.deepEqual(missing, [], `这些 token 被使用却从未定义：\n${missing.join('\n')}`);
});

// 卡面美术的版权属于 Wizards of the Coast 与画师，Scryfall 只是图源。
// 凡是把卡图渲染给用户看的页面都必须带署名——这是发布门禁，不是文案偏好。
// 此前只有结算页写了，另外五个渲染卡图的页面全漏了（强度分级 / 人格测试 /
// 套牌试玩 / 我的主将 / 环境梯度），靠人工记住显然不成立，所以改成按模板自动判定。
test('渲染 Scryfall 卡图的页面都必须带美术署名', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const pagesDir = path.join(root, 'miniprogram/pages');

  // 判定「这一页是否把卡图渲染给用户」：模板里的 <image> 绑定了卡图字段。
  // 只看 wxml 而不看 js——js 里有卡图字段不等于用户看得见，模板才是最终呈现。
  const ART_BINDINGS = /<image[\s\S]{0,400}?src="\{\{[^"]*(art|Art|scryfall|Scryfall|cardImage|normal)[^"]*\}\}"/;

  const rendersArt = [];
  const missingCredit = [];
  fs.readdirSync(pagesDir).forEach((page) => {
    const wxmlPath = path.join(pagesDir, page, `${page}.wxml`);
    if (!fs.existsSync(wxmlPath)) return;
    const wxml = fs.readFileSync(wxmlPath, 'utf8');
    if (!ART_BINDINGS.test(wxml)) return;
    rendersArt.push(page);
    const credited = /card-art-credit|image-credit/.test(wxml)
      && /Scryfall/.test(wxml) && /Wizards of the Coast/.test(wxml);
    if (!credited) missingCredit.push(page);
  });

  // 断言不能空转：真有页面在渲染卡图，这条才有意义
  assert.ok(rendersArt.length >= 5,
    `只识别出 ${rendersArt.length} 个渲染卡图的页面，卡图绑定的判定式可能已失效`);
  assert.deepEqual(missingCredit, [],
    `这些页面渲染了卡图却没有美术署名：${missingCredit.join(', ')}`);

  // 署名必须同时点明图源与版权方，只写其一不够
  rendersArt.forEach((page) => {
    const wxml = fs.readFileSync(path.join(pagesDir, page, `${page}.wxml`), 'utf8');
    const line = (wxml.match(/<view class="(?:card-art-credit|image-credit)">([^<]*)</)
      || wxml.match(/class="image-credit">([^<]*)</) || [])[1] || '';
    assert.match(line, /Scryfall/, `${page} 的署名缺图源 Scryfall`);
    assert.match(line, /Wizards of the Coast/, `${page} 的署名缺版权方 Wizards of the Coast`);
  });
});

// 项目配置只能有一份。此前根目录与 miniprogram/ 各有一份、同一个 AppID，
// 且已经漂移：内层那份缺 miniprogramRoot 与 urlCheck，却多了 minifyWXML。
// 危险的是 urlCheck——它是「检查安全域名」开关，漏配白名单全靠它在开发者工具里暴露；
// 从内层那份打开项目就少了这道保护，而卡图刚改成直连 cards.scryfall.io，
// 正是最需要这道检查的时候。开发者工具在子目录被打开时会自动生成配置，
// 所以这条必须是门禁而不是口头约定。
test('项目配置只有一份，且带 miniprogramRoot 与 urlCheck', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');

  // external/ 下是第三方参考仓库，各自独立，不在本项目的约束范围内
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 2) return;
    fs.readdirSync(dir, { withFileTypes: true }).forEach((item) => {
      if (item.name === 'node_modules' || item.name === 'external' || item.name === '.git') return;
      const full = path.join(dir, item.name);
      if (item.isDirectory()) walk(full, depth + 1);
      else if (item.name === 'project.config.json') found.push(path.relative(root, full));
    });
  };
  walk(root, 0);

  assert.deepEqual(found, ['project.config.json'],
    `project.config.json 只能有根目录这一份，实际找到：${found.join(', ')}`);

  const config = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
  assert.equal(config.miniprogramRoot, 'miniprogram/',
    '必须声明 miniprogramRoot，否则打包根目录会错');
  assert.equal(config.setting.urlCheck, true,
    'urlCheck 必须开着——漏配合法域名全靠它在开发者工具里暴露');
  assert.ok(config.appid && !/^tourist/i.test(config.appid), 'AppID 必须是正式号，不能是游客号');
});

// 图片加载的「丝滑」不是一个模糊感受，它由几件互不相同的事组成。
// 这条门禁只管其中能可靠判定的两件：
//   ① 有占位底  —— 解码完成前不闪白；加载失败时露出的是底色而不是一个透明洞
//   ② 挂 lazy-load —— 不在视野里的图不抢带宽
// 逐页人工记这两件事是记不住的（这次审出 7 处缺占位底、1 处缺 lazy），所以按模板自动判。
//
// **第三件「高度确定」（图到位时不顶开下方内容）没有做成门禁**，是刻意的：
// 判定它需要理解完整的祖先链——譬如强度分级的 hero 底图，图自身是 height:100%、
// 父容器 .hero-art-split 也是 height:100%，再上一层 .hero-art 才是 position:absolute
// （脱离文档流，定义上就顶不开任何东西）。静态正则解析 WXML 嵌套做不可靠，
// 初版就把这三处正确代码误报成了违规。与其留一条会误伤的门禁让人跟它打架，不如撤掉。
// 当前 19 处网络图已人工逐个核过：高度全部确定或本就脱离文档流，无布局抖动。
// 新增图片时请自行确认这一点（README「视觉规则」有记）。
test('全站网络图：有占位底、挂 lazy-load', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const pagesDir = path.join(root, 'miniprogram/pages');
  const appWxss = fs.readFileSync(path.join(root, 'miniprogram/app.wxss'), 'utf8');

  // 取出所有命中该 class 的规则体（含复合选择器）
  const rulesFor = (css, cls) => {
    const out = [];
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m = re.exec(css);
    while (m) {
      if (new RegExp(`\\.${cls}(?![\\w-])`).test(m[1])) out.push(m[2]);
      m = re.exec(css);
    }
    return out.join('\n');
  };

  const missingPlaceholder = [];
  const missingLazy = [];
  let checked = 0;

  fs.readdirSync(pagesDir).forEach((page) => {
    const wxmlPath = path.join(pagesDir, page, `${page}.wxml`);
    const wxssPath = path.join(pagesDir, page, `${page}.wxss`);
    if (!fs.existsSync(wxmlPath)) return;
    const wxml = fs.readFileSync(wxmlPath, 'utf8');
    const wxss = fs.existsSync(wxssPath) ? fs.readFileSync(wxssPath, 'utf8') : '';

    (wxml.match(/<image[\s\S]{0,500}?>/g) || []).forEach((tag) => {
      const src = (tag.match(/src="([^"]*)"/) || [])[1] || '';
      if (!src.includes('{{')) return; // 只管网络图；本地静态图不走加载态
      const cls = ((tag.match(/class="([^"]+)"/) || [])[1] || '').split(/\s+/)[0];
      if (!cls) return;
      checked += 1;
      const own = rulesFor(wxss, cls) + rulesFor(appWxss, cls);
      // 容器：模板里紧挨着这枚 image 的上一个 class
      const parentCls = ((wxml.slice(0, wxml.indexOf(tag)).match(/class="([^"]+)"[^<]*$/) || [])[1] || '')
        .split(/\s+/)[0];
      const parent = parentCls ? rulesFor(wxss, parentCls) + rulesFor(appWxss, parentCls) : '';

      const label = `${page}/.${cls}`;
      if (!/background/.test(own) && !/background/.test(parent)) missingPlaceholder.push(label);
      if (!/lazy-load/.test(tag)) missingLazy.push(label);
    });
  });

  // 断言不能空转：真有网络图，这三条才有意义
  assert.ok(checked >= 15, `只扫到 ${checked} 处网络图，模板判定式可能已失效`);

  assert.deepEqual(missingPlaceholder, [],
    `这些图没有占位底，加载中会闪白、失败会留透明洞：${missingPlaceholder.join(', ')}`);
  assert.deepEqual(missingLazy, [],
    `这些图没挂 lazy-load，不在视野里也会抢带宽：${missingLazy.join(', ')}`);
});

// 孤儿样式门禁：WXSS 里定义了、但 WXML 与 JS 里一次都拼不出来的类名。
//
// 这道门禁是从一次真实的漏接里长出来的：playtest 的 .zone-chip.drop-target 样式
// 写好了却从没挂上去——拖动过程中没有任何区块高亮，用户只能靠猜手指在哪个区上，
// 松手才知道落到哪。它不是「多余的样式」，是**没接上的功能**，而这类漏接从外面看
// 跟死代码长得一模一样，只能靠扫。同一轮还扫出五处纯孤儿（.result-button /
// .seat-button / .edhti-kicker / .commander-cn / .result-title / .recommend-rank）。
//
// 已知盲区（有意留着，宁可漏报不可误报）：类名由模板或 JS 拼出来时只能按前缀判活，
// 于是「前缀撞上另一个动态族」的孤儿会漏掉——.seat-button 就是这样躲过第一遍的
// （life-tracker 里有 seat-{{index + 1}}，但它只会产出 seat-1，永远产不出 seat-button）。
// 漏报只是少抓一个，误报却会拦住正常开发，所以这个方向是刻意选的。
test('WXSS 不得留下 WXML 与 JS 都够不着的孤儿样式', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const mini = path.join(__dirname, '..', 'miniprogram');

  const files = [];
  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(full);
    });
  };
  walk(mini);

  const read = (file) => fs.readFileSync(file, 'utf8');
  const consumers = files
    .filter((file) => file.endsWith('.wxml') || file.endsWith('.js'))
    .map(read)
    .join('\n');

  // 动态感知：类名常由模板或 JS 拼出（mode-{{playerCount}} / player-facing-${facing}），
  // 所以逐级砍尾巴，只要某个前缀后面紧跟插值就算活的。
  const reachable = (name) => {
    if (consumers.includes(name)) return true;
    const parts = name.split('-');
    for (let i = parts.length - 1; i > 0; i -= 1) {
      const prefix = `${parts.slice(0, i).join('-')}-`;
      if (consumers.includes(`${prefix}{{`) || consumers.includes(`${prefix}\${`)) return true;
    }
    return false;
  };

  const orphans = [];
  files.filter((file) => file.endsWith('.wxss')).forEach((file) => {
    const source = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
    const names = new Set(Array.from(source.matchAll(/\.([a-z][a-z0-9-]{2,})/g), (m) => m[1]));
    names.forEach((name) => {
      if (reachable(name)) return;
      orphans.push(`${path.relative(mini, file).split(path.sep).join('/')} → .${name}`);
    });
  });

  assert.deepEqual(orphans, [],
    '这些类名在 WXSS 里有样式、但 WXML 与 JS 里都拼不出来。\n'
    + '先分清是哪一种再动手：**样式写好了却忘了挂上去**（那是漏接的功能，要接上），\n'
    + '还是**改版后没人再用**（那才是删）。\n'
    + orphans.join('\n'));
});

// README 的「当前基线」数字必须与真值对得上。
//
// 散文里的数字没有主人：改了代码不会有人回去重算它，于是它慢慢变成一句假话，
// 而下一个人（或下一轮的自己）会拿它当事实用。这一轮就抓到两处——
//   · 测试数写着 347，真值 349，加了两条测试没同步；
//   · 而 349 本身还是虚的：tests/core.test.js 又 require 了五个 suite，
//     那五个因此各跑两遍，把报出来的条数抬高了 87（真实唯一条数 262）。
//     那个文件是历史遗留——npm test 早就改成 node --test tests/*.js，
//     每个 suite 都会被直接拾取，它的 require 只剩重复计数这一个效果。
//     （顺带纠正一个想当然：重复并不多花墙钟时间，node --test 是多进程并行跑文件的。）
//
// 所以这里只锁**能被算出来**的那几个。锁不住的（包体大小、覆盖率画像数）留在散文里，
// 但不要再往散文里加新的可算数字——能算的就该由这条守着。
test('README 的基线数字与真值一致', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

  const stated = (label, re) => {
    const m = readme.match(re);
    assert.ok(m, `README 里找不到「${label}」这条基线数字`);
    return Number(m[1]);
  };

  // 测试条数：静态数 tests/ 下行首的 test( 声明。这个数与 node --test 报的条数
  // 一致，前提是没有哪个文件把别的 suite 再 require 一遍。
  const suiteFiles = fs.readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.js'));
  const declared = suiteFiles.reduce((sum, file) => (
    sum + (fs.readFileSync(path.join(root, 'tests', file), 'utf8').match(/^test\(/gm) || []).length
  ), 0);
  assert.equal(stated('测试数', /(\d+) 项测试全绿/), declared,
    `README 说 ${stated('测试数', /(\d+) 项测试全绿/)} 项，实际声明了 ${declared} 项。`
    + '加删测试之后要同步这个数字。');

  // 没有哪个 suite 该被别的文件再 require 一遍——那会让同一批测试跑两遍、
  // 把报出来的条数抬高，而条数正是 README 与提交信息里反复引用的那个数
  suiteFiles.forEach((file) => {
    const source = fs.readFileSync(path.join(root, 'tests', file), 'utf8');
    const requires = Array.from(source.matchAll(/require\('\.\/([\w.-]+)'\)/g), (m) => m[1]);
    assert.deepEqual(requires, [],
      `${file} 又 require 了 ${requires.join('、')}——node --test tests/*.js 已经会拾取每个 suite，`
      + '再 require 一遍只会让它们跑两遍、把条数报虚');
  });

  // 语法门禁的文件数：口径是全仓（含 tests 与 scripts），与 scripts/check-syntax.js 一致
  // 口径必须与 scripts/check-syntax.js 一致：它只走 miniprogram / scripts / tests 三个根，
  // 不是全仓——照全仓算会多出 tools 等目录，得到一个跟门禁输出对不上的数字
  const jsFiles = [];
  const walk = (dir) => {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) jsFiles.push(full);
    });
  };
  ['miniprogram', 'scripts', 'tests'].forEach((dir) => walk(path.join(root, dir)));
  assert.equal(stated('语法门禁文件数', /当前基线：(\d+) 个 JavaScript 文件/), jsFiles.length);

  // 指挥官库人数与页面数
  const { commanders } = require('../miniprogram/config/commanders');
  assert.equal(stated('推荐诊断覆盖人数', /推荐诊断覆盖 \d+\/(\d+) 位主将/), commanders.length);
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  assert.equal(stated('页面数', /## 当前模块（(\d+) 页）/), appJson.pages.length);
});
