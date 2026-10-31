import * as THREE from '../vendor/three.module.js';
import { clamp, lerp, wrap01 } from './util.js';

export function waveHeight(x, z, t) {
  return (
    0.22 * Math.sin(x * 0.45 + t * 1.25) +
    0.16 * Math.sin(z * 0.37 - t * 0.95) +
    0.08 * Math.sin(x * 0.72 + z * 0.55 + t * 1.9)
  );
}

export const CONTROL_POINTS = [
  [0, 40], [58, 12], [104, -44], [108, -115], [70, -172],
  [8, -200], [-58, -188], [-104, -136], [-100, -68], [-56, -18], [-22, 18],
];

export class RiverTrack {
  constructor() {
    const pts = CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    this.length = this.curve.getLength();
    this.N = 900;
    this.segLen = this.length / this.N;
    this.samples = [];
    this.tangents = [];
    this.widths = [];
    for (let i = 0; i < this.N; i++) {
      const u = i / this.N;
      const p = this.curve.getPointAt(u);
      const t = this.curve.getTangentAt(u).setY(0).normalize();
      this.samples.push(p);
      this.tangents.push(t);
      this.widths.push(this.halfWidth(u));
    }
  }

  halfWidth(u) {
    return 11.2 + 2.5 * Math.sin(wrap01(u) * Math.PI * 6 + 1.1) + 1.0 * Math.sin(wrap01(u) * Math.PI * 14 + 0.4);
  }

  sampleIndex(u) {
    const f = wrap01(u) * this.N;
    const i0 = Math.floor(f) % this.N;
    const i1 = (i0 + 1) % this.N;
    return { i0, i1, f: f - Math.floor(f) };
  }

  pointAt(u, offset = 0, out = new THREE.Vector3()) {
    const { i0, i1, f } = this.sampleIndex(u);
    const p0 = this.samples[i0];
    const p1 = this.samples[i1];
    out.set(lerp(p0.x, p1.x, f), 0, lerp(p0.z, p1.z, f));
    if (offset !== 0) {
      const t = this.tangentAt(u);
      out.x += t.z * offset;
      out.z += -t.x * offset;
    }
    return out;
  }

  tangentAt(u, out = new THREE.Vector3()) {
    const { i0, i1, f } = this.sampleIndex(u);
    const a = this.tangents[i0];
    const b = this.tangents[i1];
    return out.set(lerp(a.x, b.x, f), 0, lerp(a.z, b.z, f)).normalize();
  }

  nearest(pos, hint = -1) {
    const N = this.N;
    let best = 0;
    let bestD = Infinity;
    const test = (i) => {
      const p = this.samples[i];
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    };
    if (hint >= 0) {
      for (let k = -32; k <= 32; k++) test((hint + k + N) % N);
      if (bestD > 900) {
        bestD = Infinity;
        for (let i = 0; i < N; i += 2) test(i);
      }
    } else {
      for (let i = 0; i < N; i += 2) test(i);
      const loose = best;
      bestD = Infinity;
      for (let k = -3; k <= 3; k++) test((loose + k + N) % N);
    }

    const p = this.samples[best];
    const t = this.tangents[best];
    const along = (pos.x - p.x) * t.x + (pos.z - p.z) * t.z;
    const alongClamped = clamp(along, -this.segLen * 0.5, this.segLen * 0.5);
    const frac = alongClamped / this.segLen;
    const u = wrap01((best + frac) / N);
    const perp = Math.sqrt(Math.max(0, bestD - alongClamped * alongClamped));
    return { u, dist: perp, idx: best, along };
  }

  heightAt(x, z, distance, width) {
    const d = distance;
    const hw = width;
    if (d < hw + 0.7) return -2.0;
    let h = lerp(-0.4, 1.55, smooth(d, hw + 0.7, hw + 6.5));
    const bank = smooth(d, hw + 7, hw + 55);
    h += bank * (1.1 + noise2(x * 0.02 + 4.2, z * 0.02 - 1.7) * 2.6 + noise2(x * 0.06, z * 0.06) * 0.6);
    const far = smooth(d, 90, 280);
    h += far * (3.5 + noise2(x * 0.008 + 9, z * 0.008 + 3) * 11);
    return h;
  }
}

function smooth(x, a, b) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
