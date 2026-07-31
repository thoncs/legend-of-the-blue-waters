/**
 * Legend progression: rumour -> active -> stage advance -> resolved,
 * plus reward granting. Every legend touches exploration (stages), rewards
 * (this file) and combat (battle.js) — that is the whole design in one line.
 */
import { LEGENDS, LEGEND_STATE, MAIN_LEGENDS } from '../data/legends.js';
import { ITEMS, itemName } from '../data/items.js';
import { skillName } from '../data/skills.js';

/** Move a legend from unheard to rumoured. @returns true if it changed. */
export function rumorLegend(state, id) {
  const rec = state.legendRecord(id);
  if (rec.state !== LEGEND_STATE.UNHEARD) return false;
  rec.state = LEGEND_STATE.RUMORED;
  rec.stage = 0;
  return true;
}

/** Mark a legend as being actively pursued. */
export function activateLegend(state, id) {
  const rec = state.legendRecord(id);
  if (rec.state === LEGEND_STATE.RESOLVED) return false;
  if (rec.state === LEGEND_STATE.UNHEARD) rec.stage = 0;
  rec.state = LEGEND_STATE.ACTIVE;
  return true;
}

export function currentStage(state, id) {
  const def = LEGENDS[id];
  const rec = state.legendRecord(id);
  return def.stages[Math.min(rec.stage, def.stages.length - 1)];
}

/** Jump to the stage with the given id (no-op if already past it). */
export function advanceStage(state, id, stageId) {
  const def = LEGENDS[id];
  const rec = state.legendRecord(id);
  const index = def.stages.findIndex((s) => s.id === stageId);
  if (index < 0 || index <= rec.stage) return false;
  rec.stage = index;
  if (rec.state === LEGEND_STATE.RUMORED) rec.state = LEGEND_STATE.ACTIVE;
  return true;
}

/** Advance by one stage. */
export function nextStage(state, id) {
  const def = LEGENDS[id];
  const rec = state.legendRecord(id);
  if (rec.stage < def.stages.length - 1) {
    rec.stage++;
    if (rec.state === LEGEND_STATE.RUMORED) rec.state = LEGEND_STATE.ACTIVE;
    return true;
  }
  return false;
}

/**
 * Tick a stage counter (beacons lit, bowls filled, …).
 * @returns {{value:number, of:number, complete:boolean, already:boolean}}
 */
export function bumpCounter(state, id, counter, by = 1) {
  const rec = state.legendRecord(id);
  const stage = LEGENDS[id].stages.find((s) => s.counter === counter);
  const of = stage?.of ?? 1;
  const before = rec.counters[counter] ?? 0;
  if (before >= of) return { value: before, of, complete: true, already: true };
  rec.counters[counter] = Math.min(of, before + by);
  if (rec.state === LEGEND_STATE.RUMORED || rec.state === LEGEND_STATE.UNHEARD) {
    rec.state = LEGEND_STATE.ACTIVE;
  }
  const value = rec.counters[counter];
  const complete = value >= of;
  if (complete) nextStage(state, id);
  return { value, of, complete, already: false };
}

export function counterValue(state, id, counter) {
  return state.legendRecord(id).counters[counter] ?? 0;
}

/** Human-readable current objective, with counter progress folded in. */
export function objectiveText(state, id) {
  const def = LEGENDS[id];
  const rec = state.legendRecord(id);
  if (rec.state === LEGEND_STATE.RESOLVED) {
    const branch = def.branches?.find((b) => b.id === rec.branch);
    return branch ? `Told. ${branch.label}.` : 'Told.';
  }
  const stage = currentStage(state, id);
  if (!stage) return 'Told.';
  if (stage.counter) {
    const value = stage.counter === 'legends' ? state.resolvedCount : (rec.counters[stage.counter] ?? 0);
    return `${stage.objective}  (${Math.min(value, stage.of)}/${stage.of})`;
  }
  return stage.objective;
}

/**
 * Apply a reward block.
 * @returns {string[]} notice lines to show the player
 */
export function grantReward(state, reward) {
  const notices = [];
  if (!reward) return notices;
  if (reward.gold) {
    state.addGold(reward.gold);
    notices.push(`Gained [[${reward.gold}]] doubloons.`);
  }
  for (const id of reward.items ?? []) {
    if (!ITEMS[id]) continue;
    state.addItem(id, 1);
    notices.push(`Obtained [[${itemName(id)}]].`);
  }
  for (const f of reward.flags ?? []) state.setFlag(f, true);
  const unlock = reward.unlockSkill;
  if (unlock && state.teach(unlock.char, unlock.skill)) {
    notices.push(`Learned [[${skillName(unlock.skill)}]].`);
  }
  return notices;
}

/**
 * Finish a legend, optionally along a branch.
 * @returns {{notices:string[], branch:object|null}}
 */
export function resolveLegend(state, id, branchId = null) {
  const def = LEGENDS[id];
  const rec = state.legendRecord(id);
  const notices = [];

  if (rec.state !== LEGEND_STATE.RESOLVED) {
    notices.push(...grantReward(state, def.reward));
  }

  let branch = null;
  if (branchId && def.branches) {
    branch = def.branches.find((b) => b.id === branchId) ?? null;
    if (branch) {
      rec.branch = branchId;
      notices.push(...grantReward(state, branch.reward));
      if (branch.unlockSkill && state.teach(branch.unlockSkill.char, branch.unlockSkill.skill)) {
        notices.push(`Learned [[${skillName(branch.unlockSkill.skill)}]].`);
      }
      for (const [town, delta] of Object.entries(branch.rep ?? {})) {
        state.reputation[town] = (state.reputation[town] ?? 0) + delta;
      }
    }
  }

  rec.state = LEGEND_STATE.RESOLVED;
  rec.stage = def.stages.length - 1;
  return { notices, branch };
}

/** Legends whose rumour the player has heard but not finished. */
export function openLegends(state) {
  return state.knownLegends.filter((id) => state.legendState(id) !== LEGEND_STATE.RESOLVED);
}

/** Is the endgame legend allowed to start? */
export function passUnlocked(state) {
  const need = LEGENDS.stormSaint.requiresLegends ?? 4;
  return state.resolvedLegends.filter((id) => id !== 'stormSaint').length >= need;
}

/** Progress for the journal header and the sea chart overlay. */
export function legendProgress(state) {
  return {
    resolved: state.resolvedCount,
    total: MAIN_LEGENDS.length,
    known: state.knownLegends.length,
  };
}
