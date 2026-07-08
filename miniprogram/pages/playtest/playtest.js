const {
  ZONE_LABELS,
  parseMtgoDeckText,
  createGame,
  drawCards,
  moveCard,
  toggleTapped,
  countZones,
  shuffleInPlace,
} = require('../../utils/playtest');
const {
  MANA_COLORS,
  createManaPool,
  addMana,
  removeMana,
  resetManaPool,
  totalMana,
  saveManaPool,
  loadManaPool,
} = require('../../utils/playtest-mana');
const { buildScryfallImageUrl, normalizeCardName } = require('../../utils/scryfall');
const { splitCommanderNames } = require('../../utils/result-display');
const { enableShareMenu } = require('../../utils/share');

const DECK_TEXT_STORAGE_KEY = 'playtestDeckText';
const CARD_WIDTH = 66;
const CARD_HEIGHT = 92;
const DRAG_THRESHOLD = 6;
const LONGPRESS_MS = 350;

function buildInspectTargets(zone) {
  // 主将只在手牌 / 战场 / 坟场之间移动，不入库、不放逐、不回主将区
  if (zone === 'command') {
    return [
      { zone: 'hand', label: ZONE_LABELS.hand },
      { zone: 'battlefield', label: ZONE_LABELS.battlefield },
      { zone: 'graveyard', label: ZONE_LABELS.graveyard },
    ];
  }

  // 非主将区的牌不再提供「移到主将区」——主将区只容纳开局的主将
  const targets = [
    { zone: 'hand', label: ZONE_LABELS.hand },
    { zone: 'battlefield', label: ZONE_LABELS.battlefield },
    { zone: 'graveyard', label: ZONE_LABELS.graveyard },
    { zone: 'exile', label: ZONE_LABELS.exile },
    { zone: 'library', position: 'top', label: '库顶' },
    { zone: 'library', position: 'bottom', label: '库底' },
  ];

  return targets.filter((target) => target.zone === 'library' || target.zone !== zone);
}

Page({
  data: {
    imported: false,
    deckText: '',
    importWarning: '',
    life: 40,
    battlefield: [],
    hand: [],
    handScrollLeft: 0,
    counts: { battlefield: 0, hand: 0, library: 0, graveyard: 0, exile: 0, command: 0 },
    panelZone: '',
    panelTitle: '',
    panelCards: [],
    panelQuery: '',
    revealTop: false,
    topCardArt: '',
    commandPreview: { mode: 'empty', single: '', left: '', right: '' },
    graveyardTopArt: '',
    exileTopArt: '',
    inspect: null,
    inspectTargets: [],
    dragId: 0,
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
    manaTotal: 0,
  },

  onLoad() {
    enableShareMenu();
    this.game = null;
    this.parsed = null;
    this.zoneRects = null;
    this.drag = null;
    this.longpressFired = false;
    this.nextTokenId = -1;
    this.handScrollLeft = 0;
    this.manaPool = loadManaPool();

    try {
      const savedText = wx.getStorageSync(DECK_TEXT_STORAGE_KEY);
      if (savedText) this.setData({ deckText: savedText });
    } catch (e) {
      // storage unavailable, proceed with empty input
    }
  },

  onShareAppMessage() {
    return {
      title: '在手机上试玩你的 cEDH 套牌',
      path: '/pages/playtest/playtest',
    };
  },

  onShareTimeline() {
    return { title: '在手机上试玩你的 cEDH 套牌' };
  },

  handleDeckInput(event) {
    this.setData({ deckText: event.detail.value, importWarning: '' });
  },

  confirmClearDeckText() {
    if (!this.data.deckText) return;

    wx.showModal({
      title: '清除现套牌',
      content: '会清空输入框和已保存的牌表文本',
      confirmText: '清除',
      success: (result) => {
        if (!result.confirm) return;
        try {
          wx.removeStorageSync(DECK_TEXT_STORAGE_KEY);
        } catch (e) {
          // storage unavailable, skip
        }
        this.setData({ deckText: '', importWarning: '' });
      },
    });
  },

  importDeck() {
    const parsed = parseMtgoDeckText(this.data.deckText);

    if (!parsed.main.length && !parsed.commanders.length) {
      this.setData({ importWarning: parsed.warnings[0] || '没有识别到卡牌，请检查格式：每行「数量 卡名」' });
      return;
    }

    wx.setStorageSync(DECK_TEXT_STORAGE_KEY, this.data.deckText);
    this.parsed = parsed;
    this.game = createGame(parsed);
    this.nextTokenId = -1;
    this.handScrollLeft = 0;
    this.manaPool = createManaPool();

    this.setData({
      imported: true,
      life: 40,
      importWarning: parsed.warnings.length ? `${parsed.warnings.length} 行未识别，已跳过` : '',
      handScrollLeft: 0,
      revealTop: false,
    }, () => this.measureZones());
    this.syncView();
  },

  // 缓存各投放区域的视口矩形，供拖放命中检测
  measureZones() {
    const query = this.createSelectorQuery();
    query.select('#battlefield').boundingClientRect();
    query.select('#hand').boundingClientRect();
    query.select('#zone-command').boundingClientRect();
    query.select('#zone-library').boundingClientRect();
    query.select('#zone-graveyard').boundingClientRect();
    query.select('#zone-exile').boundingClientRect();
    query.exec((rects) => {
      if (!rects || !rects[0]) return;
      this.zoneRects = {
        battlefield: rects[0],
        hand: rects[1],
        command: rects[2],
        library: rects[3],
        graveyard: rects[4],
        exile: rects[5],
      };
    });
  },

  syncView(options) {
    if (!this.game) return;

    const config = typeof options === 'function' ? { callback: options } : (options || {});

    this.setData({
      // 非牌库区的卡带 normal 直连卡图；衍生物保持文字瓦片
      battlefield: this.game.battlefield.map((card) => ({
        ...card,
        art: card.token ? '' : buildScryfallImageUrl(card.name),
      })),
      hand: this.game.hand.map((card) => ({
        id: card.id,
        name: card.name,
        art: buildScryfallImageUrl(card.name),
      })),
      counts: countZones(this.game),
      topCardArt: this.buildTopCardArt(this.data.revealTop),
      commandPreview: this.buildCommandPreview(),
      graveyardTopArt: this.buildZoneTopArt('graveyard'),
      exileTopArt: this.buildZoneTopArt('exile'),
      manaPool: { ...this.manaPool },
      manaTotal: totalMana(this.manaPool),
    }, () => {
      if (!config.skipPanelRefresh && this.data.panelZone) this.refreshPanel(this.data.panelZone);
      if (typeof config.callback === 'function') config.callback();
    });
  },

  scrollHandToEnd() {
    this.handScrollLeft = (this.handScrollLeft || 0) + 10000;
    this.setData({ handScrollLeft: this.handScrollLeft });
  },

  // ===== 抓牌 / 打出 =====

  drawOne() {
    if (!this.game || !this.game.library.length) {
      wx.showToast({ title: '牌库已空', icon: 'none' });
      return;
    }
    drawCards(this.game, 1);
    this.syncView(() => this.scrollHandToEnd());
  },

  // 找战场上第一个没被占用的网格格子。以「已占格子」而非「战场牌数」定位，
  // 否则把中间某张牌收回手后再打出时，index=牌数 会正好落在最后一张牌的格子上，直接压住它。
  nextFieldSlot() {
    const rect = this.zoneRects && this.zoneRects.battlefield;
    const stepX = CARD_WIDTH + 8;
    const stepY = CARD_HEIGHT + 8;
    const width = rect && rect.width ? rect.width : 320;
    const height = rect && rect.height ? rect.height : 8 + stepY * 4;
    const columns = Math.max(1, Math.floor((width - 16) / stepX));
    const rows = Math.max(1, Math.floor((height - 8) / stepY));
    const cards = (this.game && this.game.battlefield) || [];

    // 第 index 格的左上角：有战场尺寸时从左下角往上铺，否则从左上角往下铺
    const slotAt = (index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = 8 + col * stepX;
      const y = rect
        ? Math.max(8, height - CARD_HEIGHT - 8 - row * stepY)
        : 8 + row * stepY;
      return { x, y };
    };

    // 该格是否已被某张牌占据（含被手动拖到附近的牌），避免新牌精确压在旧牌上
    const occupied = (x, y) => cards.some((card) => (
      Math.abs((card.x || 0) - x) < CARD_WIDTH * 0.6
      && Math.abs((card.y || 0) - y) < CARD_HEIGHT * 0.6
    ));

    for (let index = 0; index < columns * rows; index += 1) {
      const slot = slotAt(index);
      if (!occupied(slot.x, slot.y)) return slot;
    }

    // 网格排满：沿对角线小幅级联偏移，尽量不与任何牌精确重叠
    let fallback = slotAt(0);
    for (let bump = 0; bump < 24 && occupied(fallback.x, fallback.y); bump += 1) {
      fallback = { x: fallback.x + 10, y: Math.max(8, fallback.y - 10) };
    }
    return fallback;
  },

  playFromHand(event) {
    const cardId = Number(event.currentTarget.dataset.id);
    moveCard(this.game, 'hand', cardId, 'battlefield', this.nextFieldSlot());
    this.syncView();
  },

  addToken() {
    if (!this.game) return;

    const slot = this.nextFieldSlot();
    this.game.battlefield.push({
      id: this.nextTokenId,
      name: 'Token',
      tapped: false,
      x: slot.x,
      y: slot.y,
      token: true,
    });
    this.nextTokenId -= 1;
    this.syncView();
  },

  randomDiscard() {
    if (!this.game) return;
    const hand = this.game.hand;
    if (!hand.length) return;

    const idx = Math.floor(Math.random() * hand.length);
    const card = hand[idx];

    wx.showModal({
      title: '随机弃牌',
      content: `弃掉「${card.name}」？`,
      confirmText: '弃掉',
      success: (result) => {
        if (!result.confirm) return;
        moveCard(this.game, 'hand', card.id, 'graveyard');
        this.syncView();
      },
    });
  },

  // ===== 战场拖放：移动更新单卡坐标，释放时命中检测 =====

  fieldTouchStart(event) {
    if (!this.game) return;
    const index = Number(event.currentTarget.dataset.index);
    const card = this.game.battlefield[index];
    if (!card) return;

    const touch = event.touches[0];
    this.longpressFired = false;
    this.drag = {
      id: card.id,
      index,
      startX: touch.clientX,
      startY: touch.clientY,
      cardX: card.x,
      cardY: card.y,
      moved: false,
    };
    // 战场卡的自定义拖拽 touch 会打断系统 bindlongpress，另用计时器保证长按放大稳定触发
    this.clearFieldLongpress();
    this.fieldLongpressTimer = setTimeout(() => this.fireFieldLongpress(card.id), LONGPRESS_MS);
  },

  fieldTouchMove(event) {
    const drag = this.drag;
    if (!drag) return;
    if (this.longpressFired) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - drag.startX;
    const deltaY = touch.clientY - drag.startY;
    if (!drag.moved && Math.abs(deltaX) < DRAG_THRESHOLD && Math.abs(deltaY) < DRAG_THRESHOLD) return;

    // 位移超过阈值 = 拖拽，取消待触发的长按
    this.clearFieldLongpress();
    drag.moved = true;
    const rect = this.zoneRects && this.zoneRects.battlefield;
    let x = drag.cardX + deltaX;
    let y = drag.cardY + deltaY;
    if (rect) {
      x = Math.max(-CARD_WIDTH / 2, Math.min(x, rect.width - CARD_WIDTH / 2));
      y = Math.max(-CARD_HEIGHT / 2, Math.min(y, rect.height + CARD_HEIGHT / 2));
    }

    this.setData({
      [`battlefield[${drag.index}].x`]: x,
      [`battlefield[${drag.index}].y`]: y,
      dragId: drag.id,
    });
  },

  fieldTouchEnd(event) {
    this.clearFieldLongpress();
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;

    if (this.longpressFired) {
      this.longpressFired = false;
      return;
    }

    // 位移未超过阈值视为单击：横置 / 竖置
    if (!drag.moved) {
      toggleTapped(this.game, drag.id);
      this.syncView();
      return;
    }

    const touch = event.changedTouches[0];
    const dropZone = this.hitTestZone(touch.clientX, touch.clientY);

    if (dropZone && dropZone !== 'battlefield') {
      moveCard(this.game, 'battlefield', drag.id, dropZone);
      this.setData({ dragId: 0 });
      this.syncView(dropZone === 'hand' ? () => this.scrollHandToEnd() : undefined);
      return;
    }

    // 落在战场之外、又不属于任何指定区域的「黑区」：收回手牌。
    // 否则卡牌会被夹在战场边缘外、被 overflow:hidden 裁掉，看着像凭空消失。
    if (!dropZone && !this.isInsideBattlefield(touch.clientX, touch.clientY)) {
      moveCard(this.game, 'battlefield', drag.id, 'hand');
      this.setData({ dragId: 0 });
      this.syncView(() => this.scrollHandToEnd());
      return;
    }

    // 留在战场：把新坐标写回状态
    const card = this.game.battlefield[drag.index];
    if (card) {
      card.x = this.data.battlefield[drag.index].x;
      card.y = this.data.battlefield[drag.index].y;
    }
    this.setData({ dragId: 0 });
  },

  hitTestZone(clientX, clientY) {
    const rects = this.zoneRects;
    if (!rects) return '';

    const zones = ['hand', 'command', 'library', 'graveyard', 'exile'];
    for (let i = 0; i < zones.length; i += 1) {
      const rect = rects[zones[i]];
      if (rect
        && clientX >= rect.left && clientX <= rect.right
        && clientY >= rect.top && clientY <= rect.bottom) {
        return zones[i];
      }
    }
    return '';
  },

  isInsideBattlefield(clientX, clientY) {
    const rect = this.zoneRects && this.zoneRects.battlefield;
    // 测不到战场矩形时保守处理：维持「留在战场」旧行为，不误把牌收回手
    if (!rect) return true;
    return clientX >= rect.left && clientX <= rect.right
      && clientY >= rect.top && clientY <= rect.bottom;
  },

  // ===== 区域面板（单击展开 / 牌库长按查找） =====

  openZone(event) {
    const zone = event.currentTarget.dataset.zone;
    if (!zone || !this.game) return;
    if (zone !== this.data.panelZone) this.setData({ panelQuery: '' });
    this.refreshPanel(zone);
  },

  refreshPanel(zone) {
    // 查询也归一化弯引号，与已归一化的存储名对齐
    const query = normalizeCardName(this.data.panelQuery).toLowerCase();
    const cards = (this.game[zone] || [])
      .filter((card) => !query || card.name.toLowerCase().includes(query))
      .map((card) => ({ id: card.id, name: card.name }));

    this.setData({
      panelZone: zone,
      panelTitle: zone === 'library' ? '查找牌库' : (ZONE_LABELS[zone] || zone),
      panelCards: cards,
    });
  },

  handlePanelSearch(event) {
    this.setData({ panelQuery: event.detail.value }, () => {
      if (this.data.panelZone) this.refreshPanel(this.data.panelZone);
    });
  },

  closeZone() {
    this.setData({ panelZone: '', panelCards: [], panelQuery: '' });
  },

  shuffleLibrary() {
    shuffleInPlace(this.game.library);
    // 洗牌后牌库顺序回归隐藏信息，自动关闭检索面板
    this.closeZone();
    wx.showToast({ title: '已洗牌', icon: 'none' });
    this.syncView();
  },

  // 展示库顶模式（Bolas's Citadel / Mystic Forge 类效应）：开启后牌库芯片以库顶
  // 第一张的 art_crop 无字大画铺底。syncView 每次重算，抓牌/检索/洗牌后自动跟随。
  buildTopCardArt(revealTop) {
    if (!revealTop || !this.game || !this.game.library.length) return '';
    return buildScryfallImageUrl(this.game.library[0].name, 'art_crop');
  },

  toggleRevealTop() {
    const revealTop = !this.data.revealTop;
    this.setData({ revealTop, topCardArt: this.buildTopCardArt(revealTop) });
  },

  // 主将区：按 主将推荐结算界面 呈现——单主将居中大画，双拍档左右分屏。
  // 主将可能一行一张（game.command 多条目）或一行 "A / B"（splitCommanderNames 再拆）。
  buildCommandPreview() {
    const faces = ((this.game && this.game.command) || [])
      .reduce((list, card) => list.concat(splitCommanderNames(card.name)), []);
    if (!faces.length) return { mode: 'empty', single: '', left: '', right: '' };
    if (faces.length === 1) {
      return { mode: 'single', single: buildScryfallImageUrl(faces[0], 'art_crop'), left: '', right: '' };
    }
    return {
      mode: 'dual',
      single: '',
      left: buildScryfallImageUrl(faces[0], 'art_crop'),
      right: buildScryfallImageUrl(faces[1], 'art_crop'),
    };
  },

  // 坟场 / 放逐区：最上方（最近置入 = 数组末位）一张的 art_crop 大画，恒显（无开关，逻辑同展示库顶）。
  buildZoneTopArt(zone) {
    const cards = (this.game && this.game[zone]) || [];
    if (!cards.length) return '';
    return buildScryfallImageUrl(cards[cards.length - 1].name, 'art_crop');
  },

  movePanelCard(event) {
    const cardId = Number(event.currentTarget.dataset.id);
    const toZone = event.currentTarget.dataset.to;
    const fromZone = this.data.panelZone;
    const options = toZone === 'battlefield' ? this.nextFieldSlot() : {};

    const moved = moveCard(this.game, fromZone, cardId, toZone, options);
    if (!moved) return;

    if (fromZone === 'library') {
      shuffleInPlace(this.game.library);
      this.closeZone();
      wx.showToast({ title: '已查找并洗牌', icon: 'none' });
      this.syncView({
        skipPanelRefresh: true,
        callback: toZone === 'hand' ? () => this.scrollHandToEnd() : null,
      });
      return;
    }

    this.syncView(toZone === 'hand' ? () => this.scrollHandToEnd() : undefined);
  },

  // ===== 长按详视 =====

  // 长按战场卡：放大查看卡图（衍生物无卡图，长按直接移除）。
  // 系统 bindlongpress 与拖拽计时器都进这里，靠 longpressFired 去重。
  inspectFieldCard(event) {
    this.fireFieldLongpress(Number(event.currentTarget.dataset.id));
  },

  clearFieldLongpress() {
    if (this.fieldLongpressTimer) {
      clearTimeout(this.fieldLongpressTimer);
      this.fieldLongpressTimer = null;
    }
  },

  fireFieldLongpress(cardId) {
    this.clearFieldLongpress();
    if (this.longpressFired || !this.game) return;
    this.longpressFired = true;

    const card = this.game.battlefield.find((item) => item.id === cardId);
    if (card && card.token) {
      this.game.battlefield = this.game.battlefield.filter((item) => item.id !== cardId);
      this.syncView();
      return;
    }

    this.showInspect('battlefield', cardId);
  },

  inspectHandCard(event) {
    this.showInspect('hand', Number(event.currentTarget.dataset.id));
  },

  inspectPanelCard(event) {
    this.showInspect(this.data.panelZone, Number(event.currentTarget.dataset.id));
  },

  showInspect(zone, cardId) {
    const card = (this.game[zone] || []).find((item) => item.id === cardId);
    if (!card) return;

    this.setData({
      inspect: {
        id: card.id,
        zone,
        name: card.name,
        imageUrl: buildScryfallImageUrl(card.name, 'normal'),
      },
      inspectTargets: buildInspectTargets(zone),
    });
  },

  closeInspect() {
    this.setData({ inspect: null, inspectTargets: [] });
  },

  moveInspectCard(event) {
    const inspect = this.data.inspect;
    if (!inspect) return;

    const toZone = event.currentTarget.dataset.to;
    const position = event.currentTarget.dataset.position;
    const options = toZone === 'battlefield' ? this.nextFieldSlot() : { position };

    const moved = moveCard(this.game, inspect.zone, inspect.id, toZone, options);
    if (!moved) return;

    if (inspect.zone === 'library') {
      shuffleInPlace(this.game.library);
      this.closeZone();
      this.closeInspect();
      wx.showToast({ title: '已查找并洗牌', icon: 'none' });
      this.syncView({
        skipPanelRefresh: true,
        callback: toZone === 'hand' ? () => this.scrollHandToEnd() : null,
      });
      return;
    }

    this.closeInspect();
    this.syncView(toZone === 'hand' ? () => this.scrollHandToEnd() : undefined);
  },

  // ===== 刷新 / 换套牌 =====

  lifeUp() {
    this.setData({ life: Math.min(this.data.life + 1, 999) });
  },

  lifeDown() {
    this.setData({ life: Math.max(this.data.life - 1, 0) });
  },

  resetBoard() {
    if (!this.game) return;
    this.game.battlefield.forEach((card) => {
      card.tapped = false;
    });
    this.syncView();
    wx.showToast({ title: '已重置所有永久物', icon: 'none' });
  },

  manaAdd(event) {
    const color = event.currentTarget.dataset.color;
    if (!color || !this.manaPool) return;
    addMana(this.manaPool, color);
    saveManaPool(this.manaPool);
    this.syncView();
  },

  manaRemove(event) {
    const color = event.currentTarget.dataset.color;
    if (!color || !this.manaPool) return;
    removeMana(this.manaPool, color);
    saveManaPool(this.manaPool);
    this.syncView();
  },

  manaReset() {
    if (!this.manaPool) return;
    wx.showModal({
      title: '清空法力池',
      content: '将所有颜色的法力量归零？',
      confirmText: '清空',
      success: (result) => {
        if (!result.confirm) return;
        resetManaPool(this.manaPool);
        saveManaPool(this.manaPool);
        this.syncView();
      },
    });
  },

  confirmRestart() {
    wx.showModal({
      title: '刷新局面',
      content: '重新洗牌并抓起手 7 张，当前局面会被清空',
      confirmText: '刷新',
      success: (result) => {
        if (!result.confirm || !this.parsed) return;
        this.game = createGame(this.parsed);
        this.nextTokenId = -1;
        this.handScrollLeft = 0;
        this.manaPool = createManaPool();
        this.closeZone();
        this.closeInspect();
        // 新对局：授予展示库顶的永久物已随局面清空，回到隐藏，不泄露新库顶
        this.setData({ life: 40, handScrollLeft: 0, revealTop: false });
        this.syncView();
      },
    });
  },

});
