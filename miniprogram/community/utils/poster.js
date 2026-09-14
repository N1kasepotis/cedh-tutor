function wrap(ctx, text, x, y, width, lineHeight, maxLines = 4) {
  let line = '';
  let row = 0;
  const characters = Array.from(String(text || ''));
  for (let index = 0; index < characters.length; index += 1) {
    const next = line + characters[index];
    if (ctx.measureText(next).width > width && line) {
      ctx.fillText(line, x, y + row * lineHeight);
      if (++row >= maxLines) return;
      line = characters[index];
    } else line = next;
  }
  ctx.fillText(line, x, y + row * lineHeight);
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
  canvas.width = 750;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b0b09';
  ctx.fillRect(0, 0, 750, 1200);
  ctx.fillStyle = '#e6d8ad';
  ctx.font = '22px sans-serif';
  ctx.fillText('THREE CARDS / 三张牌认识你', 44, 60);
  ctx.fillStyle = '#fffefa';
  ctx.font = 'bold 42px sans-serif';
  wrap(ctx, passport.nickname || '我的三张牌', 44, 124, 650, 46, 2);
  ctx.font = '22px sans-serif';
  wrap(ctx, passport.deckName || '', 44, 218, 650, 28, 2);
  for (let index = 0; index < 3; index += 1) {
    const slot = passport.slots[index];
    const y = 290 + index * 272;
    const url = artOnly ? slot.art || slot.image : slot.image;
    if (!url) throw new Error('所选版本暂无卡图，请换一个版本后导出');
    const img = await image(canvas, url);
    const scale = Math.min(174 / img.width, 244 / img.height);
    ctx.drawImage(
      img,
      44 + (174 - img.width * scale) / 2,
      y + (244 - img.height * scale) / 2,
      img.width * scale,
      img.height * scale,
    );
    ctx.fillStyle = '#e6d8ad';
    ctx.font = '22px sans-serif';
    ctx.fillText(
      ['最喜欢的设计', '代表打法的牌', '常用妙妙牌'][index],
      246,
      y + 26,
    );
    ctx.fillStyle = '#fffefa';
    ctx.font = 'bold 27px sans-serif';
    wrap(ctx, slot.displayName || slot.name, 246, y + 68, 452, 34, 2);
    ctx.font = '23px sans-serif';
    ctx.fillStyle = '#bab8ab';
    wrap(ctx, slot.reason, 246, y + 144, 452, 30, 3);
    ctx.font = '17px sans-serif';
    wrap(
      ctx,
      `${slot.lang} / ${slot.set} #${slot.number}　${slot.artist}`,
      246,
      y + 239,
      452,
      20,
      1,
    );
  }
  ctx.fillStyle = '#a7a69a';
  ctx.font = '18px sans-serif';
  ctx.fillText(
    'cEDH 导师　卡图 Scryfall　© Wizards of the Coast / 画师',
    44,
    1164,
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
