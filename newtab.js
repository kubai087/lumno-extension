(function() {
  const root = document.getElementById('_x_extension_newtab_root_2024_unique_');
  const createSearchInput = window._x_extension_createSearchInput_2024_unique_;
  if (!root || typeof createSearchInput !== 'function') {
    return;
  }
  root.style.setProperty('padding', '8px', 'important');

  const storageArea = (chrome && chrome.storage && chrome.storage.sync)
    ? chrome.storage.sync
    : (chrome && chrome.storage ? chrome.storage.local : null);
  const storageAreaName = storageArea
    ? (storageArea === (chrome && chrome.storage ? chrome.storage.sync : null) ? 'sync' : 'local')
    : null;

  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  const LANGUAGE_STORAGE_KEY = '_x_extension_language_2024_unique_';
  const LANGUAGE_MESSAGES_STORAGE_KEY = '_x_extension_language_messages_2024_unique_';
  const RECENT_MODE_STORAGE_KEY = '_x_extension_recent_mode_2024_unique_';
  const RECENT_COUNT_STORAGE_KEY = '_x_extension_recent_count_2024_unique_';
  const DEFAULT_SEARCH_ENGINE_STORAGE_KEY = '_x_extension_default_search_engine_2024_unique_';
  const RI_SPRITE_URL = (chrome && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('remixicon.symbol.svg')
    : 'remixicon.symbol.svg';
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let mediaListenerAttached = false;
  let currentThemeMode = 'system';
  let modeBadge = null;
  const recentCards = [];
  let currentMessages = null;
  let currentLanguageMode = 'system';
  let defaultPlaceholderText = '搜索或输入网址...';
  let currentRecentMode = 'latest';
  let currentRecentCount = 4;

  // 使用系统字体，避免外链字体依赖。
  let defaultSearchEngineState = {
    id: '',
    name: '',
    host: '',
    updatedAt: 0
  };

  const SEARCH_ENGINE_DEFS = [
    {
      id: 'google',
      name: 'Google',
      hostMatches: ['google.'],
      searchUrl: (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'bing',
      name: 'Bing',
      hostMatches: ['bing.com'],
      searchUrl: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    },
    {
      id: 'baidu',
      name: '百度',
      hostMatches: ['baidu.com'],
      searchUrl: (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      hostMatches: ['duckduckgo.com'],
      searchUrl: (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
    },
    {
      id: 'yahoo',
      name: 'Yahoo',
      hostMatches: ['search.yahoo.com'],
      searchUrl: (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
    },
    {
      id: 'yandex',
      name: 'Yandex',
      hostMatches: ['yandex.com'],
      searchUrl: (query) => `https://yandex.com/search/?text=${encodeURIComponent(query)}`
    },
    {
      id: 'sogou',
      name: '搜狗',
      hostMatches: ['sogou.com'],
      searchUrl: (query) => `https://www.sogou.com/web?query=${encodeURIComponent(query)}`
    },
    {
      id: 'so',
      name: '360搜索',
      hostMatches: ['so.com'],
      searchUrl: (query) => `https://www.so.com/s?q=${encodeURIComponent(query)}`
    },
    {
      id: 'shenma',
      name: '神马',
      hostMatches: ['sm.cn'],
      searchUrl: (query) => `https://m.sm.cn/s?q=${encodeURIComponent(query)}`
    }
  ];

  function resolveTheme(mode) {
    if (mode === 'dark') {
      return 'dark';
    }
    if (mode === 'light') {
      return 'light';
    }
    return mediaQuery.matches ? 'dark' : 'light';
  }

  function normalizeLocale(locale) {
    const raw = String(locale || '').trim();
    if (!raw) {
      return 'en';
    }
    const lower = raw.toLowerCase();
    if (lower.startsWith('zh')) {
      if (lower.includes('hk')) {
        return 'zh_HK';
      }
      if (lower.includes('tw') || lower.includes('mo') || lower.includes('hant')) {
        return 'zh_TW';
      }
      return 'zh_CN';
    }
    return 'en';
  }

  function migrateStorageIfNeeded(keys) {
    if (!storageArea || !chrome || !chrome.storage || !chrome.storage.local) {
      return;
    }
    if (storageArea === chrome.storage.local) {
      return;
    }
    chrome.storage.local.get(keys, (localResult) => {
      const hasLocal = keys.some((key) => typeof localResult[key] !== 'undefined');
      if (!hasLocal) {
        return;
      }
      storageArea.get(keys, (syncResult) => {
        const hasSync = keys.some((key) => typeof syncResult[key] !== 'undefined');
        if (hasSync) {
          return;
        }
        storageArea.set(localResult);
      });
    });
  }


  function getSystemLocale() {
    if (chrome && chrome.i18n && chrome.i18n.getUILanguage) {
      return normalizeLocale(chrome.i18n.getUILanguage());
    }
    return normalizeLocale(navigator.language || 'en');
  }

  function escapeRegExp(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function renderHighlightedText(target, text, query, styles) {
    const safeText = String(text || '');
    const needle = String(query || '').trim();
    if (!needle) {
      target.textContent = safeText;
      return;
    }
    const parts = safeText.split(new RegExp(`(${escapeRegExp(needle)})`, 'gi'));
    if (parts.length === 1) {
      target.textContent = safeText;
      return;
    }
    parts.forEach((part) => {
      if (!part) {
        return;
      }
      if (part.toLowerCase() === needle.toLowerCase()) {
        const mark = document.createElement('mark');
        mark.style.background = styles && styles.background
          ? styles.background
          : 'var(--x-ext-mark-bg, #CFE8FF)';
        mark.style.color = styles && styles.color
          ? styles.color
          : 'var(--x-ext-mark-text, #1E3A8A)';
        mark.style.padding = '2px 4px';
        mark.style.borderRadius = '3px';
        mark.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
        mark.textContent = part;
        target.appendChild(mark);
      } else {
        target.appendChild(document.createTextNode(part));
      }
    });
  }

  function loadLocaleMessages(locale) {
    const normalized = normalizeLocale(locale);
    const localePath = chrome.runtime.getURL(`_locales/${normalized}/messages.json`);
    return fetch(localePath)
      .then((response) => response.json())
      .catch(() => ({}));
  }

  function t(key, fallback) {
    if (currentMessages && currentMessages[key] && currentMessages[key].message) {
      return currentMessages[key].message;
    }
    if (chrome && chrome.i18n && chrome.i18n.getMessage) {
      const message = chrome.i18n.getMessage(key);
      if (message) {
        return message;
      }
    }
    return fallback || '';
  }

  function formatMessage(key, fallback, params) {
    let text = t(key, fallback);
    if (!params) {
      return text;
    }
    Object.keys(params).forEach((token) => {
      const value = params[token];
      text = text.replace(new RegExp(`\\{${token}\\}`, 'g'), value);
    });
    return text;
  }

  function getRiSvg(id, sizeClass, extraClass) {
    const size = sizeClass || 'ri-size-16';
    const extra = extraClass ? ` ${extraClass}` : '';
    return `<svg class="ri-icon ${size}${extra}" aria-hidden="true" focusable="false"><use href="${RI_SPRITE_URL}#${id}"></use></svg>`;
  }

  function getSearchEngineById(id) {
    if (!id) {
      return null;
    }
    return SEARCH_ENGINE_DEFS.find((engine) => engine.id === id) || null;
  }

  function buildDefaultSearchUrl(query) {
    const engine = getSearchEngineById(defaultSearchEngineState.id);
    if (engine && typeof engine.searchUrl === 'function') {
      return engine.searchUrl(query);
    }
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  function getDefaultSearchEngineThemeUrl() {
    const engine = getSearchEngineById(defaultSearchEngineState.id);
    if (engine && typeof engine.searchUrl === 'function') {
      return engine.searchUrl('test');
    }
    return 'https://www.google.com';
  }

  function getDefaultSearchEngineFaviconUrl() {
    if (defaultSearchEngineState.host) {
      return `https://${defaultSearchEngineState.host}/favicon.ico`;
    }
    const engine = getSearchEngineById(defaultSearchEngineState.id);
    if (engine) {
      try {
        const host = new URL(engine.searchUrl('test')).hostname;
        return `https://${host}/favicon.ico`;
      } catch (e) {
        return '';
      }
    }
    return 'https://www.google.com/favicon.ico';
  }

  function getSearchActionLabel() {
    if (defaultSearchEngineState && defaultSearchEngineState.name) {
      return formatMessage('action_search_engine', '在 {engine} 中搜索', {
        engine: defaultSearchEngineState.name
      });
    }
    return t('action_search', '搜索');
  }

  function loadDefaultSearchEngineState() {
    if (!storageArea) {
      return;
    }
    storageArea.get([DEFAULT_SEARCH_ENGINE_STORAGE_KEY], (result) => {
      const stored = result ? result[DEFAULT_SEARCH_ENGINE_STORAGE_KEY] : null;
      if (stored && stored.id) {
        defaultSearchEngineState = stored;
      }
    });
  }

  function updateRecentHeading() {
    if (!recentHeading) {
      return;
    }
    const key = currentRecentMode === 'most' ? 'recent_heading_most' : 'recent_heading_latest';
    const fallback = currentRecentMode === 'most' ? '最常访问' : '最近访问';
    recentHeading.textContent = t(key, fallback);
  }

  function applyLanguageStrings() {
    document.title = t('newtab_page_title', 'New Tab');
    updateRecentHeading();
    if (inputParts && inputParts.input) {
      defaultPlaceholderText = t('search_placeholder', defaultPlaceholderText);
      if (!siteSearchState) {
        inputParts.input.placeholder = defaultPlaceholderText;
      }
    }
    if (modeBadge) {
      modeBadge.textContent = formatMessage('mode_badge', '模式：{mode}', {
        mode: getThemeModeLabel(currentThemeMode)
      });
    }
    recentCards.forEach((card) => {
      if (!card || !card._xActionText || !card._xTitleText) {
        return;
      }
      card._xActionText.textContent = t('visit_label', '访问');
      card.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', {
        title: card._xTitleText
      }));
    });
    if (latestQuery && latestQuery.trim()) {
      renderSuggestions(lastSuggestionResponse, latestQuery);
    }
    if ((!latestQuery || !latestQuery.trim()) && Array.isArray(tabs) && tabs.length > 0) {
      renderTabSuggestions(tabs);
    }
  }


  function applyLanguageMode(mode) {
    currentLanguageMode = mode || 'system';
    const targetLocale = currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(currentLanguageMode);
    if (storageArea) {
      storageArea.get([LANGUAGE_MESSAGES_STORAGE_KEY], (result) => {
        const payload = result[LANGUAGE_MESSAGES_STORAGE_KEY];
        if (payload && payload.locale === targetLocale && payload.messages) {
          currentMessages = payload.messages || {};
          applyLanguageStrings();
          return;
        }
        loadLocaleMessages(targetLocale).then((messages) => {
          currentMessages = messages || {};
          applyLanguageStrings();
        });
      });
      return;
    }
    loadLocaleMessages(targetLocale).then((messages) => {
      currentMessages = messages || {};
      applyLanguageStrings();
    });
  }

  function applyThemeMode(mode) {
    currentThemeMode = mode || 'system';
    const resolved = resolveTheme(mode);
    document.body.setAttribute('data-theme', resolved);
    suggestionItems.forEach((item) => {
      if (item && item._xTheme) {
        applyThemeVariables(item, item._xTheme);
      }
    });
    recentCards.forEach((card) => {
      if (!card || !card._xHost || !card._xTheme) {
        return;
      }
      applyRecentCardTheme(card, card._xTheme, card._xHost);
    });
    applyLanguageStrings();
    updateSelection();
    updateModeBadge(inputParts && inputParts.input ? inputParts.input.value : '');
    refreshFallbackIcons();
    if (mode === 'system' && !mediaListenerAttached) {
      mediaQuery.addEventListener('change', handleMediaChange);
      mediaListenerAttached = true;
      return;
    }
    if (mode !== 'system' && mediaListenerAttached) {
      mediaQuery.removeEventListener('change', handleMediaChange);
      mediaListenerAttached = false;
    }
  }

  function handleMediaChange() {
    if (!storageArea) {
      return;
    }
    storageArea.get([THEME_STORAGE_KEY], (result) => {
      const mode = result[THEME_STORAGE_KEY] || 'system';
      if (mode === 'system') {
        document.body.setAttribute('data-theme', resolveTheme(mode));
      }
    });
  }

  if (storageArea) {
    storageArea.get([THEME_STORAGE_KEY], (result) => {
      applyThemeMode(result[THEME_STORAGE_KEY] || 'system');
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!storageAreaName || areaName !== storageAreaName) {
      return;
    }
    if (changes[THEME_STORAGE_KEY]) {
      applyThemeMode(changes[THEME_STORAGE_KEY].newValue || 'system');
    }
    if (changes[LANGUAGE_STORAGE_KEY]) {
      applyLanguageMode(changes[LANGUAGE_STORAGE_KEY].newValue || 'system');
    }
    if (changes[RECENT_COUNT_STORAGE_KEY]) {
      const nextCount = Number.parseInt(changes[RECENT_COUNT_STORAGE_KEY].newValue, 10);
      currentRecentCount = Number.isFinite(nextCount) ? nextCount : 4;
      loadRecentSites();
    }
    if (changes[RECENT_MODE_STORAGE_KEY]) {
      const nextMode = changes[RECENT_MODE_STORAGE_KEY].newValue;
      currentRecentMode = nextMode === 'most' ? 'most' : 'latest';
      updateRecentHeading();
      loadRecentSites();
    }
    if (changes[LANGUAGE_MESSAGES_STORAGE_KEY]) {
      const payload = changes[LANGUAGE_MESSAGES_STORAGE_KEY].newValue;
      const targetLocale = currentLanguageMode === 'system' ? getSystemLocale() : normalizeLocale(currentLanguageMode);
      if (payload && payload.locale === targetLocale && payload.messages) {
        currentMessages = payload.messages || {};
        applyLanguageStrings();
      }
    }
  });

  if (storageArea) {
    storageArea.get([LANGUAGE_STORAGE_KEY], (result) => {
      applyLanguageMode(result[LANGUAGE_STORAGE_KEY] || 'system');
    });

    storageArea.get([RECENT_COUNT_STORAGE_KEY], (result) => {
      const stored = result[RECENT_COUNT_STORAGE_KEY];
      const count = Number.isFinite(stored) ? stored : 4;
      currentRecentCount = count;
      loadRecentSites();
    });
    storageArea.get([RECENT_MODE_STORAGE_KEY], (result) => {
      const stored = result[RECENT_MODE_STORAGE_KEY];
      const mode = stored === 'most' ? 'most' : 'latest';
      currentRecentMode = mode;
      updateRecentHeading();
      if (stored !== mode) {
        storageArea.set({ [RECENT_MODE_STORAGE_KEY]: mode });
      }
      loadRecentSites();
    });
  }

  function getThemeModeLabel(mode) {
    if (mode === 'dark') {
      return t('theme_label_dark', '深色');
    }
    if (mode === 'light') {
      return t('theme_label_light', '浅色');
    }
    return t('theme_label_system', '跟随系统');
  }

  const commandDefinitions = [
    {
      type: 'commandNewTab',
      primary: '/new',
      aliases: ['/n', '/newtab', '/nt']
    },
    {
      type: 'commandSettings',
      primary: '/settings',
      aliases: ['/set', '/settings', '/s']
    }
  ];

  function getCommandMatch(rawInput) {
    const input = String(rawInput || '').trim().toLowerCase();
    if (!input.startsWith('/')) {
      return null;
    }
    for (let i = 0; i < commandDefinitions.length; i += 1) {
      const command = commandDefinitions[i];
      const tokens = [command.primary].concat(command.aliases || []);
      for (let j = 0; j < tokens.length; j += 1) {
        const token = tokens[j];
        if (token.startsWith(input) || input.startsWith(token)) {
          return {
            command: command,
            completion: command.primary
          };
        }
      }
    }
    return null;
  }

  function buildCommandSuggestion(command) {
    let titleText = '';
    if (command.type === 'commandSettings') {
      titleText = formatMessage('command_settings', '打开 Lumno 设置', {
        name: 'Lumno'
      });
    } else {
      titleText = t('command_newtab', '新建标签页');
    }
    return {
      type: command.type,
      title: titleText,
      url: '',
      commandText: command.primary,
      commandAliases: command.aliases || []
    };
  }

  function updateModeBadge(rawValue) {
    if (!modeBadge) {
      return;
    }
    const shouldShow = isModeCommand(rawValue || '');
    if (!shouldShow) {
      modeBadge.style.setProperty('display', 'none', 'important');
      return;
    }
    modeBadge.textContent = formatMessage('mode_badge', '模式：{mode}', {
      mode: getThemeModeLabel(currentThemeMode)
    });
    modeBadge.style.setProperty('display', 'inline-flex', 'important');
  }

  function getNextThemeMode(mode) {
    const order = ['system', 'light', 'dark'];
    const index = order.indexOf(mode);
    if (index === -1) {
      return 'light';
    }
    return order[(index + 1) % order.length];
  }

  function isModeCommand(input) {
    const raw = String(input || '').trim().toLowerCase();
    return raw === '/mode' || raw.startsWith('/mode ');
  }

  function buildModeSuggestion() {
    const nextMode = getNextThemeMode(currentThemeMode);
    return {
      type: 'modeSwitch',
      title: formatMessage('mode_switch_title', `Lumno：切换到${getThemeModeLabel(nextMode)}模式`, {
        name: 'Lumno',
        mode: getThemeModeLabel(nextMode)
      }),
      url: '',
      favicon: chrome.runtime.getURL('lumno.png'),
      nextMode: nextMode
    };
  }

  function setThemeMode(mode) {
    const nextMode = mode || 'system';
    currentThemeMode = nextMode;
    if (!storageArea) {
      applyThemeMode(nextMode);
      return;
    }
    storageArea.set({ [THEME_STORAGE_KEY]: nextMode }, () => {
      applyThemeMode(nextMode);
      if (isModeCommand(inputParts && inputParts.input ? inputParts.input.value : '')) {
        renderSuggestions([], (inputParts.input.value || '').trim());
      }
    });
  }

  let latestQuery = '';
  let latestRawQuery = '';
  let lastDeletionAt = 0;
  let autocompleteState = null;
  let inlineSearchState = null;
  let isComposing = false;
  let siteSearchState = null;
  let debounceTimer = null;
  let tabs = [];
  let siteSearchProvidersCache = null;
  let pendingProviderReload = false;
  loadDefaultSearchEngineState();
  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (!storageAreaName || areaName !== storageAreaName || !changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY]) {
        return;
      }
      const nextValue = changes[DEFAULT_SEARCH_ENGINE_STORAGE_KEY].newValue;
      if (nextValue && nextValue.id) {
        defaultSearchEngineState = nextValue;
      }
      if (latestQuery && latestQuery.trim()) {
        renderSuggestions(lastSuggestionResponse, latestQuery);
      }
    });
  }
  const SITE_SEARCH_STORAGE_KEY = '_x_extension_site_search_custom_2024_unique_';
  const SITE_SEARCH_DISABLED_STORAGE_KEY = '_x_extension_site_search_disabled_2024_unique_';
  migrateStorageIfNeeded([
    THEME_STORAGE_KEY,
    LANGUAGE_STORAGE_KEY,
    LANGUAGE_MESSAGES_STORAGE_KEY,
    RECENT_MODE_STORAGE_KEY,
    RECENT_COUNT_STORAGE_KEY,
    DEFAULT_SEARCH_ENGINE_STORAGE_KEY,
    SITE_SEARCH_STORAGE_KEY,
    SITE_SEARCH_DISABLED_STORAGE_KEY
  ]);
  let handleTabKey = null;
  const defaultSiteSearchProviders = [
    { key: 'yt', aliases: ['youtube'], name: 'YouTube', template: 'https://www.youtube.com/results?search_query={query}' },
    { key: 'bb', aliases: ['bilibili', 'bili'], name: 'Bilibili', template: 'https://search.bilibili.com/all?keyword={query}' },
    { key: 'gh', aliases: ['github'], name: 'GitHub', template: 'https://github.com/search?q={query}' },
    { key: 'so', aliases: ['baidu', 'bd'], name: '百度', template: 'https://www.baidu.com/s?wd={query}' },
    { key: 'bi', aliases: ['bing'], name: 'Bing', template: 'https://www.bing.com/search?q={query}' },
    { key: 'gg', aliases: ['google'], name: 'Google', template: 'https://www.google.com/search?q={query}' },
    { key: 'zh', aliases: ['zhihu'], name: '知乎', template: 'https://www.zhihu.com/search?q={query}' },
    { key: 'db', aliases: ['douban'], name: '豆瓣', template: 'https://www.douban.com/search?q={query}' },
    { key: 'jd', aliases: ['juejin'], name: '掘金', template: 'https://juejin.cn/search?query={query}' },
    { key: 'tb', aliases: ['taobao'], name: '淘宝', template: 'https://s.taobao.com/search?q={query}' },
    { key: 'tm', aliases: ['tmall'], name: '天猫', template: 'https://list.tmall.com/search_product.htm?q={query}' },
    { key: 'wx', aliases: ['weixin', 'wechat'], name: '微信', template: 'https://weixin.sogou.com/weixin?query={query}' },
    { key: 'tw', aliases: ['twitter', 'x'], name: 'X', template: 'https://x.com/search?q={query}' },
    { key: 'rd', aliases: ['reddit'], name: 'Reddit', template: 'https://www.reddit.com/search/?q={query}' },
    { key: 'wk', aliases: ['wiki', 'wikipedia'], name: 'Wikipedia', template: 'https://en.wikipedia.org/wiki/Special:Search?search={query}' },
    { key: 'zw', aliases: ['zhwiki'], name: '维基百科', template: 'https://zh.wikipedia.org/wiki/Special:Search?search={query}' }
  ];
  const defaultAccentColor = [59, 130, 246];
  const themeColorCache = window._x_extension_theme_color_cache_2024_unique_ || new Map();
  window._x_extension_theme_color_cache_2024_unique_ = themeColorCache;
  const themeHostCache = window._x_extension_theme_host_cache_2024_unique_ || new Map();
  window._x_extension_theme_host_cache_2024_unique_ = themeHostCache;

  function mixColor(color, target, amount) {
    return [
      Math.round(color[0] + (target[0] - color[0]) * amount),
      Math.round(color[1] + (target[1] - color[1]) * amount),
      Math.round(color[2] + (target[2] - color[2]) * amount)
    ];
  }

  function rgbToCss(rgb) {
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  function rgbToCssParts(rgb) {
    return `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
  }

  function parseCssColor(color) {
    if (!color || typeof color !== 'string') {
      return null;
    }
    const trimmed = color.trim().toLowerCase();
    if (trimmed.startsWith('#')) {
      const hex = trimmed.slice(1);
      if (hex.length === 3) {
        const r = parseInt(hex[0] + hex[0], 16);
        const g = parseInt(hex[1] + hex[1], 16);
        const b = parseInt(hex[2] + hex[2], 16);
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          return [r, g, b];
        }
      }
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          return [r, g, b];
        }
      }
      return null;
    }
    const rgbMatch = trimmed.match(/^rgb\(\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)$/);
    if (rgbMatch) {
      const r = Number(rgbMatch[1]);
      const g = Number(rgbMatch[2]);
      const b = Number(rgbMatch[3]);
      if ([r, g, b].every((value) => Number.isFinite(value))) {
        return [r, g, b];
      }
    }
    return null;
  }

  function getHighlightColors(theme) {
    const resolvedTheme = getThemeForMode(theme);
    if (!resolvedTheme || !resolvedTheme._xIsBrand) {
      return {
        bg: 'var(--x-nt-hover-bg, #F3F4F6)',
        border: 'transparent'
      };
    }
    return {
      bg: resolvedTheme.highlightBg,
      border: resolvedTheme.highlightBorder
    };
  }

  function getLuminance(rgb) {
    const [r, g, b] = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function getReadableTextColor(bgRgb) {
    if (!bgRgb || bgRgb.length !== 3) {
      return '#111827';
    }
    const darkText = [17, 24, 39];
    const lightText = [248, 250, 252];
    const bgLum = getLuminance(bgRgb);
    const darkLum = getLuminance(darkText);
    const lightLum = getLuminance(lightText);
    const contrastWithDark = (Math.max(bgLum, darkLum) + 0.05) / (Math.min(bgLum, darkLum) + 0.05);
    const contrastWithLight = (Math.max(bgLum, lightLum) + 0.05) / (Math.min(bgLum, lightLum) + 0.05);
    return contrastWithDark >= contrastWithLight ? '#111827' : '#F8FAFC';
  }

  function normalizeAccentColor(rgb) {
    if (!rgb || rgb.length !== 3) {
      return defaultAccentColor;
    }
    const luminance = getLuminance(rgb);
    if (luminance < 0.12) {
      return mixColor(rgb, [255, 255, 255], 0.55);
    }
    if (luminance > 0.9) {
      return mixColor(rgb, [0, 0, 0], 0.2);
    }
    return rgb;
  }

  function buildThemeVariant(accent, mode) {
    const isDark = mode === 'dark';
    const base = isDark ? [48, 48, 48] : [255, 255, 255];
    const highlightBg = mixColor(accent, base, isDark ? 0.82 : 0.86);
    const highlightBorder = mixColor(accent, base, isDark ? 0.66 : 0.62);
    const markBg = mixColor(accent, base, isDark ? 0.74 : 0.78);
    const tagBg = mixColor(accent, base, isDark ? 0.76 : 0.74);
    const keyBg = mixColor(accent, base, isDark ? 0.88 : 0.9);
    const tagBorder = mixColor(accent, base, isDark ? 0.62 : 0.58);
    const keyBorder = mixColor(accent, base, isDark ? 0.7 : 0.18);
    const buttonBg = mixColor(accent, base, isDark ? 0.8 : 0.94);
    const buttonBorder = mixColor(accent, base, isDark ? 0.68 : 0.7);
    const buttonText = isDark
      ? getReadableTextColor(buttonBg)
      : (getLuminance(accent) > 0.8
        ? rgbToCss(mixColor(accent, [0, 0, 0], 0.6))
        : rgbToCss(accent));
    const placeholderText = isDark
      ? rgbToCss(mixColor(accent, [255, 255, 255], 0.2))
      : buttonText;
    return {
      accent: rgbToCss(accent),
      accentRgb: accent,
      highlightBg: rgbToCss(highlightBg),
      highlightBorder: rgbToCss(highlightBorder),
      markBg: rgbToCss(markBg),
      markText: getReadableTextColor(markBg),
      tagBg: rgbToCss(tagBg),
      tagText: getReadableTextColor(tagBg),
      tagBorder: rgbToCss(tagBorder),
      keyBg: rgbToCss(keyBg),
      keyText: getReadableTextColor(keyBg),
      keyBorder: rgbToCss(keyBorder),
      buttonText: buttonText,
      buttonBg: rgbToCss(buttonBg),
      buttonBorder: rgbToCss(buttonBorder),
      placeholderText: placeholderText
    };
  }

  function buildTheme(rgb) {
    const accent = normalizeAccentColor(rgb);
    return buildThemeVariant(accent, 'light');
  }

  const defaultTheme = buildTheme(defaultAccentColor);
  defaultTheme._xIsDefault = true;
  const urlHighlightTheme = buildTheme(defaultAccentColor);
  urlHighlightTheme._xIsBrand = true;
  urlHighlightTheme._xIsUrl = true;
  const brandAccentMap = {
    'github.com': [36, 41, 46],
    'docs.github.com': [36, 41, 46],
    'douban.com': [0, 181, 29],
    'zhihu.com': [23, 127, 255],
    'bilibili.com': [0, 174, 236],
    'youtube.com': [255, 0, 0],
    'youtu.be': [255, 0, 0],
    'google.com': [66, 133, 244],
    'bing.com': [0, 120, 215],
    'baidu.com': [41, 98, 255],
    'taobao.com': [255, 80, 0],
    'tmall.com': [226, 35, 26],
    'juejin.cn': [30, 128, 255],
    'reddit.com': [255, 69, 0],
    'wikipedia.org': [64, 64, 64],
    'zh.wikipedia.org': [64, 64, 64],
    'x.com': [17, 24, 39],
    'twitter.com': [29, 161, 242]
  };

  function getBrandAccentForHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) {
      return null;
    }
    if (brandAccentMap[host]) {
      return brandAccentMap[host];
    }
    const entry = Object.keys(brandAccentMap).find((key) => host === key || host.endsWith(`.${key}`));
    return entry ? brandAccentMap[entry] : null;
  }

  function getBrandAccentForUrl(url) {
    if (!url) {
      return null;
    }
    try {
      const hostname = normalizeHost(new URL(url).hostname);
      return getBrandAccentForHost(hostname);
    } catch (e) {
      return null;
    }
  }

  function hashStringToHue(value) {
    if (!value) {
      return 0;
    }
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 360;
  }

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;
    if (hp >= 0 && hp < 1) {
      r = c; g = x; b = 0;
    } else if (hp >= 1 && hp < 2) {
      r = x; g = c; b = 0;
    } else if (hp >= 2 && hp < 3) {
      r = 0; g = c; b = x;
    } else if (hp >= 3 && hp < 4) {
      r = 0; g = x; b = c;
    } else if (hp >= 4 && hp < 5) {
      r = x; g = 0; b = c;
    } else if (hp >= 5 && hp < 6) {
      r = c; g = 0; b = x;
    }
    const m = l - c / 2;
    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255)
    ];
  }

  function buildFallbackThemeForHost(hostname) {
    if (!hostname) {
      return null;
    }
    const hue = hashStringToHue(hostname);
    const accent = hslToRgb(hue, 0.55, 0.52);
    const theme = buildTheme(accent);
    theme._xIsBrand = true;
    theme._xIsFallback = true;
    return theme;
  }

  function getHostFromUrl(url) {
    if (!url) {
      return '';
    }
    try {
      return normalizeHost(new URL(url).hostname);
    } catch (e) {
      return '';
    }
  }

  function normalizeHost(hostname) {
    if (!hostname) {
      return '';
    }
    const lower = String(hostname).toLowerCase();
    const stripped = lower.replace(/^www\./i, '');
    if (stripped === 'my.feishu.cn') {
      return 'feishu.cn';
    }
    return stripped;
  }

  function normalizeFaviconHost(hostname) {
    if (!hostname) {
      return '';
    }
    const host = String(hostname).toLowerCase().replace(/^www\./i, '');
    if (host === 'feishu.cn' || host.endsWith('.feishu.cn')) {
      return 'feishu.cn';
    }
    return host;
  }

  function isFaviconProxyUrl(url) {
    if (!url) {
      return false;
    }
    return /google\.com\/s2\/favicons/i.test(url) || /gstatic\.com\/favicon/i.test(url);
  }

  const newtabThemeStyle = document.createElement('style');
  newtabThemeStyle.id = '_x_extension_newtab_theme_style_2024_unique_';
  newtabThemeStyle.textContent = `
    #_x_extension_newtab_root_2024_unique_ {
      color: var(--x-nt-text, #111827);
    }
    #_x_extension_newtab_search_input_2024_unique_::placeholder {
      color: var(--x-nt-placeholder, #9CA3AF);
    }
    #_x_extension_newtab_search_input_2024_unique_::selection {
      background: #CFE8FF;
      color: #1E3A8A;
    }
  `;
  document.head.appendChild(newtabThemeStyle);

  function extractAverageColor(image) {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }
    try {
      context.drawImage(image, 0, 0, size, size);
      const data = context.getImageData(0, 0, size, size).data;
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3];
        if (alpha < 32) {
          continue;
        }
        const red = data[i];
        const green = data[i + 1];
        const blue = data[i + 2];
        const brightness = (red + green + blue) / 3;
        if (brightness > 245) {
          continue;
        }
        r += red;
        g += green;
        b += blue;
        count += 1;
      }
      if (!count) {
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3];
          if (alpha < 32) {
            continue;
          }
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
      }
      if (!count) {
        return null;
      }
      return [
        Math.round(r / count),
        Math.round(g / count),
        Math.round(b / count)
      ];
    } catch (e) {
      return null;
    }
  }

  function getThemeFromUrl(url, hostOverride) {
    if (!url) {
      return Promise.resolve(defaultTheme);
    }
    const hostKey = hostOverride || getHostFromUrl(url);
    const isProxy = isFaviconProxyUrl(url);
    const useHostCache = hostKey && (!isProxy || Boolean(hostOverride));
    if (useHostCache && themeHostCache.has(hostKey)) {
      return Promise.resolve(themeHostCache.get(hostKey));
    }
    if (themeColorCache.has(url)) {
      return Promise.resolve(themeColorCache.get(url));
    }
    const brandAccent = (isProxy && hostOverride) ? null : getBrandAccentForUrl(url);
    if (brandAccent) {
      const brandTheme = buildTheme(brandAccent);
      brandTheme._xIsBrand = true;
      themeColorCache.set(url, brandTheme);
      if (useHostCache) {
        themeHostCache.set(hostKey, brandTheme);
      }
      return Promise.resolve(brandTheme);
    }
    const cachedFaviconData = faviconDataCache.get(url);
    if (cachedFaviconData) {
      return new Promise((resolve) => {
        const image = new Image();
        image.onload = function() {
          const avg = extractAverageColor(image);
          if (!avg) {
            themeColorCache.set(url, defaultTheme);
            resolve(defaultTheme);
            return;
          }
          const theme = buildTheme(avg);
          theme._xIsBrand = true;
          themeColorCache.set(url, theme);
          if (useHostCache) {
            themeHostCache.set(hostKey, theme);
          }
          resolve(theme);
        };
        image.onerror = function() {
          themeColorCache.set(url, defaultTheme);
          resolve(defaultTheme);
        };
        image.src = cachedFaviconData;
      });
    }
    if (isProxy) {
      return requestFaviconData(url).then((dataUrl) => {
        if (!dataUrl) {
          themeColorCache.set(url, defaultTheme);
          return defaultTheme;
        }
        return new Promise((resolve) => {
          const image = new Image();
          image.onload = function() {
            const avg = extractAverageColor(image);
            if (!avg) {
              themeColorCache.set(url, defaultTheme);
              resolve(defaultTheme);
              return;
            }
            const theme = buildTheme(avg);
            theme._xIsBrand = true;
            themeColorCache.set(url, theme);
            if (useHostCache) {
              themeHostCache.set(hostKey, theme);
            }
            resolve(theme);
          };
          image.onerror = function() {
            themeColorCache.set(url, defaultTheme);
            resolve(defaultTheme);
          };
          image.src = dataUrl;
        });
      });
    }
    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = function() {
        const avg = extractAverageColor(image);
        if (!avg) {
          themeColorCache.set(url, defaultTheme);
          resolve(defaultTheme);
          return;
        }
        const theme = buildTheme(avg);
        theme._xIsBrand = true;
        themeColorCache.set(url, theme);
        if (useHostCache) {
          themeHostCache.set(hostKey, theme);
        }
        resolve(theme);
      };
      image.onerror = function() {
        themeColorCache.set(url, defaultTheme);
        resolve(defaultTheme);
      };
      image.src = url;
    });
  }

  function getThemeForProvider(provider) {
    if (provider && provider.template) {
      const brandAccent = getBrandAccentForUrl(provider.template);
      if (brandAccent) {
        const brandTheme = buildTheme(brandAccent);
        brandTheme._xIsBrand = true;
        return Promise.resolve(brandTheme);
      }
    }
    return getThemeFromUrl(getProviderIcon(provider));
  }

  function shouldUseBrandTheme(suggestion) {
    if (!suggestion) {
      return false;
    }
  const neutralTypes = ['googleSuggest', 'newtab', 'modeSwitch', 'chatgpt', 'perplexity', 'commandNewTab', 'commandSettings'];
    if (neutralTypes.includes(suggestion.type)) {
      return false;
    }
    return true;
  }

  function getThemeForSuggestion(suggestion) {
    if (!shouldUseBrandTheme(suggestion)) {
      return Promise.resolve(defaultTheme);
    }
    if (suggestion && suggestion.provider) {
      return getThemeForProvider(suggestion.provider);
    }
    if (suggestion && suggestion.url) {
      const brandAccent = getBrandAccentForUrl(suggestion.url);
      if (brandAccent) {
        const brandTheme = buildTheme(brandAccent);
        brandTheme._xIsBrand = true;
        return Promise.resolve(brandTheme);
      }
    }
    const hostKey = suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : '';
    return getThemeFromUrl(getThemeSourceForSuggestion(suggestion), hostKey).then((theme) => {
      if (theme && !theme._xIsDefault) {
        return theme;
      }
      const fallback = buildFallbackThemeForHost(hostKey);
      return fallback || theme;
    });
  }

  function getImmediateThemeForSuggestion(suggestion) {
    if (!shouldUseBrandTheme(suggestion)) {
      return defaultTheme;
    }
    if (suggestion && suggestion.provider) {
      const brandAccent = getBrandAccentForUrl(suggestion.provider.template);
      if (brandAccent) {
        const brandTheme = buildTheme(brandAccent);
        brandTheme._xIsBrand = true;
        return brandTheme;
      }
    }
    if (suggestion && suggestion.url) {
      const hostKey = getHostFromUrl(suggestion.url);
      if (hostKey && themeHostCache.has(hostKey)) {
        return themeHostCache.get(hostKey);
      }
      if (themeColorCache.has(suggestion.url)) {
        return themeColorCache.get(suggestion.url);
      }
      const brandAccent = getBrandAccentForUrl(suggestion.url);
      if (brandAccent) {
        const brandTheme = buildTheme(brandAccent);
        brandTheme._xIsBrand = true;
        return brandTheme;
      }
      const fallbackTheme = buildFallbackThemeForHost(hostKey);
      if (fallbackTheme) {
        return fallbackTheme;
      }
    }
    return null;
  }

  function isNewtabDarkMode() {
    return document.body.getAttribute('data-theme') === 'dark';
  }

  function getThemeForMode(theme) {
    if (!theme) {
      return defaultTheme;
    }
    if (!isNewtabDarkMode()) {
      return theme;
    }
    if (theme._xDark) {
      return theme._xDark;
    }
    const accentRgb = theme.accentRgb || parseCssColor(theme.accent) || defaultAccentColor;
    const darkTheme = buildThemeVariant(accentRgb, 'dark');
    darkTheme._xIsDefault = Boolean(theme._xIsDefault);
    darkTheme._xIsBrand = Boolean(theme._xIsBrand);
    theme._xDark = darkTheme;
    return darkTheme;
  }

  function getHoverColors(theme) {
    const resolvedTheme = getThemeForMode(theme);
    const accentRgb = resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent) || defaultAccentColor;
    const isDark = isNewtabDarkMode();
    const base = isDark ? [48, 48, 48] : [255, 255, 255];
    return {
      bg: rgbToCss(mixColor(accentRgb, base, isDark ? 0.6 : 0.9)),
      border: rgbToCss(mixColor(accentRgb, base, isDark ? 0.4 : 0.72))
    };
  }

  function applyThemeVariables(target, theme) {
    if (!target || !theme) {
      return;
    }
    const resolvedTheme = getThemeForMode(theme);
    target.style.setProperty('--x-ext-mark-bg', resolvedTheme.markBg, 'important');
    target.style.setProperty('--x-ext-mark-text', resolvedTheme.markText, 'important');
    target.style.setProperty('--x-ext-tag-bg', resolvedTheme.tagBg, 'important');
    target.style.setProperty('--x-ext-tag-text', resolvedTheme.tagText, 'important');
    target.style.setProperty('--x-ext-tag-border', resolvedTheme.tagBorder, 'important');
    target.style.setProperty('--x-ext-key-bg', resolvedTheme.keyBg, 'important');
    target.style.setProperty('--x-ext-key-text', resolvedTheme.keyText, 'important');
    target.style.setProperty('--x-ext-key-border', resolvedTheme.keyBorder, 'important');
    target.style.setProperty('--x-ext-icon-color', resolvedTheme.accent, 'important');
  }

  function applyMarkVariables(target, theme) {
    if (!target || !theme) {
      return;
    }
    const resolvedTheme = getThemeForMode(theme);
    target.style.setProperty('--x-ext-mark-bg', resolvedTheme.markBg, 'important');
    target.style.setProperty('--x-ext-mark-text', resolvedTheme.markText, 'important');
  }

  const iconPreloadCache = new Map();
  const faviconDataCache = new Map();
  const faviconDataPending = new Map();
  const missingIconCache = new Set();

  function reportMissingIcon(context, url, iconUrl) {
    const key = `${context || 'unknown'}::${url || ''}::${iconUrl || ''}`;
    if (missingIconCache.has(key)) {
      return;
    }
    missingIconCache.add(key);
    console.warn('[Lumno] icon missing', {
      context: context || 'unknown',
      url: url || '',
      icon: iconUrl || ''
    });
  }

  function ensureFallbackIconNode(img) {
    if (!img || !img.parentElement) {
      return null;
    }
    let node = img.parentElement.querySelector('._x_extension_favicon_fallback_2024_unique_');
    if (node) {
      return node;
    }
    node = document.createElement('span');
    node.className = '_x_extension_favicon_fallback_2024_unique_';
    node.style.cssText = `
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: ${img.clientWidth || 25}px !important;
      height: ${img.clientHeight || 25}px !important;
      border-radius: 6px !important;
      background: var(--x-nt-tag-bg, #F3F4F6) !important;
      color: var(--x-nt-tag-text, #6B7280) !important;
      box-sizing: border-box !important;
      padding: 3px !important;
      margin: 0 !important;
      flex-shrink: 0 !important;
    `;
    node.innerHTML = getRiSvg('ri-link-m', 'ri-size-14');
    img.parentElement.insertBefore(node, img.nextSibling);
    return node;
  }

  function applyFallbackIcon(img) {
    if (!img) {
      return;
    }
    const node = ensureFallbackIconNode(img);
    img.setAttribute('data-fallback-icon', 'true');
    img.style.setProperty('display', 'none', 'important');
    if (node) {
      node.style.setProperty('display', 'inline-flex', 'important');
      return;
    }
    // Some local-network entries fallback before the image is attached to DOM.
    // Retry once on next tick so the fallback icon can be mounted after attach.
    setTimeout(() => {
      if (!img || !img.isConnected) {
        return;
      }
      const delayedNode = ensureFallbackIconNode(img);
      if (delayedNode) {
        delayedNode.style.setProperty('display', 'inline-flex', 'important');
      }
    }, 0);
  }

  function refreshFallbackIcons() {
    document.querySelectorAll('img[data-fallback-icon=\"true\"]').forEach((img) => {
      const node = ensureFallbackIconNode(img);
      if (node) {
        node.style.setProperty('display', 'inline-flex', 'important');
      }
      img.style.setProperty('display', 'none', 'important');
    });
  }
  const recentActionOffsetUpdaters = new Set();
  let recentActionResizeBound = false;
  const recentActionObservers = new WeakMap();

  function requestFaviconData(url) {
    if (!url || url.startsWith('data:')) {
      return Promise.resolve(null);
    }
    if (faviconDataCache.has(url)) {
      return Promise.resolve(faviconDataCache.get(url));
    }
    if (faviconDataPending.has(url)) {
      return faviconDataPending.get(url);
    }
    const promise = new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getFaviconData', url: url }, (response) => {
        const dataUrl = response && response.data ? response.data : '';
        if (dataUrl) {
          faviconDataCache.set(url, dataUrl);
        }
        faviconDataPending.delete(url);
        resolve(dataUrl || null);
      });
    });
    faviconDataPending.set(url, promise);
    return promise;
  }

  function attachFaviconData(img, url, hostOverride) {
    if (!img || !url) {
      return;
    }
    const cached = faviconDataCache.get(url);
    if (cached) {
      img.src = cached;
      preloadThemeFromFavicon(url, cached, hostOverride);
      return;
    }
    requestFaviconData(url).then((dataUrl) => {
      if (!dataUrl || !img.isConnected) {
        return;
      }
      img.src = dataUrl;
      preloadThemeFromFavicon(url, dataUrl, hostOverride);
    });
  }

  function preloadThemeFromFavicon(url, dataUrl, hostOverride) {
    if (!url || themeColorCache.has(url)) {
      return;
    }
    const hostKey = hostOverride || getHostFromUrl(url);
    const useHostCache = hostKey && (Boolean(hostOverride) || !isFaviconProxyUrl(url));
    if (useHostCache && themeHostCache.has(hostKey)) {
      return;
    }
    if (!dataUrl) {
      return;
    }
    const image = new Image();
    image.onload = function() {
      const avg = extractAverageColor(image);
      if (!avg) {
        return;
      }
      const theme = buildTheme(avg);
      theme._xIsBrand = true;
      themeColorCache.set(url, theme);
      if (useHostCache) {
        themeHostCache.set(hostKey, theme);
      }
    };
    image.onerror = function() {};
    image.src = dataUrl;
  }

  function preloadIcon(url) {
    if (!url || url.startsWith('data:') || iconPreloadCache.has(url)) {
      return;
    }
    const host = getHostFromUrl(url);
    if (host && isLocalNetworkHost(host)) {
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.src = url;
    iconPreloadCache.set(url, img);
  }

  function warmIconCache(list) {
    if (!Array.isArray(list)) {
      return;
    }
    list.forEach((item) => {
      if (!item) {
        return;
      }
      const skipType = item.type === 'browserPage' ||
        item.type === 'directUrl' ||
        item.type === 'newtab' ||
        item.type === 'googleSuggest';
      if (item.favicon && !skipType) {
        preloadIcon(item.favicon);
        const hostKey = item && item.url ? getHostFromUrl(item.url) : '';
        requestFaviconData(item.favicon).then((dataUrl) => {
          if (dataUrl) {
            preloadThemeFromFavicon(item.favicon, dataUrl, hostKey);
          }
        });
      }
      const hostKeyForTheme = item && item.url ? getHostFromUrl(item.url) : '';
      if (hostKeyForTheme && !themeHostCache.has(hostKeyForTheme)) {
        const themeIcon = getGoogleFaviconUrl(hostKeyForTheme);
        if (themeIcon) {
          requestFaviconData(themeIcon).then((dataUrl) => {
            if (dataUrl) {
              preloadThemeFromFavicon(themeIcon, dataUrl, hostKeyForTheme);
            }
          });
        }
      }
    });
  }

  function createSearchIcon() {
    const icon = document.createElement('span');
    icon.innerHTML = getRiSvg('ri-search-line', 'ri-size-16');
    icon.style.cssText = `
      all: unset !important;
      width: 16px !important;
      height: 16px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      background: transparent !important;
      color: inherit !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
    `;
    return icon;
  }

  function createLinkIcon() {
    const icon = document.createElement('span');
    icon.innerHTML = getRiSvg('ri-link-m', 'ri-size-16');
    icon.style.cssText = `
      all: unset !important;
      width: 16px !important;
      height: 16px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      background: transparent !important;
      color: inherit !important;
      font-size: 100% !important;
      font: inherit !important;
      vertical-align: baseline !important;
    `;
    return icon;
  }

  function getNonFaviconIconBg() {
    return isNewtabDarkMode() ? 'rgba(255, 255, 255, 0.12)' : '#FFFFFF';
  }

  function setNonFaviconIconBg(item, isActive) {
    if (!item || !item._xIconWrap || item._xIconIsFavicon) {
      return;
    }
    item._xIconWrap.style.setProperty(
      'background-color',
      isActive ? getNonFaviconIconBg() : 'transparent',
      'important'
    );
  }

  const FAVICON_GOOGLE_SIZE = 128;

  function getThemeSourceForSuggestion(suggestion) {
    if (suggestion && suggestion.url) {
      try {
        const hostname = normalizeHost(new URL(suggestion.url).hostname);
        if (hostname) {
          return getGoogleFaviconUrl(hostname);
        }
      } catch (e) {
        // Ignore malformed URLs.
      }
    }
    return suggestion && suggestion.favicon ? suggestion.favicon : '';
  }

  function getSiteFaviconUrl(hostname) {
    if (!hostname) {
      return '';
    }
    return `https://${hostname}/favicon.ico`;
  }

  function createActionTag(labelText, keyLabel) {
    const tag = document.createElement('span');
    tag.style.cssText = `
      all: unset !important;
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      background: var(--x-ext-tag-bg, #EEF6FF) !important;
      color: var(--x-ext-tag-text, #1E3A8A) !important;
      border: 1px solid var(--x-ext-tag-border, #BFDBFE) !important;
      padding: 4px 10px 4px 8px !important;
      border-radius: 999px !important;
      font-size: 11px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      line-height: 1 !important;
      text-decoration: none !important;
      list-style: none !important;
      outline: none !important;
      box-sizing: border-box !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
    `;

    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.cssText = `
      all: unset !important;
      font-weight: 500 !important;
      line-height: 1 !important;
    `;

    const keycap = document.createElement('span');
    keycap.textContent = keyLabel;
    keycap.style.cssText = `
      all: unset !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 2px 7px !important;
      border-radius: 6px !important;
      background: var(--x-ext-key-bg, #FFFFFF) !important;
      color: var(--x-ext-key-text, #1E3A8A) !important;
      border: 1px solid var(--x-ext-key-border, #BFDBFE) !important;
      box-shadow: 0 1px 0 rgba(0, 0, 0, 0.12) !important;
      font-size: 10px !important;
      font-weight: 500 !important;
      line-height: 1 !important;
    `;

    tag.appendChild(label);
    tag.appendChild(keycap);
    return tag;
  }

  function navigateToUrl(url) {
    if (!url) {
      return;
    }
    if (chrome.tabs && chrome.tabs.getCurrent) {
      chrome.tabs.getCurrent(function(tab) {
        if (chrome.runtime.lastError) {
          window.location.href = url;
          return;
        }
        if (tab && tab.id) {
          chrome.tabs.update(tab.id, { url: url });
        } else {
          window.location.href = url;
        }
      });
    } else {
      window.location.href = url;
    }
  }

  function markCurrentTabForSearchTracking() {
    if (!chrome || !chrome.tabs || !chrome.tabs.getCurrent || !chrome.runtime || !chrome.runtime.sendMessage) {
      return;
    }
    chrome.tabs.getCurrent((tab) => {
      if (tab && typeof tab.id === 'number') {
        chrome.runtime.sendMessage({ action: 'trackSearchTab', tabId: tab.id });
      }
    });
  }

  function runBrowserSearch(query, disposition, onFail) {
    if (chrome && chrome.search && typeof chrome.search.query === 'function') {
      try {
        chrome.search.query({ text: query, disposition: disposition || 'CURRENT_TAB' }, () => {
          if (chrome.runtime && chrome.runtime.lastError && typeof onFail === 'function') {
            onFail();
          }
        });
        return true;
      } catch (e) {
        if (typeof onFail === 'function') {
          onFail();
        }
        return false;
      }
    }
    return false;
  }

  function navigateToQuery(query, forceSearch) {
    const directUrl = !forceSearch ? getDirectNavigationUrl(query) : '';
    let targetUrl = query;
    if (directUrl) {
      navigateToUrl(directUrl);
      return;
    }
    markCurrentTabForSearchTracking();
    const attempted = runBrowserSearch(query, 'CURRENT_TAB', () => {
      const fallbackUrl = buildDefaultSearchUrl(query);
      navigateToUrl(fallbackUrl);
    });
    if (attempted) {
      return;
    }
    targetUrl = buildDefaultSearchUrl(query);
    navigateToUrl(targetUrl);
  }

  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.id = '_x_extension_newtab_suggestions_container_2024_unique_';
  suggestionsContainer.style.cssText = `
    all: unset !important;
    width: 100% !important;
    margin-top: 8px !important;
    position: relative !important;
    z-index: 3 !important;
    background: var(--x-nt-suggestions-bg, #FFFFFF) !important;
    border-radius: 20px !important;
    border: 1px solid var(--x-nt-suggestions-border, rgba(0, 0, 0, 0.06)) !important;
    box-shadow: var(--x-nt-suggestions-shadow, 0 18px 44px rgba(0, 0, 0, 0.08)) !important;
    padding: 8px !important;
    box-sizing: border-box !important;
    display: none !important;
    max-height: calc(100vh - 220px) !important;
    overflow-y: auto !important;
    overscroll-behavior: contain !important;
    opacity: 0 !important;
    visibility: hidden !important;
    pointer-events: none !important;
    transform: translateY(-4px) !important;
    transition: opacity 0.12s ease, transform 0.12s ease !important;
    line-height: 1 !important;
    text-decoration: none !important;
    list-style: none !important;
    outline: none !important;
    color: inherit !important;
    font-size: 100% !important;
    font: inherit !important;
    vertical-align: baseline !important;
  `;

  const recentSection = document.createElement('section');
  recentSection.id = '_x_extension_newtab_recent_sites_2024_unique_';
  recentSection.style.setProperty('display', 'none', 'important');
  const recentHeading = document.createElement('div');
  recentHeading.className = 'x-nt-recent-heading';
  updateRecentHeading();
  const recentGrid = document.createElement('div');
  recentGrid.id = '_x_extension_newtab_recent_sites_grid_2024_unique_';
  recentSection.appendChild(recentHeading);
  recentSection.appendChild(recentGrid);

  function renderRecentSites(items) {
    recentGrid.innerHTML = '';
    if (!Array.isArray(items) || items.length === 0) {
      recentSection.style.setProperty('display', 'none', 'important');
      return;
    }
    items.forEach((item, index) => {
      const card = buildRecentSiteCard(item, index);
      if (card) {
        recentGrid.appendChild(card);
      }
    });
    recentSection.style.setProperty('display', 'flex', 'important');
  }

  function loadRecentSites() {
    if (!currentRecentCount || currentRecentCount <= 0) {
      recentSection.style.setProperty('display', 'none', 'important');
      return;
    }
    getRecentSites(currentRecentCount, currentRecentMode).then((items) => {
      renderRecentSites(items);
    });
  }

  function handleRecentVisibilityChange() {
    if (document.visibilityState === 'visible') {
      loadRecentSites();
    }
  }

  function setSuggestionsVisible(visible) {
    suggestionsContainer.style.setProperty('display', visible ? 'block' : 'none', 'important');
    suggestionsContainer.style.setProperty('margin-top', visible ? '8px' : '0', 'important');
    suggestionsContainer.style.setProperty('opacity', visible ? '1' : '0', 'important');
    suggestionsContainer.style.setProperty('visibility', visible ? 'visible' : 'hidden', 'important');
    suggestionsContainer.style.setProperty('pointer-events', visible ? 'auto' : 'none', 'important');
    suggestionsContainer.style.setProperty('transform', visible ? 'translateY(0)' : 'translateY(-4px)', 'important');
  }

  function isEnglishQuery(query) {
    if (!query) {
      return false;
    }
    if (!/[A-Za-z]/.test(query)) {
      return false;
    }
    return /^[A-Za-z0-9\s._/-]+$/.test(query);
  }

  function getUrlDisplay(url) {
    if (!url) {
      return '';
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./i, '');
      const path = parsed.pathname === '/' ? '' : parsed.pathname;
      return `${host}${path}${parsed.search || ''}${parsed.hash || ''}`;
    } catch (e) {
      return url;
    }
  }

  function isRestrictedUrl(url) {
    if (!url) {
      return true;
    }
    const lower = String(url).toLowerCase();
    if (lower.startsWith('chrome://') ||
      lower.startsWith('chrome-extension://') ||
      lower.startsWith('edge://') ||
      lower.startsWith('brave://') ||
      lower.startsWith('vivaldi://') ||
      lower.startsWith('opera://') ||
      lower.startsWith('about:')) {
      return true;
    }
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      const path = parsed.pathname.toLowerCase();
      if ((host === 'chrome.google.com' && path.startsWith('/webstore')) ||
          host === 'chromewebstore.google.com' ||
          (host === 'microsoftedge.microsoft.com' && path.startsWith('/addons')) ||
          host === 'addons.opera.com') {
        return true;
      }
    } catch (e) {
      return true;
    }
    return false;
  }

  function getChromeFaviconUrl(url) {
    if (!url) {
      return '';
    }
    if (location && location.protocol === 'chrome-extension:') {
      return '';
    }
    return `chrome://favicon2/?size=128&scale_factor=2x&show_fallback_monogram=1&url=${encodeURIComponent(url)}`;
  }

  function getGoogleFaviconUrl(hostname) {
    const normalized = normalizeFaviconHost(hostname);
    if (!normalized) {
      return '';
    }
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(normalized)}&sz=${FAVICON_GOOGLE_SIZE}`;
  }

  function isLocalNetworkHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (!host) {
      return false;
    }
    if (host === 'localhost' || host.endsWith('.local')) {
      return true;
    }
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
      const parts = host.split('.').map((part) => Number(part));
      if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
        return false;
      }
      if (parts[0] === 10 || parts[0] === 127) {
        return true;
      }
      if (parts[0] === 192 && parts[1] === 168) {
        return true;
      }
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
        return true;
      }
      return false;
    }
    return false;
  }

  function attachFaviconWithFallbacks(img, url, host) {
    if (!img || !url) {
      return;
    }
    const hostKey = host || getHostFromUrl(url);
    if (isLocalNetworkHost(hostKey)) {
      applyFallbackIcon(img);
      return;
    }
    const faviconHostKey = normalizeFaviconHost(hostKey);
    const chromeFavicon = getChromeFaviconUrl(url);
    const siteSvgFavicon = faviconHostKey ? `https://${faviconHostKey}/favicon.svg` : '';
    const siteIcoFavicon = faviconHostKey ? `https://${faviconHostKey}/favicon.ico` : '';
    const googleFavicon = faviconHostKey ? getGoogleFaviconUrl(faviconHostKey) : '';
    const fallbackCandidates = [chromeFavicon, googleFavicon, siteSvgFavicon, siteIcoFavicon].filter(Boolean);
    const quickSrc = fallbackCandidates[0] || '';
    const tried = new Set();
    const trySetDirect = (nextSrc) => {
      if (!nextSrc || !img) {
        return false;
      }
      if (tried.has(nextSrc)) {
        return false;
      }
      tried.add(nextSrc);
      img.src = nextSrc;
      if (nextSrc === googleFavicon) {
        attachFaviconData(img, googleFavicon, hostKey);
      }
      return true;
    };
    if (!trySetDirect(quickSrc)) {
      applyFallbackIcon(img);
      return;
    }
    img.onerror = function() {
      const nextFallback = fallbackCandidates.find((candidate) => !tried.has(candidate));
      if (!trySetDirect(nextFallback)) {
        applyFallbackIcon(img);
      }
    };

    // Improve icon quality in background without blocking first paint.
    const tryUpgradeCandidates = (candidateUrls) => {
      const unique = Array.from(new Set((candidateUrls || []).filter(Boolean)));
      const upgrades = unique.filter((candidate) => candidate && candidate !== img.src);
      if (upgrades.length === 0) {
        return;
      }
      const loadNext = (index) => {
        if (!img || !img.isConnected || index >= upgrades.length) {
          return;
        }
        const candidate = upgrades[index];
        const probe = new Image();
        probe.referrerPolicy = 'no-referrer';
        probe.onload = () => {
          if (!img || !img.isConnected) {
            return;
          }
          img.src = candidate;
          if (candidate === googleFavicon) {
            attachFaviconData(img, googleFavicon, hostKey);
          }
        };
        probe.onerror = () => {
          loadNext(index + 1);
        };
        probe.src = candidate;
      };
      loadNext(0);
    };
    chrome.runtime.sendMessage(
      { action: 'resolveFaviconCandidates', url: url, host: hostKey, fallbackUrl: '' },
      (response) => {
        const resolved = response && Array.isArray(response.urls) ? response.urls : [];
        tryUpgradeCandidates([...resolved, ...fallbackCandidates]);
      }
    );
  }

  function getRecentSites(limit, mode) {
    return new Promise((resolve) => {
      function loadLatestRecentSites() {
        if (!chrome.history || !chrome.history.search) {
          resolve([]);
          return;
        }
        chrome.history.search({
          text: '',
          maxResults: 60,
          startTime: Date.now() - 1000 * 60 * 60 * 24 * 30
        }, (items) => {
          if (chrome.runtime.lastError || !Array.isArray(items)) {
            resolve([]);
            return;
          }
          const results = [];
          const seenHosts = new Set();
          for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            const url = item && item.url ? String(item.url) : '';
            if (!url || isRestrictedUrl(url)) {
              continue;
            }
            let host = '';
            try {
              host = normalizeHost(new URL(url).hostname);
            } catch (e) {
              continue;
            }
            if (!host || seenHosts.has(host)) {
              continue;
            }
            seenHosts.add(host);
            results.push({
              title: item.title || host,
              url: url,
              host: host,
              lastVisitTime: item.lastVisitTime || 0
            });
            if (results.length >= limit) {
              break;
            }
          }
          if (results.length >= limit || !chrome.topSites || !chrome.topSites.get) {
            resolve(results);
            return;
          }
          chrome.topSites.get((topSites) => {
            if (!Array.isArray(topSites)) {
              resolve(results);
              return;
            }
            for (let i = 0; i < topSites.length; i += 1) {
              const item = topSites[i];
              const url = item && item.url ? String(item.url) : '';
              if (!url || isRestrictedUrl(url)) {
                continue;
              }
              let host = '';
              try {
                host = normalizeHost(new URL(url).hostname);
              } catch (e) {
                continue;
              }
              if (!host || seenHosts.has(host)) {
                continue;
              }
              seenHosts.add(host);
              results.push({
                title: item.title || host,
                url: url,
                host: host,
                lastVisitTime: 0
              });
              if (results.length >= limit) {
                break;
              }
            }
            resolve(results);
          });
        });
      }

      const viewMode = mode === 'most' ? 'most' : 'latest';
      if (viewMode === 'most') {
        if (!chrome.topSites || !chrome.topSites.get) {
          loadLatestRecentSites();
          return;
        }
        chrome.topSites.get((topSites) => {
          if (!Array.isArray(topSites)) {
            loadLatestRecentSites();
            return;
          }
          const results = [];
          const seenHosts = new Set();
          for (let i = 0; i < topSites.length; i += 1) {
            const item = topSites[i];
            const url = item && item.url ? String(item.url) : '';
            if (!url || isRestrictedUrl(url)) {
              continue;
            }
            let host = '';
            try {
              host = normalizeHost(new URL(url).hostname);
            } catch (e) {
              continue;
            }
            if (!host || seenHosts.has(host)) {
              continue;
            }
            seenHosts.add(host);
            results.push({
              title: item.title || host,
              url: url,
              host: host,
              lastVisitTime: 0,
              visitCount: 0
            });
            if (results.length >= limit) {
              break;
            }
          }
          if (results.length === 0) {
            loadLatestRecentSites();
            return;
          }
          resolve(results);
        });
        return;
      }

      loadLatestRecentSites();
    });
  }

  function getSiteDisplayName(hostname, title) {
    const rawTitle = String(title || '').trim();
    const host = String(hostname || '').toLowerCase().replace(/^(www|m)\./i, '');
    const brandMap = {
      'github.com': 'GitHub',
      'youtube.com': 'YouTube',
      'google.com': 'Google',
      'weibo.com': '微博',
      'x.com': 'X',
      'twitter.com': 'X',
      'immersivetranslate.com': 'Immersive Translate',
      'abouttrans.info': 'aboutTrans',
      'aboutrans.info': 'aboutTrans'
    };
    const suffixes = new Set([
      'co.uk', 'org.uk', 'gov.uk', 'ac.uk',
      'com.cn', 'net.cn', 'org.cn', 'gov.cn',
      'com.hk', 'com.tw', 'com.au', 'com.sg',
      'co.jp', 'co.kr'
    ]);
    const noisySubdomains = new Set([
      'onboarding', 'login', 'signin', 'auth', 'account',
      'web', 'app', 'admin', 'stage', 'staging', 'preview', 'dev'
    ]);
    const separators = [' | ', ' - ', ' — ', ' – ', ' · ', ' • ', '：', ':'];

    function getPrimaryLabelFromHost(hostValue) {
      if (!hostValue) {
        return '';
      }
      const parts = hostValue.split('.').filter(Boolean);
      if (parts.length === 0) {
        return '';
      }
      if (parts.length === 1) {
        return parts[0];
      }
      const tail2 = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
      const index = suffixes.has(tail2) && parts.length >= 3 ? parts.length - 3 : parts.length - 2;
      return parts[index] || parts[0];
    }

    function prettifyLabel(label) {
      const value = String(label || '').trim();
      if (!value) {
        return '';
      }
      if (value.length === 1) {
        return value.toUpperCase();
      }
      if (/^[a-z]+$/.test(value)) {
        return value.charAt(0).toUpperCase() + value.slice(1);
      }
      return value;
    }

    function pickTitleCandidate() {
      if (!rawTitle) {
        return '';
      }
      const candidates = [rawTitle];
      separators.forEach((sep) => {
        if (rawTitle.includes(sep)) {
          rawTitle.split(sep).forEach((part) => candidates.push(part));
        }
      });
      let best = '';
      let bestScore = -1;
      candidates.forEach((part) => {
        const value = String(part || '').trim();
        if (!value || value.length < 2 || value.length > 24) {
          return;
        }
        if (/https?:|\/|\\|\?|=|&/.test(value)) {
          return;
        }
        if (/^\d+$/.test(value)) {
          return;
        }
        let score = 0;
        if (/[\u4e00-\u9fff]/.test(value)) {
          score += 2;
        }
        if (/\s/.test(value)) {
          score += 1;
        }
        if (value.length >= 3 && value.length <= 14) {
          score += 1;
        }
        if (score > bestScore) {
          best = value;
          bestScore = score;
        }
      });
      return best;
    }

    function normalizeWordToken(value) {
      return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    }

    function pickCasedLabelFromTitle(hostLabelRaw) {
      const raw = String(hostLabelRaw || '').trim();
      if (!raw || !rawTitle) {
        return '';
      }
      const target = normalizeWordToken(raw);
      if (!target) {
        return '';
      }
      const candidates = [rawTitle];
      separators.forEach((sep) => {
        if (rawTitle.includes(sep)) {
          rawTitle.split(sep).forEach((part) => candidates.push(part));
        }
      });
      for (let i = 0; i < candidates.length; i += 1) {
        const token = String(candidates[i] || '').trim();
        if (!token) {
          continue;
        }
        if (normalizeWordToken(token) === target) {
          return token;
        }
      }
      const words = rawTitle.split(/[\s|—–\-·•:：()（）\[\]【】]+/).map((part) => String(part || '').trim()).filter(Boolean);
      for (let i = 0; i < words.length; i += 1) {
        const word = words[i];
        if (normalizeWordToken(word) === target) {
          return word;
        }
      }
      return '';
    }

    function isWeakHostLabel(label) {
      const value = String(label || '').trim().toLowerCase();
      if (!value) {
        return true;
      }
      if (value.length <= 1 || /^\d+$/.test(value)) {
        return true;
      }
      return noisySubdomains.has(value);
    }

    if (host) {
      if (brandMap[host]) {
        return brandMap[host];
      }
      const matchedBrandHost = Object.keys(brandMap).find((key) => host === key || host.endsWith(`.${key}`));
      if (matchedBrandHost) {
        return brandMap[matchedBrandHost];
      }
      const primaryHostLabel = getPrimaryLabelFromHost(host);
      const casedFromTitle = pickCasedLabelFromTitle(primaryHostLabel);
      const hostLabel = casedFromTitle || prettifyLabel(primaryHostLabel);
      const titleCandidate = pickTitleCandidate();
      const firstSubdomain = host.split('.').filter(Boolean)[0] || '';
      if (noisySubdomains.has(firstSubdomain) && titleCandidate) {
        return titleCandidate;
      }
      if (isWeakHostLabel(hostLabel) && titleCandidate) {
        return titleCandidate;
      }
      if (hostLabel) {
        return hostLabel;
      }
      if (titleCandidate) {
        return titleCandidate;
      }
    }
    return rawTitle || hostname || '';
  }

  function getRecentCardColors(theme, host) {
    const fallbackTheme = theme || buildFallbackThemeForHost(host) || defaultTheme;
    const resolvedTheme = getThemeForMode(fallbackTheme);
    const accentRgb = resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent) || defaultAccentColor;
    const isDark = document.body && document.body.getAttribute('data-theme') === 'dark';
    const baseTarget = isDark ? [22, 22, 22] : [255, 255, 255];
    const base = mixColor(accentRgb, baseTarget, isDark ? 0.72 : 0.82);
    const border = mixColor(base, isDark ? [255, 255, 255] : [0, 0, 0], isDark ? 0.12 : 0.1);
    const innerTint = mixColor(accentRgb, [255, 255, 255], 0.82);
    return {
      base: rgbToCss(base),
      border: rgbToCss(border),
      innerTint: rgbToCssParts(innerTint)
    };
  }

  function applyRecentCardTheme(card, theme, host) {
    if (!card) {
      return;
    }
    const colors = getRecentCardColors(theme, host);
    card.style.setProperty('--x-nt-recent-card-color', colors.base);
    card.style.setProperty('--x-nt-recent-card-border-color', colors.border);
    card.style.setProperty('--x-nt-recent-inner-tint-rgb', colors.innerTint);
  }

  function updateRecentActionOffset(card, actionLine) {
    if (!card || !actionLine) {
      return;
    }
    const update = () => {
      if (!card.isConnected) {
        return;
      }
      const width = Math.ceil(actionLine.getBoundingClientRect().width);
      card.style.setProperty('--x-nt-recent-action-offset', `${width}px`);
    };
    requestAnimationFrame(update);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(update).catch(() => {});
    }
    recentActionOffsetUpdaters.add(update);
    if (!recentActionResizeBound) {
      recentActionResizeBound = true;
      window.addEventListener('resize', () => {
        recentActionOffsetUpdaters.forEach((handler) => handler());
      });
    }
    if (!recentActionObservers.has(actionLine)) {
      const mutationObserver = new MutationObserver(() => update());
      mutationObserver.observe(actionLine, {
        childList: true,
        characterData: true,
        subtree: true
      });
      let resizeObserver = null;
      if (typeof ResizeObserver === 'function') {
        resizeObserver = new ResizeObserver(() => update());
        resizeObserver.observe(actionLine);
      }
      recentActionObservers.set(actionLine, { mutationObserver, resizeObserver });
    }
  }

  function buildRecentSiteCard(item, index) {
    if (!item || !item.url) {
      return null;
    }
    const host = item.host || getHostFromUrl(item.url) || '';
    const siteName = getSiteDisplayName(host, item.title);
    const titleText = item.title || siteName || item.url;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'x-nt-recent-card';
    card.setAttribute('aria-label', formatMessage('open_prefix', '打开 {title}', {
      title: titleText
    }));
    card._xHost = host;
    const themeSuggestion = { type: 'history', url: item.url, title: item.title || '' };
    const immediateTheme = getImmediateThemeForSuggestion(themeSuggestion);
    card._xTheme = immediateTheme;
    applyRecentCardTheme(card, immediateTheme, host);
    getThemeForSuggestion(themeSuggestion).then((theme) => {
      if (card.isConnected) {
        card._xTheme = theme || card._xTheme;
        applyRecentCardTheme(card, theme, host);
      }
    });

    const inner = document.createElement('div');
    inner.className = 'x-nt-recent-inner';
    const header = document.createElement('div');
    header.className = 'x-nt-recent-header';
    const faviconImage = document.createElement('img');
    faviconImage.className = 'x-nt-recent-favicon';
    faviconImage.alt = siteName || t('site_icon_alt', '站点');
    const eagerCount = Math.min(6, currentRecentCount);
    const shouldEager = index < eagerCount;
    faviconImage.loading = shouldEager ? 'eager' : 'lazy';
    if (shouldEager) {
      faviconImage.fetchPriority = 'high';
    }
    attachFaviconWithFallbacks(faviconImage, item.url, host);
    faviconImage.onerror = function() {
      reportMissingIcon('recent', item.url, faviconImage.src);
      applyFallbackIcon(faviconImage);
    };
    const name = document.createElement('div');
    name.className = 'x-nt-recent-name';
    name.textContent = siteName;
    name.title = siteName;
    header.appendChild(faviconImage);
    header.appendChild(name);

    const title = document.createElement('div');
    title.className = 'x-nt-recent-title';
    title.textContent = titleText;
    title.title = titleText;

    const urlLine = document.createElement('div');
    urlLine.className = 'x-nt-recent-url';
    urlLine.textContent = getUrlDisplay(item.url);
    urlLine.title = item.url;

    const actionLine = document.createElement('div');
    actionLine.className = 'x-nt-recent-action';
    const actionText = document.createElement('span');
    actionText.textContent = t('visit_label', '访问');
    actionLine.appendChild(actionText);
    const actionIcon = document.createElement('span');
    actionIcon.innerHTML = getRiSvg('ri-arrow-right-line', 'ri-size-12');
    actionLine.appendChild(actionIcon);
    card._xActionText = actionText;
    card._xTitleText = titleText;

    inner.appendChild(header);
    inner.appendChild(title);
    card.appendChild(inner);
    card.appendChild(urlLine);
    card.appendChild(actionLine);
    updateRecentActionOffset(card, actionLine);
    recentCards.push(card);

    let isCardPointerActive = false;
    let hasNavigateAttempted = false;
    let rollbackTimerId = null;
    let hoverUnlockTimerId = null;
    let isHoverLocked = false;
    const rollbackClassName = 'x-nt-recent-card--rollback';
    const ROLLBACK_ANIMATION_MS = 220;
    const HOVER_REENABLE_DELAY_MS = 1000;
    const clearRollbackTimer = () => {
      if (rollbackTimerId !== null) {
        window.clearTimeout(rollbackTimerId);
        rollbackTimerId = null;
      }
    };
    const clearHoverUnlockTimer = () => {
      if (hoverUnlockTimerId !== null) {
        window.clearTimeout(hoverUnlockTimerId);
        hoverUnlockTimerId = null;
      }
    };
    const lockHoverAfterRollback = () => {
      clearHoverUnlockTimer();
      isHoverLocked = true;
      card.classList.add(rollbackClassName);
      hoverUnlockTimerId = window.setTimeout(() => {
        hoverUnlockTimerId = null;
        isHoverLocked = false;
        card.classList.remove(rollbackClassName);
      }, ROLLBACK_ANIMATION_MS + HOVER_REENABLE_DELAY_MS);
    };
    const markNavigationSuccess = () => {
      clearRollbackTimer();
      clearHoverUnlockTimer();
    };
    const scheduleRollbackIfPending = () => {
      clearRollbackTimer();
      rollbackTimerId = window.setTimeout(() => {
        rollbackTimerId = null;
        if (document.visibilityState === 'hidden') {
          return;
        }
        lockHoverAfterRollback();
        hasNavigateAttempted = false;
      }, 180);
    };
    const navigateFromCard = () => {
      if (hasNavigateAttempted) {
        return;
      }
      hasNavigateAttempted = true;
      if (!isHoverLocked) {
        card.classList.remove(rollbackClassName);
      }
      navigateToUrl(item.url);
      scheduleRollbackIfPending();
    };
    card.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }
      isCardPointerActive = true;
      if (typeof card.setPointerCapture === 'function') {
        try {
          card.setPointerCapture(event.pointerId);
        } catch (error) {
          // Ignore capture errors and keep pointer flow fallback.
        }
      }
      navigateFromCard();
    });
    card.addEventListener('pointercancel', () => {
      isCardPointerActive = false;
    });
    card.addEventListener('pointerup', (event) => {
      if (event.button !== 0 || !isCardPointerActive) {
        return;
      }
      isCardPointerActive = false;
    });
    card.addEventListener('pointerleave', () => {
      if (!hasNavigateAttempted && !isHoverLocked) {
        card.classList.remove(rollbackClassName);
      }
    });
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        markNavigationSuccess();
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', markNavigationSuccess, { once: true });
    card.addEventListener('click', () => {
      navigateFromCard();
    });
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        navigateFromCard();
      }
    });

    return card;
  }

  function getAutocompleteCandidate(allSuggestions, rawQuery) {
    if (!Array.isArray(allSuggestions) || !rawQuery) {
      return null;
    }
    const rawLower = rawQuery.toLowerCase();
    const passes = [true, false];
    for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
      const skipGoogleSuggest = passes[passIndex];
      for (let i = 0; i < allSuggestions.length; i += 1) {
      const suggestion = allSuggestions[i];
      if (!suggestion || suggestion.type === 'newtab') {
        continue;
      }
      if (skipGoogleSuggest && suggestion.type === 'googleSuggest') {
        continue;
      }
      if (suggestion.commandText) {
        const commandText = String(suggestion.commandText).toLowerCase();
        if (commandText.startsWith(rawLower)) {
          return {
            completion: suggestion.commandText,
            url: '',
            title: suggestion.title || '',
            type: 'command'
          };
        }
        const aliases = Array.isArray(suggestion.commandAliases) ? suggestion.commandAliases : [];
        for (let aliasIndex = 0; aliasIndex < aliases.length; aliasIndex += 1) {
          const alias = String(aliases[aliasIndex] || '').toLowerCase();
          if (alias && alias.startsWith(rawLower)) {
            return {
              completion: aliases[aliasIndex],
              url: '',
              title: suggestion.title || '',
              type: 'command'
            };
          }
        }
      }
        const urlText = getUrlDisplay(suggestion.url);
        if (urlText && urlText.toLowerCase().startsWith(rawLower)) {
          return {
            completion: urlText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'url'
          };
        }
        const titleText = suggestion.title || '';
        if (titleText && titleText.toLowerCase().startsWith(rawLower)) {
          return {
            completion: titleText,
            url: suggestion.url || '',
            title: suggestion.title || '',
            type: 'title'
          };
        }
      }
    }
    return null;
  }

  function getDomainPrefixCandidate(allSuggestions, rawQuery) {
    if (!Array.isArray(allSuggestions) || !rawQuery) {
      return null;
    }
    const rawLower = rawQuery.toLowerCase();
    for (let i = 0; i < allSuggestions.length; i += 1) {
      const suggestion = allSuggestions[i];
      if (!suggestion || suggestion.type === 'newtab') {
        continue;
      }
      const urlText = getUrlDisplay(suggestion.url);
      if (!urlText) {
        continue;
      }
      const host = urlText.split('/')[0] || '';
      if (host.toLowerCase().startsWith(rawLower)) {
        return {
          completion: urlText,
          url: suggestion.url || '',
          title: suggestion.title || '',
          type: 'url'
        };
      }
    }
    return null;
  }

  function clearAutocomplete() {
    autocompleteState = null;
  }

  function applyAutocomplete(allSuggestions) {
    const rawQuery = latestRawQuery;
    const trimmedQuery = rawQuery.trim();
    if (Date.now() - lastDeletionAt < 250) {
      clearAutocomplete();
      return;
    }
    if (siteSearchState) {
      clearAutocomplete();
      return;
    }
    if (!isEnglishQuery(trimmedQuery) || !rawQuery) {
      clearAutocomplete();
      return;
    }
    if (!allSuggestions || !Array.isArray(allSuggestions)) {
      clearAutocomplete();
      return;
    }
    if (inputParts.input.selectionStart !== inputParts.input.value.length ||
        inputParts.input.selectionEnd !== inputParts.input.value.length) {
      return;
    }
    const candidate = getDomainPrefixCandidate(allSuggestions, rawQuery) ||
      getAutocompleteCandidate(allSuggestions, rawQuery);
    if (!candidate || !candidate.completion) {
      clearAutocomplete();
      return;
    }
    if (candidate.completion.length <= rawQuery.length) {
      clearAutocomplete();
      return;
    }
    if (!candidate.completion.toLowerCase().startsWith(rawQuery.toLowerCase())) {
      clearAutocomplete();
      return;
    }
    let displayText = candidate.completion;
    if (candidate.type === 'url' && candidate.title) {
      displayText = `${candidate.completion} - ${candidate.title}`;
    }
    inputParts.input.value = displayText;
    inputParts.input.setSelectionRange(rawQuery.length, displayText.length);
    autocompleteState = {
      completion: candidate.completion,
      displayText: displayText,
      url: candidate.url || '',
      rawQuery: rawQuery,
      title: candidate.title || '',
      type: candidate.type || ''
    };
  }

  function buildUrlLine(url) {
    if (!url) {
      return null;
    }
    const urlLine = document.createElement('span');
    urlLine.textContent = url;
    urlLine.style.cssText = `
      all: unset !important;
      color: var(--x-nt-link, #2563EB) !important;
      font-size: 12px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      text-decoration: none !important;
      display: inline-block !important;
      max-width: 60% !important;
      line-height: 1.4 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      box-sizing: border-box !important;
      margin: 0 !important;
      padding: 0 !important;
    `;
    return urlLine;
  }

  function buildSearchUrl(template, query) {
    if (!template) {
      return '';
    }
    return template.replace(/\{query\}/g, encodeURIComponent(query));
  }

  function getProviderIcon(provider) {
    if (provider && provider.icon) {
      return provider.icon;
    }
    const template = provider && provider.template ? provider.template : '';
    try {
      const url = template.replace(/\{query\}/g, 'test');
      const hostname = normalizeHost(new URL(url).hostname);
      return getGoogleFaviconUrl(hostname);
    } catch (e) {
      return '';
    }
  }

  function mergeCustomProvidersLocal(baseItems, customItems) {
    const merged = [];
    const seen = new Set();
    (customItems || []).forEach((item) => {
      const key = String(item && item.key ? item.key : '').toLowerCase();
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push(item);
    });
    (baseItems || []).forEach((item) => {
      const key = String(item && item.key ? item.key : '').toLowerCase();
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      merged.push(item);
    });
    return merged;
  }

  function getSiteSearchProviders() {
    if (siteSearchProvidersCache) {
      return Promise.resolve(siteSearchProvidersCache);
    }
    const localUrl = chrome.runtime.getURL('site-search.json');
    const localFallback = fetch(localUrl)
      .then((response) => response.json())
      .then((data) => {
        const items = data && Array.isArray(data.items) ? data.items : [];
        return items;
      })
      .catch(() => []);
    const customFallback = new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      storageArea.get([SITE_SEARCH_STORAGE_KEY], (result) => {
        const items = Array.isArray(result[SITE_SEARCH_STORAGE_KEY]) ? result[SITE_SEARCH_STORAGE_KEY] : [];
        resolve(items);
      });
    });
    const disabledFallback = new Promise((resolve) => {
      if (!storageArea) {
        resolve([]);
        return;
      }
      storageArea.get([SITE_SEARCH_DISABLED_STORAGE_KEY], (result) => {
        const items = Array.isArray(result[SITE_SEARCH_DISABLED_STORAGE_KEY])
          ? result[SITE_SEARCH_DISABLED_STORAGE_KEY]
          : [];
        resolve(items.map((item) => String(item).toLowerCase()).filter(Boolean));
      });
    });
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSiteSearchProviders' }, (response) => {
        const items = response && Array.isArray(response.items) ? response.items : [];
        if (items.length > 0) {
          siteSearchProvidersCache = items;
          resolve(items);
          return;
        }
        Promise.all([localFallback, customFallback, disabledFallback])
          .then(([localItems, customItems, disabledKeys]) => {
          const baseItems = localItems.length > 0 ? localItems : defaultSiteSearchProviders;
          const filteredBase = baseItems.filter((item) => {
            const key = String(item && item.key ? item.key : '').toLowerCase();
            return key && !disabledKeys.includes(key);
          });
          const merged = mergeCustomProvidersLocal(filteredBase, customItems);
          siteSearchProvidersCache = merged;
          resolve(merged);
        });
      });
    });
  }

  function findSiteSearchProvider(trigger, providers) {
    const key = String(trigger || '').toLowerCase();
    if (!key) {
      return null;
    }
    return (providers || []).find((provider) => {
      const providerKey = String(provider.key || '').toLowerCase();
      if (providerKey === key) {
        return true;
      }
      const aliases = Array.isArray(provider.aliases) ? provider.aliases : [];
      return aliases.some((alias) => String(alias).toLowerCase() === key);
    }) || null;
  }

  function getSiteSearchDisplayName(provider) {
    if (!provider) {
      return t('site_search_default', '站内');
    }
    return provider.name || provider.key || t('site_search_default', '站内');
  }

  function suggestionMatchesProvider(suggestion, provider) {
    if (!suggestion || !provider || !suggestion.url) {
      return false;
    }
    const normalizedSuggestion = getSuggestionHost(suggestion);
    const normalizedProvider = getProviderHost(provider);
    if (!normalizedSuggestion || !normalizedProvider) {
      return false;
    }
    return normalizedSuggestion === normalizedProvider ||
      normalizedSuggestion.endsWith(`.${normalizedProvider}`) ||
      normalizedProvider.endsWith(`.${normalizedSuggestion}`);
  }

  function isAsciiToken(token) {
    return /^[a-z0-9]+$/i.test(token || '');
  }

  function isProviderTokenEligible(token) {
    if (!token) {
      return false;
    }
    const normalized = String(token).trim();
    if (!normalized) {
      return false;
    }
    if (isAsciiToken(normalized)) {
      return normalized.length >= 3;
    }
    return normalized.length >= 2;
  }

  function providerMatchesSuggestion(provider, suggestion) {
    if (!provider || !suggestion) {
      return false;
    }
    if (suggestionMatchesProvider(suggestion, provider)) {
      return true;
    }
    const titleText = String(suggestion.title || '').toLowerCase();
    const urlText = String(suggestion.url || '').toLowerCase();
    const hostText = normalizeHost(getSuggestionHost(suggestion));
    const haystack = `${titleText} ${urlText} ${hostText}`;
    const tokens = [provider.key, provider.name].concat(provider.aliases || []);
    for (let i = 0; i < tokens.length; i += 1) {
      const token = String(tokens[i] || '').toLowerCase().trim();
      if (!isProviderTokenEligible(token)) {
        continue;
      }
      if (token && haystack.includes(token)) {
        return true;
      }
    }
    return false;
  }

  function findProviderForSuggestionMatch(suggestion, providers) {
    if (!suggestion) {
      return null;
    }
    const eligibleTypes = new Set(['topSite', 'history', 'bookmark']);
    if (!eligibleTypes.has(suggestion.type) && !suggestion.isTopSite) {
      return null;
    }
    return (providers || []).find((provider) => providerMatchesSuggestion(provider, suggestion)) || null;
  }

  function findSiteSearchProviderByKey(trigger, providers) {
    const key = String(trigger || '').toLowerCase();
    if (!key) {
      return null;
    }
    return (providers || []).find((provider) => String(provider.key || '').toLowerCase() === key) || null;
  }

  function findSiteSearchProviderByInput(input, providers) {
    const raw = String(input || '').trim();
    if (!raw) {
      return null;
    }
    const firstToken = raw.split(/\s+/)[0];
    const keyMatch = findSiteSearchProvider(firstToken, providers) ||
      findSiteSearchProviderByKey(firstToken, providers);
    if (keyMatch) {
      return keyMatch;
    }
    let host = '';
    if (/[./]/.test(firstToken)) {
      try {
        const url = firstToken.includes('://') ? firstToken : `https://${firstToken}`;
        host = new URL(url).hostname;
      } catch (e) {
        host = firstToken.split('/')[0] || '';
      }
    }
    if (!host) {
      return null;
    }
    const normalizedHost = normalizeHost(host);
    return (providers || []).find((provider) => {
      const providerHost = normalizeHost(getProviderHost(provider));
      if (!providerHost) {
        return false;
      }
      return normalizedHost === providerHost ||
        normalizedHost.endsWith(`.${providerHost}`) ||
        providerHost.endsWith(`.${normalizedHost}`);
    }) || null;
  }

  function getInlineSiteSearchCandidate(input, providers) {
    const raw = String(input || '').trim();
    if (!raw) {
      return null;
    }
    const tokens = raw.split(/\s+/);
    if (tokens.length < 2) {
      return null;
    }
    const provider = findSiteSearchProviderByInput(raw, providers);
    if (!provider) {
      return null;
    }
    const firstToken = tokens[0];
    const remainder = raw.slice(raw.indexOf(firstToken) + firstToken.length).trim();
    if (!remainder) {
      return null;
    }
    return { provider: provider, query: remainder };
  }

  function matchesTopSitePrefix(suggestion, input) {
    if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
      return false;
    }
    const query = String(input || '').trim().toLowerCase();
    if (!query) {
      return false;
    }
    const titleText = String(suggestion.title || '').toLowerCase();
    if (titleText.startsWith(query)) {
      return true;
    }
    const urlText = getUrlDisplay(suggestion.url || '');
    if (!urlText) {
      return false;
    }
    const host = urlText.split('/')[0] || '';
    return host.toLowerCase().startsWith(query);
  }

  function getTopSiteMatchCandidate(list, input) {
    if (!Array.isArray(list)) {
      return null;
    }
    const query = String(input || '').trim();
    if (!query || /\s/.test(query)) {
      return null;
    }
    let fallback = null;
    for (let i = 0; i < list.length; i += 1) {
      const suggestion = list[i];
      if (!suggestion || !(suggestion.type === 'topSite' || suggestion.isTopSite)) {
        continue;
      }
      const urlText = getUrlDisplay(suggestion.url || '');
      const host = urlText ? (urlText.split('/')[0] || '') : '';
      if (host && host.toLowerCase().startsWith(query.toLowerCase())) {
        return suggestion;
      }
      if (!fallback && matchesTopSitePrefix(suggestion, query)) {
        fallback = suggestion;
      }
    }
    return fallback;
  }

  function promoteTopSiteMatch(list, queryText) {
    const match = getTopSiteMatchCandidate(list, queryText);
    if (!match) {
      return null;
    }
    const matchIndex = list.indexOf(match);
    if (matchIndex > 0) {
      const [picked] = list.splice(matchIndex, 1);
      list.unshift(picked);
      return picked;
    }
    if (matchIndex === 0) {
      return list[0];
    }
    return null;
  }

  function getProviderHost(provider) {
    if (!provider || !provider.template) {
      return '';
    }
    try {
      const url = provider.template.replace(/\{query\}/g, 'test');
      return normalizeHost(new URL(url).hostname);
    } catch (e) {
      return '';
    }
  }

  function getSuggestionHost(suggestion) {
    if (!suggestion || !suggestion.url) {
      return '';
    }
    try {
      return normalizeHost(new URL(suggestion.url).hostname);
    } catch (e) {
      return '';
    }
  }

  function hostsMatch(a, b) {
    if (!a || !b) {
      return false;
    }
    return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
  }

  function providerMatchesInputPrefix(provider, input) {
    const needle = String(input || '').toLowerCase();
    if (!needle || !provider) {
      return false;
    }
    const allowPrefix = needle.length >= 2;
    const tokens = [provider.key, provider.name].concat(provider.aliases || []);
    for (let i = 0; i < tokens.length; i += 1) {
      const token = String(tokens[i] || '').toLowerCase();
      if (!token) {
        continue;
      }
      if (token === needle || (allowPrefix && token.startsWith(needle))) {
        return true;
      }
    }
    const host = normalizeHost(getProviderHost(provider));
    if (host) {
      const hostToken = host.split('.')[0] || host;
      if (hostToken === needle || (allowPrefix && hostToken.startsWith(needle))) {
        return true;
      }
    }
    return false;
  }

  function getSiteSearchTriggerCandidate(input, providers, topSiteMatch) {
    const trimmed = String(input || '').trim();
    if (!trimmed || /\s/.test(trimmed)) {
      return null;
    }
    let provider = findSiteSearchProvider(trimmed, providers) ||
      findSiteSearchProviderByKey(trimmed, providers);
    if (!provider && topSiteMatch) {
      provider = (providers || []).find((candidate) => {
        if (!suggestionMatchesProvider(topSiteMatch, candidate)) {
          return false;
        }
        return providerMatchesInputPrefix(candidate, trimmed);
      }) || null;
    }
    if (!provider) {
      return null;
    }
    if (topSiteMatch && trimmed.length <= 2 && matchesTopSitePrefix(topSiteMatch, trimmed)) {
      const providerHost = getProviderHost(provider);
      const topHost = getSuggestionHost(topSiteMatch);
      if (!hostsMatch(providerHost, topHost)) {
        return null;
      }
    }
    return provider;
  }

  function activateSiteSearch(provider) {
    if (!provider) {
      return;
    }
    siteSearchState = provider;
    inlineSearchState = null;
    inputParts.input.value = '';
    latestRawQuery = '';
    latestQuery = '';
    clearAutocomplete();
    setSiteSearchPrefix(provider, defaultTheme);
    getThemeForProvider(provider).then((theme) => {
      if (siteSearchState === provider) {
        setSiteSearchPrefix(provider, theme);
      }
    });
    clearSearchSuggestions();
  }

  function clearSiteSearch() {
    if (!siteSearchState) {
      return;
    }
    siteSearchState = null;
    inlineSearchState = null;
    clearSiteSearchPrefix();
    clearAutocomplete();
  }

  function getBrowserInternalScheme() {
    const ua = navigator.userAgent || '';
    if (ua.includes('Edg/')) {
      return 'edge://';
    }
    if (ua.includes('Brave')) {
      return 'brave://';
    }
    if (ua.includes('Vivaldi')) {
      return 'vivaldi://';
    }
    if (ua.includes('OPR/') || ua.includes('Opera')) {
      return 'opera://';
    }
    return 'chrome://';
  }

  function getShortcutRules() {
    if (window._x_extension_shortcut_rules_2024_unique_) {
      return Promise.resolve(window._x_extension_shortcut_rules_2024_unique_);
    }
    if (window._x_extension_shortcut_rules_promise_2024_unique_) {
      return window._x_extension_shortcut_rules_promise_2024_unique_;
    }
    const rulesUrl = chrome.runtime.getURL('shortcut-rules.json');
    const rulesPromise = fetch(rulesUrl)
      .then((response) => response.json())
      .then((data) => {
        const items = data && Array.isArray(data.items) ? data.items : [];
        window._x_extension_shortcut_rules_2024_unique_ = items;
        return items;
      })
      .catch(() => new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'getShortcutRules' }, (response) => {
          const items = response && Array.isArray(response.items) ? response.items : [];
          window._x_extension_shortcut_rules_2024_unique_ = items;
          resolve(items);
        });
      }));
    window._x_extension_shortcut_rules_promise_2024_unique_ = rulesPromise;
    return rulesPromise;
  }

  function buildKeywordSuggestions(input, rules) {
    const queryLower = input.toLowerCase();
    const scheme = getBrowserInternalScheme();
    const matches = [];
    rules.forEach((rule) => {
      if (!rule || !Array.isArray(rule.keys)) {
        return;
      }
      const isMatch = rule.keys.some((key) => queryLower.startsWith(key));
      if (!isMatch) {
        return;
      }
      if (rule.type === 'browserPage' && rule.path) {
        const targetUrl = `${scheme}${rule.path}`;
        matches.push({
          type: 'browserPage',
          title: formatMessage('open_url', '打开 {url}', { url: targetUrl }),
          url: targetUrl,
          favicon: 'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
        });
      } else if (rule.type === 'url' && rule.url) {
        matches.push({
          type: 'browserPage',
          title: formatMessage('open_url', '打开 {url}', { url: rule.url }),
          url: rule.url,
          favicon: 'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
        });
      }
    });
    return matches;
  }

  function getDirectUrlSuggestion(input) {
    const targetUrl = getDirectNavigationUrl(input);
    if (!targetUrl) {
      return null;
    }
    return {
      type: 'directUrl',
      title: formatMessage('open_url', '打开 {url}', { url: targetUrl }),
      url: targetUrl,
      favicon: ''
    };
  }

  function isNumericHostLike(hostname) {
    if (!hostname) {
      return false;
    }
    if (!/^(\d{1,3})(\.\d{1,3}){0,3}$/.test(hostname)) {
      return false;
    }
    const parts = hostname.split('.');
    if (parts.length < 1 || parts.length > 4) {
      return false;
    }
    if (parts.length === 1) {
      return parts[0] === '127';
    }
    return parts.every((part) => {
      const value = Number(part);
      return Number.isInteger(value) && value >= 0 && value <= 255;
    });
  }

  function extractHostFromInput(rawInput) {
    const withoutScheme = String(rawInput || '').replace(/^https?:\/\//i, '');
    const authority = withoutScheme.split(/[/?#]/)[0] || '';
    if (!authority) {
      return '';
    }
    if (authority.startsWith('[')) {
      const endBracket = authority.indexOf(']');
      if (endBracket > 1) {
        return authority.slice(1, endBracket).toLowerCase();
      }
      return '';
    }
    if (authority.includes('::') && !authority.includes('.')) {
      return authority.toLowerCase();
    }
    return (authority.split(':')[0] || '').toLowerCase();
  }

  function isDevHostLike(hostname) {
    if (!hostname) {
      return false;
    }
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
      return true;
    }
    if (hostname === 'host.docker.internal') {
      return true;
    }
    if (
      hostname.endsWith('.local') ||
      hostname.endsWith('.test') ||
      hostname.endsWith('.localdev') ||
      hostname.endsWith('.internal')
    ) {
      return true;
    }
    return hostname === '::1' || hostname === '0:0:0:0:0:0:0:1';
  }

  function getDirectNavigationUrl(input) {
    const raw = String(input || '').trim();
    if (!raw) {
      return '';
    }
    const queryLower = raw.toLowerCase();
    const isInternal = ['chrome://', 'edge://', 'brave://', 'vivaldi://', 'opera://'].some((prefix) =>
      queryLower.startsWith(prefix)
    );
    let normalizedInput = raw.match(/^(\d{1,3})([.\s]\d{1,3}){0,3}(?::\d{1,5})?(?:[/?#].*)?$/)
      ? raw.replace(/\s+/g, '.').replace(/\.{2,}/g, '.')
      : raw;
    const hostOnly = extractHostFromInput(normalizedInput);
    const isDevHost = isDevHostLike(hostOnly);
    const isNumericLike = isNumericHostLike(hostOnly);
    const looksLikeUrl = (normalizedInput.includes('.') && !normalizedInput.includes(' ')) || isInternal || isDevHost || isNumericLike;
    if (!looksLikeUrl) {
      return '';
    }
    if (hostOnly.includes(':') && !/^https?:\/\//i.test(normalizedInput) && !normalizedInput.startsWith('[')) {
      normalizedInput = `[${normalizedInput}]`;
    }
    if (!isInternal && !normalizedInput.startsWith('http://') && !normalizedInput.startsWith('https://')) {
      return `https://${normalizedInput}`;
    }
    return normalizedInput;
  }

  function resolveQuickNavigation(query) {
    const directUrlSuggestion = getDirectUrlSuggestion(query);
    if (directUrlSuggestion) {
      return Promise.resolve(directUrlSuggestion.url);
    }
    return getShortcutRules().then((rules) => {
      const keywordSuggestions = buildKeywordSuggestions(query, rules);
      if (keywordSuggestions.length > 0) {
        return keywordSuggestions[0].url;
      }
      return null;
    });
  }

  const suggestionItems = [];
  let selectedIndex = -1;
  let currentSuggestions = [];
  let lastSuggestionResponse = [];
  let siteSearchTriggerState = null;
  let lastRenderedQuery = '';

  function getAutoHighlightIndex() {
    return suggestionItems.findIndex((item) => Boolean(item && item._xIsAutocompleteTop));
  }

  function isSameSuggestion(a, b) {
    if (!a || !b) {
      return false;
    }
    if (a.type !== b.type) {
      return false;
    }
    if ((a.url || '') !== (b.url || '')) {
      return false;
    }
    if ((a.title || '') !== (b.title || '')) {
      return false;
    }
    const providerA = a.provider && a.provider.key ? a.provider.key : '';
    const providerB = b.provider && b.provider.key ? b.provider.key : '';
    return providerA === providerB;
  }

  function isSuggestionPrefix(previous, next) {
    if (!Array.isArray(previous) || !Array.isArray(next)) {
      return false;
    }
    if (previous.length === 0 || previous.length > next.length) {
      return false;
    }
    for (let i = 0; i < previous.length; i += 1) {
      if (!isSameSuggestion(previous[i], next[i])) {
        return false;
      }
    }
    return true;
  }

  function applySearchSuggestionHighlight(item, theme) {
    const highlight = getHighlightColors(theme);
    item.style.setProperty('background', highlight.bg, 'important');
    item.style.setProperty('border', `1px solid ${highlight.border}`, 'important');
  }

  function resetSearchSuggestion(item) {
    item.style.setProperty('background', 'transparent', 'important');
    item.style.setProperty('border', '1px solid transparent', 'important');
  }

  function applySearchActionStyles(item, theme, isActive) {
    const resolvedTheme = getThemeForMode(theme);
    applyMarkVariables(item, isActive ? resolvedTheme : defaultTheme);
    if (item._xHistoryTag) {
      if (isActive) {
        item._xHistoryTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
        item._xHistoryTag.style.setProperty('color', resolvedTheme.tagText, 'important');
        item._xHistoryTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
      } else {
        item._xHistoryTag.style.setProperty('background', item._xHistoryTag._xDefaultBg || 'var(--x-nt-tag-bg, #F3F4F6)', 'important');
        item._xHistoryTag.style.setProperty('color', item._xHistoryTag._xDefaultText || 'var(--x-nt-tag-text, #6B7280)', 'important');
        item._xHistoryTag.style.setProperty('border', `1px solid ${item._xHistoryTag._xDefaultBorder || 'transparent'}`, 'important');
      }
    }
    if (item._xBookmarkTag) {
      if (isActive) {
        item._xBookmarkTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
        item._xBookmarkTag.style.setProperty('color', resolvedTheme.tagText, 'important');
        item._xBookmarkTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
      } else {
        item._xBookmarkTag.style.setProperty('background', item._xBookmarkTag._xDefaultBg || 'var(--x-nt-bookmark-tag-bg, #FEF3C7)', 'important');
        item._xBookmarkTag.style.setProperty('color', item._xBookmarkTag._xDefaultText || 'var(--x-nt-bookmark-tag-text, #D97706)', 'important');
        item._xBookmarkTag.style.setProperty('border', `1px solid ${item._xBookmarkTag._xDefaultBorder || 'transparent'}`, 'important');
      }
    }
    if (item._xTopSiteTag) {
      if (isActive) {
        item._xTopSiteTag.style.setProperty('background', resolvedTheme.tagBg, 'important');
        item._xTopSiteTag.style.setProperty('color', resolvedTheme.tagText, 'important');
        item._xTopSiteTag.style.setProperty('border', `1px solid ${resolvedTheme.tagBorder}`, 'important');
      } else {
        item._xTopSiteTag.style.setProperty('background', item._xTopSiteTag._xDefaultBg || 'var(--x-nt-tag-bg, #F3F4F6)', 'important');
        item._xTopSiteTag.style.setProperty('color', item._xTopSiteTag._xDefaultText || 'var(--x-nt-tag-text, #6B7280)', 'important');
        item._xTopSiteTag.style.setProperty('border', `1px solid ${item._xTopSiteTag._xDefaultBorder || 'transparent'}`, 'important');
      }
    }
    if (item._xTagContainer) {
      if (item._xHasActionTags) {
        item._xTagContainer.style.setProperty('display', 'inline-flex', 'important');
        item._xTagContainer.style.setProperty('visibility', isActive ? 'visible' : 'hidden', 'important');
      } else {
        item._xTagContainer.style.setProperty('display', 'none', 'important');
        item._xTagContainer.style.setProperty('visibility', 'hidden', 'important');
      }
    }
    if (item._xTitle) {
      item._xTitle.style.setProperty('font-weight', isActive ? '600' : '400', 'important');
    }
  }

  function updateSelection() {
    suggestionItems.forEach((item, index) => {
      const isSelected = index === selectedIndex;
      const shouldAutoHighlight = selectedIndex === -1 && item._xIsAutocompleteTop;
      const isHighlighted = isSelected || shouldAutoHighlight;
      if (item._xIsSearchSuggestion) {
          const theme = item._xTheme || defaultTheme;
          if (isHighlighted) {
            applySearchSuggestionHighlight(item, theme);
          } else {
            resetSearchSuggestion(item);
          }
          applySearchActionStyles(item, theme, isHighlighted);
          setNonFaviconIconBg(item, Boolean(isHighlighted || item._xIsHovering));
          if (item._xDirectIconWrap) {
            const shouldShow = isHighlighted && theme && theme._xIsBrand;
            const resolvedTheme = getThemeForMode(theme || defaultTheme);
            item._xDirectIconWrap.style.setProperty(
              'color',
              shouldShow ? resolvedTheme.accent : 'var(--x-nt-subtext, #6B7280)',
              'important'
            );
          }
          return;
        }
      setNonFaviconIconBg(item, Boolean(isHighlighted || item._xIsHovering));
      const theme = item._xTheme || defaultTheme;
      if (isSelected) {
        applySearchSuggestionHighlight(item, theme);
        if (item._xSwitchButton) {
          item._xSwitchButton.style.setProperty('color', 'var(--x-nt-text, #111827)', 'important');
        }
      } else {
        resetSearchSuggestion(item);
        if (item._xSwitchButton) {
          item._xSwitchButton.style.setProperty('color', 'var(--x-nt-subtext, #9CA3AF)', 'important');
        }
      }
    });
  }

  function animateSuggestionsGrowth(container, fromHeight) {
    if (!container || !fromHeight) {
      return;
    }
    const toHeight = container.getBoundingClientRect().height;
    if (toHeight <= fromHeight + 1) {
      return;
    }
    container.style.setProperty('height', `${fromHeight}px`, 'important');
    container.style.setProperty('overflow', 'hidden', 'important');
    container.style.setProperty('transition', 'height 180ms ease', 'important');
    requestAnimationFrame(() => {
      container.style.setProperty('height', `${toHeight}px`, 'important');
    });
    const cleanup = () => {
      container.style.removeProperty('height');
      container.style.removeProperty('overflow');
      container.style.removeProperty('transition');
      container.removeEventListener('transitionend', cleanup);
    };
    container.addEventListener('transitionend', cleanup);
    setTimeout(cleanup, 220);
  }


  function renderTabSuggestions(tabList) {
    suggestionsContainer.innerHTML = '';
    suggestionItems.length = 0;
    currentSuggestions = [];
    lastRenderedQuery = '';
    const list = Array.isArray(tabList) ? tabList : [];
    if (list.length === 0) {
      setSuggestionsVisible(false);
      return;
    }
    list.forEach((tab) => {
      if (tab && tab.favIconUrl) {
        preloadIcon(tab.favIconUrl);
      }
    });
    list.forEach((tab, index) => {
      const suggestionItem = document.createElement('div');
      suggestionItem.id = `_x_extension_newtab_suggestion_item_${index}_2024_unique_`;
      const isLastItem = index === list.length - 1;
      suggestionItem.style.cssText = `
        all: unset !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 12px 16px !important;
        background: transparent !important;
        border: 1px solid transparent !important;
        border-radius: 16px !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
        box-sizing: border-box !important;
        margin: 0 0 ${isLastItem ? '0' : '6px'} 0 !important;
        line-height: 1.5 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        color: inherit !important;
        font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
      `;
      suggestionItem._xIsSearchSuggestion = false;
      suggestionItem._xIsAutocompleteTop = false;
      suggestionItems.push(suggestionItem);

      const leftSide = document.createElement('div');
      leftSide.style.cssText = `
        all: unset !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        flex: 1 !important;
        min-width: 0 !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        background: transparent !important;
        color: inherit !important;
        font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
      `;

      const favicon = document.createElement('img');
      let hostForTab = '';
      try {
        hostForTab = tab && tab.url ? new URL(tab.url).hostname : '';
      } catch (e) {
        hostForTab = '';
      }
      const useFallback = !tab.favIconUrl || isLocalNetworkHost(hostForTab);
      if (useFallback) {
        applyFallbackIcon(favicon);
      } else {
        favicon.src = tab.favIconUrl;
      }
      favicon.decoding = 'async';
      favicon.loading = 'eager';
      favicon.referrerPolicy = 'no-referrer';
      if (index < 4) {
        favicon.fetchPriority = 'high';
      }
      const isFallbackIcon = useFallback;
      favicon.style.cssText = `
        all: unset !important;
        width: ${isFallbackIcon ? '18px' : '16px'} !important;
        height: ${isFallbackIcon ? '18px' : '16px'} !important;
        border-radius: 2px !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        background: transparent !important;
        color: inherit !important;
        font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
        display: block !important;
      `;
      const iconSlot = document.createElement('span');
      iconSlot.style.cssText = `
        all: unset !important;
        width: 24px !important;
        height: 24px !important;
        border-radius: 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        background: transparent !important;
        transition: background-color 0.2s ease !important;
        color: var(--x-nt-subtext, #6B7280) !important;
        font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
      `;
      iconSlot.appendChild(favicon);
      suggestionItem._xIconWrap = iconSlot;
      suggestionItem._xIconIsFavicon = !useFallback;
      favicon.onerror = function() {
        reportMissingIcon('tab', tab && tab.url ? tab.url : '', favicon.src);
        applyFallbackIcon(favicon);
        favicon.style.width = '18px';
        favicon.style.height = '18px';
        suggestionItem._xIconIsFavicon = false;
      };

      const title = document.createElement('span');
      title.textContent = tab.title || t('untitled', '无标题');
      title.style.cssText = `
        all: unset !important;
        color: var(--x-nt-text, #111827) !important;
        font-size: 14px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        padding: 0 !important;
        line-height: 1.5 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        background: transparent !important;
        display: inline-block !important;
        vertical-align: baseline !important;
      `;

      const switchButton = document.createElement('button');
      switchButton.innerHTML = `${t('switch_to_tab', '切换到标签页')} ${getRiSvg('ri-arrow-right-line', 'ri-size-12')}`;
      switchButton.style.cssText = `
        all: unset !important;
        background: transparent !important;
        color: var(--x-nt-subtext, #6B7280) !important;
        border: none !important;
        border-radius: 6px !important;
        font-size: 12px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        cursor: pointer !important;
        transition: background-color 0.2s ease !important;
        padding: 6px 12px !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        line-height: 1.5 !important;
        text-decoration: none !important;
        list-style: none !important;
        outline: none !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 4px !important;
        vertical-align: baseline !important;
      `;
      suggestionItem._xSwitchButton = switchButton;

      suggestionItem.addEventListener('mouseenter', function() {
        if (suggestionItems.indexOf(this) !== selectedIndex) {
          this._xIsHovering = true;
          setNonFaviconIconBg(this, true);
          if (selectedIndex === -1 && this._xIsAutocompleteTop) {
            return;
          }
          const theme = this._xTheme;
          if (theme && theme._xIsBrand) {
            const hover = getHoverColors(theme);
            this.style.setProperty('background-color', hover.bg, 'important');
            this.style.setProperty('border', `1px solid ${hover.border}`, 'important');
          } else {
            this.style.setProperty('background-color', 'var(--x-nt-hover-bg, #F3F4F6)', 'important');
            this.style.setProperty('border', '1px solid transparent', 'important');
          }
        }
      });

      suggestionItem.addEventListener('mouseleave', function() {
        if (suggestionItems.indexOf(this) !== selectedIndex) {
          this._xIsHovering = false;
          updateSelection();
        }
      });

      switchButton.addEventListener('click', function(event) {
        event.stopPropagation();
        chrome.runtime.sendMessage({
          action: 'switchToTab',
          tabId: tab.id
        });
      });

      suggestionItem.addEventListener('click', function() {
        chrome.runtime.sendMessage({
          action: 'switchToTab',
          tabId: tab.id
        });
      });

      leftSide.appendChild(iconSlot);
      leftSide.appendChild(title);
      suggestionItem.appendChild(leftSide);
      suggestionItem.appendChild(switchButton);
      suggestionsContainer.appendChild(suggestionItem);

      const themeSourceSuggestion = {
        url: tab.url || '',
        favicon: tab.favIconUrl || ''
      };
      const immediateTheme = getImmediateThemeForSuggestion(themeSourceSuggestion) || defaultTheme;
      suggestionItem._xTheme = immediateTheme;
      applyThemeVariables(suggestionItem, immediateTheme);
      getThemeForSuggestion(themeSourceSuggestion).then((theme) => {
        if (!suggestionItem.isConnected) {
          return;
        }
        suggestionItem._xTheme = theme;
        updateSelection();
      });
    });

    selectedIndex = -1;
    setSuggestionsVisible(true);
  }

  function requestTabsAndRender() {
    chrome.runtime.sendMessage({ action: 'getTabsForOverlay' }, (response) => {
      const freshTabs = response && Array.isArray(response.tabs) ? response.tabs : [];
      if (freshTabs.length === 0) {
        setSuggestionsVisible(false);
        return;
      }
      tabs = freshTabs;
      renderTabSuggestions(freshTabs);
    });
  }

  function clearSearchSuggestions() {
    inlineSearchState = null;
    siteSearchTriggerState = null;
    suggestionsContainer.innerHTML = '';
    suggestionItems.length = 0;
    currentSuggestions = [];
    lastSuggestionResponse = [];
    selectedIndex = -1;
    lastRenderedQuery = '';
    setSuggestionsVisible(false);
  }

  function renderSuggestions(suggestions, query) {
    if (!query) {
      clearSearchSuggestions();
      return;
    }
    lastSuggestionResponse = Array.isArray(suggestions) ? suggestions : [];

    getShortcutRules().then((rules) => {
      if (query !== latestQuery) {
        return;
      }
      const rawTagInput = (latestRawQuery || inputParts.input.value || '').trim();
      const modeCommandActive = isModeCommand(rawTagInput);
      if (modeCommandActive) {
        if (storageArea) {
          storageArea.get([THEME_STORAGE_KEY], (result) => {
            const storedMode = result[THEME_STORAGE_KEY] || 'system';
            if (storedMode !== currentThemeMode && query === latestQuery) {
              currentThemeMode = storedMode;
              renderSuggestions([], query);
            }
          });
        }
      }
      const commandMatch = !modeCommandActive ? getCommandMatch(rawTagInput) : null;
      const hasCommand = Boolean(commandMatch);
      const preSuggestions = [];
      if (modeCommandActive) {
        preSuggestions.push(buildModeSuggestion());
      } else {
        if (hasCommand) {
          preSuggestions.push(buildCommandSuggestion(commandMatch.command));
        }
        const directUrlSuggestion = getDirectUrlSuggestion(query);
        if (directUrlSuggestion) {
          preSuggestions.push(directUrlSuggestion);
        }
        const keywordSuggestions = buildKeywordSuggestions(query, rules);
        preSuggestions.push(...keywordSuggestions);
      }

      const providersForTags = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
        ? siteSearchProvidersCache
        : defaultSiteSearchProviders;
      if (!siteSearchProvidersCache && !pendingProviderReload) {
        pendingProviderReload = true;
        getSiteSearchProviders().then((items) => {
          pendingProviderReload = false;
          if (query !== latestQuery) {
            return;
          }
          siteSearchProvidersCache = items;
          renderSuggestions(suggestions, query);
        });
      }
      const inlineCandidate = (!siteSearchState && !modeCommandActive && !hasCommand)
        ? getInlineSiteSearchCandidate(rawTagInput, providersForTags)
        : null;
      let inlineSuggestion = null;
      if (inlineCandidate) {
        const inlineUrl = buildSearchUrl(inlineCandidate.provider.template, inlineCandidate.query);
        if (inlineUrl) {
          inlineSuggestion = {
            type: 'inlineSiteSearch',
            title: formatMessage('search_in_site', '在 {site} 中搜索', {
              site: getSiteSearchDisplayName(inlineCandidate.provider)
            }),
            url: inlineUrl,
            favicon: getProviderIcon(inlineCandidate.provider),
            provider: inlineCandidate.provider
          };
        }
      }

      const newTabSuggestion = modeCommandActive
        ? null
        : {
          type: 'newtab',
          title: formatMessage('search_query', '搜索 "{query}"', {
            query: query
          }),
          url: buildDefaultSearchUrl(query),
          favicon: getDefaultSearchEngineFaviconUrl(),
          searchQuery: query,
          forceSearch: true
        };

      let allSuggestions = modeCommandActive
        ? [...preSuggestions]
        : [...preSuggestions, newTabSuggestion, ...suggestions];
      if (!modeCommandActive && siteSearchState && query) {
        const siteUrl = buildSearchUrl(siteSearchState.template, query);
        if (siteUrl) {
          allSuggestions.unshift({
            type: 'siteSearch',
            title: formatMessage('search_in_site_query', '在 {site} 中搜索 "{query}"', {
              site: getSiteSearchDisplayName(siteSearchState),
              query: query
            }),
            url: siteUrl,
            favicon: getProviderIcon(siteSearchState),
            provider: siteSearchState
          });
        }
      }

      const onlyKeywordSuggestions = allSuggestions.length > 0 &&
        allSuggestions.every((item) => item && (item.type === 'googleSuggest' || item.type === 'newtab'));

      let autocompleteCandidate = null;
      let primaryHighlightIndex = -1;
      let primaryHighlightReason = 'none';
      let topSiteMatch = null;
      let siteSearchPrompt = null;
      let mergedProvider = null;
      let primarySuggestion = null;
      const inlineEnabled = Boolean(inlineSuggestion);
      let siteSearchTrigger = null;
      if (!modeCommandActive && !hasCommand) {
        if (!siteSearchState && !inlineEnabled) {
          topSiteMatch = promoteTopSiteMatch(allSuggestions, latestRawQuery.trim());
        }
        siteSearchTrigger = (!siteSearchState && !inlineEnabled)
          ? getSiteSearchTriggerCandidate(rawTagInput, providersForTags, topSiteMatch)
          : null;
        if (siteSearchTrigger && !topSiteMatch) {
          siteSearchPrompt = {
            type: 'siteSearchPrompt',
            title: formatMessage('search_in_site', '在 {site} 中搜索', {
              site: getSiteSearchDisplayName(siteSearchTrigger)
            }),
            url: '',
            favicon: getProviderIcon(siteSearchTrigger),
            provider: siteSearchTrigger
          };
          allSuggestions.unshift(siteSearchPrompt);
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'siteSearchPrompt';
        }
        if (!siteSearchState && !inlineEnabled && !siteSearchPrompt) {
          autocompleteCandidate = getAutocompleteCandidate(allSuggestions, latestRawQuery);
          if (autocompleteCandidate) {
            const candidateIndex = allSuggestions.findIndex((suggestion) => {
              if (!suggestion || suggestion.type === 'newtab') {
                return false;
              }
              if (autocompleteCandidate.url && suggestion.url === autocompleteCandidate.url) {
                return true;
              }
              const suggestionUrlText = getUrlDisplay(suggestion.url);
              if (suggestionUrlText && suggestionUrlText.toLowerCase() === autocompleteCandidate.completion.toLowerCase()) {
                return true;
              }
              if (suggestion.title && suggestion.title.toLowerCase().startsWith(autocompleteCandidate.completion.toLowerCase())) {
                return true;
              }
              return false;
            });
            if (candidateIndex >= 0 && candidateIndex !== 0) {
              const [candidateSuggestion] = allSuggestions.splice(candidateIndex, 1);
              allSuggestions.unshift(candidateSuggestion);
            }
            primaryHighlightIndex = 0;
            primaryHighlightReason = 'autocomplete';
          }
        }
        if (inlineSuggestion) {
          allSuggestions.unshift(inlineSuggestion);
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'inline';
        } else if (!siteSearchPrompt && topSiteMatch) {
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'topSite';
        }
        if (query && primaryHighlightIndex < 0 && allSuggestions.length > 0) {
          primaryHighlightIndex = 0;
          primaryHighlightReason = 'default';
        }
        if (primaryHighlightIndex >= 0) {
          primarySuggestion = allSuggestions[primaryHighlightIndex] || null;
          mergedProvider = findProviderForSuggestionMatch(primarySuggestion, providersForTags);
        }
        applyAutocomplete(allSuggestions);
        const inlineAutoHighlight = Boolean(inlineSuggestion && primaryHighlightIndex === 0);
        inlineSearchState = inlineSuggestion
          ? { url: inlineSuggestion.url, rawInput: rawTagInput, isAuto: inlineAutoHighlight }
          : null;
        const resolvedProvider = mergedProvider || siteSearchTrigger;
        siteSearchTriggerState = resolvedProvider
          ? { provider: resolvedProvider, rawInput: rawTagInput }
          : null;
      } else if (modeCommandActive) {
        clearAutocomplete();
        inlineSearchState = null;
        siteSearchTriggerState = null;
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'modeSwitch';
      } else if (hasCommand) {
        clearAutocomplete();
        inlineSearchState = null;
        siteSearchTriggerState = null;
        primaryHighlightIndex = 0;
        primaryHighlightReason = 'command';
      }
      if (hasCommand) {
        applyAutocomplete(allSuggestions);
      }

      const canAppend = query === lastRenderedQuery &&
        isSuggestionPrefix(currentSuggestions, allSuggestions);
      const startIndex = canAppend ? currentSuggestions.length : 0;
      const shouldAnimateGrowth = canAppend && startIndex < allSuggestions.length;
      const previousHeight = shouldAnimateGrowth
        ? suggestionsContainer.getBoundingClientRect().height
        : 0;
      if (!canAppend) {
        suggestionsContainer.innerHTML = '';
        suggestionItems.length = 0;
        selectedIndex = -1;
      } else {
        suggestionItems.forEach((item, index) => {
          item._xIsAutocompleteTop = index === primaryHighlightIndex;
        });
      }

      currentSuggestions = allSuggestions;
      lastRenderedQuery = query;
      warmIconCache(allSuggestions);

      allSuggestions.forEach(function(suggestion, index) {
        if (index < startIndex) {
          return;
        }
        const suggestionItem = document.createElement('div');
        suggestionItem.id = `_x_extension_newtab_suggestion_item_${index}_2024_unique_`;
        const isLastItem = index === allSuggestions.length - 1;
        const isPrimaryHighlight = index === primaryHighlightIndex;
        const isPrimarySearchSuggest = isPrimaryHighlight && suggestion.type === 'googleSuggest';
        let immediateTheme = getImmediateThemeForSuggestion(suggestion) || defaultTheme;
        if (suggestion.type === 'directUrl' || suggestion.type === 'browserPage') {
          immediateTheme = urlHighlightTheme;
        }
        const shouldUseSearchEngineTheme = isPrimarySearchSuggest ||
          (onlyKeywordSuggestions && isPrimaryHighlight && suggestion.type === 'newtab');
        if (shouldUseSearchEngineTheme) {
          const engineAccent = getBrandAccentForUrl(getDefaultSearchEngineThemeUrl());
          if (engineAccent) {
            immediateTheme = buildTheme(engineAccent);
            immediateTheme._xIsBrand = true;
          }
        }
        const initialHighlight = isPrimaryHighlight ? getHighlightColors(immediateTheme) : null;
        suggestionItem.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 12px 16px !important;
          min-height: 44px !important;
          background: ${isPrimaryHighlight ? initialHighlight.bg : 'transparent'} !important;
          border: ${isPrimaryHighlight ? `1px solid ${initialHighlight.border}` : '1px solid transparent'} !important;
          border-radius: 16px !important;
          cursor: pointer !important;
          transition: background-color 0.2s ease !important;
          box-sizing: border-box !important;
          margin: 0 0 ${isLastItem ? '0' : '6px'} 0 !important;
          line-height: 1.5 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          color: inherit !important;
          font-size: 100% !important;
        font: inherit !important;
        vertical-align: baseline !important;
      `;
        suggestionItems.push(suggestionItem);
        suggestionItem._xIsSearchSuggestion = true;
        suggestionItem._xTheme = immediateTheme;
        suggestionItem._xIsAutocompleteTop = isPrimaryHighlight;
        applyThemeVariables(suggestionItem, immediateTheme);

        const leftSide = document.createElement('div');
        leftSide.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          flex: 1 !important;
          min-width: 0 !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
        `;

        let iconNode = null;
        let iconWrapper = null;
        if (suggestion.type === 'browserPage') {
          const themedIcon = document.createElement('span');
          themedIcon.innerHTML = getRiSvg('ri-window-2-line', 'ri-size-16');
          themedIcon.style.cssText = `
            all: unset !important;
            width: 16px !important;
            height: 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            color: inherit !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          iconNode = themedIcon;
        } else if (suggestion.type === 'directUrl') {
          iconNode = createSearchIcon();
        } else if (suggestion.type === 'commandNewTab') {
          const plusIcon = document.createElement('span');
          plusIcon.innerHTML = getRiSvg('ri-add-line', 'ri-size-16');
          plusIcon.style.cssText = `
            all: unset !important;
            width: 16px !important;
            height: 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            color: var(--x-nt-subtext, #6B7280) !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          iconNode = plusIcon;
        } else if (suggestion.type === 'commandSettings') {
          const gearIcon = document.createElement('span');
          gearIcon.innerHTML = getRiSvg('ri-settings-3-line', 'ri-size-16');
          gearIcon.style.cssText = `
            all: unset !important;
            width: 16px !important;
            height: 16px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            color: var(--x-nt-subtext, #6B7280) !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          iconNode = gearIcon;
        } else if (suggestion.type === 'newtab' || suggestion.type === 'googleSuggest') {
          const searchIcon = createSearchIcon();
          searchIcon.style.setProperty('color', 'var(--x-nt-subtext, #6B7280)', 'important');
          iconNode = searchIcon;
        } else if (suggestion.favicon) {
          const suggestionHost = suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : '';
          const isLocalSuggestion = suggestionHost && isLocalNetworkHost(suggestionHost);
          if (isLocalSuggestion) {
            iconNode = createLinkIcon();
          } else {
            const favicon = document.createElement('img');
            favicon.decoding = 'async';
            favicon.loading = 'eager';
            favicon.referrerPolicy = 'no-referrer';
            if (index < 4) {
              favicon.fetchPriority = 'high';
            }
            const faviconPageUrl = suggestion && suggestion.url ? suggestion.url : (suggestion.favicon || '');
            attachFaviconWithFallbacks(favicon, faviconPageUrl, suggestionHost);
            favicon.style.cssText = `
              all: unset !important;
              width: 16px !important;
              height: 16px !important;
              border-radius: 2px !important;
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              line-height: 1 !important;
              text-decoration: none !important;
              list-style: none !important;
              outline: none !important;
              background: transparent !important;
              color: inherit !important;
              font-size: 100% !important;
              font: inherit !important;
              vertical-align: baseline !important;
              display: block !important;
              object-fit: contain !important;
            `;
            iconNode = favicon;
          }
        } else {
          const suggestionHost = suggestion && suggestion.url ? getHostFromUrl(suggestion.url) : '';
          if (suggestionHost && isLocalNetworkHost(suggestionHost)) {
            const linkIcon = createLinkIcon();
            linkIcon.style.setProperty('color', 'var(--x-nt-subtext, #6B7280)', 'important');
            iconNode = linkIcon;
          } else {
            const searchIcon = createSearchIcon();
            searchIcon.style.setProperty('color', 'var(--x-nt-subtext, #6B7280)', 'important');
            iconNode = searchIcon;
          }
        }

        if (iconNode) {
          const isFaviconIcon = iconNode.tagName === 'IMG';
          const iconSlot = document.createElement('span');
          iconSlot.style.cssText = `
            all: unset !important;
            width: 24px !important;
            height: 24px !important;
            border-radius: 8px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 0 !important;
            line-height: 1 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            background: transparent !important;
            transition: background-color 0.2s ease !important;
            color: var(--x-nt-subtext, #6B7280) !important;
            font-size: 100% !important;
            font: inherit !important;
            vertical-align: baseline !important;
          `;
          iconSlot._xIsFavicon = isFaviconIcon;
          iconSlot.appendChild(iconNode);
          iconNode = iconSlot;
          suggestionItem._xIconWrap = iconSlot;
          suggestionItem._xIconIsFavicon = isFaviconIcon;
          if (suggestion.type === 'directUrl' || suggestion.type === 'browserPage') {
            iconWrapper = iconSlot;
          }
        }

        const textWrapper = document.createElement('div');
        textWrapper.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          gap: 6px !important;
          flex: 1 !important;
          min-width: 0 !important;
          overflow: visible !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 8px 0 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
        `;

        const title = document.createElement('span');
        const baseTitle = suggestion.title || '';
        let highlightedTitle;
        if (isPrimarySearchSuggest ||
            suggestion.type === 'chatgpt' ||
            suggestion.type === 'perplexity' ||
            suggestion.type === 'newtab' ||
            suggestion.type === 'siteSearch' ||
            suggestion.type === 'inlineSiteSearch' ||
            suggestion.type === 'siteSearchPrompt' ||
            suggestion.type === 'modeSwitch') {
          highlightedTitle = baseTitle;
        } else {
          highlightedTitle = baseTitle;
        }
        title.textContent = '';
        renderHighlightedText(title, highlightedTitle, query, {
          background: 'var(--x-ext-mark-bg, #CFE8FF)',
          color: 'var(--x-ext-mark-text, #1E3A8A)'
        });
        title.style.cssText = `
          all: unset !important;
          color: var(--x-nt-text, #111827) !important;
          font-size: 14px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-weight: 400 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1.5 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          display: inline-block !important;
          vertical-align: baseline !important;
        `;
        suggestionItem._xTitle = title;

        textWrapper.appendChild(title);

        if (suggestion.type === 'history' && !suggestion.isTopSite) {
          const urlLine = buildUrlLine(suggestion.url || '');
          if (urlLine) {
            textWrapper.appendChild(urlLine);
          }
          const historyTag = document.createElement('span');
          historyTag.textContent = '历史';
          historyTag._xDefaultBg = 'var(--x-nt-tag-bg, #F3F4F6)';
          historyTag._xDefaultText = 'var(--x-nt-tag-text, #6B7280)';
          historyTag._xDefaultBorder = 'transparent';
          historyTag.style.cssText = `
            all: unset !important;
            background: var(--x-nt-tag-bg, #F3F4F6) !important;
            color: var(--x-nt-tag-text, #6B7280) !important;
            font-size: 10px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            padding: 4px 6px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
            line-height: 1.2 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            border: 1px solid transparent !important;
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
          `;
          textWrapper.appendChild(historyTag);
          suggestionItem._xHistoryTag = historyTag;
        }

        if (suggestion.type === 'topSite' || suggestion.isTopSite) {
          const urlLine = buildUrlLine(suggestion.url || '');
          if (urlLine) {
            textWrapper.appendChild(urlLine);
          }
          const topSiteTag = document.createElement('span');
          topSiteTag.textContent = '常用';
          topSiteTag._xDefaultBg = 'var(--x-nt-tag-bg, #F3F4F6)';
          topSiteTag._xDefaultText = 'var(--x-nt-tag-text, #6B7280)';
          topSiteTag._xDefaultBorder = 'transparent';
          topSiteTag.style.cssText = `
            all: unset !important;
            background: var(--x-nt-tag-bg, #F3F4F6) !important;
            color: var(--x-nt-tag-text, #6B7280) !important;
            font-size: 10px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            padding: 4px 6px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
            line-height: 1.2 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            border: 1px solid transparent !important;
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
          `;
          textWrapper.appendChild(topSiteTag);
          suggestionItem._xTopSiteTag = topSiteTag;
        }

        if (suggestion.type === 'bookmark') {
          if (suggestion.path) {
            const bookmarkPath = document.createElement('span');
            bookmarkPath.textContent = suggestion.path;
            bookmarkPath.style.cssText = `
              all: unset !important;
              color: var(--x-nt-link, #2563EB) !important;
              font-size: 12px !important;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
              text-decoration: none !important;
              white-space: nowrap !important;
              overflow: hidden !important;
              text-overflow: ellipsis !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              line-height: 1.2 !important;
              display: inline-block !important;
              vertical-align: middle !important;
            `;
            textWrapper.appendChild(bookmarkPath);
          }
          const bookmarkTag = document.createElement('span');
          bookmarkTag.textContent = '书签';
          bookmarkTag._xDefaultBg = 'var(--x-nt-bookmark-tag-bg, #FEF3C7)';
          bookmarkTag._xDefaultText = 'var(--x-nt-bookmark-tag-text, #D97706)';
          bookmarkTag._xDefaultBorder = 'transparent';
          bookmarkTag.style.cssText = `
            all: unset !important;
            background: var(--x-nt-bookmark-tag-bg, #FEF3C7) !important;
            color: var(--x-nt-bookmark-tag-text, #D97706) !important;
            font-size: 10px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            padding: 4px 6px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
            line-height: 1.2 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            border: 1px solid transparent !important;
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
          `;
          textWrapper.appendChild(bookmarkTag);
          suggestionItem._xBookmarkTag = bookmarkTag;
        }

        const rightSide = document.createElement('div');
        rightSide.style.cssText = `
          all: unset !important;
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          flex-shrink: 0 !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
        `;

        const actionTags = document.createElement('div');
        actionTags.style.cssText = `
          all: unset !important;
          display: none !important;
          align-items: center !important;
          gap: 6px !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 0 !important;
          line-height: 1 !important;
          text-decoration: none !important;
          list-style: none !important;
          outline: none !important;
          background: transparent !important;
          color: inherit !important;
          font-size: 100% !important;
          font: inherit !important;
          vertical-align: baseline !important;
          flex-shrink: 0 !important;
        `;

        const isTopSiteMatch = Boolean(topSiteMatch && suggestion === topSiteMatch);
        const isDirectHighlight = isPrimaryHighlight &&
          (suggestion.type === 'directUrl' || suggestion.type === 'browserPage');
        const isMergedHighlight = Boolean(mergedProvider && primarySuggestion === suggestion && isPrimaryHighlight);
        const shouldShowEnterTag = !isPrimarySearchSuggest && isPrimaryHighlight &&
          !onlyKeywordSuggestions &&
          (primaryHighlightReason === 'topSite' ||
            primaryHighlightReason === 'inline' ||
            primaryHighlightReason === 'autocomplete' ||
            isDirectHighlight ||
            isMergedHighlight);
        const shouldShowSiteSearchTag = !isPrimarySearchSuggest && isPrimaryHighlight &&
          ((siteSearchTrigger && (primaryHighlightReason === 'siteSearchPrompt' || isTopSiteMatch)) ||
            isMergedHighlight);
        if (shouldShowEnterTag) {
          actionTags.appendChild(createActionTag(t('visit_label', '访问'), 'Enter'));
        }
        if (shouldShowSiteSearchTag) {
          actionTags.appendChild(createActionTag(t('action_search', '搜索'), 'Tab'));
        }
        if (isPrimaryHighlight && onlyKeywordSuggestions && suggestion.type === 'newtab') {
          actionTags.appendChild(createActionTag(getSearchActionLabel(), 'Enter'));
        }

        suggestionItem._xTagContainer = actionTags;
        suggestionItem._xHasActionTags = actionTags.childNodes.length > 0;

        suggestionItem.addEventListener('mouseenter', function() {
          if (suggestionItems.indexOf(this) !== selectedIndex) {
            this._xIsHovering = true;
            setNonFaviconIconBg(this, true);
            if (selectedIndex === -1 && this._xIsAutocompleteTop) {
              return;
            }
            const theme = this._xTheme;
            if (theme && theme._xIsBrand) {
              const hover = getHoverColors(theme);
              this.style.setProperty('background', hover.bg, 'important');
              this.style.setProperty('border', `1px solid ${hover.border}`, 'important');
            } else {
              this.style.setProperty('background', 'var(--x-nt-hover-bg, #F3F4F6)', 'important');
              this.style.setProperty('border', '1px solid transparent', 'important');
            }
          }
        });

        suggestionItem.addEventListener('mouseleave', function() {
          if (suggestionItems.indexOf(this) !== selectedIndex) {
            this._xIsHovering = false;
            updateSelection();
          }
        });

        suggestionItem.addEventListener('click', function() {
          if (suggestion.type === 'commandNewTab') {
            chrome.runtime.sendMessage({ action: 'openNewTab' });
            return;
          }
          if (suggestion.type === 'commandSettings') {
            chrome.runtime.sendMessage({ action: 'openOptionsPage' });
            return;
          }
          if (suggestion.type === 'siteSearchPrompt' && suggestion.provider) {
            activateSiteSearch(suggestion.provider);
            inputParts.input.focus();
            return;
          }
          if (suggestion.type === 'modeSwitch') {
            setThemeMode(suggestion.nextMode);
            inputParts.input.focus();
            return;
          }
          if (suggestion.forceSearch && suggestion.searchQuery) {
            navigateToQuery(suggestion.searchQuery, true);
            return;
          }
          navigateToUrl(suggestion.url);
        });

        leftSide.appendChild(iconNode);
        leftSide.appendChild(textWrapper);
        suggestionItem.appendChild(leftSide);
        rightSide.appendChild(actionTags);
        suggestionItem.appendChild(rightSide);
        if (iconWrapper) {
          suggestionItem._xDirectIconWrap = iconWrapper;
        }
        suggestionsContainer.appendChild(suggestionItem);

        if (!shouldUseSearchEngineTheme &&
            !(onlyKeywordSuggestions && suggestion.type === 'newtab') &&
            suggestion.type !== 'directUrl' &&
            suggestion.type !== 'browserPage') {
          getThemeForSuggestion(suggestion).then((theme) => {
            if (!suggestionItem.isConnected) {
              return;
            }
            suggestionItem._xTheme = theme;
            applyThemeVariables(suggestionItem, theme);
            updateSelection();
          });
        }
      });

      updateSelection();
      if (shouldAnimateGrowth) {
        animateSuggestionsGrowth(suggestionsContainer, previousHeight);
      }
      setSuggestionsVisible(true);
    });
  }

  function requestSuggestions(query, options) {
    latestQuery = query;
    const immediate = options && options.immediate;
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(function() {
      const requestQuery = latestQuery;
      chrome.runtime.sendMessage({
        action: 'getSearchSuggestions',
        query: requestQuery
      }, function(response) {
        if (requestQuery !== latestQuery) {
          return;
        }
        if (chrome.runtime && chrome.runtime.lastError) {
          renderSuggestions([], requestQuery);
          return;
        }
        if (response && response.suggestions) {
          renderSuggestions(response.suggestions, requestQuery);
          return;
        }
        renderSuggestions([], requestQuery);
      });
    }, immediate ? 0 : 120);
  }

  const inputParts = createSearchInput({
    containerId: '_x_extension_newtab_input_container_2024_unique_',
    inputId: '_x_extension_newtab_search_input_2024_unique_',
    iconId: '_x_extension_newtab_search_icon_2024_unique_',
    placeholder: t('search_placeholder', defaultPlaceholderText),
    containerStyleOverrides: {
      'border-radius': '24px',
      'background': 'var(--x-nt-input-bg, rgba(255, 255, 255, 0.9))',
      'border': '1px solid var(--x-nt-input-border, rgba(0, 0, 0, 0.06))',
      'box-shadow': 'var(--x-nt-input-shadow, 0 20px 60px rgba(0, 0, 0, 0.08))',
      'position': 'relative',
      'z-index': '3'
    },
    inputStyleOverrides: {
      'border-bottom': 'none',
      'color': 'var(--x-nt-text, #111827)',
      'caret-color': 'var(--x-nt-link, #2563EB)',
      'padding': '8px 52px 8px 44px'
    },
    iconStyleOverrides: {
      'color': 'var(--x-nt-subtext, #6B7280)'
    },
    rightIconStyleOverrides: {
      cursor: 'pointer'
    },
    onInput: function(event) {
      const rawValue = event.target.value;
      const query = rawValue.trim();
      updateModeBadge(rawValue);
      const inputType = event && event.inputType;
      const isPaste = inputType === 'insertFromPaste';
      const isDelete = inputType && inputType.startsWith('delete');
      if (isDelete) {
        lastDeletionAt = Date.now();
      }
      if (isComposing) {
        latestQuery = query;
        latestRawQuery = rawValue;
        return;
      }
      if (!query) {
        latestQuery = '';
        latestRawQuery = '';
        clearAutocomplete();
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        clearSearchSuggestions();
        return;
      }
      latestRawQuery = rawValue;
      clearAutocomplete();
      if (isModeCommand(query) || getCommandMatch(query)) {
        latestQuery = query;
        renderSuggestions([], query);
        return;
      }
      if (isPaste || getDirectUrlSuggestion(query)) {
        latestQuery = query;
        renderSuggestions([], query);
        requestSuggestions(query, { immediate: true });
        return;
      }
      requestSuggestions(query);
    },
    onKeyDown: function(event) {
      if (event.key !== 'Backspace' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        latestRawQuery = inputParts.input.value;
        latestQuery = inputParts.input.value.trim();
      }
      if (event.key === 'Escape' && siteSearchState) {
        event.preventDefault();
        clearSiteSearch();
        return;
      }
      if (event.key === 'Backspace' && siteSearchState && !inputParts.input.value) {
        clearSiteSearch();
        return;
      }
      if (isComposing || (event && event.isComposing)) {
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (suggestionItems.length === 0) {
          return;
        }
        event.preventDefault();
        if (event.key === 'ArrowDown') {
          if (selectedIndex === -1) {
            const autoIndex = getAutoHighlightIndex();
            selectedIndex = autoIndex >= 0
              ? (autoIndex + 1) % suggestionItems.length
              : 0;
          } else {
            selectedIndex = (selectedIndex + 1) % suggestionItems.length;
          }
        } else {
          if (selectedIndex === 0) {
            selectedIndex = -1;
          } else if (selectedIndex === -1) {
            const autoIndex = getAutoHighlightIndex();
            if (autoIndex > 0) {
              selectedIndex = autoIndex - 1;
            } else if (autoIndex === 0) {
              selectedIndex = -1;
            } else {
              selectedIndex = suggestionItems.length - 1;
            }
          } else {
            selectedIndex = selectedIndex - 1;
          }
        }
        updateSelection();
        return;
      }
      if (event.key === 'Tab' && handleTabKey) {
        handleTabKey(event);
        return;
      }
      if (event.key !== 'Enter') {
        return;
      }
      const query = event.target.value.trim();
      if (!query) {
        return;
      }
      const commandMatch = getCommandMatch(query);
      if (commandMatch && selectedIndex === -1) {
        if (commandMatch.command.type === 'commandNewTab') {
          chrome.runtime.sendMessage({ action: 'openNewTab' });
          return;
        }
        if (commandMatch.command.type === 'commandSettings') {
          chrome.runtime.sendMessage({ action: 'openOptionsPage' });
          return;
        }
      }
      if (isModeCommand(query)) {
        setThemeMode(getNextThemeMode(currentThemeMode));
        return;
      }
      const executeSuggestion = (selectedSuggestion) => {
        if (!selectedSuggestion) {
          return false;
        }
        if (selectedSuggestion.type === 'modeSwitch') {
          setThemeMode(selectedSuggestion.nextMode);
          return true;
        }
        if (selectedSuggestion.type === 'commandNewTab') {
          chrome.runtime.sendMessage({ action: 'openNewTab' });
          return true;
        }
        if (selectedSuggestion.type === 'commandSettings') {
          chrome.runtime.sendMessage({ action: 'openOptionsPage' });
          return true;
        }
        if (selectedSuggestion.type === 'siteSearchPrompt' && selectedSuggestion.provider) {
          activateSiteSearch(selectedSuggestion.provider);
          inputParts.input.focus();
          return true;
        }
        if (selectedSuggestion.forceSearch && selectedSuggestion.searchQuery) {
          navigateToQuery(selectedSuggestion.searchQuery, true);
          return true;
        }
        if (selectedSuggestion.url) {
          navigateToUrl(selectedSuggestion.url);
          return true;
        }
        return false;
      };
      if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
        if (executeSuggestion(currentSuggestions[selectedIndex])) {
          return;
        }
      } else {
        const autoIndex = getAutoHighlightIndex();
        if (autoIndex >= 0 && currentSuggestions[autoIndex]) {
          if (executeSuggestion(currentSuggestions[autoIndex])) {
            return;
          }
        }
      }
      if (siteSearchState) {
        const siteUrl = buildSearchUrl(siteSearchState.template, query);
        if (siteUrl) {
          navigateToUrl(siteUrl);
          return;
        }
      }
      const currentRawInput = (latestRawQuery || inputParts.input.value || '').trim();
      if (inlineSearchState && inlineSearchState.isAuto &&
          inlineSearchState.url && inlineSearchState.rawInput === currentRawInput) {
        navigateToUrl(inlineSearchState.url);
        return;
      }
      if (autocompleteState && autocompleteState.url) {
        navigateToUrl(autocompleteState.url);
        return;
      }
      resolveQuickNavigation(query).then((targetUrl) => {
        if (targetUrl) {
          navigateToUrl(targetUrl);
          return;
        }
        navigateToQuery(query);
      });
    }
  });

  const shouldAutoFocus = window.location.search.includes('focus=1') ||
    window.location.hash.includes('focus');
  if (shouldAutoFocus) {
    setTimeout(() => {
      inputParts.input.focus();
    }, 0);
  }

  function isEditableElement(el) {
    if (!el) {
      return false;
    }
    const tagName = el.tagName ? el.tagName.toLowerCase() : '';
    if (tagName === 'input' || tagName === 'textarea') {
      return true;
    }
    return Boolean(el.isContentEditable);
  }

  function handleGlobalTypingFocus(event) {
    if (!event || event.defaultPrevented || event.isComposing) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    const activeElement = document.activeElement;
    if (activeElement === inputParts.input || isEditableElement(activeElement)) {
      return;
    }
    const key = event.key || '';
    if (!key || key === 'Tab' || key === 'Escape' || key.startsWith('Arrow')) {
      return;
    }
    inputParts.input.focus();
    const currentValue = inputParts.input.value || '';
    if (key === 'Backspace') {
      if (currentValue) {
        inputParts.input.value = currentValue.slice(0, -1);
        inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      event.preventDefault();
      return;
    }
    if (key.length === 1) {
      inputParts.input.value = currentValue + key;
      inputParts.input.setSelectionRange(inputParts.input.value.length, inputParts.input.value.length);
      inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
      event.preventDefault();
    }
  }

  function shouldFocusOnBackground(target) {
    if (!target) {
      return false;
    }
    if (target === inputParts.input || inputParts.input.contains(target)) {
      return false;
    }
    if (inputContainer && (target === inputContainer || inputContainer.contains(target))) {
      return false;
    }
    if (isEditableElement(target)) {
      return false;
    }
    if (modeBadge && modeBadge.contains(target)) {
      return false;
    }
    if (rightIcon && (target === rightIcon || rightIcon.contains(target))) {
      return false;
    }
    if (suggestionsContainer && suggestionsContainer.contains(target)) {
      return false;
    }
    return true;
  }

  window.addEventListener('keydown', handleGlobalTypingFocus, true);
  window.addEventListener('pointerdown', function(event) {
    if (!event || event.defaultPrevented) {
      return;
    }
    if (shouldFocusOnBackground(event.target)) {
      inputParts.input.focus();
    }
  }, true);
  modeBadge = document.createElement('div');
  modeBadge.id = '_x_extension_newtab_mode_badge_2024_unique_';
  modeBadge.style.cssText = `
    all: unset !important;
    position: absolute !important;
    right: 52px !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    display: none !important;
    align-items: center !important;
    gap: 6px !important;
    background: var(--x-nt-tag-bg, #F3F4F6) !important;
    color: var(--x-nt-tag-text, #6B7280) !important;
    border: 1px solid var(--x-nt-panel-border, rgba(0, 0, 0, 0.08)) !important;
    border-radius: 999px !important;
    padding: 4px 8px !important;
    font-size: 11px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    font-weight: 500 !important;
    line-height: 1 !important;
    white-space: nowrap !important;
    max-width: 180px !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    box-sizing: border-box !important;
    pointer-events: none !important;
    z-index: 1 !important;
  `;
  inputParts.container.appendChild(modeBadge);
  const searchInput = inputParts.input;
  const inputContainer = inputParts.container;
  const rightIcon = inputParts.rightIcon;

  if (rightIcon) {
    rightIcon.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
        return;
      }
      window.open(chrome.runtime.getURL('options.html'), '_blank');
    });
  }
  const defaultPlaceholder = searchInput.placeholder;
  const defaultCaretColor = searchInput.style.caretColor || '#7DB7FF';
  let baseInputPaddingLeft = null;
  const prefixGap = 6;

  const siteSearchPrefix = document.createElement('span');
  siteSearchPrefix.id = '_x_extension_newtab_site_search_prefix_2024_unique_';
  siteSearchPrefix.style.cssText = `
    all: unset !important;
    position: absolute !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
    left: 50px !important;
    display: none !important;
    white-space: nowrap !important;
    font-size: 16px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
    line-height: 1 !important;
    color: var(--x-nt-subtext, #6B7280) !important;
    pointer-events: none !important;
    z-index: 1 !important;
  `;
  inputContainer.appendChild(siteSearchPrefix);

  function getBaseInputPaddingLeft() {
    if (baseInputPaddingLeft === null) {
      const computed = parseFloat(window.getComputedStyle(searchInput).paddingLeft);
      baseInputPaddingLeft = Number.isFinite(computed) ? computed : 50;
    }
    return baseInputPaddingLeft;
  }

  function updateSiteSearchPrefixLayout() {
    const basePadding = getBaseInputPaddingLeft();
    siteSearchPrefix.style.setProperty('left', `${basePadding}px`, 'important');
    if (siteSearchPrefix.style.display === 'none') {
      searchInput.style.setProperty('padding-left', `${basePadding}px`, 'important');
      return;
    }
    const prefixWidth = siteSearchPrefix.getBoundingClientRect().width;
    const paddedLeft = Math.max(basePadding + prefixWidth + prefixGap, basePadding);
    searchInput.style.setProperty('padding-left', `${paddedLeft}px`, 'important');
  }

  function setSiteSearchPrefix(provider, theme) {
    const prefixText = formatMessage('search_in_site_ellipsis', '在 {site} 中搜索...', {
      site: getSiteSearchDisplayName(provider)
    });
    siteSearchPrefix.textContent = prefixText;
    siteSearchPrefix.style.setProperty('display', 'inline-flex', 'important');
    const resolvedTheme = theme ? getThemeForMode(theme) : null;
    if (resolvedTheme && resolvedTheme.placeholderText) {
      siteSearchPrefix.style.setProperty('color', resolvedTheme.placeholderText, 'important');
    }
    searchInput.placeholder = '';
    if (resolvedTheme && resolvedTheme.placeholderText) {
      searchInput.style.setProperty('caret-color', resolvedTheme.placeholderText, 'important');
    }
    updateSiteSearchPrefixLayout();
  }

  function clearSiteSearchPrefix() {
    siteSearchPrefix.textContent = '';
    siteSearchPrefix.style.setProperty('display', 'none', 'important');
    searchInput.placeholder = defaultPlaceholder;
    searchInput.style.setProperty('caret-color', defaultCaretColor, 'important');
    updateSiteSearchPrefixLayout();
  }

  window.addEventListener('resize', updateSiteSearchPrefixLayout);

  handleTabKey = function(event) {
    if (siteSearchState) {
      return false;
    }
    const rawValue = inputParts.input.value;
    const rawTrigger = latestRawQuery || rawValue;
    const triggerInput = (rawTrigger || rawValue).trim();
    if (siteSearchTriggerState &&
        siteSearchTriggerState.rawInput === triggerInput &&
        siteSearchTriggerState.provider) {
      event.preventDefault();
      activateSiteSearch(siteSearchTriggerState.provider);
      return true;
    }
    if (triggerInput) {
      event.preventDefault();
      const providers = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
        ? siteSearchProvidersCache
        : defaultSiteSearchProviders;
      const topSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
      const directProvider = getSiteSearchTriggerCandidate(triggerInput, providers, topSiteMatch);
      if (directProvider) {
        activateSiteSearch(directProvider);
        return true;
      }
      getSiteSearchProviders().then((items) => {
        const asyncTopSiteMatch = getTopSiteMatchCandidate(currentSuggestions, triggerInput);
        const asyncProvider = getSiteSearchTriggerCandidate(triggerInput, items, asyncTopSiteMatch);
        if (asyncProvider) {
          activateSiteSearch(asyncProvider);
          return;
        }
        if (autocompleteState && autocompleteState.completion) {
          inputParts.input.value = autocompleteState.completion;
          inputParts.input.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
          latestRawQuery = autocompleteState.completion;
          latestQuery = autocompleteState.completion.trim();
          autocompleteState = null;
          inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      return true;
    }
    if (autocompleteState && autocompleteState.completion) {
      event.preventDefault();
      inputParts.input.value = autocompleteState.completion;
      inputParts.input.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
      latestRawQuery = autocompleteState.completion;
      latestQuery = autocompleteState.completion.trim();
      autocompleteState = null;
      inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    return false;
  };

  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Tab') {
      return;
    }
    if (document.activeElement !== inputParts.input) {
      return;
    }
    if (handleTabKey) {
      handleTabKey(event);
    }
  }, true);

  getSiteSearchProviders();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (!storageAreaName || areaName !== storageAreaName ||
        (!changes[SITE_SEARCH_STORAGE_KEY] && !changes[SITE_SEARCH_DISABLED_STORAGE_KEY])) {
      return;
    }
    if (!storageArea) {
      return;
    }
    storageArea.get([SITE_SEARCH_STORAGE_KEY, SITE_SEARCH_DISABLED_STORAGE_KEY], (result) => {
      const customItems = Array.isArray(result[SITE_SEARCH_STORAGE_KEY]) ? result[SITE_SEARCH_STORAGE_KEY] : [];
      const disabledKeys = Array.isArray(result[SITE_SEARCH_DISABLED_STORAGE_KEY])
        ? result[SITE_SEARCH_DISABLED_STORAGE_KEY].map((item) => String(item).toLowerCase()).filter(Boolean)
        : [];
      const baseItems = defaultSiteSearchProviders.filter((item) => {
        const key = String(item && item.key ? item.key : '').toLowerCase();
        return key && !disabledKeys.includes(key);
      });
      siteSearchProvidersCache = mergeCustomProvidersLocal(baseItems, customItems);
      if (latestQuery) {
        requestSuggestions(latestQuery, { immediate: true });
      }
    });
  });

  inputParts.input.addEventListener('compositionstart', function() {
    isComposing = true;
    clearAutocomplete();
  });

  inputParts.input.addEventListener('compositionend', function(event) {
    isComposing = false;
    const rawValue = event.target.value;
    const query = rawValue.trim();
    latestQuery = query;
    latestRawQuery = rawValue;
    clearAutocomplete();
    if (!query) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      clearSearchSuggestions();
      return;
    }
    requestSuggestions(query);
  });

  root.appendChild(inputParts.container);
  root.appendChild(suggestionsContainer);
  document.body.appendChild(recentSection);
  window.addEventListener('visibilitychange', handleRecentVisibilityChange);
  window.addEventListener('focus', () => loadRecentSites());

})();
