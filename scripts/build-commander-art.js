#!/usr/bin/env node
// 把本地指挥官库的卡图直链烤进 config/commander-art.js。
//
// 为什么要烤：本地 100 位指挥官是**固定不变的**一份表，推荐结果、强度分级 hero 底图、
// 战绩头像、EDHTI 导出海报都只从这份表里取名字。运行时再去 Scryfall 解析一次，
// 等于每次开页都为一份编译期就能确定的数据付一趟网络往返——这趟往返还挡在首屏前面。
// 烤进包里之后这四条链路的卡图请求数直接归零，冷启动也不再有「先占位、后跳图」。
//
// 存法：只存 <卡名, scryfallId, 版本时间戳>，三档地址按这条规则拼：
//   https://cards.scryfall.io/<档位>/front/<id[0]>/<id[1]>/<id>.jpg?<ts>
// 这跟 utils/card-art.js 里「不要自己拼路径」的告诫不矛盾——那条针对的是运行时凭卡名
// 瞎猜，这里是**拿到真实 image_uris 之后逐档比对**，规则对不上的卡自动退化成存字面量
// 地址（LITERAL_ART）。规则哪天被 Scryfall 改掉，重新生成会把全部卡塞进 LITERAL_ART，
// 功能不受影响，只是文件变大。生成末尾还会拿生成物反查一遍，不一致就非零退出。
//
// 重新生成：node scripts/build-commander-art.js
// 什么时候要重新生成：config/commanders.js 增删主将之后。
// 不重新生成也不会坏——没烤到的名字照旧走运行时批量解析。

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'miniprogram', 'config', 'commander-art.js');
const COLLECTION_API = 'https://api.scryfall.com/cards/collection';
const BATCH_SIZE = 75;
const BATCH_GAP_MS = 120; // Scryfall 要求控制调用节奏，批次之间留一口气
const { commanders } = require(path.join(ROOT, 'miniprogram', 'config', 'commanders.js'));
const { normalizeCardName } = require(path.join(ROOT, 'miniprogram', 'utils', 'scryfall.js'));
const { compactCdnArt } = require(path.join(ROOT, 'miniprogram', 'utils', 'scryfall-cdn.js'));

// 与 utils/result-display.js 的 splitCommanderNames 同规则：
// 单斜杠是本项目双拍档的写法，双斜杠是单张双面牌名要整体保留。
function splitPartners(name) {
  const value = String(name || '').trim();
  if (!value) return [];
  if (value.indexOf(' / ') >= 0 && value.indexOf(' // ') < 0) {
    return value.split(/\s+\/\s+/).map((item) => item.trim()).filter(Boolean);
  }
  return [value];
}

function cacheKey(name) {
  return normalizeCardName(name).toLowerCase();
}

// /cards/collection 的 name 标识符**只认正面名，给全名一律 not_found**。
// 实测（2026-08）双面、拆分、融合、冒险四类全都如此：
//   'Etali, Primal Conqueror // Etali, Primal Sickness' → 未找到
//   'Etali, Primal Conqueror'                          → 命中（返回的 name 反而是全名）
// 本地主将库里有 10 位是这样写的全名，牌表里 Moxfield 导出的 MDFC 地也全是这个写法，
// 不砍掉后半截，这些卡永远解析不到直链、只能走慢路。
function collectionIdentifier(name) {
  return normalizeCardName(name).split(/\s*\/\/\s*/)[0].trim();
}

function collectNames() {
  const seen = new Set();
  const out = [];
  commanders.forEach((commander) => {
    splitPartners(commander && commander.name).forEach((name) => {
      const key = cacheKey(name);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(normalizeCardName(name));
    });
  });
  return out;
}

function postCollection(names) {
  return new Promise((resolve, reject) => {
    const identifiers = Array.from(new Set(names.map(collectionIdentifier).filter(Boolean)));
    const body = JSON.stringify({ identifiers: identifiers.map((name) => ({ name })) });
    const request = https.request(COLLECTION_API, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'cedh-tutor-build/1.0 (+https://github.com/N1kasepotis/cedh-tutor)',
        'content-length': Buffer.byteLength(body),
      },
    }, (response) => {
      let raw = '';
      response.on('data', (chunk) => { raw += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error('Scryfall 返回 ' + response.statusCode + '：' + raw.slice(0, 200)));
          return;
        }
        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(new Error('解析响应失败：' + error.message));
        }
      });
    });
    request.on('error', reject);
    request.end(body);
  });
}

// 双面牌的 image_uris 挂在 card_faces[0] 上，卡对象本身没有
function faceImageUris(card) {
  return (card && card.image_uris)
    || (card && Array.isArray(card.card_faces) && card.card_faces[0] && card.card_faces[0].image_uris)
    || null;
}

// 能不能压成 <id, 时间戳>。判据在 utils/scryfall-cdn.js，跟运行时落盘用的是同一份，
// 免得构建期和运行时对「地址长什么样」各有一套理解。
function ruleMatches(uris) {
  return compactCdnArt({
    small: uris.small || '',
    normal: uris.normal || '',
    artCrop: uris.art_crop || '',
  });
}

// 一张牌要落多个键：牌表写的名字未必等于 Scryfall 的正式卡名。
// 双面牌尤其明显——牌表写 `Malakir Rebirth`，正式名是 `Malakir Rebirth // Malakir Mire`。
function keysForCard(card) {
  const names = [card.name];
  if (Array.isArray(card.card_faces)) {
    names.push(card.card_faces.map((face) => face && face.name).filter(Boolean).join(' // '));
    card.card_faces.forEach((face) => names.push(face && face.name));
  }
  return Array.from(new Set(names.filter(Boolean).map(cacheKey).filter(Boolean)));
}

function quote(value) {
  return "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function render(baked, literal, stats) {
  const literalKeys = Object.keys(literal).sort();
  const lines = [];

  lines.push('// 由 scripts/build-commander-art.js 生成，请勿手改。');
  lines.push('// 生成日期：' + new Date().toISOString().slice(0, 10));
  lines.push('// 覆盖 config/commanders.js 的全部主将（拍档已拆分）：' + stats.wanted + ' 个名字，');
  lines.push('// 解析命中 ' + stats.resolved + ' 张卡，落表 ' + stats.keys + ' 个键');
  lines.push('//（一张牌的正式名、双面全名、每一面的名字各占一键，因为牌表通常只写正面）。');
  lines.push('//');
  lines.push('// 存的是 <卡名, scryfallId, 版本时间戳>，三档地址由 utils/scryfall-cdn.js 的');
  lines.push('// buildCdnArt 拼出。这条规则在生成时对每一档逐条比对过 Scryfall 真实返回，');
  lines.push('// 对不上的卡不进这张表，而是原样存进下面的 LITERAL_ART（当前 ' + literalKeys.length + ' 张）。');
  lines.push('');
  lines.push("const { buildCdnArt } = require('../utils/scryfall-cdn');");
  lines.push('');
  lines.push('// [归一化卡名, scryfallId, 版本时间戳]');
  lines.push('const BAKED_ART = [');
  baked.forEach((row) => {
    lines.push('  [' + quote(row[0]) + ', ' + quote(row[1]) + ', ' + quote(row[2]) + '],');
  });
  lines.push('];');
  lines.push('');
  lines.push('// [归一化卡名, small, normal, artCrop]——不符合拼接规则的卡走这条逃生舱');
  lines.push('const LITERAL_ART = [');
  literalKeys.forEach((key) => {
    const item = literal[key];
    lines.push('  [' + quote(key) + ', ' + quote(item.small) + ', ' + quote(item.normal) + ', ' + quote(item.artCrop) + '],');
  });
  lines.push('];');
  lines.push('');
  lines.push('const bakedIndex = new Map();');
  lines.push('BAKED_ART.forEach((row) => bakedIndex.set(row[0], { id: row[1], stamp: row[2] }));');
  lines.push('');
  lines.push('const literalIndex = new Map();');
  lines.push('LITERAL_ART.forEach((row) => literalIndex.set(row[0], { small: row[1], normal: row[2], artCrop: row[3] }));');
  lines.push('');
  lines.push('// 拼好的结果缓存住：同一位主将在一屏里会被问很多次（推荐五条 × 两个卡位），');
  lines.push('// 每次重新拼三个字符串没必要。');
  lines.push('const builtCache = new Map();');
  lines.push('');
  lines.push('// 传入已归一化并转小写的卡名；命中返回 { small, normal, artCrop }，未命中返回 null。');
  lines.push('function buildBakedArt(key) {');
  lines.push('  if (!key) return null;');
  lines.push('  if (builtCache.has(key)) return builtCache.get(key);');
  lines.push('');
  lines.push('  const literal = literalIndex.get(key);');
  lines.push('  if (literal) {');
  lines.push('    builtCache.set(key, literal);');
  lines.push('    return literal;');
  lines.push('  }');
  lines.push('');
  lines.push('  const baked = bakedIndex.get(key);');
  lines.push('  if (!baked) return null;');
  lines.push('');
  lines.push('  const built = buildCdnArt(baked.id, baked.stamp);');
  lines.push('  if (!built) return null;');
  lines.push('  builtCache.set(key, built);');
  lines.push('  return built;');
  lines.push('}');
  lines.push('');
  lines.push('function hasBakedArt(key) {');
  lines.push('  return Boolean(key) && (bakedIndex.has(key) || literalIndex.has(key));');
  lines.push('}');
  lines.push('');
  lines.push('module.exports = {');
  lines.push('  BAKED_ART,');
  lines.push('  LITERAL_ART,');
  lines.push('  buildBakedArt,');
  lines.push('  hasBakedArt,');
  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const wanted = collectNames();
  console.log('指挥官名字（拍档已拆分、已去重）：' + wanted.length);

  const cards = [];
  const notFound = [];
  for (let i = 0; i < wanted.length; i += BATCH_SIZE) {
    const batch = wanted.slice(i, i + BATCH_SIZE);
    process.stdout.write('  批次 ' + (Math.floor(i / BATCH_SIZE) + 1) + '：' + batch.length + ' 个名字 … ');
    // eslint-disable-next-line no-await-in-loop
    const payload = await postCollection(batch);
    (payload.data || []).forEach((card) => cards.push(card));
    (payload.not_found || []).forEach((item) => notFound.push(item.name));
    console.log('命中 ' + (payload.data || []).length + '，未找到 ' + (payload.not_found || []).length);
    if (i + BATCH_SIZE < wanted.length) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, BATCH_GAP_MS));
    }
  }

  const baked = [];
  const literal = {};
  const takenKeys = new Set();
  cards.forEach((card) => {
    const uris = faceImageUris(card);
    if (!uris) {
      console.warn('  ！' + card.name + ' 没有 image_uris，跳过');
      return;
    }
    const compact = ruleMatches(uris);
    keysForCard(card).forEach((key) => {
      if (takenKeys.has(key)) return;
      takenKeys.add(key);
      if (compact) {
        baked.push([key, compact.id, compact.stamp]);
      } else {
        literal[key] = {
          small: uris.small || uris.normal || '',
          normal: uris.normal || uris.large || uris.small || '',
          artCrop: uris.art_crop || uris.normal || '',
        };
      }
    });
  });

  baked.sort((a, b) => (a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0)));

  if (notFound.length) {
    console.warn('未找到的名字（会照旧走运行时解析）：' + notFound.join('、'));
  }

  const source = render(baked, literal, {
    wanted: wanted.length,
    resolved: cards.length,
    keys: baked.length + Object.keys(literal).length,
  });
  fs.writeFileSync(OUT_FILE, source, 'utf8');

  console.log('');
  console.log('落表：压缩存储 ' + baked.length + ' 键 + 字面量 ' + Object.keys(literal).length + ' 键');
  console.log('写入：' + path.relative(ROOT, OUT_FILE) + '（' + (Buffer.byteLength(source) / 1024).toFixed(1) + 'KB）');

  // 自检：拿生成物反查每一张卡，逐档比对 Scryfall 原样返回。
  // 没有这一步，拼接规则出错时只会表现成「线上卡图 404」，而不是构建失败。
  delete require.cache[require.resolve(OUT_FILE)];
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const generated = require(OUT_FILE);
  let checked = 0;
  let failed = 0;
  cards.forEach((card) => {
    const uris = faceImageUris(card);
    if (!uris) return;
    const built = generated.buildBakedArt(cacheKey(card.name));
    if (!built) {
      failed += 1;
      console.error('  ✗ ' + card.name + ' 没落进生成物');
      return;
    }
    checked += 1;
    if (built.small !== uris.small || built.normal !== uris.normal || built.artCrop !== uris.art_crop) {
      failed += 1;
      console.error('  ✗ ' + card.name + ' 拼出的地址与 Scryfall 返回不一致');
    }
  });
  console.log('自检：' + checked + ' 张卡逐档比对，不一致 ' + failed + ' 处');
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error('生成失败：' + error.message);
  process.exit(1);
});
