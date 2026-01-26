(function() {
  const root = document.getElementById('_x_extension_newtab_root_2024_unique_');
  const createSearchInput = window._x_extension_createSearchInput_2024_unique_;
  if (!root || typeof createSearchInput !== 'function') {
    return;
  }

  const THEME_STORAGE_KEY = '_x_extension_theme_mode_2024_unique_';
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let mediaListenerAttached = false;

  function resolveTheme(mode) {
    if (mode === 'dark') {
      return 'dark';
    }
    if (mode === 'light') {
      return 'light';
    }
    return mediaQuery.matches ? 'dark' : 'light';
  }

  function applyThemeMode(mode) {
    const resolved = resolveTheme(mode);
    document.body.setAttribute('data-theme', resolved);
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
    chrome.storage.local.get([THEME_STORAGE_KEY], (result) => {
      const mode = result[THEME_STORAGE_KEY] || 'system';
      if (mode === 'system') {
        document.body.setAttribute('data-theme', resolveTheme(mode));
      }
    });
  }

  chrome.storage.local.get([THEME_STORAGE_KEY], (result) => {
    applyThemeMode(result[THEME_STORAGE_KEY] || 'system');
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[THEME_STORAGE_KEY]) {
      return;
    }
    applyThemeMode(changes[THEME_STORAGE_KEY].newValue || 'system');
  });

  let latestQuery = '';
  let latestRawQuery = '';
  let autocompleteState = null;
  let inlineSearchState = null;
  let isComposing = false;
  let siteSearchState = null;
  let debounceTimer = null;
  let tabs = [];
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
    const accentRgb = resolvedTheme.accentRgb || parseCssColor(resolvedTheme.accent) || defaultAccentColor;
    return {
      bg: resolvedTheme.highlightBg || rgbToCss(mixColor(accentRgb, [255, 255, 255], 0.88)),
      border: resolvedTheme.highlightBorder || rgbToCss(mixColor(accentRgb, [255, 255, 255], 0.68))
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
      const hostname = new URL(url).hostname;
      return getBrandAccentForHost(hostname);
    } catch (e) {
      return null;
    }
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

  function getThemeFromUrl(url) {
    if (!url) {
      return Promise.resolve(defaultTheme);
    }
    if (themeColorCache.has(url)) {
      return Promise.resolve(themeColorCache.get(url));
    }
    const brandAccent = getBrandAccentForUrl(url);
    if (brandAccent) {
      const brandTheme = buildTheme(brandAccent);
      themeColorCache.set(url, brandTheme);
      return Promise.resolve(brandTheme);
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

  function getThemeForProvider(provider) {
    if (provider && provider.template) {
      const brandAccent = getBrandAccentForUrl(provider.template);
      if (brandAccent) {
        return Promise.resolve(buildTheme(brandAccent));
      }
    }
    return getThemeFromUrl(getProviderIcon(provider));
  }

  function getThemeForSuggestion(suggestion) {
    if (suggestion && suggestion.provider) {
      return getThemeForProvider(suggestion.provider);
    }
    if (suggestion && suggestion.url) {
      const brandAccent = getBrandAccentForUrl(suggestion.url);
      if (brandAccent) {
        return Promise.resolve(buildTheme(brandAccent));
      }
    }
    return getThemeFromUrl(getThemeSourceForSuggestion(suggestion));
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
      font-weight: 600 !important;
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
    background: var(--x-nt-suggestions-bg, #FFFFFF) !important;
    border-radius: 20px !important;
    border: 1px solid var(--x-nt-suggestions-border, rgba(0, 0, 0, 0.06)) !important;
    box-shadow: var(--x-nt-suggestions-shadow, 0 18px 44px rgba(0, 0, 0, 0.08)) !important;
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

  function getSiteSearchTriggerCandidate(input, providers, topSiteMatch) {
    const trimmed = String(input || '').trim();
    if (!trimmed || /\s/.test(trimmed)) {
      return null;
    }
    const provider = findSiteSearchProvider(trimmed, providers) ||
      findSiteSearchProviderByKey(trimmed, providers);
    if (!provider) {
      return null;
    }
    if (topSiteMatch && trimmed.length <= 2 && matchesTopSitePrefix(topSiteMatch, trimmed)) {
      return null;
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

  const suggestionItems = [];
  let selectedIndex = -1;
  let currentSuggestions = [];
  let siteSearchTriggerState = null;

  function getAutoHighlightIndex() {
    return suggestionItems.findIndex((item) => Boolean(item && item._xIsAutocompleteTop));
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
      const shouldShow = isActive && item._xHasActionTags;
      item._xTagContainer.style.setProperty('display', shouldShow ? 'inline-flex' : 'none', 'important');
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
        return;
      }
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

  function renderTabSuggestions(tabList) {
    suggestionsContainer.innerHTML = '';
    suggestionItems.length = 0;
    currentSuggestions = [];
    const list = Array.isArray(tabList) ? tabList : [];
    if (list.length === 0) {
      setSuggestionsVisible(false);
      return;
    }
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
      suggestionItem._xTheme = defaultTheme;
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
      favicon.src = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%23E3E4E8" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
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
      `;

      const title = document.createElement('span');
      title.textContent = tab.title || '无标题';
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
      switchButton.innerHTML = '切换到标签页 <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
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
          this.style.setProperty('background-color', 'var(--x-nt-hover-bg, #F3F4F6)', 'important');
          this.style.setProperty('border', '1px solid transparent', 'important');
        }
      });

      suggestionItem.addEventListener('mouseleave', function() {
        if (suggestionItems.indexOf(this) !== selectedIndex) {
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

      leftSide.appendChild(favicon);
      leftSide.appendChild(title);
      suggestionItem.appendChild(leftSide);
      suggestionItem.appendChild(switchButton);
      suggestionsContainer.appendChild(suggestionItem);

      const themeSourceSuggestion = {
        url: tab.url || '',
        favicon: tab.favIconUrl || ''
      };
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
    selectedIndex = -1;
    setSuggestionsVisible(false);
  }

  function renderSuggestions(suggestions, query) {
    suggestionsContainer.innerHTML = '';
    suggestionItems.length = 0;
    currentSuggestions = [];
    selectedIndex = -1;
    if (!query) {
      clearSearchSuggestions();
      return;
    }

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

      const providersForTags = (siteSearchProvidersCache && siteSearchProvidersCache.length > 0)
        ? siteSearchProvidersCache
        : defaultSiteSearchProviders;
      const rawTagInput = (latestRawQuery || inputParts.input.value || '').trim();
      const inlineCandidate = !siteSearchState
        ? getInlineSiteSearchCandidate(rawTagInput, providersForTags)
        : null;
      let inlineSuggestion = null;
      if (inlineCandidate) {
        const inlineUrl = buildSearchUrl(inlineCandidate.provider.template, inlineCandidate.query);
        if (inlineUrl) {
          inlineSuggestion = {
            type: 'inlineSiteSearch',
            title: `在 ${getSiteSearchDisplayName(inlineCandidate.provider)} 中搜索`,
            url: inlineUrl,
            favicon: getProviderIcon(inlineCandidate.provider),
            provider: inlineCandidate.provider
          };
        }
      }

      const newTabSuggestion = {
        type: 'newtab',
        title: `搜索 "${query}"`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        favicon: 'https://img.icons8.com/?size=100&id=ejub91zEY6Sl&format=png&color=000000'
      };

      const allSuggestions = [...preSuggestions, newTabSuggestion, ...suggestions];
      if (siteSearchState && query) {
        const siteUrl = buildSearchUrl(siteSearchState.template, query);
        if (siteUrl) {
          allSuggestions.unshift({
            type: 'siteSearch',
            title: `在 ${getSiteSearchDisplayName(siteSearchState)} 中搜索 "${query}"`,
            url: siteUrl,
            favicon: getProviderIcon(siteSearchState),
            provider: siteSearchState
          });
        }
      }

      let autocompleteCandidate = null;
      let primaryHighlightIndex = -1;
      let primaryHighlightReason = 'none';
      let topSiteMatch = null;
      let siteSearchPrompt = null;
      const inlineEnabled = Boolean(inlineSuggestion);
      if (!siteSearchState && !inlineEnabled) {
        topSiteMatch = promoteTopSiteMatch(allSuggestions, latestRawQuery.trim());
      }
      const siteSearchTrigger = (!siteSearchState && !inlineEnabled)
        ? getSiteSearchTriggerCandidate(rawTagInput, providersForTags, topSiteMatch)
        : null;
      if (siteSearchTrigger && !topSiteMatch) {
        siteSearchPrompt = {
          type: 'siteSearchPrompt',
          title: `在 ${getSiteSearchDisplayName(siteSearchTrigger)} 中搜索`,
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

      currentSuggestions = allSuggestions;
      applyAutocomplete(allSuggestions);
      const inlineAutoHighlight = Boolean(inlineSuggestion && primaryHighlightIndex === 0);
      inlineSearchState = inlineSuggestion
        ? { url: inlineSuggestion.url, rawInput: rawTagInput, isAuto: inlineAutoHighlight }
        : null;
      siteSearchTriggerState = siteSearchTrigger
        ? { provider: siteSearchTrigger, rawInput: rawTagInput }
        : null;

      allSuggestions.forEach(function(suggestion, index) {
        const suggestionItem = document.createElement('div');
        suggestionItem.id = `_x_extension_newtab_suggestion_item_${index}_2024_unique_`;
        const isLastItem = index === allSuggestions.length - 1;
        const isPrimaryHighlight = index === primaryHighlightIndex;
        suggestionItem.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          padding: 12px 16px !important;
          background: ${isPrimaryHighlight ? defaultTheme.highlightBg : 'transparent'} !important;
          border: ${isPrimaryHighlight ? `1px solid ${defaultTheme.highlightBorder}` : '1px solid transparent'} !important;
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
        suggestionItem._xTheme = defaultTheme;
        suggestionItem._xIsAutocompleteTop = isPrimaryHighlight;
        applyThemeVariables(suggestionItem, defaultTheme);

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
        if (suggestion.type === 'browserPage') {
          const themedIcon = document.createElement('span');
          themedIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--x-ext-icon-color, #6B7280)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="14" rx="2"/><line x1="3" y1="8" x2="21" y2="8"/><circle cx="7" cy="6" r="1"/><circle cx="11" cy="6" r="1"/></svg>`;
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
        } else {
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
          iconNode = favicon;
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
        if (suggestion.type === 'chatgpt' || suggestion.type === 'perplexity' || suggestion.type === 'newtab' || suggestion.type === 'siteSearch' || suggestion.type === 'inlineSiteSearch' || suggestion.type === 'siteSearchPrompt') {
          highlightedTitle = baseTitle;
        } else {
          highlightedTitle = baseTitle.replace(
            new RegExp(`(${query})`, 'gi'),
            '<mark style="background: var(--x-ext-mark-bg, #CFE8FF); color: var(--x-ext-mark-text, #1E3A8A); padding: 2px 4px; border-radius: 3px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif;">$1</mark>'
          );
        }
        title.innerHTML = highlightedTitle;
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
        const shouldShowEnterTag = isPrimaryHighlight &&
          (primaryHighlightReason === 'topSite' ||
            primaryHighlightReason === 'inline' ||
            primaryHighlightReason === 'autocomplete');
        const shouldShowSiteSearchTag = isPrimaryHighlight &&
          siteSearchTrigger &&
          (primaryHighlightReason === 'siteSearchPrompt' || isTopSiteMatch);
        if (shouldShowEnterTag) {
          actionTags.appendChild(createActionTag('访问', 'Enter'));
        }
        if (shouldShowSiteSearchTag) {
          actionTags.appendChild(createActionTag('搜索', 'Tab'));
        }

        suggestionItem._xTagContainer = actionTags;
        suggestionItem._xHasActionTags = actionTags.childNodes.length > 0;

        suggestionItem.addEventListener('mouseenter', function() {
          if (suggestionItems.indexOf(this) !== selectedIndex) {
            this.style.setProperty('background', 'var(--x-nt-hover-bg, #F3F4F6)', 'important');
            this.style.setProperty('border', '1px solid transparent', 'important');
          }
        });

        suggestionItem.addEventListener('mouseleave', function() {
          if (suggestionItems.indexOf(this) !== selectedIndex) {
            updateSelection();
          }
        });

        suggestionItem.addEventListener('click', function() {
          if (suggestion.type === 'siteSearchPrompt' && suggestion.provider) {
            activateSiteSearch(suggestion.provider);
            inputParts.input.focus();
            return;
          }
          navigateToUrl(suggestion.url);
        });

        leftSide.appendChild(iconNode);
        leftSide.appendChild(textWrapper);
        suggestionItem.appendChild(leftSide);
        rightSide.appendChild(actionTags);
        suggestionItem.appendChild(rightSide);
        suggestionsContainer.appendChild(suggestionItem);

        getThemeForSuggestion(suggestion).then((theme) => {
          if (!suggestionItem.isConnected) {
            return;
          }
          suggestionItem._xTheme = theme;
          applyThemeVariables(suggestionItem, theme);
          updateSelection();
        });
      });

      updateSelection();
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
      'background': 'var(--x-nt-input-bg, rgba(255, 255, 255, 0.9))',
      'border': '1px solid var(--x-nt-input-border, rgba(0, 0, 0, 0.06))',
      'box-shadow': 'var(--x-nt-input-shadow, 0 20px 60px rgba(0, 0, 0, 0.08))'
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
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        clearSearchSuggestions();
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
      if (selectedIndex >= 0 && currentSuggestions[selectedIndex]) {
        const selectedSuggestion = currentSuggestions[selectedIndex];
        if (selectedSuggestion.type === 'siteSearchPrompt' && selectedSuggestion.provider) {
          activateSiteSearch(selectedSuggestion.provider);
          inputParts.input.focus();
          return;
        }
        if (selectedSuggestion.url) {
          navigateToUrl(selectedSuggestion.url);
          return;
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
    const prefixText = `在 ${getSiteSearchDisplayName(provider)} 中搜索...`;
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

})();
