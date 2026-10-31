import * as THREE from '../vendor/three.module.js'
import { createTextures } from './textures.js'
import { Rickshaw } from './rickshaw.js'
import { World } from './world.js'
import { Entities, LANE_X } from './entities.js'
import { Particles } from './particles.js'
import { Sound } from './audio.js'

const BEST_KEY = 'rickshaw-rush-best'
const MUTE_KEY = 'rickshaw-rush-muted'

const clamp = THREE.MathUtils.clamp
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt))

const els = {
  canvas: document.getElementById('scene'),
  loader: document.getElementById('loader'),
  startScreen: document.getElementById('startScreen'),
  pauseScreen: document.getElementById('pauseScreen'),
  overScreen: document.getElementById('overScreen'),
  playBtn: document.getElementById('playBtn'),
  againBtn: document.getElementById('againBtn'),
  menuBtn: document.getElementById('menuBtn'),
  resumeBtn: document.getElementById('resumeBtn'),
  quitBtn: document.getElementById('quitBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  soundBtn: document.getElementById('soundBtn'),
  scoreValue: document.getElementById('scoreValue'),
  hudBest: document.getElementById('hudBest'),
  comboWrap: document.getElementById('comboWrap'),
  comboValue: document.getElementById('comboValue'),
  powerChip: document.getElementById('powerChip'),
  powerTime: document.getElementById('powerTime'),
  speedFill: document.getElementById('speedFill'),
  startBest: document.getElementById('startBest'),
  overScore: document.getElementById('overScore'),
  overBest: document.getElementById('overBest'),
  overMangoes: document.getElementById('overMangoes'),
  overDistance: document.getElementById('overDistance'),
  recordBadge: document.getElementById('recordBadge'),
  toast: document.getElementById('toast'),
  touch: document.getElementById('touchControls'),
  tapLeft: document.getElementById('tapLeft'),
  tapJump: document.getElementById('tapJump'),
  tapRight: document.getElementById('tapRight'),
}

class Game {
  constructor() {
    this.phase = 'loading'
    this.last = 0
    this.time = 0
    this.best = this.readBest()
    this.muted = (() => {
      try {
        return localStorage.getItem(MUTE_KEY) === '1'
      } catch {
        return false
      }
    })()
    this.shake = 0
    this.crashRoll = 0
    this.toastTimer = 0
    this.run = this.freshRun()
    this.player = { lane: 1, x: 0, y: 0, vy: 0, prevX: 0, lateral: 0 }
    this.cameraLook = new THREE.Vector3(0, 1.2, 0)
    this.pointer = null
    this.touchDevice =
      matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      'ontouchstart' in window
    this.spawnAccumulator = 0
    this.nextGap = 30
    this.chaTimer = 16
    this.dustTimer = 0
    this.lastHud = {}
  }

  freshRun() {
    return {
      speed: 15,
      distance: 0,
      score: 0,
      mangoScore: 0,
      mangoes: 0,
      combo: 0,
      multiplier: 1,
      shield: 0,
      crashed: false,
      crashTimer: 0,
      newBest: false,
      nextMilestone: 250,
    }
  }

  readBest() {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0
    } catch {
      return 0
    }
  }

  saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value))
    } catch {
      /* ignore */
    }
  }

  async init() {
    await this.loadFonts()

    this.renderer = new THREE.WebGLRenderer({
      canvas: els.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.12

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 460)
    this.camera.position.set(0, 3.4, 8.6)

    this.textures = createTextures()
    this.world = new World(this.scene, this.textures)
    this.entities = new Entities(this.scene, this.textures)
    this.rickshaw = new Rickshaw(this.scene, this.textures)
    this.rickshaw.addToScene()
    this.particles = new Particles(this.scene, this.textures.glow)
    this.sound = new Sound()
    this.sound.setMuted(this.muted)

    this.shieldRing = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.35, 36),
      new THREE.MeshBasicMaterial({
        color: 0xffcf6b,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    this.shieldRing.rotation.x = -Math.PI / 2
    this.shieldRing.position.y = 0.08
    this.shieldRing.visible = false
    this.rickshaw.group.add(this.shieldRing)

    this.bindEvents()
    this.resize()
    this.applySoundIcon()
    this.updateBestDisplays()
    this.setPhase('menu')
    this.last = performance.now()
    requestAnimationFrame((now) => this.loop(now))

    requestAnimationFrame(() => {
      els.loader.classList.add('done')
      setTimeout(() => els.loader.classList.add('hidden'), 700)
    })
  }

  async loadFonts() {
    if (!document.fonts) return
    try {
      await Promise.all([
        document.fonts.load('700 48px "Hind Siliguri"', 'রিকশা রাশ'),
        document.fonts.load('600 24px "Hind Siliguri"', 'ঢাকা রিকশা'),
        document.fonts.load('400 20px "Hind Siliguri"', 'বাংলাদেশ'),
      ])
      await document.fonts.ready
    } catch {
      /* fall back to system fonts */
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize())
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120))
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.phase === 'playing') this.pause()
    })

    window.addEventListener('keydown', (event) => {
      const key = event.key
      if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) event.preventDefault()
      if (key === 'Enter' || key === ' ') {
        if (this.phase === 'menu' || this.phase === 'over') {
          this.startRun()
          return
        }
      }
      if (this.phase === 'playing') {
        if (key === 'ArrowLeft' || key === 'a' || key === 'A') this.move(-1)
        else if (key === 'ArrowRight' || key === 'd' || key === 'D') this.move(1)
        else if (key === 'ArrowUp' || key === 'w' || key === 'W' || key === ' ') this.jump()
        else if (key === 'p' || key === 'P' || key === 'Escape') this.pause()
        else if (key === 'm' || key === 'M') this.toggleMute()
      } else if (key === 'p' || key === 'P' || key === 'Escape') {
        if (this.phase === 'paused') this.resume()
      }
    })

    const canvas = els.canvas
    canvas.addEventListener('pointerdown', (event) => {
      if (this.phase !== 'playing') return
      this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY }
      canvas.setPointerCapture?.(event.pointerId)
    })
    canvas.addEventListener('pointerup', (event) => {
      if (!this.pointer || this.phase !== 'playing') return
      const dx = event.clientX - this.pointer.x
      const dy = event.clientY - this.pointer.y
      this.pointer = null
      if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy)) this.move(dx > 0 ? 1 : -1)
      else if (dy < -30) this.jump()
    })
    canvas.addEventListener('pointercancel', () => {
      this.pointer = null
    })

    els.playBtn.addEventListener('click', () => this.startRun())
    els.againBtn.addEventListener('click', () => this.startRun())
    els.menuBtn.addEventListener('click', () => this.goMenu())
    els.resumeBtn.addEventListener('click', () => this.resume())
    els.quitBtn.addEventListener('click', () => this.goMenu())
    els.pauseBtn.addEventListener('click', () => this.pause())
    els.soundBtn.addEventListener('click', () => this.toggleMute())

    els.tapLeft.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      this.move(-1)
    })
    els.tapRight.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      this.move(1)
    })
    els.tapJump.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      this.jump()
    })
  }

  resize() {
    if (!this.renderer) return
    const width = window.innerWidth
    const height = window.innerHeight
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }

  applySoundIcon() {
    els.soundBtn.classList.toggle('muted', this.muted)
    els.soundBtn.setAttribute('aria-label', this.muted ? 'শব্দ চালু করো' : 'শব্দ বন্ধ করো')
  }

  toggleMute() {
    this.muted = !this.muted
    this.sound.setMuted(this.muted)
    this.applySoundIcon()
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0')
    } catch {
      /* ignore */
    }
    if (!this.muted) this.sound.click()
  }

  setPhase(phase) {
    this.phase = phase
    document.body.dataset.phase = phase
    const playing = phase === 'playing'
    document.body.classList.toggle('playing', playing)
    els.startScreen.classList.toggle('hidden', phase !== 'menu')
    els.pauseScreen.classList.toggle('hidden', phase !== 'paused')
    els.overScreen.classList.toggle('hidden', phase !== 'over')
    els.touch.classList.toggle('visible', playing && this.touchDevice)
    if (phase === 'paused' || phase === 'over' || phase === 'menu') {
      els.touch.classList.remove('visible')
    }
  }

  updateBestDisplays() {
    els.startBest.textContent = this.best.toLocaleString('en-US')
    els.hudBest.textContent = this.best.toLocaleString('en-US')
    els.overBest.textContent = this.best.toLocaleString('en-US')
  }

  resetRun() {
    this.run = this.freshRun()
    this.player = { lane: 1, x: 0, y: 0, vy: 0, prevX: 0, lateral: 0 }
    this.spawnAccumulator = 0
    this.nextGap = 30
    this.chaTimer = 16
    this.shake = 0
    this.crashRoll = 0
    this.entities.clear()
    this.particles.clear()
    this.rickshaw.group.position.set(0, 0, 0)
    this.rickshaw.tilt.rotation.set(0, 0, 0)
    this.rickshaw.model.position.y = 0
    this.rickshaw.shadow.position.set(0, 0.03, 0.25)
    this.rickshaw.shadow.material.opacity = 0.85
    this.rickshaw.shadow.scale.set(1, 1, 1)
    this.shieldRing.visible = false
    this.cameraLook.set(0, 1.2, 0)
    this.lastHud = {}
  }

  startRun() {
    if (this.phase === 'playing') return
    this.sound.unlock()
    this.sound.click()
    this.sound.start()
    this.resetRun()
    this.setPhase('playing')
    this.toast('যাত্রা শুরু!', 'start')
    this.rickshaw.ringBell()

    this.entities.spawn('mango', 1, -22)
    this.entities.spawn('mango', 1, -26)
    this.entities.spawn('mango', 1, -30)
    for (let i = 0; i < 3; i++) {
      this.entities.spawn('mango', 0, -48 - i * 4)
      this.entities.spawn('mango', 2, -64 - i * 4)
    }
    this.spawnWave(-92)
    this.spawnWave(-126)
    this.sound.setIntensity(this.run.speed)
  }

  goMenu() {
    this.entities.clear()
    this.particles.clear()
    this.resetRun()
    this.setPhase('menu')
    this.updateBestDisplays()
    this.sound.click()
    this.sound.setIntensity(0)
  }

  pause() {
    if (this.phase !== 'playing') return
    this.pointer = null
    this.setPhase('paused')
    this.sound.click()
  }

  resume() {
    if (this.phase !== 'paused') return
    this.sound.unlock()
    this.setPhase('playing')
    this.sound.click()
  }

  move(direction) {
    if (this.phase !== 'playing' || this.run.crashed) return
    const next = clamp(this.player.lane + direction, 0, LANE_X.length - 1)
    if (next === this.player.lane) return
    this.player.lane = next
    this.sound.lane()
  }

  jump() {
    if (this.phase !== 'playing' || this.run.crashed) return
    if (this.player.y > 0.01) return
    this.player.vy = 8.6
    this.player.y = 0.001
    this.sound.jump()
    this.rickshaw.ringBell()
  }

  loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000))
    this.last = now
    this.time += dt

    if (this.phase === 'playing') {
      this.updatePlaying(dt)
    } else if (this.phase === 'menu') {
      this.updateMenu(dt)
    } else if (this.phase === 'over') {
      this.updateOver(dt)
    }

    this.updateCamera(dt)
    this.renderer.render(this.scene, this.camera)
    requestAnimationFrame((next) => this.loop(next))
  }

  updateMenu(dt) {
    this.world.update(dt, 5.2)
    this.rickshaw.group.position.set(0, 0, 0)
    this.rickshaw.update(dt, { speed: 5.2, lateral: 0, airborne: false })
    this.rickshaw.shadow.position.set(0, 0.03, 0.25)
    this.particles.update(dt, 5.2)
  }

  updateOver(dt) {
    this.world.update(dt, 0)
    this.rickshaw.update(dt, { speed: 0, lateral: 0, airborne: false })
    this.particles.update(dt, 0)
    this.shake = Math.max(0, this.shake - dt * 2.5)
  }

  updatePlaying(dt) {
    const run = this.run
    const player = this.player

    if (!run.crashed) {
      run.distance += run.speed * dt
      const targetSpeed = 15 + Math.min(19, run.distance * 0.019)
      run.speed = damp(run.speed, targetSpeed, 0.9, dt)
      run.score = Math.floor(run.distance * 2 + run.mangoScore)
      run.shield = Math.max(0, run.shield - dt)
      this.sound.setIntensity(run.speed)

      if (run.distance >= run.nextMilestone) {
        const reached = run.nextMilestone
        run.nextMilestone += 250
        this.toast(`${reached} মিটার!`, 'combo')
        this.sound.collect(9)
        this.particles.emit(this.player.x, 1.4, -1.6, 0xffd98a, 18, 4.5, 0.8, 1.2)
      }
    } else {
      run.crashTimer += dt
      run.speed = damp(run.speed, 0, 2.8, dt)
      this.crashRoll = damp(this.crashRoll, 0.32, 4, dt)
      if (run.crashTimer > 0.95 && this.phase === 'playing') {
        this.finishRun()
        return
      }
    }

    this.world.update(dt, run.speed)

    // lateral movement
    player.prevX = player.x
    player.x = damp(player.x, LANE_X[player.lane], 11, dt)
    player.lateral = dt > 0 ? (player.x - player.prevX) / dt : 0

    // jump physics
    if (player.y > 0 || player.vy > 0) {
      player.y += player.vy * dt
      player.vy -= 24 * dt
      if (player.y <= 0) {
        player.y = 0
        player.vy = 0
      }
    }

    this.rickshaw.group.position.set(player.x, player.y, 0)
    this.rickshaw.update(dt, {
      speed: run.speed,
      lateral: player.lateral,
      airborne: player.y > 0.05,
    })
    if (this.crashRoll > 0.01) {
      this.rickshaw.tilt.rotation.z = this.crashRoll + Math.sin(this.time * 14) * 0.035 * this.crashRoll
      this.rickshaw.tilt.rotation.y += Math.sin(this.time * 9) * 0.02 * this.crashRoll
    }
    this.rickshaw.shadow.position.set(player.x, 0.03, 0.25)
    const heightFade = clamp(1 - player.y * 0.32, 0.45, 1)
    this.rickshaw.shadow.scale.set(heightFade, heightFade, 1)
    this.rickshaw.shadow.material.opacity = 0.8 * heightFade

    this.shieldRing.visible = run.shield > 0 && !run.crashed
    if (this.shieldRing.visible) {
      this.shieldRing.rotation.z += dt * 1.4
      const pulse = 1 + Math.sin(this.time * 5) * 0.06
      this.shieldRing.scale.setScalar(pulse)
      this.shieldRing.material.opacity = 0.35 + Math.sin(this.time * 5) * 0.15
    }

    this.entities.update(dt, run.speed)
    this.particles.update(dt, run.speed)
    this.shake = Math.max(0, this.shake - dt * 2.2)

    // wheel dust
    this.dustTimer -= dt
    if (!run.crashed && player.y < 0.05 && this.dustTimer <= 0) {
      this.dustTimer = 0.09
      this.particles.emit(player.x - 0.6, 0.12, 0.55, 0xc08a58, 1, 0.9, 0.5, -0.3)
      this.particles.emit(player.x + 0.6, 0.12, 0.55, 0xc08a58, 1, 0.9, 0.5, -0.3)
    }

    if (!run.crashed) {
      this.spawnAccumulator += run.speed * dt
      if (this.spawnAccumulator >= this.nextGap) {
        this.spawnAccumulator = 0
        this.nextGap = 27 + Math.random() * 15
        this.spawnWave(-185 - Math.random() * 12)
      }

      this.chaTimer -= dt
      if (this.chaTimer <= 0 && run.shield <= 0) {
        this.chaTimer = 20 + Math.random() * 10
        const lane = Math.floor(Math.random() * 3)
        this.entities.spawn('cha', lane, -158)
      }

      this.checkCollisions()
    }

    this.updateHud()
  }

  spawnWave(z) {
    const lanes = [0, 1, 2]
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
    }
    const blockedCount = Math.random() < 0.36 ? 2 : 1
    const blocked = lanes.slice(0, blockedCount)
    const open = lanes.slice(blockedCount)

    const bag = ['cng', 'cng', 'bus', 'cow', 'cone', 'pothole', 'cow', 'cone']
    for (const lane of blocked) {
      const kind = bag[Math.floor(Math.random() * bag.length)]
      this.entities.spawn(kind, lane, z - Math.random() * 5)
    }

    if (Math.random() < 0.82) {
      const lane = open[Math.floor(Math.random() * open.length)]
      const base = z + 1.5
      for (let i = 0; i < 3; i++) {
        this.entities.spawn('mango', lane, base - i * 3.6)
      }
    }
  }

  checkCollisions() {
    const run = this.run
    const player = this.player

    for (let i = this.entities.active.length - 1; i >= 0; i--) {
      const entry = this.entities.active[i]
      const z = entry.mesh.position.z
      const dx = Math.abs(entry.mesh.position.x - player.x)

      if (entry.kind === 'mango') {
        if (z > -1.4 && z < 1.5 && dx < 1.15) {
          this.collectMango(entry)
        }
        continue
      }
      if (entry.kind === 'cha') {
        if (z > -1.5 && z < 1.6 && dx < 1.2) {
          this.collectCha(entry)
        }
        continue
      }

      if (Math.abs(z) > entry.hd + 0.85) continue
      if (dx > entry.hw + 0.48) continue
      if (entry.jumpable && player.y > 0.7) continue

      if (run.shield > 0) {
        run.shield = 0
        this.shieldRing.visible = false
        this.entities.release(entry)
        this.shake = 0.7
        this.sound.shieldSave()
        this.particles.emit(player.x, 1.1, 0, 0xffcf6b, 30, 6, 0.9, 4)
        this.toast('চা শক্তি! বেঁচে গেলাম', 'power')
        this.rickshaw.ringBell()
      } else {
        this.triggerCrash(entry)
      }
      break
    }
  }

  collectMango(entry) {
    const run = this.run
    const x = entry.mesh.position.x
    const y = entry.mesh.position.y
    const z = entry.mesh.position.z
    run.mangoes += 1
    run.combo += 1
    const nextMultiplier = Math.min(5, 1 + Math.floor(run.combo / 3))
    if (nextMultiplier > run.multiplier) {
      run.multiplier = nextMultiplier
      this.toast(`কম্বো ×${nextMultiplier}!`, 'combo')
      this.bumpCombo()
    }
    run.mangoScore += 15 * run.multiplier
    run.score = Math.floor(run.distance * 2 + run.mangoScore)
    this.entities.release(entry)
    this.particles.emit(x, y, z, 0xffc247, 12, 3.5, 0.6, 2)
    this.sound.collect(run.combo)
    this.rickshaw.ringBell()
    this.bumpScore()
  }

  collectCha(entry) {
    const run = this.run
    const x = entry.mesh.position.x
    const z = entry.mesh.position.z
    run.shield = 9
    this.entities.release(entry)
    this.particles.emit(x, 1.2, z, 0xffdd8a, 22, 4.5, 0.8, 2)
    this.sound.power()
    this.toast('চা শক্তি — এক ধাক্কা মাফ', 'power')
    this.bumpScore()
  }

  triggerCrash() {
    const run = this.run
    if (run.crashed) return
    run.crashed = true
    run.crashTimer = 0
    this.shake = 1
    this.player.vy = 3.4
    this.player.y = Math.max(0.02, this.player.y)
    this.sound.crash()
    this.particles.emit(this.player.x, 1.1, 0.2, 0xffb35c, 26, 6.5, 1, 5)
    this.particles.emit(this.player.x, 0.4, 0.2, 0x35313a, 18, 4, 0.8, 4)
    if (run.score > this.best) {
      this.best = run.score
      run.newBest = true
      this.saveBest(this.best)
    }
    this.updateBestDisplays()
  }

  finishRun() {
    const run = this.run
    this.setPhase('over')
    this.updateBestDisplays()
    els.overScore.textContent = run.score.toLocaleString('en-US')
    els.overBest.textContent = this.best.toLocaleString('en-US')
    els.overMangoes.textContent = String(run.mangoes)
    els.overDistance.textContent = `${Math.floor(run.distance)} m`
    els.recordBadge.classList.toggle('show', run.newBest)
    this.sound.gameOver()
    this.sound.setIntensity(0)
  }

  bumpScore() {
    els.scoreValue.classList.remove('bump')
    void els.scoreValue.offsetWidth
    els.scoreValue.classList.add('bump')
  }

  bumpCombo() {
    els.comboWrap.classList.remove('pop')
    void els.comboWrap.offsetWidth
    els.comboWrap.classList.add('pop')
  }

  updateHud() {
    const run = this.run
    const scoreText = run.score.toLocaleString('en-US')
    if (scoreText !== this.lastHud.score) {
      els.scoreValue.textContent = scoreText
      this.lastHud.score = scoreText
    }
    if (this.lastHud.best !== this.best) {
      els.hudBest.textContent = this.best.toLocaleString('en-US')
      this.lastHud.best = this.best
    }
    const showCombo = run.multiplier > 1
    if (this.lastHud.combo !== showCombo) {
      els.comboWrap.classList.toggle('show', showCombo)
      this.lastHud.combo = showCombo
    }
    if (showCombo) {
      els.comboValue.textContent = `×${run.multiplier}`
    }

    const showPower = run.shield > 0
    if (this.lastHud.power !== showPower) {
      els.powerChip.classList.toggle('show', showPower)
      this.lastHud.power = showPower
    }
    if (showPower) els.powerTime.textContent = `${Math.ceil(run.shield)}s`

    const speedPct = clamp(((run.speed - 14) / 20) * 100, 0, 100)
    els.speedFill.style.transform = `scaleX(${(speedPct / 100).toFixed(3)})`
  }

  updateCamera(dt) {
    const target = new THREE.Vector3()
    const look = new THREE.Vector3()
    let fov = 58

    if (this.phase === 'menu') {
      const angle = Math.sin(this.time * 0.22) * 0.5
      target.set(Math.sin(angle) * 8.8, 3.35 + Math.sin(this.time * 0.5) * 0.12, Math.cos(angle) * 8.8)
      look.set(0, 1.3, 0)
      fov = 55
    } else if (this.phase === 'over') {
      target.set(this.player.x * 0.5 + 1.6, 4.1, 9.6)
      look.set(0, 1.0, -2)
      fov = 54
    } else if (this.phase === 'paused') {
      target.copy(this.camera.position)
      look.copy(this.cameraLook)
      fov = this.camera.fov
    } else {
      const portrait = clamp(1 - this.camera.aspect, 0, 0.6)
      target.set(this.player.x * 0.45, 3.15 + this.player.y * 0.14 + portrait * 0.9, 8.2 + portrait * 2.6)
      look.set(this.player.x * 0.18, 1.15 + this.player.y * 0.25, -9)
      fov = 57 + (this.run.speed - 15) * 0.36
    }

    const follow = this.phase === 'paused' ? 0 : this.phase === 'menu' ? 2.2 : 4.2
    this.camera.position.lerp(target, 1 - Math.exp(-follow * dt))
    this.cameraLook.lerp(look, 1 - Math.exp(-follow * dt))

    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, fov, 3, dt)
      this.camera.updateProjectionMatrix()
    }

    this.camera.lookAt(this.cameraLook)
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.4
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.28
      this.camera.rotation.z += (Math.random() - 0.5) * this.shake * 0.03
    }
  }

  toast(text, kind = '') {
    clearTimeout(this.toastTimer)
    els.toast.textContent = text
    els.toast.className = `toast show ${kind}`
    this.toastTimer = setTimeout(() => {
      els.toast.className = `toast ${kind}`
    }, 1700)
  }
}

const game = new Game()
window.__rickshawRush = game
game.init().catch((error) => {
  console.error(error)
  els.loader.classList.remove('done')
  els.loader.innerHTML = `<div class="loader-error"><h2>দুঃখিত!</h2><p>3D দৃশ্য লোড করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করো।</p><code>${String(error?.message || error)}</code></div>`
})
