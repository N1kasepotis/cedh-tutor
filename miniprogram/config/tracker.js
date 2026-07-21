const trackerConfig = {
  storageKey: 'commanderTrackerData',
  version: 1,
  maxDecks: 5,
  suggestionLimit: 8,
  historyRenderLimit: 50,
  resultOptions: [
    { id: 'win', label: '胜' },
    { id: 'loss', label: '负' },
    { id: 'draw', label: '平' },
  ],
  seatOptions: [
    { id: 'seat1', label: 'Seat 1' },
    { id: 'seat2', label: 'Seat 2' },
    { id: 'seat3', label: 'Seat 3' },
    { id: 'seat4', label: 'Seat 4' },
  ],

  stats: {
    drawsCountForWinRate: false,
    frequencyBucket: 'week',
    dateFormat: 'YYYY-MM-DD',
  },

  export: {
    clipboardLabel: '战绩摘要已复制',
  },
};

module.exports = {
  trackerConfig,
};
