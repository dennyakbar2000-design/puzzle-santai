// The four original animal racers, built from three.js primitives, plus per-kart effects.
import * as THREE from '../vendor/three.module.min.js';

// stats 1-5; small differences only (each sums to 10)
export const CHARACTERS = [
  { id: 'kucing', name: 'Kucing Oren', emoji: '🐱', color: 0xf28c28, stats: { speed: 3, accel: 4, turn: 3 } },
  { id: 'kodok', name: 'Kodok Hijau', emoji: '🐸', color: 0x3cb44b, stats: { speed: 3, accel: 3, turn: 4 } },
  { id: 'ayam', name: 'Ayam Jago', emoji: '🐓', color: 0xe03a3a, stats: { speed: 4, accel: 3, turn: 3 } },
  { id: 'kura', name: 'Kura Biru', emoji: '🐢', color: 0x2f6fdf, stats: { speed: 4, accel: 2, turn: 4 } },
];

export function statMultipliers({ speed, accel, turn }) {
  return { speed: 1 + (speed - 3) * 0.03, accel: 1 + (accel - 3) * 0.12, turn: 1 + (turn - 3) * 0.08 };
}

const SPARK_COLORS = [0xfff6d0, 0xffd23f, 0xff8a1f, 0xb04dff]; // putih, kuning, oranye, ungu
const lambert = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };

function buildKart(color) {
  const g = new THREE.Group();
  const paint = lambert(color), dark = lambert(0x262428), trim = lambert(0xf4f1ea);
  g.add(mesh(new THREE.BoxGeometry(1.8, 0.45, 2.8), paint, 0, 0.55, 0));
  g.add(mesh(new THREE.BoxGeometry(1.4, 0.35, 0.7), paint, 0, 0.6, 1.6));
  g.add(mesh(new THREE.BoxGeometry(2.1, 0.2, 0.3), trim, 0, 0.45, 1.95));
  g.add(mesh(new THREE.BoxGeometry(1.2, 0.7, 0.25), dark, 0, 1.0, -0.9));
  const wheel = new THREE.CylinderGeometry(0.45, 0.45, 0.42, 8);
  for (const [x, z] of [[-1.05, 1], [1.05, 1], [-1.05, -1], [1.05, -1]]) {
    const w = mesh(wheel, dark, x, 0.45, z);
    w.rotation.z = Math.PI / 2;
    g.add(w);
  }
  return g;
}

const eye = (x, y, z, r = 0.1) => mesh(new THREE.SphereGeometry(r, 6, 4), lambert(0x111111), x, y, z);

function buildCat(head) {
  const fur = lambert(0xf28c28), white = lambert(0xfff3e0);
  head.add(mesh(new THREE.SphereGeometry(0.62, 8, 6), fur));
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.22, 0.45, 4), fur, s * 0.36, 0.55, 0);
    ear.rotation.z = -s * 0.3;
    head.add(ear, eye(s * 0.22, 0.12, 0.55));
  }
  head.add(mesh(new THREE.SphereGeometry(0.28, 6, 4), white, 0, -0.12, 0.5));
  head.add(mesh(new THREE.SphereGeometry(0.08, 4, 3), lambert(0xff6f91), 0, -0.02, 0.76));
}

function buildFrog(head) {
  const skin = lambert(0x3cb44b), white = lambert(0xffffff);
  const h = mesh(new THREE.SphereGeometry(0.62, 8, 6), skin);
  h.scale.set(1.15, 0.8, 1);
  head.add(h);
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.24, 8, 6), white, s * 0.32, 0.45, 0.25));
    head.add(eye(s * 0.32, 0.5, 0.46, 0.11));
  }
  head.add(mesh(new THREE.BoxGeometry(0.7, 0.06, 0.1), lambert(0x7a1f2b), 0, -0.15, 0.6));
}

function buildRooster(head) {
  const feather = lambert(0xfdf6e3), red = lambert(0xe03a3a);
  head.add(mesh(new THREE.SphereGeometry(0.55, 8, 6), feather));
  for (const [z, y] of [[0.25, 0.55], [0, 0.65], [-0.25, 0.55]]) head.add(mesh(new THREE.SphereGeometry(0.17, 5, 4), red, 0, y, z));
  const beak = mesh(new THREE.ConeGeometry(0.15, 0.4, 4), lambert(0xffb703), 0, 0, 0.65);
  beak.rotation.x = Math.PI / 2;
  head.add(beak, mesh(new THREE.SphereGeometry(0.12, 5, 4), red, 0, -0.25, 0.5));
  for (const s of [-1, 1]) head.add(eye(s * 0.24, 0.15, 0.45));
}

function buildTurtle(head, body) {
  const skin = lambert(0x9bd17a);
  head.add(mesh(new THREE.SphereGeometry(0.52, 8, 6), skin));
  for (const s of [-1, 1]) head.add(eye(s * 0.2, 0.12, 0.45));
  const shell = mesh(new THREE.SphereGeometry(0.85, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0x2f6fdf), 0, 0.95, -0.55);
  shell.rotation.x = -0.6;
  body.add(shell);
}

const HEADS = { kucing: buildCat, kodok: buildFrog, ayam: buildRooster, kura: buildTurtle };

function buildFx(root, body) {
  const sparkMat = new THREE.MeshBasicMaterial({ color: SPARK_COLORS[0] });
  const sparkGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const sparks = [];
  for (let k = 0; k < 6; k++) { const s = new THREE.Mesh(sparkGeo, sparkMat); s.visible = false; body.add(s); sparks.push(s); }
  const flame = mesh(new THREE.ConeGeometry(0.35, 1.4, 6), new THREE.MeshBasicMaterial({ color: 0xff9a2e }), 0, 0.6, -2);
  flame.rotation.x = -Math.PI / 2;
  flame.visible = false;
  body.add(flame);
  const shield = mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.3, depthWrite: false }), 0, 1, 0);
  shield.visible = false;
  body.add(shield);
  const shadow = mesh(new THREE.CircleGeometry(1.5, 10), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }), 0, 0.05, 0);
  shadow.rotation.x = -Math.PI / 2;
  root.add(shadow);
  return { sparks, sparkMat, flame, shield, shadow };
}

export function buildRacerModel(char) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(buildKart(char.color));
  body.add(mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.8, 7), lambert(char.color), 0, 1.15, -0.3));
  const head = new THREE.Group();
  head.position.set(0, 1.95, -0.15);
  body.add(head);
  HEADS[char.id](head, body);
  return { root, body, ...buildFx(root, body) };
}

const DRIFT_YAW = 0.38;

// Sync a model to its kart state (plain numbers from physics.js).
export function updateRacerModel(model, k, time) {
  model.root.position.set(k.x, k.y, k.z);
  model.root.rotation.y = k.heading;
  const spin = k.spinTime > 0 ? time * 18 : 0;
  model.body.rotation.y = spin + (k.drifting ? k.driftDir * -DRIFT_YAW : 0);
  model.body.rotation.z = k.drifting ? k.driftDir * 0.08 : 0;
  model.body.rotation.x = k.airborne ? -0.15 : 0;
  model.shadow.position.y = k.groundY - k.y + 0.06;
  model.shield.visible = k.shieldTime > 0;
  model.flame.visible = k.boostTime > 0;
  if (k.boostTime > 0) model.flame.scale.setScalar(0.8 + Math.random() * 0.5);
  const showSparks = k.drifting && !k.airborne;
  model.sparkMat.color.setHex(SPARK_COLORS[k.driftLevel] ?? SPARK_COLORS[0]);
  model.sparks.forEach((s, i) => {
    s.visible = showSparks && (k.driftLevel > 0 || i % 2 === 0);
    if (!s.visible) return;
    const side = i < 3 ? -1 : 1;
    s.position.set(side * 1.1 + (Math.random() - 0.5) * 0.6, 0.2 + Math.random() * 0.5, -1.4 - Math.random() * 0.8);
  });
}
