import { test, expect } from '@playwright/test';

test('core-party punches advance through authored drawings in the real battle renderer', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const actor of ['goku', 'gohan', 'krillin', 'vegeta', 'piccolo', 'nail', 'trunks', 'trunks_ssj']) {
    const combatId = actor === 'trunks_ssj' ? 'trunks' : actor;
    const party = [combatId, ...['goku', 'gohan', 'vegeta'].filter((id) => id !== combatId)].slice(0, 3);
    await page.goto(`/?dev=battle&party=${party.join(',')}&foes=zarbon&first=${combatId}&lv=15`);
    await page.waitForFunction(() => (window as any).__battle && (window as any).__ctl, null, { timeout: 60000 });
    const initial = await page.evaluate(({ id, superSaiyan }) => {
      const b = (window as any).__battle;
      if (superSaiyan) {
        const c = (window as any).__ctl;
        const fighter = c.engine.allies().find((f: any) => f.defId === 'trunks');
        c.engine.addStatus(fighter, { kind: 'ssjform', turns: 99, power: 0.3 });
      }
      b.manual = true;
      b.debugStep(1800);
      return b.debugActor(`a_${id}`);
    }, { id: combatId, superSaiyan: actor === 'trunks_ssj' });
    expect(initial.texture).toMatch(new RegExp(`^pw_${actor}_idle_frame_0[1-4]$`));
    await page.evaluate(() => {
      const c = (window as any).__ctl;
      c.director.submit({ kind: 'attack', target: c.engine.enemies()[0].uid });
    });
    const startHp = await page.evaluate(() => (window as any).__ctl.engine.enemies()[0].hp as number);
    const seen = new Set<string>();
    let captured = false;
    let firstDamageFrame = '';
    for (let i = 0; i < 48; i++) {
      const { key, hp } = await page.evaluate((id) => {
        const b = (window as any).__battle; b.debugStep(16);
        return { key: b.debugActor(`a_${id}`).texture as string, hp: (window as any).__ctl.engine.enemies()[0].hp as number };
      }, combatId);
      if (key.startsWith(`pw_${actor}_attack_frame_`)) seen.add(key);
      if (!firstDamageFrame && hp < startHp) firstDamageFrame = key;
      if (!captured && key.endsWith('_03')) {
        await page.screenshot({ path: `evidence/overhaul/${actor}-punch-contact-960x540.png` });
        captured = true;
      }
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4].map((n) => `pw_${actor}_attack_frame_${String(n).padStart(2, '0')}`));
    if (firstDamageFrame) expect(firstDamageFrame).toMatch(new RegExp(`^pw_${actor}_attack_frame_0[34]$`));
  }
  expect(errors).toEqual([]);
});

test('Namek and postgame enemies advance through registered strikes in the real renderer', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const enemies = [
    ...['cui', 'dodoria', 'zarbon', 'zarbon2', 'guldo', 'recoome', 'burter', 'jeice', 'ginyu', 'frieza1', 'frieza2', 'frieza3', 'frieza4', 'frieza5', 'cooler'].map((id) => ({ id, sprite: id })),
    { id: 'scout', sprite: 'soldier' },
  ];
  for (const { id: actor, sprite } of enemies) {
    await page.goto(`/?dev=battle&party=goku,gohan,piccolo&foes=${actor}&lv=20`);
    await page.waitForFunction(() => (window as any).__battle && (window as any).__ctl, null, { timeout: 60000 });
    const rendered = await page.evaluate(() => {
      const b = (window as any).__battle;
      const c = (window as any).__ctl;
      const uid = c.engine.enemies()[0].uid;
      b.manual = true;
      const view = b.views.get(uid);
      view.setPose('attack');
      const seen = new Set<string>();
      for (let i = 0; i < 12; i++) {
        view.update(16);
        seen.add(b.debugActor(uid).texture);
      }
      return { frames: [...seen], actor: b.debugActor(uid), uid };
    });
    expect(rendered.frames).toEqual([1, 2, 3, 4].map((n) => `pw_${sprite}_attack_frame_${String(n).padStart(2, '0')}`));
    expect(rendered.actor.flipX).toBe(true);
    await page.evaluate((uid) => {
      const b = (window as any).__battle;
      const view = b.views.get(uid);
      view.setPose('attack');
      view.update(64); // capture the authored contact drawing at the 60 ms hit marker
    }, rendered.uid);
    await page.screenshot({ path: `evidence/overhaul/${actor}-strike-contact-phaser-960x540.png` });
  }
  expect(errors).toEqual([]);
});

test('core-party idle breathing loops are genuine and seamless in the battle renderer', async ({ page }) => {
  for (const actor of ['goku', 'gohan', 'krillin', 'vegeta', 'piccolo', 'trunks', 'trunks_ssj', 'cui', 'dodoria', 'zarbon', 'zarbon2', 'guldo', 'recoome', 'burter', 'jeice', 'ginyu', 'nail', 'soldier', 'frieza1', 'frieza2', 'frieza3', 'frieza4', 'frieza5', 'cooler']) {
    const isTrunks = actor === 'trunks' || actor === 'trunks_ssj';
    const isEnemy = ['cui', 'dodoria', 'zarbon', 'zarbon2', 'guldo', 'recoome', 'burter', 'jeice', 'ginyu', 'soldier', 'frieza1', 'frieza2', 'frieza3', 'frieza4', 'frieza5', 'cooler'].includes(actor);
    const combatId = isTrunks ? 'trunks' : actor;
    const party = isEnemy ? ['goku', 'gohan', 'piccolo'] : [combatId, ...['goku', 'gohan', 'vegeta'].filter((id) => id !== combatId)].slice(0, 3);
    const foeId = actor === 'soldier' ? 'scout' : actor;
    await page.goto(`/?dev=battle&party=${party.join(',')}&foes=${isEnemy ? foeId : 'zarbon'}&lv=15`);
    await page.waitForFunction(() => (window as any).__battle && (window as any).__ctl, null, { timeout: 60000 });
    const frames = await page.evaluate(({ id, actor, superSaiyan, isEnemy }) => {
      const b = (window as any).__battle;
      const uid = isEnemy ? (window as any).__ctl.engine.enemies()[0].uid : `a_${id}`;
      if (superSaiyan) {
        const c = (window as any).__ctl;
        const fighter = c.engine.allies().find((f: any) => f.defId === 'trunks');
        c.engine.addStatus(fighter, { kind: 'ssjform', turns: 99, power: 0.3 });
        b.debugStep(32);
      }
      b.manual = true;
      const view = b.views.get(uid);
      view.setPose('idle');
      const seen: string[] = [];
      for (let i = 0; i < 8; i++) { view.update(200); seen.push(b.debugActor(uid).texture); }
      return { seen, sprite: view.sprite, loadedFrame: b.textures.exists(`pw_${actor}_idle_frame_01`), allIdle: b.textures.getTextureKeys().filter((key: string) => key.includes('_idle_frame_')) };
    }, { id: combatId, actor, superSaiyan: actor === 'trunks_ssj', isEnemy });
    expect(new Set(frames.seen).size, `${actor} idle frames: ${frames.seen.join(', ')}; sprite=${frames.sprite}; loaded=${frames.loadedFrame}; textures=${frames.allIdle.join(',')}`).toBe(4);
    expect(frames.seen[0]).toBe(frames.seen[4]);
    for (let i = 1; i < 5; i++) expect(frames.seen[i]).toMatch(new RegExp(`^pw_${actor}_idle_frame_0[1-4]$`));
    if (actor === 'goku') await page.screenshot({ path: 'evidence/overhaul/goku-idle-loop-phaser-960x540.png' });
  }
});

test('core-party charge loops and signature-release poses advance in Phaser', async ({ page }) => {
  for (const actor of ['goku', 'gohan', 'krillin', 'vegeta', 'piccolo']) {
    const party = [actor, ...['goku', 'gohan', 'vegeta'].filter((id) => id !== actor)].slice(0, 3);
    await page.goto(`/?dev=battle&party=${party.join(',')}&foes=zarbon&lv=15`);
    await page.waitForFunction(() => (window as any).__battle && (window as any).__ctl, null, { timeout: 60000 });
    for (const pose of ['charge', 'special'] as const) {
      const seen = await page.evaluate(({ id, pose }) => {
        const b = (window as any).__battle;
        b.manual = true;
        const view = b.views.get(`a_${id}`);
        view.setPose(pose);
        const frames: string[] = [b.debugActor(`a_${id}`).texture];
        const step = pose === 'charge' ? 125 : 25;
        for (let i = 0; i < 8; i++) { view.update(step); frames.push(b.debugActor(`a_${id}`).texture); }
        return frames;
      }, { id: actor, pose });
      const expected = [1, 2, 3, 4].map((n) => `pw_${actor}_${pose}_frame_${String(n).padStart(2, '0')}`);
      expect(new Set(seen.filter((key) => key.startsWith(`pw_${actor}_${pose}_frame_`))).size, `${actor} ${pose}`).toBe(4);
      for (const key of expected) expect(seen).toContain(key);
      if (pose === 'charge') expect(seen[0]).toBe(seen[4]);
      if (actor === 'goku' && pose === 'special') await page.screenshot({ path: 'evidence/overhaul/goku-special-release-phaser-960x540.png' });
    }
  }
});

test('Goku base, Kaioken and SSJ use complete anchored guard and reaction sequences', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?dev=battle&party=goku,gohan,vegeta&foes=zarbon&lv=22&ssj=1');
  await page.waitForFunction(() => (window as any).__battle && (window as any).__ctl, null, { timeout: 60000 });
  const ssj = await page.evaluate(() => {
    const b = (window as any).__battle, c = (window as any).__ctl;
    b.manual = true; c.engine.get('a_goku').ssj = true; b.debugStep(32);
    const v = b.views.get('a_goku');
    const ssjFormAtStart = b.debugActor('a_goku').form;
    const stateAtStart = { formSet: v.formSet, sprite: v.sprite, pose: v.pose, downed: v.downed, hold: v.poseHold };
    const sequence = (pose: string, hold: number, step: number) => {
      v.downed = false; v.poseHold = 0; v.setPose('idle');
      v.setPose(pose, hold);
      const keys: string[] = [v.img.texture.key];
      for (let i = 0; i < 5; i++) { v.update(step); keys.push(v.img.texture.key); }
      return keys;
    };
    const guard = sequence('guard', 380, 56);
    const ssjGuardFrames = [...v.animFrames];
    const hurt = sequence('hurt', 420, 65);
    const ssjHurtFrames = [...v.animFrames];
    const actor = c.engine.get('a_goku'); actor.ssj = false;
    c.engine.addStatus(actor, { kind: 'kaioken', turns: 5, power: 0.3 }); b.debugStep(160);
    const liveIdle: string[] = [];
    const liveAura: string[] = [];
    for (let i = 0; i < 8; i++) {
      b.debugStep(220);
      liveIdle.push(v.img.texture.key);
      liveAura.push(v.kaiokenFlame?.texture.key);
    }
    const charge = sequence('charge', 0, 125);
    const idle = sequence('idle', 0, 200);
    const auraFrames = [...liveAura, v.kaiokenFlame?.texture.key];
    for (let i = 0; i < 5; i++) { v.update(100); auraFrames.push(v.kaiokenFlame?.texture.key); }
    return { ssjFormAtStart, stateAtStart, form: b.debugActor('a_goku').form, guard, hurt, charge, idle, liveIdle, aura: !!v.kaiokenFlame, auraFrames, ssjGuardFrames, ssjHurtFrames };
  });
  expect(ssj.guard.filter((key: string) => key.startsWith('pw_goku_ssj_guard_frame_')).length, JSON.stringify(ssj)).toBeGreaterThanOrEqual(4);
  expect(ssj.hurt.filter((key: string) => key.startsWith('pw_goku_ssj_hurt_frame_')).length).toBeGreaterThanOrEqual(4);
  expect(ssj.form).toBe('goku_kaioken');
  expect(ssj.charge.filter((key: string) => key.startsWith('pw_goku_kaioken_charge_frame_')).length).toBeGreaterThanOrEqual(4);
  expect(new Set(ssj.idle.filter((key: string) => key.startsWith('pw_goku_kaioken_idle_frame_'))).size).toBe(4);
  expect(new Set(ssj.liveIdle.filter((key: string) => key.startsWith('pw_goku_kaioken_idle_frame_'))).size).toBeGreaterThanOrEqual(3);
  expect(ssj.aura).toBe(true);
  expect(new Set(ssj.auraFrames.filter((key: string) => key?.startsWith('pw_goku_kaioken_aura_frame_'))).size).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: 'evidence/overhaul/goku-kaioken-battle-frames-960x540.png' });
  expect(errors).toEqual([]);
});
