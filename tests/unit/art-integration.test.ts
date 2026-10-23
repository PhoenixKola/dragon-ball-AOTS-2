import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OVERWORLD, VFX_FAMILIES, SKILL_ICON_IDS, ITEM_ICON_IDS, UI_ASSETS, BEAM_PARTS } from '../../src/data/artManifest.generated';
import { POWERUP_SETS, POWERUP_CANVAS } from '../../src/data/powerupSprites.generated';
import { SKILLS } from '../../src/data/skills';
import { ITEMS, HEROES } from '../../src/data/heroes';
import { gokuForm, formSet, formAnim, powerupFrameNames } from '../../src/engine/animation/gokuForms';
import { heroOverworld, owFrame, dirFromVector, dirToward, overworldTextures, owKey } from '../../src/engine/world/overworld';
import { buildAlly, newMember } from '../../src/systems/party';
import { MAPS } from '../../src/data/maps';
import { validateState, serialize, deserialize } from '../../src/systems/save';
import { newGameState } from '../../src/systems/gameState';

const root = join(__dirname, '..', '..', 'public');
const png = (p: string) => readFileSync(join(root, p));
const dims = (b: Buffer) => [b.readUInt32BE(16), b.readUInt32BE(20)];
type Dir = 'down' | 'up' | 'left' | 'right';

describe('validated art pack is fully wired', () => {
  it('every overworld frame exists, has the manifest canvas size and a real walk cycle', () => {
    for (const [ent, e] of Object.entries(OVERWORLD)) for (const [dir, d] of Object.entries(e.dirs)) {
      expect(d.idle.length, `${ent}/${dir} idle`).toBeGreaterThanOrEqual(1);
      expect(d.walk.length, `${ent}/${dir} walk`).toBeGreaterThanOrEqual(3);
      for (const f of [...d.idle, ...d.walk]) {
        const p = `assets/reviewed/overworld/${ent}/${dir}/${f}`;
        expect(existsSync(join(root, p)), p).toBe(true);
        expect(dims(png(p))).toEqual(e.canvas);
      }
      expect(new Set(d.walk.map((f) => png(`assets/reviewed/overworld/${ent}/${dir}/${f}`).toString('base64'))).size, `${ent}/${dir} distinct walk frames`).toBeGreaterThanOrEqual(2);
    }
  });

  it('the four directions of each entity look different (no mirrored placeholder)', () => {
    for (const [ent, e] of Object.entries(OVERWORLD)) {
      const idle = (d: Dir) => png(`assets/reviewed/overworld/${ent}/${d}/${e.dirs[d].idle[0]}`).toString('base64');
      expect(new Set([idle('down'), idle('up'), idle('left'), idle('right')]).size, ent).toBe(4);
    }
  });

  it('every skill has a validated icon and every item has an icon', () => {
    for (const id of Object.keys(SKILLS)) expect(SKILL_ICON_IDS, 'icon for skill ' + id).toContain(id);
    for (const id of Object.keys(ITEMS)) expect(ITEM_ICON_IDS, 'icon for item ' + id).toContain(id);
    for (const id of SKILL_ICON_IDS) expect(dims(png(`assets/reviewed/icons/skills/${id}.png`))).toEqual([32, 32]);
    for (const id of ITEM_ICON_IDS) expect(dims(png(`assets/reviewed/icons/items/${id}.png`))).toEqual([32, 32]);
  });

  it('VFX families have all their frames at 96x64 and beams have a tileable body', () => {
    for (const [fam, v] of Object.entries(VFX_FAMILIES)) for (let i = 0; i < v.frames; i++) expect(dims(png(`assets/reviewed/vfx/${fam}/${String(i).padStart(3, '0')}.png`)), `${fam}/${i}`).toEqual([96, 64]);
    for (const [fam, frames] of Object.entries(BEAM_PARTS)) for (const f of [3, 4, 5]) expect(frames[f].body[1] - frames[f].body[0], `${fam} body tileable`).toBeGreaterThanOrEqual(8);
  });

  it('UI panels are present with 9-slice insets and the menu cursor exists', () => {
    for (const k of ['panel', 'panel_focused', 'panel_warning']) {
      expect(UI_ASSETS[k].insets).toEqual([7, 7, 7, 7]);
      expect(existsSync(join(root, 'assets/reviewed/ui/' + UI_ASSETS[k].file))).toBe(true);
    }
    expect(existsSync(join(root, 'assets/reviewed/ui/cursor.png'))).toBe(true);
  });
});

describe('overworld mapping and facing', () => {
  it('each hero maps to its own approved set; provisional sets are labelled and can be turned off', () => {
    expect(heroOverworld('krillin', {}, false)).toEqual({ entity: 'krillin', provisional: false });
    expect(heroOverworld('vegeta', {}, false)).toEqual({ entity: 'vegeta', provisional: false });
    expect(heroOverworld('goku', {}, false)).toEqual({ entity: 'goku_base', provisional: false });
    expect(heroOverworld('piccolo', {}, false)).toEqual({ entity: 'piccolo', provisional: false });
    expect(heroOverworld('piccolo', { fused: true }, false)).toEqual({ entity: 'piccolo_fused', provisional: false });
    // v4: Gohan's Namek costume and the SSJ set are real art now (no recolours), so they are approved and need no provisional toggle
    for (const allow of [true, false]) {
      expect(heroOverworld('gohan', {}, allow)).toEqual({ entity: 'gohan_namek', provisional: false });
      expect(heroOverworld('goku', { ssj: true }, allow)).toEqual({ entity: 'goku_ssj_test', provisional: false });
    }
    expect(heroOverworld('dende', {}, true)).toBeNull();
  });

  it('base Goku never uses the SSJ overworld set before the unlock', () => {
    for (const allow of [true, false]) expect(heroOverworld('goku', { ssj: false }, allow)?.entity).toBe('goku_base');
  });

  it('facing follows the input vector and diagonals do not flicker', () => {
    expect(dirFromVector(1, 0, 'down')).toBe('right');
    expect(dirFromVector(-1, 0, 'down')).toBe('left');
    expect(dirFromVector(0, -1, 'down')).toBe('up');
    expect(dirFromVector(0, 1, 'up')).toBe('down');
    expect(dirFromVector(0.7, 0.7, 'left')).toBe('left');
    expect(dirFromVector(0, 0, 'up')).toBe('up');
    expect(dirToward(5, 0)).toBe('right');
    expect(dirToward(0, -9)).toBe('up');
  });

  it('idle uses the idle frame; walking cycles at least three distinct frames (the sheets supply 3-4 poses)', () => {
    expect(owFrame('krillin', 'left', false, 999).key).toBe(owKey('krillin', 'left', 'idle_000.png'));
    const seen = new Set([0, 130, 260, 390].map((t) => owFrame('krillin', 'left', true, t).key));
    expect(seen.size).toBeGreaterThanOrEqual(3);
    expect(owFrame('krillin', 'left', true, 520).walkIndex).toBe(0);
  });

  it('every overworld texture key is unique and Bulma stands on the Shore', () => {
    const keys = overworldTextures().map(([k]) => k);
    expect(new Set(keys).size).toBe(keys.length);
    expect(MAPS.shore.ents.find((e) => e.ow === 'bulma')).toBeDefined();
  });
});

describe('Goku form state machine (base / Kaioken / Super Saiyan never overwrite each other)', () => {
  const goku = (o: { ssj?: boolean; kaioken?: boolean } = {}) => {
    const m = newMember('goku', 12); if (o.ssj) m.ssj = true;
    const f = buildAlly(m, 0); if (o.kaioken) f.statuses.push({ kind: 'kaioken', turns: 3 });
    return f;
  };

  it('base Goku is the black-haired base form before the story unlock, whatever the battle state', () => {
    expect(gokuForm(goku())).toBe('base');
    expect(formSet('base')).toBeNull();   // base Goku is the goku_<pose>.png stills, not a frame set
    expect(gokuForm(goku(), 'kamehameha')).toBe('base');
    expect(gokuForm(goku(), 'spiritbomb')).toBe('base');
    expect(newGameState().roster.every((m) => !m.ssj)).toBe(true);
  });

  it('Kaioken only appears for the Kaioken status or Kaioken skills', () => {
    expect(gokuForm(goku({ kaioken: true }))).toBe('kaioken');
    expect(gokuForm(goku(), 'kaioken')).toBe('kaioken');
    expect(gokuForm(goku(), 'kaiokenassault')).toBe('kaioken');
    expect(formSet('kaioken')).toBe('goku_kaioken');
  });

  it('Super Saiyan only after the unlock flag, and the SSJ skill set belongs to it alone', () => {
    expect(gokuForm(goku({ ssj: true }))).toBe('ssj');
    expect(formSet('ssj')).toBe('goku_ssj');
    expect(gokuForm(goku({ ssj: true, kaioken: true }))).toBe('ssj');
    expect(goku().skills).not.toContain('ssjkame');
    expect(goku({ ssj: true }).skills).toContain('ssjkame');
  });

  it('only Goku has forms', () => {
    for (const id of Object.keys(HEROES).filter((h) => h !== 'goku')) {
      const f = buildAlly(newMember(id as never, 10), 0); f.statuses.push({ kind: 'kaioken', turns: 3 });
      expect(gokuForm(f, 'kaioken')).toBe('base');
    }
  });

  it('each set provides every state the battle needs, and every frame file exists at the shared canvas size', () => {
    for (const [sid, s] of Object.entries(POWERUP_SETS)) {
      for (const need of ['idle', 'powerup', 'attack', 'beam', 'guard', 'hurt', 'victory']) expect(s.anims[need]?.length, `${sid}.${need}`).toBeGreaterThanOrEqual(1);
      expect(s.anims.idle.length, `${sid} idle loop`).toBe(4);
      expect(s.anims.attack.length).toBe(6);
      expect(s.refH).toBeGreaterThan(100);
    }
    for (const n of powerupFrameNames()) {
      const p = `assets/reviewed/actors/${n}.png`;
      expect(existsSync(join(root, p)), p).toBe(true);
      expect(dims(png(p))).toEqual([POWERUP_CANVAS.w, POWERUP_CANVAS.h]);
    }
  });

  it('pose to frame mapping: idle loops, a flurry walks different strikes, hurt escalates', () => {
    expect(formAnim('goku_kaioken', 'idle').loop).toBe(true);
    const strikes = [0, 1, 2, 3].map((i) => formAnim('goku_ssj', 'attack', { attackIdx: i }).frames[0]);
    expect(new Set(strikes).size).toBeGreaterThanOrEqual(3);
    expect(formAnim('goku_kaioken', 'hurt', { holdMs: 200 }).frames[0]).not.toBe(formAnim('goku_kaioken', 'hurt', { holdMs: 420 }).frames[0]);
    expect(formAnim('goku_ssj', 'ko').frames[0]).toBe('goku_ssj_ko_01'); expect(formAnim('goku_kaioken', 'ko').frames[0]).toBe('goku_kaioken_ko_01');
    expect(formAnim('goku_kaioken', 'special').frames[0]).toContain('beam_03');
  });

  it('power-up frames are uniquely named and never reuse base-Goku files', () => {
    for (const n of powerupFrameNames()) expect(n).toMatch(/^goku_(kaioken|ssj)_/);
    expect(new Set(powerupFrameNames()).size).toBe(powerupFrameNames().length);
  });

  it('no crossover: every form set only references its own prefix, and no Goku frame file is orphaned', () => {
    const prefix = { goku_kaioken: 'goku_kaioken_', goku_ssj: 'goku_ssj_' } as const;
    for (const [sid, s] of Object.entries(POWERUP_SETS)) for (const list of Object.values(s.anims)) for (const n of list) expect(n.startsWith(prefix[sid as keyof typeof prefix]), `${sid} -> ${n}`).toBe(true);
    const live = new Set(powerupFrameNames());
    const onDisk = readdirSync(join(root, 'assets/reviewed/actors')).filter((f) => /^goku_(base|kaioken|ssj)_.*\.png$/.test(f)).map((f) => f.slice(0, -4));
    expect(onDisk.filter((n) => !live.has(n)), 'Goku form frames on disk that no animation table uses').toEqual([]);
  });

  it('Kaioken idle skips the wrong-costume source frame and loops as a clean ping-pong', () => {
    const k = POWERUP_SETS.goku_kaioken;
    expect(k.anims.idle).toEqual(['goku_kaioken_idle_01', 'goku_kaioken_idle_02', 'goku_kaioken_idle_03', 'goku_kaioken_idle_02']);
    expect(existsSync(join(root, 'assets/reviewed/actors/goku_kaioken_idle_04.png'))).toBe(false);
    const f = formAnim('goku_kaioken', 'idle'); expect(f.loop).toBe(true); expect(f.frames).toEqual(k.anims.idle);
  });
});

describe('saves stay valid with the new party/form data', () => {
  it('a state with a Super Saiyan Goku round-trips through strict validation', () => {
    const s = newGameState(); const g = newMember('goku', 20); g.ssj = true; s.roster.push(g); s.party = ['gohan', 'goku'];
    const r = deserialize(serialize(s));
    expect(r.ok).toBe(true);
    expect(validateState(JSON.parse(JSON.stringify(s))).ok).toBe(true);
    if (r.ok) expect(r.state.roster.find((m) => m.id === 'goku')?.ssj).toBe(true);
  });
});

import { nativeFacing, shouldFlip, wantedFacing, POSE_FACING_TABLE } from '../../src/data/poseFacing';
import { SPRITE_BOXES } from '../../src/data/spriteManifest.generated';
import { ENEMIES } from '../../src/data/enemies';

describe('facing: allies face right, enemies face left, whatever way the pose was drawn', () => {
  const effective = (sprite: string, pose: string, side: 'ally' | 'enemy') => {
    const n = nativeFacing(sprite, pose);
    if (n === 'F') return 'F';
    const flip = shouldFlip(n, side);
    return flip ? (n === 'L' ? 'R' : 'L') : n;
  };
  it('every annotated pose exists in the sprite manifest', () => {
    for (const [sprite, poses] of Object.entries(POSE_FACING_TABLE)) for (const pose of Object.keys(poses)) expect(SPRITE_BOXES[sprite]?.[pose], `${sprite}:${pose}`).toBeDefined();
  });
  it('after the rule, every directional pose of every hero faces right and of every enemy faces left', () => {
    for (const [sprite, poses] of Object.entries(POSE_FACING_TABLE)) for (const pose of Object.keys(poses)) {
      const isEnemy = Object.values(ENEMIES).some((e) => e.sprite === sprite);
      const side = isEnemy ? 'enemy' : 'ally';
      expect(effective(sprite, pose, side), `${sprite}:${pose} as ${side}`).toBe(wantedFacing(side));
    }
  });
  it('every battle sprite is drawn facing right: allies are never mirrored, enemies always are (v4 art)', () => {
    for (const sprite of Object.keys(SPRITE_BOXES)) for (const pose of Object.keys(SPRITE_BOXES[sprite])) {
      expect(nativeFacing(sprite, pose), `${sprite}:${pose}`).toBe('R');
      expect(shouldFlip('R', 'ally')).toBe(false); expect(shouldFlip('R', 'enemy')).toBe(true);
    }
  });
});
