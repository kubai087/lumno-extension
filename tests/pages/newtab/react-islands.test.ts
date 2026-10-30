import { describe, expect, it } from 'vitest';
import { createBrowserFake } from '../../fakes/browser';
import { getElements } from '../../fakes/dom';
import { bootReadyNewtab } from './boot';

describe('New Tab views', () => {
  it('draws its feedback control, bottom dock, wordmark and search input through React', async () => {
    await bootReadyNewtab(createBrowserFake());

    const islands = new Set(getElements(document, '[data-react-island]').map((island) => island.getAttribute('data-react-island')));
    expect(Array.from(islands)).toEqual(expect.arrayContaining(['newtab-feedback-control', 'newtab-bottom-dock', 'newtab-wordmark', 'shared-search-input']));
  });
});
