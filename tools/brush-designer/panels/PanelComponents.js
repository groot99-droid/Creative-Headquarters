/**
 * PanelComponents.js - All Brush Studio Panel Components
 *
 * Creates the UI for each of the 11 brush studio panels.
 */

import { Slider } from '../ui/Slider.js';
import { CurveEditor } from '../ui/CurveEditor.js';
import { generateShape, getShapeGeneratorNames } from '../generators/ShapeGenerator.js';
import { generateGrain, getGrainGeneratorNames } from '../generators/GrainGenerator.js';
import { BLENDING_MODES } from '../editor/BrushState.js';

/**
 * Base panel class
 */
export class BasePanel {
  constructor(container, brushState, onChange) {
    this.container = container;
    this.brushState = brushState;
    this.onChange = onChange;
    this.sliders = [];
  }

  createSlider(key, label, options = {}) {
    const container = document.createElement('div');

    const slider = new Slider(container, {
      label,
      min: options.min ?? 0,
      max: options.max ?? 1,
      step: options.step ?? 0.01,
      value: this.brushState.get(key),
      displayFormatter: options.formatter || (v => `${(v * 100).toFixed(0)}%`),
      onChange: (value) => {
        this.brushState.set(key, value);
        if (this.onChange) this.onChange(key, value);
      }
    });

    this.sliders.push({ key, slider });
    return container;
  }

  createToggle(key, label) {
    const container = document.createElement('div');
    container.className = 'toggle-container';

    const value = this.brushState.get(key);

    container.innerHTML = `
      <span class="toggle-label">${label}</span>
      <div class="toggle-switch ${value ? 'active' : ''}" data-key="${key}">
        <div class="toggle-thumb"></div>
      </div>
    `;

    const toggle = container.querySelector('.toggle-switch');
    toggle.addEventListener('click', () => {
      const newValue = !toggle.classList.contains('active');
      toggle.classList.toggle('active', newValue);
      this.brushState.set(key, newValue);
      if (this.onChange) this.onChange(key, newValue);
    });

    return container;
  }

  createDropdown(key, label, options) {
    const container = document.createElement('div');
    container.className = 'dropdown-container';

    const select = document.createElement('select');
    select.className = 'dropdown-select';

    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === this.brushState.get(key)) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    select.addEventListener('change', () => {
      const value = parseInt(select.value);
      this.brushState.set(key, value);
      if (this.onChange) this.onChange(key, value);
    });

    const labelEl = document.createElement('label');
    labelEl.className = 'dropdown-label';
    labelEl.textContent = label;

    container.appendChild(labelEl);
    container.appendChild(select);

    return container;
  }

  updateSliders() {
    this.sliders.forEach(({ key, slider }) => {
      slider.setValue(this.brushState.get(key), true);
    });
  }

  clear() {
    this.sliders = [];
    this.container.innerHTML = '';
  }
}

/**
 * Stroke Path Panel
 */
export class StrokePathPanel extends BasePanel {
  render() {
    this.clear();

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Stroke Path';
    this.container.appendChild(title);

    this.container.appendChild(this.createSlider('brushSpacing', 'Spacing', {
      min: 0, max: 5, step: 0.01,
      formatter: v => `${(v * 100).toFixed(0)}%`
    }));

    this.container.appendChild(this.createSlider('brushSpacingJitter', 'Spacing Jitter'));
    this.container.appendChild(this.createSlider('brushStreamline', 'StreamLine'));
    this.container.appendChild(this.createSlider('brushStreamlinePressure', 'StreamLine Pressure'));
    this.container.appendChild(this.createSlider('brushStabilization', 'Stabilization'));
    this.container.appendChild(this.createSlider('brushMotionFiltering', 'Motion Filtering'));
    this.container.appendChild(this.createSlider('brushJitterX', 'Jitter X'));
    this.container.appendChild(this.createSlider('brushJitterY', 'Jitter Y'));
    this.container.appendChild(this.createSlider('brushFallOff', 'Fall Off'));
  }
}

/**
 * Taper Panel
 */
export class TaperPanel extends BasePanel {
  render() {
    this.clear();

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Taper';
    this.container.appendChild(title);

    this.container.appendChild(this.createSlider('brushTaperSizeStart', 'Size Start'));
    this.container.appendChild(this.createSlider('brushTaperSizeEnd', 'Size End'));
    this.container.appendChild(this.createSlider('brushTaperTip', 'Tip'));
    this.container.appendChild(this.createSlider('brushTaperOpacity', 'Opacity'));
    this.container.appendChild(this.createToggle('brushTaperLinked', 'Linked'));
  }
}

/**
 * Shape Panel
 */
export class ShapePanel extends BasePanel {
  render(shapeCanvas, onShapeChange) {
    this.clear();
    this.shapeCanvas = shapeCanvas;
    this.onShapeChange = onShapeChange;

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Shape';
    this.container.appendChild(title);

    const section1 = document.createElement('div');
    section1.className = 'panel-section';

    const sectionTitle1 = document.createElement('div');
    sectionTitle1.className = 'panel-section-title';
    sectionTitle1.textContent = 'Shape Source';
    section1.appendChild(sectionTitle1);

    const generatorSelect = document.createElement('div');
    generatorSelect.className = 'generator-select';

    const generators = getShapeGeneratorNames();
    const currentSource = this.brushState.get('shapeSource');

    generators.forEach(name => {
      const btn = document.createElement('button');
      btn.className = 'generator-btn' + (name === currentSource ? ' active' : '');
      btn.textContent = name;
      btn.addEventListener('click', () => {
        generatorSelect.querySelectorAll('.generator-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.brushState.set('shapeSource', name);
        this.generateShape(name);
      });
      generatorSelect.appendChild(btn);
    });

    section1.appendChild(generatorSelect);
    this.container.appendChild(section1);

    this.container.appendChild(this.createSlider('brushShapeScatter', 'Scatter', {
      max: 2,
      formatter: v => `${(v * 100).toFixed(0)}%`
    }));

    this.container.appendChild(this.createSlider('brushShapeRotation', 'Rotation', {
      max: 6.283,
      formatter: v => `${(v * 57.2958).toFixed(0)}°`
    }));

    this.container.appendChild(this.createSlider('brushShapeCount', 'Count', {
      min: 1, max: 16, step: 1,
      formatter: v => v.toFixed(0)
    }));

    this.container.appendChild(this.createSlider('brushShapeCountJitter', 'Count Jitter'));
    this.container.appendChild(this.createToggle('brushShapeRandomized', 'Randomized'));
    this.container.appendChild(this.createToggle('brushAzimuth', 'Azimuth'));
    this.container.appendChild(this.createToggle('brushFlipX', 'Flip X'));
    this.container.appendChild(this.createToggle('brushFlipY', 'Flip Y'));
  }

  generateShape(generatorName) {
    const canvas = generateShape(generatorName, 512);

    const ctx = this.shapeCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.shapeCanvas.width, this.shapeCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    if (this.onShapeChange) {
      this.onShapeChange();
    }
  }
}

/**
 * Grain Panel
 */
export class GrainPanel extends BasePanel {
  render(grainCanvas, onGrainChange) {
    this.clear();
    this.grainCanvas = grainCanvas;
    this.onGrainChange = onGrainChange;

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Grain';
    this.container.appendChild(title);

    const section1 = document.createElement('div');
    section1.className = 'panel-section';

    const sectionTitle1 = document.createElement('div');
    sectionTitle1.className = 'panel-section-title';
    sectionTitle1.textContent = 'Grain Source';
    section1.appendChild(sectionTitle1);

    const generatorSelect = document.createElement('div');
    generatorSelect.className = 'generator-select';

    const generators = getGrainGeneratorNames();
    const currentSource = this.brushState.get('grainSource');

    generators.forEach(name => {
      const btn = document.createElement('button');
      btn.className = 'generator-btn' + (name === currentSource ? ' active' : '');
      btn.textContent = name;
      btn.addEventListener('click', () => {
        generatorSelect.querySelectorAll('.generator-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.brushState.set('grainSource', name);
        this.generateGrain(name);
      });
      generatorSelect.appendChild(btn);
    });

    section1.appendChild(generatorSelect);
    this.container.appendChild(section1);

    this.container.appendChild(this.createSlider('brushGrainScale', 'Scale', {
      max: 2,
      formatter: v => `${(v * 100).toFixed(0)}%`
    }));

    this.container.appendChild(this.createSlider('brushGrainRotation', 'Rotation', {
      max: 6.283,
      formatter: v => `${(v * 57.2958).toFixed(0)}°`
    }));

    this.container.appendChild(this.createSlider('brushGrainDepth', 'Depth'));
    this.container.appendChild(this.createSlider('brushGrainDepthMin', 'Depth Min'));
    this.container.appendChild(this.createSlider('brushGrainDepthJitter', 'Depth Jitter'));
    this.container.appendChild(this.createSlider('brushGrainOffsetJitter', 'Offset Jitter'));
    this.container.appendChild(this.createToggle('brushGrainMoving', 'Moving'));
    this.container.appendChild(this.createToggle('brushGrainZoom', 'Zoom'));
  }

  generateGrain(generatorName) {
    const canvas = generateGrain(generatorName, 1024);

    const ctx = this.grainCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.grainCanvas.width, this.grainCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    if (this.onGrainChange) {
      this.onGrainChange();
    }
  }
}

/**
 * Dynamics Panel
 */
export class DynamicsPanel extends BasePanel {
  render() {
    this.clear();

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Dynamics';
    this.container.appendChild(title);

    const section1 = document.createElement('div');
    section1.className = 'panel-section';

    const sectionTitle1 = document.createElement('div');
    sectionTitle1.className = 'panel-section-title';
    sectionTitle1.textContent = 'Size';
    section1.appendChild(sectionTitle1);

    section1.appendChild(this.createSlider('brushSizeMaximum', 'Maximum'));
    section1.appendChild(this.createSlider('brushSizeMinimum', 'Minimum'));
    this.container.appendChild(section1);

    const section2 = document.createElement('div');
    section2.className = 'panel-section';

    const sectionTitle2 = document.createElement('div');
    sectionTitle2.className = 'panel-section-title';
    sectionTitle2.textContent = 'Opacity';
    section2.appendChild(sectionTitle2);

    section2.appendChild(this.createSlider('brushOpacityMaximum', 'Maximum'));
    section2.appendChild(this.createSlider('brushOpacityMinimum', 'Minimum'));
    this.container.appendChild(section2);

    this.container.appendChild(this.createSlider('brushBleedAmount', 'Bleed Amount'));
  }
}

/**
 * Pencil Panel (Pressure & Tilt)
 */
export class PencilPanel extends BasePanel {
  render() {
    this.clear();

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Apple Pencil';
    this.container.appendChild(title);

    // Pressure Size curve
    const section1 = document.createElement('div');
    section1.className = 'panel-section';

    const sectionTitle1 = document.createElement('div');
    sectionTitle1.className = 'panel-section-title';
    sectionTitle1.textContent = 'Pressure → Size';
    section1.appendChild(sectionTitle1);

    const curveCanvas1 = document.createElement('canvas');
    curveCanvas1.className = 'curve-canvas';
    section1.appendChild(curveCanvas1);

    const curvePresets1 = document.createElement('div');
    curvePresets1.className = 'curve-presets';
    ['linear', 'easeIn', 'easeOut', 'heavyPressure', 'lightTouch', 'sCurve'].forEach(preset => {
      const btn = document.createElement('button');
      btn.className = 'curve-preset-btn';
      btn.textContent = preset.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      btn.addEventListener('click', () => {
        this.sizeCurve.loadPreset(preset);
      });
      curvePresets1.appendChild(btn);
    });
    section1.appendChild(curvePresets1);

    this.container.appendChild(section1);

    this.sizeCurve = new CurveEditor(curveCanvas1, {
      onChange: (data) => {
        this.brushState.set('brushPressureSizeResponse', new Uint8Array(new Float64Array(data).buffer));
      }
    });

    // Pressure Opacity curve
    const section2 = document.createElement('div');
    section2.className = 'panel-section';

    const sectionTitle2 = document.createElement('div');
    sectionTitle2.className = 'panel-section-title';
    sectionTitle2.textContent = 'Pressure → Opacity';
    section2.appendChild(sectionTitle2);

    const curveCanvas2 = document.createElement('canvas');
    curveCanvas2.className = 'curve-canvas';
    section2.appendChild(curveCanvas2);

    const curvePresets2 = document.createElement('div');
    curvePresets2.className = 'curve-presets';
    ['linear', 'easeIn', 'easeOut', 'heavyPressure', 'lightTouch', 'sCurve'].forEach(preset => {
      const btn = document.createElement('button');
      btn.className = 'curve-preset-btn';
      btn.textContent = preset.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      btn.addEventListener('click', () => {
        this.opacityCurve.loadPreset(preset);
      });
      curvePresets2.appendChild(btn);
    });
    section2.appendChild(curvePresets2);

    this.container.appendChild(section2);

    this.opacityCurve = new CurveEditor(curveCanvas2, {
      onChange: (data) => {
        this.brushState.set('brushPressureOpacityResponse', new Uint8Array(new Float64Array(data).buffer));
      }
    });
  }
}

/**
 * Wet Mix Panel
 */
export class WetMixPanel extends BasePanel {
  render() {
    this.clear();

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Wet Mix';
    this.container.appendChild(title);

    this.container.appendChild(this.createSlider('brushWetDilution', 'Dilution'));
    this.container.appendChild(this.createSlider('brushWetCharge', 'Charge'));
    this.container.appendChild(this.createSlider('brushWetPull', 'Pull'));
    this.container.appendChild(this.createSlider('brushWetAttack', 'Attack'));
    this.container.appendChild(this.createSlider('brushWetBleed', 'Bleed'));
    this.container.appendChild(this.createToggle('brushWetEdge', 'Wet Edge'));
    this.container.appendChild(this.createToggle('brushWetBurn', 'Burn'));
  }
}

/**
 * Color Dynamics Panel
 */
export class ColorDynamicsPanel extends BasePanel {
  render() {
    this.clear();

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Color Dynamics';
    this.container.appendChild(title);

    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-state-icon">C</div>
      <div class="empty-state-text">Color dynamics settings would appear here.<br>This is a simplified implementation.</div>
    `;
    this.container.appendChild(empty);
  }
}

/**
 * Rendering Panel
 */
export class RenderingPanel extends BasePanel {
  render() {
    this.clear();

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'Rendering';
    this.container.appendChild(title);

    const blendModes = BLENDING_MODES.map(m => ({ value: m.id, label: m.name }));
    this.container.appendChild(this.createDropdown('brushBlendingMode', 'Blending Mode', blendModes));
  }
}

/**
 * About This Brush Panel
 */
export class AboutBrushPanel extends BasePanel {
  render(onReset) {
    this.clear();
    this.onReset = onReset;

    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = 'About This Brush';
    this.container.appendChild(title);

    const authorContainer = document.createElement('div');
    authorContainer.className = 'dropdown-container';

    const authorLabel = document.createElement('label');
    authorLabel.className = 'dropdown-label';
    authorLabel.textContent = 'Author';
    authorContainer.appendChild(authorLabel);

    const authorInput = document.createElement('input');
    authorInput.type = 'text';
    authorInput.className = 'brush-name-input';
    authorInput.value = this.brushState.get('authorName');
    authorInput.style.width = '100%';
    authorInput.addEventListener('change', () => {
      this.brushState.set('authorName', authorInput.value);
    });
    authorContainer.appendChild(authorInput);

    this.container.appendChild(authorContainer);

    const notesContainer = document.createElement('div');
    notesContainer.className = 'dropdown-container';

    const notesLabel = document.createElement('label');
    notesLabel.className = 'dropdown-label';
    notesLabel.textContent = 'Notes';
    notesContainer.appendChild(notesLabel);

    const notesInput = document.createElement('textarea');
    notesInput.className = 'brush-name-input';
    notesInput.value = this.brushState.get('notes');
    notesInput.style.width = '100%';
    notesInput.style.height = '100px';
    notesInput.style.resize = 'none';
    notesInput.addEventListener('change', () => {
      this.brushState.set('notes', notesInput.value);
    });
    notesContainer.appendChild(notesInput);

    this.container.appendChild(notesContainer);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn';
    resetBtn.textContent = 'Reset to Defaults';
    resetBtn.style.width = '100%';
    resetBtn.style.marginTop = '16px';
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all brush settings to defaults?')) {
        this.brushState.reset();
        if (this.onReset) this.onReset();
      }
    });
    this.container.appendChild(resetBtn);
  }
}

export default {
  StrokePathPanel,
  TaperPanel,
  ShapePanel,
  GrainPanel,
  DynamicsPanel,
  PencilPanel,
  WetMixPanel,
  ColorDynamicsPanel,
  RenderingPanel,
  AboutBrushPanel
};
