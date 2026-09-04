// 竞逐时空：共享时空套牌 + 时空骰。
//
// 页面只做渲染与手势，规则全在 utils/planechase.js（纯函数、Node 可测）。
//
// 图片有两条机制保证「换境不等图」：
//  ① 双层渐进，不做 src 替换——微信 image 换了 src 会重新下载同一张图，
//     所以是两个并列的 <image> 各自 src：small（11KB，转正后模糊垫底）与
//     art_crop（横向画作，load 后淡入盖上）。弱网下 art_crop 不来也不是白屏，
//     是一层本卡颜色的模糊底，与强度分级页「卡图失败回落纯档位色」同一条原则。
//  ② 预取下一张——牌库顺序在我们手里，牌库顶那张是谁完全确定，
//     当前时空显示期间就把它的 art_crop 预热进微信图片缓存。只预取一张。
//     预取不渲染，因此不泄露牌库信息（与试玩页「展示库顶」同一条顾虑）。
//
// 档位是按格子反算的：竖屏满宽 375pt × 2.24 比例 = 375×167pt，@3x 需 1125×502px；
// art_crop 是 1214×543——略微不足而非超配，因此是正确档位。

const {
  cardAt,
  createGame,
  rollCost,
  rollPlanarDie,
  planeswalk,
  resolveEncounter,
  revealUntilPlanes,
  planeswalkTo,
  endTurn,
  setDieModifier,
  cloneGame,
} = require('../../utils/planechase');
const { buildCdnArt } = require('../../utils/scryfall-cdn');
const { setKeepScreenOn } = require('../../utils/keep-screen-on');
const { enableShareMenu } = require('../../utils/share');
const { readStorage, writeStorage } = require('../../utils/storage');

const STORAGE_KEY = 'planechaseState';
const SCHEMA_VERSION = 1;
const PLAYER_COUNTS = [2, 3, 4, 5];

// 掷骰动画：约 500ms 轮转减速落定。
// 4/6 的结果是空白——最常见的结果必须快速读作「无事发生」，
// 所以轮转本身短，彩头只留给混沌与换境。
const SPIN_STEPS = [40, 45, 52, 60, 70, 82, 96, 112];
const SPIN_FACES = ['blank', 'chaos', 'blank', 'planeswalk', 'blank', 'chaos'];
const WALK_BEAT_MS = 340;   // 掷出换境后留一拍再真的换，让人看清是换境

const FACE_LABEL = { blank: '空白', chaos: '混沌', planeswalk: '时空换境' };

function isPlanechaseState(value) {
  return Boolean(value)
    && Array.isArray(value.planarDeck)
    && Array.isArray(value.activePlanes)
    && value.activePlanes.length > 0;
}

Page({
  data: {
    planes: [],
    isPhenomenon: false,
    pending: '',
    dieFace: 'idle',
    dieLabel: '掷时空骰',
    rollCost: 0,
    rolling: false,
    chaosHot: false,
    modifierOn: false,
    modifierNote: '',
    deckLeft: 0,
    playerCount: 4,
    playerCounts: PLAYER_COUNTS,
    trimmedText: '',
    inspect: null,
    canUndo: false,
    revealed: [],
  },

  onLoad() {
    enableShareMenu();
    this.undoSnapshot = null;
    this.spinTimer = null;
    this.walkTimer = null;

    const stored = readStorage(STORAGE_KEY, {
      schemaVersion: SCHEMA_VERSION,
      defaultValue: null,
      validate: isPlanechaseState,
    });
    this.game = stored.value || createGame(4, Math.random);
    this.syncView();
  },

  onShow() {
    setKeepScreenOn(true);
  },

  onHide() {
    this.stopTimers();
    this.persist();
    setKeepScreenOn(false);
  },

  onUnload() {
    this.stopTimers();
    this.persist();
    setKeepScreenOn(false);
  },

  onShareAppMessage() {
    return { title: '竞逐时空：共享时空套牌与时空骰', path: '/pages/planechase/planechase' };
  },

  onShareTimeline() {
    return { title: '竞逐时空：共享时空套牌与时空骰' };
  },

  stopTimers() {
    if (this.spinTimer) { clearTimeout(this.spinTimer); this.spinTimer = null; }
    if (this.walkTimer) { clearTimeout(this.walkTimer); this.walkTimer = null; }
  },

  persist() {
    if (!this.game) return;
    writeStorage(STORAGE_KEY, this.game, {
      schemaVersion: SCHEMA_VERSION,
      validate: isPlanechaseState,
    });
  },

  // 只推真正渲染的字段。整份 game 里 planarDeck 是 50 个下标，
  // 每帧推过去纯属浪费——界面只需要「还剩几张」。
  syncView(extra) {
    const game = this.game;
    const planes = game.activePlanes.map((index) => {
      const card = cardAt(index);
      const art = buildCdnArt(card.id, card.stamp) || {};
      return {
        index: card.index,
        name: card.name,
        type: card.type,
        staticLines: card.staticLines,
        chaosLines: card.chaosLines,
        art: { small: art.small || '', artCrop: art.artCrop || '' },
        // 主图失败就摘掉它，露出下面那层 small——降级是设计出来的，不是崩出来的
        artFailed: false,
      };
    });

    this.setData(Object.assign({
      planes,
      isPhenomenon: cardAt(game.activePlanes[0]).isPhenomenon,
      pending: game.pending || '',
      rollCost: rollCost(game),
      deckLeft: game.planarDeck.length,
      playerCount: game.playerCount,
      modifierOn: game.dieModifier === 'blankIsChaos',
      modifierNote: game.dieModifier === 'blankIsChaos'
        ? '乙太混沦：空白判为混沌，直到有人换出一个时空'
        : '',
      trimmedText: (game.trimmed || []).length
        ? `${game.playerCount} 人局异象上限 ${game.limits.maxPhenomena} 张，已移出：${game.trimmed.join('、')}`
        : '',
      canUndo: Boolean(this.undoSnapshot),
    }, extra || {}));

    this.prefetchNextPlane();
  },

  // 预取牌库顶那张的 art_crop：换境时它已在微信图片缓存里，落地即显示。
  // 只预取一张——预取五十张既没必要，也会在弱网下抢掉当前这张的带宽。
  prefetchNextPlane() {
    const next = this.game && this.game.planarDeck[0];
    if (next === undefined || next === this.prefetchedIndex) return;
    const card = cardAt(next);
    const art = card && buildCdnArt(card.id, card.stamp);
    if (!art || !wx.getImageInfo) return;
    this.prefetchedIndex = next;
    wx.getImageInfo({ src: art.artCrop, fail: () => {} });
  },

  captureUndo() {
    this.undoSnapshot = cloneGame(this.game);
  },

  undo() {
    if (!this.undoSnapshot) return;
    this.stopTimers();
    this.game = this.undoSnapshot;
    this.undoSnapshot = null;
    this.persist();
    this.syncView({ rolling: false, dieFace: 'idle', dieLabel: '掷时空骰', chaosHot: false, revealed: [] });
  },

  // 先定结果，再演——与首页边缘赛跑同源。轮转期间不改任何游戏状态。
  rollDie() {
    if (this.data.rolling || !this.game) return;
    this.captureUndo();
    const result = rollPlanarDie(this.game, Math.random);

    this.setData({ rolling: true, chaosHot: false, revealed: [] });
    let step = 0;
    const spin = () => {
      if (step >= SPIN_STEPS.length) {
        this.settleRoll(result);
        return;
      }
      // 只推一个短字符串，轮转八帧的过桥代价可以忽略
      this.setData({ dieFace: SPIN_FACES[step % SPIN_FACES.length] });
      this.spinTimer = setTimeout(spin, SPIN_STEPS[step]);
      step += 1;
    };
    spin();
  },

  settleRoll(result) {
    this.spinTimer = null;
    const label = FACE_LABEL[result.face] + (result.modified ? '（空白改判）' : '');

    if (result.face === 'planeswalk') {
      this.setData({ dieFace: 'planeswalk', dieLabel: label, rollCost: rollCost(this.game) });
      // 留一拍再真的换境，否则画面在同一帧里既落定又整块换掉，读不出发生了什么
      this.walkTimer = setTimeout(() => {
        this.walkTimer = null;
        planeswalk(this.game);
        this.persist();
        this.syncView({ rolling: false, dieFace: 'planeswalk', dieLabel: label });
      }, WALK_BEAT_MS);
      return;
    }

    this.persist();
    this.syncView({
      rolling: false,
      dieFace: result.face,
      dieLabel: label,
      // 掷出混沌就把该读的那一行点亮，而不是让人在整段文字里找
      chaosHot: result.face === 'chaos',
    });
  },

  // 异象的提醒文字写着「（然后时空换出此异象。）」——读完点这个继续
  resolvePhenomenon() {
    if (this.data.rolling || this.data.pending !== 'encounter') return;
    this.captureUndo();
    resolveEncounter(this.game);
    this.persist();
    this.syncView({ dieFace: 'idle', dieLabel: '掷时空骰', chaosHot: false });
  },

  // 手动换境：给「艾蕾侬的树种核心」这类不经掷骰的换境用
  manualPlaneswalk() {
    if (this.data.rolling) return;
    this.captureUndo();
    planeswalk(this.game);
    this.persist();
    this.syncView({ dieFace: 'idle', dieLabel: '掷时空骰', chaosHot: false, revealed: [] });
  },

  // 展示到第 N 张时空牌：境界交融要两张，艾蕾侬与撒维尼亚各要一张。
  // 只展示不结算——怎么处置由玩家按卡面决定。
  revealPlanes(event) {
    if (this.data.rolling) return;
    const count = Number(event.currentTarget.dataset.count) || 1;
    const revealed = revealUntilPlanes(this.game, count).map((index) => {
      const card = cardAt(index);
      return { index, name: card.name, isPhenomenon: card.isPhenomenon };
    });
    this.setData({ revealed });
  },

  applyRevealed() {
    if (!this.data.revealed.length) return;
    this.captureUndo();
    planeswalkTo(this.game, this.data.revealed.map((item) => item.index));
    this.persist();
    this.syncView({ revealed: [], dieFace: 'idle', dieLabel: '掷时空骰', chaosHot: false });
  },

  dismissRevealed() {
    this.setData({ revealed: [] });
  },

  toggleModifier() {
    this.captureUndo();
    setDieModifier(this.game, this.game.dieModifier === 'blankIsChaos' ? 'none' : 'blankIsChaos');
    this.persist();
    this.syncView();
  },

  nextTurn() {
    if (this.data.rolling) return;
    this.captureUndo();
    endTurn(this.game);
    this.persist();
    this.syncView({ dieFace: 'idle', dieLabel: '掷时空骰', chaosHot: false, revealed: [] });
  },

  changePlayerCount(event) {
    const count = Number(event.currentTarget.dataset.count);
    if (!count || count === this.game.playerCount) return;
    // 换人数会改变异象上限，必须重建牌库；给撤销而不是二次确认，
    // 与血量记录的重置同一条口径——这是长局里的高频合法操作
    this.captureUndo();
    this.game = createGame(count, Math.random);
    this.prefetchedIndex = undefined;
    this.persist();
    this.syncView({ dieFace: 'idle', dieLabel: '掷时空骰', chaosHot: false, revealed: [] });
  },

  restart() {
    this.captureUndo();
    this.game = createGame(this.game.playerCount, Math.random);
    this.prefetchedIndex = undefined;
    this.persist();
    this.syncView({ dieFace: 'idle', dieLabel: '掷时空骰', chaosHot: false, revealed: [] });
  },

  // 点画作看整张中文卡面。取的是简中印次的 id，因此这里是中文卡。
  openInspect(event) {
    const index = Number(event.currentTarget.dataset.index);
    const card = cardAt(index);
    if (!card) return;
    const art = buildCdnArt(card.id, card.stamp) || {};
    this.setData({ inspect: { name: card.name, normal: art.normal || '' } });
  },

  closeInspect() {
    this.setData({ inspect: null });
  },

  // 走定向路径改这一条的标记。WXML 里做不了 planes[item.id] 这种计算成员访问
  // （全项目无先例、Node 侧验不了、失败还是静默的），所以标记挂在条目上。
  hidePlaneArt(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || index < 0) return;
    this.setData({ [`planes[${index}].artFailed`]: true });
  },

  goBack() {
    wx.navigateBack({ delta: 1, fail: () => wx.reLaunch({ url: '/pages/index/index' }) });
  },
});
