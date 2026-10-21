import { audio } from '../engine/audio/audio';

export interface Settings {
  guardPreset: 'standard' | 'relaxed' | 'assist';
  battleSpeed: 1 | 1.6;
  screenShake: boolean;
  reducedFlash: boolean;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  integerScale: boolean;
  /** Request browser full screen on the first key/click (F toggles it at any time). */
  fullscreen: boolean;
  difficulty: 'normal' | 'easy';
  showDiagnostics: boolean;
  /** Use the not-yet-approved overworld sets (Gohan Namek recolour, SSJ test) instead of the battle-idle fallback. */
  provisionalArt: boolean;
  vfxStyle: 'sprites' | 'procedural';
  /** The one-time Rage / Sparking hint has been shown. */
  rageTipSeen: boolean;
  /** The one-time full-screen / Back-key tip has been shown. */
  fsTipSeen: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  guardPreset: 'standard', battleSpeed: 1, screenShake: true, reducedFlash: false, musicVolume: 0.55, sfxVolume: 0.8,
  muted: false, integerScale: false, fullscreen: true, difficulty: 'normal', showDiagnostics: false, provisionalArt: true, vfxStyle: 'sprites', rageTipSeen: false, fsTipSeen: false,
};
const KEY = 'aots2.settings.v1';
type Listener = () => void;
const listeners = new Set<Listener>();
let current: Settings = load();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Settings>;
      const out = { ...DEFAULT_SETTINGS };
      (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).forEach((k) => { if (typeof v[k] === typeof DEFAULT_SETTINGS[k]) (out as Record<string, unknown>)[k] = v[k]; });
      if (!['standard', 'relaxed', 'assist'].includes(out.guardPreset)) out.guardPreset = 'standard';
      if (out.battleSpeed !== 1 && out.battleSpeed !== 1.6) out.battleSpeed = 1;
      if (out.vfxStyle !== 'sprites' && out.vfxStyle !== 'procedural') out.vfxStyle = 'sprites';
      return out;
    }
  } catch { /* corrupt or blocked storage: use defaults */ }
  return { ...DEFAULT_SETTINGS };
}
export const getSettings = () => current;
export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  audio.setVolume('music', current.musicVolume); audio.setVolume('sfx', current.sfxVolume); audio.setVolume('ui', current.sfxVolume * 0.8); audio.setMuted(current.muted);
  listeners.forEach((l) => l());
}
export function subscribeSettings(l: Listener) { listeners.add(l); return () => { listeners.delete(l); }; }
audio.volumes = { music: current.musicVolume, sfx: current.sfxVolume, ui: current.sfxVolume * 0.8 }; audio.muted = current.muted;
