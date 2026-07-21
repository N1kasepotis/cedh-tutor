const CHART_COLORS = {
  background: 'rgba(10, 10, 10, 0.72)',
  axis: 'rgba(255, 249, 224, 0.16)',
  accent: '#2FA75D',
  winrateInk: '#F2D0A2',
  accentBar: 'rgba(47, 167, 93, 0.78)',
  seatBarColors: [
    'rgba(58, 128, 64, 0.78)',
    'rgba(88, 158, 66, 0.66)',
    'rgba(151, 184, 68, 0.56)',
    'rgba(214, 185, 61, 0.52)',
  ],
  emptyBar: 'rgba(255, 249, 224, 0.1)',
  text: 'rgba(255, 254, 250, 0.82)',
  mutedText: 'rgba(255, 254, 250, 0.5)',
};

const CHART_CONFIG = {
  winrateMinVisibleRange: 0.32,
  winrateViewportPadding: 0.08,
};

function clampRate(value) {
  return Math.max(0, Math.min(1, Number(value || 0)));
}

function getWinRateViewport(values) {
  const rates = (values || []).map(clampRate);
  if (!rates.length) {
    return { min: 0, max: 1 };
  }

  let min = Math.min(...rates) - CHART_CONFIG.winrateViewportPadding;
  let max = Math.max(...rates) + CHART_CONFIG.winrateViewportPadding;
  const range = max - min;

  if (range < CHART_CONFIG.winrateMinVisibleRange) {
    const center = (min + max) / 2;
    min = center - CHART_CONFIG.winrateMinVisibleRange / 2;
    max = center + CHART_CONFIG.winrateMinVisibleRange / 2;
  }

  if (min < 0) {
    max = Math.min(1, max - min);
    min = 0;
  }

  if (max > 1) {
    min = Math.max(0, min - (max - 1));
    max = 1;
  }

  if (max <= min) {
    return { min: 0, max: 1 };
  }

  return { min, max };
}

function paintChart(ctx, width, height, series, type) {
  if (type === 'seatWinrate') {
    paintSeatWinrateChart(ctx, width, height, series);
    return;
  }

  const paddingX = 18;
  const paddingTop = 18;
  const paddingBottom = type === 'winrate' ? 34 : 18;
  const chartWidth = Math.max(1, width - paddingX * 2);
  const chartHeight = Math.max(1, height - paddingTop - paddingBottom);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = CHART_COLORS.background;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = CHART_COLORS.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, paddingTop);
  ctx.lineTo(paddingX, height - paddingBottom);
  ctx.lineTo(width - paddingX, height - paddingBottom);
  ctx.stroke();

  if (!series || !series.length) {
    ctx.fillStyle = CHART_COLORS.mutedText;
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u6682\u65e0\u8bb0\u5f55', width / 2, height / 2);
    return;
  }

  const values = type === 'frequency'
    ? series.map((point) => point.count)
    : series.map((point) => point.rate);
  const viewport = type === 'frequency'
    ? { min: 0, max: Math.max(1, ...values) }
    : getWinRateViewport(values);
  const valueRange = Math.max(0.001, viewport.max - viewport.min);

  const lineColor = type === 'winrate' ? CHART_COLORS.winrateInk : CHART_COLORS.accent;

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  values.forEach((value, index) => {
    const x = paddingX + (series.length === 1 ? chartWidth / 2 : (chartWidth * index) / (series.length - 1));
    const normalized = Math.max(0, Math.min(1, (Number(value || 0) - viewport.min) / valueRange));
    const y = height - paddingBottom - normalized * chartHeight;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  ctx.fillStyle = lineColor;
  values.forEach((value, index) => {
    const x = paddingX + (series.length === 1 ? chartWidth / 2 : (chartWidth * index) / (series.length - 1));
    const normalized = Math.max(0, Math.min(1, (Number(value || 0) - viewport.min) / valueRange));
    const y = height - paddingBottom - normalized * chartHeight;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (type === 'winrate') {
    const labelStep = Math.max(1, Math.ceil(series.length / 4));
    ctx.fillStyle = CHART_COLORS.mutedText;
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    series.forEach((point, index) => {
      if (index % labelStep !== 0 && index !== series.length - 1) return;
      const x = paddingX + (series.length === 1 ? chartWidth / 2 : (chartWidth * index) / (series.length - 1));
      ctx.fillText(point.label || String(point.date || '').slice(5), x, height - 10);
    });
    ctx.textAlign = 'left';
  }
}

function paintSeatWinrateChart(ctx, width, height, series) {
  const paddingX = 20;
  const paddingTop = 24;
  const paddingBottom = 34;
  const chartWidth = Math.max(1, width - paddingX * 2);
  const chartHeight = Math.max(1, height - paddingTop - paddingBottom);
  const barSlot = chartWidth / 4;
  const barWidth = Math.min(34, barSlot * 0.52);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = CHART_COLORS.background;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = CHART_COLORS.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, height - paddingBottom);
  ctx.lineTo(width - paddingX, height - paddingBottom);
  ctx.stroke();

  (series || []).forEach((item, index) => {
    const x = paddingX + barSlot * index + (barSlot - barWidth) / 2;
    const barHeight = chartHeight * Number(item.rate || 0);
    const y = height - paddingBottom - barHeight;

    ctx.fillStyle = item.sampleSize
      ? CHART_COLORS.seatBarColors[index] || CHART_COLORS.accentBar
      : CHART_COLORS.emptyBar;
    ctx.fillRect(x, y, barWidth, Math.max(2, barHeight));

    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(item.rateLabel || '0.0%', x + barWidth / 2, Math.max(12, y - 6));

    ctx.fillStyle = CHART_COLORS.mutedText;
    ctx.font = '10px sans-serif';
    ctx.fillText(item.label || `Seat ${index + 1}`, x + barWidth / 2, height - 12);
  });

  ctx.textAlign = 'left';
}

module.exports = {
  CHART_CONFIG,
  CHART_COLORS,
  getWinRateViewport,
  paintChart,
  paintSeatWinrateChart,
};
