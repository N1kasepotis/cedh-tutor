const {
  costTierConfig,
  metaTagConfig,
  statsWeightConfig,
} = require('./recommendation-rules');
const { applyCommanderMetaTags } = require('../utils/commander-meta');

const commanders = [
  {
    "name": "Kraum, Ludevic's Opus / Tymna the Weaver",
    "colorIdentity": "WUBR",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "speed": 1,
      "combo": 2,
      "proactive": 1,
      "consistency": 1,
      "midrange": 3,
      "value": 2,
      "interaction": 2,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "red": 2,
      "complex": 2,
      "highBudget": 2,
      "competitive": 2,
      "commanderIndependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Kraum%2C%20Ludevic's%20Opus%20%2F%20Tymna%20the%20Weaver",
    "sourceStats": {
      "rank": 1,
      "entries": 1532,
      "conversionRate": 0.22258485639686684,
      "topCuts": 341,
      "winRate": 0.2024793388429752,
      "metaShare": 0.0873233014135887
    },
    "deckElements": [
      "ad_naus",
      "ad_naus_access",
      "black_tutors",
      "blue_farm",
      "blue_stack_interaction",
      "breach_oracle",
      "card_advantage",
      "card_selection",
      "combat_draw",
      "commander_card_advantage",
      "farm_value",
      "flexible_answers",
      "high_play_count",
      "midrange_naus",
      "midrange_value",
      "multi_color_goodstuff",
      "partner_shell",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "top_play_count",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Kinnan, Bonder Prodigy",
    "colorIdentity": "UG",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "permanentEngine": 4,
      "artifact": 2,
      "value": 2,
      "blue": 2,
      "green": 2,
      "simple": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Kinnan%2C%20Bonder%20Prodigy",
    "sourceStats": {
      "rank": 2,
      "entries": 1290,
      "conversionRate": 0.19147286821705425,
      "topCuts": 247,
      "winRate": 0.19503440023930602,
      "metaShare": 0.07352941176470588
    },
    "deckElements": [
      "activated_ability",
      "artifact_mana",
      "basalt_monolith_combo",
      "blue_stack_interaction",
      "card_selection",
      "creature_combo",
      "creature_tutors",
      "fast_mana",
      "green_creature_mana",
      "high_play_count",
      "infinite_mana",
      "mana_engine",
      "proactive_combo",
      "solid_conversion",
      "top_play_count",
      "turbo_combo"
    ]
  },
  {
    "name": "Rograkh, Son of Rohgahh / Thrasios, Triton Hero",
    "colorIdentity": "URG",
    "archetypeTags": [
      "Turbo",
      "Midrange"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "midrange": 3,
      "value": 2,
      "permanentEngine": 4,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "red": 2,
      "green": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Rograkh%2C%20Son%20of%20Rohgahh%20%2F%20Thrasios%2C%20Triton%20Hero",
    "sourceStats": {
      "rank": 3,
      "entries": 1017,
      "conversionRate": 0.20648967551622419,
      "topCuts": 210,
      "winRate": 0.19308247814519194,
      "metaShare": 0.05796853625170999
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "cradle_combo",
      "creature_combo",
      "creature_tutors",
      "fast_mana",
      "green_creature_mana",
      "high_play_count",
      "infinite_mana_sink",
      "midrange_value",
      "partner_shell",
      "proactive_combo",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "temur_cradle",
      "thrasios_outlet",
      "top_play_count",
      "turbo_combo"
    ]
  },
  {
    "name": "Rograkh, Son of Rohgahh / Silas Renn, Seeker Adept",
    "colorIdentity": "UBR",
    "archetypeTags": [
      "Turbo",
      "Midrange"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "black": 2,
      "red": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderIndependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Rograkh%2C%20Son%20of%20Rohgahh%20%2F%20Silas%20Renn%2C%20Seeker%20Adept",
    "sourceStats": {
      "rank": 4,
      "entries": 809,
      "conversionRate": 0.18294190358467244,
      "topCuts": 148,
      "winRate": 0.1819059107358263,
      "metaShare": 0.04611263109895121
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "breach_oracle",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "fast_mana",
      "glass_cannon",
      "high_play_count",
      "midrange_value",
      "partner_shell",
      "proactive_combo",
      "red_breach",
      "resilient_gameplan",
      "rogsi",
      "solid_conversion",
      "top_play_count",
      "turbo_combo",
      "turbo_naus"
    ]
  },
  {
    "name": "Sisay, Weatherlight Captain",
    "colorIdentity": "WUBRG",
    "archetypeTags": [
      "Turbo",
      "Midrange"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "midrange": 3,
      "value": 2,
      "permanentEngine": 4,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "red": 2,
      "green": 2,
      "complex": 2,
      "highBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Sisay%2C%20Weatherlight%20Captain",
    "sourceStats": {
      "rank": 5,
      "entries": 659,
      "conversionRate": 0.22610015174506828,
      "topCuts": 149,
      "winRate": 0.20173160173160173,
      "metaShare": 0.03756269949840401
    },
    "deckElements": [
      "ad_naus_access",
      "activated_ability",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "fast_mana",
      "five_color_combo",
      "five_color_flexibility",
      "flexible_answers",
      "green_creature_mana",
      "high_play_count",
      "legendary_toolbox",
      "mana_engine",
      "midrange_value",
      "multi_color_goodstuff",
      "proactive_combo",
      "red_breach",
      "resilient_gameplan",
      "sisay_toolbox",
      "solid_conversion",
      "top_play_count",
      "turbo_combo",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Thrasios, Triton Hero / Tymna the Weaver",
    "colorIdentity": "WUBG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "green": 2,
      "complex": 2,
      "highBudget": 2,
      "competitive": 2,
      "commanderIndependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Thrasios%2C%20Triton%20Hero%20%2F%20Tymna%20the%20Weaver",
    "sourceStats": {
      "rank": 6,
      "entries": 438,
      "conversionRate": 0.2054794520547945,
      "topCuts": 90,
      "winRate": 0.18725447402880838,
      "metaShare": 0.02496580027359781
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "combat_draw",
      "commander_card_advantage",
      "creature_tutors",
      "farm_value",
      "flexible_answers",
      "green_creature_mana",
      "high_play_count",
      "infinite_mana_sink",
      "midrange_value",
      "multi_color_goodstuff",
      "partner_shell",
      "razakats",
      "razaketh_reanimator",
      "resilient_gameplan",
      "solid_conversion",
      "thrasios_outlet",
      "top_play_count",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Etali, Primal Conqueror // Etali, Primal Sickness",
    "colorIdentity": "RG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "red": 2,
      "green": 2,
      "simple": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Etali%2C%20Primal%20Conqueror%20%2F%2F%20Etali%2C%20Primal%20Sickness",
    "sourceStats": {
      "rank": 7,
      "entries": 437,
      "conversionRate": 0.13043478260869565,
      "topCuts": 57,
      "winRate": 0.15774647887323945,
      "metaShare": 0.024908800729594165
    },
    "deckElements": [
      "big_creature_combo",
      "card_advantage",
      "creature_tutors",
      "etali_cast_triggers",
      "food_chain",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "modal_commander",
      "red_breach",
      "resilient_gameplan",
      "top_play_count"
    ]
  },
  {
    "name": "Dargo, the Shipwrecker / Tymna the Weaver",
    "colorIdentity": "WBR",
    "archetypeTags": [
      "Turbo",
      "Midrange"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "black": 2,
      "red": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Dargo%2C%20the%20Shipwrecker%20%2F%20Tymna%20the%20Weaver",
    "sourceStats": {
      "rank": 8,
      "entries": 385,
      "conversionRate": 0.16623376623376623,
      "topCuts": 64,
      "winRate": 0.19050025265285497,
      "metaShare": 0.02194482444140447
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "card_advantage",
      "combat_draw",
      "commander_card_advantage",
      "dargo_combo",
      "farm_value",
      "fast_mana",
      "high_play_count",
      "midrange_value",
      "partner_shell",
      "proactive_combo",
      "red_breach",
      "resilient_gameplan",
      "sacrifice_combo",
      "solid_conversion",
      "top_play_count",
      "turbo_combo",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Ral, Monsoon Mage // Ral, Leyline Prodigy",
    "colorIdentity": "UR",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "blue": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Ral%2C%20Monsoon%20Mage%20%2F%2F%20Ral%2C%20Leyline%20Prodigy",
    "sourceStats": {
      "rank": 9,
      "entries": 384,
      "conversionRate": 0.17708333333333334,
      "topCuts": 68,
      "winRate": 0.18653648509763618,
      "metaShare": 0.02188782489740082
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_selection",
      "fast_mana",
      "high_play_count",
      "modal_commander",
      "proactive_combo",
      "red_breach",
      "ritual_chain",
      "solid_conversion",
      "spellslinger",
      "storm_combo",
      "top_play_count",
      "turbo_combo"
    ]
  },
  {
    "name": "Ishai, Ojutai Dragonspeaker / Rograkh, Son of Rohgahh",
    "colorIdentity": "WUR",
    "archetypeTags": [
      "Turbo",
      "Aggro",
      "Midrange"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 3,
      "consistency": 1,
      "competitive": 2,
      "combat": 1,
      "simple": 1,
      "fun": 1,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "red": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Ishai%2C%20Ojutai%20Dragonspeaker%20%2F%20Rograkh%2C%20Son%20of%20Rohgahh",
    "sourceStats": {
      "rank": 10,
      "entries": 331,
      "conversionRate": 0.21450151057401812,
      "topCuts": 71,
      "winRate": 0.19930273097036608,
      "metaShare": 0.01886684906520748
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "combat_damage",
      "commander_card_advantage",
      "fast_mana",
      "high_play_count",
      "midrange_value",
      "partner_shell",
      "pressure",
      "proactive_combat",
      "proactive_combo",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "top_play_count",
      "turbo_combo",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Vivi Ornitier",
    "colorIdentity": "UR",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "blue": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Vivi%20Ornitier",
    "sourceStats": {
      "rank": 11,
      "entries": 323,
      "conversionRate": 0.15170278637770898,
      "topCuts": 49,
      "winRate": 0.1763590391908976,
      "metaShare": 0.018410852713178296
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_selection",
      "fast_mana",
      "high_play_count",
      "proactive_combo",
      "red_breach",
      "ritual_chain",
      "solid_conversion",
      "spellslinger",
      "storm_combo",
      "top_play_count",
      "turbo_combo"
    ]
  },
  {
    "name": "Magda, Brazen Outlaw",
    "colorIdentity": "R",
    "archetypeTags": [
      "Stax",
      "Turbo"
    ],
    "matchTags": {
      "stax": 4,
      "speed": 1,
      "control": 2,
      "interaction": 2,
      "lateGame": 1,
      "competitive": 2,
      "red": 2,
      "simple": 2,
      "budgetFriendly": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Magda%2C%20Brazen%20Outlaw",
    "sourceStats": {
      "rank": 12,
      "entries": 292,
      "conversionRate": 0.21232876712328766,
      "topCuts": 62,
      "winRate": 0.20785070785070786,
      "metaShare": 0.016643866849065207
    },
    "deckElements": [
      "artifact_combo",
      "clock_of_omens",
      "high_conversion",
      "high_play_count",
      "proactive_disruption",
      "red_breach",
      "stax_piece",
      "tax_or_lock",
      "top_play_count",
      "treasure_engine",
      "tutor_commander"
    ]
  },
  {
    "name": "Thrasios, Triton Hero / Yoshimaru, Ever Faithful",
    "colorIdentity": "WUG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "green": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Thrasios%2C%20Triton%20Hero%20%2F%20Yoshimaru%2C%20Ever%20Faithful",
    "sourceStats": {
      "rank": 13,
      "entries": 270,
      "conversionRate": 0.14444444444444443,
      "topCuts": 39,
      "winRate": 0.17560617193240263,
      "metaShare": 0.015389876880984952
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "creature_tutors",
      "green_creature_mana",
      "high_play_count",
      "infinite_mana_sink",
      "midrange_value",
      "partner_shell",
      "resilient_gameplan",
      "solid_conversion",
      "thrasios_outlet",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Kefka, Court Mage // Kefka, Ruler of Ruin",
    "colorIdentity": "UBR",
    "archetypeTags": [
      "Turbo",
      "Midrange"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "black": 2,
      "red": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Kefka%2C%20Court%20Mage%20%2F%2F%20Kefka%2C%20Ruler%20of%20Ruin",
    "sourceStats": {
      "rank": 14,
      "entries": 242,
      "conversionRate": 0.15702479338842976,
      "topCuts": 38,
      "winRate": 0.16016597510373445,
      "metaShare": 0.013793889648882809
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "fast_mana",
      "grixis_core",
      "hand_pressure",
      "high_play_count",
      "midrange_naus",
      "midrange_value",
      "modal_commander",
      "proactive_combo",
      "red_breach",
      "resilient_gameplan",
      "turbo_combo"
    ]
  },
  {
    "name": "Tivit, Seller of Secrets",
    "colorIdentity": "WUB",
    "archetypeTags": [
      "Stax",
      "Control",
      "Midrange"
    ],
    "matchTags": {
      "stax": 3,
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "competitive": 2,
      "complex": 1,
      "value": 2,
      "artifact": 3,
      "midrange": 3,
      "flexibility": 2,
      "white": 2,
      "blue": 2,
      "black": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Tivit%2C%20Seller%20of%20Secrets",
    "sourceStats": {
      "rank": 15,
      "entries": 223,
      "conversionRate": 0.19730941704035873,
      "topCuts": 44,
      "winRate": 0.19557522123893806,
      "metaShare": 0.012710898312813497
    },
    "deckElements": [
      "ad_naus_access",
      "artifact_combo",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "control_posture",
      "high_play_count",
      "late_game",
      "midrange_value",
      "proactive_disruption",
      "resilient_gameplan",
      "solid_conversion",
      "stack_interaction",
      "stax_compatible",
      "stax_piece",
      "tax_or_lock",
      "time_sieve",
      "token_engine",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Lumra, Bellow of the Woods",
    "colorIdentity": "G",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "green": 2,
      "budgetFriendly": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Lumra%2C%20Bellow%20of%20the%20Woods",
    "sourceStats": {
      "rank": 16,
      "entries": 186,
      "conversionRate": 0.14516129032258066,
      "topCuts": 27,
      "winRate": 0.17502668089647813,
      "metaShare": 0.010601915184678522
    },
    "deckElements": [
      "card_advantage",
      "creature_tutors",
      "graveyard_value",
      "green_creature_mana",
      "high_play_count",
      "land_engine",
      "lands_combo",
      "midrange_value",
      "resilient_gameplan"
    ]
  },
  {
    "name": "Tayam, Luminous Enigma",
    "colorIdentity": "WBG",
    "archetypeTags": [
      "Stax",
      "Midrange"
    ],
    "matchTags": {
      "stax": 3,
      "control": 2,
      "interaction": 2,
      "lateGame": 1,
      "competitive": 1,
      "midrange": 3,
      "value": 2,
      "graveyard": 4,
      "permanentEngine": 2,
      "flexibility": 2,
      "white": 2,
      "black": 2,
      "green": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Tayam%2C%20Luminous%20Enigma",
    "sourceStats": {
      "rank": 17,
      "entries": 186,
      "conversionRate": 0.16129032258064516,
      "topCuts": 30,
      "winRate": 0.1888772298006296,
      "metaShare": 0.010601915184678522
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "card_advantage",
      "counter_combo",
      "creature_loop",
      "creature_tutors",
      "graveyard_loop",
      "graveyard_value",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "proactive_disruption",
      "resilient_gameplan",
      "solid_conversion",
      "stax_grind",
      "stax_piece",
      "tax_or_lock",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Ob Nixilis, Captive Kingpin",
    "colorIdentity": "BR",
    "archetypeTags": [
      "Turbo",
      "Storm"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "storm": 4,
      "spellChain": 4,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "black": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderIndependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Ob%20Nixilis%2C%20Captive%20Kingpin",
    "sourceStats": {
      "rank": 18,
      "entries": 172,
      "conversionRate": 0.09302325581395349,
      "topCuts": 16,
      "winRate": 0.16184971098265896,
      "metaShare": 0.00980392156862745
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "fast_mana",
      "high_play_count",
      "ping_combo",
      "proactive_combo",
      "rakdos_turbo",
      "red_breach",
      "storm_combo",
      "turbo_combo"
    ]
  },
  {
    "name": "Malcolm, Keen-Eyed Navigator / Vial Smasher the Fierce",
    "colorIdentity": "UBR",
    "archetypeTags": [
      "Turbo",
      "Midrange"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "black": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderIndependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Malcolm%2C%20Keen-Eyed%20Navigator%20%2F%20Vial%20Smasher%20the%20Fierce",
    "sourceStats": {
      "rank": 19,
      "entries": 160,
      "conversionRate": 0.175,
      "topCuts": 28,
      "winRate": 0.20334928229665072,
      "metaShare": 0.009119927040583675
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "fast_mana",
      "glinthorn_combo",
      "high_play_count",
      "midrange_value",
      "partner_shell",
      "pirate_combo",
      "proactive_combo",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "treasure_engine",
      "turbo_combo"
    ]
  },
  {
    "name": "Winota, Joiner of Forces",
    "colorIdentity": "WR",
    "archetypeTags": [
      "Stax",
      "Aggro"
    ],
    "matchTags": {
      "stax": 3,
      "control": 2,
      "interaction": 2,
      "lateGame": 1,
      "competitive": 1,
      "combat": 3,
      "proactive": 3,
      "speed": 1,
      "simple": 2,
      "fun": 1,
      "white": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Winota%2C%20Joiner%20of%20Forces",
    "sourceStats": {
      "rank": 20,
      "entries": 137,
      "conversionRate": 0.17518248175182483,
      "topCuts": 24,
      "winRate": 0.16568047337278108,
      "metaShare": 0.007808937528499772
    },
    "deckElements": [
      "combat_damage",
      "combat_snowball",
      "creature_pressure",
      "high_play_count",
      "pressure",
      "proactive_combat",
      "proactive_disruption",
      "red_breach",
      "solid_conversion",
      "stax_piece",
      "tax_or_lock",
      "white_silence",
      "white_stax",
      "winota_stax"
    ]
  },
  {
    "name": "Terra, Magical Adept // Esper Terra",
    "colorIdentity": "WUBRG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "red": 2,
      "green": 2,
      "highBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Terra%2C%20Magical%20Adept%20%2F%2F%20Esper%20Terra",
    "sourceStats": {
      "rank": 21,
      "entries": 131,
      "conversionRate": 0.13740458015267176,
      "topCuts": 18,
      "winRate": 0.15742128935532235,
      "metaShare": 0.007466940264477884
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "five_color_combo",
      "five_color_flexibility",
      "flexible_answers",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "modal_commander",
      "multi_color_goodstuff",
      "red_breach",
      "resilient_gameplan",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Kenrith, the Returned King",
    "colorIdentity": "WUBRG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "red": 2,
      "green": 2,
      "highBudget": 2,
      "competitive": 2,
      "commanderIndependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Kenrith%2C%20the%20Returned%20King",
    "sourceStats": {
      "rank": 22,
      "entries": 130,
      "conversionRate": 0.24615384615384617,
      "topCuts": 32,
      "winRate": 0.21159420289855072,
      "metaShare": 0.007409940720474236
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "dockside_combo",
      "five_color_combo",
      "five_color_flexibility",
      "five_color_goodstuff",
      "flexible_answers",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "multi_color_goodstuff",
      "outlet_commander",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "K'rrik, Son of Yawgmoth",
    "colorIdentity": "B",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "black": 2,
      "budgetFriendly": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/K'rrik%2C%20Son%20of%20Yawgmoth",
    "sourceStats": {
      "rank": 23,
      "entries": 128,
      "conversionRate": 0.1015625,
      "topCuts": 13,
      "winRate": 0.14556962025316456,
      "metaShare": 0.00729594163246694
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "creature_loop",
      "fast_mana",
      "graveyard_value",
      "high_play_count",
      "life_total_resource",
      "mono_black_turbo",
      "proactive_combo",
      "storm_combo",
      "turbo_combo"
    ]
  },
  {
    "name": "Inalla, Archmage Ritualist",
    "colorIdentity": "UBR",
    "archetypeTags": [
      "Turbo",
      "Midrange"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "black": 2,
      "red": 2,
      "complex": 3,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Inalla%2C%20Archmage%20Ritualist",
    "sourceStats": {
      "rank": 24,
      "entries": 127,
      "conversionRate": 0.18110236220472442,
      "topCuts": 23,
      "winRate": 0.19083969465648856,
      "metaShare": 0.007238942088463292
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "fast_mana",
      "high_play_count",
      "midrange_value",
      "one_card_combo",
      "proactive_combo",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "spellseeker_combo",
      "turbo_combo",
      "wizard_combo"
    ]
  },
  {
    "name": "Rowan, Scion of War",
    "colorIdentity": "BR",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "black": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderIndependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Rowan%2C%20Scion%20of%20War",
    "sourceStats": {
      "rank": 25,
      "entries": 124,
      "conversionRate": 0.25806451612903225,
      "topCuts": 32,
      "winRate": 0.2115677321156773,
      "metaShare": 0.007067943456452348
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "fast_mana",
      "high_play_count",
      "life_total_resource",
      "proactive_combo",
      "red_breach",
      "ritual_combo",
      "solid_conversion",
      "storm_combo",
      "turbo_combo"
    ]
  },
  {
    "name": "Glarb, Calamity's Augur",
    "colorIdentity": "UBG",
    "archetypeTags": [
      "Control",
      "Midrange"
    ],
    "matchTags": {
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "complex": 1,
      "value": 2,
      "midrange": 3,
      "flexibility": 2,
      "blue": 2,
      "black": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Glarb%2C%20Calamity's%20Augur",
    "sourceStats": {
      "rank": 26,
      "entries": 119,
      "conversionRate": 0.19327731092436976,
      "topCuts": 23,
      "winRate": 0.16415410385259632,
      "metaShare": 0.006782945736434108
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "control_midrange",
      "control_posture",
      "creature_tutors",
      "green_creature_mana",
      "high_play_count",
      "late_game",
      "midrange_value",
      "resilient_gameplan",
      "stack_interaction",
      "topdeck_value"
    ]
  },
  {
    "name": "Arcum Dagsson",
    "colorIdentity": "U",
    "archetypeTags": [
      "Stax",
      "Control"
    ],
    "matchTags": {
      "stax": 3,
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "competitive": 2,
      "complex": 1,
      "value": 1,
      "blue": 2,
      "budgetFriendly": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Arcum%20Dagsson",
    "sourceStats": {
      "rank": 27,
      "entries": 117,
      "conversionRate": 0.2564102564102564,
      "topCuts": 30,
      "winRate": 0.2523961661341853,
      "metaShare": 0.0066689466484268125
    },
    "deckElements": [
      "artifact_combo",
      "artifact_tutor",
      "blue_stack_interaction",
      "card_selection",
      "control_posture",
      "high_conversion",
      "high_play_count",
      "late_game",
      "prison_combo",
      "proactive_disruption",
      "stack_interaction",
      "stax_piece",
      "tax_or_lock"
    ]
  },
  {
    "name": "Zirda, the Dawnwaker",
    "colorIdentity": "WR",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "white": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Zirda%2C%20the%20Dawnwaker",
    "sourceStats": {
      "rank": 28,
      "entries": 115,
      "conversionRate": 0.2,
      "topCuts": 23,
      "winRate": 0.20882852292020374,
      "metaShare": 0.0065549475604195166
    },
    "deckElements": [
      "fast_mana",
      "high_play_count",
      "proactive_combo",
      "red_breach",
      "solid_conversion",
      "turbo_combo",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Thrasios, Triton Hero / Vial Smasher the Fierce",
    "colorIdentity": "UBRG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "black": 2,
      "red": 2,
      "green": 2,
      "complex": 2,
      "highBudget": 2,
      "competitive": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Thrasios%2C%20Triton%20Hero%20%2F%20Vial%20Smasher%20the%20Fierce",
    "sourceStats": {
      "rank": 29,
      "entries": 104,
      "conversionRate": 0.2980769230769231,
      "topCuts": 31,
      "winRate": 0.22956521739130434,
      "metaShare": 0.005927952576379389
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "creature_tutors",
      "flexible_answers",
      "green_creature_mana",
      "high_play_count",
      "infinite_mana_sink",
      "midrange_value",
      "multi_color_goodstuff",
      "partner_shell",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "thrasios_outlet"
    ]
  },
  {
    "name": "Derevi, Empyrial Tactician",
    "colorIdentity": "WUG",
    "archetypeTags": [
      "Stax",
      "Midrange"
    ],
    "matchTags": {
      "stax": 3,
      "control": 2,
      "interaction": 2,
      "lateGame": 1,
      "competitive": 1,
      "midrange": 3,
      "value": 2,
      "flexibility": 2,
      "white": 2,
      "blue": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Derevi%2C%20Empyrial%20Tactician",
    "sourceStats": {
      "rank": 30,
      "entries": 101,
      "conversionRate": 0.1782178217821782,
      "topCuts": 18,
      "winRate": 0.16895874263261296,
      "metaShare": 0.005756953944368445
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "proactive_disruption",
      "resilient_gameplan",
      "stax_piece",
      "tax_or_lock",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Aang, at the Crossroads // Aang, Destined Savior",
    "colorIdentity": "WUG",
    "archetypeTags": [
      "Aggro",
      "Midrange"
    ],
    "matchTags": {
      "combat": 3,
      "proactive": 3,
      "speed": 1,
      "simple": 1,
      "fun": 1,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Aang%2C%20at%20the%20Crossroads%20%2F%2F%20Aang%2C%20Destined%20Savior",
    "sourceStats": {
      "rank": 32,
      "entries": 98,
      "conversionRate": 0.1326530612244898,
      "topCuts": 13,
      "winRate": 0.19230769230769232,
      "metaShare": 0.005585955312357501
    },
    "deckElements": [
      "blink_value",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "combat_damage",
      "creature_combo",
      "creature_tutors",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "modal_commander",
      "pressure",
      "proactive_combat",
      "resilient_gameplan",
      "solid_conversion",
      "value_engine",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Rocco, Cabaretti Caterer",
    "colorIdentity": "WRG",
    "archetypeTags": [
      "Stax",
      "Midrange"
    ],
    "matchTags": {
      "stax": 3,
      "control": 2,
      "interaction": 2,
      "lateGame": 1,
      "competitive": 2,
      "midrange": 3,
      "value": 2,
      "flexibility": 2,
      "white": 2,
      "red": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Rocco%2C%20Cabaretti%20Caterer",
    "sourceStats": {
      "rank": 33,
      "entries": 98,
      "conversionRate": 0.1836734693877551,
      "topCuts": 18,
      "winRate": 0.21875,
      "metaShare": 0.005585955312357501
    },
    "deckElements": [
      "card_advantage",
      "creature_combo",
      "creature_tutors",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "proactive_disruption",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "stax_combo",
      "stax_piece",
      "tax_or_lock",
      "toolbox_tutor",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Yuriko, the Tiger's Shadow",
    "colorIdentity": "UB",
    "archetypeTags": [
      "Aggro"
    ],
    "matchTags": {
      "combat": 3,
      "damagePressure": 5,
      "proactive": 3,
      "speed": 1,
      "simple": 1,
      "fun": 1,
      "blue": 2,
      "black": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Yuriko%2C%20the%20Tiger's%20Shadow",
    "sourceStats": {
      "rank": 34,
      "entries": 97,
      "conversionRate": 0.07216494845360824,
      "topCuts": 7,
      "winRate": 0.11063829787234042,
      "metaShare": 0.005528955768353853
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_selection",
      "combat_damage",
      "high_play_count",
      "ninja_combat",
      "pressure",
      "proactive_combat",
      "tempo_control",
      "topdeck_damage"
    ]
  },
  {
    "name": "Brigid, Clachan's Heart // Brigid, Doun's Mind",
    "colorIdentity": "WG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "green": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Brigid%2C%20Clachan's%20Heart%20%2F%2F%20Brigid%2C%20Doun's%20Mind",
    "sourceStats": {
      "rank": 35,
      "entries": 96,
      "conversionRate": 0.20833333333333334,
      "topCuts": 20,
      "winRate": 0.22699386503067484,
      "metaShare": 0.005471956224350205
    },
    "deckElements": [
      "card_advantage",
      "creature_tutors",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "modal_commander",
      "resilient_gameplan",
      "solid_conversion",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Marneus Calgar",
    "colorIdentity": "WUB",
    "archetypeTags": [
      "Control",
      "Midrange"
    ],
    "matchTags": {
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "complex": 1,
      "value": 2,
      "midrange": 3,
      "flexibility": 2,
      "white": 2,
      "blue": 2,
      "black": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Marneus%20Calgar",
    "sourceStats": {
      "rank": 36,
      "entries": 93,
      "conversionRate": 0.11827956989247312,
      "topCuts": 11,
      "winRate": 0.14132762312633834,
      "metaShare": 0.005300957592339261
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "control_posture",
      "high_play_count",
      "late_game",
      "midrange_value",
      "resilient_gameplan",
      "stack_interaction",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Atraxa, Grand Unifier",
    "colorIdentity": "WUBG",
    "archetypeTags": [
      "Control",
      "Midrange"
    ],
    "matchTags": {
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "complex": 1,
      "value": 2,
      "midrange": 3,
      "flexibility": 2,
      "white": 2,
      "blue": 2,
      "black": 2,
      "green": 2,
      "highBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Atraxa%2C%20Grand%20Unifier",
    "sourceStats": {
      "rank": 37,
      "entries": 84,
      "conversionRate": 0.15476190476190477,
      "topCuts": 13,
      "winRate": 0.19451371571072318,
      "metaShare": 0.0047879616963064295
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "control_posture",
      "creature_tutors",
      "flexible_answers",
      "green_creature_mana",
      "high_play_count",
      "late_game",
      "midrange_value",
      "multi_color_goodstuff",
      "resilient_gameplan",
      "solid_conversion",
      "stack_interaction",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Tevesh Szat, Doom of Fools / Thrasios, Triton Hero",
    "colorIdentity": "UBG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "black": 2,
      "green": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Tevesh%20Szat%2C%20Doom%20of%20Fools%20%2F%20Thrasios%2C%20Triton%20Hero",
    "sourceStats": {
      "rank": 38,
      "entries": 73,
      "conversionRate": 0.1643835616438356,
      "topCuts": 12,
      "winRate": 0.17962466487935658,
      "metaShare": 0.004160966712266302
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "creature_tutors",
      "green_creature_mana",
      "high_play_count",
      "infinite_mana_sink",
      "midrange_value",
      "partner_shell",
      "resilient_gameplan",
      "solid_conversion",
      "thrasios_outlet"
    ]
  },
  {
    "name": "Stella Lee, Wild Card",
    "colorIdentity": "UR",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "blue": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Stella%20Lee%2C%20Wild%20Card",
    "sourceStats": {
      "rank": 39,
      "entries": 70,
      "conversionRate": 0.17142857142857143,
      "topCuts": 12,
      "winRate": 0.17613636363636365,
      "metaShare": 0.003989968080255358
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_selection",
      "fast_mana",
      "high_play_count",
      "proactive_combo",
      "red_breach",
      "solid_conversion",
      "turbo_combo"
    ]
  },
  {
    "name": "Urza, Lord High Artificer",
    "colorIdentity": "U",
    "archetypeTags": [
      "Stax",
      "Control"
    ],
    "matchTags": {
      "stax": 3,
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "competitive": 1,
      "complex": 1,
      "value": 1,
      "blue": 2,
      "budgetFriendly": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Urza%2C%20Lord%20High%20Artificer",
    "sourceStats": {
      "rank": 40,
      "entries": 67,
      "conversionRate": 0.11940298507462686,
      "topCuts": 8,
      "winRate": 0.12844036697247707,
      "metaShare": 0.003818969448244414
    },
    "deckElements": [
      "artifact_combo",
      "blue_stack_interaction",
      "card_selection",
      "control_posture",
      "high_play_count",
      "late_game",
      "low_conversion",
      "proactive_disruption",
      "stack_interaction",
      "stax_piece",
      "tax_or_lock"
    ]
  },
  {
    "name": "Najeela, the Blade-Blossom",
    "colorIdentity": "WUBRG",
    "archetypeTags": [
      "Aggro",
      "Midrange"
    ],
    "matchTags": {
      "combat": 4,
      "damagePressure": 2,
      "combo": 2,
      "proactive": 3,
      "speed": 1,
      "simple": 2,
      "fun": 1,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "red": 2,
      "green": 2,
      "highBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Najeela%2C%20the%20Blade-Blossom",
    "sourceStats": {
      "rank": 41,
      "entries": 65,
      "conversionRate": 0.09230769230769231,
      "topCuts": 6,
      "winRate": 0.15548780487804878,
      "metaShare": 0.003704970360237118
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "combat_combo",
      "combat_damage",
      "creature_tutors",
      "five_color_combo",
      "five_color_flexibility",
      "flexible_answers",
      "extra_combat",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "multi_color_goodstuff",
      "one_card_combo",
      "pressure",
      "proactive_combat",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Norman Osborn // Green Goblin",
    "colorIdentity": "UBR",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "black": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Norman%20Osborn%20%2F%2F%20Green%20Goblin",
    "sourceStats": {
      "rank": 42,
      "entries": 64,
      "conversionRate": 0.109375,
      "topCuts": 7,
      "winRate": 0.11301369863013698,
      "metaShare": 0.00364797081623347
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "high_play_count",
      "midrange_value",
      "modal_commander",
      "red_breach",
      "resilient_gameplan"
    ]
  },
  {
    "name": "Krark, the Thumbless / Sakashima of a Thousand Faces",
    "colorIdentity": "UR",
    "archetypeTags": [
      "Turbo",
      "Storm"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "storm": 4,
      "spellChain": 4,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "blue": 2,
      "red": 2,
      "complex": 3,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Krark%2C%20the%20Thumbless%20%2F%20Sakashima%20of%20a%20Thousand%20Faces",
    "sourceStats": {
      "rank": 43,
      "entries": 59,
      "conversionRate": 0.2033898305084746,
      "topCuts": 12,
      "winRate": 0.1779935275080906,
      "metaShare": 0.0033629730962152302
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_selection",
      "commander_card_advantage",
      "coin_flip_engine",
      "copy_spells",
      "fast_mana",
      "medium_play_count",
      "partner_shell",
      "proactive_combo",
      "red_breach",
      "rituals",
      "spellslinger",
      "storm_combo",
      "turbo_combo"
    ]
  },
  {
    "name": "The Cabbage Merchant",
    "colorIdentity": "G",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "green": 2,
      "budgetFriendly": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/The%20Cabbage%20Merchant",
    "sourceStats": {
      "rank": 44,
      "entries": 58,
      "conversionRate": 0.27586206896551724,
      "topCuts": 16,
      "winRate": 0.25249169435215946,
      "metaShare": 0.0033059735522115823
    },
    "deckElements": [
      "card_advantage",
      "creature_tutors",
      "green_creature_mana",
      "high_conversion",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan"
    ]
  },
  {
    "name": "The Gitrog Monster",
    "colorIdentity": "BG",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "black": 2,
      "green": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/The%20Gitrog%20Monster",
    "sourceStats": {
      "rank": 45,
      "entries": 58,
      "conversionRate": 0.1724137931034483,
      "topCuts": 10,
      "winRate": 0.17406143344709898,
      "metaShare": 0.0033059735522115823
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "creature_tutors",
      "fast_mana",
      "green_creature_mana",
      "high_play_count",
      "proactive_combo",
      "turbo_combo"
    ]
  },
  {
    "name": "Scion of the Ur-Dragon",
    "colorIdentity": "WUBRG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "red": 2,
      "green": 2,
      "highBudget": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Scion%20of%20the%20Ur-Dragon",
    "sourceStats": {
      "rank": 46,
      "entries": 56,
      "conversionRate": 0.2857142857142857,
      "topCuts": 16,
      "winRate": 0.2108843537414966,
      "metaShare": 0.0031919744642042863
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "five_color_combo",
      "five_color_flexibility",
      "flexible_answers",
      "green_creature_mana",
      "high_conversion",
      "medium_play_count",
      "midrange_value",
      "multi_color_goodstuff",
      "red_breach",
      "resilient_gameplan",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Bjorna, Nightfall Alchemist / Wernog, Rider's Chaplain",
    "colorIdentity": "WUBR",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "red": 2,
      "highBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Bjorna%2C%20Nightfall%20Alchemist%20%2F%20Wernog%2C%20Rider's%20Chaplain",
    "sourceStats": {
      "rank": 47,
      "entries": 56,
      "conversionRate": 0.125,
      "topCuts": 7,
      "winRate": 0.15873015873015872,
      "metaShare": 0.0031919744642042863
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "flexible_answers",
      "medium_play_count",
      "midrange_value",
      "multi_color_goodstuff",
      "partner_shell",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Malcolm, Keen-Eyed Navigator / Tymna the Weaver",
    "colorIdentity": "WUB",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderIndependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Malcolm%2C%20Keen-Eyed%20Navigator%20%2F%20Tymna%20the%20Weaver",
    "sourceStats": {
      "rank": 48,
      "entries": 55,
      "conversionRate": 0.18181818181818182,
      "topCuts": 10,
      "winRate": 0.16906474820143885,
      "metaShare": 0.0031349749202006384
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "combat_draw",
      "commander_card_advantage",
      "farm_value",
      "glinthorn_combo",
      "high_play_count",
      "midrange_value",
      "partner_shell",
      "pirate_combo",
      "resilient_gameplan",
      "solid_conversion",
      "treasure_engine",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Dihada, Binder of Wills",
    "colorIdentity": "WBR",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "black": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Dihada%2C%20Binder%20of%20Wills",
    "sourceStats": {
      "rank": 49,
      "entries": 54,
      "conversionRate": 0.2037037037037037,
      "topCuts": 11,
      "winRate": 0.183206106870229,
      "metaShare": 0.0030779753761969904
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "card_advantage",
      "high_play_count",
      "midrange_value",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Malcolm, Keen-Eyed Navigator / Tana, the Bloodsower",
    "colorIdentity": "URG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "red": 2,
      "green": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Malcolm%2C%20Keen-Eyed%20Navigator%20%2F%20Tana%2C%20the%20Bloodsower",
    "sourceStats": {
      "rank": 50,
      "entries": 53,
      "conversionRate": 0.20754716981132076,
      "topCuts": 11,
      "winRate": 0.19696969696969696,
      "metaShare": 0.0030209758321933424
    },
    "deckElements": [
      "blue_stack_interaction",
      "board_engine",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "creature_combo",
      "creature_tutors",
      "glinthorn_combo",
      "green_creature_mana",
      "high_conversion",
      "high_play_count",
      "midrange_value",
      "partner_shell",
      "pirate_combo",
      "red_breach",
      "resilient_gameplan",
      "treasure_engine"
    ]
  },
  {
    "name": "Gwenom, Remorseless",
    "colorIdentity": "B",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "black": 2,
      "budgetFriendly": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Gwenom%2C%20Remorseless",
    "sourceStats": {
      "rank": 51,
      "entries": 52,
      "conversionRate": 0.3076923076923077,
      "topCuts": 16,
      "winRate": 0.2454212454212454,
      "metaShare": 0.0029639762881896944
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "card_advantage",
      "high_conversion",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan"
    ]
  },
  {
    "name": "Kediss, Emberclaw Familiar / Malcolm, Keen-Eyed Navigator",
    "colorIdentity": "UR",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Kediss%2C%20Emberclaw%20Familiar%20%2F%20Malcolm%2C%20Keen-Eyed%20Navigator",
    "sourceStats": {
      "rank": 52,
      "entries": 51,
      "conversionRate": 0.19607843137254902,
      "topCuts": 10,
      "winRate": 0.20152091254752852,
      "metaShare": 0.0029069767441860465
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "glinthorn_combo",
      "medium_play_count",
      "midrange_value",
      "partner_shell",
      "pirate_combo",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "treasure_engine"
    ]
  },
  {
    "name": "Maralen, Fae Ascendant",
    "colorIdentity": "UBG",
    "archetypeTags": [
      "Turbo",
      "Midrange"
    ],
    "matchTags": {
      "combo": 3,
      "speed": 2,
      "proactive": 1,
      "consistency": 2,
      "midrange": 1,
      "value": 1,
      "complex": 2,
      "competitive": 1,
      "black": 2,
      "blue": 1,
      "green": 1,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Maralen%2C%20Fae%20Ascendant",
    "sourceStats": {
      "rank": 53,
      "entries": 49,
      "conversionRate": 0.10204081632653061,
      "topCuts": 5,
      "winRate": 0.12396694214876033,
      "metaShare": 0.0027929776561787505
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "exile_cast",
      "fast_mana",
      "food_chain",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "proactive_combo",
      "resilient_gameplan",
      "sultai_etali",
      "turbo_combo"
    ]
  },
  {
    "name": "Korvold, Fae-Cursed King",
    "colorIdentity": "BRG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "black": 2,
      "red": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Korvold%2C%20Fae-Cursed%20King",
    "sourceStats": {
      "rank": 54,
      "entries": 49,
      "conversionRate": 0.12244897959183673,
      "topCuts": 6,
      "winRate": 0.13253012048192772,
      "metaShare": 0.0027929776561787505
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "card_advantage",
      "creature_tutors",
      "green_creature_mana",
      "high_play_count",
      "midrange_value",
      "red_breach",
      "resilient_gameplan",
      "sacrifice_value",
      "treasure_engine"
    ]
  },
  {
    "name": "Heliod, the Radiant Dawn // Heliod, the Warped Eclipse",
    "colorIdentity": "WU",
    "archetypeTags": [
      "Stax",
      "Control"
    ],
    "matchTags": {
      "stax": 3,
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "competitive": 2,
      "complex": 1,
      "value": 1,
      "white": 2,
      "blue": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Heliod%2C%20the%20Radiant%20Dawn%20%2F%2F%20Heliod%2C%20the%20Warped%20Eclipse",
    "sourceStats": {
      "rank": 55,
      "entries": 49,
      "conversionRate": 0.1836734693877551,
      "topCuts": 9,
      "winRate": 0.216,
      "metaShare": 0.0027929776561787505
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_selection",
      "control_posture",
      "enchantment_engine",
      "high_conversion",
      "late_game",
      "medium_play_count",
      "modal_commander",
      "proactive_disruption",
      "stack_interaction",
      "stax_piece",
      "tax_or_lock",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Akiri, Line-Slinger / Thrasios, Triton Hero",
    "colorIdentity": "WURG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "red": 2,
      "green": 2,
      "complex": 2,
      "highBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Akiri%2C%20Line-Slinger%20%2F%20Thrasios%2C%20Triton%20Hero",
    "sourceStats": {
      "rank": 56,
      "entries": 47,
      "conversionRate": 0.1276595744680851,
      "topCuts": 6,
      "winRate": 0.15517241379310345,
      "metaShare": 0.0026789785681714546
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "creature_tutors",
      "flexible_answers",
      "green_creature_mana",
      "infinite_mana_sink",
      "medium_play_count",
      "midrange_value",
      "multi_color_goodstuff",
      "partner_shell",
      "red_breach",
      "resilient_gameplan",
      "thrasios_outlet",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Rakdos, the Muscle",
    "colorIdentity": "BR",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "black": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Rakdos%2C%20the%20Muscle",
    "sourceStats": {
      "rank": 57,
      "entries": 47,
      "conversionRate": 0.1276595744680851,
      "topCuts": 6,
      "winRate": 0.1581196581196581,
      "metaShare": 0.0026789785681714546
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "card_advantage",
      "medium_play_count",
      "midrange_value",
      "red_breach",
      "resilient_gameplan"
    ]
  },
  {
    "name": "Zhulodok, Void Gorger",
    "colorIdentity": "C",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "budgetFriendly": 2,
      "colorless": 4,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Zhulodok%2C%20Void%20Gorger",
    "sourceStats": {
      "rank": 58,
      "entries": 47,
      "conversionRate": 0.10638297872340426,
      "topCuts": 5,
      "winRate": 0.1415929203539823,
      "metaShare": 0.0026789785681714546
    },
    "deckElements": [
      "artifact_mana",
      "card_advantage",
      "colorless_artifacts",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan"
    ]
  },
  {
    "name": "Raph & Mikey, Troublemakers",
    "colorIdentity": "RG",
    "archetypeTags": [
      "Aggro"
    ],
    "matchTags": {
      "combat": 4,
      "damagePressure": 2,
      "combo": 2,
      "proactive": 3,
      "speed": 1,
      "simple": 1,
      "fun": 1,
      "red": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Raph%20%26%20Mikey%2C%20Troublemakers",
    "sourceStats": {
      "rank": 61,
      "entries": 42,
      "conversionRate": 0.023809523809523808,
      "topCuts": 1,
      "winRate": 0.14646464646464646,
      "metaShare": 0.0023939808481532147
    },
    "deckElements": [
      "combat_damage",
      "creature_tutors",
      "green_creature_mana",
      "medium_play_count",
      "pressure",
      "proactive_combat",
      "red_breach"
    ]
  },
  {
    "name": "Elsha of the Infinite",
    "colorIdentity": "WUR",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "red": 2,
      "complex": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Elsha%20of%20the%20Infinite",
    "sourceStats": {
      "rank": 62,
      "entries": 42,
      "conversionRate": 0.14285714285714285,
      "topCuts": 6,
      "winRate": 0.20833333333333334,
      "metaShare": 0.0023939808481532147
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "medium_play_count",
      "midrange_value",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "spellslinger",
      "storm_combo",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Leonardo, the Balance / Michelangelo, the Heart",
    "colorIdentity": "WUBRG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "red": 2,
      "green": 2,
      "highBudget": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Leonardo%2C%20the%20Balance%20%2F%20Michelangelo%2C%20the%20Heart",
    "sourceStats": {
      "rank": 63,
      "entries": 41,
      "conversionRate": 0.2926829268292683,
      "topCuts": 12,
      "winRate": 0.228310502283105,
      "metaShare": 0.0023369813041495668
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "commander_card_advantage",
      "creature_tutors",
      "five_color_combo",
      "five_color_flexibility",
      "flexible_answers",
      "green_creature_mana",
      "medium_play_count",
      "midrange_value",
      "multi_color_goodstuff",
      "partner_shell",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Shorikai, Genesis Engine",
    "colorIdentity": "WU",
    "archetypeTags": [
      "Stax",
      "Control"
    ],
    "matchTags": {
      "stax": 3,
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "competitive": 1,
      "complex": 1,
      "value": 1,
      "white": 2,
      "blue": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Shorikai%2C%20Genesis%20Engine",
    "sourceStats": {
      "rank": 64,
      "entries": 38,
      "conversionRate": 0.07894736842105263,
      "topCuts": 3,
      "winRate": 0.1443850267379679,
      "metaShare": 0.002165982672138623
    },
    "deckElements": [
      "artifact_combo",
      "blue_stack_interaction",
      "card_selection",
      "control_posture",
      "late_game",
      "medium_play_count",
      "proactive_disruption",
      "stack_interaction",
      "stax_piece",
      "tax_or_lock",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Jhoira, Ageless Innovator",
    "colorIdentity": "UR",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "blue": 2,
      "red": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Jhoira%2C%20Ageless%20Innovator",
    "sourceStats": {
      "rank": 65,
      "entries": 38,
      "conversionRate": 0.18421052631578946,
      "topCuts": 7,
      "winRate": 0.19791666666666666,
      "metaShare": 0.002165982672138623
    },
    "deckElements": [
      "artifact_combo",
      "blue_stack_interaction",
      "card_selection",
      "fast_mana",
      "high_conversion",
      "medium_play_count",
      "proactive_combo",
      "red_breach",
      "turbo_combo"
    ]
  },
  {
    "name": "Y'shtola, Night's Blessed",
    "colorIdentity": "WUB",
    "archetypeTags": [
      "Control",
      "Midrange"
    ],
    "matchTags": {
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "complex": 1,
      "value": 2,
      "midrange": 3,
      "flexibility": 2,
      "white": 2,
      "blue": 2,
      "black": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Y'shtola%2C%20Night's%20Blessed",
    "sourceStats": {
      "rank": 66,
      "entries": 37,
      "conversionRate": 0,
      "topCuts": 0,
      "winRate": 0.12290502793296089,
      "metaShare": 0.002108983128134975
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "control_posture",
      "late_game",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan",
      "stack_interaction",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Talion, the Kindly Lord",
    "colorIdentity": "UB",
    "archetypeTags": [
      "Control"
    ],
    "matchTags": {
      "control": 3,
      "combat": 1,
      "damagePressure": 2,
      "interaction": 3,
      "lateGame": 2,
      "complex": 1,
      "value": 2,
      "blue": 2,
      "black": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Talion%2C%20the%20Kindly%20Lord",
    "sourceStats": {
      "rank": 69,
      "entries": 35,
      "conversionRate": 0.08571428571428572,
      "topCuts": 3,
      "winRate": 0.12359550561797752,
      "metaShare": 0.001994984040127679
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_selection",
      "commander_card_advantage",
      "control_posture",
      "late_game",
      "low_conversion",
      "medium_play_count",
      "stack_interaction"
    ]
  },
  {
    "name": "Niv-Mizzet, Parun",
    "colorIdentity": "UR",
    "archetypeTags": [
      "Control"
    ],
    "matchTags": {
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "complex": 1,
      "value": 1,
      "blue": 2,
      "red": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Niv-Mizzet%2C%20Parun",
    "sourceStats": {
      "rank": 70,
      "entries": 34,
      "conversionRate": 0.29411764705882354,
      "topCuts": 10,
      "winRate": 0.2215909090909091,
      "metaShare": 0.001937984496124031
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_selection",
      "control_posture",
      "high_conversion",
      "late_game",
      "medium_play_count",
      "red_breach",
      "spellslinger",
      "stack_interaction",
      "storm_combo"
    ]
  },
  {
    "name": "Tasigur, the Golden Fang",
    "colorIdentity": "UBG",
    "archetypeTags": [
      "Control",
      "Midrange"
    ],
    "matchTags": {
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "complex": 2,
      "value": 2,
      "midrange": 3,
      "flexibility": 2,
      "blue": 2,
      "black": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderIndependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Tasigur%2C%20the%20Golden%20Fang",
    "sourceStats": {
      "rank": 71,
      "entries": 33,
      "conversionRate": 0.18181818181818182,
      "topCuts": 6,
      "winRate": 0.1488095238095238,
      "metaShare": 0.001880984952120383
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "control_posture",
      "creature_tutors",
      "green_creature_mana",
      "late_game",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan",
      "stack_interaction"
    ]
  },
  {
    "name": "Halana, Kessig Ranger / Tymna the Weaver",
    "colorIdentity": "WBG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "black": 2,
      "green": 2,
      "complex": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Halana%2C%20Kessig%20Ranger%20%2F%20Tymna%20the%20Weaver",
    "sourceStats": {
      "rank": 72,
      "entries": 32,
      "conversionRate": 0.1875,
      "topCuts": 6,
      "winRate": 0.24705882352941178,
      "metaShare": 0.001823985408116735
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "card_advantage",
      "combat_draw",
      "commander_card_advantage",
      "creature_tutors",
      "farm_value",
      "green_creature_mana",
      "high_conversion",
      "medium_play_count",
      "midrange_value",
      "partner_shell",
      "resilient_gameplan",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Gyruda, Doom of Depths",
    "colorIdentity": "UB",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "blue": 2,
      "black": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Gyruda%2C%20Doom%20of%20Depths",
    "sourceStats": {
      "rank": 73,
      "entries": 32,
      "conversionRate": 0.3125,
      "topCuts": 10,
      "winRate": 0.20625,
      "metaShare": 0.001823985408116735
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_selection",
      "fast_mana",
      "medium_play_count",
      "proactive_combo",
      "solid_conversion",
      "turbo_combo"
    ]
  },
  {
    "name": "Ashling, the Limitless",
    "colorIdentity": "WUBRG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "red": 2,
      "green": 2,
      "highBudget": 2,
      "commanderIndependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Ashling%2C%20the%20Limitless",
    "sourceStats": {
      "rank": 74,
      "entries": 30,
      "conversionRate": 0.06666666666666667,
      "topCuts": 2,
      "winRate": 0.11188811188811189,
      "metaShare": 0.001709986320109439
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "five_color_combo",
      "five_color_flexibility",
      "flexible_answers",
      "green_creature_mana",
      "medium_play_count",
      "midrange_value",
      "multi_color_goodstuff",
      "red_breach",
      "resilient_gameplan",
      "spellslinger",
      "storm_combo",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Animar, Soul of Elements",
    "colorIdentity": "URG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "red": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Animar%2C%20Soul%20of%20Elements",
    "sourceStats": {
      "rank": 78,
      "entries": 27,
      "conversionRate": 0.2222222222222222,
      "topCuts": 6,
      "winRate": 0.2158273381294964,
      "metaShare": 0.0015389876880984952
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "green_creature_mana",
      "medium_play_count",
      "midrange_value",
      "red_breach",
      "resilient_gameplan"
    ]
  },
  {
    "name": "Celes, Rune Knight",
    "colorIdentity": "WBR",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "black": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Celes%2C%20Rune%20Knight",
    "sourceStats": {
      "rank": 79,
      "entries": 27,
      "conversionRate": 0.07407407407407407,
      "topCuts": 2,
      "winRate": 0.15873015873015872,
      "metaShare": 0.0015389876880984952
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "card_advantage",
      "medium_play_count",
      "midrange_value",
      "red_breach",
      "resilient_gameplan",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Chatterfang, Squirrel General",
    "colorIdentity": "BG",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "black": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Chatterfang%2C%20Squirrel%20General",
    "sourceStats": {
      "rank": 80,
      "entries": 27,
      "conversionRate": 0.18518518518518517,
      "topCuts": 5,
      "winRate": 0.1693548387096774,
      "metaShare": 0.0015389876880984952
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "creature_tutors",
      "fast_mana",
      "green_creature_mana",
      "medium_play_count",
      "proactive_combo",
      "turbo_combo"
    ]
  },
  {
    "name": "The Master of Keys",
    "colorIdentity": "WUB",
    "archetypeTags": [
      "Control",
      "Midrange"
    ],
    "matchTags": {
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "complex": 1,
      "value": 2,
      "midrange": 3,
      "flexibility": 2,
      "white": 2,
      "blue": 2,
      "black": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/The%20Master%20of%20Keys",
    "sourceStats": {
      "rank": 81,
      "entries": 26,
      "conversionRate": 0.2692307692307692,
      "topCuts": 7,
      "winRate": 0.2028985507246377,
      "metaShare": 0.0014819881440948472
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "control_posture",
      "late_game",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan",
      "solid_conversion",
      "stack_interaction",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Nissa, Resurgent Animist",
    "colorIdentity": "G",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "green": 2,
      "budgetFriendly": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Nissa%2C%20Resurgent%20Animist",
    "sourceStats": {
      "rank": 82,
      "entries": 25,
      "conversionRate": 0.2,
      "topCuts": 5,
      "winRate": 0.14754098360655737,
      "metaShare": 0.0014249886000911993
    },
    "deckElements": [
      "card_advantage",
      "creature_combo",
      "creature_tutors",
      "green_creature_mana",
      "green_mana_engine",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan",
      "solid_conversion"
    ]
  },
  {
    "name": "Narset, Enlightened Master",
    "colorIdentity": "WUR",
    "archetypeTags": [
      "Control",
      "Midrange"
    ],
    "matchTags": {
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "complex": 1,
      "value": 2,
      "midrange": 3,
      "flexibility": 2,
      "white": 2,
      "blue": 2,
      "red": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Narset%2C%20Enlightened%20Master",
    "sourceStats": {
      "rank": 83,
      "entries": 25,
      "conversionRate": 0.28,
      "topCuts": 7,
      "winRate": 0.20634920634920634,
      "metaShare": 0.0014249886000911993
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "control_posture",
      "high_conversion",
      "late_game",
      "medium_play_count",
      "midrange_value",
      "red_breach",
      "resilient_gameplan",
      "stack_interaction",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Iron Man, Titan of Innovation",
    "colorIdentity": "UR",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "red": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Iron%20Man%2C%20Titan%20of%20Innovation",
    "sourceStats": {
      "rank": 84,
      "entries": 24,
      "conversionRate": 0.125,
      "topCuts": 3,
      "winRate": 0.21052631578947367,
      "metaShare": 0.0013679890560875513
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "medium_play_count",
      "midrange_value",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion"
    ]
  },
  {
    "name": "Baylen, the Haymaker",
    "colorIdentity": "WRG",
    "archetypeTags": [
      "Aggro",
      "Midrange"
    ],
    "matchTags": {
      "combat": 3,
      "proactive": 3,
      "speed": 1,
      "simple": 2,
      "fun": 1,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "red": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Baylen%2C%20the%20Haymaker",
    "sourceStats": {
      "rank": 85,
      "entries": 24,
      "conversionRate": 0.125,
      "topCuts": 3,
      "winRate": 0.13675213675213677,
      "metaShare": 0.0013679890560875513
    },
    "deckElements": [
      "card_advantage",
      "combat_damage",
      "creature_tutors",
      "green_creature_mana",
      "medium_play_count",
      "midrange_value",
      "pressure",
      "proactive_combat",
      "red_breach",
      "resilient_gameplan",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Avatar Aang // Aang, Master of Elements",
    "colorIdentity": "WUBRG",
    "archetypeTags": [
      "Aggro",
      "Midrange"
    ],
    "matchTags": {
      "combat": 3,
      "proactive": 3,
      "speed": 1,
      "simple": 1,
      "fun": 1,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "red": 2,
      "green": 2,
      "highBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Avatar%20Aang%20%2F%2F%20Aang%2C%20Master%20of%20Elements",
    "sourceStats": {
      "rank": 87,
      "entries": 22,
      "conversionRate": 0.22727272727272727,
      "topCuts": 5,
      "winRate": 0.21367521367521367,
      "metaShare": 0.0012539899680802553
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "combat_damage",
      "creature_tutors",
      "five_color_combo",
      "five_color_flexibility",
      "flexible_answers",
      "green_creature_mana",
      "medium_play_count",
      "midrange_value",
      "modal_commander",
      "multi_color_goodstuff",
      "pressure",
      "proactive_combat",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Kaalia of the Vast",
    "colorIdentity": "WBR",
    "archetypeTags": [
      "Aggro",
      "Midrange"
    ],
    "matchTags": {
      "combat": 3,
      "proactive": 3,
      "speed": 1,
      "simple": 2,
      "fun": 1,
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "black": 2,
      "red": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Kaalia%20of%20the%20Vast",
    "sourceStats": {
      "rank": 88,
      "entries": 22,
      "conversionRate": 0.13636363636363635,
      "topCuts": 3,
      "winRate": 0.19130434782608696,
      "metaShare": 0.0012539899680802553
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "card_advantage",
      "combat_damage",
      "medium_play_count",
      "midrange_value",
      "pressure",
      "proactive_combat",
      "red_breach",
      "resilient_gameplan",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Yisan, the Wanderer Bard",
    "colorIdentity": "G",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "green": 2,
      "budgetFriendly": 2,
      "competitive": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Yisan%2C%20the%20Wanderer%20Bard",
    "sourceStats": {
      "rank": 89,
      "entries": 21,
      "conversionRate": 0.2857142857142857,
      "topCuts": 6,
      "winRate": 0.23711340206185566,
      "metaShare": 0.0011969904240766074
    },
    "deckElements": [
      "card_advantage",
      "creature_tutors",
      "green_creature_mana",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan",
      "solid_conversion"
    ]
  },
  {
    "name": "Hashaton, Scarab's Fist",
    "colorIdentity": "WUB",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "black": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Hashaton%2C%20Scarab's%20Fist",
    "sourceStats": {
      "rank": 90,
      "entries": 21,
      "conversionRate": 0.14285714285714285,
      "topCuts": 3,
      "winRate": 0.13861386138613863,
      "metaShare": 0.0011969904240766074
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Selvala, Explorer Returned",
    "colorIdentity": "WG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "green": 2,
      "simple": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Selvala%2C%20Explorer%20Returned",
    "sourceStats": {
      "rank": 91,
      "entries": 20,
      "conversionRate": 0.15,
      "topCuts": 3,
      "winRate": 0.1414141414141414,
      "metaShare": 0.0011399908800729594
    },
    "deckElements": [
      "card_advantage",
      "creature_combo",
      "creature_tutors",
      "green_creature_mana",
      "green_mana_engine",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Lotho, Corrupt Shirriff",
    "colorIdentity": "WB",
    "archetypeTags": [
      "Stax"
    ],
    "matchTags": {
      "stax": 3,
      "control": 2,
      "interaction": 2,
      "lateGame": 1,
      "competitive": 1,
      "white": 2,
      "black": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Lotho%2C%20Corrupt%20Shirriff",
    "sourceStats": {
      "rank": 94,
      "entries": 19,
      "conversionRate": 0.10526315789473684,
      "topCuts": 2,
      "winRate": 0.13541666666666666,
      "metaShare": 0.0010829913360693114
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "medium_play_count",
      "proactive_disruption",
      "stax_piece",
      "tax_or_lock",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Helga, Skittish Seer",
    "colorIdentity": "WUG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "blue": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Helga%2C%20Skittish%20Seer",
    "sourceStats": {
      "rank": 95,
      "entries": 19,
      "conversionRate": 0.05263157894736842,
      "topCuts": 1,
      "winRate": 0.11235955056179775,
      "metaShare": 0.0010829913360693114
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "green_creature_mana",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Ellivere of the Wild Court",
    "colorIdentity": "WG",
    "archetypeTags": [
      "Stax"
    ],
    "matchTags": {
      "stax": 3,
      "control": 2,
      "interaction": 2,
      "lateGame": 1,
      "competitive": 1,
      "white": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Ellivere%20of%20the%20Wild%20Court",
    "sourceStats": {
      "rank": 97,
      "entries": 19,
      "conversionRate": 0.10526315789473684,
      "topCuts": 2,
      "winRate": 0.13829787234042554,
      "metaShare": 0.0010829913360693114
    },
    "deckElements": [
      "creature_tutors",
      "enchantment_engine",
      "green_creature_mana",
      "medium_play_count",
      "proactive_disruption",
      "stax_piece",
      "tax_or_lock",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Kodama of the East Tree / Tymna the Weaver",
    "colorIdentity": "WBG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "white": 2,
      "black": 2,
      "green": 2,
      "complex": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Kodama%20of%20the%20East%20Tree%20%2F%20Tymna%20the%20Weaver",
    "sourceStats": {
      "rank": 79,
      "entries": 46,
      "winRate": 0.21982758620689655,
      "metaShare": 0.0014136447449293178
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "board_engine",
      "card_advantage",
      "combat_draw",
      "commander_card_advantage",
      "creature_combo",
      "creature_tutors",
      "farm_value",
      "green_creature_mana",
      "medium_play_count",
      "midrange_value",
      "partner_shell",
      "resilient_gameplan",
      "solid_conversion",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Selvala, Heart of the Wilds",
    "colorIdentity": "G",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "green": 2,
      "simple": 2,
      "budgetFriendly": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Selvala%2C%20Heart%20of%20the%20Wilds",
    "sourceStats": {
      "rank": 88,
      "entries": 39,
      "winRate": 0.16201117318435754,
      "metaShare": 0.0011985248924400737
    },
    "deckElements": [
      "creature_combo",
      "creature_tutors",
      "fast_mana",
      "green_creature_mana",
      "green_mana_engine",
      "medium_play_count",
      "proactive_combo",
      "turbo_combo"
    ]
  },
  {
    "name": "Flubs, the Fool",
    "colorIdentity": "URG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "red": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Flubs%2C%20the%20Fool",
    "sourceStats": {
      "rank": 94,
      "entries": 37,
      "winRate": 0.1393939393939394,
      "metaShare": 0.0011370620774431468
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "green_creature_mana",
      "medium_play_count",
      "midrange_value",
      "red_breach",
      "resilient_gameplan"
    ]
  },
  {
    "name": "Tameshi, Reality Architect",
    "colorIdentity": "WU",
    "archetypeTags": [
      "Stax",
      "Control"
    ],
    "matchTags": {
      "stax": 3,
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "competitive": 1,
      "complex": 2,
      "value": 1,
      "white": 2,
      "blue": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Tameshi%2C%20Reality%20Architect",
    "sourceStats": {
      "rank": 97,
      "entries": 33,
      "winRate": 0.10365853658536585,
      "metaShare": 0.0010141364474492932
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_selection",
      "control_posture",
      "enchantment_engine",
      "late_game",
      "low_conversion",
      "medium_play_count",
      "proactive_disruption",
      "stack_interaction",
      "stax_piece",
      "tax_or_lock",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Oswald Fiddlebender",
    "colorIdentity": "W",
    "archetypeTags": [
      "Stax"
    ],
    "matchTags": {
      "stax": 3,
      "control": 2,
      "interaction": 2,
      "lateGame": 1,
      "competitive": 2,
      "white": 2,
      "budgetFriendly": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Oswald%20Fiddlebender",
    "sourceStats": {
      "rank": 98,
      "entries": 33,
      "winRate": 0.26380368098159507,
      "metaShare": 0.0010141364474492932
    },
    "deckElements": [
      "high_conversion",
      "medium_play_count",
      "proactive_disruption",
      "stax_piece",
      "tax_or_lock",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Tatyova, Benthic Druid",
    "colorIdentity": "UG",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "blue": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Tatyova%2C%20Benthic%20Druid",
    "sourceStats": {
      "rank": 105,
      "entries": 30,
      "winRate": 0.18115942028985507,
      "metaShare": 0.0009219422249539029
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_advantage",
      "card_selection",
      "creature_tutors",
      "green_creature_mana",
      "medium_play_count",
      "midrange_value",
      "resilient_gameplan",
      "solid_conversion"
    ]
  },
  {
    "name": "Ashling, Flame Dancer",
    "colorIdentity": "R",
    "archetypeTags": [
      "Midrange"
    ],
    "matchTags": {
      "midrange": 3,
      "value": 2,
      "interaction": 1,
      "flexibility": 2,
      "lateGame": 1,
      "red": 2,
      "budgetFriendly": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Ashling%2C%20Flame%20Dancer",
    "sourceStats": {
      "rank": 107,
      "entries": 29,
      "winRate": 0.2074074074074074,
      "metaShare": 0.0008912108174554394
    },
    "deckElements": [
      "card_advantage",
      "low_play_count",
      "midrange_value",
      "red_breach",
      "resilient_gameplan",
      "solid_conversion",
      "spellslinger",
      "storm_combo"
    ]
  },
  {
    "name": "Dina, Soul Steeper",
    "colorIdentity": "BG",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "black": 2,
      "green": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Dina%2C%20Soul%20Steeper",
    "sourceStats": {
      "rank": 109,
      "entries": 27,
      "winRate": 0.2196969696969697,
      "metaShare": 0.0008297480024585126
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "creature_tutors",
      "fast_mana",
      "green_creature_mana",
      "low_play_count",
      "proactive_combo",
      "solid_conversion",
      "turbo_combo"
    ]
  },
  {
    "name": "Sami, Wildcat Captain",
    "colorIdentity": "WR",
    "archetypeTags": [
      "Aggro"
    ],
    "matchTags": {
      "combat": 3,
      "proactive": 3,
      "speed": 1,
      "simple": 1,
      "fun": 1,
      "white": 2,
      "red": 2,
      "mediumBudget": 2,
      "competitive": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Sami%2C%20Wildcat%20Captain",
    "sourceStats": {
      "rank": 111,
      "entries": 26,
      "winRate": 0.2283464566929134,
      "metaShare": 0.0007990165949600492
    },
    "deckElements": [
      "combat_damage",
      "high_conversion",
      "low_play_count",
      "pressure",
      "proactive_combat",
      "red_breach",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Rona, Herald of Invasion // Rona, Tolarian Obliterator",
    "colorIdentity": "UB",
    "archetypeTags": [
      "Turbo"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "blue": 2,
      "black": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Rona%2C%20Herald%20of%20Invasion%20%2F%2F%20Rona%2C%20Tolarian%20Obliterator",
    "sourceStats": {
      "rank": 115,
      "entries": 24,
      "winRate": 0.14814814814814814,
      "metaShare": 0.0007375537799631224
    },
    "deckElements": [
      "ad_naus_access",
      "black_tutors",
      "blue_stack_interaction",
      "card_selection",
      "fast_mana",
      "low_play_count",
      "modal_commander",
      "proactive_combo",
      "turbo_combo"
    ]
  },
  {
    "name": "Captain Sisay",
    "colorIdentity": "WG",
    "archetypeTags": [
      "Turbo",
      "Stax"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "stax": 3,
      "control": 2,
      "interaction": 2,
      "lateGame": 1,
      "white": 2,
      "green": 2,
      "complex": 2,
      "mediumBudget": 2,
      "commanderDependent": 3,
      "commanderFlexible": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Captain%20Sisay",
    "sourceStats": {
      "rank": 121,
      "entries": 22,
      "winRate": 0.16346153846153846,
      "metaShare": 0.0006760909649661955
    },
    "deckElements": [
      "creature_combo",
      "creature_tutors",
      "fast_mana",
      "green_creature_mana",
      "green_mana_engine",
      "low_play_count",
      "proactive_combo",
      "proactive_disruption",
      "stax_piece",
      "tax_or_lock",
      "turbo_combo",
      "white_silence",
      "white_stax"
    ]
  },
  {
    "name": "Teferi, Temporal Archmage",
    "colorIdentity": "U",
    "archetypeTags": [
      "Turbo",
      "Control"
    ],
    "matchTags": {
      "speed": 3,
      "combo": 3,
      "proactive": 2,
      "consistency": 1,
      "competitive": 2,
      "control": 3,
      "interaction": 3,
      "lateGame": 2,
      "complex": 1,
      "value": 1,
      "blue": 2,
      "budgetFriendly": 2,
      "commanderFlexible": 3,
      "commanderIndependent": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Teferi%2C%20Temporal%20Archmage",
    "sourceStats": {
      "rank": 122,
      "entries": 22,
      "winRate": 0.25,
      "metaShare": 0.0006760909649661955
    },
    "deckElements": [
      "blue_stack_interaction",
      "card_selection",
      "control_posture",
      "fast_mana",
      "high_conversion",
      "late_game",
      "low_play_count",
      "proactive_combo",
      "stack_interaction",
      "turbo_combo"
    ]
  },
  {
    "name": "Emry, Lurker of the Loch",
    "colorIdentity": "U",
    "archetypeTags": [
      "Combo"
    ],
    "matchTags": {
      "combo": 4,
      "value": 2,
      "consistency": 2,
      "blue": 3,
      "commanderDependent": 3,
      "budgetFriendly": 3,
      "complex": 2,
      "interaction": 1,
      "competitive": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Emry%2C%20Lurker%20of%20the%20Loch",
    "sourceStats": {
      "rank": 80,
      "entries": 22,
      "conversionRate": 0.18,
      "topCuts": 4,
      "winRate": 0.17,
      "metaShare": 0.0013
    },
    "deckElements": [
      "artifact_combo",
      "artifact_tutor",
      "artifact_mana",
      "one_card_combo",
      "activated_ability",
      "card_selection",
      "graveyard_value",
      "medium_play_count"
    ]
  },
  {
    "name": "Prossh, Skyraider of Kher",
    "colorIdentity": "BRG",
    "archetypeTags": [
      "Combo"
    ],
    "matchTags": {
      "combo": 4,
      "speed": 2,
      "proactive": 2,
      "consistency": 2,
      "black": 2,
      "red": 2,
      "green": 2,
      "commanderDependent": 3,
      "mediumBudget": 2,
      "complex": 2,
      "competitive": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Prossh%2C%20Skyraider%20of%20Kher",
    "sourceStats": {
      "rank": 81,
      "entries": 19,
      "conversionRate": 0.19,
      "topCuts": 3,
      "winRate": 0.17,
      "metaShare": 0.00108
    },
    "deckElements": [
      "food_chain",
      "proactive_combo",
      "sacrifice_combo",
      "creature_tutors",
      "graveyard_value",
      "black_tutors",
      "fast_mana",
      "medium_play_count"
    ]
  },
  {
    "name": "Kykar, Wind's Fury",
    "colorIdentity": "WUR",
    "archetypeTags": [
      "Spellslinger",
      "Combo"
    ],
    "matchTags": {
      "storm": 3,
      "combo": 3,
      "value": 2,
      "white": 2,
      "blue": 2,
      "red": 2,
      "commanderDependent": 3,
      "mediumBudget": 2,
      "complex": 2,
      "competitive": 1
    },
    "edhtop16Url": "https://edhtop16.com/commander/Kykar%2C%20Wind%27s%20Fury",
    "sourceStats": {
      "rank": 82,
      "entries": 23,
      "conversionRate": 0.18,
      "topCuts": 4,
      "winRate": 0.17,
      "metaShare": 0.0013
    },
    "deckElements": [
      "spellslinger",
      "storm_combo",
      "copy_spells",
      "token_engine",
      "ritual_chain",
      "red_breach",
      "commander_card_advantage",
      "medium_play_count"
    ]
  }
];

module.exports = {
  costTierConfig,
  metaTagConfig,
  statsWeightConfig,
  commanders: applyCommanderMetaTags(commanders, metaTagConfig),
};
