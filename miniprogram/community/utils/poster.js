const { SLOT_LABELS } = require('../shared/contracts');

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
function fitText(
  ctx,
  text,
  x,
  y,
  width,
  initialSize,
  lines,
  maxHeight = Infinity,
) {
  const value = String(text || '');
  let size = initialSize;
  // Measure at export resolution so long names retain their full text.
  while (size > 14) {
    ctx.font = `bold ${size}px sans-serif`;
    const count = textLines(ctx, value, width).length;
    if (count <= lines && count * size * 1.18 <= maxHeight) break;
    size -= 1;
  }
  ctx.font = `bold ${size}px sans-serif`;
  wrap(ctx, value, x, y, width, size * 1.18, lines);
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
  canvas.width = 900;
  canvas.height = 1440;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#10120f';
  ctx.fillRect(0, 0, 900, 1440);
  const accents = ['#e6ce8b', '#a9c8bd', '#d7afa1'];
  // The three spine marks match the three choices below.
  accents.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, index * 480, 10, 480);
  });
  ctx.fillStyle = '#e6ce8b';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('EDH  /  PLAYER PROFILE', 40, 48);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#363a30';
  ctx.font = 'bold 156px serif';
  ctx.fillText('03', 865, 188);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff8e8';
  fitText(ctx, passport.nickname || '我的三张牌', 40, 116, 700, 60, 2);
  ctx.fillStyle = '#b9b9a7';
  ctx.font = '24px sans-serif';
  ctx.fillText('三张牌认识我', 42, 218);
  for (let index = 0; index < 3; index += 1) {
    const slot = passport.slots[index];
    const img = pictures[index];
    const y = 250 + index * 356;
    const accent = accents[index];
    ctx.save();
    ctx.beginPath();
    ctx.rect(30, y, 840, 334);
    ctx.clip();
    cover(ctx, img, 30, y, 840, 334);
    const shade = ctx.createLinearGradient(30, y, 870, y);
    shade.addColorStop(
      0,
      artOnly ? 'rgba(12,16,13,0.04)' : 'rgba(12,16,13,0.70)',
    );
    shade.addColorStop(0.36, 'rgba(12,16,13,0.78)');
    shade.addColorStop(0.62, 'rgba(12,16,13,0.96)');
    shade.addColorStop(1, '#111710');
    ctx.fillStyle = shade;
    ctx.fillRect(30, y, 840, 334);
    if (!artOnly) {
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      const scale = Math.min(212 / img.width, 298 / img.height);
      ctx.drawImage(
        img,
        50 + (212 - img.width * scale) / 2,
        y + 18 + (298 - img.height * scale) / 2,
        img.width * scale,
        img.height * scale,
      );
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.fillStyle = accent;
    ctx.fillRect(30, y, 840, 2);
    ctx.font = 'bold 21px sans-serif';
    ctx.fillText(SLOT_LABELS[index], 302, y + 39);
    ctx.fillStyle = '#fffaf0';
    fitText(ctx, slot.displayName || slot.name, 300, y + 92, 514, 39, 3, 82);
    if (slot.reason) {
      ctx.fillStyle = accent;
      ctx.fillRect(302, y + 168, 24, 3);
      ctx.fillStyle = '#e1e0d4';
      ctx.font = '25px sans-serif';
      wrap(ctx, slot.reason, 302, y + 204, 510, 33, 3);
    }
    ctx.fillStyle = '#b9bdac';
    ctx.font = '18px sans-serif';
    wrap(
      ctx,
      `${slot.lang.toUpperCase()} / ${slot.set.toUpperCase()} #${slot.number}`,
      302,
      y + 300,
      500,
      21,
      1,
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = accent;
    ctx.font = 'bold 22px serif';
    ctx.fillText(`0${index + 1}`, 848, y + 39);
    ctx.textAlign = 'left';
    ctx.restore();
  }
  ctx.fillStyle = '#d0c397';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('cEDH Tutor', 40, 1354);
  ctx.fillStyle = '#b9bdac';
  ctx.font = '17px sans-serif';
  ctx.fillText('卡图 Scryfall  /  © Wizards of the Coast', 40, 1385);
  // Artist credit is separate from the card panels so a long name cannot overlap a note.
  fitText(
    ctx,
    passport.slots
      .map((slot) => slot.artist)
      .filter(Boolean)
      .join(' / '),
    40,
    1411,
    820,
    16,
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
