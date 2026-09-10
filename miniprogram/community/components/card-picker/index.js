const cards = require('../../utils/cards');
Component({
  properties: { visible: Boolean },
  data: {
    query: '',
    results: [],
    busy: false,
    error: '',
    mode: 'search',
    language: 0,
    languages: [
      '所有语言',
      'English',
      '简体中文',
      '繁體中文',
      '日本語',
      'Deutsch',
      'Français',
      'Italiano',
      'Español',
      'Português',
      '한국어',
      'Русский',
    ],
    codes: [
      'any',
      'en',
      'zhs',
      'zht',
      'ja',
      'de',
      'fr',
      'it',
      'es',
      'pt',
      'ko',
      'ru',
    ],
    more: false,
  },
  lifetimes: {
    attached() {
      this.sequence = 0;
    },
    detached() {
      this.sequence += 1;
    },
  },
  methods: {
    input(event) {
      this.setData({ query: event.detail.value });
    },
    close() {
      this.sequence += 1;
      this.setData({ busy: false });
      this.triggerEvent('close');
    },
    noop() {},
    search() {
      this.oracle = '';
      this.page = 1;
      this.setData({ mode: 'search' });
      this.fetch(false);
    },
    language(event) {
      this.setData({ language: Number(event.detail.value) });
      this.page = 1;
      this.fetch(false);
    },
    more() {
      if (!this.data.busy) {
        this.page += 1;
        this.fetch(true);
      }
    },
    back() {
      this.search();
    },
    async fetch(append) {
      const sequence = ++this.sequence;
      this.setData({ busy: true, error: '' });
      try {
        const result = this.oracle
          ? await cards.prints(
              this.oracle,
              this.data.codes[this.data.language],
              this.page,
            )
          : await cards.search(this.data.query, this.page);
        if (sequence !== this.sequence) return;
        this.all = append ? this.all.concat(result.cards) : result.cards;
        this.setData({
          results: this.all.slice(0, 400),
          more: result.more && this.all.length < 400,
          busy: false,
        });
      } catch (error) {
        if (sequence === this.sequence) {
          if (append) this.page -= 1;
          this.setData({ error: error.message, busy: false });
        }
      }
    },
    choose(event) {
      const selected =
        this.data.results[Number(event.currentTarget.dataset.index)];
      if (!selected) return;
      if (this.data.mode === 'search') {
        this.oracle = selected.oracleId;
        this.page = 1;
        this.setData({ mode: 'prints' });
        this.fetch(false);
      } else {
        this.triggerEvent('select', selected);
        this.close();
      }
    },
  },
});
