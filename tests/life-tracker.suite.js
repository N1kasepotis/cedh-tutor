const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const miniRoot = path.join(root, 'miniprogram');
const pagePath = 'pages/life-tracker/life-tracker';
const pageRoot = path.join(miniRoot, pagePath);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readPage(extension) {
  return fs.readFileSync(`${pageRoot}.${extension}`, 'utf8');
}

function getLifeTrackerUtils() {
  return require('../miniprogram/utils/life-tracker');
}

function getExport(module, names, label) {
  const found = names.find((name) => typeof module[name] === 'function');
  assert.ok(found, `${label} should be exported as one of: ${names.join(', ')}`);
  return module[found];
}

function playersFrom(result, fallback) {
  if (result && Array.isArray(result.players)) return result.players;
  if (Array.isArray(result)) return result;
  if (fallback && Array.isArray(fallback.players)) return fallback.players;
  return [];
}

test('life tracker page is registered as a complete standalone page', () => {
  const appJson = JSON.parse(read('miniprogram/app.json'));

  assert.ok(appJson.pages.includes(pagePath));
  ['js', 'json', 'wxml', 'wxss'].forEach((extension) => {
    assert.ok(fs.existsSync(`${pageRoot}.${extension}`), `life-tracker.${extension} should exist`);
  });
});

test('home exposes the Life Tracker as the fifth unified index entry', () => {
  const wxml = read('miniprogram/pages/index/index.wxml');
  const js = read('miniprogram/pages/index/index.js');
  const wxss = read('miniprogram/pages/index/index.wxss');

  assert.match(wxml, /class="home-button home-button-life"[^>]*bindtap="goLifeTracker"/);
  assert.match(wxml, /血量记录/);
  assert.match(wxml, /LIFE COUNTER/);
  assert.match(wxml, /home-button-life[^>]*>[\s\S]*?home-button-index">05<\/text>/);
  assert.match(js, /goLifeTracker\(\)\s*{[\s\S]*?navigateTo\([\s\S]*?\/pages\/life-tracker\/life-tracker/);
  assert.doesNotMatch(wxss, /--home-accent|\.home-button-life\s*{/);
  assert.match(wxss, /\.home-index-active\s*{[\s\S]*background:\s*#0A0A0A/);
});

test('life tracker requests landscape and renders a full-screen two-by-two cross layout', () => {
  const pageJson = JSON.parse(readPage('json'));
  const wxml = readPage('wxml');
  const wxss = readPage('wxss');

  assert.equal(pageJson.pageOrientation, 'landscape');
  assert.match(wxml, /class="[^"]*life-tracker-page[^"]*"/);
  assert.match(wxml, /wx:for="\{\{players\}\}"/);
  assert.match(wxml, /class="[^"]*player-zone[^"}]*\{\{item\.orientationClass\}\}/);
  assert.match(wxss, /\.life-tracker-page\s*{[\s\S]*?(?:width:\s*100vw|inset:\s*0)[\s\S]*?(?:height|min-height):\s*100vh/);
  assert.match(wxss, /\.life-grid\s*{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*repeat\(2,\s*1fr\)[\s\S]*grid-template-rows:\s*repeat\(2,\s*1fr\)/);
  assert.match(wxss, /\.life-grid::before,[\s\S]*\.life-grid::after/);
});

test('new games contain four uniquely colored named players at 40 life', () => {
  const lifeTracker = getLifeTrackerUtils();
  const createGame = getExport(
    lifeTracker,
    ['createLifeTrackerState', 'createInitialGame', 'createGameState'],
    'initial game factory',
  );
  const state = createGame({ rng: () => 0.25 });
  const players = playersFrom(state);

  assert.equal(players.length, 4);
  assert.deepEqual(players.map((player) => player.life), [40, 40, 40, 40]);
  assert.deepEqual(players.map((player) => player.name), ['玩家 1', '玩家 2', '玩家 3', '玩家 4']);
  assert.equal(new Set(players.map((player) => player.colorKey)).size, 4);
});

test('life tracker supports two and three player modes with adaptive layout', () => {
  const lifeTracker = getLifeTrackerUtils();
  const {
    createLifeTrackerState,
    setLifeTrackerPlayerCount,
    isLifeTrackerState,
  } = lifeTracker;

  const duel = createLifeTrackerState({ rng: () => 0.25, playerCount: 2 });
  assert.equal(duel.playerCount, 2);
  assert.equal(duel.players.length, 2);
  assert.deepEqual(duel.players.map((player) => player.life), [20, 20], '两人对决按 1v1 惯例 20 点起始');
  assert.equal(new Set(duel.players.map((player) => player.colorKey)).size, 2);
  assert.ok(isLifeTrackerState(duel));

  const trio = setLifeTrackerPlayerCount(duel, 3, () => 0.5);
  assert.equal(trio.playerCount, 3);
  assert.deepEqual(trio.players.map((player) => player.life), [40, 40, 40], '多人模式保持 40 点');
  const backToDuel = setLifeTrackerPlayerCount(trio, 2, () => 0.5);
  assert.deepEqual(backToDuel.players.map((player) => player.life), [20, 20], '切回两人自动回到 20 点');
  assert.deepEqual(
    trio.players.slice(0, 2).map((player) => player.name),
    duel.players.map((player) => player.name),
    '切换人数应按序保留已有座位名',
  );
  assert.ok(isLifeTrackerState(trio));

  const legacy = { players: createLifeTrackerState({ rng: () => 0.25 }).players };
  assert.ok(isLifeTrackerState(legacy), '旧版无 playerCount 的四人存档仍应有效');
  assert.equal(isLifeTrackerState({ playerCount: 3, players: legacy.players }), false);
  assert.equal(createLifeTrackerState({ playerCount: 9 }).players.length, 4, '非法人数回退默认四人');

  const wxml = readPage('wxml');
  const wxss = readPage('wxss');
  const js = readPage('js');
  assert.match(wxml, /class="life-grid mode-\{\{playerCount\}\}/);
  assert.match(wxml, /wx:for="\{\{playerCountOptions\}\}"[\s\S]*?bindtap="setPlayerMode"/);
  assert.match(wxml, /hub-mode \{\{item === playerCount \? 'hub-mode-active' : ''\}\}/);
  assert.match(js, /setPlayerMode\(event\)\s*{[\s\S]*setLifeTrackerPlayerCount/);
  assert.match(js, /playerCountOptions:\s*lifeTrackerConfig\.playerCountOptions/);
  assert.match(js, /playerCount === 4 \? 2 : 1/);
  assert.match(wxss, /\.life-grid\.mode-2\s*{[^}]*grid-template-columns:\s*1fr/);
  assert.match(wxss, /\.life-grid\.mode-2::after\s*{[^}]*display:\s*none/);
  assert.match(wxss, /\.life-grid\.mode-3 \.player-zone\.seat-1\s*{[^}]*grid-column:\s*1 \/ -1/);
  assert.match(wxss, /\.life-grid\.mode-3::after\s*{[^}]*top:\s*50%[^}]*height:\s*50%/);
  assert.match(wxss, /\.hub-mode-active\s*{[^}]*border-color/);
});

test('player values reuse cEDHDisplay with a thin color-aware double outline', () => {
  const js = readPage('js');
  const wxml = readPage('wxml');
  const wxss = readPage('wxss');

  assert.match(js, /titleFontBase64/);
  assert.match(js, /wx\.loadFontFace/);
  assert.match(js, /family:\s*'cEDHDisplay'/);
  assert.match(wxml, /class="[^"]*life-value[^"]*"[^>]*>\{\{item\.life\}\}/);

  const lifeValueBlock = wxss.match(/\.life-value\s*{[\s\S]*?\n}/);
  assert.ok(lifeValueBlock, 'life-value styles should exist');
  assert.match(lifeValueBlock[0], /font-family:\s*"cEDHDisplay"/);
  assert.match(lifeValueBlock[0], /font-size:\s*(?:clamp\(|[1-9]\d*(?:rpx|vw|vh))/);
  assert.match(lifeValueBlock[0], /text-shadow:[\s\S]*var\(--player-color[\s\S]*,[\s\S]*var\(--player-color/);
  assert.doesNotMatch(wxml, /<input\b|player-name|玩家\s*\{\{|＋1|−1|\+1|-1<\/text>/);
});

test('life adjustment is clamped to -999..999 and each half exposes press-and-hold hooks', () => {
  const lifeTracker = getLifeTrackerUtils();
  const createGame = getExport(
    lifeTracker,
    ['createLifeTrackerState', 'createInitialGame', 'createGameState'],
    'initial game factory',
  );
  const adjustLife = getExport(
    lifeTracker,
    ['adjustPlayerLife', 'changePlayerLife', 'updatePlayerLife'],
    'life adjustment function',
  );
  const initial = createGame({ rng: () => 0.25 });
  const raised = adjustLife(initial, 1, 5000);
  const raisedPlayers = playersFrom(raised, initial);
  assert.equal(raisedPlayers[0].life, 999);
  const lowered = adjustLife(raised || initial, 1, -5000);
  const loweredPlayers = playersFrom(lowered, raised || initial);
  assert.equal(loweredPlayers[0].life, -999);

  const wxml = readPage('wxml');
  const js = readPage('js');
  assert.match(wxml, /class="[^"]*life-hit-area[^"]*life-(?:increase|plus)[^"]*"[\s\S]*?data-delta="1"/);
  assert.match(wxml, /class="[^"]*life-hit-area[^"]*life-(?:decrease|minus)[^"]*"[\s\S]*?data-delta="-1"/);
  assert.match(wxml, /(?:bind|catch)touchstart="[^"]+"/);
  assert.match(wxml, /(?:bind|catch)touchend="[^"]+"/);
  assert.match(wxml, /(?:bind|catch)touchcancel="[^"]+"/);
  assert.match(js, /setTimeout|setInterval/);
  assert.match(js, /clearTimeout|clearInterval/);
  assert.match(js, /(?:LONG_PRESS|longPress|holdDelay)/);
  assert.match(js, /(?:ACCELERAT|accelerat|holdInterval|repeatInterval)/);
});

test('game state persists across backgrounding and reset restores 40 with randomized unique colors', () => {
  const lifeTracker = getLifeTrackerUtils();
  const createGame = getExport(
    lifeTracker,
    ['createLifeTrackerState', 'createInitialGame', 'createGameState'],
    'initial game factory',
  );
  const resetGame = getExport(
    lifeTracker,
    ['resetLifeTrackerState', 'resetGame', 'createResetState'],
    'game reset function',
  );
  const oldState = createGame({ rng: () => 0 });
  oldState.players.forEach((player, index) => {
    player.life = index - 20;
    player.name = `Seat ${index + 1}`;
  });
  const randomValues = [0.92, 0.08, 0.74, 0.31, 0.55];
  let randomIndex = 0;
  const reset = resetGame(oldState, () => randomValues[randomIndex++ % randomValues.length]);
  const resetPlayers = playersFrom(reset, oldState);

  assert.deepEqual(resetPlayers.map((player) => player.life), [40, 40, 40, 40]);
  assert.deepEqual(resetPlayers.map((player) => player.name), ['Seat 1', 'Seat 2', 'Seat 3', 'Seat 4']);
  assert.equal(new Set(resetPlayers.map((player) => player.colorKey)).size, 4);

  const js = readPage('js');
  const wxml = readPage('wxml');
  assert.match(js, /readStorage\(/);
  assert.match(js, /writeStorage\(/);
  assert.match(js, /onLoad\(\)[\s\S]*?readStorage\(/);
  assert.match(js, /onHide\(\)[\s\S]*?writeStorage\(/);
  assert.match(wxml, /bindtap="resetGame"[^>]*>[\s\S]*?重置/);
});

test('screen wake lock is enabled on entry and restored only when leaving the match page', () => {
  const js = readPage('js');
  const keepScreenOn = read('miniprogram/utils/keep-screen-on.js');

  assert.match(js, /require\('\.\.\/\.\.\/utils\/keep-screen-on'\)/);
  assert.match(keepScreenOn, /wx\.setKeepScreenOn\s*\(\s*{\s*keepScreenOn:\s*Boolean\(keepScreenOn\)/);
  assert.match(js, /onShow\(\)\s*{[\s\S]*?(?:setKeepScreenOn\(true\)|keepScreenOn:\s*true)/);
  const onHideBlock = js.match(/onHide\(\)\s*{[\s\S]*?\n\s*}/);
  assert.ok(onHideBlock, 'onHide should preserve the match while the app is backgrounded');
  assert.doesNotMatch(onHideBlock[0], /setKeepScreenOn\(false\)|keepScreenOn:\s*false/);
  assert.match(js, /onUnload\(\)\s*{[\s\S]*?(?:setKeepScreenOn\(false\)|keepScreenOn:\s*false)/);
});

test('match toolbar provides a direct return to the home page', () => {
  const wxml = readPage('wxml');
  const js = readPage('js');

  assert.match(wxml, /bindtap="goHome"[^>]*>[\s\S]*?(?:返回|主页)/);
  assert.match(js, /goHome\(\)\s*{[\s\S]*?wx\.navigateBack\s*\(/);
  assert.match(wxml, /class="hub-trigger-hit"[\s\S]*bindtap="toggleDropdown"[\s\S]*class="dropdown-trigger"/);
  assert.match(wxml, /class="dropdown-menu \{\{menuOpen \? 'dropdown-menu-open' : ''\}\}"/);
  assert.match(js, /toggleDropdown\(\)\s*{[\s\S]*menuOpen:\s*!this\.data\.menuOpen/);
  assert.match(readPage('wxss'), /\.life-grid\s*{[\s\S]*position:\s*fixed[\s\S]*inset:\s*0[\s\S]*width:\s*100vw[\s\S]*height:\s*100vh/);
  assert.match(readPage('wxss'), /\.board-hub\s*{[\s\S]*position:\s*fixed[\s\S]*top:\s*50vh[\s\S]*left:\s*50vw[\s\S]*width:\s*0[\s\S]*height:\s*0/);
  assert.match(readPage('wxss'), /\.hub-trigger-hit\s*{[\s\S]*width:\s*88rpx[\s\S]*height:\s*88rpx[\s\S]*translate\(-50%,\s*-50%\)/);
  assert.match(readPage('wxss'), /\.dropdown-trigger\s*{[\s\S]*width:\s*36rpx[\s\S]*height:\s*28rpx/);
  assert.match(readPage('wxss'), /\.hub-action\s*{[\s\S]*height:\s*44rpx[\s\S]*font-size:\s*16rpx/);
  assert.match(wxml, /class="dropdown-icon"[\s\S]*class="dropdown-bar"[\s\S]*class="dropdown-bar"[\s\S]*class="dropdown-bar"/);
  assert.match(readPage('wxss'), /\.dropdown-trigger\s*{[\s\S]*border-radius:\s*999rpx[\s\S]*animation:\s*dropdown-rgb-cycle\s*12s/);
  assert.match(readPage('wxss'), /@keyframes dropdown-rgb-cycle[\s\S]*border-color:[\s\S]*33%[\s\S]*66%/);
  assert.match(readPage('wxss'), /\.life-tracker-page\s*{[\s\S]*--life-entry-accent-rgb:\s*225,\s*93,\s*104/);
  assert.match(readPage('wxss'), /\.life-grid::before,[\s\S]*background:\s*rgba\(var\(--life-entry-accent-rgb\),\s*0\.11\)/);
  assert.match(readPage('wxss'), /\.hub-action\s*{[\s\S]*border-radius:\s*999rpx/);
  assert.match(readPage('wxss'), /\.dropdown-menu\s*{[\s\S]*opacity:\s*0[\s\S]*transform:[\s\S]*scale\(0\.92\)[\s\S]*transition:/);
  assert.match(readPage('wxss'), /\.dropdown-menu-open\s*{[\s\S]*opacity:\s*1[\s\S]*scale\(1\)/);
});
