const api = require('../../utils/api');
const local = require('../../utils/local');
Component({
  options: { styleIsolation: 'apply-shared' },
  properties: { pollId: String, choices: Array },
  data: {
    localChoice: '',
    remembered: false,
    perspective: 0,
    perspectives: ['不填写', '休闲 EDH', 'cEDH', '两者都玩'],
    view: 0,
    views: ['全部参与者', '休闲 EDH', 'cEDH', '两者都玩', '未填写'],
    reason: 4,
    reasons: ['强度', '套牌多样性', '对局体验', '玩法特色', '不填写'],
    details: false,
    stats: null,
    rows: [],
    sample: 0,
    known: 0,
    unknown: 0,
    mine: null,
    busy: false,
    error: '',
    online: api.available(),
    updated: '',
  },
  observers: {
    pollId(id) {
      if (id) this.loadPoll();
    },
  },
  lifetimes: {
    detached() {
      this.requestId = (this.requestId || 0) + 1;
    },
  },
  methods: {
    loadPoll() {
      this.requestId = (this.requestId || 0) + 1;
      try {
        const stance = local.load().stances[this.properties.pollId];
        this.setData({
          localChoice: (stance && stance.choice) || '',
          remembered: Boolean(stance),
          perspective: stance
            ? ['unspecified', 'casual', 'competitive', 'both'].indexOf(stance.perspective)
            : 0,
          reason: stance
            ? ['balance', 'diversity', 'experience', 'identity', 'unsure'].indexOf(
                stance.reason,
              )
            : 4,
          stats: null,
          mine: null,
          rows: [],
          busy: false,
          error: '',
        });
      } catch (error) {
        this.setData({ error: error.message });
      }
      if (api.available()) this.refresh();
    },
    voteValue() {
      return {
        choice: this.data.localChoice,
        perspective: ['unspecified', 'casual', 'competitive', 'both'][
          this.data.perspective
        ],
        reason: ['balance', 'diversity', 'experience', 'identity', 'unsure'][
          this.data.reason
        ],
      };
    },
    remember() {
      try {
        local.update((state) => {
          state.stances[this.properties.pollId] = this.voteValue();
        });
        this.setData({ remembered: true });
        return true;
      } catch (error) {
        this.setData({ error: error.message, remembered: false });
        return false;
      }
    },
    choose(event) {
      this.setData({
        localChoice: event.currentTarget.dataset.choice,
        error: '',
      });
      this.remember();
      this.triggerEvent('answer', { choice: this.data.localChoice });
    },
    toggleDetails() {
      this.setData({ details: !this.data.details });
    },
    perspective(event) {
      this.setData({ perspective: Number(event.detail.value) });
      if (this.data.localChoice) this.remember();
    },
    reason(event) {
      this.setData({ reason: Number(event.detail.value) });
      if (this.data.localChoice) this.remember();
    },
    filter(event) {
      this.setData({ view: Number(event.detail.value) });
      this.decorate();
    },
    decorate() {
      const counts =
        this.data.stats &&
        (this.data.stats[
          ['all', 'casual', 'competitive', 'both', 'unspecified'][this.data.view]
        ] ||
          {});
      if (!counts) return;
      const sample = Object.values(counts).reduce((sum, value) => sum + value, 0);
      const known = sample - (counts.unknown || 0);
      this.setData({
        sample,
        known,
        unknown: counts.unknown || 0,
        rows: this.properties.choices
          .filter((choice) => choice.id !== 'unknown')
          .map((choice) => ({
            ...choice,
            count: counts[choice.id] || 0,
            percent: known ? Math.round(((counts[choice.id] || 0) * 100) / known) : 0,
          })),
      });
    },
    async request(action, extra = {}) {
      if (this.data.busy) return;
      const request = ++this.requestId;
      this.setData({ busy: true, error: '' });
      try {
        const result = await api.call(action, {
          pollId: this.properties.pollId,
          ...extra,
        });
        if (request !== this.requestId) return;
        this.setData({
          stats: result.counts,
          mine: result.mine,
          updated: new Date(result.updatedAt).toLocaleDateString(),
          busy: false,
        });
        this.decorate();
      } catch (error) {
        if (request === this.requestId)
          this.setData({ error: error.message, busy: false });
      }
    },
    refresh() {
      return this.request('poll');
    },
    submit() {
      if (!this.data.localChoice) return;
      this.remember();
      return this.request('vote', { vote: this.voteValue() });
    },
    retract() {
      return this.request('vote', { retract: true });
    },
  },
});
