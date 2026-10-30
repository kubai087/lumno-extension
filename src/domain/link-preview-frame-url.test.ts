import { describe, expect, it } from 'vitest';
import { toPreviewFrameUrl } from './link-preview-frame-url';

describe('the address a preview frame loads', () => {
  it("loads an X post through the address X's service worker leaves to the network", () => {
    expect(toPreviewFrameUrl('https://x.com/__oQuery/status/2113594440686453210')).toBe('https://x.com/i/web/status/2113594440686453210');
    expect(toPreviewFrameUrl('https://twitter.com/a_b/status/42/photo/1')).toBe('https://x.com/i/web/status/42');
  });

  it('loads other pages as they are', () => {
    expect(toPreviewFrameUrl('https://x.com/a_b')).toBe('https://x.com/a_b');
    expect(toPreviewFrameUrl('https://x.com/i/web/status/42')).toBe('https://x.com/i/web/status/42');
    expect(toPreviewFrameUrl('https://example.com/a/status/42')).toBe('https://example.com/a/status/42');
  });
});
