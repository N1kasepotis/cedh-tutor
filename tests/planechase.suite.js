const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const P = require('../miniprogram/utils/planechase');
const { PLANECHASE_CARDS } = require('../miniprogram/config/planechase');

const root = path.join(__dirname, '..');
const NEWLINE = String.fromCharCode(10);

// 确定性 rng：线性同余，够洗牌用，且每次跑出同一副牌
function seeded(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 数据快照
// ---------------------------------------------------------------------------

test('快照：50 张全中文，时空 45 / 异象 5，无同名', () => {
  assert.equal(PLANECHASE_CARDS.length, 50);
  const planes = PLANECHASE_CARDS.filter((row) => row[0] === 'P');
  const phenomena = PLANECHASE_CARDS.filter((row) => row[0] === 'X');
  assert.equal(planes.length, 45);
  assert.equal(phenomena.length, 5);

  PLANECHASE_CARDS.forEach((row, i) => {
    assert.equal(row.length, 7, `第 ${i} 条字段数不对`);
    // 中文名：没有中文字符说明这张卡没有简中印刷，不该进这份快照
    assert.match(row[1], /[一-鿿]/, `第 ${i} 条卡名不是中文：${row[1]}`);
    assert.match(row[2], /[一-鿿]/, `第 ${i} 条类别不是中文：${row[2]}`);
    assert.ok(row[3], `${row[1]} 没有正文`);
    assert.match(row[4], /^[0-9a-f]{8}-[0-9a-f]{4}-/, `${row[1]} 的 scryfallId 不合法`);
    assert.match(row[6], /^[0-9a-f]{8}-[0-9a-f]{4}-/, `${row[1]} 的 Oracle ID 不合法`);
  });

  // CR 901.3：同一副时空套牌内不得有同名牌
  const names = new Set(PLANECHASE_CARDS.map((row) => row[1]));
  assert.equal(names.size, PLANECHASE_CARDS.length, '快照里有同名牌');
});

test('快照：每张时空牌都有混沌异能，异象都没有', () => {
  PLANECHASE_CARDS.forEach((row) => {
    const hasChaos = row[3].split(NEWLINE).some((line) => P.CHAOS_LINE_PATTERN.test(line));
    if (row[0] === 'P') {
      assert.ok(hasChaos, `时空牌「${row[1]}」没有「每当引发混沌时」，掷出混沌将无从高亮`);
    } else {
      assert.ok(!hasChaos, `异象「${row[1]}」不该有混沌异能`);
    }
  });
});

test('快照：恰好一张牌会把空白改判为混沌（乙太混沦）', () => {
  // 不硬编卡名，但要锁住「只有一张」这件事——
  // Scryfall 改了文案会让这条红，而不是让骰面修正悄悄失效
  const hits = PLANECHASE_CARDS.filter((row) => P.BLANK_IS_CHAOS_PATTERN.test(row[3]));
  assert.equal(hits.length, 1, `命中 ${hits.length} 张：${hits.map((r) => r[1]).join('、')}`);
  assert.equal(hits[0][1], '乙太混沦');
  assert.equal(hits[0][0], 'X', '乙太混沦是异象');
});

test('cardAt 把正文拆成常驻与混沌两段', () => {
  const planeIndex = PLANECHASE_CARDS.findIndex((row) => row[0] === 'P');
  const card = P.cardAt(planeIndex);
  assert.equal(card.isPhenomenon, false);
  assert.ok(card.chaosLines.length >= 1);
  assert.ok(card.staticLines.length >= 1);
  card.chaosLines.forEach((line) => assert.match(line, P.CHAOS_LINE_PATTERN));
  card.staticLines.forEach((line) => assert.doesNotMatch(line, P.CHAOS_LINE_PATTERN));
  // 两段合起来必须是原文的全部非空行，不能丢句子
  const raw = PLANECHASE_CARDS[planeIndex][3].split(NEWLINE).filter((l) => l.trim());
  assert.equal(card.staticLines.length + card.chaosLines.length, raw.length);

  const phenomenonIndex = PLANECHASE_CARDS.findIndex((row) => row[0] === 'X');
  const phenomenon = P.cardAt(phenomenonIndex);
  assert.equal(phenomenon.isPhenomenon, true);
  assert.equal(phenomenon.chaosLines.length, 0);

  assert.equal(P.cardAt(-1), null);
  assert.equal(P.cardAt(9999), null);
});

// ---------------------------------------------------------------------------
// 建库合规（CR 901.15a 单一共享时空套牌）
// ---------------------------------------------------------------------------

test('建库：张数与异象数按人数合规，两人局必须裁掉一张异象', () => {
  [1, 2, 3, 4, 5, 6].forEach((players) => {
    const limits = P.planarDeckLimits(players);
    assert.equal(limits.minCards, Math.min(40, 10 * players));
    assert.equal(limits.maxPhenomena, 2 * players);

    const game = P.createGame(players, seeded(7 + players));
    const total = game.planarDeck.length + game.activePlanes.length;
    assert.ok(total >= limits.minCards, `${players} 人局只有 ${total} 张，低于下限 ${limits.minCards}`);

    const all = game.planarDeck.concat(game.activePlanes);
    const phenomena = all.filter((i) => PLANECHASE_CARDS[i][0] === 'X').length;
    assert.ok(phenomena <= limits.maxPhenomena,
      `${players} 人局有 ${phenomena} 张异象，超过上限 ${limits.maxPhenomena}`);
    // 裁掉多少必须如实报出来，界面要写明——不能默默少牌
    assert.equal(game.trimmed.length, Math.max(0, 5 - limits.maxPhenomena));
  });

  // 两人局上限 4，本地有 5 张异象，必然裁掉恰好一张
  const two = P.createGame(2, seeded(11));
  assert.equal(two.trimmed.length, 1);
  assert.match(two.trimmed[0], /[一-鿿]/);
});

test('开局时空不可能是异象（CR 901.5），且过程中不触发任何异能', () => {
  // 用大量不同种子确保不是碰巧
  for (let seed = 0; seed < 200; seed += 1) {
    const game = P.createGame(4, seeded(seed));
    assert.equal(game.activePlanes.length, 1);
    const card = P.cardAt(game.activePlanes[0]);
    assert.equal(card.isPhenomenon, false, `种子 ${seed} 的开局翻出了异象`);
    // 901.5 明写此过程中异能不触发：乙太混沦若被翻过也不得留下骰面修正
    assert.equal(game.dieModifier, 'none', `种子 ${seed} 开局就带上了骰面修正`);
    assert.equal(game.pending, null);
  }
});

// ---------------------------------------------------------------------------
// 守恒：任何操作序列后，每张牌恰好在一个区
// ---------------------------------------------------------------------------

test('守恒：随机操作 2000 步后牌不重不漏', () => {
  const rng = seeded(20260904);
  const game = P.createGame(4, rng);
  const expected = game.planarDeck.length + game.activePlanes.length;

  for (let step = 0; step < 2000; step += 1) {
    const pick = Math.floor(rng() * 5);
    if (pick === 0) P.rollPlanarDie(game, rng);
    else if (pick === 1) P.planeswalk(game);
    else if (pick === 2) P.resolveEncounter(game);
    else if (pick === 3) P.endTurn(game);
    else P.planeswalkTo(game, P.revealUntilPlanes(game, 2));

    const all = game.planarDeck.concat(game.activePlanes);
    assert.equal(all.length, expected, `第 ${step} 步后总数变成 ${all.length}`);
    assert.equal(new Set(all).size, expected, `第 ${step} 步后出现重复牌`);
    assert.ok(game.activePlanes.length >= 1, `第 ${step} 步后没有当前时空`);
    // 面朝上的牌不可能同时还在牌库里
    game.activePlanes.forEach((index) => {
      assert.ok(game.planarDeck.indexOf(index) < 0, '当前时空同时还在牌库里');
    });
  }
});

// ---------------------------------------------------------------------------
// 掷骰：费用与骰面分布
// ---------------------------------------------------------------------------

test('掷骰费用等于本回合此前已掷次数，新回合归零（CR 901.9）', () => {
  const rng = seeded(3);
  const game = P.createGame(4, rng);
  for (let i = 0; i < 6; i += 1) {
    assert.equal(P.rollCost(game), i, `第 ${i + 1} 次掷骰的费用应为 ${i}`);
    assert.equal(P.rollPlanarDie(game, rng).cost, i);
  }
  P.endTurn(game);
  assert.equal(P.rollCost(game), 0, '新回合首掷应免费');
  assert.equal(game.lastRoll, null, '新回合应清掉上一次掷骰结果');

  // 换境不重置费用——费用只跟「本回合掷了几次」有关
  P.rollPlanarDie(game, rng);
  P.planeswalk(game);
  assert.equal(P.rollCost(game), 1, '换境不该重置掷骰费用');
});

test('骰面分布 1/6 · 1/6 · 4/6，用多次重复而不是单次卡方', () => {
  assert.equal(P.DIE_FACES.length, 6);
  assert.equal(P.DIE_FACES.filter((f) => f === 'planeswalk').length, 1);
  assert.equal(P.DIE_FACES.filter((f) => f === 'chaos').length, 1);
  assert.equal(P.DIE_FACES.filter((f) => f === 'blank').length, 4);

  // 单次卡方越线不能下结论（越线概率本就有 5%），所以跑 10 次独立重复，
  // 看越线次数是否接近期望的 0.5 次。
  const expected = { planeswalk: 1 / 6, chaos: 1 / 6, blank: 4 / 6 };
  let exceeded = 0;
  for (let rep = 0; rep < 10; rep += 1) {
    const rng = seeded(1000 + rep * 7919);
    const game = P.createGame(4, rng);
    const counts = { planeswalk: 0, chaos: 0, blank: 0 };
    const trials = 30000;
    for (let i = 0; i < trials; i += 1) counts[P.rollPlanarDie(game, rng).face] += 1;
    let chi = 0;
    Object.keys(expected).forEach((face) => {
      const e = expected[face] * trials;
      chi += ((counts[face] - e) ** 2) / e;
    });
    if (chi > 5.99) exceeded += 1;   // df=2，p=0.05 临界值 5.99
  }
  assert.ok(exceeded <= 3, `10 次重复里有 ${exceeded} 次越过临界值，期望约 0.5 次`);
});

// ---------------------------------------------------------------------------
// 换境与异象
// ---------------------------------------------------------------------------

test('换境：当前时空进牌库底，翻开牌库顶', () => {
  const game = P.createGame(4, seeded(42));
  const before = game.activePlanes[0];
  const wasTop = game.planarDeck[0];
  const size = game.planarDeck.length;

  const next = P.planeswalk(game);
  assert.equal(next, wasTop, '换境后的当前时空应是原牌库顶');
  assert.equal(game.activePlanes[0], wasTop);
  assert.equal(game.planarDeck[game.planarDeck.length - 1], before, '原当前时空应落到牌库底');
  assert.equal(game.planarDeck.length, size, '牌库张数不变（出一张、进一张）');
});

test('异象：遭遇后必然自动再次换出，且落点是时空牌', () => {
  const rng = seeded(5);
  const game = P.createGame(4, rng);
  // 把一张异象顶到牌库顶
  const phenomenonIndex = game.planarDeck.find((i) => PLANECHASE_CARDS[i][0] === 'X');
  game.planarDeck = [phenomenonIndex].concat(game.planarDeck.filter((i) => i !== phenomenonIndex));

  P.planeswalk(game);
  assert.equal(game.pending, 'encounter', '换入异象后应进入待结算');
  assert.equal(P.cardAt(game.activePlanes[0]).isPhenomenon, true);

  P.resolveEncounter(game);
  assert.equal(game.pending, null, '结算后应清掉待结算');
  assert.equal(game.activePlanes[0], game.activePlanes[0]);
  // 结算后落在哪张牌上由牌库决定，但不该还停在那张异象上
  assert.notEqual(game.activePlanes[0], phenomenonIndex);

  // 没有待结算时 resolveEncounter 是空操作，不该乱动牌库
  const snapshot = game.planarDeck.slice();
  assert.equal(P.resolveEncounter(game), null);
  assert.deepEqual(game.planarDeck, snapshot);
});

test('乙太混沦：空白改判混沌，且异象自身的换出不结束它', () => {
  const rng = seeded(9);
  const game = P.createGame(4, rng);
  const aether = PLANECHASE_CARDS.findIndex((row) => P.BLANK_IS_CHAOS_PATTERN.test(row[3]));
  game.planarDeck = [aether].concat(game.planarDeck.filter((i) => i !== aether));

  P.planeswalk(game);
  assert.equal(game.dieModifier, 'none', '仅遭遇乙太混沦不能提前执行其触发效应');

  // 「直到有牌手时空换出任一**时空**」——异象自己那次自动换出离开的是异象，
  // 不是时空，因此修正必须存活。这条极易写反。
  P.resolveEncounter(game);
  assert.equal(game.dieModifier, 'blankIsChaos', '异象自身的换出不该结束乙太混沦');
  assert.equal(P.cardAt(game.activePlanes[0]).isPhenomenon, false);

  // 空白此时判为混沌，并标记 modified 供界面说明「这是被改判的」
  const blankRng = () => 0.5;   // rollInteger(1,6) → 4 → blank
  const roll = P.rollPlanarDie(game, blankRng);
  assert.equal(roll.rolled, 'blank');
  assert.equal(roll.face, 'chaos');
  assert.equal(roll.modified, true);

  // 换出一个时空之后才结束
  P.planeswalk(game);
  assert.equal(game.dieModifier, 'none', '换出时空后应结束乙太混沦');
  const plain = P.rollPlanarDie(game, blankRng);
  assert.equal(plain.face, 'blank');
  assert.equal(plain.modified, false);
});

test('境界交融：同时换入两个时空，其余展示牌置底', () => {
  const game = P.createGame(4, seeded(13));
  const size = game.planarDeck.length + game.activePlanes.length;

  const revealed = P.revealUntilPlanes(game, 2);
  const planesRevealed = revealed.filter((i) => PLANECHASE_CARDS[i][0] === 'P');
  assert.equal(planesRevealed.length, 2, '应展示到恰好两张时空牌为止');
  assert.equal(PLANECHASE_CARDS[revealed[revealed.length - 1]][0], 'P', '最后一张必是时空牌');

  P.planeswalkTo(game, revealed);
  assert.equal(game.activePlanes.length, 2, '应同时存在两个当前时空');
  game.activePlanes.forEach((i) => assert.equal(PLANECHASE_CARDS[i][0], 'P'));
  assert.equal(game.planarDeck.length + game.activePlanes.length, size, '总数不变');
  assert.equal(new Set(game.planarDeck.concat(game.activePlanes)).size, size, '出现重复');
});

test('非法入参不抛', () => {
  assert.equal(P.rollPlanarDie(null, Math.random), null);
  assert.equal(P.planeswalk(null), null);
  assert.equal(P.resolveEncounter(null), null);
  assert.equal(P.rollCost(null), 0);
  assert.equal(P.endTurn(null), null);
  assert.equal(P.cloneGame(null), null);
  const game = P.createGame(4, seeded(1));
  assert.equal(P.planeswalkTo(game, []), null);
  assert.equal(P.planeswalkTo(game, null), null);
  // 只给异象时无处可换入，应拒绝而不是把异象设成当前时空
  const phenomenon = game.planarDeck.find((i) => PLANECHASE_CARDS[i][0] === 'X');
  assert.equal(P.planeswalkTo(game, [phenomenon]), null);
});

test('cloneGame 是深拷贝，撤销不会被后续操作污染', () => {
  const rng = seeded(77);
  const game = P.createGame(4, rng);
  const snapshot = P.cloneGame(game);
  P.rollPlanarDie(game, rng);
  P.planeswalk(game);
  assert.notDeepEqual(game.planarDeck, snapshot.planarDeck);
  assert.equal(snapshot.rollsThisTurn, 0);
  snapshot.planarDeck.push(-1);
  assert.ok(game.planarDeck.indexOf(-1) < 0, '快照与实时状态共享了数组');
});

// ---------------------------------------------------------------------------
// 生成物与页面接线
// ---------------------------------------------------------------------------

test('生成物带勿手改抬头，且不含逻辑', () => {
  const source = fs.readFileSync(path.join(root, 'miniprogram/config/planechase.js'), 'utf8');
  assert.match(source, /由 scripts\/build-planechase\.js 生成，请勿手改/);
  // 生成物只放数据——「生成代码的代码」是转义地狱，逻辑一律留在手写的 util 里
  assert.doesNotMatch(source, /\bfunction\b/, '生成物里出现了函数');
  assert.doesNotMatch(source, /\brequire\(/, '生成物里出现了 require');
});

test('页面已注册，且入口挂在混沌工具下', () => {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  assert.ok(app.pages.indexOf('pages/planechase/planechase') >= 0, 'app.json 没注册竞逐时空页');

  const hub = fs.readFileSync(path.join(root, 'miniprogram/pages/random/random.wxml'), 'utf8');
  assert.match(hub, /竞逐时空/, '混沌工具里没有竞逐时空入口');
  const hubJs = fs.readFileSync(path.join(root, 'miniprogram/pages/random/random.js'), 'utf8');
  assert.match(hubJs, /pages\/planechase\/planechase/);

  // 首页八行是被锁死的，竞逐时空不得越级挂到首页
  const home = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.wxml'), 'utf8');
  assert.doesNotMatch(home, /竞逐时空/, '竞逐时空不该出现在首页八行里');
});

test('页面只加载一张横幅；网络失败由本地图鉴占位与完整卡文承接', () => {
  const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/planechase/planechase.wxml'), 'utf8');
  // 浏览卡文只需一份原画，离线占位不再额外请求低清卡面。
  assert.match(wxml, /class="art-placeholder"/, '缺少本地占位');
  assert.match(wxml, /卡图不可用，卡文可离线阅读/, '失败时要说明卡文仍可用');
  assert.match(wxml, /src="\{\{item\.art\.artCrop\}\}"/, '缺少 art_crop 主图层');
  assert.equal((wxml.match(/<image[^>]*src="\{\{item\.art\./g) || []).length, 1);
  assert.match(wxml, /item\.staticLines/);
  assert.match(wxml, /item\.chaosLines/);
  // 失败回调按卡片身份摘掉原图，不修改已提交牌局（控制器测试验证）。
  assert.match(wxml, /binderror="hidePlaneArt"/, '主图缺少失败回落');

  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/planechase/planechase.js'), 'utf8');
  assert.match(js, /buildCdnArt/, '图片地址应由 scryfall-cdn 拼出，不要另写一份规则');
  assert.match(js, /prefetch/i, '缺少下一张时空的预取');
});
