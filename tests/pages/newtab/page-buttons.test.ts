import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { newtabAppearanceButtonVisible, newtabFeedbackButtonVisible } from '../../../src/domain/settings/newtab-page';
import { createBrowserFake } from '../../fakes/browser';
import { readRepoFile } from '../../fakes/css';
import { expectElement, getElement } from '../../fakes/dom';
import { bootReadyNewtab } from './boot';
import { pause } from './search-page';

// The feedback and appearance buttons each follow their own setting, from
// the first visible frame and live when Settings changes it. Settings' own
// switches are covered by tests/pages/options/newtab-page-rows.test.ts.
const BUTTONS = [
  { setting: newtabFeedbackButtonVisible, control: '.x-nt-feedback-control', titleKey: 'settings_newtab_feedback_button_visible_title' },
  { setting: newtabAppearanceButtonVisible, control: '.x-nt-wallpaper-control', titleKey: 'settings_newtab_appearance_button_visible_title' }
];

function shown(selector: string): boolean {
  const control = getElement(document, selector);
  return !control.hidden && control.getAttribute('aria-hidden') === 'false' && !control.inert;
}

describe('New Tab page buttons', () => {
  it.each(BUTTONS)('hides the $control from the first frame and follows its setting live', async ({ setting, control }) => {
    const hiddenWhenReady: boolean[] = [];
    const observer = new MutationObserver(() => {
      if (!hiddenWhenReady.length && document.body.getAttribute('data-nt-ready') === '1') {
        hiddenWhenReady.push(expectElement(document.querySelector(control), control).hidden);
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-nt-ready'] });
    const browser = createBrowserFake({ sync: { [setting.key]: false } });
    await bootReadyNewtab(browser);
    observer.disconnect();

    expect(hiddenWhenReady).toEqual([true]);
    expect(shown(control)).toBe(false);
    BUTTONS.filter((other) => other.control !== control).forEach((other) => expect(shown(other.control)).toBe(true));
    await act(async () => browser.storage.sync.externalSet({ [setting.key]: true }));
    await pause(60);
    expect(shown(control)).toBe(true);
    await act(async () => browser.storage.sync.externalSet({ [setting.key]: false }));
    await pause(60);
    expect(shown(control)).toBe(false);
  });

  it.each(['en', 'ja', 'zh_CN', 'zh_TW'])('names both switches in %s', (locale) => {
    const messages: Record<string, { message?: string } | undefined> = JSON.parse(readRepoFile(`_locales/${locale}/messages.json`));
    BUTTONS.forEach(({ titleKey }) => expect((messages[titleKey]?.message || '').trim()).toBeTruthy());
  });
});
