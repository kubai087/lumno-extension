// What a row offers: its URL line, the action its modifier keys pick, its
// labels and its theme.
import type {
  NormalizedOptions,
  Suggestion,
  ThemeValue,
  SuggestionsRuntime,
  ModifierState,
  SuggestionActionModelResult,
  SuggestionActionTagModel
} from './types';
import type { SearchActionModelOptions } from '../../../../domain/search/suggestion-action-model';

export function getSuggestionUrlLineText(
  options: NormalizedOptions,
  suggestion: Suggestion
): string {
  // Help center pages show the section or passage that matched instead of their address.
  if (suggestion.type === 'helpArticle') {
    return String(suggestion.detail || '');
  }
  const rawUrl = String(suggestion.url || '').trim();
  if (!rawUrl) {
    return '';
  }
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return options.getUrlDisplay(rawUrl);
    }
    const hostname = parsed.hostname.replace(/^www\./i, '');
    const host = parsed.port ? `${hostname}:${parsed.port}` : hostname;
    let pathname = parsed.pathname || '/';
    try {
      pathname = decodeURI(pathname);
    } catch {
      // Keep encoded paths when they cannot be decoded safely.
    }
    const displayPath = pathname === '/'
      ? ''
      : (pathname.replace(/\/+$/, '') || '');
    return `${host}${displayPath}`;
  } catch {
    return options.getUrlDisplay(rawUrl);
  }
}

export function isLocalUrlSuggestion(
  options: NormalizedOptions,
  suggestion: Suggestion
): boolean {
  const url = String(suggestion.url || '');
  if (!url) {
    return false;
  }
  try {
    if (new URL(url).protocol.toLowerCase() === 'file:') {
      return true;
    }
  } catch {
    // Continue with the host-based check for partially typed URLs.
  }
  const host = options.getHostFromUrl(url);
  return Boolean(
    host &&
    (options.isLocalNetworkHost(host) ||
      options.shouldBlockFaviconForHost(host))
  );
}

export function resolveTheme(
  options: NormalizedOptions,
  suggestion: Suggestion,
  theme: ThemeValue
): ThemeValue {
  const nextTheme = theme || options.defaultTheme;
  return options.shouldUseUrlFallbackThemeForSuggestion(
    suggestion,
    nextTheme
  )
    ? options.urlHighlightTheme
    : nextTheme;
}

export function getModifierAction(
  runtime: SuggestionsRuntime,
  action: string,
  modifiers: ModifierState
): string {
  const { actionModel } = runtime.options;
  if (actionModel.getModifierAdjustedAction) {
    return actionModel.getModifierAdjustedAction(action, modifiers);
  }
  if (modifiers.openSwitchInNewTab && action === 'switch') {
    return modifiers.openInBackgroundTab && !modifiers.openInCurrentTab ? 'openBackgroundTab' : 'openNewTab';
  }
  if (modifiers.openInBackgroundTab && !modifiers.openInCurrentTab && ['openNewTab', 'go', 'switch'].includes(action)) {
    return 'openBackgroundTab';
  }
  return modifiers.openInCurrentTab && action === 'openNewTab' ? 'go' : action;
}

export function getActionLabel(
  runtime: SuggestionsRuntime,
  action: string,
  suggestion: Suggestion
): string {
  const options = runtime.options;
  if (action === 'search') {
    const provider = suggestion.provider;
    if (provider && options.isAiSiteSearchProvider(provider)) {
      const site = options.getSiteSearchDisplayName(provider);
      return options.formatMessage(
        'action_open_ai_web',
        '打开 {site} 网页版',
        { site }
      );
    }
    return options.t('action_search', '搜索');
  }
  const labels: Record<string, [string, string]> = {
    switch: ['action_switch', '切换'],
    open: ['action_open', '打开'],
    openBackgroundTab: ['action_open_background_new_tab', '在后台新开'],
    openNewTab: ['action_open_new_tab', '新开'],
    go: ['action_go_current_tab', '前往'],
    commandNewTab: ['command_newtab', '新建标签页'],
    commandOpenTabs: ['command_tabs_action', '搜索标签页'],
    commandCopyUrl: ['command_copy_action', '复制链接'],
    commandDocumentPip: ['document_pip_command_action', '开始剪裁']
  };
  if (action === 'commandSettings') {
    return options.formatMessage(
      'command_settings',
      '打开设置',
      { name: 'Lumno' }
    );
  }
  const entry = labels[action] || labels.openNewTab;
  return options.t(entry[0], entry[1]);
}

export function createActionModel(
  options: NormalizedOptions,
  input: SearchActionModelOptions
): SuggestionActionModelResult {
  const model =
    options.actionModel.createSearchActionModel?.(input) || {};
  const tags = Array.isArray(model.actionTags)
    ? model.actionTags.filter(
        (tag): tag is SuggestionActionTagModel =>
          Boolean(tag && typeof tag.action === 'string')
      )
    : [];
  return {
    actionTags: tags,
    visitButtonAction: String(
      model.visitButtonAction || 'openNewTab'
    ),
    alwaysHideVisitButton: Boolean(model.alwaysHideVisitButton),
    hasActionTags:
      typeof model.hasActionTags === 'boolean'
        ? model.hasActionTags
        : tags.length > 0,
    hasSwitchAction: Boolean(model.hasSwitchAction)
  };
}
