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
