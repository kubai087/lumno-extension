// What every part of the Options page reaches: the runtime instances the
// page makes once (settings, language, toast, tooltips and the owners of
// shared data). Modules, constants and storage keys are imported instead.
import { createContext, useContext } from 'react';
import type { SettingsStore } from '../../platform/settings-store';
import { useStore } from '../../shared/react/use-store';
import type { Account } from '../features/account/account';
import type { AggregateSearches } from '../features/aggregate-search/searches';
import type { PageTheme } from '../features/appearance/page-theme';
import type { SurfaceLocale } from '../../shared/i18n/surface-locale';
import type { BrowserCommands } from '../features/shortcuts/browser-commands';
import type { SiteSearchProviders } from '../features/site-search/providers';
import type { createSearchSourceOrderController } from '../options-search-source-order';
import type { GetMessage } from '../options-types';

interface OptionsPage {
  settingsStore: SettingsStore;
  locale: SurfaceLocale;
  commands: BrowserCommands;
  siteSearchProviders: SiteSearchProviders;
  aggregateSearches: AggregateSearches;
  // The order of search groups, lists and browser content types.
  sourceOrder: ReturnType<typeof createSearchSourceOrderController>;
  pageTheme: PageTheme;
  account: Account;
  showToast(message: string, isError?: boolean): void;
  // Asks open New Tab pages to redraw a part of themselves.
  notifyNewtab(section: string): void;
  hideTooltip(): void;
  // Binds the floating tooltip to the hints a view has just drawn.
  bindTooltips(): void;
  // Runs whenever the Search sources lists are drawn, so a link to a row
  // in them can scroll to it once it exists.
  onSearchSourcesDrawn(): void;
  // Where menus that flip upward must stop: below the pinned tabs row.
  getViewportTopInset(): number;
  isMacPlatform: boolean;
  // The browser family the page runs in (data-browser-family).
  browserFamily: string;
}

const OptionsPageContext = createContext<OptionsPage | null>(null);

function useOptionsPage(): OptionsPage {
  const page = useContext(OptionsPageContext);
  if (!page) {
    throw new Error('Options views render inside the Options page');
  }
  return page;
}

// The page's copy; the view redraws when the language changes.
function useMessages(): GetMessage {
  const { locale } = useOptionsPage();
  useStore(locale.store);
  return locale.t;
}

export { OptionsPageContext, useMessages, useOptionsPage };
export type { OptionsPage };
