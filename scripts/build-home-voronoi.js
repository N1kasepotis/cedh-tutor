#!/usr/bin/env node
/**
 * 生成首页背景的 Voronoi 线段，输出 miniprogram/config/home-voronoi.js。
 *
 *   node scripts/build-home-voronoi.js
 *
 * 为什么是 Voronoi：首页测试把 border-radius 锁死为唯一一条 `0`，圆环类母题根本画不了；
 * 又禁 gradient / background-image / clip-path，所以图、渐变、多边形裁切都用不上。
 * 剩下能用的只有「直线段 + transform 旋转 + 既有色板」。Voronoi 的胞元边恰好全是直线段，
 * 且它是 Delaunay 三角剖分的对偶，天然不规则、不存在重复单元——正好要的就是不规律。
 *
 * 种子用泊松盘采样（蓝噪声）而不是均匀随机：纯随机会结块也会留空洞，蓝噪声疏密有致，
 * 看上去才像有机结构而不是噪点。
 *
 * 算法用半平面裁剪：每个种子从整个画布矩形出发，逐一被它与其他种子的中垂线裁掉外侧，
 * 剩下的凸多边形就是它的胞元。O(n²) 但 n 只有二十几个，且是构建期一次性计算。
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const TARGET = path.join(root, 'miniprogram/config/home-voronoi.js');

// 画布用 0-100 的百分比坐标系，渲染时直接映射成 %，与屏幕尺寸解耦
const W = 100;
const H = 100;
const SEED_COUNT = 22;
const MIN_DIST = 15;      // 泊松盘半径，控制疏密
const RANDOM_SEED = 20260728;

// 固定种子的 PRNG（mulberry32）：同一份输入永远得到同一张图，构建可复现
function makeRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poissonSeeds(random) {
  const points = [];
  let guard = 0;
  while (points.length < SEED_COUNT && guard < 20000) {
    guard += 1;
    // 允许越界一点，让胞元自然被画布裁掉，形成「更大结构的一角」而不是完整封闭图案
    const p = { x: random() * (W + 40) - 20, y: random() * (H + 40) - 20 };
    if (points.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= MIN_DIST)) points.push(p);
  }
  return points;
}

// 用半平面 ax + by <= c 裁剪凸多边形（Sutherland–Hodgman）
function clip(polygon, a, b, c) {
  const out = [];
  const inside = (p) => a * p.x + b * p.y <= c + 1e-9;
  for (let i = 0; i < polygon.length; i += 1) {
    const cur = polygon[i];
    const nxt = polygon[(i + 1) % polygon.length];
    const curIn = inside(cur);
    const nxtIn = inside(nxt);
    if (curIn) out.push(cur);
    if (curIn !== nxtIn) {
      const d1 = a * cur.x + b * cur.y - c;
      const d2 = a * nxt.x + b * nxt.y - c;
      const t = d1 / (d1 - d2);
      out.push({ x: cur.x + t * (nxt.x - cur.x), y: cur.y + t * (nxt.y - cur.y) });
    }
  }
  return out;
}

function voronoiEdges(seeds) {
  const box = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  const seen = new Set();
  const edges = [];

  seeds.forEach((s) => {
    let cell = box;
    seeds.forEach((o) => {
      if (o === s) return;
      // s 与 o 的中垂线：靠 s 的那一侧保留
      const a = o.x - s.x;
      const b = o.y - s.y;
      const c = (o.x * o.x - s.x * s.x + o.y * o.y - s.y * s.y) / 2;
      cell = clip(cell, a, b, c);
      if (!cell.length) return;
    });
    if (cell.length < 2) return;

    for (let i = 0; i < cell.length; i += 1) {
      const p = cell[i];
      const q = cell[(i + 1) % cell.length];
      const length = Math.hypot(q.x - p.x, q.y - p.y);
      if (length < 1.2) continue; // 丢掉裁剪产生的碎屑

      // 丢掉贴着画布边缘的那圈边：它们是矩形裁剪的产物，不是真正的胞元分界。
      // 留着会在四周描出一个方框，整张图就变成「一个盒子」，而不是「更大结构的一角」。
      const onEdge = (v, bound) => Math.abs(v - bound) < 0.05;
      const bothOn = (get, bound) => onEdge(get(p), bound) && onEdge(get(q), bound);
      if (bothOn((v) => v.x, 0) || bothOn((v) => v.x, W)
        || bothOn((v) => v.y, 0) || bothOn((v) => v.y, H)) continue;

      // 相邻胞元共享同一条边，去重（按端点四舍五入后的无序键）
      const k = (pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`;
      const key = [k(p), k(q)].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      edges.push({
        x: Number(p.x.toFixed(2)),
        y: Number(p.y.toFixed(2)),
        len: Number(length.toFixed(2)),
        deg: Number((Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI).toFixed(2)),
      });
    }
  });

  return edges;
}

function build() {
  const random = makeRandom(RANDOM_SEED);
  const seeds = poissonSeeds(random);
  const edges = voronoiEdges(seeds);

  // 顶点（三条边交汇处）作为「结点」，Black Orbit 母题里的 junction spark。
  // 只取画布内、且被多条边共用的点，避免边界裁剪点。
  const vertexCount = new Map();
  edges.forEach((e) => {
    const key = `${e.x.toFixed(1)},${e.y.toFixed(1)}`;
    vertexCount.set(key, (vertexCount.get(key) || 0) + 1);
  });
  const nodes = Array.from(vertexCount.entries())
    .filter(([, n]) => n >= 2)
    .map(([key]) => key.split(',').map(Number))
    .filter(([x, y]) => x > 4 && x < 96 && y > 4 && y < 96)
    .slice(0, 6)
    .map(([x, y]) => ({ x, y }));

  const banner = '// 由 scripts/build-home-voronoi.js 生成，请勿手改。\n'
    + '// 首页背景的 Voronoi 线场：坐标为 0-100 百分比，渲染时映射成 %，与屏幕尺寸解耦。\n'
    + `// 固定随机种子 ${RANDOM_SEED}，同一份输入永远得到同一张图。\n\n`;
  const body = `const HOME_VORONOI_EDGES = ${JSON.stringify(edges)};\n\n`
    + `const HOME_VORONOI_NODES = ${JSON.stringify(nodes)};\n\n`
    + 'module.exports = {\n  HOME_VORONOI_EDGES,\n  HOME_VORONOI_NODES,\n};\n';

  fs.writeFileSync(TARGET, banner + body, 'utf8');
  console.log(`已生成 ${path.relative(root, TARGET)}`);
  console.log(`  种子 ${seeds.length}  线段 ${edges.length}  结点 ${nodes.length}`);
  console.log(`  数据量 ${(Buffer.byteLength(JSON.stringify({ edges, nodes })) / 1024).toFixed(1)} KB`);
  const lens = edges.map((e) => e.len);
  console.log(`  线段长度 ${Math.min(...lens).toFixed(1)}–${Math.max(...lens).toFixed(1)}（越参差越不像规则网格）`);
}

build();
