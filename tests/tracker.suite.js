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

test('tracker page is registered and exposes commander record controls', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const pageRoot = path.join(root, 'miniprogram/pages/tracker');

  assert.ok(appJson.pages.includes('pages/tracker/tracker'));
  ['tracker.js', 'tracker.wxml', 'tracker.wxss', 'tracker.json'].forEach((file) => {
    assert.ok(fs.existsSync(path.join(pageRoot, file)), `${file} should exist`);
  });

  const js = fs.readFileSync(path.join(pageRoot, 'tracker.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(pageRoot, 'tracker.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageRoot, 'tracker.wxss'), 'utf8');
  const pageJson = JSON.parse(fs.readFileSync(path.join(pageRoot, 'tracker.json'), 'utf8'));

  assert.match(js, /readStorage\(trackerConfig\.storageKey/);
  assert.match(js, /writeStorage\(trackerConfig\.storageKey/);
  assert.match(js, /buildTrackerExportText/);
  assert.match(js, /formatCommanderDisplayLines\(deck\.commander\.name,\s*\{ abbreviatePartners: false \}\)/);
  assert.match(js, /longestDisplayLineLength/);
  assert.match(js, /commanderNameClass/);
  assert.match(js, /maxDecks/);
  assert.match(wxml, /指挥官战情室/);
  assert.doesNotMatch(wxml, /<view class="tracker-title">我的指挥官<\/view>/);
  assert.equal(pageJson.navigationBarTitleText, '指挥官战情室');
  assert.equal(pageJson.navigationBarBackgroundColor, '#050505');
  assert.equal(pageJson.navigationBarTextStyle, 'white');
  assert.equal(pageJson.backgroundColor, '#050505');
  assert.doesNotMatch(wxml, /class="tracker-head"/);
  assert.doesNotMatch(wxml, /class="tracker-title"/);
  assert.doesNotMatch(wxml, /class="tracker-subtitle"/);
  assert.doesNotMatch(wxml, /class="deck-count"/);
  assert.match(wxml, /bindinput="handleCommanderInput"/);
  assert.match(wxml, /placeholder="输入指挥官名称，如 Yuriko"/);
  assert.doesNotMatch(wxml, /placeholder="输入指挥官名称，如 Kinnan"/);
  assert.match(wxml, /class="selector-block"\s+wx:if="{{!item\.commander}}"/);
  assert.match(wxml, /wx:for="{{decks}}"/);
  assert.match(wxml, /wx:for="{{item\.displayLines}}"/);
  assert.match(wxml, /class="deck-name \{\{item\.commanderNameClass\}\}"/);
  assert.match(wxml, /class="deck-name-line"/);
  assert.match(wxml, /mode="date"/);
  assert.match(wxml, /胜/);
  assert.match(wxml, /负/);
  assert.match(wxml, /平/);
  assert.match(wxml, /bindchange="changePendingResultPicker"/);
  assert.match(wxml, /bindchange="changePendingSeatPicker"/);
  assert.match(wxml, /resultOptions/);
  assert.match(wxml, /seatOptions/);
  assert.match(wxml, /winrateChart/);
  assert.match(wxml, /seatWinrateChart/);
  assert.doesNotMatch(wxml, /botanical|flower-|sprig-/);
  assert.doesNotMatch(wxml, /frequencyChart/);
  assert.doesNotMatch(wxml, /周度游玩频率/);
  assert.doesNotMatch(js, /frequencyChart/);
  assert.doesNotMatch(js, /buildFrequencySeries/);
  assert.match(wxml, /每日胜率/);
  assert.match(wxml, /轮次胜率/);
  assert.doesNotMatch(wxml, /<view class="chart-title">游玩频率<\/view>/);
  assert.doesNotMatch(wxml, /<view class="chart-title">座位胜率<\/view>/);
  assert.match(wxml, /复制战绩文本/);
  assert.match(wxml, /清空数据/);
  assert.match(js, /changePendingResultPicker/);
  assert.match(js, /changePendingSeatPicker/);
  assert.match(js, /pendingResult/);
  assert.match(js, /pendingSeat/);
  assert.match(wxml, /class="match-row"[\s\S]*bindlongpress="confirmDeleteMatch"/);
  assert.match(wxml, /wx:for="{{item\.visibleMatches}}"/);
  assert.match(wxml, /bindtap="toggleMatchHistory"/);
  assert.match(wxml, /bindtap="editMatch"/);
  assert.match(wxml, /class="match-action match-edit"/);
  assert.match(wxml, /class="match-action match-delete"/);
  assert.match(wxml, /class="commander-avatar"/);
  const commanderAvatarsStyle = wxss.match(/\.commander-avatars\s*{[\s\S]*?\n}/)?.[0] || '';
  const commanderAvatarStyle = wxss.match(/\.commander-avatar\s*{[\s\S]*?\n}/)?.[0] || '';
  assert.match(commanderAvatarsStyle, /gap:\s*12rpx/);
  assert.doesNotMatch(commanderAvatarStyle, /margin-left:\s*-/);
  assert.match(js, /splitCommanderNames/);
  assert.match(js, /buildScryfallImageUrl/);
  assert.match(js, /confirmDeleteMatch\(event\)/);
  assert.match(js, /wx\.showModal\(\{[\s\S]*title:\s*'取消对局'/);
  assert.match(js, /confirmText:\s*'删除对局'/);
  assert.doesNotMatch(js, /confirmText:\s*'取消记录'/);
  assert.match(js, /removeMatch\(deckId,\s*matchId\)/);
  assert.match(wxml, /class="text-button deck-delete-button"/);
  assert.match(wxml, /bindtap="deleteDeck"/);
  const exportBlock = js.slice(
    js.indexOf('exportData()'),
    js.indexOf('clearData()'),
  );
  assert.match(exportBlock, /buildTrackerExportText/);
  assert.doesNotMatch(exportBlock, /JSON\.stringify/);

  // 主题变量收拢在 styles/themes/dark-table.wxss（tracker / random / playtest 共用）
  const darkTableTheme = fs.readFileSync(path.join(root, 'miniprogram/styles/themes/dark-table.wxss'), 'utf8');
  const sharedThemeBlock = darkTableTheme.match(/\.izzet-page\s*{[\s\S]*?\n}/)[0];
  assert.match(wxss, /@import "\.\.\/\.\.\/styles\/themes\/dark-table\.wxss"/);
  assert.match(sharedThemeBlock, /linear-gradient\(180deg,\s*#070707/);
  assert.match(sharedThemeBlock, /--cedh-surface:\s*rgba\(255,\s*249,\s*224,\s*0\.08\)/);
  assert.match(sharedThemeBlock, /--cedh-accent:\s*#b24536/);
  assert.match(darkTableTheme, /\.tracker\s*{[\s\S]*?--module-accent-rgb:\s*205,\s*183,\s*116[\s\S]*?--cedh-accent:\s*#cdb774/);
  assert.doesNotMatch(sharedThemeBlock, /radial-gradient/);
  assert.doesNotMatch(darkTableTheme, /#fbfff1|#f3fad7|#eaf6c2/);
  assert.match(wxss, /\.deck-card\s*{[\s\S]*position:\s*relative/);
  assert.match(wxss, /\.deck-name-line\s*{[\s\S]*display:\s*block/);
  assert.match(wxss, /\.deck-card-head\s*{[\s\S]*?align-items:\s*center/);
  assert.match(wxss, /\.deck-name-line\s*{[\s\S]*?white-space:\s*nowrap/);
  assert.match(wxss, /\.deck-name\.partner\s*{[\s\S]*?font-size:\s*28rpx/);
  assert.match(wxss, /\.deck-name\.name-tight\s*{[\s\S]*?font-size:\s*24rpx/);
  assert.doesNotMatch(wxss, /botanical|flower-|sprig-|\.chart-section::before|\.chart-section::after/);
  assert.match(wxss, /\.deck-delete-button\s*{[\s\S]*position:\s*absolute/);
  assert.match(wxss, /\.deck-delete-button\s*{[\s\S]*right:\s*var\(--cedh-space-4\)/);
  assert.match(wxss, /\.deck-delete-button\s*{[\s\S]*top:\s*var\(--cedh-space-4\)/);
  assert.match(wxss, /\.deck-delete-button\s*{[\s\S]*color:\s*var\(--cedh-danger\)/);
});

test('tracker record pickers stay inside the mobile grid', () => {
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.wxss'), 'utf8');
  const selectorGroup = wxml.slice(
    wxml.indexOf('<view class="record-row record-selectors">'),
    wxml.indexOf('<view class="record-actions">'),
  );

  assert.match(selectorGroup, /mode="date"/);
  assert.match(selectorGroup, /mode="selector"[\s\S]*range="{{seatOptions}}"/);
  assert.match(selectorGroup, /mode="selector"[\s\S]*range="{{resultOptions}}"/);
  assert.match(selectorGroup, /bindchange="changePendingSeatPicker"/);
  assert.match(selectorGroup, /bindchange="changePendingResultPicker"/);
  assert.match(wxss, /\.record-selectors\s*{[\s\S]*grid-template-columns:\s*minmax\(0,/);
  assert.match(wxss, /\.record-selectors\s*{[\s\S]*min-width:\s*0/);
  assert.match(wxss, /\.record-select\s*{[\s\S]*box-sizing:\s*border-box/);
  assert.match(wxss, /\.record-select\s*{[\s\S]*width:\s*100%/);
});

test('tracker result and seat controls use semantic color classes', () => {
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.wxss'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.js'), 'utf8');
  const chartJs = fs.readFileSync(path.join(root, 'miniprogram/utils/tracker-charts.js'), 'utf8');

  assert.match(wxml, /class="record-select \{\{item\.pendingResult\}\}"/);
  assert.match(wxml, /class="record-select \{\{item\.pendingSeat\}\}"/);
  assert.match(wxml, /class="match-seat \{\{match\.seatClass\}\}"/);
  assert.match(wxml, /class="match-result \{\{match\.result\}\}"/);
  assert.match(js, /seatClass:\s*match\.seat \|\| 'seat-unknown'/);
  assert.match(chartJs, /seatBarColors/);
  const seatBarColorsBlock = chartJs.slice(
    chartJs.indexOf('seatBarColors'),
    chartJs.indexOf('emptyBar'),
  );
  assert.match(seatBarColorsBlock, /rgba\(58,\s*128,\s*64/);
  assert.match(seatBarColorsBlock, /rgba\(214,\s*185,\s*61/);
  assert.doesNotMatch(seatBarColorsBlock, /rgba\(113,\s*103,\s*94/);
  // 座位/结果调色板定义在 dark-table 主题文件里
  const seatTheme = fs.readFileSync(path.join(root, 'miniprogram/styles/themes/dark-table.wxss'), 'utf8');
  assert.match(seatTheme, /--tracker-seat-leaf-1/);
  assert.match(seatTheme, /--tracker-seat-leaf-solid-1:\s*#3a8040/);
  assert.match(seatTheme, /--tracker-seat-leaf-solid-2:\s*#589e42/);
  assert.match(seatTheme, /--tracker-seat-leaf-solid-3:\s*#97b844/);
  assert.match(seatTheme, /--tracker-seat-leaf-solid-4:\s*#d6b93d/);
  assert.doesNotMatch(seatTheme, /--tracker-seat-blue/);
  assert.doesNotMatch(seatTheme, /--tracker-seat-gray/);
  assert.doesNotMatch(seatTheme, /--tracker-seat-1:\s*rgba\(177,\s*82,\s*72/);

  ['win', 'loss', 'draw'].forEach((result) => {
    assert.match(wxss, new RegExp(`\\.record-select\\.${result}\\s*{[\\s\\S]*background:`));
    assert.match(wxss, new RegExp(`\\.match-result\\.${result}\\s*{[\\s\\S]*color:`));
  });

  ['seat1', 'seat2', 'seat3', 'seat4'].forEach((seat) => {
    assert.match(wxss, new RegExp(`\\.record-select\\.${seat}\\s*{[\\s\\S]*background:`));
    assert.match(wxss, new RegExp(`\\.match-seat\\.${seat}\\s*{[\\s\\S]*color:`));
    assert.match(wxss, new RegExp(`\\.match-seat\\.${seat}\\s*{[\\s\\S]*background:\\s*var\\(--tracker-seat-leaf-`));
  });
});

test('tracker commander input and debug actions stay inside mobile width', () => {
  const appWxss = fs.readFileSync(path.join(root, 'miniprogram/app.wxss'), 'utf8');
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.wxss'), 'utf8');
  const debugActions = wxml.slice(
    wxml.indexOf('<view class="debug-actions">'),
    wxml.indexOf('</view>\n  </view>\n</view>'),
  );

  assert.match(appWxss, /input,\s*textarea[\s\S]*box-sizing:\s*border-box/);
  assert.match(wxss, /\.commander-input\s*{[\s\S]*box-sizing:\s*border-box/);
  assert.match(wxss, /\.commander-input\s*{[\s\S]*min-width:\s*0/);
  assert.doesNotMatch(debugActions, /<button\b/);
  assert.match(debugActions, /class="secondary-button debug-action-button"/);
  assert.match(wxss, /\.debug-actions\s*{[\s\S]*display:\s*flex/);
  assert.match(wxss, /\.debug-action-button\s*{[\s\S]*flex:\s*1 1 0/);
  assert.match(wxss, /\.debug-action-button\s*{[\s\S]*min-width:\s*0/);
  assert.match(wxss, /\.record-select\s*{[\s\S]*background:\s*var\(--cedh-input-glass\)/);
  assert.match(wxss, /\.record-select\s*{[\s\S]*border:\s*var\(--cedh-hairline\)/);
  assert.match(wxss, /page\s*{[\s\S]*overflow-x:\s*hidden/);
  const trackerGlassActionBlock = wxss.match(
    /\.tracker \.add-match-button,[\s\S]*?\.tracker \.debug-action-button\s*{[\s\S]*?\n}/,
  )[0];
  assert.match(trackerGlassActionBlock, /\.tracker \.add-match-button/);
  assert.match(trackerGlassActionBlock, /\.tracker \.add-deck-button/);
  assert.match(trackerGlassActionBlock, /\.tracker \.debug-action-button/);
  assert.match(trackerGlassActionBlock, /background:\s*var\(--cedh-input-glass\)/);
  assert.match(trackerGlassActionBlock, /border:\s*var\(--cedh-hairline\)/);
  assert.match(trackerGlassActionBlock, /color:\s*var\(--cedh-text\)/);
});

test('tracker empty chart label is centered in the canvas', () => {
  const chartJs = fs.readFileSync(path.join(root, 'miniprogram/utils/tracker-charts.js'), 'utf8');
  const emptyStateBlock = chartJs.slice(
    chartJs.indexOf("if (!series || !series.length)"),
    chartJs.indexOf('const values = type ==='),
  );

  assert.match(emptyStateBlock, /ctx\.textAlign\s*=\s*'center'/);
  assert.match(emptyStateBlock, /ctx\.textBaseline\s*=\s*'middle'/);
  assert.match(emptyStateBlock, /ctx\.fillText\('\\u6682\\u65e0\\u8bb0\\u5f55',\s*width \/ 2,\s*height \/ 2\)/);
});

test('tracker stats keep draws separate and build chart series', () => {
  const configPath = path.join(root, 'miniprogram/config/tracker.js');
  const utilsPath = path.join(root, 'miniprogram/utils/tracker.js');

  assert.ok(fs.existsSync(configPath), 'tracker config should exist');
  assert.ok(fs.existsSync(utilsPath), 'tracker utils should exist');

  const { trackerConfig } = require(configPath);
  const {
    buildTrackerExportText,
    buildFrequencySeries,
    buildSeatWinRateSeries,
    buildWinRateSeries,
    calculateDeckStats,
    createEmptyDeck,
    filterCommanders,
    normalizeTrackerData,
    serializeTrackerData,
  } = require(utilsPath);

  assert.equal(trackerConfig.storageKey, 'commanderTrackerData');
  assert.equal(trackerConfig.maxDecks, 5);
  assert.deepEqual(trackerConfig.resultOptions.map((option) => option.id), ['win', 'loss', 'draw']);
  assert.deepEqual(trackerConfig.seatOptions.map((option) => option.label), ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4']);
  assert.equal(trackerConfig.stats.drawsCountForWinRate, false);
  assert.equal(trackerConfig.stats.frequencyBucket, 'week');

  const deck = {
    id: 'deck-1',
    commander: { name: 'Test Commander' },
    matches: [
      { id: 'm1', date: '2026-06-03', result: 'win' },
      { id: 'm2', date: '2026-06-01', result: 'loss', seat: 'seat1' },
      { id: 'm3', date: '2026-06-15', result: 'draw', seat: 'seat2' },
      { id: 'm4', date: '2026-06-16', result: 'win', seat: 'seat2' },
      { id: 'm5', date: '2026-06-20', result: 'loss', seat: 'seat2' },
      { id: 'm6', date: '2026-06-21', result: 'win', seat: 'seat4' },
    ],
  };

  const stats = calculateDeckStats(deck, trackerConfig.stats);
  assert.deepEqual(
    {
      total: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      draws: stats.draws,
      winRateLabel: stats.winRateLabel,
    },
    { total: 6, wins: 3, losses: 2, draws: 1, winRateLabel: '60.0%' },
  );

  assert.deepEqual(
    buildWinRateSeries(deck.matches, trackerConfig.stats).map((point) => point.rateLabel),
    ['0.0%', '100.0%', '0.0%', '100.0%', '0.0%', '100.0%'],
  );
  assert.deepEqual(
    buildWinRateSeries([
      { id: 'daily-1', date: '2026-07-01', result: 'win' },
      { id: 'daily-2', date: '2026-07-01', result: 'loss' },
      { id: 'daily-3', date: '2026-07-02', result: 'win' },
    ], trackerConfig.stats).map(({ date, label, rateLabel, sampleSize }) => ({ date, label, rateLabel, sampleSize })),
    [
      { date: '2026-07-01', label: '07-01', rateLabel: '50.0%', sampleSize: 2 },
      { date: '2026-07-02', label: '07-02', rateLabel: '100.0%', sampleSize: 1 },
    ],
  );
  assert.deepEqual(
    buildFrequencySeries(deck.matches, trackerConfig.stats),
    [
      { label: '2026-W23', count: 2 },
      { label: '2026-W25', count: 4 },
    ],
  );
  assert.deepEqual(
    buildSeatWinRateSeries(deck.matches, trackerConfig.stats).map((seat) => ({
      seat: seat.seat,
      label: seat.label,
      rateLabel: seat.rateLabel,
      sampleSize: seat.sampleSize,
    })),
    [
      { seat: 'seat1', label: 'Seat 1', rateLabel: '0.0%', sampleSize: 1 },
      { seat: 'seat2', label: 'Seat 2', rateLabel: '50.0%', sampleSize: 2 },
      { seat: 'seat3', label: 'Seat 3', rateLabel: '0.0%', sampleSize: 0 },
      { seat: 'seat4', label: 'Seat 4', rateLabel: '100.0%', sampleSize: 1 },
    ],
  );

  const exportText = buildTrackerExportText({
    version: 1,
    decks: [deck],
  }, trackerConfig.stats);
  assert.match(exportText, /cEDH 导师战绩/);
  assert.match(exportText, /1\. Test Commander/);
  assert.match(exportText, /总场次：6/);
  assert.match(exportText, /胜率：60\.0%/);
  assert.match(exportText, /战绩：3胜 \/ 2负 \/ 1平/);
  assert.match(exportText, /2026-06-01 ｜ 负 ｜ Seat 1/);
  assert.match(exportText, /2026-06-03 ｜ 胜 ｜ 座位未知/);
  assert.doesNotMatch(exportText, /"matches"|\"result\"|\{|\}/);

  assert.equal(createEmptyDeck(0).matches.length, 0);
  assert.equal(createEmptyDeck(0).pendingResult, 'win');
  assert.equal(createEmptyDeck(0).pendingSeat, 'seat1');

  const normalized = normalizeTrackerData({
    decks: [{ id: 'old', matches: [{ id: 'old-1', date: '2026-06-01', result: 'win' }] }],
  }, commanders, trackerConfig);
  assert.equal(normalized.decks.length, 1);
  assert.equal(normalized.decks[0].matches[0].seat, null);
  assert.equal(normalized.decks[0].matches[0].seatLabel, '座位未知');

  const serialized = serializeTrackerData({
    version: 1,
    decks: [{
      id: 'seat-save',
      commander: null,
      matches: [{ id: 'seat-save-1', date: '2026-06-28', result: 'loss', seat: 'seat3' }],
    }],
  });
  assert.equal(serialized.decks[0].matches[0].seat, 'seat3');

  assert.ok(filterCommanders(commanders, 'tym kra', 5).some((commander) => commander.name.includes('Tymna')));
});

test('tracker chart drawing is isolated from page state', () => {
  const chartUtilPath = path.join(root, 'miniprogram/utils/tracker-charts.js');
  assert.ok(fs.existsSync(chartUtilPath), 'tracker chart utility should exist');

  const pageJs = fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.js'), 'utf8');
  const chartJs = fs.readFileSync(chartUtilPath, 'utf8');
  const {
    CHART_CONFIG,
    CHART_COLORS,
    getWinRateViewport,
  } = require(chartUtilPath);

  assert.match(pageJs, /require\('\.\.\/\.\.\/utils\/tracker-charts'\)/);
  assert.match(pageJs, /paintChart\(ctx,\s*width,\s*height,\s*series,\s*type\)/);
  assert.doesNotMatch(pageJs, /paintSeatWinrateChart\(ctx,/);
  assert.match(chartJs, /function paintChart\(ctx,\s*width,\s*height,\s*series,\s*type\)/);
  assert.match(chartJs, /function paintSeatWinrateChart\(ctx,\s*width,\s*height,\s*series\)/);
  assert.match(chartJs, /function getWinRateViewport\(values\)/);
  assert.equal(CHART_COLORS.accent, '#2FA75D');
  assert.equal(CHART_COLORS.winrateInk, '#F2D0A2');
  assert.match(chartJs, /type === 'winrate' \? CHART_COLORS\.winrateInk : CHART_COLORS\.accent/);
  assert.equal(CHART_CONFIG.winrateMinVisibleRange, 0.32);
  const zoomedViewport = getWinRateViewport([0.5, 0.6]);
  assert.ok(Math.abs(zoomedViewport.min - 0.39) < 0.001);
  assert.ok(Math.abs(zoomedViewport.max - 0.71) < 0.001);
  assert.ok(getWinRateViewport([0, 0.5, 0.667]).max < 1, 'winrate viewport should zoom in when data allows');
});

test('tracker coalesces chart redraws and caps expanded history nodes', () => {
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/tracker/tracker.wxml'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'miniprogram/config/tracker.js'), 'utf8');

  assert.match(js, /buildChartSignature/);
  assert.match(js, /if \(!this\.pageActive \|\| this\.chartDrawTimer\) return/);
  assert.match(js, /clearChartDrawTimer\(\)/);
  assert.match(js, /newestMatches\.slice\(0, historyRenderLimit\)/);
  assert.match(config, /historyRenderLimit:\s*50/);
  assert.match(wxml, /\{\{item\.historyToggleLabel\}\}/);
});

// 主将头像此前按名取图，打的是 api.scryfall.com/cards/named?format=image——
// 那是 API 端点不是 CDN，每张先查表再回 302，等于两次建连。
// 最多 5 副牌 × 2 位拍档，一次批量解析就能全换成直连。
test('主将头像优先用 CDN 直链，解析不到才按名回落', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const js = fs.readFileSync(
    path.join(__dirname, '..', 'miniprogram/pages/tracker/tracker.js'), 'utf8',
  );

  assert.match(js, /getCardArt\(name, 'artCrop'\) \|\| buildScryfallImageUrl\(name, 'art_crop'\)/,
    '取图必须先查直链、查不到再按名取，顺序不能反');
  assert.match(js, /prefetchCardArt\(names\)\.then\(/, '读到牌组后必须批量预解析头像');

  // 微信的 image 换了 src 会重新下载同一张图，所以只在确实解析到直链时才重渲染，
  // 不能无条件重刷——那等于把每张头像都下载两次
  assert.match(js, /if \(this\.pageActive && names\.some\(\(name\) => getCardArt\(name, 'artCrop'\)\)\)/,
    '只有在真的解析到直链时才重渲染，否则白白重下一遍');
});
