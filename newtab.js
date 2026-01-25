(function() {
  const root = document.getElementById('_x_extension_newtab_root_2024_unique_');
  const createSearchInput = window._x_extension_createSearchInput_2024_unique_;
  if (!root || typeof createSearchInput !== 'function') {
    return;
  }

  let latestQuery = '';
  let latestRawQuery = '';
  let autocompleteState = null;
  let debounceTimer = null;

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

      promoteDomainPrefixMatch(allSuggestions, latestRawQuery.trim());

      const autocompleteCandidate = getAutocompleteCandidate(allSuggestions, latestRawQuery);
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

      applyAutocomplete(allSuggestions);

      allSuggestions.forEach(function(suggestion, index) {
        const suggestionItem = document.createElement('div');
        suggestionItem.id = `_x_extension_newtab_suggestion_item_${index}_2024_unique_`;
        const isLastItem = index === allSuggestions.length - 1;
        const isAutocompleteTop = Boolean(
          autocompleteCandidate &&
          index === 0 &&
          ((autocompleteCandidate.url && suggestion.url === autocompleteCandidate.url) ||
            (getUrlDisplay(suggestion.url) &&
              getUrlDisplay(suggestion.url).toLowerCase() === autocompleteCandidate.completion.toLowerCase()) ||
            (suggestion.title && suggestion.title.toLowerCase().startsWith(autocompleteCandidate.completion.toLowerCase())))
        );
        suggestionItem.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 12px 16px !important;
          background: ${isAutocompleteTop ? '#EEF6FF' : '#FFFFFF'} !important;
          border: ${isAutocompleteTop ? '1px solid #BFDBFE' : '1px solid transparent'} !important;
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
        if (suggestion.type !== 'newtab') {
          highlightedTitle = suggestion.title.replace(
            new RegExp(`(${query})`, 'gi'),
            '<mark style="background: #CFE8FF; color: #1E3A8A; padding: 2px 4px; border-radius: 3px; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, \'Helvetica Neue\', Arial, sans-serif;">$1</mark>'
          );
        }
        title.innerHTML = highlightedTitle;
        title.style.cssText = `
          all: unset !important;
          color: #111827 !important;
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
          this.style.setProperty('background-color', '#F9FAFB', 'important');
        });
        
        suggestionItem.addEventListener('mouseleave', function() {
          this.style.setProperty('background-color', isAutocompleteTop ? '#EEF6FF' : '#FFFFFF', 'important');
        });
        
        suggestionItem.addEventListener('click', function() {
          navigateToUrl(suggestion.url);
        });
        
        suggestionsContainer.appendChild(suggestionItem);
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
      if (!query) {
        latestQuery = '';
        latestRawQuery = '';
        clearAutocomplete();
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
      if (event.key === 'Tab' && autocompleteState && autocompleteState.completion) {
        event.preventDefault();
        inputParts.input.value = autocompleteState.completion;
        inputParts.input.setSelectionRange(autocompleteState.completion.length, autocompleteState.completion.length);
        latestRawQuery = autocompleteState.completion;
        latestQuery = autocompleteState.completion.trim();
        autocompleteState = null;
        inputParts.input.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      if (event.key !== 'Enter') {
        return;
      }
      const query = event.target.value.trim();
      if (!query) {
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

  root.appendChild(inputParts.container);
  root.appendChild(suggestionsContainer);
})();
