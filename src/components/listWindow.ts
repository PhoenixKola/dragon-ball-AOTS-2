export const LIST_WINDOW = 3;

/** Minimal-scroll window: the first visible row only moves when the cursor leaves the window. */
export function windowStart(prev: number, cursor: number, total: number, size = LIST_WINDOW): number {
  const max = Math.max(0, total - size);
  let s = Math.min(Math.max(prev, 0), max);
  if (cursor < s) s = cursor;
  else if (cursor >= s + size) s = cursor - size + 1;
  return Math.min(Math.max(s, 0), max);
}
