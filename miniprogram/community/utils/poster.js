const { SLOT_LABELS } = require('../shared/contracts');

// 深暗极简：冷黑底、银白与冷灰的文字层级，钴蓝只出现一次（标题下的短线）。
// 不画三色色条、右上角大号编号和每段序号；层级只靠字号、间距和留白区分。
const MARGIN = 64;
const MINI_PROGRAM_CODE = '/assets/cT_logo_v.2.jpg';
const CODE_SIZE = 112;
const COLORS = {
  field: '#050507',
  plate: '#0C0E12',
  edge: '#1B1F25',
  display: '#F1F2F5',
  body: '#B3B8C2',
  meta: '#888E97',
  faint: '#575E6A',
  signal: '#2454FF',
};

function textLines(ctx, text, width) {
  const lines = [];
  let line = '';
  const tokens = String(text || '').match(/[A-Za-z0-9]+|\s+|./gu) || [];
  for (const token of tokens) {
    if (!line && !token.trim()) continue;
    if (line && ctx.measureText(line + token).width > width) {
      lines.push(line.trimEnd());
      line = '';
    }
    const value = line ? token : token.trimStart();
    for (const character of Array.from(value)) {
      if (line && ctx.measureText(line + character).width > width) {
        lines.push(line.trimEnd());
        line = '';
      }
      line += character;
    }
  }
  if (line) lines.push(line.trimEnd());
  return lines;
}
function wrap(ctx, text, x, y, width, lineHeight, maxLines = 4) {
  textLines(ctx, text, width)
    .slice(0, maxLines)
    .forEach((line, index) => {
      ctx.fillText(line, x, y + index * lineHeight);
    });
}
// 微信的 Canvas 2D 不保证支持 letterSpacing，小号标签逐字绘制出字距
function tracked(ctx, text, x, y, spacing) {
  let cursor = x;
  for (const character of Array.from(String(text || ''))) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + spacing;
  }
}
function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}
function boundedTask(milliseconds, message, start) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(
      () => finish(reject, new Error(message)),
      milliseconds,
    );
    try {
      start(
        (value) => finish(resolve, value),
        (error) => finish(reject, error),
      );
    } catch (error) {
      finish(reject, error);
    }
  });
}
function image(canvas, url) {
  return boundedTask(20000, '卡图下载超时，请重试', (resolve, reject) => {
    wx.getImageInfo({
      src: url,
      success(info) {
        const img = canvas.createImage();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('卡图加载失败，请重试'));
        img.src = info.path;
      },
      fail(error) {
        const blocked = /domain list|合法域名/i.test(
          (error && error.errMsg) || '',
        );
        reject(
          new Error(
            blocked
              ? '微信下载域名配置异常，暂时无法生成图片'
              : '卡图下载失败，请检查网络后重试',
          ),
        );
      },
    });
  });
}
// 包里的小程序码不走网络，直接交给画布加载；失败时说清是二维码，不冒充卡图下载失败
function asset(canvas, src) {
  return boundedTask(5000, '小程序码加载超时，请重试', (resolve, reject) => {
    const img = canvas.createImage();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('小程序码加载失败，请重试'));
    img.src = src;
  });
}
function cover(ctx, img, x, y, width, height) {
  const scale = Math.max(width / img.width, height / img.height);
  const sw = width / scale;
  const sh = height / scale;
  ctx.drawImage(
    img,
    (img.width - sw) / 2,
    (img.height - sh) / 2,
    sw,
    sh,
    x,
    y,
    width,
    height,
  );
}
// Measure at export resolution so long names retain their full text.
function fitText(ctx, text, x, y, width, initialSize, lines, maxHeight = Infinity) {
  const value = String(text || '');
  let size = initialSize;
  let count = 1;
  while (size > 14) {
    ctx.font = `${size}px sans-serif`;
    count = textLines(ctx, value, width).length;
    if (count <= lines && count * size * 1.18 <= maxHeight) break;
    size -= 1;
  }
  ctx.font = `${size}px sans-serif`;
  count = Math.min(textLines(ctx, value, width).length, lines);
  wrap(ctx, value, x, y, width, size * 1.18, lines);
  return y + (Math.max(count, 1) - 1) * size * 1.18;
}
function drawPlate(ctx, slot, img, index, top, artOnly) {
  const x = MARGIN;
  const width = 900 - MARGIN * 2;
  const height = 320;
  ctx.fillStyle = COLORS.plate;
  roundedRect(ctx, x, top, width, height, 20);
  ctx.fill();
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.save();
  if (artOnly) {
    // 卡画模式：左侧一条有边界的画带，贴齐面板圆角裁切
    roundedRect(ctx, x, top, width, height, 20);
    ctx.clip();
    ctx.beginPath();
    ctx.rect(x, top, 256, height);
    ctx.clip();
    cover(ctx, img, x, top, 256, height);
  } else {
    // 全卡模式：完整牌面等比放进左侧，没有投影
    const scale = Math.min(196 / img.width, 274 / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const left = x + 24 + (196 - w) / 2;
    const y = top + 23 + (274 - h) / 2;
    roundedRect(ctx, left, y, w, h, 10);
    ctx.clip();
    ctx.drawImage(img, left, y, w, h);
  }
  ctx.restore();
  const textX = x + 288;
  const textWidth = width - 288 - 32;
  ctx.fillStyle = COLORS.meta;
  ctx.font = '17px sans-serif';
  tracked(ctx, SLOT_LABELS[index], textX, top + 54, 2);
  ctx.fillStyle = COLORS.display;
  const nameBottom = fitText(ctx, slot.displayName || slot.name, textX, top + 102, textWidth, 34, 2, 82);
  if (slot.reason) {
    // 短评紧跟牌名，一行和两行的牌名都保持同样的间距
    ctx.fillStyle = COLORS.body;
    ctx.font = '23px sans-serif';
    wrap(ctx, slot.reason, textX, nameBottom + 52, textWidth, 34, 3);
  }
  ctx.fillStyle = COLORS.faint;
  ctx.font = '14px monospace';
  tracked(
    ctx,
    `${slot.lang.toUpperCase()} / ${slot.set.toUpperCase()} #${slot.number}`,
    textX,
    top + 292,
    1,
  );
}
async function render(page, passport, artOnly) {
  const canvas = await boundedTask(
    5000,
    '图片画布未响应，请重新打开页面',
    (resolve, reject) =>
      page
        .createSelectorQuery()
        .select('#passport-poster')
        .fields({ node: true })
        .exec((items) =>
          items[0] && items[0].node
            ? resolve(items[0].node)
            : reject(new Error('画布尚未就绪，请重试')),
        ),
  );
  // Download before drawing so errors never leave a partially exported poster.
  const pictures = await Promise.all(
    passport.slots.map((slot) => {
      const url = artOnly ? slot.art || slot.image : slot.image;
      if (!url) throw new Error('所选版本暂无卡图，请换一个版本后导出');
      return image(canvas, url);
    }),
  );
  const code = await asset(canvas, MINI_PROGRAM_CODE);
  canvas.width = 900;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.field;
  ctx.fillRect(0, 0, 900, 1440);

  // 右上角小程序码：白底圆角方块保证长按能识别，下面一行小字说明用途
  const codeX = 900 - MARGIN - CODE_SIZE;
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  roundedRect(ctx, codeX, 64, CODE_SIZE, CODE_SIZE, 14);
  ctx.fill();
  ctx.clip();
  const codeScale = Math.min(CODE_SIZE / code.width, CODE_SIZE / code.height);
  ctx.drawImage(
    code,
    codeX + (CODE_SIZE - code.width * codeScale) / 2,
    64 + (CODE_SIZE - code.height * codeScale) / 2,
    code.width * codeScale,
    code.height * codeScale,
  );
  ctx.restore();
  ctx.fillStyle = COLORS.faint;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('长按识别，选出你的三张牌', 900 - MARGIN, 64 + CODE_SIZE + 26);
  ctx.textAlign = 'left';

  ctx.fillStyle = COLORS.meta;
  ctx.font = '15px sans-serif';
  tracked(ctx, 'EDH / PLAYER PROFILE', MARGIN, 92, 3);
  ctx.fillStyle = COLORS.display;
  // 标题收窄到二维码说明文字的左侧，长署名折行也不会压到二维码
  const titleBottom = fitText(
    ctx,
    passport.nickname || '我的三张牌',
    MARGIN,
    168,
    900 - MARGIN * 2 - 184,
    64,
    2,
    104,
  );
  // 没署名时标题已是“我的三张牌”，不再重复一行说明
  let headerBottom = titleBottom;
  if (passport.nickname) {
    headerBottom = titleBottom + 46;
    ctx.fillStyle = COLORS.meta;
    ctx.font = '22px sans-serif';
    ctx.fillText('三张牌认识我', MARGIN, headerBottom);
  }
  // 唯一的钴蓝：贴着标题块的一条短线
  ctx.fillStyle = COLORS.signal;
  ctx.fillRect(MARGIN, headerBottom + 40, 40, 2);

  for (let index = 0; index < 3; index += 1) {
    drawPlate(ctx, passport.slots[index], pictures[index], index, 324 + index * 344, artOnly);
  }

  ctx.fillStyle = COLORS.meta;
  ctx.font = '17px sans-serif';
  ctx.fillText('cEDH Tutor', MARGIN, 1376);
  ctx.fillStyle = COLORS.faint;
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('卡图 Scryfall  /  © Wizards of the Coast', 900 - MARGIN, 1376);
  ctx.textAlign = 'left';
  // Artist credit is separate from the card panels so a long name cannot overlap a note.
  fitText(
    ctx,
    passport.slots
      .map((slot) => slot.artist)
      .filter(Boolean)
      .join(' / '),
    MARGIN,
    1404,
    900 - MARGIN * 2,
    15,
    2,
  );
  return boundedTask(10000, '图片导出超时，请重试', (resolve, reject) =>
    wx.canvasToTempFilePath(
      {
        canvas,
        fileType: 'png',
        success: (result) => resolve(result.tempFilePath),
        fail: () => reject(new Error('图片生成失败，请重试')),
      },
      page,
    ),
  );
}
module.exports = { render, wrap };
