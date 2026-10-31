import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';
import { World, LANES } from './world.js';
import { createRickshaw } from './rickshaw.js';
import { GameAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

const els = {
  scene: $('scene'),
  hud: $('hud'),
  score: $('score'),
  distance: $('distance'),
  hudBest: $('hudBest'),
  progressBar: $('progressBar'),
  combo: $('combo'),
  boostWrap: $('boostWrap'),
  boostFill: $('boostFill'),
  boostHint: $('boostHint'),
  touch: $('touchControls'),
  toastLayer: $('toastLayer'),
  start: $('startScreen'),
  startBest: $('startBest'),
  how: $('howScreen'),
  pause: $('pauseScreen'),
  over: $('overScreen'),
  loader: $('loader'),
  pauseScore: $('pauseScore'),
  pauseDistance: $('pauseDistance'),
  finalScore: $('finalScore'),
  finalDistance: $('finalDistance'),
  finalMangoes: $('finalMangoes'),
  finalBest: $('finalBest'),
  newBest: $('newBest'),
  overKicker: $('overKicker'),
  overTitle: $('overTitle'),
};

const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');

const LOW_POWER = isTouch || window.innerWidth < 760;
const BEST_KEY = 'dhaka-dash-best';
const MUTE_KEY = 'dhaka-dash-muted';

const state = {
  mode: 'loading',
  score: 0,
  distance: 0,
  mangoes: 0,
  combo: 0,
  comboTimer: 0,
  boost: 0,
  boostTime: 0,
  boosting: false,
  speed: 16,
  lane: 1,
  x: 0,
  y: 0,
  vy: 0,
  grounded: true,
  ducking: false,
  duckHeld: false,
  duckUntil: 0,
  lean: 0,
  shake: 0,
  crashTimer: 0,
  time: 0,
  best: Number(localStorage.getItem(BEST_KEY) || 0) || 0,
  muted: localStorage.getItem(MUTE_KEY) === '1',
  scoreAcc: 0,
  menuTrafficTimer: 0,
  overTimer: 0,
};

const audio = new GameAudio();
audio.muted = state.muted;
if (state.muted) document.body.classList.add('muted');

let renderer;
let camera;
let scene;
let composer;
let bloomPass;
let world;
let rickshaw;
let clock;
const cameraTarget = new THREE.Vector3(0, 1.4, -12);
const desiredCam = new THREE.Vector3();
const lookAt = new THREE.Vector3();

const callbacks = {
  onCollect: (mango) => collectMango(mango),
  onHit: (obstacle) => handleHit(obstacle),
  onNearMiss: () => handleNearMiss(),
};

function boot() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW_POWER ? 1.4 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  els.scene.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 520);
  camera.position.set(-5.7, 3.2, 8.4);

  world = new World(scene, { quality: LOW_POWER ? 'low' : 'high', callbacks });
  rickshaw = createRickshaw();
  scene.add(rickshaw.root);

  composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), LOW_POWER ? 0.4 : 0.52, 0.68, 0.86);
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  clock = new THREE.Clock();
  window.addEventListener('resize', resize);
  bindUI();
  bindInput();
  resize();
  updateBestUI();

  // first frame
  camera.lookAt(0.8, 1.4, -2);
  composer.render();
  els.loader.classList.add('done');
  state.mode = 'menu';
  showScreen('start');
  requestAnimationFrame(loop);
}

function resize() {
  if (!renderer) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}

/* --------------------------------------------------------------------- UI */

function showScreen(name) {
  els.start.classList.toggle('is-hidden', name !== 'start');
  els.how.classList.toggle('is-hidden', name !== 'how');
  els.pause.classList.toggle('is-hidden', name !== 'pause');
  els.over.classList.toggle('is-hidden', name !== 'over');
}

function setHud(visible) {
  els.hud.classList.toggle('is-hidden', !visible);
  els.boostWrap.classList.toggle('is-hidden', !visible);
  els.touch.classList.toggle('is-hidden', !visible);
}

function updateBestUI() {
  els.startBest.textContent = state.best;
  els.hudBest.textContent = state.best;
  els.finalBest.textContent = state.best;
}

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`.trim();
  el.textContent = text;
  els.toastLayer.appendChild(el);
  setTimeout(() => el.remove(), 1600);
}

let lastHud = { score: -1, distance: -1, best: -1, boost: -1, combo: -1 };

function updateHud() {
  const score = Math.floor(state.score);
  if (score !== lastHud.score) {
    els.score.textContent = score.toLocaleString('en-US');
    lastHud.score = score;
  }
  const distance = Math.floor(state.distance);
  if (distance !== lastHud.distance) {
    els.distance.textContent = distance.toLocaleString('en-US');
    els.progressBar.style.width = `${Math.min(100, ((state.speed - 16) / 22) * 100)}%`;
    lastHud.distance = distance;
  }
  if (state.best !== lastHud.best) {
    els.hudBest.textContent = state.best;
    lastHud.best = state.best;
  }
  const boostPct = Math.round(state.boost * 100);
  if (boostPct !== lastHud.boost) {
    els.boostFill.style.width = `${boostPct}%`;
    els.boostWrap.classList.toggle('full', state.boost >= 0.999 && !state.boosting);
    lastHud.boost = boostPct;
  }
  if (state.boosting) {
    els.boostHint.textContent = 'বুস্টিং!';
  } else if (state.boost >= 0.999) {
    els.boostHint.textContent = 'DASH!';
  } else {
    els.boostHint.textContent = 'DASH';
  }
  const combo = state.combo;
  if (combo !== lastHud.combo) {
    els.combo.textContent = combo > 1 ? `x${combo}` : '';
    els.combo.classList.toggle('show', combo > 1 && state.comboTimer > 0);
    lastHud.combo = combo;
  }
}

/* ------------------------------------------------------------------ input */

function bindUI() {
  $('playBtn').addEventListener('click', () => {
    audio.init();
    audio.ui();
    startGame();
  });
  $('howBtn').addEventListener('click', () => {
    audio.ui();
    state.mode = 'how';
    showScreen('how');
  });
  $('howClose').addEventListener('click', () => {
    audio.ui();
    state.mode = 'menu';
    showScreen('start');
  });
  $('pauseBtn').addEventListener('click', () => {
    audio.ui();
    pauseGame();
  });
  $('resumeBtn').addEventListener('click', () => {
    audio.ui();
    resumeGame();
  });
  $('pauseHomeBtn').addEventListener('click', () => {
    audio.ui();
    goMenu();
  });
  $('retryBtn').addEventListener('click', () => {
    audio.ui();
    startGame();
  });
  $('homeBtn').addEventListener('click', () => {
    audio.ui();
    goMenu();
  });
  $('muteBtn').addEventListener('click', toggleMute);

  for (const btn of document.querySelectorAll('[data-action]')) {
    const action = btn.dataset.action;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      audio.init();
      if (action === 'left') moveLane(-1);
      else if (action === 'right') moveLane(1);
      else if (action === 'jump') jump();
      else if (action === 'dash') activateBoost();
      else if (action === 'duck') state.duckHeld = true;
    });
    const release = (e) => {
      if (action === 'duck') state.duckHeld = false;
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  }
}

function bindInput() {
  window.addEventListener('keydown', (e) => {
    const key = e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Spacebar'].includes(key)) e.preventDefault();
    if (e.repeat) return;

    if (key === 'm' || key === 'M') { toggleMute(); return; }

    if (state.mode === 'menu') {
      if (key === ' ' || key === 'Enter') { audio.init(); startGame(); }
      return;
    }
    if (state.mode === 'how') {
      if (key === 'Escape' || key === ' ' || key === 'Enter') {
        state.mode = 'menu';
        showScreen('start');
      }
      return;
    }
    if (state.mode === 'over') {
      if (key === ' ' || key === 'Enter') { audio.init(); startGame(); }
      return;
    }
    if (state.mode === 'paused') {
      if (key === 'p' || key === 'P' || key === 'Escape' || key === ' ') resumeGame();
      return;
    }
    if (state.mode !== 'playing') return;

    if (key === 'ArrowLeft' || key === 'a' || key === 'A') moveLane(-1);
    else if (key === 'ArrowRight' || key === 'd' || key === 'D') moveLane(1);
    else if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === ' ') jump();
    else if (key === 'ArrowDown' || key === 's' || key === 'S') state.duckHeld = true;
    else if (key === 'Shift') activateBoost();
    else if (key === 'p' || key === 'P' || key === 'Escape') pauseGame();
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') state.duckHeld = false;
  });

  const sceneEl = els.scene;
  let pointer = null;
  sceneEl.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'playing') return;
    pointer = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  const end = (e) => {
    if (!pointer) return;
    const dx = e.clientX - pointer.x;
    const dy = e.clientY - pointer.y;
    const dt = performance.now() - pointer.t;
    pointer = null;
    if (state.mode !== 'playing') return;
    if (Math.abs(dx) < 26 && Math.abs(dy) < 26 && dt < 400) {
      jump();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      moveLane(dx > 0 ? 1 : -1);
    } else if (dy < 0) {
      jump();
    } else {
      duckPulse();
    }
  };
  sceneEl.addEventListener('pointerup', end);
  sceneEl.addEventListener('pointercancel', () => { pointer = null; });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') pauseGame();
  });
}

function duckPulse() {
  state.duckUntil = performance.now() + 700;
}

function toggleMute() {
  state.muted = !state.muted;
  document.body.classList.toggle('muted', state.muted);
  localStorage.setItem(MUTE_KEY, state.muted ? '1' : '0');
  audio.setMuted(state.muted);
  if (!state.muted) audio.init();
}

/* --------------------------------------------------------------- gameplay */

function moveLane(dir) {
  if (state.mode !== 'playing') return;
  const next = Math.max(0, Math.min(2, state.lane + dir));
  if (next === state.lane) return;
  state.lane = next;
  audio.blip(300 + next * 60, 0.05, 'sine', 0.03);
}

function jump() {
  if (state.mode !== 'playing' || !state.grounded) return;
  state.vy = 8.6;
  state.grounded = false;
  state.ducking = false;
  state.duckHeld = false;
  state.duckUntil = 0;
  audio.jump();
  world.burst(state.x, 0.15, 0.6, 0xd9b48a, 10, 2.6);
}

function activateBoost() {
  if (state.mode !== 'playing') return;
  if (state.boost < 0.999 || state.boosting) return;
  state.boosting = true;
  state.boostTime = 4.4;
  state.boost = 1;
  document.body.classList.add('boosting');
  audio.dash();
  world.burst(state.x, 1, 0, 0x26d3b4, 26, 6);
  toast('চা-বুস্ট! ধোঁয়া তুলুন', 'hot');
  state.shake = 0.35;
}

function collectMango() {
  state.mangoes += 1;
  state.combo = Math.min(12, state.combo + 1);
  state.comboTimer = 2.2;
  const points = 25 * state.combo * (state.boosting ? 2 : 1);
  state.score += points;
  if (!state.boosting) state.boost = Math.min(1, state.boost + 0.145);
  audio.collect(state.combo);
  if (state.boost >= 0.999 && !state.boosting && !collectMango.announced) {
    collectMango.announced = true;
    toast('চা-বুস্ট প্রস্তুত — Shift চাপুন', 'good');
    setTimeout(() => { collectMango.announced = false; }, 5000);
  }
}

function handleNearMiss() {
  state.combo = Math.min(12, state.combo + 1);
  state.comboTimer = 2.2;
  state.score += 12;
  audio.nearMiss();
  if (Math.random() < 0.35) toast('নিয়ার মিস! +12', 'good');
}

function handleHit(obstacle) {
  if (state.mode !== 'playing') return;
  if (state.boosting) {
    state.score += 100;
    state.shake = Math.max(state.shake, 0.45);
    world.destroyObstacle(obstacle);
    world.burst(obstacle.x, 1.1, obstacle.z, 0xff7a3a, 26, 8);
    audio.nearMiss();
    toast('ধুম! +100', 'hot');
    return;
  }
  crash(obstacle);
}

function crash(obstacle) {
  if (state.mode !== 'playing') return;
  state.mode = 'crash';
  state.crashTimer = 0;
  state.boosting = false;
  state.ducking = false;
  state.duckHeld = false;
  state.duckUntil = 0;
  document.body.classList.remove('boosting');
  document.body.classList.add('crash');
  setTimeout(() => document.body.classList.remove('crash'), 700);
  state.shake = 1;
  audio.crash();
  const x = obstacle?.x ?? state.x;
  const z = obstacle?.z ?? 0;
  world.burst(x, 1.2, z, 0xff6a2e, 32, 9);
  world.burst(x, 0.6, z, 0xffcf6e, 18, 6);
  world.burst(state.x, 1, 0.8, 0x6b4a3a, 20, 5);
  setHud(false);
  if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
}

function gameOver() {
  state.mode = 'over';
  state.overTimer = 0;
  setHud(false);
  const score = Math.floor(state.score);
  const isBest = score > state.best;
  if (isBest) {
    state.best = score;
    localStorage.setItem(BEST_KEY, String(state.best));
  }
  els.finalScore.textContent = score.toLocaleString('en-US');
  els.finalDistance.textContent = Math.floor(state.distance).toLocaleString('en-US');
  els.finalMangoes.textContent = state.mangoes;
  els.finalBest.textContent = state.best;
  els.newBest.classList.toggle('is-hidden', !isBest);
  els.overKicker.textContent = 'খেলা শেষ';
  els.overTitle.textContent = isBest ? 'দুর্দান্ত ছুট!' : 'দুর্ঘটনা';
  updateBestUI();
  showScreen('over');
  audio.gameOver();
  audio.setEngine(0, false, false);
}

function startGame() {
  state.mode = 'playing';
  state.score = 0;
  state.scoreAcc = 0;
  state.distance = 0;
  state.mangoes = 0;
  state.combo = 0;
  state.comboTimer = 0;
  state.boost = 0;
  state.boostTime = 0;
  state.boosting = false;
  state.speed = 16;
  state.lane = 1;
  state.x = 0;
  state.y = 0;
  state.vy = 0;
  state.grounded = true;
  state.ducking = false;
  state.duckHeld = false;
  state.duckUntil = 0;
  state.lean = 0;
  state.shake = 0;
  state.crashTimer = 0;
  state.overTimer = 0;
  collectMango.announced = false;
  lastHud = { score: -1, distance: -1, best: -1, boost: -1, combo: -1 };
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  document.body.classList.remove('boosting', 'crash');
  rickshaw.root.position.set(0, 0, 0);
  rickshaw.root.rotation.set(0, 0, 0);
  world.reset();
  showScreen(null);
  setHud(true);
  updateHud();
  cameraTarget.set(0, 1.4, -12);
  audio.init();
  audio.start();
  audio.setEngine(16, true, false);
  setTimeout(() => { if (state.mode === 'playing') toast('← → লেন বদলান · ↑ লাফ · ↓ ঝুঁকুন'); }, 700);
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  els.pauseScore.textContent = Math.floor(state.score).toLocaleString('en-US');
  els.pauseDistance.textContent = Math.floor(state.distance).toLocaleString('en-US');
  showScreen('pause');
  els.touch.classList.add('is-hidden');
  audio.setEngine(0, false, false);
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  showScreen(null);
  els.touch.classList.remove('is-hidden');
  audio.init();
  audio.setEngine(state.speed, true, state.boosting);
}

function goMenu() {
  state.mode = 'menu';
  state.boosting = false;
  state.ducking = false;
  state.duckHeld = false;
  state.duckUntil = 0;
  state.boost = 0;
  state.y = 0;
  state.vy = 0;
  state.grounded = true;
  state.crashTimer = 0;
  document.body.classList.remove('boosting', 'crash');
  world.reset();
  // clear the starting obstacles so the hero shot is clean
  for (const o of [...world.obstacles]) world.destroyObstacle(o);
  rickshaw.root.position.set(0, 0, 0);
  rickshaw.root.rotation.set(0, 0, 0);
  rickshaw.body.rotation.set(0, 0, 0);
  showScreen('start');
  setHud(false);
  updateBestUI();
  audio.setEngine(0, false, false);
  cameraTarget.set(0.8, 1.4, -2);
}

/* ------------------------------------------------------------------- loop */

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  state.time += dt;
  update(dt);
  composer.render();
}

function update(dt) {
  const menu = state.mode === 'menu' || state.mode === 'how';
  const playing = state.mode === 'playing';
  const crashing = state.mode === 'crash';
  const paused = state.mode === 'paused';

  if (paused) {
    return;
  }

  let speed = state.speed;
  if (playing) {
    const target = 16 + Math.min(22, state.distance * 0.026);
    state.speed += (target - state.speed) * Math.min(1, dt * 0.8);
    speed = state.speed * (state.boosting ? 1.62 : 1);
    state.distance += speed * dt;
    state.scoreAcc += speed * dt * (state.boosting ? 1.6 : 0.75);
    state.score += speed * dt * (state.boosting ? 1.6 : 0.75);
    if (state.boosting) {
      state.boostTime -= dt;
      state.boost = Math.max(0, state.boostTime / 4.4);
      state.shake = Math.max(state.shake, 0.12);
      if (state.boostTime <= 0) {
        state.boosting = false;
        state.boost = 0;
        document.body.classList.remove('boosting');
      }
    }
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    state.ducking = (state.duckHeld || performance.now() < state.duckUntil) && state.grounded;
    updatePlayerPhysics(dt);
    world.setNight((state.distance - 300) / 1000);
  } else if (crashing) {
    state.crashTimer += dt;
    state.speed = Math.max(0, state.speed - dt * 18);
    speed = state.speed * 0.4;
    state.shake = Math.max(0, state.shake - dt * 0.9);
    rickshaw.root.rotation.z = Math.min(0.55, state.crashTimer * 1.6);
    rickshaw.root.position.y = Math.sin(Math.min(1, state.crashTimer * 3) * Math.PI) * 0.25;
    if (state.crashTimer > 1.15) {
      rickshaw.root.rotation.z = 0;
      rickshaw.root.position.y = 0;
      gameOver();
    }
  } else if (menu) {
    speed = 6.5;
    state.menuTrafficTimer -= dt;
    if (state.menuTrafficTimer <= 0) {
      state.menuTrafficTimer = 4.5;
      world.spawnMangoLine((Math.random() * 3) | 0, -140);
      if (Math.random() < 0.5) world.spawnObstacle('cng', (Math.random() * 3) | 0, -150);
    }
  } else if (state.mode === 'over') {
    speed = 0;
    state.overTimer += dt;
  }

  const active = playing;
  world.update(dt, {
    speed,
    playerX: state.x,
    playerY: state.y,
    playerHeight: state.ducking ? 1.42 : 2.0,
    boosting: state.boosting,
    active,
  });

  // lane easing
  const targetX = LANES[state.lane];
  const prevX = state.x;
  state.x += (targetX - state.x) * Math.min(1, dt * 11);
  state.lean = THREE.MathUtils.clamp((targetX - state.x) * 0.55, -1, 1);
  if (Math.abs(prevX - state.x) > 0.001 && playing) {
    // tire dust while changing lanes
    if (Math.random() < 0.25) world.burst(state.x, 0.15, 1.1, 0x8a6a52, 1, 1.6);
  }

  rickshaw.root.position.x = state.x;
  rickshaw.root.position.y = state.y;
  rickshaw.root.rotation.y = THREE.MathUtils.clamp((targetX - state.x) * 0.05, -0.12, 0.12);
  rickshaw.update(dt, {
    speed,
    lean: state.lean,
    duck: state.ducking ? 1 : 0,
    boost: state.boosting ? 1 : 0,
    airborne: !state.grounded,
    vy: state.vy,
    crashed: crashing,
  });

  if (menu) updateMenuCamera(dt);
  else updateGameCamera(dt, speed, crashing);

  if (playing) updateHud();
}

function updatePlayerPhysics(dt) {
  if (!state.grounded) {
    state.vy -= 23 * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) {
      state.y = 0;
      state.vy = 0;
      state.grounded = true;
      state.shake = Math.max(state.shake, 0.08);
      world.burst(state.x, 0.12, 1, 0xc9a27a, 12, 3);
    }
  }
}

function updateMenuCamera(dt) {
  const t = state.time;
  const k = 1 - Math.exp(-dt * 2.2);
  const portrait = window.innerWidth / window.innerHeight < 0.8;
  if (portrait) {
    desiredCam.set(-5.5 + Math.sin(t * 0.18) * 0.3, 3.9 + Math.sin(t * 0.31) * 0.1, 11.6 + Math.cos(t * 0.2) * 0.3);
    cameraTarget.lerp(lookAt.set(0.35, 1.55, -4.5), 1 - Math.exp(-dt * 3));
  } else {
    desiredCam.set(-5.7 + Math.sin(t * 0.18) * 0.4, 3.15 + Math.sin(t * 0.31) * 0.14, 8.35 + Math.cos(t * 0.2) * 0.35);
    cameraTarget.lerp(lookAt.set(0.65, 1.4, -3), 1 - Math.exp(-dt * 3));
  }
  camera.position.lerp(desiredCam, k);
  camera.lookAt(cameraTarget);
  const targetFov = portrait ? 66 : 58;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
}

function updateGameCamera(dt, speed, crashing) {
  const k = 1 - Math.exp(-dt * (crashing ? 2 : 4.6));
  const boost = state.boosting;
  const portrait = window.innerWidth / window.innerHeight < 0.8;
  desiredCam.set(
    state.x * 0.55 - (portrait ? 0.55 : 0.95),
    3.3 + state.y * 0.52 + (boost ? 0.15 : 0),
    (portrait ? 8.6 : 7.5) + (boost ? 0.9 : 0) + (crashing ? 1.4 : 0)
  );
  camera.position.lerp(desiredCam, k);
  cameraTarget.lerp(
    lookAt.set(state.x * 0.4 - 0.1, 1.25 + state.y * 0.48, -14),
    1 - Math.exp(-dt * 5)
  );
  camera.lookAt(cameraTarget);

  const targetFov = crashing ? 70 : boost ? 78 : (portrait ? 68 : 64);
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 4);
    camera.updateProjectionMatrix();
  }

  if (state.shake > 0.001) {
    const s = state.shake;
    camera.position.x += (Math.random() - 0.5) * s * 0.5;
    camera.position.y += (Math.random() - 0.5) * s * 0.35;
    camera.rotation.z += (Math.random() - 0.5) * s * 0.02;
    state.shake = Math.max(0, state.shake - dt * 2.2);
  }
}

/* ------------------------------------------------------------------ start */

async function init() {
  try {
    if (document.fonts) {
      await Promise.all([
        document.fonts.load('400 20px "Hind Siliguri"'),
        document.fonts.load('600 20px "Hind Siliguri"'),
        document.fonts.load('700 20px "Hind Siliguri"'),
        document.fonts.load('400 20px "Bebas Neue"'),
      ]);
      await document.fonts.ready;
    }
  } catch { /* fonts are optional */ }
  boot();
}

init();

window.__dhakaDash = {
  get state() { return state; },
  get world() { return world; },
  get camera() { return camera; },
  startGame,
  goMenu,
  pauseGame,
  resumeGame,
  jump,
  moveLane,
  activateBoost,
  toast,
  spawn(type, lane, z) { return world.spawnObstacle(type, lane, z); },
  collectAt(lane, z = -1) { world.spawnMango(lane, z); },
};
