import { useEffect, useState } from 'react';
import { host } from '../engine/host';

export function LoadingScreen() {
  const [p, setP] = useState(0);
  useEffect(() => host.onProgress(setP), []);
  const pct = Math.round(p * 100);
  return (
    <div className="loading" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Loading">
      <div className="l-title">ATTACK OF THE SAIYANS II</div>
      <div className="l-sub">THE NAMEK SAGA</div>
      <div className="l-bar"><div className="l-fill" style={{ width: pct + '%' }} /></div>
      <div className="l-text">LOADING {pct}%</div>
    </div>
  );
}

/** Enters or leaves browser full screen. `want` forces a state; omitted toggles. Needs a user gesture to enter. */
export function toggleFullscreen(want?: boolean) {
  const el = document.documentElement;
  const on = !!document.fullscreenElement;
  const target = want ?? !on;
  try {
    if (target && !on) void el.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => undefined);
    else if (!target && on) void document.exitFullscreen?.().catch(() => undefined);
  } catch { /* unsupported or blocked */ }
}
