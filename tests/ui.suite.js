const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildPreferenceProfile,
  buildEffectiveMatchTags,
  recommendCommanders,
  calculateCostTier,
  calculateColorMatchMultiplier,
  calculateStatsMultiplier,
  formatFitScore,
} = require('../miniprogram/utils/recommender');
const { questions, dimensionLabels, matchingConfig } = require('../miniprogram/config/questionnaire');
const {
  commanders,
  costTierConfig,
  metaTagConfig,
  statsWeightConfig,
} = require('../miniprogram/config/commanders');
const { particleConfig } = require('../miniprogram/config/particle');
const { performanceConfig } = require('../miniprogram/config/performance');

const root = path.join(__dirname, '..');

test('home is a single-screen acid index with the eight existing actions', () => {
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxss'), 'utf8');
  const shareUtil = fs.readFileSync(path.join(root, 'miniprogram/utils/share.js'), 'utf8');
  const pageJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.json'), 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));

  assert.match(wxml, /class="home-title-brand">cEDH Tutor<\/text>/);
  assert.match(wxml, /class="home-title-zh">竞技指挥官导师<\/text>/);
  // 侧脊格言（cEDH 精神题词）：从底部中置移到页面右缘竖排，独立于 home-content
  assert.match(wxml, /class="home-edge-tagline"[^>]*>PLAY TO WIN \| PLAY FOR THE GAME<\/text>/);
  const tagline = (wxml.match(/class="home-edge-tagline"[^>]*>([^<]+)<\/text>/) || [])[1];
  assert.match(tagline, /^[A-Z0-9 |]+$/);
  assert.ok(tagline.length <= 46);
  assert.match(wxml, /class="home-content"[\s\S]*<\/view>\s*<text class="home-edge-tagline"/);
  assert.match(wxss, /\.home-edge-tagline\s*{[^}]*position:\s*fixed[^}]*writing-mode:\s*vertical-rl/);
  // 侧脊题词与底部版权左右都留安全区内缩，避免贴边被屏幕圆角吞掉
  assert.match(wxss, /\.home-edge-tagline\s*{[^}]*padding-right:\s*calc\(14rpx \+ env\(safe-area-inset-right\)\)/);
  assert.match(wxss, /\.home-colophon\s*{[^}]*padding-right:\s*calc\(48rpx \+ env\(safe-area-inset-right\)\)/);
  assert.doesNotMatch(wxml, /home-epigraph/);
  // 工业注释风小字：EDH 与 cEDH 两段、每段三个完整句子，只用大写字母数字与空格（无冒号斜杠句号）
  const formatNotes = Array.from(
    wxml.matchAll(/class="home-format-note[^"]*">([^<]+)<\/text>/g),
    (match) => match[1],
  );
  assert.equal(formatNotes.length, 9);
  assert.match(formatNotes[0], /^RULE 903 DEFINES EDH AS MULTIPLAYER COMMANDER$/);
  assert.match(formatNotes[3], /^CEDH PLAYS THE SAME RULES AT FULL POWER$/);
  assert.match(formatNotes[6], /^EVERY SEAT PLAYS TO WIN AND NO ONE APOLOGIZES$/);
  formatNotes.forEach((note) => assert.match(note, /^[A-Z0-9 ]+$/));
  // 单行纪律：每句 ≤46 字符，7px Courier 在最窄机型也不折行，防止注释块撑破 45vh 压进目录
  formatNotes.forEach((note) => assert.ok(note.length <= 46, `注释句需单行（≤46 字符）：${note}`));
  assert.equal((wxml.match(/home-format-para/g) || []).length, 2);
  // 氛围文字密度 ③：宣言整墙轻微倾斜、审查黑条压住一条规则、字符 /// 作粗暴分割
  assert.match(wxss, /\.home-format-notes\s*{[^}]*transform:\s*rotate\(-1\.3deg\)/);
  // 审查＝随机涂黑一整行：把该行自身文字盒染黑、字色同底隐去，黑条与文字天然等宽等高必定盖住。
  // 绝不用绝对定位/像素 top 定位（字体回退与屏高断点会让黑条悬空在行间空白或墙外）。
  assert.match(wxss, /\.home-format-note\.is-redacted\s*{[^}]*color:\s*#0A0A0A[^}]*background:\s*#0A0A0A/);
  assert.doesNotMatch(wxss, /\.home-redaction/);
  assert.doesNotMatch(wxml, /home-redaction/);
  assert.doesNotMatch(wxss, /\.home-format-notes\s*{[^}]*position:\s*absolute/);
  for (let line = 0; line < 9; line += 1) {
    assert.match(wxml, new RegExp(`\\{\\{redactionLine === ${line} \\? 'is-redacted' : ''\\}\\}`));
  }
  assert.match(js, /REDACTION_LINE_COUNT = 9/);
  assert.match(js, /redactionLine:\s*Math\.floor\(Math\.random\(\)\s*\*\s*REDACTION_LINE_COUNT\)/);
  assert.match(wxml, /class="home-rule-slash"[^>]*>\/{6,}<\/view>/);
  assert.match(wxss, /\.home-rule-slash\s*{[^}]*color:\s*#0A0A0A/);
  assert.doesNotMatch(wxml, /home-reminder|home-button-leader/);
  assert.doesNotMatch(wxml, /开源共学|OPEN SOURCE COMMONS|·|home-button-separator/);
  const colophonItems = Array.from(
    wxml.matchAll(/class="home-colophon-item[^"]*">([^<]+)<\/text>/g),
    (match) => match[1],
  );
  // 首列分隔符用 +（普通字符，WXML 解析无歧义，避免 & 的实体/转义问题）
  assert.deepEqual(colophonItems, ['BY CPP123 + 345', 'MIT LICENSE', 'SCRYFALL API']);
  colophonItems.forEach((item) => assert.match(item, /^[A-Z0-9 +]+$/));

  assert.deepEqual(
    Array.from(wxml.matchAll(/class="home-button-en">([^<]+)<\/text>/g), (match) => match[1]),
    [
      'EDHTI PROFILE',
      'COMMANDER FINDER',
      'BRACKET ANALYSIS',
      'DECK SANDBOX',
      'LIFE COUNTER',
      'CHAOS TOOLKIT',
      'COMMANDER LOG',
      'META TIER LIST',
    ],
  );
  // 入口不带序号。01–08 前后改过九轮，最后一版是 glitch 行里的七段数码管，2026-11-09 看过效果后整体撤掉，
  // 八枚按行的主题色一并删除。这里挡住它们被加回来（home-index-active 是整行按压态，不在此列）。
  assert.doesNotMatch(wxml, /home-button-index|home-clock|home-index-(?!active)/, '首页入口已撤掉序号，不要再加回');
  assert.doesNotMatch(wxss, /home-button-index|home-digit|home-seg|\.home-index-(?!active)/, '序号的样式已随序号一并删除');
  assert.deepEqual(
    Array.from(wxml.matchAll(/class="home-button home-button-([a-z]+)/g), (match) => match[1]),
    ['edhti', 'match', 'bracket', 'playtest', 'life', 'random', 'tracker', 'meta'],
  );
  // 八行全部可用，八行都要有按压反馈
  assert.equal((wxml.match(/hover-class="home-index-active"/g) || []).length, 8);
  assert.equal((wxml.match(/hover-start-time="0"/g) || []).length, 8);
  assert.equal((wxml.match(/hover-stay-time="60"/g) || []).length, 8);
  assert.match(wxml, /home-button-edhti[^>]*bindtap="goEdhti"/);
  assert.match(wxml, /home-button-match[^>]*bindtap="goQuiz"/);
  assert.match(wxml, /home-button-bracket[^>]*bindtap="goBracket"/);
  assert.match(wxml, /home-button-playtest[^>]*bindtap="goPlaytest"/);
  assert.match(wxml, /home-button-life[^>]*bindtap="goLifeTracker"/);
  assert.match(wxml, /home-button-random[^>]*bindtap="goRandom"/);
  assert.match(wxml, /home-button-tracker[^>]*bindtap="goTracker"/);
  // 08 环境梯度已开放：未启用态（is-pending / SOON / aria-disabled）必须一并清干净，
  // 否则会留下「看着不可点却能点」的矛盾状态
  assert.match(wxml, /home-button-meta[^>]*bindtap="goMeta"/);
  assert.doesNotMatch(wxml, /is-pending|home-button-pending|SOON|aria-disabled/);
  assert.doesNotMatch(wxss, /is-pending|home-button-pending/);
  assert.match(wxml, /class="home-actions" aria-role="navigation" aria-label="主要功能"/);
  assert.doesNotMatch(wxml, /particle-background|particleCanvas/);
  assert.doesNotMatch(wxml, /<button[^>]*home-button|glass|bindtouch/);

  assert.match(js, /goEdhti\(\)[\s\S]*\/pages\/edhti\/edhti/);
  assert.match(js, /goQuiz\(\)[\s\S]*\/pages\/quiz\/quiz/);
  assert.match(js, /goBracket\(\)[\s\S]*\/pages\/bracket\/bracket/);
  assert.match(js, /goPlaytest\(\)[\s\S]*\/pages\/playtest\/playtest/);
  assert.match(js, /goLifeTracker\(\)[\s\S]*\/pages\/life-tracker\/life-tracker/);
  assert.match(js, /goRandom\(\)[\s\S]*\/pages\/random\/random/);
  assert.match(js, /goTracker\(\)[\s\S]*\/pages\/tracker\/tracker/);
  assert.doesNotMatch(js, /showMetaComingSoon/);
  assert.match(js, /enableShareMenu\(\)/);
  assert.match(shareUtil, /menus:\s*\[\s*'shareAppMessage'\s*,\s*'shareTimeline'\s*\]/);
  assert.match(js, /onShareAppMessage\s*\(\)\s*{[\s\S]*title:\s*'cEDH Tutor 竞技指挥官导师'/);
  assert.match(js, /onShareTimeline\s*\(\)\s*{[\s\S]*title:\s*'cEDH Tutor 竞技指挥官导师'/);
  assert.match(js, /titleFontBase64/);
  assert.match(js, /family:\s*'cEDHDisplay'/);
  assert.doesNotMatch(js, /selectComponent|HomeTouch|homeParticles/);

  assert.equal(appJson.window.navigationBarTitleText, 'cEDH Tutor');
  assert.equal(pageJson.navigationStyle, 'custom');
  assert.equal(pageJson.navigationBarTitleText, '');
  assert.equal(pageJson.navigationBarBackgroundColor, '#D0F03C');
  assert.equal(pageJson.navigationBarTextStyle, 'black');
  assert.equal(pageJson.backgroundColor, '#D0F03C');
  assert.equal(pageJson.backgroundTextStyle, 'dark');
  assert.equal(pageJson.disableScroll, true);
  assert.equal(pageJson.usingComponents, undefined);

  assert.match(wxss, /page\s*{[\s\S]*background:\s*#D0F03C/);
  assert.match(wxss, /\.home\s*{[\s\S]*height:\s*100vh[\s\S]*padding:\s*0[\s\S]*constant\(safe-area-inset-bottom\)[\s\S]*env\(safe-area-inset-bottom\)[\s\S]*background:\s*#D0F03C/);
  assert.match(wxss, /\.home-hero\s*{[\s\S]*flex:\s*0 0 45vh/);
  // 顶栏 5px 粗黑分割，取代旧发丝线（排版破坏 ②）
  assert.match(wxss, /\.home-actions\s*{[\s\S]*flex:\s*1 1 55%[\s\S]*flex-direction:\s*column[\s\S]*border-top:\s*5px solid #0A0A0A/);
  assert.match(wxss, /\.home-button\s*{[\s\S]*flex:\s*1 1 0[\s\S]*border-bottom:\s*1px solid rgba\(0,0,0,0\.35\)[\s\S]*border-radius:\s*0/);
  // 暴力按压：整块黑底 + 电光蓝字（反相，非缩放/位移）
  assert.match(wxss, /\.home-index-active\s*{[^}]*background:\s*#0A0A0A/);
  assert.match(wxss, /\.home-index-active \.home-button-zh[\s\S]*?color:\s*#00B3FF/);
  assert.match(wxss, /\.home-button\s*{[\s\S]*transition:\s*color 60ms linear,\s*background-color 60ms linear/);
  // 反相态只许改颜色：块内匹配（[^}]*）防跨块误命中，(?<!text-) 防 text-transform 子串误报
  assert.doesNotMatch(wxss, /\.home-index-active\s*{[^}]*(?:opacity:|scale:|(?<!text-)transform:)/);
  assert.match(wxss, /@media \(max-height:\s*700px\)[\s\S]*flex-basis:\s*40vh/);
  assert.match(wxss, /@media \(max-height:\s*600px\)[\s\S]*flex-basis:\s*40vh/);
  assert.match(wxss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*transition:\s*none/);
  assert.match(wxss, /\.home-button-text\s*{[^}]*align-items:\s*baseline[^}]*justify-content:\s*space-between/);
  assert.doesNotMatch(wxss, /home-button-leader|dotted/);
  // 排版破坏 ①：不等行高、偏移打破左对齐线、部分行粗黑分割。
  // 「巨号编号」这一项已随 01–08 序号一并撤掉——破坏感现在只靠行高与偏移承担
  assert.match(wxss, /\.home-button-tall\s*{[^}]*flex-grow:\s*1\.45/);
  assert.match(wxss, /\.home-button-short\s*{[^}]*flex-grow:\s*0\.72/);
  assert.match(wxss, /\.home-button-shift\s*{[^}]*padding-left:\s*64rpx/);
  assert.match(wxss, /\.home-button-heavy\s*{[^}]*border-bottom:\s*5px solid #0A0A0A/);
  // 对比极端化 ②：标题横向拉伸变形 + 倾斜，"喊叫"压过点阵"低语"
  assert.match(wxss, /\.home-title-brand\s*{[^}]*transform:\s*scaleX\(1\.18\) skewX\(-10deg\)/);
  // 事故色 glitch ④：每个入口条件挂 is-glitch，随机行由 glitchIndex 决定、每次进页面重掷
  for (let i = 0; i < 8; i += 1) {
    assert.match(wxml, new RegExp(`\\{\\{glitchIndex === ${i} \\? 'is-glitch' : ''\\}\\}`));
  }
  assert.match(wxss, /\.home-button\.is-glitch\s*{[^}]*background:\s*#00B3FF/);
  assert.match(js, /HOME_ACTION_COUNT = 8/);
  assert.match(js, /onShow\s*\(\)\s*{[\s\S]*glitchIndex:\s*Math\.floor\(Math\.random\(\)\s*\*\s*HOME_ACTION_COUNT\)/);
  assert.match(wxss, /\.home-format-note\s*{[^}]*color:\s*rgba\(0,0,0,0\.35\)[^}]*font-size:\s*7px[^}]*text-transform:\s*uppercase/);
  assert.doesNotMatch(wxss, /home-reminder/);
  assert.match(wxss, /\.home-colophon\s*{[^}]*grid-template-columns:\s*1fr auto 1fr[^}]*font-family:\s*"Courier New",\s*Courier/);
  assert.match(wxss, /\.home-colophon-center\s*{[^}]*text-align:\s*center/);
  assert.match(wxss, /\.home-colophon-right\s*{[^}]*text-align:\s*right/);
  // imprint 缩到近乎隐形的 fine print（6px）
  assert.match(wxss, /\.home-colophon-item\s*{[^}]*font-size:\s*6px[^}]*text-transform:\s*uppercase/);
  assert.doesNotMatch(wxss, /gradient|box-shadow|backdrop-filter|clip-path|background-image|radial-gradient/);
  // 首页零圆角：全文件只允许 .home-button 那一条显式的 0。
  //（曾为右上角的 MTGso 外跳入口开过一条钝角例外；该入口已整体移除，例外一并撤回。）
  const radiusOwners = Array.from(
    wxss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{([^{}]*border-radius:\s*([^;]+);[^{}]*)\}/g),
    (m) => ({ selector: m[1].trim(), value: m[3].trim() }),
  );
  assert.deepEqual(
    radiusOwners.map((r) => `${r.selector} → ${r.value}`).sort(),
    ['.home-button → 0'],
    '首页一律直角，全文件只此一条显式的 border-radius: 0',
  );

  // 色板没有例外：全页只用下面六个字面量（八枚序号主题色已随序号一并撤掉）。
  // 扫剥掉注释的版本：色板契约管的是「页面画了什么」，不是「注释提到什么」。
  // 注释里为交代取舍常要写出备选色值（例如「若要达 AA 需把某个蓝压到多深」），
  // 那不是使用。真正的使用一定出现在声明里，照样会被这里抓到。
  const wxssNoComments = wxss.replace(/\/\*[\s\S]*?\*\//g, '');
  const colorLiterals = Array.from(
    wxssNoComments.matchAll(/#[0-9a-f]{6}|rgba?\([^)]*\)/gi),
    (match) => match[0].replace(/\s/g, '').toUpperCase(),
  );
  assert.deepEqual(
    new Set(colorLiterals),
    new Set(['#D0F03C', '#FFFFFF', '#0A0A0A', '#00B3FF', 'RGBA(0,0,0,0.35)', 'RGBA(0,0,0,0.7)']),
    '首页色板：底色 + 黑 + 白 + 事故色电光蓝 + 半透明黑双档（0.35 装饰 / 0.7 功能文本）',
  );
  // 中文入口为纯黑（最大对比），英文副标题 0.7 过 AA 正文对比度；imprint 退到 0.35 近乎隐形
  assert.match(wxss, /\.home-button-zh\s*{[^}]*color:\s*#0A0A0A/);

  // glitch 行整行变电光蓝，中文与副标题跟着反成纯黑
  assert.match(wxss, /\.home-button\.is-glitch \.home-button-zh,/);

  // 功能文本（入口副标题）按正文对比度要求：10px + 0.7 alpha 在 #D0F03C 上约 7.5:1，过 AA 4.5:1
  assert.match(wxss, /\.home-button-en\s*{[^}]*color:\s*rgba\(0,0,0,0\.7\)[^}]*font-size:\s*10px/);
  // 窄屏只收紧字距，不把说明文本降回 8px
  assert.doesNotMatch(wxss, /\.home-button-en\s*{[^}]*font-size:\s*[89]px/);
  assert.match(wxss, /\.home-colophon-item\s*{[^}]*color:\s*rgba\(0,0,0,0\.35\)/);

  ['纯前端', '本地配置', '技术', '接口', '云', 'edhtop16'].forEach((word) => {
    assert.doesNotMatch(wxml, new RegExp(word), `home page should not show ${word}`);
  });
});

test('home uses licensed embedded display and pixel fonts with device-safe fallbacks', () => {
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxss'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8');
  const fontModulePath = path.join(root, 'miniprogram/assets/home-pixel-font.js');
  const displayFontModulePath = path.join(root, 'miniprogram/assets/title-font.js');
  const subsetPath = path.join(root, 'tools/fonts/fusion-pixel-10px-monospaced-zh_hans-home-subset.ttf');
  const packagedLicensePath = path.join(root, 'miniprogram/assets/FUSION_PIXEL_OFL.txt');
  const sourceLicensePath = path.join(root, 'tools/fonts/FUSION_PIXEL_OFL.txt');
  const generatorPath = path.join(root, 'scripts/build-home-pixel-font.js');
  const fontModule = fs.readFileSync(fontModulePath, 'utf8');
  const displayFontModule = fs.readFileSync(displayFontModulePath, 'utf8');
  const base64Match = fontModule.match(/const homePixelFontBase64 = '([A-Za-z0-9+/=]+)'/);
  const displayBase64Match = displayFontModule.match(/titleFontBase64:\s*'([A-Za-z0-9+/=]+)'/);

  assert.match(wxml, /class="home-title-brand">cEDH Tutor<\/text>/);
  assert.match(wxml, /class="home-title-zh">竞技指挥官导师<\/text>/);
  assert.match(wxss, /font-family:\s*"HomePixel",\s*"Fusion Pixel 10px Monospaced SC",\s*"Zpix",\s*ui-monospace,\s*monospace/);
  // 喊叫：超粗展示体横向拉伸变形、字距更紧；字号留边防止品牌名被右缘裁切
  assert.match(wxss, /\.home-title-brand\s*{[\s\S]*font-family:\s*"cEDHDisplay"[\s\S]*font-size:\s*48px[\s\S]*font-weight:\s*900[\s\S]*letter-spacing:\s*-0\.06em/);
  assert.match(wxss, /\.home-title-brand\s*{[\s\S]*-webkit-text-stroke:\s*0\.6px #FFFFFF[\s\S]*transform:\s*scaleX\(1\.18\) skewX\(-10deg\)[\s\S]*transform-origin:\s*left center/);
  assert.match(wxss, /@media \(max-width:\s*360px\)[\s\S]*\.home-title-brand\s*{[\s\S]*font-size:\s*42px/);
  assert.match(wxss, /@media \(max-height:\s*700px\)[\s\S]*\.home-title-brand\s*{[\s\S]*font-size:\s*42px/);
  assert.match(wxss, /\.home-title-zh\s*{[\s\S]*font-size:\s*18px[\s\S]*letter-spacing:\s*5px/);
  assert.match(wxss, /\.home-button-zh\s*{[\s\S]*font-weight:\s*400[\s\S]*letter-spacing:\s*3px/);
  assert.match(wxss, /\.home-button-zh\s*{[^}]*font-size:\s*20px/);
  // 全页文字均不使用 text-shadow：注释墙、字标、中文入口、编号、题词、imprint
  // 一律靠字体与字重立住，一加投影就回到「发光大字」那类廉价效果。
  // 旧橙色双影配色不得复现
  assert.doesNotMatch(wxss, /text-shadow|#8A7200|#F26A1B|#8F3A05/);
  // 侧脊题词：竖排贴右缘，Courier 工业注释体、无投影（位置/竖排在第一组测试锁定）
  const edgeTaglineRule = (wxss.match(/\.home-edge-tagline\s*{([^}]*)}/) || [])[1] || '';
  assert.match(edgeTaglineRule, /font-family:\s*"Courier New"/);
  assert.doesNotMatch(edgeTaglineRule, /text-shadow/);
  const titleBrandRule = (wxss.match(/\.home-title-brand\s*{([^}]*)}/) || [])[1] || '';
  assert.doesNotMatch(titleBrandRule, /text-shadow/);
  const chineseTextRules = Array.from(
    wxss.matchAll(/\.home-(?:title|button)-zh\s*{([^}]*)}/g),
    (match) => match[1],
  );
  assert.ok(chineseTextRules.length >= 4);
  chineseTextRules.forEach((rule) => assert.doesNotMatch(rule, /text-shadow/));
  assert.match(wxss, /home-format-notes[^}]*font-family:\s*"Courier New",\s*Courier,\s*"Nimbus Mono PS",\s*ui-monospace,\s*monospace/);
  assert.match(wxss, /home-colophon[^}]*font-family:\s*"Courier New",\s*Courier,\s*"Nimbus Mono PS",\s*ui-monospace,\s*monospace/);
  assert.match(wxss, /home-colophon-item[^}]*font-size:\s*6px[^}]*font-weight:\s*700[^}]*font-variant-numeric:\s*tabular-nums[^}]*letter-spacing:\s*0\.5px[^}]*line-height:\s*1\.3[^}]*text-transform:\s*uppercase/);
  assert.match(wxss, /@media \(max-height:\s*600px\)[\s\S]*home-format-note[^}]*font-size:\s*6px[^}]*letter-spacing:\s*0\.2px/);
  assert.match(wxss, /@media \(max-height:\s*600px\)[\s\S]*home-title-brand[^}]*font-size:\s*38px/);
  // 斜体只许用在序号上——它是全页最小的一枚标记，右倾是为了跟同字号的英文副标题拉开。
  // 其余任何地方都不许斜：标题、中文入口、注释墙、题词、imprint 都靠字重与字距立住，
  // 而且点阵字体没有真正的斜体字面，系统只能靠切变合成，字号一大就露出锯齿
  const italicOwners = Array.from(
    wxss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{([^{}]*)\}/g),
  ).filter(([, , body]) => /font-style:\s*italic/.test(body)).map(([, sel]) => sel.trim());
  // 全页零斜体。序号原来是唯一一处——那时它是行内小标记，右倾是为了跟同字号的
  // 英文副标题拉开。改成沉底巨号之后，区分靠的是尺度与层级，不再需要斜；
  // 而且点阵字没有斜体字面，60px 下合成斜体会把像素网格整个剪歪。
  assert.deepEqual(italicOwners, [],
    `首页不该有任何斜体，实际出现在：${italicOwners.join(' / ')}`);

  assert.match(js, /homePixelFontBase64/);
  assert.match(js, /titleFontBase64/);
  assert.match(js, /wx\.loadFontFace/);
  assert.match(js, /family:\s*'HomePixel'/);
  assert.match(js, /family:\s*'cEDHDisplay'/);
  assert.match(js, /data:font\/ttf;base64/);
  assert.match(js, /data:font\/woff2;base64/);
  assert.match(js, /global:\s*false[\s\S]*scopes:\s*\['webview'\]/);
  assert.match(js, /typeof wx\.getWindowInfo === 'function'[\s\S]*wx\.getSystemInfoSync/);
  assert.match(js, /wx\.getMenuButtonBoundingClientRect/);
  assert.match(js, /menuBottom > statusBarHeight[\s\S]*menuBottom < windowHeight \/ 2/);
  assert.equal((js.match(/wx\.loadFontFace\(/g) || []).length, 2);

  assert.ok(base64Match, '首页点阵字体 base64 应存在');
  const embeddedFont = Buffer.from(base64Match[1], 'base64');
  const sourceFont = fs.readFileSync(subsetPath);
  assert.equal(Buffer.compare(embeddedFont, sourceFont), 0, '发布字体应与受控子集源一致');
  assert.ok(sourceFont.length > 10000 && sourceFont.length < 20000, '首页字体子集应保持轻量');
  assert.ok(fontModule.length < 25000, 'base64 模块不应异常膨胀');
  assert.match(fontModule, /release 2026\.07\.01/);
  assert.match(fontModule, /SIL Open Font License 1\.1/);
  assert.ok(displayBase64Match, '首页粗体展示字体 base64 应存在');
  assert.ok(Buffer.from(displayBase64Match[1], 'base64').length > 15000, '粗体展示字体应随包内嵌');
  assert.match(displayFontModule, /SIL Open Font License 1\.1/);

  [packagedLicensePath, sourceLicensePath].forEach((licensePath) => {
    const license = fs.readFileSync(licensePath, 'utf8');
    assert.match(license, /Fusion Pixel Font/);
    assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.match(license, /Copyright \(c\) 2022, TakWolf/);
  });
  const generator = fs.readFileSync(generatorPath, 'utf8');
  assert.match(generator, /fusion-pixel-10px-monospaced-zh_hans-home-subset\.ttf/);
  assert.match(generator, /miniprogram', 'assets', 'home-pixel-font\.js/);
  assert.match(generator, /miniprogram\/assets\/FUSION_PIXEL_OFL\.txt/);
});

// 首页入口副标题改过字，子集没跟着补，缺的字悄悄退回了系统字体。首页 WXML 里的静态文字必须全部落在点阵子集里
test('home pixel font subset covers every static text glyph on the home page', () => {
  const font = fs.readFileSync(path.join(root, 'tools/fonts/fusion-pixel-10px-monospaced-zh_hans-home-subset.ttf'));
  const u16 = (offset) => font.readUInt16BE(offset);
  const u32 = (offset) => font.readUInt32BE(offset);
  let cmap = -1;
  for (let i = 0; i < u16(4); i += 1) {
    if (font.toString('latin1', 12 + i * 16, 16 + i * 16) === 'cmap') cmap = u32(20 + i * 16);
  }
  assert.ok(cmap > 0, '子集应有 cmap 表');
  const mapped = new Set();
  for (let i = 0; i < u16(cmap + 2); i += 1) {
    const table = cmap + u32(cmap + 8 + i * 8);
    if (u16(table) !== 4) continue;
    const segments = u16(table + 6) / 2;
    const ends = table + 14;
    const starts = ends + segments * 2 + 2;
    const deltas = starts + segments * 2;
    const ranges = deltas + segments * 2;
    for (let s = 0; s < segments; s += 1) {
      const start = u16(starts + s * 2);
      const delta = u16(deltas + s * 2);
      const range = u16(ranges + s * 2);
      for (let code = start; code <= u16(ends + s * 2) && code !== 0xffff; code += 1) {
        let glyph = range ? u16(ranges + s * 2 + range + (code - start) * 2) : code;
        if (glyph) glyph = (glyph + delta) & 0xffff;
        if (glyph) mapped.add(code);
      }
    }
  }
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const text = wxml
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .replace(/<[^>]*>/g, ' ');
  assert.match(text, /名片 \/ 禁牌 \/ 条约 \/ 练习 →/, '入口副标题应在扫描范围内');
  const missing = [...new Set([...text].filter((ch) => /\S/.test(ch) && !mapped.has(ch.codePointAt(0))))];
  assert.deepEqual(missing, [], `首页点阵子集缺字：${missing.join('')}`);
  // 月报入口的日期是绑定出来的，不在静态文字里，单独查它会用到的字
  const labelMissing = [...'0123456789月日更新'].filter((ch) => !mapped.has(ch.codePointAt(0)));
  assert.deepEqual(labelMissing, [], `月报更新日期缺字：${labelMissing.join('')}`);
});

// 月报入口的更新日期：电光蓝色块、黑字，贴在“环境梯度”后面，斜切加双色硬阴影。读不到就整块不显示，不留空位
test('首页月报入口显示电光蓝的更新日期，读不到就不显示', async () => {
  const vm = require('node:vm');
  const { createRequire } = require('node:module');
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxss'), 'utf8');
  const filename = path.join(root, 'miniprogram/pages/index/index.js');
  const row = wxml.slice(wxml.indexOf('home-button-meta'), wxml.indexOf('home-community-entry'));
  assert.match(row, /aria-label="环境梯度\{\{metaUpdatedLabel \? '，' \+ metaUpdatedLabel : ''\}\}"/, '读屏也要读到日期');
  assert.match(row, /<text class="home-button-zh">环境梯度<\/text>\s*<view wx:if="\{\{metaUpdatedLabel\}\}" class="home-meta-updated" aria-hidden="true"><text class="home-meta-face">\{\{metaUpdatedLabel\}\}<\/text><\/view>\s*<text class="home-button-en">META TIER LIST<\/text>/);
  assert.equal((wxml.match(/home-meta-updated/g) || []).length, 1, '只有月报入口有日期');

  const rule = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = wxss.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(found, `找不到 ${selector}`);
    return found[1];
  };
  // 电光蓝的字直接压在荧光黄上，对比度不到 2:1，所以是色块加黑字
  const channel = (hex, i) => {
    const value = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex) => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  assert.ok(contrast('#00B3FF', '#D0F03C') < 2.5, '蓝字压荧光黄本来就看不清');
  const badge = rule('.home-meta-updated');
  const face = rule('.home-meta-face');
  assert.match(face, /color:\s*#0A0A0A/);
  assert.match(face, /background:\s*#00B3FF/);
  assert.ok(contrast('#0A0A0A', '#00B3FF') >= 4.5);
  assert.match(badge, /margin:\s*0 auto 0 \d+rpx/, '右边距 auto 把它贴在中文后面，英文副标题照旧靠右');
  assert.match(face, /font-size:\s*10px/, '点阵字在 10px 原尺寸最清楚');

  // 斜化走 skewX：本页禁斜体。阴影是两层没有模糊的实色块：本页禁阴影属性
  const slant = Number(badge.match(/transform:\s*skewX\(-(\d+)deg\)/)[1]);
  assert.ok(slant >= 8 && slant <= 15, `斜切 ${slant} 度，太小看不出，太大点阵字会糊`);
  assert.match(badge, /position:\s*relative/);
  const far = rule('.home-meta-updated::before');
  const near = rule('.home-meta-updated::after');
  [far, near].forEach((layer) => assert.match(layer, /content:\s*""[\s\S]*position:\s*absolute[\s\S]*top:\s*0[\s\S]*right:\s*0[\s\S]*bottom:\s*0[\s\S]*left:\s*0/));
  assert.match(far, /background:\s*#FFFFFF/);
  assert.match(near, /background:\s*#0A0A0A/);
  const offset = (block) => Number(block.match(/translate\((\d+)px,\s*\1px\)/)[1]);
  assert.ok(offset(far) > offset(near) && offset(near) > 0, '两层阴影要错开，远的一层更远');
  assert.match(face, /position:\s*relative[\s\S]*z-index:\s*1/, '色块要压在两层阴影上面');
  // 这一行的文字容器会裁掉溢出：色块加错位的总高不能超过中文的行高
  assert.match(badge, /align-self:\s*flex-start/);
  const zhSize = Number(rule('.home-button-zh').match(/font-size:\s*(\d+)px/)[1]);
  const padding = Number(face.match(/padding:\s*(\d+)px/)[1]);
  assert.ok(10 + padding * 2 + offset(far) <= zhSize, '阴影的下缘会被这一行裁掉');

  // 故障行整行变电光蓝，色块和阴影都要换色；按下时整行反黑，近的一层换白
  const glitchFace = rule('.home-button.is-glitch .home-meta-face');
  assert.match(glitchFace, /color:\s*#00B3FF/);
  assert.match(glitchFace, /background:\s*#0A0A0A/);
  assert.match(rule('.home-button.is-glitch .home-meta-updated::after'), /background:\s*#FFFFFF/);
  assert.match(rule('.home-button.is-glitch .home-meta-updated::before'), /background:\s*#0A0A0A/);
  assert.match(rule('.home-button.home-index-active .home-meta-face'), /background:\s*#00B3FF/);
  assert.match(rule('.home-button.home-index-active .home-meta-updated::after'), /background:\s*#FFFFFF/);
  assert.ok(wxss.indexOf('.home-button.home-index-active .home-meta-face') > wxss.indexOf('.home-button.is-glitch .home-meta-face'),
    '按下写在故障之后，两者同时成立时按下胜出');

  // 行为：先用本机记的日期，过期才问云函数；问不到保持原样，不弹提示
  const store = new Map(); const calls = []; const toasts = [];
  let answer = { ok: true, data: { latestPeriod: '2026-10', publishedAt: Date.UTC(2026, 10, 5, 2) } };
  const fakeWx = {
    getWindowInfo: () => ({ statusBarHeight: 20, windowHeight: 844 }),
    getMenuButtonBoundingClientRect: () => ({ bottom: 56 }),
    showShareMenu() {},
    showToast: (options) => toasts.push(options),
    getStorageSync: (key) => (store.has(key) ? store.get(key) : ''),
    setStorageSync: (key, value) => store.set(key, structuredClone(value)),
    cloud: { init() {}, async callFunction(options) { calls.push(options.data); if (answer instanceof Error) throw answer; return { result: answer }; } },
  };
  const previous = global.wx;
  global.wx = fakeWx;
  try {
    let definition;
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      Page: (value) => { definition = value; },
      require: createRequire(filename),
      wx: fakeWx,
      Math,
    }, { filename });
    const page = Object.assign(Object.create(definition), {
      data: structuredClone(definition.data),
      setData(patch) { Object.assign(this.data, patch); },
    });
    assert.equal(page.data.metaUpdatedLabel, '');
    page.onShow();
    assert.equal(page.data.metaUpdatedLabel, '', '第一次进首页还不知道日期');
    await page.metaRefresh;
    assert.equal(page.data.metaUpdatedLabel, '11月5日更新');
    assert.deepEqual(calls, [{ action: 'latest' }]);

    page.data.metaUpdatedLabel = '';
    page.onShow();
    assert.equal(page.data.metaUpdatedLabel, '11月5日更新', '再进首页立刻显示，不等网络');
    await page.metaRefresh;
    assert.equal(calls.length, 1, '六小时内不再问');

    store.clear();
    answer = new Error('offline');
    page.data.metaUpdatedLabel = '';
    page.onShow();
    await page.metaRefresh;
    assert.equal(page.data.metaUpdatedLabel, '', '问不到就不显示');
    assert.equal(toasts.length, 0, '首页不为这个弹提示');

    // 两次进首页的请求先后乱序回来：只认后发的那次
    store.clear();
    const pending = [];
    fakeWx.cloud.callFunction = () => new Promise((resolve) => pending.push(resolve));
    page.onShow();
    const first = page.metaRefresh;
    page.onShow();
    const second = page.metaRefresh;
    pending[1]({ result: { ok: true, data: { latestPeriod: '2026-11', publishedAt: Date.UTC(2026, 11, 4) } } });
    await second;
    pending[0]({ result: { ok: true, data: { latestPeriod: '2026-10', publishedAt: Date.UTC(2026, 10, 5, 2) } } });
    await first;
    assert.equal(page.data.metaUpdatedLabel, '12月4日更新', '先发的请求晚回来，不能盖掉新的日期');
  } finally {
    global.wx = previous;
  }
});

test('bracket page lists exhaustive reasons without a secondary evidence drawer', () => {
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.wxml'), 'utf8');

  assert.match(js, /const dominantTheme = \(result\.cohesionProfile \|\| \{\}\)\.dominantTheme \|\| \{\}/);
  assert.match(js, /if \(dominantTheme\.qualifies && dominantTheme\.label\)\s*{[\s\S]*label: '主线'[\s\S]*dominantTheme\.strong \? '高' : '清晰'/);
  assert.doesNotMatch(js, /dominantTheme\.label}\s*·/);
  // 判定依据不设条数上限：规则与强度在前、参考观察在后，每条附触发牌；无二级「完整证据」抽屉
  assert.match(js, /const reasons = primaryReasons\s+\.concat\(contextReasons\)/);
  assert.doesNotMatch(js, /primaryReasons\s*\.slice\(/);
  assert.doesNotMatch(js, /showDetails|toggleDetails|comboRows|comboPotentialRows|signalRows/);
  assert.match(wxml, /class="reason-row \{\{item\.kind === 'context' \? 'is-context' : ''\}\}"/);
  assert.match(wxml, /class="reason-cards" wx:if="\{\{item\.cardsText\}\}">\{\{item\.cardsText\}\}/);
  // 作用标签一律右上角：copy 必须撑满，否则短依据的 space-between 无空间可分配
  const bracketWxss = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.wxss'), 'utf8');
  assert.match(bracketWxss, /\.reason-copy\s*{[^}]*flex:\s*1 1 auto/);
  assert.match(bracketWxss, /\.reason-head\s*{[^}]*justify-content:\s*space-between/);
  assert.doesNotMatch(wxml, /details-toggle|details-body|查看完整证据|combo-row|comboPotentialRows/);
  assert.match(js, /\{ label: '构筑', value: `\$\{efficiencyCoveragePercent\}%` \}/);
  assert.doesNotMatch(js, /\{ label: '稳定性', value:/);
});

test('button press feedback is centralized and reused across app controls', () => {
  const tokensWxss = fs.readFileSync(path.join(root, 'miniprogram/styles/tokens.wxss'), 'utf8');
  const appWxss = fs.readFileSync(path.join(root, 'miniprogram/app.wxss'), 'utf8');
  const randomWxss = fs.readFileSync(path.join(root, 'miniprogram/pages/random/random.wxss'), 'utf8');
  const indexWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const interactiveMarkup = [
    'miniprogram/pages/quiz/quiz.wxml',
    'miniprogram/pages/result/result.wxml',
    'miniprogram/pages/random/random.wxml',
    'miniprogram/pages/tracker/tracker.wxml',
  ].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

  assert.match(tokensWxss, /--cedh-radius-control:\s*28rpx/);
  assert.match(tokensWxss, /--cedh-radius-control-sm:\s*24rpx/);
  assert.match(appWxss, /button\s*{[\s\S]*border-radius:\s*var\(--cedh-radius-control\)/);
  assert.match(appWxss, /\.primary-button\s*{[\s\S]*border-radius:\s*var\(--cedh-radius-control\)/);
  assert.match(appWxss, /\.secondary-button\s*{[\s\S]*border-radius:\s*var\(--cedh-radius-control\)/);
  // .result-button / .seat-button 已删：两者在全项目的 wxml 与 js 里一次都没出现过，
  // 是纯孤儿样式。共用按压反馈这件事本身没变，只是名单里少了两个从不存在的按钮。
  assert.match(appWxss, /\.option,[\s\S]*\.preset-chip\s*{[\s\S]*border-radius:\s*var\(--cedh-radius-control-sm\)/);
  assert.match(appWxss, /\.primary-button,[\s\S]*\.secondary-button,[\s\S]*\.text-button,[\s\S]*\.option,[\s\S]*\.preset-chip\s*{[\s\S]*transition:[\s\S]*220ms/);
  assert.match(appWxss, /\.pressable-active\s*{[\s\S]*opacity:\s*0\.72/);
  assert.match(appWxss, /\.pressable-active\s*{[\s\S]*translateY\(6rpx\)/);
  assert.doesNotMatch(appWxss, /scale\(0\.985\)|scale\(1\)/);
  assert.match(appWxss, /\.primary-button\.drawing,[\s\S]*\.secondary-button\.drawing\s*{[\s\S]*opacity:\s*0\.72/);
  assert.match(appWxss, /\.primary-button\.drawing,[\s\S]*\.secondary-button\.drawing\s*{[\s\S]*translateY\(6rpx\)/);
  assert.match(appWxss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(randomWxss, /\.sticker-draw-button\.drawing/);
  assert.ok((interactiveMarkup.match(/hover-class="pressable-active"/g) || []).length >= 18);
  assert.ok((interactiveMarkup.match(/hover-stay-time="120"/g) || []).length >= 18);
  assert.equal((indexWxml.match(/hover-class="home-index-active"/g) || []).length, 8);
  assert.equal((indexWxml.match(/hover-start-time="0"/g) || []).length, 8);
  assert.equal((indexWxml.match(/hover-stay-time="60"/g) || []).length, 8);
});

test('home removes particles while other interfaces retain theme-matched particle backgrounds', () => {
  const indexWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const indexJs = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8');
  const indexJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.json'), 'utf8'));
  const particleComponent = fs.readFileSync(path.join(root, 'miniprogram/components/particle-background/particle-background.js'), 'utf8');
  const particleWxml = fs.readFileSync(path.join(root, 'miniprogram/components/particle-background/particle-background.wxml'), 'utf8');
  const particleWxss = fs.readFileSync(path.join(root, 'miniprogram/components/particle-background/particle-background.wxss'), 'utf8');
  const paletteMounts = [
    ['miniprogram/pages/edhti/edhti.wxml', 'neon-arcade'],
    ['miniprogram/pages/quiz/quiz.wxml', 'noir-gold'],
    ['miniprogram/pages/result/result.wxml', 'noir-gold'],
    ['miniprogram/pages/tracker/tracker.wxml', 'tracker'],
    ['miniprogram/pages/random/random.wxml', 'random'],
    ['miniprogram/pages/playtest/playtest.wxml', 'playtest'],
    ['miniprogram/pages/bracket/bracket.wxml', 'bracket'],
    ['miniprogram/pages/cabbage/cabbage.wxml', 'cabbage'],
    ['miniprogram/pages/izzet/izzet.wxml', 'izzet'],
    ['miniprogram/pages/planechase/planechase.wxml', 'random'],
    ...['hub', 'passport', 'banlist', 'table', 'swaps', 'hands'].map((name) => [`miniprogram/community/pages/${name}/index.wxml`, 'tracker']),
  ];

  assert.doesNotMatch(indexWxml, /particle-background|particleCanvas/);
  assert.doesNotMatch(indexJs, /selectComponent|homeParticles|HomeTouch|setTouchFromEvent|clearTouch/);
  assert.equal(indexJson.usingComponents, undefined);
  paletteMounts.forEach(([file, palette]) => {
    const markup = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(
      markup,
      new RegExp(`<particle-background(?: paused="[^"]*")? palette="${palette}"></particle-background>`),
      `${file} 的粒子背景应使用 ${palette} 主题配色`,
    );
    assert.ok(particleConfig.palettes && particleConfig.palettes[palette], `${palette} palette 应在 config/particle.js 收录`);
  });
  // 竞逐时空与 EDH hub 是后来接回粒子的页面。画布是 position: fixed + z-index: 0，
  // 正文若不包进 content-layer，非定位内容会画在画布下面，点击也会落到画布上
  paletteMounts
    .filter(([file]) => /planechase|community/.test(file))
    .forEach(([file, palette]) => {
      const markup = fs.readFileSync(path.join(root, file), 'utf8');
      assert.match(
        markup,
        new RegExp(`<particle-background(?: paused="[^"]*")? palette="${palette}"></particle-background>\\s*<view class="content-layer[ "]`),
        `${file} 的正文要紧跟粒子组件包进 content-layer`,
      );
      const pageJson = JSON.parse(fs.readFileSync(path.join(root, file.replace(/\.wxml$/, '.json')), 'utf8'));
      assert.equal(pageJson.usingComponents['particle-background'], '/components/particle-background/particle-background');
    });

  assert.doesNotMatch(particleComponent, /CLUSTER_|clustered|fieldHeightVh|dotColor|lineColor/);
  assert.doesNotMatch(particleWxml, /fieldHeightVh|style=/);
  assert.match(particleComponent, /properties:\s*{[\s\S]*interactive:\s*{[\s\S]*type:\s*Boolean[\s\S]*value:\s*false[\s\S]*palette:\s*{[\s\S]*type:\s*String[\s\S]*value:\s*''/);
  assert.match(particleComponent, /const palette = palettes\[this\.properties\.palette\] \|\| \{\}/);
  assert.match(particleComponent, /this\.accentRgb = hexToRgb\(palette\.accentColor \|\| particleConfig\.accentColor\)/);
  assert.match(particleComponent, /this\.neutralRgb = hexToRgb\(palette\.neutralColor \|\| particleConfig\.neutralColor\)/);
  assert.match(particleComponent, /this\.connectionRgb = hexToRgb\(palette\.connectionColor \|\| \(particleConfig\.connections && particleConfig\.connections\.color\)\)/);
  assert.match(particleComponent, /this\.width\s*=\s*windowInfo\.windowWidth/);
  assert.match(particleComponent, /this\.height\s*=\s*windowInfo\.windowHeight/);
  assert.match(particleComponent, /setTouchFromEvent\(event\)[\s\S]*this\.properties\.interactive[\s\S]*this\.updateTouch\(event\)/);
  assert.match(particleComponent, /clearTouch\(\)[\s\S]*this\.properties\.interactive[\s\S]*this\.touch = null/);
  assert.match(particleWxss, /position:\s*fixed/);
  assert.match(particleWxss, /width:\s*100vw/);
  assert.match(particleWxss, /height:\s*100vh/);
  assert.match(particleWxss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.particle-canvas\s*{[^}]*display:\s*none/);
});

// 卡面和梯度详情是用来读字的：帧循环要停，画布要清空，页面切回前台也不能自己恢复
// 全站量过一遍最小字之后改的几处：能点的按钮和要读的中文说明不该是 9 到 10px，标题不该和说明一样暗
test('操作按钮和中文说明不用过小的字，卡片标题比说明亮', () => {
  const wxss = (file) => fs.readFileSync(path.join(root, 'miniprogram', file), 'utf8');
  const rule = (text, selector) => {
    const found = text.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`));
    assert.ok(found, `找不到 ${selector}`);
    return found[1];
  };
  // 全站门禁：字号不再低于 20rpx（390 宽约 10.4px）。例外只有不靠读字的记号，
  // 血量页是横屏，rpx 按长边算，16rpx 实际有 18pt，所以不算
  const exempt = new Set([
    'pages/bracket/bracket.wxss .import-mark',
    'pages/playtest/playtest.wxss .import-mark',
    'pages/playtest/playtest.wxss .mana-symbol-letter',
  ]);
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.name.endsWith('.wxss') ? [full] : [];
  });
  const miniRoot = path.join(root, 'miniprogram');
  const tiny = [];
  walk(miniRoot).forEach((file) => {
    const relative = path.relative(miniRoot, file).split(path.sep).join('/');
    if (relative.startsWith('pages/life-tracker/')) return;
    const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const size = body.match(/font-size:\s*(\d+(?:\.\d+)?)rpx/);
      if (size && Number(size[1]) < 20 && !exempt.has(`${relative} ${selector.trim()}`)) tiny.push(`${relative} ${selector.trim()} ${size[1]}rpx`);
    }
  });
  assert.deepEqual(tiny, [], '要读的字不低于 20rpx，写 max(20rpx, 10px) 同时保住窄屏');

  // 战绩行的改和删：圆圈只有 36rpx，热区要撑开，否则对局中很难点准
  const trackerStyles = wxss('pages/tracker/tracker.wxss');
  assert.match(rule(trackerStyles, '.match-action'), /position:\s*relative/);
  const hit = rule(trackerStyles, '.match-action::after');
  assert.match(hit, /position:\s*absolute/);
  const rowHeight = Number(rule(trackerStyles, '.match-row').match(/min-height:\s*(\d+)rpx/)[1]);
  const up = Number(hit.match(/top:\s*-(\d+)rpx/)[1]);
  const down = Number(hit.match(/bottom:\s*-(\d+)rpx/)[1]);
  assert.ok(36 + up + down >= rowHeight, '热区要撑满整行高度');
  assert.ok(Number(hit.match(/right:\s*-(\d+)rpx/)[1]) <= 4 && Number(hit.match(/left:\s*-(\d+)rpx/)[1]) <= 4, '两颗之间只有 8rpx，各占一半，互不抢点');
  assert.match(rule(trackerStyles, '.match-action.match-edit::after'), /left:\s*-12rpx/);
  assert.match(rule(trackerStyles, '.match-action.match-delete::after'), /right:\s*-12rpx/);
  // 胜率 100.0% 时右栏变窄，W / L / D 带空格就折成两行
  assert.match(fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.wxml'), 'utf8'), /stat-micro-label">W\/L\/D</);

  // 骰子快捷按钮是主要操作
  assert.match(rule(wxss('pages/random/random.wxss'), '.preset-chip'), /font-size:\s*var\(--cedh-text-14\)/);
  // EDHTI 的翻页和问卷同一个分量
  assert.match(rule(wxss('pages/edhti/edhti.wxss'), '.action-button'), /font-size:\s*var\(--cedh-text-14\)/);

  // 战情室的说明文字：窄屏上 rpx 会缩，下限保住 10px，颜色不用最淡的一档
  const tracker = wxss('pages/tracker/tracker.wxss');
  ['.stat-micro-label', '.stat-micro-sub', '.record-select-label'].forEach((selector) => {
    assert.match(rule(tracker, selector), /font-size:\s*max\(20rpx,\s*10px\)/, `${selector} 要有下限`);
  });
  ['.stat-micro-sub', '.record-select-label'].forEach((selector) => {
    assert.match(rule(tracker, selector), /color:\s*var\(--cedh-text-soft\)/, `${selector} 是要读的中文`);
  });

  // EDH hub 卡片：按钮默认是次要文字色，标题要自己写主文字色
  assert.match(rule(wxss('community/pages/hub/index.wxss'), '.entry-title'), /color:\s*var\(--cedh-text\)/);

  // 伊捷风暴的标签列要放得下“我的瞬间/法术”：6 个汉字加斜杠共约 7em，字号和列宽都是 rpx，所以任何屏宽都成立
  const izzet = wxss('pages/izzet/izzet.wxss');
  const column = Number(rule(izzet, '.izzet-stat').match(/grid-template-columns:\s*(\d+)rpx/)[1]);
  const spacing = Number(rule(izzet, '.izzet-stat-label').match(/letter-spacing:\s*([\d.]+)em/)[1]);
  assert.ok(24 * (6 * (1 + spacing) + 0.6 + spacing) <= column, '标签会在“法术”中间断行');
});

test('粒子组件：paused 停帧、清空并隐藏，关闭后接着画', () => {
  const vm = require('node:vm');
  const { createRequire } = require('node:module');
  const component = path.join(root, 'miniprogram/components/particle-background/particle-background');
  let definition;
  vm.runInNewContext(fs.readFileSync(`${component}.js`, 'utf8'), {
    Component: (value) => { definition = value; },
    require: createRequire(`${component}.js`),
    wx: {},
  }, { filename: `${component}.js` });

  const frames = [];
  const cancelled = [];
  const clears = [];
  const instance = {
    ...definition.methods,
    properties: { paused: false },
    canvas: {
      requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; },
      cancelAnimationFrame: (handle) => { cancelled.push(handle); },
    },
    ctx: { clearRect: (...args) => clears.push(args) },
    width: 390,
    height: 844,
    touch: { x: 1, y: 1 },
    boundDrawFrame() {},
  };
  const setPaused = (value) => {
    instance.properties.paused = value;
    definition.observers.paused.call(instance, value);
  };

  instance.startAnimation();
  assert.equal(instance.frameHandle, 1);

  setPaused(true);
  assert.equal(instance.frameHandle, null, '暂停后帧循环要停');
  assert.deepEqual(cancelled, [1]);
  assert.deepEqual(Array.from(clears[0]), [0, 0, 390, 844], '暂停后画布要清空');
  assert.equal(instance.touch, null);

  definition.pageLifetimes.show.call(instance);
  instance.startAnimation();
  assert.equal(instance.frameHandle, null, '弹层还开着时，切回前台不能恢复动画');
  assert.equal(frames.length, 1);

  setPaused(false);
  assert.equal(instance.frameHandle, 2, '关闭弹层后接着画');

  // 属性可能先于画布初始化到达，这时没有东西要停
  const early = { ...definition.methods, properties: { paused: true } };
  assert.doesNotThrow(() => definition.observers.paused.call(early, true));

  // 系统减弱动效：样式表隐藏了画布，帧循环也不能在后面空转
  let windowed;
  vm.runInNewContext(fs.readFileSync(`${component}.js`, 'utf8'), {
    Component: (value) => { windowed = value; },
    require: createRequire(`${component}.js`),
    wx: { getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, pixelRatio: 2 }) },
  }, { filename: `${component}.js` });
  const initWith = (display) => {
    const updates = [];
    const requested = [];
    const context = {
      ...windowed.methods,
      properties: { paused: false, palette: '' },
      data: {},
      setData(patch) { updates.push(patch); },
      createSelectorQuery: () => ({
        select: () => ({
          fields: (options) => ({
            exec: (callback) => {
              assert.deepEqual(Array.from(options.computedStyle), ['display'], '要读算出来的 display');
              callback([{
                display,
                width: 390,
                height: 844,
                node: {
                  width: 0,
                  height: 0,
                  getContext: () => ({ scale() {} }),
                  requestAnimationFrame: (callback) => { requested.push(callback); return requested.length; },
                },
              }]);
            },
          }),
        }),
      }),
    };
    context.initCanvas();
    return { updates, requested, context };
  };
  const reduced = initWith('none');
  assert.deepEqual(reduced.updates.map((patch) => ({ ...patch })), [{ enabled: false }], '减弱动效时撤掉画布');
  assert.equal(reduced.requested.length, 0, '减弱动效时不启动帧循环');
  assert.equal(reduced.context.canvas, undefined);
  const normal = initWith('block');
  assert.deepEqual(normal.updates, [], '正常情况不撤画布');
  assert.equal(normal.requested.length, 1, '正常情况启动帧循环');
  const unknown = initWith(undefined);
  assert.equal(unknown.requested.length, 1, '某个基础库读不到样式时，宁可照常画，也不把背景弄没');
  assert.match(fs.readFileSync(`${component}.wxss`, 'utf8'), /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.particle-canvas\s*\{\s*display:\s*none/);

  assert.match(fs.readFileSync(`${component}.wxml`, 'utf8'), /class="particle-canvas \{\{paused \? 'is-paused' : ''\}\}"/);
  assert.match(fs.readFileSync(`${component}.wxss`, 'utf8'), /\.particle-canvas\.is-paused\s*\{[^}]*visibility:\s*hidden/);
  assert.match(
    fs.readFileSync(path.join(root, 'miniprogram/pages/planechase/planechase.wxml'), 'utf8'),
    /<particle-background paused="\{\{inspect \? true : false\}\}" palette="random">/,
  );
});
test('quiz and result action controls stay inside mobile width', () => {
  const quizWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/quiz/quiz.wxml'), 'utf8').replace(/\r\n/g, '\n');
  const resultWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/result/result.wxml'), 'utf8').replace(/\r\n/g, '\n');
  const quizJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/pages/quiz/quiz.json'), 'utf8'));
  const resultJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/pages/result/result.json'), 'utf8'));
  const quizWxss = fs.readFileSync(path.join(root, 'miniprogram/pages/quiz/quiz.wxss'), 'utf8');
  const resultWxss = fs.readFileSync(path.join(root, 'miniprogram/pages/result/result.wxss'), 'utf8');
  const quizFooter = quizWxml.slice(
    quizWxml.indexOf('<view class="footer-actions">'),
    quizWxml.indexOf('</view>\n  </view>\n</view>'),
  );
  const resultActions = resultWxml.slice(
    resultWxml.indexOf('<view class="actions">'),
    resultWxml.indexOf('</view>\n    </block>'),
  );
  const progressRow = quizWxml.slice(
    quizWxml.indexOf('<view class="progress-row">'),
    quizWxml.indexOf('<view class="progress-track">'),
  );

  assert.equal(quizJson.navigationBarTitleText, '指挥官问卷');
  assert.equal(quizJson.navigationBarBackgroundColor, '#050505');
  assert.equal(quizJson.navigationBarTextStyle, 'white');
  assert.equal(resultJson.navigationBarBackgroundColor, '#050505');
  assert.equal(resultJson.navigationBarTextStyle, 'white');
  assert.doesNotMatch(quizWxml, /class="quiz-title"/);
  assert.match(progressRow, /{{progressText}}/);
  assert.doesNotMatch(progressRow, /{{currentQuestion\.title}}/);
  assert.doesNotMatch(quizWxml, /可多选。选择“无所谓”会清空其它颜色。/);
  assert.doesNotMatch(quizWxml, /class="hint"/);
  assert.doesNotMatch(quizFooter, /<button\b/);
  assert.doesNotMatch(resultActions, /<button\b/);
  assert.match(quizFooter, /class="secondary-button footer-button/);
  assert.match(quizFooter, /class="primary-button footer-button/);
  assert.match(resultActions, /class="secondary-button action-button"/);
  assert.doesNotMatch(resultActions, /action-export-button|bindtap="exportImage"/);
  assert.match(resultActions, /bindtap="restart"/);
  assert.match(resultActions, /bindtap="goHome"/);
  assert.match(quizWxss, /\.footer-actions\s*{[\s\S]*display:\s*flex/);
  assert.match(quizWxss, /\.footer-actions\s*{[\s\S]*overflow:\s*visible/);
  assert.match(quizWxss, /\.footer-actions\s*{[\s\S]*padding-bottom:\s*10rpx/);
  assert.doesNotMatch(
    quizWxss.match(/\.footer-actions\s*{[\s\S]*?\n}/)[0],
    /overflow:\s*hidden/,
  );
  assert.match(quizWxss, /\.footer-button\s*{[\s\S]*flex:\s*1 1 0/);
  assert.match(quizWxss, /\.footer-button\s*{[\s\S]*min-width:\s*0/);
  // quiz 与 result 共用黑金主题，变量收拢在 styles/themes/noir-gold.wxss
  const noirGoldTheme = fs.readFileSync(path.join(root, 'miniprogram/styles/themes/noir-gold.wxss'), 'utf8');
  assert.match(quizWxss, /@import "\.\.\/\.\.\/styles\/themes\/noir-gold\.wxss"/);
  assert.match(resultWxss, /@import "\.\.\/\.\.\/styles\/themes\/noir-gold\.wxss"/);
  assert.match(noirGoldTheme, /\.quiz\s*{[\s\S]*linear-gradient\(180deg,\s*#070707 0%,\s*#020202 58%,\s*#000000 100%\)/);
  assert.doesNotMatch(noirGoldTheme, /radial-gradient/);
  assert.match(noirGoldTheme, /\.quiz,\s*\.result\s*{[\s\S]*?--noir-gold-rgb:\s*230,\s*155,\s*82/);
  assert.match(noirGoldTheme, /\.quiz,\s*\.result\s*{[\s\S]*?--cedh-accent:\s*#e69b52/);
  assert.match(quizWxss, /\.question-title\s*{[\s\S]*color:\s*var\(--cedh-accent-ink\)/);
  assert.match(quizWxss, /\.option\.selected \.option-text\s*{[\s\S]*color:\s*var\(--cedh-accent-ink\)/);
  assert.doesNotMatch(quizWxss, /rgba\(155,\s*58,\s*47/);
  assert.match(noirGoldTheme, /\.result\s*{[\s\S]*linear-gradient\(180deg,\s*#070707 0%,\s*#020202 56%,\s*#000000 100%\)/);
  assert.match(resultWxss, /\.actions\s*{[\s\S]*display:\s*flex/);
  assert.match(resultWxss, /\.action-button\s*{[\s\S]*flex:\s*1 1 0/);
  assert.match(resultWxss, /\.action-button\s*{[\s\S]*min-width:\s*0/);
});

// 粘 100 行是本项目最贵的单次操作：不能白粘一次，也不该为「先分析再试玩」粘两次
test('bracket keeps its deck text, offers clipboard import, and hands off to playtest', () => {
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.wxml'), 'utf8');

  // 与套牌试玩各存各的 key：改一边不该悄悄改掉另一边
  assert.match(js, /const DECK_TEXT_STORAGE_KEY = 'bracketDeckText'/);
  assert.match(js, /const PLAYTEST_DECK_TEXT_STORAGE_KEY = 'playtestDeckText'/);
  assert.match(js, /onLoad\(\)\s*{[\s\S]*this\.restoreDeckText\(\)/);
  assert.match(js, /handleDeckInput\(event\)\s*{[\s\S]*this\.persistDeckText\(deckText\)/);
  assert.match(js, /clearDeck\(\)\s*{[\s\S]*removeStorage\(DECK_TEXT_STORAGE_KEY\)/);
  // 清空牌表先确认，和套牌试玩的「清除现套牌」同一确认强度、同一句说明（ux-goals B、C）
  assert.match(js, /clearDeck\(\)\s*{[\s\S]{0,200}wx\.showModal\(\{[\s\S]{0,160}content:\s*'会清空输入框和已保存的牌表文本'[\s\S]{0,400}removeStorage\(DECK_TEXT_STORAGE_KEY\)/,
    '清空牌表要先弹窗确认，再清存储');
  assert.doesNotMatch(js, /clearDeck\(\)\s*{\s*this\.analysisRequestId/, '清空不能不问就执行');
  // 长度上限复用 utils/bracket 的常量，不在页面里另抄一份
  assert.match(js, /MAX_DECK_CHARS,\s*\n\s*MAX_DECK_LINES,\s*\n\}\s*=\s*require\('\.\.\/\.\.\/utils\/bracket'\)/);

  // 显式按钮读剪贴板：微信会弹系统提示，不能在 onShow 静默读
  assert.match(js, /importFromClipboard\(\)\s*{[\s\S]*wx\.getClipboardData/);
  assert.doesNotMatch(js, /onShow\s*\([\s\S]{0,200}getClipboardData/);
  assert.match(js, /lineCount < CLIPBOARD_DECK_MIN_LINES/);
  assert.match(wxml, /bindtap="importFromClipboard"\s*\n?\s*>粘贴</);

  // 分析完直接开局，不用把同一副牌再粘一遍
  assert.match(js, /playtestDeck\(\)\s*{[\s\S]*writeStorage\(PLAYTEST_DECK_TEXT_STORAGE_KEY[\s\S]*url: '\/pages\/playtest\/playtest'/);
  assert.match(wxml, /bindtap="playtestDeck"[\s\S]{0,120}用这副牌试玩/);
});

// 弱网下顺序分批可能拖到 20–30 秒：等待必须有分母，也必须有出路
test('bracket analysis shows progress and exposes a local-rules escape hatch', () => {
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/bracket/bracket.wxml'), 'utf8');

  assert.match(js, /onProgress: \(\{ done, total, phase \}\) =>[\s\S]*analyzeProgress: phase === 'prices' \? '读取参考价' : `\$\{done\} \/ \$\{total\}`/);
  assert.match(js, /requestId !== this\.analysisRequestId\) return;\s*\n\s*this\.setData\(\{\s*\n\s*analyzeProgress/);
  assert.match(wxml, /class="analyze-progress mono" wx:if="\{\{analyzing && analyzeProgress\}\}" aria-live="polite"/);

  // 降级出口在 6 秒后才出现，避免打断正常速度的分析
  assert.match(js, /const SLOW_ANALYSIS_MS = 6000/);
  assert.match(js, /startSlowAnalysisTimer\(requestId\)\s*{[\s\S]*this\.setData\(\{ canSkipMetadata: true \}\)/);
  assert.match(wxml, /wx:if="\{\{canSkipMetadata\}\}"[\s\S]*bindtap="skipMetadata"[\s\S]*网络较慢，先看本地规则结果/);
  // 提前出结果必须递增请求编号，晚到的元数据不能再覆盖这份本地结果
  assert.match(js, /skipMetadata\(\)\s*{[\s\S]*this\.analysisRequestId = \(this\.analysisRequestId \|\| 0\) \+ 1[\s\S]*evaluateBracket\(parsed\)/);
  // 计时器不能泄漏
  assert.match(js, /onUnload\(\)\s*{[\s\S]*this\.clearSlowAnalysisTimer\(\)/);

  // wx.hideKeyboard 必须带回调：无参调用走 Promise 风格，而从「粘贴」按钮填入牌表时
  // 键盘从未升起，无键盘可收会拒绝，没人 catch 就冒成框架级的 Error: timeout
  assert.match(js, /wx\.hideKeyboard\(\{ fail: \(\) => \{\} \}\)/);
  assert.doesNotMatch(js, /wx\.hideKeyboard\(\s*\)/);
});

// 问卷答案不该一次性：中途被打断能恢复，出结果后能只改一个答案而不重答 12 题
test('quiz persists a draft, offers resume, and can prefill from the stored result', () => {
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/quiz/quiz.js'), 'utf8');
  const resultJs = fs.readFileSync(path.join(root, 'miniprogram/pages/result/result.js'), 'utf8');
  const resultWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/result/result.wxml'), 'utf8');

  // 每步落盘，切后台被回收也不丢已答的题
  assert.match(js, /const QUIZ_DRAFT_STORAGE_KEY = 'quizDraft'/);
  assert.match(js, /refreshQuestion\(index, answers\)\s*{[\s\S]*this\.persistDraft\(index, answers\)/);
  assert.match(js, /persistDraft\(currentIndex, answers\)\s*{[\s\S]*writeStorage\(QUIZ_DRAFT_STORAGE_KEY, { currentIndex, answers }/);

  // 只有真的有答案可丢时才弹恢复询问
  const resumeBlock = js.slice(js.indexOf('offerDraftResume()'));
  assert.match(resumeBlock, /if \(!draft \|\| !countAnswered\(draft\.answers\)\) return/);
  assert.match(resumeBlock, /title: '继续上次作答'/);
  assert.match(resumeBlock, /confirmText: '继续'/);
  assert.match(resumeBlock, /cancelText: '重新开始'/);
  assert.match(resumeBlock, /removeStorage\(QUIZ_DRAFT_STORAGE_KEY\)/);

  // 出结果即清草稿，避免带着结果再进问卷还被问「继续上次」
  assert.match(js, /removeStorage\(QUIZ_DRAFT_STORAGE_KEY\);[\s\S]*wx\.redirectTo\(\{\s*url: '\/pages\/result\/result'/);

  // mode 分流：edit 预填上次答案，restart 明确清空
  assert.match(js, /mode === 'restart'[\s\S]*removeStorage\(QUIZ_DRAFT_STORAGE_KEY\)/);
  assert.match(js, /mode === 'edit'[\s\S]*this\.prefillFromResult\(\)/);
  assert.match(js, /prefillFromResult\(\)\s*{[\s\S]*QUIZ_RESULT_STORAGE_KEY[\s\S]*this\.refreshQuestion\(0, { \.\.\.stored\.value\.answers }\)/);

  assert.match(resultJs, /editAnswers\(\)\s*{[\s\S]*url: '\/pages\/quiz\/quiz\?mode=edit'/);
  assert.match(resultJs, /restart\(\)\s*{[\s\S]*url: '\/pages\/quiz\/quiz\?mode=restart'/);
  assert.match(resultWxml, /bindtap="editAnswers">修改答案</);
});

test('result display sorts by fit and replaces repeated partner names with later candidates', () => {
  const {
    buildPreviewCards,
    formatCommanderDisplayName,
    formatCommanderDisplayLines,
    isPartnerRecommendation,
    parseFitPercent,
    sortRecommendationsForDisplay,
  } = require('../miniprogram/utils/result-display');

  const recommendations = [
    { name: 'Ishai, Ojutai Dragonspeaker / Kraum, Ludevic\'s Opus', fitLabel: '契合度：100%' },
    { name: 'Ishai, Ojutai Dragonspeaker / Jeska, Thrice Reborn', fitLabel: '契合度：99%' },
    { name: 'Kinnan, Bonder Prodigy', fitLabel: '契合度：74%' },
    { name: 'Winota, Joiner of Forces', fitLabel: '契合度：82%' },
    { name: 'Tymna the Weaver / Thrasios, Triton Hero', fitLabel: '契合度：89%' },
    { name: 'Najeela, the Blade-Blossom', fitLabel: '契合度：72%' },
  ];
  const sorted = sortRecommendationsForDisplay(recommendations, 5);

  assert.deepEqual(sorted.map((item) => item.rank), [1, 2, 3, 4, 5]);
  assert.deepEqual(sorted.map((item) => parseFitPercent(item)), [100, 89, 82, 74, 72]);
  assert.equal(sorted[0].isTop, true);
  assert.equal(sorted[1].isTop, false);
  assert.equal(sorted.some((item) => item.name.includes('/ Jeska')), false);
  assert.equal(sorted[0].displayName, 'Ishai / Kraum');
  assert.deepEqual(sorted[0].displayLines, ['Ishai', 'Kraum']);
  assert.equal(formatCommanderDisplayName('Aang, at the Crossroads // Aang, Destined Savior'), 'Aang, at the Crossroads');
  assert.equal(formatCommanderDisplayName('Rograkh, Son of Rohgahh / Silas Renn, Seeker Adept'), 'Rograkh / Silas Renn');
  assert.equal(formatCommanderDisplayName('Vial Smasher the Fierce / Thrasios, Triton Hero'), 'Vial Smasher / Thrasios');
  assert.deepEqual(formatCommanderDisplayLines('Vial Smasher the Fierce / Thrasios, Triton Hero'), ['Vial Smasher', 'Thrasios']);
  assert.deepEqual(
    formatCommanderDisplayLines('Vial Smasher the Fierce / Thrasios, Triton Hero', { abbreviatePartners: false }),
    ['Vial Smasher the Fierce', 'Thrasios, Triton Hero'],
  );
  assert.equal(formatCommanderDisplayName('Kraum, Ludevic\'s Opus / Tymna the Weaver'), 'Tymna / Kraum');
  assert.deepEqual(formatCommanderDisplayLines('Kraum, Ludevic\'s Opus / Tymna the Weaver'), ['Tymna', 'Kraum']);
  assert.deepEqual(
    buildPreviewCards('Kraum, Ludevic\'s Opus / Tymna the Weaver').map((card) => card.name),
    ['Tymna the Weaver', 'Kraum, Ludevic\'s Opus'],
  );

  const partnerHeavy = sortRecommendationsForDisplay([
    { name: 'Rograkh, Son of Rohgahh / Silas Renn, Seeker Adept', deckElements: ['partner_shell'], fitLabel: '契合度：100%' },
    { name: 'Tymna the Weaver / Kraum, Ludevic\'s Opus', deckElements: ['partner_shell'], fitLabel: '契合度：99%' },
    { name: 'Malcolm, Keen-Eyed Navigator / Tana, the Bloodsower', deckElements: ['partner_shell'], fitLabel: '契合度：98%' },
    { name: 'Dargo, the Shipwrecker / Ikra Shidiqi, the Usurper', deckElements: ['partner_shell'], fitLabel: '契合度：97%' },
    { name: 'Sisay, Weatherlight Captain', deckElements: [], fitLabel: '契合度：96%' },
    { name: 'Kinnan, Bonder Prodigy', deckElements: [], fitLabel: '契合度：95%' },
  ], 5);

  assert.ok(partnerHeavy.filter(isPartnerRecommendation).length <= 3);
  assert.ok(partnerHeavy.some((item) => item.name === 'Sisay, Weatherlight Captain'));
  assert.ok(partnerHeavy.some((item) => item.name === 'Kinnan, Bonder Prodigy'));
});

test('result page copies links and shows Scryfall previews without export UI', () => {
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/result/result.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/result/result.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/result/result.wxss'), 'utf8');
  const scryfallJs = fs.readFileSync(path.join(root, 'miniprogram/utils/scryfall.js'), 'utf8');

  assert.match(js, /wx\.setClipboardData/);
  assert.match(wxml, /edhtop16/);
  assert.doesNotMatch(wxml, /class="result-head"|class="result-title">/);
  assert.match(wxml, /recommend-card surface {{item\.isTop \? 'top-match' : ''}}/);
  assert.match(wxml, /banner-art-left/);
  assert.match(wxml, /banner-art-right/);
  assert.match(wxml, /banner-art-center/);
  assert.match(wxml, /item\.isDualPreview/);
  assert.match(wxml, /item\.isSinglePreview/);
  assert.match(wxml, /item\.singlePreview\.artCrop/);
  assert.doesNotMatch(wxml, /banner-edge-fade|banner-center-fade|recommend-mask/);
  assert.doesNotMatch(wxml, /Top Match/);
  assert.doesNotMatch(wxml, /item\.rank/);
  assert.match(wxml, /<image[\s\S]*class="banner-art-image"/);
  assert.match(wxml, /src="{{item\.leftPreview\.artCrop \|\| item\.leftPreview\.normal}}"/);
  assert.match(wxml, /src="{{item\.rightPreview\.artCrop \|\| item\.rightPreview\.normal}}"/);
  assert.match(wxml, /src="{{item\.singlePreview\.artCrop \|\| item\.singlePreview\.normal}}"/);
  assert.match(wxml, /bindtap="previewCardImage"/);
  assert.match(wxml, /Scryfall/);
  assert.match(wxml, /class="secondary-button action-button"[\s\S]*bindtap="restart"/);
  assert.match(wxml, /class="secondary-button action-button"[\s\S]*bindtap="goHome"/);
  assert.doesNotMatch(wxml, /id="resultExportCanvas"|action-export-button|bindtap="exportImage"/);

  // 主将图走批量解析，不再一卡一次往返。
  // 旧写法每张卡各发一次 fetchCardImageUris（按名查询、并发上限 4），
  // 五条推荐最多十张图要分三轮跑完；每张回来还各自 setData 一遍整个 recommendations 数组。
  assert.match(js, /require\('\.\.\/\.\.\/utils\/card-art'\)/);
  assert.match(js, /prefetchCardArt\(names\)\.then\(/,
    '主将图必须批量解析，不能逐张请求');
  // 剥注释再判：这条问的是「代码有没有调它」，不是「注释提没提它」。
  // 上面那段说明为交代来龙去脉正要写出这个函数名，扫原文会把说明本身判成违规。
  const resultCode = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(resultCode, /fetchCardImageUris/,
    '不得退回逐张按名查询——那是十次往返换一次批量');
  // 解析完只刷一次。真正要守的是「不能一张卡刷一次」——逐张 setData 会把整个
  // recommendations 数组反复过桥，十张图就是十次全量序列化。
  const loadPreviewBody = resultCode.match(/loadPreviewImages\(recommendations, signature\) \{[\s\S]*?\n  \},/)[0];
  assert.equal((loadPreviewBody.match(/setData\(/g) || []).length, 1,
    'loadPreviewImages 里只允许一次 setData——每张卡刷一次会把整表反复过桥');
  // 且那一次必须落在批量解析的回调里。只数「有几次 setData」不够：
  // 写在逐卡循环里同样只有一处文本，却会按卡片数反复执行。
  assert.match(loadPreviewBody, /prefetchCardArt\(names\)\.then\([\s\S]*?setData\(/,
    '唯一那次 setData 必须在批量解析完成后执行，不能落在逐卡循环里');
  assert.match(scryfallJs, /api\.scryfall\.com\/cards\/named/);
  assert.match(scryfallJs, /wx\.request/);
  assert.match(scryfallJs, /Accept:\s*'application\/json'/);
  assert.doesNotMatch(scryfallJs, /'User-Agent'/);
  assert.match(scryfallJs, /image_uris/);
  assert.match(scryfallJs, /art_crop/);
  assert.match(js, /normal/);
  assert.match(js, /wx\.previewImage/);
  assert.match(js, /sortRecommendationsForDisplay/);
  assert.doesNotMatch(js, /canvas-kit|exportPosterImage|drawExportPoster|loadExportAssets|loadExportImages|EXPORT_|MINI_PROGRAM_CODE_SRC|CEDH_HOUSE_QR_SRC|canvasToTempFilePath|saveImageToPhotosAlbum/);

  assert.match(wxml, /item\.displayLines/);
  assert.match(wxml, /recommend-name-line/);
  assert.match(wxss, /\.banner-art\s*{[\s\S]*opacity:\s*1/);
  assert.match(wxss, /\.banner-art\s*{[\s\S]*overflow:\s*hidden/);
  assert.match(wxss, /\.banner-art-center\s*{[\s\S]*left:\s*50%/);
  assert.match(wxss, /\.banner-art-center\s*{[\s\S]*width:\s*100%/);
  assert.match(wxss, /\.banner-art-center\s*{[\s\S]*transform:\s*translateX\(-50%\)/);
  assert.match(wxss, /\.dual-preview \.banner-art-left\s*{[\s\S]*width:\s*50%/);
  assert.match(wxss, /\.dual-preview \.banner-art-right\s*{[\s\S]*width:\s*50%/);
  assert.doesNotMatch(wxss, /\.dual-preview \.banner-art-left\s*{[\s\S]*width:\s*58%/);
  assert.doesNotMatch(wxss, /\.dual-preview \.banner-art-right\s*{[\s\S]*width:\s*58%/);
  assert.match(wxss, /\.dual-preview \.banner-art-image\s*{[\s\S]*height:\s*116%/);
  assert.match(wxss, /\.single-preview \.banner-art-center \.banner-art-image\s*{[\s\S]*object-position:\s*center 12%/);
  assert.match(wxss, /\.single-preview \.banner-art-center \.banner-art-image\s*{[\s\S]*height:\s*124%/);
  assert.match(wxss, /\.single-preview \.banner-art-center \.banner-art-image\s*{[\s\S]*transform:\s*translateY\(0\)/);
  assert.match(wxss, /\.banner-art-image\s*{[\s\S]*filter:\s*none/);
  assert.match(wxss, /\.recommend-content\s*{[\s\S]*background:\s*transparent/);
  assert.match(wxss, /\.recommend-content\s*{[\s\S]*text-shadow:/);
  assert.doesNotMatch(wxss, /\.recommend-content\s*{[\s\S]*rgba\(255,\s*254,\s*250,\s*0\.74\)/);
  assert.match(wxss, /\.link-button\s*{[\s\S]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.68\)/);
  assert.doesNotMatch(wxss, /rgba\(23,\s*6,\s*7|rgba\(155,\s*58,\s*47|rgba\(95,\s*33,\s*27/);
  assert.doesNotMatch(wxss, /banner-center-fade|banner-edge-fade|recommend-mask|\.export-canvas|action-export-button/);
  assert.doesNotMatch(wxml, /costTierLabel|reason/);
});

test('particle and performance configs use champagne dust defaults with per-page theme palettes', () => {
  assert.equal(particleConfig.defaultEnabled, true);
  assert.equal(particleConfig.backgroundFallback, '#FFFFFF');
  assert.equal(Object.hasOwn(particleConfig, 'beam'), false);
  assert.match(particleConfig.accentColor, /^#([0-9A-F]{6})$/i);
  assert.equal(particleConfig.paletteName, 'champagne-gold');
  assert.equal(particleConfig.radius.minRpx, 1.5);
  assert.equal(particleConfig.radius.maxRpx, 4.8);
  assert.equal(particleConfig.opacity.min, 0.14);
  assert.equal(particleConfig.opacity.max, 0.38);
  assert.equal(particleConfig.softEdge.blurMultiplier, 3.8);
  assert.equal(particleConfig.softEdge.shadowAlphaMultiplier, 0.72);
  assert.equal(particleConfig.tone.accentRatio, 0.58);
  assert.equal(particleConfig.connections.enabled, true);
  assert.match(particleConfig.connections.color, /^#([0-9A-F]{6})$/i);
  assert.ok(particleConfig.connections.lineWidthRpx <= 1.5);
  assert.ok(particleConfig.connections.opacity.max >= 0.18);
  assert.ok(particleConfig.connections.opacity.max <= 0.24);
  assert.equal(particleConfig.connections.tiers.high.enabled, true);
  assert.equal(particleConfig.connections.tiers.medium.enabled, true);
  assert.equal(particleConfig.connections.tiers.low.enabled, true);
  assert.ok(particleConfig.connections.tiers.low.maxLines > 0);
  assert.equal(particleConfig.touch.radiusRpx, 140);
  assert.equal(particleConfig.touch.releaseDamping, 0.93);

  const palettes = particleConfig.palettes || {};
  assert.deepEqual(
    Object.fromEntries(Object.entries(palettes).map(([name, palette]) => [
      name,
      [palette.accentColor, palette.neutralColor, palette.connectionColor],
    ])),
    {
      'neon-arcade': ['#FF7BC8', '#68C7FF', '#B9E8FF'],
      'noir-gold': ['#E69B52', '#F5EAD1', '#F0BE8A'],
      tracker: ['#CDB774', '#E6D8AD', '#D8C48E'],
      random: ['#BE709E', '#E5BAD3', '#D094B8'],
      playtest: ['#7E8DCD', '#C8D0EE', '#A3B0E0'],
      bracket: ['#49B380', '#BDEBD2', '#7FCCA6'],
      cabbage: ['#2FA75D', '#B2E3C4', '#5BBF6A'],
      izzet: ['#5AA9FF', '#BCD9FF', '#8CC0FF'],
      // 环境梯度是唯一不跟自身模块强调色（中性石板灰）走的页面：
      // 背景取 T0 档位色一族的红，把「最高档」的色彩身份让给数据
      meta: ['#EF5B4C', '#F5B3AC', '#E07A6E'],
    },
    '粒子 palette 应与各页面主题色一致',
  );
  Object.values(palettes).forEach((palette) => {
    [palette.accentColor, palette.neutralColor, palette.connectionColor].forEach((color) => {
      assert.match(color, /^#([0-9A-F]{6})$/i);
    });
  });

  const particleComponent = fs.readFileSync(path.join(root, 'miniprogram/components/particle-background/particle-background.js'), 'utf8');
  assert.match(particleComponent, /particleConfig\.tone\.accentRatio/);
  assert.match(particleComponent, /particleConfig\.softEdge\.shadowAlphaMultiplier/);
  assert.match(particleComponent, /adjustParticlePool\(\)/);
  assert.match(particleComponent, /wx\.onMemoryWarning/);
  assert.match(particleComponent, /this\.currentTier = 'low'/);
  assert.match(particleComponent, /performanceConfig\.defaultMode !== 'auto' \|\| this\.memoryConstrained/);
  assert.doesNotMatch(particleComponent, /this\.currentTier = TIER_ORDER\[currentIndex - 1\];[\s\S]{0,180}this\.resetParticles\(\)/);
  assert.doesNotMatch(particleComponent, /this\.currentTier = TIER_ORDER\[currentIndex \+ 1\];[\s\S]{0,180}this\.resetParticles\(\)/);
  assert.match(particleComponent, /paintConnections\(tier\)/);
  assert.match(particleComponent, /paintConnections\(tier\)\s*{[\s\S]*const ctx = this\.ctx/);
  assert.match(particleComponent, /ctx\.moveTo\(particle\.x,\s*particle\.y\)/);
  assert.match(particleComponent, /ctx\.lineTo\(candidate\.x,\s*candidate\.y\)/);
  assert.match(particleComponent, /pageLifetimes:\s*{[\s\S]*show\(\)[\s\S]*startAnimation\(\)[\s\S]*hide\(\)[\s\S]*stopAnimation\(\)/);
  assert.match(particleComponent, /Math\.min\(Number\(windowInfo\.pixelRatio \|\| 1\), MAX_CANVAS_DPR\)/);
  assert.match(particleComponent, /this\.boundDrawFrame = this\.drawFrame\.bind\(this\)/);
  assert.doesNotMatch(particleComponent, /requestFrame\(this\.drawFrame\.bind\(this\)\)/);
  assert.match(particleComponent, /performanceConfig\.defaultMode === 'auto'[\s\S]*\? 'medium'/);

  assert.equal(performanceConfig.defaultMode, 'auto');
  assert.equal(performanceConfig.tiers.high.count, 80);
  assert.equal(performanceConfig.tiers.medium.count, 55);
  assert.equal(performanceConfig.tiers.low.count, 30);
  assert.equal(performanceConfig.tiers.low.softEdge, false);
  assert.equal(performanceConfig.fps.downgradeBelow, 45);
  assert.equal(performanceConfig.fps.upgradeAbove, 55);
});

test('non-home interface surfaces use translucent glass tokens so particles remain visible', () => {
  const tokens = fs.readFileSync(path.join(root, 'miniprogram/styles/tokens.wxss'), 'utf8');
  const appWxss = fs.readFileSync(path.join(root, 'miniprogram/app.wxss'), 'utf8');
  const chartJs = fs.readFileSync(path.join(root, 'miniprogram/utils/tracker-charts.js'), 'utf8');
  const pageWxss = [
    'miniprogram/app.wxss',
    'miniprogram/pages/quiz/quiz.wxss',
    'miniprogram/pages/result/result.wxss',
    'miniprogram/pages/tracker/tracker.wxss',
    'miniprogram/pages/random/random.wxss',
    'miniprogram/pages/playtest/playtest.wxss',
    'miniprogram/pages/edhti/edhti.wxss',
    'miniprogram/components/particle-background/particle-background.wxss',
  ].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

  assert.match(tokens, /--cedh-surface:\s*rgba\(255,\s*254,\s*250,\s*0\.68\)/);
  assert.match(tokens, /--cedh-surface-raised:\s*rgba\(255,\s*254,\s*250,\s*0\.76\)/);
  assert.match(tokens, /--cedh-surface-muted:\s*rgba\(248,\s*245,\s*238,\s*0\.5\)/);
  assert.match(tokens, /--cedh-input-glass:\s*rgba\(255,\s*254,\s*250,\s*0\.6\)/);
  assert.match(appWxss, /\.surface\s*{[\s\S]*background:\s*var\(--cedh-surface\)/);
  assert.match(pageWxss, /background:\s*var\(--cedh-surface-raised\)/);
  assert.match(pageWxss, /background:\s*var\(--cedh-surface-muted\)/);
  assert.match(pageWxss, /background:\s*var\(--cedh-input-glass\)/);
  assert.match(chartJs, /background:\s*'rgba\(10,\s*10,\s*10,\s*0\.72\)'/);
  assert.doesNotMatch(chartJs, /background:\s*'rgba\(250,\s*255,\s*235/);
  assert.doesNotMatch(pageWxss, /background:\s*rgba\(255,\s*254,\s*250,\s*0\.(8[6-9]|9\d)\)/);
  assert.doesNotMatch(pageWxss, /radial-gradient/);
});

// 首页背景的 Voronoi 线场。选它不是审美偏好，是约束推出来的：
// border-radius 锁死为唯一一条 0，渐变/背景图/裁切路径全在禁用之列，
// 只剩「直线段 + transform + 既有色板」——而 Voronoi 的胞元边恰好全是直线段，
// 且天然不规则、没有可重复的单元。
test('首页背景线场：构建期几何、纯 CSS 动效、不新增色板', () => {
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxss'), 'utf8');
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8');
  const { HOME_VORONOI_EDGES } = require('../miniprogram/config/home-voronoi');

  // 几何在构建期算好，运行时不算
  assert.match(fs.readFileSync(path.join(root, 'miniprogram/config/home-voronoi.js'), 'utf8'),
    /由 scripts\/build-home-voronoi\.js 生成，请勿手改/);
  assert.ok(HOME_VORONOI_EDGES.length >= 50, '线段太少，铺不满整页');
  HOME_VORONOI_EDGES.forEach((edge) => {
    ['x', 'y', 'len', 'deg'].forEach((key) => assert.equal(typeof edge[key], 'number'));
  });

  // 铺的是整页，不是某一屏区域：纵向必须画到 2.1 倍屏宽以下，
  // 否则长屏手机的下半页会空着（390×844 的可见高度约 216vw）
  const lowest = Math.max(...HOME_VORONOI_EDGES.map((e) => e.y));
  assert.ok(lowest > 210, `线段最低只到 ${lowest.toFixed(0)}vw，长屏手机下半页会空`);

  // 不规则性要能被验证：线段长度必须显著参差，否则就成了规则网格
  const lens = HOME_VORONOI_EDGES.map((e) => e.len);
  assert.ok(Math.max(...lens) / Math.min(...lens) > 5,
    '线段长度过于均匀，看起来会像网格而不是 Voronoi');

  // 胞元必须闭合。Voronoi 的内部顶点度数恒为 3，出现 2 度顶点就说明有边被丢掉了，
  // 那个交汇处在真机上看着就是空的——之前按「太短就是碎屑」丢边，丢的全是真实的短边。
  // 直接跑生成器算未补长的原始几何来判，不去反推已补长的坐标（那要靠容差聚类，不可靠）。
  const { computeGeometry } = require('../scripts/build-home-voronoi');
  const geometry = computeGeometry();
  assert.equal(geometry.emptyCells, 0, '有种子的胞元被裁空了，那一片会整块缺失');
  const openJunctions = [];
  geometry.vertices.forEach((arms, k) => {
    const [x, y] = k.split(',').map(Number);
    if (x < 2 || x > 98 || y < 2 || y > 214) return; // 只看 390×844 的可见区，避开裁剪边缘
    if (arms.length !== 3) openJunctions.push(`(${x}, ${y}) ${arms.length}度`);
  });
  assert.deepEqual(openJunctions, [], `顶点度数不是 3，胞元没闭合：${openJunctions.slice(0, 3).join(' / ')}`);

  // 仓库里的 config 必须就是当前脚本的产物：漏跑生成器或手改过都会在这里断
  assert.deepEqual(HOME_VORONOI_EDGES, geometry.edges,
    'config/home-voronoi.js 与生成器输出不一致，请重跑 node scripts/build-home-voronoi.js');

  // 传输量：静态几何一次推完，不该膨胀
  const payload = Buffer.byteLength(JSON.stringify(HOME_VORONOI_EDGES), 'utf8');
  assert.ok(payload < 6 * 1024, `线场数据 ${(payload / 1024).toFixed(1)}KB，超过 6KB 上限`);

  // 动效必须是纯 CSS：JS 里不得有定时器逐帧改线场数据（那要每帧 setData 过桥）
  assert.doesNotMatch(js, /setInterval|requestAnimationFrame/);
  assert.doesNotMatch(js, /fieldLines:\s*\[\s*\]/);
  assert.match(js, /fieldLines: HOME_VORONOI_EDGES\.map/);

  // 只动 transform，不碰布局属性。用 indexOf 切块而不是拼正则，避免转义在写入路径上被吃掉。
  ['home-field-turn', 'home-field-drift'].forEach((name) => {
    const start = wxss.indexOf(`@keyframes ${name}`);
    assert.notEqual(start, -1, `找不到 @keyframes ${name}`);
    const frames = wxss.slice(start, wxss.indexOf('\n}', start) + 2);
    assert.match(frames, /transform:/);
    assert.doesNotMatch(frames, /\b(width|height|top|left|margin|padding)\s*:/,
      `${name} 不得动布局属性`);
  });

  // 动效必须真的看得见。这是真机上翻过车的地方：往返式 ease-in-out 在两端速度归零，
  // 而开屏正好停在起点，最该被看到的头十几秒恰恰最慢，肉眼读不出任何位移。
  // 所以直接按关键帧算出实际线速度，卡在「看得见但不抢戏」的区间里。
  const declaration = (name) => {
    const line = wxss.split('\n').find((row) => row.includes(`animation: ${name} `));
    assert.ok(line, `找不到 ${name} 的 animation 声明`);
    return line;
  };
  const driftDecl = declaration('home-field-drift');
  const driftPeriod = Number(driftDecl.match(/ (\d+)s/)[1]);

  const driftStart = wxss.indexOf('@keyframes home-field-drift');
  const driftFrames = wxss.slice(driftStart, wxss.indexOf('\n}', driftStart));
  const stops = [...driftFrames.matchAll(/translate3d\(\s*(-?[\d.]+)vw,\s*(-?[\d.]+)vw/g)]
    .map((m) => [Number(m[1]), Number(m[2])]);
  assert.ok(stops.length >= 4, 'drift 只有两个关键帧就是一条往返直线，正是看不出在动的那种');
  let pathVw = 0;
  for (let i = 1; i < stops.length; i += 1) {
    pathVw += Math.hypot(stops[i][0] - stops[i - 1][0], stops[i][1] - stops[i - 1][1]);
  }
  const vwPerSecond = pathVw / driftPeriod;
  // 0.35–1.2 vw/s ≈ 390 宽机型上的 1.4–4.7 px/s：下限保证十秒内能看出位移，上限保证不晃眼
  assert.ok(vwPerSecond > 0.35,
    `线场只有 ${(vwPerSecond * 3.9).toFixed(2)}px/s，真机上看不出在动`);
  assert.ok(vwPerSecond < 1.2,
    `线场 ${(vwPerSecond * 3.9).toFixed(2)}px/s 太快，背景会抢注意力`);

  // 主运动不能用 alternate：往返到端点速度归零，开屏那一刻恰好停在最慢处
  assert.doesNotMatch(driftDecl, /alternate/, 'drift 是主运动，用 alternate 会在两端出现看不见的死区');
  assert.match(driftDecl, /linear/, 'drift 用缓动会在每个关键帧附近造出减速死区');

  // 两层周期互质，合成轨迹一次使用里走不完一轮（alternate 的实际周期要翻倍）
  const effective = (name) => {
    const line = declaration(name);
    return Number(line.match(/ (\d+)s/)[1]) * (/alternate/.test(line) ? 2 : 1);
  };
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const turnEff = effective('home-field-turn');
  const driftEff = effective('home-field-drift');
  const combined = (turnEff * driftEff) / gcd(turnEff, driftEff);
  assert.ok(combined > 3600,
    `两层合成周期只有 ${(combined / 60).toFixed(0)} 分钟，会看出重复；实际周期 ${turnEff}s 与 ${driftEff}s 需互质`);

  // 减弱动态效果时停下
  assert.match(wxss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-field[\s\S]*animation:\s*none/);

  // 纯装饰：不进无障碍树、不吃触摸
  assert.match(wxml, /class="home-field" aria-hidden="true"/);
  assert.match(wxss, /\.home-field\s*\{[^}]*pointer-events:\s*none/);

  // 线段的三个几何量必须同单位（vw）。这是整页铺开后几何不变形的唯一依赖：
  // 换成百分比就会横向按容器宽、纵向按容器高分别解析，容器不是正方形时端点就对不上，
  // 胞元在交汇处裂开——而整页容器天然不是正方形。
  const lineStyle = wxml.match(/class="home-field-line"[\s\S]*?style="([^"]+)"/)[1];
  ['left', 'top', 'width'].forEach((prop) => {
    assert.match(lineStyle, new RegExp(`${prop}: \\{\\{item\\.\\w+\\}\\}vw`),
      `线段的 ${prop} 必须用 vw；换成 % 会让纵横按不同基准解析，胞元会裂开`);
  });

  // 线场铺满整页，而不是只盖住某一屏区域
  const fieldRule = wxss.match(/\.home-field\s*\{[^}]*\}/)[0];
  assert.match(fieldRule, /width:\s*100%/);
  assert.match(fieldRule, /height:\s*100%/);

  // 结点（junction spark）已撤除：不留孤儿样式，也不留没人用的数据
  assert.doesNotMatch(wxss, /home-field-node/);
  assert.doesNotMatch(wxml, /home-field-node/);
  assert.doesNotMatch(js, /HOME_VORONOI_NODES|fieldNodes/);
});

// 2026-09-18 第二次全页视觉审查：用户拍板三件（战情室少用操作、官方简中牌名、两页粘贴区统一），另修三处明显毛病
test('second visual sweep: quiet tracker actions, official card names, one paste bar and small fixes', () => {
  const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
  // 混沌工具页标题与首页入口、竞逐时空里的“返回混沌工具”同名
  assert.equal(JSON.parse(read('miniprogram/pages/random/random.json')).navigationBarTitleText, '混沌工具');
  // 牌名按 Scryfall 官方简中印刷写中文、英文原名放小字；没有简中印刷的照旧写英文
  const cabbageConfig = read('miniprogram/config/cabbage.js');
  assert.match(cabbageConfig, /name: 'Jaheira, Friend of the Forest', zhName: '树林之友贾希拉'/);
  assert.match(cabbageConfig, /name: 'Academy Manufactor', zhName: '大学院制造工人'/);
  assert.match(cabbageConfig, /name: 'Peregrin Took', zhName: '佩里格林·图克'/);
  assert.match(cabbageConfig, /\{ key: 'cabbage', name: 'The Cabbage Merchant' \}/);
  assert.match(cabbageConfig, /name: '食品'[\s\S]*name: '线索'[\s\S]*name: '珍宝'/);
  const cabbage = read('miniprogram/pages/cabbage/cabbage.wxml');
  assert.doesNotMatch(cabbage, />[^<]*\b(?:Food|Clue|Treasure)\b/, '界面文字不再写英文衍生物名');
  assert.match(cabbage, /\{\{item\.zhName \|\| item\.name\}\}[\s\S]*class="cabbage-engine-en"/);
  assert.match(read('miniprogram/config/izzet-storm.js'), /zhName: '风雨法师拉尔'/);
  const izzet = read('miniprogram/pages/izzet/izzet.wxml');
  const izzetText = izzet.replace(/\{\{[^}]*\}\}/g, '').replace(/<[^>]*>/g, ' ');
  assert.doesNotMatch(izzetText, /storm|Ral 自伤|抛币/i, '界面文字不再写英文 storm 与“抛币”');
  assert.doesNotMatch(izzet, /aria-label="[^"]*storm/, '读屏名称也用“风暴”');
  assert.match(izzet, /本回合咒语[\s\S]*拉尔自伤[\s\S]*拉尔掷硬币/);
  assert.match(izzet, /\{\{item\.zhName \|\| item\.name\}\}[\s\S]*class="izzet-engine-en"/);
  assert.match(read('miniprogram/pages/random/random.wxml'), /风雨法师拉尔 <text class="tool-entry-en">Ral, Monsoon Mage<\/text>/);
  const hands = read('miniprogram/community/pages/hands/index.js');
  assert.match(hands, /'Kinnan, Bonder Prodigy': '持绊逸才季宁'/);
  assert.match(hands, /'Tymna the Weaver': '织命使堤谟娜'/);
  assert.match(
    read('miniprogram/community/pages/hands/index.wxml'),
    /\{\{hand\.commanderZh\}\}<\/view>\s*<view class="commander-en">\{\{hand\.commander\}\}/,
  );
  // 战情室：清空数据挪到页面最下方，“＋”写明添加套牌
  const tracker = read('miniprogram/pages/tracker/tracker.wxml');
  assert.match(tracker, /bindtap="addDeck">＋ 添加套牌<\/button>/);
  const clearAt = tracker.indexOf('bindtap="clearData"');
  assert.ok(clearAt > tracker.indexOf('card-art-credit'), '清空数据在版权说明之后');
  assert.ok(clearAt > tracker.indexOf('bindtap="exportData"'), '清空数据不再和复制战绩文本并排');
  assert.match(tracker, /<view class="tracker-footer">\s*<view class="text-button clear-data-button"/);
  // 调牌记录：虚线框看着能点，就真的能点
  const swaps = read('miniprogram/community/pages/swaps/index.wxml');
  assert.equal((swaps.match(/class="swap-art-empty"[^>]*bindtap="choose"/g) || []).length, 2);
  assert.match(swaps, /aria-label="选择换出的单卡"[^>]*data-target="outCard"/);
  assert.match(swaps, /aria-label="选择换入的单卡"[^>]*data-target="inCard"/);
  // 强度分级与套牌试玩的说明文字不小于 10px
  for (const file of ['miniprogram/pages/bracket/bracket.wxss', 'miniprogram/pages/playtest/playtest.wxss']) {
    assert.match(read(file), /\.import-secondary\s*\{[^}]*font-size:\s*max\(19rpx, 10px\)/, `${file} 说明文字不小于 10px`);
  }
});

// 2026-11-10 全页美学自检（docs/ux-goals.md 末尾）。小控件的热区与外观解耦（ux-goals G：触控热区不小于
// 44×44 CSS px）：控件本身 position: relative，一个 content:"" 的 ::after 向外伸出看不见的热区，做法同战情室的改/删。
// 这里按每条 ::after 的上下伸出量加上控件自身高度，核对纵向够不够 88rpx（375 宽即 44px）。
test('试玩、卷心菜、伊捷的小控件有伸到 88rpx 的隐形热区，关键按钮有 44px 下限', () => {
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const css = (rel) => read(rel).replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (sheet, selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = sheet.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    assert.ok(match, `缺少规则 ${selector}`);
    return match[1];
  };
  const rpx = (block, prop) => {
    const match = block.match(new RegExp(`(?:^|[\\s;])${prop}:\\s*(-?\\d+)rpx`));
    return match ? Number(match[1]) : null;
  };
  const cases = [
    ['miniprogram/pages/playtest/playtest.wxss', '.life-btn', '.life-btn::after', 56],
    ['miniprogram/pages/playtest/playtest.wxss', '.board-action', '.board-action::after', 44],
    ['miniprogram/pages/playtest/playtest.wxss', '.mana-ctrl', '.mana-ctrl::after', 48],
    ['miniprogram/pages/cabbage/cabbage.wxss', '.cabbage-ctrl', '.cabbage-ctrl::after', 68],
    // 文字按钮没有写死的高度：14px 字一行约 36rpx，上下各伸 26rpx 才够
    ['miniprogram/pages/cabbage/cabbage.wxss', '.cabbage-footer .text-button', '.cabbage-footer .text-button::after', 36],
    ['miniprogram/pages/izzet/izzet.wxss', '.izzet-ctrl', '.izzet-ctrl::after', 68],
    ['miniprogram/pages/izzet/izzet.wxss', '.izzet-footer .text-button', '.izzet-footer .text-button::after', 36],
  ];
  for (const [file, base, after, ownHeight] of cases) {
    const sheet = css(file);
    assert.match(rule(sheet, base), /position:\s*relative/, `${base} 要做 ::after 的定位参照`);
    const zone = rule(sheet, after);
    assert.match(zone, /content:\s*"";/, `${after} 要有 content`);
    const top = rpx(zone, 'top');
    const bottom = rpx(zone, 'bottom');
    assert.ok(top !== null && bottom !== null && top < 0 && bottom < 0, `${after} 要向上下伸出`);
    const reach = ownHeight - top - bottom;
    assert.ok(reach >= 88, `${after} 纵向只到 ${reach}rpx，不足 88rpx`);
  }
  // 法术力 ± 左右也要伸：每格横向有 102rpx，伸 20rpx 邻格够不到；总量格只有 60rpx 宽，靠左右伸出补足
  const playtest = css('miniprogram/pages/playtest/playtest.wxss');
  assert.match(rule(playtest, '.mana-ctrl::after'), /position:\s*absolute[\s\S]*left:\s*-20rpx/);
  assert.match(rule(playtest, '.mana-total::after'), /content:\s*"";[\s\S]*left:\s*-\d+rpx/);
  // 关键按钮的 px 下限：rpx 在 320 宽的机型上缩到 32 到 35px
  const tracker = css('miniprogram/pages/tracker/tracker.wxss');
  assert.match(rule(tracker, '.add-match-button'), /min-height:\s*max\(44px, 82rpx\)/);
  assert.match(rule(tracker, '.add-deck-button'), /min-height:\s*max\(44px, 84rpx\)/);
  // 牌库面板里的每个可点元素都要有按压反馈（D 反馈），和全站其余可点控件一样
  const panel = read('miniprogram/pages/playtest/playtest.wxml');
  const zone = panel.slice(panel.indexOf('class="zone-panel '), panel.indexOf('</scroll-view>', panel.indexOf('class="zone-panel ')));
  const tappables = zone.match(/<view\b[^>]*bindtap="[^"]+"[^>]*>/g) || [];
  assert.ok(tappables.length >= 9, `牌库面板应有至少 9 个可点元素，找到 ${tappables.length}`);
  tappables.forEach((tag) => assert.match(tag, /hover-class="pressable-active"/, `缺按压反馈：${tag.slice(0, 80)}`));
  // 加载中的文案以省略号收尾，和全站其余加载文案一致
  assert.match(read('miniprogram/pages/meta/meta.wxml'), />正在读取月报…</);
  assert.match(read('miniprogram/community/components/card-picker/index.wxml'), />正在查找…</);
});
