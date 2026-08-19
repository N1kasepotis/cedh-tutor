// 由 scripts/build-commander-art.js 生成，请勿手改。
// 生成日期：2026-08-19
// 覆盖 config/commanders.js 的全部主将（拍档已拆分）：103 个名字，
// 解析命中 103 张卡，落表 123 个键
//（一张牌的正式名、双面全名、每一面的名字各占一键，因为牌表通常只写正面）。
//
// 存的是 <卡名, scryfallId, 版本时间戳>，三档地址由 utils/scryfall-cdn.js 的
// buildCdnArt 拼出。这条规则在生成时对每一档逐条比对过 Scryfall 真实返回，
// 对不上的卡不进这张表，而是原样存进下面的 LITERAL_ART（当前 0 张）。

const { buildCdnArt } = require('../utils/scryfall-cdn');

// [归一化卡名, scryfallId, 版本时间戳]
const BAKED_ART = [
  ['aang, at the crossroads', 'fea89ca0-8070-4f28-9851-994314f9d248', '1783904940'],
  ['aang, at the crossroads // aang, destined savior', 'fea89ca0-8070-4f28-9851-994314f9d248', '1783904940'],
  ['aang, destined savior', 'fea89ca0-8070-4f28-9851-994314f9d248', '1783904940'],
  ['aang, master of elements', 'fe29e909-50e9-4f04-b1a3-2cc5d7e3efe8', '1783904938'],
  ['akiri, line-slinger', '3b951e0c-a4dd-4a20-87c6-eaa947e33aa4', '1783937085'],
  ['animar, soul of elements', 'a3da57d0-1ae3-4f05-a52d-eb76ad56cae7', '1783921859'],
  ['arcum dagsson', 'f5ecf811-2efc-4fa6-9af8-ef09f559ec1a', '1783930205'],
  ['ashling, flame dancer', '40463be5-89e2-410b-9a4b-770f70d14293', '1783911273'],
  ['ashling, the limitless', '5924c01f-2815-4e37-b700-3ba6cc81e0e4', '1783904607'],
  ['atraxa, grand unifier', '4a1f905f-1d55-4d02-9d24-e58070793d3f', '1783918003'],
  ['avatar aang', 'fe29e909-50e9-4f04-b1a3-2cc5d7e3efe8', '1783904938'],
  ['avatar aang // aang, master of elements', 'fe29e909-50e9-4f04-b1a3-2cc5d7e3efe8', '1783904938'],
  ['baylen, the haymaker', '00e93be2-e06b-4774-8ba5-ccf82a6da1d8', '1783910800'],
  ['bjorna, nightfall alchemist', '83b0b716-bcb0-4044-b64a-354e3cbbd563', '1783923612'],
  ['brigid, clachan\'s heart', 'cb7d5bbb-4f68-4e38-8bb0-a95af21b24c8', '1783904517'],
  ['brigid, clachan\'s heart // brigid, doun\'s mind', 'cb7d5bbb-4f68-4e38-8bb0-a95af21b24c8', '1783904517'],
  ['brigid, doun\'s mind', 'cb7d5bbb-4f68-4e38-8bb0-a95af21b24c8', '1783904517'],
  ['captain sisay', 'd24d441c-f37f-44fe-8a93-f5c89df807e4', '1783945664'],
  ['celes, rune knight', '30584c53-533b-4dc7-b07c-8600164a99b3', '1783906375'],
  ['chatterfang, squirrel general', '1785cf85-1ac0-4246-9b89-1a8221a8e1b2', '1783926835'],
  ['dargo, the shipwrecker', '5cd87cf8-4d5d-4aba-8dfa-800b1fb3799b', '1783928817'],
  ['derevi, empyrial tactician', '3a1d0dad-18a8-489e-ac11-08f64b72fda4', '1783936231'],
  ['dihada, binder of wills', 'ddeb54d6-a600-42b9-98df-20f8d58caed8', '1783921477'],
  ['dina, soul steeper', '6ae992b6-506b-4667-884f-4f7fc075b71e', '1783903754'],
  ['ellivere of the wild court', '45851394-b8f3-4713-8239-afcb387d47c5', '1783914992'],
  ['elsha of the infinite', 'c0728027-a1ec-4814-87c4-10c3baced0e0', '1783921837'],
  ['emry, lurker of the loch', 'c977d89a-bfd1-4e98-9d95-3e41c53dd188', '1783906044'],
  ['esper terra', 'fbd447aa-588d-4c4d-925e-a7d3bdf6a65c', '1783906567'],
  ['etali, primal conqueror', '95c14c4d-6c16-4826-8d93-d89ad04aee09', '1783916997'],
  ['etali, primal conqueror // etali, primal sickness', '95c14c4d-6c16-4826-8d93-d89ad04aee09', '1783916997'],
  ['etali, primal sickness', '95c14c4d-6c16-4826-8d93-d89ad04aee09', '1783916997'],
  ['flubs, the fool', '41e58eb8-e5b9-4ef6-be1f-00e28cebb998', '1783910621'],
  ['glarb, calamity\'s augur', 'ffc70b2d-5a3a-49ea-97db-175a62248302', '1783910796'],
  ['green goblin', 'd5c53af9-7150-4e78-8771-2de7980aa307', '1783905356'],
  ['gwenom, remorseless', '46b6cc5d-7a37-4e8b-a1a5-9a573056610c', '1783905344'],
  ['gyruda, doom of depths', '97eb1804-6fd8-4917-af36-87fdfce39d3a', '1783931012'],
  ['halana, kessig ranger', '6bee6eb2-2708-4596-86ad-40eea88dbb6b', '1783928793'],
  ['hashaton, scarab\'s fist', '02645651-cd55-4bd0-8a4d-fa257270a0e0', '1783907754'],
  ['helga, skittish seer', '40339715-22d0-4f99-822b-a00d9824f27a', '1783910795'],
  ['heliod, the radiant dawn', 'a7113c93-6c6d-410f-aeec-abc5ee121cdf', '1783917074'],
  ['heliod, the radiant dawn // heliod, the warped eclipse', 'a7113c93-6c6d-410f-aeec-abc5ee121cdf', '1783917074'],
  ['heliod, the warped eclipse', 'a7113c93-6c6d-410f-aeec-abc5ee121cdf', '1783917074'],
  ['inalla, archmage ritualist', '7c6e803a-451c-4aa6-97a2-400077f32c47', '1783935937'],
  ['iron man, titan of innovation', '20d54b22-62e8-48ac-ba65-0bdbf42d6cad', '1783903309'],
  ['ishai, ojutai dragonspeaker', '2e89ce6a-6bc9-427f-a8b2-c07a9fc3218f', '1783934777'],
  ['jhoira, ageless innovator', 'dd911900-1f5f-4420-96b8-1e4fe67e59f6', '1783921284'],
  ['k\'rrik, son of yawgmoth', '4f087b1c-97e0-4379-a94d-beac53685314', '1783911216'],
  ['kaalia of the vast', 'e71c8c39-3fbb-4a42-9cf6-b3224f5a56fc', '1783911211'],
  ['kediss, emberclaw familiar', 'f606ebf1-483d-4331-b16a-9fb6f591a39f', '1783928811'],
  ['kefka, court mage', '8fcf3fbb-1ddd-437e-81c1-f5a3133f5ee8', '1783906572'],
  ['kefka, court mage // kefka, ruler of ruin', '8fcf3fbb-1ddd-437e-81c1-f5a3133f5ee8', '1783906572'],
  ['kefka, ruler of ruin', '8fcf3fbb-1ddd-437e-81c1-f5a3133f5ee8', '1783906572'],
  ['kenrith, the returned king', '0e259db1-14db-4314-998c-6a076a28d8cb', '1783916113'],
  ['kinnan, bonder prodigy', '63cda4a0-0dff-4edb-ae67-a2b7e2971350', '1783931023'],
  ['kodama of the east tree', 'af5105ee-09e2-4344-ab39-00f0e9034c47', '1783928789'],
  ['korvold, fae-cursed king', '607c1793-8e5a-4ebf-87c6-7f9c99bbd29a', '1783906027'],
  ['krark, the thumbless', '06a981cd-1951-438e-95c9-68294795638e', '1783928810'],
  ['kraum, ludevic\'s opus', '557fcd17-6cb3-414a-b2b1-ea9ae32e5aec', '1783937084'],
  ['kykar, wind\'s fury', 'fdb034c8-bae0-4f66-98f1-1b3cdc072f17', '1783915615'],
  ['leonardo, the balance', '72e637db-7112-406f-809b-0eda248488b5', '1783904176'],
  ['lotho, corrupt shirriff', 'ce01ff8f-a037-484f-9148-c847ffaabc5a', '1783916251'],
  ['lumra, bellow of the woods', 'ae4f3aaf-3960-48cd-b34b-32e4ae5ae088', '1785161492'],
  ['magda, brazen outlaw', '079e6263-e54c-4899-a336-5315909b9322', '1783928229'],
  ['malcolm, keen-eyed navigator', '51187cdb-85ee-4f68-9e29-d84d296f0825', '1783913885'],
  ['maralen, fae ascendant', 'c50f5408-5b5c-41dc-807e-136233403a09', '1783904406'],
  ['marneus calgar', 'e7517e8e-b424-4731-ba9d-6132bdefa6bf', '1783920949'],
  ['michelangelo, the heart', 'bac2d744-db65-4b56-8634-c87fd00c090e', '1783904173'],
  ['najeela, the blade-blossom', '2cb1d1da-6077-46b5-8c63-39882b8016f2', '1783934856'],
  ['narset, enlightened master', 'de4b0d5f-1071-4030-be16-2b4dadbdf9e9', '1783915413'],
  ['nissa, resurgent animist', '248c76d3-b5cb-4582-be17-7cd1d0cb0f58', '1783916520'],
  ['niv-mizzet, parun', '86c5c337-d25f-4c3e-9762-09ed0c2d36d7', '1783911897'],
  ['norman osborn', 'd5c53af9-7150-4e78-8771-2de7980aa307', '1783905356'],
  ['norman osborn // green goblin', 'd5c53af9-7150-4e78-8771-2de7980aa307', '1783905356'],
  ['ob nixilis, captive kingpin', 'ddb68233-3683-41bd-9b6e-4f07a1b54244', '1783916511'],
  ['oswald fiddlebender', 'bba1650f-eddf-49a9-820e-489cb8d5b6fa', '1783926527'],
  ['prossh, skyraider of kher', '889c1a0f-7df2-4497-8058-04358173d7e8', '1783935112'],
  ['rakdos, the muscle', 'bb34babd-1b85-4a7d-a066-a8337805056e', '1783911786'],
  ['ral, leyline prodigy', '438d8a26-ddc9-4829-8aff-22d6af6575cf', '1783911228'],
  ['ral, monsoon mage', '438d8a26-ddc9-4829-8aff-22d6af6575cf', '1783911228'],
  ['ral, monsoon mage // ral, leyline prodigy', '438d8a26-ddc9-4829-8aff-22d6af6575cf', '1783911228'],
  ['raph & mikey, troublemakers', '8795fba4-0ff3-4c04-a81c-60408608a00c', '1783904069'],
  ['rocco, cabaretti caterer', 'b6cf8b35-2a81-40fd-b383-becb81bef806', '1783923072'],
  ['rograkh, son of rohgahh', 'a4fab67f-00c2-4125-9262-d21a29411797', '1783928807'],
  ['rona, herald of invasion', 'f487b582-e73f-4325-939f-95fc5a9aba49', '1783917031'],
  ['rona, herald of invasion // rona, tolarian obliterator', 'f487b582-e73f-4325-939f-95fc5a9aba49', '1783917031'],
  ['rona, tolarian obliterator', 'f487b582-e73f-4325-939f-95fc5a9aba49', '1783917031'],
  ['rowan, scion of war', '4ee179ab-a15b-4bd6-b7f8-1e1abeeb31b7', '1783915070'],
  ['sakashima of a thousand faces', '714c3a1f-7b30-4ed8-8f38-6176758741fb', '1783928853'],
  ['sami, wildcat captain', 'bed64207-9193-4770-8f8f-e3203289d5a6', '1783905925'],
  ['scion of the ur-dragon', '565b2a40-57b1-451f-8c2a-e02222502288', '1783935875'],
  ['selvala, explorer returned', '28c1b84a-a21b-4df1-9fc9-5b387fb56810', '1786381273'],
  ['selvala, heart of the wilds', '812856be-cf51-42de-96d2-4ac91e71d442', '1783904541'],
  ['shorikai, genesis engine', '969ac7dd-f3aa-4888-9ff0-d16a31b5e7a9', '1783923999'],
  ['silas renn, seeker adept', '4e3fe912-1374-47c7-b73f-89ef55c479c1', '1783937082'],
  ['sisay, weatherlight captain', '5a293c45-1e73-4527-be2f-2dcd5c47b610', '1783933156'],
  ['stella lee, wild card', '2a8a7696-b5d9-4378-9d5c-2c9007e4df63', '1783911971'],
  ['talion, the kindly lord', '62a6b452-c796-45c6-b4d1-0ae3d675e38e', '1783915070'],
  ['tameshi, reality architect', '26594b52-3e9c-4cde-88df-1f4e9e16676e', '1783923894'],
  ['tana, the bloodsower', 'a3d8d64f-a403-42a7-881b-4f70e9fe15a2', '1783937081'],
  ['tasigur, the golden fang', '175ad810-3cdd-43c7-99a9-8a2e8ad6dbae', '1783907079'],
  ['tatyova, benthic druid', 'eabc978a-0666-472d-bdc6-d4b29d29eca4', '1783909051'],
  ['tayam, luminous enigma', '05b837a2-5773-4340-87f9-b4d6a43deb27', '1783931228'],
  ['teferi, temporal archmage', '368c6e60-804c-447c-bc2b-ac9dc4cab5e7', '1783915687'],
  ['terra, magical adept', 'fbd447aa-588d-4c4d-925e-a7d3bdf6a65c', '1783906567'],
  ['terra, magical adept // esper terra', 'fbd447aa-588d-4c4d-925e-a7d3bdf6a65c', '1783906567'],
  ['tevesh szat, doom of fools', '8f244716-78ab-46f5-b6e9-fc1e6db28052', '1783928825'],
  ['the cabbage merchant', '2fea0356-6684-4730-9eb4-0262856bc1f9', '1783904816'],
  ['the gitrog monster', '40489e28-878d-44a2-847f-07beef1aa0f8', '1783906028'],
  ['the master of keys', '3545341b-dacc-4ac8-976e-39754a62bbc3', '1783909663'],
  ['thrasios, triton hero', '21e27b91-c7f1-4709-aa0d-8b5d81b22a0a', '1783937081'],
  ['tivit, seller of secrets', '9235977e-a999-4ed0-83a3-742be87b13bb', '1783923378'],
  ['tymna the weaver', 'bc7cbe9b-324e-42b8-94e2-36e91cb32163', '1783937081'],
  ['urza, lord high artificer', '7b7a348a-51f7-4dc5-8fe7-1c70fea5e050', '1783915686'],
  ['vial smasher the fierce', 'cc7be939-2202-40fe-8899-a05682d76190', '1783909586'],
  ['vivi ornitier', 'ecc1027a-8c07-44a0-bdde-fa2844cff694', '1783906561'],
  ['wernog, rider\'s chaplain', '39491011-bdf6-4e61-8534-fe26c1571f8f', '1783923608'],
  ['winota, joiner of forces', '5dd13a6c-23d3-44ce-a628-cb1c19d777c4', '1783931014'],
  ['y\'shtola, night\'s blessed', 'c7f2c2d5-e052-49e8-b5de-712858c2ea78', '1783906373'],
  ['yisan, the wanderer bard', '94e3a130-deeb-4bf4-a1f6-9219c3d8c373', '1783915616'],
  ['yoshimaru, ever faithful', 'aa409269-3698-42a2-8c51-75557b27a6f6', '1783923987'],
  ['yuriko, the tiger\'s shadow', 'fe9be3e0-076c-4703-9750-2a6b0a178bc9', '1783915606'],
  ['zhulodok, void gorger', 'a015461d-4214-4feb-8b04-519c537759eb', '1783915492'],
  ['zirda, the dawnwaker', '1bd8e61c-2ee8-4243-a848-7008810db8a0', '1783931007'],
];

// [归一化卡名, small, normal, artCrop]——不符合拼接规则的卡走这条逃生舱
const LITERAL_ART = [
];

const bakedIndex = new Map();
BAKED_ART.forEach((row) => bakedIndex.set(row[0], { id: row[1], stamp: row[2] }));

const literalIndex = new Map();
LITERAL_ART.forEach((row) => literalIndex.set(row[0], { small: row[1], normal: row[2], artCrop: row[3] }));

// 拼好的结果缓存住：同一位主将在一屏里会被问很多次（推荐五条 × 两个卡位），
// 每次重新拼三个字符串没必要。
const builtCache = new Map();

// 传入已归一化并转小写的卡名；命中返回 { small, normal, artCrop }，未命中返回 null。
function buildBakedArt(key) {
  if (!key) return null;
  if (builtCache.has(key)) return builtCache.get(key);

  const literal = literalIndex.get(key);
  if (literal) {
    builtCache.set(key, literal);
    return literal;
  }

  const baked = bakedIndex.get(key);
  if (!baked) return null;

  const built = buildCdnArt(baked.id, baked.stamp);
  if (!built) return null;
  builtCache.set(key, built);
  return built;
}

function hasBakedArt(key) {
  return Boolean(key) && (bakedIndex.has(key) || literalIndex.has(key));
}

module.exports = {
  BAKED_ART,
  LITERAL_ART,
  buildBakedArt,
  hasBakedArt,
};
