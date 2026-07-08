const { getColorCount } = require('./profile');

function isPartnerShell(commander) {
  const elements = Array.isArray(commander && commander.deckElements)
    ? commander.deckElements
    : [];

  return elements.includes('partner_shell') || String(commander && commander.name || '').includes(' / ');
}

function setMaxTag(tags, key, value) {
  tags[key] = Math.max(Number(tags[key] || 0), value);
}

function hasAnyTag(values, wanted) {
  const source = Array.isArray(values) ? values : [];
  return wanted.some((tag) => source.includes(tag));
}

function buildEffectiveMatchTags(commander) {
  const tags = {
    ...(commander && commander.matchTags || {}),
  };
  const elements = Array.isArray(commander && commander.deckElements)
    ? commander.deckElements
    : [];
  const metaTags = Array.isArray(commander && commander.metaTags)
    ? commander.metaTags
    : [];
  const isIrrelevant = (commander && commander.metaStatus === 'irrelevant')
    || elements.includes('irrelevant_meta')
    || metaTags.includes('irrelevant');
  const isOutdated = (commander && commander.metaStatus === 'outdated')
    || elements.includes('outdated_meta')
    || metaTags.includes('outdated');
  const hasBreachEngine = elements.includes('red_breach') && hasAnyTag(elements, [
    'ad_naus_access',
    'breach_oracle',
    'copy_spells',
    'dockside_combo',
    'proactive_combo',
    'ritual_chain',
    'ritual_combo',
    'spellslinger',
    'storm_combo',
    'turbo_combo',
  ]);

  if (isPartnerShell(commander)) {
    setMaxTag(tags, 'partnerFriendly', 4);
  } else {
    setMaxTag(tags, 'partnerAverse', 4);
  }
  setMaxTag(tags, 'partnerNeutral', 1);

  const colorCount = getColorCount(commander && commander.colorIdentity);
  if (colorCount <= 1) setMaxTag(tags, 'budgetFriendly', 3);
  if (colorCount === 2) setMaxTag(tags, 'budgetFriendly', 2);
  if (colorCount >= 2 && colorCount <= 3) setMaxTag(tags, 'mediumBudget', 2);
  if (colorCount >= 4) setMaxTag(tags, 'highBudget', 3);

  if (metaTags.includes('competitive')) setMaxTag(tags, 'competitive', 3);
  if (metaTags.includes('fun')) setMaxTag(tags, 'fun', 3);
  if (metaTags.includes('fringe')) setMaxTag(tags, 'fun', 1);

  if (hasAnyTag(elements, ['turbo_combo', 'fast_mana', 'turbo_naus', 'ritual_chain', 'ritual_combo', 'rakdos_turbo', 'mono_black_turbo', 'glass_cannon'])) {
    setMaxTag(tags, 'speed', 3);
    setMaxTag(tags, 'proactive', 2);
  }

  if (hasAnyTag(elements, ['turbo_combo', 'proactive_combo', 'fast_mana', 'ad_naus_access', 'red_breach', 'storm_combo', 'ritual_chain', 'ritual_combo', 'ruby_storm', 'combat_damage', 'pressure', 'proactive_combat', 'glass_cannon', 'rakdos_turbo', 'mono_black_turbo', 'dargo_combo', 'pirate_combo'])) {
    setMaxTag(tags, 'lowInteraction', 3);
  }

  if (hasAnyTag(elements, ['proactive_combo', 'breach_oracle', 'creature_combo', 'infinite_mana', 'infinite_mana_sink', 'food_chain', 'dockside_combo', 'one_card_combo', 'spellseeker_combo', 'wizard_combo', 'outlet_commander'])) {
    setMaxTag(tags, 'combo', 3);
  }

  if (hasAnyTag(elements, ['commander_card_advantage', 'commander_engine', 'activated_ability', 'outlet_commander', 'infinite_mana_sink', 'thrasios_outlet', 'tutor_commander', 'combat_draw', 'topdeck_value', 'topdeck_damage', 'ninja_combat', 'mana_engine', 'green_mana_engine'])) {
    setMaxTag(tags, 'commanderDependent', 4);
  }

  if (hasAnyTag(elements, ['storm_combo', 'ritual_chain', 'ritual_combo', 'ruby_storm', 'spellslinger', 'copy_spells', 'rituals', 'coin_flip_engine', 'breach_oracle'])) {
    setMaxTag(tags, 'storm', 4);
    setMaxTag(tags, 'spellChain', 4);
    setMaxTag(tags, 'complex', 2);
  }

  if (hasAnyTag(elements, ['artifact_combo', 'treasure_engine', 'time_sieve', 'artifact_tutor', 'artifact_mana', 'colorless_artifacts', 'clock_of_omens'])) {
    setMaxTag(tags, 'artifact', 4);
    setMaxTag(tags, 'combo', 2);
  }

  if (hasAnyTag(elements, ['enchantment_engine'])) {
    setMaxTag(tags, 'enchantmentEngine', 4);
    setMaxTag(tags, 'value', 2);
    setMaxTag(tags, 'midrange', 1);
  }

  if (hasAnyTag(elements, ['cradle_combo', 'temur_cradle', 'cradle_reset'])) {
    setMaxTag(tags, 'cradleReset', 4);
    setMaxTag(tags, 'permanentEngine', 2);
    setMaxTag(tags, 'value', 2);
  }

  if (hasAnyTag(elements, ['creature_combo', 'creature_tutors', 'green_creature_mana', 'green_mana_engine', 'mana_engine', 'board_engine', 'enchantment_engine', 'commander_card_advantage', 'card_advantage', 'midrange_value', 'farm_value', 'value_engine', 'token_engine', 'land_engine', 'lands_combo'])) {
    setMaxTag(tags, 'permanentEngine', 4);
    setMaxTag(tags, 'value', 2);
    setMaxTag(tags, 'midrange', 2);
  }

  if (hasAnyTag(elements, ['graveyard_value', 'graveyard_loop', 'razaketh_reanimator', 'razakats', 'reanimation', 'breach_oracle']) || hasBreachEngine) {
    setMaxTag(tags, 'graveyard', 4);
    setMaxTag(tags, 'combo', 2);
    setMaxTag(tags, 'value', 2);
  }

  if (hasAnyTag(elements, ['control_posture', 'stack_interaction', 'blue_stack_interaction', 'tempo_control', 'control_midrange'])) {
    setMaxTag(tags, 'interaction', 3);
    setMaxTag(tags, 'control', 2);
  }

  if (hasAnyTag(elements, ['stax_piece', 'tax_or_lock', 'white_stax', 'prison_combo', 'stax_compatible', 'stax_grind', 'stax_combo', 'winota_stax', 'proactive_disruption'])) {
    setMaxTag(tags, 'stax', 3);
    setMaxTag(tags, 'control', 1);
  }

  if (hasAnyTag(elements, ['combat_damage', 'damage_pressure', 'proactive_combat', 'voltron', 'ninja_combat', 'topdeck_damage', 'combat_combo', 'extra_combat', 'combat_snowball', 'creature_pressure', 'pressure'])) {
    setMaxTag(tags, 'combat', 3);
    setMaxTag(tags, 'damagePressure', 3);
    setMaxTag(tags, 'proactive', 2);
  }

  if (hasAnyTag(elements, ['resilient_gameplan', 'late_game', 'flexible_answers', 'multi_color_goodstuff', 'five_color_flexibility', 'modal_commander', 'five_color_goodstuff', 'toolbox_tutor', 'sisay_toolbox', 'legendary_toolbox'])) {
    setMaxTag(tags, 'flexibility', 2);
    setMaxTag(tags, 'lateGame', 1);
  }

  if (isIrrelevant) {
    tags.competitive = 0;
  } else if (isOutdated && Number(tags.competitive || 0) > 1) {
    tags.competitive = 1;
  }

  return tags;
}

module.exports = {
  buildEffectiveMatchTags,
  hasAnyTag,
  isPartnerShell,
  setMaxTag,
};
