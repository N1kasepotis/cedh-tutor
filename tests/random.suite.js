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

test('random tool page is registered and exposes roll controls', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const pageRoot = path.join(root, 'miniprogram/pages/random');

  assert.ok(appJson.pages.includes('pages/random/random'));
  ['random.js', 'random.wxml', 'random.wxss', 'random.json'].forEach((file) => {
    assert.ok(fs.existsSync(path.join(pageRoot, file)), `${file} should exist`);
  });

  const js = fs.readFileSync(path.join(pageRoot, 'random.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(pageRoot, 'random.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageRoot, 'random.wxss'), 'utf8');
  const randomJson = JSON.parse(fs.readFileSync(path.join(pageRoot, 'random.json'), 'utf8'));
  const { randomConfig } = require('../miniprogram/config/random');

  assert.equal(randomJson.navigationBarTitleText, '\u5c0f\u5de5\u5177');
  assert.equal(randomJson.navigationBarBackgroundColor, '#050505');
  assert.equal(randomJson.navigationBarTextStyle, 'white');
  assert.equal(randomJson.backgroundColor, '#050505');

  assert.doesNotMatch(wxml, /<view class="random-title">随机工具<\/view>/);
  assert.doesNotMatch(wxml, /随机数生成器/);
  assert.match(wxml, /<view class="range-separator">至<\/view>/);
  assert.doesNotMatch(wxml, /<view class="range-separator"><\/view>/);
  // 每个面板都有标题（随机数 / 先手判定 / 贴纸），入口一目了然
  assert.match(wxml, /<view class="panel-title">随机数<\/view>/);
  assert.match(wxml, /<view class="panel-title">先手判定<\/view>/);
  assert.match(wxml, /掷 4 个 D20 骰子/);
  assert.match(wxml, /class="primary-button random-button roll-off-button"[\s\S]*掷 4 个 D20 骰子/);
  assert.doesNotMatch(wxml, /四人20面骰先手/);
  assert.doesNotMatch(wxml, /先手 Roll-off/);
  assert.doesNotMatch(wxml, /RANDOM NUMBER|WHO GOES FIRST|Roll-off|\bD100\b|\bD6\b|\bD2\b/);
  assert.doesNotMatch(wxml, /留一个干净入口/);
  assert.doesNotMatch(wxml, /掷骰、随机效果与先手判定/);
  assert.doesNotMatch(wxml, /投掷、随机效果与先手判定/);
  assert.doesNotMatch(wxml, /random-subtitle/);
  assert.doesNotMatch(wxss, /random-subtitle/);
  assert.doesNotMatch(wxss, /panel-kicker/);
  assert.deepEqual(randomConfig.number.presets.map((preset) => preset.label), ['2面', '6面', '20面', '100面']);
  assert.match(wxml, /bindtap="rollNumber"/);
  assert.match(wxml, /bindtap="rollOff"/);
  assert.match(wxml, /bindinput="changeMin"/);
  assert.match(wxml, /bindinput="changeMax"/);
  assert.match(js, /numberResultLabel:\s*'X'/);
  assert.doesNotMatch(js, /numberResultLabel:\s*'-'/);
  assert.match(js, /rollInteger/);
  assert.match(js, /buildRollOff/);
  // random 的按钮样式由 dark-table 主题的 --cedh-btn-* 变量提供
  const darkTableTheme = fs.readFileSync(path.join(root, 'miniprogram/styles/themes/dark-table.wxss'), 'utf8');
  // 主题文件里两个块（token 覆盖 + 按钮变量）选择器均以 .izzet-page { 收尾，锚定含 btn 变量的那个
  const randomThemeBlock = darkTableTheme.match(/\.izzet-page\s*{[^}]*--cedh-btn[^}]*}/)[0];
  assert.match(randomThemeBlock, /--cedh-btn-primary-bg:\s*var\(--cedh-input-glass\)/);
  assert.match(randomThemeBlock, /--cedh-btn-primary-border:\s*var\(--cedh-hairline\)/);
  assert.match(randomThemeBlock, /--cedh-btn-primary-color:\s*var\(--cedh-text\)/);
  assert.doesNotMatch(randomThemeBlock, /linear-gradient|#5f211b|#9b3a2f|#1c1713/);
});

test('random utils roll closed intervals and resolve roll-off ties', () => {
  const {
    buildRollOff,
    createSequenceRandom,
    rollInteger,
    sanitizeRange,
  } = require('../miniprogram/utils/random');

  assert.deepEqual(sanitizeRange('10', '2'), { min: 2, max: 10 });
  assert.equal(rollInteger(1, 6, () => 0), 1);
  assert.equal(rollInteger(1, 6, () => 0.999999), 6);

  const rollOff = buildRollOff(4, 20, createSequenceRandom([0, 0.25, 0.5, 0.75]));
  assert.deepEqual(rollOff.rolls.map((roll) => roll.value), [1, 6, 11, 16]);
  assert.equal(rollOff.isTie, false);
  assert.equal(rollOff.resultLabel, 'Seat 4 先手');

  const tiedRollOff = buildRollOff(4, 20, createSequenceRandom([0.95, 0.95, 0.1, 0.2]));
  assert.equal(tiedRollOff.isTie, true);
  assert.deepEqual(tiedRollOff.winners.map((winner) => winner.label), ['Seat 1', 'Seat 2']);
  assert.equal(tiedRollOff.resultLabel, 'Seat 1 / Seat 2 并列最高，需要重掷');
});

test('sticker utilities calculate Goblin mana from unique vowels and odds', () => {
  const { stickerSheets } = require('../miniprogram/config/stickers');
  const {
    buildStickerRound,
    calculateStickerOdds,
    countUniqueVowels,
    decorateStickerSheet,
    drawStickerSheets,
    normalizeStickerSheets,
  } = require('../miniprogram/utils/stickers');

  assert.equal(stickerSheets.length, 10);
  assert.deepEqual(stickerSheets[0].words, ['Playable', 'Delusionary', 'Hydra']);
  assert.ok(stickerSheets.every((sheet) => sheet.words.length === 3));
  assert.ok(stickerSheets.every((sheet) => sheet.power == null && sheet.mana == null));
  assert.equal(countUniqueVowels('Delusionary'), 6);
  assert.equal(countUniqueVowels('Hydra'), 2);
  assert.equal(countUniqueVowels('Bamboozle'), 3);
  assert.equal(decorateStickerSheet(stickerSheets[0]).bestWord.vowelCount, 6);

  const draw = drawStickerSheets(stickerSheets, 3, () => 0.3);
  assert.equal(draw.length, 3);
  assert.equal(new Set(draw.map((sheet) => sheet.id)).size, 3);

  const round = buildStickerRound(stickerSheets.slice(0, 3), () => 0);
  assert.equal(round.drawnSheets.length, 3);
  assert.equal(round.best.vowelCount, 6);
  assert.match(round.summary, /^本局最高产出：6 点红色法术力/);

  const odds = calculateStickerOdds(stickerSheets, [6, 5, 4]);
  assert.equal(odds.totalCombos, 120);
  assert.deepEqual(odds.thresholds.map((item) => item.mana), [6, 5, 4]);
  assert.ok(odds.thresholds.every((item) => item.hitCount >= 0 && item.probability >= 0 && item.probability <= 1));

  assert.equal(normalizeStickerSheets([{ name: '', words: ['A', '', 'Y'] }], stickerSheets).length, 1);
  assert.equal(normalizeStickerSheets([], stickerSheets).length, 0);
});

test('random page exposes a trimmed Goblin sticker randomizer', () => {
  const pageRoot = path.join(root, 'miniprogram/pages/random');
  const js = fs.readFileSync(path.join(pageRoot, 'random.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(pageRoot, 'random.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageRoot, 'random.wxss'), 'utf8');

  assert.match(wxml, /_____ Goblin/);
  assert.match(wxml, /_____ Goblin 开局贴纸/);
  assert.doesNotMatch(wxml, /_____ Goblin 开局贴纸随机器/);
  assert.match(wxml, /sticker-panel/);
  assert.match(wxml, /sticker-disclaimer/);
  assert.match(wxml, /本功能不能代替 REL Competitive cEDH 比赛贴纸/);
  assert.doesNotMatch(wxml, /REL-Competitive|对局前贴纸抽取/);
  assert.match(wxml, /bindtap="drawStickers"/);
  assert.doesNotMatch(wxml, /本局结论|sticker-summary-label/);
  assert.doesNotMatch(wxml, /bindtap="redrawStickers"|重抽|sticker-redraw-button/);
  assert.doesNotMatch(wxml, /bindinput="changeStickerSheetName"/);
  assert.doesNotMatch(wxml, /bindinput="changeStickerWord"/);
  assert.doesNotMatch(wxml, /bindtap="addStickerSheet"/);
  assert.doesNotMatch(wxml, /bindtap="deleteStickerSheet"/);
  assert.doesNotMatch(wxml, /sticker-editor|sticker-edit-card|sticker-name-input|sticker-word-input/);
  assert.doesNotMatch(wxml, /sticker-odds|stickerOdd|stickerOdds|probabilityLabel/);
  assert.match(wxml, /wx:if="\{\{stickerRound.drawnSheets.length\}\}"/);
  assert.match(wxml, /class="sticker-word \{\{word.isBest \? 'best' : ''\}\}"/);
  assert.match(wxml, /来自 \{\{stickerRound\.best\.sheetName\}\}/);
  assert.doesNotMatch(wxml, /stickerRound\.best\.sheetName\}\}\s*\/\s*\{\{stickerRound\.best\.word/);
  assert.match(js, /readStorage\(stickerStorageKey/);
  assert.match(js, /writeStorage\(stickerStorageKey/);
  assert.match(js, /buildStickerRound/);
  assert.doesNotMatch(js, /calculateStickerOdds/);
  assert.match(js, /canDrawStickers/);
  assert.doesNotMatch(js, /changeStickerSheetName|changeStickerWord|addStickerSheet|deleteStickerSheet|redrawStickers|createBlankStickerSheet/);
  assert.doesNotMatch(wxss, /sticker-editor|sticker-redraw-button|sticker-name-input|sticker-word-input|sticker-odds|sticker-odd-cell/);
  assert.match(wxss, /\.sticker-power\s*{[^}]*font-size:\s*var\(--cedh-text-18\)/);
  assert.doesNotMatch(wxss, /\.sticker-power\s*{[^}]*font-size:\s*var\(--cedh-text-20\)/);
  assert.match(wxss, /\.sticker-disclaimer\s*{[\s\S]*color:\s*rgba\(255,\s*254,\s*250,\s*0\.38\)/);
  assert.match(wxss, /\.sticker-disclaimer\s*{[\s\S]*font-size:\s*var\(--cedh-text-10\)/);
  assert.match(wxss, /\.sticker-disclaimer\s*{[\s\S]*text-align:\s*left/);
  // 主题变量收拢在 styles/themes/dark-table.wxss（tracker / random / playtest 共用）
  const darkTable = fs.readFileSync(path.join(root, 'miniprogram/styles/themes/dark-table.wxss'), 'utf8');
  assert.match(wxss, /@import "\.\.\/\.\.\/styles\/themes\/dark-table\.wxss"/);
  assert.match(darkTable, /\.random\s*{[\s\S]*?--module-accent-rgb:\s*190,\s*112,\s*158[\s\S]*?--cedh-accent:\s*#be709e/);
  assert.match(wxml, /tool-entry-cabbage/);
  assert.match(wxml, /tool-entry-izzet/);
  assert.match(wxss, /\.tool-entry-cabbage\s*{[\s\S]*?--tool-entry-rgb:\s*47,\s*167,\s*93/);
  assert.match(wxss, /\.tool-entry-izzet\s*{[\s\S]*?--tool-entry-rgb:\s*90,\s*169,\s*255/);
  assert.match(darkTable, /\.izzet-page\s*{[\s\S]*?linear-gradient\(180deg,\s*#070707/);
  assert.doesNotMatch(wxss, /radial-gradient/);
  assert.match(darkTable, /\.izzet-page\s*{[\s\S]*?--cedh-surface:\s*rgba\(255,\s*249,\s*224,\s*0\.08\)/);
  assert.match(wxss, /\.sticker-word\.best\s*{[\s\S]*var\(--cedh-accent\)/);
});
