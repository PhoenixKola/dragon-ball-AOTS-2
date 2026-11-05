import { useEffect, useRef, useState } from 'react';
import { isBackKey } from '../systems/backKey';
import { getSettings } from '../systems/settings';

/** A short, skippable visual payoff for Ginyu's failed final Body Change. */
export function GinyuFrogCutscene({ done }: { done: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [window.setTimeout(() => setPhase(1), 2200), window.setTimeout(() => setPhase(2), 4700), window.setTimeout(done, 7200)];
    const onKey = (e: KeyboardEvent) => { if (isBackKey(e) || e.key.toLowerCase() === 'k') { e.preventDefault(); done(); } };
    window.addEventListener('keydown', onKey);
    return () => { timers.forEach(window.clearTimeout); window.removeEventListener('keydown', onKey); };
  }, [done]);
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    g.imageSmoothingEnabled = false;
    const sources = {
      bg: '/assets/backgrounds/water_namek.png',
      ginyu: '/assets/reviewed/actors/ginyu_charge.png',
      goku: '/assets/reviewed/actors/goku_idle.png',
      frog: '/assets/reviewed/overworld/namek_frog/right/hop_000.png',
    };
    const images = new Map<string, HTMLImageElement>();
    for (const [key, src] of Object.entries(sources)) { const img = new Image(); img.src = src; images.set(key, img); }
    const t0 = performance.now(); let raf = 0; let alive = true;
    const ease = (n: number) => { const p = Math.max(0, Math.min(1, n)); return p * p * (3 - 2 * p); };
    const drawFighter = (img: HTMLImageElement | undefined, x: number, foot: number, height: number, flip = false) => {
      if (!img?.complete || !img.naturalWidth) return;
      g.save(); if (flip) { g.translate(x * 2, 0); g.scale(-1, 1); }
      g.fillStyle = 'rgba(7,20,35,.36)'; g.beginPath(); g.ellipse(x, foot - 2, height * 0.31, 8, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(img, x - height * 0.5, foot - height, height, height); g.restore();
    };
    const loop = (now: number) => {
      if (!alive) return;
      const sec = Math.min(7.2, (now - t0) / 1000), bg = images.get('bg'), reduced = getSettings().reducedFlash;
      if (bg?.complete && bg.naturalWidth) g.drawImage(bg, 0, 0, 960, 540); else { g.fillStyle = '#173f55'; g.fillRect(0, 0, 960, 540); }
      for (let i = 0; i < 22; i++) {
        const x = (i * 53 + Math.sin(sec * 0.7 + i * 2.3) * 10 + 960) % 960, y = 224 + (i % 5) * 9;
        g.fillStyle = '#c8fff0'; g.globalAlpha = 0.16 + (Math.sin(sec * 2 + i) + 1) * 0.11; g.fillRect(Math.round(x), y, 8 + i % 3 * 3, 2); g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(5,18,38,.82)'; g.fillRect(20, 24, 226, 38);
      g.strokeStyle = '#cdeaff'; g.lineWidth = 2; g.strokeRect(20, 24, 226, 38);
      g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = '#ffd34a'; g.fillText('NAMEK SHORE', 34, 48);

      const ginyu = images.get('ginyu'), goku = images.get('goku'), frog = images.get('frog');
      if (sec < 4.55) drawFighter(ginyu, 286, 386, 190);
      drawFighter(goku, 718, 386, 190, true);
      const entrance = ease((sec - 2.3) / 1.45), frogX = sec < 2.3 ? 890 : 890 - entrance * 430;
      const hopping = sec > 2.3 && sec < 5.1;
      const jump = hopping ? Math.abs(Math.sin((sec - 2.3) * 8)) * 70 : 0;
      if (frog && frog.complete && frog.naturalWidth && sec > 2.25) {
        g.fillStyle = 'rgba(7,20,35,.36)'; g.beginPath(); g.ellipse(frogX, 384, 27, 7, 0, 0, Math.PI * 2); g.fill();
        g.drawImage(frog, frogX - 72, 386 - 144 - jump, 144, 144);
      }

      // The purple body-change ray travels toward Goku, then folds around the frog crossing its path.
      if (sec > 2.55 && sec < 4.35) {
        const u = ease((sec - 2.55) / 0.72), endX = 400 + (700 - 400) * u, y = 263;
        const grad = g.createLinearGradient(400, y, endX, y); grad.addColorStop(0, 'rgba(168,75,255,0.05)'); grad.addColorStop(0.6, 'rgba(201,98,255,0.86)'); grad.addColorStop(1, 'rgba(255,245,255,0.95)');
        g.globalAlpha = reduced ? 0.38 : 1;
        g.strokeStyle = grad; g.lineCap = 'round'; g.lineWidth = reduced ? 14 : 28 + Math.sin(sec * 45) * 4; g.beginPath(); g.moveTo(400, y); g.lineTo(endX, y); g.stroke();
        g.strokeStyle = '#fff5ff'; g.lineWidth = reduced ? 2 : 5; g.beginPath(); g.moveTo(400, y); g.lineTo(endX, y); g.stroke(); g.globalAlpha = 1;
      }
      if (sec > 3.4 && sec < 4.3) {
        const p = (sec - 3.4) / 0.9, cx = frogX, cy = 276, r = 18 + p * 82;
        g.globalAlpha = reduced ? 0.36 : Math.sin(p * Math.PI) * 0.9;
        g.strokeStyle = '#deafff'; g.lineWidth = 5; g.beginPath(); g.ellipse(cx, cy, r * 0.72, r, sec * 2, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = '#f7eaff'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, r * 0.42, r * 0.85, -sec * 2.4, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      }
      if (sec > 4.05 && sec < 4.8 && !reduced) {
        const p = (sec - 4.05) / 0.75; g.globalAlpha = Math.sin(p * Math.PI) * 0.62; g.fillStyle = '#f8f0ff'; g.fillRect(0, 0, 960, 540); g.globalAlpha = 1;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);
  const captions = [
    'Cornered, Captain Ginyu gathers one last Body Change.',
    'A Namekian frog leaps across the beam and takes the hit!',
    'The flash fades. Ginyu is a frog; Goku is untouched.',
  ];
  return <div className="screen" style={{ background: '#07162c' }}>
    <canvas ref={cv} width={960} height={540} style={{ position: 'absolute', inset: 0 }} />
    <div className="win dlg-box narr" style={{ position: 'absolute', left: 80, right: 80, bottom: 40 }}>
      <div className="dlg-text">{captions[phase]}</div>
      <div className="dlg-foot"><span className="dim">A very small frog croaks…</span><button className="btn small skipbtn" onClick={done}>Skip scene</button></div>
    </div>
  </div>;
}
