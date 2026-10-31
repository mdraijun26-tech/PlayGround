import * as THREE from '../vendor/three.module.js'

const FONT = '"Hind Siliguri", sans-serif'

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return [canvas, canvas.getContext('2d')]
}

function makeTexture(canvas, { repeatX = 1, repeatY = 1 } = {}) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeatX, repeatY)
  texture.anisotropy = 4
  return texture
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function asphalt() {
  const [canvas, ctx] = makeCanvas(256, 256)
  const rng = mulberry32(7)
  ctx.fillStyle = '#26242c'
  ctx.fillRect(0, 0, 256, 256)

  for (let i = 0; i < 5200; i++) {
    const x = rng() * 256
    const y = rng() * 256
    const shade = 26 + rng() * 44
    ctx.fillStyle = `rgba(${shade},${shade - 2},${shade + 5},${0.25 + rng() * 0.5})`
    ctx.fillRect(x, y, 1 + rng() * 2, 1 + rng() * 2)
  }

  for (let i = 0; i < 7; i++) {
    ctx.strokeStyle = 'rgba(12,11,16,0.55)'
    ctx.lineWidth = 1 + rng() * 1.5
    ctx.beginPath()
    let x = rng() * 256
    let y = 0
    ctx.moveTo(x, y)
    while (y < 256) {
      y += 8 + rng() * 18
      x += (rng() - 0.5) * 18
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = 'rgba(60,56,64,0.16)'
    ctx.fillRect(rng() * 256, rng() * 256, 30 + rng() * 70, 18 + rng() * 40)
  }

  return makeTexture(canvas, { repeatX: 2, repeatY: 48 })
}

function sidewalk() {
  const [canvas, ctx] = makeCanvas(128, 128)
  const rng = mulberry32(11)
  ctx.fillStyle = '#8a7668'
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(48,38,34,0.55)'
  ctx.lineWidth = 3
  ctx.strokeRect(1, 1, 126, 126)
  ctx.beginPath()
  ctx.moveTo(64, 0)
  ctx.lineTo(64, 128)
  ctx.moveTo(0, 64)
  ctx.lineTo(128, 64)
  ctx.stroke()
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = `rgba(${40 + rng() * 40},${32 + rng() * 30},${28 + rng() * 26},0.18)`
    ctx.fillRect(rng() * 128, rng() * 128, 1 + rng() * 3, 1 + rng() * 3)
  }
  return makeTexture(canvas, { repeatX: 1, repeatY: 90 })
}

function posterWall() {
  const [canvas, ctx] = makeCanvas(512, 256)
  const rng = mulberry32(23)
  const base = ctx.createLinearGradient(0, 0, 0, 256)
  base.addColorStop(0, '#a58a72')
  base.addColorStop(0.55, '#8d735f')
  base.addColorStop(1, '#6f594a')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 256)

  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${40 + rng() * 50},${30 + rng() * 40},${20 + rng() * 30},${0.03 + rng() * 0.1})`
    ctx.beginPath()
    ctx.arc(rng() * 512, rng() * 256, 1 + rng() * 7, 0, Math.PI * 2)
    ctx.fill()
  }

  // damp patches
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 3; j++) {
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 50)
      grad.addColorStop(0, 'rgba(40,28,22,0.16)')
      grad.addColorStop(1, 'rgba(40,28,22,0)')
      ctx.save()
      ctx.translate(30 + rng() * 450, 50 + rng() * 180)
      ctx.scale(1, 2.4)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(0, 0, 50, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
      break
    }
  }

  const posters = [
    { x: 18, y: 30, w: 96, h: 128, bg: '#f6e7c1', ink: '#c0392b', text: 'চা\nদোকান', rot: -0.03 },
    { x: 128, y: 46, w: 110, h: 96, bg: '#2a9d8f', ink: '#fdf6e3', text: 'রিকশা\nচলবে', rot: 0.02 },
    { x: 258, y: 22, w: 90, h: 138, bg: '#e9c46a', ink: '#7f2b1f', text: 'মিষ্টি\nঘরে', rot: -0.015 },
    { x: 366, y: 58, w: 122, h: 104, bg: '#1d3557', ink: '#f1faee', text: 'ঢাকা\nবাজারে', rot: 0.025 },
    { x: 36, y: 168, w: 118, h: 66, bg: '#e76f51', ink: '#fff7ea', text: 'বাংলার\nরং', rot: 0.01 },
    { x: 186, y: 158, w: 128, h: 78, bg: '#f4f1e8', ink: '#1d6b4f', text: 'স্বাগতম\nঢাকা', rot: -0.02 },
    { x: 344, y: 172, w: 116, h: 62, bg: '#6d597a', ink: '#ffe8b6', text: 'স্কুল\nরোড', rot: 0.02 },
  ]

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const p of posters) {
    ctx.save()
    ctx.translate(p.x + p.w / 2, p.y + p.h / 2)
    ctx.rotate(p.rot)
    ctx.fillStyle = 'rgba(30,20,15,0.25)'
    ctx.fillRect(-p.w / 2 + 4, -p.h / 2 + 5, p.w, p.h)
    ctx.fillStyle = p.bg
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
    ctx.strokeStyle = 'rgba(255,250,235,0.5)'
    ctx.lineWidth = 2
    ctx.strokeRect(-p.w / 2 + 5, -p.h / 2 + 5, p.w - 10, p.h - 10)
    ctx.fillStyle = p.ink
    ctx.font = `700 ${Math.min(26, p.h / 2.7)}px ${FONT}`
    const lines = p.text.split('\n')
    lines.forEach((line, index) => {
      ctx.fillText(line, 0, (index - (lines.length - 1) / 2) * (p.h / 3))
    })
    // tape
    ctx.fillStyle = 'rgba(250,245,220,0.55)'
    ctx.fillRect(-p.w / 2 + 8, -p.h / 2 - 4, 22, 9)
    ctx.fillRect(p.w / 2 - 30, p.h / 2 - 4, 22, 9)
    ctx.restore()
  }

  return makeTexture(canvas, { repeatX: 18, repeatY: 1 })
}

function rickshawArt() {
  const [canvas, ctx] = makeCanvas(512, 384)
  const cx = 256
  const cy = 186

  const bg = ctx.createLinearGradient(0, 0, 0, 384)
  bg.addColorStop(0, '#d21f3c')
  bg.addColorStop(0.5, '#b3122c')
  bg.addColorStop(1, '#8b0d24')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 512, 384)

  // gold border
  ctx.strokeStyle = '#f7c948'
  ctx.lineWidth = 14
  ctx.strokeRect(16, 16, 480, 352)
  ctx.strokeStyle = '#0aa06e'
  ctx.lineWidth = 4
  ctx.strokeRect(36, 36, 440, 312)

  // corner diamonds
  for (const [x, y] of [[52, 52], [460, 52], [52, 332], [460, 332]]) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = '#f7c948'
    ctx.fillRect(-13, -13, 26, 26)
    ctx.fillStyle = '#0b6e4f'
    ctx.fillRect(-6, -6, 12, 12)
    ctx.restore()
  }

  // petal rings
  const rings = [
    { count: 18, r: 150, len: 44, width: 22, color: '#0aa06e' },
    { count: 14, r: 112, len: 40, width: 20, color: '#f7c948' },
    { count: 10, r: 78, len: 34, width: 18, color: '#f473b9' },
  ]
  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(angle)
      ctx.fillStyle = ring.color
      ctx.beginPath()
      ctx.ellipse(0, -ring.r, ring.width / 2, ring.len / 2, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.restore()
    }
  }

  // centre medallion
  const center = ctx.createRadialGradient(cx, cy, 4, cx, cy, 62)
  center.addColorStop(0, '#fff4c2')
  center.addColorStop(0.55, '#f7c948')
  center.addColorStop(1, '#e07a1f')
  ctx.fillStyle = center
  ctx.beginPath()
  ctx.arc(cx, cy, 62, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#0aa06e'
  for (let i = 0; i < 8; i++) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((i / 8) * Math.PI * 2)
    ctx.beginPath()
    ctx.ellipse(0, -28, 10, 20, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = '#b3122c'
  ctx.beginPath()
  ctx.arc(cx, cy, 15, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff4c2'
  ctx.beginPath()
  ctx.arc(cx, cy, 6, 0, Math.PI * 2)
  ctx.fill()

  // banner text
  ctx.font = `700 34px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(20,4,10,0.35)'
  ctx.fillRect(122, 300, 268, 52)
  ctx.fillStyle = '#ffe9a8'
  ctx.fillText('ঢাকা রিকশা', cx, 328)

  // scalloped valance
  ctx.fillStyle = '#f7c948'
  for (let x = 16; x < 496; x += 32) {
    ctx.beginPath()
    ctx.arc(x + 16, 368, 16, 0, Math.PI)
    ctx.fill()
  }

  return makeTexture(canvas)
}

function busSide() {
  const [canvas, ctx] = makeCanvas(512, 256)
  ctx.fillStyle = '#0c7a4d'
  ctx.fillRect(0, 0, 512, 256)

  // yellow belt
  ctx.fillStyle = '#f0b429'
  ctx.fillRect(0, 150, 512, 26)
  ctx.fillStyle = '#f7f3e3'
  ctx.fillRect(0, 104, 512, 8)

  // windows
  for (let i = 0; i < 7; i++) {
    const x = 18 + i * 69
    const grad = ctx.createLinearGradient(x, 34, x + 56, 92)
    grad.addColorStop(0, '#2b3a48')
    grad.addColorStop(0.5, '#587084')
    grad.addColorStop(0.75, '#b9d0d8')
    grad.addColorStop(1, '#31424f')
    ctx.fillStyle = grad
    ctx.fillRect(x, 34, 56, 58)
    ctx.strokeStyle = '#0a4b31'
    ctx.lineWidth = 4
    ctx.strokeRect(x, 34, 56, 58)
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.beginPath()
    ctx.moveTo(x + 8, 92)
    ctx.lineTo(x + 34, 34)
    ctx.lineTo(x + 48, 34)
    ctx.lineTo(x + 18, 92)
    ctx.fill()
  }

  ctx.fillStyle = '#0a5d3c'
  ctx.fillRect(0, 208, 512, 48)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.fillRect(0, 208, 512, 6)

  ctx.fillStyle = '#f7f3e3'
  ctx.font = `700 26px ${FONT}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('বিআরটিসি', 24, 232)
  ctx.font = `600 18px ${FONT}`
  ctx.fillStyle = '#f0b429'
  ctx.textAlign = 'right'
  ctx.fillText('ঢাকা মেট্রো', 488, 232)

  // grime
  ctx.fillStyle = 'rgba(20,10,5,0.14)'
  ctx.fillRect(0, 250, 512, 6)

  return makeTexture(canvas)
}

function busFront() {
  const [canvas, ctx] = makeCanvas(256, 256)
  ctx.fillStyle = '#0c7a4d'
  ctx.fillRect(0, 0, 256, 256)
  ctx.fillStyle = '#f0b429'
  ctx.fillRect(0, 190, 256, 16)

  // windshield
  const grad = ctx.createLinearGradient(0, 52, 0, 140)
  grad.addColorStop(0, '#9fc0cd')
  grad.addColorStop(0.45, '#4a6575')
  grad.addColorStop(1, '#22323d')
  ctx.fillStyle = grad
  ctx.fillRect(24, 50, 208, 94)
  ctx.strokeStyle = '#073d27'
  ctx.lineWidth = 6
  ctx.strokeRect(24, 50, 208, 94)
  ctx.fillStyle = '#073d27'
  ctx.fillRect(122, 50, 8, 94)

  // route sign
  ctx.fillStyle = '#16232b'
  ctx.fillRect(64, 14, 128, 28)
  ctx.fillStyle = '#ffcf6b'
  ctx.font = `700 20px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ঢাকা ⇄ সাভার', 128, 29)

  // headlights
  for (const x of [52, 204]) {
    const lamp = ctx.createRadialGradient(x, 226, 2, x, 226, 24)
    lamp.addColorStop(0, '#fff6cf')
    lamp.addColorStop(1, 'rgba(255,220,140,0)')
    ctx.fillStyle = lamp
    ctx.beginPath()
    ctx.arc(x, 226, 24, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f9e9b0'
    ctx.beginPath()
    ctx.arc(x, 226, 8, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = '#f7f3e3'
  ctx.font = `600 16px ${FONT}`
  ctx.fillText('ঢাকা', 128, 176)

  return makeTexture(canvas)
}

function building(seed, color) {
  const [canvas, ctx] = makeCanvas(256, 512)
  const rng = mulberry32(seed)
  const base = new THREE.Color(color)
  ctx.fillStyle = `#${base.getHexString()}`
  ctx.fillRect(0, 0, 256, 512)

  // vertical grime
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(30,20,20,${0.02 + rng() * 0.05})`
    ctx.fillRect(rng() * 256, 0, 2 + rng() * 12, 512)
  }

  const floors = 7
  const floorH = 58
  const shopTop = 512 - 92
  for (let f = 0; f < floors; f++) {
    const y = 18 + f * floorH
    if (y > shopTop - 30) break
    // floor slab
    ctx.fillStyle = 'rgba(30,22,26,0.18)'
    ctx.fillRect(0, y + floorH - 8, 256, 6)
    // balcony rail
    ctx.strokeStyle = 'rgba(30,24,26,0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, y + floorH - 12)
    ctx.lineTo(256, y + floorH - 12)
    ctx.stroke()

    for (let w = 0; w < 4; w++) {
      const x = 14 + w * 60
      const lit = rng() > 0.58
      const grad = ctx.createLinearGradient(x, y, x + 44, y + 38)
      if (lit) {
        grad.addColorStop(0, '#ffd98a')
        grad.addColorStop(1, '#d98a3d')
      } else {
        grad.addColorStop(0, '#2c3b48')
        grad.addColorStop(0.6, '#51646d')
        grad.addColorStop(1, '#22303a')
      }
      ctx.fillStyle = grad
      ctx.fillRect(x, y, 44, 38)
      ctx.strokeStyle = 'rgba(25,18,20,0.5)'
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, 44, 38)
      if (!lit && rng() > 0.5) {
        ctx.fillStyle = 'rgba(25,35,40,0.55)'
        ctx.fillRect(x + 4, y + 22, 36, 12)
      }
      // AC unit
      if (rng() > 0.72) {
        ctx.fillStyle = '#b8b3a6'
        ctx.fillRect(x + 8, y + 44, 24, 10)
        ctx.strokeStyle = 'rgba(20,15,15,0.5)'
        ctx.strokeRect(x + 8, y + 44, 24, 10)
      }
    }
  }

  // ground floor shops
  ctx.fillStyle = '#3a2b2b'
  ctx.fillRect(0, shopTop, 256, 92)
  const signs = [
    { text: 'চা ঘর', bg: '#e9c46a', ink: '#7a2318' },
    { text: 'মুদি দোকান', bg: '#2a9d8f', ink: '#f7f3e3' },
    { text: 'রিকশা গ্যারেজ', bg: '#e76f51', ink: '#fff6e5' },
  ]
  signs.forEach((s, i) => {
    const x = 6 + i * 84
    ctx.fillStyle = s.bg
    ctx.fillRect(x, shopTop + 6, 78, 26)
    ctx.fillStyle = s.ink
    ctx.font = `700 15px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.text, x + 39, shopTop + 19)
    ctx.fillStyle = 'rgba(18,14,14,0.65)'
    ctx.fillRect(x + 6, shopTop + 40, 66, 46)
    ctx.strokeStyle = 'rgba(255,220,160,0.35)'
    ctx.lineWidth = 2
    ctx.strokeRect(x + 6, shopTop + 40, 66, 46)
    if (rng() > 0.4) {
      ctx.fillStyle = 'rgba(255,205,120,0.3)'
      ctx.fillRect(x + 10, shopTop + 44, 58, 6)
    }
  })

  // rooftop rail
  ctx.fillStyle = 'rgba(35,25,25,0.35)'
  ctx.fillRect(0, 0, 256, 10)

  return makeTexture(canvas)
}

function flag() {
  const [canvas, ctx] = makeCanvas(300, 180)
  ctx.fillStyle = '#006a4e'
  ctx.fillRect(0, 0, 300, 180)
  ctx.fillStyle = '#f42a41'
  ctx.beginPath()
  ctx.arc(116, 90, 52, 0, Math.PI * 2)
  ctx.fill()
  return makeTexture(canvas)
}

function glow() {
  const [canvas, ctx] = makeCanvas(128, 128)
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.18, 'rgba(255,238,190,0.85)')
  grad.addColorStop(0.45, 'rgba(255,180,90,0.28)')
  grad.addColorStop(1, 'rgba(255,140,60,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  return makeTexture(canvas)
}

function shadow() {
  const [canvas, ctx] = makeCanvas(128, 128)
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62)
  grad.addColorStop(0, 'rgba(8,4,12,0.62)')
  grad.addColorStop(0.6, 'rgba(8,4,12,0.3)')
  grad.addColorStop(1, 'rgba(8,4,12,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  return makeTexture(canvas)
}

function puddle() {
  const [canvas, ctx] = makeCanvas(256, 128)
  ctx.clearRect(0, 0, 256, 128)
  const grad = ctx.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, 'rgba(255,196,132,0.85)')
  grad.addColorStop(0.45, 'rgba(178,112,138,0.75)')
  grad.addColorStop(1, 'rgba(52,38,80,0.85)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.ellipse(128, 64, 120, 56, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,235,205,0.4)'
  ctx.lineWidth = 2
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.ellipse(128, 64, 60 + i * 18, 22 + i * 8, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  return makeTexture(canvas)
}

function checkered() {
  const [canvas, ctx] = makeCanvas(64, 64)
  ctx.fillStyle = '#e7d8b6'
  ctx.fillRect(0, 0, 64, 64)
  ctx.fillStyle = '#1c7a6b'
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * 16, y * 16, 16, 16)
    }
  }
  return makeTexture(canvas)
}

function plate() {
  const [canvas, ctx] = makeCanvas(160, 56)
  ctx.fillStyle = '#111318'
  ctx.fillRect(0, 0, 160, 56)
  ctx.strokeStyle = '#efe6cf'
  ctx.lineWidth = 3
  ctx.strokeRect(3, 3, 154, 50)
  ctx.fillStyle = '#f3ecd9'
  ctx.font = `700 19px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('ঢাকা মেট্রো', 80, 20)
  ctx.font = `600 16px ${FONT}`
  ctx.fillText('১১-০০৭৯', 80, 39)
  return makeTexture(canvas)
}

export function createTextures() {
  return {
    asphalt: asphalt(),
    sidewalk: sidewalk(),
    wall: posterWall(),
    rickshawArt: rickshawArt(),
    busSide: busSide(),
    busFront: busFront(),
    buildings: [
      building(3, '#d9a07c'),
      building(9, '#c27a6c'),
      building(15, '#9fb9a3'),
      building(21, '#d7bd86'),
      building(33, '#b08fb8'),
    ],
    flag: flag(),
    glow: glow(),
    shadow: shadow(),
    puddle: puddle(),
    checkered: checkered(),
    plate: plate(),
  }
}
