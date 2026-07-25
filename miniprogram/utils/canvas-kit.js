// 各页面导出海报共用的 Canvas 绘制原语与保存流程。
// 页面各自的海报视觉（玻璃拟态、纹章排版等）留在页面文件里，这里只放与风格无关的能力。

function drawRoundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// 逐字断行：中文等 CJK 文本没有空格，按字符累加测宽。
function buildCharWrappedLines(ctx, text, maxWidth, maxLines) {
  const source = String(text || '');
  const chars = Array.from(source);
  const lines = [];
  let current = '';

  chars.forEach((char) => {
    const next = current + char;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
      return;
    }

    lines.push(current);
    current = char;
  });

  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

// 按词断行：英文卡名等以空格分词的文本。
function buildWordWrappedLines(ctx, text, maxWidth, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const lines = buildCharWrappedLines(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });

  return lines.length * lineHeight;
}

function drawFittedText(ctx, text, x, y, maxWidth) {
  const rawText = String(text || '');
  if (ctx.measureText(rawText).width <= maxWidth) {
    ctx.fillText(rawText, x, y);
    return;
  }

  let fitted = rawText;
  while (fitted.length > 1 && ctx.measureText(`${fitted}…`).width > maxWidth) {
    fitted = fitted.slice(0, -1);
  }

  ctx.fillText(`${fitted}…`, x, y);
}

function drawTrackedText(ctx, text, x, y, tracking) {
  const chars = Array.from(String(text || ''));
  const totalWidth = chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0)
    + Math.max(0, chars.length - 1) * tracking;
  const originalAlign = ctx.textAlign;
  let cursor = x;
  if (ctx.textAlign === 'center') {
    cursor = x - totalWidth / 2;
  } else if (ctx.textAlign === 'right' || ctx.textAlign === 'end') {
    cursor = x - totalWidth;
  }

  ctx.textAlign = 'left';
  chars.forEach((char) => {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + tracking;
  });
  ctx.textAlign = originalAlign;
}

// 方形中心裁切（二维码等正方形素材）。
function drawImageCover(ctx, image, x, y, width, height) {
  if (!image) return;

  const imageWidth = image.width || width;
  const imageHeight = image.height || height;
  const sourceSize = Math.min(imageWidth, imageHeight);
  const sourceX = (imageWidth - sourceSize) / 2;
  const sourceY = (imageHeight - sourceSize) / 2;

  ctx.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, x, y, width, height);
}

// 任意比例 cover 裁切，verticalFocus 控制纵向取景位置（0 顶部，0.5 居中）。
function drawCoverImage(ctx, image, x, y, width, height, options) {
  if (!image) return;

  const config = Object.assign({ verticalFocus: 0.5 }, options || {});
  const imageWidth = image.width || width;
  const imageHeight = image.height || height;
  const imageRatio = imageWidth / imageHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = imageWidth;
  let sourceHeight = imageHeight;

  if (imageRatio > targetRatio) {
    sourceWidth = imageHeight * targetRatio;
    sourceX = (imageWidth - sourceWidth) / 2;
  } else {
    sourceHeight = imageWidth / targetRatio;
    sourceY = (imageHeight - sourceHeight) * config.verticalFocus;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function loadCanvasImageDirect(canvas, src, resolve) {
  const image = canvas.createImage();
  let settled = false;
  const done = (value) => {
    if (settled) return;
    settled = true;
    resolve(value);
  };

  image.onload = () => done(image);
  image.onerror = () => done(null);
  image.src = src;
}

// 先经 wx.getImageInfo 取本地路径（网络图必须），失败再回退直接加载；任何失败都 resolve null。
function loadCanvasImage(canvas, src) {
  return new Promise((resolve) => {
    if (!src || !canvas.createImage) {
      resolve(null);
      return;
    }

    wx.getImageInfo({
      src,
      success: (info) => {
        const image = canvas.createImage();
        const resolvedSrc = info.path || src;
        let settled = false;
        const done = (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };

        image.onload = () => done(image);
        image.onerror = () => {
          if (resolvedSrc !== src) {
            loadCanvasImageDirect(canvas, src, done);
            return;
          }
          done(null);
        };
        image.src = resolvedSrc;
      },
      fail: () => loadCanvasImageDirect(canvas, src, resolve),
    });
  });
}

function canvasToTempFile(canvas, options) {
  return new Promise((resolve, reject) => {
    wx.canvasToTempFilePath(Object.assign({
      canvas,
      fileType: 'png',
      quality: 1,
      success: (result) => resolve(result.tempFilePath),
      fail: reject,
    }, options || {}));
  });
}

function saveImageWithPermission(filePath) {
  return new Promise((resolve, reject) => {
    const saveImage = () => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: reject,
      });
    };

    const openSetting = () => {
      wx.showModal({
        title: '需要相册权限',
        content: '请允许保存图片到相册',
        confirmText: '去设置',
        success: (modalResult) => {
          if (!modalResult.confirm) {
            reject(new Error('album permission rejected'));
            return;
          }

          wx.openSetting({
            success: (settingResult) => {
              const authSetting = settingResult.authSetting || {};
              if (authSetting['scope.writePhotosAlbum']) {
                saveImage();
              } else {
                reject(new Error('album permission rejected'));
              }
            },
            fail: reject,
          });
        },
        fail: reject,
      });
    };

    wx.getSetting({
      success: (settingResult) => {
        const authSetting = settingResult.authSetting || {};
        if (authSetting['scope.writePhotosAlbum']) {
          saveImage();
          return;
        }

        if (authSetting['scope.writePhotosAlbum'] === false) {
          openSetting();
          return;
        }

        wx.authorize({
          scope: 'scope.writePhotosAlbum',
          success: saveImage,
          fail: openSetting,
        });
      },
      fail: reject,
    });
  });
}

// 导出海报的完整编排：loading 提示、canvas 查询、绘制、存相册、成功/失败 toast。
// page 需有 exporting 数据位；draw(canvas) 返回 Promise；tempFileOptions 透传给 canvasToTempFilePath。
function exportPosterImage(page, options) {
  if (page.data.exporting) return;

  page.setData({ exporting: true });
  wx.showLoading({
    title: '正在导出',
    mask: true,
  });

  const finish = (success) => {
    // 同 hideKeyboard：无参调用走 Promise 风格，没有 loading 可收时会拒绝且无人 catch
    wx.hideLoading({ fail: () => {} });
    page.setData({ exporting: false });
    wx.showToast({
      title: success ? '图片已保存' : '导出失败，请重试',
      icon: success ? 'success' : 'none',
    });
  };

  page.createSelectorQuery()
    .select(options.canvasSelector)
    .fields({ node: true, size: true })
    .exec((result) => {
      const canvasInfo = result && result[0];
      if (!canvasInfo || !canvasInfo.node) {
        finish(false);
        return;
      }

      Promise.resolve(options.draw(canvasInfo.node))
        .then(() => canvasToTempFile(canvasInfo.node, options.tempFileOptions))
        .then((filePath) => saveImageWithPermission(filePath))
        .then(() => finish(true))
        .catch(() => finish(false));
    });
}

module.exports = {
  drawRoundRect,
  buildCharWrappedLines,
  buildWordWrappedLines,
  drawWrappedText,
  drawFittedText,
  drawTrackedText,
  drawImageCover,
  drawCoverImage,
  loadCanvasImageDirect,
  loadCanvasImage,
  canvasToTempFile,
  saveImageWithPermission,
  exportPosterImage,
};
