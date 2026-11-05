import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { STAGE_KINDS, stageTextureKey } from '../../src/engine/scenes/stageBackgrounds';

describe('reviewed Namek stage backgrounds', () => {
  it('has a different local 960x540 PNG for the title and every battle stage', () => {
    const hashes = new Set<string>();
    for (const kind of ['title', ...STAGE_KINDS]) {
      const bytes = readFileSync(join(process.cwd(), 'public/assets/backgrounds', `${kind}_namek.png`));
      expect(bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))).toBe(true);
      expect(bytes.readUInt32BE(16)).toBe(960);
      expect(bytes.readUInt32BE(20)).toBe(540);
      hashes.add(createHash('sha256').update(bytes).digest('hex'));
    }
    expect(hashes.size).toBe(1 + STAGE_KINDS.length);
    for (const kind of STAGE_KINDS) expect(stageTextureKey(kind)).toBe(`bg_${kind}_namek`);
  });
});
