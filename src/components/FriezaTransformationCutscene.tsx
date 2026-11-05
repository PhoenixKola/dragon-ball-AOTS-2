import { useEffect, useRef, useState } from 'react';
import { isBackKey } from '../systems/backKey';
import { getSettings } from '../systems/settings';

type Form = 'frieza2' | 'frieza3' | 'frieza4';
const PREVIOUS: Record<Form, string> = { frieza2: 'frieza1', frieza3: 'frieza2', frieza4: 'frieza3' };
const HEIGHT: Record<string, number> = { frieza1: 180, frieza2: 232, frieza3: 218, frieza4: 172 };
const COPY: Record<Form, [string, string, string]> = {
  frieza2: ['Frieza laughs as his body begins to swell.', 'Armor strains. A towering second form tears through the light.', 'The tyrant’s power surges. Prepare for the next fight.'],
  frieza3: ['The second form hunches and twists, energy snapping around him.', 'His frame stretches into a jagged, towering third form.', 'A vicious new power fills the Namek sky.'],
  frieza4: ['The towering body contracts. The light grows impossibly quiet.', 'All that bulk vanishes. A sleek final form steps forward.', 'Frieza’s true speed is revealed.'],
};

/** A compact, skippable form reveal between the existing scripted Frieza battles. */
export function FriezaTransformationCutscene({ done, form }: { done: () => void; form: Form }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [window.setTimeout(() => setPhase(1), 1500), window.setTimeout(() => setPhase(2), 3200), window.setTimeout(done, 4800)];
    const onKey = (e: KeyboardEvent) => { if (isBackKey(e) || e.key.toLowerCase() === 'k') { e.preventDefault(); done(); } };
    window.addEventListener('keydown', onKey);
    return () => { timers.forEach(window.clearTimeout); window.removeEventListener('keydown', onKey); };
  }, [done]);
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    g.imageSmoothingEnabled = false;
    const image = (id: string) => { const img = new Image(); img.src = `/assets/reviewed/actors/${id}_idle.png`; return img; };
    const bg = new Image(); bg.src = '/assets/backgrounds/plain_namek.png';
    const oldForm = image(PREVIOUS[form]), newForm = image(form);
    const t0 = performance.now(); let raf = 0; let alive = true;
    const clamp = (v: number) => Math.max(0, Math.min(1, v));
    const ease = (v: number) => { const p = clamp(v); return p * p * (3 - 2 * p); };
    const loop = (now: number) => {
      if (!alive) return;
      const sec = Math.min(4.8, (now - t0) / 1000), reduced = getSettings().reducedFlash;
      if (bg.complete && bg.naturalWidth) g.drawImage(bg, 0, 0, 960, 540); else { g.fillStyle = '#547a51'; g.fillRect(0, 0, 960, 540); }
      const cx = 492, feet = 390, reveal = ease((sec - 2.25) / 0.72);
      const oldA = 1 - ease((sec - 2.15) / 0.42), newA = reveal;
      const pulse = reduced ? 0.48 : 0.38 + (Math.sin(sec * 9) + 1) * 0.18;
      // A low ground ring anchors the energy to the battlefield while the body changes.
      g.fillStyle = '#09112b'; g.globalAlpha = 0.35; g.beginPath(); g.ellipse(cx, feet - 2, 54 + reveal * 42, 9 + reveal * 2, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
      if (oldForm.complete && oldForm.naturalWidth && oldA > 0) {
        g.globalAlpha = oldA; g.drawImage(oldForm, cx - HEIGHT[PREVIOUS[form]] / 2, feet - HEIGHT[PREVIOUS[form]], HEIGHT[PREVIOUS[form]], HEIGHT[PREVIOUS[form]]); g.globalAlpha = 1;
      }
      // Fractured violet energy grows around the silhouette before the new form appears.
      if (sec > 0.5 && sec < 3.2) {
        const size = 36 + Math.sin(sec * 13) * 5;
        g.globalAlpha = reduced ? 0.3 : 0.58;
        g.fillStyle = '#a94aff'; g.beginPath(); g.ellipse(cx, feet - 102, size, 112, 0, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3 + (reduced ? 0 : sec * 1.4), x = cx + Math.cos(a) * (48 + i % 2 * 8), y = feet - 105 + Math.sin(a) * (64 + i % 2 * 9);
          g.fillStyle = i % 2 ? '#e6b8ff' : '#7a35d8'; g.globalAlpha = reduced ? 0.45 : 0.62 + Math.sin(a) * 0.2;
          g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 4, y); g.lineTo(x, y + 8); g.lineTo(x - 4, y); g.closePath(); g.fill();
        }
        g.globalAlpha = 1;
      }
      if (newForm.complete && newForm.naturalWidth && newA > 0) {
        const settle = Math.sin(sec * 18) * (1 - reveal) * 9;
        g.globalAlpha = newA; g.drawImage(newForm, cx - HEIGHT[form] / 2, feet - HEIGHT[form] + settle, HEIGHT[form], HEIGHT[form]); g.globalAlpha = 1;
      }
      if (sec > 2.35 && sec < 2.95 && !reduced) {
        const p = (sec - 2.35) / 0.6; g.globalAlpha = Math.sin(p * Math.PI) * 0.48; g.fillStyle = '#fff8ff'; g.fillRect(0, 0, 960, 540); g.globalAlpha = 1;
      }
      // Dust, then a few cold violet motes settle as the new form takes its stance.
      for (let i = 0; i < 9; i++) {
        const phase = reduced ? i * 0.7 : sec * 2.4 + i * 0.7, x = cx + Math.sin(phase) * (48 + i % 3 * 12), y = feet - 10 - (i * 17 + sec * 24) % 142;
        g.fillStyle = i % 2 ? '#edc7ff' : '#8e5cff'; g.globalAlpha = reduced ? 0.24 : pulse * (1 - (i % 3) * 0.15); g.fillRect(Math.round(x), Math.round(y), 3, 3); g.globalAlpha = 1;
      }
      g.fillStyle = 'rgba(5,18,38,.82)'; g.fillRect(20, 24, 260, 38); g.strokeStyle = '#cdeaff'; g.lineWidth = 2; g.strokeRect(20, 24, 260, 38);
      g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = '#ffd34a'; g.fillText('FRIEZA · FORM CHANGE', 34, 48);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [form]);
  return <div className="screen" style={{ background: '#07162c' }}>
    <canvas ref={cv} width={960} height={540} style={{ position: 'absolute', inset: 0 }} />
    <div className="win dlg-box narr" style={{ position: 'absolute', left: 80, right: 80, bottom: 40 }}>
      <div className="dlg-text">{COPY[form][phase]}</div>
      <div className="dlg-foot"><span className="dim">His power changes the battlefield…</span><button className="btn small skipbtn" onClick={done}>Skip scene</button></div>
    </div>
  </div>;
}
