// Bot drivers: follow the spline with lookahead on their own lane, plus simple item rules.
const LOOK_BASE = 6;
const LOOK_PER_SPEED = 0.35; // extra samples looked ahead per unit of speed
const STEER_GAIN = 2.4;
const CORNER_LOOK = 22;
const CORNER_LIFT = 0.95; // heading change (rad) ahead that makes a bot ease off
const LANE_SWAY = 2;
const ITEM_THINK = 0.8; // seconds a bot holds an item before deciding
const ITEM_GIVE_UP = 9;
const ROCKET_RANGE = 70;
const BANANA_RANGE = 16;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp1 = (v) => Math.max(-1, Math.min(1, v));

function cornerAhead(track, idx) {
  return Math.abs(wrapAngle(track.headingAt(idx + CORNER_LOOK) - track.headingAt(idx)));
}

export function botInput(k, track, time) {
  const look = Math.round(LOOK_BASE + Math.max(0, k.speed) * LOOK_PER_SPEED);
  const lane = k.lane + Math.sin(time * 0.3 + k.phase) * LANE_SWAY;
  const target = track.pointAt(k.idx + look, lane);
  const diff = wrapAngle(Math.atan2(target.x - k.x, target.z - k.z) - k.heading);
  const sharp = cornerAhead(track, k.idx) > CORNER_LIFT && k.speed > 25;
  return {
    steer: clamp1(-diff * STEER_GAIN), // + steer turns right (heading decreases)
    gas: !sharp,
    brake: Math.abs(diff) > 0.9 && k.speed > 16,
    drift: false,
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function botWantsItem(k, ranking, track) {
  if (!k.item || k.itemAge < ITEM_THINK || k.spinTime > 0) return false;
  if (k.itemAge > ITEM_GIVE_UP) return true;
  const pos = ranking.indexOf(k);
  const ahead = ranking[pos - 1], behind = ranking[pos + 1];
  switch (k.item) {
    case 'perisai': return true;
    case 'turbo': return cornerAhead(track, k.idx) < 0.3;
    case 'roket': return !!ahead && dist(k, ahead) < ROCKET_RANGE;
    case 'pisang': return !!behind && dist(k, behind) < BANANA_RANGE;
    default: return true;
  }
}
