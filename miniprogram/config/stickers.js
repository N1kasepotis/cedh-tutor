const stickerSheets = [
  {
    id: 'playable-delusionary-hydra',
    name: 'Playable Delusionary Hydra',
    words: ['Playable', 'Delusionary', 'Hydra'],
  },
  {
    id: 'unassuming-gelatinous-serpent',
    name: 'Unassuming Gelatinous Serpent',
    words: ['Unassuming', 'Gelatinous', 'Serpent'],
  },
  {
    id: 'unsanctioned-ancient-juggler',
    name: 'Unsanctioned Ancient Juggler',
    words: ['Unsanctioned', 'Ancient', 'Juggler'],
  },
  {
    id: 'ancestral-hot-dog-minotaur',
    name: 'Ancestral Hot-Dog Minotaur',
    words: ['Ancestral', 'Hot-Dog', 'Minotaur'],
  },
  {
    id: 'eldrazi-guacamole-tightrope',
    name: 'Eldrazi Guacamole Tightrope',
    words: ['Eldrazi', 'Guacamole', 'Tightrope'],
  },
  {
    id: 'misunderstood-trapeze-elf',
    name: 'Misunderstood Trapeze Elf',
    words: ['Misunderstood', 'Trapeze', 'Elf'],
  },
  {
    id: 'narrow-minded-baloney-fireworks',
    name: 'Narrow-Minded Baloney Fireworks',
    words: ['Narrow-Minded', 'Baloney', 'Fireworks'],
  },
  {
    id: 'phyrexian-midway-bamboozle',
    name: 'Phyrexian Midway Bamboozle',
    words: ['Phyrexian', 'Midway', 'Bamboozle'],
  },
  {
    id: 'unglued-pea-brained-dinosaur',
    name: 'Unglued Pea-Brained Dinosaur',
    words: ['Unglued', 'Pea-Brained', 'Dinosaur'],
  },
  {
    id: 'trained-blessed-mind',
    name: 'Trained Blessed Mind',
    words: ['Trained', 'Blessed', 'Mind'],
  },
];

const stickerConfig = {
  storageKey: 'goblinStickerSheets',
  drawCount: 3,
  oddsThresholds: [6, 5, 4],
  stickerSheets,
};

module.exports = {
  stickerConfig,
  stickerSheets,
};
