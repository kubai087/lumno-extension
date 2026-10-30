import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Settings from '../../../domain/settings';
import { getElement, getElements, getTag, getTags } from '../../../../tests/fakes/dom';
import { cleanUpOptionsViews, renderOptionsView } from '../../../../tests/fakes/options-page';
import { fetchPackaged } from '../../../../tests/fakes/packaged-fetch';
import { GeneralGlobalSection } from './global-section';

const LANGUAGE_SELECT = '_x_extension_language_select_2024_unique_';

const FEEDBACK_HOST = '#_x_extension_feedback_support_2026_unique_';

function setUp(sync: Record<string, unknown> = {}) {
  return renderOptionsView(<GeneralGlobalSection />, { sync });
}

function showIn(view: ReturnType<typeof setUp>, mode: string, locale: string) {
  act(() => view.page.locale.store.setState({ mode, locale }));
}

// How the Help Center row offers itself: the ask-in-the-search-box demo, a
// plain link, or nothing.
function helpCenter(host: HTMLElement): string | null {
  const feedback = getElement(host, FEEDBACK_HOST);
  if (feedback.querySelector('[data-feedback-support="help-center-ask"]')) return 'ask';
  return feedback.querySelector('[data-feedback-support="help-center"]') ? 'link' : null;
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
    // A tile like the feedback channels, with its own icon and no external-link mark.
    expect(guide.classList.contains('_x_extension_feedback_support_link_2026_unique_')).toBe(true);
    expect(guide.textContent).toBe('新手引导');
    expect(guide.querySelector('i.ri-compass-3-line')).not.toBeNull();
    expect(guide.querySelector('.ri-external-link-line')).toBeNull();
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

  it('offers the WeChat group on Chinese pages and X elsewhere, each channel an external link with its icon and label', () => {
    const view = setUp();
    const channels = () => getElements(view.host, `${FEEDBACK_HOST} ._x_extension_feedback_support_link_2026_unique_`);
    const community = () => view.host.querySelector(`${FEEDBACK_HOST} [data-feedback-support="community"]`);
    const expectExternalChannels = () => {
      const external = channels().filter((link) => link instanceof HTMLAnchorElement);
      expect(external.length).toBeGreaterThanOrEqual(3);
      external.forEach((link) => {
        expect(link.getAttribute('href')).toBeTruthy();
        expect(link instanceof HTMLAnchorElement && link.target).toBe('_blank');
        const icons = Array.from(link.querySelectorAll('i'), (icon) => icon.className);
        expect(icons).toHaveLength(1);
        expect(icons[0]).not.toContain('ri-external-link-line');
        expect(link.querySelector('span[data-i18n]')?.textContent).toBeTruthy();
      });
    };
    showIn(view, 'zh-CN', 'zh_CN');
    expectExternalChannels();
    expect(community()?.getAttribute('aria-haspopup')).toBe('dialog');
    expect(community()?.querySelector('.ri-wechat-line')).not.toBeNull();
    showIn(view, 'en', 'en');
    expectExternalChannels();
    expect(view.host.querySelector(`${FEEDBACK_HOST} .ri-wechat-line`)).toBeNull();
    expect(channels().some((link) => /^https:\/\/x\.com\//.test(link.getAttribute('href') || ''))).toBe(true);
  });

  it('puts the licenses link in the Global settings header, below the feedback section', () => {
    const { host } = setUp();
    const feedback = getElement(host, FEEDBACK_HOST);
    const licenses = getTag(host, '#_x_extension_open_licenses_2026_unique_', 'a');
    expect(feedback.compareDocumentPosition(licenses) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(feedback.contains(licenses)).toBe(false);
    expect(licenses.closest('._x_extension_section_header_2026_unique_')).not.toBeNull();
    expect(licenses.target).toBe('_blank');
    expect(licenses.rel).toContain('noopener');
  });

  it('offers asking the Help Center from the search box only while its site search is on', async () => {
    vi.stubGlobal('fetch', vi.fn(fetchPackaged));
    const view = setUp({ [Settings.siteSearchDisabled.key]: ['lm'] });
    // Until the providers have loaded, the row links to the Help Center.
    expect(helpCenter(view.host)).toBe('link');
    const stop = view.page.siteSearchProviders.followStorage();
    await act(() => view.page.siteSearchProviders.refresh());
    expect(helpCenter(view.host)).toBe('link');
    await view.settings.change(Settings.siteSearchDisabled, []);
    await vi.waitFor(() => expect(helpCenter(view.host)).toBe('ask'));
    await view.settings.change(Settings.siteSearchDisabled, ['lm']);
    await vi.waitFor(() => expect(helpCenter(view.host)).toBe('link'));
    stop();
  });
});
