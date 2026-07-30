#!/usr/bin/env node
/**
 * 比较上游梯度快照与仓库内快照，供 .github/workflows/meta-tier-watch.yml 调用。
 *
 *   node scripts/meta-tier-diff.js <上游 json 路径>
 *
 * 关键点：比的是「解析并规范化后的 JSON」，不是原始字节。
 * 仓库里的 current.json 经 git 的换行符转换后在部分平台上是 CRLF，而上游直出是 LF，
 * 逐字节比较会每周都报「有更新」——那样巡检就成了每周一个空 PR，很快没人看。
 *
 * 顺带做结构校验：上游挂掉时 raw.githubusercontent 会返回 HTML 错误页，
 * 不校验就会把一段 HTML 当快照写进仓库。
 *
 * 输出 KEY=VALUE 行，便于直接喂给 $GITHUB_OUTPUT。
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const LOCAL = path.join(root, 'tools/meta-tier/current.json');

function load(file, label) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`${label} 不是合法 JSON（${file}）：${error.message}`);
  }
  if (!parsed || !Array.isArray(parsed.entries) || !parsed.publication) {
    throw new Error(`${label} 结构不符预期：缺 entries 数组或 publication`);
  }
  return parsed;
}

// 规范化：按 key 排序序列化，消除字段顺序与空白差异，只在「内容真变了」时才判定变化
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function main() {
  const upstreamPath = process.argv[2];
  if (!upstreamPath) throw new Error('用法：node scripts/meta-tier-diff.js <上游 json 路径>');

  const local = load(LOCAL, '本地快照');
  const upstream = load(upstreamPath, '上游快照');

  const changed = canonical(local) !== canonical(upstream);
  const localIds = new Set(local.entries.map((e) => e.id));
  const upstreamIds = new Set(upstream.entries.map((e) => e.id));
  const added = upstream.entries.filter((e) => !localIds.has(e.id)).map((e) => e.id);
  const removed = local.entries.filter((e) => !upstreamIds.has(e.id)).map((e) => e.id);

  const out = [
    `changed=${changed}`,
    `before=${local.publication.id}`,
    `after=${upstream.publication.id}`,
    `before_count=${local.entries.length}`,
    `after_count=${upstream.entries.length}`,
    `added=${added.join(' ')}`,
    `removed=${removed.join(' ')}`,
  ];
  out.forEach((line) => console.log(line));

  if (!changed) return;
  console.error(`上游有更新：${local.publication.id} → ${upstream.publication.id}`);
  if (added.length) console.error(`  新增 ${added.length} 条：${added.join(', ')}`);
  if (removed.length) console.error(`  移除 ${removed.length} 条：${removed.join(', ')}`);
}

main();
