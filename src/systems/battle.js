/**
 * Turn-based combat.
 *
 * The engine is pure logic: it never touches the display list. The battle
 * scene pumps `advance()` and animates whatever events come back, then calls
 * `chooseAction()` when the engine asks for input.
 *
 * The signature mechanic is Guard/Break. Every enemy has Guard pips; landing
 * an attack it is weak to strips one. At zero the enemy is Broken — it loses
 * its next turn and takes 50% extra damage until its guard comes back.
 */
import { rng } from '../core/rng.js';
import { ENEMIES } from '../data/enemies.js';
import { SKILLS, STATUS_DEFS } from '../data/skills.js';
import { ITEMS } from '../data/items.js';

export const OUTCOME = {
  VICTORY: 'victory',
  DEFEAT: 'defeat',
  ESCAPED: 'escaped',
  YIELD: 'yield',
};

let uid = 0;

export class Combatant {
  constructor(side, opts) {
    this.side = side;
    this.key = `c${++uid}`;
    Object.assign(this, opts);
    /** @type {Record<string, number>} status -> turns remaining */
    this.statuses = {};
    this.brokenTurns = 0;
    this.defending = false;
    this.revealed = side === 'party';
    this.flash = 0;
  }

  get alive() { return this.hp > 0; }
  get isParty() { return this.side === 'party'; }

  /** A stat after status modifiers. */
  stat(key) {
    let mod = 0;
    for (const name of Object.keys(this.statuses)) {
      const m = STATUS_DEFS[name]?.mod?.[key];
      if (m) mod += m;
    }
    return Math.max(1, Math.round((this.base[key] ?? 1) * (1 + mod)));
  }

  isWeak(element) { return element ? this.weak.includes(element) : false; }
  isResist(element) { return element ? this.resist.includes(element) : false; }

  hasStatus(name) { return this.statuses[name] > 0; }
  get silenced() { return Object.keys(this.statuses).some((s) => STATUS_DEFS[s]?.silence); }

  get missChance() {
    let m = 0;
    for (const s of Object.keys(this.statuses)) m += STATUS_DEFS[s]?.missChance ?? 0;
    return m;
  }

  get critBonus() {
    let m = 0;
    for (const s of Object.keys(this.statuses)) m += STATUS_DEFS[s]?.critBonus ?? 0;
    return m;
  }

  applyStatus(name, turns = 3) {
    const existing = this.statuses[name] ?? 0;
    this.statuses[name] = Math.max(existing, turns);
  }

  clearStatus(name) { delete this.statuses[name]; }

  clearBadStatuses() {
    for (const s of Object.keys(this.statuses)) {
      if (STATUS_DEFS[s]?.kind === 'bad') delete this.statuses[s];
    }
  }
}

export class Battle {
  /**
   * @param {import('./gamestate.js').GameState} state
   * @param {object} opts
   * @param {string[]} opts.enemies enemy ids
   * @param {boolean} [opts.canFlee]
   * @param {boolean} [opts.isBoss]
   */
  constructor(state, opts = {}) {
    this.state = state;
    this.opts = opts;
    this.canFlee = opts.canFlee ?? true;
    this.isBoss = opts.isBoss ?? false;
    this.round = 0;
    this.queue = [];
    this.outcome = null;
    this.rewards = null;
    this.activeActor = null;
    this.pendingAction = null;
    this.escapeAttempts = 0;

    const scale = 1 + 0.32 * (state.ngPlus ?? 0);

    this.party = state.party.map((m) => {
      const s = m.maxStats;
      return new Combatant('party', {
        member: m,
        name: m.name,
        style: m.style,
        base: s,
        hp: m.hp,
        mp: m.mp,
        maxHp: s.hp,
        maxMp: s.mp,
        weak: [],
        resist: [...m.resistances],
        guard: 0,
        maxGuard: 0,
        element: m.weaponElement,
      });
    });

    this.enemies = opts.enemies.map((id, i) => this._makeEnemy(id, i, scale));
    this.all = [...this.party, ...this.enemies];
  }

  _makeEnemy(id, index, scale = 1) {
    const def = ENEMIES[id];
    if (!def) throw new Error(`battle: unknown enemy "${id}"`);
    const base = {
      hp: Math.round(def.hp * scale),
      mp: def.mp ?? 0,
      atk: Math.round(def.atk * scale),
      def: Math.round(def.def * scale),
      mag: Math.round(def.mag * scale),
      res: Math.round(def.res * scale),
      spd: def.spd,
      luk: 6,
    };
    return new Combatant('enemy', {
      enemyId: id,
      def,
      name: def.name,
      art: def.art,
      base,
      hp: base.hp,
      mp: base.mp,
      maxHp: base.hp,
      maxMp: base.mp,
      weak: def.weak ?? [],
      resist: def.resist ?? [],
      guard: def.guard ?? 2,
      maxGuard: def.guard ?? 2,
      slot: index,
      traits: def.traits ?? [],
      yieldAt: def.yieldAt ?? 0,
      element: 'steel',
    });
  }

  /** Live enemies, in display order. */
  get livingEnemies() { return this.enemies.filter((e) => e.alive); }
  get livingParty() { return this.party.filter((p) => p.alive); }

  /* ------------------------------ flow ------------------------------ */

  _beginRound(events) {
    this.round++;
    const jitter = () => rng() * 0.15;
    this.queue = this.all
      .filter((c) => c.alive)
      .sort((a, b) => (b.stat('spd') * (1 + jitter())) - (a.stat('spd') * (1 + jitter())));
    events.push({ type: 'round', round: this.round });
  }

  _checkEnd() {
    if (this.outcome) return { kind: 'end', outcome: this.outcome, rewards: this.rewards };
    if (!this.livingParty.length) {
      this.outcome = OUTCOME.DEFEAT;
      return { kind: 'end', outcome: this.outcome, rewards: null };
    }
    if (!this.livingEnemies.length) {
      this.outcome = OUTCOME.VICTORY;
      this.rewards = this._computeRewards();
      this._writeBack();
      return { kind: 'end', outcome: this.outcome, rewards: this.rewards };
    }
    return null;
  }

  /**
   * Pump the engine.
   * @returns {{kind:'events'|'input'|'end', events?:object[], actor?:Combatant, outcome?:string, rewards?:object}}
   */
  advance() {
    const end = this._checkEnd();
    if (end) return end;

    if (this.pendingAction) {
      const action = this.pendingAction;
      const actor = this.activeActor;
      this.pendingAction = null;
      this.activeActor = null;
      const events = this._execute(actor, action);
      const after = this._checkEnd();
      if (after) return { kind: 'events', events, followUp: after };
      return { kind: 'events', events };
    }

    const events = [];
    for (let guard = 0; guard < 64; guard++) {
      if (!this.queue.length) this._beginRound(events);
      const actor = this.queue.shift();
      if (!actor || !actor.alive) continue;

      this._tickStatuses(actor, events);
      if (!actor.alive) {
        const dead = this._checkEnd();
        if (dead) return { kind: 'events', events, followUp: dead };
        continue;
      }

      if (actor.brokenTurns > 0) {
        actor.brokenTurns--;
        events.push({ type: 'stagger', actor });
        if (actor.brokenTurns === 0) {
          actor.guard = actor.maxGuard;
          events.push({ type: 'guardRestore', actor });
        }
        continue;
      }

      actor.defending = false;
      events.push({ type: 'turn', actor });

      if (actor.isParty) {
        this.activeActor = actor;
        return { kind: 'input', actor, events };
      }
      const enemyEvents = this._enemyAct(actor);
      const after = this._checkEnd();
      return { kind: 'events', events: events.concat(enemyEvents), followUp: after ?? undefined };
    }
    // Should never happen, but never hang the game if it does.
    this.outcome = OUTCOME.VICTORY;
    this.rewards = this._computeRewards();
    return { kind: 'end', outcome: this.outcome, rewards: this.rewards };
  }

  /** Provide the action for the actor the engine asked about. */
  chooseAction(action) {
    this.pendingAction = action;
  }

  /* ---------------------------- statuses ---------------------------- */

  _tickStatuses(actor, events) {
    for (const name of Object.keys(actor.statuses)) {
      const def = STATUS_DEFS[name];
      if (!def) { delete actor.statuses[name]; continue; }
      if (def.tick === 'hp') {
        const dmg = Math.max(1, Math.round(actor.maxHp * def.percent));
        actor.hp = Math.max(0, actor.hp - dmg);
        events.push({ type: 'damage', target: actor, amount: dmg, kind: 'status', status: name });
        if (!actor.alive) events.push({ type: 'down', target: actor });
      } else if (def.tick === 'heal') {
        const heal = Math.max(1, Math.round(actor.maxHp * def.percent));
        const before = actor.hp;
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        if (actor.hp > before) {
          events.push({ type: 'heal', target: actor, amount: actor.hp - before, kind: 'status', status: name });
        }
      }
      actor.statuses[name] -= 1;
      if (actor.statuses[name] <= 0) {
        delete actor.statuses[name];
        events.push({ type: 'statusEnd', target: actor, status: name });
      }
    }

    // Passive regeneration from relics, on the party's turn only.
    if (actor.isParty && actor.member) {
      const tags = actor.member.tags;
      if (tags.has('regen') && actor.alive) {
        const heal = Math.max(1, Math.round(actor.maxHp * 0.05));
        const before = actor.hp;
        actor.hp = Math.min(actor.maxHp, actor.hp + heal);
        if (actor.hp > before) events.push({ type: 'heal', target: actor, amount: actor.hp - before, kind: 'relic' });
      }
      if (tags.has('mpRegen') && actor.alive) {
        const before = actor.mp;
        actor.mp = Math.min(actor.maxMp, actor.mp + 6);
        if (actor.mp > before) events.push({ type: 'mp', target: actor, amount: actor.mp - before });
      }
    }
  }

  /* ---------------------------- targeting --------------------------- */

  _opposing(actor) { return actor.isParty ? this.livingEnemies : this.livingParty; }
  _friendly(actor) { return actor.isParty ? this.livingParty : this.livingEnemies; }

  _resolveTargets(actor, action, chosen) {
    const def = action.def;
    const target = def?.target ?? 'enemy';
    switch (target) {
      case 'enemies': return this._opposing(actor);
      case 'allies': return this._friendly(actor);
      case 'ally': return chosen && chosen.alive ? [chosen] : [this._friendly(actor)[0]].filter(Boolean);
      case 'self': return [actor];
      case 'dead': {
        const pool = (actor.isParty ? this.party : this.enemies).filter((c) => !c.alive);
        return chosen && !chosen.alive ? [chosen] : pool.slice(0, 1);
      }
      case 'random': {
        const pool = this._opposing(actor);
        const out = [];
        for (let i = 0; i < (def.hits ?? 1); i++) {
          if (!pool.length) break;
          out.push(pool[rng.int(pool.length)]);
        }
        return out;
      }
      case 'enemy':
      default: {
        if (chosen && chosen.alive && chosen.side !== actor.side) return [chosen];
        const taunting = this._opposing(actor).find((c) => c.hasStatus('taunt'));
        if (taunting) return [taunting];
        const pool = this._opposing(actor);
        return pool.length ? [pool[rng.int(pool.length)]] : [];
      }
    }
  }

  /* ----------------------------- damage ----------------------------- */

  _damage(actor, target, spec) {
    const physical = spec.type !== 'mag';
    const off = physical ? actor.stat('atk') : actor.stat('mag');
    const guardStat = physical ? target.stat('def') : target.stat('res');
    const element = spec.element ?? actor.element;

    let base = off * (spec.power ?? 1);
    if (!spec.pierce) base -= guardStat * 0.85;
    base = Math.max(2, base);

    let mult = 1;
    const weak = target.isWeak(element);
    const resist = target.isResist(element);
    if (weak) mult *= 1.5;
    if (resist) mult *= 0.5;
    if (target.brokenTurns > 0) mult *= 1.5;
    if (target.defending) mult *= 0.55;

    const critChance = 0.04 + actor.stat('luk') * 0.004 + actor.critBonus;
    const crit = rng() < critChance;
    if (crit) mult *= 1.7;

    mult *= 0.92 + rng() * 0.16;

    const amount = Math.max(1, Math.round(base * mult));
    target.hp = Math.max(0, target.hp - amount);

    // Guard/Break: only enemies carry guard pips.
    let broke = false;
    if (target.maxGuard > 0 && target.brokenTurns === 0) {
      let strip = 0;
      if (weak) strip += 1;
      strip += spec.guard ?? 0;
      if (strip > 0) {
        target.guard = Math.max(0, target.guard - strip);
        if (target.guard === 0) {
          target.brokenTurns = 2;
          broke = true;
        }
      }
    }

    return { amount, crit, weak, resist, broke, element };
  }

  _applyStatusFrom(spec, actor, target, events) {
    const status = spec.status;
    if (!status || !target.alive) return;
    const chance = spec.statusChance ?? 1;
    const resistRoll = target.stat('res') * 0.0015;
    if (rng() > chance - resistRoll) {
      events.push({ type: 'statusMiss', target, status });
      return;
    }
    target.applyStatus(status, spec.turns ?? 3);
    events.push({ type: 'status', target, status });
  }

  /* ---------------------------- execution --------------------------- */

  _execute(actor, action) {
    const events = [];
    if (!actor || !actor.alive) return events;

    switch (action.kind) {
      case 'attack': return this._doAttack(actor, action, events);
      case 'skill': return this._doSkill(actor, action, events);
      case 'item': return this._doItem(actor, action, events);
      case 'defend': {
        actor.defending = true;
        const gain = Math.max(2, Math.round(actor.maxMp * 0.08));
        actor.mp = Math.min(actor.maxMp, actor.mp + gain);
        events.push({ type: 'action', actor, label: 'Brace' });
        events.push({ type: 'mp', target: actor, amount: gain });
        return events;
      }
      case 'flee': return this._doFlee(actor, events);
      default: return events;
    }
  }

  _hitOne(actor, target, spec, events, label) {
    if (!target || !target.alive) return;
    // Blind only fouls physical swings.
    if (spec.type !== 'mag' && rng() < actor.missChance) {
      events.push({ type: 'miss', actor, target });
      return;
    }
    const res = this._damage(actor, target, spec);
    events.push({ type: 'damage', target, amount: res.amount, crit: res.crit, weak: res.weak, resist: res.resist, element: res.element, kind: label });
    if (res.weak) target.revealed = true;
    if (res.broke) events.push({ type: 'break', target });
    if (spec.drain) {
      const heal = Math.round(res.amount * 0.4);
      actor.hp = Math.min(actor.maxHp, actor.hp + heal);
      events.push({ type: 'heal', target: actor, amount: heal, kind: 'drain' });
    }
    this._applyStatusFrom(spec, actor, target, events);
    if (!target.alive) events.push({ type: 'down', target });
    this._maybeYield(target, events);
  }

  _maybeYield(target, events) {
    if (this.outcome) return;
    if (!target.yieldAt || target.side !== 'enemy' || !target.alive) return;
    if (target.hp / target.maxHp <= target.yieldAt) {
      this.outcome = OUTCOME.YIELD;
      this.yieldedBy = target;
      this.rewards = this._computeRewards({ yielded: true });
      this._writeBack();
      events.push({ type: 'yield', target });
    }
  }

  _doAttack(actor, action, events) {
    events.push({ type: 'action', actor, label: 'Attack' });
    const spec = { type: 'phys', power: 1, element: actor.element };
    const targets = this._resolveTargets(actor, { def: { target: 'enemy' } }, action.target);
    for (const t of targets) this._hitOne(actor, t, spec, events, 'attack');
    return events;
  }

  _doSkill(actor, action, events) {
    const def = SKILLS[action.skill];
    if (!def) return events;
    if (actor.silenced) {
      events.push({ type: 'message', text: `${actor.name} cannot make a sound!` });
      return events;
    }
    if (actor.mp < def.cost) {
      events.push({ type: 'message', text: `${actor.name} has not the breath for it.` });
      return events;
    }
    actor.mp -= def.cost;
    events.push({ type: 'action', actor, label: def.name, skill: action.skill, element: def.element });

    const targets = this._resolveTargets(actor, { def }, action.target);

    switch (def.type) {
      case 'phys':
      case 'mag':
        for (const t of targets) this._hitOne(actor, t, def, events, def.type);
        break;
      case 'heal': {
        const power = def.power ?? 1;
        for (const t of targets) {
          if (!t.alive) continue;
          const amount = Math.round(actor.stat('mag') * power + (def.flat ?? 0));
          const before = t.hp;
          t.hp = Math.min(t.maxHp, t.hp + amount);
          events.push({ type: 'heal', target: t, amount: t.hp - before });
          if (def.status) t.applyStatus(def.status, def.turns ?? 3);
        }
        break;
      }
      case 'revive': {
        for (const t of targets) {
          if (t.alive) continue;
          t.hp = Math.max(1, Math.round(t.maxHp * (def.ratio ?? 0.5)));
          events.push({ type: 'revive', target: t });
        }
        break;
      }
      case 'buff': {
        for (const t of targets) {
          t.applyStatus(def.status, def.turns ?? 3);
          events.push({ type: 'status', target: t, status: def.status });
        }
        if (def.taunt) actor.applyStatus('taunt', 2);
        if (def.scout) {
          for (const e of this.enemies) e.revealed = true;
          events.push({ type: 'scout' });
        }
        break;
      }
      case 'status': {
        for (const t of targets) this._applyStatusFrom(def, actor, t, events);
        break;
      }
      case 'summon': {
        const spawned = this._makeEnemy(def.summon, this.enemies.length, 1 + 0.32 * (this.state.ngPlus ?? 0));
        this.enemies.push(spawned);
        this.all.push(spawned);
        this.queue.push(spawned);
        events.push({ type: 'summon', target: spawned });
        break;
      }
      default: break;
    }
    return events;
  }

  _doItem(actor, action, events) {
    const def = ITEMS[action.item];
    if (!def?.effect) return events;
    events.push({ type: 'action', actor, label: def.name, item: action.item });
    this.state.removeItem(action.item, 1);
    const eff = def.effect;
    const targets = this._resolveTargets(actor, { def: { target: eff.target ?? 'ally' } }, action.target);

    switch (eff.type) {
      case 'heal':
        for (const t of targets) {
          if (!t.alive) continue;
          if (eff.hp) {
            const before = t.hp;
            t.hp = Math.min(t.maxHp, t.hp + eff.hp);
            events.push({ type: 'heal', target: t, amount: t.hp - before });
          }
          if (eff.mp) {
            const before = t.mp;
            t.mp = Math.min(t.maxMp, t.mp + eff.mp);
            events.push({ type: 'mp', target: t, amount: t.mp - before });
          }
        }
        break;
      case 'cure':
        for (const t of targets) {
          for (const s of eff.statuses) t.clearStatus(s);
          events.push({ type: 'cured', target: t });
        }
        break;
      case 'revive':
        for (const t of targets) {
          if (t.alive) continue;
          t.hp = Math.max(1, Math.round(t.maxHp * (eff.ratio ?? 0.5)));
          events.push({ type: 'revive', target: t });
        }
        break;
      case 'damage': {
        const spec = { type: 'mag', power: 0, element: eff.element, guard: eff.guard ?? 0, status: eff.status, statusChance: 0.7 };
        for (const t of targets) {
          if (!t.alive) continue;
          // Item damage is flat, not scaled off the thrower.
          let amount = eff.power;
          const weak = t.isWeak(eff.element);
          const resist = t.isResist(eff.element);
          if (weak) amount = Math.round(amount * 1.5);
          if (resist) amount = Math.round(amount * 0.5);
          if (t.brokenTurns > 0) amount = Math.round(amount * 1.5);
          t.hp = Math.max(0, t.hp - amount);
          events.push({ type: 'damage', target: t, amount, weak, resist, element: eff.element, kind: 'item' });
          if (t.maxGuard > 0 && t.brokenTurns === 0) {
            const strip = (weak ? 1 : 0) + (eff.guard ?? 0);
            if (strip) {
              t.guard = Math.max(0, t.guard - strip);
              if (t.guard === 0) { t.brokenTurns = 2; events.push({ type: 'break', target: t }); }
            }
          }
          if (eff.status) this._applyStatusFrom(spec, actor, t, events);
          if (!t.alive) events.push({ type: 'down', target: t });
          this._maybeYield(t, events);
        }
        break;
      }
      case 'escape':
        if (this.canFlee) {
          this.outcome = OUTCOME.ESCAPED;
          this._writeBack();
          events.push({ type: 'escaped' });
        } else {
          events.push({ type: 'message', text: 'The smoke goes nowhere. There is no leaving this.' });
        }
        break;
      default: break;
    }
    return events;
  }

  _doFlee(actor, events) {
    events.push({ type: 'action', actor, label: 'Run' });
    if (!this.canFlee) {
      events.push({ type: 'message', text: 'There is no running from this one.' });
      return events;
    }
    const always = actor.member?.tags.has('alwaysFlee');
    this.escapeAttempts++;
    const partySpd = this.livingParty.reduce((s, c) => s + c.stat('spd'), 0) / Math.max(1, this.livingParty.length);
    const foeSpd = this.livingEnemies.reduce((s, c) => s + c.stat('spd'), 0) / Math.max(1, this.livingEnemies.length);
    const chance = always ? 1 : Math.min(0.92, 0.35 + (partySpd - foeSpd) * 0.03 + this.escapeAttempts * 0.12);
    if (rng() < chance) {
      this.outcome = OUTCOME.ESCAPED;
      this._writeBack();
      events.push({ type: 'escaped' });
    } else {
      events.push({ type: 'message', text: 'They cut you off.' });
    }
    return events;
  }

  /* ------------------------------- AI ------------------------------- */

  _enemyAct(actor) {
    const events = [];
    const options = [...(actor.def.skills ?? [])];
    // Basic attack always sits in the pool so enemies stay readable.
    options.push({ id: null, weight: 2 });
    const pick = rng.weighted(options);

    if (!pick.id) {
      return this._doAttack(actor, {}, events);
    }
    const def = SKILLS[pick.id];
    if (!def) return this._doAttack(actor, {}, events);

    // Do not waste a heal or a buff that is already up.
    if (def.type === 'heal' && def.target === 'self' && actor.hp > actor.maxHp * 0.55) {
      return this._doAttack(actor, {}, events);
    }
    if (def.type === 'buff' && actor.hasStatus(def.status)) {
      return this._doAttack(actor, {}, events);
    }

    // Enemies pay no MP; run the same execution path otherwise.
    const saved = actor.mp;
    actor.mp = Math.max(actor.mp, def.cost);
    const out = this._doSkill(actor, { skill: pick.id }, events);
    actor.mp = saved;
    return out;
  }

  /* ---------------------------- resolution -------------------------- */

  _computeRewards({ yielded = false } = {}) {
    let xp = 0;
    let gold = 0;
    const drops = [];
    for (const e of this.enemies) {
      if (e.alive && !yielded) continue;
      xp += e.def.xp ?? 0;
      gold += e.def.gold ?? 0;
      for (const d of e.def.drops ?? []) {
        if (rng() < d.chance) drops.push(d.item);
      }
    }
    const bonus = 1 + 0.1 * (this.state.ngPlus ?? 0);
    return { xp: Math.round(xp * bonus), gold: Math.round(gold * bonus), drops, levelUps: [] };
  }

  /** Push combat HP/MP back onto the persistent crew. */
  _writeBack() {
    for (const c of this.party) {
      if (!c.member) continue;
      c.member.hp = c.hp;
      c.member.mp = c.mp;
      c.member.clampVitals();
    }
  }

  /** Apply XP, gold and drops after a win. Fills `rewards.levelUps`. */
  claimRewards() {
    if (!this.rewards) return null;
    const r = this.rewards;
    this.state.addGold(r.gold);
    for (const id of r.drops) this.state.addItem(id, 1);

    const before = new Map(this.state.party.map((m) => [m.id, m.level]));
    const standing = this.state.party.filter((m) => m.hp > 0).length || 1;
    // Split the pot, then hand everyone a bonus share so smaller crews are
    // not punished and larger crews still level together.
    r.xpEach = Math.round(r.xp / standing) + Math.round(r.xp * 0.2);
    r.levelUps = [];
    for (const m of this.state.party) {
      if (m.hp <= 0) continue;
      const learned = m.gainXp(r.xpEach);
      if (m.level > before.get(m.id) || learned.length) {
        r.levelUps.push({ member: m, from: before.get(m.id), to: m.level, skills: learned });
      }
    }
    return r;
  }
}

export { STATUS_DEFS };
