import { describe, expect, it } from 'vitest';
import { createSuggestionInputPreview, getSuggestionEditText } from './suggestion-input-preview';

// Moving onto a search engine suggestion with the arrow keys writes its query
// into the input, as the address bar does (issue #124).

const PAGE = { type: 'history', title: 'GitHub', url: 'https://github.com/' };
const BRAVE = { type: 'history', title: 'git - Brave Search', url: 'https://search.brave.com/search?q=git' };
const ENGINE = ['github desktop', 'github copilot'].map((query) => ({
  type: 'googleSuggest',
  title: query,
  url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  searchQuery: query,
  forceSearch: true
}));

function createInput(value: string) {
  const input = {
    value,
    selection: [0, 0],
    setSelectionRange(start: number, end: number) {
      input.selection = [start, end];
    }
  };
  return input;
}

describe('suggestion input preview', () => {
  it('fills the input with a search suggestion, caret at the end, and leaves it for a page row', () => {
    const input = createInput('git');
    const preview = createSuggestionInputPreview();
    preview.show(input, PAGE, 'git');
    expect(input.value).toBe('git');
    expect(preview.isActive()).toBe(false);
    preview.show(input, ENGINE[0], 'git');
    expect(input.value).toBe('github desktop');
    expect(input.selection).toEqual([14, 14]);
  });

  it('puts back exactly what was typed on the search action row, and keeps a committed suggestion', () => {
    const input = createInput('git');
    const preview = createSuggestionInputPreview();
    preview.show(input, ENGINE[0], 'git');
    preview.show(input, { type: 'newtab', searchQuery: 'git' }, 'git ');
    expect(input.value).toBe('git ');
    expect(preview.restore(input, 'git')).toBe(false);
    preview.show(input, ENGINE[1], 'git');
    expect(preview.commit()).toBe(true);
    expect(preview.restore(input, 'git')).toBe(false);
    expect(input.value).toBe('github copilot');
  });

  it('edits a page address without https:// and a lone slash, keeping http:// and the port', () => {
    expect(getSuggestionEditText(PAGE)).toBe('github.com');
    expect(getSuggestionEditText(BRAVE)).toBe('search.brave.com/search?q=git');
    expect(getSuggestionEditText({ type: 'bookmark', url: 'http://localhost:3000/docs' })).toBe('http://localhost:3000/docs');
    expect(getSuggestionEditText(ENGINE[0])).toBe('');
  });

  it('puts a page address in the input to edit, but not an open tab', () => {
    const input = createInput('git');
    const preview = createSuggestionInputPreview();
    expect(preview.editAddress(input, { type: 'openTab', url: 'https://a.test/' })).toBe(false);
    expect(preview.editAddress(input, BRAVE)).toBe(true);
    expect(input.value).toBe('search.brave.com/search?q=git');
  });
});
