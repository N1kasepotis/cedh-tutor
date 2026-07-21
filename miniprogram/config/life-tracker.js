const lifeTrackerConfig = {
  storageKey: 'fourPlayerLifeTracker',
  schemaVersion: 1,
  initialLife: 40,
  // 两人对决按 1v1 惯例 20 点起始；未列出的人数回退 initialLife
  initialLifeByPlayerCount: { 2: 20 },
  minLife: -999,
  maxLife: 999,
  playerCount: 4,
  playerCountOptions: [2, 3, 4],
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
