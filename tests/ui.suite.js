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
  // 编号与 key 后可跟随巨号/偏移/粗分割等破坏性修饰类，提取放宽到 key 边界
  assert.deepEqual(
    Array.from(wxml.matchAll(/class="home-button-index[^"]*">(\d{2})<\/text>/g), (match) => match[1]),
    ['01', '02', '03', '04', '05', '06', '07', '08'],
  );
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
  assert.match(wxss, /\.home-index-active \.home-button-index[\s\S]*?color:\s*#00B3FF/);
  assert.match(wxss, /\.home-button\s*{[\s\S]*transition:\s*color 60ms linear,\s*background-color 60ms linear/);
  // 反相态只许改颜色：块内匹配（[^}]*）防跨块误命中，(?<!text-) 防 text-transform 子串误报
  assert.doesNotMatch(wxss, /\.home-index-active\s*{[^}]*(?:opacity:|scale:|(?<!text-)transform:)/);
  assert.match(wxss, /@media \(max-height:\s*700px\)[\s\S]*flex-basis:\s*40vh/);
  assert.match(wxss, /@media \(max-height:\s*600px\)[\s\S]*flex-basis:\s*40vh/);
  assert.match(wxss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*transition:\s*none/);
  assert.match(wxss, /\.home-button-text\s*{[^}]*align-items:\s*baseline[^}]*justify-content:\s*space-between/);
  assert.doesNotMatch(wxss, /home-button-leader|dotted/);
  // 排版破坏 ①：不等行高、偏移打破左对齐线、巨号编号、部分行粗黑分割
  assert.match(wxss, /\.home-button-tall\s*{[^}]*flex-grow:\s*1\.45/);
  assert.match(wxss, /\.home-button-short\s*{[^}]*flex-grow:\s*0\.72/);
  assert.match(wxss, /\.home-button-shift\s*{[^}]*padding-left:\s*64rpx/);
  assert.match(wxss, /\.home-button-heavy\s*{[^}]*border-bottom:\s*5px solid #0A0A0A/);
  assert.match(wxss, /\.home-button-index-xxl\s*{[^}]*font-size:\s*38px/);
  assert.match(wxss, /\.home-button-index-over\s*{[^}]*margin-left:\s*-40rpx/);
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
  assert.deepEqual(
    Array.from(wxss.matchAll(/border-radius:\s*([^;]+);/g), (match) => match[1].trim()),
    ['0'],
  );

  const colorLiterals = Array.from(
    wxss.matchAll(/#[0-9a-f]{6}|rgba?\([^)]*\)/gi),
    (match) => match[0].replace(/\s/g, '').toUpperCase(),
  );
  assert.deepEqual(
    new Set(colorLiterals),
    new Set(['#D0F03C', '#FFFFFF', '#0A0A0A', '#00B3FF', 'RGBA(0,0,0,0.35)', 'RGBA(0,0,0,0.7)']),
    '首页色板：底色 + 黑 + 白 + 事故色电光蓝 + 半透明黑双档（0.35 装饰 / 0.7 功能文本）',
  );
  // 编号提为纯黑巨号（最大对比），英文副标题 0.7 过 AA 正文对比度；imprint 退到 0.35 近乎隐形
  assert.match(wxss, /\.home-button-index\s*{[^}]*color:\s*#0A0A0A/);

  // 编号有四种字面「声音」，按行的既有角色分配（heavy / shift / plain / short），
  // 不是八行八种、也不是八行一种——避免退回「只有字号差别、没有字体对比」的状态
  const indexVoices = {
    'home-index-shout': ['01', '05'],
    'home-index-redacted': ['02', '06'],
    // 08 是 tall 但非 heavy，与 03/07 一样没有额外角色修饰，归入点阵
    'home-index-whisper': ['03', '07', '08'],
    'home-index-stretch': ['04'],
  };
  Object.entries(indexVoices).forEach(([voice, numbers]) => {
    numbers.forEach((n) => {
      assert.match(wxml, new RegExp(`class="home-button-index[^"]*${voice}">${n}<`),
        `${n} 应使用 ${voice} 字面`);
    });
  });
  // 三套字面必须真的不同族：超粗 / 点阵 / 等宽
  assert.match(wxss, /\.home-index-shout\s*{[^}]*font-family:\s*"cEDHDisplay"/);
  assert.match(wxss, /\.home-index-whisper\s*{[^}]*font-family:\s*"HomePixel"/);
  // 点阵放大必须落在 10px 网格整数倍上，否则真机糊
  const whisperSize = Number(wxss.match(/\.home-index-whisper\s*{[^}]*font-size:\s*(\d+)px/)[1]);
  assert.equal(whisperSize % 10, 0, `点阵编号字号需为 10 的整数倍，当前 ${whisperSize}px`);
  assert.ok(whisperSize >= 28, '点阵编号仍须是巨号，对比来自肌理而不是缩小');
  // 涂黑编号在 glitch 行必须另行反相，否则黑底黑字整枚消失
  assert.match(wxss, /\.home-button\.is-glitch \.home-index-redacted\s*{[^}]*color:\s*#00B3FF/);
  // 实心黑块比字形宽出左右各 10rpx，会吃掉原本靠字形侧边距留出的间隙、直接顶到中文；
  // 必须显式补回右侧留白（真机上 02火花觉醒 / 06混沌工具 曾经贴死）
  const redactedRule = wxss.match(/\.home-index-redacted\s*\{[^}]*\}/)[0];
  const redactedPadX = Number(redactedRule.match(/padding:\s*\d+rpx\s+(\d+)rpx/)[1]);
  const redactedGap = Number(redactedRule.match(/margin-right:\s*(\d+)rpx/)[1]);
  assert.ok(redactedGap > redactedPadX,
    `涂黑编号的右侧留白 ${redactedGap}rpx 必须大于黑块外扩的 ${redactedPadX}rpx，否则仍会顶到中文`);
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
  // 全页文字均不使用 text-shadow（题词已改普通字体、加粗、无投影）；旧橙色双影配色不得复现
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
  assert.doesNotMatch(wxss, /font-style:\s*italic/);

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
  assert.match(appWxss, /\.option,[\s\S]*\.preset-chip,[\s\S]*\.result-button,[\s\S]*\.seat-button\s*{[\s\S]*border-radius:\s*var\(--cedh-radius-control-sm\)/);
  assert.match(appWxss, /\.primary-button,[\s\S]*\.secondary-button,[\s\S]*\.text-button,[\s\S]*\.option,[\s\S]*\.preset-chip,[\s\S]*\.result-button,[\s\S]*\.seat-button\s*{[\s\S]*transition:[\s\S]*220ms/);
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
  ];

  assert.doesNotMatch(indexWxml, /particle-background|particleCanvas/);
  assert.doesNotMatch(indexJs, /selectComponent|homeParticles|HomeTouch|setTouchFromEvent|clearTouch/);
  assert.equal(indexJson.usingComponents, undefined);
  paletteMounts.forEach(([file, palette]) => {
    const markup = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(
      markup,
      new RegExp(`<particle-background palette="${palette}"></particle-background>`),
      `${file} 的粒子背景应使用 ${palette} 主题配色`,
    );
    assert.ok(particleConfig.palettes && particleConfig.palettes[palette], `${palette} palette 应在 config/particle.js 收录`);
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
test('quiz and result action controls stay inside mobile width', () => {
  const quizWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/quiz/quiz.wxml'), 'utf8');
  const resultWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/result/result.wxml'), 'utf8');
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

  assert.match(js, /require\('\.\.\/\.\.\/utils\/scryfall'\)/);
  assert.match(js, /fetchCardImageUris\(card\.name\)/);
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
  const { HOME_VORONOI_EDGES, HOME_VORONOI_NODES } = require('../miniprogram/config/home-voronoi');

  // 几何在构建期算好，运行时不算
  assert.match(fs.readFileSync(path.join(root, 'miniprogram/config/home-voronoi.js'), 'utf8'),
    /由 scripts\/build-home-voronoi\.js 生成，请勿手改/);
  assert.ok(HOME_VORONOI_EDGES.length >= 20, '线段太少，构不成胞元结构');
  HOME_VORONOI_EDGES.forEach((edge) => {
    ['x', 'y', 'len', 'deg'].forEach((key) => assert.equal(typeof edge[key], 'number'));
  });

  // 不规则性要能被验证：线段长度必须显著参差，否则就成了规则网格
  const lens = HOME_VORONOI_EDGES.map((e) => e.len);
  assert.ok(Math.max(...lens) / Math.min(...lens) > 5,
    '线段长度过于均匀，看起来会像网格而不是 Voronoi');

  // 传输量：静态几何一次推完，不该膨胀
  const payload = Buffer.byteLength(JSON.stringify({ HOME_VORONOI_EDGES, HOME_VORONOI_NODES }), 'utf8');
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

  // 不规律靠两层互质周期叠加，而不是每帧重算
  const period = (name) => {
    const line = wxss.split('\n').find((row) => row.includes(`animation: ${name} `));
    assert.ok(line, `找不到 ${name} 的 animation 声明`);
    return Number(line.match(/ (\d+)s/)[1]);
  };
  const turn = period('home-field-turn');
  const drift = period('home-field-drift');
  assert.notEqual(turn, drift, '两层周期相同就会同步，合成运动变得规律');
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  assert.equal(gcd(turn, drift), 1, `周期 ${turn}s 与 ${drift}s 必须互质，否则会较快回到同一相位`);

  // 减弱动态效果时停下
  assert.match(wxss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.home-field[\s\S]*animation:\s*none/);

  // 纯装饰：不进无障碍树、不吃触摸
  assert.match(wxml, /class="home-field" aria-hidden="true"/);
  assert.match(wxss, /\.home-field\s*\{[^}]*pointer-events:\s*none/);

  // 容器必须是正方形：线段长度在 100×100 坐标系里算的，非正方形会把长度拉伸错
  const fieldRule = wxss.match(/\.home-field\s*\{[^}]*\}/)[0];
  const w = fieldRule.match(/width:\s*(\d+)vw/)[1];
  const h = fieldRule.match(/height:\s*(\d+)vw/)[1];
  assert.equal(w, h, '线场容器必须是正方形，否则百分比长度会被拉伸成错误比例');
});
