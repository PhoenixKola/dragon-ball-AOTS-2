import { describe, it, expect } from 'vitest';
import { isBackKey } from '../../src/systems/backKey';

const ev = (key: string, o: Partial<{ ctrlKey: boolean; altKey: boolean; metaKey: boolean; target: unknown }> = {}) => ({ key, ctrlKey: false, altKey: false, metaKey: false, target: null, ...o }) as Parameters<typeof isBackKey>[0];

describe('Back / Cancel keys', () => {
  it('X, x, Backspace and Escape all go back; other keys do not', () => {
    for (const k of ['x', 'X', 'Backspace', 'Escape']) expect(isBackKey(ev(k)), k).toBe(true);
    for (const k of ['z', 'Enter', ' ', 'ArrowLeft', 'p', 'q']) expect(isBackKey(ev(k)), k).toBe(false);
  });
  it('modifier combinations and typing in a text field never count as Back', () => {
    expect(isBackKey(ev('x', { ctrlKey: true }))).toBe(false); expect(isBackKey(ev('Backspace', { altKey: true }))).toBe(false); expect(isBackKey(ev('x', { metaKey: true }))).toBe(false);
    expect(isBackKey(ev('Backspace', { target: { tagName: 'INPUT' } }))).toBe(false); expect(isBackKey(ev('x', { target: { tagName: 'TEXTAREA' } }))).toBe(false);
    expect(isBackKey(ev('x', { target: { tagName: 'BUTTON' } }))).toBe(true);
  });
});
