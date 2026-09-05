#!/usr/bin/env node
// 固定收录 MOC 的 50 张官方简中时空/异象。改变集合范围需要规则审查与显式迁移。
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const vm = require('node:vm');
const { compactCdnArt, buildCdnArt } = require('../miniprogram/utils/scryfall-cdn');
const { LEGACY_CARD_IDS, PLANAR_ACTIONS } = require('../miniprogram/config/planechase-rules');
const OUT_FILE = path.join(__dirname, '../miniprogram/config/planechase.js');
const QUERY = '(t:plane or t:phenomenon) lang:zhs set:moc';
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.scryfall.com') throw new Error('拒绝非 Scryfall 分页地址');
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await new Promise((resolve, reject) => {
        const req = https.get(url, { headers: {
          'user-agent': 'cedh-tutor-build/2.0 (+https://github.com/N1kasepotis/cedh-tutor)',
          accept: 'application/json',
        } }, (response) => {
          const chunks = [];
          let length = 0;
          response.on('data', (chunk) => {
            length += chunk.length;
            if (length > 8 * 1024 * 1024) { response.destroy(new Error('响应超过 8 MiB')); return; }
            chunks.push(chunk);
          });
          response.on('error', reject);
          response.on('end', () => {
            const status = response.statusCode;
            if (status !== 200) {
              const error = new Error('HTTP ' + status);
              error.retryable = status === 408 || status === 429 || status >= 500;
              reject(error); return;
            }
            try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
          });
        });
        req.setTimeout(15000, () => req.destroy(new Error('Scryfall 请求超时')));
        req.on('error', reject);
      });
    } catch (error) {
      if (attempt >= 2 || error.retryable === false || error instanceof SyntaxError) throw error;
      await pause(500 * (attempt + 1));
    }
  }
}
async function fetchAll() {
  let url = 'https://api.scryfall.com/cards/search?include_multilingual=true&unique=prints&q=' + encodeURIComponent(QUERY);
  const out = [];
  const seen = new Set();
  while (url) {
    if (seen.has(url) || seen.size >= 10) throw new Error('分页循环或页数超限');
    seen.add(url);
    const json = await request(url);
    if (!Array.isArray(json.data) || json.total_cards !== 50 || typeof json.has_more !== 'boolean') throw new Error('集合数量或分页结构改变，请人工审查');
    out.push(...json.data);
    if (json.has_more && typeof json.next_page !== 'string') throw new Error('缺少下一页地址');
    url = json.has_more ? json.next_page : null;
    if (url) await pause(120);
  }
  return out;
}
function buildRows(cards) {
  if (!Array.isArray(cards) || cards.length !== 50) throw new Error('必须取得完整的 50 张快照');
  const rows = cards.map((card) => {
    if (!card || card.set !== 'moc' || card.lang !== 'zhs'
      || !UUID.test(card.id) || !UUID.test(card.oracle_id)
      || !/[一-鿿]/.test(card.printed_name || '') || !/[一-鿿]/.test(card.printed_type_line || '')
      || typeof card.printed_text !== 'string' || !card.printed_text.trim()
      || !/^(Plane\b|Phenomenon$)/.test(card.type_line || '')) throw new Error('卡片字段、语言或类型不完整');
    const uris = card.image_uris;
    const compact = uris && compactCdnArt({ small: uris.small, normal: uris.normal, artCrop: uris.art_crop });
    if (!compact || compact.id !== card.id) throw new Error('卡图 CDN 身份或地址无法验证');
    const built = buildCdnArt(compact.id, compact.stamp);
    if (built.small !== uris.small || built.normal !== uris.normal || built.artCrop !== uris.art_crop) throw new Error('卡图地址往返校验失败');
    const kind = card.type_line === 'Phenomenon' ? 'X' : 'P';
    if (kind === 'P' && !card.printed_text.split(String.fromCharCode(10)).some((line) => /^每当引发混沌/.test(line))) throw new Error('缺少混沌异能');
    return [kind, card.printed_name, card.printed_type_line, card.printed_text, compact.id, compact.stamp, card.oracle_id];
  });
  for (const field of [1, 4, 6]) if (new Set(rows.map((row) => row[field])).size !== 50) throw new Error('快照存在重复身份');
  if (rows.filter((row) => row[0] === 'P').length !== 45) throw new Error('时空/异象数量改变');
  const ids = new Set(rows.map((row) => row[6]));
  if (LEGACY_CARD_IDS.some((id) => !ids.has(id)) || Object.keys(PLANAR_ACTIONS).some((id) => !ids.has(id))) throw new Error('规则或迁移所需卡片缺失');
  return rows.sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
}
function render(rows, date = new Date().toISOString().slice(0, 10)) {
  return [
    '// 由 scripts/build-planechase.js 生成，请勿手改。',
    '// 数据来源：Scryfall（卡面文字与图片版权归威世智及画师所有）。',
    '// 生成日期：' + date,
    '// 固定范围：MOC 官方简中 50 张（时空 45 / 异象 5）。',
    '// 2 人局按共享套牌上限随机移出 1 张异象。',
    '// 每条：[kind, 中文名, 中文类别, 正文, scryfallId, 版本时间戳, oracleId]',
    '// kind：P = Plane，X = Phenomenon；规则身份映射见 planechase-rules.js。',
    'const PLANECHASE_CARDS = ' + JSON.stringify(rows, null, 2) + ';',
    'module.exports = { PLANECHASE_CARDS };', '',
  ].join(String.fromCharCode(10));
}
function writeSnapshot(cards, output = OUT_FILE) {
  // 数据、CDN 与生成代码全部验证后才写临时文件；失败不覆盖原快照。
  const rows = buildRows(cards);
  const source = render(rows);
  const context = { module: { exports: {} } };
  vm.runInNewContext(source, context, { timeout: 1000 });
  if (JSON.stringify(context.module.exports.PLANECHASE_CARDS) !== JSON.stringify(rows)) throw new Error('生成物往返校验失败');
  const temporary = output + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(temporary, source, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, output);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return rows;
}
if (require.main === module) fetchAll().then((cards) => {
  const rows = writeSnapshot(cards);
  console.log('快照已原子更新：' + rows.length + ' 张，字段/身份/卡图/生成语法验证通过');
}).catch((error) => { console.error('生成失败：' + error.message); process.exitCode = 1; });
module.exports = { buildRows, render, writeSnapshot };
