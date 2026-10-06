const {
  costTierConfig,
  metaTagConfig,
  statsWeightConfig,
} = require('./recommendation-rules');
const { commanderStats, commanderStatsManifest } = require('./commander-stats');
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
    "deckElements": [
      "tutor_commander",
      "graveyard_value",
      "creature_combo",
      "combat_combo",
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
    "deckElements": [
      "commander_engine",
      "token_engine",
      "graveyard_value",
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
  commanderStatsManifest,
  commanders: applyCommanderMetaTags(commanders.map((commander) => ({ ...commander, sourceStats: { ...commanderStats[commander.name] } })), metaTagConfig),
};
