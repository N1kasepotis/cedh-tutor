const {
  decoratePreviewSlots,
  sortRecommendationsForDisplay,
} = require('../../utils/result-display');
const { prefetchCardArt, getCardArt } = require('../../utils/card-art');
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

  // 一次批量解析全部主将图，解析完只刷一次视图。
  //
  // 旧写法是每张卡各发一次 fetchCardImageUris——那是 api.scryfall.com 的按名查询，
  // 一卡一次往返，且并发被限到 4，五条推荐最多十张图要分三轮跑完；
  // 每张回来还各自 setData 一遍**整个** recommendations 数组，十次全量过桥。
  // 换成 /cards/collection 批量：十个名字一次请求，解析完统一刷一次。
  loadPreviewImages(recommendations, signature) {
    const names = [];
    recommendations.forEach((recommendation) => {
      (recommendation.previewCards || []).forEach((card) => {
        if (card && card.name) names.push(card.name);
      });
    });
    if (!names.length) return;

    prefetchCardArt(names).then(() => {
      // 期间用户可能已经重新匹配，signature 对不上就丢弃这批结果
      if (signature !== this.loadedSignature) return;
      this.setData({
        recommendations: (this.data.recommendations || []).map((recommendation) => (
          decoratePreviewSlots({
            ...recommendation,
            previewCards: (recommendation.previewCards || []).map((card) => {
              const artCrop = getCardArt(card.name, 'artCrop');
              const normal = getCardArt(card.name, 'normal');
              // 没解析到就保留预填的直连地址，只清 loading——
              // 覆盖成空会把本来能显示的图弄没
              if (!artCrop && !normal) return { ...card, loading: false };
              return { ...card, artCrop, normal, loading: false };
            }),
          })
        )),
      });
    });
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
