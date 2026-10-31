export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.ambientGain = null;
    this.muted = localStorage.getItem('nouka-muted') === '1';
    this.oarTimer = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(2.4);
      this.startAmbience();
    } catch (err) {
      this.ctx = null;
    }
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, Math.floor(rate * seconds), rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  startAmbience() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.4;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.055;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.16;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    this.ambientGain = gain;
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem('nouka-muted', muted ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  tone(freq, duration = 0.15, type = 'sine', volume = 0.16, delay = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  burst(duration = 0.3, volume = 0.14, band = 900, q = 0.9, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = band;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  splash(amount = 1) {
    this.burst(0.34, 0.1 * amount, 1100, 0.8);
    this.tone(190 + Math.random() * 60, 0.12, 'sine', 0.03 * amount);
  }

  oar() {
    this.burst(0.4, 0.075, 760, 0.6);
  }

  boost() {
    this.burst(0.55, 0.11, 2400, 0.7);
    this.tone(180, 0.5, 'sawtooth', 0.05, 0, 520);
  }

  collect() {
    this.tone(880, 0.18, 'sine', 0.12);
    this.tone(1320, 0.3, 'sine', 0.09, 0.09);
    this.tone(1760, 0.4, 'sine', 0.06, 0.18);
  }

  bump() {
    this.burst(0.25, 0.16, 240, 0.8);
    this.tone(110, 0.22, 'sine', 0.1, 0, 60);
  }

  beep(high = false) {
    this.tone(high ? 880 : 520, high ? 0.5 : 0.18, 'triangle', 0.16);
  }

  horn() {
    this.tone(196, 0.9, 'sawtooth', 0.07);
    this.tone(247, 0.9, 'triangle', 0.07);
    this.tone(294, 0.95, 'triangle', 0.06);
    this.burst(0.7, 0.05, 500, 0.5);
  }

  cheer() {
    this.burst(1.4, 0.1, 1200, 0.35);
    this.burst(1.1, 0.08, 2200, 0.5, 0.15);
  }

  finish(win) {
    const notes = win ? [523, 659, 784, 1047, 1319] : [392, 494, 587, 784];
    notes.forEach((n, i) => this.tone(n, 0.34, 'triangle', 0.11, i * 0.14));
    if (win) this.cheer();
  }

  bird() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const base = 2100 + Math.random() * 900;
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(base, t + i * 0.16);
      osc.frequency.exponentialRampToValueAtTime(base * 1.5, t + i * 0.16 + 0.06);
      osc.frequency.exponentialRampToValueAtTime(base * 0.9, t + i * 0.16 + 0.14);
      gain.gain.setValueAtTime(0.0001, t + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.022, t + i * 0.16 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.16);
      osc.connect(gain).connect(this.master);
      osc.start(t + i * 0.16);
      osc.stop(t + i * 0.16 + 0.2);
    }
  }
}
