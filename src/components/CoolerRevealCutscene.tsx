import { useEffect, useRef, useState } from 'react';
import { isBackKey } from '../systems/backKey';
import { getSettings } from '../systems/settings';

/** Cooler appears in the Frozen Ruins before the player's explicit fight choice. */
export function CoolerRevealCutscene({ done }: { done: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [window.setTimeout(() => setPhase(1), 2100), window.setTimeout(done, 4700)];
    const onKey = (e: KeyboardEvent) => { if (isBackKey(e) || e.key.toLowerCase() === 'k') { e.preventDefault(); done(); } };
    window.addEventListener('keydown', onKey);
    return () => { timers.forEach(window.clearTimeout); window.removeEventListener('keydown', onKey); };
  }, [done]);
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    g.imageSmoothingEnabled = false;
    const bg = new Image(); bg.src = '/assets/backgrounds/frozen_namek.png';
    const cooler = new Image(); cooler.src = '/assets/reviewed/actors/cooler_idle.png';
    const flakes = Array.from({ length: 38 }, (_, i) => ({ x: (i * 97) % 960, y: (i * 61) % 500, s: 1 + i % 3, phase: i * 1.9 }));
    const t0 = performance.now(); let raf = 0; let alive = true;
    const ease = (n: number) => { const p = Math.max(0, Math.min(1, n)); return p * p * (3 - 2 * p); };
    const loop = (now: number) => {
      if (!alive) return;
      const sec = Math.min(4.7, (now - t0) / 1000), reduced = getSettings().reducedFlash, wind = reduced ? 0 : sec;
      if (bg.complete && bg.naturalWidth) g.drawImage(bg, 0, 0, 960, 540); else { g.fillStyle = '#14294f'; g.fillRect(0, 0, 960, 540); }
      // Drifting ice keeps the quiet arena alive without obscuring Cooler or the HUD.
      for (const f of flakes) {
        const x = (f.x - wind * (24 + f.s * 10) + Math.sin(wind + f.phase) * 9 + 1200) % 960;
        const y = (f.y + wind * (10 + f.s * 5)) % 540;
        g.fillStyle = '#d7f6ff'; g.globalAlpha = reduced ? 0.24 : 0.18 + (Math.sin(sec * 2 + f.phase) + 1) * 0.12; g.fillRect(Math.round(x), Math.round(y), f.s, f.s); g.globalAlpha = 1;
      }
      const entrance = ease((sec - 0.55) / 1.65), x = 758 - entrance * 102, foot = 350;
      // A cold ground reflection grows under the armor as he steps through the snow.
      const halo = reduced ? 0.26 : 0.18 + (Math.sin(sec * 3.4) + 1) * 0.13;
      g.fillStyle = '#4edbff'; g.globalAlpha = halo; g.beginPath(); g.ellipse(x, foot - 6, 66 + entrance * 32, 12, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      if (cooler.complete && cooler.naturalWidth) {
        g.globalAlpha = 0.25 + entrance * 0.75;
        g.drawImage(cooler, x - 132, foot - 250, 264, 264); g.globalAlpha = 1;
      }
      if (sec > 1.8) {
        const a = reduced ? 0.7 : 0.54 + (Math.sin(sec * 2.8) + 1) * 0.18;
        g.fillStyle = 'rgba(5,18,38,.78)'; g.fillRect(360, 28, 240, 52); g.strokeStyle = '#bcecff'; g.lineWidth = 2; g.strokeRect(360, 28, 240, 52);
        g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'center'; g.fillStyle = '#8feaff'; g.globalAlpha = a; g.fillText('UNKNOWN POWER', 480, 49); g.fillStyle = '#fff4ff'; g.font = '16px "Press Start 2P", monospace'; g.fillText('COOLER', 480, 69); g.globalAlpha = 1;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);
  return <div className="screen" style={{ background: '#07162c' }}>
    <canvas ref={cv} width={960} height={540} style={{ position: 'absolute', inset: 0 }} />
    <div className="win dlg-box narr" style={{ position: 'absolute', left: 80, right: 80, bottom: 40 }}>
      <div className="dlg-text">{phase ? 'Cooler steps forward, armor glinting through the snow.' : 'The frost falls silent. Something powerful waits ahead.'}</div>
      <div className="dlg-foot"><span className="dim">The rift’s cold reaches the arena…</span><button className="btn small skipbtn" onClick={done}>Skip scene</button></div>
    </div>
  </div>;
}
