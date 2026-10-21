import type { GuardGrade } from '../../types';

export interface GuardSettings {
  perfectMs: number;   // +/- window around impact
  goodMs: number;
  cooldownMs: number;  // presses ignored for this long after a press (anti-mash)
}
export const GUARD_PRESETS: Record<'standard' | 'relaxed' | 'assist', GuardSettings> = {
  standard: { perfectMs: 70, goodMs: 170, cooldownMs: 320 },
  relaxed: { perfectMs: 115, goodMs: 270, cooldownMs: 260 },
  assist: { perfectMs: 170, goodMs: 380, cooldownMs: 200 },
};

interface Press { t: number; used: boolean }

/**
 * Per-defender timed guard. The clock is the director's own accumulated battle time, so pausing the game
 * freezes guard windows, and tests can drive it with fake time.
 */
export class GuardTracker {
  private presses = new Map<string, Press[]>();
  private lastPress = new Map<string, number>();
  constructor(public settings: GuardSettings = GUARD_PRESETS.standard) {}

  /** Hit-stop: grading happens this long after the contact frame so late presses can still count. */
  get lateMs() { return Math.round(this.settings.goodMs * 0.6); }

  press(uid: string, now: number): boolean {
    const last = this.lastPress.get(uid);
    if (last !== undefined && now - last < this.settings.cooldownMs) return false;
    this.lastPress.set(uid, now);
    const list = this.presses.get(uid) ?? [];
    list.push({ t: now, used: false });
    this.presses.set(uid, list);
    return true;
  }

  /** Grade the press nearest the impact for this defender and consume it. Presses far outside the window are ignored. */
  grade(uid: string, impactAt: number): GuardGrade {
    const list = this.presses.get(uid) ?? [];
    let best: Press | null = null;
    for (const p of list) {
      if (p.used) continue;
      if (!best || Math.abs(p.t - impactAt) < Math.abs(best.t - impactAt)) best = p;
    }
    if (!best) return 'none';
    const d = Math.abs(best.t - impactAt);
    if (d > this.settings.goodMs) return 'none';
    best.used = true;
    return d <= this.settings.perfectMs ? 'perfect' : 'good';
  }

  clear(uid?: string) {
    if (uid) { this.presses.delete(uid); this.lastPress.delete(uid); } else { this.presses.clear(); this.lastPress.clear(); }
  }
}
