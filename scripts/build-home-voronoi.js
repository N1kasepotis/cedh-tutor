#!/usr/bin/env node
/**
 * 生成首页整页背景的 Voronoi 线段，输出 miniprogram/config/home-voronoi.js。
 *
 *   node scripts/build-home-voronoi.js
 *
 * 为什么是 Voronoi：首页测试把 border-radius 锁死为唯一一条 `0`，圆环类母题根本画不了；
 * 又禁 gradient / background-image / clip-path，所以图、渐变、多边形裁切都用不上。
 * 剩下能用的只有「直线段 + transform + 既有色板」。Voronoi 的胞元边恰好全是直线段，
 * 且它是 Delaunay 三角剖分的对偶，天然不规则、不存在重复单元——正好要的就是不规律。
 *
 * 种子用泊松盘采样（蓝噪声）而不是均匀随机：纯随机会结块也会留空洞，蓝噪声疏密有致，
 * 看上去才像有机结构而不是噪点。
 *
 * 算法用半平面裁剪：每个种子从一个大矩形出发，逐一被它与其他种子的中垂线裁掉外侧，
 * 剩下的凸多边形就是它的胞元。O(n²) 但 n 只有几十个，且是构建期一次性计算。
 *
 * 纵向周期：线场在页面上匀速往一个方向流（2026-11-20 起），要无缝循环，几何就必须在纵向上
 * 周期重复——滚完一个周期跳回起点时，画面和跳之前一模一样，看不到接缝。所以这里算的是
 * 纵向周期为 PERIOD 的 Voronoi：
 *   · 种子撒在一个周期带里，泊松盘的距离按纵向环绕计算，接缝两侧不会结块也不会留空；
 *   · 求胞元时每个种子在上下各复制一份（±PERIOD），胞元跨过接缝也能自然闭合；
 *   · 每条边只留一个代表（中点平移进 [0, PERIOD)），页面把同一份数据摆两遍、
 *     第二遍下移一个周期，拼起来就是连续的线场。
 * PERIOD 比最长的屏还长，一屏之内看不到重复的图案。
 *
 * 坐标单位统一是 vw（视口宽的百分之一），x / y / len 三者同单位。这一点是整页铺开的关键：
 * 若用百分比，x 与 len 会按容器宽解析、y 按容器高解析，容器一旦不是正方形，线段就落不到
 * 该落的端点上，胞元在交汇处裂开。全部走 vw 则与容器尺寸和屏幕长宽比都无关。
 *
 * 收尾两道处理都是为了「胞元必须闭合」——真机上看到的空缺全出在这两处：
 *   1) 顶点吸附到 0.01vw 网格后再去重。相邻两个胞元各自算一遍同一条边，浮点尾数不同，
 *      不吸附就会去重失败、端点错开。
 *   2) 端头按夹角补长。线段是 1px 厚的矩形、端头是平的，两条矩形在夹角 θ 处相接时外侧会
 *      露出一块楔形，深度约 (w/2)/tan(θ/2)——夹角越小缺口越深，所以只有*有些*交汇处看着是空的。
 *      每个端头按它自己那个顶点的最小夹角补，钝角顶点几乎不补，不会在顶点上糊出一个点。
 */

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const TARGET = path.join(root, 'miniprogram/config/home-voronoi.js');

// 宽 100vw = 整屏宽。纵向周期 300vw：最长的屏是 2.4 的长宽比、240vw 高，
// 页面从周期带里截一屏来显示，上下还要各留出一条边能伸出代表区的余量（见 margin）。
const W = 100;
const PERIOD = 300;
const SCREEN_MAX = 240;
// 只在左右外扩：线场不再旋转，纵向又是周期的，外扩只为让贴边的胞元从屏幕外伸进来，
// 而不是在屏幕边缘围出一个封闭图案。
const OVERSCAN = 10;
const SEED_COUNT = 28;
const MIN_DIST = 26; // 泊松盘半径，直接决定胞元大小
const RANDOM_SEED = 20260806;

const SNAP = 100;        // 顶点吸附到 1/100 vw 网格（0.04px，看不出来）
const CRUMB = 0.03;      // 只丢真正的数值碎屑；别再按「太短」丢边，那会丢掉真实的短边并留下缺口
// 线宽按最窄机型折算：1px 在 320 宽的屏上 = 0.3125vw。按最宽的那个折算值补，
// 才能保证所有机型上都补够。
const LINE_W = 100 / 320;

const snap = (v) => Math.round(v * SNAP) / SNAP;

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

// 纵向环绕的距离：周期带的顶和底是同一条接缝
function wrappedDistance(p, q) {
  const dy = Math.abs(p.y - q.y);
  return Math.hypot(p.x - q.x, Math.min(dy, PERIOD - dy));
}

function poissonSeeds(random) {
  const points = [];
  let guard = 0;
  while (points.length < SEED_COUNT && guard < 40000) {
    guard += 1;
    const p = {
      x: random() * (W + OVERSCAN * 2) - OVERSCAN,
      y: random() * PERIOD,
    };
    if (points.every((q) => wrappedDistance(p, q) >= MIN_DIST)) points.push(p);
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

function shiftSegment(segment, dy) {
  return {
    p: { x: segment.p.x, y: snap(segment.p.y + dy) },
    q: { x: segment.q.x, y: snap(segment.q.y + dy) },
  };
}

// 求出一个周期里的全部胞元边：端点吸附到网格，每条边只留一个代表
function voronoiSegments(seeds) {
  const lo = -OVERSCAN;
  const hi = W + OVERSCAN;
  // 上下各复制一份种子，接缝附近的胞元才知道另一侧的邻居
  const neighbours = [];
  [-1, 0, 1].forEach((k) => {
    seeds.forEach((s, index) => neighbours.push({ x: s.x, y: s.y + k * PERIOD, index, k }));
  });
  const seen = new Set();
  const segments = [];
  let emptyCells = 0;

  seeds.forEach((s, index) => {
    let cell = [
      { x: lo, y: s.y - PERIOD }, { x: hi, y: s.y - PERIOD },
      { x: hi, y: s.y + PERIOD }, { x: lo, y: s.y + PERIOD },
    ];
    neighbours.forEach((o) => {
      if (o.index === index && o.k === 0) return;
      // s 与 o 的中垂线：靠 s 的那一侧保留。o 可以是 s 自己上下的复制品，它们把胞元限制在一个周期内
      const a = o.x - s.x;
      const b = o.y - s.y;
      const c = (o.x * o.x - s.x * s.x + o.y * o.y - s.y * s.y) / 2;
      cell = clip(cell, a, b, c);
    });
    if (cell.length < 2) {
      emptyCells += 1;
      return;
    }

    for (let i = 0; i < cell.length; i += 1) {
      const p = { x: snap(cell[i].x), y: snap(cell[i].y) };
      const q = { x: snap(cell[(i + 1) % cell.length].x), y: snap(cell[(i + 1) % cell.length].y) };
      if (Math.hypot(q.x - p.x, q.y - p.y) < CRUMB) continue;

      // 丢掉贴着左右裁剪框的边：它们是矩形裁剪的产物，不是真正的胞元分界，
      // 留着会描出两条竖直的框线。纵向是周期的，没有上下框。
      const onEdge = (v, bound) => Math.abs(v - bound) < 0.05;
      if ((onEdge(p.x, lo) && onEdge(q.x, lo)) || (onEdge(p.x, hi) && onEdge(q.x, hi))) continue;

      // 每条边只留一个代表：中点平移进 [0, PERIOD)。跨接缝的边会被相邻两个胞元各算一遍、
      // 位置差一个周期，平移之后就落到同一处，精确去重即可。
      const shifted = shiftSegment({ p, q }, -Math.floor((p.y + q.y) / 2 / PERIOD) * PERIOD);
      const k = (pt) => `${pt.x},${pt.y}`;
      const key = [k(shifted.p), k(shifted.q)].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      segments.push(shifted);
    }
  });

  return { segments, emptyCells };
}

// 每个端头需要补多长：取该顶点上与它夹角最小的那条邻边算楔形深度。
// 接缝附近顶点的邻边可能被代表在相邻周期里，所以把上下各一份拼进来一起找。
// 没有邻边（悬在左右裁剪框外沿）就不补。
function capLengths(segments) {
  const count = segments.length;
  const expanded = [
    ...segments,
    ...segments.map((s) => shiftSegment(s, PERIOD)),
    ...segments.map((s) => shiftSegment(s, -PERIOD)),
  ];
  const vertices = new Map();
  const add = (pt, segIndex, dirDeg) => {
    const k = `${pt.x},${pt.y}`;
    if (!vertices.has(k)) vertices.set(k, []);
    vertices.get(k).push({ segIndex, dirDeg });
  };
  expanded.forEach((s, i) => {
    const dir = Math.atan2(s.q.y - s.p.y, s.q.x - s.p.x) * 180 / Math.PI;
    add(s.p, i, dir);
    add(s.q, i, dir + 180);
  });

  const caps = expanded.map(() => ({ start: 0, end: 0 }));
  vertices.forEach((arms, k) => {
    if (arms.length < 2) return;
    arms.forEach((arm) => {
      let minAngle = 180;
      arms.forEach((other) => {
        if (other === arm) return;
        let d = Math.abs(arm.dirDeg - other.dirDeg) % 360;
        if (d > 180) d = 360 - d;
        minAngle = Math.min(minAngle, d);
      });
      const need = (LINE_W / 2) / Math.tan((minAngle / 2) * Math.PI / 180);
      const seg = expanded[arm.segIndex];
      const which = (`${seg.p.x},${seg.p.y}` === k) ? 'start' : 'end';
      caps[arm.segIndex][which] = Math.max(caps[arm.segIndex][which], need);
    });
  });
  return { caps: caps.slice(0, count), vertices };
}

function toEdges(segments, caps) {
  return segments.map((s, i) => {
    const rad = Math.atan2(s.q.y - s.p.y, s.q.x - s.p.x);
    const cap = caps[i];
    return {
      x: Number((s.p.x - cap.start * Math.cos(rad)).toFixed(2)),
      y: Number((s.p.y - cap.start * Math.sin(rad)).toFixed(2)),
      len: Number((Math.hypot(s.q.x - s.p.x, s.q.y - s.p.y) + cap.start + cap.end).toFixed(2)),
      deg: Number((rad * 180 / Math.PI).toFixed(2)),
    };
  });
}

// 一条边最远伸出它的代表区多少。页面上摆两份数据，只有 [margin, 2·PERIOD − margin]
// 这一段是完整的，动画的取景框必须一直落在里面。
function seamMargin(edges) {
  return Math.max(...edges.map((e) => Math.abs(e.len * Math.sin((e.deg * Math.PI) / 180)) / 2));
}

// 按一台 390×844 的手机（长宽比 2.164）预览：从完整段的起点截一屏，两份数据都画进来
function preview(edges, top) {
  const visibleH = 216.4;
  const cols = 46;
  const rows = 38;
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(' '));
  let hit = 0;
  [0, PERIOD].forEach((offset) => {
    edges.forEach((e) => {
      const rad = (e.deg * Math.PI) / 180;
      const steps = Math.ceil(e.len * 4);
      for (let i = 0; i <= steps; i += 1) {
        const t = (i / steps) * e.len;
        const x = e.x + t * Math.cos(rad);
        const y = e.y + offset + t * Math.sin(rad) - top;
        if (x < 0 || x >= W || y < 0 || y >= visibleH) continue;
        const cx = Math.floor((x / W) * cols);
        const cy = Math.floor((y / visibleH) * rows);
        if (grid[cy][cx] === ' ') hit += 1;
        grid[cy][cx] = '·';
      }
    });
  });
  console.log(`  可见区（390×844，从 ${top.toFixed(0)}vw 起截）覆盖 ${((hit / (cols * rows)) * 100).toFixed(1)}%`);
  grid.forEach((row) => console.log(`    |${row.join('')}|`));
}

// 重算一遍几何，不落盘。测试用它验证胞元闭合（顶点度数必须全是 3）、接缝无缝，
// 以及确认仓库里的 config 就是当前脚本的产物、没有被手改或漏跑。
function computeGeometry() {
  const seeds = poissonSeeds(makeRandom(RANDOM_SEED));
  const { segments, emptyCells } = voronoiSegments(seeds);
  const { caps, vertices } = capLengths(segments);
  const edges = toEdges(segments, caps);
  return { seeds, segments, emptyCells, vertices, edges, margin: seamMargin(edges) };
}

function build() {
  const { seeds, emptyCells, vertices, edges, margin } = computeGeometry();

  const banner = '// 由 scripts/build-home-voronoi.js 生成，请勿手改。\n'
    + '// 首页整页背景的 Voronoi 线场。坐标单位统一是 vw（视口宽的百分之一）：\n'
    + '// x / y / len 同单位，因此在任何屏幕长宽比下几何都不变形。\n'
    + '// 端头已按各自顶点的夹角补长，1px 矩形在交汇处不会露出楔形缺口。\n'
    + `// 纵向周期 ${PERIOD}vw：页面把这份数据摆两遍、第二遍下移 ${PERIOD}vw，拼成连续的线场；\n`
    + `// 宽 ${W}vw 左右各外扩 ${OVERSCAN}vw。固定随机种子 ${RANDOM_SEED}，同一份输入永远得到同一张图。\n\n`;
  const body = `const HOME_VORONOI_EDGES = ${JSON.stringify(edges)};\n\n`
    + 'module.exports = {\n  HOME_VORONOI_EDGES,\n};\n';

  fs.writeFileSync(TARGET, banner + body, 'utf8');

  // 自检：胞元闭不闭合，全看顶点度数。Voronoi 的内部顶点度数恒为 3，
  // 出现度数 2 就说明有边被丢掉了，那个顶点在页面上看着就是「空的」。
  // 只看一个周期带里、屏幕宽度以内的顶点；接缝两侧的邻边已经拼进来了。
  const degrees = new Map();
  vertices.forEach((arms, k) => {
    const [x, y] = k.split(',').map(Number);
    if (x < 0 || x > W || y < 0 || y >= PERIOD) return;
    degrees.set(arms.length, (degrees.get(arms.length) || 0) + 1);
  });
  const lens = edges.map((e) => e.len);
  const startMax = PERIOD - SCREEN_MAX - margin;

  console.log(`已生成 ${path.relative(root, TARGET)}`);
  console.log(`  种子 ${seeds.length}  线段 ${edges.length}（页面摆两份，共 ${edges.length * 2} 个节点）  空胞元 ${emptyCells}`);
  console.log(`  数据量 ${(Buffer.byteLength(JSON.stringify(edges)) / 1024).toFixed(1)} KB`);
  console.log(`  线段长度 ${Math.min(...lens).toFixed(1)}–${Math.max(...lens).toFixed(1)}（越参差越不像规则网格）`);
  console.log(`  一周期内顶点度数 ${[...degrees.entries()].sort().map(([d, n]) => `${d}度×${n}`).join('  ')}`
    + `${[...degrees.keys()].some((d) => d !== 3) ? '  ← 有不是 3 度的顶点，胞元没闭合' : '  （全 3 度，胞元闭合）'}`);
  console.log(`  接缝余量 ${margin.toFixed(2)}vw：动画起点偏移要在 ${margin.toFixed(1)}–${startMax.toFixed(1)}vw 之间`
    + `${startMax < margin ? '  ← 周期太短，长屏会露出不完整的一截' : ''}`);
  preview(edges, Math.ceil(margin));
}

module.exports = { computeGeometry, VISIBLE_W: W, PERIOD, SCREEN_MAX, MIN_DIST };

if (require.main === module) build();
