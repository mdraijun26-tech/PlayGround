import * as THREE from 'three';
import { makeRickshawArtTexture, makeGlowTexture, makeSignTexture } from './textures.js';

const SKIN = 0x9a6440;

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.08, ...opts });
}

function addMesh(parent, geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeWheel(radius = 0.44) {
  const wheel = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x16121a, roughness: 0.9, metalness: 0.02 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd8b26a, roughness: 0.4, metalness: 0.55 });
  const tire = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.085, 10, 22), tireMat);
  tire.rotation.y = Math.PI / 2;
  tire.castShadow = true;
  wheel.add(tire);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.022, 6, 20), rimMat);
  rim.rotation.y = Math.PI / 2;
  wheel.add(rim);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 12), rimMat);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);

  const spokeGeo = new THREE.CylinderGeometry(0.012, 0.012, radius * 1.4, 5);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.position.set(0, Math.cos(angle) * radius * 0.34, Math.sin(angle) * radius * 0.34);
    spoke.rotation.x = angle;
    wheel.add(spoke);
  }
  return wheel;
}

export function createRickshaw() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const artTexture = makeRickshawArtTexture();
  const artMat = new THREE.MeshStandardMaterial({ map: artTexture, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
  const crimson = std(0xb3263b, { roughness: 0.48 });
  const crimsonDark = std(0x7d1728, { roughness: 0.55 });
  const teal = std(0x169e8c, { roughness: 0.5 });
  const tealDark = std(0x0d6b60, { roughness: 0.55 });
  const gold = std(0xe0b45f, { roughness: 0.35, metalness: 0.45 });
  const black = std(0x1a1519, { roughness: 0.8 });
  const cream = std(0xf4dfb8, { roughness: 0.7 });
  const cushion = std(0x8f1f35, { roughness: 0.85 });

  // ---- chassis ----
  addMesh(body, new THREE.BoxGeometry(1.3, 0.14, 2.45), crimsonDark, [0, 0.54, 0.05]);
  addMesh(body, new THREE.BoxGeometry(1.44, 0.1, 2.15), crimson, [0, 0.64, 0.12]);
  addMesh(body, new THREE.BoxGeometry(1.5, 0.06, 0.5), gold, [0, 0.67, -0.92]);
  // footboard
  addMesh(body, new THREE.BoxGeometry(1.42, 0.09, 0.5), tealDark, [0, 0.74, -1.12]);

  // ---- seat ----
  addMesh(body, new THREE.BoxGeometry(1.28, 0.2, 1.0), cream, [0, 0.96, 0.48]);
  addMesh(body, new THREE.BoxGeometry(1.2, 0.13, 0.92), cushion, [0, 1.07, 0.48]);
  const backrest = addMesh(body, new THREE.BoxGeometry(1.28, 0.62, 0.18), crimson, [0, 1.31, 0.97]);
  backrest.rotation.x = -0.1;
  addMesh(body, new THREE.BoxGeometry(1.18, 0.44, 0.08), cushion, [0, 1.31, 0.87], [-0.1, 0, 0]);
  addMesh(body, new THREE.CylinderGeometry(0.022, 0.022, 1.24, 6), gold, [0, 1.63, 0.99], [0, 0, Math.PI / 2]);

  // rear panel with art
  addMesh(body, new THREE.BoxGeometry(1.28, 0.62, 0.05), crimsonDark, [0, 0.86, 1.22]);
  const rearArt = addMesh(body, new THREE.PlaneGeometry(1.1, 0.5), artMat, [0, 0.88, 1.253]);
  rearArt.rotation.y = 0;

  // side art panels
  for (const side of [-1, 1]) {
    const panel = addMesh(body, new THREE.PlaneGeometry(1.72, 0.62), artMat, [side * 0.735, 0.9, 0.28], [0, side * Math.PI / 2, 0]);
    panel.castShadow = false;
    // fender rail
    addMesh(body, new THREE.BoxGeometry(0.05, 0.05, 1.95), gold, [side * 0.74, 1.24, 0.2]);
  }

  // ---- canopy (open-ended shell so the passenger stays visible) ----
  const canopyGeo = new THREE.CylinderGeometry(0.84, 0.84, 1.62, 26, 1, true, Math.PI / 2, Math.PI);
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xa82137,
    roughness: 0.55,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.rotation.x = Math.PI / 2;
  canopy.position.set(0, 1.42, -0.25);
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  body.add(canopy);

  // inner lining
  const lining = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({
    color: 0x2a8c7f,
    roughness: 0.75,
    side: THREE.BackSide,
  }));
  lining.rotation.x = Math.PI / 2;
  lining.scale.set(0.96, 1, 0.96);
  lining.position.set(0, 1.43, -0.25);
  body.add(lining);

  // painted cloth hanging across the open back
  const backSignTex = makeSignTexture('ঢাকা', { bg: '#8f1f2c', fg: '#ffcf6e', accent: '#ffcf6e' });
  const backSign = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.28), new THREE.MeshStandardMaterial({
    map: backSignTex,
    emissiveMap: backSignTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.3,
    roughness: 0.55,
    side: THREE.DoubleSide,
  }));
  backSign.position.set(0, 2.06, 0.57);
  body.add(backSign);

  // gold ribs arching over the canopy
  const ribMat = new THREE.MeshStandardMaterial({ color: 0xe8bd6a, roughness: 0.35, metalness: 0.5 });
  for (const z of [-0.92, -0.42, 0.08, 0.52]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.84, 1.42, z),
      new THREE.Vector3(-0.6, 1.92, z),
      new THREE.Vector3(0, 2.26, z),
      new THREE.Vector3(0.6, 1.92, z),
      new THREE.Vector3(0.84, 1.42, z),
    ]);
    const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.016, 5, false), ribMat);
    body.add(rib);
  }

  // scalloped fringe
  const fringeMat = new THREE.MeshStandardMaterial({ color: 0xffcf6e, roughness: 0.5 });
  const fringeGeo = new THREE.SphereGeometry(0.052, 8, 6);
  for (const z of [-1.06, 0.58]) {
    for (let i = 0; i < 13; i++) {
      const t = i / 12;
      const x = -0.8 + t * 1.6;
      const y = 1.42 + Math.sin(t * Math.PI) * 0.84 + 0.02;
      const bead = new THREE.Mesh(fringeGeo, i % 2 ? fringeMat : teal);
      bead.position.set(x, y, z);
      bead.scale.y = 1.45;
      body.add(bead);
    }
  }

  // hanging tassels at the open back
  for (let i = 0; i < 7; i++) {
    const x = -0.6 + i * 0.2;
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 4), fringeMat);
    tassel.position.set(x, 1.4, 0.6);
    body.add(tassel);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), i % 2 ? teal : gold);
    bead.position.set(x, 1.27, 0.6);
    body.add(bead);
  }

  // canopy support poles
  for (const x of [-0.8, 0.8]) {
    for (const z of [-0.95, 0.52]) {
      addMesh(body, new THREE.CylinderGeometry(0.025, 0.025, 0.92, 6), gold, [x, 1.16, z]);
    }
  }

  // ---- front / handlebar ----
  const handle = addMesh(body, new THREE.CylinderGeometry(0.026, 0.026, 1.08, 8), black, [0, 1.24, -1.28], [0, 0, Math.PI / 2]);
  handle.castShadow = true;
  addMesh(body, new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), gold, [0, 1.02, -1.22], [0.18, 0, 0]);
  addMesh(body, new THREE.BoxGeometry(0.5, 0.16, 0.08), black, [0, 1.02, -1.4]);

  // headlamp
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), new THREE.MeshStandardMaterial({
    color: 0xfff2c9,
    emissive: 0xffd27a,
    emissiveIntensity: 3,
    roughness: 0.3,
  }));
  lamp.position.set(0, 0.94, -1.46);
  body.add(lamp);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    color: 0xffd27a,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  lampGlow.scale.set(1.15, 1.15, 1);
  lampGlow.position.copy(lamp.position);
  body.add(lampGlow);

  // bell
  const bell = addMesh(body, new THREE.SphereGeometry(0.07, 10, 8), gold, [0.4, 1.31, -1.24]);
  bell.scale.y = 0.9;
  addMesh(body, new THREE.CylinderGeometry(0.012, 0.012, 0.1, 5), gold, [0.4, 1.38, -1.24]);

  // rear reflectors
  for (const x of [-0.55, 0.55]) {
    const r = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshStandardMaterial({
      color: 0xff3b2f,
      emissive: 0xff2a1c,
      emissiveIntensity: 2.2,
    }));
    r.position.set(x, 1.1, 1.26);
    body.add(r);
  }

  // number plate + chrome bumper
  addMesh(body, new THREE.BoxGeometry(0.62, 0.17, 0.035), std(0xf0dfb8, { roughness: 0.6 }), [0, 0.6, 1.25]);
  addMesh(body, new THREE.CylinderGeometry(0.028, 0.028, 1.36, 8), gold, [0, 0.52, 1.3], [0, 0, Math.PI / 2]);

  // ---- driver ----
  const driver = new THREE.Group();
  driver.position.set(0, 0, 0);
  body.add(driver);
  const torso = addMesh(driver, new THREE.CapsuleGeometry(0.2, 0.36, 6, 12), std(0xe88a2e, { roughness: 0.8 }), [0, 1.4, -0.52], [0.22, 0, 0]);
  torso.castShadow = true;
  const head = addMesh(driver, new THREE.SphereGeometry(0.16, 16, 12), std(SKIN, { roughness: 0.75 }), [0, 1.79, -0.58]);
  head.castShadow = true;
  // cap
  addMesh(driver, new THREE.SphereGeometry(0.168, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xe8ddc4, { roughness: 0.8 }), [0, 1.82, -0.58]);
  addMesh(driver, new THREE.CylinderGeometry(0.19, 0.19, 0.035, 14), std(0xe8ddc4), [0, 1.83, -0.64]);
  // arms
  for (const side of [-1, 1]) {
    const arm = addMesh(driver, new THREE.CylinderGeometry(0.055, 0.06, 0.62, 7), std(SKIN, { roughness: 0.8 }), [side * 0.25, 1.3, -0.92], [1.16, 0, side * 0.16]);
    arm.castShadow = true;
  }
  // legs
  for (const side of [-1, 1]) {
    addMesh(driver, new THREE.CylinderGeometry(0.075, 0.07, 0.55, 7), std(0x2c3b56, { roughness: 0.85 }), [side * 0.2, 0.96, -0.78], [1.2, 0, 0]);
  }

  // ---- passenger ----
  const passenger = new THREE.Group();
  passenger.position.set(0, 0, 0.42);
  body.add(passenger);
  addMesh(passenger, new THREE.CapsuleGeometry(0.21, 0.34, 6, 12), std(0xc94f7c, { roughness: 0.85 }), [0, 1.46, 0], [-0.08, 0, 0]);
  addMesh(passenger, new THREE.SphereGeometry(0.155, 14, 12), std(0x8a5735, { roughness: 0.78 }), [0, 1.83, 0.02]);
  addMesh(passenger, new THREE.SphereGeometry(0.163, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), std(0x1a1216, { roughness: 0.9 }), [0, 1.86, 0.02]);
  // colourful dupatta over the shoulder
  const scarf = addMesh(passenger, new THREE.ConeGeometry(0.29, 0.46, 8, 1, true), std(0x26d3b4, { roughness: 0.85, side: THREE.DoubleSide }), [0, 1.5, 0.03], [0.08, 0, 0]);
  scarf.scale.z = 0.72;
  // saree drape
  const drape = addMesh(passenger, new THREE.ConeGeometry(0.33, 0.6, 10, 1, true), std(0xe4a33b, { roughness: 0.85, side: THREE.DoubleSide }), [0, 1.15, 0.02]);
  drape.scale.z = 0.8;

  // ---- wheels ----
  const wheels = [];
  const wheelSpecs = [
    [-0.72, 0.45, 0.98],
    [0.72, 0.45, 0.98],
    [0, 0.45, -1.18],
  ];
  for (const [x, y, z] of wheelSpecs) {
    const wheel = makeWheel(0.44);
    wheel.position.set(x, y, z);
    root.add(wheel);
    wheels.push(wheel);
  }
  // front fork
  addMesh(body, new THREE.CylinderGeometry(0.035, 0.035, 0.75, 7), gold, [0, 0.75, -1.18], [0.12, 0, 0]);

  // warm cabin light so the driver and passenger read from behind
  const cabin = new THREE.PointLight(0xffc48a, 2.2, 3.4, 2);
  cabin.position.set(0, 1.95, 0.05);
  body.add(cabin);

  // subtle rim light from below
  const under = new THREE.PointLight(0xff7a3a, 0.55, 5, 2);
  under.position.set(0, 0.28, 0.6);
  root.add(under);

  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = obj.castShadow !== false;
      obj.receiveShadow = true;
    }
  });

  const state = {
    wheelSpin: 0,
    bob: 0,
    lean: 0,
    duck: 0,
    boost: 0,
    time: 0,
  };

  function update(dt, { speed = 0, lean = 0, duck = 0, boost = 0, airborne = false, vy = 0, crashed = false } = {}) {
    state.time += dt;
    state.wheelSpin += (speed * dt) / 0.44;
    state.lean += (lean - state.lean) * Math.min(1, dt * 8);
    state.duck += (duck - state.duck) * Math.min(1, dt * 12);
    state.boost += (boost - state.boost) * Math.min(1, dt * 6);

    for (const wheel of wheels) wheel.rotation.x = -state.wheelSpin;

    const bobAmp = airborne ? 0 : 0.018 + Math.min(speed, 40) * 0.0007;
    state.bob = Math.sin(state.time * (7 + speed * 0.14)) * bobAmp;
    body.position.y = state.bob;
    body.rotation.z = -state.lean * 0.2;
    body.rotation.x = airborne ? THREE.MathUtils.clamp(-vy * 0.018, -0.16, 0.2) : Math.sin(state.time * 5.4) * 0.004;
    body.scale.y = 1 - state.duck * 0.26;
    body.scale.x = 1 + state.duck * 0.06;

    driver.rotation.z = -state.lean * 0.14;
    driver.rotation.x = state.duck * 0.3;
    passenger.rotation.z = -state.lean * 0.1;
    passenger.position.y = state.duck * -0.05;

    lampGlow.material.opacity = 0.65 + Math.sin(state.time * 9) * 0.05;
    lampGlow.scale.setScalar(1.05 + state.boost * 0.5);
    under.intensity = 0.45 + state.boost * 1.6;

    if (crashed) {
      body.rotation.z = Math.sin(state.time * 18) * 0.12 - 0.25;
    }
  }

  return { root, update, body, wheels, driver, passenger };
}
