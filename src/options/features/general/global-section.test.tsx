import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import * as Settings from '../../../domain/settings';
import { getElement, getTag, getTags } from '../../../../tests/react/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/react/options-page';
import { GeneralGlobalSection } from './global-section';

const LANGUAGE_SELECT = '_x_extension_language_select_2024_unique_';

function setUp() {
  return renderOptionsView(<GeneralGlobalSection />);
}

afterEach(cleanUpOptionsViews);

describe('Options General global section', () => {
  it('lists every language in its own words after following the browser', () => {
    const { host } = setUp();
    const options = getTags(host, `#${LANGUAGE_SELECT} option`, 'option').map((option) => [option.value, option.textContent]);
    expect(options[0]).toEqual(['system', '跟随浏览器语言']);
    expect(options.slice(1)).toEqual(Settings.UI_LOCALES.map((locale) => [locale.htmlLang, locale.name]));
  });

  it('shows the applied language, and a dropped one as following the browser', () => {
    const { host, page } = setUp();
    act(() => page.locale.store.setState({ mode: 'ja', locale: 'ja' }));
    expect(getTag(host, `#${LANGUAGE_SELECT}`, 'select').value).toBe('ja');
    act(() => page.locale.store.setState({ mode: 'it', locale: 'en' }));
    expect(getTag(host, `#${LANGUAGE_SELECT}`, 'select').value).toBe('system');
  });

  it('notes an AI-translated language under the picker', () => {
    const { host, page } = setUp();
    const note = getElement(host, '#_x_extension_language_machine_note_2026_unique_');
    const machine = Settings.UI_LOCALES.find((locale) => Settings.isMachineTranslatedLocale(locale.htmlLang));
    const human = Settings.UI_LOCALES.find((locale) => !Settings.isMachineTranslatedLocale(locale.htmlLang));
    expect(machine && human).toBeTruthy();
    act(() => page.locale.store.setState({ mode: human?.htmlLang || '', locale: human?.htmlLang || '' }));
    expect(note.hidden).toBe(true);
    act(() => page.locale.store.setState({ mode: machine?.htmlLang || '', locale: machine?.htmlLang || '' }));
    expect(note.hidden).toBe(false);
  });

  it('saves a language chosen in the picker', async () => {
    const { host, writes, settings } = setUp();
    const frame = getElement(host, `[data-select="${LANGUAGE_SELECT}"]`);
    await act(async () => {
      getTag(frame, '._x_extension_select_trigger_2024_unique_', 'button').click();
    });
    await act(async () => {
      getElement(frame, '[data-value="en"]').click();
    });
    await settings.settle();
    expect(writes).toContainEqual({ [Settings.language.key]: 'en' });
  });

  it('draws the feedback, translation help and licenses link from the community links', () => {
    const { host } = setUp();
    expect(getElement(host, '#_x_extension_feedback_support_2026_unique_').childElementCount).toBeGreaterThan(0);
    expect(getElement(host, '#_x_extension_translation_help_2026_unique_').textContent).toContain('改进翻译');
    expect(getTag(host, '#_x_extension_open_licenses_2026_unique_', 'a').href)
      .toBe('https://github.com/kubai087/lumno-extension/blob/main/THIRD_PARTY_NOTICES.md');
  });

  it('puts the onboarding guide beside the Help Center card and opens it', () => {
    const { host, sendMessage } = setUp();
    const guide = getTag(host, '#_x_extension_open_onboarding_page_2026_unique_', 'button');
    expect(guide.parentElement?.lastElementChild).toBe(guide);
    expect(guide.closest('nav._x_extension_feedback_support_links_2026_unique_')).not.toBeNull();
    act(() => guide.click());
    expect(sendMessage.mock.calls.map(([message]) => message)).toEqual([{ action: 'openOnboardingPage' }]);
  });

  it('keeps the update notice on by default and saves a change', async () => {
    const { host, writes, settings } = setUp();
    const toggle = getTag(host, '#_x_extension_update_notice_toggle_2026_unique_', 'input');
    expect(toggle.checked).toBe(true);
    act(() => toggle.click());
    await settings.settle();
    expect(writes).toEqual([{ [Settings.updateNoticeEnabled.key]: false }]);
  });
});
