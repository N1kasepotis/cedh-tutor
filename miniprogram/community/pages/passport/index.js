const local = require('../../utils/local');
const api = require('../../utils/api');
const ui = require('../../utils/page');
const domain = require('../../shared/contracts');
const poster = require('../../utils/poster');
Page({
  data: {
    labels: domain.SLOT_LABELS,
    hints: ['看一眼就心动的那张', '牌友一看就知道你怎么玩的那张', '每次打出来都让全桌愣一下的那张'],
    reasonHints: ['原画、规则设计还是实战体验？', '用它说说你喜欢怎么玩', '它在你的牌组里妙在哪？'],
    slotIndex: 0,
    nickname: '',
    slots: [null, null, null],
    reasons: ['', '', ''],
    picker: false,
    busy: false,
    task: '',
    error: '',
    remote: null,
    shareReady: false,
    friend: null,
    detail: null,
    privacy: false,
    posterPath: '',
    artOnly: false,
  },
  onLoad(options) {
    this.disposed = false;
    this.unsaved = false;
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
        if (!this.disposed) this.setData({ friend });
      });
  },
  // 草稿自动存本机：选好牌、离开输入框和离开页面时写入，不再单独放保存按钮
  onHide() {
    this.persist();
  },
  onUnload() {
    this.persist();
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
    });
  },
  edit(patch) {
    this.unsaved = true;
    this.setData({ ...patch, shareReady: false, posterPath: '' });
  },
  nickname(event) {
    this.edit({ nickname: event.detail.value });
  },
  reason(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.edit({ [`reasons[${index}]`]: event.detail.value });
  },
  persist() {
    if (this.unsaved && this.saveDraft()) this.unsaved = false;
  },
  choose(event) {
    this.slotIndex = Number(event.currentTarget.dataset.index);
    // 告诉选牌弹层这次是为哪一格打开的：换了一格就从头搜索
    this.setData({ picker: true, slotIndex: this.slotIndex });
  },
  closePicker() {
    this.setData({ picker: false });
  },
  selected(event) {
    this.edit({ [`slots[${this.slotIndex}]`]: event.detail });
    this.persist();
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
  saveDraft() {
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
      return true;
    } catch (error) {
      ui.error(this, error);
      return false;
    }
  },
  // 分享和生成图片各有自己的按钮：记下正在做哪件事，只让对应的按钮转圈
  start(task, work) {
    if (this.data.busy) return undefined;
    this.setData({ task });
    return ui.run(this, work);
  },
  publish() {
    return this.start('share', async () => {
      const content = this.content();
      if (content.slots.some((slot) => !slot))
        throw new Error('还差几张牌，选齐就能生成名片');
      domain.passport(content);
      // Persist the draft ID before publication so a lost response can be retried.
      if (!this.saveDraft()) return;
      this.unsaved = false;
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
      });
      if (this.saveDraft()) wx.showToast({ title: '可分享给朋友', icon: 'success' });
    });
  },
  revoke() {
    return ui.run(this, async () => {
      const result = await api.call('revoke', { id: this.data.remote.id });
      this.setData({
        remote: { ...this.data.remote, version: result.version, active: false },
        shareReady: false,
      });
      this.saveDraft();
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
    const artOnly = Boolean(event.currentTarget.dataset.art);
    if (artOnly !== this.data.artOnly) this.setData({ artOnly, posterPath: '' });
  },
  generatePoster() {
    return this.start('poster', async () => {
      const content = this.content();
      if (content.slots.some((slot) => !slot))
        throw new Error('还差几张牌，选齐就能生成名片');
      domain.passport(content);
      const path = await poster.render(this, content, this.data.artOnly);
      if (!this.disposed) this.setData({ posterPath: path });
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
