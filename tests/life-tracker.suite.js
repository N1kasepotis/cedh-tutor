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

// ---------------------------------------------------------------------------
// 抽先手：边缘赛跑
//
// 一道光沿屏幕外缘按围坐顺序跑，减速，停在中签者那一段，之后那条边留成他的颜色。
// 全程不出文字——一半座位转了 180 度，任何一句「你先手」对另一半都是倒的。
// ---------------------------------------------------------------------------

test('围坐环序覆盖每个人恰好一次，且是真正的顺时针', () => {
  const { seatRingFor } = getLifeTrackerUtils();

  [2, 3, 4, 5].forEach((count) => {
    const ring = seatRingFor(count);
    assert.equal(ring.length, count, `${count} 人局的环少了人`);
    assert.deepEqual(
      ring.slice().sort((a, b) => a - b),
      Array.from({ length: count }, (_, i) => i + 1),
      `${count} 人局的环有重复或越界的座位`,
    );
  });

  // DOM 顺序不等于围坐顺序，这正是这张表存在的理由：
  // 三人局 seat-2 在左下、seat-3 在右下，顺时针数是 1 → 3 → 2；
  // 四人局 seat-3 在左下、seat-4 在右下，顺时针是 1 → 2 → 4 → 3。
  // 直接拿 DOM 顺序跑，光会在对角之间乱跳，一眼就是不对。
  assert.deepEqual(seatRingFor(3), [1, 3, 2]);
  assert.deepEqual(seatRingFor(4), [1, 2, 4, 3]);
  // 五人：左上 → 右上 → 右侧竖栏 → 右下 → 左下
  assert.deepEqual(seatRingFor(5), [1, 2, 5, 4, 3]);
});

test('先手是均匀抽的，动画只是把已定的结果演出来', () => {
  const { createLifeTrackerState, pickFirstPlayerId, buildFirstPlayerRace } = getLifeTrackerUtils();
  const state = createLifeTrackerState({ rng: () => 0.25, playerCount: 4 });

  // 四人局：rng 落在四个等宽区间里，各自对应一个座位
  assert.equal(pickFirstPlayerId(state, () => 0), 1);
  assert.equal(pickFirstPlayerId(state, () => 0.26), 2);
  assert.equal(pickFirstPlayerId(state, () => 0.51), 3);
  assert.equal(pickFirstPlayerId(state, () => 0.999999), 4);
  // rng 返回越界值不能把 id 抽到数组外去
  assert.equal(pickFirstPlayerId(state, () => 1.5), 4);
  assert.equal(pickFirstPlayerId(state, () => -3), 1);

  // 序列末位必须**恰好**是抽中的那个人。反过来做（先定步数、看落在谁头上）
  // 会让概率依赖 laps / easing 这些节奏参数——改一下节奏就悄悄改了公平性。
  [2, 3, 4, 5].forEach((count) => {
    for (let winner = 1; winner <= count; winner += 1) {
      const race = buildFirstPlayerRace(count, winner);
      const landed = race.sequence[race.sequence.length - 1];
      assert.equal(landed, winner, `${count} 人局抽到 seat-${winner}，光却停在 seat-${landed}`);
      assert.equal(race.sequence.length, race.delays.length);
    }
  });

  // 不存在的座位不生成序列，让调用方直接落结果而不是跑一段空动画
  assert.deepEqual(buildFirstPlayerRace(4, 99), { sequence: [], delays: [] });
});

test('赛跑必须是减速的，而且要绕够圈数', () => {
  const { buildFirstPlayerRace, seatRingFor } = getLifeTrackerUtils();
  const { lifeTrackerConfig } = require('../miniprogram/config/life-tracker');
  const config = lifeTrackerConfig.firstPlayerRace;

  const race = buildFirstPlayerRace(5, 3);
  // 单调不减：中间任何一处变快，观感就不是「转盘慢下来」而是「卡了一下」
  race.delays.forEach((delay, index) => {
    if (index === 0) return;
    assert.ok(delay >= race.delays[index - 1],
      `第 ${index} 步比上一步还快（${race.delays[index - 1]} → ${delay}），减速被打断了`);
  });
  assert.equal(race.delays[0], config.minStepMs);
  assert.equal(race.delays[race.delays.length - 1], config.maxStepMs);
  // 首尾必须真的拉开差距，否则就是匀速转圈、没有「停下来」这个动作
  assert.ok(config.maxStepMs >= config.minStepMs * 4, '最慢与最快差距不足，读不出减速');

  // 至少绕满配置的圈数：少于两圈来不及建立「在转」的印象
  const ring = seatRingFor(5);
  assert.ok(race.sequence.length > ring.length * config.laps,
    `只跑了 ${race.sequence.length} 步，不足 ${config.laps} 圈`);
  assert.ok(config.laps >= 2);
  // 彗尾至少一格。砍成 0 的话每一帧只有一个孤格在亮，快段就是纯闪烁——
  // 既读不出光在往哪边跑，也是这条效果里唯一沾边光敏风险的地方。
  assert.ok(config.trail >= 1, '彗尾长度不能是 0，那不是赛跑是闪烁');

  // 总时长要落在「有悬念但不磨人」的区间
  const total = race.delays.reduce((sum, delay) => sum + delay, 0);
  assert.ok(total > 1500 && total < 5000, `总时长 ${total}ms 超出可接受区间`);
});

test('彗尾：头部最亮往回递减，不是单格闪烁', () => {
  const { raceLevelsAt } = getLifeTrackerUtils();
  const sequence = [1, 2, 4, 3, 1, 2, 4, 3];

  // 只亮一格的话，快段就是纯闪烁；有尾巴才读得出「一道光在跑」
  assert.deepEqual(raceLevelsAt(sequence, 4, 2), { 1: 3, 3: 2, 4: 1 });
  // 开头几步尾巴还没长齐，不能越界去读 sequence[-1]
  assert.deepEqual(raceLevelsAt(sequence, 0, 2), { 1: 3 });
  assert.deepEqual(raceLevelsAt(sequence, 1, 2), { 2: 3, 1: 2 });
  // 两人局：座位比尾巴短，同一格会被扫到两次，必须取最亮的那次
  assert.deepEqual(raceLevelsAt([1, 2, 1, 2], 3, 2), { 2: 3, 1: 2 });
  assert.deepEqual(raceLevelsAt(sequence, 4, 0), { 1: 1 });
});

test('先手落定后常驻，并随新的一局清掉', () => {
  const {
    createLifeTrackerState, setFirstPlayer, resetLifeTrackerState,
    setLifeTrackerPlayerCount, isLifeTrackerState,
  } = getLifeTrackerUtils();

  const state = createLifeTrackerState({ rng: () => 0.25, playerCount: 5 });
  assert.equal(state.firstPlayerId, null, '新开一局还没抽先手');

  const drawn = setFirstPlayer(state, 4);
  assert.equal(drawn.firstPlayerId, 4);
  // 抽签只热闹两秒，但「谁先手」整局都在用来数回合顺序——所以它得存下来，
  // 切后台回来还在
  assert.ok(isLifeTrackerState(drawn), '带先手的存档必须能落盘');
  assert.equal(setFirstPlayer(drawn, 99).firstPlayerId, null, '不存在的座位不能被记成先手');

  // 重置和切人数都是「新的一局」，先手跟着清
  assert.equal(resetLifeTrackerState(drawn, () => 0.5).firstPlayerId, null);
  assert.equal(setLifeTrackerPlayerCount(drawn, 4, () => 0.5).firstPlayerId, null);

  // 越界的先手 id 必须让整份存档作废：留着它只会让那条常驻边永远不显示、
  // 而且不报错——最难查的那一类
  assert.equal(isLifeTrackerState({ ...drawn, firstPlayerId: 9 }), false);
  assert.equal(isLifeTrackerState({ ...drawn, firstPlayerId: 0 }), false);
  assert.equal(isLifeTrackerState({ ...drawn, firstPlayerId: 2.5 }), false);
  // 旧存档没有这个字段，仍然有效
  const legacy = { ...drawn };
  delete legacy.firstPlayerId;
  assert.ok(isLifeTrackerState(legacy), '旧存档没有 firstPlayerId，不该被判无效');
});

// 这条必须真的驱动页面对象跑一遍：光跑没跑、停在谁那儿、有没有全量刷 players，
// 光看源码都看不出来。
test('抽先手：真跑一遍，光停在中签者、且不整数组刷视图', async () => {
  const originalPage = global.Page;
  const originalWx = global.wx;
  let page = null;
  const store = new Map();
  global.Page = (config) => { page = config; };
  global.wx = {
    getStorageSync: (key) => (store.has(key) ? store.get(key) : ''),
    setStorageSync: (key, value) => store.set(key, JSON.parse(JSON.stringify(value))),
    removeStorageSync: (key) => store.delete(key),
    showToast: () => {},
    setKeepScreenOn: () => {},
    showShareMenu: () => {},
  };
  const modulePath = require.resolve('../miniprogram/pages/life-tracker/life-tracker.js');
  delete require.cache[modulePath];
  try {
    require(modulePath);
  } finally {
    global.Page = originalPage;
  }

  const { createLifeTrackerState } = getLifeTrackerUtils();
  const setCalls = [];
  const context = Object.assign(Object.create(page), {
    data: { players: [], playerCount: 5, menuOpen: false, undoVisible: false },
    gameState: createLifeTrackerState({ rng: () => 0.25, playerCount: 5 }),
    setData(patch) {
      setCalls.push(patch);
      Object.keys(patch).forEach((key) => {
        const indexed = key.match(/^players\[(\d+)\]\.(\w+)$/);
        if (indexed) this.data.players[Number(indexed[1])][indexed[2]] = patch[key];
        else this.data[key] = patch[key];
      });
    },
  });
  context.syncPlayers();
  const bulkBefore = setCalls.filter((patch) => Object.prototype.hasOwnProperty.call(patch, 'players')).length;

  try {
    await new Promise((resolve, reject) => {
      const settle = context.settleFirstPlayer.bind(context);
      context.settleFirstPlayer = (winnerId) => {
        try {
          settle(winnerId);
          resolve(winnerId);
        } catch (error) {
          reject(error);
        }
      };
      context.drawFirstPlayer();
    });
  } finally {
    context.stopRace();
    global.wx = originalWx;
  }

  const winnerId = context.gameState.firstPlayerId;
  assert.ok(winnerId >= 1 && winnerId <= 5, `抽出的先手 ${winnerId} 不是有效座位`);

  // 光必须真的跑过每一个人：只亮中签者那一下就不是赛跑，是直接公布答案
  const lit = new Set();
  setCalls.forEach((patch) => {
    Object.keys(patch).forEach((key) => {
      const indexed = key.match(/^players\[(\d+)\]\.raceLevel$/);
      if (indexed && patch[key] > 0) lit.add(Number(indexed[1]) + 1);
    });
  });
  assert.equal(lit.size, 5, `只点亮了 ${Array.from(lit).join(',')}，光没跑完一圈`);

  // 高频那几帧只能走定向路径。整个 players 数组每 55ms 全量过桥，
  // 是这一页最贵的写法，也正是真机上会卡的原因。
  const bulkTotal = setCalls.filter((patch) => Object.prototype.hasOwnProperty.call(patch, 'players')).length;
  assert.equal(bulkTotal - bulkBefore, 1,
    `赛跑期间整数组刷了 ${bulkTotal - bulkBefore} 次，只允许落定后 syncPlayers 那一次`);

  // 落定后中签者带上常驻标记，其余不带
  context.data.players.forEach((player) => {
    assert.equal(player.isFirstPlayer, player.id === winnerId, `seat-${player.id} 的常驻先手标记不对`);
    assert.equal(player.raceLevel || 0, 0, '落定后不该还留着赛跑的亮度');
  });
});

test('赛跑的线挂在座位外缘，位置跟着朝向走', () => {
  const wxml = readPage('wxml');
  const wxss = readPage('wxss');
  const js = readPage('js');

  // 必须在 player-face **之外**：放进去会跟着 face 一起转 180 度，线就跑到屏幕内侧了。
  // 「seat-edge 出现在唯一那个 player-face 开标签之前」——这两条合起来就等价于
  // 「它不是 player-face 的后代」，比匹配相邻文本可靠得多（相邻文本挡不住整段被复制）。
  const edgeAt = wxml.indexOf('class="seat-edge');
  const faceAt = wxml.indexOf('<view class="player-face">');
  assert.ok(edgeAt > 0, 'wxml 里找不到 seat-edge');
  assert.ok(faceAt > 0, 'wxml 里找不到 player-face');
  assert.ok(edgeAt < faceAt, 'seat-edge 必须是 player-face 的兄弟节点，不能放在里面');
  assert.equal((wxml.match(/<view class="player-face">/g) || []).length, 1,
    'player-face 只该有一个；多出来的那个会让上面的位置判断失效');
  assert.match(wxml, /class="seat-edge level-\{\{item\.raceLevel \|\| 0\}\}/);
  assert.match(wxml, /item\.isFirstPlayer \? 'seat-edge-won'/);
  assert.match(wxml, /bindtap="drawFirstPlayer"/);

  // 一个人坐哪条边，他的线就在哪条边——两者本来就是同一件事
  assert.match(wxss, /\.player-facing-top \.seat-edge\s*{[^}]*top:\s*0/);
  assert.match(wxss, /\.player-facing-bottom \.seat-edge\s*{[^}]*bottom:\s*0/);
  assert.match(wxss, /\.player-facing-right \.seat-edge\s*{[^}]*right:\s*0/);
  // 三档彗尾 + 常驻态
  ['level-1', 'level-2', 'level-3', 'seat-edge-won'].forEach((name) => {
    assert.match(wxss, new RegExp(`\\.seat-edge\\.${name}\\s*{`), `缺少 .seat-edge.${name}`);
  });
  // 外发光只给头部：全都发光就糊成一圈，看不出光往哪边跑
  assert.doesNotMatch(wxss, /\.seat-edge\.level-1\s*{[^}]*box-shadow/);
  assert.doesNotMatch(wxss, /\.seat-edge\.level-2\s*{[^}]*box-shadow/);

  // 减少动态偏好下去掉发光与过渡
  assert.match(wxss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.seat-edge\s*{[^}]*transition:\s*none/);

  // 切后台 / 重置 / 切人数都要掐掉：让一条没意义的序列继续跑，
  // 结果就是它在新的一局里凭空点亮一个座位
  assert.ok((js.match(/this\.stopRace\(\);/g) || []).length >= 4,
    'onHide / onUnload / resetGame / setPlayerMode 都要掐掉正在跑的赛跑');
});

// 中心菜单从屏幕纵向中点往下展开，但它的高度全是 rpx——而 rpx 是按**宽**推导的。
// 横屏下宽是长边，于是屏幕越长（比例越大），同样的 rpx 高度占掉的 vh 越多。
// 加第三行时正是这么翻的车：2.16:1 的机器上菜单底部落到 105vh，整行在屏幕外。
//
//   行数   iPhone SE 1.78   iPhone 13 2.16   21:9 长屏 2.28
//    2         83.7vh           91.0vh          93.2vh
//    3         95.5vh          105.4vh ✗       108.4vh ✗
//
// 所以这道门禁不锁「行数必须是 2」，而是按真实常量算出最长机型上的底边位置。
// 加一行、改行高、改顶部偏移，任何一项让它越界都会立刻红，而不是等真机上看见。
test('中心菜单在最长的横屏机型上也不出框', () => {
  const wxml = readPage('wxml');
  const wxss = readPage('wxss');

  const menuBlock = wxss.match(/\.dropdown-menu\s*{([\s\S]*?)}/);
  assert.ok(menuBlock, '找不到 .dropdown-menu 规则块');
  const actionBlock = wxss.match(/\.hub-action\s*{([\s\S]*?)}/);
  assert.ok(actionBlock, '找不到 .hub-action 规则块');

  const rpxOf = (block, property) => {
    const found = block.match(new RegExp(`${property}:\\s*(\\d+(?:\\.\\d+)?)rpx`));
    assert.ok(found, `解析不出 ${property}`);
    return Number(found[1]);
  };

  const topOffset = rpxOf(menuBlock[1], 'top');
  const rowGap = rpxOf(menuBlock[1], 'gap');
  const menuWidth = rpxOf(menuBlock[1], 'width');
  const rowHeight = rpxOf(actionBlock[1], 'height');

  const menu = wxml.slice(wxml.indexOf('class="dropdown-menu'));
  const rows = menu.split('<view class="hub-row">').slice(1);
  assert.ok(rows.length >= 1, '菜单里一行都没有');

  // 从中心往下伸的总高度（rpx）
  const dropRpx = topOffset + rowHeight * rows.length + rowGap * (rows.length - 1);

  // 目前在售最长的横屏比例约 2.3（21:9 手机）。留 4vh 余量给系统手势条。
  const LONGEST_ASPECT = 2.3;
  const SAFE_LIMIT_VH = 96;
  const bottomVh = 50 + (dropRpx * LONGEST_ASPECT * 100) / 750;
  assert.ok(bottomVh <= SAFE_LIMIT_VH,
    `${rows.length} 行菜单在 ${LONGEST_ASPECT}:1 的机型上底边落到 ${bottomVh.toFixed(1)}vh（上限 ${SAFE_LIMIT_VH}vh）。`
    + '菜单是从 50vh 往下展开的，高度却按 rpx（宽）算——屏幕越长越容易掉出去。'
    + '要加动作就并进已有的行，不要再往下堆。');

  // 并进已有行之后，横向也得放得下。按钮是 flex: 1 1 0 均分，
  // 一个中日韩字符在 16rpx 字号 + 0.08em 字距下约占 17.3rpx。
  const fontSize = rpxOf(actionBlock[1], 'font-size');
  const perChar = fontSize * 1.08;
  rows.forEach((row, index) => {
    const labels = Array.from(row.matchAll(/>([^<>]+)<\/view>/g), (match) => match[1].trim())
      .filter(Boolean)
      // wx:for 出来的是 {{item}}人，按最长的那个档位算
      .map((label) => label.replace(/\{\{[^}]*\}\}/g, String(Math.max(...[2, 3, 4, 5]))));
    assert.ok(labels.length, `第 ${index + 1} 行解析不出按钮`);
    const perButton = (menuWidth - rowGap * (labels.length - 1)) / labels.length;
    const widest = labels.reduce((longest, label) => (label.length > longest.length ? label : longest), '');
    assert.ok(widest.length * perChar < perButton,
      `第 ${index + 1} 行有 ${labels.length} 颗按钮、每颗 ${perButton.toFixed(1)}rpx，`
      + `但「${widest}」要占约 ${(widest.length * perChar).toFixed(1)}rpx——字会被挤断或溢出。`);
  });

  // 抽先手属于「按一下就发生一次」的动作，跟主页、重置同组；
  // 第二行留给「按住不变」的人数档位。分组错了菜单就读不成两句话。
  assert.match(rows[0], /bindtap="drawFirstPlayer"/, '抽先手应与主页、重置同在动作行');
  assert.match(rows[0], /bindtap="goHome"/);
  assert.match(rows[0], /bindtap="resetGame"/);
  assert.match(rows[1], /bindtap="setPlayerMode"/, '第二行应是人数档位');
});
