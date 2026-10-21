import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { MAPS } from '../../src/data/maps';
import { OVERWORLD } from '../../src/data/artManifest.generated';
import { heroOverworld } from '../../src/engine/world/overworld';
import { condMet } from '../../src/systems/gameState';

const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const frame = (ent: string, dir: string, f: string) => `public/assets/reviewed/overworld/${ent}/${dir}/${f}`;

describe('Beta 3 world: SSJ Trunks is battle-only on the map', () => {
  it('the field uses the base Trunks set whether or not the Super Saiyan status is active (SSJ is a battle status, never persisted)', () => {
    expect(heroOverworld('trunks', {}, false)?.entity).toBe('trunks');
    expect(heroOverworld('trunks', { ssj: true }, false)?.entity).toBe('trunks');
    expect(OVERWORLD.trunks_ssj).toBeUndefined();
  });
});

describe('Beta 3 world: Cooler field sprite', () => {
  const c = OVERWORLD.cooler;
  it('has four real directions: left and right are different drawings, never a flip, and front/back differ too', () => {
    expect(c.approved).toBe(true);
    const idle = (d: string) => sha(frame('cooler', d, (c.dirs as Record<string, { idle: string[] }>)[d].idle[0]));
    const set = new Set(['down', 'up', 'left', 'right'].map(idle));
    expect(set.size).toBe(4);
  });
  it('every manifest frame exists on disk', () => {
    for (const [d, v] of Object.entries(c.dirs)) for (const f of new Set([...v.idle, ...v.walk])) expect(() => readFileSync(frame('cooler', d, f))).not.toThrow();
  });
  it('is only an arena presence: a non-solid, non-interactive prop that disappears once Cooler is defeated', () => {
    const m = MAPS.cooler_ruins;
    const e = m.ents.find((x) => x.id === 'cooler_presence')!;
    expect(e.kind).toBe('prop');
    expect(e.solid).toBeUndefined(); expect(e.script).toBeUndefined(); expect(e.chest).toBeUndefined(); expect(e.foe).toBeUndefined();
    const s = { flags: {}, inventory: {} } as never;
    expect(condMet(s, e.when)).toBe(true);
    expect(condMet({ flags: { cooler_defeated: true }, inventory: {} } as never, e.when)).toBe(false);
    const arena = m.ents.find((x) => x.id === 'cooler_arena')!;
    expect(e.x).toBeGreaterThan(arena.x + (arena.w ?? 0));   // stands beyond the trigger, so walking in still starts the scripted fight
    expect(m.ents.filter((x) => x.ow === 'cooler').length).toBe(1);
  });
});

describe('Beta 3 world: Frozen Ruins rendering change did not touch geometry', () => {
  it('ground grid (collision) and encounter zones are unchanged', () => {
    const m = MAPS.cooler_ruins;
    expect(m.w).toBe(46); expect(m.h).toBe(28);
    const h = createHash('sha256').update(m.ground.join('\n')).digest('hex');
    expect(h).toBe(GROUND_HASH);
    expect(m.encounters!.zones).toEqual([[10, 8, 34, 24]]);
  });
});
const GROUND_HASH = '3d41134e4ba7a75e6eb6227bb481aac82a744efdc4db7cbb59fee723b8f817db';
