/**
 * Reads flags and legend progress and answers "what has the world become?".
 *
 * Keeping these questions in one place means a legend's world-change only has
 * to set a flag; every scene asks here rather than testing flag names inline.
 */
import { SEA_CHART } from '../data/maps.js';
import { LEGENDS, LEGEND_STATE } from '../data/legends.js';
import { passUnlocked } from './quests.js';

/** Can the ship put in here yet, and if not, why not? */
export function portAccess(state, port) {
  if (!port.requires) return { open: true };
  if (port.requires === 'ship.stormSail') {
    if (state.flag('ship.stormSail')) return { open: true };
    return { open: false, reason: port.denied };
  }
  if (state.flag(port.requires)) return { open: true };
  return { open: false, reason: port.denied ?? 'That course is closed to you.' };
}

export function portsFor(state) {
  return SEA_CHART.ports.map((port) => {
    const access = portAccess(state, port);
    const legendId = port.legend;
    return {
      ...port,
      open: access.open,
      reason: access.reason,
      discovered: Boolean(state.discovered[port.id]),
      legendState: legendId ? state.legendState(legendId) : null,
      legendName: legendId ? LEGENDS[legendId].name : null,
    };
  });
}

/** A region stops rolling random encounters once its legend is settled. */
export function encountersEnabled(state, map) {
  if (!map.encounters) return false;
  const safe = map.encounters.safeFlag;
  if (safe && state.flag(safe)) return false;
  return true;
}

/** Emberpath's vent paths need heat protection; Pearlmaw's caverns need air. */
export function gateBlocked(state, map) {
  if (map.heatGate && !state.partyHasTag('heatproof')) {
    return 'The vent path breathes out and the heat drives you back. You need a proper ward from Ashfall Rest.';
  }
  if (map.breathGate && !state.hasItem('divingReed')) {
    return 'The cavern run is longer than your lungs. Somebody in Marrowport used to dive this reef.';
  }
  return null;
}

/** Whether the trench (super-boss) door will open. */
export function trenchOpen(state) {
  return state.resolvedCount >= 6 || state.flag('game.cleared');
}

/** Which theme a map should play, accounting for world state. */
export function musicFor(state, map) {
  if (map.kind === 'town') return 'town';
  if (map.id === 'blackwater') return 'boss';
  return map.music ?? 'field';
}

/** Day/night tint colour for a map (multiplied over the world layer). */
export function ambientTint(state, map) {
  if (map.forceNight) return 0x8296c4;
  const base = map.tint ?? 0xffffff;
  if (map.kind === 'dungeon') return base;
  const segment = state.daySegment;
  const shade = {
    dawn: 0xffc9a8,
    day: 0xffffff,
    dusk: 0xffa878,
    night: 0x5f74b0,
  }[segment] ?? 0xffffff;
  return multiplyTint(base, shade);
}

export function multiplyTint(a, b) {
  const r = Math.round((((a >> 16) & 255) * ((b >> 16) & 255)) / 255);
  const g = Math.round((((a >> 8) & 255) * ((b >> 8) & 255)) / 255);
  const bl = Math.round(((a & 255) * (b & 255)) / 255);
  return (r << 16) | (g << 8) | bl;
}

/** Is it dark enough for Moonwrack's beacons to be lit? */
export function nightGate(state, map) {
  if (!map.forceNight) return true;
  return state.isNight;
}

/** Shop price multiplier from settlement reputation. */
export function priceMultiplier(state, shopId, base = 1) {
  const rep = state.reputation[shopId] ?? 0;
  const discount = Math.max(-0.2, Math.min(0.2, rep * 0.05));
  return Math.max(0.5, base - discount);
}

/** Ending flavour keys, driven by the branch choices the player made. */
export function endingSummary(state) {
  const lines = [];
  for (const id of Object.keys(LEGENDS)) {
    const rec = state.legendRecord(id);
    if (rec.state !== LEGEND_STATE.RESOLVED) continue;
    const def = LEGENDS[id];
    const branch = def.branches?.find((b) => b.id === rec.branch);
    lines.push({
      legend: def.name,
      region: def.region,
      outcome: branch ? branch.label : 'Told and settled.',
      text: branch ? branch.text : def.rewardText,
    });
  }
  return lines;
}

export { passUnlocked };
