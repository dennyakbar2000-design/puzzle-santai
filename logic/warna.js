// Sortir Warna: pure ball-sort logic. Tubes are arrays bottom -> top of color indexes.
export const CAP = 4;
const EMPTY_TUBES = 2;
const MAX_COLORS = 10;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function colorsForLevel(n) {
  return Math.min(3 + Math.floor((n - 1) / 2), MAX_COLORS);
}

function isCompleteTube(tube) {
  return tube.length === CAP && tube.every((c) => c === tube[0]);
}

function shuffled(items, rng) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// shortcut: random layouts with 2 empty tubes are almost always solvable but not proven; "+1 Tabung" is the escape hatch.
export function makeLevel(n) {
  const colors = colorsForLevel(n);
  const rng = mulberry32(n);
  const balls = [];
  for (let c = 0; c < colors; c++) for (let k = 0; k < CAP; k++) balls.push(c);
  for (;;) {
    const mixed = shuffled(balls, rng);
    const tubes = [];
    for (let i = 0; i < colors; i++) tubes.push(mixed.slice(i * CAP, (i + 1) * CAP));
    if (tubes.some(isCompleteTube)) continue; // also rules out an already-solved level
    for (let i = 0; i < EMPTY_TUBES; i++) tubes.push([]);
    return tubes;
  }
}

function topGroupSize(tube) {
  let size = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === tube[tube.length - 1]; i--) size++;
  return size;
}

export function canPour(tubes, from, to) {
  if (from === to) return false;
  const src = tubes[from];
  const dst = tubes[to];
  if (!src || !dst || src.length === 0 || dst.length >= CAP) return false;
  return dst.length === 0 || dst[dst.length - 1] === src[src.length - 1];
}

// Returns new tubes; never mutates input. Callers must check canPour first (no validation here).
export function pour(tubes, from, to) {
  const src = tubes[from];
  const count = Math.min(topGroupSize(src), CAP - tubes[to].length);
  const moved = src.slice(src.length - count);
  return tubes.map((tube, i) => {
    if (i === from) return src.slice(0, src.length - count);
    if (i === to) return tube.concat(moved);
    return tube.slice();
  });
}

export function isSolved(tubes) {
  return tubes.every((tube) => tube.length === 0 || isCompleteTube(tube));
}
