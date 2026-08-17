#!/usr/bin/env node
/**
 * 从 cEDH小屋发布工具链的 `tier-list/public/data/current.json` 生成
 * `miniprogram/config/meta-tier.js`。
 *
 * 为什么要脚本而不是手抄：源文件 74KB、56 条原型，手抄必然漂移；而且有几项过滤
 * 是每次导入都必须做、又极容易忘的（见下）。更新梯度表时把新的 current.json 放到
 * tools/meta-tier/ 覆盖，然后重跑本脚本即可。
 *
 *   node scripts/build-meta-tier.js
 *
 * 本脚本做的事：
 * 1. 只保留 status === 'reviewed' 且 archived !== true 的条目——草稿与已下架不进包。
 * 2. 只保留 tier 落在已声明 tiers 列表里的条目。上游 AGENTS.md 规定 `unranked`
 *    是编辑区、绝不能公开，这里做防御性兜底，不依赖上游一定过滤干净。
 * 3. 从 methodology 里剥掉 QQ 群号那类外部导流信息——微信审核对导流敏感，
 *    但免责声明本身必须保留（署名与方法论义务随数据走）。
 * 4. 丢掉运行时用不到的字段（本地图片路径、scryfall_url、status、source、
 *    updated_at），只留渲染需要的。卡图一律由 scryfall_id 直连，不打包卡图。
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const SOURCE = path.join(root, 'tools/meta-tier/current.json');
const TARGET = path.join(root, 'miniprogram/config/meta-tier.js');

// 外部导流：QQ / 微信群 / 加群 等整句剔除，避免提审风险
const OUTREACH_LINE = /(^|\n)[^\n]*(qq\s*群|QQ群|微信群|加群|群号|\d{6,})[^\n]*/gi;

function sanitizeMethodology(text) {
  return String(text || '')
    .replace(OUTREACH_LINE, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}


// 构建期把主将卡图解析成 cards.scryfall.io 直链，烤进快照。
// 运行时按 ID 取图会打 api.scryfall.com/cards/<id>?format=image——那是 API 端点，
// 每张图先做一次查表再回 302 跳到 CDN，等于两次建连；梯度表一屏就有十几张图，
// 这些跳转全部叠在首屏上。快照是构建期产物，没有任何理由把这步留到运行时。
// 烤进去之后梯度表的卡图是零 API 请求、直连 CDN、可缓存一年。
//
// 尽力而为：构建机没网或 Scryfall 挂了就跳过，条目不带 art 字段，
// 运行时自然回落到按 ID 取图的老路径——构建不该因为取不到图就失败。
const SCRYFALL_COLLECTION_API = 'https://api.scryfall.com/cards/collection';
const COLLECTION_BATCH_SIZE = 75; // Scryfall 该端点的硬上限
// Scryfall 会拒绝使用 HTTP 库默认 UA 的请求（400 generic_user_agent）。
// Node 的 fetch 默认发 undici，必须显式改掉，否则这一步整体失败。
// 小程序运行时不受影响：wx.request 发的是微信自己的 UA，且不允许覆盖该头。
const USER_AGENT = 'cEDHTutor-build/1.0 (+https://github.com/CPP123/cedh-tutor)';

async function resolveCommanderArt(ids) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const found = new Map();
  if (!unique.length || typeof fetch !== 'function') return found;
  for (let i = 0; i < unique.length; i += COLLECTION_BATCH_SIZE) {
    const batch = unique.slice(i, i + COLLECTION_BATCH_SIZE);
    try {
      const response = await fetch(SCRYFALL_COLLECTION_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Accept: 'application/json', 'User-Agent': USER_AGENT },
        body: JSON.stringify({ identifiers: batch.map((id) => ({ id })) }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        console.warn(`  [卡图] 批次 ${i / COLLECTION_BATCH_SIZE + 1} 失败 HTTP ${response.status}：${detail.slice(0, 160)}`);
        continue;
      }
      const payload = await response.json();
      (payload.data || []).forEach((card) => {
        // 双面牌的 image_uris 挂在 card_faces[0] 上，卡对象本身没有
        const uris = card.image_uris
          || (Array.isArray(card.card_faces) && card.card_faces[0] && card.card_faces[0].image_uris);
        if (!uris || !card.id) return;
        found.set(card.id, {
          art: uris.art_crop || uris.normal || '',
          normal: uris.normal || uris.large || '',
        });
      });
    } catch (error) {
      console.warn(`  [卡图] 批次 ${i / COLLECTION_BATCH_SIZE + 1} 异常：${error.message || error}`);
    }
  }
  return found;
}

async function build() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`找不到源数据：${path.relative(root, SOURCE)}\n`
      + '请从 cEDH小屋发布工具链复制 tier-list/public/data/current.json 到该位置。');
  }

  const source = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  const declaredTiers = (source.tiers || []).map((tier) => tier.id);
  const declared = new Set(declaredTiers);

  const dropped = { notReviewed: 0, archived: 0, unknownTier: [] };
  const kept = (source.entries || [])
    .filter((entry) => {
      if (entry.status !== 'reviewed') { dropped.notReviewed += 1; return false; }
      if (entry.archived) { dropped.archived += 1; return false; }
      if (!declared.has(entry.tier)) { dropped.unknownTier.push(`${entry.id}:${entry.tier}`); return false; }
      return true;
    })
    .sort((a, b) => (declaredTiers.indexOf(a.tier) - declaredTiers.indexOf(b.tier))
      || ((a.order || 0) - (b.order || 0)));

  // 只解析真正会收录的条目——被过滤掉的（未审核 / 已下架 / 未声明档位）不该占用请求配额
  const artById = await resolveCommanderArt(
    kept.flatMap((entry) => (entry.commanders || []).map((c) => c.scryfall_id)),
  );

  const entries = kept
    .map((entry) => ({
      id: entry.id,
      tier: entry.tier,
      nameZh: entry.name_zh || entry.name_en,
      nameEn: entry.name_en || '',
      tags: entry.tags || [],
      summary: entry.summary || '',
      winConditions: entry.win_conditions || [],
      strengths: entry.strengths || [],
      weaknesses: entry.weaknesses || [],
      analysis: entry.analysis || '',
      deckUrl: entry.deck_url || '',
      // 只留 scryfall_id：卡图运行时直连 Scryfall（域名已在白名单），不打包卡图
      commanders: (entry.commanders || []).map((commander) => {
        const scryfallId = commander.scryfall_id || '';
        const baked = artById.get(scryfallId);
        return {
          cn: commander.cn || '',
          en: commander.en || '',
          scryfallId,
          // 解析到才写；没有这两个字段时运行时按 ID 回落取图
          ...(baked ? { art: baked.art, normal: baked.normal } : {}),
        };
      }),
    }));

  const site = source.site || {};
  const publication = source.publication || {};
  const config = {
    brand: site.brand || 'cEDH小屋',
    title: site.title || '',
    description: site.description || '',
    methodology: sanitizeMethodology(site.methodology),
    publicationId: publication.id || '',
    publicationTitle: publication.title || '',
    publishedAt: publication.published_at || '',
    tiers: (source.tiers || []).map((tier) => ({
      id: tier.id,
      label: tier.label,
      color: tier.color,
      description: tier.description || '',
    })),
  };

  const banner = `// 由 scripts/build-meta-tier.js 从 tools/meta-tier/current.json 生成，请勿手改。\n`
    + `// 数据来源：${config.brand} 人工编辑的 cEDH 套牌梯度表，经授权收录。\n`
    + `// 快照版本 ${config.publicationId}（${config.publishedAt}）——本页是快照，不联网刷新。\n`
    + `// 更新方式：覆盖 tools/meta-tier/current.json 后重跑 node scripts/build-meta-tier.js\n\n`;

  const body = `const metaTierConfig = ${JSON.stringify(config, null, 2)};\n\n`
    + `const metaTierEntries = ${JSON.stringify(entries, null, 2)};\n\n`
    + `module.exports = {\n  metaTierConfig,\n  metaTierEntries,\n};\n`;

  fs.writeFileSync(TARGET, banner + body, 'utf8');

  const byTier = {};
  entries.forEach((entry) => { byTier[entry.tier] = (byTier[entry.tier] || 0) + 1; });
  console.log(`已生成 ${path.relative(root, TARGET)}`);
  console.log(`  版本 ${config.publicationId}（${config.publishedAt}）`);
  console.log(`  收录 ${entries.length} 条：${JSON.stringify(byTier)}`);
  const bakedCount = entries.reduce((n, e) => n + (e.commanders || []).filter((c) => c.art).length, 0);
  const commanderCount = entries.reduce((n, e) => n + (e.commanders || []).length, 0);
  console.log(`  卡图直链已烤入 ${bakedCount}/${commanderCount}（未解析到的运行时按 ID 回落）`);
  console.log(`  跳过：未审核 ${dropped.notReviewed}、已下架 ${dropped.archived}、`
    + `未声明档位 ${dropped.unknownTier.length}${dropped.unknownTier.length ? ` (${dropped.unknownTier.join(', ')})` : ''}`);
  if (/\d{6,}/.test(config.methodology)) {
    throw new Error('方法论文案里仍有疑似群号／长数字，请检查剥离规则');
  }
  console.log(`  方法论已剥离外部导流信息，剩 ${config.methodology.split('\n').length} 行`);
}

build().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
