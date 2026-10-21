import { audio } from './audio';

// Original procedural score. Each track is a small composition spec (key, mode, tempo, progression, orchestration)
// that is expanded into notes, rendered ONCE with an OfflineAudioContext into a long gapless loop, then crossfaded.
// This is a synthesised score: see docs/REQUIRED_MISSING_ASSETS.md for the honest audio status.

type Mode = 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'harmonicMinor';
const SCALES: Record<Mode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};
const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

interface TrackSpec {
  id: string; root: string; mode: Mode; bpm: number; bars: number;
  prog: number[];                     // scale degrees (0-based) of chord roots, repeated across the bars
  pad?: 'soft' | 'choir' | 'dark';
  bass?: 'root' | 'pulse' | 'walk' | 'octave';
  drums?: 'none' | 'soft' | 'march' | 'rock' | 'epic' | 'industrial';
  arp?: 'none' | 'up' | 'pluck' | 'bell' | 'fast';
  lead?: 'flute' | 'brass' | 'square' | 'bell' | 'none';
  leadDensity?: number;               // 0..1
  octave?: number;
  seed: number; once?: boolean;       // once: jingle, no loop
  vol?: number;
}

function mulberry(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Ev { t: number; d: number; f: number; v: 'pad' | 'bass' | 'lead' | 'arp' | 'kick' | 'snare' | 'hat' | 'tom' | 'crash'; g: number; kind?: string }

function compose(sp: TrackSpec): { events: Ev[]; seconds: number } {
  const rnd = mulberry(sp.seed);
  const beat = 60 / sp.bpm, bar = beat * 4, sc = SCALES[sp.mode], rootM = 48 + NOTE[sp.root] + (sp.octave ?? 0) * 12;
  const deg = (d: number, oct = 0) => rootM + sc[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct);
  const ev: Ev[] = [];
  const chordOf = (d: number) => [d, d + 2, d + 4];
  // lead motifs: 8-bar phrases A, A', B, A (seeded)
  const mkPhrase = (): { b: number; d: number; deg: number }[] => {
    const notes: { b: number; d: number; deg: number }[] = []; let b = 0; let cur = 4 + Math.floor(rnd() * 3);
    const rhythms = [[1, 1, 2], [1.5, 0.5, 1, 1], [2, 1, 1], [1, 0.5, 0.5, 2], [0.5, 0.5, 1, 1, 1]];
    while (b < 32 && notes.length < 80) {
      const rh = rhythms[Math.floor(rnd() * rhythms.length)];
      for (const r of rh) {
        if (b >= 32) break;
        if (rnd() < 0.18) { b += r; continue; }
        const step = [-2, -1, -1, 0, 1, 1, 2, 3][Math.floor(rnd() * 8)];
        cur = Math.max(2, Math.min(11, cur + step));
        notes.push({ b, d: r, deg: cur }); b += r;
      }
    }
    return notes;
  };
  const A = mkPhrase(), B = mkPhrase();
  const totalBars = sp.bars;
  for (let bi = 0; bi < totalBars; bi++) {
    const t0 = bi * bar, root = sp.prog[bi % sp.prog.length];
    const ch = chordOf(root);
    // pad
    if (sp.pad) for (const c of ch) ev.push({ t: t0, d: bar * 1.02, f: midi(deg(c, 0)), v: 'pad', g: sp.pad === 'dark' ? 0.09 : 0.11, kind: sp.pad });
    // bass
    if (sp.bass) {
      const bm = deg(root, -1);
      if (sp.bass === 'root') ev.push({ t: t0, d: bar * 0.95, f: midi(bm), v: 'bass', g: 0.3 });
      if (sp.bass === 'octave') for (let i = 0; i < 8; i++) ev.push({ t: t0 + i * beat * 0.5, d: beat * 0.45, f: midi(bm + (i % 2 ? 12 : 0)), v: 'bass', g: 0.26 });
      if (sp.bass === 'pulse') for (let i = 0; i < 8; i++) ev.push({ t: t0 + i * beat * 0.5, d: beat * 0.35, f: midi(bm), v: 'bass', g: i % 4 === 0 ? 0.34 : 0.22 });
      if (sp.bass === 'walk') [0, 1, 2, 3].forEach((i) => ev.push({ t: t0 + i * beat, d: beat * 0.9, f: midi(deg(root + [0, 2, 4, 2][i], -1)), v: 'bass', g: 0.28 }));
    }
    // arp
    if (sp.arp && sp.arp !== 'none') {
      const steps = sp.arp === 'fast' ? 16 : 8, len = bar / steps;
      for (let i = 0; i < steps; i++) {
        const idx = sp.arp === 'up' || sp.arp === 'fast' ? i % 4 : [0, 2, 1, 2, 0, 1, 2, 1][i % 8];
        const c = ch[idx % 3] + (idx >= 3 ? 7 : 0);
        ev.push({ t: t0 + i * len, d: len * (sp.arp === 'bell' ? 3 : 0.9), f: midi(deg(c, 1)), v: 'arp', g: sp.arp === 'bell' ? 0.1 : 0.08, kind: sp.arp });
      }
    }
    // drums
    const dr = sp.drums ?? 'none';
    if (dr !== 'none') {
      for (let q = 0; q < 4; q++) {
        const t = t0 + q * beat;
        if (dr === 'soft') { if (q % 2 === 0) ev.push({ t, d: 0.2, f: 60, v: 'kick', g: 0.22 }); ev.push({ t: t + beat / 2, d: 0.05, f: 0, v: 'hat', g: 0.04 }); }
        if (dr === 'march') { ev.push({ t, d: 0.2, f: 60, v: 'kick', g: 0.34 }); if (q % 2) ev.push({ t, d: 0.15, f: 0, v: 'snare', g: 0.22 }); ev.push({ t: t + beat / 2, d: 0.05, f: 0, v: 'hat', g: 0.06 }); }
        if (dr === 'rock' || dr === 'epic') {
          if (q === 0 || q === 2 || (q === 3 && rnd() < 0.4)) ev.push({ t, d: 0.2, f: 58, v: 'kick', g: 0.4 });
          if (q % 2) ev.push({ t, d: 0.18, f: 0, v: 'snare', g: 0.32 });
          ev.push({ t, d: 0.04, f: 0, v: 'hat', g: 0.07 }); ev.push({ t: t + beat / 2, d: 0.04, f: 0, v: 'hat', g: 0.05 });
          if (dr === 'epic' && q === 3) { ev.push({ t: t + beat * 0.5, d: 0.2, f: 90, v: 'tom', g: 0.26 }); ev.push({ t: t + beat * 0.75, d: 0.2, f: 70, v: 'tom', g: 0.26 }); }
        }
        if (dr === 'industrial') { ev.push({ t, d: 0.18, f: 52, v: 'kick', g: 0.38 }); ev.push({ t: t + beat / 2, d: 0.05, f: 0, v: 'hat', g: 0.09 }); if (q === 2) ev.push({ t, d: 0.2, f: 0, v: 'snare', g: 0.26 }); }
      }
      if (bi % 8 === 0 && (dr === 'epic' || dr === 'rock')) ev.push({ t: t0, d: 1.4, f: 0, v: 'crash', g: 0.14 });
    }
    // lead
    if (sp.lead && sp.lead !== 'none' && (sp.leadDensity ?? 0.8) > 0) {
      const phraseIdx = Math.floor(bi / 8) % 4, ph = phraseIdx === 2 ? B : A, local = (bi % 8) * 4;
      for (const n of ph) {
        if (n.b < local || n.b >= local + 4) continue;
        if (rnd() > (sp.leadDensity ?? 0.8)) continue;
        // snap strong beats to chord tones
        let d = n.deg; if (Math.floor(n.b) % 2 === 0 && n.b === Math.floor(n.b)) { const tones = [root, root + 2, root + 4].map((x) => ((x % 7) + 7) % 7); const dm = ((d % 7) + 7) % 7; if (!tones.includes(dm)) d += 1; }
        const shift = phraseIdx === 1 ? 1 : phraseIdx === 3 ? -1 : 0;
        ev.push({ t: t0 + (n.b - local) * beat, d: n.d * beat * (sp.lead === 'bell' ? 2 : 0.92), f: midi(deg(d + shift, 1)), v: 'lead', g: sp.lead === 'brass' ? 0.16 : 0.15, kind: sp.lead });
      }
    }
  }
  return { events: ev, seconds: totalBars * bar };
}

async function render(sp: TrackSpec): Promise<AudioBuffer> {
  const { events, seconds } = compose(sp);
  const sr = 32000; const tail = sp.once ? 1.5 : 0;
  const ctx = new OfflineAudioContext(2, Math.ceil((seconds + tail) * sr), sr);
  const master = ctx.createGain(); master.gain.value = sp.vol ?? 0.8;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master.connect(comp); comp.connect(ctx.destination);
  // short stereo echo for space
  const dl = ctx.createDelay(1); dl.delayTime.value = (60 / sp.bpm) * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.28; const wet = ctx.createGain(); wet.gain.value = 0.22;
  dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(comp);
  const noise = ctx.createBuffer(1, sr, sr); { const d = noise.getChannelData(0); for (let i = 0; i < sr; i++) d[i] = Math.random() * 2 - 1; }
  const osc = (type: OscillatorType, f: number, t: number, d: number, g: number, opt: { a?: number; r?: number; lp?: number; detune?: number; send?: boolean; pan?: number; vib?: number } = {}) => {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = opt.detune ?? 0;
    const gn = ctx.createGain(); const a = opt.a ?? 0.01, r = opt.r ?? 0.08;
    gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(g, t + a); gn.gain.setValueAtTime(g, Math.max(t + a, t + d - r)); gn.gain.linearRampToValueAtTime(0.0001, t + d + r);
    let out: AudioNode = gn;
    o.connect(gn);
    if (opt.lp) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = opt.lp; gn.connect(lp); out = lp; }
    if (opt.vib) { const l = ctx.createOscillator(); l.frequency.value = 5.2; const lg = ctx.createGain(); lg.gain.value = opt.vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + d + r + 0.1); }
    const pn = ctx.createStereoPanner(); pn.pan.value = opt.pan ?? 0; out.connect(pn); pn.connect(master); if (opt.send) pn.connect(dl);
    o.start(t); o.stop(t + d + r + 0.05);
  };
  const nz = (t: number, d: number, g: number, lp: number, hp = 0) => {
    const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; const gn = ctx.createGain();
    gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d); s.connect(f); let o: AudioNode = f;
    if (hp) { const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; f.connect(h); o = h; }
    o.connect(gn); gn.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
  };
  for (const e of events) {
    switch (e.v) {
      case 'pad': {
        const choir = e.kind === 'choir', dark = e.kind === 'dark';
        osc(choir ? 'triangle' : 'sawtooth', e.f, e.t, e.d, e.g, { a: 0.5, r: 0.6, lp: dark ? 700 : choir ? 1800 : 1100, detune: -7, pan: -0.4 });
        osc(choir ? 'triangle' : 'sawtooth', e.f, e.t, e.d, e.g * 0.9, { a: 0.5, r: 0.6, lp: dark ? 700 : choir ? 1800 : 1100, detune: 8, pan: 0.4 });
        break; }
      case 'bass': osc('sawtooth', e.f, e.t, e.d, e.g, { a: 0.01, r: 0.06, lp: 520 }); osc('sine', e.f / 2, e.t, e.d, e.g * 0.8, { a: 0.01, r: 0.06 }); break;
      case 'arp': osc(e.kind === 'bell' ? 'sine' : 'triangle', e.f, e.t, e.d, e.g, { a: 0.004, r: e.kind === 'bell' ? 0.7 : 0.09, send: true, pan: ((e.t * 37) % 1) - 0.5 }); if (e.kind === 'bell') osc('sine', e.f * 2.01, e.t, e.d * 0.6, e.g * 0.4, { a: 0.004, r: 0.5, send: true }); break;
      case 'lead': {
        const k = e.kind;
        if (k === 'brass') { osc('sawtooth', e.f, e.t, e.d, e.g, { a: 0.04, r: 0.1, lp: 2400, vib: 4 }); osc('square', e.f, e.t, e.d, e.g * 0.4, { a: 0.04, r: 0.1, lp: 1600, detune: 6 }); }
        else if (k === 'square') osc('square', e.f, e.t, e.d, e.g * 0.7, { a: 0.01, r: 0.05, lp: 3000, send: true });
        else if (k === 'bell') { osc('sine', e.f, e.t, e.d, e.g, { a: 0.005, r: 0.8, send: true }); osc('sine', e.f * 3, e.t, e.d * 0.5, e.g * 0.3, { a: 0.005, r: 0.5 }); }
        else osc('triangle', e.f, e.t, e.d, e.g, { a: 0.05, r: 0.12, vib: 3, send: true });
        break; }
      case 'kick': { const o = ctx.createOscillator(); const gn = ctx.createGain(); o.frequency.setValueAtTime(150, e.t); o.frequency.exponentialRampToValueAtTime(40, e.t + 0.12); gn.gain.setValueAtTime(e.g * 2, e.t); gn.gain.exponentialRampToValueAtTime(0.0001, e.t + 0.2); o.connect(gn); gn.connect(master); o.start(e.t); o.stop(e.t + 0.22); break; }
      case 'snare': nz(e.t, 0.14, e.g * 1.4, 7000, 1200); osc('triangle', 190, e.t, 0.06, e.g * 0.6, { a: 0.001, r: 0.05 }); break;
      case 'hat': nz(e.t, e.d, e.g * 1.5, 12000, 6000); break;
      case 'tom': { const o = ctx.createOscillator(); const gn = ctx.createGain(); o.frequency.setValueAtTime(e.f * 1.5, e.t); o.frequency.exponentialRampToValueAtTime(e.f, e.t + 0.15); gn.gain.setValueAtTime(e.g * 2, e.t); gn.gain.exponentialRampToValueAtTime(0.0001, e.t + 0.22); o.connect(gn); gn.connect(master); o.start(e.t); o.stop(e.t + 0.25); break; }
      case 'crash': nz(e.t, e.d, e.g * 1.4, 14000, 3000); break;
    }
  }
  return ctx.startRendering();
}

const T = (s: TrackSpec) => s;
export const TRACKS: Record<string, TrackSpec> = {};
[
  T({ id: 'title', root: 'D', mode: 'lydian', bpm: 84, bars: 32, prog: [0, 4, 5, 3, 0, 4, 1, 4], pad: 'choir', bass: 'root', drums: 'soft', arp: 'up', lead: 'flute', leadDensity: 0.8, seed: 11 }),
  T({ id: 'namek_day', root: 'G', mode: 'major', bpm: 92, bars: 32, prog: [0, 3, 4, 0, 5, 3, 1, 4], pad: 'soft', bass: 'walk', drums: 'soft', arp: 'pluck', lead: 'flute', leadDensity: 0.7, seed: 21 }),
  T({ id: 'namek_village', root: 'A', mode: 'mixolydian', bpm: 72, bars: 32, prog: [0, 6, 3, 0, 4, 3, 0, 6], pad: 'soft', bass: 'root', drums: 'none', arp: 'bell', lead: 'flute', leadDensity: 0.55, seed: 31 }),
  T({ id: 'namek_sacred', root: 'F', mode: 'lydian', bpm: 62, bars: 24, prog: [0, 4, 1, 3, 0, 5, 4, 1], pad: 'choir', bass: 'root', drums: 'none', arp: 'bell', lead: 'bell', leadDensity: 0.5, seed: 41 }),
  T({ id: 'namek_cave', root: 'E', mode: 'phrygian', bpm: 60, bars: 24, prog: [0, 1, 0, 5, 0, 1, 3, 1], pad: 'dark', bass: 'root', drums: 'none', arp: 'bell', lead: 'none', seed: 51 }),
  T({ id: 'frieza_camp', root: 'C', mode: 'minor', bpm: 102, bars: 32, prog: [0, 5, 3, 4, 0, 5, 6, 4], pad: 'dark', bass: 'pulse', drums: 'march', arp: 'none', lead: 'brass', leadDensity: 0.55, seed: 61 }),
  T({ id: 'frieza_ship', root: 'F#', mode: 'harmonicMinor', bpm: 96, bars: 24, prog: [0, 0, 5, 4, 0, 3, 5, 4], pad: 'dark', bass: 'pulse', drums: 'industrial', arp: 'fast', lead: 'square', leadDensity: 0.3, seed: 71 }),
  T({ id: 'ginyu_theme', root: 'E', mode: 'phrygian', bpm: 132, bars: 32, prog: [0, 1, 0, 5, 3, 1, 0, 6], pad: 'dark', bass: 'pulse', drums: 'rock', arp: 'none', lead: 'square', leadDensity: 0.85, seed: 81 }),
  T({ id: 'battle', root: 'A', mode: 'minor', bpm: 152, bars: 32, prog: [0, 5, 3, 6, 0, 5, 4, 4], pad: 'dark', bass: 'octave', drums: 'rock', arp: 'fast', lead: 'brass', leadDensity: 0.8, seed: 91 }),
  T({ id: 'boss', root: 'D', mode: 'minor', bpm: 144, bars: 32, prog: [0, 5, 6, 4, 0, 3, 6, 4], pad: 'dark', bass: 'octave', drums: 'epic', arp: 'none', lead: 'brass', leadDensity: 0.9, seed: 101 }),
  T({ id: 'frieza', root: 'B', mode: 'harmonicMinor', bpm: 138, bars: 32, prog: [0, 5, 0, 3, 5, 4, 0, 1], pad: 'dark', bass: 'pulse', drums: 'epic', arp: 'fast', lead: 'brass', leadDensity: 0.85, seed: 111 }),
  T({ id: 'final_battle', root: 'E', mode: 'minor', bpm: 164, bars: 32, prog: [0, 5, 6, 4, 0, 6, 5, 4], pad: 'choir', bass: 'octave', drums: 'epic', arp: 'fast', lead: 'brass', leadDensity: 0.95, seed: 121 }),
  T({ id: 'ssj', root: 'A', mode: 'minor', bpm: 96, bars: 16, prog: [0, 0, 5, 5, 3, 3, 4, 4], pad: 'choir', bass: 'root', drums: 'epic', arp: 'fast', lead: 'brass', leadDensity: 1, seed: 131 }),
  T({ id: 'epilogue', root: 'G', mode: 'major', bpm: 76, bars: 32, prog: [0, 4, 5, 3, 0, 4, 1, 4], pad: 'choir', bass: 'root', drums: 'none', arp: 'bell', lead: 'flute', leadDensity: 0.7, seed: 141 }),
  T({ id: 'cooler_ruins', root: 'F#', mode: 'dorian', bpm: 58, bars: 24, prog: [0, 5, 3, 4, 0, 6, 3, 1], pad: 'choir', bass: 'root', drums: 'none', arp: 'bell', lead: 'bell', leadDensity: 0.45, seed: 171 }),
  T({ id: 'cooler_battle', root: 'C#', mode: 'harmonicMinor', bpm: 148, bars: 32, prog: [0, 5, 6, 4, 0, 1, 5, 4], pad: 'choir', bass: 'octave', drums: 'epic', arp: 'fast', lead: 'brass', leadDensity: 0.95, seed: 181 }),
  T({ id: 'victory', root: 'C', mode: 'major', bpm: 128, bars: 4, prog: [0, 3, 4, 0], pad: 'soft', bass: 'octave', drums: 'rock', arp: 'none', lead: 'brass', leadDensity: 1, seed: 151, once: true }),
  T({ id: 'defeat', root: 'D', mode: 'minor', bpm: 60, bars: 4, prog: [0, 5, 3, 4], pad: 'dark', bass: 'root', drums: 'none', lead: 'bell', leadDensity: 0.7, seed: 161, once: true }),
].forEach((t) => { TRACKS[t.id] = t; });

class MusicPlayer {
  private cache = new Map<string, Promise<AudioBuffer>>();
  private current: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wanted = '';
  private token = 0;

  /** Render (once) and start a track with a crossfade. Safe to call before audio is unlocked: it starts on first gesture. */
  async play(id: string, fadeMs = 900) {
    this.wanted = id;
    if (!TRACKS[id]) return;
    const my = ++this.token;
    if (!audio.ctx || audio.ctx.state !== 'running') { const retry = () => { window.removeEventListener('pointerdown', retry); window.removeEventListener('keydown', retry); setTimeout(() => { if (this.wanted === id) void this.play(id, fadeMs); }, 60); }; window.addEventListener('pointerdown', retry, { once: true }); window.addEventListener('keydown', retry, { once: true }); return; }
    if (this.current?.id === id) return;
    let buf: AudioBuffer;
    try { buf = await this.get(id); } catch { return; }
    if (my !== this.token || this.wanted !== id) return;
    const ctx = audio.ctx!; const bus = audio.musicBus(); if (!bus) return;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = !TRACKS[id].once; const gain = ctx.createGain(); gain.gain.value = 0.0001;
    src.connect(gain); gain.connect(bus); src.start();
    const t = ctx.currentTime; gain.gain.setTargetAtTime(1, t, fadeMs / 3000);
    const prev = this.current; this.current = { id, src, gain };
    if (prev) { prev.gain.gain.setTargetAtTime(0.0001, t, fadeMs / 3000); setTimeout(() => { try { prev.src.stop(); } catch { /* already stopped */ } }, fadeMs * 2); }
  }
  stop(fadeMs = 600) {
    this.wanted = ''; this.token++;
    const c = this.current; this.current = null; if (!c || !audio.ctx) return;
    c.gain.gain.setTargetAtTime(0.0001, audio.ctx.currentTime, fadeMs / 3000);
    setTimeout(() => { try { c.src.stop(); } catch { /* ok */ } }, fadeMs * 2);
  }
  get(id: string): Promise<AudioBuffer> { let p = this.cache.get(id); if (!p) { p = render(TRACKS[id]); this.cache.set(id, p); } return p; }
  /** Pre-render in the background so transitions are instant. */
  warm(ids: string[]) { ids.forEach((id, i) => setTimeout(() => { if (audio.ctx && TRACKS[id]) void this.get(id); }, 1500 + i * 2500)); }
  get currentId() { return this.current?.id ?? ''; }
}
export const music = new MusicPlayer();
export const trackSeconds = (id: string) => { const t = TRACKS[id]; return t ? (t.bars * 4 * 60) / t.bpm : 0; };
