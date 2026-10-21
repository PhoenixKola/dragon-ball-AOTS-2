/**
 * The game's Back / Cancel keys: X, Backspace and Escape (and gamepad B, which the pad bridge sends as Escape).
 * Browsers reserve Escape to leave full screen and a page cannot reliably intercept it there, so X and Backspace are the always-reliable
 * choices and every Back-capable screen also has a clickable Back button. Never triggers while a text field has focus.
 */
export function isBackKey(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'altKey' | 'metaKey' | 'target'>): boolean {
  if (e.ctrlKey || e.altKey || e.metaKey) return false;
  if (e.key !== 'Escape' && e.key !== 'x' && e.key !== 'X' && e.key !== 'Backspace') return false;
  const t = e.target as { tagName?: string; isContentEditable?: boolean } | null;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return false;
  return true;
}
export const BACK_HINT = 'Back: X / Backspace / Esc / pad B';
