import { useEffect, useRef, useState } from 'react';
import { session, chapterName, objectiveOf } from '../app/session';
import { isBackKey, BACK_HINT } from '../systems/backKey';
import { useSession, SlotList, SettingsPanel, fmtTime } from './screens';
import { HEROES, ITEMS } from '../data/heroes';
import { SKILLS } from '../data/skills';
import { COMBOS } from '../data/combos';
import { MAPS } from '../data/maps';
import { Portrait, Icon } from './ui';
import { statsOf, learnedSkillsOf, formSkillsOf, equippedOf, equipSkill, unequipSkill, upcomingSkills, xpToNext, spendPoint, refundPoints, rageArtOf, CAPSULE_SLOTS, MAX_EQUIPPED, POINT_VALUE, type PartyMember } from '../systems/party';
import type { HeroId, Stats } from '../types';
import { describeSkill } from '../engine/combat/controller';
import { allSlots, deleteSlot } from '../systems/save';
import { BALL_IDS, STAR_NAMES, ownedBalls } from '../systems/gameState';
import { ballHint, journalQuests, questProgress, rewardText, type QuestStatus } from '../systems/storyRuntime';
import { coolerTrail, coolerWarning, COOLER_LEVEL, isPostgame, trainingTargets } from '../systems/postgame';
import { WISHES, WISH_IDS, canSummon, isGranted } from '../systems/wishes';

const TABS: [string, string][] = [['party', 'Party'], ['skills', 'Loadout'], ['training', 'Training'], ['capsules', 'Capsules'], ['items', 'Items'], ['combos', 'Combos'], ['journal', 'Journal'], ['map', 'Map'], ['save', 'Save/Load'], ['settings', 'Settings'], ['help', 'Help']];
const STAT_LABEL: Record<keyof Stats, string> = { hp: 'HP', ki: 'KI', atk: 'ATK', def: 'DEF', spd: 'SPD' };

export function MenuScreen({ tab }: { tab: string }) {
  const s = useSession();
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (isBackKey(e)) { e.preventDefault(); session.closeOverlay(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  return (
    <div className="overlay-dim fade-in"><div className="win menu-win">
      <div className="menu-head"><span className="px">MENU</span><span className="dim">{chapterName(s.state.chapter)} · Zeni <b>{s.state.zeni}</b> · Dragon Balls <b>{s.state.balls}/7</b></span><button className="btn small" onClick={() => session.closeOverlay()} title={BACK_HINT}>Back (X)</button></div>
      <div className="menu-tabs" role="tablist">{TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={'tabbtn' + (tab === id ? ' on' : '')} onClick={() => session.setMenuTab(id)}>{label}</button>)}</div>
      <div className="menu-body">
        {tab === 'party' && <PartyTab />}{tab === 'skills' && <SkillsTab />}{tab === 'training' && <TrainingTab />}{tab === 'capsules' && <CapsulesTab />}
        {tab === 'items' && <ItemsTab />}{tab === 'combos' && <CombosTab />}{tab === 'journal' && <JournalTab />}{tab === 'map' && <MapTab />}
        {tab === 'save' && <SaveTab />}{tab === 'settings' && <SettingsPanel />}{tab === 'help' && <HelpTab />}
      </div>
    </div></div>
  );
}

function Bar({ label, v, max, cls }: { label: string; v: number; max: number; cls: string }) {
  return <div style={{ marginBottom: 3 }}><div className="lbl2"><span>{label}</span><span>{v}/{max}</span></div><div className={'bar ' + cls}><i style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></div></div>;
}

function PartyTab() {
  const s = useSession(); const st = s.state;
  const toggle = (id: HeroId) => {
    if (st.party.includes(id)) { if (st.party.length > 1) s.setParty(st.party.filter((p) => p !== id)); } else if (st.party.length < 3) s.setParty([...st.party, id]); else s.toast('Party is full. Remove someone first.');
  };
  const lead = (id: HeroId) => s.setParty([id, ...st.party.filter((p) => p !== id)]);
  return (
    <div>
    <p className="dim" style={{ margin: '0 0 6px' }}>Your party is up to 3 fighters. Story fights with a fixed squad (for example Goku’s arrival, Nail’s stand and Frieza’s forms) use their own lineup. Fighters who are not in the party still earn half XP.</p>
    <div className="grid2">
      {st.roster.map((m) => { const x = statsOf(m); const inP = st.party.includes(m.id); return (
        <div className={'win flat hero-card' + (inP ? ' on' : '')} key={m.id}>
          <div className="hc-top"><Portrait id={m.id === 'goku' && m.ssj ? 'ssj_goku' : m.id} /><div><div className="px" style={{ fontSize: 10 }}>{HEROES[m.id].name.toUpperCase()}{m.ssj ? ' · SSJ' : ''}{m.fused ? ' · FUSED' : ''}</div><div className="dim">Lv {m.level} · {HEROES[m.id].role}</div><div className="dim">EXP {m.xp}/{xpToNext(m)}</div></div></div>
          <Bar label="HP" v={m.hp} max={x.hp} cls="hp" /><Bar label="KI" v={m.ki} max={x.ki} cls="ki" />
          <div className="stats5">{(Object.keys(x) as (keyof Stats)[]).filter((k) => k !== 'hp' && k !== 'ki').map((k) => <span key={k}>{STAT_LABEL[k]} <b>{x[k]}</b></span>)}</div>
          <div className="row"><button className="btn small" onClick={() => toggle(m.id)}>{inP ? 'Remove from party' : 'Add to party'}</button>{inP && st.party[0] !== m.id && <button className="btn small" onClick={() => lead(m.id)}>Make leader</button>}{st.party[0] === m.id && <span className="dim">Leader</span>}</div>
        </div>); })}
    </div>
    </div>
  );
}

function SkillsTab() {
  const s = useSession(); const [hero, setHero] = useState<HeroId>(s.state.roster[0].id);
  const [slot, setSlot] = useState(MAX_EQUIPPED - 1); const [msg, setMsg] = useState('');
  const m = s.state.roster.find((r) => r.id === hero) ?? s.state.roster[0]; const h = HEROES[m.id];
  const eq = equippedOf(m), learned = learnedSkillsOf(m), forms = formSkillsOf(m);
  const locked = h.skills.filter((id) => !learned.includes(id)).sort((a, b) => SKILLS[a].unlockLevel - SKILLS[b].unlockLevel);
  const act = (id: string) => {
    if (eq.includes(id)) { unequipSkill(m, id); setMsg(`${SKILLS[id].name} unequipped.`); }
    else { const err = equipSkill(m, id, eq.length >= MAX_EQUIPPED ? slot : undefined); setMsg(err ?? `${SKILLS[id].name} equipped${eq.length >= MAX_EQUIPPED ? ' (swapped into slot ' + 'I II III IV'.split(' ')[slot] + ')' : ''}.`); }
    s.touch();
  };
  const ssjNote = (id: string) => (m.id === 'goku' && m.ssj && SKILLS[id].baseOnly ? 'Not usable as Super Saiyan' : '');
  return (
    <div>
      <HeroPicker value={m.id} onChange={(x) => { setHero(x); setMsg(''); }} />
      <p className="dim" style={{ margin: '0 0 6px' }}>Learn many specials, equip four. Attack, Defend, Items, Rage Art, Sparking, Combos and Flee are always available and never use a slot.{m.id === 'goku' ? ' Kaioken is an ordinary special you can equip or swap. Super Saiyan skills appear automatically after the transformation.' : ''}</p>
      <div className="grid2">
        <div className="win flat" style={{ padding: 10 }}>
          <div className="px" style={{ fontSize: 9, marginBottom: 6 }}>EQUIPPED ({eq.length}/{MAX_EQUIPPED})</div>
          {Array.from({ length: MAX_EQUIPPED }, (_, i) => { const id = eq[i]; return (
            <div key={i} className={'skill-row slotrow' + (slot === i ? ' sel' : '')} onClick={() => setSlot(i)}>
              <span className="px slotno">{'I II III IV'.split(' ')[i]}</span>
              {id ? <><Icon name={`skill:${id}`} /><div className="grow"><b>{SKILLS[id].name}</b> <span className="role">{SKILLS[id].role ?? 'Special'}</span><div className="dim">{describeSkill(SKILLS[id])}</div></div><span className="cost">{SKILLS[id].cost} KI</span><button className="btn small" onClick={(e) => { e.stopPropagation(); act(id); }}>Unequip</button></> : <span className="dim">Empty slot{learned.length > eq.length ? ' · pick a skill from the library' : ''}</span>}
            </div>); })}
          {HEROES[m.id].extra?.length ? <><div className="px" style={{ fontSize: 9, margin: '8px 0 4px' }}>ALWAYS AVAILABLE (no slot)</div>{HEROES[m.id].extra!.map((id) => <div key={id} className="skill-row"><Icon name={`skill:${id}`} /><div className="grow"><b>{SKILLS[id].name}</b> <span className="dim">{SKILLS[id].desc}</span></div><span className="cost">{SKILLS[id].cost} KI</span></div>)}</> : null}
          {forms.length > 0 && <><div className="px" style={{ fontSize: 9, margin: '8px 0 4px' }}>SUPER SAIYAN (automatic)</div>{forms.map((id) => <div key={id} className="skill-row"><Icon name={`skill:${id}`} /><div className="grow"><b>{SKILLS[id].name}</b> <span className="dim">{describeSkill(SKILLS[id])}</span></div><span className="cost">{SKILLS[id].cost} KI</span></div>)}</>}
          <div className="skill-row" style={{ marginTop: 6 }}><Icon name={`skill:${rageArtOf(m)}`} /><div className="grow"><b>{SKILLS[rageArtOf(m)].name}</b> <span className="dim">Rage Art · always available at 100 Rage</span></div><span className="cost">RAGE 100</span></div>
          <div className="dim" style={{ marginTop: 6 }}>{msg}</div>
        </div>
        <div className="win flat" style={{ padding: 10 }}>
          <div className="px" style={{ fontSize: 9, marginBottom: 6 }}>LEARNED LIBRARY ({learned.length})</div>
          <div className="skill-list libscroll">
            {learned.map((id) => { const sk = SKILLS[id]; const on = eq.includes(id); return (
              <div key={id} className={'skill-row' + (on ? ' equipped' : '')}><Icon name={`skill:${id}`} /><div className="grow"><b>{sk.name}</b> <span className="role">{sk.role ?? 'Special'}</span>{sk.postgame && <span className="role post">POSTGAME</span>}{sk.ssjOnly && <span className="role post">SUPER SAIYAN ONLY</span>}<div className="dim">{sk.desc}</div><div className="dim">{describeSkill(sk)}{ssjNote(id) ? ' · ' + ssjNote(id) : ''}</div></div><span className="cost">{sk.cost} KI</span><button className="btn small" onClick={() => act(id)}>{on ? 'Unequip' : eq.length >= MAX_EQUIPPED ? 'Swap in slot ' + 'I II III IV'.split(' ')[slot] : 'Equip'}</button></div>); })}
            {learned.length === 0 && <div className="dim">Nothing learned yet.</div>}
          </div>
          <div className="px" style={{ fontSize: 9, margin: '8px 0 4px' }}>NOT LEARNED YET ({locked.length})</div>
          <div className="skill-list libscroll short">
            {locked.map((id) => { const sk = SKILLS[id]; return <div key={id} className="skill-row locked"><Icon name={`skill:${id}`} /><div className="grow"><b>{sk.name}</b> <span className="role">{sk.role ?? 'Special'}</span>{sk.postgame && <span className="role post">POSTGAME</span>}<div className="dim">{sk.desc}</div></div><span className="dim" style={{ minWidth: 70, textAlign: 'right' }}>Lv {sk.unlockLevel}</span></div>; })}
            {locked.length === 0 && <div className="dim">Everything learned.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
function HeroPicker({ value, onChange }: { value: HeroId; onChange: (h: HeroId) => void }) {
  const s = useSession();
  return <div className="seg" style={{ marginBottom: 8 }}>{s.state.roster.map((m) => <button key={m.id} className={'segbtn' + (m.id === value ? ' on' : '')} onClick={() => onChange(m.id)}>{HEROES[m.id].name}</button>)}</div>;
}

function TrainingTab() {
  const s = useSession(); const [hero, setHero] = useState<HeroId>(s.state.roster[0].id);
  const m = s.state.roster.find((r) => r.id === hero) ?? s.state.roster[0]; const x = statsOf(m);
  return (
    <div>
      <HeroPicker value={m.id} onChange={setHero} />
      <div className="win flat" style={{ padding: 12 }}>
        <div className="px" style={{ fontSize: 10, marginBottom: 6 }}>TRAINING POINTS: <span style={{ color: '#ffd34a' }}>{m.unspent}</span> <span className="dim" style={{ fontSize: 9 }}>(3 per level)</span></div>
        {(Object.keys(STAT_LABEL) as (keyof Stats)[]).map((k) => (
          <div className="train-row" key={k}><span className="px" style={{ width: 54, fontSize: 9 }}>{STAT_LABEL[k]}</span><b style={{ width: 52 }}>{x[k]}</b><span className="dim" style={{ width: 130 }}>+{POINT_VALUE[k]} per point · invested {m.alloc[k]}</span><button className="btn small" disabled={m.unspent <= 0} onClick={() => { spendPoint(m, k); s.touch(); }}>+ Train</button></div>))}
        <div className="row" style={{ marginTop: 8 }}><button className="btn small" onClick={() => { refundPoints(m); s.touch(); }}>Reset all points (free)</button><span className="dim">Specialise each fighter: Vegeta for ATK, Krillin for SPD, Piccolo for DEF…</span></div>
      </div>
    </div>
  );
}

function CapsulesTab() {
  const s = useSession(); const [hero, setHero] = useState<HeroId>(s.state.roster[0].id);
  const [msg, setMsg] = useState('');
  const m = s.state.roster.find((r) => r.id === hero) ?? s.state.roster[0];
  const owned = Object.entries(s.state.inventory).filter(([id, n]) => ITEMS[id]?.capsule && n > 0);
  return (
    <div>
      <HeroPicker value={m.id} onChange={setHero} />
      <div className="grid2">
        <div className="win flat" style={{ padding: 10 }}>
          <div className="px" style={{ fontSize: 9, marginBottom: 6 }}>EQUIPPED ({CAPSULE_SLOTS} slots)</div>
          {Array.from({ length: CAPSULE_SLOTS }, (_, i) => { const c = m.capsules[i]; return <div className="shop-row" key={i}>{c ? <><Icon name={`item:${c}`} /><div className="grow"><b>{ITEMS[c].name}</b><div className="dim">{ITEMS[c].desc}</div></div><button className="btn small" onClick={() => s.unequip(m.id, i)}>Remove</button></> : <span className="dim">Empty slot {i + 1}</span>}</div>; })}
        </div>
        <div className="win flat" style={{ padding: 10 }}>
          <div className="px" style={{ fontSize: 9, marginBottom: 6 }}>YOUR CAPSULES</div>
          {owned.length === 0 && <div className="dim">None. Find them in chests or buy them from the trader.</div>}
          {owned.map(([id, n]) => <div className="shop-row" key={id}><Icon name={`item:${id}`} /><div className="grow"><b>{ITEMS[id].name} x{n}</b><div className="dim">{ITEMS[id].desc}</div></div><button className="btn small" onClick={() => setMsg(s.equip(m.id, id, m.capsules.length < CAPSULE_SLOTS ? m.capsules.length : 0))}>Equip</button></div>)}
          <div className="dim">{msg}</div>
        </div>
      </div>
    </div>
  );
}

function ItemsTab() {
  const s = useSession(); const [msg, setMsg] = useState(''); const [item, setItem] = useState<string | null>(null);
  const cons = Object.entries(s.state.inventory).filter(([id, n]) => n > 0 && ITEMS[id] && !ITEMS[id].capsule);
  return (
    <div className="grid2">
      <div className="win flat" style={{ padding: 10 }}>
        {cons.length === 0 && <div className="dim">No consumables.</div>}
        {cons.map(([id, n]) => <div className={'shop-row sel' + (item === id ? ' on' : '')} key={id} onClick={() => setItem(id)}><Icon name={`item:${id}`} /><div className="grow"><b>{ITEMS[id].name}</b><div className="dim">{ITEMS[id].desc}</div></div><b>x{n}</b></div>)}
      </div>
      <div className="win flat" style={{ padding: 10 }}>
        <div className="px" style={{ fontSize: 9, marginBottom: 6 }}>{item ? 'USE ON…' : 'SELECT AN ITEM'}</div>
        {item && s.state.roster.map((m) => { const x = statsOf(m); return <div className="shop-row" key={m.id}><Portrait id={m.id} /><div className="grow"><b>{HEROES[m.id].name}</b><div className="dim">HP {m.hp}/{x.hp} · KI {m.ki}/{x.ki}</div></div><button className="btn small" onClick={() => { const r = s.useItemOutside(item, m.id); setMsg(r); if (!(s.state.inventory[item] > 0)) setItem(null); }}>Use</button></div>; })}
        <div className="dim">{msg}</div>
      </div>
    </div>
  );
}

function CombosTab() {
  const s = useSession();
  return (
    <div className="skill-list">
      <p className="dim" style={{ margin: '0 0 6px' }}>Sparking Combos: every partner needs 50 Rage and must not have acted this round. Each partner spends 50 Rage and the round’s turn.</p>
      {COMBOS.map((c) => { const known = s.state.combos.includes(c.id); const sk = SKILLS[c.skill]; return (
        <div className={'skill-row' + (known ? '' : ' locked')} key={c.id}><Icon name={`skill:${c.skill}`} /><div className="grow"><b>{known ? c.name : '???'}</b> <span className="dim">{c.members.map((m) => HEROES[m].name).join(' + ')}</span><div className="dim">{known ? sk.desc : c.hint}</div></div><span className="dim">{known ? `${sk.hits.length} hits · PWR ${Math.round(sk.power * 100)}` : 'Locked'}</span></div>); })}
    </div>
  );
}

const BEATS: [string, string][] = [['scouts1', 'First contact with Frieza’s scouts'], ['dende_met', 'Dende rescued, first Dragon Ball'], ['vegeta_joined', 'Vegeta joins the fight'], ['cui_done', 'Cui defeated'], ['dodoria_done', 'Dodoria defeated'], ['ball2', 'Second Dragon Ball'], ['zarbon_done', 'Zarbon defeated'], ['guru_done', 'Guru’s gift of potential'], ['guldo_done', 'Guldo defeated'], ['goku_joined', 'Goku arrives'], ['recoome_done', 'Recoome defeated'], ['duo_done', 'Burter & Jeice defeated'], ['ginyu_done', 'Captain Ginyu stopped'], ['piccolo_joined', 'Nail’s sacrifice: Piccolo fuses'], ['frieza3_done', 'Vegeta falls to Frieza'], ['krillin_dead', 'Krillin’s sacrifice'], ['ssj', 'The Super Saiyan awakens'], ['final_done', 'Frieza defeated']];
const STATUS_LABEL: Record<QuestStatus, string> = { locked: '', available: 'Rumour', active: 'In progress', ready: 'Ready to hand in', done: 'Done' };

function JournalTab() {
  const s = useSession(); const st = s.state; const [section, setSection] = useState<'story' | 'quests' | 'abilities' | 'postgame'>(isPostgame(s.state) ? 'postgame' : 'story');
  const quests = journalQuests(st).filter((x) => x.status !== 'locked');
  const open = quests.filter((x) => x.status === 'active' || x.status === 'ready').length;
  const firstUndone = BEATS.findIndex(([f]) => !st.flags[f]);
  return (
    <div>
      <div className="seg" style={{ marginBottom: 8 }}>
        <button className={'segbtn' + (section === 'story' ? ' on' : '')} onClick={() => setSection('story')}>Story</button>
        <button className={'segbtn' + (section === 'quests' ? ' on' : '')} onClick={() => setSection('quests')}>Side quests{open ? ` (${open})` : ''}</button>
        <button className={'segbtn' + (section === 'abilities' ? ' on' : '')} onClick={() => setSection('abilities')}>Abilities</button>
        {isPostgame(st) && <button className={'segbtn' + (section === 'postgame' ? ' on' : '')} onClick={() => setSection('postgame')}>Postgame</button>}
      </div>
      {section === 'story' && (
        <div className="grid2">
          <div className="win flat" style={{ padding: 12 }}>
            <div className="px" style={{ fontSize: 10, color: '#ffd34a' }}>{chapterName(st.chapter).toUpperCase()}</div>
            <p><b>Main objective</b><br />{objectiveOf(st)}</p>
            <p className="dim">Location: {MAPS[st.mapId].name}<br />Play time {fmtTime(st.playMs)} · Battles won {st.stats.wins}/{st.stats.battles} · Defeats {st.stats.defeats}</p>
            <p>Dragon Balls {ownedBalls(st).length}/7: {BALL_IDS.map((n) => <span key={n} title={`${STAR_NAMES[n - 1]}-Star Dragon Ball${st.flags[`ball${n}`] ? '' : ' (not found)'}`} style={{ color: st.flags[`ball${n}`] ? '#ffb62a' : '#506090' }}>{st.flags[`ball${n}`] ? '★' + n : '·' + n} </span>)}</p>
            {ownedBalls(st).length < 7 && <p className="dim">Missing: {BALL_IDS.filter((n) => !st.flags[`ball${n}`]).map((n) => `${STAR_NAMES[n - 1]}-Star (${ballHint(st, n)})`).join('; ')}.</p>}
            <p className="dim">Collecting all seven is optional (balls 1 and 2 are part of the story) and changes the ending. {st.chapter >= 5 ? 'Once you confront Frieza at the landing zone there is no way back: unfinished side quests and missing Dragon Balls are lost.' : 'You will be asked before the point of no return.'}</p>
          </div>
          <div className="win flat" style={{ padding: 12 }}>
            <div className="px" style={{ fontSize: 9, marginBottom: 6 }}>STORY SO FAR</div>
            {BEATS.map(([f, t], i) => (st.flags[f] ? <div key={f}>✔ {t}</div> : i === firstUndone ? <div key={f} className="dim">· ???</div> : null))}
          </div>
        </div>
      )}
      {section === 'quests' && (
        <div className="skill-list">
          <p className="dim" style={{ margin: '0 0 4px' }}>Optional quests never block the story. They end for good when the confrontation with Frieza begins.</p>
          {quests.length === 0 && <div className="dim">Nothing yet. Talk to people and look around.</div>}
          {quests.map(({ q, status }) => { const prog = questProgress(st, q); return (
            <div key={q.id} className={'skill-row quest' + (status === 'done' ? ' locked' : '')} style={{ alignItems: 'flex-start' }}>
              <div className="grow">
                <b>{q.name}</b> <span className="dim">· {q.place} · {STATUS_LABEL[status]}</span>
                <div className="dim">{q.summary}</div>
                {status !== 'available' && prog.map((p, i) => <div key={i} className={p.done ? '' : 'dim'}>{p.done ? '✔' : '·'} {p.text}</div>)}
                {status === 'available' && <div className="dim">Talk to: {q.giver} ({q.place}).</div>}
                {(status === 'active' || status === 'ready') && <div className="dim">Hand in: {q.turnIn}.</div>}
                <div className="dim">Reward: {rewardText(q.reward)}{status !== 'done' ? ` · ${q.missable}` : ''}</div>
              </div>
            </div>); })}
        </div>
      )}
      {section === 'abilities' && <AbilitiesPanel />}
      {section === 'postgame' && isPostgame(st) && <PostgamePanel />}
    </div>
  );
}

function PostgamePanel() {
  const s = useSession(); const st = s.state; const pg = st.postgame ?? { trainingWins: 0, coolerClears: 0, coolerBestRounds: 0 };
  const trail = coolerTrail(st), warn = coolerWarning(st), targets = trainingTargets(st);
  return (
    <div className="grid2">
      <div className="win flat" style={{ padding: 12 }}>
        <div className="px" style={{ fontSize: 10, color: '#ffd34a' }}>CAPSULE CORP · NAMEK SIMULATION</div>
        <p className="dim">Namek is gone for good; Bulma rebuilt it from your memories so you can train. Defeated patrols return as training dummies. Chests, Dragon Balls and quest rewards pay out only once. Story side quests you did not finish before Frieza stay closed.</p>
        <div className="px" style={{ fontSize: 9, margin: '8px 0 4px' }}>THE COLD SIGNAL {st.flags.cooler_defeated && <span className="role post">CLEARED</span>}</div>
        {trail.map((t, i) => <div key={i} className={t.done ? '' : 'dim'}>{t.done ? '✔' : '·'} {t.text}</div>)}
        {st.flags.cooler_trail_open && !st.flags.cooler_defeated && <div style={{ marginTop: 6, color: warn ? '#ffb09a' : '#8dffa8' }}>{warn ?? `Your party is at Lv ${COOLER_LEVEL}+: ready.`}</div>}
        <div className="px" style={{ fontSize: 9, margin: '10px 0 4px' }}>PORUNGA&apos;S WISHES ({WISH_IDS.filter((w) => isGranted(st, w)).length}/3)</div>
        {WISH_IDS.map((w) => <div key={w} className={isGranted(st, w) ? '' : 'dim'}>{isGranted(st, w) ? '✔' : '·'} <b>{WISHES[w].title}</b>: {isGranted(st, w) ? 'granted' : 'pending'}<div className="dim" style={{ marginLeft: 14 }}>{WISHES[w].short}</div></div>)}
        <div className="dim" style={{ marginTop: 4 }}>{(() => { const c = canSummon(st); return c.ok ? 'All seven Dragon Balls are ready: use the Dragon Ball Shrine in Guru’s Sanctuary.' : c.text; })()}</div>
        <div className="px" style={{ fontSize: 9, margin: '10px 0 4px' }}>RECORDS</div>
        <div>Training victories: <b>{pg.trainingWins}</b></div>
        <div>Cooler cleared: <b>{pg.coolerClears}</b>{pg.coolerBestRounds ? <> · best clear <b>{pg.coolerBestRounds}</b> rounds</> : null}</div>
        <div>Trophy: {st.flags.cooler_defeated ? <b style={{ color: '#ffb62a' }}>★ Cooler Conquered (Frost Core Capsule)</b> : <span className="dim">not earned</span>}</div>
        <div>Ending kept: <b>{st.flags.ball1 && ownedBallsCount(st) === 7 ? 'All seven Dragon Balls' : 'Without the wish'}</b></div>
      </div>
      <div className="win flat" style={{ padding: 12 }}>
        <div className="px" style={{ fontSize: 9, marginBottom: 6 }}>TRAINING TARGETS</div>
        {targets.map((t) => <div key={t.id} style={{ marginBottom: 4 }}><b>{t.name}</b> <span className="dim">Lv {t.level}{t.maxed ? ' (max)' : ''}</span>{t.next ? <div style={{ color: '#9fd0ff' }}>Next skill: {t.next.name} at Lv {t.next.level}</div> : <div className="dim">Every skill learned.</div>}</div>)}
        <p className="dim" style={{ marginTop: 8 }}>Training points (3 per level) are spent in the Training tab. Change what you take into battle in the Loadout tab.</p>
      </div>
    </div>
  );
}
const ownedBallsCount = (st: Parameters<typeof ownedBalls>[0]) => ownedBalls(st).length;

function AbilitiesPanel() {
  const s = useSession(); const st = s.state;
  return (
    <div className="grid2">
      <div className="win flat" style={{ padding: 12 }}>
        <div className="px" style={{ fontSize: 9, marginBottom: 6 }}>SKILLS: LEARNED AND NEXT</div>
        {st.roster.map((m) => { const known = equippedOf(m); const learnedN = learnedSkillsOf(m).length; const next = upcomingSkills(m); return (
          <div key={m.id} style={{ marginBottom: 6 }}>
            <b>{HEROES[m.id].name}</b> <span className="dim">Lv {m.level}</span>
            <div className="dim">Equipped: {known.length ? known.map((k) => SKILLS[k].name).join(', ') : 'none (basic attacks only)'} · learned {learnedN}/{HEROES[m.id].skills.length}</div>
            {next.length > 0 && <div style={{ color: '#9fd0ff' }}>Next: {next[0].name} at Lv {next[0].unlockLevel}</div>}
          </div>); })}
      </div>
      <div className="win flat" style={{ padding: 12 }}>
        <div className="px" style={{ fontSize: 9, marginBottom: 6 }}>SPARKING COMBOS</div>
        {COMBOS.map((c) => { const known = st.combos.includes(c.id); return <div key={c.id} className={known ? '' : 'dim'}>{known ? '✔' : '·'} {known ? c.name : '???'}<span className="dim"> {known ? c.members.map((m) => HEROES[m].name).join(' + ') : c.hint}</span></div>; })}
        <p className="dim" style={{ marginTop: 8 }}>New moves also appear in the level-up box after a battle. Training points (3 per level) are spent in the Training tab.</p>
      </div>
    </div>
  );
}

function MapTab() {
  const s = useSession(); const here = s.state.mapId;
  const nodes: Record<string, [number, number]> = { shore: [70, 120], village: [220, 120], landing: [380, 120], cave: [520, 60], hold: [520, 190], guru: [220, 30], ridge: [220, 210], core: [380, 220] };
  const edges: [string, string][] = [['shore', 'village'], ['village', 'landing'], ['landing', 'cave'], ['landing', 'hold'], ['village', 'guru'], ['village', 'ridge'], ['landing', 'core']];
  const visited = (id: string) => (id === here || (id === 'shore') || (id === 'village' && s.state.flags.scouts1) || (id === 'landing' && s.state.flags.dende_met) || (id === 'cave' && s.state.flags.dodoria_done) || (id === 'hold' && s.state.flags.dodoria_done) || (id === 'guru' && s.state.flags.zarbon_done) || (id === 'ridge' && s.state.flags.guru_done) || (id === 'core' && s.state.flags.ssj));
  return (
    <div className="win flat" style={{ padding: 8 }}>
      <svg viewBox="0 0 600 250" width="100%" height="250" role="img" aria-label="World map">
        {edges.map(([a, b]) => <line key={a + b} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke={visited(a) && visited(b) ? '#cfe3ff' : '#35497f'} strokeWidth="3" strokeDasharray={visited(a) && visited(b) ? '' : '5 4'} />)}
        {Object.entries(nodes).map(([id, [x, y]]) => <g key={id}><circle cx={x} cy={y} r={id === here ? 16 : 11} fill={id === here ? '#ffd34a' : visited(id) ? '#4aa0ff' : '#223566'} stroke="#fff" strokeWidth="2" /><text x={x} y={y + 30} textAnchor="middle" fill={visited(id) ? '#fff' : '#6f84b8'} fontSize="11" fontFamily="Pixelify Sans">{visited(id) ? MAPS[id].name : '???'}</text></g>)}
      </svg>
      <div className="dim" style={{ textAlign: 'center' }}>Gold marker = your position. Dashed paths are not yet open or discovered.</div>
    </div>
  );
}

function SaveTab() {
  const s = useSession(); const [, force] = useState(0); const [msg, setMsg] = useState(''); const fileRef = useRef<HTMLInputElement>(null);
  const slots = allSlots();
  const download = () => { const blob = new Blob([s.exportText()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'namek-saga-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); setMsg('Exported namek-saga-save.json'); };
  return (
    <div>
      <SlotList slots={slots} mode="save" onSave={(n) => { s.saveTo(n); force((x) => x + 1); }} onDelete={(n) => s.confirm(`Delete slot ${n}?`, () => { deleteSlot(n); force((x) => x + 1); s.openMenu('save'); })} />
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn small" onClick={download}>Export to file</button>
        <button className="btn small" onClick={() => fileRef.current?.click()}>Import from file…</button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const err = s.importFile(await f.text()); setMsg(err ? 'Import failed: ' + err : 'Imported.'); }} />
        <button className="btn small" onClick={() => s.confirm('Return to the title screen? Unsaved progress since your last autosave is lost.', () => s.toTitle())}>Quit to title</button>
      </div>
      <div className="dim" style={{ marginTop: 6 }}>{msg} Autosave (slot AUTO) happens when you enter an area and after battles and story scenes.</div>
    </div>
  );
}

function HelpTab() {
  return (
    <div className="help">
      <div className="px" style={{ fontSize: 10, marginBottom: 6 }}>CONTROLS</div>
      <div className="grid2">
        <div className="win flat" style={{ padding: 10 }}><b>Exploration</b><br />WASD / Arrows · move (Shift runs)<br />E / Enter / Space · interact<br />Esc or M · menu · O · toggle objective<br /><b>Back / Cancel everywhere: X · Backspace · Esc · gamepad B</b> (the browser may use Esc to leave full screen, so X and Backspace always work)<br />F · full screen<br />Gamepad: left stick, A, B (run)</div>
        <div className="win flat" style={{ padding: 10 }}><b>Battle</b><br />Arrows / WASD · menu & targets<br />Enter / Z / Space · confirm · X / Backspace / Esc · back<br /><b>Active Guard:</b> press the number key (1/2/3) of the fighter being attacked as the ring closes on them. In Assist mode Space guards everyone.<br />P · pause</div>
      </div>
      <div className="px" style={{ fontSize: 10, margin: '8px 0 4px' }}>RAGE &amp; SPARKING</div>
      <div className="grid2" style={{ fontSize: 13, lineHeight: 1.45 }}>
        <div className="win flat" style={{ padding: 8 }}><b>Rage</b> is per fighter (0 to 100) and shows as <b>+N RAGE</b> over their head. It fills when you <b>hit</b> (bosses give more than soldiers, criticals add a bonus), when you <b>get hit</b> (more when the hit is big or you are low on HP) and with <b>Active Guard</b> (good +7, perfect +16). Defend gives a little Rage the first time only, so spamming it does nothing. A single action never adds more than 60.</div>
        <div className="win flat" style={{ padding: 8 }}>At 100 you may use your <b>Rage Art</b> (one huge hit, spends all 100) or <b>Sparking</b>: <b>spend 100 Rage · 4 turns · +25% ATK · half Ki cost</b>. The bar pulses from 75, shows MAX when ready, and the SPARK chip on the party card counts the turns left. Sparking cannot be used again while it is active. <b>Combos</b> cost 50 Rage from every partner. Gohan fills fastest when hurt, Vegeta when attacking, Krillin on crits, Piccolo on guards.</div>
      </div>
      <p className="dim">Some enemies telegraph heavy attacks (CHARGE). Hit them hard (16% of their max HP in one turn) to interrupt. Guldo, Recoome and Frieza all do this.</p>
      <div className="px" style={{ fontSize: 10, margin: '8px 0 4px' }}>STATUS GUIDE</div>
      <div className="grid2" style={{ fontSize: 13, lineHeight: 1.45 }}>
        <div className="win flat" style={{ padding: 8 }}><b>Stun</b> skips the next action · <b>Blind</b> physical and Ki attacks miss half the time · <b>Seal</b> no Ki skills · <b>Time-stop</b> (Guldo) skips actions and breaks when its caster is hit.</div>
        <div className="win flat" style={{ padding: 8 }}><b>Counter</b> reflects physical hits (use Ki techniques) · <b>Sparking</b> halves Ki costs and raises ATK for a while · <b>Kaioken</b> trades 12% HP for ATK and SPD for 3 turns · <b>Possessed</b> fighters attack their friends.</div>
        <div className="win flat" style={{ padding: 8 }}><b>Defend</b> takes about half damage and restores a little Ki. <b>Active Guard</b>: a perfect press cuts a hit to 15%, a good press to 50%.</div>
        <div className="win flat" style={{ padding: 8 }}><b>Combos</b> need every partner at 50+ Rage and unacted this round; the combo list says exactly why one is blocked. <b>Capsules</b> add stats; two slots per fighter.</div>
      </div>
    </div>
  );
}

export type { PartyMember };
