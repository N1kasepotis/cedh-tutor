const { particleConfig } = require('../../config/particle');
const { performanceConfig } = require('../../config/performance');

const TIER_ORDER = ['low', 'medium', 'high'];
const FRAME_MS = 1000 / 60;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex) {
  const clean = String(hex || '#B78A61').replace('#', '');
  const value = Number.parseInt(clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

Component({
  properties: {
    interactive: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    enabled: particleConfig.defaultEnabled && performanceConfig.defaultMode !== 'off',
  },

  lifetimes: {
    detached() {
      this.stopAnimation();
    },
  },

  ready() {
    if (!this.data.enabled) return;
    this.initCanvas();
  },

  methods: {
    initCanvas() {
      const query = this.createSelectorQuery();

      query.select('#particleCanvas')
        .fields({ node: true, size: true })
        .exec((result) => {
          const canvasInfo = result && result[0];

          if (!canvasInfo || !canvasInfo.node) {
            this.setData({ enabled: false });
            return;
          }

          const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
          this.canvas = canvasInfo.node;
          this.ctx = this.canvas.getContext('2d');
          this.width = windowInfo.windowWidth;
          this.height = windowInfo.windowHeight;
          this.dpr = windowInfo.pixelRatio || 1;
          this.rpxRatio = this.width / 750;
          this.accentRgb = hexToRgb(particleConfig.accentColor);
          this.neutralRgb = hexToRgb(particleConfig.neutralColor);
          this.connectionRgb = hexToRgb(particleConfig.connections && particleConfig.connections.color);

          this.canvas.width = Math.floor(this.width * this.dpr);
          this.canvas.height = Math.floor(this.height * this.dpr);
          this.ctx.scale(this.dpr, this.dpr);

          this.currentTier = performanceConfig.defaultMode === 'auto'
            ? 'high'
            : performanceConfig.defaultMode;
          this.touch = null;
          this.lastFrameTime = 0;
          this.fpsWindowStarted = 0;
          this.frameCount = 0;
          this.lowFpsSince = 0;
          this.highFpsSince = 0;

          this.resetParticles();
          this.startAnimation();
        });
    },

    rpx(value) {
      return Number(value || 0) * this.rpxRatio;
    },

    createParticle() {
      const padding = this.rpx(particleConfig.bounds.paddingRpx);
      const accentRatio = Number(particleConfig.tone && particleConfig.tone.accentRatio) || 0.58;

      return {
        x: Math.random() * (this.width + padding * 2) - padding,
        y: Math.random() * (this.height + padding * 2) - padding,
        radius: this.rpx(particleConfig.radius.minRpx + Math.random() * (particleConfig.radius.maxRpx - particleConfig.radius.minRpx)),
        alpha: particleConfig.opacity.min + Math.random() * (particleConfig.opacity.max - particleConfig.opacity.min),
        speed: this.rpx(particleConfig.flow.minSpeedRpx + Math.random() * (particleConfig.flow.maxSpeedRpx - particleConfig.flow.minSpeedRpx)),
        seed: Math.random() * 1000,
        tone: Math.random() < accentRatio ? 'accent' : 'neutral',
        pushX: 0,
        pushY: 0,
      };
    },

    resetParticles() {
      const tier = performanceConfig.tiers[this.currentTier] || performanceConfig.tiers.low;
      const particles = [];

      for (let index = 0; index < tier.count; index += 1) {
        particles.push(this.createParticle());
      }

      this.particles = particles;
    },

    adjustParticlePool() {
      const tier = performanceConfig.tiers[this.currentTier] || performanceConfig.tiers.low;
      const targetCount = Number(tier.count || 0);

      if (!this.particles || !this.particles.length) {
        this.resetParticles();
        return;
      }

      if (this.particles.length > targetCount) {
        this.particles = this.particles.slice(0, targetCount);
        return;
      }

      while (this.particles.length < targetCount) {
        this.particles.push(this.createParticle());
      }
    },

    startAnimation() {
      const requestFrame = this.canvas.requestAnimationFrame
        ? this.canvas.requestAnimationFrame.bind(this.canvas)
        : (callback) => setTimeout(() => callback(Date.now()), 16);

      this.requestFrame = requestFrame;
      this.frameHandle = requestFrame(this.drawFrame.bind(this));
    },

    stopAnimation() {
      if (!this.frameHandle) return;

      if (this.canvas && this.canvas.cancelAnimationFrame) {
        this.canvas.cancelAnimationFrame(this.frameHandle);
      } else {
        clearTimeout(this.frameHandle);
      }

      this.frameHandle = null;
    },

    drawFrame(timestamp) {
      if (!this.ctx || !this.canvas) return;

      const now = timestamp || Date.now();
      if (!this.lastFrameTime) this.lastFrameTime = now;
      if (!this.fpsWindowStarted) this.fpsWindowStarted = now;

      this.updateParticles(now);
      this.paintParticles(now);
      this.trackFps(now);

      this.lastFrameTime = now;
      this.frameHandle = this.requestFrame(this.drawFrame.bind(this));
    },

    updateParticles(timestamp) {
      const config = particleConfig;
      const scale = config.flow.fieldScale;
      const time = timestamp * config.flow.timeScale;
      const jitter = this.rpx(config.flow.jitterRpx);
      const touchRadius = this.rpx(config.touch.radiusRpx);
      const touchStrength = this.rpx(config.touch.strengthRpx);
      const swirlStrength = this.rpx(Number(config.touch.swirlRpx || 0));
      const maxPush = this.rpx(config.touch.maxDisplacementRpx);
      const padding = this.rpx(config.bounds.paddingRpx);

      // 帧率无关积分：按真实帧耗时归一到 60fps 基准，高刷屏不加速、掉帧/降档不变慢。
      // dt 夹在 1~40ms，避免首帧或切后台回来的长间隔把粒子一次甩飞。
      const dt = clamp(timestamp - (this.lastFrameTime || timestamp), 1, 40) / FRAME_MS;
      const pushDamping = Math.pow(config.touch.releaseDamping, dt);

      this.particles.forEach((particle) => {
        const angle = Math.sin((particle.x + particle.seed) * scale + time)
          + Math.cos((particle.y - particle.seed) * scale - time * 0.72);
        const driftX = Math.cos(angle) * particle.speed + Math.sin(time + particle.seed) * jitter;
        const driftY = Math.sin(angle) * particle.speed + Math.cos(time * 0.8 + particle.seed) * jitter;

        if (this.touch) {
          const dx = particle.x - this.touch.x;
          const dy = particle.y - this.touch.y;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;

          if (distance < touchRadius) {
            const falloff = 1 - distance / touchRadius;
            const push = falloff * touchStrength * dt;
            const swirl = falloff * swirlStrength * dt;
            // 径向轻推：给指尖让出一小片干净区；切向轻旋：尘埃绕指打转，像被搅动的星尘
            particle.pushX += (dx / distance) * push + (-dy / distance) * swirl;
            particle.pushY += (dy / distance) * push + (dx / distance) * swirl;
          }
        }

        particle.pushX = clamp(particle.pushX, -maxPush, maxPush) * pushDamping;
        particle.pushY = clamp(particle.pushY, -maxPush, maxPush) * pushDamping;
        particle.x += (driftX + particle.pushX) * dt;
        particle.y += (driftY + particle.pushY) * dt;

        if (particle.x < -padding) particle.x = this.width + padding;
        if (particle.x > this.width + padding) particle.x = -padding;
        if (particle.y < -padding) particle.y = this.height + padding;
        if (particle.y > this.height + padding) particle.y = -padding;
      });
    },

    paintParticles(timestamp) {
      const ctx = this.ctx;
      const tier = performanceConfig.tiers[this.currentTier] || performanceConfig.tiers.low;
      const twinkle = particleConfig.twinkle || {};
      const twinkleAmp = Number(twinkle.amp || 0);
      const twinkleSpeed = Number(twinkle.speedMs || 0);

      ctx.clearRect(0, 0, this.width, this.height);
      ctx.globalCompositeOperation = tier.composite || 'source-over';
      this.paintConnections(tier);

      this.particles.forEach((particle) => {
        const rgb = particle.tone === 'accent' ? this.accentRgb : this.neutralRgb;
        // 微弱明暗呼吸：尘埃像在光里明灭；按 seed 错相，整片场蔓延式闪烁而非齐闪
        const shimmer = twinkleAmp
          ? 1 + Math.sin(Number(timestamp || 0) * twinkleSpeed + particle.seed) * twinkleAmp
          : 1;
        const alpha = clamp(particle.alpha * shimmer, 0, 1);
        const blur = tier.softEdge
          ? particle.radius * particleConfig.softEdge.blurMultiplier * Number(tier.blurScale || 1)
          : 0;

        ctx.shadowBlur = blur;
        const shadowAlpha = alpha * Number(particleConfig.softEdge.shadowAlphaMultiplier || 0.72);
        ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${shadowAlpha})`;
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, Math.max(0.8, particle.radius), 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';
    },

    paintConnections(tier) {
      const ctx = this.ctx;
      const config = particleConfig.connections || {};
      const tierConfig = config.tiers && config.tiers[this.currentTier] || {};

      if (!ctx || !config.enabled || tierConfig.enabled === false || !this.particles || this.particles.length < 2) {
        return;
      }

      const distanceRpx = Number(tierConfig.distanceRpx || config.distanceRpx || 0);
      const maxDistance = this.rpx(distanceRpx);
      const maxLines = Number(tierConfig.maxLines || config.maxLines || 0);
      const maxLinksPerParticle = Number(tierConfig.maxLinksPerParticle || config.maxLinksPerParticle || 1);

      if (!maxDistance || !maxLines || !maxLinksPerParticle) return;

      const opacity = config.opacity || {};
      const minAlpha = Number(opacity.min || 0.03);
      const maxAlpha = Number(opacity.max || 0.12);
      const lineWidth = Math.max(0.25, this.rpx(Number(tierConfig.lineWidthRpx || config.lineWidthRpx || 0.7)));
      const rgb = this.connectionRgb || this.accentRgb;
      const candidates = [];

      this.particles.forEach((particle, index) => {
        for (let nextIndex = index + 1; nextIndex < this.particles.length; nextIndex += 1) {
          const candidate = this.particles[nextIndex];
          const dx = particle.x - candidate.x;
          const dy = particle.y - candidate.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= maxDistance) {
            candidates.push({
              particle,
              candidate,
              from: index,
              to: nextIndex,
              distance,
            });
          }
        }
      });

      const linkCounts = new Array(this.particles.length).fill(0);
      let drawn = 0;

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';

      candidates
        .sort((a, b) => a.distance - b.distance)
        .some(({ particle, candidate, from, to, distance }) => {
          if (drawn >= maxLines) return true;
          if (linkCounts[from] >= maxLinksPerParticle || linkCounts[to] >= maxLinksPerParticle) return false;

          const strength = 1 - distance / maxDistance;
          const alpha = minAlpha + strength * (maxAlpha - minAlpha);
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(particle.x, particle.y);
          ctx.lineTo(candidate.x, candidate.y);
          ctx.stroke();

          linkCounts[from] += 1;
          linkCounts[to] += 1;
          drawn += 1;
          return false;
        });

      ctx.restore();
      ctx.globalCompositeOperation = tier.composite || 'source-over';
    },

    trackFps(timestamp) {
      if (performanceConfig.defaultMode !== 'auto') return;

      this.frameCount += 1;
      const elapsed = timestamp - this.fpsWindowStarted;
      if (elapsed < 500) return;

      const fps = (this.frameCount * 1000) / elapsed;
      const currentIndex = TIER_ORDER.indexOf(this.currentTier);

      if (fps < performanceConfig.fps.downgradeBelow) {
        this.lowFpsSince = this.lowFpsSince || timestamp;
        this.highFpsSince = 0;
        if (timestamp - this.lowFpsSince >= performanceConfig.fps.downgradeAfterMs && currentIndex > 0) {
          this.currentTier = TIER_ORDER[currentIndex - 1];
          this.lowFpsSince = 0;
          this.adjustParticlePool();
        }
      } else if (fps > performanceConfig.fps.upgradeAbove) {
        this.highFpsSince = this.highFpsSince || timestamp;
        this.lowFpsSince = 0;
        if (timestamp - this.highFpsSince >= performanceConfig.fps.upgradeAfterMs && currentIndex < TIER_ORDER.length - 1) {
          this.currentTier = TIER_ORDER[currentIndex + 1];
          this.highFpsSince = 0;
          this.adjustParticlePool();
        }
      } else {
        this.lowFpsSince = 0;
        this.highFpsSince = 0;
      }

      this.frameCount = 0;
      this.fpsWindowStarted = timestamp;
    },

    updateTouch(event) {
      const touch = event.touches && event.touches[0];
      if (!touch) return;

      this.touch = {
        x: Number(touch.clientX || 0),
        y: Number(touch.clientY || 0),
      };
    },

    setTouchFromEvent(event) {
      if (!this.properties.interactive) return;
      this.updateTouch(event);
    },

    clearTouch() {
      if (!this.properties.interactive) return;
      this.touch = null;
    },

    handleTouchStart(event) {
      this.setTouchFromEvent(event);
    },

    handleTouchMove(event) {
      this.setTouchFromEvent(event);
    },

    handleTouchEnd() {
      this.clearTouch();
    },
  },
});
