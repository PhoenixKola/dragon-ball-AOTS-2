import { describe, expect, it } from 'vitest';
import { windowStart } from '../../src/components/listWindow';

describe('battle list window', () => {
  it('hovering any visible row never moves the window', () => {
    for (let c = 2; c <= 4; c++) expect(windowStart(2, c, 8)).toBe(2);
  });
  it('keyboard past the edge scrolls exactly one row', () => {
    expect(windowStart(0, 3, 8)).toBe(1);
    expect(windowStart(1, 0, 8)).toBe(0);
  });
  it('clamps at the end', () => {
    expect(windowStart(5, 7, 8)).toBe(5);
    expect(windowStart(0, 3, 4)).toBe(1);
  });
});
