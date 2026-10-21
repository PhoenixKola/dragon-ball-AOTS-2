// Offline WebAudio mixer: separate music / sfx / ui buses with ducking, fades and synthesised SFX.
// No audio files are required at runtime; every effect is generated, so nothing can 404 offline.

export type BusName = 'music' | 'sfx' | 'ui';

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<BusName, GainNode>;
  private musicDuck!: GainNode;
  volumes: Record<BusName, number> = { music: 0.55, sfx: 0.8, ui: 0.6 };
  muted = false;
  private noiseBuf: AudioBuffer | null = null;
  private lastPlayed = new Map<string, number>();

  /** Must be called from a user gesture (key/click). Safe to call repeatedly. */
  resume() {
    try {
      if (!this.ctx) {
        const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!C) return;
        this.ctx = new C();
        this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        this.musicDuck = this.ctx.createGain(); this.musicDuck.connect(this.master);
        this.buses = { music: this.ctx.createGain(), sfx: this.ctx.createGain(), ui: this.ctx.createGain() };
        this.buses.music.connect(this.musicDuck); this.buses.sfx.connect(this.master); this.buses.ui.connect(this.master);
        this.applyVolumes();
        const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* audio unavailable: game continues silently */ }
  }
  get ready() { return !!this.ctx && this.ctx.state === 'running'; }
  musicBus(): GainNode | null { return this.ctx ? this.buses.music : null; }

  setVolume(bus: BusName, v: number) { this.volumes[bus] = Math.max(0, Math.min(1, v)); this.applyVolumes(); }
  setMuted(m: boolean) { this.muted = m; this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    (Object.keys(this.buses) as BusName[]).forEach((b) => this.buses[b].gain.setTargetAtTime(this.muted ? 0 : this.volumes[b], t, 0.02));
  }
  /** Lower music under big hits / banners, then recover. */
  duck(amount = 0.45, ms = 500) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicDuck.gain.cancelScheduledValues(t);
    this.musicDuck.gain.setTargetAtTime(amount, t, 0.02);
    this.musicDuck.gain.setTargetAtTime(1, t + ms / 1000, 0.25);
  }

  // ---- synthesis helpers ----
  private env(g: GainNode, t: number, a: number, peak: number, d: number) {
    g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, bus: BusName = 'sfx', delay = 0, detune = 0) {
    const c = this.ctx!; const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); o.detune.value = detune;
    this.env(g, t, 0.004, peak, dur); o.connect(g); g.connect(this.buses[bus]); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, peak: number, lp: number, lpEnd = lp, bus: BusName = 'sfx', delay = 0, hp = 0) {
    const c = this.ctx!; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(lp, t); f.frequency.exponentialRampToValueAtTime(Math.max(60, lpEnd), t + dur);
    const g = c.createGain(); this.env(g, t, 0.003, peak, dur);
    s.connect(f); let last: AudioNode = f;
    if (hp) { const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; f.connect(h); last = h; }
    last.connect(g); g.connect(this.buses[bus]); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  /** Play a named effect. Rate-limited per id so 8-hit barrages do not clip. */
  sfx(id: string) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(id) ?? -1;
    const gap = id === 'blast' ? 0.04 : id === 'hit' ? 0.045 : 0.02;
    if (now - last < gap) return;
    this.lastPlayed.set(id, now);
    switch (id) {
      case 'hit': this.noise(0.12, 0.7, 4200, 500); this.tone('sine', 150, 55, 0.14, 0.7); break;
      case 'impact_big': this.noise(0.3, 0.9, 3000, 200); this.tone('sine', 110, 38, 0.32, 0.9); break;
      case 'dash': this.noise(0.18, 0.35, 1800, 5200, 'sfx', 0, 700); break;
      case 'blast': this.tone('square', 900, 220, 0.12, 0.22); this.noise(0.08, 0.18, 6000, 1500); break;
      case 'charge': this.tone('sawtooth', 90, 520, 0.8, 0.28); this.tone('sine', 180, 1040, 0.8, 0.18, 'sfx', 0, 7); this.noise(0.7, 0.12, 400, 3200); break;
      case 'beam': this.noise(0.55, 0.45, 2200, 700, 'sfx', 0, 200); this.tone('sawtooth', 420, 140, 0.55, 0.3); this.tone('square', 210, 90, 0.5, 0.18); break;
      case 'kame': this.tone('sawtooth', 160, 640, 0.25, 0.3); this.noise(0.8, 0.5, 2600, 500, 'sfx', 0.1, 150); this.tone('sawtooth', 640, 180, 0.7, 0.3, 'sfx', 0.2); this.duck(0.35, 800); break;
      case 'disc': this.tone('triangle', 1700, 2300, 0.5, 0.2); this.tone('triangle', 1710, 2310, 0.5, 0.15, 'sfx', 0, 30); break;
      case 'flare': this.tone('sine', 2400, 3200, 0.5, 0.35); this.noise(0.5, 0.3, 9000, 3000, 'sfx', 0, 2000); break;
      case 'guard': this.tone('square', 520, 380, 0.1, 0.35); this.noise(0.06, 0.3, 5000, 1500, 'sfx', 0, 1500); break;
      case 'perfect': this.tone('triangle', 1318, 1318, 0.25, 0.4); this.tone('triangle', 1975, 1975, 0.35, 0.3, 'sfx', 0.05); this.tone('sine', 2637, 2637, 0.4, 0.2, 'sfx', 0.09); break;
      case 'heal': [523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f, f, 0.35, 0.22, 'sfx', i * 0.07)); break;
      case 'ko': this.noise(0.6, 0.6, 2500, 100); this.tone('sawtooth', 300, 40, 0.7, 0.4); this.duck(0.4, 900); break;
      case 'select': this.tone('square', 880, 880, 0.04, 0.12, 'ui'); break;
      case 'confirm': this.tone('square', 660, 990, 0.09, 0.16, 'ui'); break;
      case 'cancel': this.tone('square', 330, 220, 0.09, 0.14, 'ui'); break;
      case 'error': this.tone('square', 160, 120, 0.14, 0.18, 'ui'); break;
      case 'banner': this.tone('sawtooth', 220, 440, 0.2, 0.18, 'ui'); this.noise(0.25, 0.2, 3000, 800, 'ui'); break;
      case 'step': this.noise(0.05, 0.1, 900, 300); break;
      case 'victory': [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.22, 0.18, 'ui', i * 0.13)); break;
      case 'defeat': [392, 349, 311, 262].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.5, 0.25, 'ui', i * 0.3)); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.16, 0.16, 'ui', i * 0.08)); break;
      case 'sparking': this.tone('sawtooth', 110, 880, 0.9, 0.3); [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, 0.5, 0.16, 'sfx', 0.25 + i * 0.06)); this.noise(0.9, 0.3, 700, 5200); this.duck(0.25, 1200); break;
      case 'kaioken': this.tone('sawtooth', 70, 260, 0.9, 0.34); this.tone('square', 140, 520, 0.6, 0.18, 'sfx', 0.1); this.noise(0.7, 0.3, 500, 2400); break;
      case 'rageready': [880, 1175, 1568].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.28, 'sfx', i * 0.06)); break;
      case 'transform': this.tone('sawtooth', 60, 900, 1.8, 0.35); this.noise(1.8, 0.4, 500, 6000); this.duck(0.2, 2400); break;
      case 'pickup': this.tone('triangle', 988, 1319, 0.12, 0.25, 'ui'); this.tone('triangle', 1319, 1760, 0.2, 0.25, 'ui', 0.1); break;
      case 'door': this.noise(0.25, 0.3, 700, 200); this.tone('sine', 120, 70, 0.25, 0.3); break;
      case 'save': [784, 988, 1175].forEach((f, i) => this.tone('sine', f, f, 0.2, 0.2, 'ui', i * 0.09)); break;
      default: break;
    }
  }
}
export const audio = new AudioEngine();
