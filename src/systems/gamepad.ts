// Gamepad -> keyboard bridge for battles, menus and dialogue. In free exploration movement/interact already read the pad directly
// (systems/input.ts), so only Start (menu) is bridged there. Standard mapping: D-pad / left stick = arrows, A = Enter, B = Esc,
// X / Y / RB = Active Guard for fighters 1 / 2 / 3, Start = Esc (menus) or P (pause in battle).
export interface PadLike { buttons: ReadonlyArray<{ pressed: boolean }>; axes: ReadonlyArray<number> }
export interface PadMem { held: Record<string, number | undefined> }
export type PadMode = 'world' | 'ui' | 'battle';
export const newPadMem = (): PadMem => ({ held: {} });

const FIRST_REPEAT_MS = 380, REPEAT_MS = 130, STICK = 0.55;
const ARROWS: [string, (p: PadLike) => boolean][] = [
  ['ArrowUp', (p) => !!p.buttons[12]?.pressed || (p.axes[1] ?? 0) < -STICK],
  ['ArrowDown', (p) => !!p.buttons[13]?.pressed || (p.axes[1] ?? 0) > STICK],
  ['ArrowLeft', (p) => !!p.buttons[14]?.pressed || (p.axes[0] ?? 0) < -STICK],
  ['ArrowRight', (p) => !!p.buttons[15]?.pressed || (p.axes[0] ?? 0) > STICK],
];

/** Keys to press this tick. Buttons fire once per press; arrows repeat while held. */
export function padKeys(pad: PadLike | null, mem: PadMem, now: number, mode: PadMode): string[] {
  const out: string[] = [];
  const down: Record<string, boolean> = {};
  if (pad) {
    if (mode !== 'world') {
      for (const [k, f] of ARROWS) down[k] = f(pad);
      down.Enter = !!pad.buttons[0]?.pressed; down.Escape = !!pad.buttons[1]?.pressed;
      down['1'] = !!pad.buttons[2]?.pressed; down['2'] = !!pad.buttons[3]?.pressed; down['3'] = !!pad.buttons[5]?.pressed;
    }
    const start = !!pad.buttons[9]?.pressed;
    if (mode === 'battle') down.p = start; else down['Escape'] = down['Escape'] || start;
  }
  for (const k of [...ARROWS.map(([a]) => a), 'Enter', 'Escape', '1', '2', '3', 'p']) {
    const isDown = !!down[k], next = mem.held[k];
    if (!isDown) { mem.held[k] = undefined; continue; }
    if (next === undefined) { out.push(k); mem.held[k] = now + (k.startsWith('Arrow') ? FIRST_REPEAT_MS : Infinity); }
    else if (now >= next) { out.push(k); mem.held[k] = now + REPEAT_MS; }
  }
  return out;
}

export function firstPad(): PadLike | null {
  try { const pads = navigator.getGamepads?.() ?? []; for (const p of pads) if (p && p.connected !== false) return p; } catch { /* no gamepad API */ }
  return null;
}
