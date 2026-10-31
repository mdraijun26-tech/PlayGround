import * as THREE from '../vendor/three.module.js'

const MAX = 180

export class Particles {
  constructor(scene, texture) {
    this.items = []
    this.positions = new Float32Array(MAX * 3)
    this.colors = new Float32Array(MAX * 3)
    this.positions.fill(-999)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map: texture,
        size: 0.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    )
    this.points.frustumCulled = false
    scene.add(this.points)

    for (let i = 0; i < MAX; i++) {
      this.items.push({ active: false, life: 0, maxLife: 1, x: 0, y: -999, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, gravity: 0 })
    }
    this.cursor = 0
  }

  emit(x, y, z, color, count = 12, power = 3, life = 0.6, gravity = 4) {
    const c = new THREE.Color(color)
    for (let n = 0; n < count; n++) {
      const item = this.items[this.cursor]
      this.cursor = (this.cursor + 1) % MAX
      const angle = Math.random() * Math.PI * 2
      const elevation = (Math.random() - 0.2) * 1.6
      const speed = power * (0.35 + Math.random() * 0.9)
      item.active = true
      item.life = life * (0.65 + Math.random() * 0.6)
      item.maxLife = item.life
      item.x = x
      item.y = y
      item.z = z
      item.vx = Math.cos(angle) * speed * Math.cos(elevation)
      item.vy = Math.sin(elevation) * speed + power * 0.4
      item.vz = Math.sin(angle) * speed * Math.cos(elevation)
      item.r = c.r
      item.g = c.g
      item.b = c.b
      item.gravity = gravity
    }
  }

  update(dt, worldSpeed = 0) {
    for (let i = 0; i < MAX; i++) {
      const item = this.items[i]
      if (!item.active) {
        if (this.positions[i * 3 + 1] !== -999) {
          this.positions[i * 3 + 1] = -999
          this.colors[i * 3] = 0
          this.colors[i * 3 + 1] = 0
          this.colors[i * 3 + 2] = 0
        }
        continue
      }
      item.life -= dt
      if (item.life <= 0) {
        item.active = false
        this.positions[i * 3 + 1] = -999
        this.colors[i * 3] = 0
        this.colors[i * 3 + 1] = 0
        this.colors[i * 3 + 2] = 0
        continue
      }
      item.vy -= item.gravity * dt
      item.x += item.vx * dt
      item.y += item.vy * dt
      item.z += (item.vz + worldSpeed * 0.75) * dt
      const fade = Math.min(1, item.life / item.maxLife)
      this.positions[i * 3] = item.x
      this.positions[i * 3 + 1] = item.y
      this.positions[i * 3 + 2] = item.z
      this.colors[i * 3] = item.r * fade
      this.colors[i * 3 + 1] = item.g * fade
      this.colors[i * 3 + 2] = item.b * fade
    }
    this.points.geometry.attributes.position.needsUpdate = true
    this.points.geometry.attributes.color.needsUpdate = true
  }

  clear() {
    for (const item of this.items) item.active = false
    this.positions.fill(-999)
    this.points.geometry.attributes.position.needsUpdate = true
  }
}
