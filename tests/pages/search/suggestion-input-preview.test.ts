import { describe, expect, it } from 'vitest';
import { SURFACES, openSearchSurface, type SearchSurface, type SurfaceMessage, type SurfaceName } from './surfaces';

// Moving onto a search engine suggestion with the arrow keys writes its query
// into the input, as the address bar does (issue #124); the preview itself is
// unit-tested beside src/domain/search/suggestion-input-preview.ts.

const LOCAL = [
  { type: 'history', title: 'GitHub', url: 'https://github.com/' },
  { type: 'history', title: 'git - Brave Search', url: 'https://search.brave.com/search?q=git' }
];
const ENGINE = ['github desktop', 'github copilot'].map((query) => ({
  type: 'googleSuggest',
  title: query,
  url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  searchQuery: query,
  forceSearch: true
}));

function respond(message: SurfaceMessage) {
  if (message.action === 'getSearchSuggestions') return { suggestions: LOCAL };
  if (message.action === 'getTabsForOverlay' || message.action === 'getTabs') return { tabs: [] };
  if (message.action === 'getSearchEngineSuggestions') {
    const local = Array.isArray(message.localSuggestions) ? message.localSuggestions : [];
    return { suggestions: local.concat(ENGINE), hasRemoteSuggestions: true };
  }
  return undefined;
}

// Rows also read their number shortcut and action label.
function rowIndex(surface: SearchSurface, text: string): number {
  return surface.suggestions().findIndex((row) => (row.textContent || '').includes(text));
}

async function openWithSuggestions(name: SurfaceName, query = 'git') {
  const surface = await openSearchSurface(name, { respond });
  await surface.type(query);
  await surface.waitFor(() => rowIndex(surface, 'github desktop') >= 0, `${name}: engine suggestions did not show`);
  await surface.settle(60);
  return surface;
}

// Presses ArrowDown until the row reading `text` is selected.
async function selectRow(surface: SearchSurface, text: string): Promise<void> {
  const target = rowIndex(surface, text);
  expect(target).toBeGreaterThanOrEqual(0);
  for (let step = 0; step <= surface.suggestions().length && surface.selectedIndex() !== target; step += 1) {
    surface.press('ArrowDown');
    await surface.settle(20);
  }
  expect(surface.selectedIndex()).toBe(target);
}

describe.each(SURFACES)('%s suggestion in the input', (name) => {
  it('shows the selected search suggestion and puts back what was typed on a page row or Escape', async () => {
    const surface = await openWithSuggestions(name);
    const typedHighlight = surface.selectedIndex();
    await selectRow(surface, 'github desktop');
    expect(surface.input().value).toBe('github desktop');
    surface.press('ArrowDown');
    await surface.settle(20);
    expect(surface.input().value).toBe('github copilot');
    await selectRow(surface, 'GitHub');
    expect(surface.input().value).toBe('git');
    await selectRow(surface, 'github desktop');
    surface.press('Escape');
    await surface.settle(40);
    expect(surface.input().value).toBe('git');
    expect(surface.selectedIndex()).toBe(typedHighlight);
    expect(surface.suggestions().length).toBeGreaterThan(0);
  });

  it('searches the selected suggestion on Enter', async () => {
    const surface = await openWithSuggestions(name);
    await selectRow(surface, 'github desktop');
    surface.press('Enter');
    await surface.settle(120);
    expect(surface.navigation()).toEqual({ search: 'github desktop' });
  });

  it('keeps the suggestion as typed text when typing on', async () => {
    const surface = await openWithSuggestions(name);
    await selectRow(surface, 'github desktop');
    await surface.type('github desktop app');
    await surface.settle(150);
    expect(surface.input().value).toBe('github desktop app');
  });

  it('takes the suggestion on Tab and lists results for it', async () => {
    const surface = await openWithSuggestions(name);
    await selectRow(surface, 'github copilot');
    surface.press('Tab');
    await surface.settle(150);
    expect(surface.input().value).toBe('github copilot');
    expect(surface.messages.some((message) => message.action === 'getSearchSuggestions' && message.query === 'github copilot')).toBe(true);
  });

  // Typed text that names a site search ("yt") would switch the scope on
  // Tab; with a suggestion shown, Tab takes the suggestion instead.
  it('takes the suggestion on Tab over a typed site search trigger', async () => {
    const surface = await openWithSuggestions(name, 'yt');
    await selectRow(surface, 'github copilot');
    surface.press('Tab');
    await surface.settle(150);
    expect(surface.scopeLabel()).toBe('');
    expect(surface.input().value).toBe('github copilot');
  });

  it('puts a selected page address in the input on Tab, and Enter opens the edited address', async () => {
    const surface = await openWithSuggestions(name);
    await selectRow(surface, 'git - Brave Search');
    expect(surface.input().value).toBe('git');
    surface.press('Tab');
    await surface.settle(150);
    expect(surface.input().value).toBe('search.brave.com/search?q=git');
    await surface.type('search.brave.com/search?q=github');
    await surface.settle(150);
    surface.press('Enter');
    await surface.settle(150);
    expect(surface.navigation()).toEqual({ url: 'https://search.brave.com/search?q=github' });
  });
});
