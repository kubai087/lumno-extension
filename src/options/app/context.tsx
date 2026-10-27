// What every part of the Options page reaches: the runtime instances the
// page makes once (settings, language, toast, tooltips and the owners of
// shared data). Modules, constants and storage keys are imported instead.
import { createContext, useContext } from 'react';
import type { SettingsStore } from '../../platform/settings-store';
import { useStore } from '../../shared/react/use-store';
import type { AggregateSearches } from '../features/aggregate-search/searches';
import type { OptionsLocale } from '../features/language/locale';
import type { BrowserCommands } from '../features/shortcuts/browser-commands';
import type { SiteSearchProviders } from '../features/site-search/providers';
import type { createSearchSourceOrderController } from '../options-search-source-order';
import type { GetMessage } from '../options-types';

interface OptionsPage {
  settingsStore: SettingsStore;
  locale: OptionsLocale;
  commands: BrowserCommands;
  siteSearchProviders: SiteSearchProviders;
  aggregateSearches: AggregateSearches;
  // The order of search groups, lists and browser content types.
  sourceOrder: ReturnType<typeof createSearchSourceOrderController>;
  showToast(message: string, isError?: boolean): void;
  hideTooltip(): void;
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
  return locale.getMessage;
}

export { OptionsPageContext, useMessages, useOptionsPage };
export type { OptionsPage };
