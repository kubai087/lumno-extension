import { describe, expect, it } from 'vitest';
import newtabHtml from '../../../newtab.html?raw';

describe('New Tab tooltip stylesheets', () => {
  it('links the shared tooltip and cursor tooltip stylesheets', () => {
    const page = new DOMParser().parseFromString(newtabHtml, 'text/html');
    expect(page.querySelector('link[rel="stylesheet"][href="../shared/ui/tooltip.css"]')).not.toBeNull();
    expect(page.querySelector('link[rel="stylesheet"][href="../shared/ui/cursor-tooltip.css"]')).not.toBeNull();
  });
});
