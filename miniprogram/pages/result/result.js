const {
  decoratePreviewSlots,
  sortRecommendationsForDisplay,
} = require('../../utils/result-display');
const { fetchCardImageUris } = require('../../utils/scryfall');
const { enableShareMenu } = require('../../utils/share');
const { readStorage } = require('../../utils/storage');

const QUIZ_RESULT_STORAGE_KEY = 'quizResult';

Page({
  data: {
    hasResult: false,
    recommendations: [],
  },

  onShow() {
    enableShareMenu();
    const stored = readStorage(QUIZ_RESULT_STORAGE_KEY, {
      schemaVersion: 1,
      defaultValue: null,
      validate: (value) => Boolean(value && Array.isArray(value.recommendations)),
    });
    const result = stored.value;

    if (!result || !result.recommendations) {
      this.loadedSignature = '';
      this.setData({
        hasResult: false,
        recommendations: [],
      });
      return;
    }

    const recommendations = sortRecommendationsForDisplay(result.recommendations, 5);

    // 同一份问卷结果从别的页面返回时不重置展示、不重发十个图片请求
    const signature = recommendations
      .map((item) => `${item.name}:${item.score || 0}:${item.fitLabel || ''}`)
      .join('|');
    if (signature === this.loadedSignature) return;
    this.loadedSignature = signature;

    this.setData({
      hasResult: true,
      recommendations,
    });

    this.loadPreviewImages(recommendations, signature);
  },

  onShareAppMessage() {
    const top = (this.data.recommendations || [])[0];
    const title = top && top.displayName
      ? `我的本命竞技主将是 ${top.displayName}，来测测你的`
      : '答几道题，找到你的本命 cEDH 主将';

    // 推荐结果存在本机，分享落地页指向问卷入口
    return { title, path: '/pages/quiz/quiz' };
  },

  onShareTimeline() {
    return { title: '答几道题，找到你的本命 cEDH 主将' };
  },

  loadPreviewImages(recommendations, signature) {
    recommendations.forEach((recommendation, recommendIndex) => {
      recommendation.previewCards.forEach((card, cardIndex) => {
        fetchCardImageUris(card.name)
          .then((images) => {
            if (signature !== this.loadedSignature) return;
            // API 拿不到图时保留预填的直连 URL，只清 loading，避免把能用的 src 覆盖成空
            if (!images.artCrop && !images.normal) {
              this.updatePreviewCard(recommendIndex, cardIndex, { loading: false });
              return;
            }

            this.updatePreviewCard(recommendIndex, cardIndex, {
              artCrop: images.artCrop,
              normal: images.normal,
              loading: false,
            });
          })
          .catch(() => {
            if (signature !== this.loadedSignature) return;
            this.updatePreviewCard(recommendIndex, cardIndex, {
              loading: false,
            });
          });
      });
    });
  },

  updatePreviewCard(recommendIndex, cardIndex, patch) {
    const recommendations = (this.data.recommendations || []).map((recommendation, currentRecommendIndex) => {
      if (currentRecommendIndex !== recommendIndex) return recommendation;

      const previewCards = (recommendation.previewCards || []).map((card, currentCardIndex) => (
        currentCardIndex === cardIndex ? { ...card, ...patch } : card
      ));

      return decoratePreviewSlots({
        ...recommendation,
        previewCards,
      });
    });

    this.setData({ recommendations });
  },

  previewCardImage(event) {
    const current = event.currentTarget.dataset.url;
    if (!current) return;

    const urls = [];
    (this.data.recommendations || []).forEach((recommendation) => {
      (recommendation.previewCards || []).forEach((card) => {
        if (card.normal) urls.push(card.normal);
      });
    });

    wx.previewImage({
      current,
      urls: urls.length ? urls : [current],
    });
  },

  copyLink(event) {
    const url = event.currentTarget.dataset.url;
    if (!url) return;

    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({
          title: '链接已复制，可在浏览器打开',
          icon: 'none',
        });
      },
    });
  },


  // 只想换一个答案时不必重答整份问卷：带 mode=edit 让问卷预填上次选择
  editAnswers() {
    wx.redirectTo({
      url: '/pages/quiz/quiz?mode=edit',
    });
  },

  restart() {
    // redirectTo 替换当前页：避免 quiz ↔ result 互跳时页面栈无限增长
    wx.redirectTo({
      url: '/pages/quiz/quiz?mode=restart',
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },
});
