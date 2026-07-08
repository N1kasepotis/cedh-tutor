// 问卷/测试页共享的答题流程纯函数（quiz 与 edhti 共用）。
// 页面各自的答案数据模型不同（quiz 存选项 id，edhti 存选项下标），
// 这里只放与模型无关的通用逻辑。

// 选项编号：0 → "01"
function formatOptionCode(index) {
  return String(index + 1).padStart(2, '0');
}

// 判定当前题是否已有答案（多选为非空数组，单选为真值）。
// 注意：以下标存储的答案（可能为 0）不适用本函数。
function hasAnswerValue(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

// 多选切换：exclusiveId（如 "any"）与其他选项互斥。
function toggleMultiSelect(current, optionId, exclusiveId) {
  const value = Array.isArray(current) ? current : [];

  if (exclusiveId && optionId === exclusiveId) {
    return value.includes(exclusiveId) ? [] : [exclusiveId];
  }

  if (value.includes(optionId)) {
    return value.filter((id) => id !== optionId);
  }

  const base = exclusiveId ? value.filter((id) => id !== exclusiveId) : value;
  return base.concat(optionId);
}

// 步骤指示器状态数组：done / current / idle。
function buildStepStates(total, currentIndex) {
  return Array.from({ length: total }, (unused, index) => ({
    label: formatOptionCode(index),
    state: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'idle',
  }));
}

module.exports = {
  formatOptionCode,
  hasAnswerValue,
  toggleMultiSelect,
  buildStepStates,
};
