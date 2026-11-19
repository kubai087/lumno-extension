// Saving a page uses the same cards and ordinary pin controller as the popup.
// The saved list is a WebDAV-only preference, handled by the existing sync flow.
import type { SettingsStore } from '../platform/settings-store';
import { readLaterPages } from '../domain/settings/recent-sites';
import { normalizeRecentSiteItem } from '../domain/recent-sites-store';
import type { RecentPinController, PopupPage } from './popup-recent-pin';

export function createReadLaterController(settings: SettingsStore, pins: Pick<RecentPinController, 'pin'>) {
  let chain: Promise<unknown> = Promise.resolve();
  function add(page: PopupPage): Promise<{ status: 'added' | 'limit' | 'failed' }> {
    const job = chain.catch(() => {}).then(async () => {
      if (!/^https?:\/\//i.test(page.url)) return { status: 'failed' as const };
      const item = normalizeRecentSiteItem(page, { ignoreBlacklist: true });
      if (!item) return { status: 'failed' as const };
      await settings.include(readLaterPages);
      if (!settings.isRead(readLaterPages)) return { status: 'failed' as const };
      const result = await pins.pin(page);
      if (result.status === 'limit') return { status: 'limit' as const };
      if (result.status !== 'pinned') return { status: 'failed' as const };
      await settings.set(readLaterPages, [item, ...settings.get(readLaterPages)]);
      return { status: 'added' as const };
    });
    chain = job;
    return job.catch(() => ({ status: 'failed' }));
  }
  return { add };
}
