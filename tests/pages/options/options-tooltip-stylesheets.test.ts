import { describe, expect, it } from 'vitest';
import optionsHtml from '../../../src/options/options.html?raw';

describe('Options tooltip stylesheets', () => {
  it('links the shared tooltip stylesheet', () => {
    const page = new DOMParser().parseFromString(optionsHtml, 'text/html');
    expect(page.querySelector('link[rel="stylesheet"][href="../shared/ui/tooltip.css"]')).not.toBeNull();
  });
});
