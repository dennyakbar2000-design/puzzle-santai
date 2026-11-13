// Arcade kart movement: speed, steering, drift charge, boosts, off-road, soft walls, jumps.
import { boostForCharge, driftLevel, createLapState } from './logic.js';
import { statMultipliers } from './racers.js';
import { CURB_HALF, WALL, PAD_SPOTS, PAD_HALF } from './track.js';

export const PHYS = {
  MAX_SPEED: 30,
  ACCEL: 15,
  BRAKE: 32,
  REVERSE_MAX: 8,
  COAST: 6,
  OVERSPEED_DECEL: 22,
  TURN: 2.1,
  DRIFT_TURN: 1.15,
  DRIFT_STEER: 0.75,
  DRIFT_MIN_SPEED: 0.6, // fraction of top speed needed to start a drift
  DRIFT_KEEP_SPEED: 0.4,
  OFFROAD: 0.55,
  BOOST_MULT: 1.35,
  BOOST_ACCEL: 45,
  PAD_BOOST: 0.9,
  GRAVITY: 32,
  LIP: 0.3, // ground dropping more than this in a frame launches the kart
  MAX_GROUND_VY: 12,
  WALL_DRAG: 3,
  SPIN_TIME: 1.2,
  SPIN_DECEL: 28,
  KART_RADIUS: 1.2,
};

export function createKart(char, track, idx, lat) {
  const p = track.pointAt(idx, lat);
  return {
    char, mult: statMultipliers(char.stats), speedScale: 1,
    x: p.x, y: p.y, z: p.z, heading: track.headingAt(idx),
    speed: 0, vy: 0, groundVy: 0, groundY: p.y, airborne: false,
    idx, u: idx, t: idx / track.N, lat, offroad: false, wrongWay: false,
    drifting: false, driftDir: 0, driftCharge: 0, driftLevel: 0,
    boostTime: 0, spinTime: 0, shieldTime: 0, item: null,
    lapState: { ...createLapState(), t: idx / track.N }, finishTime: null, progress: 0,
  };
}

export const applyBoost = (k, dur) => { k.boostTime = Math.max(k.boostTime, dur); };

// Returns true if the hit landed (a shield absorbs one hit).
export function hitKart(k) {
  if (k.shieldTime > 0) { k.shieldTime = 0; return false; }
  k.spinTime = PHYS.SPIN_TIME;
  k.drifting = false;
  k.boostTime = 0;
  k.speed *= 0.4;
  return true;
}

const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

function updateSpeed(k, input, dt) {
  const base = PHYS.MAX_SPEED * k.mult.speed * k.speedScale;
  const boosting = k.boostTime > 0;
  const max = base * (k.offroad && !boosting ? PHYS.OFFROAD : 1) * (boosting ? PHYS.BOOST_MULT : 1);
  if (k.airborne) return base;
  if (k.spinTime > 0) k.speed = approach(k.speed, 0, PHYS.SPIN_DECEL * dt);
  else if (k.speed > max) k.speed = Math.max(max, k.speed - PHYS.OVERSPEED_DECEL * dt);
  else if (boosting) k.speed = Math.min(max, k.speed + PHYS.BOOST_ACCEL * dt);
  else if (input.brake) {
    k.speed = k.speed > 0 ? k.speed - PHYS.BRAKE * dt : Math.max(-PHYS.REVERSE_MAX, k.speed - PHYS.ACCEL * 0.5 * dt);
  } else if (input.gas) k.speed = Math.min(max, k.speed + PHYS.ACCEL * k.mult.accel * (1 - 0.55 * Math.max(0, k.speed) / max) * dt);
  else k.speed = approach(k.speed, 0, PHYS.COAST * dt);
  return base;
}

function updateDrift(k, input, base, dt) {
  const steer = input.steer;
  if (!k.drifting) {
    if (input.drift && Math.abs(steer) > 0.3 && k.speed > PHYS.DRIFT_MIN_SPEED * base && !k.airborne && k.spinTime <= 0) {
      k.drifting = true; k.driftDir = Math.sign(steer); k.driftCharge = 0; k.driftLevel = 0;
    }
    return;
  }
  if (!input.drift) {
    applyBoost(k, boostForCharge(k.driftCharge));
    k.drifting = false;
  } else if (k.speed < PHYS.DRIFT_KEEP_SPEED * base || k.spinTime > 0) {
    k.drifting = false;
  } else if (!k.airborne) {
    k.driftCharge += dt;
    k.driftLevel = driftLevel(k.driftCharge);
  }
}

function updateHeading(k, input, dt) {
  if (k.spinTime > 0) return;
  let turn;
  if (k.drifting) turn = k.driftDir * (PHYS.DRIFT_TURN + PHYS.DRIFT_STEER * input.steer * k.driftDir);
  else {
    const grip = Math.min(1, Math.abs(k.speed) / 8) * Math.sign(k.speed);
    turn = input.steer * PHYS.TURN * grip * (1 - 0.25 * Math.min(1, Math.abs(k.speed) / PHYS.MAX_SPEED));
  }
  if (k.airborne) turn *= 0.3;
  k.heading -= turn * k.mult.turn * dt; // + steer = right = decreasing heading
}

function applyWalls(k, track, dt) {
  const excess = Math.abs(k.lat) - WALL;
  if (excess <= 0) return;
  const s = Math.sign(k.lat), i = k.idx;
  k.x += track.tz[i] * s * excess;
  k.z -= track.tx[i] * s * excess;
  k.lat = s * WALL;
  k.speed *= Math.max(0, 1 - PHYS.WALL_DRAG * dt);
}

function updateHeight(k, track, dt) {
  const ground = track.heightAt(k.u, k.lat);
  k.groundY = ground;
  if (k.airborne) {
    k.vy -= PHYS.GRAVITY * dt;
    k.y += k.vy * dt;
    if (k.y <= ground) { k.y = ground; k.vy = 0; k.airborne = false; }
  } else if (k.y - ground > PHYS.LIP) {
    k.airborne = true;
    k.vy = k.groundVy;
    k.y += k.vy * dt;
  } else {
    k.groundVy = Math.max(-PHYS.MAX_GROUND_VY, Math.min(PHYS.MAX_GROUND_VY, (ground - k.y) / dt));
    k.y = ground;
  }
}

function checkPads(k, track) {
  if (k.airborne || Math.abs(k.lat) > PAD_HALF) return;
  for (const t of PAD_SPOTS) {
    const d = Math.abs(k.idx - track.idxOf(t));
    if (Math.min(d, track.N - d) <= 2) applyBoost(k, PHYS.PAD_BOOST);
  }
}

export function updateKart(k, input, dt, track) {
  k.boostTime = Math.max(0, k.boostTime - dt);
  k.spinTime = Math.max(0, k.spinTime - dt);
  k.shieldTime = Math.max(0, k.shieldTime - dt);
  const base = updateSpeed(k, input, dt);
  updateDrift(k, input, base, dt);
  updateHeading(k, input, dt);
  k.x += Math.sin(k.heading) * k.speed * dt;
  k.z += Math.cos(k.heading) * k.speed * dt;
  Object.assign(k, track.locate(k.x, k.z, k.idx));
  applyWalls(k, track, dt);
  k.offroad = Math.abs(k.lat) > CURB_HALF;
  updateHeight(k, track, dt);
  checkPads(k, track);
  const along = Math.sin(k.heading) * track.tx[k.idx] + Math.cos(k.heading) * track.tz[k.idx];
  k.wrongWay = along < -0.3 && Math.abs(k.speed) > 3;
}

// Simple circle separation so karts bump instead of overlapping.
export function collideKarts(karts) {
  const minD = PHYS.KART_RADIUS * 2;
  for (let a = 0; a < karts.length; a++) {
    for (let b = a + 1; b < karts.length; b++) {
      const A = karts[a], B = karts[b];
      const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz);
      if (d >= minD || d < 1e-4 || Math.abs(A.y - B.y) > 2) continue;
      const push = (minD - d) / 2, nx = dx / d, nz = dz / d;
      A.x -= nx * push; A.z -= nz * push;
      B.x += nx * push; B.z += nz * push;
    }
  }
}
