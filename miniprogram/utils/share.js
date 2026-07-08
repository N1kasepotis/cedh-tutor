function enableShareMenu() {
  if (typeof wx === 'undefined' || !wx.showShareMenu) return;

  wx.showShareMenu({
    menus: ['shareAppMessage', 'shareTimeline'],
  });
}

module.exports = {
  enableShareMenu,
};
