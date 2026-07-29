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

// NEW 角标按产品要求常驻，不随「看过」熄灭。既然不再需要判断是否看过，
// 版本追踪的那一套（meta-tier-version 模块、双端存储键、onShow 比对）也一并移除——
// 留着只会是没人读的存储写入。
test('首页 NEW 角标常驻，且不残留版本追踪机制', () => {
  const indexJs = readMini('pages/index/index.js');
  const indexWxml = readMini('pages/index/index.wxml');
  const indexWxss = readMini('pages/index/index.wxss');
  const metaJs = readMini('pages/meta/meta.js');

  // 常驻：无条件渲染
  assert.match(indexWxml, /class="home-button-flag">NEW</);
  assert.doesNotMatch(indexWxml, /metaIsNew/);

  // 版本追踪机制已彻底移除，不留下没人读的存储写入
  [indexJs, metaJs].forEach((source) => {
    assert.doesNotMatch(source, /META_SEEN_STORAGE_KEY|metaTierSeenVersion|META_TIER_VERSION/);
  });
  assert.ok(!fs.existsSync(path.join(root, 'miniprogram/config/meta-tier-version.js')),
    '版本号模块已无人使用，应删除');
  assert.doesNotMatch(readMini('../scripts/build-meta-tier.js'), /VERSION_TARGET/,
    '构建脚本不应再生成版本号模块');

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

  // 页面按要求不再承载版权与界限论述；署名收敛为一行 byline（谁 + 何时）
  assert.match(wxml, /class="meta-byline mono">\{\{summary\.bylineLine\}\}/);
  assert.match(buildMetaSummary().bylineLine, /^cEDH小屋\s\d{4}\.\d{2}\.\d{2}$/);
  // 列表末尾的收尾语
  assert.match(wxml, /class="meta-tail mono">持续更新中\.\.\.</);
  assert.doesNotMatch(wxml, /meta-credit|image-credit|不代表本工具|图像来自 Scryfall|免责/);

  // 详情面板点内部不应关闭：遮罩关闭 + 内部 catchtap 阻止冒泡
  assert.match(wxml, /class="detail-mask"[^>]*bindtap="closeDetail"/);
  assert.match(wxml, /class="detail-panel[^"]*"[^>]*catchtap="stopPropagation"/);

  // 详情大图不得用 aspectFill：那是居中裁切，在宽扁窗口里会把 art_crop 上下各切掉
  // 约 23%，而卡图人物头部几乎总在最上缘。必须 widthFix + 顶部对齐 + 容器裁下缘。
  const wxss = readMini('pages/meta/meta.wxss');
  assert.match(wxml, /class="detail-commander-art"[^>]*mode="widthFix"/);
  assert.doesNotMatch(wxml, /class="detail-commander-art"[^>]*mode="aspectFill"/);
  assert.match(wxss, /\.detail-commander-art-box\s*{[^}]*overflow:\s*hidden/);
  // 图本身不能再被写死高度，否则 widthFix 的比例自适应失效、又变回拉伸或裁切
  const artRule = wxss.match(/\n\.detail-commander-art\s*{[^}]*}/)[0];
  assert.doesNotMatch(artRule, /height:/, '.detail-commander-art 不应写死高度，裁切交给外层盒子');
});

test('环境梯度：触控热区、对比度、动效与安全区', () => {
  const wxss = readMini('pages/meta/meta.wxss');
  const wxml = readMini('pages/meta/meta.wxml');

  // --cedh-text-faint 是 0.46 alpha，在近黑底上只有 4.42:1，差 0.08 未达 AA 正文。
  // 承载含义的文本不许用它；只有次要分类标签可以退到 faint。
  // 选择器可能并列（.a, .b {…}），故允许 { 前有其他选择器
  const ruleOf = (name) => {
    const matched = wxss.match(new RegExp(`\\.${name}[^{]*\\{[^}]*\\}`));
    assert.ok(matched, `未找到 .${name} 的样式规则`);
    return matched[0];
  };
  ['meta-byline', 'deck-name', 'deck-en'].forEach((name) => {
    assert.doesNotMatch(ruleOf(name), /--cedh-text-faint/,
      `.${name} 承载含义，不能用未达 AA 的 faint 色`);
  });

  // 底部面板从底部滑入，保持空间连续性；只动 transform/opacity，不触发重排
  assert.match(wxss, /@keyframes meta-sheet-in[\s\S]*transform:\s*translateY/);
  const sheetKeyframes = wxss.match(/@keyframes meta-sheet-in\s*{[\s\S]*?\n}/)[0];
  assert.doesNotMatch(sheetKeyframes, /\b(width|height|top|left|margin)\s*:/,
    '入场动画只能动 transform/opacity，不能动布局属性');
  assert.match(wxss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.detail-panel[\s\S]*animation:\s*none/);

  // 遮罩必须吃掉 touchmove，否则背后的长列表会跟着滚（微信固定遮罩的老毛病）
  assert.match(wxml, /class="detail-mask"[^>]*catchtouchmove="stopPropagation"/);

  // 列表末尾与面板底部都要让开 home indicator
  assert.match(wxss, /\.meta-shell\s*{[^}]*env\(safe-area-inset-bottom\)/);
  assert.match(wxss, /\.detail-panel\s*{[^}]*env\(safe-area-inset-bottom\)/);
});

// 这是个「翻榜单」的页面：抬头越短越早看到正文，版面上只应有标题与一行署名。
// 页面按要求不承载任何版权 / 免责 / 界限论述。
test('环境梯度版面保持精简：只有标题与一行署名，无免责论述', () => {
  const wxml = readMini('pages/meta/meta.wxml');
  const wxss = readMini('pages/meta/meta.wxss');
  const summary = buildMetaSummary();

  assert.match(wxml, /class="meta-title">\{\{summary\.title\}\}/);
  assert.match(wxml, /class="meta-byline mono">\{\{summary\.bylineLine\}\}/);
  assert.doesNotMatch(wxml, /meta-kicker|meta-facts|methodology/,
    '抬头不应再有 kicker、事实行或方法论折叠区');

  // 所有免责 / 版权 / 快照界限论述都已移除
  assert.doesNotMatch(wxml, /免责|版权|不代表|不联网|不会自动更新|需更新小程序版本|快照/);

  // 展示标题用季节说法，与上游数据标题解耦（上游是「2026年7月cedh梯度表」）
  assert.equal(summary.title, '夏末梯度表');
  assert.notEqual(summary.title, metaTierConfig.publicationTitle);

  // 抬头与套牌行都不套 .surface：全页只有详情面板是卡片
  assert.doesNotMatch(wxml, /class="meta-head[^"]*surface|class="deck-row[^"]*surface/);
  assert.equal((wxml.match(/surface/g) || []).length, 1, '仅详情面板允许使用 surface');

  // 签名元素：每档一处强标记——档位标签 + 延伸发丝线 + 该档数量
  assert.match(wxml, /class="tier-label mono">\{\{item\.label\}\}/);
  assert.match(wxml, /class="tier-rule"/);
  assert.match(wxml, /class="tier-count mono">\{\{item\.count\}\}/);
  assert.match(wxss, /\.tier-rule\s*{[^}]*background:\s*rgba\(var\(--tier-rgb\)/);

  // 档位标签用首页那套点阵字面：点阵网格与「一档一档排下来」的内容形态同构。
  // 页面其余部分保持等宽，构成「点阵＝排名刻度、等宽＝元信息」的分工。
  const labelRule = wxss.match(/\.tier-label\s*\{[^}]*\}/)[0];
  assert.match(labelRule, /font-family:\s*"HomePixel"/);
  // 点阵必须用 px 且落在 10px 网格整数倍上，否则真机上糊（与首页目录同一约束）
  const labelSize = labelRule.match(/font-size:\s*(\d+)px/);
  assert.ok(labelSize, '点阵档位标签必须用 px 而不是 rpx，rpx 会随屏宽缩放、破坏点阵网格');
  assert.equal(Number(labelSize[1]) % 10, 0, `点阵字号需为 10 的整数倍，当前 ${labelSize[1]}px`);

  // 字体是页级注册（global: false），首页那次注册在本页无效，必须自己再注册
  const js = readMini('pages/meta/meta.js');
  assert.match(js, /wx\.loadFontFace\(\{[\s\S]*family: 'HomePixel'/);
  assert.match(js, /fail: \(\) => \{\}/, '字体加载失败要回退等宽栈，不能遮挡首帧');
  // 点阵只用在档位标签这一处，避免变成满页装饰
  assert.equal((wxss.match(/HomePixel/g) || []).length, 1, '点阵字面只应用于档位标签');

  // 套牌行不再各自带彩色左边框，避免 56 条彩线与档位标记抢注意力
  assert.doesNotMatch(wxss, /\.deck-row\s*{[^}]*border-left/);
});

test('环境梯度：红色粒子、无点号、长拍档缩短、中文名下带英文原名', () => {
  const wxml = readMini('pages/meta/meta.wxml');
  const wxss = readMini('pages/meta/meta.wxss');
  const { particleConfig } = require('../miniprogram/config/particle');
  const {
    shortenPartnerZh, shortenPartnerEn, englishProperNoun, fitClass, decorateEntry,
  } = require('../miniprogram/utils/meta-tier');

  // 粒子与连线走红色（取 T0 档位色一族）
  assert.match(wxml, /<particle-background palette="meta">/);
  const red = particleConfig.palettes.meta;
  assert.equal(red.accentColor, '#EF5B4C');
  ['accentColor', 'neutralColor', 'connectionColor'].forEach((key) => {
    const [r, , b] = [1, 3, 5].map((i) => parseInt(red[key].substr(i, 2), 16));
    assert.ok(r > b, `${key} 应是红调（R 高于 B），当前 ${red[key]}`);
  });

  // 全页去掉点号：署名分隔与详情项目符号都不再用 ·
  assert.doesNotMatch(wxss, /content:\s*"·/, '详情条目不应再用点号做项目符号');
  assert.doesNotMatch(buildMetaSummary().bylineLine, /·/, '署名行不应再用点号分隔');

  // 双拍档全名过长时换成短名，与编辑在别处已用的「罗噶克 + 萨拉希洛斯」体例一致
  assert.equal(
    shortenPartnerZh('现场直击的艾普·奥尼尔 / 衡心定盘莱昂纳多'),
    '奥尼尔 + 莱昂纳多',
  );
  assert.equal(shortenPartnerEn("April O'Neil, Live on the Scene / Leonardo, the Balance"),
    "April O'Neil + Leonardo");
  // 单主将不动：缩写单个名字会丢信息，那种情况交给降字号
  assert.equal(shortenPartnerZh('持绊逸才季宁'), '持绊逸才季宁');
  assert.equal(shortenPartnerEn('Kinnan, Bonder Prodigy'), 'Kinnan, Bonder Prodigy');
  assert.equal(englishProperNoun("Kraum, Ludevic's Opus"), 'Kraum');
  assert.equal(englishProperNoun('Tymna the Weaver'), 'Tymna');

  // 只有两行：第三行（主将行）与第一行重复（单主将时）或缺失（中英同名时），已删除
  assert.doesNotMatch(wxml, /deck-commanders|commanderLine/);

  // 删掉第三行后暴露的坑：牌组名是英文原型代号时（Blue Farm，name_zh === name_en），
  // 第二行原本会被「中英同名不重复显示」抑制，整行只剩一个代号、看不出是哪两位主将。
  // 这种情况第二行必须退回主将英文名。
  const { buildSecondaryName } = require('../miniprogram/utils/meta-tier');
  assert.equal(
    buildSecondaryName({
      nameZh: 'Blue Farm',
      nameEn: 'Blue Farm',
      commanders: [{ en: 'Tymna the Weaver' }, { en: "Kraum, Ludevic's Opus" }],
    }),
    "Tymna the Weaver / Kraum, Ludevic's Opus",
  );
  // 中英不同名时仍用英文原名，不要无谓地换成主将名
  assert.equal(
    buildSecondaryName({ nameZh: '持绊逸才季宁', nameEn: 'Kinnan, Bonder Prodigy', commanders: [] }),
    'Kinnan, Bonder Prodigy',
  );
  // 不变量：每一行都必须有第二行，否则那一行只剩一个认不出来的代号
  metaTierEntries.map(decorateEntry).forEach((deck) => {
    assert.ok(deck.showEnName && deck.displayNameEn,
      `${deck.nameZh} 没有第二行，只剩代号认不出是哪套牌`);
  });
  assert.match(wxml, /class="deck-name \{\{deck\.nameZhClass\}\}">\{\{deck\.displayNameZh\}\}/);
  assert.match(wxml, /class="deck-en mono \{\{deck\.nameEnClass\}\}"[^>]*>\{\{deck\.displayNameEn\}\}/);

  // 小窗里的两个按钮做透明化：去填充去投影，但必须保留描边——
  // 没有边框就成了两行普通文字，按钮的可点性就没了
  const buttonRule = wxss.match(/\.detail-button\s*\{[^}]*\}/)[0];
  assert.match(buttonRule, /background:\s*transparent/);
  assert.match(buttonRule, /box-shadow:\s*none/);
  assert.match(buttonRule, /border:\s*1rpx solid/, '透明按钮仍需描边以保住可点的观感');

  // 小窗里没有档位分组做参照，用中性石板灰等于没有颜色：把该牌组的档位色带进去
  assert.match(wxml, /class="detail-panel surface"[^>]*style="--tier-rgb: \{\{detail\.tierRgb\}\};"/);
  ['detail-kicker', 'detail-section-title'].forEach((name) => {
    assert.match(wxss, new RegExp(`\\.${name}\\s*\\{[^}]*color:\\s*rgb\\(var\\(--tier-rgb\\)\\)`),
      `.${name} 应跟随档位色`);
  });
  // 复制牌表是真动作，取档位色；关闭保持安静
  assert.match(wxml, /detail-button detail-button-primary[\s\S]{0,200}bindtap="copyDeckUrl"/);
  assert.match(wxss, /\.detail-button-primary\s*\{[^}]*color:\s*rgb\(var\(--tier-rgb\)\)/);

  // 正文提到满值：原来全挤在 soft 一档灰度上，读起来是「一片灰」
  ['detail-text', 'detail-item'].forEach((name) => {
    const rule = wxss.match(new RegExp(`\\.${name}\\s*\\{[^}]*\\}`))[0];
    assert.match(rule, /color:\s*var\(--cedh-text\)/, `.${name} 是要读的正文，应给最高对比`);
  });

  // 列表行的标签也取所在档位的颜色，避免 56 行清一色的灰
  assert.match(wxss, /\.deck-tag\s*\{[^}]*color:\s*rgba\(var\(--tier-rgb\)/);

  // 一律单行：不换行、不省略号，长了降字号
  ['deck-name', 'deck-en'].forEach((name) => {
    const rule = wxss.match(new RegExp(`\\.${name}\\s*\\{[^}]*\\}`))[0];
    assert.match(rule, /white-space:\s*nowrap/);
    assert.doesNotMatch(rule, /text-overflow/, `.${name} 不应再用省略号`);
  });
  ['name-compact', 'name-tight'].forEach((step) => {
    assert.match(wxss, new RegExp(`\\.deck-name\\.${step}\\s*\\{[^}]*font-size`));
    assert.match(wxss, new RegExp(`\\.deck-en\\.${step}\\s*\\{[^}]*font-size`));
  });

  // 降级阶梯本身要能触发（当前数据靠缩短已全部塞下，机制仍须可用）
  assert.equal(fitClass(5, 14, 17), '');
  assert.equal(fitClass(15, 14, 17), 'name-compact');
  assert.equal(fitClass(20, 14, 17), 'name-tight');

  // 全部 56 行按估算宽度都能单行放下（中日文≈1 字号，拉丁≈0.5 字号）
  const ZH = { '': 28, 'name-compact': 26, 'name-tight': 24 };
  const EN = { '': 20, 'name-compact': 18, 'name-tight': 16 };
  const widthOf = (text, size) => Array.from(String(text))
    .reduce((sum, ch) => sum + (/[一-鿿　-〿＀-￯]/.test(ch) ? size : size * 0.5), 0);
  metaTierEntries.map(decorateEntry).forEach((deck) => {
    assert.ok(widthOf(deck.displayNameZh, ZH[deck.nameZhClass]) <= 396,
      `${deck.displayNameZh} 中文名单行放不下`);
    if (deck.showEnName) {
      assert.ok(widthOf(deck.displayNameEn, EN[deck.nameEnClass]) <= 396,
        `${deck.displayNameEn} 英文名单行放不下`);
    }
  });
});
