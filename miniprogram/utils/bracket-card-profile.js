const { normalizeCardName } = require('./scryfall');

const FEATURE_COVERAGE_THRESHOLD = 0.8;
const FEATURE_MIN_LAND_SLOTS = 20;
const FEATURE_MIN_NONLAND_SLOTS = 40;
const COHESION_THEME_DEFINITIONS = Object.freeze([
  Object.freeze({ key: 'equipment', label: '武具', member: 8, support: 2, related: 11, density: 0.17, strongMember: 13, strongSupport: 4, strongRelated: 18, strongDensity: 0.27, priority: 5 }),
  Object.freeze({ key: 'aura', label: '灵气', member: 9, support: 2, related: 12, density: 0.18, strongMember: 14, strongSupport: 4, strongRelated: 19, strongDensity: 0.28, priority: 4 }),
  Object.freeze({ key: 'discard', label: '弃牌', member: 7, support: 2, related: 10, density: 0.15, strongMember: 11, strongSupport: 4, strongRelated: 16, strongDensity: 0.24, priority: 3 }),
  Object.freeze({ key: 'counter', label: '+1/+1 指示物', member: 8, support: 2, related: 11, density: 0.17, strongMember: 13, strongSupport: 4, strongRelated: 18, strongDensity: 0.27, priority: 2 }),
  Object.freeze({ key: 'artifact', label: '神器', member: 16, support: 3, related: 20, density: 0.3, strongMember: 25, strongSupport: 5, strongRelated: 30, strongDensity: 0.43, priority: 1 }),
]);

function hasOwn(value, key) {
  return Boolean(value && Object.prototype.hasOwnProperty.call(value, key));
}

function finiteManaValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function oracleText(value) {
  return value === null || value === undefined
    ? ''
    : String(value).replace(/\r\n?/g, '\n').trim().toLowerCase();
}

function faceTypeLine(face, fallback) {
  return normalizeCardName((face && face.type_line) || fallback || '').split(' // ')[0];
}

function faceOracleSource(card, face) {
  if (hasOwn(face, 'oracle_text')) {
    return { known: true, text: oracleText(face.oracle_text) };
  }
  if (hasOwn(card, 'oracle_text')) {
    return { known: true, text: oracleText(card.oracle_text) };
  }
  return { known: false, text: '' };
}

function faceManaValue(card, face, index, faceCount) {
  const faceValue = finiteManaValue(face && face.cmc);
  if (faceValue !== null) return faceValue;
  const cardValue = finiteManaValue(card && card.cmc);
  if (cardValue === null) return null;
  // Parent CMC is safe for a single face and for the front of transform/modal cards.
  // Split/adventure parents can combine unlike costs, so they need face CMC data.
  if (faceCount <= 1 || (index === 0 && !/^(?:split|adventure)$/i.test(card.layout || ''))) {
    return cardValue;
  }
  return null;
}

function playableSpellFaces(card, faces) {
  if (!faces.length) return [card];
  const layout = String(card.layout || '').toLowerCase();
  const candidates = /^(?:split|adventure|modal_dfc)$/.test(layout) ? faces : [faces[0]];
  return candidates.filter((face) => !/\bLand\b/i.test(faceTypeLine(face, card.type_line)));
}

function playableLandFace(card, faces) {
  const front = faces[0] || card;
  if (/\bLand\b/i.test(faceTypeLine(front, card.type_line))) return front;
  if (String(card.layout || '').toLowerCase() !== 'modal_dfc') return null;
  return faces.find((face) => /\bLand\b/i.test(faceTypeLine(face, ''))) || null;
}

function hasUnconditionalTappedEntry(text) {
  return text.split('\n').some((line) => (
    /^[^.\n]{1,120} enters(?: the battlefield)? tapped\.$/i.test(line.trim())
  ));
}

function hasUntappedFetchAccess(text) {
  const clauses = text.split('\n').filter((line) => (
    /search your library for/i.test(line) && /put (?:it|that card) onto the battlefield/i.test(line)
  ));
  return clauses.some((line) => {
    const hasLandTarget = /\bland card\b/i.test(line)
      || /\b(?:plains|island|swamp|mountain|forest)(?: or (?:plains|island|swamp|mountain|forest))* card\b/i.test(line);
    return hasLandTarget && !/onto the battlefield tapped/i.test(line);
  });
}

function conditionalLandIsTurnOneReady(text) {
  const hasConditionalEntry = /enters(?: the battlefield)? tapped unless/i.test(text)
    || /if you don't,? (?:it|[^.\n]{1,80}) enters(?: the battlefield)? tapped/i.test(text)
    || /enters(?: the battlefield)? tapped if/i.test(text);
  if (!hasConditionalEntry) return true;

  return /two or fewer other lands/i.test(text)
    || /two or more opponents/i.test(text)
    || /pay (?:2|3) life/i.test(text)
    || /enters(?: the battlefield)? tapped if you control two or more other lands/i.test(text);
}

function isTurnOneManaLand(typeLine, text, producedMana, isBasic) {
  if (/\bCreature\b/i.test(typeLine)) return false;
  if (hasUnconditionalTappedEntry(text) || !conditionalLandIsTurnOneReady(text)) return false;
  if (hasUntappedFetchAccess(text)) return true;
  if (isBasic) return true;

  const dependentMana = /land you control could produce/i.test(text)
    || /add [^.\n]+ for each (?:creature|enchantment|artifact|land)/i.test(text);
  const directTapMana = /(?:^|\n)\{T\}(?:,[^:\n]{0,100})?:\s*add\b/i.test(text);
  if (directTapMana && !dependentMana) return true;

  // Some basic-like lands expose produced_mana while omitting rules text.
  return !text && Array.isArray(producedMana) && producedMana.length > 0;
}

function isRegularRampFace(typeLine, text, manaValue) {
  if (manaValue === null || manaValue < 1 || manaValue > 2 || /\bLand\b/i.test(typeLine)) {
    return false;
  }

  const landSearch = /search your library for [^.\n]*(?:\bland card\b|\b(?:plains|island|swamp|mountain|forest)(?: or (?:plains|island|swamp|mountain|forest))* card\b)[^.\n]*put (?:it|that card) onto the battlefield/i.test(text);
  const landFromHand = /put (?:a|one) land card from your hand onto the battlefield/i.test(text);
  const extraLand = /(?:play|may play) an additional land/i.test(text);
  if (landSearch || landFromHand || extraLand) return true;

  if (!/\b(?:Artifact|Creature|Enchantment)\b/i.test(typeLine)) return false;
  const sacrificeForMana = /\{T\}[^:\n]*sacrifice[^:\n]*:\s*add\b/i.test(text)
    || /sacrifice [^:\n]+:\s*add\b/i.test(text);
  if (sacrificeForMana) return false;

  return /\{T\}[^:\n]{0,120}:\s*add\b/i.test(text)
    || /whenever enchanted land is tapped for mana[^.\n]*adds?\b/i.test(text)
    || /enchanted land has[^.\n]*add\b/i.test(text)
    || /at the beginning of [^.\n]*(?:main phase|precombat main phase)[^.\n]*add\b/i.test(text);
}

function hasTargetedRemoval(text) {
  const removal = /\b(?:destroy|exile) target ([^.\n]{1,100})/gi;
  let match = removal.exec(text);
  while (match) {
    const target = match[1];
    if (!/\byou control\b/i.test(target)
      && /\b(?:artifact|creature|enchantment|permanent|planeswalker|battle|nonland)\b/i.test(target)) {
      return true;
    }
    match = removal.exec(text);
  }
  return false;
}

function hasDirectInteraction(text) {
  const stackInteraction = /counter target (?:[^.\n]{0,50}\b)?(?:spell|activated ability|triggered ability)\b/i.test(text)
    || /counter all other spells/i.test(text);
  const bounce = /return target ([^.\n]{1,100}) to (?:its|their) owner's hand/i.exec(text);
  const opposingBounce = Boolean(bounce && !/\byou control\b/i.test(bounce[1]));
  const shrink = /target creature gets? -(?:x|\d+)\s*\/-(?:x|\d+)/i.test(text);
  const damage = /deals? (?:x|\d+) damage to (?:any target|target (?:creature|planeswalker|battle))/i.test(text);
  const sacrifice = /target opponent sacrifices? (?:a|an) (?:artifact|creature|enchantment|permanent|planeswalker)/i.test(text);
  return stackInteraction || hasTargetedRemoval(text) || opposingBounce || shrink || damage || sacrifice;
}

function hasGraveyardInteraction(text) {
  return /exile (?:all |up to [^.\n]* )?target (?:card|cards)[^.\n]* from (?:a|target player's|all) graveyard/i.test(text)
    || /exile all cards from target player's graveyard/i.test(text)
    || /cards? in graveyards?[^.\n]{0,40}can't/i.test(text)
    || /players? can't cast spells? from graveyards?/i.test(text)
    || /if (?:a|one or more) (?:cards?(?: or tokens?)?|tokens?(?: or cards?)?) would be put into (?:a|an opponent's|a player's) graveyard[^.\n]*exile/i.test(text)
    || /put target card from a graveyard on (?:the top|the bottom) of its owner's library/i.test(text)
    || /shuffle target player's graveyard into/i.test(text);
}

function grantsProtection(text) {
  const grantsToControlled = /(?:target [^.\n]{0,60} you control|permanents? you control|creatures? you control) [^.\n]{0,50}(?:gains?|have|has) [^.\n]{0,50}(?:hexproof|indestructible|shroud|protection from)/i.test(text);
  const phasesControlled = /(?:target [^.\n]{0,50} you control|creatures? you control) phase out/i.test(text);
  const equipmentProtection = /equipped creature has [^.\n]*(?:hexproof|shroud)/i.test(text);
  return grantsToControlled
    || phasesControlled
    || equipmentProtection
    || /spells? you control can't be countered/i.test(text)
    || /your opponents can't cast spells/i.test(text)
    || /target (?:opponent|player) can't cast (?:spells|instant or sorcery spells) this turn/i.test(text)
    || /change the target of target spell or ability/i.test(text);
}

function hasCardFlow(text) {
  if (/search your library/i.test(text)) return false;
  const withoutOpponentOnlyDraw = text.replace(/(?:target|each|an?) opponents? draws?[^.\n]*/gi, '');
  return /(?:^|[\n.:,]\s*)(?:you may )?draw (?:a|one|two|three|x|\d+) cards?\b/i.test(withoutOpponentOnlyDraw)
    || /\byou (?:may )?draw (?:a|one|two|three|x|\d+|that many) cards?\b/i.test(withoutOpponentOnlyDraw)
    || /\b(?:target player|each player) draws? (?:a|one|two|three|x|\d+) cards?\b/i.test(withoutOpponentOnlyDraw)
    || /\b(?:scry|surveil) (?:x|\d+)/i.test(text)
    || /\bconnives?\b/i.test(text)
    || /look at (?:the )?top [^.\n]{0,100}(?:put|reveal) [^.\n]{0,100} into your hand/i.test(text)
    || /look at (?:the )?top [^.\n]{0,100}rearrange/i.test(text)
    || /look at (?:the )?top [^.\n]{0,100}put (?:them|those cards) back in any order/i.test(text)
    || /exile the top (?:card|one|two|three|x|\d+) cards? of your library[\s\S]{0,160}(?:play|cast) (?:it|them|that card|those cards)/i.test(text);
}

function addRole(roles, role, active) {
  if (active) roles.add(role);
}

function extractCohesionRoles(typeLine, text) {
  const roles = new Set();
  const equipment = /\bEquipment\b/i.test(typeLine);
  const aura = /\bAura\b/i.test(typeLine);
  const artifact = /\bArtifact\b/i.test(typeLine);

  addRole(roles, 'equipment-member', equipment);
  addRole(roles, 'equipment-support', /\bEquipment spells?\b|\bEquipment you control\b|\bequip abilities\b|\battach target Equipment\b|\bfor each Equipment\b|\bwhenever (?:an|one or more) Equipment\b|\bequipped creatures? you control\b/i.test(text));

  addRole(roles, 'aura-member', aura);
  addRole(roles, 'aura-support', /\bAura spells?\b|\bAuras? you control\b|\battach target Aura\b|\bfor each Aura\b|\bwhenever (?:an|one or more) Auras?\b/i.test(text)
    || (!aura && /\benchanted (?:creatures?|permanents?) you control\b/i.test(text)));

  const discardMember = /\b(?:you|target player|each player|target opponent|each opponent) discards? (?:a|one|two|three|x|\d+|that many|their hand)\b/i.test(text)
    || /\b(?:that player|they) discards? (?:that card|it|a card|one card)\b/i.test(text)
    || /(?:^|[,:—]\s*|\bthen\s+)discard (?:a|one|two|three|x|\d+|your hand|all the cards?)\b/i.test(text);
  const discardSupport = /\bwhenever [^.\n]{0,100}\bdiscards?\b|\bif you discarded\b|\bfor each card discarded\b|\bwas discarded\b|\bmadness\b/i.test(text);
  addRole(roles, 'discard-member', discardMember);
  addRole(roles, 'discard-support', discardSupport);

  const counterMember = /\b(?:put|puts|distribute|enters(?: the battlefield)? with)[^.\n]{0,120}\+1\/\+1 counters?\b/i.test(text)
    || /\b\+1\/\+1 counters? on\b/i.test(text);
  const counterSupport = /\bproliferate\b|\bfor each \+1\/\+1 counter\b|\bwith (?:(?:a|one or more) )?\+1\/\+1 counters? on\b|\bremove (?:a|one|one or more|x|\d+) \+1\/\+1 counters?\b|\bdouble [^.\n]{0,80}\+1\/\+1 counters?\b|\bcreatures? you control with \+1\/\+1 counters?\b/i.test(text);
  addRole(roles, 'counter-member', counterMember);
  addRole(roles, 'counter-support', counterSupport);

  const createsArtifact = /\bcreate [^.\n]{0,120}(?:artifact tokens?|Treasure|Clue|Food|Map|Powerstone|Thopter|Servo)s?\b/i.test(text);
  const artifactSupport = /\bartifact spells? you cast\b|\bartifacts? you control\b|\bfor each artifact\b|\bwhenever (?:an|one or more|another) artifacts?\b|\bsacrifice (?:an|another|one or more) artifacts?\b|\breturn target artifact card\b|\baffinity for artifacts\b|\bimprovise\b|\bmetalcraft\b/i.test(text);
  addRole(roles, 'artifact-member', artifact || createsArtifact);
  addRole(roles, 'artifact-support', artifactSupport);

  return Array.from(roles).sort();
}

function abilityLines(text) {
  return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
}

function activationManaValue(cost) {
  let total = 0;
  const symbols = String(cost || '').match(/\{[^}]+\}/g) || [];
  for (let index = 0; index < symbols.length; index += 1) {
    const symbol = symbols[index].slice(1, -1).toUpperCase();
    if (symbol === 'T' || symbol === 'Q' || symbol === 'X') return Infinity;
    if (/^\d+$/.test(symbol)) total += Number(symbol);
    else if (/^[WUBRGC]$/.test(symbol)) total += 1;
    else if (/^[WUBRGC][/WUBRGC]+$/.test(symbol)) total += 1;
    else return Infinity;
  }
  return total;
}

function freeSacrificeOutlet(text, kind) {
  const target = kind === 'artifact' ? 'artifacts?' : '(?:nontoken )?creatures?';
  const pattern = new RegExp(`\\bsacrifice (?:an?|another|one or more) ${target}\\b`, 'i');
  return abilityLines(text).some((line) => {
    const colon = line.indexOf(':');
    if (colon < 0) return false;
    const cost = line.slice(0, colon);
    return pattern.test(cost)
      && activationManaValue(cost) === 0
      && !/\b(?:pay|discard|exile|tap|remove|return|put)\b/i.test(cost);
  });
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function repeatableRecursionRoles(typeLine, text, manaValue, cardName) {
  const roles = new Set();
  if (/\bonly once each turn\b|\bactivate only as a sorcery\b|\bchosen at random\b|\ban opponent chooses\b/i.test(text)) {
    return roles;
  }

  const isCreature = /\bCreature\b/i.test(typeLine);
  const isArtifact = /\bArtifact\b/i.test(typeLine);
  const normalizedName = oracleText(cardName).split(' // ')[0];
  const selfNamePattern = normalizedName
    ? `(?:${escapeRegExp(normalizedName)}|this card)`
    : 'this card';
  const selfReference = new RegExp(`\\byou may cast ${selfNamePattern} from your graveyard\\b`, 'i');
  const selfCast = selfReference.test(text)
    && manaValue !== null
    && manaValue <= 1;
  if (selfCast && isCreature) roles.add('creature-recursion');
  if (selfCast && isArtifact) roles.add('artifact-recursion');

  abilityLines(text).forEach((line) => {
    const colon = line.indexOf(':');
    if (colon < 0) return;
    const cost = line.slice(0, colon);
    const effect = line.slice(colon + 1);
    if (activationManaValue(cost) > 1
      || /\{T\}|\{Q\}|\b(?:sacrifice|exile|discard)\b/i.test(cost)) return;
    const returnsToBattlefield = /\breturn target [^.\n]{0,80} card from your graveyard to the battlefield\b/i.test(effect);
    if (!returnsToBattlefield) return;
    if (/\bcreature\b/i.test(effect)) roles.add('creature-recursion');
    if (/\bartifact\b/i.test(effect)) roles.add('artifact-recursion');
  });

  const selfReturn = new RegExp(`\\breturn ${selfNamePattern} from your graveyard to the battlefield\\b`, 'i').test(text)
    && manaValue !== null
    && manaValue <= 1;
  if (selfReturn && isCreature) roles.add('creature-recursion');
  if (selfReturn && isArtifact) roles.add('artifact-recursion');
  return roles;
}

function extractComboRoles(typeLine, text, manaValue, cardName) {
  const roles = new Set();
  addRole(roles, 'free-creature-sacrifice', freeSacrificeOutlet(text, 'creature'));
  addRole(roles, 'free-artifact-sacrifice', freeSacrificeOutlet(text, 'artifact'));
  repeatableRecursionRoles(typeLine, text, manaValue, cardName).forEach((role) => roles.add(role));

  const terminalEffect = /(?:each|target) opponent loses? [^.\n]*life|target player loses? [^.\n]*life|deals? [^.\n]*damage to (?:each opponent|target opponent|any target)|(?:each|target) opponent mills?\b/i;
  const creatureDeath = abilityLines(text).some((line) => (
    /\bwhenever [^.\n]{0,120}\bcreatures?\b[^.\n]{0,60}\bdies?\b/i.test(line)
    && terminalEffect.test(line)
  ));
  const artifactDeath = abilityLines(text).some((line) => (
    /\bwhenever [^.\n]{0,120}\bartifacts?\b[^.\n]{0,100}(?:is put into a graveyard from the battlefield|leaves? the battlefield)\b/i.test(line)
    && terminalEffect.test(line)
  ));
  addRole(roles, 'creature-death-payoff', creatureDeath);
  addRole(roles, 'artifact-death-payoff', artifactDeath);
  return Array.from(roles).sort();
}

function emptyStrengthFeatures() {
  return {
    known: false,
    playableLand: false,
    nonland: false,
    alwaysTappedLand: false,
    turnOneManaLand: false,
    regularRamp12: false,
    lowCostInteraction: false,
    graveyardInteraction: false,
    protection: false,
    lowCostCardFlow: false,
    cohesionRoles: [],
    comboRoles: [],
  };
}

function extractStrengthFeatures(card) {
  if (!card || typeof card !== 'object') return emptyStrengthFeatures();
  const faces = Array.isArray(card.card_faces) ? card.card_faces.filter(Boolean) : [];
  const front = faces[0] || card;
  const frontType = faceTypeLine(front, card.type_line);
  const frontOracle = faceOracleSource(card, front);
  const frontCmc = faceManaValue(card, front, 0, Math.max(1, faces.length));
  const known = Boolean(frontType && frontOracle.known && frontCmc !== null);
  if (!known) return emptyStrengthFeatures();

  const landFace = playableLandFace(card, faces);
  const landType = landFace ? faceTypeLine(landFace, card.type_line) : '';
  const landOracle = landFace ? faceOracleSource(card, landFace) : { known: false, text: '' };
  const isBasic = /\bBasic\b[^/]*\bLand\b/i.test(landType);
  const producedMana = landFace && Array.isArray(landFace.produced_mana)
    ? landFace.produced_mana
    : (Array.isArray(card.produced_mana) ? card.produced_mana : []);

  let regularRamp12 = false;
  let lowCostInteraction = false;
  let graveyardInteraction = false;
  let protection = false;
  let lowCostCardFlow = false;
  const cohesionRoles = new Set();
  const comboRoles = new Set();
  const spellFaces = playableSpellFaces(card, faces);
  spellFaces.forEach((face, index) => {
    const typeLine = faceTypeLine(face, card.type_line);
    const source = faceOracleSource(card, face);
    const manaValue = faceManaValue(card, face, faces.indexOf(face) < 0 ? index : faces.indexOf(face), Math.max(1, faces.length));
    if (!source.known || manaValue === null) return;
    const text = source.text;
    extractCohesionRoles(typeLine, text).forEach((role) => cohesionRoles.add(role));
    extractComboRoles(typeLine, text, manaValue, face.name || card.name).forEach((role) => comboRoles.add(role));
    if (isRegularRampFace(typeLine, text, manaValue)) regularRamp12 = true;
    if (manaValue <= 2) {
      const grave = hasGraveyardInteraction(text);
      const protects = grantsProtection(text);
      const interacts = hasDirectInteraction(text) || grave || protects;
      lowCostInteraction = lowCostInteraction || interacts;
      graveyardInteraction = graveyardInteraction || grave;
      protection = protection || protects;
      lowCostCardFlow = lowCostCardFlow || hasCardFlow(text);
    }
  });

  return {
    known,
    playableLand: Boolean(landFace && landOracle.known),
    nonland: !/\bLand\b/i.test(frontType),
    alwaysTappedLand: Boolean(landFace && landOracle.known && hasUnconditionalTappedEntry(landOracle.text)),
    turnOneManaLand: Boolean(landFace && landOracle.known && isTurnOneManaLand(
      landType,
      landOracle.text,
      producedMana,
      isBasic,
    )),
    regularRamp12,
    lowCostInteraction,
    graveyardInteraction,
    protection,
    lowCostCardFlow,
    cohesionRoles: Array.from(cohesionRoles).sort(),
    comboRoles: Array.from(comboRoles).sort(),
  };
}

function readMetadata(byName, key) {
  if (!byName || !key) return null;
  if (byName instanceof Map) return byName.get(key) || null;
  return Object.prototype.hasOwnProperty.call(byName, key) ? byName[key] : null;
}

function metadataForCard(card, metadataResult) {
  const byName = metadataResult && metadataResult.byName;
  const rawKey = normalizeCardName(card && card.name).toLowerCase();
  return readMetadata(byName, card && card.key) || readMetadata(byName, rawKey);
}

function rounded(value) {
  return Math.round(value * 10000) / 10000;
}

function normalizedExclusionSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

function buildEfficiencyProfile(cards, metadataResult = {}, exclusions = {}) {
  const rampExclusions = normalizedExclusionSet(exclusions.regularRamp);
  const interactionExclusions = normalizedExclusionSet(exclusions.interaction);
  const flowExclusions = normalizedExclusionSet(exclusions.cardFlow);
  const rampCards = new Map();
  const interactionCards = new Map();
  const graveyardCards = new Map();
  const protectionCards = new Map();
  const flowCards = new Map();
  let totalSlotCount = 0;
  let knownSlotCount = 0;
  let landCount = 0;
  let alwaysTappedLandCount = 0;
  let turnOneManaLandCount = 0;
  let nonlandCoveredCount = 0;

  (Array.isArray(cards) ? cards : []).forEach((card) => {
    if (!card || card.section === 'commander' || card.section === 'companion') return;
    const count = Number(card.count) || 0;
    if (count <= 0) return;
    totalSlotCount += count;
    const metadata = metadataForCard(card, metadataResult);
    const features = metadata && metadata.strengthFeatures;
    if (!features || features.known !== true) return;
    knownSlotCount += count;
    if (features.playableLand) {
      landCount += count;
      if (features.alwaysTappedLand) alwaysTappedLandCount += count;
      if (features.turnOneManaLand) turnOneManaLandCount += count;
    }
    if (features.nonland) nonlandCoveredCount += count;

    const key = card.key || normalizeCardName(card.name).toLowerCase();
    const name = metadata.name || card.name;
    // A multifunction card contributes to only one primary axis.
    if (features.regularRamp12) {
      if (!rampExclusions.has(key)) rampCards.set(key, name);
      return;
    }
    if (features.lowCostInteraction) {
      if (!interactionExclusions.has(key)) {
        interactionCards.set(key, name);
        if (features.graveyardInteraction) graveyardCards.set(key, name);
        if (features.protection) protectionCards.set(key, name);
      }
      return;
    }
    if (features.lowCostCardFlow && !flowExclusions.has(key)) flowCards.set(key, name);
  });

  const featureCoverage = totalSlotCount ? knownSlotCount / totalSlotCount : 0;
  const coverageReliable = featureCoverage >= FEATURE_COVERAGE_THRESHOLD;
  const manaReliable = coverageReliable && landCount >= FEATURE_MIN_LAND_SLOTS;
  const nonlandReliable = coverageReliable && nonlandCoveredCount >= FEATURE_MIN_NONLAND_SLOTS;
  const turnOneLandRatio = landCount ? turnOneManaLandCount / landCount : 0;
  const tappedLandRatio = landCount ? alwaysTappedLandCount / landCount : 0;
  const regularRampCount = rampCards.size;
  const interactionCount = interactionCards.size;
  const graveyardInteractionCount = graveyardCards.size;
  const protectionCount = protectionCards.size;
  const cardFlowCount = flowCards.size;

  const manaDeveloped = manaReliable && (
    (turnOneLandRatio >= 0.7 && tappedLandRatio <= 0.22) || regularRampCount >= 3
  );
  const manaStrong = manaReliable
    && turnOneLandRatio >= 0.82
    && tappedLandRatio <= 0.12
    && regularRampCount >= 4;
  const interactionDeveloped = nonlandReliable && interactionCount >= 5;
  const interactionStrong = nonlandReliable
    && interactionCount >= 8
    && (graveyardInteractionCount >= 1 || protectionCount >= 2);
  const flowDeveloped = nonlandReliable && cardFlowCount >= 4;
  const flowStrong = nonlandReliable && cardFlowCount >= 7;
  const strongAxisCount = [manaStrong, interactionStrong, flowStrong].filter(Boolean).length;
  const developedAxisCount = [manaDeveloped, interactionDeveloped, flowDeveloped].filter(Boolean).length;
  const band = strongAxisCount >= 2 ? 4 : ((strongAxisCount >= 1 || developedAxisCount >= 2) ? 3 : 1);
  const triggerCards = Array.from(new Set([
    ...rampCards.values(),
    ...interactionCards.values(),
    ...flowCards.values(),
  ])).sort((a, b) => a.localeCompare(b));

  return {
    available: knownSlotCount > 0,
    reliable: coverageReliable && (manaReliable || nonlandReliable),
    featureCoverage: rounded(featureCoverage),
    totalSlotCount,
    knownSlotCount,
    landCount,
    alwaysTappedLandCount,
    turnOneManaLandCount,
    turnOneLandRatio: rounded(turnOneLandRatio),
    tappedLandRatio: rounded(tappedLandRatio),
    nonlandCoveredCount,
    regularRampCount,
    interactionCount,
    graveyardInteractionCount,
    protectionCount,
    cardFlowCount,
    manaReliable,
    nonlandReliable,
    manaDeveloped,
    manaStrong,
    interactionDeveloped,
    interactionStrong,
    flowDeveloped,
    flowStrong,
    strongAxisCount,
    developedAxisCount,
    band,
    triggerCards,
  };
}

function profileCardKey(card) {
  return normalizeCardName((card && card.key) || (card && card.name)).toLowerCase();
}

function namedRoleCards() {
  return new Map();
}

function addNamedRole(map, key, name) {
  if (key && !map.has(key)) map.set(key, name);
}

function roleList(features, field) {
  return features && Array.isArray(features[field]) ? features[field] : [];
}

function buildCohesionProfile(cards, metadataResult = {}) {
  const buckets = new Map(COHESION_THEME_DEFINITIONS.map((definition) => [definition.key, {
    definition,
    members: namedRoleCards(),
    supports: namedRoleCards(),
    commanderAligned: false,
  }]));
  const coveredNonlandKeys = new Set();
  let totalSlotCount = 0;
  let knownSlotCount = 0;
  let nonlandCoveredCount = 0;

  (Array.isArray(cards) ? cards : []).forEach((card) => {
    if (!card || card.section === 'companion') return;
    const count = Number(card.count) || 0;
    if (count <= 0) return;
    totalSlotCount += count;
    const metadata = metadataForCard(card, metadataResult);
    const features = metadata && metadata.strengthFeatures;
    if (!features || features.known !== true) return;
    knownSlotCount += count;
    if (!features.nonland) return;

    const key = profileCardKey(card);
    const name = metadata.name || card.name;
    const roles = roleList(features, 'cohesionRoles');
    if (card.section === 'commander') {
      COHESION_THEME_DEFINITIONS.forEach((definition) => {
        if (roles.includes(`${definition.key}-support`)) {
          buckets.get(definition.key).commanderAligned = true;
        }
      });
      return;
    }

    nonlandCoveredCount += count;
    coveredNonlandKeys.add(key);
    COHESION_THEME_DEFINITIONS.forEach((definition) => {
      const bucket = buckets.get(definition.key);
      if (roles.includes(`${definition.key}-member`)) addNamedRole(bucket.members, key, name);
      if (roles.includes(`${definition.key}-support`)) addNamedRole(bucket.supports, key, name);
    });
  });

  const featureCoverage = totalSlotCount ? knownSlotCount / totalSlotCount : 0;
  const reliable = featureCoverage >= FEATURE_COVERAGE_THRESHOLD
    && nonlandCoveredCount >= FEATURE_MIN_NONLAND_SLOTS;
  const nonlandUniqueCount = coveredNonlandKeys.size;
  const themes = COHESION_THEME_DEFINITIONS.map((definition) => {
    const bucket = buckets.get(definition.key);
    const related = new Map([...bucket.members, ...bucket.supports]);
    const memberCount = bucket.members.size;
    const supportCount = bucket.supports.size;
    const relatedCount = related.size;
    const density = nonlandUniqueCount ? relatedCount / nonlandUniqueCount : 0;
    const qualifies = reliable
      && memberCount >= definition.member
      && supportCount >= definition.support
      && relatedCount >= definition.related
      && density >= definition.density;
    const strong = qualifies
      && memberCount >= definition.strongMember
      && supportCount >= definition.strongSupport
      && relatedCount >= definition.strongRelated
      && density >= definition.strongDensity
      && (bucket.commanderAligned || supportCount >= definition.strongSupport + 2);
    const completion = Math.min(
      memberCount / definition.member,
      supportCount / definition.support,
      relatedCount / definition.related,
      definition.density ? density / definition.density : 0,
    );
    return {
      key: definition.key,
      label: definition.label,
      memberCount,
      supportCount,
      relatedCount,
      density: rounded(density),
      commanderAligned: bucket.commanderAligned,
      qualifies,
      strong,
      completion: rounded(completion),
      priority: definition.priority,
      memberCards: Array.from(bucket.members.values()).sort((a, b) => a.localeCompare(b)),
      supportCards: Array.from(bucket.supports.values()).sort((a, b) => a.localeCompare(b)),
    };
  });
  const dominantTheme = themes
    .filter((theme) => theme.qualifies)
    .sort((a, b) => Number(b.strong) - Number(a.strong)
      || b.completion - a.completion
      || b.priority - a.priority
      || a.label.localeCompare(b.label))[0] || null;
  const triggerCards = dominantTheme
    ? Array.from(new Set(dominantTheme.memberCards.concat(dominantTheme.supportCards)))
      .sort((a, b) => a.localeCompare(b))
    : [];

  return {
    available: knownSlotCount > 0,
    reliable,
    featureCoverage: rounded(featureCoverage),
    totalSlotCount,
    knownSlotCount,
    nonlandCoveredCount,
    nonlandUniqueCount,
    themes,
    dominantTheme,
    band: dominantTheme ? (dominantTheme.strong ? 4 : 3) : 1,
    triggerCards,
  };
}

function normalizedCardKey(value) {
  return normalizeCardName(value).toLowerCase();
}

function findDistinctRoleTriple(roleCards, roleNames, excludedKeys) {
  const first = Array.from((roleCards.get(roleNames[0]) || new Map()).entries());
  const second = Array.from((roleCards.get(roleNames[1]) || new Map()).entries());
  const third = Array.from((roleCards.get(roleNames[2]) || new Map()).entries());
  for (let firstIndex = 0; firstIndex < first.length; firstIndex += 1) {
    const [firstKey, firstName] = first[firstIndex];
    if (excludedKeys.has(firstKey)) continue;
    for (let secondIndex = 0; secondIndex < second.length; secondIndex += 1) {
      const [secondKey, secondName] = second[secondIndex];
      if (secondKey === firstKey || excludedKeys.has(secondKey)) continue;
      const payoff = third.find(([thirdKey]) => (
        thirdKey !== firstKey && thirdKey !== secondKey && !excludedKeys.has(thirdKey)
      ));
      if (payoff) return [firstName, secondName, payoff[1]];
    }
  }
  return null;
}

function buildComboPotentialProfile(cards, metadataResult = {}, exclusions = {}) {
  const excludedCards = normalizedExclusionSet(exclusions.excludedCards);
  const normalizedExcludedCards = new Set(Array.from(excludedCards, normalizedCardKey));
  const roleCards = new Map();
  let totalSlotCount = 0;
  let knownSlotCount = 0;
  let nonlandCoveredCount = 0;

  (Array.isArray(cards) ? cards : []).forEach((card) => {
    if (!card || card.section === 'companion') return;
    const count = Number(card.count) || 0;
    if (count <= 0) return;
    totalSlotCount += count;
    const metadata = metadataForCard(card, metadataResult);
    const features = metadata && metadata.strengthFeatures;
    if (!features || features.known !== true) return;
    knownSlotCount += count;
    if (!features.nonland) return;
    nonlandCoveredCount += count;

    const key = profileCardKey(card);
    if (normalizedExcludedCards.has(key)) return;
    const name = metadata.name || card.name;
    roleList(features, 'comboRoles').forEach((role) => {
      if (!roleCards.has(role)) roleCards.set(role, namedRoleCards());
      addNamedRole(roleCards.get(role), key, name);
    });
  });

  const featureCoverage = totalSlotCount ? knownSlotCount / totalSlotCount : 0;
  const reliable = featureCoverage >= FEATURE_COVERAGE_THRESHOLD
    && nonlandCoveredCount >= FEATURE_MIN_NONLAND_SLOTS;
  const usedKeys = new Set();
  const templates = [
    {
      id: 'creature-sacrifice-recursion',
      label: '生物牺牲递归',
      roles: ['free-creature-sacrifice', 'creature-recursion', 'creature-death-payoff'],
    },
    {
      id: 'artifact-sacrifice-recursion',
      label: '神器牺牲递归',
      roles: ['free-artifact-sacrifice', 'artifact-recursion', 'artifact-death-payoff'],
    },
  ];
  const detectedLoops = [];
  if (reliable) {
    templates.forEach((template) => {
      const matchedCards = findDistinctRoleTriple(roleCards, template.roles, usedKeys);
      if (!matchedCards) return;
      matchedCards.forEach((name) => usedKeys.add(normalizedCardKey(name)));
      detectedLoops.push({
        id: template.id,
        label: template.label,
        cards: matchedCards,
        result: '潜在循环结构，只作强度辅助',
      });
    });
  }
  const triggerCards = Array.from(new Set(detectedLoops.reduce(
    (names, loop) => names.concat(loop.cards),
    [],
  ))).sort((a, b) => a.localeCompare(b));

  return {
    available: knownSlotCount > 0,
    reliable,
    featureCoverage: rounded(featureCoverage),
    totalSlotCount,
    knownSlotCount,
    nonlandCoveredCount,
    potentialLoops: detectedLoops,
    band: detectedLoops.length >= 2 ? 4 : (detectedLoops.length ? 3 : 1),
    triggerCards,
  };
}

module.exports = {
  FEATURE_COVERAGE_THRESHOLD,
  FEATURE_MIN_LAND_SLOTS,
  FEATURE_MIN_NONLAND_SLOTS,
  extractStrengthFeatures,
  buildEfficiencyProfile,
  buildCohesionProfile,
  buildComboPotentialProfile,
};
