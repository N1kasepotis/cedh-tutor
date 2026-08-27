const test = require('node:test');
const assert = require('node:assert/strict');

// 不变量测试：不再举例，而是生成大量输入、断言恒成立的性质。
//
// 举例式测试只能证明「我想到的那几步是对的」。这一组要证明的是
// 「任意一串合法操作之后，这些性质都还成立」——那是举例按定义找不到的整类 bug。
//
// 条数刻意收着（每条几十局、几十步），好让它能跟在每次 npm test 后面跑完；
// 首次排查用的全量版本大得多（试玩 24000 次操作、分级 600 副牌、
// 血量 20000 次操作 + 4×60000 次抽签），需要时把种子数调大即可。

function mulberry(seed) {
  return () => {
    let s = seed;
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    seed = s;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ZONES = ['hand', 'battlefield', 'library', 'graveyard', 'exile', 'command'];

test('不变量·试玩状态机：任意操作序列后牌数守恒、id 不重、衍生物不离场', () => {
  const {
    parseMtgoDeckText, createGame, drawCards, moveCard,
    toggleTapped, adjustCardCounters, countZones, shuffleInPlace,
  } = require('../miniprogram/utils/playtest');

  const lines = [];
  for (let i = 1; i <= 99; i += 1) lines.push(`1 Card ${i}`);
  const parsed = parseMtgoDeckText(`${lines.join('\n')}\n\n1 Boss`);
  const TOTAL = 100;

  for (let seed = 1; seed <= 60; seed += 1) {
    const rng = mulberry(seed);
    const game = createGame(parsed, rng);

    for (let step = 0; step < 30; step += 1) {
      const roll = rng();
      const pool = ZONES.flatMap((z) => game[z] || []).filter((c) => !c.token);
      const pick = pool.length ? pool[Math.floor(rng() * pool.length)] : null;
      const from = pick ? ZONES.find((z) => (game[z] || []).some((c) => c.id === pick.id)) : null;

      if (roll < 0.2) drawCards(game, 1 + Math.floor(rng() * 3));
      else if (roll < 0.65 && pick) moveCard(game, from, pick.id, ZONES[Math.floor(rng() * ZONES.length)]);
      else if (roll < 0.75 && game.battlefield.length) toggleTapped(game, game.battlefield[0].id);
      else if (roll < 0.85 && game.battlefield.length) adjustCardCounters(game, game.battlefield[0].id, Math.floor(rng() * 9) - 4);
      else if (roll < 0.92) game.battlefield.push({ id: -(step + 1) * 1000 - seed, name: 'Token', token: true, tapped: false, x: 0, y: 0 });
      else shuffleInPlace(game.library, rng);

      const cards = ZONES.flatMap((z) => game[z] || []);
      const real = cards.filter((c) => !c.token);
      // 牌不会凭空出现，也不会凭空消失——用户丢了一张牌是最难自证的那种 bug
      assert.equal(real.length, TOTAL, `seed ${seed} step ${step}: 牌数变成 ${real.length}`);
      const ids = cards.map((c) => c.id);
      assert.equal(new Set(ids).size, ids.length, `seed ${seed} step ${step}: 出现重复 id`);
      // 衍生物离开战场即消失（MTG 状态动作）
      ZONES.filter((z) => z !== 'battlefield').forEach((z) => {
        assert.ok(!(game[z] || []).some((c) => c.token), `seed ${seed} step ${step}: ${z} 里出现衍生物`);
      });
      // 计数与真实数组长度必须一致，否则区块角标会说谎
      const counts = countZones(game);
      ZONES.forEach((z) => {
        assert.equal(counts[z], (game[z] || []).length, `seed ${seed} step ${step}: ${z} 计数不符`);
      });
      // 指示物归零要删键，不留空对象
      game.battlefield.forEach((c) => {
        if (!('counters' in c)) return;
        Object.values(c.counters).forEach((v) => {
          assert.ok(Number.isInteger(v) && v > 0, `seed ${seed} step ${step}: 残留非正指示物 ${v}`);
        });
      });
    }
  }
});

test('不变量·强度分级：档位落在 1–5、证据只引用牌表里的卡、同一副牌结果确定', () => {
  const B = require('../miniprogram/utils/bracket');
  const { commanders } = require('../miniprogram/config/commanders');
  const bracketData = require('../miniprogram/config/bracket-data');

  const known = new Set();
  const scrape = (v) => {
    if (typeof v === 'string') { if (/^[A-Z][A-Za-z',\- ]{3,}$/.test(v)) known.add(v); return; }
    if (Array.isArray(v)) { v.forEach(scrape); return; }
    if (v && typeof v === 'object') Object.values(v).forEach(scrape);
  };
  scrape(bracketData);
  const knownList = [...known];
  const commanderNames = commanders.map((c) => c.name.split(' / ')[0]);

  for (let seed = 1; seed <= 40; seed += 1) {
    const rng = mulberry(seed);
    const lines = [];
    const size = 1 + Math.floor(rng() * 60);
    for (let i = 0; i < size; i += 1) {
      const r = rng();
      const pool = r < 0.5 ? knownList : (r < 0.9 ? [`Nonexistent Filler ${i}`] : commanderNames);
      lines.push(`${1 + Math.floor(rng() * 4)} ${pool[Math.floor(rng() * pool.length)]}`);
    }
    const text = rng() < 0.8
      ? `${lines.join('\n')}\n\n1 ${commanderNames[Math.floor(rng() * commanderNames.length)]}`
      : lines.join('\n');

    const parsed = B.parseBracketDeck(text);
    const result = B.evaluateBracket(parsed);

    ['assignedBracket', 'floorBracket', 'strengthBracket', 'competitiveBracket'].forEach((k) => {
      const v = result[k];
      assert.ok(v === null || v === undefined || (Number.isFinite(v) && v >= 1 && v <= 5),
        `seed ${seed}: ${k} = ${v} 越出 1–5`);
    });

    // 判定依据里引用的卡必须真的在这副牌里——指向一张用户没有的牌，
    // 会让整条判定链看着像在瞎编
    const deckKeys = new Set((parsed.cards || []).map((c) => B.canonicalCardKey(c.name)));
    (parsed.commanders || []).forEach((c) => deckKeys.add(B.canonicalCardKey(c.name)));
    (result.evidence || []).forEach((item) => {
      (item.cards || []).forEach((name) => {
        assert.ok(deckKeys.has(B.canonicalCardKey(name)),
          `seed ${seed}: 证据 ${item.code} 引用了牌表里没有的「${name}」`);
      });
      assert.ok(typeof item.detail === 'string' && !/undefined|null|NaN/.test(item.detail),
        `seed ${seed}: 证据 ${item.code} 的正文泄漏了 undefined/null/NaN`);
    });

    // 页面会重复评估同一副牌；结果不确定就意味着档位会自己跳
    assert.equal(JSON.stringify(B.evaluateBracket(B.parseBracketDeck(text))), JSON.stringify(result),
      `seed ${seed}: 同一副牌两次评估结果不一致`);

    const summary = B.buildBracketSummary(result, 0);
    assert.ok(typeof summary === 'string' && summary.length > 0, `seed ${seed}: 摘要为空`);
    assert.ok(!/undefined|null|NaN|\[object/.test(summary), `seed ${seed}: 摘要泄漏了内部值`);
  }
});

test('不变量·血量记录：任意操作后状态始终可落盘，先手始终有效', () => {
  const L = require('../miniprogram/utils/life-tracker');
  const { lifeTrackerConfig: CFG } = require('../miniprogram/config/life-tracker');
  const colorKeys = new Set(CFG.colors.map((c) => c.key));

  for (let seed = 1; seed <= 60; seed += 1) {
    const rng = mulberry(seed);
    let state = L.createLifeTrackerState({ rng, playerCount: CFG.playerCountOptions[Math.floor(rng() * 4)] });

    for (let step = 0; step < 25; step += 1) {
      const roll = rng();
      if (roll < 0.55) {
        // 掺入荒唐的 delta：非数、超大、小数、字符串
        const deltas = [1, -1, 5, 9999, -9999, NaN, 0.5, '3', null];
        state = L.changePlayerLife(state, 1 + Math.floor(rng() * state.players.length),
          deltas[Math.floor(rng() * deltas.length)]);
      } else if (roll < 0.7) {
        state = L.setLifeTrackerPlayerCount(state, CFG.playerCountOptions[Math.floor(rng() * 4)], rng);
      } else if (roll < 0.8) {
        state = L.resetLifeTrackerState(state, rng);
      } else if (roll < 0.92) {
        // 一半走正常抽签，一半直接塞荒唐的座位号——先手 id 越界不会报错，
        // 只会让那条常驻边永远不显示，是最难查的那一类
        const bogus = [0, -1, 99, 2.5, NaN, null, '3'];
        state = L.setFirstPlayer(state, rng() < 0.5
          ? L.pickFirstPlayerId(state, rng)
          : bogus[Math.floor(rng() * bogus.length)]);
      } else {
        const names = ['', '   ', 'A'.repeat(40), '玩家 X', null];
        state = L.renamePlayer(state, 1 + Math.floor(rng() * state.players.length),
          names[Math.floor(rng() * names.length)]);
      }

      // 落盘校验是这一页唯一的持久化闸门：状态一旦通不过，整局就存不下去
      assert.ok(L.isLifeTrackerState(state), `seed ${seed} step ${step}: 状态无法落盘`);
      assert.equal(state.players.length, state.playerCount, `seed ${seed} step ${step}: 人数与座位数不符`);
      state.players.forEach((p, i) => {
        assert.equal(p.id, i + 1, `seed ${seed} step ${step}: 座位号不连续`);
        assert.ok(Number.isInteger(p.life) && p.life >= CFG.minLife && p.life <= CFG.maxLife,
          `seed ${seed} step ${step}: 血量 ${p.life} 越界或非整数`);
        assert.ok(typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 12,
          `seed ${seed} step ${step}: 名字「${p.name}」不合法`);
        assert.ok(colorKeys.has(p.colorKey), `seed ${seed} step ${step}: 颜色键 ${p.colorKey} 非法`);
      });
      assert.equal(new Set(state.players.map((p) => p.colorKey)).size, state.playerCount,
        `seed ${seed} step ${step}: 同局出现重复颜色`);
      // 越界的先手 id 会让那条常驻边永远不显示，而且不报错
      assert.ok(state.firstPlayerId === null || state.firstPlayerId === undefined
        || state.players.some((p) => p.id === state.firstPlayerId),
        `seed ${seed} step ${step}: 先手 ${state.firstPlayerId} 不是本局座位`);
    }
  }

  // 抽签必须均匀：不均匀就意味着某个座位更容易先手，而这是要拿来定回合顺序的
  CFG.playerCountOptions.forEach((count) => {
    const state = L.createLifeTrackerState({ rng: () => 0.25, playerCount: count });
    const hits = new Map();
    const rng = mulberry(99);
    for (let i = 0; i < 20000; i += 1) {
      const id = L.pickFirstPlayerId(state, rng);
      hits.set(id, (hits.get(id) || 0) + 1);
    }
    assert.equal(hits.size, count, `${count} 人局有座位从来抽不到`);
    // 越界的 rng 不能把 id 抽到数组外去：注入的 rng 未必规矩，
    // 而抽出一个不存在的座位会让整局的先手标记消失
    [() => 1, () => 1.5, () => -3, () => NaN, () => null].forEach((hostile, i) => {
      const id = L.pickFirstPlayerId(state, hostile);
      assert.ok(state.players.some((p) => p.id === id),
        `${count} 人局遇到第 ${i} 个越界 rng 时抽出了不存在的座位 ${id}`);
    });
    const expect = 20000 / count;
    const worst = Math.max(...[...hits.values()].map((v) => Math.abs(v - expect) / expect));
    assert.ok(worst < 0.06, `${count} 人局抽签偏差 ${(worst * 100).toFixed(1)}%，不够均匀`);
  });
});

// 存储是全站唯一的持久化，失败模式是静默丢数据：页面拿不到 ok:false 就不会提示用户。
// 这一条用一批「坏后端 × 坏值」压它，确认无论多糟都只返回结构化结果、绝不抛。
test('不变量·存储层：任何后端与任何值下都返回显式结果，绝不抛穿', () => {
  const S = require('../miniprogram/utils/storage');

  const backends = {
    正常: () => { const m = new Map(); return { getStorageSync: (k) => (m.has(k) ? m.get(k) : ''), setStorageSync: (k, v) => m.set(k, v), removeStorageSync: (k) => m.delete(k) }; },
    写入总是抛: () => ({ getStorageSync: () => '', setStorageSync: () => { throw new Error('quota'); }, removeStorageSync: () => {} }),
    读取总是抛: () => ({ getStorageSync: () => { throw new Error('corrupt'); }, setStorageSync: () => {}, removeStorageSync: () => {} }),
    删除总是抛: () => ({ getStorageSync: () => '', setStorageSync: () => {}, removeStorageSync: () => { throw new Error('locked'); } }),
    接口缺失: () => ({}),
    返回垃圾: () => ({ getStorageSync: () => ({ 乱七八糟: true }), setStorageSync: () => {}, removeStorageSync: () => {} }),
  };
  const values = [null, undefined, 0, '', false, NaN, [], {}, { a: 1 }, 'x'.repeat(3000), { deep: { x: [1, null] } }];

  Object.entries(backends).forEach(([name, make]) => {
    values.forEach((value, vi) => {
      const api = make();
      const tag = `${name}/值#${vi}`;
      const sentinel = { 哨兵: true };
      const written = S.writeStorage('k', value, { api, schemaVersion: 1 });
      assert.equal(typeof (written || {}).ok, 'boolean', `${tag}: 写入未返回显式结果`);
      if (!written.ok) assert.ok(written.error && written.error.code, `${tag}: 失败缺错误码`);
      const read = S.readStorage('k', { api, schemaVersion: 1, defaultValue: sentinel });
      assert.equal(typeof (read || {}).ok, 'boolean', `${tag}: 读取未返回显式结果`);
      if (!read.ok) assert.equal(read.value, sentinel, `${tag}: 读取失败未回落到默认值`);
      assert.equal(typeof S.removeStorage('k', { api }).ok, 'boolean', `${tag}: 删除未返回显式结果`);
    });
  });

  // 校验函数是各页自己写的，读盘时喂给它的是磁盘上的任意内容。
  // `(v) => v.answers && ...` 这种不够防御的写法碰上 null 就抛——
  // 一抛就绕过整套失败处理，页面拿不到 ok:false，也就不会提示用户。
  // 同一个函数里 migrate 早就是包起来的，validate 漏包属于不一致。
  const boom = () => { throw new Error('validator boom'); };
  const live = () => { const m = new Map(); return { getStorageSync: (k) => (m.has(k) ? m.get(k) : ''), setStorageSync: (k, v) => m.set(k, v), removeStorageSync: (k) => m.delete(k) }; };
  const api = live();
  assert.equal(S.writeStorage('v', { a: 1 }, { api, schemaVersion: 1, validate: boom }).ok, false,
    '校验函数抛异常应被当作判否，而不是冒到调用方');
  S.writeStorage('v', { a: 1 }, { api, schemaVersion: 1 });
  assert.equal(S.readStorage('v', { api, schemaVersion: 1, defaultValue: 'fallback', validate: boom }).ok, false,
    '读取时校验函数抛异常同样应被吸收');
});
