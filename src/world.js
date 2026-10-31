import * as THREE from '../vendor/three.module.js'
import { extractFaces, mergeGeometries, mergeGroupByMaterial } from './merge.js'

const WRAP = 480
const WRAP_START = 40

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.position.set(x, y, z)
  return mesh
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

export class World {
  constructor(scene, textures) {
    this.scene = scene
    this.textures = textures
    this.scroll = 0
    this.time = 0
    this.scenery = []
    this.rng = mulberry32(2026)
    this.lampGlows = []
    this.build()
  }

  build() {
    const { scene, textures } = this
    const rng = this.rng

    scene.fog = new THREE.FogExp2(0xc27d76, 0.0058)

    // ---------- sky ------------------------------------------------------
    const skyGeo = new THREE.SphereGeometry(340, 32, 20)
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color(0x1d1440) },
        mid: { value: new THREE.Color(0x8c3f68) },
        bottom: { value: new THREE.Color(0xffa76a) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 top;
        uniform vec3 mid;
        uniform vec3 bottom;
        varying vec3 vPosition;
        void main() {
          float h = normalize(vPosition).y;
          vec3 color = mix(bottom, mid, smoothstep(-0.04, 0.22, h));
          color = mix(color, top, smoothstep(0.16, 0.62, h));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
    this.sky = new THREE.Mesh(skyGeo, skyMat)
    scene.add(this.sky)

    const sun = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: textures.glow,
        color: 0xffd08a,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    sun.position.set(-52, 21, -245)
    sun.scale.set(90, 90, 1)
    sun.material.fog = false
    scene.add(sun)

    // ---------- lights ---------------------------------------------------
    scene.add(new THREE.HemisphereLight(0xffd6a8, 0x3a2740, 1.15))
    const key = new THREE.DirectionalLight(0xffb877, 2.1)
    key.position.set(-16, 24, 12)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x7d8dff, 0.7)
    rim.position.set(12, 10, -18)
    scene.add(rim)

    // ---------- ground ---------------------------------------------------
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(520, 520),
      new THREE.MeshStandardMaterial({ color: 0x342532, roughness: 1 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.06
    scene.add(ground)

    textures.asphalt.repeat.set(2, 48)
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(12, WRAP + 20),
      new THREE.MeshStandardMaterial({ map: textures.asphalt, roughness: 0.82, metalness: 0.08 }),
    )
    road.rotation.x = -Math.PI / 2
    road.position.set(0, 0, -WRAP / 2 + 10)
    scene.add(road)
    this.road = road

    for (const side of [-1, 1]) {
      const sidewalk = new THREE.Mesh(
        new THREE.PlaneGeometry(2, WRAP + 20),
        new THREE.MeshStandardMaterial({ map: textures.sidewalk, roughness: 0.95 }),
      )
      sidewalk.rotation.x = -Math.PI / 2
      sidewalk.position.set(side * 6.7, 0.055, -WRAP / 2 + 10)
      scene.add(sidewalk)

      const curb = box(0.24, 0.16, WRAP + 20, new THREE.MeshStandardMaterial({ color: 0x9d8b78, roughness: 0.9 }), side * 5.68, 0.04, -WRAP / 2 + 10)
      scene.add(curb)

      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(WRAP, 2.3),
        new THREE.MeshStandardMaterial({ map: textures.wall, roughness: 0.98 }),
      )
      textureWall(textures.wall)
      wall.rotation.y = side * -Math.PI / 2
      wall.position.set(side * 7.82, 1.15, -WRAP / 2 + 10)
      scene.add(wall)

      const wallCap = box(0.2, 0.1, WRAP, new THREE.MeshStandardMaterial({ color: 0x5b4740, roughness: 0.9 }), side * 7.82, 2.32, -WRAP / 2 + 10)
      scene.add(wallCap)
    }

    // lane dashes (periodic, so the whole mesh can scroll)
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf3dca4 })
    const dashGeo = new THREE.PlaneGeometry(0.16, 2.5)
    dashGeo.rotateX(-Math.PI / 2)
    const perRow = 2
    const rows = Math.ceil((WRAP + 30) / 6)
    const dashes = new THREE.InstancedMesh(dashGeo, dashMat, rows * perRow)
    const matrix = new THREE.Matrix4()
    let index = 0
    for (let i = 0; i < rows; i++) {
      for (let lane = 0; lane < perRow; lane++) {
        matrix.makeTranslation(lane === 0 ? -1.55 : 1.55, 0.02, 32 - i * 6)
        dashes.setMatrixAt(index++, matrix)
      }
    }
    dashes.instanceMatrix.needsUpdate = true
    scene.add(dashes)
    this.dashes = dashes

    // road edges
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, WRAP + 20),
        new THREE.MeshBasicMaterial({ color: 0xe8c98c, transparent: true, opacity: 0.5 }),
      )
      edge.rotation.x = -Math.PI / 2
      edge.position.set(side * 5.05, 0.021, -WRAP / 2 + 10)
      scene.add(edge)
    }

    // ---------- far skyline ---------------------------------------------
    const silhouetteMat = new THREE.MeshBasicMaterial({ color: 0x4b2b4a })
    const skylineParts = []
    for (let i = 0; i < 18; i++) {
      const w = 8 + rng() * 16
      const h = 8 + rng() * 30
      const geo = new THREE.BoxGeometry(w, h, 6)
      geo.applyMatrix4(
        new THREE.Matrix4().makeTranslation(-110 + i * 13 + rng() * 4, h / 2, -270 - rng() * 30),
      )
      skylineParts.push(geo)
    }
    scene.add(new THREE.Mesh(mergeGeometries(skylineParts), silhouetteMat))

    // ---------- scenery --------------------------------------------------
    const buildingFacades = textures.buildings.map(
      (facade) => new THREE.MeshStandardMaterial({ map: facade, roughness: 0.92 }),
    )
    const buildingRoofMat = new THREE.MeshStandardMaterial({ color: 0x554746, roughness: 0.95 })
    const buildingDetailMat = new THREE.MeshStandardMaterial({ color: 0x5f4c4c, roughness: 0.95 })

    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const z = 24 - i * 52 - rng() * 14
        const w = 9 + rng() * 9
        const d = 6 + rng() * 7
        const h = 6 + rng() * 15
        const group = new THREE.Group()
        group.position.set(side * (10.2 + d / 2 + rng() * 5), 0, z)
        const facadeIndex = Math.floor(rng() * buildingFacades.length)
        const bodyGeo = new THREE.BoxGeometry(d, h, w)
        const walls = new THREE.Mesh(
          extractFaces(bodyGeo, (nx, ny) => Math.abs(ny) < 0.5),
          buildingFacades[facadeIndex],
        )
        walls.position.y = h / 2
        group.add(walls)
        const caps = new THREE.Mesh(
          extractFaces(bodyGeo, (nx, ny) => Math.abs(ny) > 0.5),
          buildingRoofMat,
        )
        caps.position.y = h / 2
        group.add(caps)

        if (rng() > 0.45) {
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.6, 8), buildingDetailMat)
          tank.position.set(side * -1.2, h + 0.8, rng() * 3 - 1.5)
          group.add(tank)
        }
        if (rng() > 0.5) {
          group.add(box(d, 0.5, w, buildingDetailMat, 0, h + 0.25, 0))
        }
        mergeGroupByMaterial(group)
        scene.add(group)
        this.scenery.push(group)
      }
    }

    // palms
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a32, roughness: 1 })
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a9160, roughness: 0.9, side: THREE.DoubleSide })
    const palmTrunkGeo = new THREE.CylinderGeometry(0.1, 0.22, 4.2, 6)
    palmTrunkGeo.translate(0, 2.1, 0)
    const leafBase = new THREE.ConeGeometry(0.3, 2.8, 4, 1)
    leafBase.translate(0, 1.4, 0)
    const palmLeafGeo = (() => {
      const parts = []
      for (let i = 0; i < 7; i++) {
        const clone = leafBase.clone()
        const angle = (i / 7) * Math.PI * 2 + rng() * 0.3
        const droop = 1.05 + rng() * 0.35
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3(0, 4.1, 0),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, droop)),
          new THREE.Vector3(1, 0.85 + rng() * 0.25, 0.32),
        )
        clone.applyMatrix4(m)
        parts.push(clone)
      }
      return mergeGeometries(parts)
    })()

    const palmCount = 18
    this.palmTrunks = new THREE.InstancedMesh(palmTrunkGeo, trunkMat, palmCount)
    this.palmLeaves = new THREE.InstancedMesh(palmLeafGeo, leafMat, palmCount)
    for (const mesh of [this.palmTrunks, this.palmLeaves]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      scene.add(mesh)
    }
    this.palms = []
    const palmDummy = new THREE.Object3D()
    let palmIndex = 0
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const x = side * (6.9 + rng() * 0.35)
        const z = -14 - i * 52 - rng() * 18
        const scale = 0.8 + rng() * 0.32
        this.palms.push({ x, z, scale })
        palmDummy.position.set(x, 0, z)
        palmDummy.scale.setScalar(scale)
        palmDummy.updateMatrix()
        this.palmTrunks.setMatrixAt(palmIndex, palmDummy.matrix)
        this.palmLeaves.setMatrixAt(palmIndex, palmDummy.matrix)
        palmIndex++
      }
    }
    this.palmTrunks.instanceMatrix.needsUpdate = true
    this.palmLeaves.instanceMatrix.needsUpdate = true

    // banyan clumps
    const banyanTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3f2f, roughness: 1 })
    const banyanLeafMat = new THREE.MeshStandardMaterial({ color: 0x2b6440, roughness: 0.95 })
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const group = new THREE.Group()
        group.position.set(side * (10.4 + rng() * 3), 0, 0 - i * 150 - rng() * 35)
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 5.4, 6), banyanTrunkMat)
        trunk.position.y = 2.7
        group.add(trunk)
        const blobs = []
        for (let b = 0; b < 4; b++) {
          const g = new THREE.SphereGeometry(1.1 + rng() * 0.9, 7, 6)
          g.applyMatrix4(new THREE.Matrix4().makeTranslation((rng() - 0.5) * 3.2, 5.9 + rng() * 1.9, (rng() - 0.5) * 3.2))
          blobs.push(g)
        }
        const canopy = new THREE.Mesh(mergeGeometries(blobs), banyanLeafMat)
        group.add(canopy)
        scene.add(group)
        this.scenery.push(group)
      }
    }

    // lamp posts
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x333037, roughness: 0.7, metalness: 0.4 })
    const lampHeadMat = new THREE.MeshStandardMaterial({ color: 0xffe3a8, emissive: 0xffbe63, emissiveIntensity: 2.4 })
    const postGeo = new THREE.CylinderGeometry(0.07, 0.11, 5.2, 6)
    postGeo.translate(0, 2.6, 0)
    const armGeo = new THREE.BoxGeometry(1.1, 0.08, 0.08)
    armGeo.translate(-0.55, 5.2, 0)
    const headGeo = new THREE.BoxGeometry(0.42, 0.14, 0.26)
    headGeo.translate(-1.02, 5.12, 0)
    const lampGeo = mergeGeometries([postGeo, armGeo, headGeo])
    const bulbGeo = new THREE.SphereGeometry(0.17, 8, 6)
    bulbGeo.translate(-1.02, 5.04, 0)

    const lampCount = 26
    this.lampPosts = new THREE.InstancedMesh(lampGeo, lampMat, lampCount)
    this.lampBulbs = new THREE.InstancedMesh(bulbGeo, lampHeadMat, lampCount)
    for (const mesh of [this.lampPosts, this.lampBulbs]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      scene.add(mesh)
    }

    const lampGlowGeo = new THREE.BufferGeometry()
    const lampGlowPositions = new Float32Array(lampCount * 3)
    lampGlowGeo.setAttribute('position', new THREE.BufferAttribute(lampGlowPositions, 3))
    this.lampGlows = new THREE.Points(
      lampGlowGeo,
      new THREE.PointsMaterial({
        map: textures.glow,
        color: 0xffb35c,
        size: 5.2,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    )
    this.lampGlows.frustumCulled = false
    scene.add(this.lampGlows)
    this.lampGlowPositions = lampGlowPositions

    this.lamps = []
    const lampDummy = new THREE.Object3D()
    let lampIndex = 0
    for (const side of [-1, 1]) {
      for (let i = 0; i < 13; i++) {
        const z = 8 - i * 38 - rng() * 8
        this.lamps.push({ x: side * 7.3, glowX: side * 8.32, z, angle: side > 0 ? Math.PI : 0 })
        lampDummy.position.set(side * 7.3, 0, z)
        lampDummy.rotation.set(0, side > 0 ? Math.PI : 0, 0)
        lampDummy.scale.setScalar(1)
        lampDummy.updateMatrix()
        this.lampPosts.setMatrixAt(lampIndex, lampDummy.matrix)
        this.lampBulbs.setMatrixAt(lampIndex, lampDummy.matrix)
        lampGlowPositions[lampIndex * 3] = side * 8.32
        lampGlowPositions[lampIndex * 3 + 1] = 5.02
        lampGlowPositions[lampIndex * 3 + 2] = z
        lampIndex++
      }
    }
    this.lampPosts.instanceMatrix.needsUpdate = true
    this.lampBulbs.instanceMatrix.needsUpdate = true
    lampGlowGeo.attributes.position.needsUpdate = true

    // tea stalls
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a4f30, roughness: 0.95 })
    const tarpMats = [
      new THREE.MeshStandardMaterial({ color: 0x2a7fb8, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.85 }),
    ]
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff2c4, emissive: 0xffcf6b, emissiveIntensity: 2 })
    for (let i = 0; i < 5; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const group = new THREE.Group()
      group.position.set(side * 6.95, 0, -22 - i * 88 - rng() * 20)
      group.rotation.y = side > 0 ? Math.PI : 0
      const counter = box(1.8, 0.9, 0.7, woodMat, 0, 0.45, 0)
      group.add(counter)
      for (const x of [-0.8, 0.8]) {
        for (const z of [-0.5, 0.5]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.3, 5), woodMat)
          post.position.set(x, 1.15, z)
          group.add(post)
        }
      }
      const tarp = box(2.1, 0.06, 1.5, tarpMats[i % tarpMats.length], 0, 2.32, 0)
      tarp.rotation.x = 0.12
      group.add(tarp)
      const kettle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.22, 8), lampMat)
      kettle.position.set(0.35, 1.0, 0)
      group.add(kettle)
      for (const x of [-0.45, 0.05, 0.55]) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), bulbMat)
        bulb.position.set(x, 2.1, 0.1)
        group.add(bulb)
      }
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: textures.glow,
          color: 0xffc46b,
          transparent: true,
          opacity: 0.5,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      halo.scale.set(1.6, 0.7, 1)
      halo.position.set(0.05, 2.1, 0.1)
      group.add(halo)
      mergeGroupByMaterial(group)
      scene.add(group)
      this.scenery.push(group)
    }

    // flags
    for (let i = 0; i < 4; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const group = new THREE.Group()
      group.position.set(side * 6.4, 0, -14 - i * 96)
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 4.4, 5), lampMat)
      pole.position.y = 2.2
      group.add(pole)
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.05, 0.63),
        new THREE.MeshStandardMaterial({ map: textures.flag, side: THREE.DoubleSide, roughness: 0.85 }),
      )
      flag.position.set(side * -0.55, 3.95, 0)
      group.add(flag)
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: textures.glow, color: 0xffe1a1, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
      )
      halo.scale.set(2, 2, 1)
      halo.position.set(side * -0.55, 3.95, 0)
      group.add(halo)
      scene.add(group)
      this.scenery.push(group)
    }

    // puddles
    const puddleMat = new THREE.MeshBasicMaterial({
      map: textures.puddle,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    for (let i = 0; i < 9; i++) {
      const puddle = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), puddleMat)
      puddle.rotation.x = -Math.PI / 2
      puddle.position.set(-4 + rng() * 8, 0.026, 12 - i * 48 - rng() * 20)
      puddle.scale.set(1 + rng() * 1.4, 1, 1 + rng() * 0.8)
      scene.add(puddle)
      this.scenery.push(puddle)
    }

    // ---------- floating dust -------------------------------------------
    const dustCount = 90
    const dustGeo = new THREE.BufferGeometry()
    const dustPos = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (rng() - 0.5) * 22
      dustPos[i * 3 + 1] = 0.2 + rng() * 5
      dustPos[i * 3 + 2] = 8 - rng() * 52
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
    this.dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        map: textures.glow,
        color: 0xffd7a1,
        size: 0.16,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    )
    scene.add(this.dust)
  }

  update(dt, speed) {
    this.time += dt
    this.scroll += speed * dt

    const move = speed * dt
    for (const item of this.scenery) {
      item.position.z += move
      if (item.position.z > WRAP_START) item.position.z -= WRAP
    }

    // instanced palms
    const palmDummy = (this._palmDummy ||= new THREE.Object3D())
    for (let i = 0; i < this.palms.length; i++) {
      const palm = this.palms[i]
      palm.z += move
      if (palm.z > WRAP_START) palm.z -= WRAP
      palmDummy.position.set(palm.x, 0, palm.z)
      palmDummy.scale.setScalar(palm.scale)
      palmDummy.updateMatrix()
      this.palmTrunks.setMatrixAt(i, palmDummy.matrix)
      this.palmLeaves.setMatrixAt(i, palmDummy.matrix)
    }
    this.palmTrunks.instanceMatrix.needsUpdate = true
    this.palmLeaves.instanceMatrix.needsUpdate = true

    // instanced lamps + their glows
    const lampDummy = (this._lampDummy ||= new THREE.Object3D())
    const glow = this.lampGlowPositions
    for (let i = 0; i < this.lamps.length; i++) {
      const lamp = this.lamps[i]
      lamp.z += move
      if (lamp.z > WRAP_START) lamp.z -= WRAP
      lampDummy.position.set(lamp.x, 0, lamp.z)
      lampDummy.rotation.set(0, lamp.angle, 0)
      lampDummy.updateMatrix()
      this.lampPosts.setMatrixAt(i, lampDummy.matrix)
      this.lampBulbs.setMatrixAt(i, lampDummy.matrix)
      glow[i * 3] = lamp.glowX
      glow[i * 3 + 1] = 5.02
      glow[i * 3 + 2] = lamp.z
    }
    this.lampPosts.instanceMatrix.needsUpdate = true
    this.lampBulbs.instanceMatrix.needsUpdate = true
    this.lampGlows.geometry.attributes.position.needsUpdate = true

    // periodic lane dashes
    this.dashes.position.z = this.scroll % 6
    this.textures.asphalt.offset.y = (this.scroll / 10) % 1
    this.textures.sidewalk.offset.y = (this.scroll / 5.33) % 1

    // dust
    const pos = this.dust.geometry.attributes.position
    for (let i = 0; i < pos.count; i++) {
      let z = pos.getZ(i) + move * 0.65
      let x = pos.getX(i) + Math.sin(this.time * 0.6 + i) * 0.004
      if (z > 10) z -= 60
      if (x > 11) x -= 22
      if (x < -11) x += 22
      pos.setZ(i, z)
      pos.setX(i, x)
    }
    pos.needsUpdate = true
  }
}

function textureWall(texture) {
  texture.repeat.set(60, 1)
}
