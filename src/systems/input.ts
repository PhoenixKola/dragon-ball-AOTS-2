// Single input abstraction: keyboard + (optional) gamepad. Never calls preventDefault on Tab.
import { firstPad } from './gamepad';
const held = new Set<string>();
const pressedOnce = new Set<string>();
let installed = false;
let padWas: Record<string, boolean> = {};

export function installInput() {
  if (installed) return; installed = true;
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!held.has(k)) pressedOnce.add(k);
    held.add(k);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { held.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); });
  window.addEventListener('blur', () => { held.clear(); pressedOnce.clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { held.clear(); pressedOnce.clear(); } });
}

export interface MoveVec { x: number; y: number; run: boolean }
export function moveVector(): MoveVec {
  let x = 0, y = 0;
  if (held.has('ArrowLeft') || held.has('a')) x -= 1;
  if (held.has('ArrowRight') || held.has('d')) x += 1;
  if (held.has('ArrowUp') || held.has('w')) y -= 1;
  if (held.has('ArrowDown') || held.has('s')) y += 1;
  let run = held.has('Shift');
  try {
    const pad = firstPad();   // the same controller the menu bridge reads (slot 0 can be empty while the pad sits in slot 1)
    if (pad) { const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0; if (Math.abs(ax) > 0.3) x += ax; if (Math.abs(ay) > 0.3) y += ay; if (pad.buttons[1]?.pressed) run = true; if (pad.buttons[14]?.pressed) x -= 1; if (pad.buttons[15]?.pressed) x += 1; if (pad.buttons[12]?.pressed) y -= 1; if (pad.buttons[13]?.pressed) y += 1; }
  } catch { /* no gamepad */ }
  const m = Math.hypot(x, y);
  if (m > 1) { x /= m; y /= m; }
  return { x, y, run };
}
/** True once per press. */
export function consume(...keys: string[]): boolean {
  let hit = false;
  for (const k of keys) if (pressedOnce.delete(k)) hit = true;
  try {
    const pad = firstPad();
    if (pad && keys.includes('Enter')) { const now = !!pad.buttons[0]?.pressed; if (now && !padWas.a) hit = true; padWas.a = now; }
  } catch { /* ignore */ }
  return hit;
}
/** Called whenever an overlay opens or closes. A pad button that is still held from the overlay (e.g. A on the last dialogue line) must not count as a fresh press in the world. */
export function clearPressed() { pressedOnce.clear(); padWas.a = !!firstPad()?.buttons[0]?.pressed; }
export const isHeld = (k: string) => held.has(k);
