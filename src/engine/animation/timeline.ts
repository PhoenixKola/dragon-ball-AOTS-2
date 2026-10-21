import type { ClipDef, ClipOp } from './clips';

export type TimelineEvent =
  | { t: number; kind: 'op'; op: ClipOp }
  | { t: number; kind: 'marker'; hit: number; by: number };

/** Expand a clip into a flat, ordered list of op-start events and hit markers. */
export function expandClip(clip: ClipDef): TimelineEvent[] {
  const ev: TimelineEvent[] = [];
  for (const op of clip.ops) {
    ev.push({ t: op.t, kind: 'op', op });
    if (op.op === 'proj' && op.hit !== undefined) ev.push({ t: op.t + op.dur, kind: 'marker', hit: op.hit, by: op.by ?? 0 });
    if (op.op === 'hit') ev.push({ t: op.t, kind: 'marker', hit: op.hit, by: op.by ?? 0 });
  }
  // stable: ops before markers at identical times
  return ev.map((e, i) => ({ e, i })).sort((a, b) => a.e.t - b.e.t || a.i - b.i).map((x) => x.e);
}

export interface RunnerHandlers {
  op(op: ClipOp, t: number): void;
  marker(hit: number, t: number): void;
}

/** Deterministic runner: advances only through `update(dtMs)`, so pausing = not calling update. */
export class ClipRunner {
  private events: TimelineEvent[];
  private idx = 0;
  t = 0;
  cancelled = false;
  constructor(readonly clip: ClipDef, private h: RunnerHandlers) { this.events = expandClip(clip); }
  get done() { return this.cancelled || (this.idx >= this.events.length && this.t >= this.clip.duration); }
  update(dtMs: number) {
    if (this.cancelled) return;
    this.t += dtMs;
    while (this.idx < this.events.length && this.events[this.idx].t <= this.t) {
      const e = this.events[this.idx++];
      if (e.kind === 'op') this.h.op(e.op, e.t);
      else this.h.marker(e.hit, e.t);
    }
  }
  /** Fire everything remaining (used when animations are skipped) in order. */
  flush() {
    while (this.idx < this.events.length) {
      const e = this.events[this.idx++];
      if (e.kind === 'op') this.h.op(e.op, e.t); else this.h.marker(e.hit, e.t);
    }
    this.t = this.clip.duration;
  }
  cancel() { this.cancelled = true; }
}
