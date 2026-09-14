const local = require('../../utils/local');
const api = require('../../utils/api');
const ui = require('../../utils/page');
const domain = require('../../shared/contracts');
const poster = require('../../utils/poster');
Page({
  data: {
    labels: domain.SLOT_LABELS,
    hints: ['你最欣赏哪张牌的设计', '哪张牌最能代表你的打法', '你套牌里的常客'],
    nickname: '',
    slots: [null, null, null],
    reasons: ['', '', ''],
    picker: false,
    busy: false,
    error: '',
    feedback: '',
    remote: null,
    shareReady: false,
    friend: null,
    comparison: [],
    detail: null,
    privacy: false,
    posterPath: '',
    artOnly: false,
  },
  onLoad(options) {
    this.disposed = false;
    this.draftId = local.id();
    try {
      this.loadDraft();
    } catch (error) {
      ui.error(this, error);
    }
    if (options.id)
      ui.run(this, async () => {
        const friend = await api.call('getShare', { id: options.id });
        if (friend.kind !== 'passport')
          throw new Error('这个分享不是三张牌名片');
        if (!this.disposed) {
          this.setData({ friend });
          this.compare();
        }
      });
  },
  onUnload() {
    this.disposed = true;
  },
  loadDraft() {
    const draft = local.playerPassport(local.load()) || {
      id: local.id(),
      nickname: '',
      slots: [null, null, null],
      remote: null,
    };
    this.draftId = draft.id;
    this.setData({
      nickname: draft.nickname,
      slots: draft.slots,
      reasons: draft.slots.map((slot) => (slot && slot.reason) || ''),
      remote: draft.remote || null,
      shareReady: Boolean(draft.remote && draft.remote.active && !draft.dirty),
      posterPath: '',
      error: '',
      feedback: '',
    });
    this.compare();
  },
  nickname(event) {
    this.setData({
      nickname: event.detail.value,
      feedback: '',
      shareReady: false,
      posterPath: '',
    });
  },
  reason(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({
      [`reasons[${index}]`]: event.detail.value,
      feedback: '',
      shareReady: false,
      posterPath: '',
    });
  },
  choose(event) {
    this.slotIndex = Number(event.currentTarget.dataset.index);
    this.setData({ picker: true });
  },
  closePicker() {
    this.setData({ picker: false });
  },
  selected(event) {
    this.setData({
      [`slots[${this.slotIndex}]`]: event.detail,
      feedback: '',
      shareReady: false,
      posterPath: '',
    });
    this.compare();
  },
  content() {
    return {
      nickname: this.data.nickname,
      deckName: '',
      slots: this.data.slots.map((slot, index) =>
        slot ? { ...slot, reason: this.data.reasons[index] } : null,
      ),
    };
  },
  saveDraft(toast = true) {
    try {
      const content = this.content();
      local.update((state) => {
        state.passports.player = {
          id: this.draftId,
          ...content,
          remote: this.data.remote,
          dirty: !this.data.shareReady,
        };
      });
      if (toast) {
        this.setData({
          error: '',
          feedback: '已保存到本机，下次打开会保留这些选择',
        });
        wx.showToast({ title: '名片已保存', icon: 'success' });
      }
      return true;
    } catch (error) {
      ui.error(this, error);
      return false;
    }
  },
  save() {
    this.saveDraft();
  },
  publish() {
    return ui.run(this, async () => {
      const content = this.content();
      if (content.slots.some((slot) => !slot))
        throw new Error('还差几张牌，选齐就能生成名片');
      domain.passport(content);
      // Persist the draft ID before publication so a lost response can be retried.
      if (!this.saveDraft(false)) return;
      const result = await api.call('publish', {
        kind: 'passport',
        draftId: this.draftId,
        version: (this.data.remote && this.data.remote.version) || 0,
        content,
      });
      if (this.disposed) return;
      this.setData({
        remote: { id: result.id, version: result.version, active: true },
        shareReady: true,
        feedback: '名片已生成，可以分享给牌友',
      });
      if (this.saveDraft(false))
        wx.showToast({ title: '可分享给朋友', icon: 'success' });
    });
  },
  revoke() {
    return ui.run(this, async () => {
      const result = await api.call('revoke', { id: this.data.remote.id });
      this.setData({
        remote: { ...this.data.remote, version: result.version, active: false },
        shareReady: false,
      });
      this.saveDraft(false);
    });
  },
  compare() {
    this.setData({
      comparison: domain.compare(
        this.content(),
        this.data.friend && this.data.friend.content,
      ),
    });
  },
  viewCard(event) {
    const index = Number(event.currentTarget.dataset.index);
    const source = event.currentTarget.dataset.friend
      ? this.data.friend.content.slots
      : this.data.slots;
    this.setData({ detail: source[index] });
  },
  closeDetail() {
    this.setData({ detail: null });
  },
  noop() {},
  imageFailed() {
    this.setData({
      error: '卡图没加载出来，试试换个版本',
    });
  },
  mode(event) {
    this.setData({ artOnly: event.detail.value, posterPath: '' });
  },
  generatePoster() {
    return ui.run(this, async () => {
      const content = this.content();
      if (content.slots.some((slot) => !slot))
        throw new Error('还差几张牌，选齐就能生成名片');
      domain.passport(content);
      const path = await poster.render(this, content, this.data.artOnly);
      if (!this.disposed)
        this.setData({
          posterPath: path,
          feedback: '图片已生成，可以预览或存入相册',
        });
    });
  },
  previewPoster() {
    wx.previewImage({ urls: [this.data.posterPath] });
  },
  saveImage() {
    return ui.run(this, async () => {
      if (!this.data.posterPath) return;
      const setting = await new Promise((resolve, reject) =>
        wx.getPrivacySetting
          ? wx.getPrivacySetting({
              success: resolve,
              fail: () => reject(new Error('隐私设置读取失败，请重试')),
            })
          : reject(new Error('请升级微信后保存图片')),
      );
      if (setting.needAuthorization) {
        this.setData({ privacy: true });
        return;
      }
      await this.writeAlbum();
    });
  },
  async writeAlbum() {
    await new Promise((resolve, reject) =>
      wx.saveImageToPhotosAlbum({
        filePath: this.data.posterPath,
        success: resolve,
        fail: () =>
          reject(new Error('未能保存，可在右上角设置中允许相册权限后重试')),
      }),
    );
    wx.showToast({ title: '已存入相册', icon: 'success' });
    if (!this.disposed) this.setData({ feedback: '已存入手机相册' });
  },
  agreePrivacy() {
    this.setData({ privacy: false });
    return ui.run(this, () => this.writeAlbum());
  },
  declinePrivacy() {
    this.setData({ privacy: false });
  },
  privacyContract() {
    wx.openPrivacyContract({
      fail: () => this.setData({ error: '隐私说明暂时打不开，请稍后重试' }),
    });
  },
  onShareAppMessage() {
    return this.data.shareReady && this.data.remote
      ? {
          title: '三张牌认识我',
          path: `/community/pages/passport/index?id=${this.data.remote.id}`,
        }
      : {
          title: '选三张牌，介绍你自己',
          path: '/community/pages/passport/index',
        };
  },
});
