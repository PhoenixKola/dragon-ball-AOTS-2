import { useEffect, useRef, useState } from 'react';
import { session } from '../app/session';
import { useSession } from './screens';
import { getSettings } from '../systems/settings';
import { isBackKey } from '../systems/backKey';
import { WISHES, WISH_IDS, isGranted, pendingWishes, type WishId } from '../systems/wishes';
import { POTENTIAL, statsOf } from '../systems/party';
import { HEROES, ITEMS } from '../data/heroes';
import { audio } from '../engine/audio/audio';

const A = 'assets/reviewed/porunga/';
type Phase = 'ritual' | 'choose' | 'confirm' | 'granted';

/** Porunga's summoning: brief skippable ritual, then three choice cards. Cancelling anywhere before "Make this wish" spends nothing. */
export function PorungaScreen({ done }: { done: () => void }) {
  const s = useSession();
  const st = s.state;
  const [phase, setPhase] = useState<Phase>('ritual');
  const [step, setStep] = useState(0);
  const [pick, setPick] = useState<WishId | null>(null);
  const [msg, setMsg] = useState('');
  const [line, setLine] = useState('');
  const busy = useRef(false);
  const calm = getSettings().reducedFlash;

  useEffect(() => {
    if (phase !== 'ritual') return;
    const t = window.setInterval(() => setStep((n) => (n >= 10 ? n : n + 1)), calm ? 330 : 420);
    audio.sfx('charge');
    return () => window.clearInterval(t);
  }, [phase, calm]);
  useEffect(() => {
    if (phase === 'ritual' && step >= 10) {
      const t = window.setTimeout(() => setPhase('choose'), 900);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [phase, step]);
  useEffect(() => { if (step === 9) audio.sfx('transform'); }, [step]);

  const back = () => {
    if (phase === 'ritual') { setPhase('choose'); return; }
    if (phase === 'confirm') { setPhase('choose'); setPick(null); return; }
    if (phase === 'choose') { done(); return; }
    if (pendingWishes(st).length) setPhase('choose'); else done();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isBackKey(e)) { e.preventDefault(); back(); }
      else if ((e.key === 'Enter' || e.key === ' ' || e.key === 'k' || e.key === 'K') && phase === 'ritual') { e.preventDefault(); setPhase('choose'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const commit = () => {
    if (!pick || busy.current) return;
    busy.current = true;
    const r = session.commitWish(pick);
    setMsg(r.message);
    setLine(pick === 'trunks' ? 'Porunga: "It is done. A warrior from a future that never was now walks beside you."'
      : pick === 'potential' ? 'Porunga: "It is done. The strength you did not know you carried now wakes."'
        : 'Porunga: "It is done. Carry this crest with honour."');
    setPhase('granted');
    setPick(null);
    window.setTimeout(() => { busy.current = false; }, 400);
  };
  const preview = (id: WishId) => {
    if (id === 'potential') {
      const m = st.roster[0];
      if (!m) return null;
      const b = statsOf(m);
      const a = statsOf({ ...m, potential: true });
      return `${HEROES[m.id].name}: HP ${b.hp} to ${a.hp}, ATK ${b.atk} to ${a.atk}, DEF ${b.def} to ${a.def}. (HP x${POTENTIAL.hp}, ATK/DEF x${POTENTIAL.atk}.)`;
    }
    if (id === 'relic') return ITEMS.dragoncrest.desc;
    return 'Trunks starts at about your party level with his own loadout. Super Saiyan costs 24 Ki and drains Ki every turn.';
  };
  const left = pendingWishes(st).length;
  const first = WISH_IDS.find((x) => !isGranted(st, x));
  const dragonPose = phase === 'granted' ? 'grant' : phase === 'confirm' ? 'reach' : step >= 10 && phase === 'ritual' ? 'roar' : 'calm';

  return (
    <div className={'overlay-dim porunga fade-in porunga-sky' + (phase === 'ritual' ? ' ritual' : '')} role="dialog" aria-label="Porunga">
      <div className="porunga-stage" aria-hidden="true">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => <img key={n} className={'pball b' + n + (step >= n || phase !== 'ritual' ? ' on' : '')} src={`${A}ball_${n}.png`} alt="" draggable={false} />)}
        <img className={'ppillar' + (phase === 'ritual' && step >= 8 && step < 10 ? ' on' : '')} src={`${A}pillar_${Math.min(4, Math.max(1, step - 7))}.png`} alt="" draggable={false} />
        <img className={'pdragon' + (step >= 9 || phase !== 'ritual' ? ' on' : '')} src={`${A}porunga_${dragonPose}.png`} alt="" draggable={false} />
      </div>
      {phase === 'ritual' && (
        <div className="porunga-say win flat">The seven Dragon Balls rise and the sky darkens...<button className="btn small" onClick={() => setPhase('choose')}>Skip (Enter)</button></div>
      )}
      {phase !== 'ritual' && (
        <div className="win porunga-panel">
          {phase === 'choose' && (
            <>
              <div className="px" style={{ fontSize: 11, color: '#ffd34a' }}>PORUNGA: "State your wish."</div>
              <div className="dim" style={{ margin: '4px 0 8px' }}>{left === 3 ? 'Three wishes remain. Pick any one now; the others stay available, in any order.' : `${left} wish${left === 1 ? '' : 'es'} remain.`}</div>
              <div className="wish-cards">
                {WISH_IDS.map((id) => {
                  const w = WISHES[id];
                  const got = isGranted(st, id);
                  return (
                    <button key={id} type="button" autoFocus={id === first} className={'wish-card' + (got ? ' done' : '')} disabled={got} onClick={() => { setPick(id); setPhase('confirm'); audio.sfx('select'); }}>
                      <img src={w.icon} alt="" draggable={false} /><b>{w.title}</b><span>{w.short}</span><em>{got ? 'GRANTED' : 'Available'}</em>
                    </button>
                  );
                })}
              </div>
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <span className="dim">Back: X / Backspace / B (no wish is spent)</span>
                <button className="btn small" onClick={done}>Close (X)</button>
              </div>
            </>
          )}
          {phase === 'confirm' && pick && (
            <>
              <div className="px" style={{ fontSize: 11, color: '#ffd34a' }}>{WISHES[pick].title.toUpperCase()}</div>
              <div className="confirm-body">
                <img src={WISHES[pick].icon} alt="" draggable={false} />
                <div>
                  <p>{WISHES[pick].detail}</p>
                  <p className="dim">{preview(pick)}</p>
                  <p style={{ color: '#ffb09a' }}>This wish is permanent and can only be made once.</p>
                </div>
              </div>
              <div className="row">
                <button className="btn" onClick={commit}>Make this wish</button>
                <button className="btn" autoFocus onClick={() => { setPhase('choose'); setPick(null); }}>Go back (X)</button>
              </div>
            </>
          )}
          {phase === 'granted' && (
            <>
              <div className="px" style={{ fontSize: 11, color: '#8dffa8' }}>WISH GRANTED</div>
              <p>{line}</p>
              <p><b>{msg}</b></p>
              <div className="row"><button className="btn" autoFocus onClick={back}>{left ? 'Continue' : 'Farewell'}</button></div>
              {left === 0 && <div className="dim">All three wishes have been granted. Porunga sleeps; the Dragon Balls scatter once more.</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
