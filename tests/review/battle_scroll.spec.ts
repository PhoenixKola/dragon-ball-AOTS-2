import { test, expect } from '@playwright/test';
type C = { __ctl: any };
test('battle skills list: hover and keys do not run away; Piccolo scale', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?dev=battle&party=piccolo,goku,gohan&foes=frieza2&lv=30&stage=namek');
  await page.waitForFunction(() => (window as unknown as C).__ctl?.actor && (window as unknown as C).__ctl.menu?.kind === 'root', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'evidence/beta3/ui/battle_piccolo_1280.png' });
  const info = await page.evaluate(() => { const c = (window as unknown as C).__ctl; return { actor: c.actor.name, rows: c.currentRows().map((r: any) => r.label) }; });
  console.log(JSON.stringify(info));
  // open Skills (row index)
  const idx = info.rows.findIndex((l: string) => /skill|special/i.test(l));
  await page.evaluate((i) => (window as unknown as C).__ctl.activate(i), idx);
  await page.waitForSelector('.list-win');
  const n = await page.evaluate(() => (window as unknown as C).__ctl.currentRows().length);
  console.log('rows', n);
  const state = () => page.evaluate(() => { const m = (window as unknown as C).__ctl.menu; return { c: m.cursor, s: m.start }; });
  const btns = page.locator('.list-win .cmd');
  const box = await btns.nth(2).boundingBox();
  await page.mouse.move(box!.x + 20, box!.y + box!.height / 2);
  await page.mouse.move(box!.x + 40, box!.y + box!.height / 2 + 1);
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(250); seen.push(JSON.stringify(await state())); }
  console.log('hover idle states', [...new Set(seen)].join(' '));
  expect(new Set(seen).size).toBeLessThanOrEqual(1);
  // keys: down to the end one by one
  for (let i = 0; i < n + 1; i++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(120); }
  const end = await state(); console.log('after keys', JSON.stringify(end));
  expect(end.c).toBe(n - 1);
  // hover last visible row again after scrolling to end, idle
  const b2 = await page.locator('.list-win .cmd').last().boundingBox();
  await page.mouse.move(b2!.x + 20, b2!.y + 10); await page.mouse.move(b2!.x + 30, b2!.y + 12);
  const seen2: string[] = []; for (let i = 0; i < 12; i++) { await page.waitForTimeout(250); seen2.push(JSON.stringify(await state())); }
  console.log('hover-at-end idle', [...new Set(seen2)].join(' '));
  expect(new Set(seen2).size).toBeLessThanOrEqual(1);
  await page.screenshot({ path: 'evidence/beta3/ui/battle_skills_list_1280.png' });
  expect(errors).toEqual([]);
});
