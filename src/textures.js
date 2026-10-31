import * as THREE from 'three';

const BENGALI_FONT = '"Hind Siliguri", "Noto Sans Bengali", sans-serif';

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function textureFrom(canvas, { repeatX = 1, repeatY = 1, colorSpace = true } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function noise(ctx, width, height, amount = 2200, alpha = 0.05) {
  for (let i = 0; i < amount; i++) {
    const shade = Math.random() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${Math.random() * alpha})`;
    ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 3 + 1, Math.random() * 3 + 1);
  }
}

export function makeRoadTexture() {
  const w = 512;
  const h = 1024;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const grd = ctx.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, '#241f25');
  grd.addColorStop(0.5, '#2e282e');
  grd.addColorStop(1, '#241f25');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, 9000, 0.07);

  // patchy repairs
  for (let i = 0; i < 9; i++) {
    ctx.fillStyle = `rgba(${rand(20, 40) | 0},${rand(18, 34) | 0},${rand(20, 36) | 0},0.5)`;
    ctx.beginPath();
    ctx.ellipse(rand(0, w), rand(0, h), rand(18, 80), rand(30, 120), rand(0, 6), 0, Math.PI * 2);
    ctx.fill();
  }

  // lane boundaries at 1/3 and 2/3 (three lanes)
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255, 238, 198, 0.68)';
  ctx.setLineDash([54, 42]);
  for (const x of [w / 3, (w * 2) / 3]) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // edge lines
  ctx.fillStyle = 'rgba(255, 196, 92, 0.72)';
  ctx.fillRect(10, 0, 5, h);
  ctx.fillRect(w - 15, 0, 5, h);

  // cracks
  ctx.strokeStyle = 'rgba(8, 5, 9, 0.45)';
  for (let i = 0; i < 26; i++) {
    ctx.lineWidth = rand(0.6, 1.8);
    ctx.beginPath();
    let x = rand(0, w);
    let y = rand(0, h);
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += rand(-22, 22);
      y += rand(8, 42);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // worn tire tracks
  for (const x of [w * 0.16, w * 0.5, w * 0.84]) {
    const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 40, 0, 80, h);
  }

  return textureFrom(c, { repeatX: 1, repeatY: 26 });
}

export function makeSidewalkTexture() {
  const c = makeCanvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6e5d55';
  ctx.fillRect(0, 0, 256, 256);
  noise(ctx, 256, 256, 1500, 0.09);
  ctx.strokeStyle = 'rgba(30, 22, 26, 0.55)';
  ctx.lineWidth = 3;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
  }
  for (let y = 0; y <= 256; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(24, 16, 20, 0.18)';
  for (let i = 0; i < 18; i++) ctx.fillRect(rand(0, 256), rand(0, 256), rand(4, 18), rand(4, 18));
  return textureFrom(c, { repeatX: 2, repeatY: 40 });
}

const FACADE_PALETTE = [
  ['#b06a5a', '#7a3f3a'],
  ['#4f8f86', '#2f5f58'],
  ['#c29a62', '#8a6538'],
  ['#8f7aa8', '#5f4d76'],
  ['#cbb391', '#8f7958'],
  ['#7f9a7a', '#556f50'],
  ['#a85a48', '#6c3428'],
  ['#6f86a8', '#4a5f7a'],
];

export function makeFacadeTexture(variant = 0) {
  const w = 256;
  const h = 512;
  const c = makeCanvas(w, h);
  const e = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const ectx = e.getContext('2d');
  const [base, dark] = FACADE_PALETTE[variant % FACADE_PALETTE.length];
  ectx.fillStyle = '#000';
  ectx.fillRect(0, 0, w, h);

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, base);
  g.addColorStop(0.65, dark);
  g.addColorStop(1, '#2c2027');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, 4200, 0.08);

  // concrete banding
  ctx.fillStyle = 'rgba(255, 240, 214, 0.055)';
  for (let y = 30; y < h; y += 64) ctx.fillRect(0, y, w, 5);

  const cols = 4;
  const rows = 10;
  const cellW = w / cols;
  const cellH = (h - 30) / rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellW + 15;
      const y = 24 + row * cellH + 12;
      const ww = cellW - 30;
      const wh = cellH - 26;
      const lit = Math.random() < 0.38;
      const litColor = Math.random() < 0.14 ? '#9fe8ff' : Math.random() > 0.5 ? '#ffc978' : '#ffdda1';
      ctx.fillStyle = lit ? litColor : '#161a24';
      ctx.fillRect(x, y, ww, wh);
      if (lit) {
        ectx.fillStyle = litColor;
        ectx.fillRect(x, y, ww, wh);
      }
      // window frame
      ctx.strokeStyle = 'rgba(15, 10, 14, 0.6)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, ww, wh);
      ctx.fillStyle = 'rgba(20, 14, 18, 0.5)';
      ctx.fillRect(x + ww / 2 - 1, y, 2, wh);
      // grill / balcony on some
      if (row % 3 === 1) {
        ctx.fillStyle = 'rgba(24, 18, 22, 0.8)';
        ctx.fillRect(x - 6, y + wh + 3, ww + 12, 5);
        ctx.strokeStyle = 'rgba(255, 244, 222, 0.12)';
        ctx.lineWidth = 1.5;
        for (let bx = x - 2; bx < x + ww + 2; bx += 8) {
          ctx.beginPath(); ctx.moveTo(bx, y + wh - 14); ctx.lineTo(bx, y + wh + 3); ctx.stroke();
        }
      }
      // AC unit
      if (Math.random() < 0.14) {
        ctx.fillStyle = '#c9c1b2';
        ctx.fillRect(x + ww - 24, y + wh + 8, 22, 14);
        ctx.fillStyle = 'rgba(20, 14, 18, 0.5)';
        ctx.fillRect(x + ww - 22, y + wh + 11, 18, 3);
      }
    }
  }

  // grime streaks
  for (let i = 0; i < 16; i++) {
    const x = rand(0, w);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(20, 14, 18, 0.02)');
    grad.addColorStop(1, 'rgba(20, 14, 18, 0.24)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, rand(0, 80), rand(2, 8), h);
  }

  // rooftop parapet
  ctx.fillStyle = 'rgba(16, 11, 16, 0.55)';
  ctx.fillRect(0, 0, w, 12);

  return {
    map: textureFrom(c, { repeatX: 1, repeatY: 1 }),
    emissiveMap: textureFrom(e, { repeatX: 1, repeatY: 1 }),
  };
}

export function makeSignTexture(text, { bg = '#131a2a', fg = '#ffcf6e', accent = '#ff5a36', vertical = false } = {}) {
  const w = vertical ? 128 : 512;
  const h = vertical ? 512 : 160;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = accent;
  ctx.lineWidth = vertical ? 8 : 7;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.strokeStyle = 'rgba(255, 244, 222, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, w - 36, h - 36);

  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = fg;
  ctx.shadowBlur = 18;

  if (vertical) {
    const chars = [...text];
    const size = Math.min(64, (h - 60) / chars.length);
    ctx.font = `700 ${size}px ${BENGALI_FONT}`;
    chars.forEach((ch, i) => {
      ctx.fillText(ch, w / 2, 40 + size * (i + 0.5) + (h - 60 - size * chars.length) / 2);
    });
  } else {
    let size = 78;
    ctx.font = `700 ${size}px ${BENGALI_FONT}`;
    while (ctx.measureText(text).width > w - 60 && size > 26) {
      size -= 4;
      ctx.font = `700 ${size}px ${BENGALI_FONT}`;
    }
    ctx.fillText(text, w / 2, h / 2 + 4);
  }

  return textureFrom(c);
}

export function makeRickshawArtTexture() {
  const s = 512;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8f1f2c';
  ctx.fillRect(0, 0, s, s);

  // sunburst
  ctx.save();
  ctx.translate(s / 2, s / 2);
  for (let i = 0; i < 24; i++) {
    ctx.rotate((Math.PI * 2) / 24);
    ctx.fillStyle = i % 2 ? 'rgba(255, 196, 92, 0.16)' : 'rgba(38, 211, 180, 0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -s);
    ctx.lineTo(34, -s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // concentric rings
  const rings = [
    [205, '#ffcf6e', 12],
    [176, '#26d3b4', 9],
    [148, '#ff4f87', 7],
    [122, '#ffcf6e', 5],
  ];
  for (const [r, color, width] of rings) {
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, r, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // petals
  ctx.save();
  ctx.translate(s / 2, s / 2);
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath();
    ctx.ellipse(0, -92, 22, 50, 0, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#ffcf6e' : '#f7f0dc';
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 10, 20, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // center medallion
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 54, 0, Math.PI * 2);
  ctx.fillStyle = '#122f33';
  ctx.fill();
  ctx.strokeStyle = '#ffcf6e';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = '#26d3b4';
  ctx.font = `700 56px ${BENGALI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ঢাকা', s / 2, s / 2 + 2);

  // corner flourishes
  for (const [x, y, rot] of [[0, 0, 0], [s, 0, Math.PI / 2], [s, s, Math.PI], [0, s, -Math.PI / 2]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = '#ffcf6e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(46, 46, 30, 0, Math.PI / 2);
    ctx.stroke();
    ctx.restore();
  }

  return textureFrom(c);
}

export function makeBannerTexture(text = 'সাবধান', sub = 'ধীরে চলুন') {
  const w = 1024;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5e6c8';
  ctx.fillRect(0, 0, w, h);

  // diagonal hazard stripes
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, 34);
  ctx.clip();
  for (let x = -40; x < w + 40; x += 48) {
    ctx.fillStyle = '#1b1b22';
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 24, 0); ctx.lineTo(x + 4, 34); ctx.lineTo(x - 20, 34);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, h - 34, w, 34);
  ctx.clip();
  for (let x = -40; x < w + 40; x += 48) {
    ctx.fillStyle = '#1b1b22';
    ctx.beginPath();
    ctx.moveTo(x, h); ctx.lineTo(x + 24, h); ctx.lineTo(x + 4, h - 34); ctx.lineTo(x - 20, h - 34);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#b4232c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 112px ${BENGALI_FONT}`;
  ctx.fillText(text, w / 2, h / 2 - 8);
  ctx.fillStyle = '#5a2418';
  ctx.font = `600 34px ${BENGALI_FONT}`;
  ctx.fillText(sub, w / 2, h / 2 + 66);

  return textureFrom(c);
}

export function makeBusTexture(primary = '#1f7a4f', secondary = '#ffcf6e', label = 'বাংলা পরিবহন') {
  const w = 1024;
  const h = 512;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, 2400, 0.07);

  // roof
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(0, 0, w, 46);
  ctx.fillStyle = secondary;
  ctx.fillRect(0, 46, w, 14);
  ctx.fillRect(0, h - 60, w, 22);

  // windows
  for (let i = 0; i < 7; i++) {
    const x = 42 + i * 138;
    ctx.fillStyle = '#182430';
    ctx.fillRect(x, 100, 110, 128);
    ctx.fillStyle = 'rgba(255, 206, 128, 0.22)';
    ctx.fillRect(x + 6, 106, 98, 40);
    ctx.strokeStyle = 'rgba(10, 8, 12, 0.6)';
    ctx.lineWidth = 6;
    ctx.strokeRect(x, 100, 110, 128);
  }

  // destination board
  ctx.fillStyle = '#10151e';
  ctx.fillRect(250, 262, 520, 60);
  ctx.fillStyle = '#ffd166';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 40px ${BENGALI_FONT}`;
  ctx.fillText(label, 510, 294);

  // stripes
  ctx.fillStyle = secondary;
  ctx.fillRect(0, 350, w, 26);
  ctx.fillStyle = '#e8452f';
  ctx.fillRect(0, 384, w, 12);

  // wheels shadows
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(210, 470, 100, 44, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(810, 470, 100, 44, 0, 0, Math.PI * 2); ctx.fill();

  // grime
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = `rgba(20, 14, 18, ${rand(0.03, 0.1)})`;
    ctx.fillRect(rand(0, w), rand(300, h), rand(20, 90), rand(10, 50));
  }

  return textureFrom(c);
}

export function makeShopTexture(text, bg = '#ff5a36', fg = '#fff4de') {
  const w = 512;
  const h = 128;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255, 244, 222, 0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 56px ${BENGALI_FONT}`;
  ctx.fillText(text, w / 2, h / 2 + 2);
  return textureFrom(c);
}

export function makeGlowTexture() {
  const s = 128;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,236,190,0.8)');
  g.addColorStop(0.45, 'rgba(255,150,60,0.25)');
  g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return textureFrom(c);
}

export function makeCloudTexture() {
  const w = 512;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = rand(60, w - 60);
    const y = rand(70, h - 70);
    const r = rand(26, 74);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255, 214, 176, ${rand(0.05, 0.16)})`);
    g.addColorStop(1, 'rgba(255, 214, 176, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return textureFrom(c);
}

export function makeSkylineTexture() {
  const w = 1024;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#2b1c33';
  let x = 0;
  while (x < w) {
    const bw = rand(26, 90);
    const bh = rand(50, 220);
    ctx.fillRect(x, h - bh, bw, bh);
    ctx.fillStyle = 'rgba(255, 196, 120, 0.5)';
    for (let wy = h - bh + 12; wy < h - 8; wy += 18) {
      for (let wx = x + 7; wx < x + bw - 6; wx += 14) {
        if (Math.random() < 0.35) ctx.fillRect(wx, wy, 4, 6);
      }
    }
    ctx.fillStyle = '#2b1c33';
    x += bw + rand(2, 12);
  }
  return textureFrom(c);
}

export function makeMangoLeafTexture() {
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#2f8f4e';
  ctx.beginPath();
  ctx.ellipse(32, 32, 14, 30, Math.PI / 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1d6b37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(22, 42); ctx.lineTo(42, 22);
  ctx.stroke();
  return textureFrom(c);
}

export function makeShopWindowTexture(variant = 0) {
  const w = 512;
  const h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const palettes = [
    ['#ffcf8a', '#c46a2e', '#5a2a18'],
    ['#ffe6b0', '#c98a3a', '#3f2418'],
    ['#b9f5e0', '#2f9a80', '#123a34'],
    ['#ffd0e0', '#c45078', '#3a1626'],
  ];
  const [light, mid, dark] = palettes[variant % palettes.length];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // ceiling bulbs
  for (let i = 0; i < 4; i++) {
    const x = 70 + i * 120;
    const rg = ctx.createRadialGradient(x, 40, 2, x, 40, 40);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)');
    rg.addColorStop(0.3, 'rgba(255,220,150,0.5)');
    rg.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - 40, 0, 80, 80);
  }

  // shelves
  ctx.fillStyle = 'rgba(40,20,14,0.55)';
  for (let y = 86; y < h; y += 44) ctx.fillRect(18, y, w - 36, 7);
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = `rgba(${rand(30, 240) | 0},${rand(30, 200) | 0},${rand(30, 180) | 0},0.8)`;
    const x = rand(24, w - 40);
    const y = 60 + ((Math.random() * 4) | 0) * 44;
    ctx.fillRect(x, y, rand(10, 26), rand(14, 28));
  }

  // counter silhouette
  ctx.fillStyle = 'rgba(26, 14, 12, 0.82)';
  ctx.fillRect(0, h - 56, w, 56);
  ctx.fillStyle = 'rgba(255, 236, 190, 0.35)';
  ctx.fillRect(0, h - 60, w, 4);

  // people silhouettes
  for (let i = 0; i < 2; i++) {
    const x = rand(120, w - 120);
    ctx.fillStyle = 'rgba(20, 12, 14, 0.7)';
    ctx.beginPath();
    ctx.arc(x, h - 98, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 24, h - 84, 48, 60);
  }

  // glass reflection
  const refl = ctx.createLinearGradient(0, 0, w, h);
  refl.addColorStop(0, 'rgba(255,255,255,0.16)');
  refl.addColorStop(0.4, 'rgba(255,255,255,0.02)');
  refl.addColorStop(0.62, 'rgba(255,255,255,0.12)');
  refl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = refl;
  ctx.fillRect(0, 0, w, h);

  // frame
  ctx.strokeStyle = 'rgba(24, 14, 14, 0.9)';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, w - 14, h - 14);
  ctx.strokeStyle = 'rgba(255, 220, 160, 0.25)';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, w - 32, h - 32);

  return textureFrom(c);
}
