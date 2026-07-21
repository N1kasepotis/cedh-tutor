const { questions, dimensionLabels, matchingConfig } = require('../../config/questionnaire');
const { commanders, costTierConfig, statsWeightConfig } = require('../../config/commanders');
const {
  buildPreferenceProfile,
  recommendCommanders,
} = require('../../utils/recommender');
const {
  buildStepStates,
  formatOptionCode,
  hasAnswerValue,
  toggleMultiSelect,
} = require('../../utils/quiz-flow');
const { enableShareMenu } = require('../../utils/share');
const { writeStorage } = require('../../utils/storage');

const QUIZ_RESULT_STORAGE_KEY = 'quizResult';

function getAnswerValue(question, answers) {
  const value = answers[question.id];
  if (question.type === 'multiple') {
    return Array.isArray(value) ? value : [];
  }
  return value || '';
}

function buildSteps(currentIndex) {
  return buildStepStates(questions.length, currentIndex).map((step, index) => ({
    ...step,
    id: questions[index].id,
  }));
}

function buildProgressText(index) {
  return `第 ${index + 1} / ${questions.length} 步`;
}

function decorateQuestion(index, answers) {
  const question = questions[index];
  const value = getAnswerValue(question, answers);

  return {
    ...question,
    options: question.options.map((option, optionIndex) => ({
      ...option,
      code: formatOptionCode(optionIndex),
      selected: Array.isArray(value) ? value.includes(option.id) : value === option.id,
    })),
  };
}

Page({
  data: {
    total: questions.length,
    currentIndex: 0,
    currentQuestion: decorateQuestion(0, {}),
    steps: buildSteps(0),
    progressText: buildProgressText(0),
    progressPercent: 100 / questions.length,
    answers: {},
    canGoBack: false,
    canGoNext: false,
    nextButtonText: '下一步',
  },

  onLoad() {
    enableShareMenu();
  },

  onShareAppMessage() {
    return {
      title: '答几道题，找到你的本命 cEDH 主将',
      path: '/pages/quiz/quiz',
    };
  },

  onShareTimeline() {
    return { title: '答几道题，找到你的本命 cEDH 主将' };
  },

  selectOption(event) {
    const optionId = event.detail.id;
    const question = questions[this.data.currentIndex];
    const answers = { ...this.data.answers };

    if (question.type === 'multiple') {
      answers[question.id] = toggleMultiSelect(getAnswerValue(question, answers), optionId, 'any');
    } else {
      answers[question.id] = optionId;
    }

    this.refreshQuestion(this.data.currentIndex, answers);
  },

  prevStep() {
    if (this.data.currentIndex === 0) return;
    this.refreshQuestion(this.data.currentIndex - 1, this.data.answers);
  },

  nextStep() {
    if (!this.data.canGoNext) return;

    if (this.data.currentIndex < questions.length - 1) {
      this.refreshQuestion(this.data.currentIndex + 1, this.data.answers);
      return;
    }

    const profile = buildPreferenceProfile(questions, this.data.answers);
    // 结果页只展示 5 个；这里多保留候选，便于展示层去掉重复搭档后补位。
    const recommendations = recommendCommanders(profile, commanders, 12, dimensionLabels, costTierConfig, statsWeightConfig, matchingConfig);

    const stored = writeStorage(QUIZ_RESULT_STORAGE_KEY, {
      profile,
      recommendations,
      answers: this.data.answers,
    }, {
      schemaVersion: 1,
      validate: (value) => Boolean(value && Array.isArray(value.recommendations)),
    });

    if (!stored.ok) {
      wx.showToast({ title: '推荐结果保存失败，请重试', icon: 'none' });
      return;
    }

    // redirectTo 替换当前页：避免 quiz ↔ result 互跳时页面栈无限增长
    wx.redirectTo({
      url: '/pages/result/result',
    });
  },

  refreshQuestion(index, answers) {
    const question = questions[index];
    const hasAnswer = hasAnswerValue(getAnswerValue(question, answers));

    this.setData({
      answers,
      currentIndex: index,
      currentQuestion: decorateQuestion(index, answers),
      steps: buildSteps(index),
      progressText: buildProgressText(index),
      progressPercent: ((index + 1) / questions.length) * 100,
      canGoBack: index > 0,
      canGoNext: hasAnswer,
      nextButtonText: index === questions.length - 1 ? '查看推荐' : '下一步',
    });
  },
});
