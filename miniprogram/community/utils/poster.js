function wrap(ctx, text, x, y, width, lineHeight, maxLines = 4) {
  let line = '';
  let row = 0;
  const characters = Array.from(String(text || ''));
  for (let index = 0; index < characters.length; index += 1) {
    const next = line + characters[index];
    if (ctx.measureText(next).width > width && line) {
      ctx.fillText(
        row === maxLines - 1 ? `${line.slice(0, -1)}…` : line,
        x,
        y + row * lineHeight,
      );
      if (++row >= maxLines) return;
      line = characters[index];
    } else line = next;
  }
  ctx.fillText(line, x, y + row * lineHeight);
}
function image(canvas, url) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: url,
      success(info) {
        const img = canvas.createImage();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('卡图加载失败，请重试'));
        img.src = info.path;
      },
      fail() {
        reject(new Error('卡图下载失败，请检查网络后重试'));
      },
    });
  });
}
async function render(page, passport, artOnly) {
  const canvas = await new Promise((resolve, reject) =>
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
  ctx.fillStyle = '#0b090b';
  ctx.fillRect(0, 0, 750, 1200);
  ctx.fillStyle = '#e5bad3';
  ctx.font = '22px sans-serif';
  ctx.fillText('THREE CARDS / 三张牌认识你', 44, 60);
  ctx.fillStyle = '#fffefa';
  ctx.font = 'bold 42px sans-serif';
  wrap(ctx, passport.nickname, 44, 124, 650, 46, 2);
  ctx.font = '22px sans-serif';
  wrap(ctx, passport.deckName || '我的玩家名片', 44, 218, 650, 28, 2);
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
    ctx.fillStyle = '#e5bad3';
    ctx.font = '22px sans-serif';
    ctx.fillText(['设计之选', '我的打法', '私藏单卡'][index], 246, y + 26);
    ctx.fillStyle = '#fffefa';
    ctx.font = 'bold 27px sans-serif';
    wrap(ctx, slot.displayName || slot.name, 246, y + 68, 452, 34, 2);
    ctx.font = '23px sans-serif';
    ctx.fillStyle = '#bbb2b9';
    wrap(ctx, slot.reason, 246, y + 144, 452, 30, 3);
    ctx.font = '17px sans-serif';
    wrap(
      ctx,
      `${slot.lang} / ${slot.set} #${slot.number} · ${slot.artist}`,
      246,
      y + 239,
      452,
      20,
      1,
    );
  }
  ctx.fillStyle = '#9c9098';
  ctx.font = '18px sans-serif';
  ctx.fillText(
    'cEDH 导师 · 卡图 Scryfall · © Wizards of the Coast / 画师',
    44,
    1164,
  );
  return new Promise((resolve, reject) =>
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
