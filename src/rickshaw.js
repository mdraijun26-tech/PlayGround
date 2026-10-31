import * as THREE from '../vendor/three.module.js'
import { mergeGroupByMaterial } from './merge.js'

const UP = new THREE.Vector3(0, 1, 0)
const _a = new THREE.Vector3()
const _b = new THREE.Vector3()

function rod(a, b, radius, material, radialSegments = 6) {
  _a.set(a[0], a[1], a[2])
  _b.set(b[0], b[1], b[2])
  const dir = new THREE.Vector3().subVectors(_b, _a)
  const length = dir.length()
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, radialSegments),
    material,
  )
  mesh.position.copy(_a).addScaledVector(dir, 0.5)
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize())
  return mesh
}

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  return mesh
}

function makeWheel(radius, tireMat, hubMat) {
  const wheel = new THREE.Group()
  const tire = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.13, 6, 18), tireMat)
  tire.rotation.y = Math.PI / 2
  wheel.add(tire)

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.78, radius * 0.035, 4, 18), hubMat)
  rim.rotation.y = Math.PI / 2
  wheel.add(rim)

  const spokeCount = 7
  for (let i = 0; i < spokeCount; i++) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.04, radius * 1.62, radius * 0.04),
      hubMat,
    )
    spoke.rotation.x = (i / spokeCount) * Math.PI
    wheel.add(spoke)
  }

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.16, radius * 0.16, radius * 0.3, 8), hubMat)
  hub.rotation.z = Math.PI / 2
  wheel.add(hub)
  mergeGroupByMaterial(wheel)
  return wheel
}

export class Rickshaw {
  constructor(scene, textures) {
    this.scene = scene
    this.time = 0
    this.bellPulse = 0
    this.wheelSpin = 0
    this.group = new THREE.Group()
    this.tilt = new THREE.Group()
    this.model = new THREE.Group()
    this.group.add(this.tilt)
    this.tilt.add(this.model)

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x141319, roughness: 0.85 })
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xf4b93c,
      roughness: 0.32,
      metalness: 0.6,
      emissive: 0x3d2600,
      emissiveIntensity: 0.35,
    })
    const redMat = new THREE.MeshStandardMaterial({ color: 0xc21f3a, roughness: 0.52 })
    const greenMat = new THREE.MeshStandardMaterial({ color: 0x0b6e4f, roughness: 0.6 })
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xf3e2bd, roughness: 0.7 })
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x9a6134, roughness: 0.75 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x241d26, roughness: 0.8 })

    // ---- wheels ----------------------------------------------------------
    this.wheels = []
    const rearLeft = makeWheel(0.35, tireMat, goldMat)
    rearLeft.position.set(-0.9, 0.35, 0.6)
    const rearRight = makeWheel(0.35, tireMat, goldMat)
    rearRight.position.set(0.9, 0.35, 0.6)
    const front = makeWheel(0.31, tireMat, goldMat)
    front.position.set(0, 0.31, -0.82)
    this.wheels.push(rearLeft, rearRight, front)
    this.model.add(...this.wheels)

    this.model.add(rod([-0.9, 0.35, 0.6], [0.9, 0.35, 0.6], 0.035, goldMat))

    // ---- chassis & seat --------------------------------------------------
    this.model.add(box(1.28, 0.09, 1.32, darkMat, 0, 0.53, 0.18))
    this.model.add(box(1.34, 0.12, 0.16, goldMat, 0, 0.58, 0.86))
    this.model.add(box(1.18, 0.14, 0.62, redMat, 0, 0.82, 0.42))
    this.model.add(box(1.18, 0.58, 0.12, redMat, 0, 1.13, 0.76))
    this.model.add(box(1.24, 0.05, 0.66, creamMat, 0, 0.9, 0.42))

    for (const x of [-0.62, 0.62]) {
      this.model.add(rod([x, 0.34, 0.2], [x, 0.62, 0.62], 0.03, goldMat))
    }
    for (const z of [-0.5, 0.55]) {
      this.model.add(rod([0, 0.55, z], [0, 0.85, z - 0.12], 0.03, goldMat))
    }

    // ---- canopy ----------------------------------------------------------
    const artPanel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.06, 0.07), greenMat)
    artPanel.position.set(0, 1.55, 0.92)
    this.model.add(artPanel)

    const artPrint = new THREE.Mesh(
      new THREE.PlaneGeometry(1.46, 1.02),
      new THREE.MeshStandardMaterial({ map: textures.rickshawArt, roughness: 0.48, metalness: 0.05 }),
    )
    artPrint.position.set(0, 1.55, 0.958)
    this.model.add(artPrint)

    for (const [x, z] of [[-0.78, 0.14], [0.78, 0.14], [-0.78, 0.9], [0.78, 0.9]]) {
      this.model.add(rod([x, 0.62, z], [x, 1.98, z], 0.028, goldMat))
    }

    const roof = box(1.7, 0.075, 1.04, greenMat, 0, 2.02, 0.52)
    this.model.add(roof)
    this.model.add(box(1.78, 0.035, 1.1, goldMat, 0, 2.07, 0.52))
    for (const side of [-1, 1]) {
      const flap = box(0.46, 0.06, 1.04, greenMat, side * 0.95, 1.96, 0.52)
      flap.rotation.z = side * -0.32
      this.model.add(flap)
      const trim = box(0.48, 0.03, 1.08, goldMat, side * 0.99, 1.93, 0.52)
      trim.rotation.z = side * -0.32
      this.model.add(trim)
      const sidePanel = box(0.045, 0.62, 0.94, greenMat, side * 0.84, 1.4, 0.5)
      this.model.add(sidePanel)
      this.model.add(box(0.05, 0.06, 0.98, goldMat, side * 0.85, 1.71, 0.5))
    }

    // fringe under the art panel
    for (let i = 0; i < 11; i++) {
      const tassel = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), goldMat)
      tassel.position.set(-0.68 + i * 0.136, 0.99, 0.94)
      this.model.add(tassel)
    }

    // little Bangladesh flag
    const flagPole = rod([0.8, 2.06, 0.96], [0.8, 2.52, 0.96], 0.014, goldMat)
    this.model.add(flagPole)
    this.flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.18),
      new THREE.MeshStandardMaterial({ map: textures.flag, side: THREE.DoubleSide, roughness: 0.8 }),
    )
    this.flag.position.set(0.8 - 0.152, 2.42, 0.96)
    this.flag.rotation.y = Math.PI / 2
    this.model.add(this.flag)

    // tail lamps
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff2a10, emissiveIntensity: 2.2 })
    for (const x of [-0.56, 0.56]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), tailMat)
      lamp.position.set(x, 1.09, 0.97)
      this.model.add(lamp)
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textures.glow,
          color: 0xff4a22,
          transparent: true,
          opacity: 0.7,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      halo.scale.set(0.5, 0.5, 1)
      halo.position.set(x, 1.09, 0.99)
      this.model.add(halo)
    }

    // number plate
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.15),
      new THREE.MeshBasicMaterial({ map: textures.plate, transparent: true }),
    )
    plate.position.set(0, 0.66, 0.99)
    this.model.add(plate)

    // ---- driver ----------------------------------------------------------
    this.driver = new THREE.Group()
    this.driver.position.set(0, 0.9, -0.42)
    this.model.add(this.driver)

    const shirtTexture = textures.checkered.clone()
    shirtTexture.needsUpdate = true
    shirtTexture.repeat.set(2, 2)
    const shirtMat = new THREE.MeshStandardMaterial({ map: shirtTexture, roughness: 0.85 })

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.54, 10), shirtMat)
    torso.position.set(0, 0.3, 0)
    torso.rotation.x = 0.22
    this.driver.add(torso)

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), skinMat)
    head.position.set(0, 0.7, -0.03)
    this.driver.add(head)

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.165, 0.1, 12), creamMat)
    cap.position.set(0, 0.8, -0.03)
    this.driver.add(cap)
    const brim = box(0.24, 0.028, 0.13, creamMat, 0, 0.775, -0.19)
    this.driver.add(brim)

    const armL = rod([-0.22, 0.42, -0.02], [-0.38, 0.14, -0.62], 0.045, shirtMat, 5)
    const armR = rod([0.22, 0.42, -0.02], [0.38, 0.14, -0.62], 0.045, shirtMat, 5)
    this.driver.add(armL, armR)
    for (const x of [-0.39, 0.39]) {
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 6, 6), skinMat)
      hand.position.set(x, 0.12, -0.63)
      this.driver.add(hand)
    }

    this.legs = []
    for (const side of [-1, 1]) {
      const hip = new THREE.Group()
      hip.position.set(side * 0.13, 0.06, 0.04)
      this.driver.add(hip)
      const thigh = box(0.12, 0.36, 0.15, darkMat, 0, -0.18, 0)
      hip.add(thigh)
      const knee = new THREE.Group()
      knee.position.set(0, -0.36, 0)
      hip.add(knee)
      const shin = box(0.1, 0.34, 0.12, skinMat, 0, -0.17, 0)
      knee.add(shin)
      const foot = box(0.12, 0.07, 0.2, darkMat, 0, -0.35, -0.05)
      knee.add(foot)
      this.legs.push({ hip, knee, phase: side > 0 ? 0 : Math.PI })
    }

    // handlebar & bell
    this.model.add(rod([-0.4, 1.02, -1.02], [0.4, 1.02, -1.02], 0.03, darkMat))
    for (const x of [-0.4, 0.4]) {
      this.model.add(rod([x, 1.02, -1.02], [x * 0.5, 0.9, -0.75], 0.026, darkMat))
    }
    this.bell = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), goldMat)
    this.bell.position.set(0.26, 1.05, -1.0)
    this.model.add(this.bell)

    // rear-view mirrors peeking over the canopy
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe4ea, roughness: 0.12, metalness: 0.75 })
    for (const side of [-1, 1]) {
      this.model.add(rod([side * 0.7, 2.05, 0.25], [side * 0.88, 2.34, 0.25], 0.012, goldMat, 5))
      const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 12), glassMat)
      mirror.rotation.x = Math.PI / 2
      mirror.position.set(side * 0.88, 2.37, 0.25)
      this.model.add(mirror)
    }

    // front basket
    const basket = box(0.5, 0.28, 0.34, goldMat, 0, 0.82, -1.12)
    this.model.add(basket)
    const basketInner = box(0.42, 0.2, 0.26, darkMat, 0, 0.85, -1.12)
    this.model.add(basketInner)

    // Collapse static pieces so the hero costs only a handful of draw calls.
    // Animated meshes (flag, bell) and child groups (wheels, driver, legs) stay.
    mergeGroupByMaterial(this.model, (child) => child !== this.flag && child !== this.bell)
    mergeGroupByMaterial(this.driver)

    // ---- fake contact shadow --------------------------------------------
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.5, 3.3),
      new THREE.MeshBasicMaterial({
        map: textures.shadow,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      }),
    )
    this.shadow.rotation.x = -Math.PI / 2
    this.shadow.position.y = 0.03
    this.shadow.renderOrder = 2
  }

  addToScene() {
    this.scene.add(this.group)
    this.scene.add(this.shadow)
  }

  ringBell() {
    this.bellPulse = 1
  }

  update(dt, { speed = 0, lateral = 0, airborne = false } = {}) {
    this.time += dt
    const t = this.time
    this.wheelSpin += (speed * dt) / 0.34
    for (const wheel of this.wheels) wheel.rotation.x = -this.wheelSpin

    this.bellPulse = Math.max(0, this.bellPulse - dt * 4)
    const pulse = 1 + Math.sin(this.bellPulse * Math.PI) * 0.3
    this.bell.scale.setScalar(pulse)

    const lean = THREE.MathUtils.clamp(-lateral * 0.055, -0.19, 0.19)
    this.tilt.rotation.z += (lean - this.tilt.rotation.z) * Math.min(1, dt * 8)
    this.tilt.rotation.y += (-lateral * 0.05 - this.tilt.rotation.y) * Math.min(1, dt * 6)
    const pitchTarget = airborne ? -0.16 : 0
    this.tilt.rotation.x += (pitchTarget - this.tilt.rotation.x) * Math.min(1, dt * 6)

    const bob = Math.sin(t * 9) * 0.012 + Math.sin(t * 3.1) * 0.008
    this.model.position.y = bob

    this.driver.position.y = 0.9 + Math.sin(t * 9 + 0.6) * 0.018
    this.driver.rotation.z = Math.sin(t * 4.5) * 0.035
    const pedal = t * 7.5
    for (const leg of this.legs) {
      leg.hip.rotation.x = Math.sin(pedal + leg.phase) * 0.5 - 0.35
      leg.knee.rotation.x = Math.max(0, Math.cos(pedal + leg.phase)) * 0.9 + 0.15
    }

    this.flag.rotation.y = Math.PI / 2 + Math.sin(t * 4.4) * 0.2
    this.flag.rotation.z = Math.sin(t * 6.1) * 0.06
  }
}
