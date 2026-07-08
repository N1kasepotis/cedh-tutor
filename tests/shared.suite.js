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
