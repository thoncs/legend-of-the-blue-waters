/**
 * Enemy and boss artwork.
 *
 * Every creature is drawn by one of a handful of silhouette archetypes, then
 * recoloured per enemy. That keeps the roster visually cohesive (they read as
 * one game) while still giving each region its own palette identity.
 */

/* ------------------------------------------------------------------ *
 * Archetype painters. `p` is a pen bound to the sprite cell, `c` is the
 * creature's four-colour palette: base / dark / accent / glow.
 * ------------------------------------------------------------------ */

const ARCH = {
  /** Sideways scuttler with two claws. */
  crab(p, c, S) {
    const cy = S - 12;
    p.ellipse(S / 2, cy, 10, 6, c.a);
    p.ellipse(S / 2, cy - 2, 8, 3, c.d);
    p.rect(S / 2 - 10, cy, 20, 5, c.a);
    p.ellipse(S / 2, cy + 4, 10, 3, c.b);
    // Eyes on stalks.
    p.rect(S / 2 - 4, cy - 8, 1, 4, c.b);
    p.rect(S / 2 + 3, cy - 8, 1, 4, c.b);
    p.ellipse(S / 2 - 4, cy - 9, 1, 1, c.c);
    p.ellipse(S / 2 + 3, cy - 9, 1, 1, c.c);
    // Claws.
    p.ellipse(S / 2 - 13, cy + 1, 4, 3, c.a);
    p.ellipse(S / 2 + 13, cy + 1, 4, 3, c.a);
    p.rect(S / 2 - 16, cy - 1, 4, 1, c.b);
    p.rect(S / 2 + 12, cy - 1, 4, 1, c.b);
    // Legs.
    for (let i = 0; i < 3; i++) {
      p.line(S / 2 - 6 + i * 2, cy + 4, S / 2 - 10 + i * 2, S - 3, c.b);
      p.line(S / 2 + 6 - i * 2, cy + 4, S / 2 + 10 - i * 2, S - 3, c.b);
    }
    p.ellipse(S / 2, S - 2, 10, 2, 'rgba(8,14,22,0.28)');
  },

  /** Waterlogged sailor: slumped humanoid, tattered coat. */
  drowned(p, c, S) {
    const top = S - 26;
    p.ellipse(S / 2, S - 2, 8, 2, 'rgba(8,14,22,0.28)');
    p.rect(S / 2 - 5, top + 10, 10, 11, c.a);
    p.rect(S / 2 - 5, top + 10, 10, 2, c.d);
    // Ragged hem.
    for (let x = -5; x < 5; x++) if ((x + 5) % 2 === 0) p.rect(S / 2 + x, top + 21, 1, 2, c.a);
    // Arms hanging.
    p.rect(S / 2 - 8, top + 11, 3, 9, c.b);
    p.rect(S / 2 + 5, top + 11, 3, 9, c.b);
    p.rect(S / 2 - 8, top + 19, 3, 2, c.c);
    p.rect(S / 2 + 5, top + 19, 3, 2, c.c);
    // Head.
    p.ellipse(S / 2, top + 5, 5, 5, c.c);
    p.rect(S / 2 - 5, top, 10, 3, c.b);
    p.px(S / 2 - 2, top + 4, '#0b1420');
    p.px(S / 2 + 2, top + 4, '#0b1420');
    p.rect(S / 2 - 2, top + 7, 5, 1, '#0b1420');
    // Kelp.
    p.line(S / 2 - 5, top + 2, S / 2 - 7, top + 10, c.d);
    p.line(S / 2 + 5, top + 2, S / 2 + 8, top + 12, c.d);
    p.rect(S / 2 - 2, S - 4, 5, 2, c.b);
  },

  /** Floating flame-spirit inside a lantern glow. */
  wisp(p, c, S) {
    const cy = S / 2;
    p.ellipse(S / 2, cy, 11, 11, c.b);
    p.ellipse(S / 2, cy, 8, 8, c.a);
    p.ellipse(S / 2, cy - 1, 5, 5, c.d);
    p.ellipse(S / 2, cy - 2, 2, 3, c.c);
    p.px(S / 2 - 2, cy - 2, '#0b1420');
    p.px(S / 2 + 2, cy - 2, '#0b1420');
    // Trailing tendrils.
    for (let i = 0; i < 3; i++) {
      const x = S / 2 - 5 + i * 5;
      p.line(x, cy + 6, x + (i - 1) * 2, S - 3, c.a);
    }
    p.ellipse(S / 2, S - 2, 6, 1, 'rgba(8,14,22,0.18)');
  },

  /** Toothy vine-flower on a coiled stem. */
  plant(p, c, S) {
    p.ellipse(S / 2, S - 2, 8, 2, 'rgba(8,14,22,0.28)');
    p.rect(S / 2 - 2, S - 16, 4, 14, c.b);
    p.line(S / 2 - 2, S - 10, S / 2 - 8, S - 14, c.b);
    p.line(S / 2 + 2, S - 12, S / 2 + 9, S - 16, c.b);
    p.ellipse(S / 2 - 9, S - 15, 3, 2, c.a);
    p.ellipse(S / 2 + 10, S - 17, 3, 2, c.a);
    // Maw.
    p.ellipse(S / 2, S - 21, 9, 8, c.a);
    p.ellipse(S / 2, S - 19, 6, 5, c.d);
    p.ellipse(S / 2, S - 19, 4, 3, '#2a0f14');
    for (let i = -3; i <= 3; i += 2) {
      p.px(S / 2 + i, S - 22, c.c);
      p.px(S / 2 + i, S - 16, c.c);
    }
    p.px(S / 2 - 5, S - 24, c.c);
    p.px(S / 2 + 5, S - 24, c.c);
  },

  /** Four-legged prowler. */
  beast(p, c, S) {
    const back = S - 16;
    p.ellipse(S / 2, S - 2, 11, 2, 'rgba(8,14,22,0.28)');
    p.ellipse(S / 2, back, 11, 6, c.a);
    p.ellipse(S / 2 - 2, back - 3, 8, 3, c.d);
    // Legs.
    for (const x of [-8, -4, 4, 8]) p.rect(S / 2 + x, back + 4, 2, 8, c.b);
    for (const x of [-8, -4, 4, 8]) p.rect(S / 2 + x, S - 4, 3, 2, c.b);
    // Head + snout.
    p.ellipse(S / 2 + 10, back - 4, 5, 4, c.a);
    p.rect(S / 2 + 12, back - 3, 5, 3, c.a);
    p.px(S / 2 + 16, back - 2, c.b);
    p.px(S / 2 + 10, back - 5, c.c);
    p.px(S / 2 + 12, back - 5, c.c);
    // Ears + tail.
    p.line(S / 2 + 7, back - 8, S / 2 + 8, back - 12, c.b);
    p.line(S / 2 + 11, back - 8, S / 2 + 12, back - 12, c.b);
    p.line(S / 2 - 11, back - 1, S / 2 - 15, back - 7, c.b);
  },

  /** Bare-bones humanoid. */
  skeleton(p, c, S) {
    const top = S - 27;
    p.ellipse(S / 2, S - 2, 7, 2, 'rgba(8,14,22,0.28)');
    // Skull.
    p.ellipse(S / 2, top + 5, 5, 5, c.a);
    p.rect(S / 2 - 4, top + 7, 8, 4, c.a);
    p.px(S / 2 - 3, top + 4, '#0b1420'); p.px(S / 2 - 2, top + 4, '#0b1420');
    p.px(S / 2 + 2, top + 4, '#0b1420'); p.px(S / 2 + 3, top + 4, '#0b1420');
    p.px(S / 2, top + 7, '#0b1420');
    for (let i = -3; i <= 3; i += 2) p.px(S / 2 + i, top + 10, c.b);
    // Ribs + spine.
    p.rect(S / 2 - 1, top + 11, 2, 10, c.a);
    for (let i = 0; i < 4; i++) p.rect(S / 2 - 5, top + 12 + i * 2, 10, 1, c.a);
    // Arms.
    p.rect(S / 2 - 8, top + 12, 2, 9, c.a);
    p.rect(S / 2 + 6, top + 12, 2, 9, c.a);
    // Legs.
    p.rect(S / 2 - 4, top + 21, 2, 7, c.a);
    p.rect(S / 2 + 2, top + 21, 2, 7, c.a);
    // Rusted blade.
    p.rect(S / 2 + 8, top + 6, 2, 14, c.c);
    p.rect(S / 2 + 6, top + 18, 6, 2, c.b);
  },

  /** Broad-winged moth with an ember body. */
  moth(p, c, S) {
    const cy = S / 2;
    p.ellipse(S / 2 - 9, cy - 2, 8, 7, c.a);
    p.ellipse(S / 2 + 9, cy - 2, 8, 7, c.a);
    p.ellipse(S / 2 - 8, cy + 4, 6, 5, c.b);
    p.ellipse(S / 2 + 8, cy + 4, 6, 5, c.b);
    p.ellipse(S / 2 - 10, cy - 3, 3, 2, c.d);
    p.ellipse(S / 2 + 10, cy - 3, 3, 2, c.d);
    p.ellipse(S / 2, cy, 3, 9, c.c);
    p.ellipse(S / 2, cy - 7, 3, 3, c.b);
    p.px(S / 2 - 1, cy - 8, c.d); p.px(S / 2 + 1, cy - 8, c.d);
    p.line(S / 2 - 1, cy - 10, S / 2 - 5, cy - 14, c.b);
    p.line(S / 2 + 1, cy - 10, S / 2 + 5, cy - 14, c.b);
  },

  /** Low, molten slug. */
  crawler(p, c, S) {
    const base = S - 6;
    p.ellipse(S / 2, S - 2, 11, 2, 'rgba(8,14,22,0.28)');
    p.ellipse(S / 2, base, 13, 5, c.b);
    p.ellipse(S / 2 - 2, base - 3, 10, 4, c.a);
    p.ellipse(S / 2 - 6, base - 5, 5, 3, c.a);
    for (let i = 0; i < 5; i++) p.ellipse(S / 2 - 8 + i * 4, base - 6, 2, 2, c.d);
    p.ellipse(S / 2 + 9, base - 4, 4, 4, c.a);
    p.px(S / 2 + 8, base - 5, c.c); p.px(S / 2 + 11, base - 5, c.c);
    p.px(S / 2 + 12, base - 2, c.d);
  },

  /** Reef singer: humanoid above, finned below. */
  siren(p, c, S) {
    const top = S - 28;
    p.ellipse(S / 2, S - 2, 8, 2, 'rgba(8,14,22,0.24)');
    // Tail.
    p.ellipse(S / 2, S - 8, 5, 9, c.a);
    p.ellipse(S / 2 - 6, S - 3, 5, 3, c.d);
    p.ellipse(S / 2 + 6, S - 3, 5, 3, c.d);
    for (let y = 0; y < 8; y++) p.rect(S / 2 - 4, S - 14 + y * 2, 8, 1, c.b);
    // Torso.
    p.rect(S / 2 - 4, top + 8, 8, 9, c.c);
    p.rect(S / 2 - 6, top + 9, 2, 7, c.c);
    p.rect(S / 2 + 4, top + 9, 2, 7, c.c);
    // Head + hair.
    p.ellipse(S / 2, top + 4, 4, 4, c.c);
    p.rect(S / 2 - 5, top, 10, 4, c.a);
    p.rect(S / 2 - 6, top + 2, 2, 9, c.a);
    p.rect(S / 2 + 5, top + 2, 2, 9, c.a);
    p.px(S / 2 - 2, top + 4, '#0b1420');
    p.px(S / 2 + 2, top + 4, '#0b1420');
    // Song.
    p.px(S / 2 + 8, top + 1, c.d);
    p.px(S / 2 + 9, top - 1, c.d);
    p.px(S / 2 + 11, top - 3, c.d);
  },

  /** Squat coral idol / husk. */
  statue(p, c, S) {
    p.ellipse(S / 2, S - 2, 10, 2, 'rgba(8,14,22,0.28)');
    p.rect(S / 2 - 9, S - 6, 18, 4, c.b);
    p.rect(S / 2 - 7, S - 20, 14, 14, c.a);
    p.rect(S / 2 - 7, S - 20, 14, 2, c.d);
    p.rect(S / 2 - 4, S - 16, 3, 3, '#0b1420');
    p.rect(S / 2 + 2, S - 16, 3, 3, '#0b1420');
    p.rect(S / 2 - 4, S - 16, 3, 1, c.c);
    p.rect(S / 2 + 2, S - 16, 3, 1, c.c);
    p.rect(S / 2 - 5, S - 10, 11, 2, c.b);
    // Crown of spurs.
    for (let i = -6; i <= 6; i += 3) p.line(S / 2 + i, S - 20, S / 2 + i + (i > 0 ? 2 : -2), S - 26, c.c);
  },

  /** Long-bodied eel. */
  eel(p, c, S) {
    for (let i = 0; i < 22; i++) {
      const x = 4 + i;
      const y = S / 2 + Math.round(Math.sin(i * 0.45) * 7);
      const r = 4 - Math.floor(i / 8);
      p.ellipse(x, y, Math.max(1, r), Math.max(1, r), i % 3 === 0 ? c.d : c.a);
    }
    const hx = S - 8, hy = S / 2 + Math.round(Math.sin(21 * 0.45) * 7);
    p.ellipse(hx, hy, 5, 4, c.a);
    p.rect(hx - 1, hy, 7, 3, c.b);
    p.px(hx + 1, hy - 1, c.c);
    for (let i = 0; i < 5; i++) p.px(hx + i, hy + 1, c.d);
    p.line(4, S / 2, 1, S / 2 - 5, c.b);
    p.line(4, S / 2, 1, S / 2 + 5, c.b);
  },

  /** Hooded nothing with two coals for eyes. */
  shade(p, c, S) {
    const top = S - 28;
    for (let y = 0; y < 26; y++) {
      const w = 4 + Math.round(y * 0.42);
      p.rect(S / 2 - w, top + y, w * 2, 1, y % 5 === 0 ? c.d : c.a);
    }
    // Ragged hem.
    for (let x = -12; x < 12; x++) if ((x + 12) % 3 === 0) p.rect(S / 2 + x, top + 26, 2, 2, c.a);
    p.ellipse(S / 2, top + 6, 6, 6, c.b);
    p.ellipse(S / 2, top + 7, 4, 4, '#0b1420');
    p.px(S / 2 - 2, top + 6, c.c);
    p.px(S / 2 + 2, top + 6, c.c);
    p.px(S / 2 - 2, top + 5, c.c);
    p.px(S / 2 + 2, top + 5, c.c);
    // Grasping hands.
    p.rect(S / 2 - 11, top + 14, 3, 2, c.d);
    p.rect(S / 2 + 8, top + 14, 3, 2, c.d);
  },

  /** Plated soldier with a tower shield. */
  armored(p, c, S) {
    const top = S - 28;
    p.ellipse(S / 2, S - 2, 9, 2, 'rgba(8,14,22,0.3)');
    p.rect(S / 2 - 6, top + 9, 12, 12, c.a);
    p.rect(S / 2 - 6, top + 9, 12, 2, c.d);
    p.rect(S / 2 - 1, top + 11, 2, 10, c.b);
    p.rect(S / 2 - 8, top + 9, 3, 4, c.d);
    p.rect(S / 2 + 5, top + 9, 3, 4, c.d);
    // Helm.
    p.rect(S / 2 - 5, top + 1, 10, 8, c.a);
    p.rect(S / 2 - 5, top + 4, 10, 2, '#0b1420');
    p.px(S / 2 - 3, top + 5, c.c);
    p.px(S / 2 + 3, top + 5, c.c);
    p.rect(S / 2 - 1, top - 3, 2, 4, c.c);
    // Legs.
    p.rect(S / 2 - 5, top + 21, 4, 7, c.b);
    p.rect(S / 2 + 1, top + 21, 4, 7, c.b);
    // Shield + pike.
    p.rect(S / 2 - 13, top + 8, 6, 14, c.d);
    p.rect(S / 2 - 12, top + 10, 4, 10, c.b);
    p.rect(S / 2 + 9, top - 2, 2, 26, c.b);
    p.line(S / 2 + 10, top - 6, S / 2 + 10, top - 2, c.c);
  },

  /** Gliding ray. */
  manta(p, c, S) {
    const cy = S / 2;
    p.ellipse(S / 2, cy, 15, 7, c.a);
    p.ellipse(S / 2, cy - 2, 11, 4, c.d);
    p.ellipse(S / 2 - 13, cy + 2, 4, 2, c.b);
    p.ellipse(S / 2 + 13, cy + 2, 4, 2, c.b);
    p.px(S / 2 - 4, cy - 2, '#0b1420');
    p.px(S / 2 + 4, cy - 2, '#0b1420');
    p.rect(S / 2 - 1, cy + 5, 2, 11, c.b);
    p.px(S / 2, S - 3, c.c);
    for (let i = 0; i < 4; i++) p.px(S / 2 - 8 + i * 5, cy + 4, c.c);
  },

  /* ---------------- bosses ---------------- */

  /** Spectral captain, coat and tricorn, half-transparent. */
  ghostCaptain(p, c, S) {
    const top = 4;
    // Coat that dissolves into mist.
    for (let y = 0; y < 30; y++) {
      const w = 7 + Math.round(y * 0.45);
      p.rect(S / 2 - w, top + 14 + y, w * 2, 1, y > 24 ? c.d : c.a);
    }
    p.rect(S / 2 - 2, top + 16, 4, 26, c.d);
    for (let i = 0; i < 5; i++) p.px(S / 2, top + 18 + i * 5, c.c);
    // Arms.
    p.rect(S / 2 - 13, top + 16, 4, 14, c.a);
    p.rect(S / 2 + 9, top + 16, 4, 14, c.a);
    p.rect(S / 2 - 14, top + 28, 5, 3, c.b);
    // Cutlass.
    p.rect(S / 2 + 13, top + 6, 2, 24, c.c);
    p.rect(S / 2 + 11, top + 28, 6, 2, c.d);
    // Head.
    p.ellipse(S / 2, top + 9, 6, 6, c.b);
    p.px(S / 2 - 2, top + 8, c.c); p.px(S / 2 + 2, top + 8, c.c);
    p.rect(S / 2 - 3, top + 12, 7, 1, c.d);
    // Tricorn.
    p.rect(S / 2 - 10, top + 3, 20, 2, c.d);
    p.ellipse(S / 2, top + 1, 7, 3, c.d);
    p.line(S / 2 - 10, top + 3, S / 2 - 6, top - 1, c.d);
    p.line(S / 2 + 10, top + 3, S / 2 + 6, top - 1, c.d);
    p.px(S / 2 - 4, top + 2, c.c); p.px(S / 2 + 4, top + 2, c.c);
    // Lantern.
    p.rect(S / 2 - 17, top + 30, 5, 6, c.b);
    p.rect(S / 2 - 16, top + 31, 3, 4, c.c);
  },

  /** Rooted tree-guardian with a face in the trunk. */
  treeWarden(p, c, S) {
    // Roots.
    for (let i = -3; i <= 3; i++) {
      p.line(S / 2 + i * 3, S - 14, S / 2 + i * 7, S - 2, c.b);
    }
    p.ellipse(S / 2, S - 3, 20, 3, c.b);
    // Trunk.
    p.rect(S / 2 - 9, S - 34, 18, 21, c.a);
    p.rect(S / 2 - 9, S - 34, 5, 21, c.d);
    p.rect(S / 2 + 5, S - 34, 4, 21, c.b);
    // Face.
    p.ellipse(S / 2 - 4, S - 27, 2, 3, '#0b1420');
    p.ellipse(S / 2 + 4, S - 27, 2, 3, '#0b1420');
    p.px(S / 2 - 4, S - 28, c.c); p.px(S / 2 + 4, S - 28, c.c);
    p.rect(S / 2 - 5, S - 21, 11, 3, '#0b1420');
    for (let i = -4; i <= 4; i += 2) p.px(S / 2 + i, S - 21, c.d);
    // Arms/branches.
    p.line(S / 2 - 9, S - 30, S / 2 - 19, S - 38, c.a);
    p.line(S / 2 + 9, S - 30, S / 2 + 19, S - 36, c.a);
    p.line(S / 2 - 19, S - 38, S / 2 - 22, S - 30, c.a);
    p.line(S / 2 + 19, S - 36, S / 2 + 22, S - 28, c.a);
    // Canopy.
    for (let i = 0; i < 26; i++) {
      const ang = (i / 26) * Math.PI * 2;
      const rx = 18 + Math.round(Math.cos(i * 2.1) * 3);
      p.ellipse(S / 2 + Math.round(Math.cos(ang) * rx * 0.9),
        S - 42 + Math.round(Math.sin(ang) * 8), 4, 4, i % 3 ? c.c : c.d);
    }
    p.ellipse(S / 2, S - 44, 16, 8, c.c);
    p.ellipse(S / 2 - 5, S - 46, 8, 4, c.d);
  },

  /** Volcanic idol head wreathed in flame. */
  idol(p, c, S) {
    p.ellipse(S / 2, S - 3, 18, 3, 'rgba(8,14,22,0.3)');
    p.rect(S / 2 - 16, S - 10, 32, 8, c.b);
    p.rect(S / 2 - 13, S - 36, 26, 26, c.a);
    p.rect(S / 2 - 13, S - 36, 26, 3, c.d);
    p.rect(S / 2 - 13, S - 36, 4, 26, c.d);
    // Carved face.
    p.rect(S / 2 - 9, S - 30, 6, 4, '#160a08');
    p.rect(S / 2 + 3, S - 30, 6, 4, '#160a08');
    p.rect(S / 2 - 9, S - 29, 6, 2, c.c);
    p.rect(S / 2 + 3, S - 29, 6, 2, c.c);
    p.rect(S / 2 - 8, S - 20, 16, 5, '#160a08');
    for (let i = -7; i <= 7; i += 3) {
      p.rect(S / 2 + i, S - 20, 2, 2, c.d);
      p.rect(S / 2 + i, S - 17, 2, 2, c.d);
    }
    // Cracks bleeding heat.
    p.line(S / 2 - 12, S - 14, S / 2 - 4, S - 34, c.c);
    p.line(S / 2 + 11, S - 12, S / 2 + 5, S - 33, c.c);
    // Flame crown.
    for (let i = -4; i <= 4; i++) {
      const h = 6 + Math.round(Math.cos(i * 0.9) * 4);
      p.ellipse(S / 2 + i * 3, S - 38 - h / 2, 2, h / 2, i % 2 ? c.c : c.d);
    }
  },

  /** Coral queen on a throne of reef. */
  coralQueen(p, c, S) {
    p.ellipse(S / 2, S - 3, 18, 3, 'rgba(8,14,22,0.25)');
    // Throne branches behind.
    for (let i = -3; i <= 3; i++) {
      p.line(S / 2 + i * 6, S - 8, S / 2 + i * 8, S - 34 - Math.abs(i) * -2, c.b);
      p.ellipse(S / 2 + i * 8, S - 36, 3, 3, c.b);
    }
    // Skirt of polyps.
    for (let y = 0; y < 16; y++) {
      const w = 6 + y;
      p.rect(S / 2 - w, S - 6 - y, w * 2, 1, y % 4 === 0 ? c.d : c.a);
    }
    // Torso.
    p.rect(S / 2 - 6, S - 34, 12, 13, c.c);
    p.rect(S / 2 - 8, S - 33, 2, 10, c.a);
    p.rect(S / 2 + 6, S - 33, 2, 10, c.a);
    p.rect(S / 2 - 9, S - 24, 18, 2, c.d);
    // Head + crown.
    p.ellipse(S / 2, S - 39, 6, 6, c.c);
    p.px(S / 2 - 2, S - 40, '#0b1420');
    p.px(S / 2 + 2, S - 40, '#0b1420');
    p.rect(S / 2 - 2, S - 36, 5, 1, c.a);
    for (let i = -5; i <= 5; i += 2) {
      const h = 5 + (i === 1 || i === -1 ? 3 : 0);
      p.line(S / 2 + i, S - 44, S / 2 + i, S - 44 - h, c.d);
      p.px(S / 2 + i, S - 45 - h, c.a);
    }
    // Hair fronds.
    p.line(S / 2 - 7, S - 40, S / 2 - 13, S - 28, c.a);
    p.line(S / 2 + 7, S - 40, S / 2 + 13, S - 28, c.a);
    // Pearl.
    p.ellipse(S / 2, S - 27, 3, 3, '#f2f6e8');
  },

  /** Grinning trickster of the mangroves: lantern head, long coat. */
  trickster(p, c, S) {
    p.ellipse(S / 2, S - 3, 12, 3, 'rgba(8,14,22,0.3)');
    // Long spindly legs.
    p.rect(S / 2 - 6, S - 20, 3, 18, c.b);
    p.rect(S / 2 + 3, S - 20, 3, 18, c.b);
    p.rect(S / 2 - 8, S - 4, 6, 2, c.b);
    p.rect(S / 2 + 2, S - 4, 6, 2, c.b);
    // Coat.
    for (let y = 0; y < 20; y++) {
      const w = 5 + Math.round(y * 0.45);
      p.rect(S / 2 - w, S - 40 + y, w * 2, 1, y % 6 === 0 ? c.d : c.a);
    }
    // Arms, one holding a lantern.
    p.rect(S / 2 - 14, S - 38, 3, 16, c.a);
    p.rect(S / 2 + 11, S - 38, 3, 14, c.a);
    p.rect(S / 2 - 16, S - 22, 6, 6, c.b);
    p.rect(S / 2 - 15, S - 21, 4, 4, c.c);
    // Lantern head.
    p.rect(S / 2 - 7, S - 50, 14, 12, c.b);
    p.rect(S / 2 - 5, S - 48, 10, 8, c.c);
    p.rect(S / 2 - 8, S - 51, 16, 2, c.d);
    p.rect(S / 2 - 1, S - 54, 2, 3, c.d);
    // Face cut into the glass.
    p.px(S / 2 - 3, S - 46, '#0b1420'); p.px(S / 2 - 2, S - 47, '#0b1420');
    p.px(S / 2 + 2, S - 46, '#0b1420'); p.px(S / 2 + 3, S - 47, '#0b1420');
    for (let i = -3; i <= 3; i++) p.px(S / 2 + i, S - 42 - (Math.abs(i) === 3 ? 1 : 0), '#0b1420');
  },

  /** Storm saint: veiled figure inside a spiral of wind. */
  stormSaint(p, c, S) {
    // Spiral winds.
    for (let a = 0; a < 200; a++) {
      const t = a / 200;
      const ang = t * Math.PI * 6;
      const r = 6 + t * 22;
      p.px(Math.round(S / 2 + Math.cos(ang) * r),
        Math.round(S / 2 - 4 + Math.sin(ang) * r * 0.72),
        a % 7 === 0 ? c.c : c.d);
    }
    // Robed body.
    for (let y = 0; y < 26; y++) {
      const w = 4 + Math.round(y * 0.4);
      p.rect(S / 2 - w, S - 32 + y, w * 2, 1, y % 5 === 0 ? c.d : c.a);
    }
    p.rect(S / 2 - 10, S - 30, 3, 14, c.a);
    p.rect(S / 2 + 7, S - 30, 3, 14, c.a);
    // Veiled head + halo.
    p.ellipse(S / 2, S - 36, 6, 6, c.a);
    p.rect(S / 2 - 6, S - 38, 12, 3, c.d);
    p.px(S / 2 - 2, S - 36, c.c);
    p.px(S / 2 + 2, S - 36, c.c);
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      p.px(Math.round(S / 2 + Math.cos(ang) * 10), Math.round(S - 37 + Math.sin(ang) * 10), c.c);
    }
    // Lightning.
    p.line(S / 2 + 14, S - 50, S / 2 + 10, S - 40, c.c);
    p.line(S / 2 + 10, S - 40, S / 2 + 15, S - 36, c.c);
    p.line(S / 2 - 15, S - 46, S / 2 - 11, S - 38, c.c);
  },

  /** The trench itself: a ring of teeth around a lightless throat. */
  maw(p, c, S) {
    const cx = S / 2, cy = S / 2 + 2;
    p.ellipse(cx, cy, 26, 22, c.b);
    p.ellipse(cx, cy, 22, 18, c.a);
    p.ellipse(cx, cy, 16, 13, '#0b0d16');
    p.ellipse(cx, cy, 8, 6, '#05060c');
    // Teeth ring.
    for (let a = 0; a < 22; a++) {
      const ang = (a / 22) * Math.PI * 2;
      const x0 = cx + Math.cos(ang) * 21, y0 = cy + Math.sin(ang) * 17;
      const x1 = cx + Math.cos(ang) * 14, y1 = cy + Math.sin(ang) * 11;
      p.line(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), c.d);
    }
    // Watching lights inside.
    p.ellipse(cx - 6, cy - 2, 2, 2, c.c);
    p.ellipse(cx + 7, cy + 1, 2, 2, c.c);
    p.ellipse(cx + 1, cy + 6, 1, 1, c.c);
    // Tendrils.
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + 0.4;
      p.line(Math.round(cx + Math.cos(ang) * 24), Math.round(cy + Math.sin(ang) * 20),
        Math.round(cx + Math.cos(ang) * 31), Math.round(cy + Math.sin(ang) * 27), c.a);
    }
  },

  /** Bounty hunter: coat, wide hat, weapon of choice. */
  rival(p, c, S) {
    const top = S - 34;
    p.ellipse(S / 2, S - 2, 9, 2, 'rgba(8,14,22,0.3)');
    // Coat.
    for (let y = 0; y < 20; y++) {
      const w = 6 + Math.round(y * 0.3);
      p.rect(S / 2 - w, top + 12 + y, w * 2, 1, y % 7 === 0 ? c.d : c.a);
    }
    p.rect(S / 2 - 2, top + 13, 4, 18, c.d);
    // Legs + boots.
    p.rect(S / 2 - 5, top + 30, 4, 4, c.b);
    p.rect(S / 2 + 1, top + 30, 4, 4, c.b);
    // Arms.
    p.rect(S / 2 - 10, top + 13, 3, 12, c.a);
    p.rect(S / 2 + 7, top + 13, 3, 12, c.a);
    // Head.
    p.ellipse(S / 2, top + 7, 5, 5, c.c);
    p.px(S / 2 - 2, top + 7, '#0b1420');
    p.px(S / 2 + 2, top + 7, '#0b1420');
    // Wide hat.
    p.rect(S / 2 - 11, top + 3, 22, 2, c.b);
    p.ellipse(S / 2, top + 1, 6, 3, c.b);
    p.rect(S / 2 - 6, top + 2, 12, 1, c.d);
    // Weapon.
    p.rect(S / 2 + 10, top + 6, 2, 20, c.d);
    p.rect(S / 2 + 8, top + 4, 6, 3, c.d);
  },
};

/* ------------------------------------------------------------------ *
 * Roster: which archetype and palette each battler uses.
 * ------------------------------------------------------------------ */

export const BATTLER_ART = {
  /* --- Marrowport / open coast --- */
  wreckCrab: { art: 'crab', size: 32, pal: ['#b8683a', '#7a3f22', '#ffd45e', '#e09a5a'] },
  reefCrab: { art: 'crab', size: 32, pal: ['#5f9fa8', '#2f6570', '#f2f6e8', '#8fd4d8'] },

  /* --- Moonwrack Shoals --- */
  drownedDeckhand: { art: 'drowned', size: 32, pal: ['#3f6274', '#25404f', '#9fd8ff', '#5c8f6a'] },
  lanternWisp: { art: 'wisp', size: 32, pal: ['#8fd8f5', '#3f6f92', '#f2f6e8', '#c9e6ff'] },
  barnacleGunner: { art: 'crab', size: 32, pal: ['#6a7a6a', '#3a4a3f', '#ffb03a', '#9fb09a'] },

  /* --- Green Fathom / Whisperwood --- */
  thornMimic: { art: 'plant', size: 32, pal: ['#5f9e3a', '#2f5a22', '#f2f6e8', '#b8354a'] },
  groveHowler: { art: 'beast', size: 32, pal: ['#7a6a3a', '#463b20', '#ffd45e', '#a89a5a'] },
  sapRevenant: { art: 'drowned', size: 32, pal: ['#6a5a2a', '#3a3018', '#c8a84a', '#8fbf4a'] },

  /* --- Emberpath Ruins --- */
  ashSkeleton: { art: 'skeleton', size: 32, pal: ['#cfc6b0', '#7a6f60', '#ff6a2b', '#9a8f7a'] },
  cinderMoth: { art: 'moth', size: 32, pal: ['#8a4a3a', '#4a2620', '#ffb03a', '#ff6a2b'] },
  slagCrawler: { art: 'crawler', size: 32, pal: ['#ff6a2b', '#4a2418', '#ffe08a', '#ffb03a'] },
  ashboundSentinel: { art: 'armored', size: 40, pal: ['#8a7a6a', '#4a3f36', '#ff6a2b', '#c8b8a0'] },

  /* --- Pearlmaw Reef --- */
  reefSiren: { art: 'siren', size: 32, pal: ['#4fb8c8', '#2a6f80', '#e8c090', '#a0e8f0'] },
  coralHusk: { art: 'statue', size: 32, pal: ['#d08a86', '#8a4a50', '#f4c0bc', '#f4a3a0'] },
  gulperEel: { art: 'eel', size: 32, pal: ['#5a4f8a', '#2f2850', '#ffd45e', '#8f80c8'] },
  sirenChorus: { art: 'siren', size: 40, pal: ['#7f8fd8', '#3f4a80', '#f0d0b0', '#c0d0ff'] },

  /* --- Sable Mangroves --- */
  lanternjack: { art: 'wisp', size: 32, pal: ['#c8a83a', '#5a4a18', '#fff0b0', '#ffd45e'] },
  mireLurker: { art: 'beast', size: 32, pal: ['#3f5f3a', '#1f3020', '#9fd85a', '#6a8f4a'] },
  bogShade: { art: 'shade', size: 32, pal: ['#2a3a3a', '#141f20', '#9fd85a', '#3f5a58'] },
  hollowSmuggler: { art: 'rival', size: 36, pal: ['#4a3a5a', '#241c30', '#c8a06a', '#7a5f9a'] },

  /* --- Wailing Pass --- */
  squallWraith: { art: 'shade', size: 32, pal: ['#3f5a7a', '#1f2c40', '#c9e6ff', '#6f8fb8'] },
  brinebornHerald: { art: 'armored', size: 36, pal: ['#4a7f8a', '#254048', '#c9e6ff', '#7fb8c0'] },
  stormRay: { art: 'manta', size: 32, pal: ['#4a5f8a', '#232f4a', '#ffd45e', '#8f9fd8'] },

  /* --- Bosses --- */
  halloway: { art: 'ghostCaptain', size: 48, pal: ['#4a7a92', '#2a4a5f', '#c9e6ff', '#7fb8d0'] },
  kaobo: { art: 'treeWarden', size: 48, pal: ['#7a5a34', '#463320', '#6fc24a', '#4f9e3f'] },
  kingsflameIdol: { art: 'idol', size: 48, pal: ['#6a4a3a', '#3a2620', '#ff6a2b', '#ffb03a'] },
  coralDowager: { art: 'coralQueen', size: 48, pal: ['#d0605f', '#8a2f40', '#f4c8c0', '#f4a3a0'] },
  sableman: { art: 'trickster', size: 48, pal: ['#221c2a', '#100c16', '#ffd45e', '#4a3f5a'] },
  saintMarene: { art: 'stormSaint', size: 48, pal: ['#8fa8c8', '#4f6a8a', '#fff0b0', '#c9e6ff'] },
  blackwaterMaw: { art: 'maw', size: 64, pal: ['#2a1f3a', '#160f22', '#ff6a8a', '#4a3560'] },

  /* --- Rival company --- */
  vestrelKo: { art: 'rival', size: 40, pal: ['#2f3440', '#171b24', '#e8b88a', '#8a1a2a'] },
  mardaQuill: { art: 'rival', size: 36, pal: ['#4a3a2a', '#241c14', '#c99060', '#c8813a'] },
  grinBellows: { art: 'armored', size: 40, pal: ['#5a5f68', '#2f3238', '#b8354a', '#9aa2ad'] },
};

/**
 * Paint one battler into its atlas slot.
 * @param {*} p pen bound to the sprite cell
 * @param {string} key battler id
 */
export function drawBattler(p, key) {
  const def = BATTLER_ART[key];
  if (!def) throw new Error(`battlers: unknown battler "${key}"`);
  const [a, b, c, d] = def.pal;
  ARCH[def.art](p, { a, b, c, d }, def.size ?? 32);
}
