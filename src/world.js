import * as THREE from '../vendor/three.module.js';
import { smoothstep, matrix, mulberry32, canvasTexture, cloudTexture, glowTexture, noise2, mergeParts } from './util.js';
import { RiverTrack, waveHeight } from './track.js';
import {
  sceneryMaterial, makePalm, makeBush, makeBamboo, makeHut, makeCow, makeLily, makeLotusPickup, makeBunting, makeGrass,
} from './scenery.js';

export const SUN_DIR = new THREE.Vector3(-0.42, 0.34, -0.84).normalize();
const TERRAIN_CENTER = new THREE.Vector3(0, 0, -78);
const TERRAIN_SIZE = 760;

function makeSky() {
  const geo = new THREE.SphereGeometry(900, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSunDir: { value: SUN_DIR.clone() },
      uZenith: { value: new THREE.Color('#1d6d99') },
      uMid: { value: new THREE.Color('#7bb4bd') },
      uHorizon: { value: new THREE.Color('#ffc68f') },
      uSun: { value: new THREE.Color('#ffd9a0') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uZenith, uMid, uHorizon, uSun;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float y = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, y));
        col = mix(col, uZenith, smoothstep(0.16, 0.72, y));
        float glow = pow(max(dot(d, uSunDir), 0.0), 7.0);
        col += uSun * glow * 0.30;
        float disc = smoothstep(0.9993, 0.9998, dot(d, uSunDir));
        col += uSun * disc * 1.6;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return mesh;
}

function makeClouds(scene) {
  const tex = cloudTexture();
  const material = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.72, color: 0xfff3e2 });
  const rng = mulberry32(77);
  const clouds = [];
  for (let i = 0; i < 22; i++) {
    const sprite = new THREE.Sprite(material);
    const angle = rng() * Math.PI * 2;
    const radius = 180 + rng() * 420;
    sprite.position.set(Math.cos(angle) * radius, 55 + rng() * 90, Math.sin(angle) * radius - 60);
    const s = 50 + rng() * 90;
    sprite.scale.set(s, s * 0.42, 1);
    sprite.material = material;
    scene.add(sprite);
    clouds.push({ sprite, speed: 0.6 + rng() * 0.9, phase: rng() * 100 });
  }
  return clouds;
}

function buildTerrain(track, rng) {
  const seg = 210;
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(TERRAIN_CENTER.x, 0, TERRAIN_CENTER.z);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const cSand = new THREE.Color('#a1865b');
  const cMud = new THREE.Color('#7a7248');
  const cGrass = new THREE.Color('#4f8038');
  const cGrass2 = new THREE.Color('#6b9a44');
  const cField = new THREE.Color('#b0a24b');
  const cField2 = new THREE.Color('#7fa94d');
  const N = track.N;
  const step = 3;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let bestD = Infinity;
    let bestI = 0;
    for (let j = 0; j < N; j += step) {
      const p = track.samples[j];
      const dx = x - p.x;
      const dz = z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        bestI = j;
      }
    }
    const d = Math.sqrt(bestD);
    const hw = track.widths[bestI];
    let y = track.heightAt(x, z, d, hw);
    y += (noise2(x * 0.12, z * 0.12) - 0.5) * 0.18;
    pos.setY(i, y);

    const n = noise2(x * 0.045 + 3, z * 0.045 - 8);
    const n2 = noise2(x * 0.013 - 5, z * 0.013 + 2);
    const shore = 1 - smoothstep(hw + 0.7, hw + 2.0, d);
    const field = smoothstep(hw + 13, hw + 30, d);
    c.copy(cGrass).lerp(cGrass2, n);
    if (n2 > 0.62) c.lerp(cField, smoothstep(0.62, 0.8, n2) * 0.7 * field);
    else if (n2 < 0.3) c.lerp(cField2, smoothstep(0.3, 0.1, n2) * 0.5 * field);
    c.lerp(cSand, shore);
    if (y < 0.15) c.lerp(cMud, 0.65);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  return mesh;
}

function buildWater(track) {
  const segs = 760;
  const across = 8;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const u = (i % segs) / segs;
    const hw = track.halfWidth(u) + 6;
    const p = track.pointAt(u);
    const t = track.tangentAt(u);
    const sx = t.z;
    const sz = -t.x;
    for (let j = 0; j <= across; j++) {
      const f = j / across;
      const off = (f - 0.5) * 2 * hw;
      positions.push(p.x + sx * off, 0, p.z + sz * off);
      uvs.push(off / Math.max(1, hw - 6), u * (track.length / 9));
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < across; j++) {
      const a = i * (across + 1) + j;
      const b = a + across + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#063d49') },
      uShallow: { value: new THREE.Color('#1c7c68') },
      uSky: { value: new THREE.Color('#8fc2ba') },
      uSunDir: { value: SUN_DIR.clone() },
      uSunColor: { value: new THREE.Color('#ffdfa8') },
      uFogColor: { value: new THREE.Color('#e5bd90') },
      uFogNear: { value: 130 },
      uFogFar: { value: 470 },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying float vDepth;
      vec3 wave(vec3 p, out vec3 n) {
        float h = 0.22 * sin(p.x * 0.45 + uTime * 1.25)
                + 0.16 * sin(p.z * 0.37 - uTime * 0.95)
                + 0.08 * sin(p.x * 0.72 + p.z * 0.55 + uTime * 1.9);
        float dx = 0.22 * 0.45 * cos(p.x * 0.45 + uTime * 1.25)
                 + 0.08 * 0.72 * cos(p.x * 0.72 + p.z * 0.55 + uTime * 1.9);
        float dz = 0.16 * 0.37 * cos(p.z * 0.37 - uTime * 0.95)
                 + 0.08 * 0.55 * cos(p.x * 0.72 + p.z * 0.55 + uTime * 1.9);
        n = normalize(vec3(-dx, 1.0, -dz));
        return vec3(p.x, h, p.z);
      }
      void main() {
        vec3 n;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 w = wave(wp.xyz, n);
        vec4 world = vec4(w, 1.0);
        vWorld = w;
        vNormal = n;
        vUv = uv;
        vec4 mv = viewMatrix * world;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uDeep, uShallow, uSky, uSunDir, uSunColor, uFogColor;
      uniform float uFogNear, uFogFar;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying vec2 vUv;
      varying float vDepth;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(cameraPosition - vWorld);
        float rip1 = sin(vWorld.x * 2.2 + uTime * 1.9);
        float rip2 = cos(vWorld.z * 2.6 - uTime * 1.5);
        N = normalize(N + vec3(rip1 * 0.035, 0.0, rip2 * 0.035));
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
        float bands = sin(vWorld.x * 0.11 + vWorld.z * 0.07 + uTime * 0.5) * 0.5 + 0.5;
        vec3 body = mix(uDeep, uShallow, 0.25 + 0.35 * bands);
        vec3 col = mix(body, uSky, fres * 0.48);
        vec3 H = normalize(uSunDir + V);
        float spec = pow(max(dot(N, H), 0.0), 110.0);
        col += uSunColor * spec * 2.4;
        float sparkle = pow(max(dot(N, H), 0.0), 620.0);
        col += uSunColor * sparkle * 4.0;
        float ripple = sin(vWorld.x * 2.3 + uTime * 1.7) * sin(vWorld.z * 1.9 - uTime * 1.3);
        float edge = smoothstep(0.9, 1.0, abs(vUv.x));
        float foam = edge * (0.4 + 0.35 * max(ripple, 0.0));
        col = mix(col, vec3(0.82, 0.9, 0.86), foam * 0.32);
        float fog = smoothstep(uFogNear, uFogFar, vDepth);
        col = mix(col, uFogColor, fog);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

function makeGate(track, u, isFinish) {
  const group = new THREE.Group();
  const p = track.pointAt(u);
  const t = track.tangentAt(u);
  const hw = track.halfWidth(u);
  group.position.copy(p);
  group.rotation.y = Math.atan2(t.x, t.z);

  const poleParts = [];
  const span = hw + 1.4;
  for (const side of [-1, 1]) {
    const x = side * span;
    poleParts.push({ geometry: new THREE.CylinderGeometry(0.16, 0.22, 10, 6), color: 0xb18b53, matrix: matrix({ pos: [x, 5, 0] }) });
    for (let k = 1; k < 5; k++) {
      poleParts.push({ geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.14, 6), color: 0x8d6a3c, matrix: matrix({ pos: [x, k * 2, 0] }) });
    }
    poleParts.push({ geometry: new THREE.ConeGeometry(0.26, 0.5, 4), color: 0xd9b15a, matrix: matrix({ pos: [x, 10.2, 0] }) });
    if (!isFinish) {
      poleParts.push({
        geometry: new THREE.ConeGeometry(0.42, 1.15, 3),
        color: side < 0 ? 0xd8422f : 0x1f8a58,
        matrix: matrix({ pos: [x, 9.2, 0], rot: [0, 0, Math.PI / 2] }),
      });
    }
  }
  poleParts.push({ geometry: new THREE.CylinderGeometry(0.13, 0.13, span * 2 + 0.6, 6), color: 0xa9834d, matrix: matrix({ pos: [0, 9.7, 0], rot: [0, 0, Math.PI / 2] }) });
  group.add(new THREE.Mesh(mergeAll(poleParts), sceneryMaterial));

  if (isFinish) {
    const tex = canvasTexture(1024, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#0a3d33');
      g.addColorStop(1, '#0d5142');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f2c45f';
      ctx.lineWidth = 12;
      ctx.strokeRect(16, 16, w - 32, h - 32);
      ctx.strokeStyle = 'rgba(242,196,95,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, w - 80, h - 80);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffe9b8';
      ctx.font = '800 108px "Baloo Da 2", sans-serif';
      ctx.fillText('শুরু  •  শেষ', w / 2, h / 2 + 6);
      ctx.font = '600 30px "Noto Sans Bengali", sans-serif';
      ctx.fillStyle = '#e8c98d';
      ctx.fillText('নৌকাবাইচ ২০২৬', w / 2, h - 62);
      for (let x = 62; x < w - 40; x += 84) {
        ctx.fillStyle = '#f2c45f';
        ctx.beginPath();
        ctx.arc(x, 40, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    const bannerW = Math.min(span * 1.3, 17.5);
    const bannerH = 2.5;
    const bannerMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { map: { value: tex } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        varying vec2 vUv;
        void main() {
          vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
          vec4 texel = texture2D(map, uv);
          gl_FragColor = texel;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(bannerW, bannerH), bannerMat);
    banner.position.set(0, 8.25, 0);
    group.add(banner);

    // start buoys
    const buoyParts = [];
    for (let i = 0; i < 14; i++) {
      const x = (i / 13 - 0.5) * span * 1.7;
      buoyParts.push({ geometry: new THREE.SphereGeometry(0.22, 6, 5), color: i % 2 ? 0xf6ede0 : 0xd8422f, matrix: matrix({ pos: [x, 0.15, 0] }) });
    }
    group.add(new THREE.Mesh(mergeAll(buoyParts), sceneryMaterial));
  }

  const [flagsGeo, ropeGeo] = makeBunting(Math.round(span * 1.1), span * 2.1, 0.9);
  const flags = new THREE.Mesh(flagsGeo, sceneryMaterial);
  const rope = new THREE.Mesh(ropeGeo, sceneryMaterial);
  flags.position.set(0, 9.1, 0);
  rope.position.set(0, 9.1, 0);
  group.add(flags, rope);
  return group;
}

function mergeAll(parts) {
  return mergeParts(parts);
}
export function createWorld(scene) {
  const track = new RiverTrack();
  const rng = mulberry32(2026);

  scene.background = null;
  scene.fog = new THREE.Fog(0xe5bd90, 140, 480);
  const sky = makeSky();
  scene.add(sky);
  const clouds = makeClouds(scene);

  const hemi = new THREE.HemisphereLight(0xbfe4ff, 0x3f4a28, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9ae, 2.6);
  sun.position.copy(SUN_DIR).multiplyScalar(400);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8fc4d8, 0.55);
  fill.position.set(120, 80, 160);
  scene.add(fill);

  // sun glow sprite
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0xffe1ae, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85,
  }));
  sunSprite.position.copy(SUN_DIR).multiplyScalar(760);
  sunSprite.scale.set(160, 160, 1);
  scene.add(sunSprite);

  const terrain = buildTerrain(track, rng);
  scene.add(terrain);

  const water = buildWater(track);
  scene.add(water.mesh);

  const gates = [];
  const gateGroup = new THREE.Group();
  gateGroup.add(makeGate(track, 0, true));
  for (const u of [0.25, 0.5, 0.75]) {
    gateGroup.add(makeGate(track, u, false));
  }
  scene.add(gateGroup);

  // ------- scenery -------
  const palmGeos = [makePalm(11), makePalm(29), makePalm(47)];
  const palmMeshes = palmGeos.map((g) => {
    const inst = new THREE.InstancedMesh(g, sceneryMaterial, 54);
    inst.frustumCulled = false;
    scene.add(inst);
    return inst;
  });
  const palmCounts = [0, 0, 0];
  const palmMat = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpP = new THREE.Vector3();
  const tmpS = new THREE.Vector3();
  for (let i = 0; i < 150; i++) {
    const u = rng();
    const side = rng() > 0.5 ? 1 : -1;
    const d = track.halfWidth(u) + 8 + rng() * 52;
    const p = track.pointAt(u, side * d);
    const y = track.heightAt(p.x, p.z, d, track.halfWidth(u));
    const variant = Math.floor(rng() * 3);
    if (palmCounts[variant] >= 54) continue;
    tmpP.set(p.x, y - 0.25, p.z);
    tmpQ.setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0));
    const s = 0.85 + rng() * 0.55;
    tmpS.set(s, s, s);
    palmMat.compose(tmpP, tmpQ, tmpS);
    palmMeshes[variant].setMatrixAt(palmCounts[variant]++, palmMat);
  }
  for (const m of palmMeshes) m.instanceMatrix.needsUpdate = true;

  const bushGeo = makeBush(101);
  const bushes = new THREE.InstancedMesh(bushGeo, sceneryMaterial, 110);
  bushes.frustumCulled = false;
  scene.add(bushes);
  for (let i = 0; i < 110; i++) {
    const u = rng();
    const side = rng() > 0.5 ? 1 : -1;
    const d = track.halfWidth(u) + 5.5 + rng() * 40;
    const p = track.pointAt(u, side * d);
    const y = track.heightAt(p.x, p.z, d, track.halfWidth(u));
    const s = 0.6 + rng() * 1.2;
    tmpP.set(p.x, y - 0.15, p.z);
    tmpQ.setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0));
    tmpS.set(s, s * (0.7 + rng() * 0.5), s);
    palmMat.compose(tmpP, tmpQ, tmpS);
    bushes.setMatrixAt(i, palmMat);
  }
  bushes.instanceMatrix.needsUpdate = true;

  const bambooGeo = makeBamboo(303);
  const bamboos = new THREE.InstancedMesh(bambooGeo, sceneryMaterial, 26);
  bamboos.frustumCulled = false;
  scene.add(bamboos);
  for (let i = 0; i < 26; i++) {
    const u = rng();
    const side = rng() > 0.5 ? 1 : -1;
    const d = track.halfWidth(u) + 6 + rng() * 26;
    const p = track.pointAt(u, side * d);
    const y = track.heightAt(p.x, p.z, d, track.halfWidth(u));
    tmpP.set(p.x, y - 0.2, p.z);
    tmpQ.setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0));
    const s = 0.8 + rng() * 0.8;
    tmpS.set(s, s, s);
    palmMat.compose(tmpP, tmpQ, tmpS);
    bamboos.setMatrixAt(i, palmMat);
  }
  bamboos.instanceMatrix.needsUpdate = true;

  const hutGeos = [makeHut(401), makeHut(409), makeHut(417)];
  const hutMeshes = hutGeos.map((g) => {
    const inst = new THREE.InstancedMesh(g, sceneryMaterial, 8);
    inst.frustumCulled = false;
    scene.add(inst);
    return inst;
  });
  const hutCounts = [0, 0, 0];
  for (let i = 0; i < 18; i++) {
    const u = rng();
    const side = rng() > 0.5 ? 1 : -1;
    const d = track.halfWidth(u) + 11 + rng() * 22;
    const p = track.pointAt(u, side * d);
    const y = track.heightAt(p.x, p.z, d, track.halfWidth(u));
    const v = Math.floor(rng() * 3);
    if (hutCounts[v] >= 8) continue;
    tmpP.set(p.x, y - 0.1, p.z);
    tmpQ.setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0));
    const s = 0.95 + rng() * 0.3;
    tmpS.set(s, s, s);
    palmMat.compose(tmpP, tmpQ, tmpS);
    hutMeshes[v].setMatrixAt(hutCounts[v]++, palmMat);
  }
  for (const m of hutMeshes) m.instanceMatrix.needsUpdate = true;

  const cowGeo = makeCow(505);
  const cows = new THREE.InstancedMesh(cowGeo, sceneryMaterial, 9);
  cows.frustumCulled = false;
  scene.add(cows);
  for (let i = 0; i < 9; i++) {
    const u = rng();
    const side = rng() > 0.5 ? 1 : -1;
    const d = track.halfWidth(u) + 9 + rng() * 16;
    const p = track.pointAt(u, side * d);
    const y = track.heightAt(p.x, p.z, d, track.halfWidth(u));
    tmpP.set(p.x, y, p.z);
    tmpQ.setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0));
    const s = 0.9 + rng() * 0.35;
    tmpS.set(s, s, s);
    palmMat.compose(tmpP, tmpQ, tmpS);
    cows.setMatrixAt(i, palmMat);
  }
  cows.instanceMatrix.needsUpdate = true;

  const grassGeo = makeGrass(707);
  const grass = new THREE.InstancedMesh(grassGeo, sceneryMaterial, 190);
  grass.frustumCulled = false;
  scene.add(grass);
  for (let i = 0; i < 190; i++) {
    const u = rng();
    const side = rng() > 0.5 ? 1 : -1;
    const hw = track.halfWidth(u);
    const d = hw + 1.9 + rng() * 6.5;
    const p = track.pointAt(u, side * d);
    const y = track.heightAt(p.x, p.z, d, hw);
    tmpP.set(p.x, y - 0.15, p.z);
    tmpQ.setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0));
    const s = 0.8 + rng() * 0.9;
    tmpS.set(s, s * (0.8 + rng() * 0.5), s);
    palmMat.compose(tmpP, tmpQ, tmpS);
    grass.setMatrixAt(i, palmMat);
  }
  grass.instanceMatrix.needsUpdate = true;

  const lilyGeo = makeLily(601);
  const lilies = new THREE.InstancedMesh(lilyGeo, sceneryMaterial, 120);
  lilies.frustumCulled = false;
  scene.add(lilies);
  for (let i = 0; i < 120; i++) {
    const u = rng();
    const side = rng() > 0.5 ? 1 : -1;
    const hw = track.halfWidth(u);
    const d = hw - 0.9 - rng() * 5.5;
    const p = track.pointAt(u, side * d);
    tmpP.set(p.x, 0.03, p.z);
    tmpQ.setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0));
    const s = 0.7 + rng() * 0.8;
    tmpS.set(s, 1, s);
    palmMat.compose(tmpP, tmpQ, tmpS);
    lilies.setMatrixAt(i, palmMat);
  }
  lilies.instanceMatrix.needsUpdate = true;

  // ------- birds -------
  const birdPos = [];
  for (const sx of [-1, 1]) {
    birdPos.push(0, 0, 0.12, sx * 1.15, 0.16, -0.16, sx * 0.18, 0.02, -0.34);
  }
  const birdGeo = new THREE.BufferGeometry();
  birdGeo.setAttribute('position', new THREE.Float32BufferAttribute(birdPos, 3));
  birdGeo.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x233432, side: THREE.DoubleSide });
  const birdCount = 10;
  const birds = new THREE.InstancedMesh(birdGeo, birdMat, birdCount);
  birds.frustumCulled = false;
  scene.add(birds);
  const birdData = [];
  for (let i = 0; i < birdCount; i++) {
    birdData.push({
      radius: 45 + rng() * 90,
      height: 32 + rng() * 30,
      angle: rng() * Math.PI * 2,
      speed: (0.05 + rng() * 0.06) * (rng() > 0.5 ? 1 : -1),
      phase: rng() * 10,
      scale: 0.7 + rng() * 0.8,
    });
  }
  const birdDummy = new THREE.Object3D();
  function updateBirds(time) {
    for (let i = 0; i < birdData.length; i++) {
      const b = birdData[i];
      const a = b.angle + time * b.speed;
      const x = Math.cos(a) * b.radius;
      const z = -80 + Math.sin(a) * b.radius * 0.75;
      birdDummy.position.set(x, b.height + Math.sin(time * 0.4 + b.phase) * 1.2, z);
      birdDummy.rotation.set(0, -a + (b.speed > 0 ? Math.PI : 0), 0);
      birdDummy.scale.set(b.scale, b.scale * (0.35 + Math.abs(Math.sin(time * 5 + b.phase)) * 0.9), b.scale);
      birdDummy.updateMatrix();
      birds.setMatrixAt(i, birdDummy.matrix);
    }
    birds.instanceMatrix.needsUpdate = true;
  }

  // ------- lotus pickups -------
  const lotusGeo = makeLotusPickup();
  const lotusMat = new THREE.MeshLambertMaterial({
    vertexColors: true, flatShading: true, emissive: 0x4a3200, emissiveIntensity: 0.55, side: THREE.DoubleSide,
  });
  const lotusCount = 30;
  const lotuses = new THREE.InstancedMesh(lotusGeo, lotusMat, lotusCount);
  lotuses.frustumCulled = false;
  scene.add(lotuses);
  const lotusData = [];
  for (let i = 0; i < lotusCount; i++) {
    const u = (i / lotusCount + rng() * 0.012) % 1;
    const hw = track.halfWidth(u);
    const lateral = (rng() * 2 - 1) * (hw - 3.0) * 0.82;
    const p = track.pointAt(u, lateral);
    lotusData.push({
      u, lateral, x: p.x, z: p.z, phase: rng() * Math.PI * 2,
      collected: false, respawn: 0, scale: 1,
    });
    lotuses.setMatrixAt(i, new THREE.Matrix4());
  }
  lotuses.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  const dummy = new THREE.Object3D();
  function updateLotus(time, dt) {
    for (let i = 0; i < lotusData.length; i++) {
      const l = lotusData[i];
      if (l.collected) {
        l.respawn -= dt;
        if (l.respawn <= 0) {
          l.collected = false;
          l.scale = 1;
        }
      }
      const bob = Math.sin(time * 2 + l.phase) * 0.09;
      const y = waveHeight(l.x, l.z, time) + 0.16 + bob;
      dummy.position.set(l.x, y, l.z);
      dummy.rotation.set(0, time * 0.6 + l.phase, 0);
      const s = l.collected ? 0 : l.scale * (1 + Math.sin(time * 3 + l.phase) * 0.06);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      lotuses.setMatrixAt(i, dummy.matrix);
    }
    lotuses.instanceMatrix.needsUpdate = true;
  }

  function collectLotus(pos, radius = 2.4) {
    for (const l of lotusData) {
      if (l.collected) continue;
      const dx = pos.x - l.x;
      const dz = pos.z - l.z;
      if (dx * dx + dz * dz < radius * radius) {
        l.collected = true;
        l.respawn = 18;
        return true;
      }
    }
    return false;
  }

  function resetLotus() {
    for (const l of lotusData) {
      l.collected = false;
      l.respawn = 0;
      l.scale = 1;
    }
  }

  function update(time, dt) {
    water.mat.uniforms.uTime.value = time;
    updateLotus(time, dt);
    updateBirds(time);
    for (const c of clouds) {
      c.sprite.position.x += c.speed * dt;
      if (c.sprite.position.x > 520) c.sprite.position.x = -520;
    }
  }

  return {
    track, terrain, water: water.mesh, update, lotuses: lotusData, collectLotus, resetLotus,
    lotusMesh: lotuses, gates, sunDir: SUN_DIR,
  };
}
