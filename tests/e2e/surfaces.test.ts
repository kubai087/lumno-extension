import { describe, expect } from 'vitest';
import * as SETTINGS from '../../src/domain/settings';
import { defineFlows, delay } from './flow';

const flow = defineFlows();

const PAGES = [
  'newtab.html',
  'newtab.html?focus=1',
  'src/options/options.html',
  'src/onboarding/onboarding.html',
  'src/popup/popup.html'
];

// Two rounds of settings changed from elsewhere while New Tab is open.
const SETTINGS_ROUNDS: Array<Record<string, unknown>> = [
  {
    themeMode: 'dark',
    language: 'en',
    newtabThemeMode: 'dark',
    newtabGlassStyle: 'liquid',
    newtabGlassTheme: 'dark',
    newtabTopContentMode: 'time',
    newtabTimeFontSize: 72,
    newtabTimeSecondsVisible: true,
    newtabWidthMode: 'wide',
    newtabShortcutColumns: 6,
    newtabShortcutSize: 64,
    newtabShortcutGap: 20,
    newtabShortcutsVisible: false,
    bookmarkCount: 12,
    bookmarkColumns: 3,
    bookmarkFolderIconsVisible: false,
    recentCount: 12,
    newtabFeedbackButtonVisible: false,
    newtabAppearanceButtonVisible: false,
    newtabZenMode: true,
    searchResultDisplayLimit: 6,
    newtabOpenInNewTab: true,
    numberShortcutInstantEnabled: true,
    searchBlacklist: ['example.com'],
    faviconEnhancedFetchEnabled: true
  },
  {
    themeMode: 'light',
    language: 'zh_CN',
    newtabGlassStyle: 'frosted',
    newtabZenMode: false,
    newtabShortcutsVisible: true,
    newtabFeedbackButtonVisible: true,
    newtabAppearanceButtonVisible: true
  }
];

// A round's values under their storage keys.
function storedValues(round: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(round).map(([name, value]) => {
    const setting: unknown = Reflect.get(SETTINGS, name);
    const key = typeof setting === 'object' && setting !== null ? Reflect.get(setting, 'key') : undefined;
    if (typeof key !== 'string') {
      throw new Error(`the settings registry has no ${name}`);
    }
    return [key, value];
  }));
}

// Clicks through the appearance panel's controls and closes it again.
const WALK_APPEARANCE_PANEL = `(async () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const button = document.querySelector('.x-nt-wallpaper-button');
  if (!button) return 0;
  button.click();
  await wait(900);
  let clicks = 0;
  for (const [selector, limit] of [
    ['[data-wallpaper-tab]', 8],
    ['[data-wallpaper-mode]', 3],
    ['[data-wallpaper-id]', 2],
    ['[data-newtab-favicon-id]', 2],
    ['[data-wallpaper-effect-ink-tone]', 2]
  ]) {
    for (const element of Array.from(document.querySelectorAll(selector)).slice(0, limit)) {
      element.click();
      clicks += 1;
      await wait(250);
    }
  }
  button.click();
  await wait(600);
  return clicks;
})()`;

describe('extension pages', () => {
  // Every extension page opens and renders; New Tab survives a burst of
  // settings changes and a walk through its appearance panel.
  flow('open and render, and New Tab survives settings bursts and its appearance panel', async ({ browser }) => {
    const rounds = SETTINGS_ROUNDS.map(storedValues);
    for (const file of PAGES) {
      const page = await browser.openPage(browser.extensionUrl(file));
      // A page whose script failed to start renders no text, often with no error.
      await page.waitFor('document.body && document.body.innerText.trim().length > 0', {
        timeout: 8000,
        message: `${file} rendered no text`
      });
      await delay(1500);
      if (file === 'newtab.html') {
        for (const values of rounds) {
          await page.evaluate(`Promise.all([
            chrome.storage.sync.set(${JSON.stringify(values)}),
            chrome.storage.local.set(${JSON.stringify(values)})
          ])`);
          await delay(1200);
        }
        expect(Number(await page.evaluate(WALK_APPEARANCE_PANEL)), 'the appearance panel should have controls to click').toBeGreaterThan(0);
      }
      await browser.closePage(page);
    }
  });
});
