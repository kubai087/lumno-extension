import { describe, expect, it } from 'vitest';
import { createImeKeyGuard } from './ime-key-guard';

const INPUT = { nodeName: 'INPUT' };
const OTHER_INPUT = { nodeName: 'INPUT' };
const ENTER = { key: 'Enter', keyCode: 13, which: 13, isComposing: false };

function createGuard() {
  let now = 1000;
  const guard = createImeKeyGuard({ now: () => now, commitEnterIgnoreMs: 120 });
  return { guard, tick: (ms: number) => { now += ms; } };
}

describe('IME key guard', () => {
  it('ignores keys while a composition is active', () => {
    const { guard } = createGuard();
    guard.markCompositionStart({ target: INPUT });
    expect(guard.shouldIgnoreKeydown({ key: 'a', target: INPUT })).toBe(true);
  });

  it('ignores the Enter that commits the composition on its own input, for the commit window only', () => {
    const { guard, tick } = createGuard();
    guard.markCompositionStart({ target: INPUT });
    guard.markCompositionEnd({ target: INPUT });
    expect(guard.shouldIgnoreKeydown({ ...ENTER, target: INPUT })).toBe(true);
    expect(guard.shouldIgnoreKeydown({ ...ENTER, target: OTHER_INPUT })).toBe(false);
    tick(121);
    expect(guard.shouldIgnoreKeydown({ ...ENTER, target: INPUT })).toBe(false);
  });

  it('allows Enter once the key that committed the text is released', () => {
    const { guard } = createGuard();
    guard.markCompositionStart({ target: INPUT });
    guard.markCompositionEnd({ target: INPUT });
    guard.markKeyUp();
    expect(guard.shouldIgnoreKeydown({ ...ENTER, target: INPUT })).toBe(false);
  });

  it('does not end a composition on keyup', () => {
    const { guard } = createGuard();
    guard.markCompositionStart({ target: INPUT });
    guard.markKeyUp();
    expect(guard.isComposing()).toBe(true);
  });
});
