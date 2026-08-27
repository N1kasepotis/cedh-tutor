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

  assert.match(wxml, /class="home-button home-button-life[^>]*bindtap="goLifeTracker"/);
  assert.match(wxml, /血量记录/);
  assert.match(wxml, /LIFE COUNTER/);
  // 首页入口排在第五位（01–08 序号文字已撤，改用行的 key 顺序定位）
  assert.equal(
    Array.from(wxml.matchAll(/class="home-button home-button-([a-z]+)/g), (m) => m[1])[4],
    'life',
  );
  assert.match(js, /goLifeTracker\(\)\s*{[\s\S]*?navigateTo\([\s\S]*?\/pages\/life-tracker\/life-tracker/);
  assert.doesNotMatch(wxss, /--home-accent|\.home-button-life\s*{/);
  assert.match(wxss, /\.home-index-active\s*{[\s\S]*background:\s*#0A0A0A/);
});

test('life tracker requests landscape and renders a full-screen two-by-two cross layout', () => {
  const pageJson = JSON.parse(readPage('json'));
  const wxml = readPage('wxml');
  const wxss = readPage('wxss');

  assert.equal(pageJson.pageOrientation, 'landscape');

  // 全局 pageOrientation 只能放在 app.json 的 window 内；放顶层会被新基础库判为
  // invalid app.json ["pageOrientation"] 并拖慢/卡住运行环境加载。
  const appJson = JSON.parse(read('miniprogram/app.json'));
  assert.ok(!Object.prototype.hasOwnProperty.call(appJson, 'pageOrientation'),
    'app.json 顶层不得有 pageOrientation（应放在 window 内）');
  assert.equal(appJson.window.pageOrientation, 'portrait');
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
  // 朝向必须查 config 的 seatFacing，不能在页面里硬算。加进侧坐之后「前 N 位坐上边」
  // 这种算法已经表达不了五人局；而且这张表还被边缘赛跑用来决定光跑过哪条边，
  // 两处各算一套迟早对不上。
  assert.match(js, /orientationClass: `player-facing-\$\{seatFacingFor\(playerCount, index\)\}`/);
  assert.doesNotMatch(js, /playerCount === 4 \? 2 : 1/, '朝向不该再靠硬编码人数推');
  assert.match(wxss, /\.life-grid\.mode-2\s*{[^}]*grid-template-columns:\s*1fr/);
  assert.match(wxss, /\.life-grid\.mode-2::after\s*{[^}]*display:\s*none/);
  assert.match(wxss, /\.life-grid\.mode-3 \.player-zone\.seat-1\s*{[^}]*grid-column:\s*1 \/ -1/);
  assert.match(wxss, /\.life-grid\.mode-3::after\s*{[^}]*top:\s*50%[^}]*height:\s*50%/);
  assert.match(wxss, /\.hub-mode-active\s*{[^}]*border-color/);
});

// 五人 = 两两对坐 + 一人坐右短边。这是五个人围一台平放手机的真实坐法；
// 「一边挤三个」也能塞下，但那位侧身的人得歪着头看自己的血量。
test('五人局：四宫格 + 右短边竖栏，第五位侧坐', () => {
  const { createLifeTrackerState, isLifeTrackerState, seatFacingFor } = getLifeTrackerUtils();

  const five = createLifeTrackerState({ rng: () => 0.25, playerCount: 5 });
  assert.equal(five.playerCount, 5);
  assert.equal(five.players.length, 5);
  assert.deepEqual(five.players.map((player) => player.life), [40, 40, 40, 40, 40]);
  // 八个色够分，但「够分」不等于「真的没重」——重色会让两个人分不清自己那格
  assert.equal(new Set(five.players.map((player) => player.colorKey)).size, 5);
  assert.ok(isLifeTrackerState(five));

  // 朝向表：前四位两两对坐，第五位坐右边
  assert.deepEqual(
    Array.from({ length: 5 }, (_, index) => seatFacingFor(5, index)),
    ['top', 'top', 'bottom', 'bottom', 'right'],
  );
  // 老几档不能被这次改动带歪
  assert.deepEqual(Array.from({ length: 2 }, (_, i) => seatFacingFor(2, i)), ['top', 'bottom']);
  assert.deepEqual(Array.from({ length: 3 }, (_, i) => seatFacingFor(3, i)), ['top', 'bottom', 'bottom']);
  assert.deepEqual(Array.from({ length: 4 }, (_, i) => seatFacingFor(4, i)), ['top', 'top', 'bottom', 'bottom']);
  // 表被改坏时回退成加侧坐之前的老行为，而不是抛异常把整页搞白
  assert.equal(seatFacingFor(4, 99), 'bottom');
  assert.equal(seatFacingFor(4, 0), 'top');

  const wxss = readPage('wxss');
  // 五个座位必须全部显式落位：只写 seat-5 的话，自动流会把 seat-3 塞进右上角
  [1, 2, 3, 4, 5].forEach((seat) => {
    assert.match(wxss, new RegExp(`\\.life-grid\\.mode-5 \\.player-zone\\.seat-${seat}\\s*{[^}]*grid-area`),
      `seat-${seat} 在五人局没有显式落位，四宫格会被自动流打散`);
  });
  assert.match(wxss, /\.life-grid\.mode-5\s*{[^}]*grid-template-columns:\s*1fr 1fr var\(--life-side-strip\)/);
  // 分隔线要跟着竖栏挪：横线不能切开竖栏（那是一个人），竖线要落在四宫格中缝
  assert.match(wxss, /\.life-grid\.mode-5::before\s*{[^}]*width:\s*calc\(100vw - var\(--life-side-strip\)\)/);
  assert.match(wxss, /\.life-grid\.mode-5::after\s*{[^}]*left:\s*calc\(100vw - var\(--life-side-strip\)\)/);
  // 中心菜单同理，否则它偏在竖栏那侧、不在十字交点上
  assert.match(wxss, /\.life-grid\.mode-5 \.board-hub\s*{[^}]*left:\s*calc\(\(100vw - var\(--life-side-strip\)\) \/ 2\)/);

  // 侧坐：加减区改成左右两列（对他就是上下），只有数字转 -90 度。
  // 整块 face 转 90 度会让盒子尺寸与旋转后的视觉尺寸对调，必然溢出。
  assert.match(wxss, /\.player-facing-right \.player-face\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*1fr\)/);
  assert.match(wxss, /\.player-facing-right \.life-increase\s*{[^}]*grid-column:\s*1/);
  assert.match(wxss, /\.player-facing-right \.life-decrease\s*{[^}]*grid-column:\s*2/);
  assert.match(wxss, /\.player-facing-right \.player-summary\s*{[^}]*rotate\(-90deg\)/,
    '侧坐的数字必须转 -90 度：他坐右边朝左看，转 +90 度对他是倒的');
  assert.doesNotMatch(wxss, /\.player-facing-right \.player-face\s*{[^}]*transform:\s*rotate/,
    '不能整块 face 转，盒子尺寸对不上会溢出');
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

// 重置 / 切人数会抹掉一整局血量：给可点撤销而不是事后 toast，也不给正常路径加二次确认
test('life tracker offers an undo window after destructive board changes', () => {
  const js = readPage('js');
  const wxml = readPage('wxml');
  const wxss = readPage('wxss');

  // 两条破坏性路径都先留快照、再交给撤销条，不再只弹 toast
  const resetBlock = js.slice(js.indexOf('resetGame()'), js.indexOf('setPlayerMode(event)'));
  assert.match(resetBlock, /this\.undoPendingSnapshot = cloneLifeState\(this\.gameState\)/);
  assert.match(resetBlock, /this\.offerUndo\('对局已重置'\)/);
  assert.doesNotMatch(resetBlock, /wx\.showToast/);

  const modeBlock = js.slice(js.indexOf('setPlayerMode(event)'), js.indexOf('goHome()'));
  assert.match(modeBlock, /this\.undoPendingSnapshot = cloneLifeState\(this\.gameState\)/);
  assert.match(modeBlock, /this\.offerUndo\(`已切换为 \$\{count\} 人对局`\)/);
  assert.doesNotMatch(modeBlock, /wx\.showToast/);

  // 破坏性操作不该被二次确认拦住——重置在长局里是高频合法操作
  assert.doesNotMatch(resetBlock, /wx\.showModal/);
  assert.doesNotMatch(modeBlock, /wx\.showModal/);

  // 快照必须是拷贝，不能与 gameState 共享 players 引用
  assert.match(js, /function cloneLifeState\(state\)\s*{[\s\S]*players: \(state\.players \|\| \[\]\)\.map\(\(player\) => \(\{ \.\.\.player \}\)\)/);

  // 撤销窗口有限，且继续记血 / 离开页面都会收起
  assert.match(js, /const UNDO_WINDOW_MS = 8000/);
  assert.match(js, /applyLifeChange\(playerId, delta\)\s*{[\s\S]*if \(this\.data\.undoVisible\) this\.dismissUndo\(\)/);
  assert.match(js, /onHide\(\)\s*{[\s\S]*this\.dismissUndo\(\)/);
  assert.match(js, /onUnload\(\)\s*{[\s\S]*this\.dismissUndo\(\)/);
  assert.match(js, /undoLastChange\(\)\s*{[\s\S]*this\.gameState = this\.undoSnapshot[\s\S]*this\.writeStorage\(\)/);

  assert.match(wxml, /wx:if="\{\{undoVisible\}\}"[\s\S]*bindtap="undoLastChange"/);
  assert.match(wxml, /class="undo-bar" aria-live="polite"/);

  // 本页锁横屏：rpx 由「宽」推导，横屏下宽是长边，纵向定位不能用 vh + rpx 混算——
  // 50vh + 150rpx 在横屏约 349pt，加上条高会溢出 375pt 的视口。贴顶才是稳定解。
  assert.match(wxss, /\.undo-bar\s*{[\s\S]*top:\s*calc\(16rpx \+ env\(safe-area-inset-top\)\)/);
  const undoBarRule = wxss.match(/\.undo-bar\s*{[^}]*}/)[0];
  assert.doesNotMatch(undoBarRule, /50vh/, '横屏页纵向定位不得混用 vh 与 rpx');
  assert.match(wxss, /\.undo-action\s*{[\s\S]*min-width:\s*88rpx[\s\S]*height:\s*44rpx/);

  // 胶囊套胶囊必须同心：上下内缩 (外高 - 内高) / 2 要等于右侧 padding。
  // 两者不等时真机上一眼就看得出白胶囊没和黑条对齐——曾经是 52/44 配 12rpx 右 padding，
  // 上下缩 4rpx、右侧缩 12rpx，圆角明显错位。
  const cssRule = (name) => wxss.match(new RegExp(`\\.${name}\\s*\\{[^}]*\\}`))[0];
  const barRule = cssRule('undo-bar');
  const actionRule = cssRule('undo-action');
  const barHeight = Number(barRule.match(/\n\s*height:\s*(\d+)rpx/)[1]);
  const actionHeight = Number(actionRule.match(/\n\s*height:\s*(\d+)rpx/)[1]);
  const barPadRight = Number(barRule.match(/\n\s*padding:\s*0\s+(\d+)rpx\s+0\s+\d+rpx/)[1]);
  assert.equal(
    (barHeight - actionHeight) / 2,
    barPadRight,
    `撤销胶囊未同心：外高 ${barHeight}rpx、内高 ${actionHeight}rpx，上下缩 ${(barHeight - actionHeight) / 2}rpx，右侧却缩 ${barPadRight}rpx`,
  );
});
