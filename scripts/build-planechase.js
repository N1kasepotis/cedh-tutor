#!/usr/bin/env node
// 把竞逐时空的时空/异象牌烤进 config/planechase.js。
//
// 为什么只收 March of the Machine Commander（moc）这 50 张：
// 全库合法的时空与异象共 161 张，但**有简体中文印刷的只有 moc 这 50 张**——
// 经典的 Planechase Anthology（opca，61 张）从未出过中文，也早已绝版。
// 一副牌里一半读不懂比少 61 张糟糕得多，所以默认牌库只收全中文的这一组。
// 官方共享时空套牌下限是 min(40, 10×人数)，任何人数下 50 张都够，正好合规。
//
// 顺带排掉一个坑：punk「Black Lotus Unknown Planechase」45 张是 set_type=funny、
// commander 判定 not_legal 的店家自制恶搞集，按集合过滤天然不会进来。
//
// 存法与 build-commander-art.js 同规则：只存 <id, 版本时间戳>，三档地址由
// utils/scryfall-cdn.js 的 buildCdnArt 拼出，生成时逐档比对 Scryfall 真实返回。
//
// 取的是**简中印次的 id**，因此全屏看整张卡时是中文卡面；art_crop 的画作与英文印次相同。
//
// 重新生成：node scripts/build-planechase.js
// 什么时候要重新生成：官方出了新的中文时空牌之后。

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'miniprogram', 'config', 'planechase.js');
const QUERY = '(t:plane or t:phenomenon) lang:zhs set:moc';
const PAGE_GAP_MS = 120; // Scryfall 要求控制调用节奏
const { compactCdnArt } = require(path.join(ROOT, 'miniprogram', 'utils', 'scryfall-cdn.js'));

const NEWLINE = String.fromCharCode(10);

function request(url, attempt = 0) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'user-agent': 'cedh-tutor-build/1.0 (+https://github.com/N1kasepotis/cedh-tutor)',
        accept: 'application/json',
      },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode !== 200) {
          if (attempt < 2) {
            setTimeout(() => request(url, attempt + 1).then(resolve, reject), 500 * (attempt + 1));
            return;
          }
          reject(new Error('HTTP ' + response.statusCode + '：' + body.slice(0, 200)));
          return;
        }
        try { resolve(JSON.parse(body)); } catch (cause) { reject(cause); }
      });
    }).on('error', (error) => {
      if (attempt < 2) {
        setTimeout(() => request(url, attempt + 1).then(resolve, reject), 500 * (attempt + 1));
        return;
      }
      reject(error);
    });
  });
}

async function fetchAll() {
  let url = 'https://api.scryfall.com/cards/search?include_multilingual=true&unique=prints&q='
    + encodeURIComponent(QUERY);
  const out = [];
  let page = 0;
  while (url) {
    const json = await request(url);
    if (!Array.isArray(json.data)) throw new Error('返回里没有 data：' + JSON.stringify(json).slice(0, 200));
    out.push(...json.data);
    page += 1;
    process.stdout.write('  拉取第 ' + page + ' 页，累计 ' + out.length + ' 条');
    url = json.has_more ? json.next_page : null;
    if (url) await new Promise((resolve) => { setTimeout(resolve, PAGE_GAP_MS); });
  }
  process.stdout.write(NEWLINE);
  return out;
}

function render(rows, meta) {
  const lines = [
    '// 由 scripts/build-planechase.js 生成，请勿手改。',
    '// 数据来源：Scryfall（卡面文字与图片版权归威世智及画师所有）。',
    '// 生成日期：' + new Date().toISOString().slice(0, 10),
    '//',
    '// 收录范围：March of the Machine Commander（moc）的全部简体中文时空与异象牌，',
    '// 共 ' + meta.total + ' 张（时空 ' + meta.planes + ' / 异象 ' + meta.phenomena + '）。',
    '// 这是全库唯一有官方简中印刷的一组；opca 等集合从未出过中文，因此不收。',
    '// 官方共享时空套牌下限 min(40, 10×人数)，' + meta.total + ' 张在任何人数下都合规。',
    '//',
    '// 每条：[kind, 中文名, 中文类别, 正文, scryfallId, 版本时间戳]',
    '//   kind：P = 时空（Plane），X = 异象（Phenomenon）',
    '//   正文里的换行分隔「常驻异能」与「每当引发混沌时」那一条；异象只有一条',
    '//   三档图片地址由 utils/scryfall-cdn.js 的 buildCdnArt 拼出，生成时逐档比对过',
    '',
    'const PLANECHASE_CARDS = ' + JSON.stringify(rows, null, 2) + ';',
    '',
    'module.exports = {',
    '  PLANECHASE_CARDS,',
    '};',
    '',
  ];
  return lines.join(NEWLINE);
}

async function main() {
  const cards = await fetchAll();
  const rows = [];
  const skipped = [];

  cards.forEach((card) => {
    const uris = card.image_uris;
    const compact = uris ? compactCdnArt({
      small: uris.small, normal: uris.normal, artCrop: uris.art_crop,
    }) : null;
    if (!compact) {
      // 地址拼不回去就整张丢掉并报错退出——宁可构建失败，也不要线上一张 404 的卡图
      skipped.push(card.printed_name || card.name);
      return;
    }
    const kind = /Phenomenon/.test(card.type_line) ? 'X' : 'P';
    rows.push([
      kind,
      card.printed_name || card.name,
      card.printed_type_line || card.type_line,
      card.printed_text || card.oracle_text || '',
      compact.id,
      compact.stamp,
    ]);
  });

  if (skipped.length) {
    console.error('图片地址无法压缩的卡（CDN 规则可能已变）：' + skipped.join('、'));
    process.exit(1);
  }

  rows.sort((a, b) => (a[1] < b[1] ? -1 : (a[1] > b[1] ? 1 : 0)));

  const planes = rows.filter((row) => row[0] === 'P').length;
  const phenomena = rows.length - planes;
  const source = render(rows, { total: rows.length, planes, phenomena });
  fs.writeFileSync(OUT_FILE, source, 'utf8');

  console.log('');
  console.log('落表 ' + rows.length + ' 张（时空 ' + planes + ' / 异象 ' + phenomena + '）');
  console.log('写入 ' + path.relative(ROOT, OUT_FILE) + '（' + (Buffer.byteLength(source) / 1024).toFixed(1) + 'KB）');

  // 自检一：拿生成物反查，逐档比对 Scryfall 原样返回。
  // 没有这一步，拼接规则出错只会表现成「线上卡图 404」，而不是构建失败。
  delete require.cache[require.resolve(OUT_FILE)];
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const generated = require(OUT_FILE);
  const { buildCdnArt } = require(path.join(ROOT, 'miniprogram', 'utils', 'scryfall-cdn.js'));
  const byId = new Map(cards.map((card) => [card.id, card]));
  let failed = 0;
  generated.PLANECHASE_CARDS.forEach((row) => {
    const card = byId.get(row[4]);
    const built = buildCdnArt(row[4], row[5]);
    if (!card || !built) { failed += 1; console.error('  ✗ ' + row[1] + ' 反查不到'); return; }
    if (built.small !== card.image_uris.small
      || built.normal !== card.image_uris.normal
      || built.artCrop !== card.image_uris.art_crop) {
      failed += 1;
      console.error('  ✗ ' + row[1] + ' 拼出的地址与 Scryfall 返回不一致');
    }
  });
  console.log('自检：' + generated.PLANECHASE_CARDS.length + ' 张逐档比对，不一致 ' + failed + ' 处');

  // 自检二：每张时空牌都必须有「每当引发混沌时」那一条，否则掷出混沌无从高亮
  const noChaos = generated.PLANECHASE_CARDS
    .filter((row) => row[0] === 'P' && row[3].indexOf('引发混沌') < 0)
    .map((row) => row[1]);
  console.log('自检：时空牌缺混沌异能 ' + noChaos.length + ' 张' + (noChaos.length ? '（' + noChaos.join('、') + '）' : ''));
  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error('生成失败：' + error.message);
  process.exit(1);
});
