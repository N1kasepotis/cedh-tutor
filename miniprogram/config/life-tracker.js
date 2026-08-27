const lifeTrackerConfig = {
  storageKey: 'fourPlayerLifeTracker',
  schemaVersion: 1,
  initialLife: 40,
  // 两人对决按 1v1 惯例 20 点起始；未列出的人数回退 initialLife
  initialLifeByPlayerCount: { 2: 20 },
  minLife: -999,
  maxLife: 999,
  playerCount: 4,
  playerCountOptions: [2, 3, 4, 5],
  // 每种人数下、每个座位坐在屏幕的哪条边上。索引 = 座位序（seat-1 起）。
  //
  // 这张表同时决定两件事，所以只能有一份：
  //   ① 内容要不要转——坐上边的人要 rotate(180deg) 才对着他正着读
  //   ② 那个人的「外缘」是屏幕哪条边——边缘赛跑的光要跑过那一段
  // 以前是一句 `playerCount === 4 ? 2 : 1` 硬算，加进侧坐就算不出来了。
  //
  // 五人取「两两对坐 + 一人坐短边」：这是五个人围一台平放手机的真实坐法。
  // 侧坐那位的加减区仍是轴对齐矩形，只有数字转 90°——整块 face 转 90° 会让
  // 盒子尺寸和旋转后的视觉尺寸对不上，必然溢出。
  seatFacing: {
    2: ['top', 'bottom'],
    3: ['top', 'bottom', 'bottom'],
    4: ['top', 'top', 'bottom', 'bottom'],
    5: ['top', 'top', 'bottom', 'bottom', 'right'],
  },
  // 围坐一圈的顺序，从屏幕左上起顺时针。**DOM 顺序不等于围坐顺序**：
  // 三人局 seat-2 在左下、seat-3 在右下，顺时针数是 1 → 3 → 2。
  // 边缘赛跑的光按这个顺序跑，跑错就变成在对角之间乱跳，一眼看出不对。
  seatRing: {
    2: [1, 2],
    3: [1, 3, 2],
    4: [1, 2, 4, 3],
    5: [1, 2, 5, 4, 3],
  },
  // 抽先手：一道光沿屏幕外缘绕圈，经过每个人的座位边，减速，停在中签者那一段。
  // 这是把页面本来就有的发丝分隔线延伸了一下，而不是引进一套新的视觉。
  firstPlayerRace: {
    laps: 3, // 绕三圈再落定；少于两圈来不及建立「在转」的印象
    minStepMs: 55, // 最快那一段的停留时长
    maxStepMs: 380, // 最后一格的停留时长，减速全靠它和 minStepMs 的差
    easing: 2.2, // 幂次缓出；越大，末段拖得越明显
    trail: 2, // 彗尾长度：头部之外再亮两格递减，观感才是「一道光在跑」而不是「在闪」
    holdMs: 1500, // 落定后只留中签者独亮多久，再交给常驻的那条边
  },
  holdDelayMs: 420,
  holdIntervalMs: 85,
  colors: [
    { key: 'cyan', hex: '#5DC0C8', rgb: '93, 192, 200' },
    { key: 'ember', hex: '#E69B52', rgb: '230, 155, 82' },
    { key: 'gold', hex: '#CDB774', rgb: '205, 183, 116' },
    { key: 'orchid', hex: '#BE709E', rgb: '190, 112, 158' },
    { key: 'indigo', hex: '#7E8DCD', rgb: '126, 141, 205' },
    { key: 'mint', hex: '#72C89A', rgb: '114, 200, 154' },
    { key: 'coral', hex: '#D97772', rgb: '217, 119, 114' },
    { key: 'azure', hex: '#67A8E4', rgb: '103, 168, 228' },
  ],
};

module.exports = {
  lifeTrackerConfig,
};
