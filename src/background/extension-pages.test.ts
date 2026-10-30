import { describe, expect, it } from 'vitest';
import { releasePageOpened } from '../domain/settings/features';
import type { PageOpenOptions } from './extension-pages';
import { installWorkerFake } from '../../tests/fakes/worker';

async function loadPages(version = '0.9.9') {
  const fake = installWorkerFake({ version });
  const pages = await import('./extension-pages');
  const openWith = (open: (options: PageOpenOptions, done: (opened: boolean) => void) => void) =>
    (options: PageOpenOptions = {}) => new Promise<boolean>((resolve) => open(options, resolve));
  return {
    fake,
    pages,
    openOnboarding: openWith(pages.openOnboardingPage),
    openOptions: openWith(pages.openExtensionOptionsPage),
    openShortcuts: openWith(pages.openExtensionShortcutsPage),
    // Resolves once the page opened and its marker was saved.
    openRelease: async (options: PageOpenOptions) => {
      const opened = await openWith(pages.openReleasePage)(options);
      await new Promise((resolve) => setTimeout(resolve, 0));
      return opened;
    },
    created: () => fake.chrome.tabs.create.mock.calls.map(([properties]) => properties)
  };
}

function withoutQuery(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname}`;
}

describe('extension pages', () => {
  it('builds the onboarding address with its entry, reason and version', async () => {
    const { pages } = await loadPages();
    const url = new URL(pages.buildOnboardingUrl({ reason: 'manual' }));

    expect(withoutQuery(url)).toBe('chrome-extension://lumno-test/src/onboarding/onboarding.html');
    expect(url.searchParams.get('entry')).toBe('ext');
    expect(url.searchParams.get('reason')).toBe('manual');
    expect(url.searchParams.get('version')).toBe('v0.9.9');
  });

  it('opens onboarding once on the 0.9.11 update and not on install or later updates', async () => {
    const { pages } = await loadPages();

    expect(pages.shouldOpenOnboardingForUpdate({ reason: 'update', previousVersion: '0.9.10' }, '0.9.11')).toBe(true);
    expect(pages.shouldOpenOnboardingForUpdate({ reason: 'install' }, '0.9.11')).toBe(false);
    expect(pages.shouldOpenOnboardingForUpdate({ reason: 'update', previousVersion: '0.9.11' }, '0.9.12')).toBe(false);
  });

  it('opens onboarding in a tab, in the background when asked', async () => {
    const page = await loadPages();

    expect(await page.openOnboarding({ reason: 'manual' })).toBe(true);
    const url = new URL(String(page.created()[0].url));
    expect(withoutQuery(url)).toBe('chrome-extension://lumno-test/src/onboarding/onboarding.html');
    expect(url.searchParams.get('entry')).toBe('ext');
    expect(url.searchParams.get('reason')).toBe('manual');
    expect(url.searchParams.get('version')).toBe('v0.9.9');

    expect(await page.openOnboarding({ reason: 'manual', disposition: 'backgroundTab' })).toBe(true);
    expect(page.created()[1].active).toBe(false);
  });

  it('opens the site searches at the shortcuts section of Settings', async () => {
    const page = await loadPages();

    expect(await new Promise<boolean>((resolve) => page.pages.openSiteSearchOptionsPage(resolve))).toBe(true);
    expect(page.created().map((properties) => properties.url)).toEqual([
      'chrome-extension://lumno-test/src/options/options.html#shortcuts'
    ]);
  });

  it('opens Settings and the shortcut settings in a background tab when asked', async () => {
    const page = await loadPages();

    expect(await page.openOptions({ hash: 'appearance', disposition: 'backgroundTab' })).toBe(true);
    expect(await page.openShortcuts({ disposition: 'backgroundTab' })).toBe(true);
    expect(page.created().map((properties) => properties.active)).toEqual([false, false]);
  });

  it('opens the release notes once per version and remembers it in sync only', async () => {
    const page = await loadPages();

    expect(await page.openRelease({ reason: 'update', oncePerVersion: true, disposition: 'backgroundTab' })).toBe(true);
    expect(page.created()).toHaveLength(1);
    expect(page.created()[0].active).toBe(false);
    expect(page.fake.storage.sync.values[releasePageOpened.key]).toMatchObject({ version: 'v0.9.9' });
    expect(page.fake.storage.local.values[releasePageOpened.key]).toBeUndefined();

    expect(await page.openRelease({ reason: 'update', oncePerVersion: true })).toBe(false);
    expect(page.created()).toHaveLength(1);

    page.fake.chrome.runtime.getManifest.mockReturnValue({ manifest_version: 3, name: 'Lumno', version: '0.10.0' });
    expect(await page.openRelease({ reason: 'update', oncePerVersion: true })).toBe(true);
    expect(page.created()).toHaveLength(2);
    expect(page.fake.storage.sync.values[releasePageOpened.key]).toMatchObject({ version: 'v0.10.0' });
  });
});
