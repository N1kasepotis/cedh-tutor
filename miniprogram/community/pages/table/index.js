const { TABLE_FIELDS, table } = require('../../shared/contracts');
const local = require('../../utils/local');
const api = require('../../utils/api');
const ui = require('../../utils/page');
// 新桌默认允许代牌、无限组合技和额外回合；预览牌和鸡飞牌默认聊完再定
function defaults() {
  return { level: 1, proxy: 0, preview: 1, unCards: 1, combo: 0, turns: 0, time: 1 };
}
Page({
  data: {
    fields: TABLE_FIELDS,
    values: defaults(),
    history: [],
    remote: null,
    incoming: false,
    dirty: false,
    busy: false,
    error: '',
    agreement: null,
  },
  onLoad(options) {
    this.disposed = false;
    this.draftId = local.id();
    try {
      this.setData({ history: local.load().tables });
    } catch (error) {
      ui.error(this, error);
    }
    if (options.id) {
      this.setData({ incoming: true });
      ui.run(this, async () => {
        const result = await api.call('getShare', { id: options.id });
        if (result.kind !== 'table') throw new Error('这个分享不是对局约定');
        this.setData({
          values: table(result.content),
          remote: result,
          agreement: result.agreement,
        });
      });
    }
  },
  // 回到页面时静默刷新确认人数，不再单独放“刷新确认状态”；第一次进入已在 onLoad 读过
  onShow() {
    if (this.shown) this.refresh();
    this.shown = true;
  },
  onUnload() {
    this.disposed = true;
  },
  // 约定自动存本机：每改一个选项就写入，不再单独放“保存本桌”
  change(event) {
    this.setData({
      [`values.${event.currentTarget.dataset.key}`]: Number(event.detail.value),
      dirty: true,
      agreement: null,
    });
    this.persist();
  },
  persist(replaced = '') {
    try {
      table(this.data.values);
      const item = {
        id: this.draftId,
        values: this.data.values,
        remote: this.data.remote,
        dirty: this.data.dirty,
        date: new Date().toLocaleDateString(),
      };
      const state = local.update((state) => {
        const kept = state.tables.filter((old) => old.id !== item.id && old.id !== replaced);
        state.tables = [item, ...kept].slice(0, 20);
      });
      this.setData({ history: state.tables });
      return true;
    } catch (error) {
      ui.error(this, error);
      return false;
    }
  },
  loadSaved(event) {
    const item = this.data.history.find(
      (entry) => entry.id === event.currentTarget.dataset.id,
    );
    this.draftId = item.id;
    this.setData({
      values: table(item.values),
      remote: item.remote,
      dirty: Boolean(item.dirty),
      incoming: false,
      agreement: null,
    });
    this.refresh();
  },
  newTable() {
    this.draftId = local.id();
    this.setData({
      values: { ...this.data.values },
      remote: null,
      incoming: false,
      dirty: true,
      agreement: null,
      error: '',
    });
    this.persist();
  },
  publish() {
    return ui.run(this, async () => {
      // 撤回过的约定再分享时换一个草稿身份：生成新链接，牌友手里的旧链接一直打不开；本机记录替换掉旧的那条
      const replaced = this.data.remote && this.data.remote.revoked ? this.draftId : '';
      if (replaced) {
        this.draftId = local.id();
        this.setData({ remote: null });
      }
      if (!this.persist(replaced)) return;
      const result = await api.call('publish', {
        kind: 'table',
        draftId: this.draftId,
        version: (this.data.remote && this.data.remote.version) || 0,
        content: table(this.data.values),
      });
      this.setData({
        remote: { ...result, active: true },
        dirty: false,
        agreement: null,
      });
      if (this.persist()) wx.showToast({ title: '可以发给牌友', icon: 'success' });
    });
  },
  // 静默读取最新确认人数：没分享、有没更新的改动、已撤回或正忙时不读；读不到就保持原样
  refresh() {
    const { remote, dirty, busy } = this.data;
    if (!remote || dirty || remote.revoked || busy) return undefined;
    return api
      .call('getShare', { id: remote.id })
      .then((result) => {
        if (this.disposed) return;
        this.setData({
          agreement: result.agreement,
          remote: result,
          values: table(result.content),
          dirty: false,
        });
      })
      .catch(() => {});
  },
  agree() {
    return ui.run(this, async () => {
      const result = await api.call('agree', {
        id: this.data.remote.id,
        version: this.data.remote.version,
        agreed: !(this.data.agreement && this.data.agreement.agreed),
      });
      this.setData({ agreement: result.agreement });
    });
  },
  // 与名片页同一种确认：撤回会让牌友手里的旧链接打不开，确认了才动手
  revoke() {
    wx.showModal({
      title: '撤回分享链接',
      content: '牌友再打开之前收到的链接会看不到这份约定，本机保存的约定不受影响',
      confirmText: '撤回',
      success: (result) => {
        if (result.confirm) this.withdraw();
      },
    });
  },
  withdraw() {
    return ui.run(this, async () => {
      const result = await api.call('revoke', { id: this.data.remote.id });
      this.setData({
        remote: { ...this.data.remote, version: result.version, revoked: true },
        dirty: true,
      });
      if (this.persist()) wx.showToast({ title: '已撤回', icon: 'success' });
    });
  },
  copy() {
    wx.setClipboardData({
      data: [
        '对局约定',
        ...TABLE_FIELDS.map(
          (field) => `${field.label}：${field.options[this.data.values[field.key]]}`,
        ),
      ].join('\n'),
    });
  },
  onShareAppMessage() {
    return this.data.remote && !this.data.dirty
      ? {
          title: '这桌怎么玩',
          path: `/community/pages/table/index?id=${this.data.remote.id}`,
        }
      : { title: '这桌怎么玩', path: '/community/pages/table/index' };
  },
});
