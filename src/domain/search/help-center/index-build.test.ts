import { describe, expect, it } from 'vitest';
import { normalizeIndex } from './index-build';

describe('help center index', () => {
  it('drops malformed entries', () => {
    expect(normalizeIndex([
      { title: 'Lumno 是什么', href: '/help/what-is-lumno/', sections: [], text: '' },
      { title: 'broken entry without href' },
      null
    ])).toHaveLength(1);
  });
});
