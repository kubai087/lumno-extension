import { describe, expect, it } from 'vitest';
import { getExactTerms } from './query';

describe('help center query terms', () => {
  it('leaves question words out of what must match, unless nothing else is typed', () => {
    expect(getExactTerms('怎么改快捷键', [])).toEqual(['改快捷键']);
    expect(getExactTerms('how do I change the shortcut', [])).toEqual(['change', 'shortcut']);
    expect(getExactTerms('怎么', [])).toEqual(['怎么']);
  });

  it('keeps characters a synonym names that would otherwise be dropped as filler', () => {
    expect(getExactTerms('我的最爱', [['收藏夹', '我的最爱']])).toEqual(['我的最爱']);
  });
});
