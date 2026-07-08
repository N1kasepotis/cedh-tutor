// 答题选项列表：edhti 与 quiz 共用的 markup 与交互。
// 视觉皮肤留在各页 wxss（apply-shared 让页面的 .option 规则进入组件），
// 页面只需监听 select 事件，detail 携带 { index, id }。
Component({
  options: {
    styleIsolation: 'apply-shared',
  },

  properties: {
    options: {
      type: Array,
      value: [],
    },
  },

  methods: {
    handleTap(event) {
      const index = Number(event.currentTarget.dataset.index);
      const item = this.data.options[index] || {};
      this.triggerEvent('select', { index, id: item.id });
    },
  },
});
