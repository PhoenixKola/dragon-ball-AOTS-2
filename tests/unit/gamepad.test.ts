import { describe, it, expect } from 'vitest';
import { newPadMem, padKeys, type PadLike } from '../../src/systems/gamepad';

const pad = (pressed: number[] = [], axes: number[] = [0, 0]): PadLike => ({ buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })), axes });
describe('gamepad -> keyboard bridge (logic only; no controller hardware was available to test)', () => {
  it('buttons fire once per press; arrows repeat while held after a delay', () => {
    const mem = newPadMem();
    expect(padKeys(pad([0]), mem, 0, 'battle')).toEqual(['Enter']); expect(padKeys(pad([0]), mem, 16, 'battle')).toEqual([]);
    expect(padKeys(pad(), mem, 32, 'battle')).toEqual([]); expect(padKeys(pad([0]), mem, 48, 'battle')).toEqual(['Enter']);
    expect(padKeys(pad([13]), mem, 100, 'ui')).toEqual(['ArrowDown']); expect(padKeys(pad([13]), mem, 300, 'ui')).toEqual([]);
    expect(padKeys(pad([13]), mem, 600, 'ui')).toEqual(['ArrowDown']); expect(padKeys(pad([13]), mem, 650, 'ui')).toEqual([]); expect(padKeys(pad([13]), mem, 740, 'ui')).toEqual(['ArrowDown']);
  });
  it('left stick works like the D-pad with a dead zone', () => {
    const m = newPadMem();
    expect(padKeys(pad([], [0.3, 0.2]), m, 0, 'ui')).toEqual([]);
    expect(padKeys(pad([], [-0.9, 0]), m, 10, 'ui')).toEqual(['ArrowLeft']); expect(padKeys(pad([], [0, 0.9]), newPadMem(), 10, 'ui')).toEqual(['ArrowDown']);
  });
  it('face buttons: A confirm, B cancel, X/Y/RB are the Active Guard keys for fighters 1/2/3; Start pauses in battle and opens the menu elsewhere', () => {
    expect(padKeys(pad([1]), newPadMem(), 0, 'ui')).toEqual(['Escape']);
    expect(padKeys(pad([2]), newPadMem(), 0, 'battle')).toEqual(['1']); expect(padKeys(pad([3]), newPadMem(), 0, 'battle')).toEqual(['2']); expect(padKeys(pad([5]), newPadMem(), 0, 'battle')).toEqual(['3']);
    expect(padKeys(pad([9]), newPadMem(), 0, 'battle')).toEqual(['p']); expect(padKeys(pad([9]), newPadMem(), 0, 'world')).toEqual(['Escape']);
  });
  it('in free exploration only Start is bridged (movement and interact already read the pad directly)', () => {
    expect(padKeys(pad([0, 1, 12, 13, 14, 15, 2]), newPadMem(), 0, 'world')).toEqual([]);
  });
  it('no controller connected: nothing happens', () => { expect(padKeys(null, newPadMem(), 0, 'ui')).toEqual([]); });
});
