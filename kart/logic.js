// Pure race rules for Kart Santai (no DOM, no three.js) so Node can test them.

export const LAPS = 3;
export const SECTORS = 4;

// ---------- laps & checkpoints ----------
// t is the track parameter in [0, 1). The start grid sits just before t = 0,
// so a fresh racer is "armed" (last checkpoint reached) and lap 0 means "not yet crossed".
export function createLapState() {
  return { lap: 0, checkpoint: SECTORS - 1, t: 0.99 };
}

const sectorOf = (t) => Math.min(SECTORS - 1, Math.floor(t * SECTORS));
const WRAP_EDGE = 0.5; // a jump of more than half a lap between frames means we crossed the line

// Returns a new lap state after moving from state.t to newT.
export function advanceLap(state, newT) {
  const { lap, t } = state;
  let { checkpoint } = state;
  const crossedForward = t - newT > WRAP_EDGE;
  const crossedBackward = newT - t > WRAP_EDGE;
  let newLap = lap;
  if (crossedForward) {
    if (checkpoint === SECTORS - 1) {
      newLap = lap + 1;
      checkpoint = 0;
    }
  } else if (!crossedBackward) {
    const s = sectorOf(newT);
    if (s === checkpoint + 1) checkpoint = s;
  }
  return { lap: newLap, checkpoint, t: newT };
}

// Continuous race progress; higher is further ahead. Only counts the param if the
// racer is in the sector it legitimately reached, so a short-cut or reversing can't fake progress.
export function progressOf(state) {
  const valid = sectorOf(state.t) === state.checkpoint;
  const along = valid ? state.t : state.checkpoint / SECTORS;
  return state.lap - 1 + along;
}

export const isFinished = (state) => state.lap > LAPS;
export const shownLap = (state) => Math.min(LAPS, Math.max(1, state.lap));

// ---------- ranking ----------
// racers: [{ id, progress, finishTime|null }]; finished racers first by time, then by progress.
export function rankRacers(racers) {
  return [...racers]
    .sort((a, b) => {
      const af = a.finishTime != null, bf = b.finishTime != null;
      if (af && bf) return a.finishTime - b.finishTime;
      if (af !== bf) return af ? -1 : 1;
      return b.progress - a.progress;
    })
    .map((r) => r.id);
}

// ---------- drift boost ----------
export const DRIFT_LEVEL_TIMES = [0.8, 1.6, 2.4];
export const BOOST_DURATIONS = [0, 0.6, 1.1, 1.7];

export function driftLevel(chargeSec) {
  let level = 0;
  for (const t of DRIFT_LEVEL_TIMES) if (chargeSec >= t) level++;
  return level;
}

export const boostForCharge = (chargeSec) => BOOST_DURATIONS[driftLevel(chargeSec)];

// Start boost: gas pressed in the last half second of the countdown (keyboard).
export const START_BOOST_WINDOW = 0.5;
export function startBoost(pressedRemaining) {
  if (pressedRemaining == null) return 0;
  return pressedRemaining > 0 && pressedRemaining <= START_BOOST_WINDOW ? 0.9 : 0;
}

// ---------- items ----------
export const ITEMS = ['roket', 'pisang', 'perisai', 'turbo'];
export const ITEM_ICON = { roket: '🚀', pisang: '🍌', perisai: '🛡️', turbo: '⚡' };

// Weights per item in ITEMS order; leaders get defensive items, trailers get attack/speed.
export function itemWeights(position, total) {
  const behind = total > 1 ? (position - 1) / (total - 1) : 0; // 0 = leader, 1 = last
  return [
    1 + 4 * behind, // roket
    4 - 3 * behind, // pisang
    3 - 1 * behind, // perisai
    1 + 4 * behind, // turbo
  ];
}

export function pickItem(position, total, rand = Math.random) {
  const w = itemWeights(position, total);
  let r = rand() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ITEMS.length; i++) {
    r -= w[i];
    if (r < 0) return ITEMS[i];
  }
  return ITEMS[ITEMS.length - 1];
}

// ---------- bots ----------
// gap = player progress - bot progress (in laps). Behind the player -> faster, ahead -> slower.
export function rubberBand(gap) {
  const g = Math.max(-0.25, Math.min(0.25, gap));
  return 1 + g * (g > 0 ? 0.3 : 0.35);
}

export function formatTime(sec) {
  if (sec == null || !isFinite(sec)) return '--:--.--';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}
