// Starting and leaving a site search or a local scope: the mode, the empty
// input, the tag before it and the results. Both search panels run these
// one set of actions; a surface only says how it themes the tag at first,
// how it stops answers on their way, and how it clears its results.
import { searchResultSourceTypes } from '../../domain/settings/search';
import type { SettingsStore } from '../../platform/settings-store';
import type { InputModeProvider, InputModeTheme } from '../search/input-mode/types';
import type { InputModeController } from '../search/search-input-mode';
import type { SearchAutocomplete } from './autocomplete';
import { getLocalSearchScopeIconName, getLocalSearchScopeLabel } from './labels';
import type { SearchLocale } from './labels';
import type { ActiveLocalScope, SearchMode } from './search-mode';
import type { SearchQuery } from './search-query';

type TagOptions = Parameters<InputModeController['setProviderPrefix']>[2];

interface ModeActivationOptions {
  // Keep the rows shown, as when a mode comes back with its results.
  preserveResults?: boolean;
  animatePrefix?: boolean;
}

// What differs per surface.
interface SearchModeSurface<Provider> {
  getInput(): HTMLInputElement | null;
  getModeController(): Pick<InputModeController, 'setProviderPrefix' | 'setPrefixText' | 'clearProviderPrefix' | 'updateLayout'> | null;
  defaultTheme: InputModeTheme;
  // The tag's theme until the provider's own has loaded.
  getImmediateTheme(provider: Provider): InputModeTheme;
  getThemeForProvider(provider: Provider): Promise<InputModeTheme | null | undefined>;
  // Stops the answers on their way, and any wait before them.
  cancelRequests(): void;
  clearResults(): void;
  // Before a site search starts; the overlay drops a pending open tabs tag.
  beforeEnterSite?(): void;
}

interface SearchModeActionsOptions<Provider> {
  settings: Pick<SettingsStore, 'get'>;
  locale: SearchLocale;
  mode: SearchMode<Provider>;
  query: SearchQuery;
  autocomplete: Pick<SearchAutocomplete, 'clear'>;
  surface: SearchModeSurface<Provider>;
}

class SearchModeActions<Provider extends InputModeProvider> {
  private readonly options: SearchModeActionsOptions<Provider>;

  constructor(options: SearchModeActionsOptions<Provider>) {
    this.options = options;
  }

  readonly activateSiteSearch = (provider: Provider | null | undefined, activation?: ModeActivationOptions | null): void => {
    if (!provider) {
      return;
    }
    const { mode, surface } = this.options;
    const config = activation || {};
    if (surface.beforeEnterSite) {
      surface.beforeEnterSite();
    }
    if (config.preserveResults === true) {
      surface.cancelRequests();
    }
    mode.enterSite(provider);
    this.emptyInput();
    this.setSiteSearchPrefix(provider, surface.getImmediateTheme(provider), { animate: config.animatePrefix !== false });
    void surface.getThemeForProvider(provider).then((theme) => {
      if (mode.site === provider) {
        this.setSiteSearchPrefix(provider, theme);
      }
    });
    if (config.preserveResults !== true) {
      surface.clearResults();
    }
  };

  // False when the scope's source is off.
  readonly activateLocalSearchScope = (scope: ActiveLocalScope | null | undefined, activation?: ModeActivationOptions | null): boolean => {
    if (!scope || !this.options.settings.get(searchResultSourceTypes).includes(scope.sourceType)) {
      return false;
    }
    this.options.surface.cancelRequests();
    this.options.mode.enterLocal(scope);
    this.emptyInput();
    this.setLocalSearchScopePrefix(scope);
    if (!activation || activation.preserveResults !== true) {
      this.options.surface.clearResults();
    }
    return true;
  };

  readonly clearSiteSearch = (): void => {
    if (!this.options.mode.site) {
      return;
    }
    this.options.mode.leaveSite();
    this.clearSiteSearchPrefix();
    this.options.autocomplete.clear();
  };

  // False when no scope was active.
  readonly clearLocalSearchScope = (): boolean => {
    if (!this.options.mode.local) {
      return false;
    }
    this.options.surface.cancelRequests();
    this.options.mode.leaveLocal();
    this.clearSiteSearchPrefix();
    this.options.autocomplete.clear();
    return true;
  };

  readonly setSiteSearchPrefix = (provider: Provider | null, theme?: InputModeTheme | null, tagOptions?: TagOptions): void => {
    const controller = this.options.surface.getModeController();
    if (controller) {
      controller.setProviderPrefix(provider, theme, tagOptions);
    }
  };

  readonly setLocalSearchScopePrefix = (scope: ActiveLocalScope | null): void => {
    const controller = this.options.surface.getModeController();
    if (!controller || !scope) {
      return;
    }
    controller.setPrefixText(getLocalSearchScopeLabel(this.options.locale, scope), this.options.surface.defaultTheme, {
      animate: true,
      iconName: getLocalSearchScopeIconName(scope.sourceType),
      menuIconName: scope.sourceType === 'topSite' ? 'star' : scope.sourceType,
      modeId: `local:${scope.sourceType}`
    });
  };

  readonly clearSiteSearchPrefix = (): void => {
    const controller = this.options.surface.getModeController();
    if (controller) {
      controller.clearProviderPrefix();
    }
  };

  readonly updateSiteSearchPrefixLayout = (): void => {
    const controller = this.options.surface.getModeController();
    if (controller) {
      controller.updateLayout();
    }
  };

  // Types the query back in, as when a mode comes back with its results.
  readonly restoreSearchModeQuery = (rawQuery: unknown): void => {
    const value = String(rawQuery || '');
    this.options.query.set(value);
    const input = this.options.surface.getInput();
    if (input) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  private emptyInput(): void {
    const input = this.options.surface.getInput();
    if (input) {
      input.value = '';
    }
    this.options.query.clear();
    this.options.autocomplete.clear();
  }
}

export { SearchModeActions };
export type { ModeActivationOptions, SearchModeSurface };
