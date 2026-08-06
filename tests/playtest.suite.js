const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('MTGO 文本解析：数量卡名、空行分隔指挥官、容错行', () => {
  const { parseMtgoDeckText } = require('../miniprogram/utils/playtest');

  const parsed = parseMtgoDeckText([
    '4 Brainstorm',
    '2x Sol Ring',
    '',
    '1 Kinnan, Bonder Prodigy',
  ].join('\n'));

  assert.deepEqual(parsed.main, [
    { count: 4, name: 'Brainstorm' },
    { count: 2, name: 'Sol Ring' },
  ]);
  assert.deepEqual(parsed.commanders, [{ count: 1, name: 'Kinnan, Bonder Prodigy' }]);
  assert.equal(parsed.warnings.length, 0);

  // 前导空行不触发指挥官分段；sideboard 区段会被忽略
  const messy = parseMtgoDeckText('\n\n1 Ancient Tomb\nSIDEBOARD:\n1 Mox Diamond\n');
  assert.deepEqual(messy.main.map((entry) => entry.name), ['Ancient Tomb']);
  assert.equal(messy.warnings.length, 0);

  const empty = parseMtgoDeckText('   \n\n');
  assert.equal(empty.main.length + empty.commanders.length, 0);
});

test('牌组试玩解析支持带区段标题的 Moxfield/MTGso 纯文本', () => {
  const { parseMtgoDeckText } = require('../miniprogram/utils/playtest');

  const parsed = parseMtgoDeckText([
    'Commander',
    '1 Tymna the Weaver',
    '1 Kraum, Ludevic\'s Opus',
    '',
    'Deck',
    '1 Sol Ring',
    '1 Command Tower',
    '',
    'Sideboard',
    '1 Silence',
  ].join('\n'));

  assert.deepEqual(parsed.commanders.map((entry) => entry.name), [
    'Tymna the Weaver',
    'Kraum, Ludevic\'s Opus',
  ]);
  assert.deepEqual(parsed.main.map((entry) => entry.name), ['Sol Ring', 'Command Tower']);
  assert.equal(parsed.warnings.length, 0);
});

test('牌组试玩解析把弯引号归一化为直引号（Moxfield 导出兼容）', () => {
  const { parseMtgoDeckText } = require('../miniprogram/utils/playtest');

  // Moxfield 常用 U+2019 弯引号；归一化后 Scryfall 卡图与搜索框才能命中
  const parsed = parseMtgoDeckText('1 Gaea’s Cradle\n1 Yawgmoth’s Will');
  assert.deepEqual(parsed.main.map((entry) => entry.name), ["Gaea's Cradle", "Yawgmoth's Will"]);
  assert.ok(parsed.main.every((entry) => !entry.name.includes('’')));
});

test('牌组试玩拒绝超长文本、异常总张数与过量主将，避免无界展开', () => {
  const {
    parseMtgoDeckText,
    MAX_DECK_CHARS,
    MAX_TOTAL_CARDS,
    MAX_COMMANDER_CARDS,
  } = require('../miniprogram/utils/playtest');

  const tooLong = parseMtgoDeckText('A'.repeat(MAX_DECK_CHARS + 1));
  assert.equal(tooLong.fatal, true);
  assert.equal(tooLong.main.length + tooLong.commanders.length, 0);

  const tooManyCards = parseMtgoDeckText('99 Alpha\n99 Beta\n99 Gamma\n\n1 Boss');
  assert.equal(tooManyCards.fatal, true);
  assert.match(tooManyCards.warnings[0], new RegExp(String(MAX_TOTAL_CARDS)));

  const tooManyCommanders = parseMtgoDeckText(`1 Main\n\n${MAX_COMMANDER_CARDS + 1} Boss`);
  assert.equal(tooManyCommanders.fatal, true);
  assert.match(tooManyCommanders.warnings[0], /主将/);
});

test('建局：洗库、主将区、起手七张，注入 rng 可复现', () => {
  const { parseMtgoDeckText, createGame } = require('../miniprogram/utils/playtest');

  const lines = [];
  for (let i = 1; i <= 99; i += 1) lines.push(`1 Card ${i}`);
  const parsed = parseMtgoDeckText(`${lines.join('\n')}\n\n1 Commander`);

  const fixedRng = () => 0; // 每次都换到 0 位，结果确定
  const game = createGame(parsed, fixedRng);

  assert.equal(game.hand.length, 7);
  assert.equal(game.library.length, 92);
  assert.equal(game.command.length, 1);
  assert.equal(game.command[0].name, 'Commander');
  assert.equal(game.battlefield.length + game.graveyard.length + game.exile.length, 0);

  const gameB = createGame(parsed, fixedRng);
  assert.deepEqual(
    game.hand.map((card) => card.name),
    gameB.hand.map((card) => card.name),
  );
});

test('抓牌与跨区移动：战场坐标、库顶库底、空库保护', () => {
  const {
    parseMtgoDeckText,
    createGame,
    drawCards,
    moveCard,
    toggleTapped,
    countZones,
  } = require('../miniprogram/utils/playtest');

  const parsed = parseMtgoDeckText('3 Alpha\n3 Beta\n3 Gamma\n\n1 Boss');
  const game = createGame(parsed, () => 0.4999);

  assert.equal(game.hand.length, 7);
  assert.equal(game.library.length, 2);
  drawCards(game, 5);
  assert.equal(game.hand.length, 9);
  assert.equal(game.library.length, 0);

  const first = game.hand[0];
  assert.ok(moveCard(game, 'hand', first.id, 'battlefield', { x: 20, y: 30 }));
  const fielded = game.battlefield[0];
  assert.deepEqual({ x: fielded.x, y: fielded.y, tapped: fielded.tapped }, { x: 20, y: 30, tapped: false });

  assert.ok(toggleTapped(game, fielded.id));
  assert.equal(game.battlefield[0].tapped, true);

  assert.ok(moveCard(game, 'battlefield', fielded.id, 'graveyard'));
  assert.equal(game.graveyard.length, 1);

  const second = game.hand[0];
  const third = game.hand[1];
  moveCard(game, 'hand', second.id, 'library');
  moveCard(game, 'hand', third.id, 'library', { position: 'bottom' });
  assert.equal(game.library[0].id, second.id);
  assert.equal(game.library[game.library.length - 1].id, third.id);

  assert.equal(moveCard(game, 'hand', 99999, 'exile'), false);
  assert.equal(moveCard(game, 'hand', second.id, 'nowhere'), false);

  const counts = countZones(game);
  assert.equal(
    counts.battlefield + counts.hand + counts.library + counts.graveyard + counts.exile + counts.command,
    10,
  );
});

test('衍生物离开战场即消失（MTG 状态动作）', () => {
  const { parseMtgoDeckText, createGame, moveCard } = require('../miniprogram/utils/playtest');

  const game = createGame(parseMtgoDeckText('8 Filler'), () => 0);
  game.battlefield.push({ id: -1, name: 'Token', token: true, tapped: false, x: 0, y: 0 });

  // 换到任何非战场区域：直接消失，不进入目标区
  assert.ok(moveCard(game, 'battlefield', -1, 'graveyard'));
  assert.equal(game.battlefield.length, 0);
  assert.equal(game.graveyard.length, 0);

  game.battlefield.push({ id: -2, name: 'Token', token: true, tapped: false, x: 0, y: 0 });
  assert.ok(moveCard(game, 'battlefield', -2, 'hand'));
  assert.equal(game.hand.filter((card) => card.token).length, 0);

  game.battlefield.push({ id: -3, name: 'Token', token: true, tapped: false, x: 0, y: 0 });
  assert.ok(moveCard(game, 'battlefield', -3, 'library'));
  assert.equal(game.library.some((card) => card.token), false);
});

test('战场卡指示物：±调整、0–999 夹取、归零删字段、离场清空', () => {
  const {
    parseMtgoDeckText, createGame, moveCard, adjustCardCounters, cardCounterTotal, MAX_CARD_COUNTERS,
  } = require('../miniprogram/utils/playtest');

  const game = createGame(parseMtgoDeckText('8 Filler'), () => 0);
  game.battlefield.push({ id: 501, name: 'Walking Ballista', tapped: false, x: 4, y: 4 });

  // 无指示物的卡对象形状不变
  assert.ok(!('counters' in game.battlefield[0]));
  assert.equal(cardCounterTotal(game.battlefield[0]), 0);
  assert.equal(cardCounterTotal({ name: 'x' }), 0);

  // 累加 → { generic: n }
  assert.ok(adjustCardCounters(game, 501, 3));
  assert.deepEqual(game.battlefield[0].counters, { generic: 3 });
  assert.equal(cardCounterTotal(game.battlefield[0]), 3);

  // 下限 0：归零即删键、删空对象字段（不残留 counters: {}）
  assert.ok(adjustCardCounters(game, 501, -10));
  assert.ok(!('counters' in game.battlefield[0]));

  // 上限 999
  adjustCardCounters(game, 501, 5000);
  assert.equal(game.battlefield[0].counters.generic, MAX_CARD_COUNTERS);

  // 只作用于战场；非法目标与非有限 delta 返回 false
  assert.equal(adjustCardCounters(game, 99999, 1), false);
  assert.equal(adjustCardCounters(game, 501, NaN), false);

  // 离开战场丢失指示物（moveCard 重建卡对象）
  moveCard(game, 'battlefield', 501, 'graveyard');
  const inGrave = game.graveyard.find((card) => card.id === 501);
  assert.ok(inGrave && !('counters' in inGrave));
});

test('playtest 页面注册齐全且对局按钮有统一短按反馈', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const pageRoot = path.join(root, 'miniprogram/pages/playtest');

  assert.ok(appJson.pages.includes('pages/playtest/playtest'));
  assert.ok(!appJson.pages.includes('pages/feedback/feedback'));

  const js = fs.readFileSync(path.join(pageRoot, 'playtest.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(pageRoot, 'playtest.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageRoot, 'playtest.wxss'), 'utf8');
  const pageJson = JSON.parse(fs.readFileSync(path.join(pageRoot, 'playtest.json'), 'utf8'));
  const darkTableTheme = fs.readFileSync(path.join(root, 'miniprogram/styles/themes/dark-table.wxss'), 'utf8');

  assert.match(darkTableTheme, /\.playtest\s*{[\s\S]*?--module-accent-rgb:\s*126,\s*141,\s*205[\s\S]*?--cedh-accent:\s*#7e8dcd/);

  // 六区俱全
  ['battlefield', 'zone-command', 'zone-library', 'zone-graveyard', 'zone-exile', 'hand'].forEach((id) => {
    assert.match(wxml, new RegExp(`id="${id}"`), `${id} 区域应存在`);
  });

  // 三套交互：拖放、单击（抓牌/展开/横置）、长按（详视/查找）
  assert.match(wxml, /catchtouchstart="fieldTouchStart"/);
  assert.match(wxml, /bindtap="drawOne"/);
  assert.match(wxml, /bindtap="openZone"/);
  assert.match(wxml, /bindtap="playFromHand"/);
  assert.match(wxml, /bindlongpress="inspectFieldCard"/);
  assert.match(wxml, /catchtouchcancel="fieldTouchCancel"/);
  assert.match(wxml, /bindtap="addToken"/);
  assert.match(wxml, /Token/);
  assert.match(wxml, /长按查找/);
  assert.match(js, /toggleTapped/);
  assert.match(js, /hitTestZone/);
  assert.match(js, /addToken\(\)/);

  // 战场指示物（方案 A + 角标 + 单一通用计数）：角标纯展示不截手势、± 在详视弹窗内编辑
  assert.match(wxml, /class="card-counter-badge"[^>]*aria-label="指示物 \{\{item\.counterTotal\}\}">\{\{item\.counterTotal\}\}/);
  assert.match(wxml, /wx:if="\{\{item\.counterTotal\}\}"/);
  assert.match(wxss, /\.card-counter-badge\s*{[\s\S]*?pointer-events:\s*none/);
  assert.match(wxml, /class="inspect-counter" wx:if="\{\{inspect\.canCounter\}\}"/);
  assert.match(wxml, /data-delta="-1" bindtap="adjustInspectCounter"/);
  assert.match(wxml, /data-delta="1" bindtap="adjustInspectCounter"/);
  assert.match(js, /adjustCardCounters/);
  assert.match(js, /cardCounterTotal/);
  assert.match(js, /canCounter: zone === 'battlefield' && !card\.token/);
  // 详视步进控件触控 ≥ 64rpx
  assert.match(wxss, /\.counter-ctrl\s*{[\s\S]*?width:\s*64rpx[\s\S]*?height:\s*64rpx/);

  // 性能约定：无 keyframe 动画、禁页面滚动
  assert.doesNotMatch(wxss, /animation|keyframes/);
  // 触控地板：对局高频 ± 控件不得回落到 44rpx / 56rpx 以下
  assert.match(wxss, /\.mana-ctrl\s*{[\s\S]*?width:\s*44rpx[\s\S]*?height:\s*44rpx/);
  assert.match(wxss, /\.life-btn\s*{[\s\S]*?width:\s*56rpx[\s\S]*?height:\s*56rpx/);
  const boardBlock = wxml.slice(wxml.indexOf('playtest-board'));
  // 粒子背景提升到页面级：导入态与对局态（含 battlefield）共用同款暗色动态背景
  assert.match(wxml, /<particle-background palette="playtest"><\/particle-background>/);
  // particle-background 当前在 playtest-shell 内部，导入态与对局态复用
  assert.ok(wxml.indexOf('particle-background') > wxml.indexOf('playtest-shell'), '粒子背景应在导入态壳内');
  assert.ok(wxml.indexOf('particle-background') < wxml.indexOf('playtest-board'), '粒子背景应在对局态之前（页面级）');
  assert.equal(pageJson.disableScroll, true);
  // 对局按钮：重开 + Token + 四个区域芯片（「换牌组」已按需求移除）
  assert.ok((boardBlock.match(/hover-class="pressable-active"/g) || []).length >= 6);
  assert.doesNotMatch(wxml, /换牌组|confirmReimport/);
  assert.match(wxss, /\.board-action\s*{[\s\S]*border:\s*var\(--cedh-hairline\)/);

  // 导入态：无标题、说明块列举三种来源、有清除按钮
  assert.doesNotMatch(wxml, /playtest-title|套牌试玩<\/view>/);
  assert.match(wxml, /支持 MTGO \/ Moxfield \/ MTGso 纯文本牌表/);
  assert.match(wxml, /每行「数量 卡名」；主将以 Commander 标题或空行与主牌分隔/);
  assert.match(wxss, /\.playtest-shell\s*{[\s\S]*flex:\s*1/);
  assert.match(wxss, /\.deck-input\s*{[\s\S]*height:\s*calc\(100vh - 480rpx\)/);
  assert.match(wxss, /\.deck-input\s*{[\s\S]*min-height:\s*600rpx/);
  assert.match(wxml, /maxlength="50000"/);
  // 对局沙盘不再堆砌互动规则说明（已按需求删除 battlefield-empty 引导）
  assert.doesNotMatch(wxml, /battlefield-empty|点手牌打出|长按手牌看大图/);
  assert.match(wxml, /bindtap="confirmClearDeckText"[\s\S]{0,80}>清除现套牌/);
  // 导入 / 剪贴板粘贴 / 清除三颗按钮同款（半透明 primary-button import-button），且都有短按反馈
  assert.equal((wxml.match(/class="primary-button import-button"/g) || []).length, 3);
  assert.match(wxml, /bindtap="importFromClipboard">从剪贴板粘贴/);
  // 但只能占两行：deck-input 高度按「下方固定两行」预留，再堆一行会被 overflow:hidden 裁出屏幕
  const importActions = wxml.slice(
    wxml.indexOf('<view class="import-actions">'),
    wxml.indexOf('</view>\n  </view>'),
  );
  assert.match(importActions, /bindtap="importFromClipboard"/);
  assert.match(importActions, /bindtap="confirmClearDeckText"/);
  assert.doesNotMatch(importActions, /bindtap="importDeck"/);
  assert.match(wxss, /\.import-actions\s*{[\s\S]*display:\s*flex/);
  assert.match(wxss, /\.import-actions \.import-button\s*{[\s\S]*flex:\s*1 1 0[\s\S]*min-width:\s*0/);
  assert.match(wxml, /class="primary-button import-button"[\s\S]{0,90}bindtap="confirmClearDeckText"/);
  assert.ok((wxml.match(/hover-class="pressable-active"/g) || []).length >= 2);
  assert.match(js, /content:\s*'会清空输入框和已保存的牌表文本'/);
  assert.doesNotMatch(js, /content:\s*'会清空输入框和已保存的牌表文本。'/);

  // 洗牌或长按查找完成后牌库顺序回归隐藏信息：面板必须自动关闭
  const shuffleBlock = js.slice(js.indexOf('shuffleLibrary()'), js.indexOf('movePanelCard'));
  assert.match(shuffleBlock, /closeZone\(\)/);
  assert.doesNotMatch(shuffleBlock, /refreshPanel/);
  const movePanelBlock = js.slice(js.indexOf('movePanelCard(event)'), js.indexOf('// ===== 长按详视'));
  assert.match(movePanelBlock, /fromZone === 'library'/);
  assert.match(movePanelBlock, /shuffleInPlace\(this\.game\.library\)/);
  assert.match(movePanelBlock, /closeZone\(\)/);
  const moveInspectBlock = js.slice(js.indexOf('moveInspectCard(event)'), js.indexOf('// ===== 重开 / 换牌组'));
  assert.match(moveInspectBlock, /inspect\.zone === 'library'/);
  assert.match(moveInspectBlock, /shuffleInPlace\(this\.game\.library\)/);
  assert.match(moveInspectBlock, /closeZone\(\)/);

  // 长卡名不允许从卡面右侧溢出
  assert.match(wxss, /\.card-name\s*{[\s\S]*width:\s*100%/);
  assert.match(wxss, /\.card-name\s*{[\s\S]*word-break:\s*break-word/);
  assert.match(wxss, /\.hand-card \.card-name\s*{[\s\S]*white-space:\s*normal/);
  assert.match(wxss, /\.hand-card \.card-name\s*{[\s\S]*-webkit-line-clamp:\s*unset/);

  // 导师效应：牌库面板带精确查找输入框
  assert.match(wxml, /class="panel-search"/);
  assert.match(wxml, /bindinput="handlePanelSearch"/);
  assert.match(wxml, /bindtap="loadMorePanelCards"/);
  assert.match(js, /handlePanelSearch/);
  assert.match(js, /panelQuery/);
  assert.match(js, /PANEL_PAGE_SIZE\s*=\s*40/);
  assert.match(js, /cards\.slice\(0, this\.panelVisibleCount\)/);

  // 区域面板可把牌移入放逐区（除放逐区自身与主将区外都提供）；主将只在手牌/战场/坟场间移动
  assert.match(wxml, /wx:if="\{\{panelZone !== 'exile' && panelZone !== 'command'\}\}"[^>]*data-to="exile"[^>]*>放逐/);
  assert.match(wxml, /wx:if="\{\{panelZone !== 'library' && panelZone !== 'command'\}\}"[^>]*data-to="library"[^>]*>库顶/);
  const cmdInspectBranch = js.slice(js.indexOf("if (zone === 'command')"), js.indexOf('const targets'));
  assert.match(cmdInspectBranch, /zone: 'hand'[\s\S]*zone: 'battlefield'[\s\S]*zone: 'graveyard'/);
  assert.doesNotMatch(cmdInspectBranch, /zone: 'exile'|zone: 'library'/);
  // 非主将（其余区）的牌不再提供「移到主将区」选项
  const generalInspectTargets = js.slice(js.indexOf('const targets'), js.indexOf('return targets.filter'));
  assert.doesNotMatch(generalInspectTargets, /zone: 'command'/);

  // 小卡面使用 small 图，详视仍使用 normal；衍生物保持文字瓦片
  assert.match(wxml, /class="card-art"/);
  assert.match(js, /art:\s*card\.token \|\| this\.lowMemoryMode \? '' : buildScryfallImageUrl\(card\.name, 'small'\)/);
  assert.match(js, /art:\s*this\.lowMemoryMode \? '' : buildScryfallImageUrl\(card\.name, 'small'\)/);
  assert.match(js, /wx\.onMemoryWarning/);
  assert.match(js, /DRAG_RENDER_INTERVAL_MS\s*=\s*32/);
  assert.match(js, /syncManaView\(\)/);
  assert.match(wxss, /\.card-art\s*{[\s\S]*position:\s*absolute/);
  assert.match(wxss, /\.field-card\.token\s*{[\s\S]*border-style:\s*dashed/);

  // MTGO 导入与分享
  assert.match(js, /parseMtgoDeckText/);
  assert.match(js, /enableShareMenu/);
  assert.match(js, /onShareAppMessage\(\)/);
  assert.match(js, /onShareTimeline\(\)/);

  // 手牌横向轨道需要独立内容宽度，避免最后一张溢出右边框
  assert.match(wxml, /scroll-left="\{\{handScrollLeft\}\}"/);
  assert.match(wxml, /class="hand-track"/);
  assert.match(wxss, /\.hand-track\s*{[\s\S]*display:\s*inline-flex/);
  assert.match(wxss, /\.hand-track\s*{[\s\S]*padding-right:\s*8px/);
  assert.match(js, /scrollHandToEnd\(\)/);
  assert.doesNotMatch(wxml, /牌库 \{\{counts\.library\}\} · 手牌 \{\{counts\.hand\}\}/);
});

test('展示库顶模式：牌库检索面板 toggle + 库顶 art_crop 铺底牌库芯片', () => {
  const pageRoot = path.join(root, 'miniprogram/pages/playtest');
  const js = fs.readFileSync(path.join(pageRoot, 'playtest.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(pageRoot, 'playtest.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageRoot, 'playtest.wxss'), 'utf8');

  // toggle 只在牌库检索面板出现，文案随状态切换，绑定 toggleRevealTop
  assert.match(wxml, /wx:if="\{\{panelZone === 'library'\}\}"[^>]*bindtap="toggleRevealTop"/);
  assert.match(wxml, /\{\{revealTop \? '隐藏库顶' : '展示库顶'\}\}/);
  assert.match(js, /toggleRevealTop\(\)\s*{/);

  // 牌库芯片：有库顶图时挂 has-art 类并铺 art 图，label/count 仍在（边框保持默认白色，不随开启变色）
  assert.match(wxml, /class="zone-chip \{\{topCardArt \? 'has-art' : ''\}\}"/);
  assert.match(wxml, /<image[^>]*class="zone-top-art"[^>]*src="\{\{topCardArt\}\}"/);

  // 库顶图取 library[0] 的 art_crop 无字大画；关闭 / 空库时返回空串
  assert.match(js, /buildTopCardArt\(revealTop\)\s*{/);
  assert.match(js, /this\.game\.library\[0\]\.name,\s*'art_crop'/);
  assert.match(js, /if \(this\.lowMemoryMode \|\| !revealTop \|\| !this\.game \|\| !this\.game\.library\.length\) return '';/);

  // syncView 每次重算库顶图，抓牌 / 检索取牌 / 洗牌后自动跟随
  assert.match(js, /topCardArt: this\.buildTopCardArt\(this\.data\.revealTop\)/);

  // 新对局（导入 / 刷新）回到隐藏，不泄露新库顶
  const importBlock = js.slice(js.indexOf('importDeck()'), js.indexOf('measureZones()'));
  assert.match(importBlock, /revealTop: false/);
  const restartBlock = js.slice(js.indexOf('confirmRestart()'));
  assert.match(restartBlock, /revealTop: false/);

  // 视觉：铺底图绝对定位、带图芯片裁剪防逃逸、文字压黑边保可读；开启展示库顶后边框保持默认白色（不再挂 accent）
  assert.match(wxss, /\.zone-top-art\s*{[\s\S]*?position:\s*absolute/);
  assert.match(wxss, /\.zone-chip\.has-art\s*{[\s\S]*?overflow:\s*hidden/);
  assert.match(wxss, /\.zone-chip\.has-art \.zone-label[^{]*{[\s\S]*?text-shadow:/);
  assert.doesNotMatch(wxss, /\.zone-chip\.reveal-top/);
});

test('主将区呈现主将卡图（单主将居中 / 双拍档左右分屏）、坟场放逐恒显顶牌大画', () => {
  const pageRoot = path.join(root, 'miniprogram/pages/playtest');
  const js = fs.readFileSync(path.join(pageRoot, 'playtest.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(pageRoot, 'playtest.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageRoot, 'playtest.wxss'), 'utf8');

  // 主将区沿用 result-display 的 splitCommanderNames 拆分（对齐结算页拍档呈现）
  assert.match(js, /require\('\.\.\/\.\.\/utils\/result-display'\)/);
  assert.match(js, /buildCommandPreview\(\)\s*{/);
  assert.match(js, /splitCommanderNames\(card\.name\)/);

  // 单主将居中大画、双拍档左右分屏，全用 art_crop
  assert.match(wxml, /commandPreview\.mode === 'dual'/);
  assert.match(wxml, /class="zone-art-split"/);
  assert.match(wxml, /commandPreview\.mode === 'single'/);
  assert.match(js, /buildScryfallImageUrl\(faces\[0\], 'art_crop'\)/);
  assert.match(js, /buildScryfallImageUrl\(faces\[1\], 'art_crop'\)/);

  // 坟场 / 放逐：恒显「最上方=数组末位（最近置入）」一张 art_crop，无开关
  assert.match(js, /buildZoneTopArt\(zone\)\s*{/);
  assert.match(js, /cards\[cards\.length - 1\]\.name, 'art_crop'/);
  assert.match(js, /graveyardTopArt: this\.buildZoneTopArt\('graveyard'\)/);
  assert.match(js, /exileTopArt: this\.buildZoneTopArt\('exile'\)/);
  assert.match(wxml, /class="zone-chip \{\{graveyardTopArt \? 'has-art' : ''\}\}"/);
  assert.match(wxml, /class="zone-chip \{\{exileTopArt \? 'has-art' : ''\}\}"/);
  assert.match(wxml, /<image wx:if="\{\{graveyardTopArt\}\}" class="zone-top-art"/);
  assert.match(wxml, /<image wx:if="\{\{exileTopArt\}\}" class="zone-top-art"/);

  // 三区随对局变化：均由 syncView 重算
  assert.match(js, /commandPreview: this\.buildCommandPreview\(\)/);

  // 视觉：双拍档左右各半
  assert.match(wxss, /\.zone-art-split\s*{[\s\S]*?display:\s*flex/);
  assert.match(wxss, /\.zone-art-half\s*{[\s\S]*?flex:\s*1/);
});

test('主页入口：playtest 导航完整，反馈模块已移除', () => {
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxss'), 'utf8');

  assert.match(wxml, /home-button-playtest/);
  assert.match(wxml, /套牌试玩/);
  // 首页入口排在第四位（01–08 序号文字已撤，改用行的 key 顺序定位）
  assert.equal(
    Array.from(wxml.matchAll(/class="home-button home-button-([a-z]+)/g), (m) => m[1])[3],
    'playtest',
  );
  assert.match(js, /goPlaytest/);

  // 反馈模块已清除，首页入口遵循统一的无装饰索引样式；标题可保留独立硬边投影
  assert.doesNotMatch(wxml, /feedback/);
  assert.doesNotMatch(js, /goFeedback|feedback/);
  assert.doesNotMatch(wxss, /feedback/);
  assert.doesNotMatch(wxss, /gradient|--home-accent/);
  assert.doesNotMatch(wxss, /\.home-button\s*{[^}]*text-shadow/);
  assert.match(wxss, /\.home\s*{[\s\S]*font-family:[^;]*HomePixel/);
  assert.ok(!fs.existsSync(path.join(root, 'miniprogram/pages/feedback')), 'feedback 页面目录应已删除');
  assert.ok(!fs.existsSync(path.join(root, 'miniprogram/config/feedback.js')), 'feedback 配置应已删除');
});

// 拖错一张牌只能重开是不可接受的：保留一步局面快照，且快照必须与现局面完全脱钩
test('cloneGame snapshots every zone independently for one-step undo', () => {
  const {
    PLAYTEST_ZONES,
    cloneGame,
    createGame,
    moveCard,
    toggleTapped,
    adjustCardCounters,
    countZones,
  } = require('../miniprogram/utils/playtest');

  const parsed = {
    main: [{ count: 40, name: 'Island' }, { count: 20, name: 'Brainstorm' }],
    commanders: [{ count: 1, name: 'Kinnan, Bonder Prodigy' }],
  };
  const game = createGame(parsed);
  const before = countZones(game);
  const snapshot = cloneGame(game);

  assert.deepEqual(Object.keys(snapshot).sort(), PLAYTEST_ZONES.slice().sort());
  assert.deepEqual(countZones(snapshot), before);

  // 快照里的卡与现局面不是同一批对象
  assert.notEqual(snapshot.hand[0], game.hand[0]);

  // 之后的移动 / 横置 / 指示物都不能回写进快照
  const moving = game.hand[0];
  moveCard(game, 'hand', moving.id, 'graveyard');
  toggleTapped(game, game.battlefield[0] ? game.battlefield[0].id : moving.id);
  adjustCardCounters(snapshot.hand[0], 'generic', 0);
  adjustCardCounters(game.hand[0], 'generic', 3);

  assert.equal(countZones(game).hand, before.hand - 1);
  assert.deepEqual(countZones(snapshot), before, '快照的区计数不随现局面变化');
  assert.ok(snapshot.hand.some((card) => card.id === moving.id), '被移走的牌仍留在快照里');
  assert.equal(snapshot.hand[0].counters, undefined, '指示物不共享引用');

  // 把快照装回去就是撤销：区计数回到动作之前
  assert.deepEqual(countZones(cloneGame(snapshot)), before);
});

test('playtest exposes one-step undo on the board without multi-level history', () => {
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/playtest/playtest.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/playtest/playtest.wxml'), 'utf8');

  assert.match(js, /captureUndo\(label\)\s*{[\s\S]*this\.undoSnapshot = \{ game: cloneGame\(this\.game\), label \}/);
  assert.match(js, /undoLastAction\(\)\s*{[\s\S]*this\.game = game[\s\S]*this\.syncView\(\)/);
  assert.match(wxml, /wx:if="\{\{canUndo\}\}"[\s\S]{0,160}bindtap="undoLastAction">撤销/);

  // 每条会改局面的路径都先留快照：抓牌 / 打出 / 横置 / 拖放 / 随机弃 / 面板移动
  ['抓牌', '打出', '横置', '收回手牌', '随机弃牌'].forEach((label) => {
    assert.ok(js.includes(`this.captureUndo('${label}')`), `${label} 应留下撤销快照`);
  });
  assert.ok((js.match(/this\.captureUndo\('移动'\)/g) || []).length >= 3, '拖放与面板移动都要可撤销');

  // 只保留一步：不引入历史栈
  assert.doesNotMatch(js, /undoStack|undoHistory|\.undoSnapshots/);
  // 新开局与已确认的刷新都不该还能撤回上一局面
  assert.match(js, /this\.undoSnapshot = null;\s*\n\s*this\.setData\(\{ canUndo: false \}\)/);
});

// 打出第一张牌后「撤销」出现，顶栏按钮从 4 颗变 5 颗。这一行原本就只剩 22rpx 余量，
// 多一颗直接溢出 82rpx，而 min-width 挡住收缩，于是 CJK 标签在按钮内断字
// （随机弃 → 随机/弃），看着就是换行加不对称。
test('对局顶栏在「撤销」出现后仍能单行放下，且标签不断字', () => {
  const wxss = fs.readFileSync(path.join(root, 'miniprogram/pages/playtest/playtest.wxss'), 'utf8');
  const T = 24; // --cedh-text-12
  const width = (text) => Array.from(text)
    .reduce((sum, ch) => sum + (/[一-鿿]/.test(ch) ? T : T * 0.5), 0);

  // 用 indexOf 切规则块，不用拼正则——避免转义在不同写入路径下被吃掉
  const rule = (name) => {
    const start = wxss.indexOf(`.${name} {`);
    assert.notEqual(start, -1, `未找到 .${name} 规则`);
    return wxss.slice(start, wxss.indexOf('}', start) + 1);
  };
  const num = (source, prop) => {
    const matched = source.split('\n').find((line) => line.trim().startsWith(`${prop}:`));
    assert.ok(matched, `规则里没有 ${prop}`);
    return Number(matched.replace(/[^0-9]/g, ''));
  };

  const actionRule = rule('board-action');
  // 标签绝不允许在按钮内断字——这是这个 bug 的硬保证
  assert.match(actionRule, /white-space:\s*nowrap/);
  // 读数区不能被按钮挤窄
  assert.match(rule('board-left'), /flex-shrink:\s*0/);
  // 兜底：真机字体度量与估算有出入时整块换行，而不是挤压
  assert.match(rule('board-top'), /flex-wrap:\s*wrap/);
  assert.match(rule('board-actions'), /flex-wrap:\s*wrap/);

  const minW = num(actionRule, 'min-width');
  const padX = Number(actionRule.match(/padding:\s*0\s+(\d+)rpx/)[1]);
  const gap = 8; // --cedh-space-1
  const button = (label) => Math.max(minW, width(label) + padX * 2);

  const readouts = width('手牌 7') + 16 + (56 + 4 + 56 + 4 + 56);
  const available = 750 - 24 * 2; // 页面左右各 --cedh-space-4
  const labels = ['撤销', 'Token', '随机弃', '刷新', '重置'];
  const actions = labels.reduce((sum, label) => sum + button(label), 0) + (labels.length - 1) * gap;

  assert.ok(readouts + actions <= available,
    `五颗按钮时顶栏需 ${readouts + actions}rpx，超过可用 ${available}rpx——会挤压出断字`);
});
