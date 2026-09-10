'use strict';
// Source snapshot, not a live rules feed. Updating the list creates a new voting round.
const banlist = {
  checkedAt: '2026-09-09',
  round: 'commander-2026-09-09',
  format: 'Commander',
  source: 'https://magic.wizards.com/en/banned-restricted-list',
  restrictions: [
    '所有 Conspiracy 类型牌不可使用。',
    '所有涉及 ante（赌注）的牌不可使用。',
    '官方列明涉及种族或文化冒犯的牌不可使用。',
  ],
  cards: [
    'Ancestral Recall',
    'Balance',
    'Black Lotus',
    'Chaos Orb',
    'Channel',
    'Dockside Extortionist',
    'Emrakul, the Aeons Torn',
    'Erayo, Soratami Ascendant',
    'Falling Star',
    'Fastbond',
    'Flash',
    'Golos, Tireless Pilgrim',
    'Griselbrand',
    'Hullbreacher',
    'Iona, Shield of Emeria',
    'Karakas',
    'Jeweled Lotus',
    'Leovold, Emissary of Trest',
    'Library of Alexandria',
    'Limited Resources',
    'Mana Crypt',
    'Mox Emerald',
    'Mox Jet',
    'Mox Pearl',
    'Mox Ruby',
    'Mox Sapphire',
    'Nadu, Winged Wisdom',
    'Paradox Engine',
    'Primeval Titan',
    'Prophet of Kruphix',
    'Recurring Nightmare',
    'Rofellos, Llanowar Emissary',
    'Shahrazad',
    'Sundering Titan',
    'Sylvan Primordial',
    'Time Vault',
    'Time Walk',
    'Tinker',
    'Tolarian Academy',
    'Trade Secrets',
    'Upheaval',
    "Yawgmoth's Bargain",
  ].map((name) => ({
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    status: '禁用',
  })),
};
banlist.cards.push({
  id: 'lutri-the-spellchaser',
  name: 'Lutri, the Spellchaser',
  status: '仅禁作行侣',
  source:
    'https://magic.wizards.com/en/news/announcements/commander-banned-and-restricted-february-9-2026',
});

// Authored discussion scenarios, not a claim of a unique correct play or an empirical result.
const hands = [
  {
    id: 'yuriko-resource-v1',
    title: '有起点，也有保护',
    commander: "Yuriko, the Tiger's Shadow",
    context:
      '四人 cEDH · 2 号位 · 首次七张 · 仍有一次免费调度。套牌以低费忍者与穿透生物为主。',
    cards: [
      'Island',
      'Swamp',
      'Ornithopter',
      'Changeling Outcast',
      'Brainstorm',
      'Daze',
      'Snuff Out',
    ],
    keep: '两张地与低费生物提供展开路线；Daze 和 Snuff Out 提供有限互动。保留时需要决定是否先留法术力，而非机械地把生物全部下完。',
    mull: '如果已知前位是高速组合，且这手无法在关键窗口有效阻止，免费调度可以寻找更合适的互动。不能只因有两张地就自动保留。',
  },
  {
    id: 'kinnan-no-mana-v1',
    title: '强牌很多，法术力在哪',
    commander: 'Kinnan, Bonder Prodigy',
    context:
      '四人高强度局 · 1 号位 · 首次七张 · 仍有一次免费调度。没有可在零费下启动的法术力来源。',
    cards: [
      'Basalt Monolith',
      'Thrasios, Triton Hero',
      'Seedborn Muse',
      'Counterspell',
      'Cyclonic Rift',
      'Mystical Tutor',
      'Finale of Devastation',
    ],
    keep: '保留意味着依赖后续抓牌才能启动；手里的潜力不等于现在能执行的路线。若选择留牌，应明确愿意承担连续空过的代价。',
    mull: '倾向调度。这手没有地，也没有可立即使用的法术力来源。免费调度的目标是可执行的开局，而非更多昂贵的强牌。',
  },
  {
    id: 'winota-engine-v1',
    title: '有引擎，缺保护',
    commander: 'Winota, Joiner of Forces',
    context:
      '四人高强度局 · 4 号位 · 首次七张 · 仍有一次免费调度。桌上有蓝色互动套牌，但没有额外已知信息。',
    cards: [
      'Plains',
      'Mountain',
      'Command Tower',
      'Sol Ring',
      'Ornithopter',
      'Legion Warboss',
      'Blade Historian',
    ],
    keep: '法术力与非人类进攻者都在，计划较明确。需要考虑主将被处理后的后续，而不只计算理想情况下的爆发。',
    mull: '希望寻找保护或干扰时，可以利用免费调度。代价是放弃目前完整的法术力基础，不能把未知对手互动当成确定会发生的事。',
  },
];
function poll(id) {
  const banned = banlist.cards.find(
    (entry) => `${banlist.round}:${entry.id}` === id,
  );
  if (banned) return { id, choices: ['keep', 'unban', 'unknown'] };
  const hand = hands.find((entry) => `hand:${entry.id}` === id);
  return hand ? { id, choices: ['keep', 'mull', 'unknown'] } : null;
}
module.exports = { banlist, hands, poll };
