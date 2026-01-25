(function() {
  const root = document.getElementById('_x_extension_newtab_root_2024_unique_');
  const createSearchInput = window._x_extension_createSearchInput_2024_unique_;
  if (!root || typeof createSearchInput !== 'function') {
    return;
  }

  let latestQuery = '';
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

  function renderSuggestions(suggestions, query) {
    suggestionsContainer.innerHTML = '';
    if (!query) {
      setSuggestionsVisible(false);
      return;
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
        .catch(() => []);
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

      allSuggestions.forEach(function(suggestion, index) {
        const suggestionItem = document.createElement('div');
        suggestionItem.id = `_x_extension_newtab_suggestion_item_${index}_2024_unique_`;
        const isLastItem = index === allSuggestions.length - 1;
        suggestionItem.style.cssText = `
          all: unset !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 12px 16px !important;
          background: #FFFFFF !important;
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
          overflow: hidden !important;
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
        
        if (suggestion.type === 'history') {
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
        
        if (suggestion.type === 'topSite') {
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
          this.style.setProperty('background-color', '#FFFFFF', 'important');
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
      const query = event.target.value.trim();
      if (!query) {
        latestQuery = '';
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        suggestionsContainer.innerHTML = '';
        setSuggestionsVisible(false);
        return;
      }
      requestSuggestions(query);
    },
    onKeyDown: function(event) {
      if (event.key !== 'Enter') {
        return;
      }
      const query = event.target.value.trim();
      if (!query) {
        return;
      }
      navigateToQuery(query);
    }
  });

  root.appendChild(inputParts.container);
  root.appendChild(suggestionsContainer);
  setTimeout(() => inputParts.input.focus(), 100);
})();
