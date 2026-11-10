const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createStormState,
  flipWin,
  castInstantSorcery,
  castOtherSpell,
  shouldPromptRalUltimate,
  adjustCounter,
} = require('../miniprogram/utils/izzet-storm');
const { izzetStormConfig } = require('../miniprogram/config/izzet-storm');

const root = path.join(__dirname, '..');
const alwaysWin = () => 0;   // 0 < 0.5 → 正面
const alwaysLose = () => 0.9;

test('Ral 每次触发只抛一次硬币', () => {
  let calls = 0;
  assert.equal(flipWin(() => { calls += 1; return 0; }), true);
  assert.equal(calls, 1);
  assert.equal(flipWin(alwaysLose), false);
});

test('Ral 抛赢：记录一次胜利并增加 storm/spells', () => {
  const s = castInstantSorcery(createStormState(), { ralMonsoon: true }, alwaysWin);
  assert.equal(s.wins, 1);
  assert.equal(s.losses, 0);
  assert.equal(s.selfDamage, 0);
  assert.equal(s.storm, 1);
  assert.equal(s.spells, 1);
  assert.ok(!Object.prototype.hasOwnProperty.call(s, 'copies'));
});

test('Ral 抛输：记录一次失败与 1 点自伤', () => {
  const s = castInstantSorcery(createStormState(), { ralMonsoon: true }, alwaysLose);
  assert.equal(s.selfDamage, 1);
  assert.equal(s.losses, 1);
  assert.equal(s.storm, 1);
});

test('Ral 已转化或不在场时不抛币，但仍记录施放数', () => {
  let calls = 0;
  const s = castInstantSorcery(createStormState(), { ralMonsoon: false }, () => { calls += 1; return 0; });
  assert.equal(calls, 0);
  assert.equal(s.wins + s.losses + s.selfDamage, 0);
  assert.equal(s.storm, 1);
  assert.equal(s.spells, 1);
});

test('瞬间/法术达到 6 次且本次抛赢时才提示转化可开大', () => {
  const five = adjustCounter(createStormState(), 'spells', 5);
  const sixthWin = castInstantSorcery(five, { ralMonsoon: true }, alwaysWin);
  assert.equal(shouldPromptRalUltimate(five, sixthWin), true);

  const four = adjustCounter(createStormState(), 'spells', 4);
  const fifthWin = castInstantSorcery(four, { ralMonsoon: true }, alwaysWin);
  assert.equal(shouldPromptRalUltimate(four, fifthWin), false);

  const sixthLoss = castInstantSorcery(five, { ralMonsoon: true }, alwaysLose);
  assert.equal(shouldPromptRalUltimate(five, sixthLoss), false);

  const sixthNoRal = castInstantSorcery(five, { ralMonsoon: false }, alwaysWin);
  assert.equal(shouldPromptRalUltimate(five, sixthNoRal), false);
});

test('施放其他咒语只加 storm，不抛币不加 spells', () => {
  const s = castOtherSpell(createStormState());
  assert.equal(s.storm, 1);
  assert.equal(s.spells, 0);
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
  assert.equal(izzetStormConfig.engines.length, 1);
  izzetStormConfig.engines.forEach((engine) => {
    assert.ok(engine.key && engine.name);
    assert.ok(!engine.desc && !engine.d && !engine.explain);
  });
  assert.equal(izzetStormConfig.engines[0].name, 'Ral, Monsoon Mage');
  assert.deepEqual(izzetStormConfig.defaultEngines, { ralMonsoon: false });
  assert.doesNotMatch(JSON.stringify(izzetStormConfig), /Krark|Thumb/i);
});

test('伊捷风暴是 Ral 专用全屏页，蓝色 accent + 红色自伤/输并保持常亮', () => {
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
  assert.match(randomWxml, /Ral, Monsoon Mage/);
  assert.doesNotMatch(randomWxml, /Krark|Thumb/);
  assert.doesNotMatch(randomWxml, /izzet-panel|toggleIzzetEngine/);

  // 标题在导航栏（navigationBarTitleText），页面内不再重复标题
  assert.equal(JSON.parse(fs.readFileSync(path.join(root2, 'izzet.json'), 'utf8')).navigationBarTitleText, '伊捷风暴');
  assert.match(wxml, /class="page izzet-page"/);
  assert.match(wxml, /bindtap="stormCastSpell"/);
  assert.match(wxml, /bindtap="stormCastOther"/);
  assert.match(wxml, /bindtap="stormAdjust"/);
  assert.match(wxml, /bindtap="stormUndo"/);
  assert.match(wxml, /wx:for="\{\{izzetEngineList\}\}"/);
  assert.match(wxml, /\{\{item\.name\}\}/);
  assert.match(wxml, /不在场 \/ 已转化/);
  assert.doesNotMatch(wxml, /你的回合每次施放|赢可转化|输则自伤/);
  assert.doesNotMatch(wxml, /Krark|Thumb|复制/);
  // 蓝主题 + 红自伤（页根覆盖 accent 为蓝）
  assert.match(wxss, /\.izzet-page\s*{[\s\S]*?--cedh-accent:\s*#5aa9ff/);
  assert.match(wxss, /\.izzet-stat-dmg\s*\.izzet-stat-value\s*{[\s\S]*?color:\s*#e0655c/);
  // 仪表微标签消费 rgba(var(--module-accent-rgb))：页根必须定义该变量，否则整条声明失效回退暗色
  assert.match(wxss, /\.izzet-page\s*{[\s\S]*?--module-accent-rgb:\s*90,\s*169,\s*255/);
  assert.match(js, /castInstantSorcery/);
  assert.match(js, /shouldPromptRalUltimate/);
  assert.match(js, /title:\s*'转化可开大'/);
  assert.doesNotMatch(js, /title:\s*'Ral 可转化'/);
  assert.doesNotMatch(js, /krark|copies|lastCopies|Thumb/i);
  assert.doesNotMatch(wxss, /krark|copies/i);
  // 常亮 + 每次进入让 Ral 默认不在场
  assert.match(js, /wx\.setKeepScreenOn/);
  assert.match(js, /onLoad\(\)\s*{[\s\S]*?izzetStormConfig\.defaultEngines/);
});

function openIzzetPage() {
  const originalPage = global.Page;
  const originalWx = global.wx;
  let definition = null;
  const toasts = [];
  global.Page = (config) => { definition = config; };
  global.wx = { showShareMenu: () => {}, setKeepScreenOn: () => {}, showToast: (options) => toasts.push(options.title) };
  const modulePath = require.resolve('../miniprogram/pages/izzet/izzet.js');
  delete require.cache[modulePath];
  try {
    require(modulePath);
  } finally {
    global.Page = originalPage;
  }
  const page = Object.assign(Object.create(definition), {
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(patch) { Object.assign(this.data, patch); },
  });
  page.onLoad();
  return { page, toasts, restore: () => { global.wx = originalWx; } };
}

const adjust = (field, delta) => ({ currentTarget: { dataset: { field, delta: String(delta) } } });

// 2026-11-10 代码审查：和卷心菜同一个毛病，计数已是 0 时点 −、开局点「新回合」也会进历史，撤销要多按才退到真实操作
test('伊捷撤销：只记真实改动，计数为 0 时的 − 与开局的新回合不占撤销位', () => {
  const { page, restore } = openIzzetPage();
  try {
    page.stormReset();
    assert.equal(page.stormHistory.length, 0, '开局点新回合不进历史');
    page.stormCastOther();
    assert.equal(page.data.storm.storm, 1);
    for (let i = 0; i < 60; i += 1) page.stormAdjust(adjust('spells', -1));
    page.stormAdjust(adjust('selfDamage', -1));
    assert.equal(page.stormHistory.length, 1, '计数为 0 时的 − 不改状态');
    page.stormUndo();
    assert.equal(page.data.storm.storm, 0, '撤销退掉的是那次施法');

    const steps = [
      ['stormCastOther'],
      ['stormAdjust', adjust('spells', 1)],
      ['stormAdjust', adjust('spells', -1)],
      ['stormCastSpell'],
      ['stormAdjust', adjust('selfDamage', 1)],
      ['stormReset'],
    ];
    const seen = [JSON.stringify(page.stormState)];
    steps.forEach(([name, event]) => {
      page[name](event);
      const now = JSON.stringify(page.stormState);
      assert.notEqual(now, seen[seen.length - 1], `${name} 在这一步应当改了状态`);
      seen.push(now);
    });
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      page.stormUndo();
      assert.equal(JSON.stringify(page.stormState), seen[i], `撤销 ${steps[i][0]} 后回到上一步`);
      assert.equal(JSON.stringify(page.data.storm), seen[i], '界面跟着回退');
    }
  } finally {
    restore();
  }
});

test('伊捷施法：开大提示拿改动前的快照比，第 6 张赢币的瞬间法术提示一次', () => {
  const { page, toasts, restore } = openIzzetPage();
  const originalRandom = Math.random;
  Math.random = () => 0; // 0 < 0.5，次次正面
  try {
    page.toggleIzzetEngine({ currentTarget: { dataset: { key: 'ralMonsoon' } } });
    for (let i = 0; i < 5; i += 1) page.stormCastSpell();
    assert.deepEqual(toasts, [], '前 5 张不到开大条件');
    page.stormCastSpell();
    assert.deepEqual(toasts, ['转化可开大']);
    assert.equal(page.data.storm.wins, 6);
    page.stormUndo();
    assert.equal(page.data.storm.spells, 5, '施法也能撤销');
  } finally {
    Math.random = originalRandom;
    restore();
  }
});
