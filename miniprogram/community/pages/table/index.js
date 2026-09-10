const { TABLE_FIELDS, table } = require('../../shared/contracts');
const local = require('../../utils/local');
const api = require('../../utils/api');
const ui = require('../../utils/page');
function defaults() {
  return { level: 1, proxy: 0, combo: 1, turns: 1, time: 1 };
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
        if (result.kind !== 'table') throw new Error('这不是牌桌约定');
        this.setData({
          values: result.content,
          remote: result,
          agreement: result.agreement,
        });
      });
    }
  },
  onUnload() {
    this.disposed = true;
  },
  change(event) {
    this.setData({
      [`values.${event.currentTarget.dataset.key}`]: Number(event.detail.value),
      dirty: true,
      agreement: null,
    });
  },
  save() {
    return this.persist(true);
  },
  persist(notify) {
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
        state.tables = [
          item,
          ...state.tables.filter((old) => old.id !== item.id),
        ].slice(0, 20);
      });
      this.setData({ history: state.tables });
      if (notify) wx.showToast({ title: '约定已保存', icon: 'success' });
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
      values: item.values,
      remote: item.remote,
      dirty: Boolean(item.dirty),
      incoming: false,
      agreement: null,
    });
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
  },
  publish() {
    return ui.run(this, async () => {
      if (!this.persist(false)) return;
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
      if (this.persist(false))
        wx.showToast({ title: '可分享给牌友', icon: 'success' });
    });
  },
  refresh() {
    return ui.run(this, async () => {
      const result = await api.call('getShare', { id: this.data.remote.id });
      this.setData({
        agreement: result.agreement,
        remote: result,
        values: result.content,
        dirty: false,
      });
    });
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
  revoke() {
    return ui.run(this, async () => {
      const result = await api.call('revoke', { id: this.data.remote.id });
      this.setData({
        remote: { ...this.data.remote, version: result.version, revoked: true },
        dirty: true,
      });
      this.save();
    });
  },
  copy() {
    wx.setClipboardData({
      data: [
        '本桌怎么玩',
        ...TABLE_FIELDS.map(
          (field) =>
            `${field.label}：${field.options[this.data.values[field.key]]}`,
        ),
        '开局前一起确认；遇到分歧先讨论。',
      ].join('\n'),
    });
  },
  onShareAppMessage() {
    return this.data.remote && !this.data.dirty
      ? {
          title: '本桌怎么玩：开局前一起确认',
          path: `/community/pages/table/index?id=${this.data.remote.id}`,
        }
      : { title: '一起定下本桌约定', path: '/community/pages/table/index' };
  },
});
