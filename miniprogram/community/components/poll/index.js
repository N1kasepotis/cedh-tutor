const api = require('../../utils/api');
const local = require('../../utils/local');
const { calculatePollStats } = require('../../utils/poll-stats');
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
    // busy 只代表投票在路上；读票和投票分开，读票时选项照常能点
    busy: false,
    reading: false,
    readFailed: false,
    error: '',
    closed: false,
    // 这个环境有没有云服务，不代表这一次连得上；连不连得上看 reading 和 readFailed
    cloudReady: api.available(),
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
          reading: false,
          readFailed: false,
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
      const { cloudReady, closed, mine } = this.data;
      if (cloudReady && !closed && !(mine && mine.choice === choice))
        this.request('vote', { vote: this.voteValue() });
    },
    // 票数只看全部参与者，不再按牌手类别分开统计
    decorate() {
      const counts = this.data.stats && (this.data.stats.all || {});
      if (!counts) return;
      try {
        this.setData(calculatePollStats(counts, this.properties.choices));
      } catch (error) {
        this.setData({ stats: null, error: '票数暂时无法读取' });
      }
    },
    // 读票不挡投票：云函数冷启动时读票要等几秒，选项不该一直点不动。投票的结果本身带票数，
    // 服务端按人替换选票，读票结果晚到也会被序号作废
    async request(action, extra = {}) {
      if (this.data.busy) return;
      const isRead = action === 'poll';
      const request = ++this.requestId;
      this.setData({ busy: !isRead, reading: isRead, error: '' });
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
          reading: false,
          readFailed: false,
        });
        this.decorate();
      } catch (error) {
        if (request !== this.requestId) return;
        // 服务端不认这个题号（换题后云函数还没重新部署，或禁牌表换了轮次）：刷新也没用，
        // 投票整块收起，不把“选项已变化”这类用户做不了任何事的提示摆出来
        if (error.code === 'INVALID_VOTE')
          this.setData({ closed: true, stats: null, mine: null, busy: false, reading: false, readFailed: false });
        // 读票失败不打扰作答，只留一行能重试的小字；投票这类用户主动的操作失败仍要说清楚
        else if (isRead) this.setData({ reading: false, readFailed: true });
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
