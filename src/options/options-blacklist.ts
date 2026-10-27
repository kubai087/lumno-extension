// Rules for the search and favicon blacklists on the Options page. Rule
// parsing itself lives in LumnoBlacklistUtils; this adds the editor's
// presentation and how a saved rule joins the list. Results name a locale
// message key in `error`.
import * as BlacklistUtils from '../domain/blacklist-utils';
import type { BlacklistRule, MatchMode } from '../domain/blacklist-utils';

const DEFAULT_MATCH_MODE: MatchMode = 'prefix';

// The rule the editor's input makes, or why it makes none.
type BlacklistRuleDraft = { item: BlacklistRule; error?: undefined } | { item?: undefined; error: string };

interface BlacklistInputConfig {
  labelKey: string;
  labelFallback: string;
  placeholderKey: string;
  placeholderFallback: string;
  // Shown before the input, as the part of the URL the rule leaves out.
  prefixText: string;
}

function createBlacklistModel() {
  const utils = BlacklistUtils;

  function normalizeMatchModes(value: unknown, fallbackMode?: MatchMode | null): MatchMode[] {
    return utils.normalizeMatchModes(value, fallbackMode === undefined ? DEFAULT_MATCH_MODE : fallbackMode);
  }

  function normalizeItems(items: unknown): BlacklistRule[] {
    return utils.normalizeItems(items, DEFAULT_MATCH_MODE);
  }

  function buildItemKey(item: Partial<BlacklistRule> | null | undefined): string {
    return utils.buildRuleKey(item, DEFAULT_MATCH_MODE);
  }

  // 'exact' (this page), 'suffix' (the whole site) or 'prefix' (this path).
  function getMatchTone(modes: unknown): MatchMode {
    const normalized = normalizeMatchModes(modes);
    if (normalized.includes('exact')) {
      return 'exact';
    }
    return normalized.includes('suffix') ? 'suffix' : 'prefix';
  }

  function formatPatternForDisplay(item: Partial<BlacklistRule> | null | undefined): string {
    if (!item || !item.pattern) {
      return '';
    }
    return normalizeMatchModes(item.matchModes).includes('suffix')
      ? item.pattern
      : `http(s)://${item.pattern}`;
  }

  // Label, placeholder and the fixed prefix shown before the input.
  function getInputConfig(modes: unknown): BlacklistInputConfig {
    const tone = getMatchTone(modes);
    return {
      labelKey: 'blacklist_label_url',
      labelFallback: 'URL rule',
      placeholderKey: tone === 'exact'
        ? 'blacklist_placeholder_exact'
        : (tone === 'suffix' ? 'blacklist_placeholder_domain' : 'blacklist_placeholder_prefix'),
      placeholderFallback: tone === 'exact'
        ? 'example.com/path'
        : (tone === 'suffix' ? 'baidu.com' : 'baidu.com or baidu.com/search'),
      prefixText: tone === 'suffix' ? '' : 'http(s)://'
    };
  }

  function buildRuleDraft(inputValue: string, matchModes: MatchMode[]): BlacklistRuleDraft {
    if (matchModes.length === 0) {
      return { error: 'blacklist_error_match_mode' };
    }
    const pattern = utils.normalizePattern(inputValue, matchModes, null);
    if (!pattern) {
      return { error: matchModes.includes('suffix') ? 'blacklist_error_domain' : 'blacklist_error_url' };
    }
    return { item: { pattern, matchModes } };
  }

  // The saved rule goes first; it replaces the rule being edited and any
  // rule that already matches the same way.
  function upsertItems(items: readonly BlacklistRule[], nextItem: BlacklistRule, replacedRuleKey: string): BlacklistRule[] {
    const nextKey = buildItemKey(nextItem);
    return [
      { pattern: nextItem.pattern, matchModes: nextItem.matchModes },
      ...items.filter((entry) => {
        const entryKey = buildItemKey(entry);
        return entryKey !== replacedRuleKey && entryKey !== nextKey;
      })
    ];
  }

  return Object.freeze({
    buildItemKey,
    buildRuleDraft,
    formatPatternForDisplay,
    getInputConfig,
    getMatchTone,
    getPatternInputValue: (item: Partial<BlacklistRule> | null | undefined): string => utils.getPatternInputValue(item),
    normalizeItems,
    normalizeMatchModes,
    upsertItems
  });
}

export { createBlacklistModel };
export type { BlacklistInputConfig, BlacklistRuleDraft };
