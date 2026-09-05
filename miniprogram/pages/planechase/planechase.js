const P = require('../../utils/planechase');
const S = require('../../utils/planechase-session');
const { buildCdnArt } = require('../../utils/scryfall-cdn');
const { setKeepScreenOn } = require('../../utils/keep-screen-on');
const { enableShareMenu } = require('../../utils/share');
const { readStorage, writeStorage, backupStorage } = require('../../utils/storage');
const STORAGE_KEY = 'planechaseState';
const PHASE_LABELS = { ready: '当前时空', resolve: '能力待结算', exit: '异象待换出', reveal: '处理展示牌', notes: '牌桌事项待处理' };
const REVEAL_LABELS = { merge: '同时换入两张时空', append: '追加时空，保留当前时空', echo: '引发展示牌的混沌，全部置底', leave: '全部换出，按指定顺序置底' };
const FACE_LABELS = { blank: '空白', chaos: '混沌', planeswalk: '换境' };

Page({
  data: {
    planes: [], phase: 'ready', phaseLabel: '', playerCount: 4, deckLeft: 0,
    rollCost: 0, dieFace: 'idle', dieLabel: '尚未掷骰', lastAction: '',
    primaryLabel: '掷时空骰', canUndo: false, setupOpen: false, playerCounts: S.PLAYER_COUNTS,
    modifierOn: false, trimmedText: '', tableNotes: [], triggers: [], revealed: [],
    bottomOrder: [], exitOrder: [], canLeavePhenomenon: false, revealLabel: '', inspect: null, inspectFailed: false,
    saveError: '', actionError: '', recovery: false, canRecover: false, saving: false, hasSession: false,
  },

  onLoad() {
    enableShareMenu();
    this.failedArt = new Set();
    this.session = null;
    this.pendingCommit = null;
    this.prefetchedId = '';
    this.loadSession();
  },

  loadSession() {
    let migrated = false;
    const stored = readStorage(STORAGE_KEY, {
      schemaVersion: S.SCHEMA_VERSION, defaultValue: null, autoUpgrade: false,
      migrate: (value) => { migrated = true; return S.migrateStoredSession(value); },
      validate: (value) => Boolean(S.decodeSession(value)),
    });
    if (!stored.ok) {
      this.setData({ recovery: true, canRecover: stored.source === 'invalid', saveError: stored.source === 'future'
        ? '这份对局由较新版本保存，请更新小程序后继续。原存档已保留。'
        : stored.source === 'invalid' ? '对局存档无法识别。可以保留原存档的本机备份后开始新局。'
          : '暂时无法读取对局，原存档已保留。请重试读取。' });
      return;
    }
    const session = stored.value ? S.decodeSession(stored.value) : S.createSession();
    if (!stored.value || migrated) { this.commit(session); return; }
    this.session = session;
    this.setData({ recovery: false, saveError: '' });
    this.syncView();
  },

  onShow() { setKeepScreenOn(true); },
  onHide() { setKeepScreenOn(false); },
  onUnload() { this.unloaded = true; setKeepScreenOn(false); },

  // 数据提交独立于动画和页面生命周期。失败时保留同一个候选，重试不重掷骰。
  commit(candidate) {
    if (!candidate || this.data.saving) return false;
    this.setData({ saving: true });
    let saved;
    try {
      saved = writeStorage(STORAGE_KEY, S.encodeSession(candidate), {
        schemaVersion: S.SCHEMA_VERSION, validate: (value) => Boolean(S.decodeSession(value)),
      });
    } catch (error) { saved = { ok: false }; }
    if (!saved.ok) {
      this.pendingCommit = candidate;
      this.setData({ saving: false, saveError: '本次操作尚未保存，牌局没有推进。请重试保存或取消本次操作。' });
      return false;
    }
    this.session = candidate;
    this.pendingCommit = null;
    this.setData({ saving: false, saveError: '', recovery: false });
    this.syncView();
    return true;
  },

  dispatch(action) {
    if (!this.session || this.pendingCommit || this.data.recovery || this.data.saving || this.data.inspect) return;
    const candidate = S.transition(this.session, action);
    if (candidate) { this.setData({ actionError: '' }); this.commit(candidate); }
    else this.setData({ actionError: '此步骤暂时无法执行。请先处理现有待结算事项，或撤销回到上一步。' });
  },

  retrySave() {
    if (this.pendingCommit) this.commit(this.pendingCommit);
    else this.loadSession();
  },

  cancelSave() {
    if (!this.session) return;
    this.pendingCommit = null;
    this.setData({ saveError: '' });
  },

  recoverNewGame() {
    if (!this.data.canRecover || this.data.saving) return;
    const backup = backupStorage(STORAGE_KEY, `${STORAGE_KEY}.recovery.${Date.now()}`);
    if (!backup.ok) {
      this.setData({ saveError: '备份未成功，原存档未覆盖。请释放本机存储空间后重试。' });
      return;
    }
    this.setData({ recovery: false, canRecover: false });
    this.commit(S.createSession());
  },

  decorateCard(index) {
    const card = P.cardAt(index);
    const art = buildCdnArt(card.id, card.stamp) || {};
    return { ...card, art, artFailed: this.failedArt.has(card.id) };
  },

  syncView() {
    if (!this.session || this.unloaded) return;
    const session = this.session;
    const game = session.game;
    const phase = S.phaseOf(session);
    const reveal = session.reveal;
    const roll = game.lastRoll;
    const primaryLabel = phase === 'ready' ? `掷时空骰 · 费用 ${P.rollCost(game)}`
      : phase === 'exit' ? '异象触发已处理，换出'
        : phase === 'notes' ? '牌桌事项已处理'
          : phase === 'reveal' ? '按此顺序结算' : `处理待结算能力（${session.triggers.length}）`;
    const orderedCards = (indices) => indices.map((index, position, all) => ({ index, name: P.cardAt(index).name, canUp: position > 0, canDown: position < all.length - 1 }));
    this.setData({
      hasSession: true, phase, phaseLabel: PHASE_LABELS[phase], primaryLabel,
      planes: game.activePlanes.map((index) => this.decorateCard(index)),
      playerCount: game.playerCount, deckLeft: game.planarDeck.length,
      rollCost: P.rollCost(game), dieFace: roll ? roll.face : 'idle',
      dieLabel: roll ? FACE_LABELS[roll.face] + (roll.modified ? '（空白改判）' : '') : '尚未掷骰',
      lastAction: session.lastAction, canUndo: Boolean(session.undo),
      modifierOn: game.dieModifier === 'blankIsChaos',
      tableNotes: session.tableNotes,
      trimmedText: game.trimmed.length ? `${game.playerCount} 人局异象上限 ${game.limits.maxPhenomena} 张，本局移出：${game.trimmed.join('、')}` : '',
      canLeavePhenomenon: S.canLeavePhenomenon(session),
      triggers: session.triggers.map((source) => {
        const card = P.cardAt(source.cardIndex);
        const kind = P.planarActionFor(source.cardIndex);
        const isWalk = source.kind === 'walk';
        const isEntry = source.kind === 'entryChaos';
        return { ...source, name: isWalk ? '时空骰 · 换境触发' : card.name,
          label: isWalk ? '换境' : isEntry ? '进场触发' : source.kind === 'chaos' ? '混沌' : '遭遇触发',
          lines: isWalk ? ['先处理牌桌响应；此触发成功结算后才会换境。']
            : isEntry ? card.staticLines : source.kind === 'chaos' ? card.chaosLines : card.staticLines,
          actionLabel: isWalk ? '结算换境' : isEntry ? '结算并引发混沌'
            : kind === 'append' ? '展示并追加时空' : kind === 'echo' ? '展示时空，引发其混沌'
              : kind === 'merge' ? '展示至两张时空' : '此能力已结算' };
      }),
      revealed: reveal ? reveal.indices.map((index) => this.decorateCard(index)) : [],
      bottomOrder: reveal ? orderedCards(reveal.bottomOrder) : [],
      exitOrder: reveal ? orderedCards(reveal.exitOrder) : [],
      revealLabel: reveal ? REVEAL_LABELS[reveal.kind] : '',
    });
    this.prefetchNextPlane();
  },

  primaryAction() {
    const phase = this.data.phase;
    if (phase === 'resolve') {
      if (typeof wx.pageScrollTo === 'function') wx.pageScrollTo({ selector: '#pending-work', duration: 0, fail: () => {} });
      return;
    }
    const type = { ready: 'roll', exit: 'leavePhenomenon', reveal: 'applyReveal', notes: 'acknowledgeNotes' }[phase];
    if (type) this.dispatch({ type });
  },

  rollDie() { this.dispatch({ type: 'roll' }); },
  effectRoll() { this.dispatch({ type: 'roll', effect: true }); },
  nextTurn() { this.dispatch({ type: 'turn' }); },
  manualPlaneswalk() { this.dispatch({ type: 'walk' }); },
  causeChaos() { this.dispatch({ type: 'causeChaos' }); },
  leavePhenomenon() { this.dispatch({ type: 'leavePhenomenon' }); },
  acknowledgeNotes() { this.dispatch({ type: 'acknowledgeNotes' }); },
  dismissActionError() { this.setData({ actionError: '' }); },
  resolveTrigger(event) { this.dispatch({ type: 'resolveTrigger', id: Number(event.currentTarget.dataset.id) }); },
  preventTrigger(event) { this.dispatch({ type: 'resolveTrigger', id: Number(event.currentTarget.dataset.id), prevented: true }); },
  copyTrigger(event) { this.dispatch({ type: 'copyTrigger', id: Number(event.currentTarget.dataset.id) }); },
  moveBottomCard(event) {
    this.dispatch({ type: 'order', group: event.currentTarget.dataset.group, index: Number(event.currentTarget.dataset.index), delta: Number(event.currentTarget.dataset.delta) });
  },
  undo() { this.dispatch({ type: 'undo' }); },
  toggleSetup() { this.setData({ setupOpen: !this.data.setupOpen }); },
  changePlayerCount(event) {
    const count = Number(event.currentTarget.dataset.count);
    if (count !== this.data.playerCount) this.dispatch({ type: 'restart', playerCount: count });
  },
  restart() { this.dispatch({ type: 'restart', playerCount: this.data.playerCount }); },

  // 数据携带卡片身份，晚到的旧图错误不能把新时空标成失败。
  hidePlaneArt(event) {
    const id = event.currentTarget.dataset.id;
    if (!id || !this.session || this.unloaded) return;
    this.failedArt.add(id);
    const index = this.data.planes.findIndex((card) => card.id === id);
    if (index >= 0) this.setData({ [`planes[${index}].artFailed`]: true });
  },
  prefetchNextPlane() {
    const next = this.session.game.planarDeck[0];
    const card = P.cardAt(next);
    if (!card || card.id === this.prefetchedId || typeof wx.getImageInfo !== 'function') return;
    const id = card.id;
    this.prefetchedId = id;
    const art = buildCdnArt(card.id, card.stamp);
    if (art) wx.getImageInfo({ src: art.artCrop, fail: () => { if (this.prefetchedId === id) this.prefetchedId = ''; } });
  },
  openInspect(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!P.cardAt(index)) return;
    this.setData({ inspect: this.decorateCard(index), inspectFailed: false });
  },
  failInspect(event) {
    if (!this.data.inspect || this.unloaded) return;
    const id = event && event.currentTarget.dataset.id;
    if (id && id !== this.data.inspect.id) return;
    this.setData({ inspectFailed: true });
  },
  retryInspect() { this.setData({ inspectFailed: false }); },
  closeInspect() { this.setData({ inspect: null }); },
  stopPropagation() {},
  goBack() { wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/random/random' }) }); },
  onShareAppMessage() { return { title: '竞逐时空：共享时空套牌与时空骰', path: '/pages/planechase/planechase' }; },
  onShareTimeline() { return { title: '竞逐时空：共享时空套牌与时空骰' }; },
});
