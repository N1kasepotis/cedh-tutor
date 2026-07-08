const randomConfig = {
  number: {
    defaultMin: 1,
    defaultMax: 100,
    presets: [
      { id: 'd2', label: '2面', min: 1, max: 2 },
      { id: 'd6', label: '6面', min: 1, max: 6 },
      { id: 'd20', label: '20面', min: 1, max: 20 },
      { id: 'd100', label: '100面', min: 1, max: 100 },
    ],
  },

  rollOff: {
    playerCount: 4,
    sides: 20,
  },
};

module.exports = {
  randomConfig,
};
