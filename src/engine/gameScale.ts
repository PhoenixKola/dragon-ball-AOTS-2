// Logical stage is 960x540. The canvas renders at integer supersample `k` and is CSS-scaled by `z` to fit,
// so sprites stay sharp at 1280x720, 1920x1080, 2560x1440 and any window size, with 16:9 letterboxing.
export const LOGICAL_W = 960;
export const LOGICAL_H = 540;
export const GAME_SCALE = { z: 1, k: 1 };

export interface StageFit { z: number; k: number; cssW: number; cssH: number; left: number; top: number }

/** `refW`: the display's width in CSS px. The render scale k follows the display, not the window, so going full screen never resizes the canvas. */
export function fitStage(viewW: number, viewH: number, integer: boolean, dpr = 1, refW = 0): StageFit {
  let z = Math.min(viewW / LOGICAL_W, viewH / LOGICAL_H);
  if (integer && z >= 1) z = Math.floor(z);
  z = Math.max(0.5, z);
  const k = Math.max(1, Math.min(4, Math.ceil((Math.max(z * LOGICAL_W, refW) / LOGICAL_W) * dpr)));
  const cssW = Math.floor(LOGICAL_W * z), cssH = Math.floor(LOGICAL_H * z);
  return { z, k, cssW, cssH, left: Math.floor((viewW - cssW) / 2), top: Math.floor((viewH - cssH) / 2) };
}
