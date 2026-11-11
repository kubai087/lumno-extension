import { describe, expect, it } from 'vitest';
import { SURFACES, openSearchSurface, type SurfaceMessage } from './surfaces';

// Both search boxes: Shift+Enter opens a result in the other of the current
// and a new tab, and Option/Alt+Enter opens it in a split view beside the
// current tab where the browser has split views.

const isOpen = (message: SurfaceMessage) => message.action === 'createTab' || message.action === 'searchOrNavigate';

// Where the press opened its result; the New Tab loads the current tab itself.
async function openWith(
  name: (typeof SURFACES)[number],
  query: string,
  init: KeyboardEventInit,
  splitView = true
): Promise<unknown> {
  const surface = await openSearchSurface(name, { splitView });
  await surface.type(query);
  await surface.settle(60);
  const before = surface.messages.length;
  surface.press('Enter', init);
  await surface.settle(120);
  const opened = surface.messages.slice(before).filter(isOpen).pop();
  if (opened) {
    return opened.disposition;
  }
  return surface.navigation() ? 'currentTab' : null;
}

describe.each(SURFACES)('%s open modifier keys', (name) => {
  it.each([
    ['an address', 'example.com/docs'],
    ['a search', 'cats']
  ])('opens %s in a split view with Option/Alt+Enter', async (_kind, query) => {
    expect(await openWith(name, query, { altKey: true })).toBe('splitTab');
  });

  // The overlay opens results in a new tab by default, New Tab in itself.
  const [plain, other] = name === 'overlay' ? ['newTab', 'currentTab'] : ['currentTab', 'newTab'];

  it('opens an address as with Enter alone when the browser has no split views', async () => {
    expect(await openWith(name, 'example.com/docs', { altKey: true }, false)).toBe(plain);
  });

  it.each([
    ['Enter', {}, plain],
    ['Shift+Enter', { shiftKey: true }, other]
  ])('opens an address with %s in the %s', async (_keys, init, expected) => {
    expect(await openWith(name, 'example.com/docs', init)).toBe(expected);
  });
});
