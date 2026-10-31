export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.muted = false;
    this.enabled = false;
    this.lastCollect = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);

    // engine hum: two detuned saws through a lowpass
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 1.2;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    const oscA = this.ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 52;
    const oscB = this.ctx.createOscillator();
    oscB.type = 'triangle';
    oscB.frequency.value = 78;
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    oscA.start();
    oscB.start();
    this.engine = { oscA, oscB, filter, gain };

    // city ambience: soft filtered noise
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const nf = this.ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 380;
    nf.Q.value = 0.5;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.018;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(this.master);
    noise.start();
    this.ambience = { noise, gain: ng };

    this.enabled = true;
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.9, this.ctx.currentTime, 0.05);
    }
  }

  setEngine(speed = 0, active = false, boosting = false) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const target = active ? (boosting ? 0.05 : 0.032) : 0;
    this.engine.gain.gain.setTargetAtTime(target, t, 0.15);
    const base = 44 + Math.min(speed, 40) * 1.35 + (boosting ? 18 : 0);
    this.engine.oscA.frequency.setTargetAtTime(base, t, 0.2);
    this.engine.oscB.frequency.setTargetAtTime(base * 1.5, t, 0.2);
    this.engine.filter.frequency.setTargetAtTime(320 + speed * 16 + (boosting ? 500 : 0), t, 0.2);
  }

  blip(freq, duration = 0.14, type = 'triangle', volume = 0.13, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noiseBurst(duration = 0.4, volume = 0.3, filterFreq = 900, type = 'lowpass') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  collect(combo = 0) {
    if (!this.ctx) return;
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
    const idx = Math.min(scale.length - 1, combo % scale.length);
    this.blip(scale[idx], 0.16, 'triangle', 0.1, 90);
    this.blip(scale[idx] * 2, 0.09, 'sine', 0.04);
  }

  jump() {
    this.blip(240, 0.18, 'sine', 0.09, 260);
    this.noiseBurst(0.16, 0.05, 1200, 'highpass');
  }

  dash() {
    this.blip(180, 0.5, 'sawtooth', 0.08, 520);
    this.noiseBurst(0.5, 0.16, 2200, 'highpass');
  }

  nearMiss() {
    this.noiseBurst(0.26, 0.11, 2600, 'bandpass');
  }

  crash() {
    this.noiseBurst(0.6, 0.45, 700, 'lowpass');
    this.blip(120, 0.5, 'sawtooth', 0.16, -70);
    this.blip(60, 0.7, 'sine', 0.2, -20);
  }

  gameOver() {
    if (!this.ctx) return;
    const notes = [392, 349.23, 293.66, 220];
    notes.forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.3, 'triangle', 0.1), i * 130);
    });
  }

  ui() {
    this.blip(660, 0.07, 'square', 0.045);
  }

  start() {
    this.init();
    this.blip(392, 0.1, 'triangle', 0.08);
    setTimeout(() => this.blip(523.25, 0.14, 'triangle', 0.09), 110);
    setTimeout(() => this.blip(783.99, 0.18, 'triangle', 0.08), 220);
  }
}
