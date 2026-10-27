// The Blacklist tab: the rules that hide sites from search results and the
// New Tab, the switch for enhanced icon fetching, and the rules for sites
// whose icons are not fetched. A stored rule list is shown as normalized
// and never written back on its own.
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BlacklistRule, MatchMode } from '../../../domain/blacklist-utils';
import { faviconEnhancedFetchEnabled, faviconRequestBlacklist, searchBlacklist } from '../../../domain/settings';
import type { Setting } from '../../../domain/settings/define';
import { useSetting } from '../../../shared/react/use-setting';
import { useMessages, useOptionsPage } from '../../app/context';
import { saveSetting } from '../../app/save-setting';
import { BlacklistTab as BlacklistTabView, type BlacklistTabHandlers } from '../../react/blacklist-tab';
import { blacklistModel, buildRuleDraft, getBlacklistTabModel } from './blacklist-copy';

export const BLACKLIST_TAB_SETTINGS: readonly Setting<unknown>[] = [searchBlacklist, faviconRequestBlacklist, faviconEnhancedFetchEnabled];

function useRules(setting: Setting<unknown>): BlacklistRule[] {
  const { settingsStore } = useOptionsPage();
  const stored = useSetting(settingsStore, setting);
  return useMemo(() => blacklistModel.normalizeItems(stored), [stored]);
}

// Each form's reset version, which closes it when it moves on. Turning
// enhanced fetching off locks the favicon rules and closes their form.
function useFormResets(enhancedFetch: boolean) {
  const [search, setSearch] = useState(0);
  const [favicon, setFavicon] = useState(0);
  const wasEnhanced = useRef(enhancedFetch);
  useLayoutEffect(() => {
    if (wasEnhanced.current && !enhancedFetch) {
      setFavicon((version) => version + 1);
    }
    wasEnhanced.current = enhancedFetch;
  }, [enhancedFetch]);
  return { search, favicon, setSearch, setFavicon };
}

export function BlacklistTab() {
  const { settingsStore, showToast, notifyNewtab, bindTooltips } = useOptionsPage();
  const t = useMessages();
  const searchItems = useRules(searchBlacklist);
  const faviconItems = useRules(faviconRequestBlacklist);
  const enhancedFetch = useSetting(settingsStore, faviconEnhancedFetchEnabled);
  const resets = useFormResets(enhancedFetch);
  const { setSearch, setFavicon } = resets;
  useLayoutEffect(bindTooltips);

  const handlers = useMemo<BlacklistTabHandlers>(() => {
    const failure = (): string => t('toast_error', '操作失败，请重试。');
    const save = (setting: Setting<unknown>, items: BlacklistRule[]): Promise<void> =>
      settingsStore.set(setting, blacklistModel.normalizeItems(items)).catch(() => {});
    // Open New Tab pages redraw the sites the search rules hide.
    const saveSearch = (items: BlacklistRule[], message: string): Promise<void> => save(searchBlacklist, items).then(() => {
      notifyNewtab('recent');
      showToast(message, false);
    });
    const saveFavicon = (items: BlacklistRule[], message: string): Promise<void> =>
      save(faviconRequestBlacklist, items).then(() => showToast(message, false));
    const without = (items: BlacklistRule[], key: string) => items.filter((entry) => blacklistModel.buildItemKey(entry) !== key);
    async function addRule(
      value: string,
      modes: MatchMode[],
      store: (draft: BlacklistRule) => Promise<void>
    ): Promise<{ ok: true } | { ok: false; error: string }> {
      const draft = buildRuleDraft(t, value, modes);
      if (!draft.item) {
        return { ok: false, error: draft.error };
      }
      try {
        await store(draft.item);
        return { ok: true };
      } catch (error) {
        return { ok: false, error: failure() };
      }
    }
    return {
      search: {
        onRemove: (key) => saveSearch(without(searchItems, key), t('blacklist_removed_toast', '已从黑名单移除'))
          .catch(() => showToast(failure(), true)),
        onEdit: async (key, value, modes) => {
          const result = await addRule(value, modes, (item) => saveSearch(blacklistModel.upsertItems(searchItems, item, key), t('toast_saved', '已保存')));
          if (!result.ok && result.error === failure()) {
            showToast(result.error, true);
          }
          return result;
        },
        onAdd: (value, modes) => addRule(value, modes, (item) => saveSearch(blacklistModel.upsertItems(searchItems, item, ''), t('toast_saved', '已保存'))),
        onClear: () => {
          setSearch((version) => version + 1);
          return saveSearch([], t('toast_cleared', '已清空')).catch(() => showToast(failure(), true));
        }
      },
      favicon: {
        onRemove: (key) => saveFavicon(without(faviconItems, key), t('favicon_blacklist_removed_toast', '已移除排除规则'))
          .catch(() => showToast(failure(), true)),
        // A favicon rule goes first and replaces one that matches the same way.
        onAdd: (value, modes) => addRule(value, modes, (item) => saveFavicon(
          [item, ...without(faviconItems, blacklistModel.buildItemKey(item))],
          t('toast_saved', '已保存')
        )),
        onClear: () => {
          setFavicon((version) => version + 1);
          return saveFavicon([], t('toast_cleared', '已清空')).catch(() => showToast(failure(), true));
        }
      },
      onEnhancedFetchChange(checked) {
        saveSetting(settingsStore, faviconEnhancedFetchEnabled, checked);
      }
    };
  }, [settingsStore, showToast, notifyNewtab, t, searchItems, faviconItems, setSearch, setFavicon]);

  return (
    <BlacklistTabView
      handlers={handlers}
      model={getBlacklistTabModel(t, {
        search: { items: searchItems, formResetVersion: resets.search },
        favicon: { items: faviconItems, formResetVersion: resets.favicon },
        enhancedFetch
      })}
    />
  );
}
