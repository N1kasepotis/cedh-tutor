const api = require('../../utils/api');
const local = require('../../utils/local');
Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    pollId: String,
    choices: Array,
    // 练习题用：投过票才显示比例，不显示未表态人数和撤票
    compact: { type: Boolean, value: false },
  },
  data: {
    localChoice: '',
    remembered: false,
    stats: null,
    rows: [],
    sample: 0,
    known: 0,
    unknown: 0,
    mine: null,
    busy: false,
    error: '',
    closed: false,
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
          stats: null,
          mine: null,
          rows: [],
          busy: false,
          error: '',
          closed: false,
        });
      } catch (error) {
        this.setData({ error: error.message });
      }
      if (api.available()) this.refresh();
    },
    // 只交立场，牌手类别和补充说明都不再收集；服务端把缺省的类别记作未填写
    voteValue() {
      return { choice: this.data.localChoice };
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
    // 点选项即投票；已经投的就是这一项时不重复提交，连不上服务或本轮未开放时只存本机
    choose(event) {
      const choice = event.currentTarget.dataset.choice;
      this.setData({ localChoice: choice, error: '' });
      this.remember();
      this.triggerEvent('answer', { choice });
      const { online, closed, mine } = this.data;
      if (online && !closed && !(mine && mine.choice === choice))
        this.request('vote', { vote: this.voteValue() });
    },
    // 票数只看全部参与者，不再按牌手类别分开统计
    decorate() {
      const counts = this.data.stats && (this.data.stats.all || {});
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
        if (request !== this.requestId) return;
        // 服务端不认这个题号（换题后云函数还没重新部署，或禁牌表换了轮次）：刷新也没用，
        // 投票整块收起，不把“选项已变化”这类用户做不了任何事的提示摆出来
        if (error.code === 'INVALID_VOTE')
          this.setData({ closed: true, stats: null, mine: null, busy: false });
        // 进页时读票失败不打扰作答；投票这类用户主动的操作失败仍要说清楚
        else if (action === 'poll') this.setData({ busy: false });
        else this.setData({ error: error.message, busy: false });
      }
    },
    refresh() {
      return this.request('poll');
    },
    retract() {
      return this.request('vote', { retract: true });
    },
  },
});
