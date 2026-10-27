// The Account tab's two cards: browser sync and WebDAV. Each keeps its own
// state and hands over its model; this owns the models the tab draws, and
// redraws them when the language or what they report on changes.
import { BROWSER_SYNC_KEYS, BROWSER_SYNC_SETTINGS, syncMeta, webdavStatus } from '../../../domain/settings';
import { newtabShortcutsLocalOverflow } from '../../../domain/settings/newtab-shortcuts';
import type { ProviderStorageRuntime } from '../../../platform/settings-storage';
import type { SettingsStore } from '../../../platform/settings-store';
import { createStore } from '../../../shared/state/store';
import type { Store } from '../../../shared/state/store';
import { refreshSyncNowTooltip } from '../../dom/sync-now-tooltip';
import { createSyncSection, type SyncSectionOptions } from '../../options-sync-section';
import type { AccountTabHandlers, BrowserSyncCardModel, WebDavCardModel } from '../../react/account-tab';
import { createController as createWebDavController, type WebDavControllerOptions } from '../../webdav-options';
import type { OptionsLocale } from '../language/locale';

interface AccountState {
  // Null until each card has reported its first model.
  browserSync: BrowserSyncCardModel | null;
  webdav: WebDavCardModel | null;
}

interface AccountDeps {
  sync: Omit<SyncSectionOptions, 'onRender' | 'refreshSyncNowTooltip'>;
  webdav: Omit<WebDavControllerOptions, 'onRender'>;
  settingsStore: Pick<SettingsStore, 'subscribe'>;
  locale: Pick<OptionsLocale, 'store'>;
  // Refreshes an element's floating tooltip while it shows.
  showTooltipFor(target: HTMLElement): void;
}

class Account {
  readonly store: Store<AccountState> = createStore<AccountState>({ browserSync: null, webdav: null });
  readonly handlers: AccountTabHandlers;
  private readonly syncSection: ReturnType<typeof createSyncSection>;
  private readonly webdav: ReturnType<typeof createWebDavController>;

  constructor(deps: AccountDeps) {
    this.syncSection = createSyncSection({
      ...deps.sync,
      onRender: (browserSync) => this.store.setState({ browserSync }),
      refreshSyncNowTooltip: () => refreshSyncNowTooltip(document, deps.showTooltipFor)
    });
    this.webdav = createWebDavController({
      ...deps.webdav,
      onRender: (webdav) => this.store.setState({ webdav })
    });
    this.handlers = { browserSync: this.syncSection.handlers, webdav: { onAction: this.webdav.onAction } };
    const refreshSync = () => this.syncSection.refreshSyncStatus();
    deps.settingsStore.subscribe(webdavStatus, refreshSync);
    deps.settingsStore.subscribe([syncMeta, ...BROWSER_SYNC_SETTINGS], refreshSync);
    deps.settingsStore.subscribe(newtabShortcutsLocalOverflow, () => this.syncSection.refreshShortcutSyncSummary());
    deps.locale.store.subscribe(() => {
      this.webdav.render();
      refreshSync();
    });
  }

  // Once the provider area is known: settings older versions kept only on
  // this device move into browser sync, and the status reads them.
  start(providerStorage: Pick<ProviderStorageRuntime, 'ready'>): void {
    void providerStorage.ready.then(() => {
      this.syncSection.migrateStorageIfNeeded(BROWSER_SYNC_KEYS.slice());
      this.syncSection.refreshSyncStatus();
    });
  }
}

export { Account };
export type { AccountState };
