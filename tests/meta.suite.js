const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { metaTierConfig, metaTierEntries } = require('../miniprogram/config/meta-tier');
const {
  buildTierGroups,
  buildCommanderArt,
  decorateEntry,
  findEntry,
  buildMetaSummary,
  hexToRgbTriplet,
} = require('../miniprogram/utils/meta-tier');

const readMini = (relativePath) => fs.readFileSync(path.join(root, 'miniprogram', relativePath), 'utf8');
const source = JSON.parse(fs.readFileSync(path.join(root, 'tools/meta-tier/current.json'), 'utf8'));

// 梯度表是第三方（cEDH小屋）人工编辑的内容，随包发布。这一组断言守的是「数据契约」——
// 哪些能进包、哪些绝不能进包——而不是具体条目内容（内容每月都会变）。
test('环境梯度：只有已审核、未下架、档位已声明的条目能进包', () => {
  const declared = new Set(metaTierConfig.tiers.map((tier) => tier.id));
  const expected = source.entries
    .filter((entry) => entry.status === 'reviewed' && !entry.archived && declared.has(entry.tier));

  assert.equal(metaTierEntries.length, expected.length,
    '生成的条目数与源数据过滤后不一致——config/meta-tier.js 可能被手改过，请重跑 build-meta-tier.js');

  metaTierEntries.forEach((entry) => {
    assert.ok(declared.has(entry.tier), `${entry.id} 的档位 ${entry.tier} 不在已声明列表里`);
  });

  // unranked 在上游是编辑区，绝不能公开；即便上游忘了过滤，本地也必须挡住
  assert.ok(!declared.has('unranked'), 'unranked 不应出现在公开档位列表');
  assert.ok(!metaTierEntries.some((entry) => entry.tier === 'unranked'), 'unranked 条目泄漏进包');

  // 生成物必须带「请勿手改」抬头，否则下一个人会直接改生成物、下次重跑被覆盖
  assert.match(readMini('config/meta-tier.js'), /由 scripts\/build-meta-tier\.js[\s\S]*请勿手改/);
});

test('环境梯度：不携带外部导流信息与无用字段', () => {
  const raw = readMini('config/meta-tier.js');

  // QQ 群号一类外部导流：提审敏感，且本项目不做站外引流
  assert.doesNotMatch(metaTierConfig.methodology, /\d{6,}/, '方法论文案里仍有疑似群号');
  assert.doesNotMatch(raw, /QQ群|qq群|微信群|加群|群号/i, '生成物里仍有外部导流字样');

  // 但署名与免责必须保留——这是随数据走的义务，不能连着导流一起删掉
  assert.match(metaTierConfig.methodology, /人工编辑/);
  assert.ok(metaTierConfig.brand, '必须保留数据来源署名');

  // 卡图一律走 Scryfall 直连，不打包卡图、不引用上游本地图片路径
  assert.doesNotMatch(raw, /"image"|\.webp|\.png|scryfall_url/,
    '生成物不应残留本地图片路径或多余的 scryfall_url');
  metaTierEntries.forEach((entry) => {
    entry.commanders.forEach((commander) => {
      assert.match(commander.scryfallId, /^[0-9a-f-]{36}$/i,
        `${entry.id} 的 ${commander.en} 缺少合法 scryfall_id，卡图会加载失败`);
    });
  });
});

// 这一条守的是架构决定，不是行为：环境梯度是署名的人工判断，强度分级是本地确定性规则。
// 一旦前者被 require 进后者，判定链就不再可审计，同一副牌的档位会随第三方编辑改动而变。
test('环境梯度与强度分级保持解耦：评估器不得依赖梯度数据', () => {
  ['utils/bracket.js', 'utils/bracket-card-profile.js', 'utils/bracket-metadata.js', 'config/bracket-data.js']
    .forEach((file) => {
      assert.doesNotMatch(readMini(file), /meta-tier/,
        `${file} 不得引用环境梯度数据——那会把第三方人工判断注入确定性分类器`);
    });
  assert.doesNotMatch(readMini('utils/meta-tier.js'), /require\(['"].*bracket/,
    'utils/meta-tier.js 也不应反向依赖强度分级');

  // B5 不再承诺「待 meta 分析加入后提供」——这条思路已取消，不能留下空头支票
  assert.doesNotMatch(readMini('utils/bracket.js'), /待 meta 分析加入后提供/);
});

test('环境梯度：分组、派生与详情查找', () => {
  const groups = buildTierGroups(metaTierEntries);
  assert.ok(groups.length, '应至少有一个非空档位');
  groups.forEach((group) => {
    assert.ok(group.entries.length, `${group.id} 是空档位，不应渲染出只有标题的空行`);
    assert.match(group.rgb, /^\d+, \d+, \d+$/, `${group.id} 的档位色未解析成 rgb 三元组`);
  });
  // 档位顺序跟随声明顺序（T0 在前），不按字母序
  const declaredOrder = metaTierConfig.tiers.map((tier) => tier.id);
  const renderedOrder = groups.map((group) => group.id);
  assert.deepEqual(renderedOrder, declaredOrder.filter((id) => renderedOrder.includes(id)));

  assert.equal(hexToRgbTriplet('#ff0000'), '255, 0, 0');
  assert.equal(hexToRgbTriplet('nonsense'), '140, 143, 148', '颜色缺失时要有中性兜底而不是崩');

  // 单主将居中、双拍档左右分屏——与结算页、套牌试玩主将区同一语汇
  assert.equal(buildCommanderArt([]).mode, 'none');
  assert.equal(buildCommanderArt([{ scryfallId: 'a', en: 'A' }]).mode, 'single');
  assert.equal(buildCommanderArt([
    { scryfallId: 'a', en: 'A' }, { scryfallId: 'b', en: 'B' },
  ]).mode, 'dual');
  // 三位以上只取前两位，避免版面被撑破
  assert.equal(buildCommanderArt([
    { scryfallId: 'a', en: 'A' }, { scryfallId: 'b', en: 'B' }, { scryfallId: 'c', en: 'C' },
  ]).images.length, 2);

  // 中英同名时不重复显示（源数据里不少条目 name_zh === name_en）
  assert.equal(decorateEntry({ nameZh: 'Blue Farm', nameEn: 'Blue Farm', commanders: [] }).showEnName, false);
  assert.equal(decorateEntry({ nameZh: '蓝农', nameEn: 'Blue Farm', commanders: [] }).showEnName, true);

  assert.equal(findEntry('__missing__'), null);
  const first = findEntry(metaTierEntries[0].id);
  assert.ok(first && first.art, '按 id 应能取到已派生的详情');

  const summary = buildMetaSummary();
  assert.equal(summary.entryCount, metaTierEntries.length);
  assert.match(summary.publishedLabel, /^\d{4}\.\d{2}\.\d{2}$/);
});

// NEW 角标绑快照版本，而不是「没点过就一直亮」。永久常亮的角标是注意力税，
// 会训练用户忽略所有角标；绑版本后它有稳定含义——「有新一期梯度」。
test('首页 NEW 角标绑定梯度版本，看过即熄、换期重亮', () => {
  const indexJs = readMini('pages/index/index.js');
  const indexWxml = readMini('pages/index/index.wxml');
  const indexWxss = readMini('pages/index/index.wxss');
  const metaJs = readMini('pages/meta/meta.js');
  const { META_TIER_VERSION } = require('../miniprogram/config/meta-tier-version');

  // 版本号必须与梯度数据同源，不能各写各的
  assert.equal(META_TIER_VERSION, metaTierConfig.publicationId);
  assert.match(readMini('config/meta-tier-version.js'), /请勿手改/);

  // 首页只读版本号模块，不得为了一个字符串把 50KB 梯度数据拖进启动路径
  assert.match(indexJs, /require\('\.\.\/\.\.\/config\/meta-tier-version'\)/);
  assert.doesNotMatch(indexJs, /require\('\.\.\/\.\.\/config\/meta-tier'\)/);

  // 判定放在 onShow：从梯度页返回时角标要当场熄灭，不能等下次冷启动
  assert.match(indexJs, /onShow\(\)\s*{[\s\S]*metaIsNew: seen\.value !== META_TIER_VERSION/);
  assert.match(metaJs, /writeStorage\(META_SEEN_STORAGE_KEY, META_TIER_VERSION/);
  // 两侧必须用同一个 key，否则角标永远熄不掉
  const keyOf = (source) => (source.match(/META_SEEN_STORAGE_KEY = '([^']+)'/) || [])[1];
  assert.ok(keyOf(indexJs), '首页应声明 NEW 角标的存储键');
  assert.equal(keyOf(indexJs), keyOf(metaJs), '首页与梯度页的存储键必须一致');

  // 角标是条件渲染，不是常驻
  assert.match(indexWxml, /class="home-button-flag" wx:if="\{\{metaIsNew\}\}">NEW</);

  // 事故色电光蓝；被 glitch 命中时必须反相，否则蓝底蓝块糊成一片
  assert.match(indexWxss, /\.home-button-flag\s*{[^}]*background:\s*#00B3FF/);
  assert.match(indexWxss, /\.home-button\.is-glitch \.home-button-flag\s*{[^}]*background:\s*#0A0A0A/);
});

test('环境梯度页面：注册齐全、署名可见、外链只复制不内嵌', () => {
  const appJson = JSON.parse(readMini('app.json'));
  const pageJson = JSON.parse(readMini('pages/meta/meta.json'));
  const wxml = readMini('pages/meta/meta.wxml');
  const js = readMini('pages/meta/meta.js');

  assert.ok(appJson.pages.includes('pages/meta/meta'));
  assert.equal(pageJson.navigationBarTitleText, '环境梯度');

  // 个人主体不能用 web-view；topdeck.gg 链接只复制到剪贴板，与推荐结果页同一做法
  assert.doesNotMatch(wxml, /web-view/);
  assert.match(js, /copyDeckUrl\(\)[\s\S]*wx\.setClipboardData/);
  assert.match(wxml, /bindtap="copyDeckUrl"/);

  // 署名与「这不是本工具的结论」的界线必须常驻页面，不能只藏在折叠区里
  assert.match(wxml, /meta-credit[\s\S]*人工编辑[\s\S]*不代表本工具的强度分级结论/);
  assert.match(wxml, /图像来自 Scryfall/);
  // 快照性质要写明，否则用户会以为是实时榜
  assert.match(wxml, /快照/);

  // 详情面板点内部不应关闭：遮罩关闭 + 内部 catchtap 阻止冒泡
  assert.match(wxml, /class="detail-mask"[^>]*bindtap="closeDetail"/);
  assert.match(wxml, /class="detail-panel[^"]*"[^>]*catchtap="stopPropagation"/);
});
