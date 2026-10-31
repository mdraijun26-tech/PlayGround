import * as THREE from '../vendor/three.module.js';
import { matrix, mergeParts, cylinderBetween, mulberry32 } from './util.js';

export const sceneryMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
  side: THREE.DoubleSide,
});

function frondGeometry(len, wid, droop) {
  const segs = 4;
  const pos = [];
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const x0 = t0 * len;
    const x1 = t1 * len;
    const y0 = -t0 * t0 * len * droop;
    const y1 = -t1 * t1 * len * droop;
    const w0 = wid * (1 - t0 * 0.82);
    const w1 = wid * (1 - t1 * 0.82);
    const a = new THREE.Vector3(x0, y0, -w0);
    const b = new THREE.Vector3(x0, y0 + 0.08, 0);
    const c = new THREE.Vector3(x0, y0, w0);
    const d = new THREE.Vector3(x1, y1, -w1);
    const e = new THREE.Vector3(x1, y1 + 0.08, 0);
    const f = new THREE.Vector3(x1, y1, w1);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, e.x, e.y, e.z);
    pos.push(a.x, a.y, a.z, e.x, e.y, e.z, d.x, d.y, d.z);
    pos.push(b.x, b.y, b.z, c.x, c.y, c.z, f.x, f.y, f.z);
    pos.push(b.x, b.y, b.z, f.x, f.y, f.z, e.x, e.y, e.z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

export function makePalm(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  const height = 6.2 + rng() * 3.2;
  const bend = 0.5 + rng() * 1.1;
  let prev = new THREE.Vector3(0, -0.3, 0);
  const segs = 6;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const next = new THREE.Vector3(Math.pow(t, 2) * bend, t * height, Math.sin(t * 1.6) * 0.16);
    cylinderBetween(parts, prev, next, 0.24 - t * 0.1, i === segs ? 0x7d6136 : 0x8a6038, 5);
    prev = next;
  }
  const crown = prev;
  const fronds = 7 + Math.floor(rng() * 3);
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rng() * 0.3;
    const geo = frondGeometry(2.6 + rng() * 1.0, 0.4 + rng() * 0.12, 0.16 + rng() * 0.1);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, -0.18 + rng() * 0.22));
    m.compose(crown, q, new THREE.Vector3(1, 1, 1));
    parts.push({ geometry: geo, color: i % 2 ? 0x3e7d38 : 0x4f8f3c, matrix: m });
  }
  // coconuts
  for (let i = 0; i < 3; i++) {
    parts.push({
      geometry: new THREE.SphereGeometry(0.13, 6, 5),
      color: 0x6c4b25,
      matrix: matrix({ pos: [crown.x + (rng() - 0.5) * 0.3, crown.y - 0.2, crown.z + (rng() - 0.5) * 0.3] }),
    });
  }
  return mergeParts(parts);
}

export function makeBush(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const s = 0.5 + rng() * 0.7;
    parts.push({
      geometry: new THREE.IcosahedronGeometry(s, 0),
      color: [0x396f34, 0x46803a, 0x548c41][i % 3],
      matrix: matrix({
        pos: [(rng() - 0.5) * 1.6, s * 0.55 + rng() * 0.5, (rng() - 0.5) * 1.6],
        scale: [1, 0.75, 1],
      }),
    });
  }
  return mergeParts(parts);
}

export function makeBamboo(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const x = (rng() - 0.5) * 1.4;
    const z = (rng() - 0.5) * 1.4;
    const h = 5 + rng() * 4;
    const lean = (rng() - 0.5) * 0.7;
    cylinderBetween(parts, new THREE.Vector3(x, 0, z), new THREE.Vector3(x + lean, h, z + lean * 0.4), 0.06, 0x8aa35a, 4);
    for (let k = 0; k < 5; k++) {
      const t = 0.55 + rng() * 0.45;
      const geo = frondGeometry(0.8 + rng() * 0.5, 0.1, 0.35);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * Math.PI * 2, 0.5 + rng() * 0.4));
      m.compose(new THREE.Vector3(x + lean * t, h * t, z + lean * 0.4 * t), q, new THREE.Vector3(1, 1, 1));
      parts.push({ geometry: geo, color: 0x5d9343, matrix: m });
    }
  }
  return mergeParts(parts);
}

export function makeHut(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  const tin = rng() > 0.35;
  const stilts = 0.55 + rng() * 0.35;
  for (const x of [-2.2, 2.2]) {
    for (const z of [-1.7, 1.7]) {
      parts.push({ geometry: new THREE.CylinderGeometry(0.11, 0.13, stilts + 0.4, 5), color: 0x6e4d2e, matrix: matrix({ pos: [x, stilts / 2, z] }) });
    }
  }
  const bodyY = stilts + 1.15;
  parts.push({ geometry: new THREE.BoxGeometry(5.4, 2.3, 4.2), color: tin ? 0xb3855a : 0xa77a4e, matrix: matrix({ pos: [0, bodyY, 0] }) });
  parts.push({ geometry: new THREE.BoxGeometry(0.95, 1.6, 0.12), color: 0x3b2a1c, matrix: matrix({ pos: [-0.9, bodyY - 0.2, 2.12] }) });
  parts.push({ geometry: new THREE.BoxGeometry(0.8, 0.7, 0.12), color: 0x2c2017, matrix: matrix({ pos: [1.3, bodyY + 0.25, 2.12] }) });
  // roof
  const roofY = bodyY + 1.5;
  const roofColor = tin ? 0x8e9694 : 0xb38a4d;
  for (const side of [-1, 1]) {
    parts.push({
      geometry: new THREE.BoxGeometry(3.7, 0.14, 5.6),
      color: roofColor,
      matrix: matrix({ pos: [side * 1.55, roofY + 0.45, 0], rot: [0, 0, side * -0.42] }),
    });
  }
  parts.push({ geometry: new THREE.BoxGeometry(0.22, 0.22, 5.7), color: tin ? 0x6f7776 : 0x8f6b38, matrix: matrix({ pos: [0, roofY + 1.18, 0] }) });
  // porch / ladder
  parts.push({ geometry: new THREE.BoxGeometry(1.3, 0.12, 1.6), color: 0x9b7448, matrix: matrix({ pos: [0.8, stilts, 2.5] }) });
  return mergeParts(parts);
}

export function makeCow(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  const white = rng() > 0.5 ? 0xe8e0cf : 0xd6c7ac;
  parts.push({ geometry: new THREE.BoxGeometry(1.5, 0.8, 0.7), color: white, matrix: matrix({ pos: [0, 1.05, 0] }) });
  parts.push({ geometry: new THREE.BoxGeometry(0.55, 0.5, 0.5), color: white, matrix: matrix({ pos: [0.95, 1.2, 0], rot: [0, 0, -0.2] }) });
  parts.push({ geometry: new THREE.BoxGeometry(0.32, 0.28, 0.34), color: 0x59463a, matrix: matrix({ pos: [1.25, 1.05, 0], rot: [0, 0, -0.2] }) });
  for (const x of [-0.55, 0.55]) {
    for (const z of [-0.26, 0.26]) {
      parts.push({ geometry: new THREE.CylinderGeometry(0.075, 0.065, 0.75, 4), color: 0x6b5a47, matrix: matrix({ pos: [x, 0.38, z] }) });
    }
  }
  for (const z of [-0.2, 0.2]) {
    parts.push({ geometry: new THREE.ConeGeometry(0.07, 0.3, 4), color: 0x8b7a63, matrix: matrix({ pos: [1.12, 1.42, z], rot: [z * 2, 0, 0] }) });
  }
  return mergeParts(parts);
}

export function makeLily(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  parts.push({ geometry: new THREE.CylinderGeometry(0.52, 0.5, 0.04, 9), color: 0x3e7d4a, matrix: matrix({ pos: [0, 0, 0] }) });
  if (rng() > 0.35) {
    const pink = rng() > 0.5 ? 0xf3a6c0 : 0xffe0ec;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push({
        geometry: new THREE.ConeGeometry(0.11, 0.34, 4),
        color: pink,
        matrix: matrix({ pos: [Math.cos(a) * 0.15, 0.16, Math.sin(a) * 0.15], rot: [Math.sin(a) * 0.6, a, Math.cos(a) * 0.6] }),
      });
    }
    parts.push({ geometry: new THREE.SphereGeometry(0.09, 6, 4), color: 0xffcf5c, matrix: matrix({ pos: [0, 0.16, 0] }) });
  }
  return mergeParts(parts);
}

export function makeLotusPickup() {
  const parts = [];
  parts.push({ geometry: new THREE.CylinderGeometry(0.78, 0.72, 0.06, 12), color: 0x2f8a67, matrix: matrix({ pos: [0, 0, 0] }) });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push({
      geometry: new THREE.ConeGeometry(0.18, 0.55, 5),
      color: 0xffb347,
      matrix: matrix({ pos: [Math.cos(a) * 0.28, 0.26, Math.sin(a) * 0.28], rot: [Math.sin(a) * 0.7, a, Math.cos(a) * 0.7] }),
    });
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    parts.push({
      geometry: new THREE.ConeGeometry(0.14, 0.5, 5),
      color: 0xffd76b,
      matrix: matrix({ pos: [Math.cos(a) * 0.14, 0.42, Math.sin(a) * 0.14], rot: [Math.sin(a) * 0.45, a, Math.cos(a) * 0.45] }),
    });
  }
  parts.push({ geometry: new THREE.SphereGeometry(0.13, 7, 5), color: 0xfff1a8, matrix: matrix({ pos: [0, 0.42, 0] }) });
  return mergeParts(parts);
}

export function makeBunting(count, span, sag, colors = [0xd8422f, 0xf0c04a, 0x1f7a4d]) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = (t - 0.5) * span;
    const y = -Math.sin(t * Math.PI) * sag;
    parts.push({
      geometry: new THREE.ConeGeometry(0.32, 0.75, 3),
      color: colors[i % colors.length],
      matrix: matrix({ pos: [x, y - 0.3, 0], rot: [0, 0, Math.PI] }),
    });
  }
  // rope
  const rope = [];
  const segs = 22;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    cylinderBetween(
      rope,
      new THREE.Vector3((t0 - 0.5) * span, -Math.sin(t0 * Math.PI) * sag, 0),
      new THREE.Vector3((t1 - 0.5) * span, -Math.sin(t1 * Math.PI) * sag, 0),
      0.025,
      0x6a5230,
      3
    );
  }
  return [mergeParts(parts), mergeParts(rope)];
}

export function makeGrass(seed) {
  const rng = mulberry32(seed);
  const parts = [];
  const greens = [0x4f8a3b, 0x66a047, 0x3f7733];
  for (let i = 0; i < 8; i++) {
    const x = (rng() - 0.5) * 1.4;
    const z = (rng() - 0.5) * 1.4;
    const h = 0.55 + rng() * 1.5;
    parts.push({
      geometry: new THREE.ConeGeometry(0.075, h, 3),
      color: greens[i % greens.length],
      matrix: matrix({
        pos: [x, h / 2, z],
        rot: [(rng() - 0.5) * 0.5, rng() * 3, (rng() - 0.5) * 0.5],
      }),
    });
  }
  return mergeParts(parts);
}
