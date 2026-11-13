// "Pantai Kelapa": closed spline circuit, road mesh, ramp, pads and beach scenery.
import * as THREE from '../vendor/three.module.min.js';
import { makeCanvasTexture } from './textures.js';

const CONTROL = [
  [0, 0, -100], [60, 0, -100], [120, 0, -95], [160, 0, -70], [178, 0, -38],
  [162, 0, 2], [118, 0, 12], [92, 0, 42], [110, 0, 75], [140, 3, 98],
  [136, 8, 132], [80, 6, 140], [30, 0, 130], [-20, 0, 140], [-80, 0, 130],
  [-120, 0, 100], [-130, 0, 50], [-112, 0, 15], [-136, 0, -25], [-110, 0, -70], [-60, 0, -100],
];
export const SAMPLES = 600;
export const ROAD_HALF = 7;
export const CURB_HALF = 8; // curb still counts as road
export const WALL = 12.5; // soft wall: beyond this the kart is pushed back
const SAND_HALF = 13;
const EDGE_HALF = 17;
const GROUND_Y = -0.5;
const SEARCH = 30; // samples searched around the last known index

export const RAMP = { t0: 0.585, t1: 0.597, height: 2.4, half: 5 };
export const ITEM_SPOTS = [0.08, 0.46, 0.7];
export const PAD_SPOTS = [0.135, 0.555, 0.86];
export const PAD_HALF = 3.2;

const COLORS = {
  road: 0x6d6a72, road2: 0x77737c, curbA: 0xe8453c, curbB: 0xf4f1ea,
  sand: 0xeed9a0, sand2: 0xe6cf92, bank: 0xcfb57a,
};

export function buildTrack(scene) {
  const curve = new THREE.CatmullRomCurve3(CONTROL.map((p) => new THREE.Vector3(...p)), true, 'centripetal');
  const pts = curve.getSpacedPoints(SAMPLES);
  const N = SAMPLES;
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
  const tx = new Float32Array(N), tz = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    px[i] = pts[i].x; py[i] = pts[i].y; pz[i] = pts[i].z;
    const n = pts[(i + 1) % N], p = pts[(i - 1 + N) % N];
    const dx = n.x - p.x, dz = n.z - p.z, len = Math.hypot(dx, dz);
    tx[i] = dx / len; tz[i] = dz / len;
  }
  const spacing = curve.getLength() / N;
  const rampI0 = Math.round(RAMP.t0 * N), rampI1 = Math.round(RAMP.t1 * N);
  const wrap = (i) => ((i % N) + N) % N;

  const track = {
    N, px, py, pz, tx, tz, spacing,
    idxOf: (t) => wrap(Math.round(t * N)),
    // Nearest sample to (x, z), searching near hint (or everywhere when hint < 0).
    nearest(x, z, hint = -1) {
      const from = hint < 0 ? 0 : hint - SEARCH, to = hint < 0 ? N - 1 : hint + SEARCH;
      let best = 0, bd = Infinity;
      for (let k = from; k <= to; k++) {
        const i = wrap(k), dx = x - px[i], dz = z - pz[i], d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = i; }
      }
      return best;
    },
    // Continuous frame at (x, z): sample idx, fractional index u, lateral offset (+ = right).
    locate(x, z, hint) {
      const idx = track.nearest(x, z, hint);
      const dx = x - px[idx], dz = z - pz[idx];
      const along = dx * tx[idx] + dz * tz[idx];
      const lat = dx * -tz[idx] + dz * tx[idx];
      const u = wrap(idx + along / spacing);
      return { idx, u, t: u / N, lat };
    },
    heightAt(u, lat) {
      const i0 = Math.floor(u) % N, i1 = (i0 + 1) % N, f = u - Math.floor(u);
      let y = py[i0] * (1 - f) + py[i1] * f;
      if (u >= rampI0 && u < rampI1 && Math.abs(lat) < RAMP.half) y += RAMP.height * (u - rampI0) / (rampI1 - rampI0);
      return y;
    },
    pointAt(i, lat) {
      i = wrap(i);
      return new THREE.Vector3(px[i] - tz[i] * lat, py[i], pz[i] + tx[i] * lat);
    },
    headingAt: (i) => Math.atan2(tx[wrap(i)], tz[wrap(i)]),
  };

  scene.add(buildRoadMesh(track));
  scene.add(buildRamp(track, rampI0, rampI1));
  for (const t of PAD_SPOTS) scene.add(buildFlat(track, track.idxOf(t), PAD_HALF * 2, 5, padTexture(), 0.04));
  scene.add(buildFlat(track, 0, ROAD_HALF * 2, 2.4, checkerTexture(8, 2), 0.03));
  scene.add(buildArch(track));
  buildScenery(scene, track);
  return track;
}

// ---------- road ----------
function buildRoadMesh(track) {
  const { N } = track;
  const lats = [-EDGE_HALF, -SAND_HALF, -CURB_HALF, -ROAD_HALF, ROAD_HALF, CURB_HALF, SAND_HALF, EDGE_HALF];
  const pos = [], col = [];
  const c = new THREE.Color();
  const vert = (i, lat) => {
    const p = track.pointAt(i, lat);
    if (Math.abs(lat) >= EDGE_HALF) p.y = Math.min(p.y, 0) + GROUND_Y - 0.05;
    return p;
  };
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (let b = 0; b < lats.length - 1; b++) {
      const A = vert(i, lats[b]), B = vert(i, lats[b + 1]), C = vert(j, lats[b]), D = vert(j, lats[b + 1]);
      for (const v of [A, B, C, B, D, C]) pos.push(v.x, v.y + 0.01, v.z);
      c.setHex(bandColor(b, i));
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

function bandColor(b, i) {
  if (b === 0 || b === 6) return COLORS.bank;
  if (b === 1 || b === 5) return (i >> 3) % 2 ? COLORS.sand : COLORS.sand2;
  if (b === 2 || b === 4) return (i >> 1) % 2 ? COLORS.curbA : COLORS.curbB;
  return (i >> 2) % 2 ? COLORS.road : COLORS.road2;
}

function buildRamp(track, i0, i1) {
  const pos = [], col = [];
  const cTop = new THREE.Color(0xc98a4b), cStripe = new THREE.Color(0xf2c14e), cSide = new THREE.Color(0x8a5a2e);
  const h = (i) => RAMP.height * (i - i0) / (i1 - i0);
  const quad = (a, b, c2, d, color) => {
    for (const v of [a, b, c2, b, d, c2]) pos.push(v.x, v.y, v.z);
    for (let k = 0; k < 6; k++) col.push(color.r, color.g, color.b);
  };
  const at = (i, lat, dy) => { const p = track.pointAt(i, lat); p.y += dy + 0.02; return p; };
  for (let i = i0; i < i1; i++) {
    const L0 = at(i, -RAMP.half, h(i)), R0 = at(i, RAMP.half, h(i));
    const L1 = at(i + 1, -RAMP.half, h(i + 1)), R1 = at(i + 1, RAMP.half, h(i + 1));
    quad(L0, R0, L1, R1, (i - i0) % 2 ? cTop : cStripe);
    quad(at(i, -RAMP.half, 0), L0, at(i + 1, -RAMP.half, 0), L1, cSide);
    quad(R0, at(i, RAMP.half, 0), R1, at(i + 1, RAMP.half, 0), cSide);
  }
  quad(at(i1, -RAMP.half, h(i1)), at(i1, RAMP.half, h(i1)), at(i1, -RAMP.half, 0), at(i1, RAMP.half, 0), cSide);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
}

// A textured plane lying on the road at sample i.
function buildFlat(track, i, width, length, texture, lift) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  );
  m.rotation.order = 'YXZ';
  m.rotation.set(-Math.PI / 2, track.headingAt(i) + Math.PI, 0); // texture "up" points along the track
  m.position.set(track.px[i], track.py[i] + lift, track.pz[i]);
  return m;
}

function padTexture() {
  return makeCanvasTexture(32, 32, (g) => {
    g.fillStyle = '#ff8a1f'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#fff36b';
    for (const y of [4, 18]) { g.beginPath(); g.moveTo(16, y); g.lineTo(28, y + 10); g.lineTo(4, y + 10); g.fill(); }
  });
}

function checkerTexture(cols, rows) {
  return makeCanvasTexture(cols * 4, rows * 4, (g) => {
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 4, y * 4, 4, 4);
    }
  });
}

function buildArch(track) {
  const group = new THREE.Group();
  const pillarMat = new THREE.MeshLambertMaterial({ color: 0x2f9e8f, flatShading: true });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8, 1.2), pillarMat);
    p.position.set(s * 10, 4, 0);
    group.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(21.2, 1.6, 1.2), new THREE.MeshBasicMaterial({ map: checkerTexture(16, 2) }));
  beam.position.y = 8.4;
  group.add(beam);
  group.position.set(track.px[0], track.py[0], track.pz[0]);
  group.rotation.y = track.headingAt(0);
  return group;
}

// ---------- scenery ----------
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Random spots beside the track that keep clear of every part of the road.
function scatter(track, count, minLat, maxLat, rand) {
  const out = [];
  for (let tries = 0; out.length < count && tries < count * 20; tries++) {
    const i = Math.floor(rand() * track.N);
    const side = rand() < 0.5 ? -1 : 1;
    const p = track.pointAt(i, side * (minLat + rand() * (maxLat - minLat)));
    let clear = true;
    for (let k = 0; k < track.N && clear; k += 3) clear = Math.hypot(p.x - track.px[k], p.z - track.pz[k]) > minLat;
    if (clear) out.push(p);
  }
  return out;
}

function buildScenery(scene, track) {
  const rand = rng(7);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(250, 24), new THREE.MeshLambertMaterial({ color: 0xe2cd8e }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(20, GROUND_Y, 20);
  scene.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshLambertMaterial({ color: 0x2aa7d8 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = GROUND_Y - 0.4;
  scene.add(sea);
  addPalms(scene, scatter(track, 70, 19, 50, rand), rand);
  addRocks(scene, scatter(track, 30, 16, 45, rand), rand);
  addHuts(scene, scatter(track, 6, 26, 40, rand), rand);
}

function addPalms(scene, spots, rand) {
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.55, 8, 5), new THREE.MeshLambertMaterial({ color: 0x9a6a3c, flatShading: true }), spots.length);
  const crowns = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x3fa34d, flatShading: true }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  spots.forEach((p, k) => {
    const h = 0.8 + rand() * 0.6, lean = (rand() - 0.5) * 0.35, yaw = rand() * Math.PI * 2;
    e.set(lean, yaw, 0); q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x, GROUND_Y + 4 * h, p.z), q, s.set(1, h, 1));
    trunks.setMatrixAt(k, m);
    const top = new THREE.Vector3(0, 4 * h, 0).applyQuaternion(q);
    m.compose(new THREE.Vector3(p.x + top.x, GROUND_Y + 8 * h + 0.2, p.z + top.z), q, s.set(4.2, 0.9, 4.2));
    crowns.setMatrixAt(k, m);
  });
  scene.add(trunks, crowns);
}

function addRocks(scene, spots, rand) {
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x8e8a86, flatShading: true }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  spots.forEach((p, k) => {
    const sc = 0.8 + rand() * 2;
    e.set(rand() * 3, rand() * 3, rand() * 3); q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x, GROUND_Y + sc * 0.4, p.z), q, new THREE.Vector3(sc, sc * 0.7, sc));
    rocks.setMatrixAt(k, m);
  });
  scene.add(rocks);
}

function addHuts(scene, spots, rand) {
  const wall = new THREE.MeshLambertMaterial({ color: 0xb5793f, flatShading: true });
  const roof = new THREE.MeshLambertMaterial({ color: 0xe8c66a, flatShading: true });
  for (const p of spots) {
    const hut = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 5), wall);
    body.position.y = 1.75;
    const top = new THREE.Mesh(new THREE.ConeGeometry(5.2, 3, 4), roof);
    top.position.y = 5;
    top.rotation.y = Math.PI / 4;
    hut.add(body, top);
    hut.position.set(p.x, GROUND_Y, p.z);
    hut.rotation.y = rand() * Math.PI;
    scene.add(hut);
  }
}
