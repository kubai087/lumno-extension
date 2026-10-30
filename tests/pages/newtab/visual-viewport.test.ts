import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { language, motionEffectsEnabled } from '../../../src/domain/settings';
import { createBrowserFake } from '../../fakes/browser';
import { getElement } from '../../fakes/dom';
import { bootReadyNewtab, settle, waitFor } from './boot';

// New Tab follows the visual viewport's top inset when it resizes or
// scrolls (but not a pinch zoom's), and keeps the appearance heading above
// one shared scroller.

class FakeVisualViewport extends EventTarget {
  offsetLeft = 0;
  offsetTop = 0;
  width = 1024;
  height = 640;
  scale = 1;
}

const SYNC = { [language.key]: 'en', [motionEffectsEnabled.key]: false };

describe('New Tab and the visual viewport', () => {
  it('moves its top inset with the visual viewport, but not with a pinch zoom', async () => {
    const viewport = new FakeVisualViewport();
    vi.stubGlobal('visualViewport', viewport);
    await bootReadyNewtab(createBrowserFake({ sync: SYNC }));
    const inset = () => document.documentElement.style.getPropertyValue('--x-nt-visual-viewport-top-inset');
    const move = async (type: string, values: Partial<FakeVisualViewport>) => {
      Object.assign(viewport, values);
      await act(async () => viewport.dispatchEvent(new Event(type)));
      await settle();
    };

    await move('resize', { offsetTop: 30 });
    await waitFor(() => inset() === '30px', 'the inset did not follow a visual viewport resize');
    await move('scroll', { offsetTop: 12 });
    await waitFor(() => inset() === '12px', 'the inset did not follow a visual viewport scroll');
    await move('resize', { scale: 2, offsetTop: 200 });
    await waitFor(() => inset() === '0px', 'a pinch zoom re-fitted the page to the zoomed-in view');
  });

  it('keeps the appearance heading above the panel’s one content scroller, the theme section first', async () => {
    await bootReadyNewtab(createBrowserFake({ sync: SYNC }));

    await act(async () => getElement(document, '.x-nt-wallpaper-button').click());
    await waitFor(() => document.querySelector('.x-nt-wallpaper-panel-scroll') !== null, 'the appearance panel did not open');

    const panel = getElement(document, '.x-nt-wallpaper-panel');
    const children = Array.from(panel.children, (child) => child.className.split(' ')[0]);
    expect(children.indexOf('x-nt-appearance-header')).toBeGreaterThanOrEqual(0);
    expect(children.indexOf('x-nt-appearance-header')).toBeLessThan(children.indexOf('x-nt-wallpaper-panel-scroll'));
    const scroller = getElement(panel, ':scope > .x-nt-wallpaper-panel-scroll');
    expect(scroller.querySelector('section, [class*="-section"]')).toBe(scroller.querySelector('.x-nt-appearance-section'));
    expect(scroller.querySelector('.x-nt-appearance-section')).not.toBeNull();
  });
});
