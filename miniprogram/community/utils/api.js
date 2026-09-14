const config = require('../../config/community');
const MESSAGES = {
  UNAVAILABLE: '社区服务尚未连接，本机功能仍可使用',
  INVALID_INPUT: '请检查填写内容',
  INVALID_CARD: '卡牌版本无效，请重新选牌',
  INVALID_VOTE: '这一轮投票暂未开放',
  NOT_FOUND: '分享已撤回或不存在',
  FORBIDDEN: '无权修改这条记录',
  MODERATION: '内容未通过审核，请修改昵称或短评后重试',
  RATE_LIMIT: '操作较频繁，请稍后重试',
  CONFLICT: '内容已变化，请刷新后重试',
  SERVICE_ERROR: '社区暂时无法连接，请稍后重试',
};
let initialized = false;
function available() {
  return Boolean(config.env && typeof wx !== 'undefined' && wx.cloud);
}
// 错误带上服务端 code，调用方才能按情况处理（例如投票组件遇到 INVALID_VOTE 直接收起）
function failure(code) {
  const known = Object.prototype.hasOwnProperty.call(MESSAGES, code) ? code : 'SERVICE_ERROR';
  const error = new Error(MESSAGES[known]);
  error.code = known;
  return error;
}
async function call(action, payload = {}) {
  if (!available()) throw failure('UNAVAILABLE');
  if (!initialized) {
    wx.cloud.init({ env: config.env, traceUser: false });
    initialized = true;
  }
  let response;
  try {
    response = await wx.cloud.callFunction({
      name: config.functionName,
      data: { action, ...payload },
    });
  } catch (_) {
    throw failure('SERVICE_ERROR');
  }
  const result = response && response.result;
  if (!result || !result.ok) throw failure(result && result.code);
  return result.data;
}
module.exports = { available, call };
