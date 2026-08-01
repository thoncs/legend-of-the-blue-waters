/**
 * Dynamic light pools.
 *
 * The field already darkens with a full-screen multiply layer for night and
 * weather. This sits above it as an additive layer of soft radial sprites, so
 * a lit brazier actually punches a warm hole in the dark rather than just
 * being a brighter pixel inside it. Lights live in world coordinates and are
 * offset by the camera each frame.
 */
import { Container, Sprite } from 'pixi.js';

/** A light is skipped entirely once it is this far outside the view. */
const CULL_MARGIN = 160;

export class LightLayer extends Container {
  /**
   * @param {import('./art.js').Art} art
   * @param {import('./quality.js').quality} quality
   */
  constructor(art, quality) {
    super();
    this.art = art;
    this.quality = quality;
    this.blendMode = 'add';
    /** @type {Array<{x:number,y:number,r:number,color:number,alpha:number,flicker:number,phase:number,sprite:Sprite}>} */
    this.lights = [];
    this._pool = [];
    /** Scales every light; 0 in broad daylight, 1 at full dark. */
    this.intensity = 0;
    this.t = 0;
  }

  /**
   * Register a light at a world position.
   * @param {object} opts
   * @param {number} opts.x world x, in pixels
   * @param {number} opts.y world y, in pixels
   * @param {number} opts.radius radius in pixels
   * @param {number} opts.color tint
   * @param {number} [opts.alpha] peak brightness
   * @param {number} [opts.flicker] 0 = steady, 1 = guttering flame
   */
  add({ x, y, radius, color = 0xffd08a, alpha = 0.8, flicker = 0 }) {
    let sprite = this._pool.pop();
    if (!sprite) {
      sprite = new Sprite(this.art.tex('fx:light'));
      sprite.anchor.set(0.5);
    }
    sprite.tint = color;
    this.addChild(sprite);
    const light = { x, y, radius, color, alpha, flicker, phase: Math.random() * 6.28, sprite };
    this.lights.push(light);
    return light;
  }

  clear() {
    for (const l of this.lights) {
      this.removeChild(l.sprite);
      this._pool.push(l.sprite);
    }
    this.lights.length = 0;
  }

  /** Position and modulate every light for this frame. */
  update(dtMS, camX, camY, viewW, viewH) {
    this.t += dtMS;
    const on = this.quality.lights && this.intensity > 0.01;
    this.visible = on;
    if (!on) return;

    for (const l of this.lights) {
      const sx = l.x - camX;
      const sy = l.y - camY;
      if (sx < -CULL_MARGIN || sy < -CULL_MARGIN
        || sx > viewW + CULL_MARGIN || sy > viewH + CULL_MARGIN) {
        l.sprite.visible = false;
        continue;
      }
      l.sprite.visible = true;
      l.sprite.x = sx;
      l.sprite.y = sy;
      // Flame lights breathe; steady lights hold.
      const flick = l.flicker
        ? 1 + Math.sin(this.t / 90 + l.phase) * 0.06 * l.flicker
          + Math.sin(this.t / 37 + l.phase * 2) * 0.035 * l.flicker
        : 1;
      const size = (l.radius * 2 * flick) / this.art.tex('fx:light').width;
      l.sprite.scale.set(size);
      l.sprite.alpha = l.alpha * this.intensity * flick;
    }
  }
}
