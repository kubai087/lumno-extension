import { describe, expect, it } from 'vitest';
import { isRecord, isStringArray, readLocaleMessages, readRepoJson } from './repository';

// What the tab switcher needs from the manifest and the locales. Its
// behaviour is covered by tests/pages/tab-switcher/ and the worker's
// tab switcher tests.

const manifest = readRepoJson('manifest.json');
const contentScripts = (Array.isArray(manifest.content_scripts) ? manifest.content_scripts : []).filter(isRecord);
const LOCALES = ['en', 'ja', 'zh_CN', 'zh_TW'];

describe('tab switcher wiring', () => {
  it('preloads no switcher into web pages; the worker injects it on the first command', () => {
    const scripts = contentScripts.flatMap((entry) => (isStringArray(entry.js) ? entry.js : []));
    expect(scripts.filter((script) => /tab-switcher|page-bridge/.test(script))).toEqual([]);
  });

  it('observes the shortcut release from document start in every frame the user can type in', () => {
    const observer = contentScripts.find((entry) => isStringArray(entry.js) && entry.js.includes('build/shortcut-key-observer.js'));
    expect(observer && {
      js: observer.js,
      run_at: observer.run_at,
      all_frames: observer.all_frames,
      match_about_blank: observer.match_about_blank,
      match_origin_as_fallback: observer.match_origin_as_fallback
    }).toEqual({
      js: ['build/shortcut-key-observer.js'],
      run_at: 'document_start',
      all_frames: true,
      match_about_blank: true,
      match_origin_as_fallback: true
    });
  });

  it('needs neither the management nor the activeTab permission, and has its own command', () => {
    const permissions = isStringArray(manifest.permissions) ? manifest.permissions : [];
    expect(permissions).not.toContain('management');
    expect(permissions).not.toContain('activeTab');
    expect(isRecord(manifest.commands) && isRecord(manifest.commands['show-tab-switcher'])).toBe(true);
  });

  it.each(LOCALES)('localizes the switcher in %s, leaving the shortcut to fill in', (locale) => {
    const messages = readLocaleMessages(locale);
    ['tab_switcher_title', 'tab_switcher_untitled', 'tab_switcher_favicon_alt', 'command_show_tab_switcher',
      'settings_tab_switcher_title', 'settings_tab_switcher_desc'].forEach((key) => {
      expect(String(messages[key] || '').trim(), key).not.toBe('');
    });
    expect(Object.hasOwn(messages, 'tab_switcher_current')).toBe(false);
    expect(messages.settings_tab_switcher_desc).toMatch(/\{shortcut\}/);
  });

  it('translates the switcher title', () => {
    expect(readLocaleMessages('zh_CN').tab_switcher_title).not.toBe(readLocaleMessages('en').tab_switcher_title);
  });
});
