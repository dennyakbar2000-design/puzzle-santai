// Item boxes, rockets, banana peels, shields and turbo.
import * as THREE from '../vendor/three.module.min.js';
import { pickItem } from './logic.js';
import { ITEM_SPOTS } from './track.js';
import { applyBoost, hitKart } from './physics.js';
import { questionTexture } from './textures.js';

const BOX_LATS = [-4.5, -1.5, 1.5, 4.5];
const BOX_RESPAWN = 3;
const PICK_DIST = 2.3;
const ROCKET_SPEED = 52;
const ROCKET_TURN = 4;
const ROCKET_LIFE = 6;
const ROCKET_HOME_DIST = 28;
const ROCKET_HIT = 2.2;
const BANANA_HIT = 1.7;
const BANANA_OWNER_ARM = 1.5; // the dropper is safe from its own peel briefly
const BANANA_MAX = 10;
const SHIELD_TIME = 6;
const TURBO_TIME = 1.3;

export function createItems(scene, track, fx) {
  const boxGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  const boxMat = new THREE.MeshBasicMaterial({ map: questionTexture(), transparent: true, depthWrite: false });
  const rocketGeo = new THREE.ConeGeometry(0.35, 1.6, 6).rotateX(Math.PI / 2);
  const rocketMat = new THREE.MeshLambertMaterial({ color: 0xe8453c, flatShading: true });
  const bananaGeo = new THREE.TorusGeometry(0.5, 0.18, 4, 8, Math.PI);
  const bananaMat = new THREE.MeshLambertMaterial({ color: 0xffd23f, flatShading: true });

  const boxes = [];
  for (const t of ITEM_SPOTS) {
    const i = track.idxOf(t);
    for (const lat of BOX_LATS) {
      const p = track.pointAt(i, lat);
      const mesh = new THREE.Mesh(boxGeo, boxMat);
      mesh.position.set(p.x, p.y + 1.3, p.z);
      scene.add(mesh);
      boxes.push({ mesh, x: p.x, y: p.y, z: p.z, respawn: 0 });
    }
  }
  let rockets = [];
  let bananas = [];

  const near = (a, b, r) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2 < r * r && Math.abs(a.y - b.y) < 2.5;

  function updateBoxes(dt, karts, ranking, time) {
    for (const b of boxes) {
      b.mesh.rotation.set(time * 0.7, time * 1.3, 0);
      b.mesh.position.y = b.y + 1.3 + Math.sin(time * 2 + b.x) * 0.2;
      if (b.respawn > 0) {
        b.respawn -= dt;
        b.mesh.visible = b.respawn <= 0;
        continue;
      }
      const k = karts.find((kk) => near(kk, b, PICK_DIST));
      if (!k) continue;
      b.respawn = BOX_RESPAWN;
      b.mesh.visible = false;
      if (!k.item) {
        k.item = pickItem(ranking.indexOf(k) + 1, karts.length);
        k.itemAge = 0;
        fx.onPickup(k);
      }
    }
  }

  function updateRockets(dt, karts) {
    rockets = rockets.filter((r) => {
      r.life -= dt;
      const tgt = r.target;
      const homing = tgt && (tgt.x - r.x) ** 2 + (tgt.z - r.z) ** 2 < ROCKET_HOME_DIST ** 2;
      const aim = homing ? tgt : track.pointAt(r.idx + 10, tgt ? tgt.lat * 0.5 : 0);
      let diff = Math.atan2(aim.x - r.x, aim.z - r.z) - r.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      r.heading += Math.max(-ROCKET_TURN * dt, Math.min(ROCKET_TURN * dt, diff));
      r.x += Math.sin(r.heading) * ROCKET_SPEED * dt;
      r.z += Math.cos(r.heading) * ROCKET_SPEED * dt;
      const loc = track.locate(r.x, r.z, r.idx);
      r.idx = loc.idx;
      r.y = track.heightAt(loc.u, loc.lat) + 0.8;
      r.mesh.position.set(r.x, r.y, r.z);
      r.mesh.rotation.y = r.heading;
      const victim = karts.find((k) => k !== r.owner && near(k, r, ROCKET_HIT));
      if (victim) fx.onHit(victim, hitKart(victim));
      const alive = !victim && r.life > 0 && Math.abs(loc.lat) < 16;
      if (!alive) scene.remove(r.mesh);
      return alive;
    });
  }

  function updateBananas(dt, karts) {
    bananas = bananas.filter((b) => {
      b.age += dt;
      const victim = karts.find((k) => (k !== b.owner || b.age > BANANA_OWNER_ARM) && near(k, b, BANANA_HIT));
      if (!victim) return true;
      fx.onHit(victim, hitKart(victim));
      scene.remove(b.mesh);
      return false;
    });
  }

  function fireRocket(k, ranking) {
    const pos = ranking.indexOf(k);
    const mesh = new THREE.Mesh(rocketGeo, rocketMat);
    scene.add(mesh);
    rockets.push({
      mesh, owner: k, target: pos > 0 ? ranking[pos - 1] : null, life: ROCKET_LIFE,
      x: k.x + Math.sin(k.heading) * 2.5, y: k.y + 0.8, z: k.z + Math.cos(k.heading) * 2.5, heading: k.heading, idx: k.idx,
    });
  }

  function dropBanana(k) {
    const mesh = new THREE.Mesh(bananaGeo, bananaMat);
    const x = k.x - Math.sin(k.heading) * 3, z = k.z - Math.cos(k.heading) * 3;
    const loc = track.locate(x, z, k.idx);
    const y = track.heightAt(loc.u, loc.lat);
    mesh.position.set(x, y + 0.3, z);
    mesh.rotation.y = k.heading;
    scene.add(mesh);
    bananas.push({ mesh, owner: k, age: 0, x, y, z });
    if (bananas.length > BANANA_MAX) scene.remove(bananas.shift().mesh);
  }

  function use(k, ranking) {
    const item = k.item;
    if (!item || k.spinTime > 0) return;
    k.item = null;
    if (item === 'roket') fireRocket(k, ranking);
    else if (item === 'pisang') dropBanana(k);
    else if (item === 'perisai') k.shieldTime = SHIELD_TIME;
    else applyBoost(k, TURBO_TIME);
    fx.onUse(k, item);
  }

  function reset() {
    for (const o of [...rockets, ...bananas]) scene.remove(o.mesh);
    rockets = [];
    bananas = [];
    for (const b of boxes) { b.respawn = 0; b.mesh.visible = true; }
  }

  function update(dt, karts, ranking, time) {
    for (const k of karts) k.itemAge = (k.itemAge ?? 0) + dt;
    updateBoxes(dt, karts, ranking, time);
    updateRockets(dt, karts);
    updateBananas(dt, karts);
  }

  return { update, use, reset, getBananas: () => bananas };
}
