import * as THREE from '../vendor/three.module.js'
import { extractFaces, mergeGroupByMaterial } from './merge.js'

const LANE_X = [-3.1, 0, 3.1]
const RECYCLE_Z = 16

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  return mesh
}

function wheel(radius, width, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 10), material)
  mesh.rotation.z = Math.PI / 2
  mesh.position.set(x, y, z)
  return mesh
}

function glowSprite(texture, color, size, opacity = 0.8) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  sprite.scale.set(size, size, 1)
  return sprite
}

export class Entities {
  constructor(scene, textures) {
    this.scene = scene
    this.textures = textures
    this.active = []
    this.pools = {}
    this.time = 0

    const tire = new THREE.MeshStandardMaterial({ color: 0x16151a, roughness: 0.9 })
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8b447, roughness: 0.4, metalness: 0.4 })
    const glass = new THREE.MeshStandardMaterial({ color: 0x3c5d6c, roughness: 0.2, metalness: 0.35 })
    const dark = new THREE.MeshStandardMaterial({ color: 0x24222a, roughness: 0.8 })
    this.mats = { tire, gold, glass, dark }

    this.factories = {
      bus: () => this.makeBus(),
      cng: () => this.makeCng(),
      cow: () => this.makeCow(),
      cone: () => this.makeCone(),
      pothole: () => this.makePothole(),
      mango: () => this.makeMango(),
      cha: () => this.makeCha(),
    }
  }

  makeBus() {
    const group = new THREE.Group()
    const side = new THREE.MeshStandardMaterial({ map: this.textures.busSide, roughness: 0.6, metalness: 0.15 })
    const front = new THREE.MeshStandardMaterial({ map: this.textures.busFront, roughness: 0.6, metalness: 0.15 })
    const roof = new THREE.MeshStandardMaterial({ color: 0x0a5d3c, roughness: 0.8 })
    const bodyGeo = new THREE.BoxGeometry(2.35, 2.5, 7)
    const bodySides = new THREE.Mesh(
      extractFaces(bodyGeo, (nx, ny, nz) => Math.abs(ny) < 0.5 && nz < 0.5),
      side,
    )
    const bodyFront = new THREE.Mesh(extractFaces(bodyGeo, (nx, ny, nz) => nz > 0.5), front)
    const bodyCaps = new THREE.Mesh(extractFaces(bodyGeo, (nx, ny, nz) => Math.abs(ny) > 0.5), roof)
    for (const mesh of [bodySides, bodyFront, bodyCaps]) {
      mesh.position.y = 1.55
      group.add(mesh)
    }

    group.add(box(2.4, 0.18, 0.2, this.mats.dark, 0, 0.38, 3.52))
    for (const x of [-1.12, 1.12]) {
      for (const z of [-2.25, 2.25]) {
        group.add(wheel(0.38, 0.26, this.mats.tire, x, 0.38, z))
      }
    }
    const halo = glowSprite(this.textures.glow, 0xffdca3, 1.9, 0.55)
    halo.scale.set(2.6, 1.4, 1)
    halo.position.set(0, 0.95, 3.55)
    group.add(halo)
    group.add(box(1.6, 0.35, 2.4, this.mats.dark, 0, 2.98, 0.4))
    mergeGroupByMaterial(group)

    group.userData = { kind: 'bus', hw: 1.18, hd: 3.5, jumpable: false, top: 3.1 }
    return group
  }

  makeCng() {
    const group = new THREE.Group()
    const green = new THREE.MeshStandardMaterial({ color: 0x107a4b, roughness: 0.55 })
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf0b429, roughness: 0.55 })
    const body = box(1.5, 1.15, 2.5, green, 0, 0.88, 0)
    group.add(body)
    const roof = box(1.54, 0.16, 2.2, yellow, 0, 1.53, -0.05)
    group.add(roof)
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.66), this.mats.glass)
    windshield.position.set(0, 1.22, 1.26)
    group.add(windshield)
    const stripe = box(1.52, 0.1, 2.52, yellow, 0, 0.72, 0)
    group.add(stripe)
    group.add(wheel(0.28, 0.18, this.mats.tire, -0.72, 0.28, 0.82))
    group.add(wheel(0.28, 0.18, this.mats.tire, 0.72, 0.28, 0.82))
    group.add(wheel(0.26, 0.18, this.mats.tire, 0, 0.26, -0.95))
    const sign = box(0.7, 0.2, 0.04, this.mats.dark, 0, 1.44, 1.28)
    group.add(sign)
    const halo = glowSprite(this.textures.glow, 0xffe6b0, 1.1, 0.65)
    halo.scale.set(1.4, 0.7, 1)
    halo.position.set(0, 0.66, 1.3)
    group.add(halo)
    mergeGroupByMaterial(group)
    group.userData = { kind: 'cng', hw: 0.82, hd: 1.35, jumpable: false, top: 1.75 }
    return group
  }

  makeCow() {
    const group = new THREE.Group()
    const white = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.9 })
    const brown = new THREE.MeshStandardMaterial({ color: 0x8a5432, roughness: 0.9 })
    const horn = new THREE.MeshStandardMaterial({ color: 0xd9c9a2, roughness: 0.7 })
    const body = box(0.85, 0.82, 1.55, white, 0, 0.98, 0)
    group.add(body)
    const head = box(0.44, 0.42, 0.44, white, 0, 1.2, 0.92)
    group.add(head)
    const snout = box(0.34, 0.22, 0.2, brown, 0, 1.08, 1.14)
    group.add(snout)
    for (const x of [-0.16, 0.16]) {
      const ear = box(0.16, 0.08, 0.1, brown, x * 1.9, 1.36, 0.88)
      group.add(ear)
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 5), horn)
      h.position.set(x, 1.48, 0.92)
      h.rotation.z = x > 0 ? -0.3 : 0.3
      group.add(h)
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), this.mats.dark)
      eye.position.set(x, 1.25, 1.14)
      group.add(eye)
    }
    for (const x of [-0.28, 0.28]) {
      for (const z of [-0.52, 0.52]) {
        group.add(box(0.13, 0.6, 0.13, white, x, 0.3, z))
      }
    }
    const tail = box(0.06, 0.6, 0.06, brown, 0, 1.0, -0.82)
    tail.rotation.x = 0.35
    group.add(tail)
    for (let i = 0; i < 3; i++) {
      const patch = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 6), brown)
      patch.scale.set(1, 0.7, 1.2)
      patch.position.set(-0.3 + i * 0.3, 1.05 + (i % 2) * 0.22, -0.4 + i * 0.35)
      group.add(patch)
    }
    mergeGroupByMaterial(group)
    group.userData = { kind: 'cow', hw: 0.62, hd: 0.95, jumpable: true, top: 1.5 }
    return group
  }

  makeCone() {
    const group = new THREE.Group()
    const orange = new THREE.MeshStandardMaterial({ color: 0xe8571f, roughness: 0.7 })
    const white = new THREE.MeshStandardMaterial({ color: 0xf5eee0, roughness: 0.7 })
    const base = box(0.62, 0.06, 0.62, this.mats.dark, 0, 0.03, 0)
    group.add(base)
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.72, 10), orange)
    cone.position.y = 0.42
    group.add(cone)
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.14, 10, 1, true), white)
    band.position.y = 0.46
    group.add(band)
    mergeGroupByMaterial(group)
    group.userData = { kind: 'cone', hw: 0.38, hd: 0.38, jumpable: true, top: 0.8 }
    return group
  }

  makePothole() {
    const group = new THREE.Group()
    const rim = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 14),
      new THREE.MeshStandardMaterial({ color: 0x4a4046, roughness: 1 }),
    )
    rim.rotation.x = -Math.PI / 2
    rim.position.y = 0.012
    group.add(rim)
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 12),
      new THREE.MeshBasicMaterial({ color: 0x0b080e }),
    )
    hole.rotation.x = -Math.PI / 2
    hole.position.y = 0.016
    group.add(hole)
    group.userData = { kind: 'pothole', hw: 0.62, hd: 0.62, jumpable: true, top: 0.1 }
    return group
  }

  makeMango() {
    const group = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffb01f,
      roughness: 0.35,
      metalness: 0.05,
      emissive: 0xff8a00,
      emissiveIntensity: 0.55,
    })
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), mat)
    fruit.scale.set(1, 1.16, 0.84)
    fruit.rotation.z = 0.35
    group.add(fruit)
    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 7, 5),
      new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.8 }),
    )
    leaf.scale.set(1, 0.24, 0.55)
    leaf.position.set(0.05, 0.36, 0)
    leaf.rotation.z = -0.5
    group.add(leaf)
    const stem = box(0.03, 0.14, 0.03, this.mats.dark, -0.04, 0.31, 0)
    stem.rotation.z = 0.4
    group.add(stem)
    const halo = glowSprite(this.textures.glow, 0xffc356, 0.85, 0.4)
    group.add(halo)
    mergeGroupByMaterial(group)
    group.userData = { kind: 'mango', hw: 0.4, hd: 0.4, jumpable: false, top: 1 }
    return group
  }

  makeCha() {
    const group = new THREE.Group()
    const clay = new THREE.MeshStandardMaterial({ color: 0xb35c38, roughness: 0.8 })
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.13, 0.28, 12), clay)
    group.add(cup)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 5, 14), clay)
    rim.rotation.x = Math.PI / 2
    rim.position.y = 0.14
    group.add(rim)
    const tea = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 12),
      new THREE.MeshStandardMaterial({ color: 0x6b2f14, roughness: 0.3 }),
    )
    tea.rotation.x = -Math.PI / 2
    tea.position.y = 0.145
    group.add(tea)
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.03, 14), clay)
    saucer.position.y = -0.16
    group.add(saucer)
    const halo = glowSprite(this.textures.glow, 0xffe6a8, 1.5, 0.6)
    group.add(halo)
    mergeGroupByMaterial(group)
    group.userData = { kind: 'cha', hw: 0.4, hd: 0.4, jumpable: false, top: 1 }
    return group
  }

  spawn(kind, lane, z, options = {}) {
    const factory = this.factories[kind]
    if (!factory) return null
    const pool = (this.pools[kind] ||= [])
    const mesh = pool.pop() || factory()
    const laneX = LANE_X[lane] + (options.xOffset || 0)
    mesh.position.set(laneX, 0, z)
    mesh.rotation.y = options.rotation || 0
    mesh.visible = true
    this.scene.add(mesh)
    const entry = {
      mesh,
      kind,
      lane,
      baseY: options.baseY ?? 1.05,
      phase: Math.random() * Math.PI * 2,
      ...mesh.userData,
    }
    if (kind === 'mango' || kind === 'cha') {
      mesh.position.y = entry.baseY
    }
    this.active.push(entry)
    return entry
  }

  release(entry) {
    const index = this.active.indexOf(entry)
    if (index >= 0) this.active.splice(index, 1)
    this.scene.remove(entry.mesh)
    entry.mesh.visible = false
    ;(this.pools[entry.kind] ||= []).push(entry.mesh)
  }

  clear() {
    for (const entry of [...this.active]) this.release(entry)
  }

  update(dt, speed) {
    this.time += dt
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i]
      entry.mesh.position.z += speed * dt
      if (entry.kind === 'mango' || entry.kind === 'cha') {
        entry.mesh.rotation.y += dt * (entry.kind === 'cha' ? 0.9 : 2.2)
        entry.mesh.position.y = entry.baseY + Math.sin(this.time * 3 + entry.phase) * 0.1
        if (entry.kind === 'cha') entry.mesh.position.y += 0.15
      }
      if (entry.mesh.position.z > RECYCLE_Z) this.release(entry)
    }
  }
}

export { LANE_X }
