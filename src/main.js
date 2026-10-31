import * as THREE from '../vendor/three.module.js';
import { createWorld, SUN_DIR } from './world.js';
import { createBoat, updateBoatVisual } from './boat.js';
import { SoundEngine } from './audio.js';
import { waveHeight } from './track.js';
import { angleDiff, clamp, damp, formatTime, bn, glowTexture } from './util.js';

const LAPS = 2;
const ORDINALS = ['১ম', '২য়', '৩য়', '৪র্থ'];

const canvas = document.getElementById('scene');
const loadingEl = document.getElementById('loading');
const hudEl = document.getElementById('hud');
const menuEl = document.getElementById('menu');
const pauseEl = document.getElementById('pause');
const resultsEl = document.getElementById('results');
const countdownEl = document.getElementById('countdown');
const toastEl = document.getElementById('toast');
const lapEl = document.getElementById('lap');
const placeEl = document.getElementById('place');
const timerEl = document.getElementById('timer');
const speedEl = document.getElementById('speed');
const boostPctEl = document.getElementById('boostPct');
const boostFillEl = document.getElementById('boostFill');
const boostWrap = boostFillEl.parentElement.parentElement;
const minimap = document.getElementById('minimap');
const mmCtx = minimap.getContext('2d');
const bestTimeEl = document.getElementById('bestTime');
const muteBtn = document.getElementById('muteBtn');
const soundBtn = document.getElementById('soundBtn');

const sfx = new SoundEngine();
const keys = { left: false, right: false, brake: false, boost: false };
const touchInput = { left: false, right: false, boost: false };

let renderer;
let scene;
let camera;
let world;
let raf = 0;
let lastFrame = 0;
let elapsed = 0;
let oarTimer = 0;
let birdTimer = 6;
let hudAccumulator = 0;

const game = {
  state: 'loading',
  countdown: 0,
  lastCount: null,
  raceTime: 0,
  shake: 0,
  toastTimer: 0,
  finishOrder: [],
  boostWasActive: false,
  best: Number(localStorage.getItem('nouka-best')) || 0,
};

const boats = [];
let player = null;
const cameraTarget = new THREE.Vector3();
const camLook = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

const AI_THEMES = [
  { trim: '#2f9b6b', flag: '#2f9b6b', base: 19.1, lane: -2.4 },
  { trim: '#2f6fb3', flag: '#2f6fb3', base: 19.9, lane: 2.4 },
  { trim: '#b8457f', flag: '#b8457f', base: 20.6, lane: 0 },
];

// ---------------------------------------------------------------- particles
const PARTICLE_MAX = 420;
let particles;
let pPos;
let pCol;
let pVel = [];
let pLife = [];
let pSize = [];
let particleCursor = 0;

function initParticles() {
  const geo = new THREE.BufferGeometry();
  pPos = new Float32Array(PARTICLE_MAX * 3);
  pCol = new Float32Array(PARTICLE_MAX * 3);
  pSize = new Float32Array(PARTICLE_MAX);
  for (let i = 0; i < PARTICLE_MAX; i++) {
    pPos[i * 3 + 1] = -100;
    pVel.push(new THREE.Vector3());
    pLife.push(0);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
  const mat = new THREE.PointsMaterial({
    map: glowTexture(),
    size: 0.34,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    vertexColors: true,
    sizeAttenuation: true,
  });
  particles = new THREE.Points(geo, mat);
  particles.frustumCulled = false;
  scene.add(particles);
}

function spawnParticle(x, y, z, vx, vy, vz, color, life = 0.8) {
  const i = particleCursor;
  particleCursor = (particleCursor + 1) % PARTICLE_MAX;
  pPos[i * 3] = x;
  pPos[i * 3 + 1] = y;
  pPos[i * 3 + 2] = z;
  pVel[i].set(vx, vy, vz);
  pLife[i] = life;
  const c = new THREE.Color(color);
  pCol[i * 3] = c.r;
  pCol[i * 3 + 1] = c.g;
  pCol[i * 3 + 2] = c.b;
}

function updateParticles(dt) {
  for (let i = 0; i < PARTICLE_MAX; i++) {
    if (pLife[i] <= 0) continue;
    pLife[i] -= dt;
    if (pLife[i] <= 0) {
      pPos[i * 3 + 1] = -100;
      continue;
    }
    const v = pVel[i];
    v.y -= 4.2 * dt;
    pPos[i * 3] += v.x * dt;
    pPos[i * 3 + 1] += v.y * dt;
    pPos[i * 3 + 2] += v.z * dt;
    if (pPos[i * 3 + 1] < 0.02) {
      pPos[i * 3 + 1] = 0.02;
      v.y = Math.abs(v.y) * 0.2;
      v.x *= 0.85;
      v.z *= 0.85;
    }
  }
  particles.geometry.attributes.position.needsUpdate = true;
  particles.geometry.attributes.color.needsUpdate = true;
}

function splashBurst(pos, amount = 1, color = '#eaf7f3') {
  for (let i = 0; i < 26 * amount; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.5 + Math.random() * 4.5;
    spawnParticle(
      pos.x + Math.cos(a) * 0.5,
      0.2 + Math.random() * 0.4,
      pos.z + Math.sin(a) * 0.5,
      Math.cos(a) * s,
      1.5 + Math.random() * 3,
      Math.sin(a) * s,
      color,
      0.7 + Math.random() * 0.6
    );
  }
}

function wakeTrail(boat, dt) {
  if (boat.speed < 3) return;
  const fx = Math.sin(boat.heading);
  const fz = Math.cos(boat.heading);
  const sx = Math.cos(boat.heading);
  const sz = -Math.sin(boat.heading);
  const rate = boat.speed * dt * 1.9;
  let n = Math.floor(rate) + (Math.random() < rate % 1 ? 1 : 0);
  n = Math.min(n, 5);
  for (let i = 0; i < n; i++) {
    const side = Math.random() > 0.5 ? 1 : -1;
    spawnParticle(
      boat.pos.x - fx * 2.7 + sx * side * 0.75,
      0.12,
      boat.pos.z - fz * 2.7 + sz * side * 0.75,
      -fx * 0.6 + sx * side * 1.1,
      0.7 + Math.random() * 0.7,
      -fz * 0.6 + sz * side * 1.1,
      '#f2fbf7',
      0.9 + Math.random() * 0.5
    );
  }
}

// ---------------------------------------------------------------- setup
function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1400);
  camera.position.set(18, 10, 58);
  camera.lookAt(0, 0, 20);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function buildBoats() {
  // player
  const playerBoat = createBoat({ trim: '#e2503c', flagColor: null });
  playerBoat.group.scale.setScalar(1.06);
  const p = {
    isPlayer: true,
    mesh: playerBoat.group,
    ...playerBoat,
    pos: new THREE.Vector3(),
    heading: 0,
    speed: 0,
    total: 0,
    lastU: 0,
    hint: -1,
    finishTime: 0,
    finished: false,
    phase: Math.random() * 10,
    boost: 100,
    baseSpeed: 20.9,
    lane: 2.8,
  };
  boats.push(p);
  player = p;

  AI_THEMES.forEach((theme, i) => {
    const b = createBoat({ trim: theme.trim, flagColor: theme.flag });
    b.group.scale.setScalar(1.0 + i * 0.015);
    const boat = {
      isPlayer: false,
      mesh: b.group,
      ...b,
      pos: new THREE.Vector3(),
      heading: 0,
      speed: 0,
      total: 0,
      lastU: 0,
      hint: -1,
      finishTime: 0,
      finished: false,
      phase: Math.random() * 10,
      baseSpeed: theme.base,
      lane: theme.lane,
    };
    boats.push(boat);
  });

  for (const b of boats) {
    b.mesh.traverse((child) => {
      if (child.isMesh) child.frustumCulled = false;
    });
    scene.add(b.mesh);
  }
}

function resetBoatState() {
  const slots = [
    { lat: -2.8, back: 8 },
    { lat: 2.8, back: 8 },
    { lat: -2.8, back: 15 },
    { lat: 2.8, back: 15 },
  ];
  // player uses the back-right slot; AI take the others
  const order = [player, boats[1], boats[2], boats[3]];
  const slotFor = [3, 0, 1, 2];
  for (let i = 0; i < order.length; i++) {
    const b = order[i];
    const slot = slots[slotFor[i]];
    const u = 1 - slot.back / world.track.length;
    const p = world.track.pointAt(u, slot.lat);
    const t = world.track.tangentAt(u);
    b.pos.set(p.x, 0, p.z);
    b.heading = Math.atan2(t.x, t.z);
    b.speed = 0;
    b.total = -slot.back / world.track.length;
    b.lastU = u;
    b.hint = world.track.nearest(b.pos).idx;
    b.finished = false;
    b.finishTime = 0;
    b.boost = 100;
    b.bumpCd = 0;
    b.lane = b.isPlayer ? slot.lat : b.lane;
    updateBoatTransform(b, elapsed, 0);
  }
  game.finishOrder = [];
  game.boostWasActive = false;
  world.resetLotus();
}

function placeCameraOrbit(time, focus, radius = 26, height = 9) {
  const a = time * 0.1 + 0.8;
  camera.position.x = damp(camera.position.x, focus.x + Math.cos(a) * radius, 2.2, 1 / 60);
  camera.position.z = damp(camera.position.z, focus.z + Math.sin(a) * radius, 2.2, 1 / 60);
  camera.position.y = damp(camera.position.y, focus.y + height, 2.2, 1 / 60);
}

// ---------------------------------------------------------------- physics
function steerInput() {
  return clamp(
    (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + (touchInput.right ? 1 : 0) - (touchInput.left ? 1 : 0),
    -1,
    1
  );
}

function updatePlayer(dt) {
  const steer = steerInput();
  const wantBoost = (keys.boost || touchInput.boost) && player.boost > 1;
  const maxSpeed = wantBoost ? 26.8 : player.baseSpeed;
  if (keys.brake) {
    player.speed = damp(player.speed, 5, 2.8, dt);
  } else {
    player.speed = damp(player.speed, maxSpeed, wantBoost ? 1.1 : 0.75, dt);
  }

  const turnRate = 1.42 * (0.42 + 0.58 * clamp(player.speed / 17, 0, 1));
  player.heading += steer * turnRate * dt;

  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  player.pos.x += fx * player.speed * dt;
  player.pos.z += fz * player.speed * dt;

  if (wantBoost) {
    player.boost = Math.max(0, player.boost - 31 * dt);
    if (!game.boostWasActive) {
      sfx.boost();
      splashBurst(player.pos, 1.4);
      game.shake = Math.max(game.shake, 0.16);
    }
    game.boostWasActive = true;
  } else {
    player.boost = Math.min(100, player.boost + 10.5 * dt);
    game.boostWasActive = false;
  }

  resolveBank(player, dt);
  updateProgress(player);

  if (world.collectLotus(player.pos, 2.7)) {
    player.boost = Math.min(100, player.boost + 35);
    sfx.collect();
    splashBurst(player.pos, 1.1, '#ffd76b');
    toast('পদ্ম! বুস্ট +৩৫');
  }

  if (player.total >= 1 && player.total < 1.02) {
    toast('শেষ ল্যাপ! শেষবারের মতো টানো');
    sfx.beep(true);
  }
  if (player.total < -0.06) {
    player.total = -0.06;
  }

  if (player.total >= LAPS && !player.finished) {
    finishBoat(player);
  }

  player.mesh.position.set(player.pos.x, 0, player.pos.z);
}

function resolveBank(b, dt) {
  const near = world.track.nearest(b.pos, b.hint);
  const hw = world.track.halfWidth(near.u);
  const limit = hw - 0.9;
  if (near.dist > limit) {
    const center = world.track.pointAt(near.u, 0, tmpV);
    let nx = b.pos.x - center.x;
    let nz = b.pos.z - center.z;
    const len = Math.hypot(nx, nz) || 1;
    nx /= len;
    nz /= len;
    b.pos.x = center.x + nx * limit;
    b.pos.z = center.z + nz * limit;

    const fx = Math.sin(b.heading);
    const fz = Math.cos(b.heading);
    const outward = fx * nx + fz * nz;
    if (outward > 0.05) {
      // slide along the bank instead of stopping dead in the water
      const t = world.track.tangentAt(near.u, tmpV2);
      const dir = fx * t.x + fz * t.z >= 0 ? 1 : -1;
      const along = Math.atan2(t.x * dir, t.z * dir);
      b.heading += angleDiff(b.heading, along) * clamp(outward * 2.6, 0, 0.5) * 0.35;
      b.speed *= 1 - clamp(outward, 0, 1) * 0.55;
    }

    b.bumpCd = (b.bumpCd || 0) - dt;
    if (b.bumpCd <= 0 && b.isPlayer && outward > 0.2 && b.speed > 4) {
      b.bumpCd = 0.7;
      game.shake = Math.max(game.shake, clamp(b.speed * 0.02, 0.15, 0.45));
      sfx.bump();
      splashBurst(b.pos, 1.2);
      toast('ধাক্কা! নৌকা সামলাও');
    }
  }
}

function updateProgress(b) {
  const near = world.track.nearest(b.pos, b.hint);
  let du = near.u - b.lastU;
  if (du > 0.5) du -= 1;
  if (du < -0.5) du += 1;
  b.hint = near.idx;
  b.lastU = near.u;
  b.total += du;
  b.lateral = near.dist;
}

function updateAI(b, dt, time) {
  if (b.finished) {
    b.speed = damp(b.speed, 2, 0.8, dt);
  } else {
    const gap = player.total - b.total;
    const rubber = clamp(gap * 3.0, -1.5, 1.8);
    const target = b.baseSpeed + rubber;
    b.speed = damp(b.speed, target, 0.9, dt);
  }
  const lane = b.lane + Math.sin(time * 0.32 + b.phase) * 1.7;
  const lookAhead = (9 + b.speed * 0.55) / world.track.length;
  const targetPos = world.track.pointAt(b.lastU + lookAhead, lane, tmpV2);
  const desired = Math.atan2(targetPos.x - b.pos.x, targetPos.z - b.pos.z);
  const diff = angleDiff(b.heading, desired);
  b.heading += clamp(diff, -2.0 * dt, 2.0 * dt);
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  b.pos.x += fx * b.speed * dt;
  b.pos.z += fz * b.speed * dt;
  if (!b.finished) {
    resolveBank(b, dt);
    updateProgress(b);
    if (b.total >= LAPS) finishBoat(b);
  }
}

function finishBoat(b) {
  if (b.finished) return;
  b.finished = true;
  b.finishTime = game.raceTime;
  game.finishOrder.push(b);
  if (b.isPlayer) {
    endRace();
  }
}

function endRace() {
  if (game.state === 'finished') return;
  game.state = 'finished';
  const place = game.finishOrder.indexOf(player) + 1;
  const isBest = !game.best || game.raceTime < game.best;
  if (isBest) {
    game.best = game.raceTime;
    localStorage.setItem('nouka-best', String(game.raceTime));
  }
  sfx.finish(place === 1);
  updateBestLabel();
  showResults(place, game.raceTime, isBest);
}

// ---------------------------------------------------------------- visuals
function updateBoatTransform(b, time, dt) {
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  const sx = Math.cos(b.heading);
  const sz = -Math.sin(b.heading);
  const hFront = waveHeight(b.pos.x + fx * 2.4, b.pos.z + fz * 2.4, time);
  const hBack = waveHeight(b.pos.x - fx * 2.4, b.pos.z - fz * 2.4, time);
  const hRight = waveHeight(b.pos.x + sx * 0.9, b.pos.z + sz * 0.9, time);
  const hLeft = waveHeight(b.pos.x - sx * 0.9, b.pos.z - sz * 0.9, time);
  const y = (hFront + hBack) * 0.5 + 0.13;
  b.mesh.position.set(b.pos.x, y, b.pos.z);
  b.mesh.rotation.order = 'YXZ';
  b.mesh.rotation.y = b.heading;
  b.mesh.rotation.x = -Math.atan2(hFront - hBack, 4.8) * 1.15;
  b.mesh.rotation.z = Math.atan2(hRight - hLeft, 1.8) * 0.95;
  b.speed = b.speed;
  updateBoatVisual(b, time);
}

function updateCameraChase(dt, boosting) {
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  const back = 11.5 + player.speed * 0.13;
  const height = waveHeight(player.pos.x, player.pos.z, elapsed) + 4.9 + player.speed * 0.05;
  tmpV.set(player.pos.x - fx * back, height, player.pos.z - fz * back);
  const k = 4.2;
  camera.position.x = damp(camera.position.x, tmpV.x, k, dt);
  camera.position.y = damp(camera.position.y, tmpV.y, k, dt);
  camera.position.z = damp(camera.position.z, tmpV.z, k, dt);
  cameraTarget.set(player.pos.x + fx * 11, 2.1 + player.speed * 0.02, player.pos.z + fz * 11);
  camLook.x = damp(camLook.x, cameraTarget.x, 7, dt);
  camLook.y = damp(camLook.y, cameraTarget.y, 7, dt);
  camLook.z = damp(camLook.z, cameraTarget.z, 7, dt);
  camera.lookAt(camLook);
  const fov = boosting ? 70 : 60 + clamp(player.speed, 0, 26) * 0.18;
  camera.fov = damp(camera.fov, fov, 3, dt);
  camera.updateProjectionMatrix();

  if (game.shake > 0.001) {
    const s = game.shake;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s * 0.6;
    camera.position.z += (Math.random() - 0.5) * s;
    game.shake = Math.max(0, game.shake - dt * 1.8);
  }
}

function updateCameraMenu(dt) {
  const t = world.track.tangentAt(0, tmpV);
  const sideX = t.z;
  const sideZ = -t.x;
  const start = world.track.pointAt(0, 0, tmpV2);
  const drift = Math.sin(elapsed * 0.16) * 3.2;
  const camX = start.x - t.x * 26 + sideX * (11 + drift);
  const camZ = start.z - t.z * 26 + sideZ * (11 + drift);
  camera.position.x = damp(camera.position.x, camX, 1.8, dt);
  camera.position.y = damp(camera.position.y, 14.5, 1.8, dt);
  camera.position.z = damp(camera.position.z, camZ, 1.8, dt);
  const lookX = start.x + t.x * 18;
  const lookZ = start.z + t.z * 18;
  camLook.x = damp(camLook.x, lookX, 3, dt);
  camLook.y = damp(camLook.y, 2.6, 3, dt);
  camLook.z = damp(camLook.z, lookZ, 3, dt);
  camera.lookAt(camLook);
  camera.fov = damp(camera.fov, 58, 3, dt);
  camera.updateProjectionMatrix();
}

function updateCameraFinish(dt) {
  const focus = player.pos;
  const a = elapsed * 0.22;
  tmpV.set(focus.x + Math.cos(a) * 15, 5.2 + Math.sin(elapsed * 0.4) * 0.6, focus.z + Math.sin(a) * 15);
  camera.position.x = damp(camera.position.x, tmpV.x, 1.8, dt);
  camera.position.y = damp(camera.position.y, tmpV.y, 1.8, dt);
  camera.position.z = damp(camera.position.z, tmpV.z, 1.8, dt);
  camLook.set(focus.x, 1.4, focus.z);
  camera.lookAt(camLook);
  camera.fov = damp(camera.fov, 58, 3, dt);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- UI
let toastTimeout = 0;
function toast(message, duration = 1.8) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  game.toastTimer = duration;
}

function hideToast() {
  toastEl.classList.remove('show');
}

function showCountdownText(text, isGo = false) {
  countdownEl.textContent = text;
  countdownEl.classList.remove('pop');
  countdownEl.classList.toggle('go', isGo);
  void countdownEl.offsetWidth;
  countdownEl.classList.add('pop');
}

function ordinal(n) {
  return ORDINALS[clamp(n - 1, 0, 3)];
}

function updateHUD() {
  const lap = clamp(Math.floor(player.total) + 1, 1, LAPS);
  lapEl.textContent = `${bn(lap)}/২`;
  const sorted = [...boats].sort((a, b) => b.total - a.total);
  const place = sorted.indexOf(player) + 1;
  placeEl.textContent = ordinal(place);
  timerEl.textContent = bn(formatTime(game.raceTime));
  speedEl.textContent = bn(Math.round(clamp(player.speed / 26.8, 0, 1) * 99));
  const pct = Math.round(player.boost);
  boostPctEl.textContent = `${bn(pct)}%`;
  boostFillEl.style.transform = `scaleX(${pct / 100})`;
  boostWrap.classList.toggle('low', pct < 25);
}

function updateBestLabel() {
  bestTimeEl.textContent = game.best ? bn(formatTime(game.best)) : '—';
}

function showResults(place, time, isBest) {
  const titles = ['চ্যাম্পিয়ন!', 'দুর্দান্ত দ্বিতীয়!', 'তৃতীয় স্থান', 'চতুর্থ স্থান'];
  const notes = [
    'নদী তোমার নাম মনে রাখবে। চ্যাম্পিয়ন হয়ে তুমি ফিরলে গ্রামে!',
    'মাত্র এক নৌকা এগিয়ে ছিল। আরেকবার প্যাডেল চালাও!',
    'বাঁকে গতি কমাও, পদ্ম ফুল কুড়াও—তৃতীয় থেকে আরও উপরে ওঠা যায়।',
    'হাল ধরে রাখো, বুস্ট সঠিক সময়ে চাপো। আরেকবার চেষ্টা করো!',
  ];
  document.getElementById('resultPlace').textContent = ordinal(place);
  document.getElementById('resultEyebrow').textContent = isBest ? 'নতুন সেরা সময়' : 'দৌড় শেষ';
  document.getElementById('resultTitle').textContent = titles[place - 1];
  document.getElementById('resultPos').textContent = `${ordinal(place)} / ৪`;
  document.getElementById('resultTime').textContent = bn(formatTime(time));
  document.getElementById('resultBest').textContent = game.best ? bn(formatTime(game.best)) : '—';
  document.getElementById('resultNote').textContent = isBest && place !== 1
    ? `নতুন সেরা সময়! ${notes[place - 1]}`
    : notes[place - 1];
  resultsEl.classList.remove('hidden');
}

// ---------------------------------------------------------------- minimap
const mapBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
let mapScale = 1;
let mapOffX = 0;
let mapOffY = 0;

function buildMinimap() {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of world.track.samples) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  mapBounds.minX = minX;
  mapBounds.maxX = maxX;
  mapBounds.minZ = minZ;
  mapBounds.maxZ = maxZ;
  const pad = 20;
  const w = minimap.width;
  const h = minimap.height;
  mapScale = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxZ - minZ));
  mapOffX = (w - (maxX - minX) * mapScale) / 2;
  mapOffY = (h - (maxZ - minZ) * mapScale) / 2;
}

function mapPoint(x, z) {
  return [mapOffX + (x - mapBounds.minX) * mapScale, mapOffY + (z - mapBounds.minZ) * mapScale];
}

function drawMinimap() {
  const ctx = mmCtx;
  ctx.clearRect(0, 0, minimap.width, minimap.height);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const pts = world.track.samples;
  for (const [width, color] of [[18, 'rgba(8, 44, 38, 0.9)'], [13, '#116b5b'], [13, 'rgba(46, 155, 118, 0.5)']]) {
    ctx.beginPath();
    for (let i = 0; i <= pts.length; i += 5) {
      const p = pts[i % pts.length];
      const [x, y] = mapPoint(p.x, p.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  // start line
  const start = world.track.pointAt(0);
  const st = world.track.tangentAt(0);
  const [sx, sy] = mapPoint(start.x, start.z);
  ctx.beginPath();
  ctx.moveTo(sx - st.z * 7, sy + st.x * 7);
  ctx.lineTo(sx + st.z * 7, sy - st.x * 7);
  ctx.strokeStyle = '#ffe0a0';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  for (const b of boats) {
    if (b.isPlayer) continue;
    const [x, y] = mapPoint(b.pos.x, b.pos.z);
    ctx.beginPath();
    ctx.arc(x, y, 4.4, 0, Math.PI * 2);
    ctx.fillStyle = b === boats[1] ? '#4fd39b' : b === boats[2] ? '#6bb4ef' : '#ef8bc0';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(4,28,24,0.75)';
    ctx.stroke();
  }
  const [px, py] = mapPoint(player.pos.x, player.pos.z);
  const fx = Math.sin(player.heading);
  const fz = Math.cos(player.heading);
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(fz, fx) + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(6, 6);
  ctx.lineTo(0, 3);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fillStyle = '#ff6a4f';
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#fff4dd';
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- audio & input
function syncMuteUI() {
  muteBtn.classList.toggle('muted', sfx.muted);
  soundBtn.textContent = sfx.muted ? 'সাউন্ড চালু' : 'সাউন্ড বন্ধ';
}

function toggleMute() {
  sfx.init();
  sfx.toggleMute();
  syncMuteUI();
}

window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'].includes(e.key)) e.preventDefault();
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': keys.left = true; break;
    case 'ArrowRight': case 'd': case 'D': keys.right = true; break;
    case 'ArrowDown': case 's': case 'S': keys.brake = true; break;
    case 'ArrowUp': case 'w': case 'W': break;
    case ' ': case 'Spacebar': case 'Shift': keys.boost = true; break;
    case 'p': case 'P': case 'Escape':
      if (game.state === 'racing') pauseGame();
      else if (game.state === 'paused') resumeGame();
      break;
    case 'm': case 'M': toggleMute(); break;
    case 'Enter':
      if (game.state === 'menu') startRace();
      else if (game.state === 'finished') restartRace();
      break;
    case 'r': case 'R':
      if (game.state === 'racing' || game.state === 'finished' || game.state === 'paused') restartRace();
      break;
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': keys.left = false; break;
    case 'ArrowRight': case 'd': case 'D': keys.right = false; break;
    case 'ArrowDown': case 's': case 'S': keys.brake = false; break;
    case ' ': case 'Spacebar': case 'Shift': keys.boost = false; break;
  }
});
window.addEventListener('blur', () => {
  keys.left = keys.right = keys.brake = keys.boost = false;
  if (game.state === 'racing') pauseGame();
});

function bindTouchHold(button, prop, state = touchInput) {
  const on = (e) => {
    e.preventDefault();
    state[prop] = true;
    button.classList.add('active');
  };
  const off = (e) => {
    e.preventDefault();
    state[prop] = false;
    button.classList.remove('active');
  };
  button.addEventListener('pointerdown', on);
  button.addEventListener('pointerup', off);
  button.addEventListener('pointercancel', off);
  button.addEventListener('pointerleave', off);
  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

bindTouchHold(document.getElementById('leftBtn'), 'left');
bindTouchHold(document.getElementById('rightBtn'), 'right');
bindTouchHold(document.getElementById('boostBtn'), 'boost');

document.getElementById('startBtn').addEventListener('click', () => {
  sfx.init();
  startRace();
});
document.getElementById('againBtn').addEventListener('click', () => restartRace());
document.getElementById('resumeBtn').addEventListener('click', () => resumeGame());
document.getElementById('restartBtn').addEventListener('click', () => restartRace());
document.getElementById('homeBtn').addEventListener('click', () => goHome());
document.getElementById('menuBtn').addEventListener('click', () => goHome());
document.getElementById('pauseBtn').addEventListener('click', () => {
  if (game.state === 'racing') pauseGame();
  else if (game.state === 'paused') resumeGame();
});
muteBtn.addEventListener('click', toggleMute);
soundBtn.addEventListener('click', toggleMute);

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'racing') pauseGame();
});

function startRace() {
  menuEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  resetBoatState();
  game.state = 'countdown';
  game.countdown = 3;
  game.lastCount = null;
  game.raceTime = 0;
  game.shake = 0;
  hideToast();
  updateBestLabel();
  updateHUD();
  camLook.copy(player.pos);
  camera.position.set(player.pos.x - Math.sin(player.heading) * 12, 6, player.pos.z - Math.cos(player.heading) * 12);
}

function restartRace() {
  sfx.init();
  startRace();
}

function pauseGame() {
  if (game.state !== 'racing') return;
  game.state = 'paused';
  pauseEl.classList.remove('hidden');
  keys.left = keys.right = keys.brake = keys.boost = false;
  touchInput.left = touchInput.right = touchInput.boost = false;
}

function resumeGame() {
  if (game.state !== 'paused') return;
  game.state = 'racing';
  pauseEl.classList.add('hidden');
  lastFrame = performance.now();
}

function goHome() {
  game.state = 'menu';
  hudEl.classList.add('hidden');
  resultsEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
  resetBoatState();
  updateBestLabel();
  camLook.copy(world.track.pointAt(0.99));
  camLook.y = 1.5;
}

// ---------------------------------------------------------------- loop
function update(dt) {
  const time = elapsed;
  world.update(time, dt);
  updateParticles(dt);
  if (game.toastTimer > 0) {
    game.toastTimer -= dt;
    if (game.toastTimer <= 0) hideToast();
  }

  if (game.state === 'menu') {
    for (const b of boats) {
      updateBoatTransform(b, time, dt);
    }
    updateCameraMenu(dt);
  } else if (game.state === 'countdown') {
    game.countdown -= dt;
    const count = Math.max(1, Math.ceil(game.countdown));
    if (game.countdown > 0 && count !== game.lastCount) {
      game.lastCount = count;
      showCountdownText(bn(count));
      sfx.beep(false);
    }
    for (const b of boats) updateBoatTransform(b, time, dt);
    updateCameraChase(dt, false);
    if (game.countdown <= 0) {
      game.state = 'racing';
      showCountdownText('যাও!', true);
      sfx.horn();
      countdownEl.classList.remove('go');
      game.raceTime = 0;
    }
  } else if (game.state === 'racing') {
    game.raceTime += dt;
    updatePlayer(dt);
    for (const b of boats) {
      if (!b.isPlayer) updateAI(b, dt, time);
    }
    for (const b of boats) {
      updateBoatTransform(b, time, dt);
      wakeTrail(b, dt);
    }
    updateCameraChase(dt, keys.boost || touchInput.boost);
    updateHUD();

    oarTimer -= dt;
    if (oarTimer <= 0 && player.speed > 3) {
      sfx.oar();
      oarTimer = 0.75 + Math.random() * 0.22;
    }
    birdTimer -= dt;
    if (birdTimer <= 0) {
      sfx.bird();
      birdTimer = 7 + Math.random() * 10;
    }
  } else if (game.state === 'finished') {
    for (const b of boats) {
      if (!b.isPlayer && !b.finished) updateAI(b, dt, time);
      updateBoatTransform(b, time, dt);
    }
    updateCameraFinish(dt);
  } else if (game.state === 'paused') {
    for (const b of boats) updateBoatTransform(b, time, dt);
  }

  drawMinimap();
}

function loop(now) {
  raf = requestAnimationFrame(loop);
  if (!lastFrame) lastFrame = now;
  let dt = (now - lastFrame) / 1000;
  lastFrame = now;
  if (dt > 0.05) dt = 0.05;
  elapsed += dt;
  update(dt);
  renderer.render(scene, camera);
}

async function boot() {
  try {
    await Promise.allSettled([
      document.fonts.load('800 64px "Baloo Da 2"'),
      document.fonts.load('600 24px "Noto Sans Bengali"'),
    ]);
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1600))]);
  } catch (err) {
    // fonts are optional; continue with fallbacks
  }

  try {
    setupRenderer();
  } catch (err) {
    loadingEl.innerHTML = '<p>দুঃখিত, এই ব্রাউজারে ৩ডি চালু হলো না।</p><small>WebGL সমর্থিত ব্রাউজার ব্যবহার করো।</small>';
    return;
  }

  world = createWorld(scene);
  initParticles();
  buildBoats();
  resetBoatState();
  buildMinimap();
  updateBestLabel();
  syncMuteUI();
  camLook.copy(world.track.pointAt(0.99));
  camLook.y = 1.5;

  game.state = 'menu';
  window.__nouka = {
    game, boats, player, world, camera, keys, touchInput,
    advance(seconds, render = true) {
      const steps = Math.max(1, Math.ceil(seconds / 0.05));
      for (let i = 0; i < steps; i++) {
        elapsed += 0.05;
        update(0.05);
      }
      if (render) renderer.render(scene, camera);
      return { state: game.state, time: +game.raceTime.toFixed(2), total: +player.total.toFixed(3), place: [...boats].sort((a, b) => b.total - a.total).indexOf(player) + 1 };
    },
  };
  loadingEl.style.opacity = '0';
  setTimeout(() => loadingEl.classList.add('hidden'), 520);
  raf = requestAnimationFrame(loop);
}

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
});

boot();
