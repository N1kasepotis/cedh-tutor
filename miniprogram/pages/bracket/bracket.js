const {
  parseBracketDeck,
  evaluateBracket,
  buildBracketSummary,
  MAX_DECK_CHARS,
  MAX_DECK_LINES,
} = require('../../utils/bracket');
const { fetchBracketCardMetadata } = require('../../utils/bracket-metadata');
const { buildScryfallImageUrl } = require('../../utils/scryfall');
const { getCardArt } = require('../../utils/card-art');
const { enableShareMenu } = require('../../utils/share');
const { readStorage, removeStorage, writeStorage } = require('../../utils/storage');

// 与套牌试玩各存各的：改一边不该悄悄改掉另一边，跨页只走显式的「用这副牌试玩」
const DECK_TEXT_STORAGE_KEY = 'bracketDeckText';
const PLAYTEST_DECK_TEXT_STORAGE_KEY = 'playtestDeckText';
const DECK_TEXT_SCHEMA_VERSION = 1;
// 手机上粘 100 行成本很高，够长才认为剪贴板里真是一份牌表
const CLIPBOARD_DECK_MIN_LINES = 8;
// 弱网下顺序分批可能拖到 20–30 秒，超过这个时长就把降级出口摆出来
const SLOW_ANALYSIS_MS = 6000;

const CONFIDENCE_LABELS = Object.freeze({
  high: '高',
  medium: '中',
  low: '低',
});

function formatUsd(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  return `$${String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// 每条依据在判定链条中的角色：下限 / 强度区间 / 辅助上调 / 特殊升降档 / 参考
function reasonRoleLabel(item) {
  if (item.code === 'CONFIDENCE_PROFILE') return '置信度';
  if (item.code === 'BAND_POSITION') return '区间定位';
  if (item.kind === 'context') return '参考';
  if (item.code === 'COMPETITIVE_SIGNAL_DENSITY') return '竞技特征';
  if (item.code === 'EXPENSIVE_POOL_PROMOTION') return '主将池升 B5';
  if (item.kind === 'rule') return `下限 B${item.minimumBracket}`;
  if (item.code === 'MANA_CURVE_SUPPORT'
    || item.code === 'CONSTRUCTION_EFFICIENCY_SUPPORT'
    || item.code === 'THEME_COHESION_SUPPORT'
    || item.code === 'UNLISTED_COMBO_STRUCTURE') return '辅助上调';
  if (item.code === 'DECK_PRICE_SUPPORT') return 'B3→B4';
  if (item.code.indexOf('AUTO_') === 0) return '基线';
  return item.minimumBracket >= 3 ? `强度区间 B${item.minimumBracket}` : '强度信号';
}

// 判定链条：下限 → 结构强度 → 数据辅助 → 竞技特征（B4.5 准竞技 / B5 竞技）
function buildVerdictSteps(result) {
  const steps = [];
  const pushStep = (label, bracket, changed) => steps.push({
    label,
    code: `B${bracket}`,
    changed: Boolean(changed),
  });
  pushStep('规则下限', result.floorBracket, false);
  pushStep('结构强度', result.assignedWithoutMetrics, result.assignedWithoutMetrics > result.floorBracket);
  pushStep('数据辅助', result.assignedBeforePromotion,
    result.assignedBeforePromotion > result.assignedWithoutMetrics);
  if (result.competitivePromoted) pushStep('竞技特征', result.competitiveBracket, true);
  if (result.expensivePoolPromoted) pushStep('主将池', 5, true);
  return steps;
}

// 主将卡图嵌入 hero 底层：单主将整幅、双拍档左右分屏，不新增版面区域。
//
// 直链是白得的：读牌表时那趟 /cards/collection（拿 cmc / 类别 / 价格）响应里
// 本来就带 image_uris，bracket-metadata 顺手收进了卡图缓存，这里直接取。
// 主将若恰好在本地指挥官库里，构建期烤表还会更早一步命中。
// 两处都没有才回落按名取图的 302 慢路——那是牌表里写了自定义卡或错字的情况。
function buildHeroArt(commanders) {
  const named = (commanders || [])
    .map((card) => card && card.name)
    .filter(Boolean)
    .slice(0, 2);
  if (!named.length) return { mode: 'none', images: [] };
  return {
    mode: named.length === 2 ? 'dual' : 'single',
    images: named.map((name) => ({
      name,
      url: getCardArt(name, 'artCrop') || buildScryfallImageUrl(name, 'art_crop'),
    })),
  };
}

function normalizeBracketPageCopy(value) {
  return String(value || '')
    .replace(/[；。]+/g, '，')
    .replace(/，{2,}/g, '，')
    .replace(/，+$/g, '');
}

function decorateResult(result, commanders) {
  const parseIssueRows = result.parseIssues.map((issue, index) => ({
    ...issue,
    id: `${issue.code}-${issue.line}-${index}`,
    lineLabel: issue.line ? `第 ${issue.line} 行` : '牌表结构',
    rawLabel: issue.raw ? `：${issue.raw}` : '',
  }));
  const parseErrorRows = parseIssueRows.filter((issue) => issue.severity === 'error');
  // 判定依据不设条数上限：规则与强度依据在前，参考观察（context）在后，每条附触发牌
  const primaryReasons = result.evidence
    .filter((item) => item.kind === 'rule' || item.kind === 'strength');
  const contextReasons = result.evidence
    .filter((item) => item.kind === 'context');
  const reasons = primaryReasons
    .concat(contextReasons)
    .map((item, index) => ({
      ...item,
      ordinal: String(index + 1).padStart(2, '0'),
      roleLabel: reasonRoleLabel(item),
      detail: normalizeBracketPageCopy(item.detail),
      cardsText: item.cards.length ? item.cards.join('、') : '',
    }));
  const verdictSteps = buildVerdictSteps(result);
  const signalOverview = (result.signals || []).map((signal) => ({
    key: signal.key,
    label: signal.label,
    count: signal.count,
  }));

  const metrics = result.deckMetrics || {};
  const maximumCurveCount = (metrics.curveBuckets || [])
    .reduce((maximum, bucket) => Math.max(maximum, bucket.count || 0), 1);
  const curveRows = (metrics.curveBuckets || []).map((bucket) => ({
    ...bucket,
    height: bucket.count ? Math.max(10, Math.round((bucket.count / maximumCurveCount) * 78)) : 2,
  }));
  const manaValueLabel = metrics.averageManaValue === null || metrics.averageManaValue === undefined
    ? '—'
    : Number(metrics.averageManaValue).toFixed(1).replace(/\.0$/, '');
  const manaCoveragePercent = Math.floor((metrics.manaCoverage || 0) * 100);
  const priceCoveragePercent = Math.floor((metrics.priceCoverage || 0) * 100);
  const efficiency = result.efficiencyProfile || {};
  const dominantTheme = (result.cohesionProfile || {}).dominantTheme || {};
  const efficiencyCoveragePercent = Math.floor((efficiency.featureCoverage || 0) * 100);
  const efficiencyRows = [
    { label: 'T1 可用地', value: `${efficiency.turnOneManaLandCount || 0}/${efficiency.landCount || 0}` },
    { label: '常规加速', value: String(efficiency.regularRampCount || 0) },
    { label: '互动与保护', value: String(efficiency.interactionCount || 0) },
    { label: '低费过牌', value: String(efficiency.cardFlowCount || 0) },
  ];
  if (dominantTheme.qualifies && dominantTheme.label) {
    efficiencyRows.push({
      label: '主线',
      value: `${dominantTheme.label} ${dominantTheme.strong ? '高' : '清晰'}`,
    });
  }
  const coverageRows = [
    { label: '曲线', value: `${manaCoveragePercent}%` },
    { label: '价格', value: `${priceCoveragePercent}%` },
    { label: '构筑', value: `${efficiencyCoveragePercent}%` },
  ];

  const summary = normalizeBracketPageCopy(buildBracketSummary(result, parseErrorRows.length));
  const bandPosition = result.bandPosition || null;
  // B4.5 与 B5 竞技档不做区间定位（bandPosition.deferred）：不渲染档位下方的偏弱/中等/偏强行
  const bandPositioned = Boolean(bandPosition && !bandPosition.deferred && bandPosition.tier);

  return {
    ...result,
    bandPositionZh: bandPositioned ? bandPosition.zh : '',
    bandPositionClass: bandPositioned ? `band-${bandPosition.tier}` : '',
    bandPositionMetricText: bandPositioned ? bandPosition.metricText : '',
    bracketCode: `B${result.assignedBracket}`,
    // 小数档位（B4.5）不能直接进 CSS 类名，点号替换为连字符
    tierClass: `bracket-tier-${String(result.assignedBracket).replace('.', '-')}`,
    resultKicker: result.provisional ? '暂定档位' : '建议档位',
    floorCode: `B${result.floorBracket}`,
    confidenceLabel: CONFIDENCE_LABELS[result.confidence] || '低',
    hasLegalityWarning: result.legalityStatus === 'needs-fix',
    legalityLabel: '发现禁牌状态',
    parseErrorRows,
    visibleParseErrorRows: parseErrorRows.slice(0, 3),
    remainingParseErrorCount: Math.max(0, parseErrorRows.length - 3),
    summary,
    reasons,
    verdictSteps,
    signalOverview,
    heroArt: buildHeroArt(commanders),
    curveRows,
    efficiencyRows,
    coverageRows,
    hasManaCurve: Boolean(metrics.nonlandCoveredCount),
    hasEfficiencyProfile: Boolean(efficiency.reliable),
    efficiencyText: `T1 地源 ${efficiency.turnOneManaLandCount || 0}/${efficiency.landCount || 0}　常规加速 ${efficiency.regularRampCount || 0}　互动与保护 ${efficiency.interactionCount || 0}　低费过牌 ${efficiency.cardFlowCount || 0}`,
    manaValueLabel,
    priceLabel: formatUsd(metrics.estimatedTotalUsd),
    metricCoverageText: `覆盖范围：曲线 ${manaCoveragePercent}%　价格 ${priceCoveragePercent}%　构筑 ${efficiencyCoveragePercent}%`,
  };
}

Page({
  data: {
    deckText: '',
    canAnalyze: false,
    result: null,
    heroArtHidden: false,
    inputWarning: '',
    analyzing: false,
    analyzeProgress: '',
    canSkipMetadata: false,
  },

  onLoad() {
    this.analysisRequestId = 0;
    enableShareMenu();
    this.restoreDeckText();
  },

  // 退出再进来输入框不该是空的：粘一次 100 行的成本太高，不能让它白粘
  restoreDeckText() {
    const stored = readStorage(DECK_TEXT_STORAGE_KEY, {
      schemaVersion: DECK_TEXT_SCHEMA_VERSION,
      defaultValue: '',
      validate: (value) => typeof value === 'string',
    });
    if (!stored.value) return;
    const deckText = stored.value.slice(0, MAX_DECK_CHARS);
    this.setData({ deckText, canAnalyze: Boolean(deckText.trim()) });
  },

  persistDeckText(deckText) {
    if (!String(deckText || '').trim()) {
      removeStorage(DECK_TEXT_STORAGE_KEY);
      return;
    }
    writeStorage(DECK_TEXT_STORAGE_KEY, String(deckText).slice(0, MAX_DECK_CHARS), {
      schemaVersion: DECK_TEXT_SCHEMA_VERSION,
      validate: (value) => typeof value === 'string',
    });
  },

  // 显式按钮而不是进页面偷读：微信读剪贴板会弹系统提示，静默读既惊吓又踩隐私准则
  importFromClipboard() {
    if (this.data.analyzing) return;
    wx.getClipboardData({
      success: (clipboard) => {
        const text = String((clipboard && clipboard.data) || '');
        const lineCount = text.replace(/\r\n?/g, '\n').split('\n')
          .filter((line) => line.trim()).length;
        if (lineCount < CLIPBOARD_DECK_MIN_LINES) {
          wx.showToast({ title: '剪贴板里没有找到牌表', icon: 'none' });
          return;
        }
        const deckText = text.slice(0, MAX_DECK_CHARS);
        this.setData({
          deckText,
          inputWarning: '',
          canAnalyze: Boolean(deckText.trim()),
        });
        this.persistDeckText(deckText);
        wx.showToast({ title: `已导入 ${lineCount} 行`, icon: 'none' });
      },
      fail: () => wx.showToast({ title: '读取剪贴板失败', icon: 'none' }),
    });
  },

  // 分析完直接开局，不用把同一副牌再粘一遍
  playtestDeck() {
    const deckText = String(this.data.deckText || '');
    if (!deckText.trim()) return;
    const stored = writeStorage(PLAYTEST_DECK_TEXT_STORAGE_KEY, deckText.slice(0, MAX_DECK_CHARS), {
      schemaVersion: DECK_TEXT_SCHEMA_VERSION,
      validate: (value) => typeof value === 'string',
    });
    if (!stored.ok) {
      wx.showToast({ title: '牌表传递失败，请重试', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/playtest/playtest' });
  },

  onUnload() {
    this.analysisRequestId = (this.analysisRequestId || 0) + 1;
    this.clearSlowAnalysisTimer();
  },

  onShareAppMessage() {
    return {
      title: '强度分级｜Bracket Assignment',
      path: '/pages/bracket/bracket',
    };
  },

  onShareTimeline() {
    return { title: '强度分级｜Bracket Assignment' };
  },

  handleDeckInput(event) {
    const deckText = event.detail.value;
    const lineCount = String(deckText || '').replace(/\r\n?/g, '\n').split('\n').length;
    const inputWarning = lineCount > MAX_DECK_LINES
      ? `最多分析 ${MAX_DECK_LINES} 行，请精简后重试`
      : '';
    if (this.data.analyzing) this.analysisRequestId = (this.analysisRequestId || 0) + 1;
    this.setData({
      deckText,
      inputWarning,
      canAnalyze: Boolean(String(deckText || '').trim()) && !inputWarning,
      analyzing: false,
    });
    this.persistDeckText(deckText);
  },

  analyzeDeck() {
    if (this.data.analyzing) return;
    if (!String(this.data.deckText || '').trim()) {
      wx.showToast({ title: '请先粘贴英文牌表', icon: 'none' });
      return;
    }

    const parsed = parseBracketDeck(this.data.deckText);
    if (!parsed.cards.length) {
      wx.showToast({ title: '没有解析到有效卡名', icon: 'none' });
      return;
    }

    // 必须传回调：无参调用会走 Promise 风格，而「粘贴」按钮填入牌表时键盘从未升起，
    // 此时 hideKeyboard 无键盘可收会拒绝，没人 catch 就冒成框架级的 Error: timeout
    if (wx.hideKeyboard) wx.hideKeyboard({ fail: () => {} });
    const requestId = (this.analysisRequestId || 0) + 1;
    this.analysisRequestId = requestId;
    this.pendingParsed = parsed;
    this.setData({
      analyzing: true,
      inputWarning: '',
      analyzeProgress: '',
      canSkipMetadata: false,
    });
    this.startSlowAnalysisTimer(requestId);

    fetchBracketCardMetadata(parsed.cards.map((card) => card.name), {
      onProgress: ({ done, total, phase }) => {
        if (requestId !== this.analysisRequestId) return;
        this.setData({
          analyzeProgress: phase === 'prices' ? '读取参考价' : `${done} / ${total}`,
        });
      },
    })
      .then((metadataResult) => {
        if (requestId !== this.analysisRequestId) return;
        this.clearSlowAnalysisTimer();
        this.setData({
          result: decorateResult(evaluateBracket(parsed, { metadataResult }), parsed.commanders),
          heroArtHidden: false,
          inputWarning: '',
          analyzing: false,
          analyzeProgress: '',
          canSkipMetadata: false,
        });
        if (metadataResult.requestedCount
          && !metadataResult.resolvedCount
          && metadataResult.failedBatchCount) {
          wx.showToast({ title: '卡牌数据暂不可用，已按本地规则分析', icon: 'none' });
        }
      })
      .catch(() => {
        if (requestId !== this.analysisRequestId) return;
        this.clearSlowAnalysisTimer();
        this.setData({
          result: decorateResult(evaluateBracket(parsed), parsed.commanders),
          heroArtHidden: false,
          inputWarning: '',
          analyzing: false,
          analyzeProgress: '',
          canSkipMetadata: false,
        });
        wx.showToast({ title: '卡牌数据暂不可用，已按本地规则分析', icon: 'none' });
      });
  },

  startSlowAnalysisTimer(requestId) {
    this.clearSlowAnalysisTimer();
    this.slowAnalysisTimer = setTimeout(() => {
      this.slowAnalysisTimer = null;
      if (requestId !== this.analysisRequestId || !this.data.analyzing) return;
      this.setData({ canSkipMetadata: true });
    }, SLOW_ANALYSIS_MS);
  },

  clearSlowAnalysisTimer() {
    if (this.slowAnalysisTimer) clearTimeout(this.slowAnalysisTimer);
    this.slowAnalysisTimer = null;
  },

  // 弱网时的出路：本地规则结果本来就是网络失败的回退路径，这里只是提前让用户选它
  skipMetadata() {
    if (!this.data.analyzing || !this.pendingParsed) return;
    const parsed = this.pendingParsed;
    // 递增请求编号：晚到的元数据不会再覆盖这份本地结果
    this.analysisRequestId = (this.analysisRequestId || 0) + 1;
    this.clearSlowAnalysisTimer();
    this.setData({
      result: decorateResult(evaluateBracket(parsed), parsed.commanders),
      heroArtHidden: false,
      inputWarning: '',
      analyzing: false,
      analyzeProgress: '',
      canSkipMetadata: false,
    });
    wx.showToast({ title: '已按本地规则分析', icon: 'none' });
  },

  // 任一半卡图加载失败即整层隐藏，hero 回落为纯档位色底
  hideHeroArt() {
    this.setData({ heroArtHidden: true });
  },

  editDeck() {
    this.analysisRequestId = (this.analysisRequestId || 0) + 1;
    this.setData({ result: null, analyzing: false });
  },

  clearDeck() {
    this.analysisRequestId = (this.analysisRequestId || 0) + 1;
    removeStorage(DECK_TEXT_STORAGE_KEY);
    this.setData({
      deckText: '',
      canAnalyze: false,
      result: null,
      inputWarning: '',
      analyzing: false,
    });
  },
});
