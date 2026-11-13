// Kart Santai: renderer, game loop and the menu -> countdown -> race -> results state machine.
import * as THREE from '../vendor/three.module.min.js';
import { getBest, saveBest, registerSW } from '../app.js';
import { LAPS, advanceLap, progressOf, isFinished, shownLap, rankRacers, startBoost, formatTime, rubberBand } from './logic.js';
import { CHARACTERS, buildRacerModel, updateRacerModel } from './racers.js';
import { buildTrack } from './track.js';
import { createKart, updateKart, collideKarts, applyBoost, PHYS } from './physics.js';
import { createItems } from './items.js';
import { botInput, botWantsItem } from './ai.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud, renderPicker, renderResults } from './hud.js';

registerSW();

const INTERNAL_SHORT_SIDE = 360; // low-res render target, upscaled with pixelated CSS
const COUNTDOWN = 3;
const FINISH_DELAY = 2.5;
const TOUCH_START_BOOST = 0.5;
const WRONG_WAY_DELAY = 0.8;
const GRID = [[4, -3.5], [8, 3.5], [12, -3.5], [16, 3.5]]; // samples behind the line, lateral
const BOT_SKILL = [0.95, 0.965, 0.98];
const BOT_LANES = [-3, 0, 3];
const FOV_LANDSCAPE = 70;
const FOV_PORTRAIT = 92;
const FOV_BOOST_KICK = 9;
const CAM_BACK = 7.5;
const CAM_UP = 3.4;
const BEST_TIME_KEY = 'kart:bestTime';

const $ = (id) => document.getElementById(id);

// ---------- three.js setup ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('view'), antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const SKY = 0x9fdcf5;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 70, 260);
scene.add(new THREE.HemisphereLight(0xdff4ff, 0xc9a86a, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(80, 140, 40);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(FOV_LANDSCAPE, 1, 0.5, 400);
let baseFov = FOV_LANDSCAPE;

function resize() {
  const w = innerWidth, h = innerHeight;
  const scale = Math.min(1, INTERNAL_SHORT_SIDE / Math.min(w, h));
  renderer.setSize(Math.round(w * scale), Math.round(h * scale), false);
  camera.aspect = w / h;
  baseFov = w < h ? FOV_PORTRAIT : FOV_LANDSCAPE;
  camera.fov = baseFov;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const track = buildTrack(scene);
const hud = createHud();
const audio = createAudio();
const input = createInput(document.querySelectorAll('[data-ctl]'));
const items = createItems(scene, track, {
  onPickup: (k) => { if (k.isPlayer) audio.pickup(); },
  onHit: (k, landed) => { if (k.isPlayer || landed) audio.hit(); },
  onUse: (k, item) => { if (k.isPlayer) (item === 'turbo' ? audio.boost() : audio.use()); },
});

// ---------- game state ----------
const game = {
  mode: 'menu', paused: false, time: 0, raceTime: 0, countdown: 0, goShown: 0,
  karts: [], models: [], ranking: [], player: null, selected: CHARACTERS[0].id,
  gasPressedAt: null, lapStart: 0, lapTimes: [], finishTimer: 0, wrongTimer: 0, lastBoost: 0,
};

function setupRace(playerId) {
  for (const m of game.models) scene.remove(m.root);
  items.reset();
  const others = CHARACTERS.filter((c) => c.id !== playerId);
  const roster = [...others, CHARACTERS.find((c) => c.id === playerId)]; // player starts at the back
  game.karts = roster.map((c, i) => {
    const k = createKart(c, track, track.N - GRID[i][0], GRID[i][1]);
    k.isPlayer = c.id === playerId;
    k.lane = BOT_LANES[i % BOT_LANES.length];
    k.skill = BOT_SKILL[i % BOT_SKILL.length];
    k.phase = i * 1.7;
    return k;
  });
  game.models = game.karts.map((k) => { const m = buildRacerModel(k.char); scene.add(m.root); return m; });
  game.player = game.karts.find((k) => k.isPlayer);
  game.ranking = [...game.karts];
  Object.assign(game, { raceTime: 0, lapStart: 0, lapTimes: [], finishTimer: 0, wrongTimer: 0, gasPressedAt: null, lastBoost: 0 });
  syncModels();
}

function syncModels() {
  game.karts.forEach((k, i) => updateRacerModel(game.models[i], k, game.time));
}

// ---------- flow ----------
const menu = $('menu'), results = $('results'), pauseDlg = $('pause');

function showMenu() {
  game.mode = 'menu';
  input.setEnabled(false);
  hud.showRace(false);
  hud.countdown(null);
  menu.hidden = false;
  const best = readBestTime();
  $('menuBest').textContent = `Juara: ${getBest('kart')}× · Waktu terbaik: ${formatTime(best)}`;
  pick(game.selected);
}

function pick(id) {
  game.selected = id;
  renderPicker($('racers'), CHARACTERS, id, pick);
  setupRace(id);
}

function startCountdown() {
  audio.unlock();
  menu.hidden = true;
  if (results.open) results.close();
  setupRace(game.selected);
  game.mode = 'countdown';
  game.countdown = COUNTDOWN;
  input.setEnabled(true);
  hud.showRace(true);
  hud.countdown(String(COUNTDOWN));
  audio.countdown(false);
}

function startRace() {
  game.mode = 'race';
  game.goShown = 0.8;
  hud.countdown('GO!');
  audio.countdown(true);
  const p = game.player;
  applyBoost(p, input.isTouch() ? TOUCH_START_BOOST : startBoost(game.gasPressedAt));
  if (p.boostTime > 0) hud.banner('Start mantap! 🔥', 1.2);
}

function finishPlayer() {
  game.mode = 'finish';
  game.finishTimer = FINISH_DELAY;
  input.setEnabled(false);
  const pos = game.ranking.indexOf(game.player) + 1;
  hud.banner(pos === 1 ? 'JUARA 1! 🏆' : `FINIS! Posisi ${pos}`, FINISH_DELAY);
}

function showResults() {
  game.mode = 'results';
  hud.showRace(false);
  audio.setEngine(0, false);
  const p = game.player;
  const pos = game.ranking.indexOf(p) + 1;
  if (pos === 1) saveBest('kart', getBest('kart') + 1);
  const prevBest = readBestTime();
  const isRecord = prevBest == null || p.finishTime < prevBest;
  if (isRecord) writeBestTime(p.finishTime);
  $('resTitle').textContent = pos === 1 ? 'Juara 1! 🏆' : `Posisi ${pos} dari ${game.karts.length}`;
  const bestLap = game.lapTimes.length ? Math.min(...game.lapTimes) : null;
  $('resInfo').textContent = `Waktu: ${formatTime(p.finishTime)} · Lap terbaik: ${formatTime(bestLap)}` +
    (isRecord ? ' · Rekor baru!' : ` · Rekor: ${formatTime(prevBest)}`);
  renderResults($('resTable'), game.ranking.map((k) => ({ name: k.char.name, emoji: k.char.emoji, isPlayer: k.isPlayer, time: k.finishTime })));
  results.showModal();
}

function readBestTime() {
  try { const v = Number(localStorage.getItem(BEST_TIME_KEY)); return v > 0 ? v : null; } catch { return null; }
}
function writeBestTime(t) {
  try { localStorage.setItem(BEST_TIME_KEY, String(t)); } catch { /* storage blocked: record lasts this visit only */ }
}

// ---------- pause ----------
const racing = () => ['countdown', 'race', 'finish'].includes(game.mode);
function pause() {
  if (!racing() || game.paused) return;
  game.paused = true;
  audio.setEngine(0, false);
  input.setEnabled(false);
  if (!pauseDlg.open) pauseDlg.showModal();
}
function resume() {
  if (pauseDlg.open) pauseDlg.close();
  game.paused = false;
  input.setEnabled(game.mode === 'countdown' || game.mode === 'race');
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
pauseDlg.addEventListener('close', () => { if (game.paused) resume(); });
$('pauseBtn').addEventListener('click', pause);
$('resumeBtn').addEventListener('click', resume);
$('quitBtn').addEventListener('click', () => { location.href = '../index.html'; });
$('startBtn').addEventListener('click', startCountdown);
$('againBtn').addEventListener('click', startCountdown);
$('changeBtn').addEventListener('click', () => { results.close(); showMenu(); });
results.addEventListener('cancel', (e) => e.preventDefault());
$('muteBtn').addEventListener('click', () => {
  audio.unlock();
  const m = audio.toggleMute();
  $('muteBtn').textContent = m ? '🔇' : '🔊';
  $('muteBtn').setAttribute('aria-label', m ? 'Nyalakan suara' : 'Matikan suara');
});
addEventListener('pointerdown', () => audio.unlock(), { once: true });
addEventListener('keydown', () => audio.unlock(), { once: true });

// ---------- per-frame ----------
function stepCountdown(dt) {
  const before = Math.ceil(game.countdown);
  game.countdown -= dt;
  const gas = input.read().gas;
  if (gas && game.gasPressedAt == null) game.gasPressedAt = game.countdown;
  if (!gas) game.gasPressedAt = null;
  const now = Math.ceil(game.countdown);
  if (game.countdown <= 0) startRace();
  else if (now !== before) { hud.countdown(String(now)); audio.countdown(false); }
}

function onLap(k) {
  if (!k.isPlayer) return;
  const lap = k.lapState.lap;
  if (lap >= 2) { game.lapTimes.push(game.raceTime - game.lapStart); game.lapStart = game.raceTime; }
  if (lap === LAPS) hud.banner('PUTARAN TERAKHIR!', 2);
  if (lap >= 2) audio.lap();
}

function stepKart(k, dt) {
  const human = k.isPlayer && game.mode === 'race';
  k.speedScale = k.isPlayer ? 1 : k.skill * rubberBand(game.player.progress - k.progress);
  const ctl = human ? input.read() : botInput(k, track, game.time);
  updateKart(k, ctl, dt, track);
  const prevLap = k.lapState.lap;
  k.lapState = advanceLap(k.lapState, k.t);
  k.progress = progressOf(k.lapState);
  if (k.lapState.lap > prevLap) onLap(k);
  if (isFinished(k.lapState) && k.finishTime == null) {
    k.finishTime = game.raceTime;
    if (k.isPlayer) finishPlayer();
  }
  if (human ? input.takeItem() : botWantsItem(k, game.ranking, track)) items.use(k, game.ranking);
}

function stepRace(dt) {
  game.raceTime += dt;
  for (const k of game.karts) stepKart(k, dt);
  collideKarts(game.karts);
  const ids = rankRacers(game.karts.map((k) => ({ id: k, progress: k.progress, finishTime: k.finishTime })));
  game.ranking = ids;
  items.update(dt, game.karts, game.ranking, game.time);
  if (game.mode === 'finish' && (game.finishTimer -= dt) <= 0) showResults();
  const p = game.player;
  if (p.boostTime > 0 && game.lastBoost <= 0) audio.boost();
  game.lastBoost = p.boostTime;
  game.wrongTimer = p.wrongWay ? game.wrongTimer + dt : 0;
}

function updateHud() {
  const p = game.player;
  hud.race({
    lap: shownLap(p.lapState), laps: LAPS, pos: game.ranking.indexOf(p) + 1, total: game.karts.length,
    time: p.finishTime ?? game.raceTime, item: p.item, speed01: p.speed / (PHYS.MAX_SPEED * PHYS.BOOST_MULT),
    wrongWay: game.wrongTimer > WRONG_WAY_DELAY && game.mode === 'race',
  });
  audio.setEngine(p.speed / PHYS.MAX_SPEED, true);
}

const camLook = new THREE.Vector3();
function chaseCamera(dt) {
  const k = game.player;
  const fx = Math.sin(k.heading), fz = Math.cos(k.heading);
  const a = 1 - Math.exp(-dt * 8);
  camera.position.x += (k.x - fx * CAM_BACK - camera.position.x) * a;
  camera.position.z += (k.z - fz * CAM_BACK - camera.position.z) * a;
  camera.position.y += (Math.max(k.y, k.groundY) + CAM_UP - camera.position.y) * a;
  camera.lookAt(camLook.set(k.x + fx * 5, k.y + 1.2, k.z + fz * 5));
  const fov = baseFov + (k.boostTime > 0 ? FOV_BOOST_KICK : 0);
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 5)); camera.updateProjectionMatrix(); }
}

function orbitCamera() {
  const t = game.time * 0.15;
  const p = game.player;
  camera.position.set(p.x + Math.sin(t) * 16, p.y + 6, p.z + Math.cos(t) * 16);
  camera.lookAt(camLook.set(p.x, p.y + 1, p.z));
}

function step(dt) {
  game.time += dt;
  if (game.mode === 'countdown') stepCountdown(dt);
  if (game.mode === 'race' || game.mode === 'finish') {
    stepRace(dt);
    if (game.goShown > 0 && (game.goShown -= dt) <= 0) hud.countdown(null);
  }
  if (racing()) { updateHud(); chaseCamera(dt); } else {
    orbitCamera();
    items.update(0, [], [], game.time); // keep boxes spinning behind menus
  }
  syncModels();
}

let lastNow = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (!game.paused) step(dt);
  renderer.render(scene, camera);
}

showMenu();
requestAnimationFrame(frame);
