import * as THREE from '../vendor/three.module.js';
import { matrix, mergeParts, cylinderBetween, bdFlagTexture, flagTexture, glowTexture } from './util.js';

const deckTop = (s) => {
  const e = Math.abs(2 * s - 1);
  return 0.42 + 0.72 * Math.pow(e, 2.8);
};

function buildHullParts(parts, trim) {
  const stations = 18;
  const length = 6.0;
  const beam = 0.95;
  const rings = [];
  for (let i = 0; i <= stations; i++) {
    const s = i / stations;
    const z = (s - 0.5) * length;
    const e = Math.abs(2 * s - 1);
    const w = Math.max(0.02, Math.pow(Math.sin(Math.PI * s), 0.62) * beam);
    const top = deckTop(s);
    const keel = -0.5 + 0.55 * Math.pow(e, 2.4);
    rings.push([
      new THREE.Vector3(-w, top, z),
      new THREE.Vector3(-w * 0.96, top - 0.17, z),
      new THREE.Vector3(-w * 0.76, keel + 0.2, z),
      new THREE.Vector3(0, keel, z),
      new THREE.Vector3(w * 0.76, keel + 0.2, z),
      new THREE.Vector3(w * 0.96, top - 0.17, z),
      new THREE.Vector3(w, top, z),
    ]);
  }

  const woodPos = [];
  const paintPos = [];
  const pushTri = (arr, a, b, c) => arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const addQuad = (arr, a, b, c, d) => {
    pushTri(arr, a, b, c);
    pushTri(arr, a, c, d);
  };

  for (let i = 0; i < stations; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    for (let j = 0; j < 6; j++) {
      const target = j === 0 || j === 5 ? paintPos : woodPos;
      addQuad(target, A[j], A[j + 1], B[j + 1], B[j]);
    }
  }

  const wood = new THREE.BufferGeometry();
  wood.setAttribute('position', new THREE.Float32BufferAttribute(woodPos, 3));
  wood.computeVertexNormals();
  const paint = new THREE.BufferGeometry();
  paint.setAttribute('position', new THREE.Float32BufferAttribute(paintPos, 3));
  paint.computeVertexNormals();

  parts.push({ geometry: wood, color: 0x8a5a34 });
  parts.push({ geometry: paint, color: trim });

  // deck
  const deckPos = [];
  for (let i = 0; i < stations; i++) {
    const s0 = i / stations;
    const s1 = (i + 1) / stations;
    const z0 = (s0 - 0.5) * length;
    const z1 = (s1 - 0.5) * length;
    const w0 = Math.max(0.02, Math.pow(Math.sin(Math.PI * s0), 0.62) * beam) * 0.93;
    const w1 = Math.max(0.02, Math.pow(Math.sin(Math.PI * s1), 0.62) * beam) * 0.93;
    const y0 = deckTop(s0) - 0.055;
    const y1 = deckTop(s1) - 0.055;
    const a = new THREE.Vector3(-w0, y0, z0);
    const b = new THREE.Vector3(-w1, y1, z1);
    const c = new THREE.Vector3(w1, y1, z1);
    const d = new THREE.Vector3(w0, y0, z0);
    deckPos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    deckPos.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
  }
  const deck = new THREE.BufferGeometry();
  deck.setAttribute('position', new THREE.Float32BufferAttribute(deckPos, 3));
  deck.computeVertexNormals();
  parts.push({ geometry: deck, color: 0xa2703f });

  // gunwale caps
  for (const side of [-1, 1]) {
    const capPos = [];
    for (let i = 0; i < stations; i++) {
      const s0 = i / stations;
      const s1 = (i + 1) / stations;
      const z0 = (s0 - 0.5) * length;
      const z1 = (s1 - 0.5) * length;
      const w0 = Math.max(0.02, Math.pow(Math.sin(Math.PI * s0), 0.62) * beam);
      const w1 = Math.max(0.02, Math.pow(Math.sin(Math.PI * s1), 0.62) * beam);
      const y0 = deckTop(s0) + 0.005;
      const y1 = deckTop(s1) + 0.005;
      const a = new THREE.Vector3(side * w0 * 0.93, y0, z0);
      const b = new THREE.Vector3(side * w0 * 1.04, y0, z0);
      const c = new THREE.Vector3(side * w1 * 1.04, y1, z1);
      const d = new THREE.Vector3(side * w1 * 0.93, y1, z1);
      capPos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      capPos.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    }
    const cap = new THREE.BufferGeometry();
    cap.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
    cap.computeVertexNormals();
    parts.push({ geometry: cap, color: 0x5b3a20 });
  }

  // prow / stern posts
  for (const z of [-length / 2 + 0.12, length / 2 - 0.12]) {
    parts.push({
      geometry: new THREE.CylinderGeometry(0.03, 0.09, 1.15, 5),
      color: 0x5b3a20,
      matrix: matrix({ pos: [0, 1.05, z], rot: [z < 0 ? 0.18 : -0.18, 0, 0] }),
    });
  }

  // small cargo: clay pots and jute sack
  parts.push({ geometry: new THREE.SphereGeometry(0.28, 8, 6), color: 0xa8563c, matrix: matrix({ pos: [-0.32, 0.82, 1.3], scale: [1, 0.9, 1] }) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.14, 0.2, 0.18, 7), color: 0x8c412d, matrix: matrix({ pos: [-0.32, 1.04, 1.3] }) });
  parts.push({ geometry: new THREE.SphereGeometry(0.3, 8, 6), color: 0xa8563c, matrix: matrix({ pos: [0.3, 0.8, 1.5], scale: [0.9, 0.8, 0.9] }) });
  parts.push({ geometry: new THREE.BoxGeometry(0.7, 0.42, 0.5), color: 0xc9ac74, matrix: matrix({ pos: [0.28, 0.75, 0.6], rot: [0, 0.4, 0] }) });

  // boatman: legs, lungi, torso, head, hat, arms
  const bx = 0.02;
  const bz = -0.9;
  const footY = deckTop((-0.9 / length) + 0.5) - 0.05;
  cylinderBetween(parts, new THREE.Vector3(bx - 0.12, footY, bz + 0.06), new THREE.Vector3(bx - 0.11, footY + 0.62, bz), 0.075, 0x6f4a2c);
  cylinderBetween(parts, new THREE.Vector3(bx + 0.12, footY, bz - 0.06), new THREE.Vector3(bx + 0.11, footY + 0.62, bz), 0.075, 0x6f4a2c);
  parts.push({ geometry: new THREE.CylinderGeometry(0.27, 0.34, 0.5, 8), color: 0xf2e6cf, matrix: matrix({ pos: [bx, footY + 0.76, bz] }) });
  parts.push({ geometry: new THREE.CylinderGeometry(0.18, 0.23, 0.5, 7), color: 0xd84c3a, matrix: matrix({ pos: [bx, footY + 1.18, bz] }) });
  parts.push({ geometry: new THREE.SphereGeometry(0.16, 10, 8), color: 0x9a6338, matrix: matrix({ pos: [bx, footY + 1.55, bz] }) });
  parts.push({ geometry: new THREE.ConeGeometry(0.34, 0.2, 8), color: 0xd9b170, matrix: matrix({ pos: [bx, footY + 1.71, bz] }) });
  const hand = new THREE.Vector3(0.32, footY + 1.12, bz - 0.05);
  cylinderBetween(parts, new THREE.Vector3(bx - 0.2, footY + 1.34, bz), hand, 0.055, 0x9a6338);
  cylinderBetween(parts, new THREE.Vector3(bx + 0.2, footY + 1.34, bz), hand, 0.055, 0x9a6338);

  return { footY, hand };
}

export function createBoat({ trim = 0xd8402f, flagColor = null, name = '' } = {}) {
  const group = new THREE.Group();
  const parts = [];
  const { hand } = buildHullParts(parts, trim);

  const hullMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  const hull = new THREE.Mesh(mergeParts(parts), hullMat);
  hull.castShadow = false;
  group.add(hull);

  // flag pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.5, 6), new THREE.MeshLambertMaterial({ color: 0x6d4526 }));
  pole.position.set(0, 1.75, -2.55);
  group.add(pole);

  const flagTex = flagColor ? flagTexture(flagColor) : bdFlagTexture();
  const flagGeo = new THREE.PlaneGeometry(0.82, 0.48, 6, 2);
  flagGeo.translate(0.5, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide, toneMapped: true }));
  flag.position.set(0.04, 2.3, -2.55);
  group.add(flag);

  // paddling oar
  const paddle = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.4, 5), new THREE.MeshLambertMaterial({ color: 0xb98a50 }));
  shaft.position.y = -1.2;
  paddle.add(shaft);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.78, 0.06), new THREE.MeshLambertMaterial({ color: 0x8d6134 }));
  blade.position.y = -2.32;
  paddle.add(blade);
  paddle.position.copy(hand);
  paddle.rotation.x = -0.65;
  group.add(paddle);

  // soft contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 5.6),
    new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x062220, transparent: true, opacity: 0.34, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.08;
  group.add(shadow);

  group.userData = { paddle, flag, name };
  return { group, paddle, flag };
}

const tmpPos = new THREE.Vector3();

export function updateBoatVisual(boat, time) {
  const { paddle, flag } = boat;
  const speed = boat.speed || 0;
  const stroke = time * (2.0 + speed * 0.1) + (boat.phase || 0);
  paddle.rotation.x = -0.62 + Math.sin(stroke) * 0.42;
  paddle.rotation.y = Math.sin(stroke * 0.5) * 0.16 + 0.1;

  const pos = flag.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin(x * 7 - time * 9) * 0.12 * x);
  }
  pos.needsUpdate = true;
}
