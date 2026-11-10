const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createCabbageState,
  tokenNeedsTap,
  castTokens,
  tapToken,
  removeToken,
  cabbageActivate,
  cabbageAvailable,
  untapAll,
  untapOneFood,
  calculateMana,
} = require('../miniprogram/utils/cabbage');
const { cabbageConfig } = require('../miniprogram/config/cabbage');

const root = path.join(__dirname, '..');

test('对手施法：Cabbage 造 Food，Academy Manufactor 再补 Clue/Treasure', () => {
  let state = createCabbageState();
  // Cabbage + Manufactor：Food / Clue / Treasure 各 1（三倍膨胀需要 Cabbage 先造出 Food 作底）
  state = castTokens(state, { cabbage: true, manufactor: true });
  assert.deepEqual([state.food.u, state.clue.u, state.treasure.u], [1, 1, 1]);
  // 仅 Cabbage：只补 1 个 Food
  state = castTokens(state, { cabbage: true });
  assert.deepEqual([state.food.u, state.clue.u, state.treasure.u], [2, 1, 1]);
});

test('Peregrin Took：造 token 的事件额外多造 1 Food，空放不触发', () => {
  // 只有 Peregrin、没有任何产 token 的引擎：本次施放没造 token → Peregrin 不触发
  let state = castTokens(createCabbageState(), { peregrin: true });
  assert.deepEqual([state.food.u, state.clue.u, state.treasure.u], [0, 0, 0]);

  // Cabbage + Peregrin：Cabbage 造 1 Food，Peregrin 再额外 +1 → 2 Food
  state = castTokens(createCabbageState(), { cabbage: true, peregrin: true });
  assert.deepEqual([state.food.u, state.clue.u, state.treasure.u], [2, 0, 0]);

  // 两者都是替代效应，Cabbage 不在场时没有事件可替换。
  state = castTokens(createCabbageState(), { manufactor: true, peregrin: true });
  assert.deepEqual([state.food.u, state.clue.u, state.treasure.u], [0, 0, 0]);

  // 三件套：先应用 Peregrin，再应用 Manufactor，Food/Clue/Treasure 各 2。
  state = castTokens(createCabbageState(), { cabbage: true, manufactor: true, peregrin: true });
  assert.deepEqual([state.food.u, state.clue.u, state.treasure.u], [2, 2, 2]);
});

test('删减优先删已横置，保住未横置资源', () => {
  let state = createCabbageState();
  state.food = { u: 2, t: 1 };
  state = removeToken(state, 'food');
  assert.deepEqual(state.food, { u: 2, t: 0 });
  state = removeToken(state, 'food');
  assert.deepEqual(state.food, { u: 1, t: 0 });
});

test('Cabbage 凑对产费横置 2 Food，重置横置全部解开', () => {
  let state = createCabbageState();
  state.food = { u: 5, t: 0 };
  assert.equal(cabbageAvailable(state), 2);
  state = cabbageActivate(state);
  assert.deepEqual(state.food, { u: 3, t: 2 });
  state = untapAll(state);
  assert.deepEqual(state.food, { u: 5, t: 0 });
});

test('Clock of Omens 解 1 个横置 Food：一次只解 1 个，无横置则不变', () => {
  let state = createCabbageState();
  state.food = { u: 1, t: 2 };
  state = untapOneFood(state);
  assert.deepEqual(state.food, { u: 2, t: 1 });
  state = untapOneFood(state);
  assert.deepEqual(state.food, { u: 3, t: 0 });
  // 没有已横置 Food 时无操作
  assert.deepEqual(untapOneFood(state).food, { u: 3, t: 0 });
});

test('横置追踪自适应：Food 恒有，Clue 仅 Jaheira/Statuary，Treasure 从不', () => {
  assert.equal(tokenNeedsTap('food', {}), true);
  assert.equal(tokenNeedsTap('clue', {}), false);
  assert.equal(tokenNeedsTap('clue', { jaheira: true }), true);
  assert.equal(tokenNeedsTap('clue', { statuary: true }), true);
  // Treasure 与 Clue 同步：仅 Jaheira/Statuary 在场追踪横置（横置产 G 不牺牲）
  assert.equal(tokenNeedsTap('treasure', {}), false);
  assert.equal(tokenNeedsTap('treasure', { jaheira: true }), true);
  assert.equal(tokenNeedsTap('treasure', { statuary: true }), true);
  // 无 Jaheira/Statuary 时 Treasure 不可横置：tapToken 无效
  const idle = createCabbageState();
  idle.treasure = { u: 3, t: 0 };
  assert.deepEqual(tapToken(idle, 'treasure', {}).treasure, { u: 3, t: 0 });
  // Jaheira 在场：Treasure 可横置（未横置 → 横置，不牺牲）
  assert.deepEqual(tapToken(idle, 'treasure', { jaheira: true }).treasure, { u: 2, t: 1 });
});

test('可造法术力：绿有色优先 + 泛用 + Treasure 绿储备提示', () => {
  const state = createCabbageState();
  state.food = { u: 5, t: 0 };
  state.clue = { u: 2, t: 0 };
  state.treasure = { u: 3, t: 0 };

  // Cabbage + Statuary（无 Jaheira）：Food 成对产绿，单个零头 + Clue 落泛用
  let mana = calculateMana(state, { cabbage: true, statuary: true });
  assert.equal(mana.green, 2);
  assert.equal(mana.generic, 3);
  assert.equal(mana.treasure, 3);

  // Jaheira：Food + Clue 每个产绿，无泛用
  mana = calculateMana(state, { jaheira: true });
  assert.equal(mana.green, 7);
  assert.equal(mana.generic, 0);
  assert.equal(mana.treasure, 3);

  // 仅 Cabbage：只有 Food 成对产绿，Clue 无贡献
  mana = calculateMana(state, { cabbage: true });
  assert.equal(mana.green, 2);
  assert.equal(mana.generic, 0);
});

test('config 引擎只留卡名、无解释文字', () => {
  assert.equal(cabbageConfig.engines.length, 4);
  cabbageConfig.engines.forEach((engine) => {
    assert.ok(engine.key && engine.name);
    assert.ok(!engine.desc && !engine.d && !engine.explain);
  });
  assert.deepEqual(cabbageConfig.engines.map((engine) => engine.name), [
    'The Cabbage Merchant',
    'Jaheira, Friend of the Forest',
    'Academy Manufactor',
    'Peregrin Took',
  ]);
});

test('卷心菜对账是独立全屏页，绿/白文本分色、常亮、切出重置', () => {
  const root2 = path.join(root, 'miniprogram/pages/cabbage');
  const wxml = fs.readFileSync(path.join(root2, 'cabbage.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root2, 'cabbage.wxss'), 'utf8');
  const js = fs.readFileSync(path.join(root2, 'cabbage.js'), 'utf8');
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const randomJs = fs.readFileSync(path.join(root, 'miniprogram/pages/random/random.js'), 'utf8');
  const randomWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/random/random.wxml'), 'utf8');

  // 已注册为独立页，且从混沌工具页有入口
  assert.ok(appJson.pages.includes('pages/cabbage/cabbage'));
  assert.match(randomJs, /goCabbage\(\)\s*{[\s\S]*?navigateTo\([\s\S]*?\/pages\/cabbage\/cabbage/);
  assert.match(randomWxml, /bindtap="goCabbage"/);
  // 混沌工具页不再内联卷心菜面板
  assert.doesNotMatch(randomWxml, /cabbage-panel|toggleCabbageEngine/);

  // 标题在导航栏（navigationBarTitleText），页面内不再重复标题
  assert.equal(JSON.parse(fs.readFileSync(path.join(root2, 'cabbage.json'), 'utf8')).navigationBarTitleText, '卷心菜对账');
  assert.match(wxml, /class="page cabbage-page"/);
  assert.match(wxml, /bindtap="toggleCabbageEngine"/);
  assert.match(wxml, /bindtap="cabbageCast"/);
  assert.match(wxml, /bindtap="cabbageActivate"/);
  assert.match(wxml, /bindtap="cabbageTapToken"/);
  // 底部：撤销 + 全部重置（untapAll）+ 重置 1 个食品（Clock of Omens 解 1 个横置的食品）+ 清空；衍生物用官方简中名
  assert.match(wxml, /bindtap="cabbageUndo"[^>]*>撤销/);
  assert.match(wxml, /bindtap="cabbageUntapAll"[^>]*>全部重置/);
  assert.match(wxml, /bindtap="cabbageUntapOneFood"[^>]*>重置 1 个食品/);
  assert.ok(wxml.indexOf('bindtap="cabbageUndo"') < wxml.indexOf('bindtap="cabbageUntapAll"'), '撤销排在底栏最左，和伊捷风暴一样');
  // 2026-11-10 用户拍板：清空没有撤销而伊捷风暴有，是同类操作不同确认强度（ux-goals B、E）。
  // 撤销的行为由下面「卷心菜撤销」那条测试驱动页面对象核对，这里只看每个改衍生物的处理器都走同一个入口。
  const pageJs = fs.readFileSync(path.join(root2, 'cabbage.js'), 'utf8');
  ['cabbageCast', 'cabbageAddToken', 'cabbageTapToken', 'cabbageRemoveToken', 'cabbageActivate', 'cabbageUntapAll', 'cabbageUntapOneFood', 'cabbageReset']
    .forEach((name) => {
      assert.match(pageJs, new RegExp(`\\n  ${name}\\((?:event)?\\)\\s*{[^}]*this\\.commitCabbage\\(`), `${name} 要经 commitCabbage 落地`);
    });
  assert.doesNotMatch(pageJs, /this\.cabbageState = (?!next;|this\.cabbageHistory\.pop\(\);|createCabbageState\(\);)/, '除了 commitCabbage 与撤销，别处不直接改状态');
  assert.match(wxml, /wx:for="\{\{cabbageEngineList\}\}"/);
  assert.doesNotMatch(wxml, /征募抵泛用|产出三倍|每 token → 绿/);
  // 绿法术力 = 绿色 accent 文本；泛用 = 白；页根将 accent 覆盖为绿
  assert.match(wxss, /\.cabbage-page\s*{[\s\S]*?--cedh-accent:\s*#2fa75d/);
  assert.match(wxss, /\.cabbage-green\s*{[\s\S]*?color:\s*var\(--cedh-accent\)/);
  // 仪表微标签消费 rgba(var(--module-accent-rgb))：页根必须定义该变量，否则整条声明失效回退暗色
  assert.match(wxss, /\.cabbage-page\s*{[\s\S]*?--module-accent-rgb:\s*47,\s*167,\s*93/);
  assert.match(wxss, /\.cabbage-token-ctrls\s*{[\s\S]*?display:\s*grid/);
  assert.match(wxml, /class="cabbage-ctrl-slot"/);
  assert.match(js, /calculateMana/);
  // 常亮 + 每次进入重置引擎（切出自动 deselect）
  assert.match(js, /wx\.setKeepScreenOn/);
  assert.match(js, /onLoad\(\)\s*{[\s\S]*?cabbageConfig\.defaultEngines/);
});

// 驱动真实页面对象：stub 掉 Page 与 wx，按用户的点按顺序调处理器
function openCabbagePage() {
  const originalPage = global.Page;
  const originalWx = global.wx;
  let definition = null;
  global.Page = (config) => { definition = config; };
  global.wx = { showShareMenu: () => {}, setKeepScreenOn: () => {} };
  const modulePath = require.resolve('../miniprogram/pages/cabbage/cabbage.js');
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
  return { page, restore: () => { global.wx = originalWx; } };
}

const tokenTap = (key) => ({ currentTarget: { dataset: { key } } });

// 2026-11-10 代码审查：每个处理器原先先存快照、再算状态，无效点击也进历史。加 1 个食品、点一次
// 「横置 2 个食品」（只有 1 个，不生效）、再撤销，食品还是 1 个；连点 50 次无效横置还会把真实操作挤出历史。
test('卷心菜撤销：只记真实改动，无效点击不占撤销位、挤不掉之前的操作', () => {
  const { page, restore } = openCabbagePage();
  try {
    const food = () => page.data.cabbageTokens.find((token) => token.key === 'food');
    page.cabbageAddToken(tokenTap('food'));
    assert.equal(food().u, 1);
    page.cabbageActivate();
    assert.equal(food().u, 1, '只有 1 个未横置的食品，横置 2 个不生效');
    page.cabbageUndo();
    assert.equal(food().u, 0, '撤销退掉的是加食品，不是那次无效横置');

    page.cabbageAddToken(tokenTap('food'));
    for (let i = 0; i < 60; i += 1) page.cabbageActivate();
    // 其余几种无效点击：计数已是 0 时删减、没开贾希拉时横置线索、没有横置的食品时重置 1 个、
    // 引擎全关时对手施法、什么都没横置时全部重置
    page.cabbageRemoveToken(tokenTap('clue'));
    page.cabbageTapToken(tokenTap('clue'));
    page.cabbageUntapOneFood();
    page.cabbageCast();
    page.cabbageUntapAll();
    assert.equal(page.cabbageHistory.length, 1, '这些都没改状态，历史里只有加食品那一步');
    page.cabbageUndo();
    assert.equal(food().u, 0, '连点 60 次无效横置后，撤销仍退回加食品之前');

    page.cabbageReset();
    assert.equal(page.cabbageHistory.length, 0, '全空时点清空不进历史');
  } finally {
    restore();
  }
});

test('卷心菜撤销：每种真实操作都能逐步退回，引擎开关不进历史，历史封顶 50 步', () => {
  const { page, restore } = openCabbagePage();
  try {
    page.toggleCabbageEngine(tokenTap('cabbage'));
    const steps = [
      ['cabbageAddToken', tokenTap('food')],
      ['cabbageAddToken', tokenTap('food')],
      ['cabbageAddToken', tokenTap('food')],
      ['cabbageActivate'],
      ['cabbageUntapOneFood'],
      ['cabbageTapToken', tokenTap('food')],
      ['cabbageUntapAll'],
      ['cabbageRemoveToken', tokenTap('food')],
      ['cabbageCast'],
      ['cabbageReset'],
    ];
    const seen = [JSON.stringify(page.cabbageState)];
    steps.forEach(([name, event]) => {
      page[name](event);
      const now = JSON.stringify(page.cabbageState);
      assert.notEqual(now, seen[seen.length - 1], `${name} 在这一步应当改了状态`);
      seen.push(now);
    });
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      page.cabbageUndo();
      assert.equal(JSON.stringify(page.cabbageState), seen[i], `撤销 ${steps[i][0]} 后回到上一步`);
    }
    page.cabbageUndo();
    assert.equal(JSON.stringify(page.cabbageState), seen[0], '历史空了，撤销什么都不做');
    assert.equal(page.cabbageEngines.cabbage, true, '撤销不动引擎开关');

    page.cabbageAddToken(tokenTap('food'));
    page.toggleCabbageEngine(tokenTap('jaheira'));
    page.cabbageUndo();
    assert.equal(page.cabbageState.food.u, 0);
    assert.equal(page.cabbageEngines.jaheira, true, '引擎开关不进历史');

    for (let i = 0; i < 55; i += 1) page.cabbageAddToken(tokenTap('treasure'));
    for (let i = 0; i < 60; i += 1) page.cabbageUndo();
    assert.equal(page.cabbageState.treasure.u, 5, '只保留最近 50 步');
  } finally {
    restore();
  }
});
