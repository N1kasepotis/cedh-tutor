const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createStormState,
  krarkTriggerCount,
  flipWin,
  castInstantSorcery,
  castOtherSpell,
  adjustCounter,
} = require('../miniprogram/utils/izzet-storm');
const { izzetStormConfig } = require('../miniprogram/config/izzet-storm');

const root = path.join(__dirname, '..');
const alwaysWin = () => 0;   // 0 < 0.5 → 正面
const alwaysLose = () => 0.9;

test('Krark 触发数：本体 1，按 Krark 份数放大，无 Krark 则 0', () => {
  // Sakashima/Spark Double 复制 Krark 由页面侧 krarkCount 计数表达，不再是独立引擎
  assert.equal(krarkTriggerCount({ krark: true }), 1);
  assert.equal(krarkTriggerCount({ krark: true }, 2), 2);
  assert.equal(krarkTriggerCount({ krark: true }, 3), 3);
  assert.equal(krarkTriggerCount({}), 0);
  assert.equal(krarkTriggerCount({}, 4), 0);
});

test("Krark's Thumb：抛 2 取 1，任一正面即赢", () => {
  assert.equal(flipWin(false, alwaysWin), true);
  assert.equal(flipWin(false, alwaysLose), false);
  assert.equal(flipWin(true, alwaysLose), false);
  // 序列 [输, 赢] → 取 1 → 赢
  const seq = (values) => { let i = 0; return () => values[i++]; };
  assert.equal(flipWin(true, seq([0.9, 0.1])), true);
  assert.equal(flipWin(true, seq([0.9, 0.9])), false);
});

test('施放瞬间/法术全赢：2 份 Krark → 复制 2、storm/spells+1', () => {
  const s = castInstantSorcery(createStormState(), { krark: true }, alwaysWin, 2);
  assert.equal(s.copies, 2);
  assert.equal(s.wins, 2);
  assert.equal(s.losses, 0);
  assert.equal(s.storm, 1);
  assert.equal(s.spells, 1);
  assert.equal(s.lastCopies, 2);
});

test('施放全输：无复制，Ral, Monsoon Mage 抛输自伤', () => {
  const engines = { krark: true, krarksThumb: true, ralMonsoon: true };
  const s = castInstantSorcery(createStormState(), engines, alwaysLose, 2);
  assert.equal(s.copies, 0);
  assert.equal(s.selfDamage, 1);
  assert.equal(s.losses, 3); // 2 份 Krark + 1 Monsoon 全输
  assert.equal(s.storm, 1);
});

test('施放其他咒语只加 storm，不抛币不加 spells', () => {
  const s = castOtherSpell(createStormState());
  assert.equal(s.storm, 1);
  assert.equal(s.spells, 0);
  assert.equal(s.lastCopies, 0);
});

test('手动校正 ±1 且不低于 0', () => {
  let s = createStormState();
  s = adjustCounter(s, 'storm', 3);
  assert.equal(s.storm, 3);
  s = adjustCounter(s, 'storm', -5);
  assert.equal(s.storm, 0);
  // 未知字段不崩
  assert.deepEqual(adjustCounter(createStormState(), 'nope', 1), createStormState());
});

test('config 引擎只留卡名、无解释文字', () => {
  assert.equal(izzetStormConfig.engines.length, 3);
  izzetStormConfig.engines.forEach((engine) => {
    assert.ok(engine.key && engine.name);
    assert.ok(!engine.desc && !engine.d && !engine.explain);
  });
  assert.ok(izzetStormConfig.engines.some((e) => e.name === 'Krark, the Thumbless'));
  assert.ok(izzetStormConfig.engines.some((e) => e.name === "Krark's Thumb"));
  // Ral, Storm Conduit 与 EDH 非法的 Krark's Other Thumb 均已移除
  assert.ok(!izzetStormConfig.engines.some((e) => e.name === 'Ral, Storm Conduit'));
  assert.ok(!izzetStormConfig.engines.some((e) => /Other Thumb/.test(e.name)));
});

test('伊捷风暴是独立全屏页，蓝色 accent + 红色自伤/输、常亮、切出重置', () => {
  const root2 = path.join(root, 'miniprogram/pages/izzet');
  const wxml = fs.readFileSync(path.join(root2, 'izzet.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root2, 'izzet.wxss'), 'utf8');
  const js = fs.readFileSync(path.join(root2, 'izzet.js'), 'utf8');
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const randomJs = fs.readFileSync(path.join(root, 'miniprogram/pages/random/random.js'), 'utf8');
  const randomWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/random/random.wxml'), 'utf8');

  assert.ok(appJson.pages.includes('pages/izzet/izzet'));
  assert.match(randomJs, /goIzzet\(\)\s*{[\s\S]*?navigateTo\([\s\S]*?\/pages\/izzet\/izzet/);
  assert.match(randomWxml, /bindtap="goIzzet"/);
  assert.doesNotMatch(randomWxml, /izzet-panel|toggleIzzetEngine/);

  // 标题在导航栏（navigationBarTitleText），页面内不再重复标题
  assert.equal(JSON.parse(fs.readFileSync(path.join(root2, 'izzet.json'), 'utf8')).navigationBarTitleText, '伊捷风暴');
  assert.match(wxml, /class="page izzet-page"/);
  assert.match(wxml, /bindtap="stormCastSpell"/);
  assert.match(wxml, /bindtap="stormCastOther"/);
  assert.match(wxml, /bindtap="stormAdjust"/);
  assert.match(wxml, /bindtap="stormUndo"/);
  assert.match(wxml, /wx:for="\{\{izzetEngineList\}\}"/);
  assert.doesNotMatch(wxml, /抛\s*2\s*取\s*1|复制该咒语|每次施法触发两个/);
  // 蓝主题 + 红自伤（页根覆盖 accent 为蓝）
  assert.match(wxss, /\.izzet-page\s*{[\s\S]*?--cedh-accent:\s*#5aa9ff/);
  assert.match(wxss, /\.izzet-stat-dmg\s*\.izzet-stat-value\s*{[\s\S]*?color:\s*#e0655c/);
  assert.match(js, /castInstantSorcery/);
  // 常亮 + 每次进入重置引擎
  assert.match(js, /wx\.setKeepScreenOn/);
  assert.match(js, /onLoad\(\)\s*{[\s\S]*?izzetStormConfig\.defaultEngines/);
});
