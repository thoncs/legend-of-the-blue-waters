/**
 * Chiptune audio, synthesised at runtime with the Web Audio API.
 *
 * No audio files: sound effects are short oscillator/noise envelopes and the
 * music is a small note sequencer running a look-ahead scheduler. Everything
 * routes through master -> (music | sfx) gains so volumes are independent.
 *
 * Browsers block audio until a user gesture, so `unlock()` is called on the
 * first key press; before that the engine silently no-ops.
 */

const NOTE_BASE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** 'a#3' / 'c4' -> frequency in Hz. */
function noteFreq(name) {
  const m = /^([a-g])(#?)(-?\d)$/.exec(name);
  if (!m) return 0;
  const semis = NOTE_BASE[m[1]] + (m[2] ? 1 : 0);
  const octave = parseInt(m[3], 10);
  const midi = (octave + 1) * 12 + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Compact score format: "d4:2 -:1 a4:1" (note:beats, '-' = rest). */
function parseScore(str) {
  const out = [];
  for (const token of str.trim().split(/\s+/)) {
    const [note, beats] = token.split(':');
    out.push({ freq: note === '-' ? 0 : noteFreq(note), beats: parseFloat(beats || '1') });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Original themes. Each loops seamlessly.
 * ------------------------------------------------------------------ */
const THEMES = {
  title: {
    bpm: 84, wave: 'triangle', lead: 0.16, bassGain: 0.15,
    melody:
      'd4:2 a4:2 f4:1 e4:1 d4:2 -:1 c4:1 d4:2 f4:2 ' +
      'g4:2 a4:3 -:1 f4:2 e4:2 d4:4 -:2 ' +
      'a3:2 d4:2 f4:1 g4:1 a4:2 -:1 c5:1 a4:2 g4:2 ' +
      'f4:2 e4:3 -:1 d4:4 -:4',
    bass:
      'd2:4 d2:4 a2:4 a2:4 a#2:4 a#2:4 f2:4 f2:4 ' +
      'd2:4 d2:4 g2:4 g2:4 a2:4 a2:4 d2:8',
  },
  town: {
    bpm: 108, wave: 'square', lead: 0.12, bassGain: 0.13,
    melody:
      'g4:1 a4:1 b4:2 d5:1 b4:1 a4:2 g4:1 e4:1 g4:2 a4:2 ' +
      'b4:1 a4:1 g4:2 e4:1 d4:1 e4:4 ' +
      'e4:1 g4:1 a4:2 c5:1 a4:1 g4:2 e4:1 d4:1 e4:2 g4:2 ' +
      'a4:1 g4:1 e4:2 d4:1 e4:1 g4:4',
    bass:
      'g2:2 d3:2 g2:2 d3:2 e2:2 b2:2 e2:2 b2:2 ' +
      'c3:2 g2:2 c3:2 g2:2 d3:2 a2:2 d3:2 a2:2 ' +
      'g2:2 d3:2 g2:2 d3:2 e2:2 b2:2 e2:2 b2:2 ' +
      'c3:2 g2:2 a2:2 e2:2 g2:4 g2:4',
  },
  field: {
    bpm: 126, wave: 'square', lead: 0.12, bassGain: 0.14,
    melody:
      'd4:1 f4:1 a4:2 a4:1 c5:1 a4:2 g4:1 f4:1 g4:2 f4:2 ' +
      'd4:1 f4:1 a4:2 d5:2 c5:2 a4:4 ' +
      'a#4:1 a4:1 g4:2 f4:1 g4:1 a4:2 f4:1 e4:1 d4:2 c4:2 ' +
      'd4:1 e4:1 f4:2 a4:2 g4:2 d4:4',
    bass:
      'd2:2 d2:2 a2:2 a2:2 a#2:2 a#2:2 f2:2 f2:2 ' +
      'd2:2 d2:2 a2:2 a2:2 d3:2 d3:2 d2:2 d2:2 ' +
      'a#2:2 a#2:2 f2:2 f2:2 c3:2 c3:2 g2:2 g2:2 ' +
      'd2:2 d2:2 a2:2 a2:2 d2:4 d2:4',
  },
  sea: {
    bpm: 96, wave: 'triangle', lead: 0.15, bassGain: 0.15,
    melody:
      'a3:2 c4:2 e4:2 a4:2 g4:3 e4:1 c4:4 ' +
      'd4:2 f4:2 a4:2 c5:2 b4:3 g4:1 e4:4 ' +
      'a4:2 g4:2 e4:2 d4:2 c4:3 a3:1 e4:4 ' +
      'f4:2 e4:2 d4:2 c4:2 a3:6 -:2',
    bass:
      'a2:4 a2:4 f2:4 f2:4 d2:4 d2:4 e2:4 e2:4 ' +
      'a2:4 a2:4 c3:4 c3:4 f2:4 e2:4 a2:8',
  },
  battle: {
    bpm: 156, wave: 'square', lead: 0.13, bassGain: 0.16,
    melody:
      'e4:1 e4:1 g4:1 e4:1 a4:2 g4:2 e4:1 e4:1 d4:1 e4:1 g4:4 ' +
      'e4:1 e4:1 g4:1 a4:1 c5:2 b4:2 a4:1 g4:1 e4:1 d4:1 e4:4 ' +
      'a4:1 a4:1 c5:1 a4:1 d5:2 c5:2 a4:1 a4:1 g4:1 a4:1 c5:4 ' +
      'b4:1 a4:1 g4:1 e4:1 g4:2 a4:2 e4:4 -:4',
    bass:
      'e2:1 e2:1 e2:1 e2:1 e2:1 e2:1 e2:1 e2:1 ' +
      'c2:1 c2:1 c2:1 c2:1 d2:1 d2:1 d2:1 d2:1 ' +
      'e2:1 e2:1 e2:1 e2:1 e2:1 e2:1 e2:1 e2:1 ' +
      'a2:1 a2:1 a2:1 a2:1 g2:1 g2:1 b2:1 b2:1 ' +
      'a2:1 a2:1 a2:1 a2:1 a2:1 a2:1 a2:1 a2:1 ' +
      'f2:1 f2:1 f2:1 f2:1 g2:1 g2:1 g2:1 g2:1 ' +
      'e2:1 e2:1 e2:1 e2:1 c2:1 c2:1 c2:1 c2:1 ' +
      'e2:1 e2:1 e2:1 e2:1 e2:2 e2:2',
  },
  boss: {
    bpm: 168, wave: 'sawtooth', lead: 0.11, bassGain: 0.17,
    melody:
      'd4:1 d4:1 d#4:1 d4:1 a4:2 g#4:1 g4:1 f4:2 d4:2 ' +
      'd4:1 d4:1 d#4:1 f4:1 g4:2 a4:2 a#4:2 a4:2 ' +
      'd5:1 c5:1 a#4:1 a4:1 g4:2 f4:2 d4:4 ' +
      'a#4:2 a4:2 g4:2 f4:2 d4:4 -:4',
    bass:
      'd2:1 d2:1 d2:1 d2:1 d2:1 d2:1 a#1:1 c2:1 ' +
      'd2:1 d2:1 d2:1 d2:1 f2:1 f2:1 g2:1 g2:1 ' +
      'a#1:1 a#1:1 a#1:1 a#1:1 c2:1 c2:1 c2:1 c2:1 ' +
      'd2:1 d2:1 d2:1 d2:1 d2:2 a1:2',
  },
  ending: {
    bpm: 76, wave: 'triangle', lead: 0.16, bassGain: 0.14,
    melody:
      'c4:2 e4:2 g4:2 c5:2 b4:4 g4:4 ' +
      'a4:2 f4:2 g4:2 e4:2 f4:4 c4:4 ' +
      'd4:2 f4:2 a4:2 c5:2 b4:4 g4:4 ' +
      'e4:2 g4:2 c5:4 c4:6 -:2',
    bass:
      'c2:4 c2:4 g2:4 g2:4 f2:4 f2:4 c2:4 c2:4 ' +
      'd2:4 d2:4 g2:4 g2:4 c2:4 c2:4 c2:8',
  },
};

/* ------------------------------------------------------------------ *
 * Sound effects
 * ------------------------------------------------------------------ */
const SFX = {
  cursor: { type: 'tone', wave: 'square', f0: 760, f1: 900, dur: 0.05, gain: 0.20 },
  confirm: { type: 'tone', wave: 'square', f0: 620, f1: 1180, dur: 0.10, gain: 0.24 },
  cancel: { type: 'tone', wave: 'square', f0: 480, f1: 220, dur: 0.10, gain: 0.22 },
  deny: { type: 'tone', wave: 'sawtooth', f0: 200, f1: 140, dur: 0.16, gain: 0.20 },
  hit: { type: 'noise', dur: 0.13, gain: 0.30, f0: 1800, f1: 300 },
  crit: { type: 'noise', dur: 0.22, gain: 0.38, f0: 2600, f1: 260 },
  guard: { type: 'noise', dur: 0.10, gain: 0.22, f0: 900, f1: 500 },
  brk: { type: 'chord', notes: [440, 660, 880], wave: 'square', dur: 0.34, gain: 0.20 },
  heal: { type: 'arp', notes: [523, 659, 784, 1047], wave: 'triangle', step: 0.05, dur: 0.30, gain: 0.20 },
  magic: { type: 'sweep', wave: 'sawtooth', f0: 300, f1: 1500, dur: 0.28, gain: 0.16 },
  shot: { type: 'noise', dur: 0.12, gain: 0.30, f0: 3200, f1: 400 },
  coin: { type: 'arp', notes: [988, 1319], wave: 'square', step: 0.06, dur: 0.16, gain: 0.20 },
  chest: { type: 'arp', notes: [523, 659, 784, 1047, 1319], wave: 'square', step: 0.055, dur: 0.34, gain: 0.20 },
  encounter: { type: 'sweep', wave: 'square', f0: 900, f1: 120, dur: 0.42, gain: 0.22 },
  levelup: { type: 'arp', notes: [523, 659, 784, 1047, 1319, 1568], wave: 'square', step: 0.07, dur: 0.5, gain: 0.22 },
  down: { type: 'sweep', wave: 'sawtooth', f0: 420, f1: 90, dur: 0.5, gain: 0.22 },
  sail: { type: 'noise', dur: 0.45, gain: 0.14, f0: 500, f1: 180 },
  thunder: { type: 'noise', dur: 0.8, gain: 0.30, f0: 320, f1: 60 },
};

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicVolume = 0.55;
    this.sfxVolume = 0.75;
    this.muted = false;
    this.currentTheme = null;
    this._timer = null;
    this._seq = null;
    this.available = typeof window !== 'undefined' &&
      (window.AudioContext || window.webkitAudioContext) !== undefined;
  }

  /** Must be called from a user gesture; safe to call repeatedly. */
  unlock() {
    if (!this.available) return;
    if (!this.ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.master);
      // A theme requested before unlocking starts now.
      if (this._pendingTheme) {
        const t = this._pendingTheme;
        this._pendingTheme = null;
        this.playTheme(t);
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(v) {
    this.muted = v;
    if (this.master) this.master.gain.value = v ? 0 : 1;
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
  }

  _noiseBuffer() {
    if (this._noise) return this._noise;
    const len = Math.floor(this.ctx.sampleRate * 0.6);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  /** Fire a named sound effect. */
  play(name) {
    if (!this.ctx || this.muted) return;
    const def = SFX[name];
    if (!def) return;
    const t = this.ctx.currentTime;
    const out = this.sfxGain;

    if (def.type === 'noise') {
      const src = this.ctx.createBufferSource();
      src.buffer = this._noiseBuffer();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(def.f0, t);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, def.f1), t + def.dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(def.gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + def.dur);
      src.connect(filter).connect(g).connect(out);
      src.start(t);
      src.stop(t + def.dur + 0.02);
      return;
    }

    if (def.type === 'arp') {
      def.notes.forEach((f, i) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = def.wave;
        o.frequency.value = f;
        const at = t + i * def.step;
        g.gain.setValueAtTime(0.0001, at);
        g.gain.linearRampToValueAtTime(def.gain, at + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, at + def.step * 1.9);
        o.connect(g).connect(out);
        o.start(at);
        o.stop(at + def.step * 2.1);
      });
      return;
    }

    if (def.type === 'chord') {
      def.notes.forEach((f) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = def.wave;
        o.frequency.value = f;
        g.gain.setValueAtTime(def.gain / def.notes.length, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + def.dur);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + def.dur + 0.02);
      });
      return;
    }

    // 'tone' and 'sweep' are the same shape with different ramps.
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = def.wave;
    o.frequency.setValueAtTime(def.f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, def.f1), t + def.dur);
    g.gain.setValueAtTime(def.gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + def.dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + def.dur + 0.02);
  }

  /** Start (or switch to) a looping theme. Passing the current theme is a no-op. */
  playTheme(name) {
    if (this.currentTheme === name) return;
    if (!THEMES[name]) return;
    this.currentTheme = name;
    if (!this.ctx) { this._pendingTheme = name; return; }
    this.stopTheme(false);

    const def = THEMES[name];
    const beat = 60 / def.bpm;
    const melody = parseScore(def.melody);
    const bass = parseScore(def.bass);
    const melodyLen = melody.reduce((s, n) => s + n.beats, 0);
    const bassLen = bass.reduce((s, n) => s + n.beats, 0);
    const loopBeats = Math.max(melodyLen, bassLen);

    this._seq = {
      def, beat, melody, bass, loopBeats,
      loopSeconds: loopBeats * beat,
      nextLoopAt: this.ctx.currentTime + 0.08,
      nodes: [],
    };
    this._tick();
    this._timer = setInterval(() => this._tick(), 120);
  }

  stopTheme(clearName = true) {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._seq) {
      for (const n of this._seq.nodes) {
        try { n.o.stop(); } catch { /* already stopped */ }
        try { n.o.disconnect(); n.g.disconnect(); } catch { /* detached */ }
      }
      this._seq = null;
    }
    if (clearName) this.currentTheme = null;
  }

  _voice(freq, when, dur, wave, gain, dest, bag) {
    if (!freq) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.012);
    g.gain.setValueAtTime(gain, when + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur * 0.98);
    o.connect(g).connect(dest);
    o.start(when);
    o.stop(when + dur);
    if (bag) bag.push({ o, g, end: when + dur });
  }

  /** Queue one full loop of the current theme starting at `at`. */
  _scheduleLoop(at) {
    const s = this._seq;
    const dest = this.musicGain;
    let t = 0;
    for (const n of s.melody) {
      this._voice(n.freq, at + t * s.beat, n.beats * s.beat * 0.92,
        s.def.wave, s.def.lead, dest, s.nodes);
      t += n.beats;
    }
    t = 0;
    for (const n of s.bass) {
      this._voice(n.freq, at + t * s.beat, n.beats * s.beat * 0.9,
        'triangle', s.def.bassGain, dest, s.nodes);
      t += n.beats;
    }
  }

  /**
   * Schedule whole loops slightly ahead of time. Doing it a loop at a time
   * (rather than note by note) keeps the two voices perfectly aligned even
   * when their written lengths differ.
   */
  _tick() {
    const s = this._seq;
    if (!s || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now > s.nextLoopAt - 0.5) {
      this._scheduleLoop(Math.max(s.nextLoopAt, now + 0.02));
      s.nextLoopAt = Math.max(s.nextLoopAt, now + 0.02) + s.loopSeconds;
    }
    // Drop references to voices that have finished.
    if (s.nodes.length > 400) {
      s.nodes = s.nodes.filter((n) => n.end > now);
    }
  }

  /** Short non-looping flourish; the previous theme resumes afterwards. */
  fanfare(kind = 'victory') {
    if (!this.ctx || this.muted) return;
    const notes = kind === 'victory'
      ? [[523, 0], [659, 0.09], [784, 0.18], [1047, 0.27], [880, 0.42], [1047, 0.52]]
      : [[392, 0], [349, 0.14], [294, 0.28], [262, 0.46]];
    const t = this.ctx.currentTime;
    for (const [f, off] of notes) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.linearRampToValueAtTime(0.22, t + off + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + off + 0.3);
      o.connect(g).connect(this.sfxGain);
      o.start(t + off);
      o.stop(t + off + 0.32);
    }
  }
}

export const audio = new AudioEngine();
export const THEME_NAMES = Object.keys(THEMES);
