import { describe, expect, it } from 'vitest';
import { isLocalFileLikeUrl, readOverlayOpenOptions } from './overlay-context';

describe('Overlay open context', () => {
  // Local files and PDFs, where the overlay leaves the tab's zoom alone.
  it.each([
    'file:///Users/me/notes.html',
    'https://example.com/report.PDF',
    'chrome-extension://viewer/index.html?src=file:///tmp/a.html',
    'chrome-extension://viewer/index.html?src=https://example.com/a.pdf',
    'chrome-extension://viewer/index.html?src=file%3A%2F%2F%2Ftmp%2Fa.html',
    // A src that is no URL still names a PDF.
    'chrome-extension://viewer/index.html?src=report.pdf',
    'file://'
  ])('treats %s as a local file', (url) => {
    expect(isLocalFileLikeUrl(url)).toBe(true);
  });

  it.each([
    '',
    'https://example.com/',
    'https://example.com/docs?src=https://example.com/page',
    'chrome-extension://viewer/index.html?src=not-a-file',
    'not a url at all'
  ])('treats "%s" as no local file', (url) => {
    expect(isLocalFileLikeUrl(url)).toBe(false);
  });

  it('marks the tab pinned only for a real true', () => {
    expect(readOverlayOpenOptions({ currentTabPinned: true }, Date.now()).currentTabPinned).toBe(true);
    [undefined, 'true', 1, null].forEach((value) => {
      expect(readOverlayOpenOptions({ currentTabPinned: value }, Date.now()).currentTabPinned).toBe(false);
    });
  });
});
