(function() {
  const root = document.getElementById('_x_extension_newtab_root_2024_unique_');
  const createSearchInput = window._x_extension_createSearchInput_2024_unique_;
  if (!root || typeof createSearchInput !== 'function') {
    return;
  }

  let latestQuery = '';
  let latestRawQuery = '';
  let autocompleteState = null;
  let inlineSearchState = null;
  let isComposing = false;
  let siteSearchState = null;
  let debounceTimer = null;
  let siteSearchProvidersCache = null;
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
  const themeColorCache = new Map();

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

  function getLuminance(rgb) {
    const [r, g, b] = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function getReadableTextColor(bgRgb) {
    return getLuminance(bgRgb) > 0.68 ? '#111827' : '#F8FAFC';
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

  function buildTheme(rgb) {
    const accent = normalizeAccentColor(rgb);
    const highlightBg = mixColor(accent, [255, 255, 255], 0.86);
    const highlightBorder = mixColor(accent, [255, 255, 255], 0.62);
    const markBg = mixColor(accent, [255, 255, 255], 0.78);
    const tagBg = mixColor(accent, [255, 255, 255], 0.74);
    const keyBg = mixColor(accent, [255, 255, 255], 0.9);
    const tagBorder = mixColor(accent, [255, 255, 255], 0.58);
    const keyBorder = mixColor(accent, [0, 0, 0], 0.18);
    const buttonText = getLuminance(accent) > 0.8
      ? rgbToCss(mixColor(accent, [0, 0, 0], 0.6))
      : rgbToCss(accent);
    return {
      accent: rgbToCss(accent),
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
      buttonBg: rgbToCss(mixColor(accent, [255, 255, 255], 0.94)),
      buttonBorder: rgbToCss(mixColor(accent, [255, 255, 255], 0.7)),
      placeholderText: buttonText
    };
  }

  const defaultTheme = buildTheme(defaultAccentColor);

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

  function getThemeFromUrl(url) {
    if (!url) {
      return Promise.resolve(defaultTheme);
    }
    if (themeColorCache.has(url)) {
      return Promise.resolve(themeColorCache.get(url));
    }
    return new Promise((resolve) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = function() {
        const avg = extractAverageColor(image);
        const theme = buildTheme(avg || defaultAccentColor);
        themeColorCache.set(url, theme);
        resolve(theme);
      };
      image.onerror = function() {
        themeColorCache.set(url, defaultTheme);
        resolve(defaultTheme);
      };
      image.src = url;
    });
  }

  function applyThemeVariables(target, theme) {
    if (!target || !theme) {
      return;
    }
    target.style.setProperty('--x-ext-mark-bg', theme.markBg, 'important');
    target.style.setProperty('--x-ext-mark-text', theme.markText, 'important');
    target.style.setProperty('--x-ext-tag-bg', theme.tagBg, 'important');
    target.style.setProperty('--x-ext-tag-text', theme.tagText, 'important');
    target.style.setProperty('--x-ext-tag-border', theme.tagBorder, 'important');
    target.style.setProperty('--x-ext-key-bg', theme.keyBg, 'important');
    target.style.setProperty('--x-ext-key-text', theme.keyText, 'important');
    target.style.setProperty('--x-ext-key-border', theme.keyBorder, 'important');
  }

  function getThemeSourceForSuggestion(suggestion) {
    if (suggestion && suggestion.url) {
      try {
        const hostname = new URL(suggestion.url).hostname;
        if (hostname) {
          return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
        }
      } catch (e) {
        // Ignore malformed URLs.
      }
    }
    return suggestion && suggestion.favicon ? suggestion.favicon : '';
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

  function navigateToQuery(query) {
    const isUrl = query.includes('.') && !query.includes(' ');
    let targetUrl = query;
    if (isUrl) {
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }
    } else {
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    }
    navigateToUrl(targetUrl);
  }

  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.id = '_x_extension_newtab_suggestions_container_2024_unique_';
  suggestionsContainer.style.cssText = `
    all: unset !important;
    width: 100% !important;
    margin-top: 14px !important;
    background: #FFFFFF !important;
    border-radius: 20px !important;
    border: 1px solid rgba(0, 0, 0, 0.06) !important;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.08) !important;
    padding: 8px !important;
    box-sizing: border-box !important;
    display: block !important;
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

  function setSuggestionsVisible(visible) {
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
      color: #2563EB !important;
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
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch (e) {
      return '';
    }
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
        if (items.length > 0) {
          siteSearchProvidersCache = items;
        }
        return items;
      })
      .catch(() => []);
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getSiteSearchProviders' }, (response) => {
        const items = response && Array.isArray(response.items) ? response.items : [];
        if (items.length > 0) {
          siteSearchProvidersCache = items;
          resolve(items);
          return;
        }
        localFallback.then((localItems) => {
          if (localItems.length > 0) {
            siteSearchProvidersCache = localItems;
            resolve(localItems);
            return;
          }
          siteSearchProvidersCache = defaultSiteSearchProviders;
          resolve(defaultSiteSearchProviders);
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
      return '站内';
    }
    return provider.name || provider.key || '站内';
  }

  function getProviderHost(provider) {
    if (!provider || !provider.template) {
      return '';
    }
    try {
      const url = provider.template.replace(/\{query\}/g, 'test');
      return new URL(url).hostname.toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function normalizeHost(host) {
    return String(host || '').toLowerCase().replace(/^www\./i, '');
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
    const providerIcon = getProviderIcon(provider);
    getThemeFromUrl(providerIcon).then((theme) => {
      if (siteSearchState === provider) {
        setSiteSearchPrefix(provider, theme);
      }
    });
    suggestionsContainer.innerHTML = '';
    setSuggestionsVisible(false);
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
          title: `打开 ${targetUrl}`,
          url: targetUrl,
          favicon: 'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
        });
      } else if (rule.type === 'url' && rule.url) {
        matches.push({
          type: 'browserPage',
          title: `打开 ${rule.url}`,
          url: rule.url,
          favicon: 'https://img.icons8.com/?size=100&id=1LqgD1Q7n2fy&format=png&color=000000'
        });
      }
    });
    return matches;
  }

  function getDirectUrlSuggestion(input) {
    const queryLower = input.toLowerCase();
    const isInternal = ['chrome://', 'edge://', 'brave://', 'vivaldi://', 'opera://'].some((prefix) =>
      queryLower.startsWith(prefix)
    );
    const ipMatch = input.trim().match(/^\d{1,3}([.\s]\d{1,3}){3}$/);
    const normalizedIp = ipMatch ? input.trim().replace(/\s+/g, '.').replace(/\.{2,}/g, '.') : '';
    const looksLikeUrl = (input.includes('.') && !input.includes(' ')) || isInternal || Boolean(normalizedIp);
    if (!looksLikeUrl) {
      return null;
    }
    let targetUrl = normalizedIp || input;
    if (!isInternal && !targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    return {
      type: 'directUrl',
      title: `打开 ${targetUrl}`,
      url: targetUrl,
      favicon: 'https://img.icons8.com/?size=100&id=QeJX4E2mC0fF&format=png&color=000000'
    };
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

  function renderSuggestions(suggestions, query) {
    suggestionsContainer.innerHTML = '';
    if (!query) {
      inlineSearchState = null;
      setSuggestionsVisible(false);
      return;
    }

    function isSearchEngineResultUrl(url) {
      try {
        const parsedUrl = new URL(url);
        const hostname = parsedUrl.hostname.toLowerCase();
        const path = parsedUrl.pathname.toLowerCase();
        const searchHosts = [
          'google.',
          'bing.com',
          'baidu.com',
          'duckduckgo.com',
          'search.yahoo.com',
          'yandex.com',
          'sogou.com',
          'so.com'
        ];
        const isKnownHost = searchHosts.some((host) => hostname.includes(host));
        if (!isKnownHost) {
          return false;
        }
        const searchPaths = [
          '/search',
          '/s',
          '/s/2',
          '/web',
          '/?'
        ];
        if (path === '/' && parsedUrl.searchParams.has('q')) {
          return true;
        }
        if (path === '/' && parsedUrl.searchParams.has('wd')) {
          return true;
        }
        if (path === '/' && parsedUrl.searchParams.has('query')) {
          return true;
        }
        if (searchPaths.some((prefix) => path.startsWith(prefix))) {
          return true;
        }
        return false;
      } catch (e) {
        return false;
      }
    }

    const filteredSuggestions = suggestions.filter((suggestion) => {
      if (suggestion.type === 'history' && isSearchEngineResultUrl(suggestion.url)) {
        return false;
      }
      return true;
    });

    getShortcutRules().then((rules) => {
      if (query !== latestQuery) {
        return;
      }
      const preSuggestions = [];
      const directUrlSuggestion = getDirectUrlSuggestion(query);
      if (directUrlSuggestion) {
        preSuggestions.push(directUrlSuggestion);
      }
      const keywordSuggestions = buildKeywordSuggestions(query, rules);
      preSuggestions.push(...keywordSuggestions);

      const providersForInline = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
        ? siteSearchProvidersCache
        : defaultSiteSearchProviders;
      const rawInlineInput = (latestRawQuery || query || '').trim();
      const inlineCandidate = !siteSearchState
        ? getInlineSiteSearchCandidate(rawInlineInput, providersForInline)
        : null;
      let inlineSuggestion = null;
      if (inlineCandidate) {
        const inlineUrl = buildSearchUrl(inlineCandidate.provider.template, inlineCandidate.query);
        if (inlineUrl) {
          inlineSuggestion = {
            type: 'inlineSiteSearch',
            title: `在 ${getSiteSearchDisplayName(inlineCandidate.provider)} 中搜索`,
            url: inlineUrl,
            favicon: getProviderIcon(inlineCandidate.provider)
          };
        }
      }

      const allSuggestions = [
        ...preSuggestions,
        {
          type: 'newtab',
          title: `搜索 "${query}"`,
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
          favicon: 'https://img.icons8.com/?size=100&id=ejub91zEY6Sl&format=png&color=000000'
        },
        ...filteredSuggestions
      ];

      if (siteSearchState && query) {
        const siteUrl = buildSearchUrl(siteSearchState.template, query);
        if (siteUrl) {
          allSuggestions.unshift({
            type: 'siteSearch',
            title: `在 ${getSiteSearchDisplayName(siteSearchState)} 中搜索 "${query}"`,
            url: siteUrl,
            favicon: getProviderIcon(siteSearchState)
          });
        }
      }

      function promoteDomainPrefixMatch(list, queryText) {
        if (!queryText) {
          return null;
        }
        const queryLower = queryText.toLowerCase();
        const matchIndex = list.findIndex((suggestion) => {
          if (!suggestion || suggestion.type === 'newtab') {
            return false;
          }
          if (!(suggestion.type === 'topSite' || suggestion.isTopSite)) {
            return false;
          }
          const urlText = getUrlDisplay(suggestion.url);
          if (!urlText) {
            return false;
          }
          const host = urlText.split('/')[0] || '';
          return host.toLowerCase().startsWith(queryLower);
        });
        if (matchIndex > 0) {
          const [match] = list.splice(matchIndex, 1);
          list.unshift(match);
          return match;
        }
        if (matchIndex === 0) {
          return list[0];
        }
        return null;
      }

      let autocompleteCandidate = null;
      if (!siteSearchState) {
        promoteDomainPrefixMatch(allSuggestions, latestRawQuery.trim());
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
        }
      }

      if (inlineSuggestion) {
        allSuggestions.unshift(inlineSuggestion);
      }

      applyAutocomplete(allSuggestions);
      const inlineAutoHighlight = Boolean(inlineSuggestion && !autocompleteCandidate);
      inlineSearchState = inlineSuggestion
        ? { url: inlineSuggestion.url, rawInput: rawInlineInput, isAuto: inlineAutoHighlight }
        : null;

      allSuggestions.forEach(function(suggestion, index) {
        const suggestionItem = document.createElement('div');
        suggestionItem.id = `_x_extension_newtab_suggestion_item_${index}_2024_unique_`;
        const isLastItem = index === allSuggestions.length - 1;
        const inlineOffset = inlineSuggestion ? 1 : 0;
        const isAutocompleteTop = Boolean(
          (autocompleteCandidate &&
            index === inlineOffset &&
            ((autocompleteCandidate.url && suggestion.url === autocompleteCandidate.url) ||
              (getUrlDisplay(suggestion.url) &&
                getUrlDisplay(suggestion.url).toLowerCase() === autocompleteCandidate.completion.toLowerCase()) ||
              (suggestion.title && suggestion.title.toLowerCase().startsWith(autocompleteCandidate.completion.toLowerCase())))) ||
          (inlineAutoHighlight && suggestion.type === 'inlineSiteSearch' && index === 0)
        );
        suggestionItem.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 12px 16px !important;
          background: ${isAutocompleteTop ? defaultTheme.highlightBg : '#FFFFFF'} !important;
          border: ${isAutocompleteTop ? `1px solid ${defaultTheme.highlightBorder}` : '1px solid transparent'} !important;
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
        suggestionItem._xTheme = defaultTheme;
        suggestionItem._xIsAutocompleteTop = isAutocompleteTop;
        applyThemeVariables(suggestionItem, defaultTheme);
        
        const favicon = document.createElement('img');
        favicon.src = suggestion.favicon || '';
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
        favicon.onerror = function() {
          const searchIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E3E4E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`;
          const fallbackDiv = document.createElement('div');
          fallbackDiv.innerHTML = searchIconSvg;
          fallbackDiv.style.cssText = `
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
          if (favicon.parentNode) {
            favicon.parentNode.replaceChild(fallbackDiv, favicon);
          }
        };
        
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
        
        const title = document.createElement('span');
        let highlightedTitle = suggestion.title;
        if (suggestion.type !== 'newtab' && suggestion.type !== 'inlineSiteSearch') {
          highlightedTitle = suggestion.title.replace(
            new RegExp(`(${query})`, 'gi'),
            '<mark style="background: var(--x-ext-mark-bg, #CFE8FF); color: var(--x-ext-mark-text, #1E3A8A); padding: 2px 4px; border-radius: 3px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif;">$1</mark>'
          );
        }
        title.innerHTML = highlightedTitle;
        title.style.cssText = `
          all: unset !important;
          color: #111827 !important;
          font-size: 14px !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
          font-weight: ${isAutocompleteTop ? '600' : '400'} !important;
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
        
        textWrapper.appendChild(title);
        
        if (suggestion.type === 'history' && !suggestion.isTopSite) {
          const urlLine = buildUrlLine(suggestion.url || '');
          if (urlLine) {
            textWrapper.appendChild(urlLine);
          }
          const historyTag = document.createElement('span');
          historyTag.textContent = '历史';
          historyTag.style.cssText = `
            all: unset !important;
            background: #F3F4F6 !important;
            color: #6B7280 !important;
            font-size: 10px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            padding: 4px 6px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
            line-height: 1.2 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
          `;
          textWrapper.appendChild(historyTag);
        }
        
        if (suggestion.type === 'topSite' || suggestion.isTopSite) {
          const urlLine = buildUrlLine(suggestion.url || '');
          if (urlLine) {
            textWrapper.appendChild(urlLine);
          }
          const topSiteTag = document.createElement('span');
          topSiteTag.textContent = '常用';
          topSiteTag.style.cssText = `
            all: unset !important;
            background: #F3F4F6 !important;
            color: #6B7280 !important;
            font-size: 10px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            padding: 4px 6px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
            line-height: 1.2 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
          `;
          textWrapper.appendChild(topSiteTag);
        }
        
        if (suggestion.type === 'bookmark') {
          if (suggestion.path) {
            const bookmarkPath = document.createElement('span');
            bookmarkPath.textContent = suggestion.path;
            bookmarkPath.style.cssText = `
              all: unset !important;
              color: #2563EB !important;
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
          bookmarkTag.style.cssText = `
            all: unset !important;
            background: #FEF3C7 !important;
            color: #D97706 !important;
            font-size: 10px !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
            padding: 4px 6px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
            line-height: 1.2 !important;
            text-decoration: none !important;
            list-style: none !important;
            outline: none !important;
            display: inline-flex !important;
            align-items: center !important;
            vertical-align: middle !important;
            flex-shrink: 0 !important;
          `;
          textWrapper.appendChild(bookmarkTag);
        }
        
        suggestionItem.appendChild(favicon);
        suggestionItem.appendChild(textWrapper);
        
        suggestionItem.addEventListener('mouseenter', function() {
          this.style.setProperty('background', '#F9FAFB', 'important');
          this.style.setProperty('border', '1px solid transparent', 'important');
        });
        
        suggestionItem.addEventListener('mouseleave', function() {
          if (isAutocompleteTop) {
            const theme = this._xTheme || defaultTheme;
            this.style.setProperty('background', theme.highlightBg, 'important');
            this.style.setProperty('border', `1px solid ${theme.highlightBorder}`, 'important');
            return;
          }
          this.style.setProperty('background', '#FFFFFF', 'important');
          this.style.setProperty('border', '1px solid transparent', 'important');
        });
        
        suggestionItem.addEventListener('click', function() {
          navigateToUrl(suggestion.url);
        });
        
        suggestionsContainer.appendChild(suggestionItem);

        const themeSource = getThemeSourceForSuggestion(suggestion);
        getThemeFromUrl(themeSource).then((theme) => {
          if (!suggestionItem.isConnected) {
            return;
          }
          suggestionItem._xTheme = theme;
          applyThemeVariables(suggestionItem, theme);
          if (suggestionItem._xIsAutocompleteTop) {
            suggestionItem.style.setProperty('background', theme.highlightBg, 'important');
            suggestionItem.style.setProperty('border', `1px solid ${theme.highlightBorder}`, 'important');
          }
        });
      });

      setSuggestionsVisible(true);
    });
  }

  function requestSuggestions(query) {
    latestQuery = query;
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
        if (response && response.suggestions) {
          renderSuggestions(response.suggestions, requestQuery);
        }
      });
    }, 120);
  }

  const inputParts = createSearchInput({
    containerId: '_x_extension_newtab_input_container_2024_unique_',
    inputId: '_x_extension_newtab_search_input_2024_unique_',
    iconId: '_x_extension_newtab_search_icon_2024_unique_',
    containerStyleOverrides: {
      'border-radius': '24px',
      'border': '1px solid rgba(0, 0, 0, 0.06)',
      'box-shadow': '0 20px 60px rgba(0, 0, 0, 0.08)'
    },
    inputStyleOverrides: {
      'border-bottom': 'none'
    },
    onInput: function(event) {
      const rawValue = event.target.value;
      const query = rawValue.trim();
      if (isComposing) {
        latestQuery = query;
        latestRawQuery = rawValue;
        return;
      }
      if (!query) {
        latestQuery = '';
        latestRawQuery = '';
        clearAutocomplete();
        inlineSearchState = null;
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        suggestionsContainer.innerHTML = '';
        setSuggestionsVisible(false);
        return;
      }
      latestRawQuery = rawValue;
      clearAutocomplete();
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
      if (isComposing) {
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
  const searchInput = inputParts.input;
  const inputContainer = inputParts.container;
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
    color: #6B7280 !important;
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
    const prefixText = `在 ${getSiteSearchDisplayName(provider)} 中搜索...`;
    siteSearchPrefix.textContent = prefixText;
    siteSearchPrefix.style.setProperty('display', 'inline-flex', 'important');
    if (theme && theme.placeholderText) {
      siteSearchPrefix.style.setProperty('color', theme.placeholderText, 'important');
    }
    searchInput.placeholder = '';
    if (theme && theme.placeholderText) {
      searchInput.style.setProperty('caret-color', theme.placeholderText, 'important');
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
    const providers = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
      ? siteSearchProvidersCache
      : defaultSiteSearchProviders;
    const directProvider = findSiteSearchProviderByInput(rawTrigger, providers) ||
      findSiteSearchProviderByInput(rawValue, providers);
    if (directProvider) {
      event.preventDefault();
      activateSiteSearch(directProvider);
      return true;
    }
    if (rawTrigger.trim() || rawValue.trim()) {
      event.preventDefault();
      getSiteSearchProviders().then((items) => {
        const asyncProvider = findSiteSearchProviderByInput(rawTrigger, items) ||
          findSiteSearchProviderByInput(rawValue, items);
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
      inlineSearchState = null;
      suggestionsContainer.innerHTML = '';
      setSuggestionsVisible(false);
      return;
    }
    requestSuggestions(query);
  });

  root.appendChild(inputParts.container);
  root.appendChild(suggestionsContainer);
})();
