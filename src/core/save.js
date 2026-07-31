/**
 * Browser-storage save system: three versioned slots plus persisted options.
 *
 * Every read is defensive — a corrupt or older-schema payload is reported as
 * an empty slot rather than crashing the title screen.
 */

const PREFIX = 'lotbw';
const SCHEMA = 1;
const SLOTS = 3;

function key(slot) { return `${PREFIX}.save.${slot}`; }

function storage() {
  try {
    // Private-mode Safari throws on access rather than on write.
    const s = window.localStorage;
    const probe = `${PREFIX}.probe`;
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export const SLOT_COUNT = SLOTS;

export function saveGame(slot, payload, meta) {
  const s = storage();
  if (!s) return { ok: false, reason: 'Browser storage is unavailable.' };
  try {
    s.setItem(key(slot), JSON.stringify({
      schema: SCHEMA,
      savedAt: new Date().toISOString(),
      meta,
      data: payload,
    }));
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err && err.message ? err.message : err) };
  }
}

export function loadGame(slot) {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(key(slot));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schema !== SCHEMA || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function deleteSlot(slot) {
  const s = storage();
  if (!s) return;
  try { s.removeItem(key(slot)); } catch { /* nothing to do */ }
}

/** Slot summaries for the title / save menus; `null` where the slot is empty. */
export function slotSummaries() {
  const out = [];
  for (let i = 0; i < SLOTS; i++) {
    const rec = loadGame(i);
    out.push(rec ? { slot: i, savedAt: rec.savedAt, ...rec.meta } : null);
  }
  return out;
}

export function hasAnySave() {
  return slotSummaries().some(Boolean);
}

/* ------------------------------ options ------------------------------ */

const OPTION_KEY = `${PREFIX}.options`;
const DEFAULT_OPTIONS = {
  musicVolume: 0.55,
  sfxVolume: 0.75,
  muted: false,
  textSpeed: 2, // 0 slow .. 3 instant
};

export function loadOptions() {
  const s = storage();
  if (!s) return { ...DEFAULT_OPTIONS };
  try {
    const raw = s.getItem(OPTION_KEY);
    if (!raw) return { ...DEFAULT_OPTIONS };
    return { ...DEFAULT_OPTIONS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

export function saveOptions(opts) {
  const s = storage();
  if (!s) return;
  try { s.setItem(OPTION_KEY, JSON.stringify(opts)); } catch { /* quota */ }
}

/** "3h 04m" style play-time formatting for slot summaries. */
export function formatPlayTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}
