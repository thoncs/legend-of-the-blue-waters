/**
 * Effect budget, scaled to whatever device is actually running the game.
 *
 * Three tiers gate the expensive parts of the renderer: bloom, depth blur,
 * particle density and the render resolution itself. In `auto` mode the tier
 * steps *down* when the frame time stays bad for a few seconds, and never
 * steps back up on its own — a display that quietly oscillates between two
 * looks is worse than one that settles a notch low. The options tab can pin a
 * tier explicitly.
 */

/** @typedef {'high'|'medium'|'low'} Tier */

const TIERS = {
  high: {
    label: 'High',
    maxRenderScale: 2,
    bloom: true,
    bloomScale: 0.5,   // bright-pass buffer, as a fraction of the stage
    bloomPasses: 2,
    depthBlur: true,
    lights: true,
    particles: 1,
    weather: 1,
  },
  medium: {
    label: 'Medium',
    maxRenderScale: 1.5,
    bloom: true,
    bloomScale: 0.25,
    bloomPasses: 1,
    depthBlur: false,
    lights: true,
    particles: 0.55,
    weather: 0.7,
  },
  low: {
    label: 'Low',
    maxRenderScale: 1.25,
    bloom: false,
    bloomScale: 0.25,
    bloomPasses: 1,
    depthBlur: false,
    lights: true,
    particles: 0.3,
    weather: 0.45,
  },
};

const ORDER = ['high', 'medium', 'low'];

/** Frame time above which we consider the device to be struggling (~45fps). */
const BAD_FRAME_MS = 22;
/** How long it has to stay bad before we drop a tier. */
const BAD_WINDOW_MS = 3000;
/** Ignore the first stretch after boot: shader compiles and atlas uploads. */
const WARMUP_MS = 2500;

class Quality {
  constructor() {
    /** @type {Tier} */
    this.tier = 'high';
    /** @type {'auto'|Tier} */
    this.mode = 'auto';
    this._avgFrame = 16.7;
    this._badFor = 0;
    this._elapsed = 0;
    this._listeners = new Set();
  }

  get settings() {
    return TIERS[this.tier];
  }

  get maxRenderScale() {
    return TIERS[this.tier].maxRenderScale;
  }

  get bloom() { return TIERS[this.tier].bloom; }
  get bloomScale() { return TIERS[this.tier].bloomScale; }
  get bloomPasses() { return TIERS[this.tier].bloomPasses; }
  get depthBlur() { return TIERS[this.tier].depthBlur; }
  get lights() { return TIERS[this.tier].lights; }
  get particles() { return TIERS[this.tier].particles; }
  get weather() { return TIERS[this.tier].weather; }

  /** Options-tab choices, in display order. */
  static get choices() {
    return [
      ['auto', 'Auto'],
      ['high', 'High'],
      ['medium', 'Medium'],
      ['low', 'Low'],
    ];
  }

  label() {
    if (this.mode === 'auto') return `Auto (${TIERS[this.tier].label})`;
    return TIERS[this.tier].label;
  }

  /** Restore the saved preference at boot. */
  applySaved(mode) {
    this.setMode(mode ?? 'auto', { silent: true });
  }

  setMode(mode, { silent = false } = {}) {
    const next = mode === 'auto' || ORDER.includes(mode) ? mode : 'auto';
    this.mode = next;
    if (next !== 'auto') this._setTier(next, silent);
    this._badFor = 0;
  }

  _setTier(tier, silent = false) {
    if (this.tier === tier) return;
    const before = TIERS[this.tier].maxRenderScale;
    this.tier = tier;
    if (!silent && TIERS[tier].maxRenderScale !== before) {
      for (const fn of this._listeners) fn(TIERS[tier].maxRenderScale);
    }
  }

  /** Called every frame with the raw (unclamped) frame time. */
  sample(deltaMS) {
    this._elapsed += deltaMS;

    // Always track the average, even on a pinned tier: the options readout
    // and any diagnostics need a real number, not the value it booted with.
    if (deltaMS < 200) this._avgFrame += (deltaMS - this._avgFrame) * 0.05;

    if (this._elapsed < WARMUP_MS || this.mode !== 'auto') return;

    if (this._avgFrame > BAD_FRAME_MS) {
      this._badFor += deltaMS;
      if (this._badFor >= BAD_WINDOW_MS) {
        this._badFor = 0;
        const i = ORDER.indexOf(this.tier);
        if (i < ORDER.length - 1) {
          this._setTier(ORDER[i + 1]);
          this._avgFrame = 16.7; // give the new tier a clean slate to prove itself
        }
      }
    } else {
      this._badFor = Math.max(0, this._badFor - deltaMS);
    }
  }

  /** Notified when a tier change alters the render resolution budget. */
  onRenderScaleChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** Current measured frames per second, for the options readout. */
  fps() {
    return Math.round(1000 / Math.max(1, this._avgFrame));
  }
}

export const quality = new Quality();
export { TIERS };
