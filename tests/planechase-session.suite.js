const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');
const P = require('../miniprogram/utils/planechase');
const S = require('../miniprogram/utils/planechase-session');
const storage = require('../miniprogram/utils/storage');
const { PLANECHASE_CARDS: cards } = require('../miniprogram/config/planechase');
const { LEGACY_CARD_IDS } = require('../miniprogram/config/planechase-rules');
const clone = (value) => JSON.parse(JSON.stringify(value));
const indexOf = (kind) => cards.findIndex((row, index) => P.planarActionFor(index) === kind);
const norn = indexOf('append');
const aether = indexOf('aether');
const merge = indexOf('merge');
const echo = indexOf('echo');
const ordinary = cards.map((row, index) => index).filter((index) => cards[index][0] === 'P' && !P.planarActionFor(index));
const phenomena = cards.map((row, index) => index).filter((index) => cards[index][0] === 'X');
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function arranged(active = [ordinary[0]], top = []) {
  const session = S.createSession(4, seeded(1));
  const used = active.concat(top);
  assert.equal(new Set(used).size, used.length, '测试场景不得重复分配牌');
  session.game.activePlanes = active.slice();
  session.game.planarDeck = top.concat(cards.map((row, index) => index).filter((index) => !used.includes(index)));
  session.game.pending = cards[active[0]][0] === 'X' ? 'encounter' : null;
  if (session.game.pending) session.triggers.push({ id: session.nextTrigger++, kind: 'encounter', cardIndex: active[0], visit: session.visit });
  assert.ok(S.isSession(session));
  return session;
}
function act(session, action, rng) {
  const before = clone(session);
  const next = S.transition(session, action, rng);
  assert.ok(next, '合法动作应可提交：' + JSON.stringify(action));
  assert.deepEqual(session, before, 'transition 不得提前修改已提交对象');
  assert.ok(S.isSession(next));
  return next;
}
function resolve(session, predicate, prevented = false) {
  const source = session.triggers.find(predicate);
  assert.ok(source, '测试场景缺少待处理来源');
  return act(session, { type: 'resolveTrigger', id: source.id, prevented });
}

test('session：Oracle 身份唯一，整段卡文保留，Norn 进场与混沌正确分开', () => {
  assert.equal(new Set(cards.map((row) => row[6])).size, 50);
  assert.equal(new Set(LEGACY_CARD_IDS).size, 50);
  assert.equal(P.cardAt(norn).staticLines.length, 1);
  assert.match(P.cardAt(norn).staticLines[0], /^当你时空换入/);
  assert.equal(P.cardAt(norn).chaosLines.length, 1);
  cards.forEach((row, index) => assert.equal(P.cardAt(index).text, row[3]));
});

test('session：存档与撤销均按 Oracle ID 编码，拒绝未知身份、重复与缺牌', () => {
  const session = act(arranged(), { type: 'roll' }, () => 0);
  const encoded = S.encodeSession(session);
  assert.equal(typeof encoded.game.planarDeck[0], 'string');
  assert.equal(typeof encoded.undo.game.activePlanes[0], 'string');
  assert.deepEqual(S.decodeSession(encoded), session);
  const bad = clone(encoded);
  bad.game.planarDeck[0] = 'unknown';
  assert.equal(S.decodeSession(bad), null);
  bad.game.planarDeck[0] = bad.game.activePlanes[0];
  assert.equal(S.decodeSession(bad), null);
  bad.game.planarDeck.pop();
  assert.equal(S.decodeSession(bad), null);
  for (const value of [null, {}, [], 42, 'bad']) assert.equal(S.decodeSession(value), null);
});

test('session：生成表重排后，存档与 v1 下标迁移仍还原同一组牌', () => {
  const reordered = cards.slice().reverse();
  const root = path.join(__dirname, '..');
  const utilFile = path.join(root, 'miniprogram/utils/planechase.js');
  const sessionFile = path.join(root, 'miniprogram/utils/planechase-session.js');
  function load(file, replacements) {
    const module = { exports: {} };
    const realRequire = createRequire(file);
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { module, exports: module.exports,
      require: (name) => replacements[name] || realRequire(name) }, { filename: file });
    return module.exports;
  }
  const reorderedP = load(utilFile, { '../config/planechase': { PLANECHASE_CARDS: reordered } });
  const reorderedS = load(sessionFile, { './planechase': reorderedP, '../config/planechase': { PLANECHASE_CARDS: reordered } });
  const session = arranged([ordinary[1]], [norn, echo]);
  const restored = reorderedS.decodeSession(S.encodeSession(session));
  assert.equal(reordered[restored.game.activePlanes[0]][6], cards[ordinary[1]][6]);
  const old = clone(session.game);
  const migrated = reorderedS.decodeSession(reorderedS.migrateStoredSession(old));
  assert.equal(reordered[migrated.game.planarDeck[0]][6], cards[norn][6]);
});

test('session：旧版异象存档迁移不提前执行 Aether，非法旧存档不能进入新局', () => {
  const old = arranged([aether]).game;
  old.dieModifier = 'blankIsChaos';
  const migrated = S.decodeSession(S.migrateStoredSession(old));
  assert.equal(migrated.game.dieModifier, 'none');
  assert.equal(migrated.triggers[0].kind, 'encounter');
  assert.match(migrated.tableNotes[0], /核对/);
  assert.throws(() => S.migrateStoredSession({ planarDeck: [0], activePlanes: [0] }));
});

test('session：普通掷骰产生待结算，阻止换境保留费用，效应掷骰不加费用', () => {
  let session = act(arranged(), { type: 'roll' }, () => 0);
  assert.equal(S.phaseOf(session), 'resolve');
  assert.equal(S.transition(session, { type: 'roll' }), null);
  assert.equal(S.transition(session, { type: 'turn' }), null);
  session = act(session, { type: 'roll', effect: true }, () => 0.5);
  assert.equal(session.game.rollsThisTurn, 1);
  assert.equal(session.game.lastRoll.cost, 0);
  session = resolve(session, (source) => source.kind === 'walk', true);
  assert.equal(S.phaseOf(session), 'ready');
  assert.equal(P.rollCost(session.game), 1);
  session = act(session, { type: 'turn' });
  assert.equal(P.rollCost(session.game), 0);
});

test('session：Aether 触发副本分别结算，最后一个离开堆叠后才执行异象状态动作', () => {
  let session = arranged([aether], [ordinary[0]]);
  session = act(session, { type: 'copyTrigger', id: session.triggers[0].id });
  session = resolve(session, (source) => source.kind === 'encounter');
  assert.equal(session.game.dieModifier, 'blankIsChaos');
  assert.deepEqual(session.game.activePlanes, [aether]);
  assert.equal(S.canLeavePhenomenon(session), false);
  session = resolve(session, (source) => source.kind === 'encounter', true);
  assert.equal(S.phaseOf(session), 'exit');
  session = act(session, { type: 'leavePhenomenon' });
  assert.equal(session.game.dieModifier, 'blankIsChaos');
  session = act(session, { type: 'walk' });
  assert.equal(session.game.dieModifier, 'none');
});

test('session：反击 Aether 与 Spatial 遭遇触发不执行牌面效应', () => {
  for (const index of [aether, merge]) {
    let session = arranged([index], [ordinary[0]]);
    session = resolve(session, (source) => source.kind === 'encounter', true);
    assert.equal(session.game.dieModifier, 'none');
    assert.equal(session.reveal, null);
    session = act(session, { type: 'leavePhenomenon' });
    assert.deepEqual(session.game.activePlanes, [ordinary[0]]);
  }
});

test('session：异象状态动作优先于另一项待处理换境，不吞掉复制的换境', () => {
  let session = act(arranged([ordinary[0]], [aether, ordinary[1], ordinary[2]]), { type: 'roll' }, () => 0);
  session = act(session, { type: 'copyTrigger', id: session.triggers[0].id });
  session = resolve(session, (source) => source.kind === 'walk');
  session = resolve(session, (source) => source.kind === 'encounter');
  const remainingWalk = session.triggers.find((source) => source.kind === 'walk');
  assert.equal(S.phaseOf(session), 'exit');
  assert.equal(S.transition(session, { type: 'resolveTrigger', id: remainingWalk.id }), null);
  assert.equal(S.transition(session, { type: 'roll', effect: true }), null);
  session = act(session, { type: 'leavePhenomenon' });
  assert.deepEqual(session.game.activePlanes, [ordinary[1]]);
  session = resolve(session, (source) => source.kind === 'walk');
  assert.deepEqual(session.game.activePlanes, [ordinary[2]]);
});

test('session：Spatial 换入两张，先将换出牌置底，再按任意顺序置底跳过的异象', () => {
  const skipped = phenomena.filter((index) => index !== merge).slice(0, 2);
  let session = arranged([merge], [skipped[0], ordinary[0], skipped[1], ordinary[1]]);
  session = resolve(session, (source) => source.kind === 'encounter');
  session = act(session, { type: 'order', index: skipped[1], delta: -1 });
  session = act(session, { type: 'applyReveal' });
  assert.deepEqual(session.game.activePlanes, [ordinary[0], ordinary[1]]);
  assert.deepEqual(session.game.planarDeck.slice(-3), [merge, skipped[1], skipped[0]]);
});

test('session：复制 Spatial 在原异象离场后仍能再次换境，支持多张离场牌排序', () => {
  let session = arranged([merge], ordinary.slice(0, 4));
  session = act(session, { type: 'copyTrigger', id: session.triggers[0].id });
  session = resolve(session, (source) => source.kind === 'encounter');
  session = act(session, { type: 'applyReveal' });
  session = resolve(session, (source) => source.kind === 'encounter');
  session = act(session, { type: 'order', group: 'exit', index: ordinary[1], delta: -1 });
  session = act(session, { type: 'applyReveal' });
  assert.deepEqual(session.game.activePlanes, ordinary.slice(2, 4));
  assert.deepEqual(session.game.planarDeck.slice(-2), [ordinary[1], ordinary[0]]);
});

test('session：Norn 追加保留时空与 Aether；其进场触发可反击，开局不触发', () => {
  let session = arranged([norn], [ordinary[0]]);
  assert.equal(session.triggers.length, 0);
  session.game.dieModifier = 'blankIsChaos';
  session = act(session, { type: 'causeChaos' });
  session = resolve(session, (source) => source.cardIndex === norn);
  session = act(session, { type: 'applyReveal' });
  assert.deepEqual(session.game.activePlanes, [norn, ordinary[0]]);
  assert.equal(session.game.dieModifier, 'blankIsChaos');
  let entering = act(arranged([ordinary[0]], [norn]), { type: 'walk' });
  assert.equal(entering.triggers[0].kind, 'entryChaos');
  entering = resolve(entering, (source) => source.kind === 'entryChaos', true);
  assert.equal(entering.triggers.length, 0);
});

test('session：换入 Norn 的触发结算时，当前所有时空分别引发混沌', () => {
  let session = arranged([merge], [norn, ordinary[0]]);
  session = resolve(session, (source) => source.kind === 'encounter');
  session = act(session, { type: 'applyReveal' });
  session = resolve(session, (source) => source.kind === 'entryChaos');
  assert.deepEqual(session.triggers.map((source) => source.cardIndex), [norn, ordinary[0]]);
});

test('session：Saulvinia 只触发展示牌混沌，Norn 从置底后的新牌库继续追加', () => {
  let session = act(arranged([echo], [aether, norn, ordinary[0]]), { type: 'causeChaos' });
  session = resolve(session, (source) => source.cardIndex === echo);
  session = act(session, { type: 'order', index: norn, delta: -1 });
  session = act(session, { type: 'applyReveal' });
  assert.deepEqual(session.game.activePlanes, [echo]);
  assert.deepEqual(session.game.planarDeck.slice(-2), [norn, aether]);
  assert.deepEqual(session.triggers.map((source) => source.cardIndex), [norn]);
  session = resolve(session, (source) => source.cardIndex === norn);
  session = act(session, { type: 'applyReveal' });
  assert.deepEqual(session.game.activePlanes, [echo, ordinary[0]]);
  assert.ok(session.game.planarDeck.includes(norn));
});

test('session：原 Norn 混沌在响应换境后保留，当前异象也能被其追加效应换出', () => {
  let session = act(arranged([norn], [aether, ordinary[0]]), { type: 'causeChaos' });
  session = act(session, { type: 'walk' });
  session = resolve(session, (source) => source.cardIndex === norn);
  session = act(session, { type: 'applyReveal' });
  assert.deepEqual(session.game.activePlanes, [ordinary[0]]);
  assert.ok(session.triggers.some((source) => source.cardIndex === aether));
});

test('session：45 张时空全在场时，Norn 展示仅异象仍能完成，不丢牌不卡死', () => {
  const allPlanes = cards.map((row, index) => index).filter((index) => cards[index][0] === 'P');
  let session = act(arranged(allPlanes), { type: 'causeChaos' });
  session = resolve(session, (source) => source.cardIndex === norn);
  assert.equal(session.reveal.indices.length, 5);
  session = act(session, { type: 'applyReveal' });
  assert.deepEqual(session.game.activePlanes, allPlanes);
  assert.equal(session.game.planarDeck.length, 5);
  assert.equal(session.triggers.length, 44);
});

test('session：多时空换出全部置底，可自定顺序，清除 Aether 并保留离场文字', () => {
  const leaves = cards.findIndex((row) => /当你时空换出/.test(row[3]));
  let session = arranged([ordinary[0], leaves], [ordinary[2]]);
  session.game.dieModifier = 'blankIsChaos';
  session = act(session, { type: 'walk' });
  session = act(session, { type: 'order', index: leaves, delta: -1 });
  session = act(session, { type: 'applyReveal' });
  assert.deepEqual(session.game.planarDeck.slice(-2), [leaves, ordinary[0]]);
  assert.equal(session.game.dieModifier, 'none');
  assert.ok(session.tableNotes.some((note) => /当你时空换出/.test(note)));
});

test('session：异象重新入场是新对象，旧实例触发不阻塞本次状态动作', () => {
  let session = arranged([aether], [ordinary[0]]);
  const oldId = session.triggers[0].id;
  const oldVisit = session.visit;
  session = act(session, { type: 'walk' });
  for (let count = 0; count < 50 && session.game.activePlanes[0] !== aether; count += 1) session = act(session, { type: 'walk' });
  assert.deepEqual(session.game.activePlanes, [aether]);
  assert.ok(session.visit > oldVisit);
  session = resolve(session, (source) => source.cardIndex === aether && source.id !== oldId, true);
  assert.equal(S.canLeavePhenomenon(session), true);
  assert.ok(session.triggers.some((source) => source.id === oldId));
});

test('session：3000 步混合操作、复制、撤销和存读后始终守恒且不修改已提交状态', () => {
  const rng = seeded(82183);
  let session = S.createSession(4, rng);
  for (let step = 0; step < 3000; step += 1) {
    const phase = S.phaseOf(session);
    let action;
    if (phase === 'reveal') action = { type: 'applyReveal' };
    else if (phase === 'exit') action = { type: 'leavePhenomenon' };
    else if (phase === 'notes') action = { type: 'acknowledgeNotes' };
    else if (phase === 'resolve') {
      const source = session.triggers[Math.floor(rng() * session.triggers.length)];
      action = { type: 'resolveTrigger', id: source.id, prevented: rng() < 0.25 };
      if (rng() < 0.1 && session.triggers.length < 80) action.type = 'copyTrigger';
    } else action = rng() < 0.2 ? { type: 'walk' } : { type: 'roll', effect: rng() < 0.2 };
    if (step % 39 === 0 && session.undo) action = { type: 'undo' };
    session = act(session, action, rng);
    if (step % 25 === 0) assert.deepEqual(S.decodeSession(S.encodeSession(session)), session);
  }
});

test('session：牌桌触发提示跨效应保留，确认处理前不能普通掷骰', () => {
  let session = act(arranged([ordinary[1]], [ordinary[0]]), { type: 'walk' });
  const notes = session.tableNotes.slice();
  assert.ok(notes.length);
  assert.equal(S.phaseOf(session), 'notes');
  assert.equal(S.transition(session, { type: 'roll' }), null);
  session = act(session, { type: 'roll', effect: true }, () => 0.5);
  notes.forEach((note) => assert.ok(session.tableNotes.includes(note)));
  session = act(session, { type: 'acknowledgeNotes' });
  assert.equal(S.phaseOf(session), 'ready');
});

// 页面实际控制器 + 真实存储边界，注入微信 API；不依赖源码正则推断生命周期行为。
function pageHarness(initial, flags = {}) {
  const memory = new Map(initial === undefined ? [] : [['planechaseState', clone(initial)]]);
  const api = {
    getStorageSync(key) { if (flags.failRead) throw new Error('read'); return memory.has(key) ? clone(memory.get(key)) : ''; },
    setStorageSync(key, value) { if (flags.failWrite) throw new Error('quota'); memory.set(key, clone(value)); },
    getImageInfo(options) { flags.prefetch = options; },
    pageScrollTo() {},
  };
  const file = path.join(__dirname, '../miniprogram/pages/planechase/planechase.js');
  const realRequire = createRequire(file);
  let page;
  const rng = () => { flags.draws = (flags.draws || 0) + 1; return flags.rng === undefined ? 0.5 : flags.rng; };
  const injected = {
    '../../utils/storage': Object.fromEntries(['readStorage', 'writeStorage', 'backupStorage'].map((name) => [name,
      (key, value, options) => name === 'readStorage' ? storage[name](key, { ...value, api }) : storage[name](key, value, { ...options, api })])),
    '../../utils/planechase-session': { ...S, createSession: () => S.createSession(4, seeded(10)), transition: (session, action) => S.transition(session, action, rng) },
    '../../utils/share': { enableShareMenu() {} },
    '../../utils/keep-screen-on': { setKeepScreenOn(value) { flags.awake = value; } },
  };
  const open = () => {
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), { wx: api, Set, Date,
      require: (name) => injected[name] || realRequire(name), Page: (definition) => { page = definition; } }, { filename: file });
    page.data = clone(page.data);
    page.setData = function setData(patch) {
      Object.entries(patch).forEach(([key, value]) => {
        const keys = key.replace(/\[(\d+)\]/g, '.$1').split('.');
        let target = this.data;
        keys.slice(0, -1).forEach((part) => { target = target[part]; });
        target[keys[keys.length - 1]] = value;
      });
    };
    page.onLoad();
    return page;
  };
  return { open, memory, flags };
}
const saved = (session) => storage.createEnvelope(S.encodeSession(session), S.SCHEMA_VERSION, () => 1);

test('page：掷出换境切后台、卸载、重开后保留待结算与撤销，不依赖定时器', () => {
  const harness = pageHarness(saved(arranged()), { rng: 0 });
  let page = harness.open();
  page.onShow();
  assert.equal(harness.flags.awake, true);
  page.rollDie();
  page.onHide();
  page.onUnload();
  assert.equal(harness.flags.awake, false);
  page = harness.open();
  assert.equal(page.data.phase, 'resolve');
  assert.equal(page.data.canUndo, true);
  assert.equal(page.data.rollCost, 1);
  page.undo();
  assert.equal(page.data.phase, 'ready');
  assert.equal(page.data.rollCost, 0);
});

test('page：写盘失败不推进牌局；重试保存相同候选，不重新掷骰', () => {
  const harness = pageHarness(saved(arranged()), { rng: 0 });
  const page = harness.open();
  const before = clone(page.session);
  harness.flags.failWrite = true;
  page.rollDie();
  assert.deepEqual(page.session, before);
  assert.ok(page.data.saveError);
  page.rollDie();
  assert.equal(harness.flags.draws, 1);
  harness.flags.failWrite = false;
  page.retrySave();
  assert.equal(harness.flags.draws, 1);
  assert.equal(page.data.phase, 'resolve');
  assert.equal(harness.open().data.phase, 'resolve');
});

test('page：存储失败可取消，首次保存失败可重试，未来版本保留且禁止覆盖', () => {
  const harness = pageHarness(saved(arranged()));
  let page = harness.open();
  harness.flags.failWrite = true;
  page.rollDie();
  page.cancelSave();
  assert.equal(page.pendingCommit, null);
  assert.equal(page.data.rollCost, 0);
  const first = pageHarness(undefined, { failWrite: true });
  page = first.open();
  assert.equal(page.data.hasSession, false);
  first.flags.failWrite = false;
  page.retrySave();
  assert.equal(page.data.hasSession, true);
  const future = { ...saved(arranged()), schemaVersion: 99 };
  const later = pageHarness(future);
  page = later.open();
  assert.equal(page.data.recovery, true);
  assert.equal(page.data.canRecover, false);
  page.recoverNewGame();
  assert.deepEqual(later.memory.get('planechaseState'), future);
});

test('page：损坏存档必须先备份成功才允许恢复新局，读盘失败不会创建新局', () => {
  const broken = { __storage: 'cedh-storage', schemaVersion: 2, data: { broken: true } };
  const harness = pageHarness(broken, { failWrite: true });
  const page = harness.open();
  assert.equal(page.data.canRecover, true);
  page.recoverNewGame();
  assert.deepEqual(harness.memory.get('planechaseState'), broken);
  harness.flags.failWrite = false;
  page.recoverNewGame();
  assert.equal(page.data.hasSession, true);
  const backupKey = [...harness.memory.keys()].find((key) => key.includes('.recovery.'));
  assert.deepEqual(harness.memory.get(backupKey).data.original, broken);
  const unreadable = pageHarness(saved(arranged()), { failRead: true });
  assert.equal(unreadable.open().data.hasSession, false);
  assert.equal(unreadable.memory.size, 1);
});

test('page：旧卡图失败回调不污染新时空；完整卡文不依赖卡图，预取失败可再试', () => {
  const harness = pageHarness(saved(arranged([ordinary[0]], [ordinary[1]])));
  const page = harness.open();
  const oldId = page.data.planes[0].id;
  page.manualPlaneswalk();
  page.hidePlaneArt({ currentTarget: { dataset: { id: oldId } } });
  assert.equal(page.data.planes[0].artFailed, false);
  page.openInspect({ currentTarget: { dataset: { index: ordinary[1] } } });
  page.failInspect();
  assert.equal(page.data.inspect.text, cards[ordinary[1]][3]);
  page.retryInspect();
  assert.equal(page.data.inspectFailed, false);
  page.failInspect({ currentTarget: { dataset: { id: oldId } } });
  assert.equal(page.data.inspectFailed, false, '旧卡图错误不能污染当前弹层');
  const rolls = page.data.rollCost;
  page.rollDie();
  assert.equal(page.data.rollCost, rolls, '弹层打开时背景操作不得推进牌局');
  harness.flags.prefetch.fail();
  assert.equal(page.prefetchedId, '');
});
