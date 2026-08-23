/**
 * StrokeRenderer.js - Canvas-based Brush Stroke Simulator
 *
 * Renders brush strokes in real-time for the preview canvas.
 * Simulates Procreate's brush engine behavior.
 */

export class StrokeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.shapeCanvas = null;
    this.grainCanvas = null;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
  }

  setTextures(shapeCanvas, grainCanvas) {
    this.shapeCanvas = shapeCanvas;
    this.grainCanvas = grainCanvas;
  }

  /**
   * Render preview strokes with different pressure levels
   */
  render(brushState, pressureLevels = ['light', 'medium', 'heavy']) {
    const { width, height } = this.canvas;

    // Size canvas to its display size
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && (this.canvas.width !== Math.floor(rect.width) || this.canvas.height !== Math.floor(rect.height))) {
      this.canvas.width = Math.floor(rect.width);
      this.canvas.height = Math.floor(rect.height);
    }

    // Clear canvas with paper background
    this.ctx.fillStyle = '#F5F0E8';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;

    const strokeWidth = canvasW * 0.8;
    const strokeX = (canvasW - strokeWidth) / 2;

    const pressureValues = {
      light: 0.3,
      medium: 0.6,
      heavy: 1.0
    };

    const strokeHeight = canvasH / (pressureLevels.length + 1);

    pressureLevels.forEach((level, index) => {
      const y = strokeHeight * (index + 1);
      const pressure = pressureValues[level] || 0.5;

      const path = this.createSCurvePath(strokeX, y, strokeWidth, strokeHeight * 0.3);
      this.renderStroke(path, brushState, pressure);
    });
  }

  createSCurvePath(startX, centerY, width, amplitude) {
    const points = [];
    const steps = 100;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = startX + width * t;
      const y = centerY + Math.sin(t * Math.PI * 2 - Math.PI / 2) * amplitude;
      points.push({ x, y, t });
    }

    return points;
  }

  renderStroke(path, brushState, pressure) {
    if (!this.shapeCanvas) return;

    const spacing = brushState.brushSpacing;
    const spacingJitter = brushState.brushSpacingJitter;
    const streamline = brushState.brushStreamline;

    const stamps = this.computeStampPositions(path, spacing, spacingJitter, streamline);

    stamps.forEach((stamp, index) => {
      const stampPressure = this.computeStampPressure(stamp, pressure, brushState, index, stamps.length);
      const stampSize = this.computeSize(brushState, stampPressure);
      const stampOpacity = this.computeOpacity(brushState, stampPressure);
      const rotation = this.computeRotation(brushState, stamp, path);

      // Bug fix: pass brushState as a parameter to drawStamp
      this.drawStamp(stamp.x, stamp.y, stampSize, stampOpacity, rotation, brushState);
    });
  }

  computeStampPositions(path, spacing, spacingJitter, streamline) {
    const stamps = [];
    let distanceAccumulator = 0;
    const baseSpacing = Math.max(2, 20 * spacing);

    stamps.push({ ...path[0], pressure: 1 });

    let lastStampPoint = path[0];

    for (let i = 1; i < path.length; i++) {
      const point = path[i];
      const prevPoint = path[i - 1];

      const dx = point.x - lastStampPoint.x;
      const dy = point.y - lastStampPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      distanceAccumulator += distance;

      const jitteredSpacing = baseSpacing * (1 + (Math.random() - 0.5) * spacingJitter * 2);

      if (distanceAccumulator >= jitteredSpacing) {
        const excess = distanceAccumulator - jitteredSpacing;
        const ratio = (distance - excess) / distance;

        const stampX = prevPoint.x + (point.x - prevPoint.x) * ratio;
        const stampY = prevPoint.y + (point.y - prevPoint.y) * ratio;

        const t = i / path.length;
        const edgePressure = this.getEdgePressure(t);

        stamps.push({
          x: stampX,
          y: stampY,
          t: t,
          pressure: edgePressure
        });

        lastStampPoint = { x: stampX, y: stampY };
        distanceAccumulator = excess;
      }
    }

    stamps.push({ ...path[path.length - 1], t: 1, pressure: 0 });

    return stamps;
  }

  getEdgePressure(t) {
    const startTaper = 0.1;
    const endTaper = 0.1;

    if (t < startTaper) {
      return t / startTaper;
    } else if (t > 1 - endTaper) {
      return (1 - t) / endTaper;
    }
    return 1;
  }

  computeStampPressure(stamp, basePressure, brushState, index, totalStamps) {
    let pressure = basePressure * stamp.pressure;

    const taperStart = brushState.brushTaperSizeStart;
    const taperEnd = brushState.brushTaperSizeEnd;

    if (taperStart > 0 && stamp.t < 0.2) {
      pressure *= 1 - taperStart * (1 - stamp.t / 0.2);
    }

    if (taperEnd > 0 && stamp.t > 0.8) {
      pressure *= 1 - taperEnd * (1 - (1 - stamp.t) / 0.2);
    }

    return Math.max(0, Math.min(1, pressure));
  }

  computeSize(brushState, pressure) {
    const minSize = brushState.brushSizeMinimum;
    const maxSize = brushState.brushSizeMaximum;

    const sizeRange = maxSize - minSize;
    const baseSize = minSize + sizeRange * pressure;

    const basePixelSize = 50;

    return basePixelSize * baseSize;
  }

  computeOpacity(brushState, pressure) {
    const minOpacity = brushState.brushOpacityMinimum;
    const maxOpacity = brushState.brushOpacityMaximum;

    const opacityRange = maxOpacity - minOpacity;
    return minOpacity + opacityRange * pressure;
  }

  computeRotation(brushState, stamp, path) {
    let rotation = brushState.brushShapeRotation;

    if (brushState.brushAzimuth) {
      const idx = Math.floor(stamp.t * (path.length - 1));
      const current = path[Math.min(idx, path.length - 1)];
      const next = path[Math.min(idx + 1, path.length - 1)];

      const dx = next.x - current.x;
      const dy = next.y - current.y;
      rotation += Math.atan2(dy, dx);
    }

    if (brushState.brushShapeScatter > 0) {
      rotation += (Math.random() - 0.5) * brushState.brushShapeScatter * Math.PI;
    }

    return rotation;
  }

  /**
   * Draw a single stamp.
   * Bug fix: brushState is now passed as a parameter instead of accessed from outer scope.
   */
  drawStamp(x, y, size, opacity, rotation, brushState) {
    if (!this.shapeCanvas || size <= 0 || opacity <= 0) return;

    this.ctx.save();

    this.ctx.globalCompositeOperation = 'multiply';
    this.ctx.globalAlpha = opacity;
    this.ctx.translate(x, y);
    this.ctx.rotate(rotation);

    const halfSize = size / 2;

    this.ctx.drawImage(
      this.shapeCanvas,
      -halfSize, -halfSize,
      size, size
    );

    this.ctx.restore();

    // Apply grain if available and depth > 0
    if (this.grainCanvas && brushState.brushGrainDepth > 0) {
      this.applyGrain(x, y, size, opacity, rotation, brushState.brushGrainDepth);
    }
  }

  applyGrain(x, y, size, opacity, rotation, grainDepth) {
    const grainSize = size * 2;
    this.offscreenCanvas.width = grainSize;
    this.offscreenCanvas.height = grainSize;

    this.offscreenCtx.clearRect(0, 0, grainSize, grainSize);

    this.offscreenCtx.drawImage(
      this.grainCanvas,
      0, 0, this.grainCanvas.width, this.grainCanvas.height,
      0, 0, grainSize, grainSize
    );

    this.ctx.save();
    this.ctx.globalCompositeOperation = 'multiply';
    this.ctx.globalAlpha = opacity * grainDepth;
    this.ctx.translate(x, y);
    this.ctx.rotate(rotation);
    this.ctx.drawImage(
      this.offscreenCanvas,
      -grainSize / 2, -grainSize / 2,
      grainSize, grainSize
    );
    this.ctx.restore();
  }

  clear() {
    this.ctx.fillStyle = '#F5F0E8';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}

export default StrokeRenderer;
