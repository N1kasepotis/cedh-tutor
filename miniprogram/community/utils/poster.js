const { SLOT_LABELS } = require('../shared/contracts');

// 暗色收藏档案 × 玩家批注。阅读顺序是认识玩家 → 读三张牌 → 在底部接力分享：
// 署名是全图最大的字；每段里短评比牌名更大、更亮，版本、编号和语言退成卡图下的收藏注释。
// 微暖墨黑底上撒一层固定种子的印刷颗粒，三段之间只用细线分隔；不画圆角面板、色条、编号、标签和类别记号。
// 强调色取自“最喜欢的设计”那张卡画并压低饱和度，只画标题下的一截短线。
const WIDTH = 900;
const MARGIN = 64;
const MINI_PROGRAM_CODE = '/assets/cT_logo_v.2.jpg';
const CODE_BOX = 156;
const CARD_WIDTH = 168;
const TEXT_X = MARGIN + CARD_WIDTH + 44;
const TEXT_WIDTH = WIDTH - MARGIN - TEXT_X;
const FOOTER_WIDTH = WIDTH - MARGIN * 2 - CODE_BOX - 40;
const MODULE_GAP = 72;
const INVITATION = '这是我看待万智牌的方式，你呢？';
const COLORS = {
  field: '#110F0C',
  line: '#2C2822',
  display: '#F4EEE4',
  reason: '#ECE5D9',
  name: '#CEC6B9',
  body: '#B2AA9D',
  meta: '#8C8478',
  faint: '#6F675C',
};
const FALLBACK_ACCENT = '#AD9C7E';
const NO_LINE_START = /^[，。、：；！？）】」』》…,.;:!?)\]]$/u;

function font(size, weight = 'normal', family = 'sans-serif') {
  return `${weight === 'normal' ? '' : `${weight} `}${size}px ${family}`;
}
function textLines(ctx, text, width) {
  const lines = [];
  let line = '';
  const breakBefore = (next) => {
    // 标点不放在行首：连同上一行最后一个字（或英文单词）一起换到下一行
    if (NO_LINE_START.test(next)) {
      const carry = /(?:[A-Za-z0-9]+|\S)$/u.exec(line);
      const rest = carry ? line.slice(0, carry.index).trimEnd() : '';
      if (rest) {
        lines.push(rest);
        line = carry[0];
        return;
      }
    }
    lines.push(line.trimEnd());
    line = '';
  };
  const tokens = String(text || '').match(/[A-Za-z0-9]+|\s+|./gu) || [];
  for (const token of tokens) {
    if (!line && !token.trim()) continue;
    if (line && ctx.measureText(line + token).width > width) breakBefore(token);
    const value = line ? token : token.trimStart();
    for (const character of Array.from(value)) {
      if (line && ctx.measureText(line + character).width > width) breakBefore(character);
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
const PAUSE = /[，。、：；！？\s]/u;
// 末行只剩一两个汉字时从上一行挪字下来：优先在上一行最后几个字里的逗号句号后断开，
// 找不到停顿就挪到末行凑满四个字；行数不变，不整段收窄行宽
function settle(ctx, lines, width) {
  if (lines.length < 2) return lines;
  const last = Array.from(lines[lines.length - 1]);
  if (last.length > 2 || !last.some((character) => character.charCodeAt(0) > 255)) return lines;
  const previous = Array.from(lines[lines.length - 2]);
  const fits = (value) => ctx.measureText(value).width <= width;
  const split = (cut) => {
    const moved = `${previous.slice(cut).join('')}${last.join('')}`.trimStart();
    return [...lines.slice(0, -2), previous.slice(0, cut).join('').trimEnd(), moved];
  };
  for (let cut = previous.length - 1; cut >= Math.max(1, previous.length - 8); cut -= 1) {
    if (PAUSE.test(previous[cut - 1]) && fits(previous.slice(cut).join('') + last.join('')))
      return split(cut);
  }
  let cut = previous.length - (4 - last.length);
  while (cut > 1 && NO_LINE_START.test(previous[cut])) cut -= 1;
  return cut >= 1 && fits(previous.slice(cut).join('') + last.join('')) ? split(cut) : lines;
}
// 放不下时逐级缩小字号，牌名和玩家写的字保留全文
function fit(ctx, text, width, size, maxLines, { weight = 'normal', floor = 14, leading = 1.25 } = {}) {
  const value = String(text || '');
  let current = size;
  let lines = [];
  for (;;) {
    ctx.font = font(current, weight);
    lines = textLines(ctx, value, width);
    if (lines.length <= maxLines || current <= floor) break;
    current -= 1;
  }
  if (lines.length <= maxLines) lines = settle(ctx, lines, width);
  return {
    size: current,
    weight,
    leading: Math.round(current * leading),
    lines: lines.slice(0, maxLines),
  };
}
function lastBaseline(block, y) {
  return y + (Math.max(block.lines.length, 1) - 1) * block.leading;
}
function paintLines(ctx, block, x, y, color) {
  ctx.font = font(block.size, block.weight);
  ctx.fillStyle = color;
  block.lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * block.leading);
  });
}
function hex(hue, saturation, light) {
  const chroma = (1 - Math.abs(2 * light - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = light - chroma / 2;
  const channels = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ][Math.floor(hue / 60) % 6];
  return `#${channels
    .map((value) => Math.round((value + offset) * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}
// 色相分 24 格累计权重（越饱和、明度越居中的像素权重越大），取最重的一格连同两侧邻格的平均色相，
// 压成低饱和、在墨黑底上够亮的颜色；灰阶或几乎没有颜色的卡画退回暖灰
function accentFrom(data) {
  const bins = Array.from({ length: 24 }, () => ({ weight: 0, x: 0, y: 0 }));
  let sampled = 0;
  let total = 0;
  for (let index = 0; index + 2 < data.length; index += 16) {
    sampled += 1;
    const red = data[index] / 255;
    const green = data[index + 1] / 255;
    const blue = data[index + 2] / 255;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const delta = max - min;
    const light = (max + min) / 2;
    if (delta < 0.06 || light < 0.1 || light > 0.92) continue;
    let hue;
    if (max === red) hue = ((green - blue) / delta + 6) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    const weight = (delta / (1 - Math.abs(2 * light - 1))) * (1 - Math.abs(light - 0.5));
    const bin = bins[Math.floor(hue / 15) % 24];
    bin.weight += weight;
    bin.x += Math.cos((hue * Math.PI) / 180) * weight;
    bin.y += Math.sin((hue * Math.PI) / 180) * weight;
    total += weight;
  }
  if (!sampled || total / sampled < 0.03) return FALLBACK_ACCENT;
  const best = bins.reduce((top, bin, index) => (bin.weight > bins[top].weight ? index : top), 0);
  const near = [23, 0, 1].map((step) => bins[(best + step) % 24]);
  const x = near.reduce((sum, bin) => sum + bin.x, 0);
  const y = near.reduce((sum, bin) => sum + bin.y, 0);
  return hex(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360, 0.3, 0.66);
}
function sampleAccent(ctx, plan, artOnly) {
  // 全卡只取画框里的插画，避开边框和文字栏；卡画模式取整幅
  const [left, top, right, bottom] = artOnly
    ? [0.06, 0.06, 0.94, 0.94]
    : [0.12, 0.13, 0.88, 0.5];
  try {
    const { data } = ctx.getImageData(
      Math.round(MARGIN + CARD_WIDTH * left),
      Math.round(plan.top + plan.cardHeight * top),
      Math.round(CARD_WIDTH * (right - left)),
      Math.round(plan.cardHeight * (bottom - top)),
    );
    return accentFrom(data);
  } catch (_) {
    // 读不到像素时用暖灰，不耽误导出
    return FALLBACK_ACCENT;
  }
}
// 固定种子的印刷颗粒：同一张名片每次导出都一样
function grain(ctx, height) {
  let seed = 20260914;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const count = Math.round((WIDTH * height) / 220);
  [
    ['rgba(255, 238, 210, 0.07)', 0.7],
    ['rgba(0, 0, 0, 0.4)', 0.3],
  ].forEach(([color, share]) => {
    ctx.fillStyle = color;
    for (let index = 0; index < count * share; index += 1) {
      ctx.fillRect(
        Math.floor(random() * WIDTH),
        Math.floor(random() * height),
        random() < 0.8 ? 1 : 2,
        1,
      );
    }
  });
}
function hairline(ctx, y) {
  ctx.fillStyle = COLORS.line;
  ctx.fillRect(MARGIN, y, WIDTH - MARGIN * 2, 1);
}
function planHeader(ctx, passport) {
  const title = fit(ctx, passport.nickname || '我的三张牌', WIDTH - MARGIN * 2, 76, 2, {
    weight: '600',
    floor: 48,
    leading: 1.16,
  });
  const titleY = 184;
  let bottom = lastBaseline(title, titleY) + 18;
  let subtitleY = 0;
  // 没署名时标题已是“我的三张牌”，不再重复“三张牌认识我”
  if (passport.nickname) {
    subtitleY = bottom + 44;
    bottom = subtitleY + 8;
  }
  return { title, titleY, subtitleY, ruleY: bottom + 40 };
}
function planSlot(ctx, slot, img, top) {
  const cardHeight = Math.round((img.height / img.width) * CARD_WIDTH);
  const title = slot.displayName || slot.name || '';
  const labelY = top + 18;
  // 英文牌名收小一号；中文等印刷名保持清楚
  const printed = Array.from(title).some((character) => character.charCodeAt(0) > 255);
  const name = fit(ctx, title, TEXT_WIDTH, printed ? 28 : 26, 2, { floor: 20, leading: 1.3 });
  const nameY = labelY + 52;
  let bottom = lastBaseline(name, nameY);
  // 选了中文等非英文印刷版本时，英文原名作为小字跟在印刷名下面
  let english = null;
  let englishY = 0;
  if (slot.name && slot.name !== title) {
    english = fit(ctx, slot.name, TEXT_WIDTH, 18, 2, { floor: 14, leading: 1.3 });
    englishY = bottom + 32;
    bottom = lastBaseline(english, englishY);
  }
  let reason = null;
  let reasonY = 0;
  if (slot.reason) {
    reason = fit(ctx, slot.reason, TEXT_WIDTH, 30, 3, { floor: 20, leading: 1.45 });
    reasonY = bottom + 58;
    bottom = lastBaseline(reason, reasonY);
  }
  const noteY = top + cardHeight + 36;
  return {
    top,
    cardHeight,
    labelY,
    name,
    nameY,
    english,
    englishY,
    reason,
    reasonY,
    noteY,
    bottom: Math.max(bottom + 12, noteY + 6),
  };
}
function planFooter(ctx, passport, ruleY) {
  const codeY = ruleY + 44;
  const invite = fit(ctx, INVITATION, FOOTER_WIDTH, 32, 2, { floor: 24, leading: 1.3 });
  const inviteY = codeY + 36;
  const actionY = lastBaseline(invite, inviteY) + 46;
  const creditY = actionY + 48;
  const names = [...new Set(passport.slots.map((slot) => slot.artist).filter(Boolean))];
  const artists = fit(ctx, names.length ? `画师 ${names.join(' / ')}` : '', FOOTER_WIDTH, 15, 2, {
    floor: 12,
    leading: 1.4,
  });
  const artistY = creditY + 26;
  const bottom = Math.max(codeY + CODE_BOX, lastBaseline(artists, artistY) + 8);
  return { ruleY, codeY, invite, inviteY, actionY, creditY, artists, artistY, height: bottom + 52 };
}
function paintCard(ctx, plan, img, artOnly) {
  const radius = artOnly ? 3 : Math.round(CARD_WIDTH * 0.045);
  // 投影给出实体卡的厚度：先用底色画一块同形状的板子投下阴影，再把完整卡图等比贴上去，不倾斜
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = COLORS.field;
  roundedRect(ctx, MARGIN, plan.top, CARD_WIDTH, plan.cardHeight, radius);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundedRect(ctx, MARGIN, plan.top, CARD_WIDTH, plan.cardHeight, radius);
  ctx.clip();
  ctx.drawImage(img, MARGIN, plan.top, CARD_WIDTH, plan.cardHeight);
  ctx.restore();
}
function paintHeader(ctx, header, accent) {
  ctx.fillStyle = COLORS.meta;
  ctx.font = font(15);
  tracked(ctx, 'cEDH Tutor / PLAYER PROFILE', MARGIN, 96, 3);
  paintLines(ctx, header.title, MARGIN, header.titleY, COLORS.display);
  if (header.subtitleY) {
    ctx.fillStyle = COLORS.body;
    ctx.font = font(28);
    ctx.fillText('三张牌认识我', MARGIN, header.subtitleY);
  }
  hairline(ctx, header.ruleY);
  ctx.fillStyle = accent;
  ctx.fillRect(MARGIN, header.ruleY - 1, 44, 3);
}
function paintSlot(ctx, slot, plan, index) {
  ctx.fillStyle = COLORS.meta;
  ctx.font = font(20);
  tracked(ctx, SLOT_LABELS[index], TEXT_X, plan.labelY, 2);
  paintLines(ctx, plan.name, TEXT_X, plan.nameY, COLORS.name);
  if (plan.english) paintLines(ctx, plan.english, TEXT_X, plan.englishY, COLORS.meta);
  if (plan.reason) paintLines(ctx, plan.reason, TEXT_X, plan.reasonY, COLORS.reason);
  // 收藏注释：版本、编号和语言用等宽小字写在卡图下方，语言前用斜线隔开
  ctx.fillStyle = COLORS.faint;
  ctx.font = font(16, 'normal', 'monospace');
  tracked(
    ctx,
    `${String(slot.set || '').toUpperCase()} #${slot.number || ''} / ${String(slot.lang || '').toUpperCase()}`,
    MARGIN,
    plan.noteY,
    1,
  );
}
function paintFooter(ctx, footer, code) {
  hairline(ctx, footer.ruleY);
  // 小程序码独占右侧：白底方块，四周留白，长按容易识别
  const codeX = WIDTH - MARGIN - CODE_BOX;
  ctx.fillStyle = '#FFFFFF';
  roundedRect(ctx, codeX, footer.codeY, CODE_BOX, CODE_BOX, 6);
  ctx.fill();
  const inner = CODE_BOX - 16;
  const scale = Math.min(inner / code.width, inner / code.height);
  ctx.drawImage(
    code,
    codeX + (CODE_BOX - code.width * scale) / 2,
    footer.codeY + (CODE_BOX - code.height * scale) / 2,
    code.width * scale,
    code.height * scale,
  );
  paintLines(ctx, footer.invite, MARGIN, footer.inviteY, COLORS.display);
  ctx.fillStyle = COLORS.body;
  ctx.font = font(20);
  ctx.fillText('长按识别小程序码，选出你的三张牌', MARGIN, footer.actionY);
  ctx.fillStyle = COLORS.meta;
  ctx.font = font(15);
  ctx.fillText('卡图 Scryfall  /  © Wizards of the Coast', MARGIN, footer.creditY);
  paintLines(ctx, footer.artists, MARGIN, footer.artistY, COLORS.meta);
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
  const ctx = canvas.getContext('2d');
  // 先量好每一段的高度再定画布高度：长署名、长牌名和三行短评都不会互相压住
  const header = planHeader(ctx, passport);
  const modules = [];
  let top = header.ruleY + 52;
  passport.slots.forEach((slot, index) => {
    const plan = planSlot(ctx, slot, pictures[index], top);
    modules.push(plan);
    top = plan.bottom + MODULE_GAP;
  });
  const footer = planFooter(ctx, passport, top - MODULE_GAP / 2);
  const height = footer.height;
  canvas.width = WIDTH;
  canvas.height = height;
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.field;
  ctx.fillRect(0, 0, WIDTH, height);
  grain(ctx, height);
  const shade = ctx.createRadialGradient(
    WIDTH / 2,
    height * 0.4,
    WIDTH * 0.35,
    WIDTH / 2,
    height * 0.5,
    height * 0.78,
  );
  shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.36)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, WIDTH, height);

  modules.forEach((plan, index) => paintCard(ctx, plan, pictures[index], artOnly));
  const accent = sampleAccent(ctx, modules[0], artOnly);
  paintHeader(ctx, header, accent);
  modules.forEach((plan, index) => {
    if (index) hairline(ctx, plan.top - MODULE_GAP / 2);
    paintSlot(ctx, passport.slots[index], plan, index);
  });
  paintFooter(ctx, footer, code);
  return boundedTask(10000, '图片导出超时，请重试', (resolve, reject) =>
    wx.canvasToTempFilePath(
      {
        canvas,
        x: 0,
        y: 0,
        width: WIDTH,
        height,
        // 按画布尺寸导出，不随屏幕像素密度放大
        destWidth: WIDTH,
        destHeight: height,
        fileType: 'png',
        success: (result) => resolve(result.tempFilePath),
        fail: () => reject(new Error('图片生成失败，请重试')),
      },
      page,
    ),
  );
}
module.exports = { render, wrap, accentFrom };
