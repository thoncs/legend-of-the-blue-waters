/** Deterministic small-state PRNG plus the sampling helpers the game needs. */

/** mulberry32 — fast, good enough, and reproducible from a saved seed. */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const fn = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  fn.int = (max) => Math.floor(fn() * max);
  /** Inclusive integer range. */
  fn.range = (min, max) => min + Math.floor(fn() * (max - min + 1));
  fn.chance = (p) => fn() < p;
  fn.pick = (arr) => arr[Math.floor(fn() * arr.length)];
  /** Pick from `[{weight, ...}]`. */
  fn.weighted = (arr) => {
    let total = 0;
    for (const e of arr) total += e.weight ?? 1;
    let r = fn() * total;
    for (const e of arr) {
      r -= e.weight ?? 1;
      if (r <= 0) return e;
    }
    return arr[arr.length - 1];
  };
  fn.shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(fn() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  fn.seed = (s) => { a = s >>> 0; };
  return fn;
}

/** The shared game RNG. Reseeded on new game / load. */
export const rng = makeRng((Date.now() ^ 0x9e3779b9) >>> 0);

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (v, target, step) =>
  (v < target ? Math.min(target, v + step) : Math.max(target, v - step));
