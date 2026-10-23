import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type React from 'react';
import { LIST_WINDOW, windowStart } from './listWindow';
import type { BattleController } from '../engine/combat/controller';
import type { Fighter } from '../types';
import { Icon, Portrait } from './ui';
import { getSettings, updateSettings } from '../systems/settings';
import { audio } from '../engine/audio/audio';
import { isBackKey } from '../systems/backKey';

const STATUS_LABEL: Record<string, string> = { stun: 'STUN', blind: 'BLIND', seal: 'SEAL', atkUp: 'ATK+', defUp: 'DEF+', atkDown: 'ATK-', defDown: 'DEF-', spdUp: 'SPD+', regen: 'REGEN', frozen: 'FROZEN', charging: 'CHARGE', counter: 'COUNTER', sparking: 'SPARK', possessed: 'POSSESSED', kaioken: 'KAIOKEN', ssjform: 'SSJ' };
const BAD = new Set(['stun', 'blind', 'seal', 'atkDown', 'defDown', 'frozen', 'possessed']);

function useCtl(ctl: BattleController) {
  useSyncExternalStore((cb) => ctl.subscribe(cb), () => ctl.snapshotVersion);
}

export function BattleHUD({ ctl, onPauseRequest }: { ctl: BattleController; onPauseRequest: () => void }) {
  useCtl(ctl);
  useBattleKeys(ctl, onPauseRequest);
  const engine = ctl.engine;
  const allies = engine.fighters.filter((f) => f.side === 'ally').sort((a, b) => a.slot - b.slot);
  const boss = engine.enemies().find((e) => e.boss) ?? null;
  const actor = ctl.actor;
  const menu = ctl.menu;
  const log = engine.log.slice(-3);
  const cueActive = !!ctl.director?.activeCues.length;
  const fast = getSettings().battleSpeed > 1;
  const listOpen = menu.kind === 'skills' || menu.kind === 'items' || menu.kind === 'combos';

  return (
    <>
      <div className="win flat top-log no-pointer" aria-live="polite">
        {log.length === 0 ? <div className="dim">Battle start!</div> : log.map((l, i) => <div key={engine.log.length - log.length + i} className={l.tone === 'warn' ? 'warn' : l.tone === 'bad' ? 'bad' : l.tone === 'good' ? 'good' : ''}>{l.text}</div>)}
      </div>
      {boss && <div className="win flat boss-bar no-pointer"><div className="bn">{boss.name.toUpperCase()}</div><div className="bar hp" style={{ height: 13 }}><i style={{ width: `${Math.max(0, boss.hp / boss.stats.hp) * 100}%` }} /></div></div>}
      <div className="win flat turn-chip no-pointer">ROUND {Math.max(1, engine.round)}</div>
      {fast && <div className="win flat speed-pill no-pointer">FAST x{getSettings().battleSpeed}</div>}
      {ctl.hint && <div className="win hint err no-pointer">{ctl.hint}</div>}
      {menu.kind === 'target' && <div className="win hint no-pointer"><span className="px" style={{ fontSize: 9, color: '#ffd34a' }}>{ctl.targetLabel}</span>  ·  choose target  ·  &larr;&rarr; select · Enter confirm · X / Backspace / Esc back</div>}

      <RageTip ctl={ctl} />
      <div className={'party-cards' + (listOpen ? ' shrunk' : '')}>
        {allies.map((f) => <Card key={f.uid} f={f} active={actor?.uid === f.uid} cue={cueActive} />)}
      </div>

      {actor && menu.kind === 'root' && <RootMenu ctl={ctl} />}
      {actor && listOpen && <ListMenu ctl={ctl} />}
      {actor && menu.kind === 'target' && <div className="win cmd-root no-pointer" style={{ opacity: 0.55 }}><div className="win-title">{actor.name.toUpperCase()}</div><div style={{ padding: 8, fontSize: 14, color: '#ffe27a' }}>Select a target…</div></div>}
    </>
  );
}

/** One-time, non-blocking hint the first time anybody's Rage is full (kept in the options so it never nags). */
function RageTip({ ctl }: { ctl: BattleController }) {
  const [show, setShow] = useState(false);
  const full = ctl.engine.allies().some((f) => f.rage >= 100);
  useEffect(() => {
    if (!full || getSettings().rageTipSeen) return;
    updateSettings({ rageTipSeen: true }); setShow(true);
    window.setTimeout(() => setShow(false), 9000);
  }, [full]);
  if (!show) return null;
  return <div className="win hint rage-tip no-pointer" role="status"><span className="px" style={{ fontSize: 9, color: '#ffd34a' }}>RAGE FULL</span>  ·  <b>Rage Art</b>: one huge hit  ·  <b>Sparking</b>: 4 turns of +25% ATK and half Ki cost  ·  Combos cost 50 Rage each</div>;
}

function Card({ f, active, cue }: { f: Fighter; active: boolean; cue: boolean }) {
  const hpFrac = Math.max(0, f.hp / f.stats.hp);
  return (
    <div className={'win pcard' + (active ? ' active' : '') + (!f.alive ? ' down' : '')}>
      <div className="pt"><Portrait id={f.defId === 'goku' && f.ssj ? 'ssj_goku' : f.defId === 'trunks' && f.statuses.some((s) => s.kind === 'ssjform') ? 'trunks_ssj' : f.defId} /><div><div className="nm">{f.name}</div><div className="lv">Lv {f.level}</div></div></div>
      <div><div className="lbl"><span>HP</span><span>{f.hp}/{f.stats.hp}</span></div><div className={'bar hp' + (hpFrac < 0.3 ? ' low' : '')}><i style={{ width: `${hpFrac * 100}%` }} /></div></div>
      <div><div className="lbl"><span>KI</span><span>{f.ki}/{f.stats.ki}</span></div><div className="bar ki"><i style={{ width: `${(f.ki / f.stats.ki) * 100}%` }} /></div></div>
      <div title={`Rage ${Math.floor(f.rage)}/100. Fills by hitting, being hit and Active Guard. At 100: Rage Art or Sparking. Combos cost 50 from each partner.`}><div className="lbl"><span>RAGE</span><span>{f.rage >= 100 ? 'MAX · READY' : Math.floor(f.rage)}</span></div><div className={'bar rage' + (f.rage >= 100 ? ' full' : f.rage >= 75 ? ' near' : '')}><i style={{ width: `${f.rage}%` }} />{f.rage >= 50 && <b className="tick" />}</div></div>
      <div className="chips">{f.statuses.filter((s) => STATUS_LABEL[s.kind]).slice(0, 4).map((s) => <span key={s.kind} className={'chip ' + (BAD.has(s.kind) ? 'bad' : 'good')}>{STATUS_LABEL[s.kind]}{s.turns < 50 ? s.turns : ''}</span>)}</div>
      {cue && f.alive && <div className="keyhint">[{f.slot + 1}]</div>}
    </div>
  );
}

function RootMenu({ ctl }: { ctl: BattleController }) {
  const a = ctl.actor!; const rows = ctl.currentRows(); const m = ctl.menu as { cursor: number };
  return (
    <div className="win cmd-root fade-in" role="menu" aria-label="Battle commands">
      <div className="win-title">{a.name.toUpperCase()}</div>
      <div className="cmd-grid">
        {rows.map((r, i) => (
          <button key={r.id} type="button" role="menuitem" className={'cmd' + (i === m.cursor ? ' sel' : '') + (r.disabled ? ' dis' : '') + (r.accent ? ' accent' : '')} onMouseMove={() => { if (i !== m.cursor) { m.cursor = i; ctl.emit(); } }} onClick={() => ctl.activate(i)} title={r.disabled ?? r.desc ?? r.sub}>
            <Icon name={r.icon} /><span>{r.label}</span>{r.sub && <span className="sub">{r.sub}</span>}
          </button>
        ))}
      </div>
      {rows[m.cursor] && <div className={'cmd-desc' + (rows[m.cursor].disabled ? ' why' : '')}>{rows[m.cursor].disabled ? `Unavailable: ${rows[m.cursor].disabled}` : rows[m.cursor].desc ?? ''}</div>}
    </div>
  );
}

function ListMenu({ ctl }: { ctl: BattleController }) {
  const rows = ctl.currentRows(); const m = ctl.menu as { kind: string; cursor: number; start?: number };
  const sel = rows[m.cursor];
  m.start = windowStart(m.start ?? 0, m.cursor, rows.length);
  const start = m.start;
  const shown = rows.slice(start, start + LIST_WINDOW);
  const lastPtr = useRef<{ x: number; y: number } | null>(null);
  const hover = (i: number) => (e: React.MouseEvent) => {
    const p = lastPtr.current; lastPtr.current = { x: e.clientX, y: e.clientY };
    if (!p || (p.x === e.clientX && p.y === e.clientY)) return; // layout shifts under a still mouse fire synthetic moves
    if (i !== m.cursor) { m.cursor = i; ctl.emit(); }
  };
  return (
    <div className="win list-win fade-in" role="menu" onWheel={(e) => { if (e.deltaY > 0 && m.cursor < rows.length - 1) ctl.nav('down'); else if (e.deltaY < 0 && m.cursor > 0) ctl.nav('up'); }}>
      <div className="win-title">{m.kind === 'skills' ? 'SKILLS' : m.kind === 'items' ? 'ITEMS' : 'COMBOS'}</div>
      <div className="list-col">
        {rows.length === 0 && <div style={{ padding: 8, color: '#9fb6e0' }}>Nothing available.</div>}
        {shown.map((r, k) => { const i = start + k; return (
          <button key={r.id} type="button" role="menuitem" className={'cmd' + (i === m.cursor ? ' sel' : '') + (r.disabled ? ' dis' : '') + (r.accent ? ' accent' : '')} onMouseMove={hover(i)} onClick={() => ctl.activate(i)}>
            <Icon name={r.icon} /><span>{r.label}</span>{r.cost !== undefined && r.cost > 0 ? <span className="cost">{r.cost} KI</span> : r.sub && m.kind !== 'skills' ? <span className="sub">{r.sub}</span> : null}
          </button>); })}
        {rows.length > 3 && <div style={{ fontSize: 10, color: '#9fb6e0', textAlign: 'right' }}>{m.cursor + 1}/{rows.length}</div>}
      </div>
      <div className="desc-col">
        {sel && <><div className="dn">{sel.label.toUpperCase()}</div><div>{sel.desc}</div><div className="dm">{sel.sub}</div>{sel.disabled && <div style={{ color: '#ff9a8a' }}>{sel.disabled}</div>}</>}
      </div>
    </div>
  );
}

export function useBattleKeys(ctl: BattleController, onPause: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      audio.resume();
      const k = e.key;
      if (isBackKey(e) && ctl.menu.kind !== 'none' && ctl.menu.kind !== 'root' && !ctl.paused) { e.preventDefault(); ctl.back(); return; }
      if (k === 'Escape' || k === 'p' || k === 'P') { e.preventDefault(); if (ctl.menu.kind !== 'none' && ctl.menu.kind !== 'root' && !ctl.paused) ctl.back(); else onPause(); return; }
      if (ctl.paused) return;
      if (['1', '2', '3'].includes(k)) { ctl.guardSlot(Number(k) - 1); return; }
      if (k === ' ' || k === 'Spacebar') {
        if (ctl.director?.activeCues.length) { e.preventDefault(); if (getSettings().guardPreset === 'assist') ctl.guardAll(); return; }
        if (ctl.menu.kind !== 'none') { e.preventDefault(); ctl.nav('ok'); }
        return;
      }
      const map: Record<string, 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'> = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', Enter: 'ok', z: 'ok', Z: 'ok', x: 'back', X: 'back', Backspace: 'back' };
      const act = map[k];
      if (act && ctl.menu.kind !== 'none') { e.preventDefault(); ctl.nav(act); }
    };
    const onBlur = () => { if (!ctl.paused && !ctl.finished) onPause(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('blur', onBlur); };
  }, [ctl, onPause]);
}
