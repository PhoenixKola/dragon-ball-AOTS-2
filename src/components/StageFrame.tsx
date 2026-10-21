import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { fitStage, type StageFit } from '../engine/gameScale';
import { host } from '../engine/host';
import { getSettings, subscribeSettings, updateSettings } from '../systems/settings';
import { session } from '../app/session';
import type { BootReport } from '../engine/scenes/BootScene';

/** Letterboxed 16:9 stage: Phaser canvas underneath, React UI (authored in 960x540 logical px) on top. */
export function StageFrame({ children, onBoot }: { children: ReactNode; onBoot: (r: BootReport) => void }) {
  const canvasHost = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<StageFit>(() => fitStage(window.innerWidth, window.innerHeight, getSettings().integerScale, window.devicePixelRatio, window.screen?.width ?? 0));
  const booted = useRef(false);
  const fitRef = useRef(fit);
  fitRef.current = fit;   // the window can change size while the game is still booting: always apply the latest fit

  useLayoutEffect(() => {
    const onResize = () => setFit(fitStage(window.innerWidth, window.innerHeight, getSettings().integerScale, window.devicePixelRatio, window.screen?.width ?? 0));
    window.addEventListener('resize', onResize);
    const unsub = subscribeSettings(onResize);
    return () => { window.removeEventListener('resize', onResize); unsub(); };
  }, []);

  // The browser (not the game) decides when full screen ends, e.g. Esc. Re-fit the canvas and cameras, keep every open menu exactly as it is, never re-enter on our own.
  useEffect(() => {
    let was = !!document.fullscreenElement;
    const refit = () => setFit(fitStage(window.innerWidth, window.innerHeight, getSettings().integerScale, window.devicePixelRatio, window.screen?.width ?? 0));
    const onFs = () => {
      const now = !!document.fullscreenElement;
      refit(); window.setTimeout(refit, 120); window.setTimeout(refit, 500);
      if (was && !now) session.toast('Left full screen. Press F to return. Open menus stay as they are: close them with X / Backspace.', 3800);
      else if (!was && now && !getSettings().fsTipSeen) { updateSettings({ fsTipSeen: true }); session.toast('Tip: the browser may use Esc to leave full screen. In menus, go back with X, Backspace or gamepad B.', 4600); }
      was = now;
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  useEffect(() => {
    if (!canvasHost.current || booted.current) return;
    booted.current = true;
    void host.init(canvasHost.current, fitRef.current).then((r) => { host.applyFit(fitRef.current); onBoot(r); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { host.applyFit(fit); }, [fit]);

  return (
    <div className="viewport">
      <div className="stage-frame" style={{ left: fit.left, top: fit.top, width: fit.cssW, height: fit.cssH }}>
        <div ref={canvasHost} style={{ width: fit.cssW, height: fit.cssH }} />
        <div className={'ui-root' + (getSettings().reducedFlash ? ' reduced-motion' : '')} style={{ transform: `scale(${fit.z})` }}>{children}</div>
      </div>
    </div>
  );
}
