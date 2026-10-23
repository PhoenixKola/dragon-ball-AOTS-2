import { toggleFullscreen } from './loading';
import { isBackKey } from '../systems/backKey';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { session, chapterName, type ResultData } from '../app/session';
import { SPEAKER_PORTRAIT } from '../data/scripts';
import { HEROES, ITEMS } from '../data/heroes';
import { SHOPS } from '../data/shops';
import { Portrait, Icon } from './ui';
import { audio } from '../engine/audio/audio';
import { host } from '../engine/host';
import { music } from '../engine/audio/music';

export const useSession = () => { useSyncExternalStore((cb) => session.subscribe(cb), () => session.version); return session; };

// ============================== TITLE ==============================
export function TitleScreen() {
  const s = useSession();
  const [view, setView] = useState<'main' | 'load' | 'settings' | 'confirmNew'>('main');
  const [msg, setMsg] = useState('');
  const slots = s.slots();
  const hasSave = slots.some((m) => !m.empty && !m.corrupt);
  useEffect(() => { audio.resume(); }, []);
  // keyboard / D-pad users land on a usable button straight away (Continue when there is a save)
  const menuRef = useRef<HTMLDivElement>(null);
  // Delayed on purpose: focusing at once would let the Enter that brought the player here (credits, a dialogue) press the new default button.
  useEffect(() => {
    if (view !== 'main') return;
    const id = window.setTimeout(() => { const root = menuRef.current; if (!root) return; const btns = [...root.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]; (btns.find((b) => b.textContent === 'Continue') ?? btns[0])?.focus(); }, 450);
    return () => window.clearTimeout(id);
  }, [view, hasSave]);
  useEffect(() => { if (view === 'main') return; const onKey = (e: KeyboardEvent) => { if (isBackKey(e)) { e.preventDefault(); setView('main'); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [view]);   // Esc / B steps back out of Load, Settings and the new-game prompt
  const start = () => { audio.sfx('confirm'); void s.newGame(); };
  return (
    <div className="screen title-screen fade-in">
      <button type="button" className="btn small fs-btn" onClick={() => toggleFullscreen()} aria-label="Toggle full screen">Full screen (F)</button>
      <div className="title-logo">
        <div className="tl-small px">DRAGON BALL Z</div>
        <div className="tl-big px">ATTACK OF<br />THE SAIYANS <span>II</span></div>
        <div className="tl-sub px">THE NAMEK SAGA</div>
      </div>
      {view === 'main' && (
        <div className="title-menu" ref={menuRef}>
          <button className="btn big" onClick={() => (hasSave ? setView('confirmNew') : start())}>New Game</button>
          <button className="btn big" disabled={!hasSave} onClick={() => { audio.resume(); const e = s.continueLatest(); if (e) setMsg(e); }}>Continue</button>
          <button className="btn big" onClick={() => setView('load')}>Load / Import</button>
          <button className="btn big" onClick={() => setView('settings')}>Settings</button>
          {msg && <div className="msg">{msg}</div>}
        </div>
      )}
      {view === 'confirmNew' && (
        <div className="win title-panel"><div className="px" style={{ fontSize: 10, marginBottom: 8 }}>START A NEW GAME?</div><p>You already have saved games. A new game keeps them until you save over a slot.</p><div className="row"><button className="btn" onClick={start}>Start new game</button><button className="btn" onClick={() => setView('main')}>Cancel</button></div></div>
      )}
      {view === 'load' && <LoadPanel onBack={() => setView('main')} onError={setMsg} msg={msg} />}
      {view === 'settings' && <div className="win title-panel wide"><SettingsPanel /><div className="row"><button className="btn" onClick={() => setView('main')}>Back</button></div></div>}
      <div className="title-foot px">PRIVATE OFFLINE FAN PROJECT · NOT FOR DISTRIBUTION · v1.0.0-beta.3</div>
    </div>
  );
}

function LoadPanel({ onBack, onError, msg }: { onBack: () => void; onError: (m: string) => void; msg: string }) {
  const s = useSession();
  const slots = s.slots();
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="win title-panel wide">
      <div className="px" style={{ fontSize: 10, marginBottom: 6 }}>SAVED GAMES (stored locally in this browser)</div>
      <SlotList slots={slots} mode="load" onLoad={(n) => { const e = s.loadSlot(n); if (e) onError(e); }} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={() => fileRef.current?.click()}>Import save file…</button>
        {s.legacyAvailable() && <button className="btn small" onClick={() => onError(s.importLegacy())}>Import prototype (v2) save</button>}
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const err = s.importFile(await f.text()); if (err) onError('Import failed: ' + err); }} />
        <button className="btn small" onClick={onBack}>Back</button>
      </div>
      {msg && <div className="msg">{msg}</div>}
    </div>
  );
}

export function SlotList({ slots, mode, onLoad, onSave, onDelete }: { slots: ReturnType<typeof session.slots>; mode: 'load' | 'save'; onLoad?: (n: number) => void; onSave?: (n: number) => void; onDelete?: (n: number) => void }) {
  return (
    <div className="slots">
      {slots.map((m) => {
        if (m.slot === 0 && mode === 'save') return null;
        return (
          <div className="slot" key={m.slot}>
            <div className="slot-name px">{m.slot === 0 ? 'AUTO' : `SLOT ${m.slot}`}</div>
            <div className="slot-info">
              {m.empty ? <span className="dim">Empty</span> : m.corrupt ? <span style={{ color: '#ff9a8a' }}>Corrupted (backup also unreadable)</span> : (
                <>
                  <div>{m.mapName} · {chapterName(m.chapter ?? 0).split('·')[0]}</div>
                  <div className="dim">{(m.levels ?? []).map((l) => `${HEROES[l.id].name} Lv${l.level}`).join(' · ')} · {fmtTime(m.playMs ?? 0)} · {m.balls ?? 0}/7 balls</div>
                </>
              )}
            </div>
            <div className="slot-actions">
              {mode === 'load' && <button className="btn small" disabled={m.empty || m.corrupt} onClick={() => onLoad?.(m.slot)}>Load</button>}
              {mode === 'save' && <button className="btn small" onClick={() => onSave?.(m.slot)}>{m.empty ? 'Save' : 'Overwrite'}</button>}
              {onDelete && !m.empty && m.slot > 0 && <button className="btn small" onClick={() => onDelete(m.slot)}>Delete</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
export const fmtTime = (ms: number) => { const m = Math.floor(ms / 60000); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };

// ============================== DIALOGUE ==============================
export function Dialogue() {
  const s = useSession();
  const o = s.overlay; const open = o?.kind === 'dialogue' ? o : null;
  const [shown, setShown] = useState(0);
  const line = open ? open.lines[open.idx] : null;
  const text = line?.[1] ?? '';
  const idxKey = open ? `${open.idx}|${open.lines.length}|${text}` : '';
  // Reset before the new line paints; a normal effect briefly displays it with the previous line's reveal count.
  useLayoutEffect(() => { setShown(0); }, [idxKey]);
  useEffect(() => {
    if (!open) return;
    const iv = window.setInterval(() => setShown((n) => Math.min(text.length, n + 2)), 28);
    return () => window.clearInterval(iv);
  }, [idxKey, open, text.length]);
  const typing = shown < text.length;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (['Enter', ' ', 'z', 'Z'].includes(e.key)) { e.preventDefault(); if (typing) setShown(text.length); else session.advanceDialogue(); }
      if (e.key === 'k' || e.key === 'K' || isBackKey(e)) { e.preventDefault(); session.advanceDialogue(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, typing, text.length]);
  if (!open || !line) return null;
  const [who] = line;
  const portrait = SPEAKER_PORTRAIT[who];
  const narr = who === 'Narrator';
  return (
    <div className="dialogue" onClick={() => { if (typing) setShown(text.length); else session.advanceDialogue(); }}>
      {portrait && !narr && <div className="dlg-portrait win"><Portrait id={portrait} /></div>}
      <div className={'win dlg-box' + (narr ? ' narr' : '')}>
        {!narr && <div className="dlg-name px">{who.toUpperCase()}</div>}
        <div className="dlg-text">{text.slice(0, shown)}</div>
        <div className="dlg-foot">{typing ? '' : <span className="blink">▼ Enter</span>}<span className="dim"> {open.idx + 1}/{open.lines.length}</span><button className="btn small skipbtn" onClick={(e) => { e.stopPropagation(); session.advanceDialogue(true); }}>Skip ▶▶ (K)</button></div>
      </div>
    </div>
  );
}

// ============================== RESULTS / DEFEAT ==============================
export function ResultsScreen({ data, done }: { data: ResultData; done: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (['Enter', ' ', 'z', 'Z'].includes(e.key)) { e.preventDefault(); done(); } };
    const t = window.setTimeout(() => window.addEventListener('keydown', onKey), 500);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [done]);
  const lu = (id: string) => data.levelUps.find((l) => l.id === id);
  return (
    <div className="overlay-dim fade-in">
      <div className="win results">
        <div className="results-title px">{data.scripted ? 'BATTLE COMPLETE' : 'VICTORY!'}</div>
        <div className="results-sub">{data.title} · {data.rounds} round{data.rounds === 1 ? '' : 's'}</div>
        <div className="results-rewards"><div>EXP <b>+{data.exp}</b></div><div>ZENI <b>+{data.zeni}</b></div>{Object.entries(data.drops).map(([k, n]) => <div key={k}>{ITEMS[k]?.name ?? k} <b>x{n}</b></div>)}</div>
        <div className="results-members">
          {data.members.map((m) => { const l = lu(m.id); return (
            <div key={m.id} className="rmember">
              <Portrait id={m.id} />
              <div className="rm-info"><div>{m.name} <span className="dim">Lv {m.level}</span> {l && <span className="lvup px">LEVEL UP {l.from}→{l.to}</span>}</div>
                <div className="bar rage" style={{ height: 8 }}><i style={{ width: `${Math.min(100, (m.xp / m.next) * 100)}%` }} /></div>
                {l && <div className="dim" style={{ fontSize: 12 }}>+{l.points} training points{l.newSkills.length ? ' · learned ' + l.newSkills.join(', ') : ''}</div>}
              </div>
            </div>); })}
        </div>
        {data.levelUps.length > 0 && <div className="dim" style={{ fontSize: 13, textAlign: 'center' }}>Spend training points in the menu (Esc → Training).</div>}
        <div style={{ textAlign: 'center' }}><button className="btn" autoFocus onClick={done}>Continue ▶</button></div>
      </div>
    </div>
  );
}

export function DefeatScreen({ choose }: { choose: (c: 'retry' | 'load' | 'title') => void }) {
  return (
    <div className="overlay-dim fade-in"><div className="win results" style={{ width: 420 }}>
      <div className="results-title px" style={{ color: '#ff8a7a' }}>DEFEATED</div>
      <p style={{ textAlign: 'center' }}>The party has fallen. Your progress is safe.</p>
      <div className="col"><button className="btn" autoFocus onClick={() => choose('retry')}>Retry the battle (restored)</button><button className="btn" onClick={() => choose('load')}>Load latest save</button><button className="btn" onClick={() => choose('title')}>Return to title</button></div>
    </div></div>
  );
}

// ============================== SHOP / ALTAR / CONFIRM ==============================
export function ShopScreen({ shopId, done }: { shopId: string; done: () => void }) {
  const s = useSession(); const shop = SHOPS[shopId]; const [msg, setMsg] = useState('');
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (isBackKey(e)) { e.preventDefault(); done(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [done]);
  return (
    <div className="overlay-dim"><div className="win menu-win" style={{ width: 640 }}>
      <div className="menu-head"><span className="px">{shop.name.toUpperCase()}</span><span>Zeni <b>{s.state.zeni}</b></span></div>
      <div className="shop-list">
        {shop.stock.map((id) => { const it = ITEMS[id]; return (
          <div className="shop-row" key={id}><Icon name={`item:${id}`} /><div className="grow"><b>{it.name}</b><div className="dim">{it.desc}</div></div><span className="dim">own {s.state.inventory[id] ?? 0}</span><span className="cost">{it.price}</span><button className="btn small" disabled={s.state.zeni < (it.price ?? 0)} onClick={() => setMsg(s.buy(shopId, id))}>Buy</button></div>); })}
      </div>
      <div className="menu-foot"><span className="dim">{msg}</span><button className="btn" onClick={done}>Leave</button></div>
    </div></div>
  );
}

export function AltarScreen({ done }: { done: () => void }) {
  const s = useSession(); const [slots, setSlots] = useState(() => s.slots());
  return (
    <div className="overlay-dim"><div className="win menu-win" style={{ width: 640 }}>
      <div className="menu-head"><span className="px">DRAGON BALL ALTAR</span><span className="dim">Your party was restored.</span></div>
      <p className="dim" style={{ padding: '0 14px' }}>Record your journey. Saves live in this browser; use Export in the menu for a file backup.</p>
      <SlotList slots={slots} mode="save" onSave={(n) => { s.saveTo(n); setSlots(s.slots()); }} />
      <div className="menu-foot"><span /><button className="btn" onClick={done}>Close</button></div>
    </div></div>
  );
}

export function ConfirmScreen({ text, yes, no, yesLabel = 'Yes', noLabel = 'No' }: { text: string; yes: () => void; no: () => void; yesLabel?: string; noLabel?: string }) {
  const yesRef = useRef<HTMLButtonElement>(null); const noRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // keyboard: Left/Right move between the two choices, Esc cancels, Enter/Space activate the focused one (default: the safe choice)
    const onKey = (e: KeyboardEvent) => {
      if (isBackKey(e)) { e.preventDefault(); no(); }
      else if (e.key === 'ArrowLeft' || e.key === 'a') { e.preventDefault(); yesRef.current?.focus(); }
      else if (e.key === 'ArrowRight' || e.key === 'd') { e.preventDefault(); noRef.current?.focus(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [no]);
  return <div className="overlay-dim"><div className="win results" style={{ width: 460 }} role="alertdialog" aria-label={text}><p style={{ textAlign: 'center', lineHeight: 1.35 }}>{text}</p><div className="row" style={{ justifyContent: 'center' }}><button ref={yesRef} className="btn" onClick={yes}>{yesLabel}</button><button ref={noRef} className="btn" autoFocus onClick={no}>{noLabel}</button></div></div></div>;
}

// ============================== SETTINGS ==============================
import { getSettings, updateSettings, subscribeSettings, type Settings } from '../systems/settings';
export function SettingsPanel() {
  const st = useSyncExternalStore(subscribeSettings, getSettings);
  const set = (p: Partial<Settings>) => updateSettings(p);
  return (
    <div className="settings">
      <div className="px" style={{ fontSize: 10, marginBottom: 8 }}>SETTINGS</div>
      <Row label="Active Guard timing"><Seg value={st.guardPreset} opts={[['standard', 'Standard'], ['relaxed', 'Relaxed'], ['assist', 'Assist (Space guards all)']]} onChange={(v) => set({ guardPreset: v as Settings['guardPreset'] })} /></Row>
      <Row label="Battle animation speed"><Seg value={String(st.battleSpeed)} opts={[['1', 'Normal'], ['1.6', 'Fast']]} onChange={(v) => set({ battleSpeed: Number(v) as 1 | 1.6 })} /></Row>
      <Row label="Difficulty (enemy damage / encounters)"><Seg value={st.difficulty} opts={[['normal', 'Normal'], ['easy', 'Easier (-30% dmg, fewer fights, +25% XP)']]} onChange={(v) => set({ difficulty: v as Settings['difficulty'] })} /></Row>
      <Row label="Screen shake"><Seg value={st.screenShake ? 'on' : 'off'} opts={[['on', 'On'], ['off', 'Off']]} onChange={(v) => set({ screenShake: v === 'on' })} /></Row>
      <Row label="Reduce flashing"><Seg value={st.reducedFlash ? 'on' : 'off'} opts={[['off', 'Off'], ['on', 'On']]} onChange={(v) => set({ reducedFlash: v === 'on' })} /></Row>
      <Row label="Full screen (F key)"><Seg value={st.fullscreen ? 'on' : 'off'} opts={[['on', 'On'], ['off', 'Off']]} onChange={(v) => { set({ fullscreen: v === 'on' }); toggleFullscreen(v === 'on'); }} /></Row>
      <Row label="Integer pixel scale"><Seg value={st.integerScale ? 'on' : 'off'} opts={[['off', 'Fit window'], ['on', 'Integer only']]} onChange={(v) => set({ integerScale: v === 'on' })} /></Row>
      <Row label={`Music volume ${Math.round(st.musicVolume * 100)}`}><input type="range" min={0} max={1} step={0.05} value={st.musicVolume} onChange={(e) => set({ musicVolume: Number(e.target.value) })} /></Row>
      <Row label={`SFX volume ${Math.round(st.sfxVolume * 100)}`}><input type="range" min={0} max={1} step={0.05} value={st.sfxVolume} onChange={(e) => { set({ sfxVolume: Number(e.target.value) }); audio.sfx('hit'); }} /></Row>
      <Row label="Mute all"><Seg value={st.muted ? 'on' : 'off'} opts={[['off', 'Sound on'], ['on', 'Muted']]} onChange={(v) => set({ muted: v === 'on' })} /></Row>
      <Row label="Battle VFX style"><Seg value={st.vfxStyle} opts={[['sprites', 'Pixel sprites'], ['procedural', 'Procedural']]} onChange={(v) => set({ vfxStyle: v as Settings['vfxStyle'] })} /></Row>
      <Row label="Provisional overworld art"><Seg value={st.provisionalArt ? 'on' : 'off'} opts={[['on', 'Use (Gohan, SSJ)'], ['off', 'Off (battle pose)']]} onChange={(v) => set({ provisionalArt: v === 'on' })} /></Row>
      <Row label="Diagnostics overlay"><Seg value={st.showDiagnostics ? 'on' : 'off'} opts={[['off', 'Off'], ['on', 'On']]} onChange={(v) => set({ showDiagnostics: v === 'on' })} /></Row>
    </div>
  );
}
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="setrow"><span>{label}</span><div>{children}</div></div>;
function Seg({ value, opts, onChange }: { value: string; opts: [string, string][]; onChange: (v: string) => void }) {
  return <div className="seg">{opts.map(([v, l]) => <button key={v} className={'segbtn' + (v === value ? ' on' : '')} onClick={() => onChange(v)}>{l}</button>)}</div>;
}

// ============================== CREDITS ==============================
export function Credits() {
  const s = useSession();
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); s.finishCredits('continue'); } else if (isBackKey(e)) { e.preventDefault(); s.finishCredits('title'); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [s]);
  const st = s.state.stats;
  return (
    <div className="overlay-dim credits fade-in" style={{ background: 'rgba(2,6,24,.55)' }}>
      <div className="credits-roll">
        <div className="px" style={{ fontSize: 16, color: '#ffd34a' }}>THE END</div>
        <p>When Namek fell, a legend rose from its ashes.</p>
        <div className="dim">Time played {fmtTime(s.state.playMs)} · Battles {st.battles} · Victories {st.wins} · Defeats {st.defeats}</div>
        <div className="credits-block"><div className="px">STORY</div>Re-sequenced Namek Saga (original script)</div>
        <div className="credits-block"><div className="px">ART</div>AI-generated pixel art (private fan project). See docs/ASSET_MANIFEST.md</div>
        <div className="credits-block"><div className="px">MUSIC & SFX</div>Procedural original synthesis</div>
        <div className="credits-block"><div className="px">ENGINE</div>React · TypeScript · Phaser 3</div>
        <p className="dim">Unofficial private fan project. Not for distribution.</p>
        <p>Postgame unlocked: <b>Capsule Corp’s Namek Simulation</b>. Keep training, finish what you missed, and follow a cold signal to something that was never in the story.</p>
        <div className="row" style={{ justifyContent: 'center' }}><button className="btn" autoFocus onClick={() => s.finishCredits('continue')}>Continue Adventure (Enter)</button><button className="btn" onClick={() => s.finishCredits('title')}>Save &amp; Title (X / Esc)</button></div>
        <div className="dim" style={{ marginTop: 6 }}>Your game was saved to AUTO. Back: X / Backspace / Esc / gamepad B.</div>
      </div>
    </div>
  );
}

// ============================== INTRO CUTSCENE ==============================
const INTRO: [string, string][] = [
  ['Narrator', 'Earth, one year after the Saiyan invasion. The Dragon Balls that could have restored the fallen are gone.'],
  ['Bulma', 'Kami’s Dragon Balls turned to stone when he died. But Kami came from somewhere: a planet called Namek.'],
  ['Gohan', 'Namek has its own Dragon Balls! They could bring everyone back, even Piccolo!'],
  ['Krillin', 'A spaceship, a long trip and a planet full of strangers. What could go wrong?'],
  ['Narrator', 'Far across the galaxy, an emperor named Frieza hunts the very same wishes.'],
  ['Narrator', 'The ship crosses an ocean of stars. A blue and green world rises ahead.'],
];
export function IntroCutscene({ done }: { done: () => void }) {
  const [i, setI] = useState(0);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { void music.play('epilogue', 1500); }, []);
  useEffect(() => {
    const c = cv.current; if (!c) return; const g = c.getContext('2d')!; let raf = 0; const stars = Array.from({ length: 140 }, () => ({ x: Math.random() * 960, y: Math.random() * 540, z: 0.3 + Math.random() }));
    const img = new Image(); img.src = 'assets/world/obj/lander.png'; const t0 = performance.now();
    const loop = (t: number) => { g.fillStyle = '#04061a'; g.fillRect(0, 0, 960, 540); for (const s of stars) { s.x -= s.z * 1.6; if (s.x < 0) { s.x = 960; s.y = Math.random() * 540; } g.fillStyle = `rgba(255,255,255,${0.4 + s.z * 0.5})`; g.fillRect(Math.round(s.x), Math.round(s.y), s.z > 1 ? 2 : 1, 1); }
      const p = Math.min(1, (t - t0) / 40000); const px = 140 + p * 560;
      g.fillStyle = `rgba(80,200,150,${0.2 + p * 0.5})`; g.beginPath(); g.arc(860, 150, 20 + p * 140, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgba(40,150,230,${0.25 + p * 0.5})`; g.beginPath(); g.arc(850, 160, 14 + p * 110, 0, Math.PI * 2); g.fill();
      if (img.complete) g.drawImage(img, px, 230, 125 * 0.8, 145 * 0.8); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  const next = () => { if (i >= INTRO.length - 1) done(); else setI(i + 1); };
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (['Enter', ' ', 'z'].includes(e.key)) { e.preventDefault(); next(); } if (isBackKey(e) || e.key === 'k') { e.preventDefault(); done(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });
  const [who, text] = INTRO[i];
  return (
    <div className="screen" style={{ background: '#04061a' }} onClick={next}>
      <canvas ref={cv} width={960} height={540} style={{ position: 'absolute', inset: 0 }} />
      <div className="win dlg-box narr" style={{ position: 'absolute', left: 80, right: 80, bottom: 40 }}>
        {who !== 'Narrator' && <div className="dlg-name px">{who.toUpperCase()}</div>}
        <div className="dlg-text">{text}</div>
        <div className="dlg-foot"><span className="blink">▼ Enter</span><button className="btn small skipbtn" onClick={(e) => { e.stopPropagation(); done(); }}>Skip intro</button></div>
      </div>
    </div>
  );
}

export function SsjCutscene({ done }: { done: () => void }) {
  useEffect(() => { host.startCutscene(done); void music.play('ssj', 400); const onKey = (e: KeyboardEvent) => { if (isBackKey(e) || e.key === 'k' || e.key === 'Enter') { host.scene<import('../engine/scenes/CutsceneScene').CutsceneScene>('cutscene')?.skip(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [done]);
  return <div className="hint-skip px">ENTER / K: SKIP</div>;
}

