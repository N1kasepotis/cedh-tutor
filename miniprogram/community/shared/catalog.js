'use strict';
// Source snapshot, not a live rules feed. Updating the list creates a new voting round.
const banlist = {
  checkedAt: '2026-09-09',
  round: 'commander-2026-09-09',
  format: 'Commander',
  source: 'https://magic.wizards.com/en/banned-restricted-list',
  restrictions: [
    '所有 Conspiracy 类型牌不可使用',
    '所有涉及 ante（赌注）的牌不可使用',
    '官方列明涉及种族或文化冒犯的牌不可使用',
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
    title: '二地加互动',
    commander: "Yuriko, the Tiger's Shadow",
    context:
      '四人 cEDH，2 号位，首次七张\n还有一次免费调度，套牌以低费忍者与穿透生物为主',
    cards: [
      'Island',
      'Swamp',
      'Ornithopter',
      'Changeling Outcast',
      'Brainstorm',
      'Daze',
      'Snuff Out',
    ],
    keep: '两地加低费生物能展开，手里还有 Daze 和 Snuff Out，考虑好什么时候下生物、什么时候留互动',
    mull: '前位如果是竞速套牌，这两张互动未必拦得住，可以免费调度找更合适的起手',
  },
  {
    id: 'kinnan-no-mana-v1',
    title: '零地起手',
    commander: 'Kinnan, Bonder Prodigy',
    context: '四人高强度局，1 号位，首次七张\n还有一次免费调度，没有零费法术力来源',
    cards: [
      'Basalt Monolith',
      'Thrasios, Triton Hero',
      'Seedborn Muse',
      'Counterspell',
      'Cyclonic Rift',
      'Mystical Tutor',
      'Finale of Devastation',
    ],
    keep: '留下就得等后面抓到法术力来源，可能连续几回合都出不了牌',
    mull: '没地，也没有能用的加速，我会用免费调度换一手',
  },
  {
    id: 'winota-engine-v1',
    title: '能展开，没保护',
    commander: 'Winota, Joiner of Forces',
    context:
      '四人高强度局，4 号位，首次七张\n还有一次免费调度，对手有蓝色套牌，其余信息未知',
    cards: [
      'Plains',
      'Mountain',
      'Command Tower',
      'Sol Ring',
      'Ornithopter',
      'Legion Warboss',
      'Blade Historian',
    ],
    keep: '地、加速和非人类生物都有，可以围绕 Winota 展开，不过主将被解后会比较难受',
    mull: '想找保护或干扰，可以免费调度，但下一手不一定还有这么齐的地、加速和生物',
  },
];
function poll(id) {
  const banned = banlist.cards.find((entry) => `${banlist.round}:${entry.id}` === id);
  if (banned) return { id, choices: ['keep', 'unban', 'unknown'] };
  const hand = hands.find((entry) => `hand:${entry.id}` === id);
  return hand ? { id, choices: ['keep', 'mull', 'unknown'] } : null;
}
module.exports = { banlist, hands, poll };
