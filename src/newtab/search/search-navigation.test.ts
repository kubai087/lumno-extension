import { describe, expect, it } from 'vitest';
import { getNextSuggestionIndex } from './search-navigation';

// Arrow keys move the highlighted suggestion one step and wrap; with nothing
// selected the step starts from the suggestion highlighted automatically.
const DOWN = 1;
const UP = -1;

describe('suggestion arrow navigation', () => {
  it('moves down from a selection and wraps from the last to the first', () => {
    expect(getNextSuggestionIndex(DOWN, 0, 3, -1)).toEqual({ index: 1, didWrap: false });
    expect(getNextSuggestionIndex(DOWN, 2, 3, -1)).toEqual({ index: 0, didWrap: true });
  });

  it('moves down from the automatic highlight, or from the top without one', () => {
    expect(getNextSuggestionIndex(DOWN, -1, 3, -1)).toEqual({ index: 0, didWrap: false });
    expect(getNextSuggestionIndex(DOWN, -1, 3, 0)).toEqual({ index: 1, didWrap: false });
    expect(getNextSuggestionIndex(DOWN, -1, 3, 2)).toEqual({ index: 0, didWrap: true });
  });

  it('moves up from a selection and wraps from the first to the last', () => {
    expect(getNextSuggestionIndex(UP, 2, 3, -1)).toEqual({ index: 1, didWrap: false });
    expect(getNextSuggestionIndex(UP, 0, 3, -1)).toEqual({ index: 2, didWrap: true });
  });

  it('moves up from the automatic highlight, and to the last from the top or without one', () => {
    expect(getNextSuggestionIndex(UP, -1, 3, 2)).toEqual({ index: 1, didWrap: false });
    expect(getNextSuggestionIndex(UP, -1, 3, 0)).toEqual({ index: 2, didWrap: true });
    expect(getNextSuggestionIndex(UP, -1, 3, -1)).toEqual({ index: 2, didWrap: true });
  });

  it('keeps a single suggestion and selects nothing in an empty list', () => {
    expect(getNextSuggestionIndex(DOWN, 0, 1, -1)).toEqual({ index: 0, didWrap: true });
    expect(getNextSuggestionIndex(DOWN, -1, 0, -1)).toEqual({ index: -1, didWrap: false });
  });
});
