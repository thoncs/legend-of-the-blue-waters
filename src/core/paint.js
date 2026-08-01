/**
 * The painting foundation: colour ramps, periodic noise and a pixel buffer
 * with the primitives every sprite in the game is drawn from.
 *
 * Sprites are painted into a plain `Uint8ClampedArray` and blitted to the
 * atlas in one `putImageData` per slot. At 16px art the old one-`fillRect`-
 * per-pixel approach was fine; at 48px tiles and 48x72 characters it would be
 * roughly two million canvas calls at boot, so the pixels are pushed straight
 * into typed arrays instead. It also gives us correct alpha blending, which
 * is what makes soft shadows, rim light and dithered gradients possible.
 */

/* ------------------------------------------------------------------ *
 * Colour
 * ------------------------------------------------------------------ */

const COLOR_CACHE = new Map();

/** Parse '#rgb', '#rrggbb', '#rrggbbaa', 'rgb(...)' or 'rgba(...)'. */
export function parseColor(c) {
  if (typeof c !== 'string') return [0, 0, 0, 0];
  const hit = COLOR_CACHE.get(c);
  if (hit) return hit;

  let out = [0, 0, 0, 0];
  if (c[0] === '#') {
    const hex = c.slice(1);
    if (hex.length === 3) {
      out = [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        255,
      ];
    } else if (hex.length === 6) {
      const n = parseInt(hex, 16);
      out = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    } else if (hex.length === 8) {
      const n = parseInt(hex, 16);
      out = [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
  } else if (c.startsWith('rgb')) {
    const parts = c.slice(c.indexOf('(') + 1, c.lastIndexOf(')')).split(',');
    out = [
      parseInt(parts[0], 10) || 0,
      parseInt(parts[1], 10) || 0,
      parseInt(parts[2], 10) || 0,
      parts.length > 3 ? Math.round(parseFloat(parts[3]) * 255) : 255,
    ];
  }
  COLOR_CACHE.set(c, out);
  return out;
}

export function toHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${((1 << 24) | (clamp(r) << 16) | (clamp(g) << 8) | clamp(b)).toString(16).slice(1)}`;
}

/** Linear blend between two colours, `t` in 0..1. */
export function mix(a, b, t) {
  const A = parseColor(a);
  const B = parseColor(b);
  return toHex(
    A[0] + (B[0] - A[0]) * t,
    A[1] + (B[1] - A[1]) * t,
    A[2] + (B[2] - A[2]) * t,
  );
}

/** Legacy-compatible brightness nudge (adds `amount` to each channel). */
export function shade(hex, amount) {
  const [r, g, b] = parseColor(hex);
  return toHex(r + amount, g + amount, b + amount);
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb;
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return [(rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255];
}

/** Shortest-path hue rotation from `h` toward `target`, by fraction `t`. */
function hueToward(h, target, t) {
  let d = ((target - h + 540) % 360) - 180;
  return h + d * t;
}

const RAMP_CACHE = new Map();

/**
 * Build a shading ramp from one base colour, darkest first.
 *
 * Shadows rotate toward blue and gain saturation; highlights rotate toward
 * warm yellow and lose it. That hue travel is most of the difference between
 * a sprite that looks shaded and one that looks like a flat fill with a
 * darker copy underneath it.
 */
export function makeRamp(base, steps = 6, { spread = 1, coolShadow = 16, warmLight = 10 } = {}) {
  const key = `${base}|${steps}|${spread}|${coolShadow}|${warmLight}`;
  const hit = RAMP_CACHE.get(key);
  if (hit) return hit;

  const [r, g, b] = parseColor(base);
  const [h, s, v] = rgbToHsv(r, g, b);
  const out = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0.5 : i / (steps - 1); // 0 = shadow, 1 = light
    const d = (t - 0.5) * 2 * spread;              // -1..1
    const value = Math.max(0.04, Math.min(1, v * (1 + d * (d < 0 ? 0.62 : 0.42))));
    // Shadows keep more chroma than highlights, which wash out toward white.
    const sat = Math.max(0, Math.min(1, s * (1 - d * 0.3)));
    // Shadow rotates toward deep blue, light toward warm yellow.
    const hue = d < 0
      ? hueToward(h, 222, -d * (coolShadow / 100))
      : hueToward(h, 45, d * (warmLight / 100));
    const [rr, gg, bb] = hsvToRgb(hue, sat, value);
    out.push(toHex(rr, gg, bb));
  }
  RAMP_CACHE.set(key, out);
  return out;
}

/** Sample a ramp with a float index, clamped to its ends. */
export function rampAt(ramp, i) {
  return ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(i)))];
}

/* ------------------------------------------------------------------ *
 * Noise
 * ------------------------------------------------------------------ */

/** Cheap deterministic hash, stable across runs. */
export function hash(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Back-compat alias used by the older art functions. */
export const noise = hash;

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Value noise that repeats exactly every `size` pixels, so terrain textures
 * tile seamlessly across the map. `cells` must divide `size`.
 */
export function periodicNoise(x, y, cells, seed, size) {
  const s = size / cells;
  const fx = x / s;
  const fy = y / s;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const at = (i, j) => hash(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, seed);
  const a = at(x0, y0);
  const b = at(x0 + 1, y0);
  const c = at(x0, y0 + 1);
  const d = at(x0 + 1, y0 + 1);
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty;
}

/** Layered periodic noise; every octave still tiles at `size`. */
export function periodicFbm(x, y, seed, size, octaves = 3, baseCells = 3) {
  let sum = 0;
  let amp = 1;
  let total = 0;
  let cells = baseCells;
  for (let o = 0; o < octaves; o++) {
    if (size % cells !== 0) break;
    sum += periodicNoise(x, y, cells, seed + o * 97, size) * amp;
    total += amp;
    amp *= 0.5;
    cells *= 2;
  }
  return total ? sum / total : 0.5;
}

/** 4x4 ordered dither matrix, normalised to 0..1. */
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

const BAYER2 = [
  [0.25, 0.75],
  [1.0, 0.5],
];

/* ------------------------------------------------------------------ *
 * Pixel buffer
 * ------------------------------------------------------------------ */

/**
 * A drawing surface with the primitives the art tables use. All coordinates
 * are local to the sprite; everything blends source-over into an RGBA buffer.
 */
export class Pen {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  index(x, y) {
    return (y * this.w + x) * 4;
  }

  /** Source-over blend one pixel. */
  blend(x, y, r, g, b, a) {
    if (a <= 0) return;
    const ix = x | 0;
    const iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const d = this.data;
    const i = (iy * this.w + ix) * 4;
    if (a >= 255) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      return;
    }
    const sa = a / 255;
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    if (oa <= 0) { d[i + 3] = 0; return; }
    d[i] = (r * sa + d[i] * da * (1 - sa)) / oa;
    d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
    d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
    d[i + 3] = oa * 255;
  }

  alphaAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  /** Replace every pixel (ignores blending). */
  fill(color) {
    const [r, g, b, a] = parseColor(color);
    const d = this.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
  }

  clear() {
    this.data.fill(0);
  }

  px(x, y, color, alpha = 1) {
    const [r, g, b, a] = parseColor(color);
    this.blend(Math.round(x), Math.round(y), r, g, b, a * alpha);
  }

  rect(x, y, w, h, color, alpha = 1) {
    const [r, g, b, a] = parseColor(color);
    const al = a * alpha;
    if (al <= 0) return;
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) this.blend(xx, yy, r, g, b, al);
    }
  }

  line(x0, y0, x1, y1, color, alpha = 1) {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx - dy;
    const guard = (dx + dy) * 2 + 8;
    for (let n = 0; n < guard; n++) {
      this.px(x, y, color, alpha);
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  /** Thick line, drawn as a run of discs. */
  stroke(x0, y0, x1, y1, width, color, alpha = 1) {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    const r = width / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, color, alpha);
    }
  }

  ellipse(cx, cy, rx, ry, color, alpha = 1) {
    const RX = Math.max(0.5, rx);
    const RY = Math.max(0.5, ry);
    const x0 = Math.max(0, Math.floor(cx - RX));
    const x1 = Math.min(this.w - 1, Math.ceil(cx + RX));
    const y0 = Math.max(0, Math.floor(cy - RY));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + RY));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / RX;
        const dy = (y - cy) / RY;
        if (dx * dx + dy * dy <= 1.02) this.px(x, y, color, alpha);
      }
    }
  }

  /** Filled convex-ish polygon via scanline. */
  poly(points, color, alpha = 1) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, py] of points) {
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(this.h - 1, Math.ceil(maxY));
    for (let y = minY; y <= maxY; y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const [ax, ay] = points[i];
        const [bx, by] = points[(i + 1) % points.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        this.rect(xs[i], y, xs[i + 1] - xs[i] + 1, 1, color, alpha);
      }
    }
  }

  /**
   * Ordered-dither a rectangle between two colours. `ratio` 0 keeps `a`,
   * 1 keeps `b`; anything between gives the classic stippled transition.
   */
  dither(x, y, w, h, a, b, ratio, { matrix = 4 } = {}) {
    const m = matrix === 2 ? BAYER2 : BAYER4;
    const n = m.length;
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        this.px(xx, yy, ratio > m[yy % n][xx % n] ? b : a);
      }
    }
  }

  /**
   * A ramp gradient across a rectangle, dithered between adjacent ramp stops
   * so the banding reads as texture instead of stripes.
   */
  gradient(x, y, w, h, ramp, { axis = 'y', from = 0, to = 1, dither = true } = {}) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    const span = ramp.length - 1;
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const t = axis === 'y'
          ? (y1 - y0 <= 1 ? 0 : (yy - y0) / (y1 - y0 - 1))
          : (x1 - x0 <= 1 ? 0 : (xx - x0) / (x1 - x0 - 1));
        const f = (from + (to - from) * t) * span;
        let idx = Math.floor(f);
        const frac = f - idx;
        if (dither && frac > BAYER4[yy % 4][xx % 4]) idx += 1;
        this.px(xx, yy, ramp[Math.max(0, Math.min(span, idx))]);
      }
    }
  }

  /**
   * Fill the whole sprite with a material: seamless layered noise mapped onto
   * a ramp. This is what replaces the old flat `fill` + `speckle` pair.
   */
  material(ramp, { seed = 1, lo = 1, hi = 4, octaves = 3, cells = 3, size = this.w, contrast = 1 } = {}) {
    const span = hi - lo;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let n = periodicFbm(x, y, seed, size, octaves, cells);
        n = Math.max(0, Math.min(1, 0.5 + (n - 0.5) * contrast));
        const f = lo + n * span;
        let idx = Math.floor(f);
        if (f - idx > BAYER4[y % 4][x % 4]) idx += 1;
        this.px(x, y, rampAt(ramp, idx));
      }
    }
  }

  /** Scatter single pixels, seamlessly across tile edges. */
  speckle(color, density, seed = 0, alpha = 1) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (hash(x, y, seed) < density) this.px(x, y, color, alpha);
      }
    }
  }

  /* --- silhouette passes, run after the sprite is drawn --- */

  /**
   * Grow a 1px outline around everything opaque. The single biggest thing
   * that makes a sprite read cleanly against busy terrain.
   */
  outline(color, { alpha = 1, diagonal = false } = {}) {
    const { w, h } = this;
    const marks = [];
    const near = diagonal
      ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.alphaAt(x, y) > 24) continue;
        for (const [dx, dy] of near) {
          if (this.alphaAt(x + dx, y + dy) > 128) { marks.push(x, y); break; }
        }
      }
    }
    for (let i = 0; i < marks.length; i += 2) this.px(marks[i], marks[i + 1], color, alpha);
  }

  /**
   * Light the edge facing (dx, dy) — pixels whose neighbour in that direction
   * is empty. Light comes from the upper left everywhere in this game.
   */
  rim(color, dx = -1, dy = -1, alpha = 0.55) {
    const marks = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alphaAt(x, y) < 128) continue;
        if (this.alphaAt(x + dx, y + dy) < 64) marks.push(x, y);
      }
    }
    for (let i = 0; i < marks.length; i += 2) this.px(marks[i], marks[i + 1], color, alpha);
  }

  /** Darken toward the bottom of the sprite — cheap ambient occlusion. */
  ao(color = '#0b1420', { rows = this.h * 0.4, strength = 0.42 } = {}) {
    const start = this.h - rows;
    for (let y = Math.max(0, Math.floor(start)); y < this.h; y++) {
      const t = (y - start) / rows;
      for (let x = 0; x < this.w; x++) {
        if (this.alphaAt(x, y) < 24) continue;
        this.px(x, y, color, t * t * strength);
      }
    }
  }

  /** Wash the whole sprite toward a colour — used for tints and spirits. */
  wash(color, alpha) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.alphaAt(x, y) < 12) continue;
        this.px(x, y, color, alpha);
      }
    }
  }

  /** Fade the bottom rows out entirely (spectral NPCs, smoke). */
  fadeBottom(rows) {
    const start = this.h - rows;
    for (let y = Math.max(0, Math.floor(start)); y < this.h; y++) {
      const keep = 1 - (y - start) / rows;
      for (let x = 0; x < this.w; x++) {
        const i = this.index(x, y);
        this.data[i + 3] = this.data[i + 3] * Math.max(0, keep);
      }
    }
  }

  toImageData() {
    return new ImageData(this.data, this.w, this.h);
  }
}

export { BAYER4 };
