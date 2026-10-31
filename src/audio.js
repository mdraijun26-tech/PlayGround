export class Sound {
  constructor() {
    this.ctx = null
    this.master = null
    this.windGain = null
    this.windFilter = null
    this.muted = false
    this.noiseBuffer = null
  }

  async unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      this.ctx = new AudioCtx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.8
      this.master.connect(this.ctx.destination)
      this.noiseBuffer = this.createNoise()
      this.startWind()
    }
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* ignore */
      }
    }
  }

  createNoise() {
    const duration = 2
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  startWind() {
    if (!this.ctx) return
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    source.loop = true
    this.windFilter = this.ctx.createBiquadFilter()
    this.windFilter.type = 'lowpass'
    this.windFilter.frequency.value = 320
    this.windGain = this.ctx.createGain()
    this.windGain.gain.value = 0.012
    source.connect(this.windFilter)
    this.windFilter.connect(this.windGain)
    this.windGain.connect(this.master)
    source.start()
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.05)
    }
  }

  setIntensity(speed) {
    if (!this.ctx || !this.windGain) return
    const target = 0.01 + Math.min(0.055, speed * 0.0018)
    this.windGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25)
    this.windFilter.frequency.setTargetAtTime(240 + speed * 14, this.ctx.currentTime, 0.3)
  }

  tone({ freq = 440, to = null, dur = 0.2, type = 'sine', vol = 0.16, delay = 0, attack = 0.01 }) {
    if (!this.ctx || this.muted) return
    const t0 = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  noiseBurst({ dur = 0.2, freq = 1200, q = 0.8, vol = 0.12, delay = 0, type = 'bandpass', sweep = null }) {
    if (!this.ctx || this.muted) return
    const t0 = this.ctx.currentTime + delay
    const source = this.ctx.createBufferSource()
    source.buffer = this.noiseBuffer
    const filter = this.ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.setValueAtTime(freq, t0)
    if (sweep) filter.frequency.exponentialRampToValueAtTime(sweep, t0 + dur)
    filter.Q.value = q
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(vol, t0)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    source.start(t0)
    source.stop(t0 + dur + 0.02)
  }

  collect(combo = 0) {
    const base = 720 + Math.min(combo, 12) * 38
    this.tone({ freq: base, dur: 0.18, type: 'triangle', vol: 0.12 })
    this.tone({ freq: base * 1.5, dur: 0.22, type: 'sine', vol: 0.09, delay: 0.05 })
  }

  crash() {
    this.noiseBurst({ dur: 0.45, freq: 900, sweep: 120, vol: 0.4, type: 'lowpass' })
    this.tone({ freq: 150, to: 42, dur: 0.5, type: 'sine', vol: 0.35 })
    this.tone({ freq: 85, to: 38, dur: 0.6, type: 'square', vol: 0.08, delay: 0.02 })
  }

  jump() {
    this.tone({ freq: 300, to: 620, dur: 0.16, type: 'sine', vol: 0.1 })
    this.noiseBurst({ dur: 0.12, freq: 700, sweep: 2200, vol: 0.05, type: 'bandpass' })
  }

  lane() {
    this.noiseBurst({ dur: 0.09, freq: 1500, sweep: 700, vol: 0.05, type: 'bandpass' })
  }

  power() {
    const notes = [523, 659, 784, 1046]
    notes.forEach((freq, i) => this.tone({ freq, dur: 0.24, type: 'triangle', vol: 0.1, delay: i * 0.075 }))
  }

  shieldSave() {
    this.tone({ freq: 880, to: 1320, dur: 0.3, type: 'triangle', vol: 0.15 })
    this.noiseBurst({ dur: 0.3, freq: 2400, vol: 0.09, type: 'highpass' })
  }

  click() {
    this.tone({ freq: 520, dur: 0.07, type: 'square', vol: 0.05 })
  }

  start() {
    this.tone({ freq: 660, dur: 0.5, type: 'triangle', vol: 0.14 })
    this.tone({ freq: 990, dur: 0.7, type: 'sine', vol: 0.10, delay: 0.06 })
    this.noiseBurst({ dur: 0.5, freq: 300, sweep: 1800, vol: 0.05, type: 'bandpass' })
  }

  gameOver() {
    const notes = [392, 330, 262, 196]
    notes.forEach((freq, i) => this.tone({ freq, dur: 0.3, type: 'triangle', vol: 0.12, delay: i * 0.16 }))
  }
}
