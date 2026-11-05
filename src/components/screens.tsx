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
import { getSettings, updateSettings, subscribeSettings, type Settings } from '../systems/settings';

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
  ['Bulma', 'Kami?s Dragon Balls turned to stone when he died. But Kami came from somewhere: a planet called Namek.'],
  ['Gohan', 'Namek has its own Dragon Balls! They could bring everyone back, even Piccolo!'],
  ['Krillin', 'A spaceship, a long trip and a planet full of strangers. What could go wrong?'],
  ['Narrator', 'Far across the galaxy, an emperor named Frieza hunts the very same wishes.'],
  ['Narrator', 'Namek fills the window: blue water, green shores and twin moons.'],
  ['Narrator', 'The capsule settles on an unfamiliar shore. The race for Namek?s Dragon Balls begins.'],
];
export function IntroCutscene({ done }: { done: () => void }) {
  const [i, setI] = useState(0);
  const [arrived, setArrived] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { void music.play('namek_day', 900); }, []);
  useEffect(() => { const timer = window.setTimeout(() => setArrived(true), 9800); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    g.imageSmoothingEnabled = false;
    const orbit = new Image(); orbit.src = '/assets/backgrounds/voyage_namek.png';
    const shore = new Image(); shore.src = '/assets/backgrounds/landing_namek.png';
    const ship = new Image(); ship.src = '/assets/world/obj/lander.png';
    const t0 = performance.now(); let raf = 0; let alive = true;
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    const ease = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p); };
    const loop = (now: number) => {
      if (!alive) return;
      const ms = Math.min(now - t0, 9800); const sec = ms / 1000;
      g.clearRect(0, 0, 960, 540);
      if (orbit.complete && orbit.naturalWidth) g.drawImage(orbit, 0, 0, 960, 540);
      else { g.fillStyle = '#07162c'; g.fillRect(0, 0, 960, 540); }

      const shoreMix = ease((ms - 2900) / 1050);
      if (shoreMix > 0 && shore.complete && shore.naturalWidth) {
        g.globalAlpha = shoreMix; g.drawImage(shore, 0, 0, 960, 540); g.globalAlpha = 1;
      }

      // The capsule crosses the orbital shot, then brakes over the open shore.
      let x: number, y: number, scale: number;
      if (ms < 4300) {
        const p = ease(ms / 4300); x = 130 + p * 335; y = 105 + p * 155; scale = 0.68 + p * 0.58;
      } else {
        const p = ease((ms - 4300) / 4700); x = 465 + Math.sin(sec * 2.2) * (1 - p) * 8; y = 245 + p * 68; scale = 1.26 + p * 0.48;
      }
      const sw = ship.naturalWidth || 42, sh = ship.naturalHeight || 48;
      const dw = sw * scale, dh = sh * scale;
      const landed = ms >= 7900;
      const reduced = getSettings().reducedFlash;
      if (shoreMix > 0.8) {
        g.fillStyle = `rgba(15,24,34,${0.12 + shoreMix * 0.12})`;
        g.beginPath(); g.ellipse(465, 366, 19 + scale * 8, 4 + scale * 2, 0, 0, Math.PI * 2); g.fill();
      }
      if (ship.complete && ship.naturalWidth && !landed) {
        const flame = reduced ? 0.42 : 0.72 + Math.sin(sec * 19) * 0.15;
        g.globalAlpha = flame; g.fillStyle = '#ffb74e';
        g.beginPath(); g.moveTo(x - dw * 0.12, y + dh * 0.27); g.lineTo(x, y + dh * 0.65 + Math.sin(sec * 17) * 4); g.lineTo(x + dw * 0.12, y + dh * 0.27); g.closePath(); g.fill();
        g.fillStyle = '#fff0a3'; g.beginPath(); g.moveTo(x - dw * 0.055, y + dh * 0.26); g.lineTo(x, y + dh * 0.49); g.lineTo(x + dw * 0.055, y + dh * 0.26); g.closePath(); g.fill(); g.globalAlpha = 1;
      }
      if (ship.complete && ship.naturalWidth) {
        g.save(); g.translate(x, y); g.rotate(ms < 4300 ? -0.12 + ease(ms / 4300) * 0.12 : Math.sin(sec * 2) * (landed ? 0 : 0.018));
        g.drawImage(ship, -dw / 2, -dh / 2, dw, dh); g.restore();
      }

      if (shoreMix > 0.9 && landed && !reduced) {
        const dust = (sec * 1.6) % 1;
        for (let n = 0; n < 7; n++) {
          const p = (dust + n / 7) % 1; const side = n % 2 ? 1 : -1;
          g.fillStyle = `rgba(220,190,125,${(1 - p) * 0.16})`;
          g.beginPath(); g.ellipse(465 + side * (12 + p * 62), 357 - p * 18, 3 + p * 9, 2 + p * 4, 0, 0, Math.PI * 2); g.fill();
        }
      }

      if (ms > 7700) {
        const a = clamp((ms - 7700) / 800);
        g.globalAlpha = a; g.fillStyle = '#061a34'; g.fillRect(20, 28, 188, 37);
        g.strokeStyle = '#b6e4e6'; g.lineWidth = 2; g.strokeRect(20, 28, 188, 37);
        g.font = '9px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = '#8dffd2'; g.fillText('NAMEK  /  SHORE', 32, 52); g.globalAlpha = 1;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);
  const next = () => { if (i < INTRO.length - 1) setI(i + 1); else if (arrived) done(); };
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (['Enter', ' ', 'z'].includes(e.key)) { e.preventDefault(); next(); } if (isBackKey(e) || e.key === 'k') { e.preventDefault(); done(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); });
  const [who, text] = INTRO[i];
  return (
    <div className="screen" style={{ background: '#04061a' }} onClick={next}>
      <canvas ref={cv} width={960} height={540} style={{ position: 'absolute', inset: 0 }} />
      <div className="win dlg-box narr" style={{ position: 'absolute', left: 80, right: 80, bottom: 40 }}>
        {who !== 'Narrator' && <div className="dlg-name px">{who.toUpperCase()}</div>}
        <div className="dlg-text">{text}</div>
        <div className="dlg-foot"><span className={i === INTRO.length - 1 && !arrived ? '' : 'blink'}>{i === INTRO.length - 1 && !arrived ? 'Landing in progress?' : arrived && i === INTRO.length - 1 ? '? Enter Namek' : '? Enter'}</span><button className="btn small skipbtn" onClick={(e) => { e.stopPropagation(); done(); }}>Skip intro</button></div>
      </div>
    </div>
  );
}

/** A short, skippable field-scale staging beat before the scripted rescue dialogue and fight. */
export function DendeRescueCutscene({ done }: { done: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [window.setTimeout(() => setPhase(1), 2200), window.setTimeout(() => setPhase(2), 4400), window.setTimeout(done, 6600)];
    const onKey = (e: KeyboardEvent) => { if (isBackKey(e) || e.key.toLowerCase() === 'k') { e.preventDefault(); done(); } };
    window.addEventListener('keydown', onKey);
    return () => { timers.forEach(window.clearTimeout); window.removeEventListener('keydown', onKey); };
  }, [done]);
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    g.imageSmoothingEnabled = false;
    const bg = new Image(); bg.src = '/assets/backgrounds/village_namek.png';
    const directions = ['down', 'left', 'right'];
    const entities = ['gohan_namek', 'krillin', 'dende', 'soldier'];
    const walkFrames: Record<string, number> = { gohan_namek: 3, krillin: 3, dende: 2, soldier: 2 };
    const images = new Map<string, HTMLImageElement>();
    for (const entity of entities) for (const dir of directions) for (const frame of ['idle_000', ...Array.from({ length: walkFrames[entity] }, (_, i) => `walk_${String(i).padStart(3, '0')}`)]) {
      const image = new Image(); image.src = `/assets/reviewed/overworld/${entity}/${dir}/${frame}.png`; images.set(`${entity}_${dir}_${frame}`, image);
    }
    const t0 = performance.now(); let raf = 0; let alive = true;
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    const ease = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p); };
    const sprite = (entity: string, dir: string, walking: boolean, sec: number, x: number, foot: number) => {
      const frame = walking ? `walk_${String(Math.floor(sec * 8) % walkFrames[entity]).padStart(3, '0')}` : 'idle_000';
      const image = images.get(`${entity}_${dir}_${frame}`); if (!image?.complete || !image.naturalWidth) return;
      g.fillStyle = 'rgba(7,20,35,.28)'; g.beginPath(); g.ellipse(x, foot - 2, 22, 5, 0, 0, Math.PI * 2); g.fill();
      g.drawImage(image, x - 72, foot - 140, 144, 144);
    };
    const loop = (now: number) => {
      if (!alive) return;
      const sec = Math.min(6.6, (now - t0) / 1000);
      if (bg.complete && bg.naturalWidth) g.drawImage(bg, 0, 0, 960, 540); else { g.fillStyle = '#173f55'; g.fillRect(0, 0, 960, 540); }
      // The field has a subtle settling drift; it stops when reduced motion is enabled.
      if (!getSettings().reducedFlash) {
        g.fillStyle = `rgba(229,255,199,${0.035 + (Math.sin(sec * 2) + 1) * 0.02})`;
        g.fillRect(0, 204, 960, 116);
      }
      g.fillStyle = 'rgba(5,18,38,.82)'; g.fillRect(20, 24, 248, 38);
      g.strokeStyle = '#cdeaff'; g.lineWidth = 2; g.strokeRect(20, 24, 248, 38);
      g.font = '8px "Press Start 2P", monospace'; g.textAlign = 'left'; g.fillStyle = '#ffd34a'; g.fillText('AOJAN VILLAGE', 34, 48);

      const approach = ease((sec - 0.55) / 1.65);
      let gohanX = 138 + approach * 134, krillinX = 82 + approach * 142;
      if (sec > 2.35) { const dash = ease((sec - 2.35) / 0.85); gohanX += dash * 236; krillinX += dash * 94; }
      const retreat = ease((sec - 3.25) / 0.8);
      const soldierAX = 568 + retreat * 42, soldierBX = 746 + retreat * 34;
      const dendeX = 655 - ease((sec - 3.7) / 1.0) * 78;
      const running = sec > 0.35 && sec < 3.3;

      // Dry grass kicks up behind the two short, grounded runs.
      if (running && !getSettings().reducedFlash) {
        for (let n = 0; n < 5; n++) {
          const a = (sec * 2.1 + n / 5) % 1; const x = gohanX - 18 - a * 36;
          g.fillStyle = `rgba(255,229,151,${(1 - a) * 0.32})`; g.fillRect(Math.round(x), Math.round(346 - a * 18), 4, 2);
        }
      }
      // Draw in foot-depth order so actors overlap naturally as they meet.
      const cast = [
        { id: 'gohan_namek', dir: running ? 'right' : 'down', walk: running, x: gohanX, y: 356 },
        { id: 'krillin', dir: running ? 'right' : 'down', walk: running, x: krillinX, y: 365 },
        { id: 'soldier', dir: 'left', walk: retreat > 0.05, x: soldierAX, y: 360 },
        { id: 'dende', dir: 'left', walk: sec > 4.2 && sec < 5.2, x: dendeX, y: 360 },
        { id: 'soldier', dir: 'right', walk: retreat > 0.05, x: soldierBX, y: 365 },
      ].sort((a, b) => a.y - b.y);
      for (const actor of cast) sprite(actor.id, actor.dir, actor.walk, sec, actor.x, actor.y);

      // A compact ki-spark impact accent marks the interception without hiding the characters.
      if (sec > 3.05 && sec < 3.75) {
        const p = (sec - 3.05) / 0.7, alpha = getSettings().reducedFlash ? 0.25 : Math.sin(p * Math.PI) * 0.9;
        const cx = 542, cy = 302, radius = 8 + p * 24;
        g.globalAlpha = alpha; g.fillStyle = '#fff1a1'; g.beginPath(); g.moveTo(cx, cy - radius); g.lineTo(cx + radius * 0.35, cy - 4); g.lineTo(cx + radius, cy); g.lineTo(cx + 3, cy + 5); g.lineTo(cx, cy + radius); g.lineTo(cx - 4, cy + 5); g.lineTo(cx - radius, cy); g.lineTo(cx - 4, cy - 4); g.closePath(); g.fill(); g.globalAlpha = 1;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);
  const captions = [
    'Frieza’s soldiers have cornered Dende in the village square.',
    'Gohan and Krillin rush in to put themselves between Dende and the soldiers.',
    'The soldiers regroup. A fight is unavoidable.',
  ];
  return <div className="screen" style={{ background: '#07162c' }}>
    <canvas ref={cv} width={960} height={540} style={{ position: 'absolute', inset: 0 }} />
    <div className="win dlg-box narr" style={{ position: 'absolute', left: 80, right: 80, bottom: 40 }}>
      <div className="dlg-text">{captions[phase]}</div>
      <div className="dlg-foot"><span className="dim">Confrontation begins…</span><button className="btn small skipbtn" onClick={done}>Skip scene</button></div>
    </div>
  </div>;
}

export function SsjCutscene({ done }: { done: () => void }) {
  useEffect(() => { host.startCutscene(done); void music.play('ssj', 400); const onKey = (e: KeyboardEvent) => { if (isBackKey(e) || e.key === 'k' || e.key === 'Enter') { host.scene<import('../engine/scenes/CutsceneScene').CutsceneScene>('cutscene')?.skip(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [done]);
  return <div className="hint-skip px">ENTER / K: SKIP</div>;
}

