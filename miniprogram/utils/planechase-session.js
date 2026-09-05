// 持久化的牌桌操作记录：普通掷骰受时机限制，效应与独立触发可交错。
// 不模拟玩家战场或完整堆叠；由牌桌选择下一个实际结算的能力。
const P = require('./planechase');
const { PLANECHASE_CARDS } = require('../config/planechase');
const { LEGACY_CARD_IDS } = require('../config/planechase-rules');
const SCHEMA_VERSION = 2;
const PLAYER_COUNTS = [2, 3, 4, 5];
const idToIndex = new Map(PLANECHASE_CARDS.map((row, index) => [row[6], index]));
const copy = (value) => JSON.parse(JSON.stringify(value));
const validIndex = (index) => Number.isInteger(index) && index >= 0 && index < PLANECHASE_CARDS.length;
const validCounter = (value) => Number.isSafeInteger(value) && value >= 0;
const isPlane = (index) => validIndex(index) && PLANECHASE_CARDS[index][0] === 'P';

function isGame(game) {
  if (!game || !PLAYER_COUNTS.includes(game.playerCount)
    || !Array.isArray(game.planarDeck) || !Array.isArray(game.activePlanes) || !game.activePlanes.length
    || !validCounter(game.rollsThisTurn) || !['none', 'blankIsChaos'].includes(game.dieModifier)
    || ![null, 'encounter'].includes(game.pending) || !Array.isArray(game.trimmed)) return false;
  const all = game.planarDeck.concat(game.activePlanes);
  if (!all.every(validIndex) || new Set(all).size !== all.length) return false;
  const excluded = PLANECHASE_CARDS.map((row, index) => index).filter((index) => !all.includes(index));
  const limits = P.planarDeckLimits(game.playerCount);
  const expectedTrim = Math.max(0, PLANECHASE_CARDS.filter((row) => row[0] === 'X').length - limits.maxPhenomena);
  if (excluded.length !== expectedTrim || excluded.some(isPlane)
    || !P.isPermutation(game.trimmed, excluded.map((index) => PLANECHASE_CARDS[index][1]))) return false;
  const encounter = game.activePlanes.some((index) => !isPlane(index));
  if (encounter !== (game.pending === 'encounter') || (encounter && game.activePlanes.length !== 1)) return false;
  if (!game.limits || game.limits.minCards !== limits.minCards || game.limits.maxPhenomena !== limits.maxPhenomena) return false;
  if (game.lastRoll !== null) {
    const r = game.lastRoll;
    if (!r || !P.DIE_FACES.includes(r.rolled) || !P.DIE_FACES.includes(r.face) || !validCounter(r.cost)
      || typeof r.modified !== 'boolean' || !['special', 'effect'].includes(r.source)
      || (r.modified ? r.rolled !== 'blank' || r.face !== 'chaos' : r.face !== r.rolled)
      || (r.source === 'effect' && r.cost !== 0)) return false;
  }
  return true;
}

function frameOf(session) { const frame = copy(session); delete frame.undo; return frame; }
function createSession(playerCount = 4, rng = Math.random) {
  return { game: P.createGame(PLAYER_COUNTS.includes(playerCount) ? playerCount : 4, rng),
    triggers: [], nextTrigger: 1, visit: 1, reveal: null, lastAction: '新对局已开始',
    tableNotes: [], undo: null };
}
function isTrigger(source, nextId, visit) {
  if (!source || !validCounter(source.id) || source.id < 1 || source.id >= nextId) return false;
  if (source.kind === 'encounter' ? !validCounter(source.visit) || source.visit < 1 || source.visit > visit : source.visit !== null) return false;
  if (source.kind === 'walk') return source.cardIndex === null;
  if (!validIndex(source.cardIndex)) return false;
  if (source.kind === 'encounter') return !isPlane(source.cardIndex);
  if (source.kind === 'entryChaos') return P.planarActionFor(source.cardIndex) === 'append';
  return source.kind === 'chaos' && isPlane(source.cardIndex);
}
function isFrame(frame) {
  if (!frame || !isGame(frame.game) || !Array.isArray(frame.triggers) || frame.triggers.length > 200
    || !validCounter(frame.nextTrigger) || frame.nextTrigger < 1
    || !validCounter(frame.visit) || frame.visit < 1
    || !frame.triggers.every((source) => isTrigger(source, frame.nextTrigger, frame.visit))
    || new Set(frame.triggers.map((source) => source.id)).size !== frame.triggers.length
    || typeof frame.lastAction !== 'string' || frame.lastAction.length > 300
    || !Array.isArray(frame.tableNotes) || frame.tableNotes.length > 100
    || !frame.tableNotes.every((note) => typeof note === 'string' && note.length <= 1000)) return false;
  if (frame.reveal !== null) {
    const r = frame.reveal;
    if (!r || !['merge', 'append', 'echo', 'leave'].includes(r.kind)
      || !Array.isArray(r.indices) || !r.indices.length || !r.indices.every(validIndex)
      || new Set(r.indices).size !== r.indices.length || !Array.isArray(r.bottomOrder)
      || !Array.isArray(r.exitOrder)) return false;
    const expected = r.kind === 'leave' ? frame.game.activePlanes
      : r.kind === 'echo' ? r.indices : r.indices.filter((index) => !isPlane(index));
    if (!P.isPermutation(r.bottomOrder, expected)) return false;
    const exit = r.kind === 'merge' ? frame.game.activePlanes : [];
    if (!P.isPermutation(r.exitOrder, exit)) return false;
    const source = frame.triggers.find((item) => item.id === r.sourceId);
    if (r.kind === 'leave') {
      if (!P.isPermutation(r.indices, frame.game.activePlanes)
        || (r.sourceId !== null && (!source || source.kind !== 'walk'))) return false;
    } else {
      const prefix = P.revealUntilPlanes(frame.game, r.kind === 'merge' ? 2 : 1);
      if (JSON.stringify(prefix) !== JSON.stringify(r.indices) || !source) return false;
      if (r.kind === 'merge') {
        if (source.kind !== 'encounter' || P.planarActionFor(source.cardIndex) !== 'merge') return false;
      } else if (source.kind !== 'chaos' || P.planarActionFor(source.cardIndex) !== r.kind) return false;
    }
  }
  return true;
}
function isSession(session) {
  try { return isFrame(session) && (session.undo === null || isFrame(session.undo)); } catch (error) { return false; }
}
function translateFrame(frame, mapper) {
  const out = copy(frame);
  out.game.planarDeck = out.game.planarDeck.map(mapper);
  out.game.activePlanes = out.game.activePlanes.map(mapper);
  out.triggers.forEach((source) => { if (source.cardIndex !== null) source.cardIndex = mapper(source.cardIndex); });
  if (out.reveal) ['indices', 'bottomOrder', 'exitOrder'].forEach((key) => { out.reveal[key] = out.reveal[key].map(mapper); });
  return out;
}
function encodeSession(session) {
  if (!isSession(session)) throw new Error('invalid_session');
  const toId = (index) => PLANECHASE_CARDS[index][6];
  const stored = translateFrame(frameOf(session), toId);
  stored.undo = session.undo ? translateFrame(session.undo, toId) : null;
  return stored;
}
function decodeSession(stored) {
  try {
    const toIndex = (id) => idToIndex.get(id);
    const session = translateFrame(stored, toIndex);
    session.undo = stored.undo ? translateFrame(stored.undo, toIndex) : null;
    return isSession(session) ? session : null;
  } catch (error) { return null; }
}
function addTrigger(session, kind, cardIndex = null, visit = kind === 'encounter' ? session.visit : null) {
  session.triggers.push({ id: session.nextTrigger++, kind, cardIndex, visit });
}
function addChaos(session, indices) { indices.filter(isPlane).forEach((index) => addTrigger(session, 'chaos', index)); }
function removeTrigger(session, id) { session.triggers = session.triggers.filter((source) => source.id !== id); }
function migrateStoredSession(value) {
  // 冻结旧版下标对应的 Oracle 身份，换印次或重新排序不会把存档变成另一张牌。
  const game = copy(value);
  const remap = (index) => Number.isInteger(index) ? idToIndex.get(LEGACY_CARD_IDS[index]) : undefined;
  game.planarDeck = game.planarDeck.map(remap);
  game.activePlanes = game.activePlanes.map(remap);
  if (game.lastRoll) game.lastRoll.source = 'special';
  const session = { game, triggers: [], nextTrigger: 1, visit: 1, reveal: null,
    lastAction: '已恢复上次对局', tableNotes: ['旧版没有保存待结算步骤，请与牌桌核对上次掷骰及触发'], undo: null };
  if (game.pending === 'encounter') {
    // v1 在翻出乙太混沦时就误启用修正；先恢复为尚未结算。
    if (P.planarActionFor(game.activePlanes[0]) === 'aether') game.dieModifier = 'none';
    addTrigger(session, 'encounter', game.activePlanes[0]);
  }
  return encodeSession(session);
}
function noteTransition(session, before) {
  const after = session.game.activePlanes;
  const left = before.filter((index) => !after.includes(index));
  const entered = after.filter((index) => !before.includes(index));
  if (left.length || entered.length) session.visit += 1;
  left.forEach((index) => {
    P.cardAt(index).staticLines.filter((line) => /当你时空换出/.test(line))
      .forEach((line) => session.tableNotes.push(P.cardAt(index).name + '：' + line));
  });
  entered.forEach((index) => {
    if (!isPlane(index)) addTrigger(session, 'encounter', index);
    if (P.planarActionFor(index) === 'append') addTrigger(session, 'entryChaos', index);
    else P.cardAt(index).staticLines.filter((line) => /当你时空换入/.test(line))
      .forEach((line) => session.tableNotes.push(P.cardAt(index).name + '：' + line));
  });
}
function canLeavePhenomenon(session) {
  return session.game.pending === 'encounter'
    && !session.triggers.some((source) => source.kind === 'encounter' && source.visit === session.visit
      && session.game.activePlanes.includes(source.cardIndex));
}
function phaseOf(session) {
  if (session.reveal) return 'reveal';
  if (canLeavePhenomenon(session)) return 'exit';
  if (session.triggers.length) return 'resolve';
  if (session.tableNotes.length) return 'notes';
  return 'ready';
}
function beginWalk(session, sourceId) {
  if (session.game.activePlanes.length > 1) {
    const indices = session.game.activePlanes.slice();
    session.reveal = { kind: 'leave', sourceId, indices, bottomOrder: indices.slice(), exitOrder: [] };
    session.lastAction = '排列换出时空的置底顺序';
  } else {
    const before = session.game.activePlanes.slice();
    P.planeswalk(session.game);
    removeTrigger(session, sourceId);
    session.lastAction = '换入 ' + P.cardAt(session.game.activePlanes[0]).name;
    noteTransition(session, before);
  }
}
function transition(session, action, rng = Math.random) {
  if (!isSession(session) || !action) return null;
  if (action.type === 'undo') return session.undo ? { ...copy(session.undo), undo: null } : null;
  const next = copy(session);
  next.undo = frameOf(session);
  const phase = phaseOf(session);
  // 状态动作先于获得优先权与结算下一项能力（CR 704.6f）。
  if (phase === 'exit' && !['leavePhenomenon', 'restart'].includes(action.type)) return null;
  const before = session.game.activePlanes.slice();
  switch (action.type) {
    case 'roll': {
      if ((action.effect ? phase === 'reveal' : phase !== 'ready')
        || next.game.rollsThisTurn >= Number.MAX_SAFE_INTEGER) return null;
      const result = P.rollPlanarDie(next.game, rng, { effect: action.effect === true });
      if (result.face === 'planeswalk') addTrigger(next, 'walk');
      if (result.face === 'chaos') addChaos(next, next.game.activePlanes);
      next.lastAction = (action.effect ? '效应掷骰：' : result.cost ? '支付 ' + result.cost + ' 法术力，掷出' : '免费掷出')
        + { blank: '空白', chaos: '混沌', planeswalk: '换境' }[result.face];
      next.tableNotes = next.tableNotes.concat(next.game.activePlanes.flatMap((index) => P.cardAt(index).staticLines.filter((line) => /每当你掷时空骰/.test(line))));
      break;
    }
    case 'walk':
      if (phase === 'reveal') return null;
      beginWalk(next, null);
      break;
    case 'leavePhenomenon':
      if (phase === 'reveal' || !canLeavePhenomenon(next)) return null;
      beginWalk(next, null);
      break;
    case 'causeChaos':
      if (phase === 'reveal') return null;
      addChaos(next, next.game.activePlanes);
      next.lastAction = '效应引发当前时空混沌';
      break;
    case 'copyTrigger': {
      if (phase === 'reveal') return null;
      const source = next.triggers.find((item) => item.id === action.id);
      if (!source) return null;
      addTrigger(next, source.kind, source.cardIndex, source.visit);
      next.lastAction = '已添加一个触发副本';
      break;
    }
    case 'resolveTrigger': {
      if (phase === 'reveal') return null;
      const source = next.triggers.find((item) => item.id === action.id);
      if (!source) return null;
      const kind = source.kind === 'walk' ? 'walk'
        : source.kind === 'entryChaos' ? 'entryChaos' : P.planarActionFor(source.cardIndex);
      if (action.prevented) {
        removeTrigger(next, source.id);
        next.lastAction = '触发已被反击或阻止，掷骰次数保留';
      } else if (kind === 'walk') {
        beginWalk(next, source.id);
      } else if (kind === 'entryChaos') {
        removeTrigger(next, source.id);
        addChaos(next, next.game.activePlanes);
        next.lastAction = '进场触发已结算，当前时空引发混沌';
      } else if (['append', 'echo', 'merge'].includes(kind)) {
        const indices = P.revealUntilPlanes(next.game, kind === 'merge' ? 2 : 1);
        next.reveal = { kind, sourceId: source.id, indices,
          bottomOrder: kind === 'echo' ? indices.slice() : indices.filter((index) => !isPlane(index)),
          exitOrder: kind === 'merge' ? before.slice() : [] };
        next.lastAction = '请确认置底顺序';
      } else {
        if (source.kind === 'encounter' && kind === 'aether') next.game.dieModifier = 'blankIsChaos';
        removeTrigger(next, source.id);
        next.lastAction = P.cardAt(source.cardIndex).name + '的能力已结算';
      }
      break;
    }
    case 'order': {
      if (!next.reveal) return null;
      const list = action.group === 'exit' ? next.reveal.exitOrder : next.reveal.bottomOrder;
      const position = list.indexOf(action.index);
      const target = position + action.delta;
      if (![-1, 1].includes(action.delta) || position < 0 || target < 0 || target >= list.length) return null;
      [list[position], list[target]] = [list[target], list[position]];
      next.undo = session.undo;
      break;
    }
    case 'applyReveal': {
      const reveal = next.reveal;
      if (!reveal) return null;
      if (reveal.kind === 'leave') {
        next.game.activePlanes = reveal.bottomOrder.slice();
        P.planeswalk(next.game);
      } else if (reveal.kind === 'echo') {
        if (!P.bottomRevealed(next.game, reveal.indices, reveal.bottomOrder)) return null;
        addChaos(next, reveal.indices);
      } else if (!reveal.indices.some(isPlane)) {
        // 所有时空都已在场时，仍尽可能执行：展示异象置底，完成能力。
        if (!P.bottomRevealed(next.game, reveal.indices, reveal.bottomOrder)) return null;
      } else {
        if (reveal.kind === 'merge') next.game.activePlanes = reveal.exitOrder.slice();
        if (!P.planeswalkTo(next.game, reveal.indices, { append: reveal.kind === 'append', bottomOrder: reveal.bottomOrder })) return null;
      }
      removeTrigger(next, reveal.sourceId);
      next.reveal = null;
      next.lastAction = reveal.kind === 'echo' ? '展示牌已置底，待结算混沌' : '展示与换境已完成';
      noteTransition(next, before);
      break;
    }
    case 'turn':
      if (phase !== 'ready') return null;
      P.endTurn(next.game); next.lastAction = '新回合，掷骰费用归零'; next.tableNotes = [];
      break;
    case 'acknowledgeNotes':
      if (phase === 'reveal' || !next.tableNotes.length) return null;
      next.tableNotes = []; next.lastAction = '牌桌事项已处理';
      break;
    case 'restart': {
      if (!PLAYER_COUNTS.includes(action.playerCount)) return null;
      const fresh = createSession(action.playerCount, rng);
      fresh.undo = frameOf(session);
      return fresh;
    }
    default: return null;
  }
  return isSession(next) ? next : null;
}
module.exports = { SCHEMA_VERSION, PLAYER_COUNTS, createSession, isGame, isSession, encodeSession, decodeSession, migrateStoredSession, phaseOf, canLeavePhenomenon, transition };

