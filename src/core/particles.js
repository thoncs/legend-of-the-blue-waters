/**
 * A pooled sprite emitter.
 *
 * Everything atmospheric — embers off a brazier, spray off the bow, dust in a
 * sunbeam, sparks off a hit — comes out of here. Sprites are recycled rather
 * than created, and the live count scales with the quality tier so a weaker
 * device thins the effect instead of dropping frames.
 */
import { Container, Sprite } from 'pixi.js';

/** Named looks. `tex` is an atlas key; the rest are ranges. */
export const PRESETS = {
  ember: {
    tex: 'fx:mote', tint: [0xffb03a, 0xffe08a], life: [700, 1500],
    vx: [-14, 14], vy: [-46, -20], gravity: -6, scale: [0.6, 1.4], alpha: 0.95, blend: 'add',
  },
  spark: {
    tex: 'fx:spark', tint: [0xffe08a, 0xffffff], life: [220, 480],
    vx: [-160, 160], vy: [-170, 40], gravity: 420, scale: [0.5, 1.1], alpha: 1, blend: 'add',
  },
  spray: {
    tex: 'fx:mote', tint: [0x93e6dc, 0xf2f6e8], life: [400, 900],
    vx: [-60, 60], vy: [-120, -50], gravity: 300, scale: [0.7, 1.6], alpha: 0.85, blend: 'normal',
  },
  dust: {
    tex: 'fx:mote', tint: [0xe8cf9a, 0xf2f6e8], life: [2200, 4200],
    vx: [-10, 10], vy: [-8, -2], gravity: 0, scale: [0.5, 1.1], alpha: 0.35, blend: 'add',
  },
  firefly: {
    tex: 'fx:mote', tint: [0x9fe86a, 0xd8ffa8], life: [2400, 4800],
    vx: [-16, 16], vy: [-14, 6], gravity: 0, scale: [0.7, 1.3], alpha: 0.8, blend: 'add',
  },
  ash: {
    tex: 'fx:mote', tint: [0x584e49, 0x8a7a70], life: [2600, 5200],
    vx: [-22, 8], vy: [10, 34], gravity: 0, scale: [0.6, 1.4], alpha: 0.6, blend: 'normal',
  },
  smoke: {
    tex: 'fx:smoke', tint: [0x4a4a52, 0x7a7a86], life: [1200, 2400],
    vx: [-12, 12], vy: [-30, -12], gravity: -8, scale: [0.5, 1.2], alpha: 0.3, blend: 'normal',
  },
};

const lerp = (a, b, t) => a + (b - a) * t;
const pick = (range, r) => lerp(range[0], range[1], r);

/** Blend two 0xRRGGBB ints. */
function mixTint(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((lerp(ar, br, t) & 255) << 16) | ((lerp(ag, bg, t) & 255) << 8) | (lerp(ab, bb, t) & 255);
}

export class Particles extends Container {
  /**
   * @param {import('./art.js').Art} art
   * @param {import('./quality.js').quality} quality
   * @param {number} [budget] hard cap on live particles at the top tier
   */
  constructor(art, quality, budget = 220) {
    super();
    this.art = art;
    this.quality = quality;
    this.budget = budget;
    this.eventMode = 'none';
    /** @type {Array<object>} */
    this.live = [];
    this._pool = [];
    this._rand = 1;
  }

  /** Deterministic-ish cheap random, so emitters do not all pulse together. */
  _r() {
    this._rand = (this._rand * 1103515245 + 12345) & 0x7fffffff;
    return this._rand / 0x7fffffff;
  }

  get cap() {
    return Math.round(this.budget * this.quality.particles);
  }

  /**
   * Emit `count` particles of `preset` at (x, y), in this layer's coordinates.
   * Extra options override the preset (tint, speeds, life).
   */
  burst(preset, x, y, count = 8, overrides = {}) {
    const def = { ...PRESETS[preset], ...overrides };
    if (!def.tex) return;
    const room = this.cap - this.live.length;
    const n = Math.min(count, Math.max(0, room));
    for (let i = 0; i < n; i++) {
      let s = this._pool.pop();
      if (!s) {
        s = new Sprite();
        s.anchor.set(0.5);
      }
      s.texture = this.art.tex(def.tex);
      s.blendMode = def.blend ?? 'normal';
      s.tint = mixTint(def.tint[0], def.tint[1], this._r());
      s.x = x + (this._r() - 0.5) * (def.spreadX ?? 0);
      s.y = y + (this._r() - 0.5) * (def.spreadY ?? 0);
      const scale = pick(def.scale, this._r());
      s.scale.set(scale);
      s.alpha = def.alpha ?? 1;
      s.visible = true;
      this.addChild(s);
      this.live.push({
        s,
        vx: pick(def.vx, this._r()),
        vy: pick(def.vy, this._r()),
        gravity: def.gravity ?? 0,
        life: pick(def.life, this._r()),
        age: 0,
        alpha: def.alpha ?? 1,
        scale,
      });
    }
  }

  /** Emit at a steady rate; call every frame with the frame time. */
  stream(preset, x, y, perSecond, dtMS, overrides = {}) {
    const key = `_acc_${preset}`;
    this[key] = (this[key] ?? 0) + (perSecond * this.quality.particles * dtMS) / 1000;
    const n = Math.floor(this[key]);
    if (n > 0) {
      this[key] -= n;
      this.burst(preset, x, y, n, overrides);
    }
  }

  clear() {
    for (const p of this.live) {
      this.removeChild(p.s);
      this._pool.push(p.s);
    }
    this.live.length = 0;
  }

  update(dtMS) {
    const dt = dtMS / 1000;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.age += dtMS;
      if (p.age >= p.life) {
        this.removeChild(p.s);
        this._pool.push(p.s);
        this.live.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      // Fade and shrink over the back half of the life.
      const t = p.age / p.life;
      p.s.alpha = p.alpha * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
      p.s.scale.set(p.scale * (1 - t * 0.35));
    }
  }
}
