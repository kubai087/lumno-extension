// The Search sources tab: the search panel group order, the custom,
// aggregate, site, AI and engine lists, and the add form. The lists follow
// the providers, the aggregate searches and the reader's order; their rows
// edit through the actions, which tell the outcome in a toast or a form.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { aggregateSearchAutoGroupEnabled, aggregateSearches as aggregateSearchesSetting } from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { useSetting } from '../../../shared/react/use-setting';
import { useStore } from '../../../shared/react/use-store';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import { locateBuiltinProvider } from '../../dom/locate-builtin-provider';
import { createAggregateSearchModel } from '../../options-aggregate-search';
import { createAggregateSearchActions } from '../../options-aggregate-search-actions';
import { createSiteSearchActions } from '../../options-site-search-actions';
import type { SiteSearchListOptions } from '../../react/site-search-list';
import { ShortcutsTab as SearchSourcesView, type ShortcutsListId, type ShortcutsTabHandlers } from '../../react/shortcuts-tab';
import { getAggregateListModel } from './aggregate-list-model';
import { getSiteSearchFormModel } from './form-model';
import { hasSearchKeyConflict } from './key-conflicts';
import { getSearchSourcesModel } from './search-sources-model';
import { getSiteSearchListModels } from './site-search-list-models';

export const SEARCH_SOURCES_TAB_SETTINGS: readonly Setting<unknown>[] = [aggregateSearchAutoGroupEnabled];

const aggregateSearchModel = createAggregateSearchModel();

// The key a dragged row is moved by, per list.
function getRowKey(listId: ShortcutsListId, row: HTMLElement): string {
  if (listId === 'aggregate') {
    return row.getAttribute('data-aggregate-id') || '';
  }
  return String(row.getAttribute('data-key') || '').toLowerCase();
}

// Older installs have aggregate searches but no auto-group choice; it is
// derived from those searches and saved once.
function useLegacyAutoGroup(): void {
  const { settingsStore } = useOptionsPage();
  useEffect(() => {
    const settings = [aggregateSearchAutoGroupEnabled, aggregateSearchesSetting];
    void settingsStore.include(settings).then(() => {
      if (settingsStore.getStored(aggregateSearchAutoGroupEnabled) !== undefined || !settingsStore.isRead(aggregateSearchesSetting)) {
        return;
      }
      const derived = aggregateSearchModel.deriveLegacyAutoGroupEnabled(settingsStore.getStored(aggregateSearchesSetting));
      saveSetting(settingsStore, aggregateSearchAutoGroupEnabled, derived);
    });
  }, [settingsStore]);
}

function useSearchSourcesHandlers(keysRef: { current: Record<string, string[]> }): ShortcutsTabHandlers {
  const { settingsStore, siteSearchProviders, aggregateSearches, sourceOrder, showToast, locale } = useOptionsPage();
  return useMemo<ShortcutsTabHandlers>(() => {
    const getMessage = locale.getMessage;
    const conflict = (key: string, allowedKey = '', allowedAggregateId = '') => hasSearchKeyConflict(
      siteSearchProviders.store.getSnapshot(),
      aggregateSearches.store.getSnapshot().items,
      key,
      allowedKey,
      allowedAggregateId
    );
    const siteSearch = createSiteSearchActions({ providers: siteSearchProviders, getMessage, showToast, hasKeyConflict: conflict });
    const aggregate = createAggregateSearchActions({
      aggregates: aggregateSearches,
      providers: siteSearchProviders,
      getMessage,
      showToast,
      hasKeyConflict: (key, currentId) => conflict(key, '', currentId)
    });
    const move = (listId: string) => (fromIndex: number, toIndex: number) => {
      void sourceOrder.moveListItem(listId, keysRef.current[listId] || [], fromIndex, toIndex);
    };
    const list = (listId: string): SiteSearchListOptions => ({
      onLocateDuplicate: (template) => locateBuiltinProvider(document, template),
      onMove: move(listId),
      onRemove: siteSearch.removeProvider,
      onSave: siteSearch.saveProvider
    });
    return {
      onMoveGroup: (fromIndex, toIndex) => {
        void sourceOrder.moveGroup(fromIndex, toIndex);
      },
      attachGroupDrag: (dragHost) => sourceOrder.attachGroupDrag(dragHost),
      attachListDrag: (listId, dragHost) => sourceOrder.attachListDrag(dragHost, listId, (row) => getRowKey(listId, row)),
      custom: list('custom'),
      sites: list('site'),
      ai: list('ai'),
      engines: list('engine'),
      aggregate: {
        onMove: move('aggregate'),
        onRemove: aggregate.removeAggregateSearch,
        onSave: aggregate.saveAggregateSearch
      },
      onAddSiteSearch: siteSearch.addProvider,
      onClearCustom: siteSearch.clearCustomProviders,
      onClearAggregates: aggregate.clearAggregateSearches,
      onResetBuiltin: siteSearch.resetBuiltinProviders,
      onAutoGroupChange: (checked) => saveSetting(settingsStore, aggregateSearchAutoGroupEnabled, checked)
    };
  }, [settingsStore, siteSearchProviders, aggregateSearches, sourceOrder, showToast, locale, keysRef]);
}

export function SearchSourcesTab() {
  const { settingsStore, siteSearchProviders, aggregateSearches, sourceOrder, bindTooltips, onSearchSourcesDrawn } = useOptionsPage();
  const t = useMessages();
  const providers = useStore(siteSearchProviders.store);
  const aggregates = useStore(aggregateSearches.store);
  const { order } = useStore(sourceOrder.store);
  const autoGroup = useSetting(settingsStore, aggregateSearchAutoGroupEnabled);
  useLegacyAutoGroup();
  const siteLists = getSiteSearchListModels(t, providers, sourceOrder.sortList);
  const aggregateList = getAggregateListModel(t, aggregates.items, providers, sourceOrder.sortList, aggregateSearches.limits);
  // The keys each list shows right now, in order, for the move buttons.
  const keysRef = useRef<Record<string, string[]>>({});
  keysRef.current = { ...siteLists.keys, aggregate: aggregateList.keys };
  const handlers = useSearchSourcesHandlers(keysRef);
  useLayoutEffect(() => {
    bindTooltips();
    onSearchSourcesDrawn();
  });
  return (
    <SearchSourcesView
      handlers={handlers}
      model={getSearchSourcesModel(t, {
        groups: order.groups.map((group) => ({ group, label: sourceOrder.getGroupLabel(group) })),
        lists: siteLists.lists,
        aggregateList: aggregateList.list,
        form: getSiteSearchFormModel(t),
        autoGroup
      })}
    />
  );
}
