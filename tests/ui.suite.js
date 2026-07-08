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

test('home page only shows the required landing content', () => {
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8');
  const shareUtil = fs.readFileSync(path.join(root, 'miniprogram/utils/share.js'), 'utf8');
  const pageJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.json'), 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));

  assert.match(wxml, /cEDH Tutor/);
  assert.doesNotMatch(wxml, /cEDH 导师/);
  assert.equal(pageJson.navigationBarTitleText, 'cEDH Tutor');
  assert.equal(appJson.window.navigationBarTitleText, 'cEDH Tutor');
  assert.match(wxml, /竞技指挥官导师/);
  assert.doesNotMatch(wxml, /竞技指挥官小助手/);
  assert.doesNotMatch(wxml, /一个竞技指挥官小助手/);
  assert.doesNotMatch(wxml, /你的竞技指挥官小助手/);
  assert.doesNotMatch(wxml, /开始匹配/);
  assert.match(wxml, /火花觉醒/);
  assert.match(wxml, /人格测试/);
  assert.doesNotMatch(wxml, /人格测试 EDHTI/);
  assert.match(wxml, /EDHTI TEST/);
  assert.match(wxml, /SPARK ZONE/);
  assert.doesNotMatch(wxml, /PERSONALITY TEST/);
  assert.match(wxml, /我的主将/);
  assert.doesNotMatch(wxml, /我的指挥官/);
  assert.match(wxml, /COMMANDERS/);
  assert.doesNotMatch(wxml, /随机工具/);
  assert.match(wxml, /混沌工具/);
  assert.match(wxml, /CHAOS TOOLS/);
  assert.doesNotMatch(wxml, /EDHTI Test|START MATCHING|MY COMMANDERS|RANDOMIZATION|RANDOM TOOLS/);
  assert.doesNotMatch(wxml, /→|arrow|glass-crack/);
  assert.match(wxml, /home-button-en/);
  assert.match(wxml, /home-button-edhti/);
  assert.match(wxml, /home-button-match/);
  assert.match(wxml, /home-button-tracker/);
  assert.match(wxml, /home-button-random/);
  assert.doesNotMatch(wxml, /<button[^>]*home-button/);
  assert.doesNotMatch(wxml, /class="(?:primary|secondary)-button home-button/);
  assert.ok(
    wxml.indexOf('home-button-edhti') < wxml.indexOf('home-button-match'),
    'EDHTI entry should appear above the commander quiz entry',
  );
  assert.match(js, /goEdhti/);
  assert.match(js, /goTracker/);
  assert.match(js, /goRandom/);
  assert.match(js, /enableShareMenu\(\)/);
  assert.match(shareUtil, /wx\.showShareMenu\s*\(/);
  assert.match(shareUtil, /menus:\s*\[\s*'shareAppMessage'\s*,\s*'shareTimeline'\s*\]/);
  assert.match(js, /onShareAppMessage\s*\(\)\s*{[\s\S]*title:\s*'cEDH Tutor · 竞技指挥官导师'/);
  assert.match(js, /onShareTimeline\s*\(\)\s*{[\s\S]*title:\s*'cEDH Tutor · 竞技指挥官导师'/);

  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxss'), 'utf8');
  const homeButtonStyles = wxss.slice(wxss.indexOf('.home-button {'));
  const homeButtonBlock = wxss.match(/\.home-button\s*{[\s\S]*?\n}/)[0];
  const homeButtonGlassBlock = wxss.match(/\.home-button-glass\s*{[\s\S]*?\n}/)[0];
  const homeButtonTextBlock = wxss.match(/\.home-button-text\s*{[\s\S]*?\n}/)[0];
  const homeButtonZhStyles = wxss.slice(
    wxss.indexOf('.home-button-zh {'),
    wxss.indexOf('.home-button-en {'),
  );
  assert.match(js, /glassLayers:\s*\[1,\s*2,\s*3,\s*4,\s*5\]/);
  assert.match(wxss, /\.home-actions\s*{[\s\S]*align-items:\s*flex-start/);
  assert.match(wxss, /\.home-actions\s*{[\s\S]*gap:\s*58rpx/);
  assert.match(wxss, /\.home-actions\s*{[\s\S]*margin-left:\s*-44rpx/);
  assert.match(wxss, /\.home-actions\s*{[\s\S]*width:\s*calc\(100% \+ 44rpx\)/);
  assert.match(wxss, /\.home-button\s*{[\s\S]*align-items:\s*flex-start/);
  assert.match(wxss, /\.display-title\s*{[\s\S]*width:\s*552rpx/);
  assert.match(wxss, /\.display-title\s*{[\s\S]*justify-content:\s*center/);
  assert.match(wxss, /\.subtitle\s*{[\s\S]*width:\s*552rpx/);
  assert.match(wxss, /\.subtitle\s*{[\s\S]*text-align:\s*center/);
  assert.match(wxss, /\.subtitle\s*{[\s\S]*margin-top:\s*-22rpx/);
  assert.match(wxss, /\.home-button\s*{[\s\S]*width:\s*284rpx/);
  assert.match(wxss, /\.home-button\s*{[\s\S]*height:\s*116rpx/);
  assert.match(wxss, /\.home-button\s*{[\s\S]*padding:\s*20rpx 36rpx 20rpx 12rpx/);
  assert.match(wxss, /\.home-button\s*{[\s\S]*background:\s*transparent/);
  assert.match(wxss, /\.home-button\s*{[\s\S]*box-shadow:\s*none/);
  assert.match(wxss, /\.home-button\s*{[\s\S]*border-radius:\s*var\(--cedh-radius-control-sm\)/);
  assert.match(wxml, /home-button-glass-stack/);
  assert.match(wxml, /wx:for="\{\{glassLayers\}\}"/);
  assert.match(wxml, /home-button-glass-\{\{item\}\}/);
  assert.match(wxml, /home-button-text/);
  assert.match(wxss, /\.home-button-glass\s*{[\s\S]*backdrop-filter:\s*blur\(20rpx\)/);
  assert.match(wxss, /\.home-button-glass\s*{[\s\S]*clip-path:\s*polygon\(0 8%,\s*3% 0,\s*100% 0,\s*88% 100%,\s*3% 100%,\s*0 92%\)/);
  assert.match(wxss, /\.home-button-glass\s*{[\s\S]*background:\s*rgba\(255,\s*249,\s*224,\s*0\.52\)/);
  assert.match(homeButtonGlassBlock, /box-shadow:\s*inset 0 1rpx 0 rgba\(255,\s*255,\s*255,\s*0\.84\)/);
  assert.doesNotMatch(homeButtonGlassBlock, /linear-gradient|inset 0 -/);
  assert.doesNotMatch(wxss, /\.home-button-glass::after/);
  assert.doesNotMatch(wxss, /repeating-linear-gradient\(106deg|radial-gradient\(circle/);
  assert.match(homeButtonTextBlock, /position:\s*absolute/);
  assert.match(homeButtonTextBlock, /inset:\s*0/);
  assert.match(homeButtonTextBlock, /align-items:\s*center/);
  assert.match(homeButtonTextBlock, /justify-content:\s*center/);
  assert.match(homeButtonTextBlock, /text-align:\s*center/);
  assert.match(wxss, /\.home-button-glass-1\s*{[\s\S]*opacity:\s*0\.96/);
  assert.match(wxss, /\.home-button-glass-1\s*{[\s\S]*background:\s*rgba\(255,\s*249,\s*224,\s*0\.56\)/);
  assert.match(wxss, /\.home-button-glass-2\s*{[\s\S]*background:\s*rgba\(248,\s*240,\s*218,\s*0\.62\)/);
  assert.match(wxss, /\.home-button-glass-3\s*{[\s\S]*background:\s*rgba\(238,\s*228,\s*211,\s*0\.68\)/);
  assert.match(wxss, /\.home-button-glass-4\s*{[\s\S]*background:\s*rgba\(224,\s*220,\s*211,\s*0\.74\)/);
  assert.match(wxss, /\.home-button-glass-5\s*{[\s\S]*background:\s*rgba\(211,\s*214,\s*209,\s*0\.8\)/);
  assert.match(wxss, /\.home-button-glass-2\s*{[\s\S]*transform:\s*translate3d\(-6rpx,\s*6rpx,\s*0\)/);
  assert.match(wxss, /\.home-button-glass-3\s*{[\s\S]*transform:\s*translate3d\(-12rpx,\s*12rpx,\s*0\)/);
  assert.match(wxss, /\.home-button-glass-4\s*{[\s\S]*transform:\s*translate3d\(-18rpx,\s*18rpx,\s*0\)/);
  assert.match(wxss, /\.home-button-glass-5\s*{[\s\S]*transform:\s*translate3d\(-24rpx,\s*24rpx,\s*0\)/);
  assert.doesNotMatch(wxss, /\.home-button-random\s*{[\s\S]*rgba\(22,\s*16,\s*15,\s*0\.92\)/);
  assert.doesNotMatch(wxss, /\.home-button-random\s*{[\s\S]*rgba\(102,\s*31,\s*27,\s*0\.76\)/);
  assert.doesNotMatch(wxss, /\.home-button::before/);
  assert.doesNotMatch(wxss, /\.home-button::after/);
  assert.doesNotMatch(wxss, /rgba\(214,\s*179,\s*64,\s*0\.88\)/);
  assert.doesNotMatch(wxss, /rotate\(12deg\)/);
  assert.doesNotMatch(homeButtonBlock, /linear-gradient|clip-path|drop-shadow|backdrop-filter:\s*blur/);
  assert.match(wxss, /\.home-button-zh\s*{[\s\S]*font-family:[\s\S]*Source Han Serif SC[\s\S]*Noto Serif CJK SC[\s\S]*Songti SC/);
  assert.match(wxss, /\.home-button-zh\s*{[\s\S]*font-size:\s*var\(--cedh-text-18\)/);
  assert.match(wxss, /\.home-button-zh\s*{[\s\S]*font-weight:\s*620/);
  assert.doesNotMatch(homeButtonZhStyles, /font-weight:\s*900/);
  assert.match(wxss, /\.home-button-zh\s*{[\s\S]*color:\s*rgba\(138,\s*64,\s*22,\s*0\.9\)/);
  assert.doesNotMatch(homeButtonZhStyles, /background-image:/);
  assert.doesNotMatch(homeButtonZhStyles, /-webkit-background-clip:\s*text/);
  assert.doesNotMatch(homeButtonZhStyles, /-webkit-text-fill-color:\s*transparent/);
  assert.doesNotMatch(homeButtonZhStyles, /#8C5524|#F2C46D|#B87333/);
  assert.doesNotMatch(homeButtonZhStyles, /#F59105/);
  assert.match(homeButtonZhStyles, /text-shadow:[\s\S]*1rpx 1rpx 0 rgba\(92,\s*12,\s*16,\s*0\.28\)[\s\S]*-1rpx -1rpx 0 rgba\(255,\s*224,\s*118,\s*0\.32\)/);
  assert.match(homeButtonZhStyles, /font-style:\s*italic/);
  assert.match(wxss, /\.home-button-en\s*{[\s\S]*letter-spacing:\s*0\.34em/);
  assert.match(wxss, /\.home-button-en\s*{[\s\S]*font-family:[\s\S]*Arial Black[\s\S]*Avenir Next Condensed[\s\S]*DIN Condensed/);
  assert.match(wxss, /\.home-button-en\s*{[\s\S]*font-size:\s*16rpx/);
  assert.match(wxss, /\.home-button-en\s*{[\s\S]*font-style:\s*normal/);
  const homeButtonEnBlock = wxss.match(/\.home-button-en\s*{[\s\S]*?\n}/)[0];
  assert.doesNotMatch(homeButtonEnBlock, /text-shadow:/);
  assert.doesNotMatch(homeButtonEnBlock, /skewX/);
  assert.doesNotMatch(homeButtonStyles, /translateX\(/);
  assert.doesNotMatch(homeButtonBlock, /rgba\(184,\s*74,\s*63|#fffefa|rgba\(28,\s*23,\s*19,\s*0\.88/);

  ['纯前端', '本地配置', '技术', '接口', '云', 'edhtop16'].forEach((word) => {
    assert.doesNotMatch(wxml, new RegExp(word), `home page should not show ${word}`);
  });
});

test('home title uses a styled display treatment instead of a plain text block', () => {
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxss'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8');

  assert.match(wxml, /class="title display-title"/);
  assert.match(wxml, /class="title-latin"/);
  assert.match(wxml, /class="title-tutor"/);
  assert.match(wxss, /\.title\s*{[\s\S]*font-size:\s*108rpx/);
  assert.match(wxss, /\.display-title\s*{[\s\S]*font-style:\s*italic/);
  assert.match(wxss, /\.display-title\s*{[\s\S]*font-weight:\s*800/);
  assert.match(wxss, /\.display-title\s*{[\s\S]*skewX\(-/);
  assert.match(wxss, /\.title-latin\s*{[\s\S]*font-family:[\s\S]*(Arial Black|Avenir Next Condensed|DIN Condensed)/);
  assert.match(wxss, /\.title-latin\s*{[\s\S]*font-size:\s*108rpx/);
  assert.match(wxss, /\.title-latin\s*{[\s\S]*font-weight:\s*900/);
  assert.match(wxss, /\.title-tutor\s*{[\s\S]*font-family:\s*"cEDHDisplay",\s*"Arial Black",\s*"Avenir Next Condensed",\s*"DIN Condensed"/);
  assert.match(wxss, /\.title-tutor\s*{[\s\S]*font-size:\s*102rpx/);
  assert.match(wxss, /\.title-tutor\s*{[\s\S]*font-weight:\s*900/);
  assert.match(wxss, /text-shadow:/);

  // 内嵌标题字体：全平台统一渲染，消除 iOS/安卓系统字体分歧
  assert.match(wxss, /\.title-latin\s*{[\s\S]*font-family:\s*"cEDHDisplay"/);
  assert.match(js, /wx\.loadFontFace/);
  assert.match(js, /family:\s*'cEDHDisplay'/);
  assert.match(js, /titleFontBase64/);
  const fontModule = fs.readFileSync(path.join(root, 'miniprogram/assets/title-font.js'), 'utf8');
  assert.match(fontModule, /titleFontBase64:\s*'/);
  assert.ok(fontModule.length > 20000, '内嵌 base64 字体应存在且足够长');
  assert.match(fontModule, /Open Font License/);
});

test('button press feedback is centralized and reused across app controls', () => {
  const tokensWxss = fs.readFileSync(path.join(root, 'miniprogram/styles/tokens.wxss'), 'utf8');
  const appWxss = fs.readFileSync(path.join(root, 'miniprogram/app.wxss'), 'utf8');
  const randomWxss = fs.readFileSync(path.join(root, 'miniprogram/pages/random/random.wxss'), 'utf8');
  const interactiveMarkup = [
    'miniprogram/pages/index/index.wxml',
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
});

test('home particle touch interaction is full-screen and only enabled on home page', () => {
  const indexWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const indexJs = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8');
  const particleComponent = fs.readFileSync(path.join(root, 'miniprogram/components/particle-background/particle-background.js'), 'utf8');
  const particleWxss = fs.readFileSync(path.join(root, 'miniprogram/components/particle-background/particle-background.wxss'), 'utf8');
  const otherPages = [
    'miniprogram/pages/quiz/quiz.wxml',
    'miniprogram/pages/result/result.wxml',
    'miniprogram/pages/tracker/tracker.wxml',
    'miniprogram/pages/random/random.wxml',
  ].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');

  assert.match(indexWxml, /<view[\s\S]*class="page home"[\s\S]*bindtouchstart="handleHomeTouchStart"[\s\S]*bindtouchmove="handleHomeTouchMove"[\s\S]*bindtouchend="handleHomeTouchEnd"[\s\S]*bindtouchcancel="handleHomeTouchEnd"/);
  assert.match(indexWxml, /<particle-background\s+id="homeParticles"\s+interactive="\{\{true\}\}">/);
  assert.match(indexJs, /selectComponent\('#homeParticles'\)/);
  assert.match(indexJs, /handleHomeTouchStart\(event\)[\s\S]*setTouchFromEvent\(event\)/);
  assert.match(indexJs, /handleHomeTouchMove\(event\)[\s\S]*setTouchFromEvent\(event\)/);
  assert.match(indexJs, /handleHomeTouchEnd\(\)[\s\S]*clearTouch\(\)/);
  assert.doesNotMatch(otherPages, /interactive="\{\{true\}\}"/);

  assert.match(particleComponent, /properties:\s*{[\s\S]*interactive:\s*{[\s\S]*type:\s*Boolean[\s\S]*value:\s*false/);
  assert.match(particleComponent, /this\.width\s*=\s*windowInfo\.windowWidth/);
  assert.match(particleComponent, /this\.height\s*=\s*windowInfo\.windowHeight/);
  assert.match(particleComponent, /setTouchFromEvent\(event\)[\s\S]*this\.properties\.interactive[\s\S]*this\.updateTouch\(event\)/);
  assert.match(particleComponent, /clearTouch\(\)[\s\S]*this\.properties\.interactive[\s\S]*this\.touch = null/);
  assert.match(particleComponent, /handleTouchStart\(event\)[\s\S]*setTouchFromEvent\(event\)/);
  assert.match(particleComponent, /handleTouchEnd\(\)[\s\S]*clearTouch\(\)/);
  assert.match(particleWxss, /position:\s*fixed/);
  assert.match(particleWxss, /width:\s*100vw/);
  assert.match(particleWxss, /height:\s*100vh/);
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
  assert.match(noirGoldTheme, /\.quiz,\s*\.result\s*{[\s\S]*?--cedh-accent:\s*#d8b76a/);
  assert.match(quizWxss, /\.question-title\s*{[\s\S]*color:\s*var\(--cedh-accent-ink\)/);
  assert.match(quizWxss, /\.option\.selected \.option-text\s*{[\s\S]*color:\s*var\(--cedh-accent-ink\)/);
  assert.doesNotMatch(quizWxss, /rgba\(155,\s*58,\s*47/);
  assert.match(noirGoldTheme, /\.result\s*{[\s\S]*linear-gradient\(180deg,\s*#070707 0%,\s*#020202 56%,\s*#000000 100%\)/);
  assert.match(resultWxss, /\.actions\s*{[\s\S]*display:\s*flex/);
  assert.match(resultWxss, /\.action-button\s*{[\s\S]*flex:\s*1 1 0/);
  assert.match(resultWxss, /\.action-button\s*{[\s\S]*min-width:\s*0/);
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
  assert.match(scryfallJs, /SCRYFALL_USER_AGENT = 'cEDH-Tutor\/1\.0'/);
  assert.match(scryfallJs, /Accept:\s*'application\/json'/);
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

test('particle and performance configs use white-background champagne dust behavior', () => {
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

  const particleComponent = fs.readFileSync(path.join(root, 'miniprogram/components/particle-background/particle-background.js'), 'utf8');
  assert.match(particleComponent, /particleConfig\.tone\.accentRatio/);
  assert.match(particleComponent, /particleConfig\.softEdge\.shadowAlphaMultiplier/);
  assert.match(particleComponent, /adjustParticlePool\(\)/);
  assert.doesNotMatch(particleComponent, /this\.currentTier = TIER_ORDER\[currentIndex - 1\];[\s\S]{0,180}this\.resetParticles\(\)/);
  assert.doesNotMatch(particleComponent, /this\.currentTier = TIER_ORDER\[currentIndex \+ 1\];[\s\S]{0,180}this\.resetParticles\(\)/);
  assert.match(particleComponent, /paintConnections\(tier\)/);
  assert.match(particleComponent, /paintConnections\(tier\)\s*{[\s\S]*const ctx = this\.ctx/);
  assert.match(particleComponent, /ctx\.moveTo\(particle\.x,\s*particle\.y\)/);
  assert.match(particleComponent, /ctx\.lineTo\(candidate\.x,\s*candidate\.y\)/);

  assert.equal(performanceConfig.defaultMode, 'auto');
  assert.equal(performanceConfig.tiers.high.count, 80);
  assert.equal(performanceConfig.tiers.medium.count, 55);
  assert.equal(performanceConfig.tiers.low.count, 30);
  assert.equal(performanceConfig.tiers.low.softEdge, false);
  assert.equal(performanceConfig.fps.downgradeBelow, 45);
  assert.equal(performanceConfig.fps.upgradeAbove, 55);
});

test('interface surfaces use translucent glass tokens so particles remain visible', () => {
  const tokens = fs.readFileSync(path.join(root, 'miniprogram/styles/tokens.wxss'), 'utf8');
  const appWxss = fs.readFileSync(path.join(root, 'miniprogram/app.wxss'), 'utf8');
  const chartJs = fs.readFileSync(path.join(root, 'miniprogram/utils/tracker-charts.js'), 'utf8');
  const pageWxss = [
    'miniprogram/app.wxss',
    'miniprogram/pages/index/index.wxss',
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
  assert.match(chartJs, /background:\s*'rgba\(255,\s*254,\s*250,\s*0\.64\)'/);
  assert.doesNotMatch(chartJs, /background:\s*'rgba\(250,\s*255,\s*235/);
  assert.doesNotMatch(pageWxss, /rgba\(255,\s*254,\s*250,\s*0\.(8[6-9]|9\d)\)/);
  assert.doesNotMatch(pageWxss, /radial-gradient/);
});
