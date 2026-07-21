function setKeepScreenOn(keepScreenOn) {
  if (typeof wx === 'undefined' || typeof wx.setKeepScreenOn !== 'function') return false;
  try {
    // 微信在 iOS / Android 上分别转交系统电源管理能力；页面离开时必须显式恢复。
    wx.setKeepScreenOn({ keepScreenOn: Boolean(keepScreenOn) });
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  setKeepScreenOn,
};
