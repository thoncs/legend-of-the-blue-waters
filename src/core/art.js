/**
 * All original artwork for the game, drawn in code into one texture atlas.
 *
 * Nothing here is loaded from disk: tiles, characters, ships, objects and
 * effects are painted at boot into pixel buffers (see `paint.js`) and blitted
 * into a shared atlas, so the whole world batches into very few draw calls.
 *
 * Everything is authored at 48px to the tile with characters 48x72, shaded
 * off six-stop ramps with dithered transitions, ambient occlusion at contact
 * points and a rim light that assumes the sun is up and to the left.
 */
import { Rectangle, Texture, TextureSource } from 'pixi.js';
import { drawBattler, BATTLER_ART } from './battlers.js';
import {
  Pen, makeRamp, rampAt, mix, shade, hash, periodicFbm, parseColor, toHex,
} from './paint.js';

export const TILE = 48;
export const ACTOR_W = 48;
export const ACTOR_H = 72;
export const SHIP_SIZE = 96;

/** The game's whole colour vocabulary. Keep additions rare so art stays cohesive. */
export const PAL = {
  black: '#080e16',
  ink: '#101f2e',
  shadow: '#0b1420',
  deep: '#0f2f47',
  sea: '#1b5675',
  seaLit: '#27789a',
  teal: '#3fb8b0',
  foam: '#93e6dc',
  pale: '#cdeff0',
  white: '#f2f6e8',
  bone: '#ddd6bb',
  boneDark: '#a89f80',

  sand: '#e8cf9a',
  sandDark: '#c8a76a',
  sandWet: '#a98a58',
  dirt: '#8a6a44',

  wood: '#6b452b',
  woodLit: '#8f6039',
  woodPale: '#b08050',

  grass: '#4f9e3f',
  grassDark: '#397a30',
  grassLit: '#74c74d',
  jungle: '#2c5f2a',
  jungleDark: '#1c4220',
  leaf: '#6fc24a',

  rock: '#6b7079',
  rockDark: '#464b54',
  stone: '#8d9099',
  stoneLit: '#aab0b8',
  moss: '#5c7a44',

  lava: '#ff6a2b',
  ember: '#ffb03a',
  emberPale: '#ffe08a',
  ash: '#584e49',
  ashDark: '#332e2b',

  swamp: '#2f4a38',
  swampDark: '#1d3025',
  swampLit: '#4a6b4a',

  coral: '#e0736f',
  coralLit: '#f4a3a0',
  coralDeep: '#a8434f',

  night: '#1b2a4a',
  moon: '#c9e6ff',
  ghost: '#9fd8ff',
  ghostDim: '#5f8fb8',
  spirit: '#b9a6ff',

  gold: '#ffd45e',
  copper: '#c8813a',
  iron: '#9aa2ad',
  blood: '#b8354a',
  wine: '#792438',
  royal: '#3a6fb0',
  violet: '#6b4fa0',
};

/**
 * Material ramps. Every surface in the world shades off one of these rather
 * than off a flat colour plus a darker copy.
 */
export const R = {
  sea: makeRamp(PAL.sea, 6),
  deep: makeRamp(PAL.deep, 6),
  shallow: makeRamp(PAL.seaLit, 6),
  moonSea: makeRamp('#1c3358', 6),
  stormSea: makeRamp('#1c2b40', 6),
  reefWater: makeRamp('#1f7f8e', 6),
  swampWater: makeRamp(PAL.swamp, 6),

  sand: makeRamp(PAL.sand, 6),
  sandWet: makeRamp(PAL.sandWet, 6),
  reefSand: makeRamp('#bfe0d4', 6),
  shoalSand: makeRamp('#9fb2c8', 6),
  dirt: makeRamp(PAL.dirt, 6),

  wood: makeRamp(PAL.woodLit, 6),
  woodPale: makeRamp(PAL.woodPale, 6),

  grass: makeRamp(PAL.grass, 6),
  jungle: makeRamp(PAL.jungle, 6),
  leaf: makeRamp(PAL.leaf, 6),
  moss: makeRamp(PAL.moss, 6),

  rock: makeRamp(PAL.rock, 6),
  stone: makeRamp(PAL.stone, 6),
  ruin: makeRamp('#6a6257', 6),
  ruinWall: makeRamp('#4a463f', 6),
  iron: makeRamp(PAL.iron, 6),

  ash: makeRamp(PAL.ash, 6),
  lava: makeRamp(PAL.lava, 6),
  obsidian: makeRamp('#2a2430', 6),

  swampGround: makeRamp('#4a4a34', 6),
  coral: makeRamp(PAL.coral, 6),
  bone: makeRamp(PAL.bone, 6),
  gold: makeRamp(PAL.gold, 6),
  copper: makeRamp(PAL.copper, 6),
  ghost: makeRamp(PAL.ghost, 6),
  spirit: makeRamp(PAL.spirit, 6),
  plaster: makeRamp(PAL.bone, 6),
  roofRed: makeRamp(PAL.blood, 6),
  roofBlue: makeRamp(PAL.royal, 6),
  roofPalm: makeRamp('#a68b47', 6),
  voidFloor: makeRamp('#161a30', 6),
};

/* ------------------------------------------------------------------ *
 * Atlas plumbing
 * ------------------------------------------------------------------ */

/** 2048 is the texture size every WebGL implementation is required to support. */
const ATLAS_W = 2048;
const ATLAS_MAX_H = 2048;

class ShelfAtlas {
  constructor(width = ATLAS_W, maxHeight = ATLAS_MAX_H) {
    this.width = width;
    this.maxHeight = maxHeight;
    /** Shelf state per page; art at 3x is close enough to the cap to need it. */
    this.pages = [ShelfAtlas._page()];
    /** @type {Map<string, {page:number,x:number,y:number,w:number,h:number}>} */
    this.regions = new Map();
  }

  static _page() {
    return { x: 0, y: 0, rowH: 0, pending: [], canvas: null };
  }

  /** Reserve a w*h slot named `name`; `draw(ctx, x, y)` paints into it. */
  add(name, w, h, draw) {
    if (w > this.width || h > this.maxHeight) {
      throw new Error(`art: sprite "${name}" (${w}x${h}) does not fit an atlas page`);
    }
    let index = this.pages.length - 1;
    let page = this.pages[index];

    if (page.x + w > this.width) {
      page.x = 0;
      page.y += page.rowH + 1;
      page.rowH = 0;
    }
    // Out of vertical room: start a fresh page rather than overflowing silently.
    if (page.y + h + 1 > this.maxHeight) {
      this.pages.push(ShelfAtlas._page());
      index = this.pages.length - 1;
      page = this.pages[index];
    }

    const slot = { page: index, x: page.x, y: page.y, w, h };
    this.regions.set(name, slot);
    page.pending.push({ slot, draw });
    page.x += w + 1;
    page.rowH = Math.max(page.rowH, h);
    return slot;
  }

  /** Reserve a slot painted through a `Pen`, blitted in one putImageData. */
  paint(name, w, h, fn) {
    return this.add(name, w, h, (ctx, x, y) => {
      const p = new Pen(w, h);
      fn(p);
      ctx.putImageData(p.toImageData(), x, y);
    });
  }

  bake() {
    const sources = [];
    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i];
      const canvas = document.createElement('canvas');
      canvas.width = this.width;
      canvas.height = Math.max(64, Math.min(this.maxHeight, page.y + page.rowH + 1));
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      ctx.imageSmoothingEnabled = false;
      for (const { slot, draw } of page.pending) {
        ctx.save();
        draw(ctx, slot.x, slot.y);
        ctx.restore();
      }
      page.pending.length = 0;
      page.canvas = canvas;

      const base = Texture.from(canvas);
      base.source.scaleMode = 'nearest';
      base.source.label = `world-atlas-${i}`;
      sources.push(base);
    }

    const frames = new Map();
    for (const [name, r] of this.regions) {
      frames.set(name, new Texture({
        source: sources[r.page].source,
        frame: new Rectangle(r.x, r.y, r.w, r.h),
        label: name,
      }));
    }
    return { base: sources[0], pages: sources, frames, canvases: this.pages.map((p) => p.canvas) };
  }
}

/* ------------------------------------------------------------------ *
 * Shared terrain helpers
 * ------------------------------------------------------------------ */

const TAU = Math.PI * 2;

/**
 * Animated water. Frequencies are whole multiples of the tile so the surface
 * tiles seamlessly, and the phase advances a whole turn over `frames` so the
 * loop closes without a jump.
 */
function water(p, frame, ramp, { seed = 1, frames = 6, crest = null, chop = 1 } = {}) {
  const S = p.w;
  const phase = (frame / frames) * TAU;
  p.material(ramp, { seed, lo: 1, hi: 3, cells: 3, size: S, contrast: 0.75 });

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * TAU;
      const v = (y / S) * TAU;
      const a = Math.sin(u + v * 2 + phase);
      const b = Math.sin(u * 2 - v + phase * 2);
      const n = (a + b) * 0.5 * chop;
      if (n > 0.62) p.px(x, y, ramp[4]);
      else if (n > 0.42) p.px(x, y, ramp[3], 0.7);
      else if (n < -0.75) p.px(x, y, ramp[0], 0.55);
    }
  }

  // A couple of drifting crest dashes: enough to sparkle, not enough to boil.
  const top = crest ?? rampAt(ramp, 5);
  for (let i = 0; i < 3; i++) {
    const cy = Math.floor((hash(i, seed, 3) * S + frame * (S / frames) * 2) % S);
    const cx = Math.floor((hash(i, seed, 7) * S + frame * (S / frames) * 3) % S);
    const len = 4 + Math.floor(hash(i, seed, 11) * 6);
    for (let k = 0; k < len; k++) {
      p.px((cx + k) % S, cy, top, 0.85);
      p.px((cx + k) % S, (cy + 1) % S, top, 0.25);
    }
  }
}

/** Mottled organic ground. */
function ground(p, ramp, seed, opts = {}) {
  p.material(ramp, { seed, lo: 1, hi: 4, cells: 3, size: p.w, contrast: 0.9, ...opts });
}

/** Blocks of masonry with mortar lines, offset row to row. */
function masonry(p, ramp, { seed = 1, rows = 4, cols = 3, mortar = '#00000066' } = {}) {
  const S = p.w;
  const rh = S / rows;
  const cw = S / cols;
  p.material(ramp, { seed, lo: 1, hi: 3, cells: 6, size: S, contrast: 0.7 });
  for (let r = 0; r < rows; r++) {
    const y = Math.round(r * rh);
    const offset = (r % 2) * (cw / 2);
    // Per-block tone variation so the wall does not read as wallpaper.
    for (let c = -1; c < cols + 1; c++) {
      const x = Math.round(c * cw + offset);
      const tone = hash(r, c, seed) * 1.4 - 0.7;
      p.rect(x + 1, y + 1, cw - 2, rh - 2, rampAt(ramp, 2 + tone), 0.5);
      // Lit top-left edge, occluded bottom-right.
      p.rect(x + 1, y + 1, cw - 2, 1, rampAt(ramp, 4), 0.75);
      p.rect(x + 1, y + 1, 1, rh - 2, rampAt(ramp, 4), 0.4);
      p.rect(x + 1, y + rh - 2, cw - 2, 1, rampAt(ramp, 0), 0.7);
    }
    p.rect(0, y, S, 1, mortar);
  }
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cw / 2);
    for (let c = 0; c <= cols; c++) {
      p.rect(Math.round(c * cw + offset), Math.round(r * rh), 1, rh, mortar);
    }
  }
}

/** Planking, either horizontal or vertical. */
function planks(p, ramp, { seed = 1, count = 4, axis = 'y', gap = '#0b142088' } = {}) {
  const S = p.w;
  const step = S / count;
  p.material(ramp, { seed, lo: 2, hi: 4, cells: 6, size: S, contrast: 0.5 });
  for (let i = 0; i < count; i++) {
    const at = Math.round(i * step);
    const tone = 2 + (hash(i, seed, 5) * 1.6 - 0.8);
    if (axis === 'y') {
      p.rect(0, at, S, step - 1, rampAt(ramp, tone), 0.45);
      p.rect(0, at, S, 1, rampAt(ramp, 4), 0.6);       // lit lip
      p.rect(0, at + step - 1, S, 1, gap);              // seam
      // Wood grain.
      for (let g = 0; g < 3; g++) {
        const gy = at + 1 + Math.floor(hash(i, g, seed) * (step - 2));
        const gx = Math.floor(hash(i, g, seed + 3) * S);
        p.rect(gx, gy, 6 + Math.floor(hash(g, i, seed) * 10), 1, rampAt(ramp, 1), 0.4);
      }
    } else {
      p.rect(at, 0, step - 1, S, rampAt(ramp, tone), 0.45);
      p.rect(at, 0, 1, S, rampAt(ramp, 4), 0.6);
      p.rect(at + step - 1, 0, 1, S, gap);
    }
  }
}

/** Overlapping roof shingles. */
function shingles(p, ramp, { seed = 1, rows = 6, per = 4 } = {}) {
  const S = p.w;
  const rh = S / rows;
  const cw = S / per;
  p.fill(rampAt(ramp, 1));
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const offset = (r % 2) * (cw / 2);
    for (let c = -1; c <= per; c++) {
      const x = c * cw + offset;
      const tone = 2 + (hash(r, c, seed) * 1.5 - 0.75);
      p.rect(x + 1, y, cw - 1, rh, rampAt(ramp, tone));
      p.rect(x + 1, y, cw - 1, 1, rampAt(ramp, 4), 0.8);      // catches the light
      p.rect(x + 1, y + rh - 2, cw - 1, 2, rampAt(ramp, 0), 0.55); // shadow under the lip
      p.rect(x, y, 1, rh, rampAt(ramp, 0), 0.7);
    }
  }
}

/** A leafy clump with volume: dark base, lit crown, a few rim leaves. */
function foliage(p, ramp, cx, cy, rx, ry, seed) {
  p.ellipse(cx, cy, rx, ry, rampAt(ramp, 1));
  p.ellipse(cx - rx * 0.18, cy - ry * 0.22, rx * 0.8, ry * 0.72, rampAt(ramp, 2));
  p.ellipse(cx - rx * 0.3, cy - ry * 0.36, rx * 0.5, ry * 0.44, rampAt(ramp, 3));
  p.ellipse(cx - rx * 0.38, cy - ry * 0.46, rx * 0.26, ry * 0.24, rampAt(ramp, 4));
  // Broken edge so the silhouette is not a clean ellipse.
  for (let i = 0; i < 26; i++) {
    const a = hash(i, seed, 1) * TAU;
    const rr = 0.82 + hash(i, seed, 2) * 0.3;
    const x = cx + Math.cos(a) * rx * rr;
    const y = cy + Math.sin(a) * ry * rr;
    p.ellipse(x, y, 2.2, 2, rampAt(ramp, Math.sin(a) < -0.2 ? 3 : 1));
  }
}

/** A tapering trunk with a lit side. */
function trunk(p, ramp, x, yTop, yBottom, width) {
  for (let y = yTop; y <= yBottom; y++) {
    const t = (y - yTop) / Math.max(1, yBottom - yTop);
    const w = width * (0.78 + t * 0.34);
    p.rect(x - w / 2, y, w, 1, rampAt(ramp, 2));
    p.rect(x - w / 2, y, Math.max(1, w * 0.3), 1, rampAt(ramp, 3));
    p.rect(x + w / 2 - 1, y, 1, 1, rampAt(ramp, 0));
  }
}

/* ------------------------------------------------------------------ *
 * Terrain tiles
 * ------------------------------------------------------------------ */

const TILE_ART = {
  /* --- open water (6-frame swell) --- */
  ...Object.fromEntries([0, 1, 2, 3, 4, 5].flatMap((f) => [
    [`water${f}`, (p) => water(p, f, R.sea, { seed: 11, crest: PAL.foam })],
    [`deep${f}`, (p) => water(p, f, R.deep, { seed: 23, crest: PAL.seaLit, chop: 0.8 })],
    [`shallow${f}`, (p) => water(p, f, R.shallow, { seed: 31, crest: PAL.pale })],
    [`moonsea${f}`, (p) => water(p, f, R.moonSea, { seed: 41, crest: PAL.moon, chop: 0.85 })],
  ])),

  /* --- shoreline & ground --- */
  sand: (p) => {
    ground(p, R.sand, 3, { lo: 2, hi: 4 });
    p.speckle(rampAt(R.sand, 5), 0.02, 9, 0.7);
    p.speckle(rampAt(R.sand, 0), 0.03, 12, 0.4);
  },
  sandWet: (p) => {
    ground(p, R.sandWet, 5, { lo: 1, hi: 3 });
    p.speckle(rampAt(R.sandWet, 4), 0.03, 15, 0.5);
  },
  shore: (p) => {
    const S = p.w;
    ground(p, R.sand, 4, { lo: 2, hi: 4 });
    // Wet band, then the waterline with foam lace.
    p.dither(0, S * 0.55, S, S * 0.12, rampAt(R.sand, 2), rampAt(R.sandWet, 2), 0.5);
    p.rect(0, S * 0.67, S, S * 0.33, rampAt(R.shallow, 2));
    p.gradient(0, S * 0.67, S, S * 0.33, R.shallow, { from: 0.7, to: 0.35 });
    for (let x = 0; x < S; x++) {
      const h = 2 + Math.sin((x / S) * TAU * 2) * 2 + hash(x, 0, 7) * 2;
      for (let y = 0; y < h; y++) p.px(x, S * 0.67 - y, PAL.foam, 0.85 - y * 0.2);
    }
  },
  grass: (p) => {
    ground(p, R.grass, 2, { lo: 1, hi: 4 });
    // Scattered blades catching the light.
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(hash(i, 1, 6) * p.w);
      const y = Math.floor(hash(i, 2, 6) * p.h);
      const h = 2 + Math.floor(hash(i, 3, 6) * 3);
      for (let k = 0; k < h; k++) p.px(x, y - k, rampAt(R.grass, k === h - 1 ? 4 : 1));
    }
  },
  grassTall: (p) => {
    ground(p, R.grass, 8, { lo: 1, hi: 3 });
    for (let x = 0; x < p.w; x += 2) {
      const h = 10 + Math.floor(hash(x, 1, 12) * 12);
      const lean = Math.sin((x / p.w) * TAU) * 2;
      for (let y = 0; y < h; y++) {
        const t = y / h;
        p.px(x + lean * t, p.h - 1 - y, rampAt(R.grass, 1 + t * 3));
      }
    }
  },
  flowers: (p) => {
    ground(p, R.grass, 14, { lo: 1, hi: 3 });
    const cols = [PAL.gold, PAL.coralLit, PAL.pale, PAL.spirit];
    for (let i = 0; i < 12; i++) {
      const x = 3 + Math.floor(hash(i, 3, 21) * (p.w - 6));
      const y = 5 + Math.floor(hash(i, 9, 21) * (p.h - 8));
      const c = cols[i % cols.length];
      p.line(x, y, x, y + 4, rampAt(R.grass, 1));
      p.ellipse(x, y, 2, 2, c);
      p.px(x - 1, y - 1, PAL.white, 0.7);
    }
  },
  jungleFloor: (p) => {
    ground(p, R.jungle, 15, { lo: 0, hi: 2 });
    p.speckle(rampAt(R.moss, 3), 0.05, 27, 0.6);
    // Leaf litter.
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(hash(i, 5, 30) * p.w);
      const y = Math.floor(hash(i, 6, 30) * p.h);
      p.ellipse(x, y, 3, 1.4, rampAt(R.leaf, 1), 0.6);
    }
  },
  dirtPath: (p) => {
    ground(p, R.dirt, 17, { lo: 1, hi: 4 });
    p.speckle(rampAt(R.sand, 3), 0.04, 19, 0.5);
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(hash(i, 2, 33) * p.w);
      const y = Math.floor(hash(i, 3, 33) * p.h);
      p.ellipse(x, y, 2, 1.4, rampAt(R.rock, 2), 0.8);
      p.px(x - 1, y - 1, rampAt(R.rock, 4), 0.6);
    }
  },

  /* --- blocking scenery --- */
  jungleTree: (p) => {
    const S = p.w;
    p.rect(0, 0, S, S, rampAt(R.jungle, 0), 0.0);
    trunk(p, R.wood, S / 2, S * 0.5, S - 2, 8);
    foliage(p, R.jungle, S * 0.5, S * 0.36, S * 0.46, S * 0.36, 33);
    foliage(p, R.leaf, S * 0.36, S * 0.26, S * 0.22, S * 0.17, 34);
    p.ao(PAL.shadow, { rows: S * 0.22, strength: 0.5 });
    p.rim(rampAt(R.leaf, 5), -1, -1, 0.35);
  },
  palm: (p) => {
    const S = p.w;
    // Curved trunk.
    for (let y = S - 2; y > S * 0.32; y--) {
      const t = (S - 2 - y) / (S * 0.66);
      const x = S * 0.5 + Math.sin(t * 1.5) * 5;
      const w = 7 - t * 2.5;
      p.rect(x - w / 2, y, w, 1, rampAt(R.wood, 2));
      p.rect(x - w / 2, y, 2, 1, rampAt(R.wood, 4));
      if (y % 4 === 0) p.rect(x - w / 2, y, w, 1, rampAt(R.wood, 1), 0.6);
    }
    const cx = S * 0.5 + Math.sin(1.5) * 5;
    const cy = S * 0.32;
    // Fronds, each a tapering spray of leaflets.
    for (let f = 0; f < 7; f++) {
      const a = -Math.PI + (f / 6) * Math.PI;
      const len = S * (0.32 + hash(f, 1, 44) * 0.12);
      const droop = 0.5;
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const x = cx + Math.cos(a) * len * t;
        const y = cy + Math.sin(a) * len * t + t * t * len * droop;
        const rib = rampAt(R.leaf, i < 10 ? 3 : 2);
        p.px(x, y, rib);
        const spread = (1 - t) * 4 + 1;
        for (let s = 1; s <= spread; s++) {
          p.px(x, y - s, rampAt(R.leaf, 4), 0.85 - s * 0.12);
          p.px(x, y + s, rampAt(R.jungle, 2), 0.85 - s * 0.12);
        }
      }
    }
    p.ellipse(cx, cy, 4, 3, rampAt(R.wood, 1));
    p.ellipse(cx - 4, cy + 3, 2.5, 2.5, PAL.copper);
    p.ellipse(cx + 4, cy + 4, 2.5, 2.5, PAL.copper);
    p.outline(PAL.shadow, { alpha: 0.4 });
  },
  bush: (p) => {
    const S = p.w;
    foliage(p, R.jungle, S * 0.5, S * 0.62, S * 0.4, S * 0.3, 51);
    foliage(p, R.leaf, S * 0.38, S * 0.5, S * 0.2, S * 0.15, 52);
    p.ellipse(S * 0.5, S - 4, S * 0.36, 3, PAL.shadow, 0.35);
    p.rim(rampAt(R.leaf, 5), -1, -1, 0.3);
  },
  rock: (p) => {
    const S = p.w;
    p.poly([
      [S * 0.16, S * 0.86], [S * 0.24, S * 0.44], [S * 0.44, S * 0.28],
      [S * 0.66, S * 0.34], [S * 0.84, S * 0.6], [S * 0.8, S * 0.86],
    ], rampAt(R.rock, 2));
    p.poly([
      [S * 0.24, S * 0.46], [S * 0.44, S * 0.3], [S * 0.6, S * 0.36], [S * 0.4, S * 0.6],
    ], rampAt(R.rock, 4));
    p.poly([
      [S * 0.6, S * 0.38], [S * 0.84, S * 0.6], [S * 0.8, S * 0.84], [S * 0.56, S * 0.7],
    ], rampAt(R.rock, 1));
    p.speckle(rampAt(R.rock, 0), 0.06, 43, 0.4);
    p.ellipse(S * 0.5, S * 0.9, S * 0.34, 3, PAL.shadow, 0.4);
    p.outline(PAL.shadow, { alpha: 0.55 });
    p.rim(rampAt(R.stone, 5), -1, -1, 0.4);
  },
  vine: (p) => {
    // A wall of roots — the Whisperwood's version of a locked door.
    const S = p.w;
    p.material(R.jungle, { seed: 301, lo: 0, hi: 2, cells: 3, size: S });
    for (let x = 0; x < S; x += 7) {
      for (let y = 0; y < S; y++) {
        const wob = Math.sin((y / S) * TAU * 2 + x) * 4;
        p.rect(x + wob, y, 4, 1, rampAt(R.wood, 2));
        p.px(x + wob, y, rampAt(R.wood, 4), 0.7);
        p.px(x + wob + 3, y, rampAt(R.wood, 0), 0.8);
      }
    }
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(hash(i, 1, 303) * S);
      const y = Math.floor(hash(i, 2, 303) * S);
      p.ellipse(x, y, 3, 1.8, rampAt(R.leaf, 2), 0.85);
    }
    p.ao(PAL.black, { rows: S * 0.3, strength: 0.45 });
  },
  cliff: (p) => {
    const S = p.w;
    p.material(R.rock, { seed: 43, lo: 0, hi: 3, cells: 3, size: S, contrast: 1.2 });
    // Strata: horizontal bands with broken, lit upper lips.
    for (let y = 0; y < S; y += 11) {
      const wob = (x) => Math.sin((x / S) * TAU) * 2.5;
      for (let x = 0; x < S; x++) {
        const yy = y + wob(x);
        p.rect(x, yy, 1, 3, rampAt(R.rock, 0), 0.75);
        p.px(x, yy - 1, rampAt(R.rock, 4), 0.6);
      }
    }
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(hash(i, 1, 51) * S);
      const y = Math.floor(hash(i, 2, 51) * S);
      p.line(x, y, x + 3, y + 7, rampAt(R.rock, 0), 0.6);
    }
    p.gradient(0, 0, S, S, R.rock, { from: 0.62, to: 0.2, dither: true });
  },
  cliffTop: (p) => {
    const S = p.w;
    ground(p, R.rock, 61, { lo: 2, hi: 4 });
    p.speckle(rampAt(R.moss, 2), 0.05, 62, 0.5);
    // The lip, where it drops away.
    p.rect(0, S - 8, S, 8, rampAt(R.rock, 1), 0.5);
    p.dither(0, S - 11, S, 4, '#00000000', rampAt(R.rock, 0), 0.55);
  },

  /* --- built environment --- */
  stoneFloor: (p) => masonry(p, R.stone, { seed: 71, rows: 3, cols: 2, mortar: '#3a3f4788' }),
  stoneWall: (p) => {
    masonry(p, R.rock, { seed: 73, rows: 4, cols: 3, mortar: '#0b142099' });
    p.gradient(0, 0, p.w, p.h, R.rock, { from: 0.58, to: 0.3 });
    p.ao(PAL.black, { rows: p.h * 0.3, strength: 0.35 });
  },
  ruinFloor: (p) => {
    ground(p, R.ruin, 81, { lo: 2, hi: 4 });
    p.speckle(rampAt(R.moss, 2), 0.06, 83, 0.6);
    // Cracks.
    for (let i = 0; i < 3; i++) {
      let x = hash(i, 1, 85) * p.w;
      let y = 0;
      while (y < p.h) {
        p.px(x, y, rampAt(R.ruin, 0), 0.8);
        x += (hash(Math.floor(x), y, 86) - 0.5) * 2.4;
        y += 1;
      }
    }
  },
  ruinWall: (p) => {
    masonry(p, R.ruinWall, { seed: 91, rows: 4, cols: 3, mortar: '#0b142099' });
    p.speckle(rampAt(R.moss, 2), 0.05, 93, 0.55);
    p.ao(PAL.black, { rows: p.h * 0.3, strength: 0.4 });
  },
  woodFloor: (p) => planks(p, R.wood, { seed: 101, count: 4, axis: 'y' }),
  woodWall: (p) => {
    planks(p, R.wood, { seed: 103, count: 5, axis: 'x' });
    p.rect(0, 0, p.w, 5, rampAt(R.woodPale, 3));
    p.rect(0, 4, p.w, 1, PAL.shadow, 0.7);
    p.rect(0, p.h - 5, p.w, 5, rampAt(R.wood, 1));
  },
  plaster: (p) => {
    ground(p, R.plaster, 111, { lo: 3, hi: 5, contrast: 0.5 });
    // Timber framing.
    p.rect(0, 0, p.w, 5, rampAt(R.wood, 2));
    p.rect(0, 4, p.w, 1, PAL.shadow, 0.6);
    p.rect(0, p.h * 0.5 - 2, p.w, 4, rampAt(R.wood, 2));
    p.rect(0, p.h * 0.5 + 2, p.w, 1, PAL.shadow, 0.5);
    p.speckle(rampAt(R.plaster, 1), 0.04, 113, 0.4);
  },
  roofRed: (p) => shingles(p, R.roofRed, { seed: 121 }),
  roofBlue: (p) => shingles(p, R.roofBlue, { seed: 123 }),
  roofPalm: (p) => {
    const S = p.w;
    p.fill(rampAt(R.roofPalm, 1));
    for (let r = 0; r < 7; r++) {
      const y = r * (S / 7);
      p.rect(0, y, S, S / 7 - 1, rampAt(R.roofPalm, 2 + (r % 2)));
      // Straw strands.
      for (let x = 0; x < S; x += 2) {
        const h = 3 + hash(x, r, 121) * 4;
        p.rect(x, y, 1, h, rampAt(R.roofPalm, hash(x, r, 125) > 0.6 ? 4 : 1), 0.7);
      }
      p.rect(0, y + S / 7 - 2, S, 2, PAL.shadow, 0.45);
    }
  },
  dock: (p) => {
    planks(p, R.wood, { seed: 131, count: 4, axis: 'y' });
    p.rect(0, 0, 2, p.h, PAL.shadow, 0.6);
    p.rect(p.w - 2, 0, 2, p.h, PAL.shadow, 0.6);
  },
  bridge: (p) => {
    planks(p, R.woodPale, { seed: 133, count: 5, axis: 'y' });
    p.rect(0, 0, p.w, 4, rampAt(R.wood, 3));
    p.rect(0, p.h - 4, p.w, 4, rampAt(R.wood, 3));
  },

  /* --- volcanic --- */
  lava: (p) => {
    const S = p.w;
    p.material(R.lava, { seed: 131, lo: 2, hi: 5, cells: 3, size: S, contrast: 1.3 });
    // Cooled crust floating on the melt.
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = periodicFbm(x, y, 137, S, 3, 3);
        if (n < 0.42) p.px(x, y, rampAt(R.ash, n < 0.34 ? 0 : 1), 0.9);
      }
    }
    p.speckle(PAL.emberPale, 0.02, 133, 0.9);
  },
  lavaRock: (p) => {
    ground(p, R.ash, 141, { lo: 0, hi: 2 });
    // Glowing fissures.
    for (let i = 0; i < 4; i++) {
      let x = hash(i, 1, 143) * p.w;
      let y = hash(i, 2, 143) * p.h;
      for (let k = 0; k < 14; k++) {
        p.px(x, y, PAL.lava, 0.9);
        p.px(x + 1, y, PAL.ember, 0.5);
        p.px(x, y + 1, PAL.emberPale, 0.25);
        x += (hash(k, i, 145) - 0.4) * 3;
        y += 1.4;
      }
    }
  },
  ashGround: (p) => {
    ground(p, R.ash, 151, { lo: 1, hi: 4 });
    p.speckle(rampAt(R.ash, 5), 0.03, 153, 0.5);
  },
  obsidian: (p) => {
    ground(p, R.obsidian, 161, { lo: 0, hi: 2, contrast: 1.4 });
    // Conchoidal facets catching a violet sheen.
    for (let i = 0; i < 10; i++) {
      const x = hash(i, 1, 163) * p.w;
      const y = hash(i, 2, 163) * p.h;
      p.poly([[x, y], [x + 7, y + 3], [x + 3, y + 9]], rampAt(R.obsidian, 3), 0.7);
      p.line(x, y, x + 7, y + 3, PAL.violet, 0.35);
    }
  },

  /* --- mangrove / swamp --- */
  swampWater: (p) => {
    water(p, 0, R.swampWater, { seed: 171, chop: 0.5, crest: rampAt(R.moss, 3) });
    // Duckweed mats.
    for (let i = 0; i < 16; i++) {
      const x = hash(i, 1, 173) * p.w;
      const y = hash(i, 2, 173) * p.h;
      p.ellipse(x, y, 3.5, 2.4, rampAt(R.moss, 2), 0.85);
      p.ellipse(x - 1, y - 1, 1.6, 1, rampAt(R.moss, 4), 0.7);
    }
  },
  swampGround: (p) => {
    ground(p, R.swampGround, 181, { lo: 1, hi: 4 });
    p.speckle(rampAt(R.swampWater, 1), 0.07, 183, 0.6);
  },
  mangrove: (p) => {
    const S = p.w;
    p.material(R.swampWater, { seed: 191, lo: 0, hi: 2, cells: 3, size: S });
    // Stilt roots.
    for (let i = 0; i < 6; i++) {
      const x = 2 + i * (S / 6);
      p.stroke(x, S - 1, x + 6, S * 0.42, 3, rampAt(R.wood, 1));
      p.stroke(x + 6, S * 0.42, x + 12, S * 0.72, 3, rampAt(R.wood, 2));
      p.stroke(x, S - 1, x + 6, S * 0.42, 1, rampAt(R.wood, 3), 0.6);
    }
    foliage(p, R.jungle, S * 0.5, S * 0.18, S * 0.5, S * 0.2, 193);
    p.ao(PAL.black, { rows: S * 0.3, strength: 0.4 });
  },
  reeds: (p) => {
    const S = p.w;
    p.material(R.swampWater, { seed: 201, lo: 0, hi: 2, cells: 3, size: S });
    for (let x = 0; x < S; x += 3) {
      const h = 18 + Math.floor(hash(x, 5, 201) * 24);
      const lean = Math.sin((x / S) * TAU) * 3;
      for (let y = 0; y < h; y++) {
        const t = y / h;
        p.px(x + lean * t, S - 1 - y, rampAt(R.moss, 1 + t * 3));
      }
      if (hash(x, 7, 203) > 0.6) {
        p.ellipse(x + lean, S - h, 1.6, 4, '#8a7a3a');
      }
    }
  },

  /* --- reef --- */
  reefSand: (p) => {
    ground(p, R.reefSand, 211, { lo: 2, hi: 5 });
    // Ripples running across the sandbar.
    for (let y = 0; y < p.h; y++) {
      const off = Math.sin((y / p.h) * TAU * 2) * 4;
      for (let x = 0; x < p.w; x++) {
        if ((x + off) % 9 < 3) p.px(x, y, rampAt(R.reefSand, 1), 0.4);
      }
    }
    p.speckle(PAL.teal, 0.03, 213, 0.5);
  },
  coral: (p) => {
    const S = p.w;
    ground(p, R.reefSand, 215, { lo: 3, hi: 5 });
    // Branching coral heads.
    const branch = (x, y, a, len, depth, ramp) => {
      if (depth <= 0 || len < 2) return;
      const nx = x + Math.cos(a) * len;
      const ny = y + Math.sin(a) * len;
      p.stroke(x, y, nx, ny, Math.max(1.5, depth * 1.4), rampAt(ramp, depth));
      branch(nx, ny, a - 0.6, len * 0.7, depth - 1, ramp);
      branch(nx, ny, a + 0.5, len * 0.72, depth - 1, ramp);
    };
    branch(S * 0.3, S * 0.86, -Math.PI / 2 - 0.2, 10, 4, R.coral);
    branch(S * 0.7, S * 0.9, -Math.PI / 2 + 0.15, 9, 4, makeRamp(PAL.coralLit, 6));
    p.ellipse(S * 0.5, S * 0.94, S * 0.3, 3, PAL.shadow, 0.3);
    p.rim(PAL.coralLit, -1, -1, 0.4);
  },
  reefWater: (p) => {
    water(p, 0, R.reefWater, { seed: 221, crest: PAL.pale });
    // Coral shapes showing through the surface.
    p.ellipse(p.w * 0.28, p.h * 0.7, 8, 5, rampAt(R.reefWater, 0), 0.55);
    p.ellipse(p.w * 0.72, p.h * 0.3, 7, 4, rampAt(R.reefWater, 0), 0.55);
  },

  /* --- haunted shoals --- */
  shoalSand: (p) => {
    ground(p, R.shoalSand, 231, { lo: 2, hi: 4 });
    // Wet ripple lines read far better at night than speckle.
    for (let y = 0; y < p.h; y++) {
      const off = Math.sin((y / p.h) * TAU * 3) * 5;
      for (let x = 0; x < p.w; x++) {
        if ((x + off) % 11 < 5) p.px(x, y, rampAt(R.shoalSand, 1), 0.45);
      }
    }
    p.speckle(rampAt(R.shoalSand, 5), 0.02, 233, 0.6);
  },
  bones: (p) => {
    const S = p.w;
    ground(p, R.shoalSand, 241, { lo: 2, hi: 4 });
    // Ribcage.
    p.stroke(S * 0.2, S * 0.42, S * 0.74, S * 0.36, 3, rampAt(R.bone, 3));
    for (let i = 0; i < 5; i++) {
      const x = S * (0.24 + i * 0.12);
      p.stroke(x, S * 0.4, x + 3, S * 0.66, 2.4, rampAt(R.bone, 2 + (i % 2)));
    }
    // Skull.
    p.ellipse(S * 0.74, S * 0.74, 7, 6, rampAt(R.bone, 3));
    p.ellipse(S * 0.74, S * 0.79, 5, 4, rampAt(R.bone, 4));
    p.ellipse(S * 0.71, S * 0.72, 2, 2.4, PAL.ink);
    p.ellipse(S * 0.78, S * 0.72, 2, 2.4, PAL.ink);
    p.rect(S * 0.71, S * 0.83, 6, 1, PAL.ink, 0.7);
    p.rim(rampAt(R.bone, 5), -1, -1, 0.4);
  },
  wreck: (p) => {
    const S = p.w;
    p.material(R.moonSea, { seed: 251, lo: 0, hi: 2, cells: 3, size: S });
    for (let i = 0; i < 4; i++) {
      const x = 3 + i * (S / 4);
      p.stroke(x, S - 1, x + 5, S * 0.12, 4, rampAt(R.wood, 1));
      p.stroke(x, S - 1, x + 5, S * 0.12, 1.4, rampAt(R.wood, 3), 0.6);
    }
    p.rect(0, S * 0.5, S, 6, rampAt(R.wood, 2));
    p.rect(0, S * 0.5, S, 1, rampAt(R.wood, 4), 0.8);
    p.speckle(rampAt(R.moss, 2), 0.05, 253, 0.6);
    p.ao(PAL.black, { rows: S * 0.3, strength: 0.4 });
  },

  /* --- storm --- */
  stormSea: (p) => {
    water(p, 1, R.stormSea, { seed: 261, crest: '#a8c4dc', chop: 1.35 });
    p.speckle(PAL.white, 0.02, 263, 0.6);
  },
  ironRock: (p) => {
    ground(p, makeRamp('#3d4756', 6), 271, { lo: 1, hi: 3, contrast: 1.2 });
    p.speckle(PAL.iron, 0.04, 273, 0.6);
    for (let i = 0; i < 5; i++) {
      const x = hash(i, 1, 275) * p.w;
      p.line(x, p.h - 1, x + 6, 2, PAL.black, 0.65);
    }
  },
  voidFloor: (p) => {
    ground(p, R.voidFloor, 281, { lo: 0, hi: 2, contrast: 1.3 });
    p.speckle(PAL.violet, 0.02, 283, 0.5);
    // Distant motes of spirit-light.
    for (let i = 0; i < 7; i++) {
      const x = hash(i, 1, 287) * p.w;
      const y = hash(i, 2, 287) * p.h;
      p.ellipse(x, y, 2.4, 2.4, PAL.ghost, 0.28);
      p.px(x, y, PAL.pale, 0.8);
    }
  },
};

/* ------------------------------------------------------------------ *
 * Props (transparent overlays drawn on top of terrain)
 * ------------------------------------------------------------------ */

/** Standard contact shadow for anything standing on the ground. */
function footShadow(p, cx = p.w / 2, cy = p.h - 4, rx = p.w * 0.32, ry = 3.5) {
  p.ellipse(cx, cy, rx, ry, PAL.shadow, 0.42);
  p.ellipse(cx, cy, rx * 0.6, ry * 0.6, PAL.shadow, 0.3);
}

const PROP_ART = {
  chest: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.12, S * 0.36, S * 0.76, S * 0.44, rampAt(R.wood, 2));
    p.gradient(S * 0.12, S * 0.36, S * 0.76, S * 0.44, R.wood, { from: 0.66, to: 0.24 });
    // Domed lid.
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const w = S * 0.76 * (1 - t * t * 0.12);
      p.rect(S * 0.5 - w / 2, S * 0.36 - i, w, 1, rampAt(R.wood, 1 + (1 - t) * 3));
    }
    p.rect(S * 0.12, S * 0.34, S * 0.76, 3, rampAt(R.copper, 3));
    p.rect(S * 0.1, S * 0.36, 4, S * 0.44, rampAt(R.copper, 2));
    p.rect(S * 0.86, S * 0.36, 4, S * 0.44, rampAt(R.copper, 2));
    p.rect(S * 0.44, S * 0.44, S * 0.12, S * 0.16, rampAt(R.gold, 3));
    p.rect(S * 0.47, S * 0.52, 3, 4, PAL.ink);
    p.outline(PAL.shadow, { alpha: 0.6 });
    p.rim(rampAt(R.wood, 5), -1, -1, 0.4);
  },
  chestOpen: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.12, S * 0.5, S * 0.76, S * 0.3, rampAt(R.wood, 2));
    p.rect(S * 0.16, S * 0.5, S * 0.68, 6, PAL.black, 0.8);
    // Lid thrown back.
    p.rect(S * 0.12, S * 0.2, S * 0.76, S * 0.18, rampAt(R.wood, 1));
    p.rect(S * 0.12, S * 0.2, S * 0.76, 3, rampAt(R.copper, 3));
    p.ellipse(S * 0.36, S * 0.56, 3, 2, rampAt(R.gold, 4));
    p.ellipse(S * 0.58, S * 0.57, 2.4, 1.8, rampAt(R.gold, 3));
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  sign: (p) => {
    const S = p.w;
    footShadow(p, S / 2, S - 4, S * 0.18, 2.6);
    p.rect(S * 0.45, S * 0.55, S * 0.1, S * 0.4, rampAt(R.wood, 2));
    p.rect(S * 0.12, S * 0.16, S * 0.76, S * 0.4, rampAt(R.wood, 3));
    p.gradient(S * 0.12, S * 0.16, S * 0.76, S * 0.4, R.wood, { from: 0.75, to: 0.4 });
    p.rect(S * 0.12, S * 0.16, S * 0.76, 2, rampAt(R.woodPale, 4));
    for (let i = 0; i < 3; i++) {
      p.rect(S * 0.2, S * (0.26 + i * 0.09), S * (0.5 - i * 0.1), 2, rampAt(R.wood, 0), 0.75);
    }
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  barrel: (p) => {
    const S = p.w;
    footShadow(p);
    for (let y = S * 0.18; y < S * 0.86; y++) {
      const t = (y - S * 0.18) / (S * 0.68);
      const w = S * (0.5 + Math.sin(t * Math.PI) * 0.09);
      p.rect(S * 0.5 - w / 2, y, w, 1, rampAt(R.wood, 2));
    }
    p.gradient(S * 0.2, S * 0.18, S * 0.6, S * 0.68, R.wood, { axis: 'x', from: 0.8, to: 0.2 });
    for (const yy of [0.28, 0.52, 0.76]) {
      p.rect(S * 0.18, S * yy, S * 0.64, 3, rampAt(R.copper, 2));
      p.rect(S * 0.18, S * yy, S * 0.64, 1, rampAt(R.copper, 4), 0.8);
    }
    p.ellipse(S * 0.5, S * 0.18, S * 0.25, 4, rampAt(R.wood, 4));
    p.outline(PAL.shadow, { alpha: 0.6 });
    p.rim(rampAt(R.woodPale, 5), -1, -1, 0.35);
  },
  crate: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.12, S * 0.2, S * 0.76, S * 0.68, rampAt(R.wood, 3));
    p.gradient(S * 0.12, S * 0.2, S * 0.76, S * 0.68, R.wood, { from: 0.72, to: 0.3 });
    p.rect(S * 0.12, S * 0.2, S * 0.76, 3, rampAt(R.woodPale, 4));
    p.stroke(S * 0.14, S * 0.22, S * 0.86, S * 0.86, 3, rampAt(R.wood, 1));
    p.stroke(S * 0.86, S * 0.22, S * 0.14, S * 0.86, 3, rampAt(R.wood, 1));
    p.rect(S * 0.12, S * 0.2, 3, S * 0.68, rampAt(R.wood, 4), 0.8);
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  brazier: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.38, S * 0.7, S * 0.24, S * 0.24, rampAt(R.iron, 1));
    p.poly([[S * 0.2, S * 0.44], [S * 0.8, S * 0.44], [S * 0.68, S * 0.72], [S * 0.32, S * 0.72]],
      rampAt(R.rock, 1));
    p.rect(S * 0.18, S * 0.4, S * 0.64, 5, rampAt(R.iron, 3));
    p.rect(S * 0.18, S * 0.4, S * 0.64, 2, rampAt(R.iron, 5), 0.8);
    p.rect(S * 0.28, S * 0.48, S * 0.44, 4, rampAt(R.ash, 0));
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  brazierLit: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.38, S * 0.7, S * 0.24, S * 0.24, rampAt(R.iron, 1));
    p.poly([[S * 0.2, S * 0.44], [S * 0.8, S * 0.44], [S * 0.68, S * 0.72], [S * 0.32, S * 0.72]],
      rampAt(R.rock, 1));
    p.rect(S * 0.18, S * 0.4, S * 0.64, 5, rampAt(R.iron, 3));
    // Flame: layered teardrops, hottest at the core.
    p.ellipse(S * 0.5, S * 0.3, S * 0.19, S * 0.24, PAL.lava, 0.9);
    p.ellipse(S * 0.5, S * 0.32, S * 0.13, S * 0.18, PAL.ember);
    p.ellipse(S * 0.5, S * 0.35, S * 0.07, S * 0.11, PAL.emberPale);
    p.ellipse(S * 0.5, S * 0.15, S * 0.05, S * 0.08, PAL.ember, 0.7);
    for (let i = 0; i < 5; i++) {
      p.ellipse(S * (0.34 + hash(i, 1, 9) * 0.32), S * (0.02 + hash(i, 2, 9) * 0.16),
        1.6, 2.2, PAL.ember, 0.6);
    }
    p.outline(PAL.shadow, { alpha: 0.4 });
  },
  beacon: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.38, S * 0.32, S * 0.24, S * 0.62, rampAt(R.rock, 1));
    p.rect(S * 0.38, S * 0.32, S * 0.08, S * 0.62, rampAt(R.rock, 3), 0.8);
    p.rect(S * 0.28, S * 0.9, S * 0.44, 5, rampAt(R.rock, 2));
    p.rect(S * 0.22, S * 0.1, S * 0.56, S * 0.24, rampAt(R.iron, 2));
    p.rect(S * 0.28, S * 0.15, S * 0.44, S * 0.14, PAL.ink);
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  beaconLit: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.38, S * 0.32, S * 0.24, S * 0.62, rampAt(R.rock, 1));
    p.rect(S * 0.38, S * 0.32, S * 0.08, S * 0.62, rampAt(R.rock, 3), 0.8);
    p.rect(S * 0.28, S * 0.9, S * 0.44, 5, rampAt(R.rock, 2));
    p.rect(S * 0.22, S * 0.1, S * 0.56, S * 0.24, rampAt(R.iron, 2));
    p.ellipse(S * 0.5, S * 0.22, S * 0.24, S * 0.16, PAL.gold, 0.55);
    p.ellipse(S * 0.5, S * 0.22, S * 0.15, S * 0.1, PAL.emberPale);
    p.ellipse(S * 0.5, S * 0.22, S * 0.08, S * 0.05, PAL.white);
    p.outline(PAL.shadow, { alpha: 0.4 });
  },
  bowl: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.36, S * 0.66, S * 0.28, S * 0.24, rampAt(R.stone, 1));
    p.ellipse(S * 0.5, S * 0.6, S * 0.34, S * 0.12, rampAt(R.stone, 2));
    p.ellipse(S * 0.5, S * 0.57, S * 0.28, S * 0.09, rampAt(R.stone, 0));
    p.ellipse(S * 0.42, S * 0.55, S * 0.1, S * 0.03, rampAt(R.stone, 4), 0.6);
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  bowlFull: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.36, S * 0.66, S * 0.28, S * 0.24, rampAt(R.stone, 1));
    p.ellipse(S * 0.5, S * 0.6, S * 0.34, S * 0.12, rampAt(R.stone, 2));
    p.ellipse(S * 0.5, S * 0.57, S * 0.28, S * 0.09, rampAt(R.leaf, 2));
    p.ellipse(S * 0.44, S * 0.55, S * 0.08, S * 0.04, rampAt(R.leaf, 4), 0.8);
    p.ellipse(S * 0.4, S * 0.54, 2.4, 2, PAL.gold);
    p.ellipse(S * 0.58, S * 0.56, 2.2, 1.8, PAL.coralLit);
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  shrine: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.14, S * 0.86, S * 0.72, S * 0.12, rampAt(R.rock, 1));
    p.rect(S * 0.2, S * 0.22, S * 0.6, S * 0.66, rampAt(R.stone, 2));
    p.gradient(S * 0.2, S * 0.22, S * 0.6, S * 0.66, R.stone, { axis: 'x', from: 0.72, to: 0.28 });
    p.rect(S * 0.2, S * 0.22, S * 0.6, 4, rampAt(R.stone, 4));
    p.rect(S * 0.3, S * 0.4, S * 0.4, S * 0.42, rampAt(R.rock, 0));
    p.ellipse(S * 0.5, S * 0.56, S * 0.11, S * 0.13, PAL.ghost, 0.55);
    p.ellipse(S * 0.5, S * 0.56, S * 0.06, S * 0.08, PAL.pale);
    p.rect(S * 0.24, S * 0.14, 4, 6, rampAt(R.stone, 3));
    p.rect(S * 0.72, S * 0.14, 4, 6, rampAt(R.stone, 3));
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  statue: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.24, S * 0.8, S * 0.52, S * 0.16, rampAt(R.rock, 1));
    p.rect(S * 0.24, S * 0.8, S * 0.52, 3, rampAt(R.rock, 4), 0.7);
    p.rect(S * 0.36, S * 0.3, S * 0.28, S * 0.5, rampAt(R.stone, 2));
    p.gradient(S * 0.36, S * 0.3, S * 0.28, S * 0.5, R.stone, { axis: 'x', from: 0.75, to: 0.25 });
    p.rect(S * 0.24, S * 0.42, S * 0.52, 5, rampAt(R.stone, 2));  // outstretched arms
    p.ellipse(S * 0.5, S * 0.22, S * 0.12, S * 0.14, rampAt(R.stone, 3));
    p.ellipse(S * 0.45, S * 0.19, S * 0.05, S * 0.05, rampAt(R.stone, 4), 0.8);
    p.px(S * 0.45, S * 0.22, PAL.rockDark);
    p.px(S * 0.56, S * 0.22, PAL.rockDark);
    p.speckle(rampAt(R.moss, 2), 0.04, 77, 0.5);
    p.outline(PAL.shadow, { alpha: 0.6 });
    p.rim(rampAt(R.stone, 5), -1, -1, 0.4);
  },
  grave: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.26, S * 0.28, S * 0.48, S * 0.64, rampAt(R.stone, 2));
    p.ellipse(S * 0.5, S * 0.3, S * 0.24, S * 0.16, rampAt(R.stone, 2));
    p.gradient(S * 0.26, S * 0.28, S * 0.48, S * 0.64, R.stone, { axis: 'x', from: 0.7, to: 0.25 });
    p.rect(S * 0.46, S * 0.4, S * 0.08, S * 0.3, rampAt(R.stone, 0), 0.8);
    p.rect(S * 0.36, S * 0.48, S * 0.28, S * 0.07, rampAt(R.stone, 0), 0.8);
    p.rect(S * 0.18, S * 0.9, S * 0.64, 4, rampAt(R.moss, 2));
    p.speckle(rampAt(R.moss, 1), 0.05, 79, 0.5);
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  lantern: (p) => {
    const S = p.w;
    p.rect(S * 0.46, S * 0.02, S * 0.08, S * 0.14, rampAt(R.iron, 2));
    p.rect(S * 0.26, S * 0.16, S * 0.48, S * 0.06, rampAt(R.iron, 3));
    p.rect(S * 0.28, S * 0.22, S * 0.44, S * 0.44, rampAt(R.iron, 1));
    p.rect(S * 0.33, S * 0.26, S * 0.34, S * 0.36, PAL.gold, 0.85);
    p.rect(S * 0.38, S * 0.31, S * 0.24, S * 0.26, PAL.emberPale);
    p.ellipse(S * 0.5, S * 0.44, S * 0.07, S * 0.1, PAL.white, 0.9);
    p.rect(S * 0.26, S * 0.66, S * 0.48, S * 0.08, rampAt(R.iron, 2));
    p.outline(PAL.shadow, { alpha: 0.5 });
  },
  anchor: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.45, S * 0.1, S * 0.1, S * 0.62, rampAt(R.iron, 2));
    p.rect(S * 0.45, S * 0.1, S * 0.04, S * 0.62, rampAt(R.iron, 4), 0.8);
    p.rect(S * 0.24, S * 0.24, S * 0.52, 5, rampAt(R.iron, 3));
    p.stroke(S * 0.18, S * 0.54, S * 0.5, S * 0.8, 5, rampAt(R.iron, 2));
    p.stroke(S * 0.82, S * 0.54, S * 0.5, S * 0.8, 5, rampAt(R.iron, 2));
    p.ellipse(S * 0.5, S * 0.1, S * 0.09, S * 0.06, rampAt(R.iron, 3));
    p.ellipse(S * 0.5, S * 0.1, S * 0.05, S * 0.03, '#00000000');
    p.outline(PAL.shadow, { alpha: 0.6 });
    p.rim(rampAt(R.iron, 5), -1, -1, 0.45);
  },
  cannon: (p) => {
    const S = p.w;
    footShadow(p);
    p.rect(S * 0.08, S * 0.42, S * 0.68, S * 0.18, rampAt(R.ash, 1));
    p.gradient(S * 0.08, S * 0.42, S * 0.68, S * 0.18, R.ash, { from: 0.75, to: 0.2 });
    p.rect(S * 0.06, S * 0.4, S * 0.14, S * 0.22, rampAt(R.iron, 2));
    p.rect(S * 0.04, S * 0.44, 4, S * 0.14, PAL.black);
    p.rect(S * 0.62, S * 0.38, S * 0.1, S * 0.26, rampAt(R.iron, 2));
    p.ellipse(S * 0.3, S * 0.76, S * 0.13, S * 0.12, rampAt(R.wood, 2));
    p.ellipse(S * 0.3, S * 0.76, S * 0.05, S * 0.05, rampAt(R.iron, 2));
    p.ellipse(S * 0.66, S * 0.78, S * 0.1, S * 0.09, rampAt(R.wood, 2));
    p.outline(PAL.shadow, { alpha: 0.6 });
    p.rim(rampAt(R.iron, 5), -1, -1, 0.35);
  },
  stairsDown: (p) => {
    const S = p.w;
    p.rect(S * 0.06, S * 0.08, S * 0.88, S * 0.86, PAL.black, 0.85);
    for (let i = 0; i < 5; i++) {
      const inset = i * 3;
      const y = S * (0.14 + i * 0.16);
      p.rect(S * 0.08 + inset, y, S * 0.84 - inset * 2, S * 0.09, rampAt(R.stone, 3 - i * 0.4));
      p.rect(S * 0.08 + inset, y + S * 0.09, S * 0.84 - inset * 2, 3, PAL.black, 0.7);
    }
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  door: (p) => {
    const S = p.w;
    p.rect(S * 0.16, S * 0.06, S * 0.68, S * 0.94, rampAt(R.wood, 1));
    p.rect(S * 0.2, S * 0.12, S * 0.6, S * 0.82, rampAt(R.wood, 3));
    p.gradient(S * 0.2, S * 0.12, S * 0.6, S * 0.82, R.wood, { axis: 'x', from: 0.72, to: 0.34 });
    for (let i = 0; i < 4; i++) {
      p.rect(S * 0.2 + i * S * 0.15, S * 0.12, 2, S * 0.82, rampAt(R.wood, 0), 0.6);
    }
    p.rect(S * 0.16, S * 0.06, S * 0.68, 4, rampAt(R.copper, 3));
    p.ellipse(S * 0.72, S * 0.55, 3, 3, rampAt(R.gold, 4));
    p.outline(PAL.shadow, { alpha: 0.65 });
  },
  doorArch: (p) => {
    const S = p.w;
    p.rect(S * 0.08, S * 0.04, S * 0.84, S * 0.96, rampAt(R.rock, 1));
    p.gradient(S * 0.08, S * 0.04, S * 0.84, S * 0.96, R.rock, { from: 0.6, to: 0.25 });
    p.rect(S * 0.22, S * 0.24, S * 0.56, S * 0.76, PAL.black);
    p.ellipse(S * 0.5, S * 0.26, S * 0.28, S * 0.2, PAL.black);
    p.rect(S * 0.08, S * 0.04, S * 0.84, 5, rampAt(R.stone, 4));
    // A little light spilling out of the dark.
    p.dither(S * 0.22, S * 0.22, S * 0.56, 7, '#00000000', rampAt(R.stone, 0), 0.5);
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  well: (p) => {
    const S = p.w;
    footShadow(p);
    p.ellipse(S * 0.5, S * 0.66, S * 0.36, S * 0.2, rampAt(R.stone, 2));
    p.ellipse(S * 0.5, S * 0.64, S * 0.28, S * 0.15, rampAt(R.rock, 0));
    p.ellipse(S * 0.5, S * 0.66, S * 0.24, S * 0.12, rampAt(R.deep, 2));
    p.ellipse(S * 0.44, S * 0.64, S * 0.08, S * 0.04, rampAt(R.deep, 4), 0.6);
    p.rect(S * 0.16, S * 0.66, 5, S * 0.24, rampAt(R.rock, 2));
    p.rect(S * 0.79, S * 0.66, 5, S * 0.24, rampAt(R.rock, 2));
    p.rect(S * 0.2, S * 0.12, S * 0.6, 5, rampAt(R.wood, 3));
    p.rect(S * 0.24, S * 0.14, 5, S * 0.3, rampAt(R.wood, 2));
    p.rect(S * 0.71, S * 0.14, 5, S * 0.3, rampAt(R.wood, 2));
    p.outline(PAL.shadow, { alpha: 0.6 });
  },
  ropeCoil: (p) => {
    const S = p.w;
    footShadow(p, S / 2, S * 0.86, S * 0.28, 3);
    for (let i = 3; i >= 0; i--) {
      const r = S * (0.14 + i * 0.07);
      p.ellipse(S * 0.5, S * 0.72 - i * 2, r, r * 0.42, rampAt(R.sand, 2 - (i % 2)));
      p.ellipse(S * 0.5, S * 0.72 - i * 2, r * 0.7, r * 0.28, rampAt(R.dirt, 2));
    }
    p.rim(rampAt(R.sand, 5), -1, -1, 0.3);
  },
  fire: (p) => {
    const S = p.w;
    p.ellipse(S * 0.5, S * 0.82, S * 0.3, S * 0.08, PAL.lava, 0.35);
    p.ellipse(S * 0.5, S * 0.68, S * 0.24, S * 0.26, PAL.lava, 0.92);
    p.ellipse(S * 0.5, S * 0.7, S * 0.16, S * 0.2, PAL.ember);
    p.ellipse(S * 0.5, S * 0.74, S * 0.08, S * 0.12, PAL.emberPale);
    p.ellipse(S * 0.46, S * 0.46, S * 0.06, S * 0.1, PAL.ember, 0.75);
    p.ellipse(S * 0.56, S * 0.36, S * 0.04, S * 0.07, PAL.ember, 0.5);
    for (let i = 0; i < 6; i++) {
      p.ellipse(S * (0.36 + hash(i, 1, 13) * 0.3), S * (0.14 + hash(i, 2, 13) * 0.2),
        1.6, 2.2, PAL.emberPale, 0.5);
    }
  },
  vine: (p) => {
    const S = p.w;
    p.rect(0, 0, S, 5, rampAt(R.jungle, 0));
    for (let k = 0; k < 3; k++) {
      const baseX = S * (0.22 + k * 0.28);
      for (let y = 0; y < S; y++) {
        const x = baseX + Math.sin(y * 0.16 + k * 2) * 5;
        p.rect(x, y, 3, 1, rampAt(R.jungle, 2));
        p.px(x, y, rampAt(R.leaf, 3), 0.6);
        if (y % 9 === 0) {
          p.ellipse(x + (k % 2 ? 5 : -3), y, 4, 2.2, rampAt(R.leaf, 2));
          p.ellipse(x + (k % 2 ? 5 : -3), y - 1, 2, 1, rampAt(R.leaf, 4), 0.7);
        }
      }
    }
  },
  pearl: (p) => {
    const S = p.w;
    footShadow(p, S / 2, S * 0.84, S * 0.22, 2.6);
    p.ellipse(S * 0.5, S * 0.72, S * 0.34, S * 0.14, PAL.coralDeep);
    p.ellipse(S * 0.5, S * 0.7, S * 0.28, S * 0.1, rampAt(R.coral, 1));
    p.ellipse(S * 0.5, S * 0.52, S * 0.24, S * 0.24, rampAt(R.bone, 3));
    p.ellipse(S * 0.5, S * 0.52, S * 0.2, S * 0.2, PAL.pale);
    p.ellipse(S * 0.43, S * 0.45, S * 0.08, S * 0.07, PAL.white);
    p.ellipse(S * 0.58, S * 0.6, S * 0.06, S * 0.05, PAL.foam, 0.5);
    p.rim(PAL.white, -1, -1, 0.4);
  },
  relic: (p) => {
    const S = p.w;
    footShadow(p, S / 2, S * 0.92, S * 0.24, 2.6);
    p.rect(S * 0.3, S * 0.82, S * 0.4, S * 0.1, rampAt(R.wood, 2));
    p.ellipse(S * 0.5, S * 0.48, S * 0.26, S * 0.32, rampAt(R.gold, 2));
    p.ellipse(S * 0.5, S * 0.48, S * 0.18, S * 0.23, rampAt(R.copper, 2));
    p.ellipse(S * 0.5, S * 0.48, S * 0.09, S * 0.12, rampAt(R.gold, 4));
    p.ellipse(S * 0.44, S * 0.38, S * 0.05, S * 0.06, PAL.white, 0.85);
    // A halo, because it is always a quest item.
    p.ellipse(S * 0.5, S * 0.48, S * 0.34, S * 0.4, PAL.gold, 0.12);
    p.rim(PAL.emberPale, -1, -1, 0.5);
  },
};

/* ------------------------------------------------------------------ *
 * Characters
 * ------------------------------------------------------------------ */

/**
 * Overworld actor styles. Each generates 4 facings x 4 walk frames at 48x72.
 * Keys are referenced from map/NPC data.
 */
export const ACTOR_STYLES = {
  nia: { skin: '#f0c090', hair: '#3b2418', top: PAL.blood, bottom: '#2f3d55', hat: null, accent: PAL.gold, sash: true },
  rook: { skin: '#8a5a3a', hair: '#1d1512', top: '#2f5f8f', bottom: '#3b3b46', hat: '#1d2430', accent: PAL.copper },
  yerena: { skin: '#c98b5e', hair: '#4a2f5f', top: '#cfe0d0', bottom: '#5c7a44', hat: null, accent: PAL.teal, shawl: true },
  sailor: { skin: '#e0b083', hair: '#5a4030', top: '#d8d8d0', bottom: '#3a4a63', hat: null, accent: PAL.royal },
  officer: { skin: '#f0c090', hair: '#6a5030', top: '#2b3f6b', bottom: '#1d2a44', hat: '#1d2a44', accent: PAL.gold },
  smuggler: { skin: '#8a5a3a', hair: '#221a14', top: '#4a3a5a', bottom: '#2a2230', hat: '#2a2230', accent: PAL.violet },
  herbalist: { skin: '#c98b5e', hair: '#2a1f18', top: '#6a8f4a', bottom: '#4a5f38', hat: null, accent: PAL.leaf },
  fisher: { skin: '#b07a4a', hair: '#3a2a1a', top: '#4a8f8a', bottom: '#3a5a58', hat: '#8a7038', accent: PAL.teal },
  smith: { skin: '#8a5a3a', hair: '#4a2a1a', top: '#7a3a2a', bottom: '#3a2a22', hat: null, accent: PAL.ember },
  priest: { skin: '#e0b083', hair: '#d8d8d0', top: '#e8e0d0', bottom: '#c8bca8', hat: null, accent: PAL.gold, shawl: true },
  child: { skin: '#f0c090', hair: '#8a6030', top: '#e0a050', bottom: '#5a6a8a', hat: null, accent: PAL.white, small: true },
  elder: { skin: '#c98b5e', hair: '#c8c8c0', top: '#7a6a5a', bottom: '#4a4038', hat: null, accent: PAL.bone },
  rival: { skin: '#e0b083', hair: '#8a1a2a', top: '#2a2a34', bottom: '#1a1a22', hat: '#1a1a22', accent: PAL.iron },
  ghostSailor: { skin: '#9fd8ff', hair: '#5f8fb8', top: '#4a6f8a', bottom: '#3a5568', hat: null, accent: PAL.ghost, ghost: true },
  maroon: { skin: '#7a4a2a', hair: '#1a1210', top: '#8a6a3a', bottom: '#5a4a30', hat: null, accent: PAL.copper },
  merchant: { skin: '#e0b083', hair: '#5a4a3a', top: '#8a4a7a', bottom: '#4a3a5a', hat: '#4a3a5a', accent: PAL.gold },
};

const DIRS = ['down', 'left', 'right', 'up'];
/** 0 and 2 are the neutral passing poses; 1 and 3 are opposite contacts. */
export const ACTOR_FRAMES = 4;

/**
 * Draw one 48x72 actor pose.
 *
 * Proportions are roughly four-and-a-half heads: a real head with a face, a
 * torso with folds and a collar, arms that swing against the legs, and boots.
 * Light is up and to the left, consistently with every other sprite.
 *
 * @param {Pen} p pen bound to the slot
 * @param {*} s style descriptor
 * @param {'down'|'left'|'right'|'up'} dir
 * @param {0|1|2|3} frame
 */
function drawActor(p, s, dir, frame) {
  const W = p.w;
  const small = !!s.small;
  const k = small ? 0.84 : 1;          // children are shorter, same head size
  const cx = W / 2;

  const skin = makeRamp(s.skin, 6);
  const cloth = makeRamp(s.top, 6);
  const legs = makeRamp(s.bottom, 6);
  const hair = makeRamp(s.hair, 6);
  const hat = s.hat ? makeRamp(s.hat, 6) : null;
  const boot = makeRamp(mix(s.bottom, '#20160f', 0.55), 6);

  // Walk cycle: contacts on 1 and 3, body rises slightly as it passes over.
  const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const bob = frame === 0 || frame === 2 ? 0 : -1;
  const armSwing = -swing;

  const groundY = p.h - 3;
  const footY = groundY - 1;
  const hipY = Math.round(groundY - 22 * k) + bob;
  const shoulderY = Math.round(hipY - 20 * k) + 0;
  const neckY = shoulderY - 2;
  const headBot = neckY + 1;
  const headTop = Math.round(headBot - 19 * k);
  const headW = Math.round(15 * k);
  const torsoW = Math.round(20 * k);

  /* --- contact shadow ------------------------------------------------ */
  p.ellipse(cx, groundY + 1, 11, 3.4, PAL.shadow, 0.4);
  p.ellipse(cx, groundY + 1, 7, 2.2, PAL.shadow, 0.3);

  /* --- legs ---------------------------------------------------------- */
  const legW = Math.round(6 * k);
  const drawLeg = (side, forward) => {
    const baseX = cx + side * Math.round(4.5 * k);
    const lean = forward * 2;
    const topY = hipY - 2;
    for (let y = topY; y <= footY; y++) {
      const t = (y - topY) / Math.max(1, footY - topY);
      const x = baseX + lean * t;
      p.rect(x - legW / 2, y, legW, 1, rampAt(legs, 2));
      p.rect(x - legW / 2, y, 2, 1, rampAt(legs, 3));         // lit edge
      p.rect(x + legW / 2 - 1, y, 1, 1, rampAt(legs, 0), 0.8); // shaded edge
    }
    // Boot.
    const bx = baseX + lean;
    p.rect(bx - legW / 2 - 1, footY - 5, legW + 2, 6, rampAt(boot, 2));
    p.rect(bx - legW / 2 - 1, footY - 5, legW + 2, 1, rampAt(boot, 4), 0.8);
    if (dir === 'left') p.rect(bx - legW / 2 - 3, footY - 3, 3, 4, rampAt(boot, 2));
    if (dir === 'right') p.rect(bx + legW / 2 - 1, footY - 3, 3, 4, rampAt(boot, 2));
    if (dir === 'down') p.rect(bx - legW / 2 - 1, footY - 1, legW + 2, 2, rampAt(boot, 1));
  };
  drawLeg(-1, swing);
  drawLeg(1, -swing);

  /* --- torso --------------------------------------------------------- */
  const torsoTop = shoulderY;
  const torsoBot = hipY + 2;
  for (let y = torsoTop; y <= torsoBot; y++) {
    const t = (y - torsoTop) / Math.max(1, torsoBot - torsoTop);
    // Slight taper at the waist, widening again at the hips.
    const w = torsoW * (1 - Math.sin(t * Math.PI) * 0.1);
    p.rect(cx - w / 2, y, w, 1, rampAt(cloth, 2));
  }
  // Form shading: lit on the upper left, occluded lower right.
  p.gradient(cx - torsoW / 2, torsoTop, torsoW, torsoBot - torsoTop + 1, cloth,
    { axis: 'x', from: 0.72, to: 0.24 });
  p.rect(cx - torsoW / 2, torsoTop, torsoW, 2, rampAt(cloth, 4), 0.8);
  // Cloth folds.
  for (let i = 0; i < 3; i++) {
    const fx = cx - torsoW / 2 + 4 + i * (torsoW / 4);
    p.rect(fx, torsoTop + 5, 1, torsoBot - torsoTop - 6, rampAt(cloth, 1), 0.45);
  }
  // Belt.
  p.rect(cx - torsoW / 2, hipY - 2, torsoW, 4, rampAt(makeRamp(mix(s.bottom, '#000000', 0.4), 6), 2));
  p.rect(cx - torsoW / 2, hipY - 2, torsoW, 1, s.accent ?? PAL.gold, 0.5);
  if (s.accent) p.rect(cx - 2, hipY - 2, 4, 4, s.accent);

  if (s.sash) {
    for (let i = 0; i < torsoW; i++) {
      const x = cx - torsoW / 2 + i;
      const y = torsoTop + 6 + Math.round((i / torsoW) * 8);
      p.rect(x, y, 1, 4, s.accent);
      p.px(x, y, PAL.white, 0.25);
    }
  }
  if (s.shawl) {
    p.rect(cx - torsoW / 2 - 2, torsoTop, torsoW + 4, 8, rampAt(cloth, 4));
    p.rect(cx - torsoW / 2 - 2, torsoTop + 7, torsoW + 4, 1, rampAt(cloth, 1), 0.7);
    p.px(cx - torsoW / 2 - 1, torsoTop + 8, s.accent);
    p.px(cx + torsoW / 2, torsoTop + 8, s.accent);
  }
  // Collar.
  if (dir !== 'up') {
    p.rect(cx - 4, torsoTop, 8, 3, rampAt(cloth, 4));
    p.rect(cx - 2, torsoTop, 4, 4, rampAt(skin, 1), 0.85);
  }

  /* --- arms ---------------------------------------------------------- */
  const armW = Math.round(4 * k);
  const drawArm = (side, forward) => {
    const shX = cx + side * (torsoW / 2 + armW / 2 - 1);
    const topY = torsoTop + 2;
    const botY = hipY + 3;
    for (let y = topY; y <= botY; y++) {
      const t = (y - topY) / Math.max(1, botY - topY);
      const x = shX + forward * t * 2;
      p.rect(x - armW / 2, y, armW, 1, rampAt(cloth, side < 0 ? 3 : 1));
    }
    // Hand.
    const hx = shX + forward * 2;
    p.ellipse(hx, botY + 2, armW * 0.7, 2.4, rampAt(skin, 2));
    p.px(hx - 1, botY + 1, rampAt(skin, 4), 0.7);
  };
  if (dir === 'left') {
    drawArm(-1, armSwing);
  } else if (dir === 'right') {
    drawArm(1, armSwing);
  } else {
    drawArm(-1, armSwing);
    drawArm(1, -armSwing);
  }

  /* --- head ---------------------------------------------------------- */
  const headH = headBot - headTop;
  p.ellipse(cx, headTop + headH / 2, headW / 2, headH / 2, rampAt(skin, 3));
  // Jaw a touch narrower than the cranium.
  p.ellipse(cx, headTop + headH * 0.72, headW / 2 - 1.5, headH * 0.3, rampAt(skin, 3));
  p.gradient(cx - headW / 2, headTop, headW, headH, skin, { axis: 'x', from: 0.78, to: 0.34 });
  // Neck.
  p.rect(cx - 3, headBot - 2, 6, 4, rampAt(skin, 1));

  const eyeY = headTop + Math.round(headH * 0.52);
  const inkEye = '#1a1620';
  if (dir !== 'up') {
    const drawEye = (ex, open = true) => {
      if (!open) return;
      p.rect(ex - 1, eyeY, 3, 3, PAL.white, 0.9);
      p.rect(ex, eyeY, 2, 3, inkEye);
      p.px(ex, eyeY, PAL.white, 0.85);           // catchlight
      p.rect(ex - 1, eyeY - 2, 4, 1, rampAt(hair, 1), 0.85); // brow
    };
    if (dir === 'down') {
      drawEye(cx - 4);
      drawEye(cx + 2);
      // Nose and mouth.
      p.px(cx, eyeY + 3, rampAt(skin, 1), 0.8);
      p.px(cx, eyeY + 4, rampAt(skin, 0), 0.5);
      p.rect(cx - 2, eyeY + 6, 4, 1, mix(s.skin, '#7a2a2a', 0.55), 0.85);
    } else if (dir === 'left') {
      drawEye(cx - 5);
      p.px(cx - headW / 2 + 1, eyeY + 3, rampAt(skin, 1), 0.8);
      p.rect(cx - 5, eyeY + 6, 3, 1, mix(s.skin, '#7a2a2a', 0.55), 0.8);
    } else {
      drawEye(cx + 2);
      p.px(cx + headW / 2 - 2, eyeY + 3, rampAt(skin, 1), 0.8);
      p.rect(cx + 2, eyeY + 6, 3, 1, mix(s.skin, '#7a2a2a', 0.55), 0.8);
    }
  }

  /* --- hair ---------------------------------------------------------- */
  const hairTop = headTop - 1;
  if (dir === 'up') {
    p.ellipse(cx, hairTop + headH / 2, headW / 2 + 0.5, headH / 2, rampAt(hair, 2));
    p.ellipse(cx - 2, hairTop + headH * 0.34, headW * 0.26, headH * 0.2, rampAt(hair, 4), 0.7);
  } else {
    // Cap of hair over the crown, with sideburns framing the face.
    p.ellipse(cx, hairTop + headH * 0.3, headW / 2 + 0.5, headH * 0.34, rampAt(hair, 2));
    p.rect(cx - headW / 2 - 0.5, hairTop + headH * 0.2, 2.5, headH * 0.42, rampAt(hair, 1));
    p.rect(cx + headW / 2 - 2, hairTop + headH * 0.2, 2.5, headH * 0.42, rampAt(hair, 1));
    // Highlight band.
    p.ellipse(cx - 3, hairTop + headH * 0.22, headW * 0.22, headH * 0.1, rampAt(hair, 4), 0.75);
    if (dir === 'left') p.rect(cx - headW / 2 - 0.5, hairTop + headH * 0.2, 4, headH * 0.5, rampAt(hair, 2));
    if (dir === 'right') p.rect(cx + headW / 2 - 3.5, hairTop + headH * 0.2, 4, headH * 0.5, rampAt(hair, 2));
  }

  /* --- headwear ------------------------------------------------------ */
  if (hat) {
    p.ellipse(cx, hairTop + headH * 0.24, headW * 0.66, headH * 0.26, rampAt(hat, 2));
    p.ellipse(cx, hairTop + headH * 0.36, headW * 0.92, 3, rampAt(hat, 1));   // brim
    p.ellipse(cx - 3, hairTop + headH * 0.18, headW * 0.24, headH * 0.08, rampAt(hat, 4), 0.7);
    if (s.accent) p.rect(cx - headW * 0.6, hairTop + headH * 0.3, headW * 1.2, 2, s.accent, 0.9);
  }

  /* --- finishing passes ---------------------------------------------- */
  p.outline(PAL.shadow, { alpha: 0.72 });
  p.rim(mix(s.skin, PAL.white, 0.5), -1, -1, 0.22);
  p.ao(PAL.shadow, { rows: 10, strength: 0.3 });

  if (s.ghost) {
    p.wash(PAL.ghost, 0.28);
    p.fadeBottom(14);
  }
}

/* ------------------------------------------------------------------ *
 * Ships (sea chart)
 * ------------------------------------------------------------------ */

const SHIP_TIERS = [
  { hull: PAL.wood, trim: PAL.woodPale, sail: '#e8e2d0', flag: PAL.blood },
  { hull: '#5a3f5a', trim: PAL.ghost, sail: '#cfe6f5', flag: PAL.ghost },
  { hull: '#3d3a52', trim: PAL.gold, sail: '#f0e6c0', flag: PAL.gold },
];

function drawShip(p, tier, dir) {
  const t = SHIP_TIERS[tier];
  const S = p.w;
  const cx = S / 2;
  const hull = makeRamp(t.hull, 6);
  const trim = makeRamp(t.trim, 6);
  const sail = makeRamp(t.sail, 6);
  const beam = dir === 'up' || dir === 'down' ? 0.3 : 0.46;
  const keelY = S * 0.78;

  // Wake.
  p.ellipse(cx, keelY + 6, S * (beam + 0.12), 5, PAL.foam, 0.22);
  p.ellipse(cx, keelY + 4, S * (beam + 0.04), 3.5, PAL.pale, 0.3);

  /* --- hull --- */
  const hullTop = S * 0.56;
  for (let y = hullTop; y < keelY; y++) {
    const tt = (y - hullTop) / (keelY - hullTop);
    const w = S * beam * 2 * (1 - tt * tt * 0.55);
    p.rect(cx - w / 2, y, w, 1, rampAt(hull, 2));
  }
  p.gradient(cx - S * beam, hullTop, S * beam * 2, keelY - hullTop, hull,
    { axis: 'x', from: 0.7, to: 0.22 });
  // Gunwale and a stripe of trim.
  p.rect(cx - S * beam, hullTop, S * beam * 2, 3, rampAt(trim, 3));
  p.rect(cx - S * beam, hullTop + 4, S * beam * 2, 2, rampAt(hull, 0), 0.6);
  // Planking.
  for (let y = hullTop + 7; y < keelY - 2; y += 4) {
    const tt = (y - hullTop) / (keelY - hullTop);
    const w = S * beam * 2 * (1 - tt * tt * 0.55);
    p.rect(cx - w / 2, y, w, 1, rampAt(hull, 1), 0.55);
  }
  // Gunports on the broadside views.
  if (dir === 'left' || dir === 'right') {
    for (let i = -1; i <= 1; i++) {
      p.rect(cx + i * 14 - 3, hullTop + 9, 6, 5, PAL.black, 0.85);
      p.rect(cx + i * 14 - 3, hullTop + 9, 6, 1, rampAt(trim, 4), 0.6);
    }
  }

  /* --- mast and sails --- */
  const mastY = S * 0.1;
  p.rect(cx - 2, mastY, 4, hullTop - mastY + 4, rampAt(hull, 1));
  p.rect(cx - 2, mastY, 1.5, hullTop - mastY + 4, rampAt(hull, 3), 0.8);

  const sailW = S * (dir === 'up' || dir === 'down' ? 0.34 : 0.4);
  const bellyDir = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  const drawSail = (topY, botY, scale) => {
    for (let y = topY; y < botY; y++) {
      const tt = (y - topY) / (botY - topY);
      const belly = Math.sin(tt * Math.PI) * 5 * bellyDir;
      const w = sailW * scale * (0.72 + Math.sin(tt * Math.PI) * 0.34);
      p.rect(cx - w / 2 + belly, y, w, 1, rampAt(sail, 3));
      // The lee side falls into shadow.
      p.rect(cx + belly + (bellyDir >= 0 ? w / 2 - w * 0.3 : -w / 2), y, w * 0.3, 1,
        rampAt(sail, 1), 0.55);
      p.rect(cx - w / 2 + belly, y, 1.5, 1, rampAt(sail, 5), 0.7);
    }
    // Yard.
    p.rect(cx - sailW * scale * 0.6, topY - 2, sailW * scale * 1.2, 2.5, rampAt(hull, 1));
  };
  drawSail(mastY + 5, S * 0.36, 1);
  drawSail(S * 0.4, hullTop - 3, 0.78);

  /* --- flag --- */
  const flagY = mastY + 1;
  for (let i = 0; i < 12; i++) {
    const wob = Math.sin(i * 0.6) * 1.6;
    p.rect(cx + 2 + i, flagY + wob, 1, 6, t.flag);
  }
  p.rect(cx + 2, flagY, 1, 6, mix(t.flag, PAL.white, 0.4), 0.6);

  p.outline(PAL.shadow, { alpha: 0.6 });
  p.rim(rampAt(sail, 5), -1, -1, 0.25);
}

/* ------------------------------------------------------------------ *
 * Effects & UI bits
 * ------------------------------------------------------------------ */

const FX_ART = {
  dot: (p) => p.fill(PAL.white),
  drop: (p) => {
    p.rect(0, 0, p.w, p.h, PAL.pale, 0.75);
    p.rect(0, 0, 1, p.h * 0.5, PAL.white, 0.9);
  },
  mote: (p) => {
    p.ellipse(p.w / 2, p.h / 2, p.w / 2, p.h / 2, PAL.white, 0.55);
    p.ellipse(p.w / 2, p.h / 2, p.w / 4, p.h / 4, PAL.white);
  },
  slash: (p) => {
    // A tapered arc, brightest at the middle of the swing.
    const S = p.w;
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      const a = -0.9 + t * 2.4;
      const r = S * 0.42;
      const x = S / 2 + Math.cos(a) * r;
      const y = S / 2 + Math.sin(a) * r;
      const thick = Math.sin(t * Math.PI) * 4 + 1;
      p.ellipse(x, y, thick, thick, PAL.white, 0.9);
      p.ellipse(x, y, thick * 1.9, thick * 1.9, PAL.pale, 0.28);
    }
  },
  burst: (p) => {
    const S = p.w;
    p.ellipse(S / 2, S / 2, S * 0.46, S * 0.46, PAL.white, 0.12);
    p.ellipse(S / 2, S / 2, S * 0.3, S * 0.3, PAL.white, 0.34);
    p.ellipse(S / 2, S / 2, S * 0.15, S * 0.15, PAL.white, 0.85);
    p.ellipse(S / 2, S / 2, S * 0.07, S * 0.07, PAL.white);
  },
  ring: (p) => {
    const S = p.w;
    for (let a = 0; a < 360; a++) {
      const r = (a / 360) * Math.PI * 2;
      const rad = S * 0.44;
      p.px(S / 2 + Math.cos(r) * rad, S / 2 + Math.sin(r) * rad, PAL.white, 0.9);
      p.px(S / 2 + Math.cos(r) * (rad - 1), S / 2 + Math.sin(r) * (rad - 1), PAL.pale, 0.5);
    }
  },
  shadowBlob: (p) => {
    p.ellipse(p.w / 2, p.h / 2, p.w * 0.46, p.h * 0.42, PAL.shadow, 0.42);
    p.ellipse(p.w / 2, p.h / 2, p.w * 0.3, p.h * 0.28, PAL.shadow, 0.3);
  },
  cursorHand: (p) => {
    const S = p.w;
    p.poly([[S * 0.12, S * 0.2], [S * 0.82, S * 0.5], [S * 0.12, S * 0.8]], PAL.gold);
    p.poly([[S * 0.2, S * 0.32], [S * 0.6, S * 0.5], [S * 0.2, S * 0.68]], rampAt(R.gold, 4));
    p.outline(PAL.shadow, { alpha: 0.8 });
  },
  waveEdge: (p) => {
    for (let x = 0; x < p.w; x++) {
      const h = p.h * 0.5 + Math.sin((x / p.w) * TAU * 2) * (p.h * 0.4);
      for (let y = 0; y < h; y++) p.px(x, y, PAL.foam, 1 - y / p.h);
    }
  },
  /** Soft radial falloff — the sprite every dynamic light is drawn from. */
  light: (p) => {
    const S = p.w;
    const r = S / 2;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.hypot(x - r, y - r) / r;
        if (d >= 1) continue;
        // Smooth, slightly tightened falloff so lights have a visible core.
        const a = Math.pow(1 - d, 2.2);
        p.px(x, y, PAL.white, a);
      }
    }
  },
  spark: (p) => {
    const S = p.w;
    p.ellipse(S / 2, S / 2, S * 0.18, S * 0.18, PAL.white);
    p.rect(S / 2 - 0.5, 0, 1, S, PAL.white, 0.55);
    p.rect(0, S / 2 - 0.5, S, 1, PAL.white, 0.55);
  },
  smoke: (p) => {
    const S = p.w;
    for (let i = 0; i < 5; i++) {
      p.ellipse(S * (0.3 + hash(i, 1, 5) * 0.4), S * (0.3 + hash(i, 2, 5) * 0.4),
        S * 0.22, S * 0.2, PAL.white, 0.16);
    }
  },
  splash: (p) => {
    const S = p.w;
    p.ellipse(S / 2, S * 0.7, S * 0.4, S * 0.16, PAL.foam, 0.5);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + (i / 8) * Math.PI;
      p.ellipse(S / 2 + Math.cos(a) * S * 0.34, S * 0.7 + Math.sin(a) * S * 0.3,
        2, 2.6, PAL.pale, 0.8);
    }
  },
};

/* ------------------------------------------------------------------ *
 * Public builder
 * ------------------------------------------------------------------ */

export class Art {
  constructor(frames, base) {
    this.frames = frames;
    this.base = base;
  }

  /** Fetch a texture by name; throws loudly rather than silently drawing nothing. */
  tex(name) {
    const t = this.frames.get(name);
    if (!t) throw new Error(`art: unknown texture "${name}"`);
    return t;
  }

  has(name) { return this.frames.has(name); }

  actor(style, dir = 'down', frame = 0) {
    return this.tex(`actor:${style}:${dir}:${frame % ACTOR_FRAMES}`);
  }

  ship(tier = 0, dir = 'down') {
    return this.tex(`ship:${Math.min(2, tier)}:${dir}`);
  }

  battler(key) {
    return this.tex(`battler:${key}`);
  }

  /** Native battle sprite for a party member. */
  hero(style, pose = 'idle') {
    const key = `hero:${style}:${pose}`;
    return this.has(key) ? this.tex(key) : this.tex(`hero:${style}:idle`);
  }
}

/** Build every texture the game uses. Returns an `Art` handle. */
export function buildArt() {
  TextureSource.defaultOptions.scaleMode = 'nearest';
  const atlas = new ShelfAtlas();

  for (const [name, draw] of Object.entries(TILE_ART)) {
    atlas.paint(`tile:${name}`, TILE, TILE, draw);
  }
  for (const [name, draw] of Object.entries(PROP_ART)) {
    atlas.paint(`prop:${name}`, TILE, TILE, draw);
  }
  for (const [key, style] of Object.entries(ACTOR_STYLES)) {
    for (const dir of DIRS) {
      for (let f = 0; f < ACTOR_FRAMES; f++) {
        atlas.paint(`actor:${key}:${dir}:${f}`, ACTOR_W, ACTOR_H, (p) => drawActor(p, style, dir, f));
      }
    }
  }
  for (let tier = 0; tier < SHIP_TIERS.length; tier++) {
    for (const dir of DIRS) {
      atlas.paint(`ship:${tier}:${dir}`, SHIP_SIZE, SHIP_SIZE, (p) => drawShip(p, tier, dir));
    }
  }

  atlas.paint('fx:dot', 3, 3, FX_ART.dot);
  atlas.paint('fx:drop', 3, 12, FX_ART.drop);
  atlas.paint('fx:mote', 6, 6, FX_ART.mote);
  atlas.paint('fx:slash', 72, 72, FX_ART.slash);
  atlas.paint('fx:burst', 72, 72, FX_ART.burst);
  atlas.paint('fx:ring', 72, 72, FX_ART.ring);
  atlas.paint('fx:shadow', 48, 24, FX_ART.shadowBlob);
  atlas.paint('fx:cursor', 24, 24, FX_ART.cursorHand);
  atlas.paint('fx:waveEdge', 48, 12, FX_ART.waveEdge);
  atlas.paint('fx:light', 128, 128, FX_ART.light);
  atlas.paint('fx:spark', 16, 16, FX_ART.spark);
  atlas.paint('fx:smoke', 48, 48, FX_ART.smoke);
  atlas.paint('fx:splash', 48, 48, FX_ART.splash);

  for (const [key, def] of Object.entries(BATTLER_ART)) {
    const size = def.size ?? 96;
    atlas.paint(`battler:${key}`, size, size, (p) => drawBattler(p, key));
  }

  const { base, pages, frames, canvases } = atlas.bake();
  const art = new Art(frames, base);
  art.pages = pages;
  // Kept so tools/atlas-dump.mjs can write the sheet out for inspection.
  art.canvases = canvases;
  return art;
}

export { hash as noise, shade, mix, makeRamp, rampAt, Pen, drawActor, DIRS };
