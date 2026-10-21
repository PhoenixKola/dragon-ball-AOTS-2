import { useCallback, useEffect, useState } from 'react';
import { StageFrame } from '../components/StageFrame';
import { BattleHUD } from '../components/BattleHUD';
import { TitleScreen, Dialogue, ResultsScreen, DefeatScreen, ShopScreen, AltarScreen, ConfirmScreen, Credits, IntroCutscene, SsjCutscene, useSession, SettingsPanel } from '../components/screens';
import { MenuScreen } from '../components/menu';
import { PorungaScreen } from '../components/PorungaScreen';
import { session, objectiveOf, chapterName } from './session';
import { host } from '../engine/host';
import { BattleController } from '../engine/combat/controller';
import { buildAlly, buildEnemy, newMember } from '../systems/party';
import type { BootReport } from '../engine/scenes/BootScene';
import type { HeroId } from '../types';
import type { StageKind } from '../engine/scenes/stageBackgrounds';
import { audio } from '../engine/audio/audio';
import { LoadingScreen, toggleFullscreen } from '../components/loading';
import { installInput, consume } from '../systems/input';
import { firstPad, newPadMem, padKeys } from '../systems/gamepad';
import { getSettings } from '../systems/settings';
import { MAPS } from '../data/maps';

installInput();

function devBattle(): BattleController {
  const q = new URLSearchParams(location.search);
  const party = (q.get('party') ?? 'gohan,krillin,vegeta').split(',') as HeroId[];
  const foes = (q.get('foes') ?? 'scout,scout').split(',');
  const lv = Number(q.get('lv') ?? 8);
  const allies = party.map((id, i) => { const m = newMember(id, lv); if (id === 'goku' && q.get('ssj')) m.ssj = true; const a = buildAlly(m, i); if (q.get('rage')) a.rage = Number(q.get('rage')); if (q.get('first') === id) a.stats.spd = 999; if (q.get('kaioken') && id === 'goku') a.statuses.push({ kind: 'kaioken', turns: 5, power: 0.4 }); return a; });
  const enemies = foes.map((id, i) => buildEnemy(id, i));
  return new BattleController({ allies, enemies, seed: Number(q.get('seed') ?? 7), inventory: { medkit: 3, kicapsule: 2, senzu: 1 }, unlockedCombos: ['gohan_krillin', 'goku_vegeta', 'z_trio', 'piccolo_gohan', 'vegeta_krillin'] },
    { stageKind: (q.get('stage') ?? 'plain') as StageKind, onFinish: () => {} });
}

export function App() {
  const s = useSession();
  const [dev, setDev] = useState<BattleController | null>(null);
  const [devPaused, setDevPaused] = useState(false);
  const onBoot = useCallback((r: BootReport) => {
    const q = new URLSearchParams(location.search);
    if (r.ok && q.get('dev') === 'battle') { const c = devBattle(); setDev(c); host.startBattle(c); (window as unknown as { __ctl: BattleController }).__ctl = c; return; }
    (window as unknown as { __session: typeof session }).__session = session;
    (window as unknown as { __audio: typeof audio }).__audio = audio;
    session.onBoot(r);
  }, []);
  useEffect(() => { dev?.setPaused(devPaused); }, [dev, devPaused]);
  useEffect(() => { const f = () => audio.resume(); window.addEventListener('pointerdown', f); window.addEventListener('keydown', f); return () => { window.removeEventListener('pointerdown', f); window.removeEventListener('keydown', f); }; }, []);

  useEffect(() => { try { if (window.outerWidth < screen.availWidth - 8 || window.outerHeight < screen.availHeight - 8) { window.moveTo(0, 0); window.resizeTo(screen.availWidth, screen.availHeight); } } catch { /* not allowed in normal tabs */ } }, []);
  // gamepad: bridge pad buttons to the keyboard handlers used by battles, menus and dialogue
  useEffect(() => {
    const mem = newPadMem();
    const iv = window.setInterval(() => {
      const mode = session.mode === 'battle' || dev ? 'battle' : session.mode === 'world' && !session.overlay ? 'world' : 'ui';
      for (const key of padKeys(firstPad(), mem, performance.now(), mode)) { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true })); }
    }, 16);
    return () => window.clearInterval(iv);
  }, [dev]);
  // focus navigation for button screens (title, settings, load, menus, shops, prompts): arrows / D-pad move focus, Enter / A presses the focused button.
  // Synthetic keys come from the gamepad bridge (so we click for them). Real keyboard Enter and Space already press a focused button natively,
  // so only the arrow keys are handled for real keys, and never while a form control owns them (sliders, selects, text) or a screen has its own arrows.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('.dialogue') || document.querySelector('.cmd-root') || document.querySelector('[role=alertdialog]')) return;
      const real = e.isTrusted;
      if (real) {
        if (!e.key.startsWith('Arrow') || e.ctrlKey || e.altKey || e.metaKey) return;
        const tgt = e.target;
        if (tgt instanceof HTMLInputElement || tgt instanceof HTMLSelectElement || tgt instanceof HTMLTextAreaElement) return;
      }
      const root = [...document.querySelectorAll<HTMLElement>('.overlay-dim')].pop() ?? document.querySelector<HTMLElement>('.title-panel') ?? document.querySelector<HTMLElement>('.title-menu') ?? document.querySelector<HTMLElement>('.title-screen');
      if (!root) return;
      const items = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), [role=tab], select, input')].filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const cur = items.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { items[(cur + 1) % items.length].focus(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { items[(cur - 1 + items.length) % items.length].focus(); e.preventDefault(); }
      else if (!real && e.key === 'Enter' && cur >= 0 && items[cur].tagName === 'BUTTON') { items[cur].click(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  // full screen: first key/click enters it (when enabled in settings); F toggles at any time (not while typing)
  useEffect(() => {
    let tried = false;
    const first = () => { if (tried) return; tried = true; if (getSettings().fullscreen && !document.fullscreenElement) toggleFullscreen(true); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target instanceof HTMLInputElement)) { tried = true; toggleFullscreen(); return; }
      first();
    };
    window.addEventListener('pointerdown', first); window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', first); window.removeEventListener('keydown', onKey); };
  }, []);

  // world-level keys: Esc opens the menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (session.mode !== 'world' || session.overlay) return;
      if (e.key === 'Escape' || e.key === 'm' || e.key === 'M') { e.preventDefault(); session.openMenu(); }
      if ((e.key === 'o' || e.key === 'O')) setShowObj((v) => !v);
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [showObj, setShowObj] = useState(true);
  void consume;

  const o = s.overlay;
  const ctl = dev ?? s.battle;
  const inBattle = !!ctl && (dev ? true : s.mode === 'battle');
  const paused = dev ? devPaused : s.battlePaused;
  const boot = s.bootReport;

  return (
    <StageFrame onBoot={onBoot}>
      {!boot && !dev && <LoadingScreen />}
      {boot && !boot.ok && <div className="screen" style={{ background: '#200', padding: 20 }}><h2>Missing critical assets</h2><pre style={{ fontSize: 11 }}>{boot.missing.join('\n')}</pre></div>}
      {!dev && s.mode === 'title' && !o && <TitleScreen />}
      {!dev && s.mode === 'world' && <WorldHud showObj={showObj} />}
      {inBattle && ctl && <BattleHUD ctl={ctl} onPauseRequest={() => (dev ? setDevPaused((p) => !p) : session.togglePause())} />}
      {paused && inBattle && <PauseOverlay onResume={() => (dev ? setDevPaused(false) : session.togglePause())} />}
      {o?.kind === 'dialogue' && <Dialogue />}
      {o?.kind === 'results' && <ResultsScreen data={o.data} done={o.done} />}
      {o?.kind === 'defeat' && <DefeatScreen choose={o.choose} />}
      {o?.kind === 'menu' && <MenuScreen tab={o.tab} />}
      {o?.kind === 'shop' && <ShopScreen shopId={o.shop} done={o.done} />}
      {o?.kind === 'altar' && <AltarScreen done={o.done} />}
      {o?.kind === 'porunga' && <PorungaScreen done={o.done} />}
      {o?.kind === 'confirm' && <ConfirmScreen text={o.text} yes={o.yes} no={o.no} yesLabel={o.yesLabel} noLabel={o.noLabel} />}
      {o?.kind === 'credits' && <Credits />}
      {o?.kind === 'cutscene' && o.id === 'intro' && <IntroCutscene done={o.done} />}
      {o?.kind === 'cutscene' && o.id === 'ssj' && <SsjCutscene done={o.done} />}
      {s.toastOverlay && <div className="toast win">{s.toastOverlay.text}</div>}
      {s.mapTitle && s.mode === 'world' && <div className="maptitle win no-pointer"><div className="px">{s.mapTitle.name.toUpperCase()}</div><div className="dim">{s.mapTitle.sub}</div></div>}
      <div className="fade" style={{ opacity: s.fade }} />
      {getSettings().showDiagnostics && <Diagnostics />}
    </StageFrame>
  );
}

function WorldHud({ showObj }: { showObj: boolean }) {
  const s = useSession(); const st = s.state; const m = MAPS[st.mapId];
  if (s.overlay && s.overlay.kind !== 'toast') return null;
  return (
    <>
      <div className="win flat hud-loc no-pointer"><b>{m.name}</b></div>
      <div className="win flat hud-money no-pointer">Zeni <b>{st.zeni}</b> · Balls <b>{st.balls}/7</b></div>
      {showObj && <div className="win flat hud-obj no-pointer"><span className="px" style={{ fontSize: 7, color: '#ffd34a' }}>{chapterName(st.chapter).toUpperCase()}</span><div>◆ {objectiveOf(st)}</div></div>}
      <div className="hud-hint px no-pointer">E interact · Esc menu · O objective</div>
      <button className="btn small hud-menu" onClick={() => session.openMenu()}>Menu</button>
    </>
  );
}

function PauseOverlay({ onResume }: { onResume: () => void }) {
  const s = useSession(); const [view, setView] = useState<'main' | 'settings'>('main');
  return (
    <div className="overlay-dim fade-in"><div className="win results" style={{ width: view === 'settings' ? 560 : 340 }}>
      <div className="results-title px">PAUSED</div>
      {view === 'main' ? <div className="col"><button className="btn" autoFocus onClick={onResume}>Resume</button><button className="btn" onClick={() => setView('settings')}>Settings</button><button className="btn" onClick={() => s.confirm('Abandon this battle and return to the title screen?', () => session.toTitle())}>Quit to title</button></div>
        : <><SettingsPanel /><div className="col"><button className="btn" onClick={() => setView('main')}>Back</button></div></>}
    </div></div>
  );
}

function Diagnostics() {
  const s = useSession(); const r = s.bootReport;
  return <div className="diag px">DIAG · mode {s.mode} · overlay {s.overlay?.kind ?? '-'} · assets {r?.ok ? 'ok' : 'MISSING ' + (r?.missing.length ?? '?')} · provisional overworld sets (not approved): gohan_namek, goku_ssj_test · scenes {host.activeScenes().join(',')}</div>;
}
