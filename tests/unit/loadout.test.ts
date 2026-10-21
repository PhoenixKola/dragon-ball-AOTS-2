import { describe, it, expect } from 'vitest';
import { HEROES } from '../../src/data/heroes';
import { SKILLS } from '../../src/data/skills';
import { SKILL_ICON_IDS } from '../../src/data/artManifest.generated';
import { newMember, skillsOf, learnedSkillsOf, equippedOf, equipSkill, unequipSkill, defaultEquipped, buildAlly, grantXp, MAX_EQUIPPED } from '../../src/systems/party';
import { newGameState } from '../../src/systems/gameState';
import { validateState, serialize, deserialize } from '../../src/systems/save';
import type { HeroId } from '../../src/types';

const MAIN: HeroId[] = ['gohan', 'krillin', 'vegeta', 'goku', 'piccolo'];

describe('learnable library', () => {
  it('every main hero learns at least 9 specials in total, guests have 5, and every skill has an icon and a unique id', () => {
    for (const id of MAIN) expect(HEROES[id].skills.length, id).toBeGreaterThanOrEqual(9);
    expect(HEROES.dende.skills.length).toBeGreaterThanOrEqual(5); expect(HEROES.nail.skills.length).toBeGreaterThanOrEqual(5);
    for (const h of Object.values(HEROES)) {
      expect(new Set(h.skills).size, h.id).toBe(h.skills.length);
      for (const sk of h.skills) { expect(SKILLS[sk], sk).toBeDefined(); expect(SKILL_ICON_IDS, 'icon ' + sk).toContain(sk); }
    }
  });
  it('the library is varied: at least three roles per main hero, unique names, and damage + heal + buff + status skills all exist', () => {
    for (const id of MAIN) {
      const roles = new Set(HEROES[id].skills.map((s) => SKILLS[s].role ?? 'Special'));
      expect(roles.size, id).toBeGreaterThanOrEqual(3);
      const names = HEROES[id].skills.map((s) => SKILLS[s].name); expect(new Set(names).size).toBe(names.length);
    }
    const kinds = new Set(MAIN.flatMap((id) => HEROES[id].skills.map((s) => SKILLS[s].kind))); expect(kinds).toEqual(new Set(['damage', 'heal', 'status', 'buff']));
  });
  it('skills are spread across levels: nothing floods in early', () => {
    for (const id of MAIN) { const early = HEROES[id].skills.filter((s) => SKILLS[s].unlockLevel <= 3).length; expect(early, id).toBeLessThanOrEqual(4); }
  });
});

describe('four-slot loadout', () => {
  it('the default loadout is at most four, signature moves first, all learned', () => {
    for (const id of MAIN) {
      const m = newMember(id, 30); const eq = defaultEquipped(m);
      expect(eq.length).toBeLessThanOrEqual(MAX_EQUIPPED);
      expect(eq.slice(0, HEROES[id].signature)).toEqual(HEROES[id].skills.slice(0, HEROES[id].signature));
      for (const s of eq) expect(learnedSkillsOf(m)).toContain(s);
    }
  });
  it('equip, swap, unequip: never more than four, no duplicates, only learned skills', () => {
    const m = newMember('goku', 30);
    expect(equipSkill(m, 'maxsbc')).toMatch(/learned/);
    expect(equipSkill(m, 'kamehameha')).toBe('Already equipped.');
    expect(equipSkill(m, 'meteorcombo')).toMatch(/full/);
    expect(equipSkill(m, 'meteorcombo', 3)).toBeNull();
    const eq = equippedOf(m); expect(eq).toHaveLength(4); expect(eq[3]).toBe('meteorcombo'); expect(new Set(eq).size).toBe(4);
    unequipSkill(m, 'meteorcombo'); expect(equippedOf(m)).toHaveLength(3);
    expect(equipSkill(m, 'kitransfer')).toBeNull(); expect(equippedOf(m)).toContain('kitransfer');
  });
  it('a battle fighter only offers the equipped specials plus the Rage Art; unequipped skills are absent', () => {
    const m = newMember('vegeta', 20); unequipSkill(m, 'galick'); const a = buildAlly(m, 0);
    expect(a.skills).not.toContain('galick'); expect(a.skills.filter((s) => !SKILLS[s].rageArt).length).toBeLessThanOrEqual(MAX_EQUIPPED);
    expect(a.skills.some((s) => SKILLS[s].rageArt)).toBe(true);
  });
  it('Super Saiyan: form skills appear automatically, base-only specials are hidden but stay equipped, and the preferred loadout is restored afterwards', () => {
    const g = newMember('goku', 30); equipSkill(g, 'kaiokenkame', 3); expect(equippedOf(g)).toContain('kaiokenkame');
    g.ssj = true; const ss = skillsOf(g);
    expect(ss).toEqual(expect.arrayContaining(['ssjkame', 'ssjassault']));
    expect(ss).not.toContain('kaiokenkame'); expect(ss).not.toContain('kamehameha'); expect(ss).not.toContain('kaiokenassault');
    expect(ss).toContain('kaioken'); expect(equippedOf(g)).toContain('kaiokenkame');
    g.ssj = false; expect(skillsOf(g)).toContain('kaiokenkame');
  });
  it('a chosen loadout survives level-ups; an untouched default is not frozen', () => {
    const m = newMember('gohan', 12);
    expect(equipSkill(m, 'stunstrike', 3)).toBeNull(); const chosen = [...equippedOf(m)];
    grantXp(m, 1e6); expect(equippedOf(m)).toEqual(chosen);
    const d = newMember('gohan', 12); expect(d.equipped).toBeUndefined(); grantXp(d, 1e6); expect(d.equipped).toBeUndefined(); expect(equippedOf(d)).toHaveLength(4);
  });
  it('Piccolo fused and guests keep a valid per-hero loadout', () => {
    const p = newMember('piccolo', 15); p.fused = true; expect(skillsOf(p).length).toBeLessThanOrEqual(MAX_EQUIPPED);
    const n = newMember('nail', 10); expect(skillsOf(n)).toContain('nailbeam');
  });
});

describe('loadout in saves', () => {
  const withEquipped = (eq: unknown) => { const s = newGameState(); s.roster[0].level = 12; (s.roster[0] as unknown as { equipped: unknown }).equipped = eq; return JSON.parse(JSON.stringify(s)); };
  it('an old save without a loadout still loads and gets the default loadout', () => {
    const raw = JSON.parse(JSON.stringify(newGameState())); for (const r of raw.roster) delete r.equipped;
    const p = validateState(raw); expect(p.ok).toBe(true);
    if (p.ok) { expect(p.state.roster[0].equipped).toBeUndefined(); expect(equippedOf(p.state.roster[0]).length).toBeGreaterThan(0); }
  });
  it('a chosen loadout round-trips through serialize/deserialize', () => {
    const s = newGameState(); s.roster[0].level = 12; equipSkill(s.roster[0], 'wildfury', 3); const eq = equippedOf(s.roster[0]);
    const p = deserialize(serialize(s)); expect(p.ok).toBe(true); if (p.ok) expect(equippedOf(p.state.roster[0])).toEqual(eq);
  });
  it('tampered loadouts are rejected: unknown ids, other heroes skills, unlearned skills, duplicates, too many, wrong types, prototype keys', () => {
    for (const bad of [['nope'], ['maxsbc'], ['maxpotential'], ['masenko', 'masenko'], ['masenko', 'dragonkick', 'wildfury', 'potentialguard', 'stunstrike'], 'masenko', [1], ['__proto__']]) {
      expect(validateState(withEquipped(bad)).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(validateState(withEquipped(['masenko', 'dragonkick'])).ok).toBe(true);
  });
});
