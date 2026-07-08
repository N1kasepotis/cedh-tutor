// 套牌试玩的纯逻辑：MTGO 文本解析、区域状态机、抓牌/移动/洗牌。
// 页面只做渲染与手势，所有规则集中在这里以便 Node 测试。

const { normalizeCardName } = require('./scryfall');

const PLAYTEST_ZONES = ['battlefield', 'hand', 'library', 'graveyard', 'exile', 'command'];

const ZONE_LABELS = {
  battlefield: '战场',
  hand: '手牌',
  library: '牌库',
  graveyard: '坟场',
  exile: '放逐区',
  command: '主将区',
};

const MAX_DECK_LINES = 400;

const SECTION_HEADERS = {
  commander: 'command',
  commanders: 'command',
  command: 'command',
  deck: 'main',
  main: 'main',
  mainboard: 'main',
  maindeck: 'main',
  cards: 'main',
  sideboard: 'ignore',
  maybeboard: 'ignore',
  considering: 'ignore',
};

function normalizeSectionHeader(line) {
  return String(line || '')
    .toLowerCase()
    .replace(/[:：]/g, '')
    .replace(/\s+/g, '');
}

// MTGO/Moxfield/MTGso 纯文本：每行「数量 卡名」，允许 4x 写法；
// 可用 Commander / Deck 区段标题，也可用第一个空行把后段视为指挥官区；
// 无标题且无空行时，首 1–3 张自动识别为指挥官，其余归主牌。
function parseMtgoDeckText(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > MAX_DECK_LINES) {
    return { main: [], commanders: [], warnings: ['牌表行数过多，请确认是纯文本牌表'] };
  }

  const cards = [];
  const warnings = [];
  let sawCards = false;
  let explicitSection = false;
  let currentSection = 'main';
  let sawBlank = false;
  let afterBlank = false;

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      if (sawCards) { sawBlank = true; afterBlank = true; }
      return;
    }

    const section = SECTION_HEADERS[normalizeSectionHeader(line)];
    if (section) {
      explicitSection = true;
      currentSection = section;
      return;
    }

    // 数量前缀可选：无数量时默认 1 张（兼容直接粘贴卡名列表）
    let match = line.match(/^(\d+)[xX]?\s+(.+)$/);
    if (!match) match = [null, '1', line];

    const count = Number(match[1]);
    const name = normalizeCardName(match[2]);
    if (!count || count > 99 || !name) {
      warnings.push(`已忽略无法识别的行：${line}`);
      return;
    }

    sawCards = true;
    if (currentSection === 'ignore') return;
    cards.push({ count, name, section: currentSection, afterBlank });
  });

  // 分配：有区段标题 → 按标题；无标题但有空行 → 空行前为主牌，后为指挥官（兼容旧格式）；
  // 无标题且无空行的连续块 → 首 ≤3 张为指挥官
  const main = [];
  const commanders = [];
  const isSingleBlock = !explicitSection && !sawBlank;

  if (isSingleBlock && cards.length > 3) {
    const commanderCount = Math.min(3, cards.length - 1);
    for (let i = 0; i < commanderCount; i += 1) commanders.push(cleanCard(cards[i]));
    for (let i = commanderCount; i < cards.length; i += 1) main.push(cleanCard(cards[i]));
  } else if (explicitSection) {
    cards.forEach((card) => {
      (card.section === 'command' ? commanders : main).push(cleanCard(card));
    });
  } else {
    // 旧格式：空行前 → main，空行后 → command
    cards.forEach((card) => {
      (card.afterBlank ? commanders : main).push(cleanCard(card));
    });
  }

  return { main, commanders, warnings };
}

function cleanCard(card) {
  return { count: card.count, name: card.name };
}

function expandCards(entries, startId) {
  const cards = [];
  let nextId = startId;

  (entries || []).forEach((entry) => {
    for (let i = 0; i < entry.count; i += 1) {
      cards.push({ id: nextId, name: entry.name });
      nextId += 1;
    }
  });

  return { cards, nextId };
}

function shuffleInPlace(cards, rng) {
  const random = typeof rng === 'function' ? rng : Math.random;
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const swap = cards[i];
    cards[i] = cards[j];
    cards[j] = swap;
  }
  return cards;
}

// 建局：主牌洗入牌库，指挥官进主将区，抓起手 7 张。
function createGame(parsed, rng) {
  const mainExpand = expandCards(parsed.main, 1);
  const commandExpand = expandCards(parsed.commanders, mainExpand.nextId);

  const game = {
    battlefield: [],
    hand: [],
    library: shuffleInPlace(mainExpand.cards, rng),
    graveyard: [],
    exile: [],
    command: commandExpand.cards,
  };

  drawCards(game, 7);
  return game;
}

// 从牌库顶抓 n 张；牌库不足时抓到空为止。
function drawCards(game, count) {
  for (let i = 0; i < count; i += 1) {
    const card = game.library.shift();
    if (!card) break;
    game.hand.push(card);
  }
  return game;
}

function findCard(game, zone, cardId) {
  const cards = game[zone] || [];
  const index = cards.findIndex((card) => card.id === cardId);
  return index >= 0 ? { index, card: cards[index] } : null;
}

// 跨区移动。进牌库支持 top/bottom；进战场清掉横置并保留/初始化坐标。
// 衍生物（token: true）遵循 MTG 状态动作：一旦离开战场就直接消失，不进入目标区。
function moveCard(game, fromZone, cardId, toZone, options) {
  if (!PLAYTEST_ZONES.includes(fromZone) || !PLAYTEST_ZONES.includes(toZone)) return false;

  const found = findCard(game, fromZone, cardId);
  if (!found) return false;

  const config = options || {};
  game[fromZone].splice(found.index, 1);

  if (found.card.token && toZone !== 'battlefield') {
    return true;
  }

  const card = { id: found.card.id, name: found.card.name };
  if (found.card.token) card.token = true;

  if (toZone === 'battlefield') {
    card.tapped = false;
    card.x = Number.isFinite(config.x) ? config.x : 0;
    card.y = Number.isFinite(config.y) ? config.y : 0;
    game.battlefield.push(card);
    return true;
  }

  if (toZone === 'library' && config.position === 'bottom') {
    game.library.push(card);
    return true;
  }

  if (toZone === 'library') {
    game.library.unshift(card);
    return true;
  }

  game[toZone].push(card);
  return true;
}

function toggleTapped(game, cardId) {
  const found = findCard(game, 'battlefield', cardId);
  if (!found) return false;
  found.card.tapped = !found.card.tapped;
  return true;
}

function countZones(game) {
  const counts = {};
  PLAYTEST_ZONES.forEach((zone) => {
    counts[zone] = (game[zone] || []).length;
  });
  return counts;
}

module.exports = {
  PLAYTEST_ZONES,
  ZONE_LABELS,
  parseMtgoDeckText,
  expandCards,
  shuffleInPlace,
  createGame,
  drawCards,
  moveCard,
  toggleTapped,
  countZones,
};
