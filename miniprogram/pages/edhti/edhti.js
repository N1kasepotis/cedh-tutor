const {
  edhtiPersonas,
  edhtiPersonaOdds,
  edhtiQuestions,
  edhtiTagLabels,
} = require('../../config/edhti');
const {
  buildEdhtiResult,
  selectEdhtiCommander,
} = require('../../utils/edhti');
const {
  drawRoundRect,
  drawWrappedText,
  drawTrackedText,
  drawImageCover,
  loadCanvasImage,
  exportPosterImage,
} = require('../../utils/canvas-kit');
const {
  buildScryfallImageUrl,
} = require('../../utils/scryfall');
const { getCardArt } = require('../../utils/card-art');
const { formatOptionCode } = require('../../utils/quiz-flow');
const { enableShareMenu } = require('../../utils/share');
const { readStorage, removeStorage, writeStorage } = require('../../utils/storage');
const { titleFontBase64 } = require('../../assets/title-font');

// 只存答案不存算好的结果：结果可由答案确定性重建，配置更新后也不会展示陈旧人格
const EDHTI_STATE_STORAGE_KEY = 'edhtiState';
const EDHTI_STATE_SCHEMA_VERSION = 1;

const EXPORT_WIDTH = 750;
const EXPORT_HEIGHT = 1624;
// 导出成图用固定像素（不乘 DPR）：高分屏上过大的画布会让 canvasToTempFilePath 失败，
// 与 result 页的导出策略保持一致；1080 宽与 result 海报清晰度对齐。
const EXPORT_PIXEL_SCALE = 1080 / EXPORT_WIDTH;
const EXPORT_CANVAS_WIDTH = EXPORT_WIDTH * EXPORT_PIXEL_SCALE;
const EXPORT_CANVAS_HEIGHT = Math.floor(EXPORT_HEIGHT * EXPORT_PIXEL_SCALE);
const EXPORT_FOOTER_HEIGHT = EXPORT_HEIGHT / 10;
const EXPORT_MARGIN = 54;
const MINI_PROGRAM_CODE_SRC = '/assets/cT_logo_v.2.jpg';
const CEDH_HOUSE_QR_SRC = '/assets/cedh-house-qr.jpg';
// 标题预渲染贴图：把「Multiverse EDHTI」烤成 PNG（用 tools/edhti-title-export.html 导出），
// 全平台像素一致，绕过画布 ctx.font 在各系统解析到不同字体的问题。缺图时回退到实时文字。
const TITLE_IMAGE_SRC = '/assets/edhti-title.png';
// 贴图在标题局部坐标系（translate 后、旋转前）的落位框，须与导出器的渲染锚点严格对应。
const TITLE_BOX = { x: -10, y: -88, w: 600, h: 210 };
const EXPORT_FOOTER_BACKGROUND = '#FFFFFF';
const EXPORT_DEEP_BLUE = '#07152F';
const EXPORT_BLUE = '#68C7FF';
const EXPORT_BLUE_LIGHT = '#B9E8FF';
const EXPORT_PINK = '#FF7BC8';
const EXPORT_PINK_LIGHT = '#FFD6EF';
const EXPORT_ELECTRIC_CYAN = '#28F6FF';
const EXPORT_HOT_MAGENTA = '#FF2BD6';
const EXPORT_INK = '#F8FBFF';
const EXPORT_DISPLAY_FONT = '"cEDHDisplay", "Avenir Next Condensed", "Arial Black", sans-serif';
const STAT_LABEL_X = EXPORT_MARGIN + 26;
const STAT_BAR_X = EXPORT_MARGIN + 168;
const STAT_BAR_WIDTH = 360;
const STAT_VALUE_X = STAT_BAR_X + STAT_BAR_WIDTH + 52;
const TAG_HEX_CENTER_X = EXPORT_WIDTH / 4;
const TAG_HEX_CENTER_Y = 1246;
const TAG_HEX_RADIUS = 96;
const ALIGNMENT_GRID_Y = 1180;
const ALIGNMENT_GRID_CELL = 48;
const ALIGNMENT_GRID_CENTER_X = EXPORT_WIDTH * 3 / 4;
const ALIGNMENT_GRID_X = ALIGNMENT_GRID_CENTER_X - ALIGNMENT_GRID_CELL * 1.5;
const EDHTI_ALIGNMENT_THRESHOLD = 2;
const EDHTI_ALIGNMENT_MORAL_LABELS = ['善良', '中立', '邪恶'];
const EDHTI_ALIGNMENT_ORDER_LABELS = ['守序', '中立', '混乱'];
const EDHTI_ALIGNMENT_MORAL_SHORT = ['善', '中', '邪'];
const EDHTI_ALIGNMENT_ORDER_SHORT = ['守', '中', '混'];

const bucketLabels = {
  intent: '胜负动机',
  table: '牌桌行为',
  complexity: '复杂偏好',
  meta: '主流冷门',
  wildcard: '娱乐副标签',
};

function stripTerminalPeriod(value) {
  return String(value || '').replace(/[。.]\s*$/u, '');
}

function stripSentencePeriods(value) {
  return String(value || '').replace(/[。.]/gu, '\n');
}

function spaceSentencePeriods(value) {
  return String(value || '').replace(/[。.]/gu, '。 ');
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return `rgba(40, 246, 255, ${alpha})`;
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawExportTitleLine(ctx, text, x, y) {
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = EXPORT_HOT_MAGENTA;
  ctx.fillText(text, x - 5, y - 5);
  ctx.fillStyle = EXPORT_ELECTRIC_CYAN;
  ctx.fillText(text, x + 5, y + 5);
  ctx.globalAlpha = 1;
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(248, 251, 255, 0.78)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#05060B';
  ctx.fillText(text, x, y);
}

function drawEdhtiSplitGlowBackground(ctx) {
  const background = ctx.createLinearGradient(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  background.addColorStop(0, '#0A0E2D');
  background.addColorStop(0.42, EXPORT_DEEP_BLUE);
  background.addColorStop(0.72, '#0E2558');
  background.addColorStop(1, '#050818');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(292, 0);
  ctx.lineTo(516, EXPORT_HEIGHT);
  ctx.lineTo(0, EXPORT_HEIGHT);
  ctx.closePath();
  ctx.clip();
  const pinkWash = ctx.createLinearGradient(0, 0, EXPORT_WIDTH * 0.72, EXPORT_HEIGHT);
  pinkWash.addColorStop(0, 'rgba(255, 43, 214, 0.46)');
  pinkWash.addColorStop(0.46, 'rgba(255, 123, 200, 0.24)');
  pinkWash.addColorStop(1, 'rgba(255, 123, 200, 0.02)');
  ctx.fillStyle = pinkWash;
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  [
    { x: 136, y: 260, r: 620, c0: 'rgba(255, 43, 214, 0.26)', c1: 'rgba(255, 43, 214, 0.08)', c2: 'rgba(255, 43, 214, 0)' },
    { x: 240, y: 1060, r: 760, c0: 'rgba(255, 123, 200, 0.16)', c1: 'rgba(255, 123, 200, 0.06)', c2: 'rgba(255, 123, 200, 0)' },
  ].forEach((glow) => {
    const radial = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
    radial.addColorStop(0, glow.c0);
    radial.addColorStop(0.5, glow.c1);
    radial.addColorStop(1, glow.c2);
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  });
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(292, 0);
  ctx.lineTo(EXPORT_WIDTH, 0);
  ctx.lineTo(EXPORT_WIDTH, EXPORT_HEIGHT);
  ctx.lineTo(516, EXPORT_HEIGHT);
  ctx.closePath();
  ctx.clip();
  const blueWash = ctx.createLinearGradient(EXPORT_WIDTH, 0, EXPORT_WIDTH * 0.24, EXPORT_HEIGHT);
  blueWash.addColorStop(0, 'rgba(40, 246, 255, 0.42)');
  blueWash.addColorStop(0.48, 'rgba(104, 199, 255, 0.24)');
  blueWash.addColorStop(1, 'rgba(104, 199, 255, 0.02)');
  ctx.fillStyle = blueWash;
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  [
    { x: 652, y: 330, r: 680, c0: 'rgba(40, 246, 255, 0.24)', c1: 'rgba(40, 246, 255, 0.07)', c2: 'rgba(40, 246, 255, 0)' },
    { x: 540, y: 1220, r: 760, c0: 'rgba(104, 199, 255, 0.16)', c1: 'rgba(104, 199, 255, 0.06)', c2: 'rgba(104, 199, 255, 0)' },
  ].forEach((glow) => {
    const radial = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
    radial.addColorStop(0, glow.c0);
    radial.addColorStop(0.55, glow.c1);
    radial.addColorStop(1, glow.c2);
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  });
  ctx.restore();

  const topLight = ctx.createRadialGradient(EXPORT_WIDTH / 2, 0, 0, EXPORT_WIDTH / 2, 0, 760);
  topLight.addColorStop(0, 'rgba(248, 251, 255, 0.12)');
  topLight.addColorStop(0.42, 'rgba(248, 251, 255, 0.04)');
  topLight.addColorStop(1, 'rgba(248, 251, 255, 0)');
  ctx.fillStyle = topLight;
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
}

function drawGlassPanel(ctx, x, y, width, height, radius, options) {
  const config = Object.assign({
    fill: 'rgba(248, 251, 255, 0.08)',
    stroke: 'rgba(185, 232, 255, 0.26)',
    shadow: 'rgba(1, 8, 30, 0.42)',
    topHighlight: true,
  }, options || {});

  ctx.save();
  ctx.shadowColor = config.shadow;
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 20;
  drawRoundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = config.fill;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = config.stroke;
  ctx.stroke();

  drawRoundRect(ctx, x + 12, y + 12, width - 24, height - 24, Math.max(0, radius - 8));
  ctx.strokeStyle = 'rgba(248, 251, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (config.topHighlight !== false) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y + 1);
    ctx.lineTo(x + width - radius, y + 1);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.58)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawNoiseTexture(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < 260; i += 1) {
    const x = (i * 97) % EXPORT_WIDTH;
    const y = (i * 193) % EXPORT_HEIGHT;
    const alpha = 0.035 + ((i % 7) * 0.008);
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

function drawStatBar(ctx, tag, x, y, width, isTop) {
  const height = 14;
  const fillWidth = Math.max(height, width * tag.value / 100);

  ctx.save();
  ctx.fillStyle = 'rgba(185, 232, 255, 0.06)';
  drawRoundRect(ctx, x, y - height, width, height, height / 2);
  ctx.fill();

  const bar = ctx.createLinearGradient(x, y - height, x + width, y - height);
  bar.addColorStop(0, isTop ? EXPORT_HOT_MAGENTA : EXPORT_PINK);
  bar.addColorStop(0.55, '#DCEBFF');
  bar.addColorStop(1, isTop ? EXPORT_ELECTRIC_CYAN : EXPORT_BLUE);
  ctx.shadowColor = isTop ? 'rgba(40, 246, 255, 0.62)' : 'rgba(104, 199, 255, 0.34)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = bar;
  drawRoundRect(ctx, x, y - height, fillWidth, height, height / 2);
  ctx.fill();

  ctx.restore();
}

function drawTagHexagon(ctx, tags, centerX, centerY, radius) {
  const source = (tags || []).slice(0, 6);
  if (!source.length) return;

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  [0.34, 0.67, 1].forEach((scale) => {
    ctx.beginPath();
    source.forEach((tag, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / source.length;
      const x = centerX + Math.cos(angle) * radius * scale;
      const y = centerY + Math.sin(angle) * radius * scale;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();
    ctx.strokeStyle = scale === 1 ? 'rgba(185, 232, 255, 0.22)' : 'rgba(185, 232, 255, 0.10)';
    ctx.lineWidth = scale === 1 ? 1.4 : 1;
    ctx.stroke();
  });

  source.forEach((tag, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / source.length;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.strokeStyle = 'rgba(255, 123, 200, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  const fill = ctx.createLinearGradient(centerX - radius, centerY - radius, centerX + radius, centerY + radius);
  fill.addColorStop(0, 'rgba(255, 43, 214, 0.28)');
  fill.addColorStop(1, 'rgba(40, 246, 255, 0.26)');
  ctx.beginPath();
  source.forEach((tag, index) => {
    const value = Math.max(0, Math.min(100, Number(tag.value) || 0)) / 100;
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / source.length;
    const x = centerX + Math.cos(angle) * radius * value;
    const y = centerY + Math.sin(angle) * radius * value;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = EXPORT_ELECTRIC_CYAN;
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(40, 246, 255, 0.38)';
  ctx.shadowBlur = 12;
  ctx.stroke();

  source.forEach((tag, index) => {
    const value = Math.max(0, Math.min(100, Number(tag.value) || 0)) / 100;
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / source.length;
    const x = centerX + Math.cos(angle) * radius * value;
    const y = centerY + Math.sin(angle) * radius * value;
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = index === 0 ? EXPORT_HOT_MAGENTA : EXPORT_BLUE_LIGHT;
    ctx.fill();
  });

  ctx.restore();
}

function alignmentIndexFromScore(score) {
  if (score > EDHTI_ALIGNMENT_THRESHOLD) return 0;
  if (score < -EDHTI_ALIGNMENT_THRESHOLD) return 2;
  return 1;
}

function buildEdhtiAlignment(result) {
  const scores = (result && result.scores) || {};
  const moralScore = Number(scores.fun || 0) + Number(scores.social || 0)
    - Number(scores.competitive || 0) - Number(scores.solo || 0);
  const orderScore = Number(scores.mainstream || 0) + Number(scores.direct || 0)
    - Number(scores.offmeta || 0) - Number(scores.complex || 0);
  const moralIndex = alignmentIndexFromScore(moralScore);
  const orderIndex = alignmentIndexFromScore(orderScore);

  return {
    moral: EDHTI_ALIGNMENT_MORAL_LABELS[moralIndex],
    order: EDHTI_ALIGNMENT_ORDER_LABELS[orderIndex],
    moralIndex,
    orderIndex,
    // 中立中立特称「绝对中立」（True Neutral）
    label: orderIndex === 1 && moralIndex === 1
      ? '绝对中立'
      : `${EDHTI_ALIGNMENT_ORDER_LABELS[orderIndex]}${EDHTI_ALIGNMENT_MORAL_LABELS[moralIndex]}`,
  };
}

function drawAlignmentGrid(ctx, alignment, x, y, cellSize) {
  const selected = alignment || buildEdhtiAlignment(null);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = EXPORT_BLUE_LIGHT;
  ctx.font = `800 15px ${EXPORT_DISPLAY_FONT}`;
  ctx.fillText('阵营', x + cellSize * 1.5, y - 34);

  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
  EDHTI_ALIGNMENT_ORDER_SHORT.forEach((label, index) => {
    ctx.fillStyle = 'rgba(185, 232, 255, 0.62)';
    ctx.fillText(label, x + index * cellSize + cellSize / 2, y - 12);
  });
  EDHTI_ALIGNMENT_MORAL_SHORT.forEach((label, index) => {
    ctx.fillStyle = 'rgba(255, 214, 239, 0.62)';
    ctx.fillText(label, x - 12, y + index * cellSize + cellSize / 2);
  });

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const cellX = x + column * cellSize;
      const cellY = y + row * cellSize;
      const active = row === selected.moralIndex && column === selected.orderIndex;
      drawRoundRect(ctx, cellX + 2, cellY + 2, cellSize - 4, cellSize - 4, 6);

      if (active) {
        const activeFill = ctx.createLinearGradient(cellX, cellY, cellX + cellSize, cellY + cellSize);
        activeFill.addColorStop(0, EXPORT_HOT_MAGENTA);
        activeFill.addColorStop(1, EXPORT_ELECTRIC_CYAN);
        ctx.shadowColor = 'rgba(40, 246, 255, 0.42)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = activeFill;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(248, 251, 255, 0.72)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(185, 232, 255, 0.045)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(185, 232, 255, 0.14)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
  }

  ctx.fillStyle = EXPORT_INK;
  ctx.font = `800 16px ${EXPORT_DISPLAY_FONT}`;
  ctx.fillText(selected.label, x + cellSize * 1.5, y + cellSize * 3 + 20);
  ctx.restore();
}

function drawEdhtiFooter(ctx, assets) {
  assets = assets || {};
  const footerY = EXPORT_HEIGHT - EXPORT_FOOTER_HEIGHT;
  const codeSize = 126;
  const houseSize = 126;
  const gap = 20;
  const startX = EXPORT_MARGIN;
  const centerY = footerY + EXPORT_FOOTER_HEIGHT / 2;
  const textX = startX + codeSize + houseSize + gap * 2;
  const textWidth = EXPORT_WIDTH - EXPORT_MARGIN - textX;

  ctx.save();
  ctx.fillStyle = EXPORT_FOOTER_BACKGROUND;
  ctx.fillRect(0, footerY, EXPORT_WIDTH, EXPORT_FOOTER_HEIGHT);

  ctx.strokeStyle = 'rgba(104, 199, 255, 0.28)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(EXPORT_MARGIN, footerY + 1);
  ctx.lineTo(EXPORT_WIDTH - EXPORT_MARGIN, footerY + 1);
  ctx.stroke();

  drawImageCover(ctx, assets.miniProgramCode, startX, centerY - codeSize / 2, codeSize, codeSize);
  drawImageCover(ctx, assets.cedhHouseQr, startX + codeSize + gap, centerY - houseSize / 2, houseSize, houseSize);

  ctx.fillStyle = 'rgba(30, 63, 102, 0.72)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '600 17px -apple-system, BlinkMacSystemFont, sans-serif';
  drawWrappedText(ctx, '竞技 EDH 导师 × cedh 小屋', textX, centerY - 12, textWidth, 22, 2);
  ctx.fillStyle = 'rgba(30, 63, 102, 0.42)';
  ctx.font = '400 16px -apple-system, BlinkMacSystemFont, sans-serif';
  drawWrappedText(ctx, '扫码打开小程序 / 关注账号', textX, centerY + 22, textWidth, 20, 2);
  ctx.restore();
}

// 右上角赛博霓虹小贴纸：显示此人格的出现概率（两位小数）。
function drawOddsSticker(ctx, odds) {
  if (!Number.isFinite(odds)) return;

  const centerX = EXPORT_WIDTH - 138;
  // 与结果面板里的人格简写（code, y≈398）同一水平线，避开标题 Multiverse 尾部
  const centerY = 390;
  const width = 176;
  const height = 82;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(0.14);
  ctx.textAlign = 'center';

  // 霓虹辉光暗底
  ctx.shadowColor = 'rgba(40, 246, 255, 0.55)';
  ctx.shadowBlur = 22;
  drawRoundRect(ctx, -width / 2, -height / 2, width, height, 14);
  ctx.fillStyle = 'rgba(6, 10, 26, 0.9)';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // 色差双描边：内品红 + 外电青
  drawRoundRect(ctx, -width / 2 + 3, -height / 2 + 3, width - 6, height - 6, 11);
  ctx.strokeStyle = EXPORT_HOT_MAGENTA;
  ctx.lineWidth = 2;
  ctx.stroke();
  drawRoundRect(ctx, -width / 2, -height / 2, width, height, 14);
  ctx.strokeStyle = EXPORT_ELECTRIC_CYAN;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.fillStyle = 'rgba(185, 232, 255, 0.85)';
  ctx.font = `700 15px ${EXPORT_DISPLAY_FONT}`;
  drawTrackedText(ctx, '人格稀有度', 0, -12, 2);

  ctx.shadowColor = 'rgba(255, 43, 214, 0.6)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = EXPORT_ELECTRIC_CYAN;
  ctx.font = `900 32px ${EXPORT_DISPLAY_FONT}`;
  ctx.fillText(`${odds.toFixed(2)}%`, 0, 24);
  ctx.restore();
}

function drawPolishedEdhtiPosterContent(ctx, result, assets) {
  ctx.clearRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  drawEdhtiSplitGlowBackground(ctx);

  ctx.save();
  ctx.globalAlpha = 0.86;
  ctx.translate(-184, 126);
  ctx.rotate(-0.12);
  const ribbon = ctx.createLinearGradient(0, 0, EXPORT_WIDTH + 420, 0);
  ribbon.addColorStop(0, EXPORT_HOT_MAGENTA);
  ribbon.addColorStop(0.42, EXPORT_PINK);
  ribbon.addColorStop(0.68, '#B7E4FF');
  ribbon.addColorStop(1, EXPORT_ELECTRIC_CYAN);
  ctx.fillStyle = ribbon;
  ctx.fillRect(0, 28, EXPORT_WIDTH + 420, 118);
  ctx.globalAlpha = 0.34;
  ctx.fillStyle = EXPORT_PINK_LIGHT;
  ctx.fillRect(120, 174, EXPORT_WIDTH + 300, 24);
  ctx.restore();

  drawNoiseTexture(ctx);

  ctx.save();
  ctx.translate(EXPORT_MARGIN - 34, 194);
  ctx.rotate(-0.035);
  if (assets && assets.titleImage) {
    // 预渲染贴图：全平台像素一致；旋转仍由上面的 ctx.rotate 动态处理
    ctx.drawImage(assets.titleImage, TITLE_BOX.x, TITLE_BOX.y, TITLE_BOX.w, TITLE_BOX.h);
  } else {
    // 兜底：贴图缺失时用实时文字（各系统字体会略有差异）
    ctx.textAlign = 'left';
    ctx.font = `900 108px ${EXPORT_DISPLAY_FONT}`;
    const suffixX = ctx.measureText('Multi').width;
    // 两行错位标题整体水平居中：按包围盒宽度反推起始 x（抵消外层 translate 的左边距）
    const titleBlockW = Math.max(ctx.measureText('Multiverse').width, suffixX + ctx.measureText('EDHTI').width);
    const startX = (EXPORT_WIDTH - titleBlockW) / 2 - (EXPORT_MARGIN - 34);
    drawExportTitleLine(ctx, 'Multiverse', startX, 0);
    drawExportTitleLine(ctx, 'EDHTI', startX + suffixX, 92);
  }
  ctx.restore();

  drawGlassPanel(ctx, EXPORT_MARGIN, 324, EXPORT_WIDTH - EXPORT_MARGIN * 2, 390, 34, {
    fill: 'rgba(248, 251, 255, 0.075)',
    stroke: 'rgba(185, 232, 255, 0.32)',
    shadow: 'rgba(2, 10, 30, 0.5)',
    topHighlight: false,
  });
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(185, 232, 255, 0.82)';
  ctx.font = `700 19px ${EXPORT_DISPLAY_FONT}`;
  drawTrackedText(ctx, result.code, EXPORT_WIDTH / 2, 398, 8);

  const ring = ctx.createRadialGradient(EXPORT_WIDTH / 2, 480, 64, EXPORT_WIDTH / 2, 480, 190);
  ring.addColorStop(0, 'rgba(255, 43, 214, 0)');
  ring.addColorStop(0.62, 'rgba(255, 43, 214, 0.18)');
  ring.addColorStop(1, 'rgba(40, 246, 255, 0)');
  ctx.fillStyle = ring;
  ctx.fillRect(EXPORT_MARGIN, 350, EXPORT_WIDTH - EXPORT_MARGIN * 2, 250);

  const personaColor = result.persona && result.persona.color ? result.persona.color : EXPORT_INK;
  ctx.shadowColor = hexToRgba(personaColor, 0.34);
  ctx.shadowBlur = 18;
  ctx.fillStyle = personaColor;
  ctx.font = `900 68px ${EXPORT_DISPLAY_FONT}`;
  ctx.fillText(result.persona.name, EXPORT_WIDTH / 2, 490);
  ctx.shadowColor = 'transparent';

  ctx.fillStyle = 'rgba(248, 251, 255, 0.56)';
  ctx.font = '300 25px -apple-system, BlinkMacSystemFont, sans-serif';
  drawWrappedText(ctx, stripTerminalPeriod(result.persona.subtitle), EXPORT_WIDTH / 2, 545, 548, 36, 2);

  const quoteGradient = ctx.createLinearGradient(EXPORT_WIDTH / 2 - 200, 620, EXPORT_WIDTH / 2 + 200, 700);
  quoteGradient.addColorStop(0, EXPORT_PINK);
  quoteGradient.addColorStop(1, '#C86EF0');
  ctx.fillStyle = quoteGradient;
  ctx.font = '600 27px -apple-system, BlinkMacSystemFont, sans-serif';
  drawWrappedText(ctx, `"${stripTerminalPeriod(result.persona.quote)}"`, EXPORT_WIDTH / 2, 632, 400, 38, 3);
  ctx.restore();

  // 出现率贴纸画在结果面板之上、与人格简写同一水平线（原在右上角会与标题 Multiverse 尾部重合）
  drawOddsSticker(ctx, result.odds);

  const visibleTags = (result.topTags || []).slice(0, 6);
  const maxTagValue = Math.max(...visibleTags.map((tag) => tag.value), 0);
  drawGlassPanel(ctx, EXPORT_MARGIN, 760, EXPORT_WIDTH - EXPORT_MARGIN * 2, 620, 34, {
    fill: 'rgba(248, 251, 255, 0.068)',
    stroke: 'rgba(255, 123, 200, 0.24)',
    shadow: 'rgba(4, 8, 28, 0.46)',
    topHighlight: false,
  });
  ctx.save();
  ctx.fillStyle = EXPORT_PINK_LIGHT;
  ctx.textAlign = 'left';
  ctx.font = `800 20px ${EXPORT_DISPLAY_FONT}`;
  ctx.fillText('玩家标签', STAT_LABEL_X, 810);
  const alignment = buildEdhtiAlignment(result);

  visibleTags.forEach((tag, index) => {
    const y = 860 + index * 46;
    const isTop = tag.value === maxTagValue;
    ctx.fillStyle = isTop ? EXPORT_INK : 'rgba(248, 251, 255, 0.84)';
    ctx.font = isTop
      ? '700 21px -apple-system, BlinkMacSystemFont, sans-serif'
      : '500 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(tag.label, STAT_LABEL_X, y);
    drawStatBar(ctx, tag, STAT_BAR_X, y, STAT_BAR_WIDTH, isTop);
    ctx.fillStyle = isTop ? EXPORT_ELECTRIC_CYAN : EXPORT_BLUE_LIGHT;
    ctx.font = isTop ? `900 22px ${EXPORT_DISPLAY_FONT}` : `700 20px ${EXPORT_DISPLAY_FONT}`;
    ctx.textAlign = 'right';
    if (isTop) {
      ctx.shadowColor = 'rgba(40, 246, 255, 0.72)';
      ctx.shadowBlur = 18;
    }
    ctx.fillText(String(tag.value), STAT_VALUE_X, y);
    ctx.shadowColor = 'transparent';
    ctx.textAlign = 'left';
  });
  drawTagHexagon(ctx, visibleTags, TAG_HEX_CENTER_X, TAG_HEX_CENTER_Y, TAG_HEX_RADIUS);
  drawAlignmentGrid(ctx, alignment, ALIGNMENT_GRID_X, ALIGNMENT_GRID_Y, ALIGNMENT_GRID_CELL);
  ctx.restore();

  drawEdhtiFooter(ctx, assets);
}

function formatQuestion(question, answerMap, index) {
  const selectedIndex = answerMap[question.id];

  return {
    ...question,
    bucketLabel: bucketLabels[question.bucket] || question.bucket,
    prompt: stripTerminalPeriod(question.prompt),
    answers: question.answers.map((answer, answerIndex) => ({
      ...answer,
      text: stripTerminalPeriod(answer.text),
      code: formatOptionCode(answerIndex),
      selected: selectedIndex === answerIndex,
    })),
    displayIndex: index + 1,
  };
}

// 无字大画：结果页从头到尾只用同一个 URL，绝不在 JSON 查询返回后替换 src——
// 微信的 image 一换 src 就会重新下载并解码同一张卡图。
//
// 主将来自本地指挥官库，直链在构建期已烤进 config/commander-art.js，
// 所以首帧拿到的就是 CDN 直链；烤不到才回落按名取图的 302 慢路。
function buildCommanderArt(commanderName) {
  if (!commanderName) return { artCrop: '', normal: '', large: '' };
  return {
    artCrop: getCardArt(commanderName, 'artCrop') || buildScryfallImageUrl(commanderName, 'art_crop'),
    normal: getCardArt(commanderName, 'normal') || buildScryfallImageUrl(commanderName, 'normal'),
    large: '',
  };
}

function formatResult(rawResult) {
  if (!rawResult || !rawResult.persona) return null;
  const commanderName = rawResult.persona.commander && rawResult.persona.commander.en;
  const personaColor = rawResult.persona.color || '#F8FBFF';

  return {
    ...rawResult,
    commanderArt: buildCommanderArt(commanderName),
    descriptionText: spaceSentencePeriods(rawResult.persona.description),
    personaColor,
    // 句末句号转换后去掉尾部换行，避免收尾引号被挤到单独一行
    quoteText: stripSentencePeriods(rawResult.persona.quote).replace(/\n+$/g, ''),
    personaStyle: `--edhti-persona-color: ${personaColor};`,
    odds: edhtiPersonaOdds[rawResult.code],
    topTags: rawResult.normalizedTags.slice(0, 6),
  };
}

function isEdhtiState(value) {
  return Boolean(value
    && typeof value === 'object'
    && value.answers
    && typeof value.answers === 'object');
}

function countEdhtiAnswers(answers) {
  return edhtiQuestions.reduce((total, question) => (
    (answers || {})[question.id] !== undefined ? total + 1 : total
  ), 0);
}

Page({
  data: {
    answers: {},
    canGoBack: false,
    canGoNext: false,
    currentIndex: 0,
    currentQuestion: formatQuestion(edhtiQuestions[0], {}, 0),
    exporting: false,
    hasResult: false,
    nextButtonText: '下一题',
    progressPercent: 5,
    progressText: `1 / ${edhtiQuestions.length}`,
    result: null,
  },

  onLoad() {
    enableShareMenu();
    // 内嵌字体：Canvas 2D 导出海报 + WXSS 统一渲染标题，与主页一致
    if (wx.loadFontFace) {
      wx.loadFontFace({
        family: 'cEDHDisplay',
        source: `url("data:font/woff2;base64,${titleFontBase64}")`,
        global: true,
        scopes: ['webview', 'native'],
        success: () => {},
        fail: () => {},
      });
    }
    // 恢复流程会自行接管渲染（重建结果或弹继续询问），没有可恢复的状态才走首题
    if (!this.restoreState()) this.refreshState();
  },

  // 24 题的答案与结果都要留下来：切后台被回收、来电、误触返回都不该让整份测试作废
  restoreState() {
    const stored = readStorage(EDHTI_STATE_STORAGE_KEY, {
      schemaVersion: EDHTI_STATE_SCHEMA_VERSION,
      defaultValue: null,
      validate: isEdhtiState,
    });
    const state = stored.value;
    if (!state || !countEdhtiAnswers(state.answers)) return false;

    if (state.completed) {
      this.setData({ answers: { ...state.answers } }, () => this.showResult());
      return true;
    }

    const resumeIndex = Math.min(
      Math.max(Number(state.currentIndex) || 0, 0),
      edhtiQuestions.length - 1,
    );
    wx.showModal({
      title: '继续上次测试',
      content: `上次答到第 ${resumeIndex + 1} / ${edhtiQuestions.length} 题`,
      confirmText: '继续',
      cancelText: '重新开始',
      success: (result) => {
        if (result.confirm) {
          this.setData({
            answers: { ...state.answers },
            currentIndex: resumeIndex,
          }, () => this.refreshState());
          return;
        }
        removeStorage(EDHTI_STATE_STORAGE_KEY);
        this.refreshState();
      },
      fail: () => this.refreshState(),
    });
    return true;
  },

  persistState(options) {
    writeStorage(EDHTI_STATE_STORAGE_KEY, {
      currentIndex: this.data.currentIndex,
      answers: this.data.answers || {},
      completed: Boolean(options && options.completed),
    }, {
      schemaVersion: EDHTI_STATE_SCHEMA_VERSION,
      validate: isEdhtiState,
    });
  },

  onShareAppMessage() {
    const result = this.data.result;
    const title = this.data.hasResult && result && result.persona
      ? `我的 EDHTI 人格是「${result.persona.name}」，来测测你的`
      : 'EDHTI 人格测试：你是哪种指挥官玩家？';

    return { title, path: '/pages/edhti/edhti' };
  },

  onShareTimeline() {
    return { title: 'EDHTI 人格测试：你是哪种指挥官玩家？' };
  },

  refreshState() {
    const currentIndex = this.data.currentIndex;
    const answers = this.data.answers || {};
    const currentQuestion = formatQuestion(edhtiQuestions[currentIndex], answers, currentIndex);
    const selected = answers[currentQuestion.id] !== undefined;

    this.setData({
      canGoBack: currentIndex > 0,
      canGoNext: selected,
      currentQuestion,
      nextButtonText: currentIndex === edhtiQuestions.length - 1 ? '查看结果' : '下一题',
      progressPercent: Math.round(((currentIndex + 1) / edhtiQuestions.length) * 100),
      progressText: `${currentIndex + 1} / ${edhtiQuestions.length}`,
    });
    // 每一步都落盘，答到哪算哪
    this.persistState();
  },

  selectAnswer(event) {
    const index = Number(event.detail.index);
    const question = edhtiQuestions[this.data.currentIndex];

    this.setData({
      answers: {
        ...this.data.answers,
        [question.id]: index,
      },
    }, () => this.refreshState());
  },

  prevStep() {
    if (this.data.currentIndex <= 0) return;

    this.setData({
      currentIndex: this.data.currentIndex - 1,
    }, () => this.refreshState());
  },

  nextStep() {
    if (!this.data.canGoNext) return;

    if (this.data.currentIndex >= edhtiQuestions.length - 1) {
      this.showResult();
      return;
    }

    this.setData({
      currentIndex: this.data.currentIndex + 1,
    }, () => this.refreshState());
  },

  showResult() {
    const rawResult = buildEdhtiResult(
      edhtiQuestions,
      this.data.answers,
      edhtiPersonas,
      edhtiTagLabels,
    );
    const result = formatResult(rawResult);

    const recommendedCommander = selectEdhtiCommander(result.persona, rawResult.tags);

    // 以实际展示的主将（推荐池选中项）预填无字大画，避免先显示人格默认主将再跳变
    const displayCommander = recommendedCommander
      || (result.persona && result.persona.commander && result.persona.commander.en);
    if (displayCommander) {
      result.commanderArt = buildCommanderArt(displayCommander);
    }

    this.setData({
      hasResult: true,
      result,
      recommendedCommander,
    });
    // 标记完成：下次进页面直接重建这份结果，不用重测 24 题
    this.persistState({ completed: true });
  },

  restart() {
    wx.showModal({
      title: '重新开始测试',
      content: '当前结果将被清除',
      confirmText: '重新开始',
      success: (result) => {
        if (!result.confirm) return;
        removeStorage(EDHTI_STATE_STORAGE_KEY);
        this.setData({
          answers: {},
          currentIndex: 0,
          hasResult: false,
          result: null,
        }, () => this.refreshState());
      },
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index',
    });
  },

  exportImage() {
    if (!this.data.result) return;

    exportPosterImage(this, {
      canvasSelector: '#edhtiExportCanvas',
      draw: (canvas) => this.drawEdhtiPoster(canvas),
      tempFileOptions: {
        x: 0,
        y: 0,
        width: EXPORT_CANVAS_WIDTH,
        height: EXPORT_CANVAS_HEIGHT,
        destWidth: EXPORT_CANVAS_WIDTH,
        destHeight: EXPORT_CANVAS_HEIGHT,
      },
    });
  },

  drawEdhtiPoster(canvas) {
    const result = this.data.result;
    const ctx = canvas.getContext('2d');

    canvas.width = EXPORT_CANVAS_WIDTH;
    canvas.height = EXPORT_CANVAS_HEIGHT;
    ctx.scale(EXPORT_PIXEL_SCALE, EXPORT_PIXEL_SCALE);

    return this.loadExportAssets(canvas).then((assets) => {
      drawPolishedEdhtiPosterContent(ctx, result, assets);
    });
  },

  loadExportAssets(canvas) {
    return Promise.all([
      loadCanvasImage(canvas, MINI_PROGRAM_CODE_SRC),
      loadCanvasImage(canvas, CEDH_HOUSE_QR_SRC),
      loadCanvasImage(canvas, TITLE_IMAGE_SRC),
    ]).then(([miniProgramCode, cedhHouseQr, titleImage]) => ({
      miniProgramCode,
      cedhHouseQr,
      titleImage,
    }));
  },
});
