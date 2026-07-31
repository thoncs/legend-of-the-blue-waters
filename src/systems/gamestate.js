/**
 * The single source of truth for a run: crew, inventory, flags, legend
 * progress, position, clock and reputation. Everything else reads from here,
 * and the save file is just this object serialised.
 */
import { CHARACTERS, PARTY_ORDER, MAX_LEVEL, statsAt, skillsAt, xpForLevel, xpToNext } from '../data/party.js';
import { ITEMS } from '../data/items.js';
import { LEGENDS, MAIN_LEGENDS, LEGEND_STATE } from '../data/legends.js';
import { MAPS, SEA_CHART } from '../data/maps.js';

const STEPS_PER_DAY = 420;
const MINUTES_PER_STEP = 1440 / STEPS_PER_DAY;

export class Member {
  constructor(id) {
    this.id = id;
    this.level = 1;
    this.xp = 0;
    this.equip = { ...CHARACTERS[id].start };
    this.extraSkills = [];
    const s = this.maxStats;
    this.hp = s.hp;
    this.mp = s.mp;
  }

  get def() { return CHARACTERS[this.id]; }
  get name() { return CHARACTERS[this.id].name; }
  get style() { return CHARACTERS[this.id].style; }

  /** Base stats plus everything currently equipped. */
  get maxStats() {
    const out = statsAt(this.id, this.level);
    for (const slot of ['weapon', 'coat', 'trinket']) {
      const id = this.equip[slot];
      if (!id) continue;
      const gear = ITEMS[id];
      if (!gear?.stats) continue;
      for (const [k, v] of Object.entries(gear.stats)) out[k] = (out[k] ?? 0) + v;
    }
    return out;
  }

  /** Elemental resistances contributed by gear. */
  get resistances() {
    const out = new Set();
    for (const slot of ['weapon', 'coat', 'trinket']) {
      const gear = ITEMS[this.equip[slot]];
      for (const el of gear?.resist ?? []) out.add(el);
    }
    return out;
  }

  /** Free-form gear tags ('heatproof', 'regen', 'alwaysFlee', …). */
  get tags() {
    const out = new Set();
    for (const slot of ['weapon', 'coat', 'trinket']) {
      const gear = ITEMS[this.equip[slot]];
      for (const t of gear?.tags ?? []) out.add(t);
    }
    return out;
  }

  get weaponElement() {
    return ITEMS[this.equip.weapon]?.element ?? CHARACTERS[this.id].element;
  }

  get skills() {
    return [...skillsAt(this.id, this.level), ...this.extraSkills];
  }

  get alive() { return this.hp > 0; }

  clampVitals() {
    const s = this.maxStats;
    this.hp = Math.max(0, Math.min(this.hp, s.hp));
    this.mp = Math.max(0, Math.min(this.mp, s.mp));
  }

  fullHeal() {
    const s = this.maxStats;
    this.hp = s.hp;
    this.mp = s.mp;
  }

  /** @returns {string[]} names of newly learned skills */
  gainXp(amount) {
    if (this.level >= MAX_LEVEL) { this.xp += amount; return []; }
    this.xp += amount;
    const learned = [];
    while (this.level < MAX_LEVEL && this.xp >= xpForLevel(this.level + 1)) {
      const before = new Set(this.skills);
      const oldMax = this.maxStats;
      this.level++;
      const newMax = this.maxStats;
      // Level-ups top up by the amount the maximum grew, so they feel good
      // mid-dungeon without being a free full heal.
      this.hp = Math.min(newMax.hp, this.hp + (newMax.hp - oldMax.hp));
      this.mp = Math.min(newMax.mp, this.mp + (newMax.mp - oldMax.mp));
      for (const sk of this.skills) if (!before.has(sk)) learned.push(sk);
    }
    return learned;
  }

  get xpToNext() { return xpToNext(this.level, this.xp); }

  /** Progress toward the next level, 0..1. */
  get xpRatio() {
    if (this.level >= MAX_LEVEL) return 1;
    const lo = xpForLevel(this.level);
    const hi = xpForLevel(this.level + 1);
    return hi === lo ? 1 : (this.xp - lo) / (hi - lo);
  }

  toJSON() {
    return {
      id: this.id, level: this.level, xp: this.xp, hp: this.hp, mp: this.mp,
      equip: { ...this.equip }, extraSkills: [...this.extraSkills],
    };
  }

  static fromJSON(data) {
    const m = new Member(data.id);
    m.level = data.level;
    m.xp = data.xp;
    m.equip = { weapon: null, coat: null, trinket: null, ...data.equip };
    m.extraSkills = data.extraSkills ?? [];
    m.hp = data.hp;
    m.mp = data.mp;
    m.clampVitals();
    return m;
  }
}

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    /** @type {Member[]} */
    this.party = [];
    /** @type {Record<string, number>} */
    this.inventory = {};
    this.gold = 120;
    /** @type {Record<string, boolean>} */
    this.flags = {};
    /** @type {Record<string, {state:string, stage:number, counters:Record<string,number>, branch:string|null}>} */
    this.legends = {};
    this.position = { map: 'marrowport', x: 18, y: 15, dir: 'down' };
    this.ship = { x: SEA_CHART.start.x, y: SEA_CHART.start.y, tier: 0 };
    this.discovered = { marrowport: true };
    this.reputation = { marrowport: 0, mireborne: 0, ashfall: 0 };
    this.steps = 0;
    this.clock = 8 * 60; // 08:00
    this.day = 1;
    this.playTimeMs = 0;
    this.ngPlus = 0;
    this.chests = {};
    this.lastPort = 'marrowport';
    for (const id of MAIN_LEGENDS.concat(['ironBell'])) {
      this.legends[id] = { state: LEGEND_STATE.UNHEARD, stage: 0, counters: {}, branch: null };
    }
  }

  /** Fresh run (optionally carrying a New Game+ crew over). */
  newGame({ carryOver = null } = {}) {
    this.reset();
    this.party = [new Member('nia')];
    this.addItem('sunderedChart', 1);
    this.addItem('rumTonic', 3);
    this.addItem('bitterroot', 1);

    if (carryOver) {
      this.ngPlus = carryOver.ngPlus + 1;
      this.gold = Math.max(500, Math.floor(carryOver.gold * 0.5));
      this.party = carryOver.party.map((m) => {
        const copy = Member.fromJSON(m.toJSON());
        copy.fullHeal();
        return copy;
      });
      // Keep gear and consumables, drop key items and quest flags.
      for (const [id, n] of Object.entries(carryOver.inventory)) {
        if (ITEMS[id]?.kind !== 'key') this.inventory[id] = n;
      }
      this.addItem('sunderedChart', 1);
    }
    const start = MAPS.marrowport.start;
    this.position = { map: 'marrowport', x: start.x, y: start.y, dir: start.dir };
    return this;
  }

  /* ---------------------------- crew ---------------------------- */

  has(charId) { return this.party.some((m) => m.id === charId); }
  member(charId) { return this.party.find((m) => m.id === charId) ?? null; }
  get leader() { return this.party[0]; }
  get livingParty() { return this.party.filter((m) => m.alive); }
  get partyWiped() { return this.party.every((m) => !m.alive); }

  join(charId) {
    if (this.has(charId)) return null;
    const m = new Member(charId);
    // Recruits arrive roughly as strong as the crew they are joining.
    const target = Math.max(1, Math.round(this.averageLevel));
    while (m.level < target) m.gainXp(xpForLevel(m.level + 1) - m.xp);
    m.fullHeal();
    this.party.push(m);
    this.party.sort((a, b) => PARTY_ORDER.indexOf(a.id) - PARTY_ORDER.indexOf(b.id));
    return m;
  }

  get averageLevel() {
    if (!this.party.length) return 1;
    return this.party.reduce((s, m) => s + m.level, 0) / this.party.length;
  }

  restAll() {
    for (const m of this.party) m.fullHeal();
  }

  /** Learn a story skill (legend rewards). @returns true if it was new. */
  teach(charId, skillId) {
    const m = this.member(charId);
    if (!m || m.extraSkills.includes(skillId) || m.skills.includes(skillId)) return false;
    m.extraSkills.push(skillId);
    return true;
  }

  /* -------------------------- inventory -------------------------- */

  addItem(id, count = 1) {
    if (!ITEMS[id]) throw new Error(`gamestate: unknown item "${id}"`);
    this.inventory[id] = (this.inventory[id] ?? 0) + count;
  }

  removeItem(id, count = 1) {
    if (!this.inventory[id]) return false;
    this.inventory[id] -= count;
    if (this.inventory[id] <= 0) delete this.inventory[id];
    return true;
  }

  countItem(id) { return this.inventory[id] ?? 0; }
  hasItem(id) { return (this.inventory[id] ?? 0) > 0; }

  /** Inventory entries of a given kind, in a stable display order. */
  itemsOfKind(...kinds) {
    return Object.entries(this.inventory)
      .filter(([id]) => kinds.includes(ITEMS[id]?.kind))
      .map(([id, count]) => ({ id, count, ...ITEMS[id] }));
  }

  addGold(n) { this.gold = Math.max(0, this.gold + n); }
  spendGold(n) {
    if (this.gold < n) return false;
    this.gold -= n;
    return true;
  }

  /** Equip `itemId` on a member, returning whatever came off. */
  equip(charId, itemId) {
    const m = this.member(charId);
    const gear = ITEMS[itemId];
    if (!m || !gear?.slot) return null;
    if (gear.user && gear.user !== charId) return null;
    if (!this.hasItem(itemId)) return null;
    const previous = m.equip[gear.slot];
    m.equip[gear.slot] = itemId;
    this.removeItem(itemId, 1);
    if (previous) this.addItem(previous, 1);
    m.clampVitals();
    return previous;
  }

  unequip(charId, slot) {
    const m = this.member(charId);
    if (!m || !m.equip[slot]) return null;
    const previous = m.equip[slot];
    m.equip[slot] = null;
    this.addItem(previous, 1);
    m.clampVitals();
    return previous;
  }

  /** True if anyone in the crew carries gear with `tag`. */
  partyHasTag(tag) {
    return this.party.some((m) => m.tags.has(tag));
  }

  /* ---------------------------- flags ---------------------------- */

  flag(name) { return Boolean(this.flags[name]); }
  setFlag(name, value = true) { this.flags[name] = value; }

  /* --------------------------- legends --------------------------- */

  legendRecord(id) {
    if (!this.legends[id]) {
      this.legends[id] = { state: LEGEND_STATE.UNHEARD, stage: 0, counters: {}, branch: null };
    }
    return this.legends[id];
  }

  legendState(id) { return this.legendRecord(id).state; }

  get resolvedLegends() {
    return MAIN_LEGENDS.filter((id) => this.legendState(id) === LEGEND_STATE.RESOLVED);
  }

  get resolvedCount() { return this.resolvedLegends.length; }

  /** Legends the journal should list (heard about, or already told). */
  get knownLegends() {
    return Object.keys(LEGENDS).filter((id) => this.legendState(id) !== LEGEND_STATE.UNHEARD);
  }

  /* ----------------------------- time ---------------------------- */

  get hour() { return Math.floor(this.clock / 60) % 24; }
  get minute() { return Math.floor(this.clock % 60); }
  get isNight() { return this.hour >= 19 || this.hour < 6; }
  get timeLabel() {
    return `${String(this.hour).padStart(2, '0')}:${String(Math.floor(this.minute / 10) * 10).padStart(2, '0')}`;
  }

  get daySegment() {
    const h = this.hour;
    if (h < 6) return 'night';
    if (h < 9) return 'dawn';
    if (h < 17) return 'day';
    if (h < 19) return 'dusk';
    return 'night';
  }

  advanceStep() {
    this.steps++;
    this.clock += MINUTES_PER_STEP;
    while (this.clock >= 1440) { this.clock -= 1440; this.day++; }
  }

  /** Jump the clock to a specific hour, rolling the day over if needed. */
  setHour(hour) {
    const target = hour * 60;
    if (target <= this.clock) this.day++;
    this.clock = target;
  }

  /* ------------------------- serialisation ------------------------ */

  toJSON() {
    return {
      party: this.party.map((m) => m.toJSON()),
      inventory: { ...this.inventory },
      gold: this.gold,
      flags: { ...this.flags },
      legends: JSON.parse(JSON.stringify(this.legends)),
      position: { ...this.position },
      ship: { ...this.ship },
      discovered: { ...this.discovered },
      reputation: { ...this.reputation },
      steps: this.steps,
      clock: this.clock,
      day: this.day,
      playTimeMs: this.playTimeMs,
      ngPlus: this.ngPlus,
      chests: { ...this.chests },
      lastPort: this.lastPort,
    };
  }

  loadJSON(data) {
    this.reset();
    this.party = (data.party ?? []).map(Member.fromJSON);
    this.inventory = { ...data.inventory };
    this.gold = data.gold ?? 0;
    this.flags = { ...data.flags };
    for (const [id, rec] of Object.entries(data.legends ?? {})) {
      this.legends[id] = { counters: {}, branch: null, stage: 0, state: LEGEND_STATE.UNHEARD, ...rec };
    }
    this.position = { ...this.position, ...data.position };
    this.ship = { ...this.ship, ...data.ship };
    this.discovered = { ...data.discovered };
    this.reputation = { ...this.reputation, ...data.reputation };
    this.steps = data.steps ?? 0;
    this.clock = data.clock ?? 8 * 60;
    this.day = data.day ?? 1;
    this.playTimeMs = data.playTimeMs ?? 0;
    this.ngPlus = data.ngPlus ?? 0;
    this.chests = { ...data.chests };
    this.lastPort = data.lastPort ?? 'marrowport';
    return this;
  }

  /** Compact summary shown on save slots. */
  saveMeta() {
    const where = this.position.map === 'SEA'
      ? 'At sea'
      : (MAPS[this.position.map]?.name ?? 'Unknown waters');
    return {
      leader: this.leader?.name ?? 'Nia Corvel',
      level: this.leader?.level ?? 1,
      partySize: this.party.length,
      legends: this.resolvedCount,
      where,
      gold: this.gold,
      day: this.day,
      ngPlus: this.ngPlus,
      playTimeMs: this.playTimeMs,
    };
  }
}
